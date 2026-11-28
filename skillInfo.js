// skillInfo.js - hold a skill button in battle to read what the skill does. A quick tap still uses it.
// The popup wording is built from the same data the battle runs, so changing a number in the Skills tab changes the popup too.
// Load order in index.html: after gearPassives.js, before main.js. main.js does not need any changes.

// ===== SETTINGS =====
const HOLD_MS = 400;            // how long a button must be held (in thousandths of a second) before the popup opens
const SHOW_SHEET_TEXT = true;   // show the skill's Description from the Skills tab under its name
const POPUP_W = 620;            // popup width

// ===== WORDING (nothing in this part draws on the screen or rolls any dice) =====

const TARGET_WORDS = {
  self: 'yourself', oneenemy: 'one enemy', randomenemy: 'a random enemy', allenemies: 'all enemies',
  allenemiesminustarget: 'all other enemies', adjacentenemies: 'enemies next to the target',
  oneally: 'one ally', randomally: 'a random ally', allallies: 'all allies',
  allalliesminustarget: 'all allies except the chosen one', allalliesminusself: 'all other allies',
  adjacentallies: 'allies next to you', onedeadally: 'a random fallen ally', alldeadallies: 'all fallen allies',
};

// Buffs and debuffs that are a simple "name +/- number"
const STAT_WORDS = {
  accuracyBoost: ['Accuracy', '+'], accuracyReduce: ['Accuracy', '-'],
  crit: ['Critical chance', '+'], critChanceReduce: ['Critical chance', '-'],
  dmgUp: ['Damage', '+'], dmgOutReduce: ['Damage dealt', '-'],
  armorBoost: ['Armor', '+'], armorReduce: ['Armor', '-'],
  dmgReduceIn: ['Damage taken', '-'], vulnerable: ['Damage taken', '+'],
  critResist: ['Critical resistance', '+'], critResistWeaken: ['Critical resistance', '-'],
  healthBoost: ['Max health', '+'], healthReduce: ['Max health', '-'],
  healReceivedBoost: ['Healing received', '+'], healReceivedReduce: ['Healing received', '-'],
  healOutBoost: ['Healing done', '+'], healOutReduce: ['Healing done', '-'],
};

function infoCap(text) {
  const s = String(text || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function infoNumber(n) { return String(show(n)); }
function infoTurns(n) { return n + (n === 1 ? ' turn' : ' turns'); }
function infoTimes(n) { return n === 1 ? 'once' : n + ' times'; }

function infoDamageType(g) {
  if (g.parts && g.parts.length > 1) {
    return 'split (' + g.parts.map(function (p) { return Math.round(p.share * 100) + '% ' + infoCap(p.type); }).join(', ') + ')';
  }
  const random = String(g.type || '').match(/^random\s+([a-z]+)$/);
  if (random) return 'random ' + infoCap(random[1]);
  return infoCap(g.type);
}

// One plain-English line for one effect group. user = the character whose button it is.
function skillGroupLine(user, sk, g, shield) {
  const run = g.def.run;
  const who = TARGET_WORDS[g.token] || g.token;
  const turns = groupTurns(sk, g);
  const amount = function (x) { return infoNumber(scaledAmount(user, sk, x)); };
  const pct = Math.round(g.x || 0) + '%';
  const foldsIntoShield = shield && g !== shield && g.token === shield.token && !g.cond;
  let line = '';

  if (run === 'damage') {
    const type = infoDamageType(g);
    line = 'Deals ' + amount(g.x) + (type ? ' ' + type : '') + ' damage to ' + who;
  } else if (run === 'heal') {
    if (g.def.fromSacrifice) line = 'Heals ' + who + ' for ' + pct + ' of the health sacrificed';
    else line = 'Heals ' + who + ' for ' + amount(g.x);
  } else if (run === 'sacrifice') {
    line = 'Costs ' + pct + ' of your max health (never drops you below 1)';
  } else if (run === 'lifesteal') {
    line = 'Heals ' + who + ' for ' + pct + ' of the damage dealt';
  } else if (run === 'cleanse') {
    line = 'Removes all debuffs from ' + who;
  } else if (run === 'dispel') {
    line = 'Removes ' + (g.x || 1) + ((g.x || 1) === 1 ? ' buff' : ' buffs') + ' from ' + who;
  } else if (run === 'steal') {
    line = 'Steals ' + (g.x || 1) + ((g.x || 1) === 1 ? ' buff' : ' buffs') + ' from ' + who;
  } else if (run === 'cdReduce' || run === 'cdIncrease') {
    line = (run === 'cdReduce' ? 'Lowers' : 'Raises') + ' cooldowns by ' + g.x + ' for ' + who;
  } else if (run === 'resurrect') {
    line = 'Revives ' + who + ' with ' + pct + ' health';
  } else if (run === 'assist') {
    line = 'A random ally also hits the target with their basic attack';
  } else if (run === 'ignoreTaunt') {
    line = 'Ignores Taunt';
  } else if (run === 'summon') {
    const row = mobRowFor(g.mobId);
    line = row ? 'Summons ' + String(field(row, ['Mob Name', 'Name'], 'an ally')) + ' for ' + infoTurns(turns)
      : 'Summon is not set up yet';
  } else if (run === 'taunt') {
    line = 'Taunt: enemy single-target attacks must hit you (' + infoTurns(turns) + ')';
  } else if (run === 'ward') {
    let pool = Math.round(scaledAmount(user, sk, g.x));
    if (typeof hasSpecial === 'function' && hasSpecial(user, 'wardMastery')) pool = Math.round(pool * (1 + GP.wardMasteryPct / 100));
    line = 'Gives ' + who + ' a ' + pool + ' Ward';
  } else if (run === 'shield') {
    const hits = g.x || 1;
    const lasts = g.y > 0 ? g.y : (sk.duration > 0 ? sk.duration : 0);
    line = 'Shield on ' + who + ': blocks ' + hits + (hits === 1 ? ' hit' : ' hits') + (lasts ? ' (' + infoTurns(lasts) + ')' : '');
  } else if (run === 'reflection') {
    const only = g.cond && g.cond.kind === 'damageGroup' ? g.cond.groups.map(infoCap).join(' and ') + ' ' : '';
    const back = Math.round(reflectPercent(g) * 100) + '% of ' + only + 'damage';
    line = foldsIntoShield ? 'When the Shield blocks a hit, reflects ' + back
      : 'Reflect on ' + who + ': sends back ' + back + ' (' + infoTurns(turns) + ')';
  } else if (run === 'shieldBreak') {
    line = g.token === 'self' ? '+' + pct + ' damage against Warded enemies (' + infoTurns(turns) + ')'
      : '+' + pct + ' damage against a target with a Ward';
  } else if (run === 'effect') {
    const e = buildGroupEffect(user, sk, g, turns); // the very effect the battle would apply
    const lasts = typeof e.charges === 'number' ? ' (' + infoTurns(e.charges) + ')' : '';
    const on = ' on ' + who;
    if (e.type === 'dot') {
      line = infoNumber(e.damage) + ' ' + infoCap(e.damageType) + ' damage each turn' + on + lasts;
    } else if (e.type === 'hot') {
      line = 'Heals ' + who + ' for ' + infoNumber(e.heal) + ' each turn' + lasts;
    } else if (e.type === 'reactiveHeal') {
      line = 'Heals ' + who + ' for ' + infoNumber(e.heal) + ' each time an attack hurts them' + lasts;
    } else if (e.type === 'thorns') {
      const hit = infoNumber(e.damage) + ' ' + infoCap(e.damageType || 'piercing') + ' damage';
      if (foldsIntoShield) line = 'When the Shield blocks a hit, deals ' + hit + ' back';
      else {
        line = 'Thorns on ' + who + ': ' + hit + ' back when hit' + (e.uses !== undefined ? ', up to ' + infoTimes(e.uses) : '') +
          (sk.duration > 0 || !(g.y > 0) ? lasts : '');
      }
    } else if (e.type === 'deathWard') {
      line = 'Death Ward' + on + ': survive defeat with ' + Math.round(e.hpPercent * 100) + '% health, ' + infoTimes(e.uses);
    } else if (e.type === 'provoke') {
      line = 'Provokes ' + who + ': they must use their basic attack on you' + lasts;
    } else if (e.type === 'critBonus' || e.type === 'critBonusReduce') {
      line = 'Critical bonus damage ' + (e.type === 'critBonus' ? '+' : '-') + e.points + on + lasts;
    } else if (e.type === 'resistance' || e.type === 'weakenResistance') {
      line = infoCap(e.damageType) + ' resistance ' + (e.type === 'resistance' ? 'up ' : 'down ') + e.delta +
        (e.delta === 1 ? ' step' : ' steps') + on + lasts;
    } else if (e.type === 'attributeBoost' || e.type === 'attributeReduce') {
      line = infoCap(e.attr) + ' ' + (e.type === 'attributeBoost' ? '+' : '-') + Math.round(e.percent * 100) + '%' + on + lasts;
    } else if (STAT_WORDS[e.type]) {
      const value = e.percent !== undefined ? e.percent : e.chance;
      line = STAT_WORDS[e.type][0] + ' ' + STAT_WORDS[e.type][1] + Math.round(value * 100) + '%' + on + lasts;
    } else {
      line = effectLabel(e) + on + lasts;
    }
  }

  if (line && g.cond && g.cond.kind === 'targetBelow') line += ', only if below ' + g.cond.pct + '% health';
  return line;
}

// Everything the popup shows for one character's skill
function skillInfo(state, user, key) {
  let sk = SKILLS[key];
  if (!sk) return null;
  // gear passives that change a skill (for example one more Shield hit). With no target, nothing random happens.
  if (typeof adjustSkillForPassives === 'function') sk = adjustSkillForPassives(state, user, sk, null);

  let cooldown = sk.cd;
  if (cooldown > 1 && typeof hasSpecial === 'function' && hasSpecial(user, 'swiftPrayer') && isHealingSkill(sk)) {
    cooldown = Math.max(1, cooldown - GP.swiftPrayerTurns);
  }
  let timing = sk.basic ? 'Basic attack' : (cooldown > 0 ? 'Cooldown: ' + infoTurns(cooldown) : 'No cooldown');
  const left = (user.cd && user.cd[key]) || 0;
  if (left > 0) timing += '  (' + left + ' left)';

  const groups = sk.groups || [];
  const shield = groups.filter(function (g) { return g.def.run === 'shield'; })[0] || null;
  const lines = groups.map(function (g) { return skillGroupLine(user, sk, g, shield); }).filter(Boolean);
  if (!lines.length) lines.push('This skill has no effect set up yet.');

  const row = typeof GAME_DATA !== 'undefined' ? rowById(GAME_DATA.skills, sk.id) : null;
  const text = row ? String(field(row.row, ['Description'], '')).replace(/\s+/g, ' ').trim() : '';

  // Which numbers grow with an attribute (percent effects never do)
  const scales = !!sk.attr && sk.scale > 0 && groups.some(function (g) {
    return g.def.run === 'damage' || g.def.run === 'ward' || (g.def.run === 'heal' && !g.def.fromSacrifice) ||
      (g.def.run === 'effect' && g.def.scales);
  });
  const note = scales ? 'Numbers include ' + infoCap(sk.attr) + '. Buffs, gear, crits and defenses can change the result.' : '';

  return { name: sk.name, timing: timing, text: text, lines: lines, note: note };
}

// ===== THE POPUP AND THE HOLD (screen) =====

// The popup sits just above the buttons, so your finger does not cover it
function showSkillPopup(scene, user, key) {
  hideSkillPopup(scene);
  const info = skillInfo(scene.battle, user, key);
  if (!info) return;
  const pad = 18;
  const parts = [];
  let y = pad;
  const add = function (str, size, color, gap, extra) {
    const t = scene.add.text(pad, y, str, Object.assign({
      fontFamily: BTN_FONT, fontSize: size + 'px', color: color, lineSpacing: 4, wordWrap: { width: POPUP_W - pad * 2 },
    }, extra || {}));
    parts.push(t);
    y += t.height + gap;
  };
  add(info.name, 32, '#ffffff', 4, { fontStyle: 'bold' });
  add(info.timing, 22, '#ffcc66', 10);
  if (SHOW_SHEET_TEXT && info.text) add(info.text, 21, '#bbbbbb', 10, { fontStyle: 'italic' });
  info.lines.forEach(function (line) { add('• ' + line, 25, '#ffffff', 6); });
  if (info.note) { y += 4; add(info.note, 18, '#99bbdd', 0); }
  const height = y + pad;

  const bottom = scene.H - BTN_MARGIN - BTN_H * 2 - BTN_GAP - 12; // just above the top row of buttons
  const room = bottom - 66;                                       // stay under the top bar
  const k = Math.min(1, room / height);                           // a very long skill is drawn a little smaller
  const back = scene.add.rectangle(0, 0, POPUP_W, height, 0x101018, 0.96).setOrigin(0, 0).setStrokeStyle(3, 0xf2c66a);
  scene.skillPopup = scene.add.container(scene.W - BTN_MARGIN - POPUP_W * k, bottom - height * k, [back].concat(parts))
    .setScale(k).setDepth(2600);
}

function hideSkillPopup(scene) {
  if (!scene.skillPopup) return;
  scene.skillPopup.destroy();
  scene.skillPopup = null;
}

// Forgets the finger that is on a button and closes the popup. Nothing is used.
function endSkillPress(scene) {
  if (scene.skillPress) scene.skillPress.timer.remove(false);
  scene.skillPress = null;
  hideSkillPopup(scene);
}

// Replaces each button's "use on touch" with: quick tap = use (when you lift your finger), hold = popup
function addSkillHold(scene) {
  scene.skillPress = null;
  scene.skillPopup = null;
  (scene.buttons || []).forEach(function (b, i) {
    b.box.removeAllListeners('pointerdown');
    b.box.on('pointerdown', function (pointer) {
      endSkillPress(scene);
      const hero = scene.active;
      const key = hero ? hero.skills[i] : null;
      if (!key) return;
      // remember whose turn it was when the finger went down, so a late release never uses the next hero's skill
      const press = { index: i, pointerId: pointer.id, hero: hero, yourTurn: scene.awaitingPlayer, held: false };
      press.timer = scene.time.delayedCall(HOLD_MS, function () {
        press.held = true;
        showSkillPopup(scene, hero, key);
      });
      scene.skillPress = press;
    });
    const mine = function (pointer) {
      const p = scene.skillPress;
      return p && p.index === i && p.pointerId === pointer.id ? p : null;
    };
    b.box.on('pointerup', function (pointer) {
      const press = mine(pointer);
      if (!press) return;
      const use = !press.held && !pointer.wasCanceled && press.yourTurn && press.hero === scene.active;
      endSkillPress(scene);
      if (use) scene.playerUse(i);
    });
    b.box.on('pointerout', function (pointer) { if (mine(pointer)) endSkillPress(scene); }); // slid off the button
  });
  const letGo = function (pointer) {
    if (scene.skillPress && scene.skillPress.pointerId === pointer.id) endSkillPress(scene);
  };
  scene.input.on('pointerup', letGo);
  scene.input.on('pointerupoutside', letGo);
  scene.input.on('gameout', function () { endSkillPress(scene); });
}

// Stops the iPad / phone from selecting the page or opening its own menu during a long press
function stopLongPressMenus() {
  const style = document.createElement('style');
  style.textContent = 'body,canvas{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}';
  document.head.appendChild(style);
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

function installSkillInfo() {
  if (typeof battleScene === 'undefined' || !battleScene.create || !battleScene.extend || !battleScene.extend.showResult) {
    console.error('skillInfo.js: main.js has changed, so the skill popup is off.');
    return;
  }
  const baseCreate = battleScene.create;
  battleScene.create = function () {
    const result = baseCreate.apply(this, arguments);
    if (!this.problem) addSkillHold(this);
    return result;
  };
  const baseResult = battleScene.extend.showResult;
  battleScene.extend.showResult = function () {
    endSkillPress(this);
    return baseResult.apply(this, arguments);
  };
  stopLongPressMenus();
}

// main.js starts the game as soon as the data has loaded. The hold goes in just before that.
(function () {
  const baseLoad = loadGameData;
  loadGameData = function () {
    return baseLoad.apply(this, arguments).then(function (result) {
      installSkillInfo(); // the battle screen (main.js) exists by now
      return result;
    });
  };
})();
