// playerGear.js - the player's gear, the main character, and what gear does for them.
// RULES AND SAVE DATA ONLY: nothing in this file draws on the screen. The Armory screen is in armory.js.
// Load order in index.html: after combatEngine.js and passives.js, before main.js.

// ===== SETTINGS YOU CAN CHANGE =====
const MC_ID = 'MC';
const MC_NAME = 'Main Character';
const MC_SPRITE = '';      // '' = borrow the class picture of your strongest affinity. Or your own art, like 'assets/hero/main_character.png'
const MC_PARTY_SLOT = 3;   // the party spot locked to the main character (0 back, 1-2 middle, 3-4 front)

// The main character's stats with no gear on. Gear adds to these.
const MC_BASE_STATS = {
  Strength: 5, Dexterity: 5, Intelligence: 5, Wisdom: 5, Vitality: 5, Speed: 5,
  Armor: 0, Accuracy: 20, 'Critical Chance': 5, 'Critical Bonus': 20, 'Critical Resistance': 0,
};

const GIVE_ALL_GEAR = true;     // testing: you own one copy of every piece in the Gear tab
const STARTING_SET = 'GS0001';  // what the main character wears on a brand new save ('' = nothing)

// Weapons with no Skill ID (the generic sets) borrow a basic attack from the Skills tab, picked by a word in the weapon's name.
// As soon as a weapon has its own Skill ID in the Gear tab, that is used instead.
const WEAPON_BASICS = [
  { words: /shortbow|longbow|bow/i, skill: 'SK0044' },                  // Release Arrow
  { words: /stiletto|dagger|spear/i, skill: 'SK0039' },                 // Jab
  { words: /greatsword|sword|cleaver|falchion|axe/i, skill: 'SK0070' }, // Slash
  { words: /warhammer|hammer|mace|maul/i, skill: 'SK0040' },            // Slam
  { words: /scepter|sceptre|rod|staff|branch|wand/i, skill: 'SK0071' }, // Arcane Bolt
];
const NO_WEAPON_BASIC = 'SK0039'; // empty main hand: Jab

// ===== FIXED LISTS =====
const GEAR_SLOTS = ['Main Hand', 'Off Hand', 'Head', 'Chest', 'Gloves', 'Legs', 'Feet'];
const SKILL_SLOT_ORDER = ['Main Hand', 'Head', 'Chest', 'Legs', 'Off Hand', 'Gloves', 'Feet']; // order of the skill buttons
const SET_TIERS = [2, 4, 6];
const AFFINITY_TIERS = [2, 4, 6];
const ATTRIBUTE_NAMES = ['Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Vitality'];
const GEAR_STAT_NAMES = ['Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Vitality', 'Speed', 'Armor', 'Accuracy',
  'Critical Chance', 'Critical Bonus', 'Critical Resistance', 'Healing Done', 'Healing Received', 'Life Steal'];
const PERCENT_STATS = ['Critical Chance', 'Critical Resistance', 'Healing Done', 'Healing Received', 'Life Steal'];
const CLASS_ART = {
  guardian: 'guardian', druid: 'druid', cleric: 'cleric', berserker: 'barbarian', assassin: 'rogue', monk: 'monk',
  necromancer: 'necromancer', shaman: 'shaman', elementalist: 'elementalist', warlock: 'warlock', bard: 'bard',
  paladin: 'paladin', ranger: 'ranger', stormcaller: 'stormcaller',
};

// ===== GEAR FROM THE SHEET =====

function gearNumber(v) {
  const n = parseFloat(String(v === undefined || v === null ? '' : v).replace('%', ''));
  return isNaN(n) ? 0 : n;
}

// "critical chance", "Crit Chance" and so on all become the one name the game uses. '' = not a stat the game knows.
function gearStatName(raw) {
  const want = normKey(raw).replace(/^crit(?!ical)/, 'critical');
  return GEAR_STAT_NAMES.filter(function (n) { return normKey(n) === want; })[0] || '';
}

const GEAR_CACHE = {};

// One row of the Gear tab, tidied up. null if the sheet has no such gear.
function gearInfo(gearId) {
  if (GEAR_CACHE[gearId]) return GEAR_CACHE[gearId];
  const row = GAME_DATA.gear[gearId];
  if (!row) return null;
  const name = String(field(row, ['Gear Name', 'Name'], gearId));
  const stats = {};
  const add = function (statRaw, value) {
    const label = String(statRaw || '').trim();
    if (!label) return;
    const stat = gearStatName(label);
    if (!stat) { sheetWarn('Gear ' + gearId + ' ' + name + ': "' + label + '" is not a stat the game knows, so it does nothing', 'note'); return; }
    const n = gearNumber(value);
    if (n) stats[stat] = (stats[stat] || 0) + n;
  };
  [1, 2, 3].forEach(function (i) {
    add(field(row, ['Attribute ' + i], ''), field(row, ['Attribute ' + i + ' Value'], ''));
    add(field(row, ['Combat Stat ' + i], ''), field(row, ['Combat Stat ' + i + ' Value'], ''));
  });
  add('Vitality', field(row, ['Vitality Bonus'], ''));  // added on top of any Vitality attribute
  add('Armor', field(row, ['Armor Value', 'Armor'], ''));

  const affinities = [1, 2, 3].map(function (i) { return String(field(row, ['Affinity Slot ' + i], '')).trim(); })
    .filter(function (a) { return a; });
  const setId = String(field(row, ['Gear Set ID', 'Set ID'], '')).trim();
  const setRow = GAME_DATA.gearSets[setId];
  GEAR_CACHE[gearId] = {
    id: gearId, name: name,
    slot: String(field(row, ['Gear Slot', 'Slot'], '')).trim(),
    rarity: String(field(row, ['Rarity'], 'Common')).trim(),
    setId: setId, setName: setRow ? String(field(setRow, ['Set Name', 'Name'], setId)) : '',
    skillId: String(field(row, ['Skill ID'], '')).trim().toUpperCase(),
    affinities: affinities, stats: stats,
    description: String(field(row, ['Gear Description', 'Description'], '')),
  };
  return GEAR_CACHE[gearId];
}

// ===== SET BONUSES =====
// The game reads the 2, 4 and 6 Piece Bonus cells of the Gear Set tab, so changing a number in the sheet changes the game.
// These are the wordings it understands. Join two bonuses in one cell with "and".
const BONUS_RULES = [
  { re: /^\+(\d+(?:\.\d+)?)% (strength|dexterity|wisdom|intelligence|vitality)$/, key: function (m) { return 'attr:' + m[2]; } },
  { re: /^\+(\d+(?:\.\d+)?)% (physical|elemental|nature|noxious|divine|arcane) damage$/, key: function (m) { return 'type:' + m[2]; } },
  { re: /^\+(\d+(?:\.\d+)?)% damage dealt$/, key: 'damagePct' },
  { re: /^\+(\d+(?:\.\d+)?) accuracy$/, key: 'accuracy' },
  { re: /^\+(\d+(?:\.\d+)?)% critical chance$/, key: 'critChance' },
  { re: /^\+(\d+(?:\.\d+)?) critical bonus damage$/, key: 'critBonus' },
  { re: /^\+(\d+(?:\.\d+)?)% armor effectiveness$/, key: 'armorPct' },
  { re: /^\+?(\d+(?:\.\d+)?)% less damage taken$/, key: 'damageTaken' },
  { re: /^\+(\d+(?:\.\d+)?)% maximum health$/, key: 'maxHpPct' },
  { re: /^\+(\d+(?:\.\d+)?)% healing done$/, key: 'healDone' },
  { re: /^\+(\d+(?:\.\d+)?)% healing received$/, key: 'healReceived' },
  { re: /^heal for (\d+(?:\.\d+)?)% of damage dealt$/, key: 'lifesteal' },
  { re: /^heal (\d+(?:\.\d+)?)% of maximum health at the start of each turn$/, key: 'turnHeal' },
  { re: /^damage over time effects last (\d+) turns? longer$/, key: 'dotTurns' },
  { re: /^([a-z]+) skills are (\d+(?:\.\d+)?)% stronger$/, key: function (m) { return 'classSkill:' + m[1]; }, value: 2 },
];

// One bonus cell -> its parts: [{ text, key, value }]. key is '' for a wording the game does not understand.
function parseSetBonus(text) {
  const clean = String(text || '').replace(/placeholder:?/i, '').replace(/\([^)]*\)/g, '').trim();
  if (!clean) return [];
  return clean.split(/\s+and\s+/i).map(function (piece) {
    const words = piece.trim().replace(/\.$/, '').replace(/\s+/g, ' ');
    const low = words.toLowerCase();
    for (let i = 0; i < BONUS_RULES.length; i++) {
      const rule = BONUS_RULES[i];
      const m = low.match(rule.re);
      if (m) return { text: words, key: typeof rule.key === 'function' ? rule.key(m) : rule.key, value: Number(m[rule.value || 1]) };
    }
    return { text: words, key: '', value: 0 };
  });
}

// What a set gives when you wear "count" pieces of it. Every tier you reach applies.
// When two tiers raise the same thing (+5% then +10%), the bigger number counts; they are not added together.
function setBonusFor(setId, count) {
  const row = GAME_DATA.gearSets[setId];
  const out = { id: setId, name: row ? String(field(row, ['Set Name', 'Name'], setId)) : setId, count: count, tiers: [], mods: {} };
  if (!row) return out;
  SET_TIERS.forEach(function (n) {
    const raw = String(field(row, [n + ' Piece Bonus'], ''));
    if (!raw) return;
    const parts = parseSetBonus(raw);
    const active = count >= n;
    parts.forEach(function (p) {
      if (!p.key) { sheetWarn('Gear set ' + setId + ' ' + out.name + ': the game does not understand the bonus "' + p.text + '"', 'note'); return; }
      if (active) out.mods[p.key] = Math.max(out.mods[p.key] || 0, p.value);
    });
    out.tiers.push({ pieces: n, active: active, parts: parts, text: parts.map(function (p) { return p.text; }).join(' and '), placeholder: /placeholder/i.test(raw) });
  });
  return out;
}

// ===== PLAYER SAVE =====
// Everything the player owns and wears. Only the functions in this section touch it,
// so it can move to a server later without changing the rest of the game.
const SAVE_KEY = 'heroCollector.save.v1';
let PLAYER_SAVE = null;

function emptySave() { return { version: 1, nextItem: 1, items: {}, equipped: {} }; }

function readStoredSave() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY));
    return save && save.version === 1 && save.items && save.equipped ? save : null;
  } catch (e) { return null; }
}

function storeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(PLAYER_SAVE)); return true; }
  catch (e) { console.log('The save could not be written, so changes last until the page is closed'); return false; }
}

// Every owned piece is its own item with its own item ID
function addItemTo(save, gearId) {
  const itemId = 'IT' + String(save.nextItem).padStart(6, '0');
  save.nextItem += 1;
  save.items[itemId] = { gearId: gearId };
  return itemId;
}

function playerSave() {
  if (PLAYER_SAVE) return PLAYER_SAVE;
  const gearIds = Object.keys(GAME_DATA.gear);
  if (!gearIds.length) return emptySave(); // the Gear file did not load: change nothing
  let save = readStoredSave();
  const brandNew = !save;
  if (brandNew) save = emptySave();
  if (GIVE_ALL_GEAR) {
    const owned = {};
    Object.keys(save.items).forEach(function (id) { owned[save.items[id].gearId] = true; });
    gearIds.forEach(function (gearId) { if (!owned[gearId]) addItemTo(save, gearId); });
  }
  PLAYER_SAVE = save;
  if (brandNew && STARTING_SET) {
    Object.keys(save.items).forEach(function (itemId) {
      const g = gearInfo(save.items[itemId].gearId);
      if (g && g.setId === STARTING_SET && !getEquipped(MC_ID)[g.slot]) equipItem(MC_ID, itemId);
    });
  }
  storeSave();
  return PLAYER_SAVE;
}

function resetPlayerSave() {
  PLAYER_SAVE = null;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage is off */ }
  return playerSave();
}

// { itemId, gearId, gear } or null
function getItem(itemId) {
  const item = playerSave().items[itemId];
  if (!item) return null;
  const gear = gearInfo(item.gearId);
  return gear ? { itemId: itemId, gearId: item.gearId, gear: gear } : null;
}

// Every item you own (pieces that are no longer in the sheet are hidden, not deleted)
function ownedItems() {
  return Object.keys(playerSave().items).map(getItem).filter(function (i) { return i; });
}

// What a wearer has on: { 'Head': itemId, ... }. wearerId is 'MC' or a hero ID.
function getEquipped(wearerId) {
  const worn = playerSave().equipped[wearerId] || {};
  const out = {};
  GEAR_SLOTS.forEach(function (slot) {
    const item = worn[slot] ? getItem(worn[slot]) : null;
    if (item && item.gear.slot === slot) out[slot] = worn[slot];
  });
  return out;
}

// The gear rows a wearer has on, in slot order
function wornGear(wearerId) {
  const worn = getEquipped(wearerId);
  return GEAR_SLOTS.filter(function (s) { return worn[s]; }).map(function (s) { return getItem(worn[s]).gear; });
}

// Who is wearing an item ('' = nobody). An item can only be on one character.
function wearerOfItem(itemId) {
  const all = playerSave().equipped;
  return Object.keys(all).filter(function (who) {
    return Object.keys(all[who]).some(function (slot) { return all[who][slot] === itemId; });
  })[0] || '';
}

// Puts an item on. If someone else is wearing it, it comes off them first.
function equipItem(wearerId, itemId) {
  const save = playerSave();
  const item = getItem(itemId);
  if (!item) return { ok: false, reason: 'You do not own that item' };
  const slot = item.gear.slot;
  if (GEAR_SLOTS.indexOf(slot) === -1) return { ok: false, reason: item.gear.name + ' has an unknown gear slot: ' + slot };
  const from = wearerOfItem(itemId);
  if (from && from !== wearerId) delete save.equipped[from][slot];
  const worn = save.equipped[wearerId] || (save.equipped[wearerId] = {});
  const replaced = worn[slot] && worn[slot] !== itemId ? worn[slot] : '';
  worn[slot] = itemId;
  storeSave();
  return { ok: true, slot: slot, takenFrom: from && from !== wearerId ? from : '', replaced: replaced };
}

function unequipSlot(wearerId, slot) {
  const save = playerSave();
  if (!save.equipped[wearerId] || !save.equipped[wearerId][slot]) return { ok: false, reason: 'Nothing in that slot' };
  delete save.equipped[wearerId][slot];
  storeSave();
  return { ok: true };
}

// ===== WORKING OUT THE MAIN CHARACTER =====

function roundStat(n) { return Math.round(n * 10) / 10; }

function skillSheetRow(skillId) {
  const found = rowById(GAME_DATA.skills, skillId);
  return found ? found.row : null;
}

// Does a passive from the Skills tab actually do something yet? (Checked from the row, so nothing is warned about.)
function passiveWorks(skillId) {
  if (typeof passiveSourceRow !== 'function') return false; // passives.js is not loaded
  if (SPECIAL_PASSIVES[skillId]) return true;
  const src = passiveSourceRow(skillId);
  if (!src) return false;
  return GROUP_LETTERS.some(function (L) {
    const def = SHEET_EFFECTS[String(field(src.row, [L + '_ID'], '')).trim().toUpperCase()];
    if (!def || ['effect', 'reflection', 'shieldBreak', 'taunt'].indexOf(def.run) === -1) return false;
    const token = targetToken(field(src.row, [L + '_Target'], ''));
    return token === 'self' || (!token && !def.foe);
  });
}

function describeSkill(skillId, slot) {
  const row = skillSheetRow(skillId) || (typeof passiveSourceRow === 'function' && passiveSourceRow(skillId) ? passiveSourceRow(skillId).row : null);
  if (!row) return null;
  const cooldown = String(field(row, ['Cooldown'], '')).trim();
  const passive = /passive/i.test(cooldown);
  return {
    id: skillId, slot: slot, name: String(field(row, ['Skill Name', 'Name'], skillId)),
    text: String(field(row, ['Description'], '')).replace(/^passive\.\s*/i, ''),
    cooldown: cooldown, basic: /basic/i.test(cooldown), passive: passive, works: passive ? passiveWorks(skillId) : true, borrowed: false,
  };
}

// The basic attack a weapon without its own skill borrows
function borrowedBasicFor(weapon) {
  if (!weapon) return NO_WEAPON_BASIC;
  const hit = WEAPON_BASICS.filter(function (b) { return b.words.test(weapon.name); })[0];
  return hit ? hit.skill : NO_WEAPON_BASIC;
}

// The skills a list of gear gives: up to 4 buttons (basic first, then Head, Chest, Legs) and the passives
function skillsFromGear(gearList) {
  const actives = [], passives = [];
  const bySlot = {};
  gearList.forEach(function (g) { bySlot[g.slot] = g; });
  SKILL_SLOT_ORDER.forEach(function (slot) {
    const g = bySlot[slot];
    if (!g || !g.skillId) return;
    const s = describeSkill(g.skillId, slot);
    if (!s) { sheetWarn('Gear ' + g.id + ' ' + g.name + ': skill ' + g.skillId + ' is not in the Skills tab'); return; }
    s.affinities = g.affinities;
    (s.passive ? passives : actives).push(s);
  });
  if (!actives.some(function (s) { return s.basic; })) {
    const s = describeSkill(borrowedBasicFor(bySlot['Main Hand']), 'Main Hand');
    if (s) { s.borrowed = true; s.affinities = []; actives.unshift(s); }
  }
  actives.sort(function (a, b) { return (b.basic ? 1 : 0) - (a.basic ? 1 : 0); }); // the basic attack is the first button
  if (actives.length > 4) sheetWarn('The main character has more than 4 skills equipped. Only 4 have buttons');
  return { actives: actives.slice(0, 4), passives: passives };
}

// Everything about the main character wearing this gear. It changes nothing, so it also works for previews.
function sheetForGear(gearList) {
  const base = MC_BASE_STATS;
  const gear = {};
  GEAR_STAT_NAMES.forEach(function (n) { gear[n] = 0; });
  gearList.forEach(function (g) { Object.keys(g.stats).forEach(function (n) { gear[n] += g.stats[n]; }); });

  // sets: pieces worn of each set, and what they give. Bonuses from different sets add together.
  const setCount = {};
  gearList.forEach(function (g) { if (g.setId) setCount[g.setId] = (setCount[g.setId] || 0) + 1; });
  const sets = Object.keys(setCount).map(function (id) { return setBonusFor(id, setCount[id]); })
    .sort(function (a, b) { return b.count - a.count; });
  const mods = {};
  sets.forEach(function (s) { Object.keys(s.mods).forEach(function (k) { mods[k] = (mods[k] || 0) + s.mods[k]; }); });
  const mod = function (k) { return mods[k] || 0; };

  // affinities: one count per piece that carries it. No limit on how many classes can be lit.
  const affinityCount = {};
  gearList.forEach(function (g) { g.affinities.forEach(function (a) { affinityCount[a] = (affinityCount[a] || 0) + 1; }); });
  const affinities = Object.keys(affinityCount).map(function (a) {
    const n = affinityCount[a];
    return { name: a, count: n, tier: AFFINITY_TIERS.filter(function (t) { return n >= t; }).pop() || 0 };
  }).sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });

  const stats = {};
  ATTRIBUTE_NAMES.forEach(function (n) { stats[n] = roundStat((base[n] + gear[n]) * (1 + mod('attr:' + n.toLowerCase()) / 100)); });
  stats.Speed = roundStat(base.Speed + gear.Speed);
  stats.Armor = roundStat((base.Armor + gear.Armor) * (1 + mod('armorPct') / 100));
  stats.Accuracy = roundStat(base.Accuracy + gear.Accuracy + mod('accuracy'));
  stats['Critical Chance'] = roundStat(base['Critical Chance'] + gear['Critical Chance'] + mod('critChance'));
  stats['Critical Bonus'] = roundStat(base['Critical Bonus'] + gear['Critical Bonus'] + mod('critBonus'));
  stats['Critical Resistance'] = roundStat(base['Critical Resistance'] + gear['Critical Resistance']);
  const maxHp = Math.round(stats.Vitality * VITALITY_HEALTH * (1 + mod('maxHpPct') / 100));

  const skills = skillsFromGear(gearList);

  // bonuses that are not a plain stat. The combat engine reads these (shares: 0.05 = 5%).
  const typePct = {};
  Object.keys(mods).forEach(function (k) { if (k.indexOf('type:') === 0) typePct[k.slice(5)] = mods[k] / 100; });
  const skillBoost = {};
  Object.keys(mods).forEach(function (k) {
    if (k.indexOf('classSkill:') !== 0) return;
    const cls = k.slice(11);
    skills.actives.forEach(function (s) {
      if (s.affinities.some(function (a) { return a.toLowerCase() === cls; })) skillBoost[s.id] = (skillBoost[s.id] || 0) + mods[k] / 100;
    });
  });
  const mainHand = gearList.filter(function (g) { return g.slot === 'Main Hand'; })[0];
  const bonus = {
    weapon: mainHand ? mainHand.name : '',   // some passives only work with an axe or a dagger
    damagePct: mod('damagePct') / 100,
    typePct: typePct,
    skillBoost: skillBoost,
    healDone: (gear['Healing Done'] + mod('healDone')) / 100,
    healReceived: (gear['Healing Received'] + mod('healReceived')) / 100,
    lifesteal: (gear['Life Steal'] + mod('lifesteal')) / 100,
    damageTaken: mod('damageTaken') / 100,   // share of damage NOT taken
    turnHeal: mod('turnHeal') / 100,         // share of maximum health healed at the start of each turn
    dotTurns: mod('dotTurns'),
  };

  return { base: base, gear: gear, stats: stats, maxHp: maxHp, sets: sets, affinities: affinities, mods: mods, bonus: bonus, actives: skills.actives, passives: skills.passives };
}

function mainCharacterSheet() { return sheetForGear(wornGear(MC_ID)); }

function mainCharacterSprite(sheet) {
  if (MC_SPRITE) return MC_SPRITE;
  const top = sheet.affinities[0];
  return 'assets/hero/' + ((top && CLASS_ART[top.name.toLowerCase()]) || 'wizard') + '.png';
}

// The main character as a battle row, shaped like a row of the Hero tab
function mainCharacterRow() {
  const sheet = mainCharacterSheet();
  const s = sheet.stats;
  const row = {
    ID: MC_ID, 'Hero Name': MC_NAME, 'Hero Sprite': mainCharacterSprite(sheet), Class: '',
    Strength: s.Strength, Dexterity: s.Dexterity, Intelligence: s.Intelligence, Wisdom: s.Wisdom, Vitality: s.Vitality,
    Speed: s.Speed, Armor: s.Armor, Accuracy: s.Accuracy,
    'Critical Chance': s['Critical Chance'], 'Critical Bonus': s['Critical Bonus'], 'Critical Resistance': s['Critical Resistance'],
    HP: sheet.maxHp - s.Vitality * VITALITY_HEALTH, // only the extra health from "maximum health" bonuses; Vitality gives the rest
    Passives: sheet.passives.filter(function (p) { return p.works; }).map(function (p) { return p.id; }).join(', '),
    gearBonus: sheet.bonus,
    isMainCharacter: true,
  };
  sheet.actives.forEach(function (a, i) { row['Skill ' + (i + 1)] = a.id; });
  return row;
}

// The battle party: the main character in the locked spot, plus 4 heroes (random until team picking is built)
// heroIds: the 4 heroes beside the main character (a retry passes the same ones). Left out = 4 random heroes.
function buildPlayerParty(heroIds) {
  const party = heroIds ? heroIds.map(function (id) { return Object.assign({}, GAME_DATA.heroes[id]); }) : pickRandomHeroes(4);
  party.splice(Math.min(MC_PARTY_SLOT, party.length), 0, mainCharacterRow());
  return party;
}

// What got switched on between two sheets, as short messages for the screen
function newUnlocks(before, after) {
  const out = [];
  after.affinities.forEach(function (a) {
    const old = before.affinities.filter(function (b) { return b.name === a.name; })[0];
    if (a.tier > (old ? old.tier : 0)) out.push(a.name + ' affinity: ' + a.tier + ' pieces');
  });
  after.sets.forEach(function (set) {
    const old = before.sets.filter(function (b) { return b.id === set.id; })[0];
    const reached = set.tiers.filter(function (t) { return t.active && (!old || old.count < t.pieces); }).pop();
    if (reached) out.push(set.name + ': ' + reached.pieces + '-piece bonus');
  });
  return out;
}
