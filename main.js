// main.js: the battle scene, plus the game start-up (the game opens on the town, see town.js). 
// // Needs these files loaded first, in this order (see index.html):
//   Phaser, dataLoader.js, nodeBattle.js, town.js, then this file.

// ===== SETTINGS =====
const ASSET_PATH = ''; // use 'assets/' if you move the images into a folder

// Short names for image files. A sprite name from your sheets that matches a name here uses the file listed.
// Any other sprite name is used as the file name itself (".png" is added if it has no ending).
const SPRITE_FILES = {
  druid: 'elf_druid.png',
  goblin1: 'goblin_warrior.png',
  goblin2: 'orc_brute.png',
  goblin3: 'goblin_archer.png',
  goblin4: 'goblin_shaman.png',
  necromancer: 'necromancer.png',
  rogue: 'rogue.png',
  barbarian: 'barbarian.png',
  shaman: 'shaman.png',
  necromancer_summon: 'necromancer_summon.png', // loaded and ready for the necromancer's summon
};
const ALWAYS_LOAD = ['necromancer_summon']; // images the game needs even when no sheet row names them

const SPRITE_HEIGHT = 300;   // character picture height when standing closest to the camera
const SUMMON_SCALE = 0.6;    // summons are drawn at this fraction of normal size
const HP_BAR_W = 110;        // width of the health bars (they shrink a little with distance)
const HIT_ALPHA = 20;        // how solid a pixel must be (0-255) to count as touching a character when tapping

// Skill buttons: a 2 x 2 grid in the bottom right corner. Change these numbers to resize them.
const BTN_W = 190;           // button width
const BTN_H = 96;            // button height
const BTN_GAP = 10;          // space between buttons
const BTN_MARGIN = 15;       // space between the buttons and the screen edge
const BTN_FONT_SIZE = 24;    // size of the skill name
const BTN_FONT = 'Arial, Helvetica, sans-serif';

// Camera depth: the higher a character's feet are on screen, the further away they are and the smaller they are drawn.
const FAR_Y = 250;           // feet at this height are the farthest away
const NEAR_Y = 700;          // feet at this height are the closest to the camera
const FAR_SCALE = 0.55;      // size at FAR_Y compared with size at NEAR_Y (1 = same size)

// Where characters stand on the floor. x = across the screen, y = where the feet stand.
// Each side: slot 0 = back row, slots 1-2 = middle row (left, right), slots 3-4 = front row (left, right).
// Rows are 280 apart across and staggered, so each character has its own space. Spread them further by changing these numbers.
const PLAYER_SLOTS = [
  { x: 390, y: 430 },  // slot 0: back row
  { x: 250, y: 555 },  // slot 1: middle row, left
  { x: 530, y: 555 },  // slot 2: middle row, right
  { x: 120, y: 690 },  // slot 3: front row, left
  { x: 400, y: 690 },  // slot 4: front row, right
];
const ENEMY_SLOTS = [
  { x: 975,  y: 275 },  // slot 0: back row
  { x: 850,  y: 355 },  // slot 1: middle row, left
  { x: 1110, y: 355 },  // slot 2: middle row, right
  { x: 740,  y: 440 },  // slot 3: front row, left
  { x: 1000, y: 440 },  // slot 4: front row, right
];

// Summon spots (hidden until a summon stands in one). A unit uses one with: spot: 'summon', slot: 0 (or 1)
const PLAYER_SUMMON_SLOTS = [
  { x: 615, y: 395 },
  { x: 680, y: 395 },
];
const ENEMY_SUMMON_SLOTS = [
  { x: 720, y: 300 },
  { x: 790, y: 300 },
];

const SHOW_SHEET_WARNINGS = true; // show problems found in the Skills tab on the battle screen (set false to hide them)

const FLIP_PLAYER = false; // set true if your druid faces the wrong way
const FLIP_ENEMY = false;  // set true if your goblins face the wrong way

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

// Skill kinds: damage, aoe, dot, hot, shield, ward, drain, steal, summon, taunt, dmgUpAll, wardAll, massRes, armorReduce, shadow,
//   effect, cleanse, dispel, cdReduce, cdIncrease, assist
// target: enemy, ally, self, allEnemies, allAllies.  basic = the unit's basic attack (a provoked unit must use it).
// attr = the attribute that boosts the damage (2% of base damage per point). damageType = a child damage type like 'fire'.
// kind 'effect' applies any effect from the Effects tab, for example:
//   { name: 'Mirror', kind: 'effect', target: 'self', effect: { type: 'reflection', percent: 0.5, charges: 3, uses: 2 }, cd: 3 }
// Effect types: shield, hot, dot, deathWard, reflection, thorns, reactiveHeal, accuracyBoost, accuracyReduce, crit, critChanceReduce,
//   critBonus, critBonusReduce, dmgUp, shieldBreak, armorBoost, armorReduce, dmgReduceIn, vulnerable, dmgOutReduce, critResist,
//   critResistWeaken, resistance, weakenResistance, healthBoost, healthReduce, healReceivedBoost, healReceivedReduce, healOutBoost,
//   healOutReduce, attributeBoost, attributeReduce, taunt, provoke, shadow
const SKILLS = {
  // ----- Druid -----
  attack:    { name: 'Attack', kind: 'damage', target: 'enemy', damage: 20, attr: 'wisdom', damageType: 'primal', cd: 0, basic: true },
  shield:    { name: 'Shield', kind: 'shield', target: 'self', charges: 2, cd: 3 },
  poison:    { name: 'Poison', kind: 'dot', target: 'enemy', hit: 6, dot: 8, charges: 3, attr: 'wisdom', damageType: 'poison', cd: 2 },
  regrowth:  { name: 'Regrowth', kind: 'hot', target: 'ally', heal: 12, charges: 4, cd: 3 },

  // ----- Necromancer -----
  necroAttack:  { name: 'Necrotic Attack', kind: 'damage', target: 'enemy', damage: 18, lifesteal: 0.5, attr: 'intelligence', damageType: 'necrotic', cd: 0, basic: true },
  summonUndead: { name: 'Summon Undead', kind: 'summon', target: 'self', cd: 5,
                  summon: { name: 'Undead Warrior', sprite: 'necromancer_summon', hp: 20, duration: 3, skills: ['undeadSlash'], explosion: 10 } },
  drainLife:    { name: 'Drain Life', kind: 'drain', target: 'allEnemies', damage: 10, healPerHit: 5, attr: 'intelligence', damageType: 'necrotic', cd: 3 },
  weakenSoul:   { name: 'Weaken Soul', kind: 'steal', target: 'enemy', cd: 3 },
  undeadSlash:  { name: 'Slash', kind: 'damage', target: 'enemy', damage: 12, damageType: 'slashing', cd: 0, basic: true }, // the undead warrior's attack

  // ----- Barbarian -----
  axeAttack:     { name: 'Axe Attack', kind: 'damage', target: 'enemy', damage: 16, missingHealthBonus: 0.1, attr: 'strength', damageType: 'slashing', cd: 0, basic: true }, // +10% per 10% health missing
  taunt:         { name: 'Taunt', kind: 'taunt', target: 'self', charges: 2, cd: 3 }, // a buff on the Barbarian: enemies must attack him
  cleave:        { name: 'Cleave', kind: 'aoe', target: 'allEnemies', damage: 10, attr: 'strength', damageType: 'slashing', cd: 0 },
  goadingAttack: { name: 'Goading Attack', kind: 'damage', target: 'enemy', damage: 14, provoke: 1, attr: 'strength', damageType: 'crushing', cd: 2 },

  // ----- Shaman -----
  shamanAttack:     { name: 'Nature Attack', kind: 'damage', target: 'enemy', damage: 16, attr: 'wisdom', damageType: 'lightning', critBuff: { chance: 0.5, charges: 1 }, cd: 0, basic: true },
  primalScream:     { name: 'Primal Scream', kind: 'dmgUpAll', target: 'allAllies', percent: 0.25, charges: 2, cd: 3 },
  greaterWard:      { name: 'Greater Ward', kind: 'wardAll', target: 'allAllies', pool: 60, cd: 4 },
  massResurrection: { name: 'Mass Resurrection', label: 'Mass Revive', kind: 'massRes', target: 'allAllies', hpPercent: 0.25, cd: 0 },

  // ----- Rogue -----
  rogueAttack: { name: 'Rogue Attack', kind: 'damage', target: 'enemy', damage: 15, ignoresTaunt: true, attr: 'dexterity', damageType: 'piercing', cd: 0, basic: true },
  execution:   { name: 'Execution', kind: 'damage', target: 'enemy', damage: 32, executeBelow: 0.3, executeBonus: 0.5, attr: 'dexterity', damageType: 'piercing', cd: 0 },
  armorBreak:  { name: 'Armor Break', kind: 'armorReduce', target: 'enemy', percent: 0.3, charges: 3, cd: 0 }, // lowers armor by 30% (test value)
  shadowSlip:  { name: 'Shadow Slip', kind: 'shadow', target: 'self', mult: 3, charges: 2, cd: 2 },

  // ----- Goblins (some extras exist only so your heroes' skills have something to work on) -----
  stab:      { name: 'Stab', kind: 'damage', target: 'enemy', damage: 50, attr: 'strength', damageType: 'piercing', cd: 0, basic: true },
  venom:     { name: 'Venom', kind: 'aoe', target: 'allEnemies', damage: 60, damageType: 'poison', cd: 0 }, // was written with "hit", which did nothing
  bulwark:   { name: 'Bulwark', kind: 'shield', target: 'self', charges: 9, cd: 4},        // gives Weaken Soul a buff to steal
  roar:      { name: 'Roar', kind: 'taunt', target: 'self', damage: 40,  charges: 2, cd: 4 },      // gives the Rogue's taunt-ignoring attack a job
  ward:      { name: 'Ward', kind: 'ward', target: 'self', pool: 30, cd: 3 },              // not used by anyone right now
};

// ===== BUILDING UNITS FROM YOUR SHEETS =====
// Heroes come from the Hero sheet (five random ones) and enemies from the node's waves.
// Health, Armor, Speed and Dexterity are read from the sheet when it has a column for them.
// Skills still come from the code above: a unit uses the stats and skills listed here (found by its sprite name or its Name)
// whenever the sheet has no matching column.
const DRUID_STATS = { hp: 90, armor: 0, speed: 6, dex: 10, skills: ['attack', 'shield', 'poison', 'regrowth'] };
const KNOWN_UNITS = {
  elf_druid: DRUID_STATS,
  druid: DRUID_STATS,
  necromancer: { hp: 80, armor: 0, speed: 5, dex: 8,  skills: ['necroAttack', 'summonUndead', 'drainLife', 'weakenSoul'] },
  shaman: { hp: 90, armor: 0, speed: 6, dex: 8,  skills: ['shamanAttack', 'primalScream', 'greaterWard', 'massResurrection'] },
  barbarian: { hp: 100, armor: 0, speed: 4, dex: 7,  skills: ['axeAttack', 'taunt', 'cleave', 'goadingAttack'] },
  rogue: { hp: 70, armor: 0, speed: 8, dex: 12, skills: ['rogueAttack', 'execution', 'armorBreak', 'shadowSlip'] },
  goblin_warrior: { hp: 70,  armor: 3, speed: 4, dex: 5, skills: ['stab'] },
  orc_brute:      { hp: 100, armor: 6, speed: 3, dex: 5, skills: ['roar', 'bulwark', 'stab'] },
  goblin_archer:  { hp: 70,  armor: 2, speed: 5, dex: 5, skills: ['stab'] },
  goblin_shaman:  { hp: 70,  armor: 2, speed: 2, dex: 5, skills: ['venom', 'ward'] },
};
const GENERIC_HERO = { hp: 80, armor: 0, speed: 5, dex: 8, skills: ['attack'] };
const GENERIC_MOB = { hp: 70, armor: 2, speed: 4, dex: 5, skills: ['stab'] };

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

// The image file for a sprite or background name
function imageFile(value) {
  if (SPRITE_FILES[value]) return SPRITE_FILES[value];
  const v = String(value).replace(/^\/+/, ''); // "/assets/Hero/rogue.png" -> "assets/Hero/rogue.png" so it works on GitHub Pages
  if (/\.[a-z0-9]+$/i.test(v)) return v;
  return v + '.png';
}

// A steady color for a missing image, so each missing character looks different
function placeholderColor(key) {
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffffff;
  return h | 0x404040;
}

// Test stats for a unit, found by sprite name first and then by its Name
function knownStats(sprite, name, isHero) {
  const stem = String(sprite).split('/').pop().replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  const nm = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return KNOWN_UNITS[stem] || KNOWN_UNITS[nm] || (isHero ? GENERIC_HERO : GENERIC_MOB);
}

// Skills, in this order of preference:
//   1. The Skill 1 to Skill 4 columns (skill IDs from the Skills tab, built by part1b.js)
//   2. A "Skills" column with the code names from SKILLS above (separated by commas)
//   3. The test skills for that sprite or name
function skillsFor(row, base) {
  const keys = [];
  skillIdsOf(row).forEach(function (sid) {
    const key = sheetSkillKey(sid);
    if (key) keys.push(key);
  });
  const ult = String(field(row, ['Ultimate'], '')).trim();
  if (ult) sheetWarn(String(field(row, ['Hero Name', 'Mob Name', 'Name'], '?')) + ' has an Ultimate (' + ult + '). Ultimates have no button yet, so it is not used', 'note');
  if (keys.length) {
    if (!keys.some(function (k) { return SKILLS[k].basic; })) {
      sheetWarn(String(field(row, ['Hero Name', 'Mob Name', 'Name'], '?')) + ' has no Basic Attack. Set one skill\'s Cooldown to "Basic Attack"');
    }
    return keys;
  }
  const raw = String(field(row, ['Skills', 'Skill List'], ''));
  const named = raw.split(/[,;|]/).map(function (s) { return s.trim(); }).filter(function (s) { return SKILLS[s]; });
  return named.length ? named : base.skills.slice();
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
  const base = knownStats(sprite, name, isHero);
  const vitRaw = field(row, ['Vitality', 'Vit'], '');
  const vitality = (vitRaw !== '' && !isNaN(Number(vitRaw))) ? Number(vitRaw) : null;
  const hpRaw = field(row, ['HP', 'Health', 'Max HP', 'Max Health', 'Hit Points'], '');
  const hpColumn = (hpRaw !== '' && !isNaN(Number(hpRaw))) ? Number(hpRaw) : null;
  const hp = (hpColumn !== null ? hpColumn : (vitality !== null ? 0 : base.hp)) + (vitality !== null ? vitality * VITALITY_HEALTH : 0);
  const dex = statOf(row, ['Dexterity', 'Dex'], base.dex);
  return {
    id: id, name: name, sprite: sprite || 'placeholder_' + id, side: side, slot: slot,
    hp: hp,
    armor: statOf(row, ['Armor', 'Armour'], base.armor),
    speed: statOf(row, ['Speed'], base.speed),
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
    skills: skillsFor(row, base),
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

// The Undead Warrior the Necromancer summoned before summons came from the Mobs tab. It is used when a summon's mob ID is not found.
const UNDEAD_FALLBACK = { name: 'Undead Warrior', sprite: 'necromancer_summon', hp: 20, skills: ['undeadSlash'], explosion: 10 };

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

// Sprite names for every summon a row's skills can call, so the images get loaded before the battle
function summonSpritesOf(row) {
  const out = [];
  skillIdsOf(row).forEach(function (sid) {
    const key = sheetSkillKey(sid);
    if (!key || !SKILLS[key].groups) return;
    SKILLS[key].groups.forEach(function (g) {
      if (g.def.run !== 'summon') return;
      const m = mobRowFor(g.mobId);
      const s = m ? spriteValueOf(m, false) : UNDEAD_FALLBACK.sprite;
      if (s && out.indexOf(s) === -1) out.push(s);
    });
  });
  return out;
}
// ===== COMBAT RULES (no graphics in this part) =====
// Follows your Effects and Combat Rulings doc and your damage specification.
// Damage Calculation (dealHit) and Damage Resolution (takeHit) are two separate steps.
// Resolution order: Resistance -> Shield -> Armor -> Ward -> Health -> death check.

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
    initiative: Math.floor(Math.random() * 20) + 1 + def.speed, // random roll + Speed modifier, fixed for the node
    tie: Math.random(),
  });
}

// Puts one wave of enemies on the field and rebuilds the turn order. Returns the new enemy units.
function spawnWave(state, waveIndex) {
  const added = [];
  state.waves[waveIndex].forEach(function (mob, slot) {
    if (!mob) return; // empty slot
    state.mobCount += 1;
    const unit = makeUnit(unitFromRow(mob, 'mob', 'enemy', slot, 'mob' + state.mobCount));
    state.units.push(unit);
    added.push(unit);
  });
  state.order = state.units.filter(function (u) { return !u.isSummon; }).sort(compareInitiative);
  state.turn = -1;     // each wave starts at the top of the turn order
  state.pending = [];
  return added;
}

// The current wave is cleared: its enemies leave and the next wave comes in. Returns the new enemy units.
function advanceWave(state) {
  state.units = state.units.filter(function (u) { return u.side !== 'enemy'; });
  state.waveIndex += 1;
  state.waveCleared = false;
  return spawnWave(state, state.waveIndex);
}

function newBattle(emit, heroRows, nodeData) {
  const state = {
    units: [], order: [], turn: -1, serial: 0, over: null, emit: emit,
    pending: [], current: null, summonCount: 0, // summons waiting to act right after their summoner
    waves: nodeData.waves, waveIndex: 0, waveCleared: false, mobCount: 0,
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
  return list[Math.floor(Math.random() * list.length)];
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
    case 'dot': return 'DoT ' + Math.round(e.damage * 10) / 10 + x;
    case 'hot': return 'HoT ' + e.heal + x;
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
    case 'thorns': return 'Thorns ' + e.damage + x;
    case 'reactiveHeal': return 'Reactive heal ' + e.heal + x;
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

// A critical hit: everything the crit adds (the multiplier's extra damage and the flat Critical Bonus) is cut by the target's Critical Resistance
function critDamage(target, amount, c) {
  const resist = Math.max(0, Math.min(1, (target.baseCritResist || 0) + bestOf(target, 'critResist', 'percent') - bestOf(target, 'critResistWeaken', 'percent')));
  return amount + (amount * (c.mult - 1) + c.bonus) * (1 - resist);
}

// A Damage Over Time can crit, but the roll is made ONCE when it is applied, never on each tick.
// A crit raises the damage of every tick of that Damage Over Time.
function rollDotCrit(state, user, target, tick) {
  const c = critNumbers(user);
  if (c.chance > 0 && Math.random() < c.chance) {
    state.emit('crit', target, 'CRIT!');
    return critDamage(target, tick, c);
  }
  return tick;
}

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
  if (sk.missingHealthBonus) { // Barbarian: more damage for each 10% of health missing
    const tens = Math.floor((user.maxHp - user.hp) * 10 / user.maxHp + 1e-9);
    pct += sk.missingHealthBonus * tens;
  }
  if (sk.executeBelow && target.hp < target.maxHp * sk.executeBelow) pct += sk.executeBonus; // Execution
  if (mods.shieldBreak && target.ward > 0) pct += mods.shieldBreak;                           // Shield Break
  const attrBonus = sk.attr ? base * attrOf(user, sk.attr) * (sk.scale !== undefined ? sk.scale : ATTR_SCALING) : 0;
  let amt = Math.max(0, (base + attrBonus + base * pct + mods.flat) * mods.shadow);
  if (mods.critChance > 0 && Math.random() < mods.critChance) {
    amt = critDamage(target, amt, { mult: mods.critMult, bonus: mods.critBonus });
    state.emit('crit', target, 'CRIT!');
  }
  return takeHit(state, target, amt, { attacker: user, type: sk.damageType, parts: sk.damageParts });
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

// Sends damage back at the attacker. It goes through the attacker's defenses but cannot trigger reactive effects again.
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
// Order: Resistance, Shield, Armor, Ward, Health, then the death check.
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
  // The part of the hit (after Resistance) that is a damage type or group, for a Reflection that only reflects some types
  const shareOf = function (only) {
    if (!only) return 1;
    let total = 0, match = 0;
    parts.forEach(function (p, i) { total += partDmg[i]; if (typeMatches(p.type, only)) match += partDmg[i]; });
    return total > 0 ? match / total : 0;
  };

  // 2. Shield: one charge fully nullifies one hit. DoT ticks bypass Shields.
  if (!opts.dotTick) {
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

  // 3. Armor: flat reduction, never below zero
  dmg = Math.max(0, dmg - armorOf(unit, attacker));
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

  // 5. Health (never below zero)
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

  // 6. Death check: a Death Ward charge is used up instead of dying
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

// The targets a skill hits, for the skills that do not handle their own targets
function eachTarget(state, user, sk, target) {
  if (sk.target === 'allEnemies') return opponents(state, user);
  if (sk.target === 'allAllies') {
    return state.units.filter(function (u) { return u.side === user.side && u.alive && !u.isSummon; });
  }
  return [target];
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
  const livingAllies = function () {
    return state.units.filter(function (u) { return u.side === user.side && u.alive && !u.isSummon; });
  };

  if (sk.kind === 'sheet') {
    useSheetSkill(state, user, sk, target, add);
  } else if (sk.kind === 'damage') {
    const r = dealHit(state, user, sk, target, prepareDamage(user), sk.damage);
    // Lifesteal: a share of the damage that reached health comes back as healing, fractions rounded down
    if (sk.lifesteal && r.dealt > 0) healUnit(state, user, Math.floor(r.dealt * sk.lifesteal), user);
    // Provoke rides on the hit: if a Shield nullifies the hit, the Provoke is not applied
    if (sk.provoke && target.alive && !r.nullified) add(target, { type: 'provoke', charges: sk.provoke, source: user });
    // Nature Attack: a random ally gets a crit chance buff
    if (sk.critBuff) {
      const others = livingAllies().filter(function (u) { return u !== user; });
      const who = others.length ? randomOf(others) : user;
      add(who, { type: 'crit', chance: sk.critBuff.chance, charges: sk.critBuff.charges });
    }
  } else if (sk.kind === 'aoe') {
    const mods = prepareDamage(user);
    const base = sk.damage !== undefined ? sk.damage : sk.hit;
    opponents(state, user).forEach(function (e) { dealHit(state, user, sk, e, mods, base); });
  } else if (sk.kind === 'shield') {
    // reflect / thorns on a Shield skill go off at the Shield step
    add(target, { type: 'shield', charges: sk.charges, reflect: sk.reflect, thorns: sk.thorns, thornsType: sk.thornsType });
  } else if (sk.kind === 'dot') {
    // The initial hit is subject to Shields. If a Shield nullifies it, the DoT is not applied.
    const r = dealHit(state, user, sk, target, prepareDamage(user), sk.hit);
    if (!r.nullified && target.alive && !target.isSummon) { // summons cannot receive debuffs
      add(target, { type: 'dot', damage: rollDotCrit(state, user, target, sk.dot), charges: sk.charges, damageType: sk.damageType });
    }
  } else if (sk.kind === 'hot') {
    // Heal over time: X every turn for Y turns, at the start of the target's turns. Several can run together.
    add(target, { type: 'hot', heal: sk.heal, charges: sk.charges, source: user });
  } else if (sk.kind === 'ward') {
    // A new ward only replaces the current pool if it is larger. No duration.
    if (sk.pool > target.ward) { target.ward = sk.pool; target.wardMax = sk.pool; }
    state.emit('status', target, 'Ward ' + target.ward);
  } else if (sk.kind === 'wardAll') {
    livingAllies().forEach(function (a) {
      if (sk.pool > a.ward) { a.ward = sk.pool; a.wardMax = sk.pool; }
      state.emit('status', a, 'Ward ' + a.ward);
    });
  } else if (sk.kind === 'dmgUpAll') {
    livingAllies().forEach(function (a) { add(a, { type: 'dmgUp', percent: sk.percent, charges: sk.charges }); });
  } else if (sk.kind === 'taunt') {
    // Taunt is a buff on the character using the skill: enemies' single-target attacks must hit a taunter
    add(user, { type: 'taunt', charges: sk.charges });
  } else if (sk.kind === 'armorReduce') {
    add(target, { type: 'armorReduce', percent: sk.percent, charges: sk.charges });
  } else if (sk.kind === 'shadow') {
    add(user, { type: 'shadow', mult: sk.mult, charges: sk.charges });
  } else if (sk.kind === 'massRes') {
    // Revives every fallen ally (never summons). Each keeps its place in the turn order and gets no extra turn.
    state.units.filter(function (u) { return u.side === user.side && !u.alive && !u.isSummon; })
      .forEach(function (u) { reviveUnit(state, u, sk.hpPercent); });
  } else if (sk.kind === 'summon') {
    const def = sk.summon;
    spawnSummon(state, user, {
      name: def.name, sprite: def.sprite, hp: def.hp, armor: 0, speed: 0, dex: 0, accuracy: 0,
      attrs: { strength: 0, dexterity: 0, wisdom: 0, intelligence: 0, vitality: def.hp / VITALITY_HEALTH },
      resist: { base: {} }, skills: def.skills,
    }, def.duration, def.explosion);
  } else if (sk.kind === 'drain') {
    // Damages every enemy, then heals every ally for healPerHit for each enemy that was hit
    const mods = prepareDamage(user);
    let hits = 0;
    opponents(state, user).forEach(function (e) {
      const r = dealHit(state, user, sk, e, mods, sk.damage);
      if (!r.nullified) hits += 1;
    });
    const amount = hits * sk.healPerHit;
    if (amount > 0) livingAllies().forEach(function (u) { healUnit(state, u, amount, user); });
  } else if (sk.kind === 'steal') {
    stealBuff(state, user, target, add);
  } else if (sk.kind === 'effect') {
    // Any effect from the Effects tab, built in the skill's "effect" field
    eachTarget(state, user, sk, target).forEach(function (t) {
      add(t, Object.assign({ source: user }, sk.effect));
    });
  } else if (sk.kind === 'cleanse') {
    // Removes all debuffs
    eachTarget(state, user, sk, target).forEach(function (t) {
      const gone = removeEffects(t, function (e) { return !isBuff(e); });
      if (gone.length) state.emit('status', t, 'cleansed');
    });
  } else if (sk.kind === 'dispel') {
    // Removes X random buffs (a Ward cannot be dispelled, and buffs marked "Can Be Dispelled = off" are skipped)
    eachTarget(state, user, sk, target).forEach(function (t) {
      dispelBuffs(state, t, sk.count || 1);
    });
  } else if (sk.kind === 'cdReduce' || sk.kind === 'cdIncrease') {
    // Cooldown Increase also hits skills that are ready now, but never basic attacks
    eachTarget(state, user, sk, target).forEach(function (t) {
      shiftCooldowns(state, t, sk.amount, sk.kind === 'cdIncrease');
    });
  } else if (sk.kind === 'assist') {
    // A random living ally uses their basic attack on the target
    const helpers = livingAllies().filter(function (a) {
      return a !== user && a.skills.some(function (k) { return SKILLS[k].basic; });
    });
    if (helpers.length && target && target.alive) {
      const ally = randomOf(helpers);
      const basic = ally.skills.find(function (k) { return SKILLS[k].basic; });
      state.emit('info', ally, 'assists');
      useSkill(state, ally, basic, target);
    }
  }
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
    // 1. DoTs resolve, oldest first. They bypass Shields but still use Resistance, Armor, Ward and Health.
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

// ----- shared actions (the older skill kinds use these too) -----

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

// Puts a summon beside its summoner if there is room. base = the stats of the summon (a mob row built by unitFromRow, or the old test Undead Warrior).
function spawnSummon(state, user, base, duration, explosion) {
  const used = activeSummons(state, user.side).map(function (u) { return u.slot; });
  const slot = [0, 1].find(function (i) { return used.indexOf(i) === -1; });
  if (slot === undefined || used.length >= MAX_SUMMONS) return null;
  state.summonCount += 1;
  const sm = Object.assign(makeUnit(Object.assign({}, base, { id: 'summon' + state.summonCount, side: user.side, spot: 'summon', slot: slot })), {
    initiative: 0, tie: 0, isSummon: true, owner: user.id, duration: duration, explodes: explosion,
  });
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
  if (d.uses) e.uses = g.y > 0 ? g.y : 1;
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
      else {
        const u = UNDEAD_FALLBACK;
        spawnSummon(state, user, {
          name: u.name, sprite: u.sprite, hp: u.hp, armor: 0, speed: 0, dex: 0, accuracy: 0,
          attrs: { strength: 0, dexterity: 0, wisdom: 0, intelligence: 0, vitality: u.hp / VITALITY_HEALTH },
          resist: { base: {} }, skills: u.skills,
        }, turns, u.explosion);
      }
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
            state.emit('status', t, 'Ward ' + t.ward);
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
          // a Damage Over Time rolls its crit once, now (only if it will actually be applied)
          if (e.type === 'dot' && effectWouldApply(t, e)) e.damage = rollDotCrit(state, user, t, e.damage);
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
  if (sk.kind === 'steal' && !stealable(target).length) return 'needs an enemy that has a buff to steal';
  if (sk.kind === 'massRes' && !fallenAllies(state, user).length) return 'has no fallen allies to revive';
  if (sk.kind === 'summon' && activeSummons(state, user.side).length >= MAX_SUMMONS) return 'has no free summon spot';
  if (sk.kind === 'sheet' && sk.groups.length) {
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
  if (sk.kind === 'shield') return !hasShield(target);   // no new Shield while one is still up
  if (sk.kind === 'ward') return target.ward < sk.pool;
  if (sk.kind !== 'sheet') return true;
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
  if (sk.target === 'ally' && sk.kind === 'sheet') { // the ally that has lost the most health
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
// ===== SCENE (graphics and input) =====
const EVENT_COLORS = {
  damage: '#ff6666', heal: '#66ff88', ward: '#66ccff', block: '#ffee66',
  status: '#cc88ff', death: '#ff4444', info: '#dddddd', summon: '#cc88ff', expire: '#aaaaaa', crit: '#ffd34d', revive: '#66ff88',
};

function makeLabel(scene, x, y, str, size) {
  return scene.add.text(x, y, str, { fontSize: size + 'px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
}

// Bigger when close to the camera (low on screen), smaller when far away (high on screen)
function depthScale(y) {
  const t = Math.max(0, Math.min(1, (y - FAR_Y) / (NEAR_Y - FAR_Y)));
  return FAR_SCALE + (1 - FAR_SCALE) * t;
}

// Position of a character slot (or a summon spot) on the floor
function slotPosition(side, i, spot) {
  const list = spot === 'summon'
    ? (side === 'player' ? PLAYER_SUMMON_SLOTS : ENEMY_SUMMON_SLOTS)
    : (side === 'player' ? PLAYER_SLOTS : ENEMY_SLOTS);
  return list[i];
}

// A simple room in perspective: back wall, floor with lines running to a vanishing point, and a floor ring
function drawBackdrop(scene, W, H) {
  const g = scene.add.graphics().setDepth(-10);
  const wallTop = 0;
  const wallBottom = 215;
  const vanishY = 150;
  g.fillStyle(0x1b2730, 1);
  g.fillRect(0, wallTop, W, wallBottom - wallTop);
  for (let x = 0; x < W; x += 90) {
    g.fillStyle(0x24343f, 1);
    g.fillRect(x + 8, wallTop + 14, 74, wallBottom - wallTop - 28);
    g.fillStyle(0x2f4552, 1);
    g.fillRect(x + 8, wallTop + 14, 74, 6);
  }
  g.fillStyle(0x2a323a, 1);
  g.fillRect(0, wallBottom, W, H - wallBottom);
  g.fillStyle(0x3a4a57, 0.25);
  g.fillEllipse(W / 2, 480, 1100, 330);
  g.lineStyle(2, 0x3c4953, 0.7);
  for (let bx = -1400; bx <= 2700; bx += 160) {
    const x0 = W / 2 + (bx - W / 2) * (wallBottom - vanishY) / (H - vanishY);
    g.lineBetween(x0, wallBottom, bx, H);
  }
  for (let k = 1; k <= 7; k++) {
    const y = wallBottom + (H - wallBottom) * Math.pow(k / 8, 1.8);
    g.lineBetween(0, y, W, y);
  }
  g.lineStyle(3, 0x56707f, 0.5);
  g.strokeEllipse(W / 2, 480, 1100, 330);
}

function makePad(scene, x, y, color, k) {
  const s = k || 1;
  return scene.add.ellipse(x, y - 4, 130 * s, 34 * s, color, 0.35).setStrokeStyle(2, color);
}

// How far down (0 to 1) the top of the character's head is inside its picture, so health bars sit at the head
const figureTopCache = {};
function figureTop(scene, key) {
  if (figureTopCache[key] !== undefined) return figureTopCache[key];
  let result = 0;
  try {
    const src = scene.textures.get(key).getSourceImage();
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let y = 0; y < c.height && result === 0; y++) {
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] > 20) { result = y / c.height; break; }
      }
    }
  } catch (e) {
    result = 0;
  }
  figureTopCache[key] = result;
  return result;
}

const battleScene = {
  key: 'Battle',

  // Runs every time the battle starts or restarts: picks the node and the five heroes
  init: function () {
    const scene = this;
    this.problem = '';
    this.heroRows = [];
    this.nodeData = null;
    this.spriteKeys = [];

    if (typeof startRandomNodeBattle !== 'function' || typeof pickRandomHeroes !== 'function') {
      this.problem = 'nodeBattle.js is missing or out of date.\nIt needs the pickRandomHeroes function (Part 3 of the loader doc).';
      return;
    }
    this.heroRows = pickRandomHeroes(5);
    this.nodeData = startRandomNodeBattle();
    if (!this.nodeData) {
      this.problem = 'No nodes found.\nCheck data/nodes.csv and that its ID column is headed Node ID.';
      return;
    }
    if (!this.heroRows.length) {
      this.problem = 'No heroes found.\nCheck data/heroes.csv.';
      return;
    }
    let mobCount = 0;
    this.nodeData.waves.forEach(function (wave) { wave.forEach(function (m) { if (m) mobCount += 1; }); });
    if (!mobCount) {
      this.problem = 'Node ' + this.nodeData.nodeId + ' has no enemies.\nCheck its Wave columns and mob IDs in data/nodes.csv.';
      return;
    }

    // Every image this battle needs, so preload can fetch them
    const keys = {};
    ALWAYS_LOAD.forEach(function (k) { keys[k] = true; });
    this.heroRows.forEach(function (row) {
      const s = spriteValueOf(row, true);
      if (s) keys[s] = true;
      summonSpritesOf(row).forEach(function (k) { keys[k] = true; });
    });
    this.nodeData.waves.forEach(function (wave) {
      wave.forEach(function (mob) {
        if (!mob) return;
        const s = spriteValueOf(mob, false);
        if (s) keys[s] = true;
        summonSpritesOf(mob).forEach(function (k) { keys[k] = true; });
      });
    });
    this.spriteKeys = Object.keys(keys);
  },

  preload: function () {
    const scene = this;
    if (this.problem) return;
    this.load.on('loaderror', function (file) {
      console.log('missing file: ' + file.key);
    });
    this.load.setPath(ASSET_PATH);
    this.spriteKeys.forEach(function (key) { scene.load.image(key, imageFile(key)); });
    if (this.nodeData.background) {
      this.load.image('bg_' + this.nodeData.background, imageFile(this.nodeData.background));
    }
    this.load.setPath('');
  },

  create: function () {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W;
    this.H = H;

    // If the data could not be used, say why on the screen (the console is hard to reach on an iPad)
    if (this.problem) {
      this.add.text(W / 2, H / 2, this.problem, {
        fontSize: '32px', color: '#ffcc66', align: 'center', wordWrap: { width: W - 160 },
      }).setOrigin(0.5);
      return;
    }

    // Background: the node's background image if it exists, otherwise the plain room
    const bgKey = this.nodeData.background ? 'bg_' + this.nodeData.background : '';
    if (bgKey && this.textures.exists(bgKey)) {
      this.add.image(W / 2, H / 2, bgKey).setDisplaySize(W, H).setDepth(-10);
    } else {
      drawBackdrop(this, W, H);
    }

    // Top bar
    this.add.rectangle(W / 2, 30, W, 60, 0x000000, 0.6);
    // HOME goes back to the town. It sits above the VICTORY / DEFEAT screen so it still works there.
    makeLabel(this, 60, 30, 'HOME', 24).setPadding(18, 14, 18, 14).setDepth(3002).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.scene.start('Town'); });
    this.nodeText = makeLabel(this, 330, 30, String(this.nodeData.name), 22);
    makeLabel(this, W / 2 - 80, 30, 'Energy 0/0', 24);
    makeLabel(this, W / 2 + 120, 30, 'Gold 0', 24);
    this.waveText = makeLabel(this, W - 100, 30, '', 24);

    // Ground pads for the 5 character positions (summon spots stay hidden until used)
    for (let i = 0; i < PLAYER_SLOTS.length; i++) {
      const p = slotPosition('player', i);
      const e = slotPosition('enemy', i);
      makePad(this, p.x, p.y, 0x3366cc, depthScale(p.y));
      makePad(this, e.x, e.y, 0xcc3333, depthScale(e.y));
    }

    // Battle state
    const scene = this;
    this.battle = newBattle(function (type, unit, text) { scene.onEvent(type, unit, text); }, this.heroRows, this.nodeData);
    this.active = null;       // the hero whose turn it is (or was last)
    this.allyTarget = null;   // who a single-target ally skill will hit
    this.awaitingPlayer = false;
    this.logLines = [];

    // Unit views
    this.targetRing = this.add.ellipse(0, 0, 170, 44).setStrokeStyle(3, 0xff4444).setVisible(false);
    this.targetMarker = this.add.triangle(0, 0, 0, 0, 30, 0, 15, 24, 0xff4444)
      .setStrokeStyle(3, 0xffffff).setDepth(2000).setVisible(false);
    this.allyMarker = this.add.triangle(0, 0, 0, 0, 30, 0, 15, 24, 0x44dd66)
      .setStrokeStyle(3, 0xffffff).setDepth(2000).setVisible(false);
    this.views = {};
    this.battle.units.forEach(function (u) { scene.makeView(u); });
    this.target = this.battle.units.find(function (u) { return u.side === 'enemy' && u.alive; });
    this.updateWaveText();

    // Info text
    this.turnText = makeLabel(this, W / 2, 82, '', 24).setDepth(1500).setBackgroundColor('#000000').setPadding(10, 2, 10, 2);
    this.orderText = makeLabel(this, W / 2, 106, '', 14).setDepth(1500).setBackgroundColor('#000000').setPadding(8, 2, 8, 2);
    this.logText = this.add.text(W / 2 - 60, H - 8, '', {
      fontSize: '16px', color: '#ffffff' backgroundColor:'#000000', padding: { x: 8, y: 6 } lineSpacing: 4, wordWrap: { width: 270 },
    }).setOrigin(0, 1).setDepth(1500).setVisible(false);

    // Four skill buttons in a 2 x 2 grid, bottom right. They show the skills of whichever hero is acting.
    // Order: skill 1 top left, skill 2 top right, skill 3 bottom left, skill 4 bottom right.
    this.buttons = [];
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = W - BTN_MARGIN - BTN_W / 2 - (1 - col) * (BTN_W + BTN_GAP);
      const y = H - BTN_MARGIN - BTN_H / 2 - (1 - row) * (BTN_H + BTN_GAP);
      const box = scene.add.rectangle(x, y, BTN_W, BTN_H, 0x444444).setStrokeStyle(3, 0xffffff).setDepth(1500).setInteractive();
      const label = scene.add.text(x, y, '', {
        fontFamily: BTN_FONT, fontSize: BTN_FONT_SIZE + 'px', fontStyle: 'bold', color: '#ffffff', align: 'center',
        stroke: '#000000', strokeThickness: 4, wordWrap: { width: BTN_W - 20 },
      }).setOrigin(0.5).setDepth(1501);
      const cdLabel = scene.add.text(x, y + BTN_H / 2 - 20, '', {
        fontFamily: BTN_FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffcc66', align: 'center',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(1501);
      box.on('pointerdown', function () { scene.playerUse(i); });
      scene.buttons.push({ box: box, label: label, cdLabel: cdLabel, y: y });
    }

    // Problems found while reading the Skills tab (a wrong target, a missing number...) show in small yellow text, top left
    const problems = SHEET_WARNINGS.filter(function (w) { return w.level === 'error'; }).map(function (w) { return w.text; });
    if (SHOW_SHEET_WARNINGS && problems.length) {
      const shown = problems.slice(0, 4);
      if (problems.length > 4) shown.push('(+' + (problems.length - 4) + ' more in the console)');
      this.add.text(10, 70, 'Sheet problems:\n' + shown.join('\n'), {
        fontSize: '13px', color: '#ffe066', backgroundColor: '#000000aa', lineSpacing: 2, wordWrap: { width: 430 },
      }).setDepth(2500);
    }

    this.refresh();
    this.time.delayedCall(600, function () { scene.continueBattle(); });
  },

  extend: {

  // Makes a plain colored figure if an image is missing
  ensureTexture: function (key) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(placeholderColor(key), 1);
    g.fillRoundedRect(27, 2, 46, 96, 18);
    g.generateTexture(key, 100, 100);
    g.destroy();
  },

  makeView: function (u) {
    const scene = this;
    this.ensureTexture(u.sprite);
    const isSummon = u.spot === 'summon';
    const slot = slotPosition(u.side, u.slot, u.spot);
    const k = depthScale(slot.y) * (isSummon ? SUMMON_SCALE : 1);
    const h = SPRITE_HEIGHT * k;
    const bw = HP_BAR_W * (0.5 + 0.5 * k);
    let pad = null;
    if (isSummon) pad = makePad(this, slot.x, slot.y, u.side === 'player' ? 0x3366cc : 0xcc3333, k);
    const ring = this.add.ellipse(slot.x, slot.y - 4, 170 * k, 44 * k)
      .setStrokeStyle(3, 0xffff00).setVisible(false).setDepth(slot.y + 1);
    const sprite = this.add.image(slot.x, slot.y, u.sprite).setOrigin(0.5, 1).setDepth(slot.y);
    sprite.setScale(h / sprite.height);
    sprite.setFlipX(u.side === 'player' ? FLIP_PLAYER : FLIP_ENEMY);
    this.tweens.add({
      targets: sprite, y: slot.y - 8 * k, duration: 700 + Math.random() * 300,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const top = Math.max(84, slot.y - h + figureTop(this, u.sprite) * h - 14); // just above the character's head
    const hpBack = this.add.rectangle(slot.x - bw / 2, top, bw, 12, 0x000000).setOrigin(0, 0.5).setDepth(1000);
    const hpFill = this.add.rectangle(slot.x - bw / 2, top, bw, 12, 0x44cc44).setOrigin(0, 0.5).setDepth(1000);
    const wardBack = this.add.rectangle(slot.x - bw / 2, top + 11, bw, 8, 0x000000)
      .setOrigin(0, 0.5).setDepth(1000).setVisible(false);
    const wardFill = this.add.rectangle(slot.x - bw / 2, top + 11, bw, 8, 0x4aa8ff)
      .setOrigin(0, 0.5).setDepth(1001).setVisible(false);
    const status = this.add.text(slot.x, slot.y - 8, '', {
      fontSize: '18px', color: '#ffffff', align: 'center', backgroundColor: '#000000', padding: [ x: 6, y: 3],
    }).setOrigin(0.5, 1).setDepth(1000).setVisible(false);
    sprite.setInteractive(this.input.makePixelPerfect(HIT_ALPHA));
    sprite.on('pointerdown', function () {
      if (u.side === 'enemy') scene.selectTarget(u);
      else scene.selectAlly(u);
    });
    this.views[u.id] = {
      slot: slot, ring: ring, sprite: sprite, hpBack: hpBack, hpFill: hpFill,
      wardBack: wardBack, wardFill: wardFill, status: status, pad: pad, h: h, bw: bw, barY: top, k: k,
    };
  },

  // Removes a character's picture, bars and text from the screen
  destroyView: function (id) {
    const v = this.views[id];
    if (!v) return;
    this.tweens.killTweensOf(v.sprite);
    [v.sprite, v.hpBack, v.hpFill, v.wardBack, v.wardFill, v.status, v.ring, v.pad].forEach(function (o) {
      if (o) o.destroy();
    });
    delete this.views[id];
  },

  updateWaveText: function () {
    this.waveText.setText('Wave ' + (this.battle.waveIndex + 1) + '/' + this.battle.waves.length);
  },

  selectTarget: function (u) {
    if (!u.alive) return;
    this.target = u;
    this.refresh();
  },

  selectAlly: function (u) {
    if (!u.alive || u.isSummon) return; // summons cannot be healed or buffed
    this.allyTarget = u;
    this.refresh();
  },

  onEvent: function (type, unit, text) {
    if (type === 'summon' && !this.views[unit.id]) this.makeView(unit); // a new summon appears on the field
    const view = this.views[unit.id];
    this.logLines.push(unit.name + ' ' + (type === 'info' ? text : '[' + text + ']'));
    if (this.logLines.length > 5) this.logLines.shift();
    if (this.logText) this.logText.setText(this.logLines.join('\n')).setVisible(true);
    if (type === 'info' || !view) return;
    const t = this.add.text(view.slot.x + (Math.random() * 40 - 20), view.slot.y - view.h / 2, text, {
      fontSize: '30px', color: EVENT_COLORS[type] || '#ffffff', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(2000);
    this.tweens.add({
      targets: t, y: t.y - 60, alpha: 0, duration: 1000,
      onComplete: function () { t.destroy(); },
    });
  },

  refresh: function () {
    const scene = this;
    if (this.target && !this.target.alive) {
      this.target = this.battle.units.find(function (u) { return u.side === 'enemy' && u.alive; });
    }
    this.battle.units.forEach(function (u) {
      const v = scene.views[u.id];
      if (!v) return;
      if (u.isSummon && !u.alive) { // a summon that expired or was defeated leaves the field
        [v.sprite, v.hpBack, v.hpFill, v.wardBack, v.wardFill, v.status, v.ring].forEach(function (o) { o.setVisible(false); });
        if (v.pad) v.pad.setVisible(false);
        return;
      }
      v.hpFill.width = Math.max(0, v.bw * u.hp / u.maxHp);
      const showWard = u.alive && u.ward > 0;
      v.wardBack.setVisible(showWard);
      v.wardFill.setVisible(showWard);
      if (showWard) v.wardFill.width = v.bw * Math.min(1, u.ward / Math.max(u.wardMax, u.ward));
      v.sprite.setAlpha(u.alive ? 1 : 0.25);
      if (v.pad) v.pad.setVisible(u.alive);
      const lines = [];
      if (u.isSummon) lines.push(u.duration + ' turns left');
      if (u.ward > 0) lines.push('Ward ' + u.ward);
      u.effects.forEach(function (e) { lines.push(effectLabel(e)); });
      v.status.setText(u.alive ? lines.join('\n') : '').setVisible(u.alive && line.length > 0);
      v.hpFill.setFillStyle(u.hp / u.maxHp > 0.3 ? 0x44cc44 : 0xcc4444);
    });
    if (this.target && this.views[this.target.id]) {
      const tv = this.views[this.target.id];
      this.targetRing.setPosition(tv.slot.x, tv.slot.y - 4).setScale(tv.k).setDepth(tv.slot.y + 2).setVisible(true);
      this.targetMarker.setPosition(tv.slot.x, Math.max(68, tv.barY - 26)).setVisible(true);
    } else {
      this.targetRing.setVisible(false);
      this.targetMarker.setVisible(false);
    }
    // Green arrow over the ally a single-target ally skill (like Regrowth) will hit
    const wantsAlly = this.awaitingPlayer && this.active &&
      this.active.skills.some(function (k) { return SKILLS[k].target === 'ally'; });
    if (this.allyTarget && !this.allyTarget.alive) this.allyTarget = this.active;
    if (wantsAlly && this.allyTarget) {
      const av = this.views[this.allyTarget.id];
      this.allyMarker.setPosition(av.slot.x, Math.max(68, av.barY - 26)).setVisible(true);
    } else {
      this.allyMarker.setVisible(false);
    }
    this.buttons.forEach(function (b, i) {
      const key = scene.active ? scene.active.skills[i] : undefined;
      const sk = key ? SKILLS[key] : null;
      b.box.setVisible(!!sk);
      b.label.setVisible(!!sk);
      b.cdLabel.setVisible(false);
      if (!sk) return;
      const cd = scene.active.cd[key] || 0;
      const ready = scene.awaitingPlayer && cd === 0;
      b.box.setFillStyle(ready ? 0x2f7a3f : 0x2a2a2a);
      b.box.setStrokeStyle(3, ready ? 0xffffff : 0x666666);
      b.label.setText(sk.label || sk.name);
      b.label.setColor(ready ? '#ffffff' : '#9a9a9a');
      b.label.setY(cd > 0 ? b.y - 14 : b.y); // nudge the name up to make room for the cooldown line
      b.cdLabel.setText('Cooldown ' + cd).setVisible(cd > 0);
    });
  },

  // Decides what happens next: the result screen, the next wave, or the next turn
  continueBattle: function () {
    checkOver(this.battle);
    if (this.battle.over) this.showResult();
    else if (this.battle.waveCleared) this.startNextWave();
    else this.nextTurn();
  },

  // The wave is cleared: its defeated enemies leave and the next wave walks in
  startNextWave: function () {
    const scene = this;
    const battle = this.battle;
    battle.units.filter(function (u) { return u.side === 'enemy'; })
      .forEach(function (u) { scene.destroyView(u.id); });
    const fresh = advanceWave(battle);
    fresh.forEach(function (u) { scene.makeView(u); });
    this.target = fresh.find(function (u) { return u.alive; });
    this.updateWaveText();
    this.active = null;
    this.awaitingPlayer = false;
    this.refresh();
    const banner = makeLabel(this, this.W / 2, this.H / 2 - 60, 'WAVE ' + (battle.waveIndex + 1), 64).setDepth(3000);
    this.tweens.add({
      targets: banner, alpha: 0, duration: 800, delay: 600,
      onComplete: function () { banner.destroy(); },
    });
    this.time.delayedCall(1200, function () { scene.continueBattle(); });
  },

  nextTurn: function () {
    const scene = this;
    const u = nextActor(this.battle);
    if (!u) { this.showResult(); return; }
    this.current = u;
    for (const id in this.views) this.views[id].ring.setVisible(false);
    this.views[u.id].ring.setVisible(true);
    this.turnText.setText(u.name + "'s turn");
    this.orderText.setText('Next: ' + upcoming(this.battle, 3).map(function (x) { return x.name; }).join(' > '));
    startTurn(this.battle, u); // heal-over-time effects resolve at the start of the turn

    if (u.side === 'player' && !u.isSummon) {
      this.active = u;
      // If an enemy has Taunt, single-target attacks must hit one of the taunters (you can still pick between them)
      const taunters = tauntersFor(this.battle, u, { target: 'enemy' });
      if (taunters && taunters.indexOf(this.target) === -1) this.target = taunters[0];
      this.allyTarget = u;
      this.awaitingPlayer = true;
      this.refresh();
    } else {
      this.awaitingPlayer = false;
      this.refresh();
      this.time.delayedCall(700, function () {
        const act = chooseAction(scene.battle, u);
        if (act) useSkill(scene.battle, u, act.key, act.target);
        scene.refresh();
        scene.time.delayedCall(700, function () { scene.finishTurn(u); });
      });
    }
  },

  playerUse: function (index) {
    const scene = this;
    if (!this.awaitingPlayer || this.battle.over || !this.active) return;
    const hero = this.active;
    const key = hero.skills[index];
    if (!key || !skillReady(hero, key)) return;
    const sk = SKILLS[key];
    let target = hero;
    if (sk.target === 'enemy') {
      target = this.target;
      const taunters = tauntersFor(this.battle, hero, sk); // must hit an enemy with Taunt, unless the skill ignores Taunt
      if (taunters && taunters.indexOf(target) === -1) {
        target = taunters[0];
        this.target = target;
        this.onEvent('info', hero, 'must attack an enemy with Taunt');
      }
      if (!target || !target.alive) return;
    } else if (sk.target === 'ally') {
      target = (this.allyTarget && this.allyTarget.alive) ? this.allyTarget : hero;
    }
    // Skills that cannot be used right now do not cost the turn
    const why = cannotUse(this.battle, hero, sk, target);
    if (why) {
      this.onEvent('info', hero, why);
      return;
    }
    this.awaitingPlayer = false;
    useSkill(this.battle, hero, key, target);
    this.refresh();
    this.time.delayedCall(700, function () { scene.finishTurn(hero); });
  },

  finishTurn: function (u) {
    const scene = this;
    endTurn(this.battle, u);
    this.refresh();
    if (this.battle.over) {
      this.time.delayedCall(600, function () { scene.showResult(); });
    } else if (this.battle.waveCleared) {
      this.time.delayedCall(600, function () { scene.startNextWave(); });
    } else {
      this.time.delayedCall(400, function () { scene.nextTurn(); });
    }
  },

  showResult: function () {
    const scene = this;
    this.awaitingPlayer = false;
    this.refresh();
    const W = this.W;
    const H = this.H;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(3000).setInteractive()
      .on('pointerdown', function () { scene.scene.restart(); }); // a new random node and five new heroes
    makeLabel(this, W / 2, H / 2 - 20, this.battle.over === 'victory' ? 'VICTORY' : 'DEFEAT', 72).setDepth(3001);
    makeLabel(this, W / 2, H / 2 + 50, 'Tap to fight again', 28).setDepth(3001);
  },

  },
};

// Load the sheets first, then start the game
loadGameData().then(function () {
  new Phaser.Game({
    type: Phaser.CANVAS,
    width: 1280,
    height: 720,
    backgroundColor: '#000000'
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [townScene, battleScene], // the first scene opens first: the town, whose Campaign Gate starts the battle
  });
});
