// gearPassives.js - the class gear passives that the Effects tab cannot describe. RULES ONLY: nothing here draws on the screen.
// Load order in index.html: after combatEngine.js and passives.js, before playerGear.js.
//
// A passive works for whoever wears the piece, whatever else they wear. "Healing", "Wards", "Nature damage" and so on
// mean any skill of that kind. A passive that names one skill or weapon needs that skill or weapon to be equipped too.

// =====================================================================================================
// THE NUMBERS. Change a number, upload this file, and the game and the Armory both use the new one.
// "sheet/Notion" = your design gives this number.   "TEST VALUE" = no number in your design yet.
// =====================================================================================================
const GP = {
  // Druid
  natureBlessingPct: 10,     // SK0414 Nature's Blessing: % more Nature damage                      TEST VALUE
  lastingEmbraceHits: 1,     // SK0416 Lasting Embrace: extra hits Armor of Vines blocks            sheet/Notion
  // Cleric
  swiftPrayerTurns: 1,       // SK0419 Swift Prayer: turns taken off healing cooldowns              TEST VALUE
  reflectionPct: 10,         // SK0420 Healing Reflection: % of the heal the wearer also gets       sheet/Notion
  // Berserker
  sweepPct: 50,              // SK0421 Sweeping Strikes: % damage to the two neighbours             TEST VALUE
  furyPer10: 5,              // SK0422 Berserker's Fury: +% damage per 10% of health missing        TEST VALUE
  lastStandAttacks: 3,       // SK0423 Last Stand: how many area attacks                            sheet/Notion
  lastStandDamage: 10,       // SK0423 Last Stand: base damage of each (grows with Strength)        TEST VALUE
  // Assassin
  venomDamage: 5,            // SK0424 Venom Coating: poison per turn (grows with Dexterity)        TEST VALUE
  venomTurns: 2,             // SK0424 Venom Coating: how many turns (it refreshes, no stacking)    TEST VALUE
  reflexInitiative: 20,      // SK0426 Quick Reflexes: added to the 1-100 turn order roll           TEST VALUE
  // Monk
  extraHitPct: 50,           // SK0427 Additional Hit: the extra hit's share of a normal hit        TEST VALUE
  jabChance: 8,              // SK0428 Infuriating Jab: % chance on each hit (Notion says 5-10)     TEST VALUE
  jabTurns: 1,               // SK0428 Infuriating Jab: how long the Provoke lasts                  TEST VALUE
  // Necromancer
  necroticPct: 10,           // SK0430 Necrotic Mastery: % more Necrotic damage                     TEST VALUE
  lifeStealPct: 20,          // SK0431 Life Steal: % of basic attack health damage healed           TEST VALUE
  shrapnelDamage: 15,        // SK0432 Bone Shrapnel: explosion damage (grows with Intelligence)    TEST VALUE
  // Shaman
  wardMasteryPct: 15,        // SK0433 Ward Mastery: % bigger Wards                                 TEST VALUE
  critWardChance: 30,        // SK0434 Critical Ward: % chance a Ward is a critical                 sheet/Notion
  // Elementalist
  elementalPct: 10,          // SK0437 Elemental Mastery: % more Elemental damage                   TEST VALUE
  // Warlock
  cursePotencyTurns: 1,      // SK0439 Curse Potency: extra turns on curses                         sheet/Notion
  darkAffinityPct: 10,       // SK0440 Dark Affinity: % more Dark damage while a curse is on a foe  sheet/Notion
  communionPct: 3,           // SK0441 Dark Communion: % max health healed per debuff               sheet/Notion
  // Bard
  melodyTurns: 1,            // SK0442 Lingering Melody: extra turns on heals over time, debuffs    sheet/Notion
  crowdWorkChance: 5,        // SK0443 Crowd Work: % chance to counterattack when hit               TEST VALUE
  // Paladin
  favorCharges: 5,           // SK0445 Favor of the Gods: Reactive Healing charges                  sheet/Notion
  favorHeal: 12,             // SK0445 Favor of the Gods: health per charge (like your other        TEST VALUE
                             //        Reactive Healing skills, which use 10 and 12)
  divineStrengthPct: 10,     // SK0446 Divine Strength: % more basic attack damage                  TEST VALUE
};

const AXE_WEAPONS = /axe|cleaver/i;
const DAGGER_WEAPONS = /dagger|stiletto|dirk/i;

// Skill ID -> the rule's name. Listing them here also tells passives.js not to look for effect groups on these rows.
const GEAR_PASSIVE_RULES = {
  SK0414: 'natureBlessing', SK0416: 'lastingEmbrace', SK0419: 'swiftPrayer', SK0420: 'healingReflection',
  SK0421: 'sweepingStrikes', SK0422: 'berserkersFury', SK0423: 'lastStand', SK0424: 'venomCoating',
  SK0426: 'quickReflexes', SK0427: 'additionalHit', SK0428: 'infuriatingJab', SK0430: 'necroticMastery',
  SK0431: 'necroLifeSteal', SK0432: 'boneShrapnel', SK0433: 'wardMastery', SK0434: 'criticalWard',
  SK0435: 'sharedFortune', SK0436: 'elementalFocus', SK0437: 'elementalMastery', SK0439: 'cursePotency',
  SK0440: 'darkAffinity', SK0441: 'darkCommunion', SK0442: 'lingeringMelody', SK0443: 'crowdWork',
  SK0445: 'favorOfTheGods', SK0446: 'divineStrength',
};

// ===== SMALL HELPERS =====

// How much of a hit (0 to 1) is a damage type or a damage group
function typeShare(type, parts, name) {
  const list = parts && parts.length ? parts : [{ type: type, share: 1 }];
  return list.reduce(function (n, p) {
    const t = normType(p.type);
    return n + (t === name || PARENT_OF[t] === name ? p.share : 0);
  }, 0);
}

function isCurseName(name) { return plainName(name).indexOf('curse') !== -1; }

// A "healing ability" is a button skill (not the basic attack) that heals or puts a heal over time on someone
function isHealingSkill(sk) {
  return !!sk && !sk.basic && sk.groups.some(function (g) { return g.def.run === 'heal' || g.def.type === 'hot'; });
}

// How much one cast of a healing ability gives each target (a heal over time counts all of its turns)
function healOutput(user, sk) {
  return sk.groups.reduce(function (n, g) {
    if (g.def.run === 'heal') return n + scaledAmount(user, sk, g.def.fromSacrifice ? (user.sacrificed || 0) * g.x / 100 : g.x);
    if (g.def.type === 'hot') return n + scaledAmount(user, sk, g.x) * groupTurns(sk, g);
    return n;
  }, 0);
}

function curseOnAnyFoe(state, user) {
  return opponents(state, user).some(function (o) {
    return o.effects.some(function (e) { return e.by === user.id && !isBuff(e) && isCurseName(nameOf(e)); });
  });
}

// How many debuffs this character currently has on the other side
function debuffsPlacedBy(state, user) {
  return opponents(state, user).reduce(function (n, o) {
    return n + o.effects.filter(function (e) { return e.by === user.id && !isBuff(e); }).length;
  }, 0);
}

// ===== DAMAGE BONUSES =====

function furyBonus(user) {
  if (!hasSpecial(user, 'berserkersFury') || !(user.maxHp > 0)) return 0;
  const missing = Math.max(0, Math.min(1, 1 - user.hp / user.maxHp));
  return missing * GP.furyPer10 * 10 / 100;
}

// Extra damage (a share: 0.1 = +10%) for one hit or damage over time, from passives that care about the damage type or the attack
function passiveTypeBonus(state, user, sk, type, parts) {
  let n = 0;
  if (hasSpecial(user, 'natureBlessing')) n += typeShare(type, parts, 'nature') * GP.natureBlessingPct / 100;
  if (hasSpecial(user, 'necroticMastery')) n += typeShare(type, parts, 'necrotic') * GP.necroticPct / 100;
  if (hasSpecial(user, 'elementalMastery')) n += typeShare(type, parts, 'elemental') * GP.elementalPct / 100;
  if (hasSpecial(user, 'divineStrength') && sk && sk.basic) n += GP.divineStrengthPct / 100;
  if (hasSpecial(user, 'darkAffinity') && state && curseOnAnyFoe(state, user)) n += typeShare(type, parts, 'dark') * GP.darkAffinityPct / 100;
  return n;
}

// Extra turns on a heal over time or a debuff
function passiveExtraTurns(user, sk, g) {
  const hostile = g.def.run === 'effect' && g.def.foe && g.token !== 'self';
  let n = 0;
  if (hostile && hasSpecial(user, 'cursePotency') && isCurseName(sk.name)) n += GP.cursePotencyTurns;
  if ((hostile || g.def.type === 'hot') && hasSpecial(user, 'lingeringMelody')) n += GP.melodyTurns;
  return n;
}

// ===== PASSIVES THAT CHANGE A SKILL BEFORE IT RUNS =====

function adjustSkillForPassives(state, user, sk, target) {
  let groups = null;
  const change = function (index, extra) {
    if (!groups) groups = sk.groups.slice();
    groups[index] = Object.assign({}, groups[index], extra);
  };
  let weakest = null; // one choice per cast
  sk.groups.forEach(function (g, i) {
    // Elemental Focus: a random element becomes the one the target resists least
    if (g.def.run === 'damage' && /^random\s+elemental$/.test(String(g.type || '')) && hasSpecial(user, 'elementalFocus') && target && target.side !== user.side) {
      if (!weakest) {
        const best = Math.min.apply(null, DAMAGE_TYPES.elemental.map(function (t) { return resistanceState(target, t); }));
        weakest = randomOf(DAMAGE_TYPES.elemental.filter(function (t) { return resistanceState(target, t) === best; }));
        state.emit('status', user, weakest.charAt(0).toUpperCase() + weakest.slice(1) + '!');
      }
      change(i, { type: weakest });
    }
    // Shared Fortune: the basic attack's crit buff goes to the whole team
    if (sk.basic && g.def.type === 'crit' && g.token === 'randomally' && hasSpecial(user, 'sharedFortune')) change(i, { token: 'allallies' });
    // Lasting Embrace: Armor of Vines blocks one more hit
    if (g.def.run === 'shield' && plainName(sk.name) === 'armorofvines' && hasSpecial(user, 'lastingEmbrace')) change(i, { x: (g.x || 1) + GP.lastingEmbraceHits });
  });
  return groups ? Object.assign({}, sk, { groups: groups }) : sk;
}

// ===== PASSIVES THAT GO OFF AFTER A SKILL =====

function afterPassiveSkill(state, cast, key) {
  const user = cast.user, sk = cast.sk;
  if (!sk || !sk.groups || !user.alive || user.dying) return;
  cast.after = true; // hits from here on are extra hits, not part of the skill itself
  const main = cast.hits.slice();
  const weapon = (user.gear && user.gear.weapon) || '';

  // Sweeping Strikes: the basic axe attack also hits two neighbours of the target
  if (sk.basic && main.length && hasSpecial(user, 'sweepingStrikes') && AXE_WEAPONS.test(weapon)) {
    const first = main[0].target;
    const around = first.spot !== 'summon' ? ADJACENT_SLOTS[first.slot] : null;
    const near = around ? state.units.filter(function (u) {
      return u.side === first.side && u !== first && u.alive && u.spot !== 'summon' && around.indexOf(u.slot) !== -1;
    }) : [];
    while (near.length > 2) near.splice(near.indexOf(randomOf(near)), 1);
    if (near.length) state.emit('info', user, 'triggers Sweeping Strikes');
    near.forEach(function (t) {
      main.forEach(function (h) {
        if (t.alive && user.alive && !user.dying && h.target === first) {
          const r = dealHit(state, user, h.skill, t, cast.mods, h.base * GP.sweepPct / 100);
          cast.hits.push({ skill: h.skill, target: t, base: 0, result: r });
        }
      });
    });
  }

  // Additional Hit: Quick Palms strikes one more time
  if (plainName(sk.name) === 'quickpalms' && main.length && hasSpecial(user, 'additionalHit') && user.alive && !user.dying && main[0].target.alive) {
    state.emit('info', user, 'triggers Additional Hit');
    dealHit(state, user, main[0].skill, main[0].target, cast.mods, main[0].base * GP.extraHitPct / 100);
  }
  if (!user.alive || user.dying) return;

  // Venom Coating: the basic dagger attack poisons (a new coat replaces the old one)
  if (sk.basic && hasSpecial(user, 'venomCoating') && DAGGER_WEAPONS.test(weapon)) {
    const done = [];
    main.forEach(function (h) {
      const t = h.target;
      if (!t.alive || t.dying || t.side === user.side || h.result.nullified || done.indexOf(t) !== -1) return;
      done.push(t);
      const damage = GP.venomDamage * (1 + attrOf(user, 'dexterity') * ATTR_SCALING) *
        (1 + gearBonus(user, 'damagePct') + gearTypeBonus(user, 'poison') + passiveTypeBonus(state, user, null, 'poison') + furyBonus(user));
      removeEffects(t, function (e) { return e.type === 'dot' && e.name === 'Venom Coating' && e.by === user.id; });
      addEffect(state, t, { type: 'dot', damage: damage, damageType: 'poison', charges: GP.venomTurns + gearBonus(user, 'dotTurns'), name: 'Venom Coating' }, user);
    });
  }

  // Life Steal: heals from the health damage the basic attack did
  if (sk.basic && hasSpecial(user, 'necroLifeSteal')) {
    const dealt = cast.hits.reduce(function (n, h) { return n + (h.result.dealt || 0); }, 0);
    if (dealt > 0 && user.hp < user.maxHp) {
      state.emit('info', user, 'triggers Life Steal');
      healUnit(state, user, Math.max(1, Math.round(dealt * GP.lifeStealPct / 100)), user);
    }
  }

  if (isHealingSkill(sk)) {
    // Healing Reflection: once per cast, however many allies were healed
    if (hasSpecial(user, 'healingReflection') && user.hp < user.maxHp) {
      state.emit('info', user, 'triggers Healing Reflection');
      healUnit(state, user, Math.max(1, Math.round(healOutput(user, sk) * GP.reflectionPct / 100)), user);
    }
    // Swift Prayer: a shorter wait before the next heal (never under 1)
    if (hasSpecial(user, 'swiftPrayer') && sk.cd > 1) user.cd[key] = Math.max(1, sk.cd - GP.swiftPrayerTurns);
  }

  // Favor of the Gods: casting Aura of Vitality gives fresh Reactive Healing charges. They last until used.
  if (plainName(sk.name) === 'auraofvitality' && hasSpecial(user, 'favorOfTheGods')) {
    removeEffects(user, function (e) { return e.name === 'Favor of the Gods'; });
    state.emit('info', user, 'triggers Favor of the Gods');
    addEffect(state, user, { type: 'reactiveHeal', heal: GP.favorHeal, uses: GP.favorCharges, source: user, name: 'Favor of the Gods' }, user);
  }
}

// Infuriating Jab: each hit has a small chance to Provoke
function tryJab(state, user, target) {
  if (!hasSpecial(user, 'infuriatingJab') || !user.alive || !target.alive || target.dying || target.side === user.side) return;
  if (engineRandom() * 100 >= GP.jabChance) return;
  const e = { type: 'provoke', source: user, charges: GP.jabTurns, name: 'Infuriating Jab' };
  if (state.current === target) e.fresh = true; // landed during their own turn (a counterattack): it counts from their next turn
  addEffect(state, target, e, user);
}

// ===== LAST STAND =====
// The wearer does not fall straight away: once whatever hit them has finished, they attack three times and then go down.
let resolvingLastStand = false;
function resolveLastStands(state) {
  if (resolvingLastStand || !state.lastStands || !state.lastStands.length) return;
  resolvingLastStand = true;
  try {
    while (state.lastStands.length) {
      const unit = state.lastStands.shift();
      for (let i = 1; i <= GP.lastStandAttacks; i++) {
        if (!opponents(state, unit).length) break;
        state.emit('info', unit, 'Last Stand attack ' + i);
        const mods = prepareDamage(unit);
        opponents(state, unit).forEach(function (t) {
          if (t.alive) dealHit(state, unit, { attr: 'strength', scale: ATTR_SCALING, damageType: 'slashing' }, t, mods, GP.lastStandDamage);
        });
      }
      unit.dying = false;
      killUnit(state, unit); // now they really fall
    }
  } finally { resolvingLastStand = false; }
  checkOver(state);
  // If that cleared a stage but nobody on your side is left to fight the next one, the battle is lost
  const standing = state.units.some(function (u) { return u.side === 'player' && u.alive && !u.isSummon; });
  if (!standing && state.waveCleared) { state.waveCleared = false; state.over = 'defeat'; }
}

// ===== HOOKING INTO THE BATTLE =====
// Each hook runs the game's own function and adds the passive rules around it.
// Nothing here rolls a random number or changes anything for a character without one of these passives.

const gearCasts = []; // the skills being used right now (an Assist runs one inside another)
function castOf(user) {
  const c = gearCasts[gearCasts.length - 1];
  return c && c.user === user ? c : null;
}

function installGearPassives() {
  Object.assign(SPECIAL_PASSIVES, GEAR_PASSIVE_RULES);

  // Quick Reflexes
  const baseMakeUnit = makeUnit;
  makeUnit = function (def) {
    const unit = baseMakeUnit.apply(this, arguments);
    if (hasSpecial(unit, 'quickReflexes')) unit.initiative += GP.reflexInitiative;
    return unit;
  };

  const basePrepare = prepareDamage;
  prepareDamage = function (user) {
    const fury = furyBonus(user); // worked out once, when the attack starts
    const mods = basePrepare.apply(this, arguments);
    mods.percent += fury;
    return mods;
  };

  const baseDealHit = dealHit;
  dealHit = function (state, user, sk, target, mods, base) {
    const cast = castOf(user);
    const before = mods.percent;
    mods.percent += passiveTypeBonus(state, user, cast ? cast.sk : null, sk.damageType, sk.damageParts);
    let result;
    try { result = baseDealHit.apply(this, arguments); }
    finally { mods.percent = before; } // the bonus is for this one hit
    if (cast && !cast.after) { cast.hits.push({ skill: sk, target: target, base: base, result: result }); cast.mods = mods; }
    if (!result.nullified) tryJab(state, user, target);
    return result;
  };

  const baseTakeHit = takeHit;
  takeHit = function (state, unit, amount, opts) {
    if (unit.dying) return { nullified: true, absorbed: 0, dealt: 0 };
    const attacker = opts && opts.attacker;
    // Counter Stance, noted before the hit so we can tell whether it went off
    const monk = !!attacker && (hasSpecial(unit, 'additionalHit') || hasSpecial(unit, 'infuriatingJab'));
    const stance = monk
      ? unit.effects.filter(function (e) { return e.type === 'thorns' && plainName(e.name) === 'counterstance' && e.uses > 0; })
        .map(function (e) { return { effect: e, uses: e.uses }; })
      : [];
    const result = baseTakeHit.apply(this, arguments);
    stance.forEach(function (s) {
      if (s.effect.uses >= s.uses || !attacker.alive) return;
      tryJab(state, unit, attacker); // the counterattack is one of the Monk's hits
      if (hasSpecial(unit, 'additionalHit') && attacker.alive) {
        strikeBack(state, unit, attacker, s.effect.damage * GP.extraHitPct / 100, s.effect.damageType || 'crushing', 'Extra hit');
        tryJab(state, unit, attacker);
      }
    });
    // Crowd Work
    if (attacker && !opts.dotTick && !opts.reflected && !result.nullified && attacker.side !== unit.side && attacker.alive &&
        unit.alive && !unit.dying && hasSpecial(unit, 'crowdWork') && engineRandom() * 100 < GP.crowdWorkChance) {
      const found = rowById(GAME_DATA.skills, 'SK0008'); // Harmonious Strike
      const strike = found ? SKILLS[sheetSkillKey(found.key)] : null;
      const hit = strike && strike.groups.filter(function (g) { return g.def.run === 'damage'; })[0];
      if (hit) strikeBack(state, unit, attacker, scaledAmount(unit, strike, hit.x), hit.type, 'Crowd Work!');
    }
    return result;
  };

  const baseHeal = healUnit;
  healUnit = function (state, unit) {
    if (unit.dying) return 0;
    return baseHeal.apply(this, arguments);
  };

  // Every debuff remembers who put it there (Dark Affinity and Dark Communion need to know)
  const baseAddEffect = addEffect;
  addEffect = function (state, unit, e, user) {
    if (unit.dying) return false;
    if (user && user.side !== unit.side && !isBuff(e)) e.by = user.id;
    return baseAddEffect.apply(this, arguments);
  };

  const baseBuild = buildGroupEffect;
  buildGroupEffect = function (user, sk, g, turns) {
    const longer = turns === undefined ? turns : turns + passiveExtraTurns(user, sk, g);
    const e = baseBuild.call(this, user, sk, g, longer);
    const cast = castOf(user);
    if (cast && e.type === 'dot') e.damage *= 1 + passiveTypeBonus(cast.state, user, cast.sk, e.damageType) + furyBonus(user);
    return e;
  };

  const baseSheetSkill = useSheetSkill;
  useSheetSkill = function (state, user, sk, target, add) {
    return baseSheetSkill.call(this, state, user, adjustSkillForPassives(state, user, sk, target), target, add);
  };

  // Ward Mastery and Critical Ward
  const baseWardPool = wardPoolFor;
  wardPoolFor = function (state, user, sk, g, target) {
    let pool = baseWardPool.apply(this, arguments);
    if (hasSpecial(user, 'wardMastery')) pool = Math.round(pool * (1 + GP.wardMasteryPct / 100));
    if (hasSpecial(user, 'criticalWard') && target.alive && !target.isSummon && engineRandom() * 100 < GP.critWardChance) {
      pool = Math.round(critDamage(pool, critNumbers(user)));
      state.emit('crit', target, 'CRIT WARD!');
    }
    return pool;
  };

  // Bone Shrapnel: the wearer's summon explodes when it is defeated
  const baseSummon = spawnSummon;
  spawnSummon = function (state, user) {
    const summon = baseSummon.apply(this, arguments);
    if (summon && hasSpecial(user, 'boneShrapnel')) summon.explodes = Math.round(GP.shrapnelDamage * (1 + attrOf(user, 'intelligence') * ATTR_SCALING));
    return summon;
  };

  // Dark Communion
  const baseStartTurn = startTurn;
  startTurn = function (state, unit) {
    baseStartTurn.apply(this, arguments);
    if (!unit.alive || !hasSpecial(unit, 'darkCommunion') || unit.hp >= unit.maxHp) return;
    const n = debuffsPlacedBy(state, unit);
    if (n > 0) {
      state.emit('info', unit, 'triggers Dark Communion x' + n);
      healUnit(state, unit, Math.max(1, Math.round(unit.maxHp * GP.communionPct / 100 * n)), unit);
    }
  };

  // Last Stand
  const baseKill = killUnit;
  killUnit = function (state, unit) {
    if (!unit.dying && !unit.lastStandUsed && !unit.isSummon && hasSpecial(unit, 'lastStand')) {
      unit.lastStandUsed = true; // once per battle, even if revived
      unit.dying = true;
      unit.hp = 0;
      (state.lastStands || (state.lastStands = [])).push(unit);
      state.emit('status', unit, 'LAST STAND!');
      return undefined;
    }
    return baseKill.apply(this, arguments);
  };

  const baseUseSkill = useSkill;
  useSkill = function (state, user, key) {
    const cast = { state: state, user: user, sk: SKILLS[key], hits: [], mods: null, after: false };
    let result;
    gearCasts.push(cast);
    try {
      result = baseUseSkill.apply(this, arguments);
      afterPassiveSkill(state, cast, key);
    } finally { gearCasts.pop(); }
    if (!gearCasts.length) resolveLastStands(state);
    checkOver(state);
    return result;
  };

  const baseEndTurn = endTurn;
  endTurn = function (state) {
    const result = baseEndTurn.apply(this, arguments);
    resolveLastStands(state); // poisoned or burned down at the end of their turn
    return result;
  };
}

// ===== WHAT THE GEAR SCREENS SHOW =====

// One line saying what a passive does right now, with the current numbers. '' for other passives.
function gearPassiveNote(skillId) {
  const notes = {
    SK0414: '+' + GP.natureBlessingPct + '% Nature damage',
    SK0416: 'Armor of Vines blocks ' + GP.lastingEmbraceHits + ' more hit',
    SK0419: 'Healing cooldowns are ' + GP.swiftPrayerTurns + ' turn shorter',
    SK0420: 'You also heal ' + GP.reflectionPct + '% of your heal',
    SK0421: GP.sweepPct + '% damage to 2 enemies beside the target',
    SK0422: '+' + GP.furyPer10 + '% damage per 10% health missing',
    SK0423: 'Once per battle: ' + GP.lastStandAttacks + ' area attacks before you fall',
    SK0424: 'Basic attack adds ' + GP.venomDamage + ' poison (before bonuses) for ' + GP.venomTurns + ' turns',
    SK0426: '+' + GP.reflexInitiative + ' to your turn order roll',
    SK0427: 'The extra hit does ' + GP.extraHitPct + '% damage',
    SK0428: GP.jabChance + '% chance per hit to Provoke for ' + GP.jabTurns + ' turn',
    SK0430: '+' + GP.necroticPct + '% Necrotic damage',
    SK0431: 'Heal ' + GP.lifeStealPct + '% of basic attack damage',
    SK0432: 'Your summon explodes for ' + GP.shrapnelDamage + ' (before bonuses) when defeated',
    SK0433: 'Your Wards are ' + GP.wardMasteryPct + '% bigger',
    SK0434: GP.critWardChance + '% chance for a critical Ward',
    SK0435: 'The crit buff goes to the whole team',
    SK0436: 'Elemental Blast picks the target\'s weakest element',
    SK0437: '+' + GP.elementalPct + '% Elemental damage',
    SK0439: 'Curses last ' + GP.cursePotencyTurns + ' turn longer',
    SK0440: '+' + GP.darkAffinityPct + '% Dark damage while an enemy has your curse',
    SK0441: 'Heal ' + GP.communionPct + '% per debuff of yours at the start of your turn',
    SK0442: 'Your heals over time and debuffs last ' + GP.melodyTurns + ' turn longer',
    SK0443: GP.crowdWorkChance + '% chance to hit back when hit',
    SK0445: 'Aura of Vitality gives ' + GP.favorCharges + ' charges that heal ' + GP.favorHeal + ' when you are hurt',
    SK0446: '+' + GP.divineStrengthPct + '% basic attack damage',
  };
  return notes[skillId] || '';
}

// What a passive still needs from the rest of the loadout. '' = it can work. sheet = sheetForGear(...) from playerGear.js
function gearPassiveMissing(skillId, sheet) {
  const rule = GEAR_PASSIVE_RULES[skillId];
  if (!rule) return '';
  const skills = sheet.actives.map(function (a) { const k = sheetSkillKey(a.id); return k ? SKILLS[k] : null; }).filter(Boolean);
  const weapon = sheet.bonus.weapon || '';
  const any = function (test) { return skills.some(test); };
  const group = function (test) { return any(function (s) { return s.groups.some(function (g) { return test(g, s); }); }); };
  const deals = function (name) {
    return group(function (g) {
      if (g.def.run !== 'damage' && g.def.type !== 'dot') return false;
      const random = String(g.type || '').match(/^random\s+([a-z]+)$/);
      return random ? random[1] === name : typeShare(g.type, g.parts, name) > 0;
    });
  };
  const named = function (n) { return any(function (s) { return plainName(s.name) === n; }); };
  const debuffsFoes = function (g) { return g.def.run === 'effect' && g.def.foe && g.token !== 'self'; };
  const curse = any(function (s) { return isCurseName(s.name) && s.groups.some(debuffsFoes); });
  const needs = {
    natureBlessing: [deals('nature'), 'a skill that deals Nature damage'],
    lastingEmbrace: [named('armorofvines'), 'Armor of Vines'],
    swiftPrayer: [any(isHealingSkill), 'a healing skill'],
    healingReflection: [any(isHealingSkill), 'a healing skill'],
    sweepingStrikes: [AXE_WEAPONS.test(weapon), 'an axe or cleaver in your Main Hand'],
    venomCoating: [DAGGER_WEAPONS.test(weapon), 'a dagger in your Main Hand'],
    additionalHit: [named('quickpalms') || named('counterstance'), 'Quick Palms or Counter Stance'],
    necroticMastery: [deals('necrotic'), 'a skill that deals Necrotic damage'],
    boneShrapnel: [group(function (g) { return g.def.run === 'summon'; }), 'a summon skill'],
    wardMastery: [group(function (g) { return g.def.run === 'ward'; }), 'a Ward skill'],
    criticalWard: [group(function (g) { return g.def.run === 'ward'; }), 'a Ward skill'],
    sharedFortune: [group(function (g, s) { return s.basic && g.def.type === 'crit' && g.token === 'randomally'; }), 'Spirit Strike'],
    elementalFocus: [group(function (g) { return g.def.run === 'damage' && /^random\s+elemental$/.test(g.type); }), 'Elemental Blast'],
    elementalMastery: [deals('elemental'), 'a skill that deals Elemental damage'],
    cursePotency: [curse, 'a curse skill'],
    darkAffinity: [curse && deals('dark'), 'a curse skill and Dark damage'],
    darkCommunion: [group(debuffsFoes), 'a skill that puts a debuff on enemies'],
    lingeringMelody: [group(function (g) { return debuffsFoes(g) || g.def.type === 'hot'; }), 'a heal over time or debuff skill'],
    favorOfTheGods: [named('auraofvitality'), 'Aura of Vitality'],
  };
  return needs[rule] && !needs[rule][0] ? 'Needs ' + needs[rule][1] : '';
}

if (typeof hasSpecial === 'function' && typeof newBattle === 'function' && typeof wardPoolFor === 'function') installGearPassives();
else console.error('gearPassives.js needs the new combatEngine.js and passives.js loaded before it. The new gear passives are off.');
