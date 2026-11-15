// ===== SETTINGS ====
const ASSET_PATH = ''; // use 'assets/' if you move the images into a folder

const SPRITE_FILES = {
  druid: 'elf_druid.png',
  goblin1: 'goblin_warrior.png',
  goblin2: 'orc_brute.png',
  goblin3: 'goblin_archer.png',
  goblin4: 'goblin_shaman.png',
};

// Colored circles used if an image is missing
const PLACEHOLDER_COLORS = {
  druid: 0x44aa55,
  goblin1: 0x88bb33,
  goblin2: 0xaa9933,
  goblin3: 0x669944,
  goblin4: 0xbb6633,
};

const SPRITE_HEIGHT = 140;                 
 // bigger number = bigger characters
const FEET_Y = [215, 305, 395, 485, 575];  // screen height of each slot's feet, top to bottom
const FORMATION_X = [0, 50, 100, 50, 0];   // how far each slot sits toward the middle (the stagger)
const SIDE_MARGIN = 300;                   // how far the back line sits from the screen edge
const FLIP_PLAYER = false; // set true if your druid faces the wrong way
const FLIP_ENEMY = false;  // set true if your goblins face the wrong way

// ===== TEST VALUES (placeholders for testing, not approved design numbers) =====
const SKILLS = {
  attack:    { name: 'Attack', kind: 'damage', target: 'enemy', damage: 20, cd: 0 },
  shield:    { name: 'Shield', kind: 'shield', target: 'self', charges: 3, cd: 3 },
  poison:    { name: 'Poison', kind: 'dot', target: 'enemy', hit: 6, dot: 8, charges: 3, cd: 2 },
  ward:      { name: 'Ward', kind: 'ward', target: 'self', pool: 30, cd: 3 },
  stab:      { name: 'Stab', kind: 'damage', target: 'enemy', damage: 6, cd: 0 },
  venom:     { name: 'Venom', kind: 'dot', target: 'enemy', hit: 4, dot: 6, charges: 3, cd: 2 },
};

const UNITS = [
  { id: 'druid',   name: 'Druid',    sprite: 'druid',   side: 'player', slot: 2, hp: 200, armor: 0, speed: 6, dex: 10, skills: ['attack', 'shield', 'poison', 'ward'] },
  { id: 'goblin1', name: 'Goblin 1', sprite: 'goblin1', side: 'enemy',  slot: 0, hp: 40,  armor: 0, speed: 4, dex: 5,  skills: ['stab'] },
  { id: 'goblin2', name: 'Goblin 2', sprite: 'goblin2', side: 'enemy',  slot: 1, hp: 40,  armor: 0, speed: 3, dex: 5,  skills: ['stab'] },
  { id: 'goblin3', name: 'Goblin 3', sprite: 'goblin3', side: 'enemy',  slot: 2, hp: 40,  armor: 0, speed: 5, dex: 5,  skills: ['stab'] },
  { id: 'goblin4', name: 'Goblin 4', sprite: 'goblin4', side: 'enemy',  slot: 3, hp: 40,  armor: 0, speed: 2, dex: 5,  skills: ['venom', 'stab'] },
];

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

function newBattle(emit) {
  const units = UNITS.map(function (u) {
    return Object.assign({}, u, {
      maxHp: u.hp, ward: 0, effects: [], cd: {}, alive: true,
      initiative: Math.floor(Math.random() * 20) + 1 + u.speed, // random roll + Speed modifier, fixed for the node
      tie: Math.random(),
    });
  });
  return { units: units, order: units.slice().sort(compareInitiative), turn: -1, serial: 0, over: null, emit: emit };
}

function opponents(state, unit) {
  return state.units.filter(function (u) { return u.side !== unit.side && u.alive; });
}

function skillReady(unit, key) {
  return !(unit.cd[key] > 0);
}

function killUnit(state, unit) {
  unit.hp = 0;
  unit.alive = false;
  unit.ward = 0;
  unit.effects = []; // Dead characters lose all buffs and debuffs
  state.emit('death', unit, 'defeated');
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

  // 2. Armor: flat reduction, never below zero (all Armor is 0 in this prototype)
  let dmg = Math.max(0, amount - unit.armor);

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

  if (sk.kind === 'damage') {
    takeHit(state, target, sk.damage, {});
  } else if (sk.kind === 'shield') {
    state.serial += 1;
    target.effects.push({ type: 'shield', charges: sk.charges, serial: state.serial });
    state.emit('status', target, 'Shield x' + sk.charges);
  } else if (sk.kind === 'dot') {
    // The initial hit is subject to Shields. If a Shield nullifies it, the DoT is not applied.
    const r = takeHit(state, target, sk.hit, {});
    if (!r.nullified && target.alive) {
      state.serial += 1;
      target.effects.push({ type: 'dot', damage: sk.dot, charges: sk.charges, serial: state.serial });
      state.emit('status', target, 'DoT ' + sk.dot + ' x' + sk.charges);
    }
  } else if (sk.kind === 'ward') {
    // A new ward only replaces the current pool if it is larger. No duration.
    if (sk.pool > target.ward) target.ward = sk.pool;
    state.emit('status', target, 'Ward ' + target.ward);
  }
  checkOver(state);
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
    }
  }
  checkOver(state);
}

function checkOver(state) {
  if (state.over) return;
  const playersAlive = state.units.some(function (u) { return u.side === 'player' && u.alive; });
  const enemiesAlive = state.units.some(function (u) { return u.side === 'enemy' && u.alive; });
  if (!enemiesAlive) state.over = 'victory';
  else if (!playersAlive) state.over = 'defeat';
}

function nextActor(state) {
  if (state.over) return null;
  for (let i = 0; i < state.order.length; i++) {
    state.turn = (state.turn + 1) % state.order.length;
    const u = state.order[state.turn];
    if (u.alive) return u; // dead characters keep their place but skip their turn
  }
  return null;
}

// Simple enemy AI: first skill that is off cooldown, aimed at the first living opponent
function chooseAction(state, unit) {
  const key = unit.skills.find(function (k) { return skillReady(unit, k); });
  if (!key) return null;
  const targets = SKILLS[key].target === 'self' ? [unit] : opponents(state, unit);
  return targets.length ? { key: key, target: targets[0] } : null;
}

// ===== SCENE (graphics and input) =====
const EVENT_COLORS = {
  damage: '#ff6666', ward: '#66ccff', block: '#ffee66',
  status: '#cc88ff', death: '#ff4444', info: '#dddddd',
};

function makeLabel(scene, x, y, str, size) {
  return scene.add.text(x, y, str, { fontSize: size + 'px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
}

function slotPosition(side, i, W) {
  const x = side === 'player' ? SIDE_MARGIN + FORMATION_X[i] : W - SIDE_MARGIN - FORMATION_X[i];
  return { x: x, y: FEET_Y[i] };
}

function makePad(scene, x, y, color) {
  return scene.add.ellipse(x, y - 4, 80, 22, color, 0.35).setStrokeStyle(2, color);
}

const battleScene = {
  key: 'Battle',

  preload: function () {
    this.load.on('loaderror', function (file) {
      console.log('missing image: ' + file.key);
    });
    this.load.setPath(ASSET_PATH);
    for (const key in SPRITE_FILES) {
      this.load.image(key, SPRITE_FILES[key]);
    }
  },

  create: function () {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W;
    this.H = H;

    // Placeholders for any missing images
    for (const key in PLACEHOLDER_COLORS) {
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(PLACEHOLDER_COLORS[key], 1);
        g.fillCircle(50, 50, 48);
        g.generateTexture(key, 100, 100);
        g.destroy();
      }
    }

    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a2b);

    // Top bar
    this.add.rectangle(W / 2, 30, W, 60, 0x000000, 0.6);
    makeLabel(this, 60, 30, 'HOME', 24);
    makeLabel(this, W / 2 - 80, 30, 'Energy 0/0', 24);
    makeLabel(this, W / 2 + 120, 30, 'Gold 0', 24);

    // 5 staggered positions per side (little ground pads)
    this.playerSlots = [];
    this.enemySlots = [];
    for (let i = 0; i < 5; i++) {
      const p = slotPosition('player', i, W);
      const e = slotPosition('enemy', i, W);
      makePad(this, p.x, p.y, 0x3366cc);
      makePad(this, e.x, e.y, 0xcc3333);
      this.playerSlots.push(p);
      this.enemySlots.push(e);
    }

    // Battle state
    const scene = this;
    this.battle = newBattle(function (type, unit, text) { scene.onEvent(type, unit, text); });
    this.hero = this.battle.units.find(function (u) { return u.side === 'player'; });
    this.awaitingPlayer = false;
    this.logLines = [];

    // Unit views
    this.targetRing = this.add.ellipse(0, 0, 108, 30).setStrokeStyle(3, 0xff4444).setVisible(false);
    this.views = {};
    this.battle.units.forEach(function (u) { scene.makeView(u); });
    this.target = this.battle.units.find(function (u) { return u.side === 'enemy' && u.alive; });

    // Info text
    this.turnText = makeLabel(this, W / 2, 100, '', 24);
    makeLabel(this, W / 2, 130, 'Order: ' + this.battle.order.map(function (u) { return u.name; }).join(' > '), 14);
    this.logText = this.add.text(20, H - 120, '', { fontSize: '16px', color: '#dddddd', lineSpacing: 4 });

    // Skill buttons (the druid's four skills, bottom right)
    this.buttons = [];
    this.hero.skills.forEach(function (key, i) {
      const x = W - 60 - (3 - i) * 100;
      const y = H - 50;
      const box = scene.add.rectangle(x, y, 90, 60, 0x444444).setStrokeStyle(2, 0xffffff).setInteractive();
      const label = makeLabel(scene, x, y, '', 16);
      box.on('pointerdown', function () { scene.playerUse(key); });
      scene.buttons.push({ key: key, box: box, label: label });
    });

    this.refresh();
    this.time.delayedCall(600, function () { scene.nextTurn(); });
  },
    this.load.setPath(ASSET_PATH);
    for (const key in SPRITE_FILES) {
      this.load.image(key, SPRITE_FILES[key]);
    }
  },

  create: function () {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W;
    this.H = H;

    // Placeholders for any missing images
    for (const key in PLACEHOLDER_COLORS) {
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(PLACEHOLDER_COLORS[key], 1);
        g.fillCircle(50, 50, 48);
        g.generateTexture(key, 100, 100);
        g.destroy();
      }
    }

    this.add.rectangle(W / 2, H / 2, W, H, 0x2b3a2b);

    // Top bar
    this.add.rectangle(W / 2, 30, W, 60, 0x000000, 0.6);
    makeLabel(this, 60, 30, 'HOME', 24);
    makeLabel(this, W / 2 - 80, 30, 'Energy 0/0', 24);
    makeLabel(this, W / 2 + 120, 30, 'Gold 0', 24);

    // 5 slots per side
    this.playerSlots = [];
    this.enemySlots = [];
    for (let i = 0; i < 5; i++) {
      const y = 140 + i * 100;
      const stagger = (i % 2) * 40;
      const px = 250 + stagger;
      const ex = W - 250 - stagger;
      makeSlot(this, px, y, 0x3366cc);
      makeSlot(this, ex, y, 0xcc3333);
      this.playerSlots.push({ x: px, y: y });
      this.enemySlots.push({ x: ex, y: y });
    }

    // Battle state
    const scene = this;
    this.battle = newBattle(function (type, unit, text) { scene.onEvent(type, unit, text); });
    this.hero = this.battle.units.find(function (u) { return u.side === 'player'; });
    this.awaitingPlayer = false;
    this.logLines = [];

    // Unit views
    this.targetRing = this.add.ellipse(0, 0, 96, 26).setStrokeStyle(3, 0xff4444).setVisible(false);
    this.views = {};
    this.battle.units.forEach(function (u) { scene.makeView(u); });
    this.target = this.battle.units.find(function (u) { return u.side === 'enemy' && u.alive; });

    // Info text
    this.turnText = makeLabel(this, W / 2, 100, '', 24);
    makeLabel(this, W / 2, 130, 'Order: ' + this.battle.order.map(function (u) { return u.name; }).join(' > '), 14);
    this.logText = this.add.text(20, H - 120, '', { fontSize: '16px', color: '#dddddd', lineSpacing: 4 });

    // Skill buttons (the druid's four skills, bottom right)
    this.buttons = [];
    this.hero.skills.forEach(function (key, i) {
      const x = W - 60 - (3 - i) * 100;
      const y = H - 50;
      const box = scene.add.rectangle(x, y, 90, 60, 0x444444).setStrokeStyle(2, 0xffffff).setInteractive();
      const label = makeLabel(scene, x, y, '', 16);
      box.on('pointerdown', function () { scene.playerUse(key); });
      scene.buttons.push({ key: key, box: box, label: label });
    });

    this.refresh();
    this.time.delayedCall(600, function () { scene.nextTurn(); });
  },

  extend: {

  makeView: function (u) {
    const scene = this;
    const slot = (u.side === 'player' ? this.playerSlots : this.enemySlots)[u.slot];
    const ring = this.add.ellipse(slot.x, slot.y + 42, 96, 26).setStrokeStyle(3, 0xffff00).setVisible(false);
    const sprite = this.add.image(slot.x, slot.y, u.sprite);
    sprite.setScale(SPRITE_HEIGHT / sprite.height);
    sprite.setFlipX(u.side === 'player' ? FLIP_PLAYER : FLIP_ENEMY);
    this.tweens.add({
      targets: sprite, y: slot.y - 6, duration: 700 + Math.random() * 300,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const hpBack = this.add.rectangle(slot.x - 30, slot.y - 62, 60, 8, 0x000000).setOrigin(0, 0.5);
    const hpFill = this.add.rectangle(slot.x - 30, slot.y - 62, 60, 8, 0x44cc44).setOrigin(0, 0.5);
    const status = this.add.text(slot.x, slot.y + 56, '', { fontSize: '14px', color: '#ffffff', align: 'center' }).setOrigin(0.5, 0);
    if (u.side === 'enemy') {
      sprite.setInteractive();
      sprite.on('pointerdown', function () { scene.selectTarget(u); });
    }
    this.views[u.id] = { slot: slot, ring: ring, sprite: sprite, hpBack: hpBack, hpFill: hpFill, status: status };
  },

  selectTarget: function (u) {
    if (!u.alive) return;
    this.target = u;
    this.refresh();
  },

  onEvent: function (type, unit, text) {
    const view = this.views[unit.id];
    this.logLines.push(unit.name + ' ' + (type === 'info' ? text : '[' + text + ']'));
    if (this.logLines.length > 5) this.logLines.shift();
    if (this.logText) this.logText.setText(this.logLines.join('\n'));
    if (type === 'info' || !view) return;
    const t = this.add.text(view.slot.x + (Math.random() * 30 - 15), view.slot.y - 30, text, {
      fontSize: '24px', color: EVENT_COLORS[type] || '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: t.y - 50, alpha: 0, duration: 1000,
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
      v.hpFill.width = Math.max(0, 60 * u.hp / u.maxHp);
      v.sprite.setAlpha(u.alive ? 1 : 0.25);
      const lines = [];
      const shield = u.effects.filter(function (e) { return e.type === 'shield'; })
        .reduce(function (n, e) { return n + e.charges; }, 0);
      if (shield > 0) lines.push('Shield x' + shield);
      if (u.ward > 0) lines.push('Ward ' + u.ward);
      u.effects.filter(function (e) { return e.type === 'dot'; })
        .forEach(function (e) { lines.push('DoT ' + e.damage + ' x' + e.charges); });
      v.status.setText(u.alive ? lines.join('\n') : '');
      v.hpFill.setFillStyle(u.hp / u.maxHp > 0.3 ? 0x44cc44 : 0xcc4444);
    });
    if (this.target) {
      const tv = this.views[this.target.id];
      this.targetRing.setPosition(tv.slot.x, tv.slot.y + 42).setVisible(true);
    } else {
      this.targetRing.setVisible(false);
    }
    this.buttons.forEach(function (b) {
      const sk = SKILLS[b.key];
      const cd = scene.hero.cd[b.key] || 0;
      const ready = scene.awaitingPlayer && cd === 0;
      b.box.setFillStyle(ready ? 0x446644 : 0x222222);
      b.label.setText(sk.name + (cd > 0 ? '\ncd ' + cd : ''));
      b.label.setColor(ready ? '#ffffff' : '#777777');
    });
  },

  nextTurn: function () {
    const scene = this;
    const u = nextActor(this.battle);
    if (!u) { this.showResult(); return; }
    this.current = u;
    for (const id in this.views) this.views[id].ring.setVisible(false);
    this.views[u.id].ring.setVisible(true);
    this.turnText.setText(u.name + "'s turn");

    if (u.side === 'player') {
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

  playerUse: function (key) {
    const scene = this;
    if (!this.awaitingPlayer || this.battle.over) return;
    if (!skillReady(this.hero, key)) return;
    const sk = SKILLS[key];
    let target = this.hero;
    if (sk.target === 'enemy') {
      target = this.target;
      if (!target || !target.alive) return;
    }
    this.awaitingPlayer = false;
    useSkill(this.battle, this.hero, key, target);
    this.refresh();
    this.time.delayedCall(700, function () { scene.finishTurn(scene.hero); });
  },

  finishTurn: function (u) {
    const scene = this;
    endTurn(this.battle, u);
    this.refresh();
    if (this.battle.over) {
      this.time.delayedCall(600, function () { scene.showResult(); });
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
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive()
      .on('pointerdown', function () { scene.scene.restart(); });
    makeLabel(this, W / 2, H / 2 - 20, this.battle.over === 'victory' ? 'VICTORY' : 'DEFEAT', 72);
    makeLabel(this, W / 2, H / 2 + 50, 'Tap to fight again', 28);
  },

  },
};

new Phaser.Game({
  type: Phaser.CANVAS,
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [battleScene],
});