// passives.js - makes the battle use Passive skills (any Skills row whose Cooldown is "Passive").
// It also handles "Random Elemental" damage (see RANDOM DAMAGE TYPES below).
//
// Add it to index.html AFTER town.js and BEFORE main.js. Nothing in main.js needs to change.
//
// A unit gets a passive from any of these:
//   1. A passive skill ID in Skill 1 to Skill 4 (it gets no button, it is always on)
//   2. A "Passives" column on the Hero or Mobs tab (IDs separated by commas)
//   3. The class list below, a stand-in until gear is built

// ===== SETTINGS =====

// These are the class GEAR passives. Gear is not built yet, so heroes of these classes simply get them.
const GIVE_CLASS_PASSIVES = true; // false = turn the class list off
const CLASS_PASSIVES = {
  Guardian:    ['SK0102', 'SK0103', 'SK0413'],
  Ranger:      ['SK0139', 'SK0140', 'SK0141'],
  Stormcaller: ['SK0142', 'SK0143', 'SK0144'],
};

// Passives that the Effects tab cannot describe, so their rules are written in this file
const PREDATOR_CRIT_BONUS = 25;   // PLACEHOLDER (the sheet gives no number): +% crit chance against Hunter's Mark targets
const STATIC_PER_STACK = 10;      // +% lightning damage for each Static Charge stack
const STATIC_MAX_STACKS = 5;
const STATIC_COOLDOWN_ADDED = 1;  // turns Static Disruption adds to enemy cooldowns
const CONDUCTION_SHARE = 50;      // % of the first hit that Lightning Conduction deals to the second enemy

const SPECIAL_PASSIVES = {
  SK0139: 'markCrit',          // Predator's Instinct
  SK0142: 'staticCharge',      // Static Charge
  SK0143: 'staticDisruption',  // Static Disruption
  SK0144: 'conduction',        // Lightning Conduction
};

// Copies of the sheet rows, used only while data/Skills.csv does not have them yet.
// Once the CSV has a row, the CSV wins.
const PASSIVE_BACKUP_ROWS = (function () {
  const make = function (id, name, extra) {
    return Object.assign({ ID: id, 'Skill Name': name, Duration: 'Passive', Cooldown: 'Passive' }, extra || {});
  };
  return {
    SK0102: make('SK0102', 'Stalwart Guard', { A_ID: 'EF017', A_Target: 'Self', A_X: 10, B_ID: 'EF033', B_Target: 'OneEnemy', B_X: 20 }),
    SK0103: make('SK0103', 'Iron Constitution', { A_ID: 'EF025', A_Target: 'Self', A_SubType: 'Vitality', A_X: 15, B_ID: 'EF017', B_Target: 'Self', B_X: 15 }),
    SK0139: make('SK0139', "Predator's Instinct"),
    SK0140: make('SK0140', 'Keen Aim', { A_ID: 'EF011', A_Target: 'Self', A_X: 10 }),
    SK0141: make('SK0141', 'Thorns', { A_ID: 'EF022', A_Target: 'Self', A_SubType: 'Piercing', A_X: 3 }),
    SK0142: make('SK0142', 'Static Charge'),
    SK0143: make('SK0143', 'Static Disruption'),
    SK0144: make('SK0144', 'Lightning Conduction'),
    SK0413: make('SK0413', 'Death Ward', { A_ID: 'EF007', A_Target: 'Self', A_X: 30, A_Y: 1 }),
  };
})();

// ===== RANDOM DAMAGE TYPES =====
// A Damage SubType of "Random Elemental" picks Earth, Water, Wind, Fire or Cold each time the skill is used.
// "Random" works the same way with any other group on the lists tab, such as "Random Nature".

function rollRandomTypes(state, user, sk) {
  if (!sk || !sk.groups) return sk;
  const picked = {};
  const groups = sk.groups.map(function (g) {
    if (g.def.run !== 'damage') return g;
    const m = String(g.type || '').match(/^random\s+([a-z]+)$/);
    if (!m || !DAMAGE_TYPES[m[1]]) return g;
    if (!picked[m[1]]) picked[m[1]] = randomOf(DAMAGE_TYPES[m[1]]); // one roll per cast
    return Object.assign({}, g, { type: picked[m[1]] });
  });
  const rolled = Object.keys(picked).map(function (k) { return picked[k]; });
  if (!rolled.length) return sk;
  rolled.forEach(function (t) { state.emit('status', user, t.charAt(0).toUpperCase() + t.slice(1) + '!'); });
  return Object.assign({}, sk, { groups: groups }); // a copy, so the next cast rolls again
}

function installRandomTypes() {
  if (typeof useSheetSkill !== 'function' || typeof DAMAGE_TYPES === 'undefined' || typeof randomOf !== 'function') {
    console.error('passives.js: main.js has changed, so random damage types are off.');
    return;
  }
  const baseUseSheetSkill = useSheetSkill;
  useSheetSkill = function (state, user, sk, target, add) {
    return baseUseSheetSkill.call(this, state, user, rollRandomTypes(state, user, sk), target, add);
  };
}

// ===== FINDING PASSIVES =====

// The Skills row for an ID: from the CSV if it is there, otherwise the backup copy. null if neither has it.
function passiveSourceRow(id) {
  const want = String(id === undefined || id === null ? '' : id).trim();
  if (!want) return null;
  const found = rowById(typeof GAME_DATA !== 'undefined' ? GAME_DATA.skills : null, want);
  if (found) return { key: found.key, row: found.row };
  const up = want.toUpperCase();
  return PASSIVE_BACKUP_ROWS[up] ? { key: up, row: PASSIVE_BACKUP_ROWS[up] } : null;
}

function isPassiveRow(row) {
  return /passive/i.test(String(field(row, ['Cooldown'], '')));
}

const PASSIVE_BUILT = {}; // passive skills already read from their rows

function passiveInfo(id) {
  if (PASSIVE_BUILT[id]) return PASSIVE_BUILT[id];
  const src = passiveSourceRow(id);
  if (!src || !isPassiveRow(src.row)) return null;
  const special = SPECIAL_PASSIVES[src.key] || '';
  const name = String(field(src.row, ['Skill Name', 'Name'], src.key));
  // A special passive has its rules in this file, so its (empty) effect groups are not read
  const sk = special ? null : buildSheetSkill(src.key, src.row);
  PASSIVE_BUILT[id] = { id: src.key, name: name, special: special, sk: sk };
  return PASSIVE_BUILT[id];
}

// Every passive a Hero or Mobs row gives its unit
function passiveIdsFor(row, kind, who) {
  const out = [];
  const take = function (raw, from) {
    const id = String(raw || '').trim().toUpperCase();
    if (!id) return;
    const info = passiveInfo(id);
    if (!info) {
      if (from !== 'slot') sheetWarn(who + ': ' + id + (from === 'class' ? ' (class list in passives.js)' : ' (Passives column)') + ' is not a Passive skill, so it is skipped');
      return;
    }
    if (out.indexOf(info.id) === -1) out.push(info.id);
  };
  skillIdsOf(row).forEach(function (id) { take(id, 'slot'); });
  String(field(row, ['Passives', 'Passive Skills', 'Passive'], '')).split(/[,;\s]+/).forEach(function (id) { take(id, 'column'); });
  if (GIVE_CLASS_PASSIVES && kind === 'hero') {
    // Some starter heroes have a blank Class cell and are named after their class
    const cls = String(field(row, ['Class'], '') || field(row, ['Hero Name', 'Name'], '')).trim().toLowerCase();
    Object.keys(CLASS_PASSIVES).forEach(function (c) {
      if (c.toLowerCase() === cls) CLASS_PASSIVES[c].forEach(function (id) { take(id, 'class'); });
    });
  }
  return out;
}

function hasSpecial(unit, special) {
  return !!unit && !!unit.passives && unit.passives.some(function (id) { return SPECIAL_PASSIVES[id] === special; });
}

// Skill names are compared without capitals, spaces or punctuation
function plainName(text) {
  return String(text || '').toLowerCase().replace(/[^a-z]/g, '');
}

// ===== TURNING A PASSIVE ON =====

// The lasting effect one effect group of a passive gives its owner, or null if that kind cannot be a passive
function passiveEffect(unit, sk, g) {
  const run = g.def.run;
  if (run === 'effect') {
    const e = buildGroupEffect(unit, sk, g, undefined);
    delete e.charges; // no charges = it never runs out
    return e;
  }
  if (run === 'reflection') {
    const only = g.cond && g.cond.kind === 'damageGroup' ? (g.cond.groups.length > 1 ? g.cond.groups : g.cond.groups[0]) : undefined;
    return { type: 'reflection', percent: reflectPercent(g), only: only };
  }
  if (run === 'shieldBreak') return { type: 'shieldBreak', percent: (g.x || 0) / 100 };
  if (run === 'taunt') return { type: 'taunt' };
  return null;
}

// Switches a unit's passives on. Silent on purpose: the battle screen is not drawn yet when a battle starts.
function grantPassives(state, unit) {
  if (unit.passivesGranted || unit.isSummon) return; // summons cannot receive buffs
  unit.passivesGranted = true;
  unit.staticStacks = 0;
  (unit.passives || []).forEach(function (id) {
    const info = passiveInfo(id);
    if (!info || info.special) return;
    info.sk.groups.forEach(function (g) {
      const where = info.id + ' ' + info.name + ' group ' + g.letter;
      if (g.token !== 'self') { // so far a passive only works on its owner
        sheetWarn(where + ': passives only affect their owner for now, so this group is skipped', ENEMY_TARGETS.indexOf(g.token) !== -1 ? 'note' : 'error');
        return;
      }
      const e = passiveEffect(unit, info.sk, g);
      if (!e) { sheetWarn(where + ': ' + g.id + ' does not work as a passive yet, so this group is skipped'); return; }
      // its own name, so an ordinary skill with the same name can never replace it
      e.name = info.name + ' (passive)';
      e.passive = true;
      e.canDispel = false;
      e.canSteal = false;
      state.serial += 1;
      e.serial = state.serial;
      unit.effects.push(e);
    });
  });
  syncMaxHp(unit, true);
}

// ===== RULES FOR THE SPECIAL PASSIVES =====

function addStaticStack(state, unit) {
  if (unit.staticStacks >= STATIC_MAX_STACKS) return;
  unit.staticStacks = (unit.staticStacks || 0) + 1;
  state.emit('status', unit, 'Static Charge ' + unit.staticStacks);
}

function includesLightning(type, parts) {
  if (parts && parts.length) return parts.some(function (p) { return normType(p.type) === 'lightning'; });
  return normType(type) === 'lightning';
}

function isLightningSpell(sk) {
  return !!sk && !!sk.groups && sk.groups.some(function (g) { return g.def.run === 'damage' && includesLightning(g.type, g.parts); });
}

function markedByHunter(unit) {
  return unit.effects.some(function (e) { return e.type === 'vulnerable' && plainName(e.name) === 'huntersmark'; });
}

// Health plus Ward damage a hit really did
function damageDone(result) {
  return result ? (result.dealt || 0) + (result.absorbed || 0) : 0;
}

// What happens once a skill has finished: Lightning Conduction and Static Disruption
function afterCast(state, cast) {
  const user = cast.user;
  const name = plainName(cast.sk && cast.sk.name);

  if (name === 'lightningbolt' && hasSpecial(user, 'conduction') && cast.hits.length) {
    const first = cast.hits[0];
    const amount = damageDone(first.result) * CONDUCTION_SHARE / 100;
    const around = first.target.spot !== 'summon' ? ADJACENT_SLOTS[first.target.slot] : null;
    const near = around ? state.units.filter(function (u) {
      return u.side === first.target.side && u !== first.target && u.alive && u.spot !== 'summon' && around.indexOf(u.slot) !== -1;
    }) : [];
    if (amount > 0 && near.length) {
      const next = randomOf(near);
      state.emit('status', next, 'Lightning jumps!');
      // The amount already went through Armor once on the first enemy, so Armor is not taken off again.
      // The second enemy's Resistance, Shield and Ward still count.
      const armor = next.armor;
      next.armor = 0;
      try { takeHit(state, next, amount, { attacker: user, type: 'lightning' }); }
      finally { next.armor = armor; }
    }
  }

  if (name === 'thunderclash' && hasSpecial(user, 'staticDisruption')) {
    const done = [];
    cast.hits.forEach(function (h) {
      const t = h.target;
      if (!t.alive || t.side === user.side || damageDone(h.result) <= 0 || done.indexOf(t) !== -1) return;
      done.push(t);
      shiftCooldowns(state, t, STATIC_COOLDOWN_ADDED, true);
    });
  }
}

// ===== HOOKING INTO THE BATTLE =====
// Each hook runs the game's own function and adds the passive rules around it.

function installPassives() {
  const needed = {
    sheetSkillKey: typeof sheetSkillKey, unitFromRow: typeof unitFromRow, buildSheetSkill: typeof buildSheetSkill,
    newBattle: typeof newBattle, spawnWave: typeof spawnWave, useSkill: typeof useSkill, dealHit: typeof dealHit,
    takeHit: typeof takeHit, killUnit: typeof killUnit, reviveUnit: typeof reviveUnit, removeEffects: typeof removeEffects,
    buildGroupEffect: typeof buildGroupEffect, shiftCooldowns: typeof shiftCooldowns, syncMaxHp: typeof syncMaxHp,
    field: typeof field, rowById: typeof rowById, skillIdsOf: typeof skillIdsOf, checkOver: typeof checkOver,
    randomOf: typeof randomOf, normType: typeof normType, sheetWarn: typeof sheetWarn,
  };
  const missing = Object.keys(needed).filter(function (k) { return needed[k] !== 'function'; });
  if (missing.length) {
    console.error('passives.js: main.js has no ' + missing.join(', ') + '. Passives are off.');
    if (typeof sheetWarn === 'function') sheetWarn('passives.js does not match main.js (' + missing.join(', ') + '). Passives are off');
    return;
  }

  // A passive is never a skill button
  const baseSheetSkillKey = sheetSkillKey;
  sheetSkillKey = function (id) {
    const src = passiveSourceRow(id);
    if (src && isPassiveRow(src.row)) return null;
    return baseSheetSkillKey.apply(this, arguments);
  };

  const baseUnitFromRow = unitFromRow;
  unitFromRow = function (row, kind) {
    const unit = baseUnitFromRow.apply(this, arguments);
    unit.passives = passiveIdsFor(row, kind, unit.name);
    return unit;
  };

  const baseSpawnWave = spawnWave;
  spawnWave = function (state) {
    const added = baseSpawnWave.apply(this, arguments);
    added.forEach(function (u) { grantPassives(state, u); });
    return added;
  };

  const baseNewBattle = newBattle;
  newBattle = function () {
    const state = baseNewBattle.apply(this, arguments);
    state.units.forEach(function (u) { grantPassives(state, u); });
    return state;
  };

  // Nothing that removes effects (Dispel, Steal Buff, Cleanse, running out) can take a passive away
  const baseRemoveEffects = removeEffects;
  removeEffects = function (unit, test) {
    return baseRemoveEffects.call(this, unit, function (e) { return !e.passive && test(e); });
  };

  // Passives stay through death: set them aside, then give them back on revival (GDD 11.7)
  const baseKillUnit = killUnit;
  killUnit = function (state, unit) {
    const kept = unit.effects.filter(function (e) { return e.passive; });
    unit.staticStacks = 0;
    const result = baseKillUnit.apply(this, arguments);
    unit.keptPassives = kept;
    return result;
  };

  const baseReviveUnit = reviveUnit;
  reviveUnit = function (state, unit, fraction) {
    const result = baseReviveUnit.apply(this, arguments);
    if (unit.keptPassives && unit.keptPassives.length) {
      unit.effects = unit.effects.concat(unit.keptPassives);
      unit.keptPassives = null;
      syncMaxHp(unit, false);
      unit.hp = Math.max(1, Math.floor(unit.maxHp * fraction));
    }
    return result;
  };

  // Every skill use is remembered while it runs, so the after-effects know what it hit
  const casts = [];

  const baseUseSkill = useSkill;
  useSkill = function (state, user, key) {
    const cast = { user: user, sk: SKILLS[key], hits: [], chargeBonus: 0 };
    const charging = hasSpecial(user, 'staticCharge') && isLightningSpell(cast.sk);
    if (charging && user.staticStacks > 0) { // the stacks are spent on this spell
      cast.chargeBonus = user.staticStacks * STATIC_PER_STACK / 100;
      state.emit('status', user, 'Charge released +' + (user.staticStacks * STATIC_PER_STACK) + '%');
      user.staticStacks = 0;
    }
    casts.push(cast);
    let result;
    try { result = baseUseSkill.apply(this, arguments); }
    finally { casts.pop(); }
    afterCast(state, cast);
    if (charging && user.alive) addStaticStack(state, user); // casting it starts the next charge
    checkOver(state);
    return result;
  };

  const baseDealHit = dealHit;
  dealHit = function (state, user, sk, target, mods) {
    const cast = casts[casts.length - 1];
    const mine = !!cast && cast.user === user;
    const before = { critChance: mods.critChance, percent: mods.percent };
    if (hasSpecial(user, 'markCrit') && markedByHunter(target)) mods.critChance = Math.min(1, mods.critChance + PREDATOR_CRIT_BONUS / 100);
    if (mine && cast.chargeBonus && includesLightning(sk.damageType, sk.damageParts)) mods.percent += cast.chargeBonus;
    let result;
    try { result = baseDealHit.apply(this, arguments); }
    finally { mods.critChance = before.critChance; mods.percent = before.percent; } // the changes are for this one hit
    if (mine) cast.hits.push({ target: target, result: result });
    return result;
  };

  // Taking lightning damage builds Static Charge
  const baseTakeHit = takeHit;
  takeHit = function (state, unit, amount, opts) {
    const result = baseTakeHit.apply(this, arguments);
    if (unit.alive && damageDone(result) > 0 && hasSpecial(unit, 'staticCharge') && opts && includesLightning(opts.type, opts.parts)) {
      addStaticStack(state, unit);
    }
    return result;
  };
}

// On screen: a small "passives" line under each unit, and the names on that hero's turn
function installPassiveDisplay() {
  if (typeof battleScene === 'undefined' || !battleScene.extend || !battleScene.extend.refresh) return;
  const baseRefresh = battleScene.extend.refresh;
  battleScene.extend.refresh = function () {
    const scene = this;
    const units = this.battle.units;
    // Leave passive effects out of the usual list, so they do not pile up as numbers under the characters
    const full = units.map(function (u) { return u.effects; });
    units.forEach(function (u) { u.effects = u.effects.filter(function (e) { return !e.passive; }); });
    try { baseRefresh.apply(this, arguments); }
    finally { units.forEach(function (u, i) { u.effects = full[i]; }); }

    units.forEach(function (u) {
      const v = scene.views[u.id];
      if (!v || !u.alive || u.isSummon || !u.passives || !u.passives.length) return;
      const lines = v.status.visible && v.status.text ? [v.status.text] : [];
      lines.push('★ ' + u.passives.length + (u.passives.length > 1 ? ' passives' : ' passive'));
      if (hasSpecial(u, 'staticCharge') && u.staticStacks > 0) lines.push('Charge ' + u.staticStacks + '/' + STATIC_MAX_STACKS);
      v.status.setText(lines.join('\n')).setVisible(true);
    });

    const cur = this.current;
    if (this.turnText && cur && units.indexOf(cur) !== -1) { // not a hero left over from the last battle
      let text = cur.name + "'s turn";
      if (cur.side === 'player' && cur.passives && cur.passives.length) {
        text += '   ★ ' + cur.passives.map(function (id) { const i = passiveInfo(id); return i ? i.name : id; }).join(', ');
      }
      this.turnText.setText(text);
    }
  };
}

// main.js starts the game as soon as the data has loaded. The hooks go in just before that.
(function () {
  const install = function () { installRandomTypes(); installPassives(); };
  const rulesReady = typeof newBattle === 'function'; // combatEngine.js loads before this file
  if (rulesReady) install();
  const baseLoad = loadGameData;
  loadGameData = function () {
    return baseLoad.apply(this, arguments).then(function (result) {
      if (!rulesReady) install();
      installPassiveDisplay(); // the battle screen (main.js) exists by now
      return result;
    });
  };
})();
