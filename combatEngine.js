// combatEngine.js: the battle RULES. No graphics, no Phaser, no screen code in this file.
//
// What is here: reading heroes, mobs and skills from the sheets (GAME_DATA), the damage and healing rules,
// effects, turn order, summons, and the enemy AI. The screen (main.js) only asks this file what happened and draws it.
// The engine reports everything through one callback, state.emit(type, unit, text), so any screen (Phaser now, Unity later)
// or a server can follow the same battle.
//
// What is NOT here: pictures, positions on screen, buttons, animation, sounds. Those stay in main.js.
//
// Load order (see index.html): Phaser, dataLoader.js, nodeBattle.js, town.js, combatEngine.js, (passives.js), main.js.
// This file only needs GAME_DATA (from dataLoader.js) when a battle is built, not when the file loads.

// ===== RANDOM NUMBERS =====
// Every random roll in the battle rules (turn order, critical hits, random targets) goes through engineRandom().
// With no seed set it works exactly like Math.random(), so the game plays as before.
// seedEngine(12345) makes the rolls repeatable: the same seed, the same heroes and the same choices give the identical battle.
// That is what lets a server (or a replay) rerun a fight and get the same result. seedEngine(null) goes back to normal.
// Drawing code keeps using Math.random on its own, so sprite wobble never uses up the battle's numbers.
let engineRngState = null;
function seedEngine(seed) {
  engineRngState = (seed === null || seed === undefined) ? null : (Number(seed) >>> 0);
}
function engineRandom() {
  if (engineRngState === null) return Math.random();
  // mulberry32: a small, well-known seeded generator
  engineRngState = (engineRngState + 0x6D2B79F5) >>> 0;
  let t = engineRngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ===== TEST VALUES (placeholders for testing, not approved design numbers) =====
const MAX_SUMMONS = 2;   // total active summons per side (your Notion page 14.2)
const CRIT_MULT = 2.0;   // starting Critical Multiplier (proposed in your damage specification)
const CRIT_BONUS = 0;    // flat damage added after the Critical Multiplier
const ATTR_SCALING = 0.02;   // each point of the attribute an ability names adds 2% of its base damage
const VITALITY_HEALTH = 10;  // each point of Vitality gives 10 health

// ===== DAMAGE TYPES AND RESISTANCE STATES =====
// Parent groups and their child types. Skills use a child type (like 'fire'), and Resistance can be set on a child or a whole group.
const DAMAGE_TYPES = {
  physical: ['slashing', 'crushing', 'piercing'],
  elemental: ['earth', 'water', 'wind', 'fire', 'cold'],
  nature: ['lightning', 'thunder', 'primal', 'astral', 'spiritual'],
  noxious: ['poison', 'disease', 'acid'],
  divine: ['radiant', 'dark', 'necrotic', 'chaos'],
  arcane: ['force', 'psychic', 'gravity', 'temporal'],
};
const PARENT_OF = {};
Object.keys(DAMAGE_TYPES).forEach(function (parent) {
  DAMAGE_TYPES[parent].forEach(function (child) { PARENT_OF[child] = parent; });
});
const RESIST_STATES = ['Vulnerable', 'Normal', 'Resistant', 'Immune'];
const RESIST_MULT = [1.5, 1, 0.5, 0]; // share of damage taken in each state

// A skill's target (set from the Skills tab) is one of: enemy, ally, self, allEnemies, allAllies. basic = the unit's basic attack (a provoked unit must use it).
// The effect types the battle engine knows:
//   shield, hot, dot, deathWard, reflection, thorns, reactiveHeal, accuracyBoost, accuracyReduce, crit, critChanceReduce,
//   critBonus, critBonusReduce, dmgUp, shieldBreak, armorBoost, armorReduce, dmgReduceIn, vulnerable, dmgOutReduce, critResist,
//   critResistWeaken, resistance, weakenResistance, healthBoost, healthReduce, healReceivedBoost, healReceivedReduce, healOutBoost,
//   healOutReduce, attributeBoost, attributeReduce, taunt, provoke, shadow
// Every skill the battle can run, by key. It starts empty: a skill is built from the Skills tab the first time a hero or mob asks for it.
const SKILLS = {};

// ===== BUILDING UNITS FROM YOUR SHEETS =====
// Heroes come from the Hero sheet (five random ones) and enemies from the node's waves.
// Health, Armor, Speed and Dexterity are read from the sheet. If a row leaves one blank, the unit uses the test value below
// and a warning is shown on the battle screen, so a gap in the sheet is never hidden.
const TEST_STATS = { hp: 100, armor: 0, speed: 5, dex: 5 };

// Lowercase and drop spaces and punctuation, so "Max HP" and "maxhp" match
function normKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Finds a value in a sheet row by trying several possible column names. Empty cells count as missing.
function field(row, names, fallback) {
  const wanted = names.map(normKey);
  for (const header in row) {
    if (wanted.indexOf(normKey(header)) !== -1 && row[header] !== '') return row[header];
  }
  return fallback;
}

function statOf(row, names, fallback) {
  const n = Number(field(row, names, fallback));
  return isNaN(n) ? fallback : n;
}

// A percent cell as a fraction: 10 and "10%" both give 0.1. Blank or text gives 0.
function pctStat(row, names) {
  const raw = String(field(row, names, '')).replace('%', '').trim();
  const n = Number(raw);
  return (raw === '' || isNaN(n)) ? 0 : n / 100;
}

// The sprite name a hero or mob row asks for ('' if it has none)
function spriteValueOf(row, isHero) {
  return String(field(row, isHero ? ['Hero Sprite', 'Sprite'] : ['Mob Sprite', 'Sprite'], ''));
}

// Skills come from the Skill 1 to Skill 4 columns (skill IDs from the Skills tab).
function skillsFor(row) {
  const keys = [];
  skillIdsOf(row).forEach(function (sid) {
    const key = sheetSkillKey(sid);
    if (key) keys.push(key);
  });
  const who = String(field(row, ['Hero Name', 'Mob Name', 'Name'], '?'));
  const ult = String(field(row, ['Ultimate'], '')).trim();
  if (ult) sheetWarn(who + ' has an Ultimate (' + ult + '). Ultimates have no button yet, so it is not used', 'note');
  if (!keys.length) {
    sheetWarn(who + ' has no skills. Fill in its Skill 1 to Skill 4 columns');
  } else if (!keys.some(function (k) { return SKILLS[k].basic; })) {
    sheetWarn(who + ' has no Basic Attack. Set one skill\'s Cooldown to "Basic Attack"');
  }
  return keys;
}

// A resistance cell from the Hero or Mob tab: TRUE = Resistant, FALSE or empty = Normal, vulnerable = Vulnerable, immune = Immune
function resistFromCell(v) {
  if (v === true) return 'Resistant';
  if (v === false) return 'Normal';
  if (v === '' || v === undefined || v === null) return null; // blank = no setting here, so the type inherits its group
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === 'resistant') return 'Resistant';
  if (s === 'false' || s === 'normal') return 'Normal'; // an explicit Normal beats the group's state
  if (s === 'vulnerable') return 'Vulnerable';
  if (s === 'immune') return 'Immune';
  return null; // anything else counts as blank
}

// Reads the "<Type> Resistance" columns (Slashing Resistance, Fire Resistance, ...) into base Resistance states.
// A parent group column (like "Elemental Resistance") works too, if you add one.
function resistBaseFromRow(row) {
  const base = {};
  Object.keys(DAMAGE_TYPES).forEach(function (parent) {
    [parent].concat(DAMAGE_TYPES[parent]).forEach(function (type) {
      const state = resistFromCell(field(row, [type + ' Resistance'], ''));
      if (state) base[type] = state;
    });
  });
  return base;
}

// Turns one sheet row into a unit for the battle
// Health = the HP / Health column + Vitality x 10. A row with no HP column uses Vitality alone, and a row with neither uses the test value.
function unitFromRow(row, kind, side, slot, id) {
  const isHero = kind === 'hero';
  const sprite = spriteValueOf(row, isHero);
  const name = String(field(row, ['Name', isHero ? 'Hero Name' : 'Mob Name'], id));
  const vitRaw = field(row, ['Vitality', 'Vit'], '');
  const vitality = (vitRaw !== '' && !isNaN(Number(vitRaw))) ? Number(vitRaw) : null;
  const hpRaw = field(row, ['HP', 'Health', 'Max HP', 'Max Health', 'Hit Points'], '');
  const hpColumn = (hpRaw !== '' && !isNaN(Number(hpRaw))) ? Number(hpRaw) : null;
  const hp = (hpColumn !== null ? hpColumn : (vitality !== null ? 0 : TEST_STATS.hp)) + (vitality !== null ? vitality * VITALITY_HEALTH : 0);
  const dex = statOf(row, ['Dexterity', 'Dex'], TEST_STATS.dex);
  const blank = function (names) { const v = field(row, names, ''); return v === '' || isNaN(Number(v)); };
  const missing = [];
  if (hpColumn === null && vitality === null) missing.push('Vitality');
  if (blank(['Dexterity', 'Dex'])) missing.push('Dexterity');
  if (blank(['Armor', 'Armour'])) missing.push('Armor');
  if (blank(['Speed'])) missing.push('Speed');
  if (missing.length) sheetWarn(name + ' has blank ' + missing.join(', ') + ' in its sheet row. Using test values for now');
  return {
    id: id, name: name, sprite: sprite || 'placeholder_' + id, side: side, slot: slot,
    hp: hp,
    armor: statOf(row, ['Armor', 'Armour'], TEST_STATS.armor),
    speed: statOf(row, ['Speed'], TEST_STATS.speed),
    dex: dex,
    accuracy: statOf(row, ['Accuracy'], 0),
    // Critical columns of the Hero and Mob tabs: chance and resistance are percents (10 = 10%, "10%" works too), the bonus is a flat number
    baseCrit: pctStat(row, ['Critical Chance', 'Crit Chance']),
    baseCritBonus: statOf(row, ['Critical Bonus', 'Crit Bonus'], 0),
    baseCritResist: pctStat(row, ['Critical Resistance', 'Crit Resistance']),
    attrs: {
      strength: statOf(row, ['Strength', 'Str'], 0),
      dexterity: dex,
      wisdom: statOf(row, ['Wisdom', 'Wis'], 0),
      intelligence: statOf(row, ['Intelligence', 'Int'], 0),
      vitality: vitality !== null ? vitality : hp / VITALITY_HEALTH,
    },
    resist: { base: resistBaseFromRow(row) }, // base Resistance states, like { fire: 'Immune', elemental: 'Resistant' }
    skills: skillsFor(row),
  };
}

// ===== SKILLS FROM YOUR SHEET =====
// A row of the Skills tab becomes a skill the battle can run. Heroes and mobs list their skills by ID
// (Skill 1 to Skill 4 columns). This part only READS the rows. The part after the combat rules RUNS them.
//
// What each Skills column means:
//   Scaling Attribute + Scale per point   the attribute that boosts the skill, and the PERCENT per point (2 = 2% per point; blank = 2%)
//   Duration                              "Instant" or "N turn(s)": how long the buffs and debuffs it applies last
//   Cooldown                              "Basic Attack" (the unit's basic attack: no cooldown, not changed by cooldown effects, what a provoked unit must use), "None" or "N turns"
//   A to E groups                         ID (Effects tab), Target, SubType (damage type, attribute...), X, Y, Cond, CondVal
//                                         A Damage group's SubType can split the hit across types: "Fire 1, Cold 1" (type + weight, any number of types)
//   Can Be Dispelled / Can Be Stolen      protect the buffs this skill gives from Dispel and Steal Buff

// Things the sheet gets wrong or asks for that is not built yet. 'error' ones are shown on screen, 'note' ones only in the console.
const SHEET_WARNINGS = [];
function sheetWarn(text, level) {
  if (SHEET_WARNINGS.some(function (w) { return w.text === text; })) return;
  SHEET_WARNINGS.push({ text: text, level: level || 'error' });
  if (typeof console !== 'undefined') console.log('Sheet: ' + text);
}

const SKILL_ATTRS = ['strength', 'dexterity', 'wisdom', 'intelligence', 'vitality'];
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// How each effect ID from the Effects tab is built.
//   run: what the battle does. 'effect' = put a buff or debuff on the target.
//   type / field: the engine effect and which of its numbers X fills. pct: X is a percent. sub: where the SubType goes.
//   scales: X grows with the skill's attribute. foe: hostile, so it rides on the hit (a blocked hit applies none of it).
function pctEffect(type, field, foe) {
  return { run: 'effect', type: type, field: field || 'percent', pct: true, foe: !!foe };
}
const SHEET_EFFECTS = {
  EF001: { run: 'damage', foe: true },
  EF002: { run: 'heal' },
  EF003: { run: 'effect', type: 'hot', field: 'heal', scales: true, source: true },
  EF004: { run: 'lifesteal' },
  EF005: { run: 'effect', type: 'dot', field: 'damage', scales: true, sub: 'damageType', foe: true },
  EF006: { run: 'cleanse', noX: true },
  EF007: { run: 'effect', type: 'deathWard', field: 'hpPercent', pct: true, uses: true },
  EF008: { run: 'shield' },
  EF009: { run: 'ward' },
  EF010: { run: 'reflection' },
  EF011: pctEffect('accuracyBoost'),
  EF012: pctEffect('crit', 'chance'),
  EF013: { run: 'effect', type: 'critBonus', field: 'points' },                 // X = flat damage added to a critical hit
  EF014: pctEffect('dmgUp'),
  EF015: { run: 'shieldBreak' },
  EF016: pctEffect('armorBoost'),
  EF017: pctEffect('dmgReduceIn'),
  EF018: pctEffect('critResist'),
  EF019: { run: 'effect', type: 'resistance', field: 'delta', sub: 'damageType' },
  EF020: pctEffect('healthBoost'),
  EF021: { run: 'effect', type: 'reactiveHeal', field: 'heal', scales: true, source: true },
  EF022: { run: 'effect', type: 'thorns', field: 'damage', scales: true, sub: 'damageType' },
  EF023: pctEffect('healReceivedBoost'),
  EF024: pctEffect('healOutBoost'),
  EF025: { run: 'effect', type: 'attributeBoost', field: 'percent', pct: true, sub: 'attr' },
  EF026: { run: 'taunt', noX: true },
  EF027: { run: 'effect', type: 'provoke', noX: true, source: true, foe: true },
  EF028: { run: 'cdReduce' },
  EF029: { run: 'cdIncrease', foe: true },
  EF030: pctEffect('accuracyReduce', 'percent', true),
  EF031: pctEffect('critChanceReduce', 'chance', true),
  EF032: { run: 'effect', type: 'critBonusReduce', field: 'points', foe: true }, // X = flat damage taken off the Critical Bonus
  EF033: pctEffect('dmgOutReduce', 'percent', true),
  EF034: pctEffect('armorReduce', 'percent', true),
  EF035: pctEffect('vulnerable', 'percent', true),
  EF036: pctEffect('critResistWeaken', 'percent', true),
  EF037: { run: 'effect', type: 'weakenResistance', field: 'delta', sub: 'damageType', foe: true },
  EF038: pctEffect('healthReduce', 'percent', true),
  EF039: pctEffect('healReceivedReduce', 'percent', true),
  EF040: pctEffect('healOutReduce', 'percent', true),
  EF041: { run: 'effect', type: 'attributeReduce', field: 'percent', pct: true, sub: 'attr', foe: true },
  EF042: { run: 'dispel', noX: true, foe: true },
  EF043: { run: 'steal', noX: true, foe: true },
  EF044: { run: 'assist', noX: true, foe: true },
  EF045: { run: 'ignoreTaunt', noX: true },
  EF046: { run: 'resurrect' },
  EF047: { run: 'summon', noX: true },
};

// Target names from the lists tab. The side tells us where a target is when a skill needs the player to pick one.
const ENEMY_TARGETS = ['oneenemy', 'randomenemy', 'allenemies', 'allenemiesminustarget', 'adjacentenemies', 'onedeadenemy', 'alldeadenemies'];
const ALLY_TARGETS = ['oneally', 'randomally', 'allallies', 'allalliesminustarget', 'allalliesminusself', 'adjacentallies', 'onedeadally', 'alldeadallies'];
const UNBUILT_TARGETS = ['onedeadenemy', 'alldeadenemies'];
// Damage aimed at your own side is almost always a slip, so it is aimed at the enemy side and the sheet gets a warning
const ENEMY_FOR_ALLY = {
  oneally: 'oneenemy', randomally: 'randomenemy', allallies: 'allenemies', allalliesminustarget: 'allenemiesminustarget',
  allalliesminusself: 'allenemies', adjacentallies: 'adjacentenemies',
};

function numberOrNull(v) {
  if (v === '' || v === undefined || v === null || typeof v === 'boolean') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// "Instant" / "None" / "" = 0, "3 turns" = 3, 3 = 3
function turnsFrom(v) {
  if (typeof v === 'number') return v;
  const m = String(v === undefined || v === null ? '' : v).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function flagFrom(v) {
  return !(v === false || String(v).trim().toLowerCase() === 'false');
}

function targetToken(raw) {
  return String(raw === undefined || raw === null ? '' : raw).toLowerCase().replace(/[^a-z]/g, '');
}

// The Cond / CondVal pair of a group. Supported so far:
//   "target below 30% health"   the group only affects targets under that health (the number in the text wins over CondVal)
//   "If elemental damage"       a Reflection only reflects that damage type or group (CondVal is the percent when X is 0).
//                               Several are fine: "If fire, cold damage", "If fire or cold damage", "If fire and arcane damage". No Cond = every type.
//   "Summon Mob001"             the mob a Summon calls
function parseCond(text, val) {
  const raw = String(text === undefined || text === null ? '' : text).trim();
  if (!raw) return null;
  const t = raw.toLowerCase();
  let m = t.match(/below\s*(\d+(?:\.\d+)?)\s*%/);
  if (m) return { kind: 'targetBelow', pct: Number(m[1]), val: numberOrNull(val), text: raw };
  if (/below/.test(t) && /health/.test(t) && numberOrNull(val) !== null) return { kind: 'targetBelow', pct: numberOrNull(val), val: null, text: raw };
  m = t.match(/^if\s+(.+?)\s+damage$/);
  if (m) {
    const seen = {}, groups = [];
    m[1].split(/\s*(?:,|;|\/|&|\+|\band\b|\bor\b)\s*/).forEach(function (k) {
      k = k.replace(/[^a-z]/g, '');
      if (k && !seen[k]) { seen[k] = true; groups.push(k); }
    });
    if (groups.length && groups.every(function (k) { return DAMAGE_TYPES[k] || PARENT_OF[k]; })) {
      return { kind: 'damageGroup', group: groups[0], groups: groups, val: numberOrNull(val), text: raw };
    }
  }
  m = raw.match(/^summon\s+(\S+)/i);
  if (m) return { kind: 'summon', mob: m[1], text: raw };
  return { kind: 'unknown', text: raw };
}

// Finds a row in a loaded table by ID, ignoring capital letters
function rowById(table, id) {
  const want = String(id).trim();
  if (!want || !table) return null;
  if (table[want]) return { key: want, row: table[want] };
  const k = Object.keys(table).find(function (x) { return x.toLowerCase() === want.toLowerCase(); });
  return k ? { key: k, row: table[k] } : null;
}

function mobRowFor(id) {
  const found = rowById(typeof GAME_DATA !== 'undefined' ? GAME_DATA.mobs : null, id);
  return found ? found.row : null;
}

// The damage types of one Damage group, from its SubType cell.
//   "Fire"            one type (the usual case)
//   "Fire 1, Cold 1"  a split hit: each part has a type and a weight. The game works out the shares: 1 and 1 is 50% and 50%,
//                     "Fire 2, Cold 1, Primal 1" is 50%, 25%, 25%. Adding another type needs no math.
// Returns [{ type, share, known }] with the shares adding up to 1 (empty if the cell is blank).
function parseDamageParts(raw, where) {
  const text = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!text) return [];
  const order = [], weight = {};
  text.split(/[,;|+&\n]+/).forEach(function (tok) {
    const t = tok.trim();
    if (!t) return;
    const m = t.match(/^([A-Za-z][A-Za-z ]*?)\s*[:=*]?\s*(\d+(?:\.\d+)?)?\s*%?$/);
    if (!m) { sheetWarn(where + ': could not read "' + t + '" in the damage types. Write it like Fire 1, Cold 1'); return; }
    const type = m[1].trim().toLowerCase();
    const w = m[2] === undefined ? 1 : Number(m[2]);
    if (!(w > 0)) { sheetWarn(where + ': "' + t + '" has a weight of 0, so that part is skipped'); return; }
    if (weight[type] === undefined) { weight[type] = 0; order.push(type); }
    weight[type] += w;
  });
  const total = order.reduce(function (a, t) { return a + weight[t]; }, 0);
  return order.map(function (t) {
    return { type: t, share: weight[t] / total, known: !!(DAMAGE_TYPES[t] || PARENT_OF[t]) };
  });
}

// Builds the skill for one Skills-tab row
function buildSheetSkill(id, row) {
  const name = String(field(row, ['Skill Name', 'Name'], id));
  const attrRaw = String(field(row, ['Scaling Attribute'], '')).trim().toLowerCase();
  const attr = SKILL_ATTRS.indexOf(attrRaw) !== -1 ? attrRaw : '';
  if (attrRaw && !attr) sheetWarn(id + ' ' + name + ': Scaling Attribute "' + attrRaw + '" is not Strength, Dexterity, Wisdom, Intelligence or Vitality');
  let scale = ATTR_SCALING;
  const scaleRaw = numberOrNull(field(row, ['Scale per point'], ''));
  if (scaleRaw !== null) {
    scale = scaleRaw / 100; // the sheet holds a percent per point
    if (scaleRaw > 0 && scaleRaw < 1) sheetWarn(id + ' ' + name + ': Scale per point ' + scaleRaw + ' means ' + scaleRaw + '% per point (2 = 2%)', 'note');
  }
  const duration = turnsFrom(field(row, ['Duration'], ''));
  const cdRaw = String(field(row, ['Cooldown'], '')).trim();
  const basic = /basic/i.test(cdRaw); // Cooldown = "Basic Attack": no cooldown, not changed by cooldown effects, what a provoked unit must use
  const cd = basic ? 0 : turnsFrom(cdRaw);
  const sk = {
    id: id, name: name, kind: 'sheet', cd: cd, duration: duration, basic: basic, attr: attr, scale: scale,
    canBeDispelled: flagFrom(field(row, ['Can Be Dispelled'], true)),
    canBeStolen: flagFrom(field(row, ['Can Be Stolen'], true)),
    ignoresTaunt: false, groups: [], target: 'self',
  };

  let lastToken = '';
  GROUP_LETTERS.forEach(function (L) {
    const gid = String(field(row, [L + '_ID'], '')).trim().toUpperCase();
    if (!gid) return;
    const where = id + ' ' + name + ' group ' + L;
    const def = SHEET_EFFECTS[gid];
    if (!def) { sheetWarn(where + ': effect ' + gid + ' is not in the Effects tab list, so it is skipped'); return; }

    // Target: a blank one uses the group above it, or Self for helpful effects and OneEnemy for hostile ones
    let token = targetToken(field(row, [L + '_Target'], ''));
    if (!token) token = lastToken || (def.foe ? 'oneenemy' : 'self');
    if (def.run === 'taunt' || def.run === 'ignoreTaunt' || def.run === 'summon') token = 'self'; // these always belong to the caster
    if (token !== 'self' && ENEMY_TARGETS.indexOf(token) === -1 && ALLY_TARGETS.indexOf(token) === -1) {
      sheetWarn(where + ': target "' + field(row, [L + '_Target'], '') + '" is not a target from the lists tab, so it is skipped');
      return;
    }
    if (UNBUILT_TARGETS.indexOf(token) !== -1) { sheetWarn(where + ': target ' + token + ' is not built yet, so it is skipped'); return; }
    if (def.run === 'damage' && ENEMY_FOR_ALLY[token]) {
      sheetWarn(where + ': Damage was aimed at ' + field(row, [L + '_Target'], token) + ', so it hits the enemy side instead');
      token = ENEMY_FOR_ALLY[token];
    }
    lastToken = token;

    const subRaw = String(field(row, [L + '_SubType'], '')).trim();
    const sub = subRaw.toLowerCase();
    let x = numberOrNull(field(row, [L + '_X'], ''));
    const y = numberOrNull(field(row, [L + '_Y'], ''));
    const cond = parseCond(field(row, [L + '_Cond'], ''), field(row, [L + '_CondVal'], ''));
    const g = { letter: L, id: gid, def: def, token: token, type: sub, x: x, y: y, cond: cond, mobId: '' };
    if (def.run === 'damage') {
      const parts = parseDamageParts(subRaw, where);
      if (parts.length) g.type = parts[0].type;
      if (parts.length > 1) { // a split hit: one hit, one crit roll, the damage shared out by weight
        g.parts = parts.map(function (p) { return { type: p.type, share: p.share }; });
        parts.forEach(function (p) { if (!p.known) sheetWarn(where + ': damage type "' + p.type + '" is not a type from the lists tab'); });
      } else if (parts.length === 1 && !parts[0].known) {
        sheetWarn(where + ': damage type "' + subRaw + '" is not a type from the lists tab', 'note');
      }
    } else if (def.sub === 'damageType' && /[,;|+&]/.test(subRaw)) { // only plain Damage can be split
      const first = parseDamageParts(subRaw, where)[0];
      g.type = first ? first.type : '';
      sheetWarn(where + ': only Damage (EF001) can split damage across types, so only ' + (g.type || 'the first type') + ' is used');
    }

    if (def.run === 'damage' && x === null && y !== null) {
      sheetWarn(where + ': the damage number is in Y, not X. Y was used'); g.x = x = y;
    }
    if (!def.noX && x === null && def.run !== 'shield' && def.run !== 'cdReduce' && def.run !== 'cdIncrease') {
      sheetWarn(where + ': ' + gid + ' has no X number, so it is skipped');
      return;
    }
    if ((def.run === 'cdReduce' || def.run === 'cdIncrease') && x === null) g.x = 1;
    if (def.sub === 'attr' && SKILL_ATTRS.indexOf(sub) === -1) { sheetWarn(where + ': ' + gid + ' needs an attribute in SubType'); return; }
    if (def.sub === 'damageType' && gid !== 'EF005' && gid !== 'EF022' && !sub) { sheetWarn(where + ': ' + gid + ' needs a damage type or group in SubType'); return; }

    if (cond) {
      if (cond.kind === 'unknown') { sheetWarn(where + ': condition "' + cond.text + '" is not built yet, so the group is skipped'); return; }
      if (cond.kind === 'targetBelow' && cond.val !== null && cond.val !== cond.pct) {
        sheetWarn(where + ': the text says below ' + cond.pct + '% but CondVal is ' + cond.val + '. ' + cond.pct + '% was used', 'note');
      }
      if (cond.kind === 'damageGroup' && def.run !== 'reflection') { sheetWarn(where + ': "' + cond.text + '" only works with Reflection, so the group is skipped'); return; }
      if (cond.kind === 'summon') {
        if (def.run !== 'summon') { sheetWarn(where + ': "' + cond.text + '" only works with Summon, so the group is skipped'); return; }
        g.mobId = cond.mob;
      }
    }
    if (def.run === 'summon' && !g.mobId) {
      const xs = String(field(row, [L + '_X'], '')).trim();
      g.mobId = xs; // the mob ID can also go in X
      g.x = null;
    }
    if (def.run === 'summon') {
      if (!g.mobId) { sheetWarn(where + ': Summon needs a mob ID in X (or "Summon Mob001" in Cond)'); return; }
      if (!mobRowFor(g.mobId)) sheetWarn(where + ': mob ' + g.mobId + ' is not in the Mobs tab, so the built-in Undead Warrior is summoned', 'note');
    }
    if (def.run === 'ignoreTaunt') sk.ignoresTaunt = true;
    sk.groups.push(g);
  });

  if (!sk.groups.length) sheetWarn(id + ' ' + name + ': no effect groups could be read, so this skill does nothing');

  // What the skill needs from the player: one enemy, one ally, or nothing
  const tokens = sk.groups.map(function (g) { return g.token; });
  const has = function (list) { return tokens.some(function (t) { return list.indexOf(t) !== -1; }); };
  if (has(['oneenemy', 'allenemiesminustarget', 'adjacentenemies'])) sk.target = 'enemy';
  else if (has(['oneally', 'allalliesminustarget'])) sk.target = 'ally';
  else if (has(['allenemies', 'randomenemy'])) sk.target = 'allEnemies';
  else if (has(['allallies', 'allalliesminusself', 'randomally', 'adjacentallies', 'alldeadallies', 'onedeadally'])) sk.target = 'allAllies';
  return sk;
}

// The SKILLS key for a skill ID from the sheet (it builds the skill the first time it is asked for). null if there is no such skill.
function sheetSkillKey(id) {
  const want = String(id === undefined || id === null ? '' : id).trim();
  if (!want) return null;
  if (SKILLS[want]) return want;
  const found = rowById(typeof GAME_DATA !== 'undefined' ? GAME_DATA.skills : null, want);
  if (!found) { sheetWarn('Skill ' + want + ' is not in the Skills tab'); return null; }
  if (!SKILLS[found.key]) SKILLS[found.key] = buildSheetSkill(found.key, found.row);
  return found.key;
}

// The skill IDs a hero or mob row lists (Skill 1 to Skill 4). The Ultimate column is read but has no button yet.
function skillIdsOf(row) {
  return ['Skill 1', 'Skill 2', 'Skill 3', 'Skill 4']
    .map(function (n) { return String(field(row, [n], '')).trim(); })
    .filter(function (s) { return s; });
}

// ===== COMBAT RULES (no graphics in this part) =====
// Follows your Effects and Combat Rulings doc and your damage specification.
// Damage Calculation (dealHit) and Damage Resolution (takeHit) are two separate steps.
// Resolution order: Resistance -> Shield -> Armor -> Ward -> Critical Resistance -> Health -> death check.

function compareInitiative(a, b) {
  if (b.initiative !== a.initiative) return b.initiative - a.initiative; // highest first
  if (a.side !== b.side) return a.side === 'player' ? -1 : 1;           // players before enemies
  if (b.dex !== a.dex) return b.dex - a.dex;                             // higher Dexterity
  if (a.armor !== b.armor) return a.armor - b.armor;                     // lower total Armor
  return a.tie - b.tie;                                                  // random
}

// ----- effect catalog -----
// buff: true for buffs, false for debuffs (Dispel and Steal Buff only touch buffs, Cleanse only touches debuffs).
// strength: the field compared when the same effect is applied twice WITH THE SAME NAME (the skill that gave it). Only the strongest applies,
//   and on equal strength the one with more turns left. Effects of the same type with different names STACK. Damage and Healing Over Time always stack.
// key: effects of the same type but a different key (damage type, attribute) do not compete.
// turnless: does not run out with turns (a Death Ward only runs out of charges).
const EFFECT_INFO = {
  shield:           { buff: true,  strength: 'charges' },
  hot:              { buff: true,  stack: 'all' },
  dot:              { buff: false, stack: 'all' },
  deathWard:        { buff: true,  strength: 'hpPercent', turnless: true },
  reflection:       { buff: true,  strength: 'percent' },
  thorns:           { buff: true,  strength: 'damage' },
  reactiveHeal:     { buff: true,  strength: 'heal' },
  accuracyBoost:    { buff: true,  strength: 'percent' },
  accuracyReduce:   { buff: false, strength: 'percent' },
  crit:             { buff: true,  strength: 'chance' },
  critChanceReduce: { buff: false, strength: 'chance' },
  critBonus:        { buff: true,  strength: 'points' },
  critBonusReduce:  { buff: false, strength: 'points' },
  dmgUp:            { buff: true,  strength: 'percent' },
  shieldBreak:      { buff: true,  strength: 'percent' },
  armorBoost:       { buff: true,  strength: 'percent' },
  armorReduce:      { buff: false, strength: 'percent' },
  dmgReduceIn:      { buff: true,  strength: 'percent' },
  vulnerable:       { buff: false, strength: 'percent' },
  dmgOutReduce:     { buff: false, strength: 'percent' },
  critResist:       { buff: true,  strength: 'percent' },
  critResistWeaken: { buff: false, strength: 'percent' },
  resistance:       { buff: true,  strength: 'delta', key: 'damageType' },
  weakenResistance: { buff: false, strength: 'delta', key: 'damageType' },
  healthBoost:      { buff: true,  strength: 'percent' },
  healthReduce:     { buff: false, strength: 'percent' },
  healReceivedBoost:  { buff: true,  strength: 'percent' },
  healReceivedReduce: { buff: false, strength: 'percent' },
  healOutBoost:     { buff: true,  strength: 'percent' },
  healOutReduce:    { buff: false, strength: 'percent' },
  attributeBoost:   { buff: true,  strength: 'percent', key: 'attr' },
  attributeReduce:  { buff: false, strength: 'percent', key: 'attr' },
  taunt:            { buff: true },
  provoke:          { buff: false },
  shadow:           { buff: true,  strength: 'mult' },
};

function infoOf(e) { return EFFECT_INFO[e.type] || {}; }

// How many hits a Shield can still block. A Shield from your sheet counts hits (X) and turns (Y) separately.
// Older test Shields use one number (charges) for both.
function shieldHits(e) { return e.hits !== undefined ? e.hits : e.charges; }

// Does a damage type belong to a type or parent group? (no group set = every type)
// "only" is one type or group, or a list of them (a Reflection can be limited to Fire, or to Fire and Cold)
function typeMatches(type, only) {
  if (!only) return true;
  const t = normType(type);
  const list = [].concat(only);
  if (!list.length) return true;
  return list.some(function (o) { return t === o || PARENT_OF[t] === o; });
}
function isBuff(e) { return !!infoOf(e).buff; }

function normType(t) {
  return String(t || '').toLowerCase().replace(/[^a-z]/g, '');
}

function effectKey(e) {
  const k = infoOf(e).key;
  return k ? normType(e[k]) : '';
}

// The name of an effect = the skill that gave it. Effects with no name (older tests) all share the empty name.
function nameOf(e) {
  return e.name === undefined || e.name === null ? '' : String(e.name);
}

function strengthOf(e) {
  const f = infoOf(e).strength;
  return f ? (Number(e[f]) || 0) : 0;
}

// The value of one field of an effect on a unit (0 if the unit does not have it).
// Effects of the same type from different skills stack, so this adds them all up.
function bestOf(unit, type, field) {
  return unit.effects.reduce(function (n, x) { return x.type === type ? n + (Number(x[field]) || 0) : n; }, 0);
}

// ----- attributes and health -----

// An attribute with any Attribute Boost or Reduction applied
function attrOf(unit, name) {
  const base = (unit.attrs && unit.attrs[name]) || 0;
  const sum = function (type) {
    return unit.effects.filter(function (e) { return e.type === type && e.attr === name; })
      .reduce(function (n, e) { return n + (e.percent || 0); }, 0);
  };
  return Math.max(0, base * (1 + sum('attributeBoost') - sum('attributeReduce')));
}

// Keeps maximum health in line with Health Boost, Reduce Maximum Health and Vitality changes.
// When an effect is applied, current health moves with the maximum (never below 1).
// When one ends, current health is only capped at the new maximum.
function syncMaxHp(unit, applying) {
  if (unit.baseMaxHp === undefined) return;
  const vitChange = unit.attrs ? attrOf(unit, 'vitality') - unit.attrs.vitality : 0;
  const factor = 1 + bestOf(unit, 'healthBoost', 'percent') - bestOf(unit, 'healthReduce', 'percent');
  const newMax = Math.max(1, Math.round((unit.baseMaxHp + VITALITY_HEALTH * vitChange) * factor));
  const oldMax = unit.maxHp;
  if (newMax === oldMax) return;
  unit.maxHp = newMax;
  if (!unit.alive) return;
  if (applying) unit.hp = Math.max(1, Math.min(newMax, unit.hp + (newMax - oldMax)));
  else unit.hp = Math.min(unit.hp, newMax);
}

// ----- resistance (four states) -----

function stateIndex(name) {
  const i = RESIST_STATES.findIndex(function (s) { return s.toLowerCase() === String(name).toLowerCase(); });
  return i < 0 ? 1 : i;
}

function clampState(i) {
  return Math.max(0, Math.min(RESIST_STATES.length - 1, i));
}

// Total Resistance modifier (in states) that active effects give to one damage type or group
function resistMods(unit, type) {
  return unit.effects.reduce(function (n, e) {
    if (e.type === 'resistance' && normType(e.damageType) === type) return n + (e.delta || 0);
    if (e.type === 'weakenResistance' && normType(e.damageType) === type) return n - (e.delta || 0);
    return n;
  }, 0);
}

function groupState(unit, group) {
  const b = unit.resist && unit.resist.base[group];
  return clampState((b === undefined ? 1 : stateIndex(b)) + resistMods(unit, group));
}

// A specific type's own base state beats its group's state. Without one it inherits the group's. Without either it is Normal.
// Base states and modifiers are kept apart, so when an effect ends the right state comes back.
function resistanceState(unit, rawType) {
  const t = normType(rawType);
  if (!t) return 1;
  if (DAMAGE_TYPES[t]) return groupState(unit, t);
  const own = unit.resist && unit.resist.base[t];
  const start = own !== undefined ? stateIndex(own) : (PARENT_OF[t] ? groupState(unit, PARENT_OF[t]) : 1);
  return clampState(start + resistMods(unit, t));
}

// ----- building a battle -----

// Adds the battle values every unit needs to a unit built from a sheet row
function makeUnit(def) {
  return Object.assign({}, def, {
    maxHp: def.hp, baseMaxHp: def.hp, ward: 0, wardMax: 0, effects: [], cd: {}, alive: true,
    initiative: Math.floor(engineRandom() * 100) + 1 + def.speed, // random roll 1-100 + Speed, fixed for the node
    tie: engineRandom(),
  });
}

// Node Ability Multiplier (Nodes tab): an enemy's attributes (Strength, Dexterity, Intelligence, Wisdom, Vitality) are multiplied,
// so every skill that scales with an attribute gets stronger. Health is not multiplied, and heroes are not affected.
function applyAbilityMultiplier(state, unit) {
  const m = state.abilityMult;
  if (!m || m === 1 || unit.side !== 'enemy' || !unit.attrs) return;
  unit.attrs = Object.assign({}, unit.attrs); // a copy, so a shared row is never changed
  Object.keys(unit.attrs).forEach(function (k) { unit.attrs[k] *= m; });
}

// Puts one wave of enemies on the field and rebuilds the turn order. Returns the new enemy units.
function spawnWave(state, waveIndex) {
  const added = [];
  state.waves[waveIndex].forEach(function (mob, slot) {
    if (!mob) return; // empty slot
    state.mobCount += 1;
    const unit = makeUnit(unitFromRow(mob, 'mob', 'enemy', slot, 'mob' + state.mobCount));
    applyAbilityMultiplier(state, unit);
    state.units.push(unit);
    added.push(unit);
  });
  state.order = state.units.filter(function (u) { return !u.isSummon; }).sort(compareInitiative);
  state.turn = -1;     // each wave starts at the top of the turn order
  state.pending = [];
  return added;
}

// The current stage is cleared: its enemies leave, the party recovers a little, and the next stage comes in. Returns the new enemy units.
function advanceWave(state) {
  state.units = state.units.filter(function (u) { return u.side !== 'enemy'; });
  // Between stages (Chapter 4.7): living party members recover 10% of maximum HP, dead ones stay dead, summons get no recovery,
  // detrimental effects (debuffs and DoTs) are cleared, beneficial buffs, Wards and cooldowns carry forward.
  state.units.forEach(function (u) {
    if (u.side !== 'player') return;
    removeEffects(u, function (e) { return !isBuff(e); });
    if (!u.alive || u.isSummon) return;
    const gain = Math.min(u.maxHp - u.hp, Math.ceil(u.maxHp * 0.1));
    if (gain > 0) { u.hp += gain; state.emit('heal', u, '+' + show(gain)); }
  });
  state.waveIndex += 1;
  state.waveCleared = false;
  return spawnWave(state, state.waveIndex);
}

function newBattle(emit, heroRows, nodeData) {
  const state = {
    units: [], order: [], turn: -1, serial: 0, over: null, emit: emit,
    pending: [], current: null, summonCount: 0, // summons waiting to act right after their summoner
    waves: nodeData.waves, waveIndex: 0, waveCleared: false, mobCount: 0,
    abilityMult: nodeData.abilityMultiplier > 0 ? nodeData.abilityMultiplier : 1, // the node's Ability Multiplier
  };
  heroRows.forEach(function (row, i) {
    state.units.push(makeUnit(unitFromRow(row, 'hero', 'player', i, 'hero' + (i + 1))));
  });
  spawnWave(state, 0);
  return state;
}

function opponents(state, unit) {
  return state.units.filter(function (u) { return u.side !== unit.side && u.alive; });
}

function skillReady(unit, key) {
  return !(unit.cd[key] > 0);
}

function activeSummons(state, side) {
  return state.units.filter(function (u) { return u.isSummon && u.alive && u.side === side; });
}

// A number for the floating text: whole numbers, but never 0 for damage that really happened
function show(n) {
  return n > 0 ? Math.max(1, Math.round(n)) : Math.round(n);
}

function randomOf(list) {
  return list[Math.floor(engineRandom() * list.length)];
}

// ----- adding and removing effects -----

// Adds an effect. Only the strongest copy of the same effect applies (Damage and Healing Over Time can all run together).
// A buff the caster puts on themselves does not count the turn it was cast: its duration starts on the caster's next turn.
// Returns true if the effect was added.
function addEffect(state, unit, e, user) {
  const info = infoOf(e);
  if (unit.isSummon && (info.buff || e.type === 'dot')) return false; // summons cannot receive buffs or DoTs
  state.serial += 1;
  e.serial = state.serial;
  if (user && unit === user && state.current === user && !info.turnless) e.fresh = true;
  if (info.stack !== 'all') {
    const key = effectKey(e);
    const nm = nameOf(e);
    const old = unit.effects.find(function (x) { return x.type === e.type && effectKey(x) === key && nameOf(x) === nm; });
    if (old) {
      const s = strengthOf(e);
      const so = strengthOf(old);
      const better = s > so || (s === so && (e.charges || 0) > (old.charges || 0));
      if (!better) return false; // a weaker or equal copy with the same name is ignored
      unit.effects = unit.effects.filter(function (x) { return x !== old; });
    }
  }
  unit.effects.push(e);
  state.emit('status', unit, effectLabel(e));
  syncMaxHp(unit, true);
  return true;
}

// Removes every effect that the test picks. Returns the removed effects.
function removeEffects(unit, test) {
  const gone = unit.effects.filter(test);
  if (gone.length) {
    unit.effects = unit.effects.filter(function (e) { return !test(e); });
    syncMaxHp(unit, false);
  }
  return gone;
}

// An effect with hit charges (uses) loses one when it goes off and is removed at zero
function useCharge(unit, e) {
  if (e.uses === undefined) return;
  e.uses -= 1;
  if (e.uses <= 0) unit.effects = unit.effects.filter(function (x) { return x !== e; });
}

// Summons are removed without any on-death effect when they expire or their summoner dies (14.3, 14.4)
function removeSummon(state, summon, text) {
  summon.alive = false;
  summon.hp = 0;
  summon.effects = [];
  state.emit('expire', summon, text);
}

function killUnit(state, unit) {
  unit.hp = 0;
  unit.alive = false;
  unit.ward = 0;
  unit.wardMax = 0;
  unit.effects = []; // Dead characters lose all buffs and debuffs
  unit.maxHp = unit.baseMaxHp;
  state.emit('death', unit, 'defeated');
  // Provokes they put on others end
  state.units.forEach(function (u) {
    u.effects = u.effects.filter(function (e) { return !(e.type === 'provoke' && e.source === unit); });
  });
  // A summon that is defeated explodes and hits every enemy (Bone Shrapnel)
  if (unit.isSummon && unit.explodes) {
    state.emit('info', unit, 'explodes!');
    opponents(state, unit).forEach(function (e) { takeHit(state, e, unit.explodes, { type: 'piercing' }); });
  }
  // Summons end when their summoner dies
  state.units.forEach(function (u) {
    if (u.isSummon && u.owner === unit.id && u.alive) removeSummon(state, u, 'vanishes');
  });
}

// Buffs that Weaken Soul and Steal Buff can take, and Dispel can remove. A Ward is a damage pool, not a buff, so it is never touched.
function stealable(unit) {
  return unit.effects.filter(function (e) { return isBuff(e) && e.canSteal !== false; });
}
// Buffs that Dispel can remove. A skill with "Can Be Dispelled" unticked makes buffs that Dispel skips.
function dispellable(unit) {
  return unit.effects.filter(function (e) { return isBuff(e) && e.canDispel !== false; });
}

// Short text for an effect, used on the screen and in the log
function effectLabel(e) {
  const pct = function (x) { return Math.round((x || 0) * 100) + '%'; };
  const x = e.charges === undefined ? '' : ' x' + e.charges;
  switch (e.type) {
    case 'shield': return 'Shield' + (e.hits !== undefined ? ' x' + e.hits : x);
    case 'dot': return 'DoT ' + show(e.damage) + x;
    case 'hot': return 'HoT ' + show(e.heal) + x;
    case 'taunt': return 'Taunt' + x;
    case 'provoke': return 'Provoked' + x;
    case 'armorReduce': return 'Armor -' + pct(e.percent) + x;
    case 'armorBoost': return 'Armor +' + pct(e.percent) + x;
    case 'dmgUp': return 'Dmg +' + pct(e.percent) + x;
    case 'dmgOutReduce': return 'Dmg -' + pct(e.percent) + x;
    case 'vulnerable': return 'Vulnerable +' + pct(e.percent) + x;
    case 'dmgReduceIn': return 'Takes -' + pct(e.percent) + x;
    case 'crit': return 'Crit ' + pct(e.chance) + x;
    case 'critChanceReduce': return 'Crit -' + pct(e.chance) + x;
    case 'critBonus': return 'Crit bonus +' + show(e.points) + x;
    case 'critBonusReduce': return 'Crit bonus -' + show(e.points) + x;
    case 'critResist': return 'Crit resist +' + pct(e.percent) + x;
    case 'critResistWeaken': return 'Crit resist -' + pct(e.percent) + x;
    case 'accuracyBoost': return 'Accuracy +' + pct(e.percent) + x;
    case 'accuracyReduce': return 'Accuracy -' + pct(e.percent) + x;
    case 'shieldBreak': return 'Shield Break +' + pct(e.percent) + x;
    case 'shadow': return 'Shadow x' + e.mult + ' (' + e.charges + ')';
    case 'deathWard': return 'Death Ward x' + e.uses;
    case 'reflection': return 'Reflect ' + pct(e.percent) + (e.only && [].concat(e.only).length ? ' ' + [].concat(e.only).join('/') : '') + x;
    case 'thorns': return 'Thorns ' + show(e.damage) + (e.uses !== undefined ? ' x' + e.uses : x);
    case 'reactiveHeal': return 'Reactive heal ' + show(e.heal) + x;
    case 'resistance': return e.damageType + ' resist +' + e.delta + x;
    case 'weakenResistance': return e.damageType + ' resist -' + e.delta + x;
    case 'healthBoost': return 'Health +' + pct(e.percent) + x;
    case 'healthReduce': return 'Health -' + pct(e.percent) + x;
    case 'healReceivedBoost': return 'Healed +' + pct(e.percent) + x;
    case 'healReceivedReduce': return 'Healed -' + pct(e.percent) + x;
    case 'healOutBoost': return 'Heals +' + pct(e.percent) + x;
    case 'healOutReduce': return 'Heals -' + pct(e.percent) + x;
    case 'attributeBoost': return e.attr + ' +' + pct(e.percent) + x;
    case 'attributeReduce': return e.attr + ' -' + pct(e.percent) + x;
    default: return e.type + x;
  }
}

// ----- taunt -----

// Enemies of this unit that have Taunt. A single-target attack must hit one of them (the attacker picks which),
// unless the skill ignores Taunt. Returns null when nothing forces the choice.
function tauntersFor(state, unit, sk) {
  if (sk.target !== 'enemy' || sk.ignoresTaunt) return null;
  const list = opponents(state, unit).filter(function (o) {
    return o.effects.some(function (e) { return e.type === 'taunt'; });
  });
  return list.length ? list : null;
}

// ----- damage calculation -----

// The critical numbers of an attacker. The Critical Multiplier and the Critical Bonus are separate numbers.
//   Multiplier: 2.0 for everyone. Bonus: flat damage added after the multiplier. Critical Bonus Boost adds to it, Reduction takes from it (never below 0).
function critNumbers(user) {
  return {
    chance: Math.max(0, Math.min(1, (user.baseCrit || 0) + bestOf(user, 'crit', 'chance') - bestOf(user, 'critChanceReduce', 'chance'))),
    mult: CRIT_MULT,
    bonus: Math.max(0, CRIT_BONUS + (user.baseCritBonus || 0) + bestOf(user, 'critBonus', 'points') - bestOf(user, 'critBonusReduce', 'points')),
  };
}

// A critical hit's damage as calculated: amount x Critical Multiplier + flat Critical Bonus (Section 11.18).
// The target's Critical Resistance is NOT used here. It is its own step in Damage Resolution, after Ward (Section 11.1, step 5).
function critDamage(amount, c) {
  return amount * c.mult + c.bonus;
}

// The target's Critical Resistance (a share from 0 to 1, capped at 100%), with Critical Resistance buffs and Weaken Critical Resistance
function critResistOf(unit) {
  return Math.max(0, Math.min(1, (unit.baseCritResist || 0) + bestOf(unit, 'critResist', 'percent') - bestOf(unit, 'critResistWeaken', 'percent')));
}

// A Damage Over Time never critically strikes. Only the hit that applies it can (Section 11.11), and that hit goes through dealHit like any other.

// Once per skill use: the Shadow Slip multiplier, percent damage modifiers and the critical numbers of the attacker
function prepareDamage(user) {
  let shadow = 1;
  const s = user.effects.find(function (e) { return e.type === 'shadow'; });
  if (s) { shadow = s.mult; user.effects = user.effects.filter(function (e) { return e !== s; }); }
  const crit = critNumbers(user);
  return {
    shadow: shadow,
    percent: bestOf(user, 'dmgUp', 'percent') - bestOf(user, 'dmgOutReduce', 'percent'), // share of base damage
    shieldBreak: bestOf(user, 'shieldBreak', 'percent'),
    flat: 0,                                                                              // flat Damage Modifiers
    critChance: crit.chance,
    critMult: crit.mult,
    critBonus: crit.bonus,
  };
}

// Damage Calculation: (Base + Attribute Bonus + Damage Modifiers) x Critical Multiplier + Critical Bonus.
// Percent modifiers count as a percent of base damage. Then the hit goes to Damage Resolution.
function dealHit(state, user, sk, target, mods, base) {
  let pct = mods.percent;
  if (mods.shieldBreak && target.ward > 0) pct += mods.shieldBreak;                           // Shield Break
  const attrBonus = sk.attr ? base * attrOf(user, sk.attr) * (sk.scale !== undefined ? sk.scale : ATTR_SCALING) : 0;
  let amt = Math.max(0, (base + attrBonus + base * pct + mods.flat) * mods.shadow);
  let critExtra = 0; // the damage the crit added (multiplier extra + flat Critical Bonus). Critical Resistance cuts this, later in Damage Resolution
  if (mods.critChance > 0 && engineRandom() < mods.critChance) {
    const plain = amt;
    amt = critDamage(plain, { mult: mods.critMult, bonus: mods.critBonus });
    critExtra = amt - plain;
    state.emit('crit', target, 'CRIT!');
  }
  return takeHit(state, target, amt, { attacker: user, type: sk.damageType, parts: sk.damageParts, critExtra: critExtra });
}

// ----- damage resolution -----

// Accuracy of an attacker, with Accuracy Boost and Reduction
function accuracyOf(unit) {
  const mult = 1 + bestOf(unit, 'accuracyBoost', 'percent') - bestOf(unit, 'accuracyReduce', 'percent');
  return Math.max(0, (unit.accuracy || 0) * Math.max(0, mult));
}

// Armor after Armor Boost, Armor Reduction and the attacker's Accuracy (never below zero)
function armorOf(unit, attacker) {
  const accuracy = attacker ? accuracyOf(attacker) : 0;
  const penetration = accuracy / (accuracy + 100);
  const reduce = Math.max(0, Math.min(1, bestOf(unit, 'armorReduce', 'percent')));
  return Math.max(0, unit.armor * (1 + bestOf(unit, 'armorBoost', 'percent')) * (1 - reduce) * (1 - penetration));
}

// Sends damage back at the attacker. Reactive damage skips Shield and Armor: only Resistance, Ward and Health apply. It cannot trigger reactive effects again.
function strikeBack(state, from, attacker, amount, type, text, parts) {
  if (!attacker || !attacker.alive || amount <= 0) return;
  state.emit('status', from, text);
  takeHit(state, attacker, amount, { reflected: true, type: type, parts: parts });
}

// The damage types of a hit: one type, or a split (opts.parts = [{type, share}], the shares add up to 1)
function hitParts(opts) {
  return opts.parts && opts.parts.length ? opts.parts : [{ type: opts.type, share: 1 }];
}

// Damage Resolution. amount = the damage as calculated (before any defense).
// Order: Resistance, Shield, Armor, Ward, Critical Resistance, Health, Reactive Healing, then the death check.
// DoT ticks and reactive hits (Thorns, Reflection) skip the Shield and Armor steps.
function takeHit(state, unit, amount, opts) {
  opts = opts || {};
  const result = { nullified: false, absorbed: 0, dealt: 0 };
  if (!unit.alive) return result;
  const attacker = opts.attacker;
  const react = !!attacker && !opts.dotTick && !opts.reflected; // only a real attack sets off reactive effects
  let dmg = amount;

  // 1. Resistance (and Damage Reduction / Vulnerability): an Immune hit stops here.
  // A split hit checks every part against its own damage type: an Immune part drops out, the other parts still land.
  const parts = hitParts(opts);
  const partDmg = parts.map(function (p) { return amount * p.share * RESIST_MULT[resistanceState(unit, p.type)]; });
  dmg = partDmg.reduce(function (a, b) { return a + b; }, 0);
  dmg *= Math.max(0, 1 + bestOf(unit, 'vulnerable', 'percent') - bestOf(unit, 'dmgReduceIn', 'percent'));
  if (dmg <= 0) {
    result.nullified = true;
    const allImmune = parts.every(function (p) { return resistanceState(unit, p.type) === RESIST_STATES.length - 1; });
    state.emit('block', unit, allImmune ? 'IMMUNE' : 'NO DAMAGE');
    return result;
  }
  // What a critical added to this hit (the multiplier's extra damage plus the flat Critical Bonus), after Resistance. Critical Resistance cuts it at step 5.
  const critPart = opts.critExtra > 0 && amount > 0 ? opts.critExtra * (dmg / amount) : 0;
  // The part of the hit (after Resistance) that is a damage type or group, for a Reflection that only reflects some types
  const shareOf = function (only) {
    if (!only) return 1;
    let total = 0, match = 0;
    parts.forEach(function (p, i) { total += partDmg[i]; if (typeMatches(p.type, only)) match += partDmg[i]; });
    return total > 0 ? match / total : 0;
  };

  // 2. Shield: one charge fully nullifies one hit. DoT ticks and reactive hits (Thorns, Reflection) bypass Shields.
  if (!opts.dotTick && !opts.reflected) {
    const shield = unit.effects.find(function (e) { return e.type === 'shield' && shieldHits(e) > 0; });
    if (shield) {
      if (shield.hits !== undefined) shield.hits -= 1; else shield.charges -= 1;
      if (shieldHits(shield) <= 0) unit.effects = unit.effects.filter(function (e) { return e !== shield; });
      result.nullified = true;
      state.emit('block', unit, 'BLOCKED');
      // Only Reflection and Thorns that came with the skill that gave this Shield go off here (full damage as calculated)
      if (react && shield.reflect) strikeBack(state, unit, attacker, amount * shield.reflect, opts.type, 'Reflect', opts.parts);
      if (react && shield.thorns) strikeBack(state, unit, attacker, shield.thorns, shield.thornsType || 'piercing', 'Thorns');
      return result;
    }
  }

  // 3. Armor: flat reduction, never below zero. DoT ticks and reactive hits (Thorns, Reflection) skip it.
  if (!opts.dotTick && !opts.reflected) dmg = Math.max(0, dmg - armorOf(unit, attacker));
  // All other Reflection and Thorns go off here (Reflection uses the damage left after Armor)
  if (react) {
    // Every Reflection and every Thorns on the unit goes off (effects with different names stack)
    unit.effects.filter(function (e) {
      return e.type === 'reflection' && (e.uses === undefined || e.uses > 0) && shareOf(e.only) > 0;
    }).forEach(function (refl) {
      useCharge(unit, refl);
      // A split hit is one hit: each Reflection goes off once. With a type filter, only the matching parts are sent back.
      let sendParts, sendType = opts.type;
      if (parts.length > 1) {
        const keep = parts.map(function (p, i) { return { type: p.type, w: partDmg[i] }; })
          .filter(function (p) { return p.w > 0 && (!refl.only || typeMatches(p.type, refl.only)); });
        const sum = keep.reduce(function (a, p) { return a + p.w; }, 0);
        sendParts = keep.map(function (p) { return { type: p.type, share: p.w / sum }; });
        sendType = sendParts[0].type;
      }
      strikeBack(state, unit, attacker, dmg * refl.percent * shareOf(refl.only), sendType, 'Reflect', sendParts);
    });
    unit.effects.filter(function (e) { return e.type === 'thorns' && (e.uses === undefined || e.uses > 0); }).forEach(function (th) {
      useCharge(unit, th);
      strikeBack(state, unit, attacker, th.damage, th.damageType || 'piercing', 'Thorns');
    });
  }

  // 4. Ward: absorbs up to its current pool
  const absorbed = Math.min(unit.ward, dmg);
  if (absorbed > 0) {
    unit.ward -= absorbed;
    dmg -= absorbed;
    result.absorbed = absorbed;
    state.emit('ward', unit, '-' + show(absorbed) + ' ward');
  }

  // 5. Critical Resistance: takes its percent off everything the critical added (multiplier extra + flat Critical Bonus), after Ward
  if (critPart > 0 && dmg > 0) dmg = Math.max(0, dmg - critPart * critResistOf(unit));

  // 6. Health (never below zero)
  if (dmg > 0) {
    const lost = Math.min(unit.hp, dmg);
    unit.hp -= lost;
    result.dealt = lost;
    state.emit('damage', unit, '-' + show(dmg));
    // Reactive Healing goes off when an attack does health damage, before the death check, so it can save the character
    if (react) {
      unit.effects.filter(function (e) { return e.type === 'reactiveHeal' && (e.uses === undefined || e.uses > 0); })
        .forEach(function (e) {
          healUnit(state, unit, e.heal, e.source);
          useCharge(unit, e);
        });
    }
  }

  // 7. Death check: a Death Ward charge is used up instead of dying
  if (unit.hp <= 0) {
    const dw = unit.effects.find(function (e) { return e.type === 'deathWard' && e.uses > 0; });
    if (dw) {
      useCharge(unit, dw);
      unit.hp = Math.max(1, Math.floor(unit.maxHp * dw.hpPercent));
      state.emit('revive', unit, 'DEATH WARD');
      state.emit('heal', unit, '+' + show(unit.hp));
    } else {
      killUnit(state, unit);
    }
  }
  return result;
}

function reviveUnit(state, unit, fraction) {
  unit.alive = true;
  unit.effects = []; // returns free of old buffs and debuffs (13.5)
  unit.maxHp = unit.baseMaxHp;
  unit.hp = Math.max(1, Math.floor(unit.maxHp * fraction));
  unit.ward = 0;
  unit.wardMax = 0;
  state.emit('revive', unit, 'revived');
  state.emit('heal', unit, '+' + show(unit.hp));
}

// Healing can never take a character above Maximum Health.
// source = who is healing (their Healing Outgoing effects count). The target's Healing Received effects count too.
function healUnit(state, unit, amount, source) {
  if (!unit.alive || unit.isSummon) return 0; // summons cannot receive healing (14.6)
  const out = source ? 1 + bestOf(source, 'healOutBoost', 'percent') - bestOf(source, 'healOutReduce', 'percent') : 1;
  const inc = 1 + bestOf(unit, 'healReceivedBoost', 'percent') - bestOf(unit, 'healReceivedReduce', 'percent');
  const total = Math.floor(Math.max(0, amount * Math.max(0, out) * Math.max(0, inc)));
  const healed = Math.max(0, Math.min(total, unit.maxHp - unit.hp));
  unit.hp += healed;
  if (healed > 0) state.emit('heal', unit, '+' + show(healed));
  return healed;
}

function useSkill(state, user, key, target) {
  const sk = SKILLS[key];
  user.cd[key] = sk.cd;
  state.emit('info', user, 'uses ' + sk.name + (target !== user ? ' on ' + target.name : ''));
  // Every effect a skill applies remembers whether Dispel and Steal Buff may touch it (a stolen buff keeps its own flags)
  const add = function (unit, e) {
    if (e.name === undefined) e.name = sk.name; // the effect's name is the skill that gave it (a stolen buff keeps its own)
    if (e.canDispel === undefined && sk.canBeDispelled === false) e.canDispel = false;
    if (e.canSteal === undefined && sk.canBeStolen === false) e.canSteal = false;
    return addEffect(state, unit, e, user);
  };
  useSheetSkill(state, user, sk, target, add);
  checkOver(state);
}

// Start of a character's turn: heal-over-time effects resolve, largest heal first, oldest breaks ties (10.5, 10.8)
function startTurn(state, unit) {
  if (!unit.alive) return;
  const hots = unit.effects
    .filter(function (e) { return e.type === 'hot'; })
    .sort(function (a, b) { return (b.heal - a.heal) || (a.serial - b.serial); });
  hots.forEach(function (h) { healUnit(state, unit, h.heal, h.source); });
}

function endTurn(state, unit) {
  if (unit.alive) {
    // 1. DoTs resolve, oldest first. They bypass Shields and Armor: only Resistance, Ward and Health apply.
    const dots = unit.effects
      .filter(function (e) { return e.type === 'dot'; })
      .sort(function (a, b) { return a.serial - b.serial; });
    for (let i = 0; i < dots.length; i++) {
      if (!unit.alive) break;
      takeHit(state, unit, dots[i].damage, { dotTick: true, type: dots[i].damageType });
    }
    if (unit.alive) {
      // 2-3. Buff and debuff charges drop by one; effects with zero charges expire.
      // An effect the character put on themselves this turn skips this first drop (the cast turn does not count).
      unit.effects.forEach(function (e) {
        if (infoOf(e).turnless || typeof e.charges !== 'number') return;
        if (e.fresh) { e.fresh = false; return; }
        e.charges -= 1;
      });
      removeEffects(unit, function (e) { return !infoOf(e).turnless && typeof e.charges === 'number' && e.charges <= 0; });
      // 4. Cooldowns drop by one for the character whose turn is ending
      Object.keys(unit.cd).forEach(function (k) { if (unit.cd[k] > 0) unit.cd[k] -= 1; });
      // A summon's duration drops at the end of its own turn; at zero it disappears with no on-death effect (14.4)
      if (unit.isSummon) {
        unit.duration -= 1;
        if (unit.duration <= 0) removeSummon(state, unit, 'expired');
      }
    }
    // Summons act right after their summoner (14.5)
    if (unit.alive && !unit.isSummon) {
      state.units.forEach(function (u) { if (u.isSummon && u.owner === unit.id && u.alive) state.pending.push(u); });
    }
  }
  checkOver(state);
}

// Victory only comes when the last wave is cleared. Clearing an earlier wave sets waveCleared so the next wave comes in.
function checkOver(state) {
  if (state.over) return;
  const playersAlive = state.units.some(function (u) { return u.side === 'player' && u.alive && !u.isSummon; });
  const enemiesAlive = state.units.some(function (u) { return u.side === 'enemy' && u.alive && !u.isSummon; });
  if (!enemiesAlive) {
    if (state.waveIndex < state.waves.length - 1) state.waveCleared = true;
    else state.over = 'victory';
  } else if (!playersAlive) state.over = 'defeat';
}

// The next few living characters to act after the current one (for the "Next:" line)
function upcoming(state, n) {
  const out = [];
  const cur = state.current;
  const add = function (u) {
    if (u.alive && u !== cur && out.indexOf(u) === -1 && out.length < n) out.push(u);
  };
  state.pending.forEach(add);
  if (cur && !cur.isSummon) state.units.forEach(function (u) { if (u.owner === cur.id) add(u); });
  for (let i = 1; i <= state.order.length; i++) add(state.order[(state.turn + i) % state.order.length]);
  return out;
}

function nextActor(state) {
  if (state.over) return null;
  // Summons act right after their summoner, in the order they were summoned
  while (state.pending.length) {
    const sm = state.pending.shift();
    if (sm.alive) { state.current = sm; return sm; }
  }
  for (let i = 0; i < state.order.length; i++) {
    state.turn = (state.turn + 1) % state.order.length;
    const u = state.order[state.turn];
    if (u.alive) { state.current = u; return u; } // dead characters keep their place but skip their turn
  }
  return null;
}

// ===== RUNNING SKILLS FROM YOUR SHEET, AND CHOOSING ACTIONS =====
// Skills built by part1b.js run here. Each effect group (A to E) is carried out in order,
// except that every Damage group goes first, so a hostile effect can tell whether the hit was blocked.

// Which slots touch each other (for AdjacentEnemies / AdjacentAllies). Slot 0 = back, 1-2 = middle, 3-4 = front.
const ADJACENT_SLOTS = { 0: [1, 2], 1: [0, 2, 3], 2: [0, 1, 4], 3: [1, 4], 4: [2, 3] };

function livingAllies(state, user) {
  return state.units.filter(function (u) { return u.side === user.side && u.alive && !u.isSummon; });
}
function fallenAllies(state, user) {
  return state.units.filter(function (u) { return u.side === user.side && !u.alive && !u.isSummon; });
}

// The units a target name points at. picks = who the player (or the AI) chose: { enemy, ally }
function sheetTargets(state, user, token, picks) {
  const allies = livingAllies(state, user);
  const foes = opponents(state, user);
  const near = function (list, center) {
    const around = center && ADJACENT_SLOTS[center.slot];
    return around ? list.filter(function (u) { return u !== center && u.spot !== 'summon' && around.indexOf(u.slot) !== -1; }) : [];
  };
  const one = function (list) { return list.length ? [randomOf(list)] : []; };
  switch (token) {
    case 'self': return [user];
    case 'oneenemy': return picks.enemy && picks.enemy.alive ? [picks.enemy] : one(foes);
    case 'randomenemy': return one(foes);
    case 'allenemies': return foes;
    case 'allenemiesminustarget': return foes.filter(function (u) { return u !== picks.enemy; });
    case 'adjacentenemies': return near(foes, picks.enemy);
    case 'oneally': return [picks.ally && picks.ally.alive && !picks.ally.isSummon ? picks.ally : user];
    case 'randomally': return one(allies);
    case 'allallies': return allies;
    case 'allalliesminustarget': return allies.filter(function (u) { return u !== (picks.ally || user); });
    case 'allalliesminusself': return allies.filter(function (u) { return u !== user; });
    case 'adjacentallies': return near(allies, user);
    case 'onedeadally': return one(fallenAllies(state, user));
    case 'alldeadallies': return fallenAllies(state, user);
    default: return [];
  }
}

// How many turns an effect from this group lasts: the skill's Duration, or the group's Y when the skill is Instant
function groupTurns(sk, g) {
  if (sk.duration > 0) return sk.duration;
  if (g.y !== null && g.y > 0) return g.y;
  return 1;
}

// An amount that grows with the skill's attribute: amount x (1 + attribute x scale per point)
function scaledAmount(user, sk, x) {
  return sk.attr ? x * (1 + attrOf(user, sk.attr) * sk.scale) : x;
}

// The percent a Reflection reflects: X, or CondVal when X is 0 and the condition carries it ("If elemental damage", 50)
function reflectPercent(g) {
  if ((g.x === null || g.x === 0) && g.cond && g.cond.kind === 'damageGroup' && g.cond.val !== null) return g.cond.val / 100;
  return (g.x || 0) / 100;
}

// ----- shared actions -----

// Steals one random buff (Taunt included): removed from the enemy and moved (not copied) to the caster
function stealBuff(state, user, target, add) {
  const buffs = stealable(target);
  if (!buffs.length) return false;
  const b = randomOf(buffs);
  removeEffects(target, function (e) { return e === b; });
  state.emit('status', target, 'lost ' + effectLabel(b));
  const copy = Object.assign({}, b);
  delete copy.fresh;
  add(user, copy);
  return true;
}

// Removes up to "count" random buffs (a Ward cannot be dispelled, and buffs marked Can Be Dispelled = off are skipped)
function dispelBuffs(state, target, count) {
  for (let i = 0; i < count; i++) {
    const buffs = dispellable(target);
    if (!buffs.length) break;
    const b = randomOf(buffs);
    removeEffects(target, function (e) { return e === b; });
    state.emit('status', target, 'lost ' + effectLabel(b));
  }
}

// Cooldown Increase also hits skills that are ready now, but never basic attacks. Reduction never goes below 0.
function shiftCooldowns(state, unit, amount, increase) {
  unit.skills.forEach(function (k) {
    const cur = unit.cd[k] || 0;
    if (!increase) unit.cd[k] = Math.max(0, cur - amount);
    else if (!SKILLS[k].basic) unit.cd[k] = cur + amount;
  });
  state.emit('status', unit, increase ? 'cooldowns +' + amount : 'cooldowns -' + amount);
}

// Puts a summon beside its summoner if there is room. base = the stats of the summon (a mob row built by unitFromRow).
function spawnSummon(state, user, base, duration, explosion) {
  const used = activeSummons(state, user.side).map(function (u) { return u.slot; });
  const slot = [0, 1].find(function (i) { return used.indexOf(i) === -1; });
  if (slot === undefined || used.length >= MAX_SUMMONS) return null;
  state.summonCount += 1;
  const sm = Object.assign(makeUnit(Object.assign({}, base, { id: 'summon' + state.summonCount, side: user.side, spot: 'summon', slot: slot })), {
    initiative: 0, tie: 0, isSummon: true, owner: user.id, duration: duration, explodes: explosion,
  });
  applyAbilityMultiplier(state, sm); // enemy summons get the node's Ability Multiplier too
  state.units.push(sm);
  state.emit('summon', sm, 'summoned');
  return sm;
}

// The engine effect an "effect" group puts on a target (the Effects tab ID decides which one)
function buildGroupEffect(user, sk, g, turns) {
  const d = g.def;
  const e = { type: d.type };
  if (d.field) e[d.field] = d.pct ? (g.x || 0) / 100 : (d.scales ? scaledAmount(user, sk, g.x) : g.x);
  if (d.sub) e[d.sub] = d.sub === 'attr' ? g.type : (g.type || (d.type === 'thorns' ? 'piercing' : ''));
  if (d.source) e.source = user;
  if (d.type === 'thorns') {
    // Y = how many times it retaliates. It also ends when the skill's Duration runs out (blank Y = no limit on retaliations).
    e.charges = sk.duration > 0 ? sk.duration : (g.y > 0 ? 99 : turns);
    if (g.y > 0) e.uses = g.y;
  } else if (d.uses) e.uses = g.y > 0 ? g.y : 1;
  else if (d.type !== 'deathWard') e.charges = turns;
  return e;
}

// Would this effect actually be added to the unit? (A copy that is not stronger than the one already there is ignored.)
function effectWouldApply(unit, e) {
  const info = infoOf(e);
  if (info.stack === 'all' || unit.isSummon && (info.buff || e.type === 'dot')) return !unit.isSummon;
  const key = effectKey(e);
  const nm = nameOf(e);
  const old = unit.effects.find(function (x) { return x.type === e.type && effectKey(x) === key && nameOf(x) === nm; });
  if (!old) return true;
  const s = strengthOf(e), so = strengthOf(old);
  return s > so || (s === so && (e.charges || 0) > (old.charges || 0));
}

// ----- running one sheet skill -----

function useSheetSkill(state, user, sk, target, add) {
  const picks = {
    enemy: target && target.side !== user.side ? target : null,
    ally: target && target.side === user.side ? target : null,
  };
  const ctx = { dealt: 0, blocked: [], hpFrac: new Map() };
  state.units.forEach(function (u) { ctx.hpFrac.set(u, u.maxHp > 0 ? u.hp / u.maxHp : 0); }); // conditions look at health before the skill
  const targetsOf = function (g) {
    return sheetTargets(state, user, g.token, picks).filter(function (t) {
      if (!g.cond || g.cond.kind !== 'targetBelow') return true;
      return ctx.hpFrac.get(t) < g.cond.pct / 100;
    });
  };

  // Damage Calculation values are worked out once per skill use (this also uses up a Shadow Slip)
  const hasDamage = sk.groups.some(function (g) { return g.def.run === 'damage'; });
  const mods = hasDamage ? prepareDamage(user) : null;
  sk.groups.forEach(function (g) { // Shield Break inside a skill aimed at an enemy: bonus damage to warded targets for this skill only
    if (g.def.run === 'shieldBreak' && g.token !== 'self' && mods) mods.shieldBreak = Math.max(mods.shieldBreak, (g.x || 0) / 100);
  });

  // 1. Every Damage group
  sk.groups.forEach(function (g) {
    if (g.def.run !== 'damage') return;
    targetsOf(g).forEach(function (t) {
      if (!t.alive) return;
      const r = dealHit(state, user, { attr: sk.attr, scale: sk.scale, damageType: g.type, damageParts: g.parts }, t, mods, g.x);
      ctx.dealt += r.dealt;
      if (r.nullified && ctx.blocked.indexOf(t) === -1) ctx.blocked.push(t);
    });
  });

  // 2. Everything else, in the order of the groups
  const shieldGroup = sk.groups.find(function (g) { return g.def.run === 'shield'; });
  const foldsIntoShield = function (g) { return shieldGroup && g.token === shieldGroup.token && !g.cond; };
  sk.groups.forEach(function (g) {
    const run = g.def.run;
    if (run === 'damage' || run === 'ignoreTaunt') return;
    if (run === 'shieldBreak' && g.token !== 'self') return; // already counted above
    if ((run === 'reflection' || (g.id === 'EF022')) && foldsIntoShield(g)) return; // goes off at the Shield step instead
    let targets = targetsOf(g);
    if (g.def.foe) targets = targets.filter(function (t) { return ctx.blocked.indexOf(t) === -1; }); // a blocked hit applies none of its extras
    const turns = groupTurns(sk, g);

    if (run === 'summon') {
      const row = mobRowFor(g.mobId);
      if (row) spawnSummon(state, user, unitFromRow(row, 'mob', user.side, 0, 'summon'), turns, undefined);
      else sheetWarn('Summon ID ' + (g.mobId || '(blank)') + ' is not in the Mobs tab, so ' + sk.name + ' summons nothing');
      return;
    }
    if (run === 'taunt') { add(user, { type: 'taunt', charges: turns }); return; }
    if (run === 'lifesteal') {
      const amount = Math.floor(ctx.dealt * (g.x || 0) / 100);
      if (amount > 0) targets.forEach(function (t) { healUnit(state, t, amount, user); });
      return;
    }

    targets.forEach(function (t) {
      switch (run) {
        case 'heal':
          healUnit(state, t, scaledAmount(user, sk, g.x), user);
          break;
        case 'cleanse': {
          const gone = removeEffects(t, function (e) { return !isBuff(e); });
          if (gone.length) state.emit('status', t, 'cleansed');
          break;
        }
        case 'dispel': dispelBuffs(state, t, g.x || 1); break;
        case 'steal':
          for (let i = 0; i < (g.x || 1); i++) if (!stealBuff(state, user, t, add)) break;
          break;
        case 'cdReduce': shiftCooldowns(state, t, g.x, false); break;
        case 'cdIncrease': shiftCooldowns(state, t, g.x, true); break;
        case 'resurrect': if (!t.alive && !t.isSummon) reviveUnit(state, t, (g.x || 0) / 100); break;
        case 'ward': {
          const pool = Math.round(scaledAmount(user, sk, g.x));
          if (!t.isSummon && t.alive) { // a Ward only replaces the current one if it is larger
            if (pool > t.ward) { t.ward = pool; t.wardMax = pool; }
            state.emit('status', t, 'Ward ' + show(t.ward));
          }
          break;
        }
        case 'assist': {
          const helpers = livingAllies(state, user).filter(function (a) {
            return a !== user && a.skills.some(function (k) { return SKILLS[k].basic; });
          });
          if (helpers.length && t.alive) {
            const ally = randomOf(helpers);
            const basic = ally.skills.find(function (k) { return SKILLS[k].basic; });
            state.emit('info', ally, 'assists');
            useSkill(state, ally, basic, t);
          }
          break;
        }
        case 'shield': {
          // Hits blocked = X, and it also ends after Y turns (or the skill's Duration). Reflection and Thorns that
          // came with the same skill go off at the Shield step.
          const e = { type: 'shield', hits: g.x || 1, charges: (g.y > 0 ? g.y : (sk.duration > 0 ? sk.duration : 99)) };
          sk.groups.forEach(function (o) {
            if (!foldsIntoShield(o)) return;
            if (o.id === 'EF010') e.reflect = reflectPercent(o);
            if (o.id === 'EF022') { e.thorns = scaledAmount(user, sk, o.x); e.thornsType = o.type || 'piercing'; }
          });
          add(t, e);
          break;
        }
        case 'reflection':
          add(t, { type: 'reflection', percent: reflectPercent(g), charges: turns, only: g.cond && g.cond.kind === 'damageGroup' ? (g.cond.groups.length > 1 ? g.cond.groups : g.cond.groups[0]) : undefined });
          break;
        case 'shieldBreak': // aimed at yourself: a lasting buff
          add(t, { type: 'shieldBreak', percent: (g.x || 0) / 100, charges: turns });
          break;
        case 'effect': {
          const e = buildGroupEffect(user, sk, g, turns);
          add(t, e);
          break;
        }
      }
    });
  });
}

// ----- can this skill be used right now? -----

// Returns a short reason if the skill would do nothing, so the turn is not wasted. Returns '' when it can be used.
function cannotUse(state, user, sk, target) {
  if (sk.groups.length) {
    const picks = { enemy: target && target.side !== user.side ? target : null, ally: target && target.side === user.side ? target : null };
    const real = sk.groups.filter(function (g) { return g.def.run !== 'ignoreTaunt'; });
    const only = function (run) { return real.every(function (g) { return g.def.run === run; }); };
    if (only('steal') && !real.some(function (g) {
      return sheetTargets(state, user, g.token, picks).some(function (t) { return stealable(t).length; });
    })) return 'needs an enemy that has a buff to steal';
    if (only('resurrect') && !fallenAllies(state, user).length) return 'has no fallen allies to revive';
    if (only('summon') && activeSummons(state, user.side).length >= MAX_SUMMONS) return 'has no free summon spot';
  }
  return '';
}

// For the enemy AI: is there any point in using this skill now? (Skills from the sheet only.)
function hasShield(unit) {
  return unit.effects.some(function (e) { return e.type === 'shield' && shieldHits(e) > 0; });
}

function worthUsing(state, user, sk, target) {
  const picks = { enemy: target && target.side !== user.side ? target : null, ally: target && target.side === user.side ? target : null };
  return sk.groups.some(function (g) {
    const targets = sheetTargets(state, user, g.token, picks);
    switch (g.def.run) {
      case 'heal': return targets.some(function (t) { return t.hp < t.maxHp; });
      case 'effect': {
        if (g.def.type === 'hot') return targets.some(function (t) { return t.hp < t.maxHp; });
        const e = buildGroupEffect(user, sk, g, groupTurns(sk, g));
        return targets.some(function (t) { return effectWouldApply(t, e); });
      }
      case 'shield': return targets.some(function (t) { return !hasShield(t); });
      case 'ward': return targets.some(function (t) { return t.ward < Math.round(scaledAmount(user, sk, g.x)); });
      case 'cleanse': return targets.some(function (t) { return t.effects.some(function (e) { return !isBuff(e); }); });
      case 'resurrect': return fallenAllies(state, user).length > 0;
      case 'summon': return activeSummons(state, user.side).length < MAX_SUMMONS;
      case 'dispel': return targets.some(function (t) { return dispellable(t).length; });
      case 'steal': return targets.some(function (t) { return stealable(t).length; });
      case 'taunt': return !user.effects.some(function (e) { return e.type === 'taunt'; });
      default: return true;
    }
  });
}

// ----- enemy and summon AI -----

// Who the AI aims a skill at
function aiTargetFor(state, unit, sk, provoke) {
  if (sk.target === 'enemy') {
    const foes = opponents(state, unit);
    if (!foes.length) return null;
    if (provoke) return provoke.source;
    const taunters = tauntersFor(state, unit, sk);
    return randomOf(taunters || foes);
  }
  if (sk.target === 'ally') { // the ally that has lost the most health
    const allies = livingAllies(state, unit);
    return allies.slice().sort(function (a, b) { return (a.hp / a.maxHp) - (b.hp / b.maxHp); })[0] || unit;
  }
  return unit;
}

// Simple AI for enemies and summons: special skills that are off cooldown come first, then the basic attack.
// Skills that would do nothing (healing a full team, stealing from a unit with no buffs) are skipped.
// Provoked: must use its basic attack on whoever provoked it. A single-target attack must hit a character with Taunt.
function chooseAction(state, unit) {
  const provoke = unit.effects.find(function (e) { return e.type === 'provoke' && e.source && e.source.alive; });
  const ready = unit.skills.filter(function (k) { return skillReady(unit, k); });
  const basics = ready.filter(function (k) { return SKILLS[k].basic; });
  const order = provoke ? basics : ready.filter(function (k) { return !SKILLS[k].basic; }).concat(basics);
  for (let i = 0; i < order.length; i++) {
    const sk = SKILLS[order[i]];
    const target = aiTargetFor(state, unit, sk, provoke);
    if (!target) continue;
    if (cannotUse(state, unit, sk, target) || !worthUsing(state, unit, sk, target)) continue;
    return { key: order[i], target: target };
  }
  return null;
}
