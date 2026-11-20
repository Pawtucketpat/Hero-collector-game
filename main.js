// main.js: the battle scene.
// Needs these files loaded first, in this order (see index.html):
//   Phaser, dataLoader.js, nodeBattle.js, then this file.

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

const FLIP_PLAYER = false; // set true if your druid faces the wrong way
const FLIP_ENEMY = false;  // set true if your goblins face the wrong way

// ===== TEST VALUES (placeholders for testing, not approved design numbers) =====
const MAX_SUMMONS = 2;   // total active summons per side (your Notion page 14.2)
const CRIT_MULT = 1.5;   // damage multiplier on a critical hit

// Skill kinds: damage, aoe, dot, hot, shield, ward, drain, steal, summon, taunt, dmgUpAll, wardAll, massRes, armorBreak, shadow
// target: enemy, ally, self, allEnemies, allAllies.  basic = the unit's basic attack (a provoked unit must use it).
const SKILLS = {
  // ----- Druid -----
  attack:    { name: 'Attack', kind: 'damage', target: 'enemy', damage: 20, cd: 0, basic: true },
  shield:    { name: 'Shield', kind: 'shield', target: 'self', charges: 2, cd: 3 },
  poison:    { name: 'Poison', kind: 'dot', target: 'enemy', hit: 6, dot: 8, charges: 3, cd: 2 },
  regrowth:  { name: 'Regrowth', kind: 'hot', target: 'ally', heal: 12, charges: 4, cd: 3 },

  // ----- Necromancer -----
  necroAttack:  { name: 'Necrotic Attack', kind: 'damage', target: 'enemy', damage: 18, lifesteal: 0.5, damageType: 'necrotic', cd: 0, basic: true },
  summonUndead: { name: 'Summon Undead', kind: 'summon', target: 'self', cd: 5,
                  summon: { name: 'Undead Warrior', sprite: 'necromancer_summon', hp: 20, duration: 3, skills: ['undeadSlash'], explosion: 10 } },
  drainLife:    { name: 'Drain Life', kind: 'drain', target: 'allEnemies', damage: 10, healPerHit: 5, damageType: 'necrotic', cd: 3 },
  weakenSoul:   { name: 'Weaken Soul', kind: 'steal', target: 'enemy', cd: 3 },
  undeadSlash:  { name: 'Slash', kind: 'damage', target: 'enemy', damage: 12, damageType: 'physical', cd: 0, basic: true }, // the undead warrior's attack

  // ----- Barbarian -----
  axeAttack:     { name: 'Axe Attack', kind: 'damage', target: 'enemy', damage: 16, missingHealthBonus: 0.1, cd: 0, basic: true }, // +10% per 10% health missing
  taunt:         { name: 'Taunt', kind: 'taunt', target: 'allEnemies', charges: 2, cd: 3 },
  cleave:        { name: 'Cleave', kind: 'aoe', target: 'allEnemies', damage: 10, cd: 0 },
  goadingAttack: { name: 'Goading Attack', kind: 'damage', target: 'enemy', damage: 14, provoke: 1, cd: 2 },

  // ----- Shaman -----
  shamanAttack:     { name: 'Nature Attack', kind: 'damage', target: 'enemy', damage: 16, damageType: 'nature', critBuff: { chance: 0.5, charges: 1 }, cd: 0, basic: true },
  primalScream:     { name: 'Primal Scream', kind: 'dmgUpAll', target: 'allAllies', percent: 0.25, charges: 2, cd: 3 },
  greaterWard:      { name: 'Greater Ward', kind: 'wardAll', target: 'allAllies', pool: 60, cd: 4 },
  massResurrection: { name: 'Mass Resurrection', label: 'Mass Revive', kind: 'massRes', target: 'allAllies', hpPercent: 0.25, cd: 0 },

  // ----- Rogue -----
  rogueAttack: { name: 'Rogue Attack', kind: 'damage', target: 'enemy', damage: 15, ignoresTaunt: true, cd: 0, basic: true },
  execution:   { name: 'Execution', kind: 'damage', target: 'enemy', damage: 32, executeBelow: 0.3, executeBonus: 0.5, cd: 0 },
  armorBreak:  { name: 'Armor Break', kind: 'armorBreak', target: 'enemy', amount: 4, charges: 3, cd: 0 },
  shadowSlip:  { name: 'Shadow Slip', kind: 'shadow', target: 'self', mult: 3, charges: 2, cd: 2 },

  // ----- Goblins (some extras exist only so your heroes' skills have something to work on) -----
  stab:      { name: 'Stab', kind: 'damage', target: 'enemy', damage: 50, cd: 0, basic: true },
  venom:     { name: 'Venom', kind: 'aoe', target: 'allEnemies', hit: 60, cd: 0 },
  bulwark:   { name: 'Bulwark', kind: 'shield', target: 'self', charges: 9, cd: 4},        // gives Weaken Soul a buff to steal
  roar:      { name: 'Roar', kind: 'taunt', target: 'allEnemies', damage: 40,  charges: 2, cd: 4 },      // gives the Rogue's taunt-ignoring attack a job
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

// The sprite name a hero or mob row asks for ('' if it has none)
function spriteValueOf(row, isHero) {
  return String(field(row, isHero ? ['Hero Sprite', 'Sprite'] : ['Mob Sprite', 'Sprite'], ''));
}

// The image file for a sprite or background name
function imageFile(value) {
  if (SPRITE_FILES[value]) return SPRITE_FILES[value];
  if (/\.[a-z0-9]+$/i.test(value)) return value;
  return value + '.png';
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

// Skills: a "Skills" column in the sheet (code names separated by commas) wins; otherwise the test skills are used
function skillsFor(row, base) {
  const raw = String(field(row, ['Skills', 'Skill List'], ''));
  const keys = raw.split(/[,;|]/).map(function (s) { return s.trim(); }).filter(function (s) { return SKILLS[s]; });
  return keys.length ? keys : base.skills.slice();
}

// Turns one sheet row into a unit for the battle
function unitFromRow(row, kind, side, slot, id) {
  const isHero = kind === 'hero';
  const sprite = spriteValueOf(row, isHero);
  const name = String(field(row, ['Name', isHero ? 'Hero Name' : 'Mob Name'], id));
  const base = knownStats(sprite, name, isHero);
  return {
    id: id, name: name, sprite: sprite || 'placeholder_' + id, side: side, slot: slot,
    hp: statOf(row, ['HP', 'Health', 'Max HP', 'Max Health', 'Hit Points'], base.hp),
    armor: statOf(row, ['Armor', 'Armour'], base.armor),
    speed: statOf(row, ['Speed'], base.speed),
    dex: statOf(row, ['Dex', 'Dexterity'], base.dex),
    skills: skillsFor(row, base),
  };
}

// ===== COMBAT RULES (no graphics in this part) =====
// Follows your Notion pages: Section 10 (turns) and Section 11 (damage, shields, wards, DoTs).
// Not in this prototype: crits, resistances, reactive heals/damage, death wards, summons, Lesser Shield.

function compareInitiative(a, b) {
  if (b.initiative !== a.initiative) return b.initiative - a.initiative; // highest first
  if (a.side !== b.side) return a.side === 'player' ? -1 : 1;           // players before enemies
  if (b.dex !== a.dex) return b.dex - a.dex;                             // higher Dexterity
  if (a.armor !== b.armor) return a.armor - b.armor;                     // lower total Armor
  return a.tie - b.tie;                                                  // random
}

// Adds the battle values every unit needs to a unit built from a sheet row
function makeUnit(def) {
  return Object.assign({}, def, {
    maxHp: def.hp, ward: 0, wardMax: 0, effects: [], cd: {}, alive: true,
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
  state.emit('death', unit, 'defeated');
  state.units.forEach(function (u) { u.effects = u.effects.filter(function (e) { return e.source !== unit; }); }); // their Taunts and Provokes end
  // A summon that is defeated explodes and hits every enemy (Bone Shrapnel)
  if (unit.isSummon && unit.explodes) {
    state.emit('info', unit, 'explodes!');
    opponents(state, unit).forEach(function (e) { takeHit(state, e, unit.explodes, {}); });
  }
  // Summons end when their summoner dies
  state.units.forEach(function (u) {
    if (u.isSummon && u.owner === unit.id && u.alive) removeSummon(state, u, 'vanishes');
  });
}

// Buffs that Weaken Soul can steal (a ward pool is not a buff and cannot be dispelled)
const STEALABLE = ['shield', 'hot', 'dmgUp', 'crit'];
function stealable(unit) {
  return unit.effects.filter(function (e) { return STEALABLE.indexOf(e.type) !== -1; });
}

// Armor after any Armor Break debuffs (never below zero)
function armorOf(unit) {
  const broken = unit.effects.filter(function (e) { return e.type === 'armorBreak'; })
    .reduce(function (n, e) { return n + e.amount; }, 0);
  return Math.max(0, unit.armor - broken);
}

// Short text for an effect, used on the screen and in the log
function effectLabel(e) {
  if (e.type === 'shield') return 'Shield x' + e.charges;
  if (e.type === 'dot') return 'DoT ' + e.damage + ' x' + e.charges;
  if (e.type === 'hot') return 'HoT ' + e.heal + ' x' + e.charges;
  if (e.type === 'taunt') return 'Taunted x' + e.charges;
  if (e.type === 'provoke') return 'Provoked x' + e.charges;
  if (e.type === 'armorBreak') return 'Armor -' + e.amount + ' x' + e.charges;
  if (e.type === 'dmgUp') return 'Dmg +' + Math.round(e.percent * 100) + '% x' + e.charges;
  if (e.type === 'crit') return 'Crit ' + Math.round(e.chance * 100) + '% x' + e.charges;
  if (e.type === 'shadow') return 'Shadow x' + e.mult + ' (' + e.charges + ')';
  return e.type;
}

// A taunted character must aim single-target attacks at whoever taunted it, unless the skill ignores taunt
function forcedTarget(unit, sk) {
  if (sk.target !== 'enemy' || sk.ignoresTaunt) return null;
  const t = unit.effects.find(function (e) { return e.type === 'taunt' && e.source && e.source.alive; });
  return t ? t.source : null;
}

// Once per skill use: the multiplier from Shadow Slip and damage buffs, and the total crit chance
function prepareDamage(user) {
  let mult = 1;
  const shadow = user.effects.find(function (e) { return e.type === 'shadow'; });
  if (shadow) { mult *= shadow.mult; user.effects = user.effects.filter(function (e) { return e !== shadow; }); }
  mult *= 1 + user.effects.filter(function (e) { return e.type === 'dmgUp'; }).reduce(function (n, e) { return n + e.percent; }, 0);
  const crit = Math.min(1, user.effects.filter(function (e) { return e.type === 'crit'; }).reduce(function (n, e) { return n + e.chance; }, 0));
  return { mult: mult, critChance: crit };
}

// One damaging hit: skill bonuses, buffs, crit, then through the target's defenses
function dealHit(state, user, sk, target, mods, base) {
  let amt = base;
  if (sk.missingHealthBonus) { // Barbarian: more damage for each 10% of health missing
    const tens = Math.floor((user.maxHp - user.hp) * 10 / user.maxHp + 1e-9);
    amt *= 1 + sk.missingHealthBonus * tens;
  }
  if (sk.executeBelow && target.hp < target.maxHp * sk.executeBelow) amt *= 1 + sk.executeBonus; // Execution
  amt *= mods.mult;
  if (mods.critChance > 0 && Math.random() < mods.critChance) {
    amt *= CRIT_MULT;
    state.emit('crit', target, 'CRIT!');
  }
  return takeHit(state, target, Math.max(0, Math.floor(amt)), {});
}

function reviveUnit(state, unit, fraction) {
  unit.alive = true;
  unit.hp = Math.max(1, Math.floor(unit.maxHp * fraction));
  unit.ward = 0;
  unit.wardMax = 0;
  unit.effects = []; // returns free of old buffs and debuffs (13.5)
  state.emit('revive', unit, 'revived');
  state.emit('heal', unit, '+' + unit.hp);
}

// Damage order: Shield -> Armor -> Ward -> (Resistance, skipped) -> Health -> Death
function takeHit(state, unit, amount, opts) {
  const result = { nullified: false, absorbed: 0, dealt: 0 };
  if (!unit.alive) return result;

  // 1. Shield: one charge fully nullifies one hit. DoT ticks bypass Shields.
  if (!(opts && opts.dotTick)) {
    const shield = unit.effects.find(function (e) { return e.type === 'shield' && e.charges > 0; });
    if (shield) {
      shield.charges -= 1;
      unit.effects = unit.effects.filter(function (e) { return e.charges > 0; });
      result.nullified = true;
      state.emit('block', unit, 'BLOCKED');
      return result;
    }
  }

  // 2. Armor: flat reduction, never below zero
  let dmg = Math.max(0, amount - armorOf(unit));

  // 3. Ward: absorbs up to its current pool
  const absorbed = Math.min(unit.ward, dmg);
  if (absorbed > 0) {
    unit.ward -= absorbed;
    dmg -= absorbed;
    result.absorbed = absorbed;
    state.emit('ward', unit, '-' + absorbed + ' ward');
  }

  // 4. Resistances: not in this prototype

  // 5. Health
  if (dmg > 0) {
    unit.hp -= dmg;
    result.dealt = dmg;
    state.emit('damage', unit, '-' + dmg);
  }

  // 6. Death (no death wards or reactive heals yet)
  if (unit.hp < 1) killUnit(state, unit);
  return result;
}

function useSkill(state, user, key, target) {
  const sk = SKILLS[key];
  user.cd[key] = sk.cd;
  state.emit('info', user, 'uses ' + sk.name + (target !== user ? ' on ' + target.name : ''));
  const addEffect = function (unit, e) {
    state.serial += 1;
    e.serial = state.serial;
    unit.effects.push(e);
    state.emit('status', unit, effectLabel(e));
  };
  const livingAllies = function () {
    return state.units.filter(function (u) { return u.side === user.side && u.alive && !u.isSummon; });
  };

  if (sk.kind === 'damage') {
    const r = dealHit(state, user, sk, target, prepareDamage(user), sk.damage);
    // Lifesteal: a share of the damage that reached health comes back as healing, fractions rounded down
    if (sk.lifesteal && r.dealt > 0) healUnit(state, user, Math.floor(r.dealt * sk.lifesteal));
    // Provoke rides on the hit: if a Shield nullifies the hit, the Provoke is not applied
    if (sk.provoke && target.alive && !r.nullified) addEffect(target, { type: 'provoke', charges: sk.provoke, source: user });
    // Nature Attack: a random ally gets a crit chance buff
    if (sk.critBuff) {
      const others = livingAllies().filter(function (u) { return u !== user; });
      const who = others.length ? others[Math.floor(Math.random() * others.length)] : user;
      addEffect(who, { type: 'crit', chance: sk.critBuff.chance, charges: sk.critBuff.charges });
    }
  } else if (sk.kind === 'aoe') {
    const mods = prepareDamage(user);
    opponents(state, user).forEach(function (e) { dealHit(state, user, sk, e, mods, sk.damage); });
  } else if (sk.kind === 'shield') {
    addEffect(target, { type: 'shield', charges: sk.charges });
  } else if (sk.kind === 'dot') {
    // The initial hit is subject to Shields. If a Shield nullifies it, the DoT is not applied.
    const r = dealHit(state, user, sk, target, prepareDamage(user), sk.hit);
    if (!r.nullified && target.alive && !target.isSummon) { // summons cannot receive debuffs
      addEffect(target, { type: 'dot', damage: sk.dot, charges: sk.charges });
    }
  } else if (sk.kind === 'hot') {
    // Heal over time: nothing happens right away. It heals at the start of the target's turns.
    addEffect(target, { type: 'hot', heal: sk.heal, charges: sk.charges });
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
    livingAllies().forEach(function (a) { addEffect(a, { type: 'dmgUp', percent: sk.percent, charges: sk.charges }); });
  } else if (sk.kind === 'taunt') {
    opponents(state, user).forEach(function (e) { addEffect(e, { type: 'taunt', charges: sk.charges, source: user }); });
  } else if (sk.kind === 'armorBreak') {
    addEffect(target, { type: 'armorBreak', amount: sk.amount, charges: sk.charges });
  } else if (sk.kind === 'shadow') {
    addEffect(user, { type: 'shadow', mult: sk.mult, charges: sk.charges });
  } else if (sk.kind === 'massRes') {
    // Revives every fallen ally (never summons). Each keeps its place in the turn order and gets no extra turn.
    state.units.filter(function (u) { return u.side === user.side && !u.alive && !u.isSummon; })
      .forEach(function (u) { reviveUnit(state, u, sk.hpPercent); });
  } else if (sk.kind === 'summon') {
    const used = activeSummons(state, user.side).map(function (u) { return u.slot; });
    const slot = [0, 1].find(function (i) { return used.indexOf(i) === -1; });
    if (slot !== undefined && used.length < MAX_SUMMONS) {
      state.summonCount += 1;
      const def = sk.summon;
      const sm = {
        id: 'summon' + state.summonCount, name: def.name, sprite: def.sprite, side: user.side, spot: 'summon', slot: slot,
        hp: def.hp, maxHp: def.hp, armor: 0, speed: 0, dex: 0, skills: def.skills,
        ward: 0, wardMax: 0, effects: [], cd: {}, alive: true, initiative: 0, tie: 0,
        isSummon: true, owner: user.id, duration: def.duration, explodes: def.explosion,
      };
      state.units.push(sm);
      state.emit('summon', sm, 'summoned');
    }
  } else if (sk.kind === 'drain') {
    // Damages every enemy, then heals every ally for healPerHit for each enemy that was hit
    const mods = prepareDamage(user);
    let hits = 0;
    opponents(state, user).forEach(function (e) {
      const r = dealHit(state, user, sk, e, mods, sk.damage);
      if (!r.nullified) hits += 1;
    });
    const amount = hits * sk.healPerHit;
    if (amount > 0) livingAllies().forEach(function (u) { healUnit(state, u, amount); });
  } else if (sk.kind === 'steal') {
    // Steals one random buff: removed from the enemy and moved (not copied) to the caster
    const buffs = stealable(target);
    if (buffs.length) {
      const b = buffs[Math.floor(Math.random() * buffs.length)];
      target.effects = target.effects.filter(function (e) { return e !== b; });
      state.emit('status', target, 'lost ' + effectLabel(b));
      addEffect(user, Object.assign({}, b));
    }
  }
  checkOver(state);
}

// Healing can never take a character above Maximum Health
function healUnit(state, unit, amount) {
  if (!unit.alive || unit.isSummon) return 0; // summons cannot receive healing (14.6)
  const healed = Math.max(0, Math.min(amount, unit.maxHp - unit.hp));
  unit.hp += healed;
  if (healed > 0) state.emit('heal', unit, '+' + healed);
  return healed;
}

// Start of a character's turn: heal-over-time effects resolve, largest heal first, oldest breaks ties (10.5, 10.8)
function startTurn(state, unit) {
  if (!unit.alive) return;
  const hots = unit.effects
    .filter(function (e) { return e.type === 'hot'; })
    .sort(function (a, b) { return (b.heal - a.heal) || (a.serial - b.serial); });
  hots.forEach(function (h) { healUnit(state, unit, h.heal); });
}

function endTurn(state, unit) {
  if (unit.alive) {
    // 1. DoTs resolve, oldest first. They bypass Shields but use Armor, Ward and Health.
    //    (Your pages disagree on DoT order: 10.7 says oldest first, 10.8 and 11.10 say lowest or highest damage.)
    const dots = unit.effects
      .filter(function (e) { return e.type === 'dot'; })
      .sort(function (a, b) { return a.serial - b.serial; });
    for (let i = 0; i < dots.length; i++) {
      if (!unit.alive) break;
      takeHit(state, unit, dots[i].damage, { dotTick: true });
    }
    if (unit.alive) {
      // 2-3. Buff and debuff charges drop by one; effects with zero charges expire
      unit.effects.forEach(function (e) { e.charges -= 1; });
      unit.effects = unit.effects.filter(function (e) { return e.charges > 0; });
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

// Simple AI for enemies and summons: first skill that is off cooldown, aimed at a random living opponent.
// Provoked: must use its basic attack on whoever provoked it. Taunted: single-target attacks go to the taunter.
function chooseAction(state, unit) {
  const provoke = unit.effects.find(function (e) { return e.type === 'provoke' && e.source && e.source.alive; });
  const ready = unit.skills.filter(function (k) { return skillReady(unit, k); });
  const key = provoke ? ready.find(function (k) { return SKILLS[k].basic; }) : ready[0];
  if (!key) return null;
  const sk = SKILLS[key];
  if (sk.target === 'self' || sk.target === 'allEnemies' || sk.target === 'allAllies') return { key: key, target: unit };
  const foes = opponents(state, unit);
  if (!foes.length) return null;
  let target = foes[Math.floor(Math.random() * foes.length)];
  const forced = provoke ? provoke.source : forcedTarget(unit, sk);
  if (forced && forced.alive) target = forced;
  return { key: key, target: target };
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
    this.heroRows.forEach(function (row) { const s = spriteValueOf(row, true); if (s) keys[s] = true; });
    this.nodeData.waves.forEach(function (wave) {
      wave.forEach(function (mob) { if (mob) { const s = spriteValueOf(mob, false); if (s) keys[s] = true; } });
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
    makeLabel(this, 60, 30, 'HOME', 24);
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
    this.turnText = makeLabel(this, W / 2, 82, '', 24).setDepth(1500);
    this.orderText = makeLabel(this, W / 2, 106, '', 14).setDepth(1500);
    this.logText = this.add.text(W / 2 - 60, H - 130, '', {
      fontSize: '16px', color: '#dddddd', lineSpacing: 4, wordWrap: { width: 280 },
    }).setDepth(1500);

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
      fontSize: '18px', color: '#ffffff', align: 'center', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(1000);
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
    if (this.logText) this.logText.setText(this.logLines.join('\n'));
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
      v.status.setText(u.alive ? lines.join('\n') : '');
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
      const taunt = u.effects.find(function (e) { return e.type === 'taunt' && e.source && e.source.alive; });
      if (taunt) this.target = taunt.source; // a taunted hero's target is chosen for them
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
      const forced = forcedTarget(hero, sk); // a taunted hero must attack the taunter, unless the skill ignores taunt
      if (forced) {
        target = forced;
        this.onEvent('info', hero, 'is taunted and must attack ' + forced.name);
      }
      if (!target || !target.alive) return;
    } else if (sk.target === 'ally') {
      target = (this.allyTarget && this.allyTarget.alive) ? this.allyTarget : hero;
    }
    // Skills that cannot be used right now do not cost the turn
    if (sk.kind === 'steal' && !stealable(target).length) {
      this.onEvent('info', hero, 'needs an enemy that has a buff to steal');
      return;
    }
    if (sk.kind === 'massRes' && !this.battle.units.some(function (u) { return u.side === hero.side && !u.alive && !u.isSummon; })) {
      this.onEvent('info', hero, 'has no fallen allies to revive');
      return;
    }
    if (sk.kind === 'summon' && activeSummons(this.battle, hero.side).length >= MAX_SUMMONS) {
      this.onEvent('info', hero, 'has no free summon spot');
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
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [battleScene],
  });
});
