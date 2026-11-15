// ===== SETTINGS =====
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

const SPRITE_HEIGHT = 280;   // bigger number = bigger characters
const SUMMON_SCALE = 0.6;    // summons are drawn at this fraction of normal size
const HP_BAR_W = 110;        // width of the health bars
const HIT_ALPHA = 20;        // how solid a pixel must be (0-255) to count as touching a character when tapping

// Where the 5 characters stand on the PLAYER side (the enemy side is a mirror image).
// x = across the screen from the left edge, y = where the feet stand.
// Slot order: 0 = top row, 1-2 = middle row (outer, inner), 3-4 = bottom row (outer, inner).
const CHAR_SLOTS = [
  { x: 310, y: 345 },  // slot 0: top row
  { x: 190, y: 485 },  // slot 1: middle row, outer
  { x: 430, y: 485 },  // slot 2: middle row, inner
  { x: 90,  y: 625 },  // slot 3: bottom row, outer
  { x: 320, y: 625 },  // slot 4: bottom row, inner
];

// Summon spots. Hidden until a summon stands in one. A unit uses one with: spot: 'summon', slot: 0 (or 1)
const SUMMON_SLOTS = [
  { x: 510, y: 345 },
  { x: 580, y: 345 },
];

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
      maxHp: u.hp, ward: 0, wardMax: 0, effects: [], cd: {}, alive: true,
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
  unit.wardMax = 0;
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
    if (sk.pool > target.ward) { target.ward = sk.pool; target.wardMax = sk.pool; }
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

// Position of a character slot (or a summon spot). The enemy side mirrors the player side.
function slotPosition(side, i, W, spot) {
  const p = (spot === 'summon' ? SUMMON_SLOTS : CHAR_SLOTS)[i];
  return { x: side === 'player' ? p.x : W - p.x, y: p.y };
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

    // Placeholder figures for any missing images
    for (const key in PLACEHOLDER_COLORS) {
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(PLACEHOLDER_COLORS[key], 1);
        g.fillRoundedRect(32, 2, 36, 96, 16);
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

    // Ground pads for the 5 character positions (summon spots stay hidden until used)
    for (let i = 0; i < CHAR_SLOTS.length; i++) {
      const p = slotPosition('player', i, W);
      const e = slotPosition('enemy', i, W);
      makePad(this, p.x, p.y, 0x3366cc);
      makePad(this, e.x, e.y, 0xcc3333);
    }

    // Battle state
    const scene = this;
    this.battle = newBattle(function (type, unit, text) { scene.onEvent(type, unit, text); });
    this.hero = this.battle.units.find(function (u) { return u.side === 'player'; });
    this.awaitingPlayer = false;
    this.logLines = [];

    // Unit views
    this.targetRing = this.add.ellipse(0, 0, 170, 44).setStrokeStyle(3, 0xff4444).setVisible(false);
    this.targetMarker = this.add.triangle(0, 0, 0, 0, 30, 0, 15, 24, 0xff4444)
      .setStrokeStyle(3, 0xffffff).setDepth(2000).setVisible(false);
    this.views = {};
    this.battle.units.forEach(function (u) { scene.makeView(u); });
    this.target = this.battle.units.find(function (u) { return u.side === 'enemy' && u.alive; });

    // Info text
    this.turnText = makeLabel(this, W / 2, 100, '', 24).setDepth(1500);
    makeLabel(this, W / 2, 130, 'Order: ' + this.battle.order.map(function (u) { return u.name; }).join(' > '), 14).setDepth(1500);
    this.logText = this.add.text(W / 2 - 160, H - 120, '', {
      fontSize: '16px', color: '#dddddd', lineSpacing: 4, wordWrap: { width: 320 },
    }).setDepth(1500);

    // Skill buttons (the druid's four skills, bottom right)
    this.buttons = [];
    this.hero.skills.forEach(function (key, i) {
      const x = W - 60 - (3 - i) * 100;
      const y = H - 50;
      const box = scene.add.rectangle(x, y, 90, 60, 0x444444).setStrokeStyle(2, 0xffffff).setDepth(1500).setInteractive();
      const label = makeLabel(scene, x, y, '', 16).setDepth(1501);
      box.on('pointerdown', function () { scene.playerUse(key); });
      scene.buttons.push({ key: key, box: box, label: label });
    });

    this.refresh();
    this.time.delayedCall(600, function () { scene.nextTurn(); });
  },

  extend: {

  makeView: function (u) {
    const scene = this;
    const isSummon = u.spot === 'summon';
    const k = isSummon ? SUMMON_SCALE : 1;
    const h = SPRITE_HEIGHT * k;
    const bw = HP_BAR_W * k;
    const slot = slotPosition(u.side, u.slot, this.W, u.spot);
    let pad = null;
    if (isSummon) pad = makePad(this, slot.x, slot.y, u.side === 'player' ? 0x3366cc : 0xcc3333, k);
    const ring = this.add.ellipse(slot.x, slot.y - 4, 170 * k, 44 * k)
      .setStrokeStyle(3, 0xffff00).setVisible(false).setDepth(slot.y + 1);
    const sprite = this.add.image(slot.x, slot.y, u.sprite).setOrigin(0.5, 1).setDepth(slot.y);
    sprite.setScale(h / sprite.height);
    sprite.setFlipX(u.side === 'player' ? FLIP_PLAYER : FLIP_ENEMY);
    this.tweens.add({
      targets: sprite, y: slot.y - 8, duration: 700 + Math.random() * 300,
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
    if (u.side === 'enemy') {
      sprite.setInteractive(this.input.makePixelPerfect(HIT_ALPHA));
      sprite.on('pointerdown', function () { scene.selectTarget(u); });
    }
    this.views[u.id] = {
      slot: slot, ring: ring, sprite: sprite, hpBack: hpBack, hpFill: hpFill,
      wardBack: wardBack, wardFill: wardFill, status: status, pad: pad, h: h, bw: bw, barY: top,
    };
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
      v.hpFill.width = Math.max(0, v.bw * u.hp / u.maxHp);
      const showWard = u.alive && u.ward > 0;
      v.wardBack.setVisible(showWard);
      v.wardFill.setVisible(showWard);
      if (showWard) v.wardFill.width = v.bw * Math.min(1, u.ward / Math.max(u.wardMax, u.ward));
      v.sprite.setAlpha(u.alive ? 1 : 0.25);
      if (v.pad) v.pad.setVisible(u.alive);
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
      this.targetRing.setPosition(tv.slot.x, tv.slot.y - 4).setDepth(tv.slot.y + 2).setVisible(true);
      this.targetMarker.setPosition(tv.slot.x, Math.max(68, tv.barY - 26)).setVisible(true);
    } else {
      this.targetRing.setVisible(false);
      this.targetMarker.setVisible(false);
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
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(3000).setInteractive()
      .on('pointerdown', function () { scene.scene.restart(); });
    makeLabel(this, W / 2, H / 2 - 20, this.battle.over === 'victory' ? 'VICTORY' : 'DEFEAT', 72).setDepth(3001);
    makeLabel(this, W / 2, H / 2 + 50, 'Tap to fight again', 28).setDepth(3001);
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
