// main.js: the battle SCREEN (Phaser drawing, buttons, taps) plus the game start-up (the game opens on the town, see town.js).
// The battle rules live in combatEngine.js. This file asks the engine what happened and shows it.
// Needs these files loaded first, in this order (see index.html):
//   Phaser, dataLoader.js, nodeBattle.js, town.js, combatEngine.js, (passives.js), then this file.

// ===== SETTINGS =====
const ASSET_PATH = ''; // use 'assets/' if you move the images into a folder

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

const FLIP_PLAYER = false; // set true if your heroes face the wrong way
const FLIP_ENEMY = false;  // set true if your enemies face the wrong way

// ===== IMAGE NAMES AND PRELOADING =====
// The image file for a sprite or background name
function imageFile(value) {
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

// Sprite names for every summon a row's skills can call, so the images get loaded before the battle
function summonSpritesOf(row) {
  const out = [];
  skillIdsOf(row).forEach(function (sid) {
    const key = sheetSkillKey(sid);
    if (!key || !SKILLS[key].groups) return;
    SKILLS[key].groups.forEach(function (g) {
      if (g.def.run !== 'summon') return;
      const m = mobRowFor(g.mobId);
      if (!m) { sheetWarn('Summon ID ' + (g.mobId || '(blank)') + ' is not in the Mobs tab, so ' + SKILLS[key].name + ' summons nothing'); return; }
      const s = spriteValueOf(m, false);
      if (s && out.indexOf(s) === -1) out.push(s);
    });
  });
  return out;
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

  // Runs every time the battle starts or restarts: sets up the node and the five heroes
  init: function () {
    const scene = this;
    this.problem = '';
    this.heroRows = [];
    this.nodeData = null;
    this.spriteKeys = [];

    if (typeof gearPassiveNote !== 'function') {
      this.problem = 'gearPassives.js is missing.\nUpload it, and check that index.html loads it right after passives.js.';
      return;
    }
    if (typeof openBattlePrep !== 'function') {
      this.problem = 'battlePrep.js is missing.\nUpload it, and check that index.html loads it before main.js.';
      return;
    }
    if (typeof buildPlayerParty !== 'function') {
      this.problem = 'playerGear.js is missing.\nUpload it, and check that index.html loads it before main.js.';
      return;
    }
    if (typeof takeNextFight !== 'function') {
      this.problem = 'fightRules.js is missing.\nUpload it, and check that index.html loads it before main.js.';
      return;
    }
    if (typeof buildNodeBattle !== 'function' || typeof pickRandomHeroes !== 'function') {
      this.problem = 'nodeBattle.js is missing or out of date.\nIt needs the pickRandomHeroes function (Part 3 of the loader doc).';
      return;
    }
    this.fight = takeNextFight(); // the fight being retried, or a new node and 4 new heroes
    this.heroRows = buildPlayerParty(this.fight.heroIds); // the main character plus those 4 heroes
    this.nodeData = buildNodeBattle(this.fight.nodeId);
    if (!this.nodeData) {
      this.problem = 'No nodes found.\nCheck data/Nodes.csv and that its ID column is headed Node ID.';
      return;
    }
    if (!this.heroRows.length) {
      this.problem = 'No heroes found.\nCheck data/Hero.csv.';
      return;
    }
    let mobCount = 0;
    this.nodeData.waves.forEach(function (wave) { wave.forEach(function (m) { if (m) mobCount += 1; }); });
    if (!mobCount) {
      this.problem = 'Node ' + this.nodeData.nodeId + ' has no enemies.\nCheck its Wave columns and mob IDs in data/Nodes.csv.';
      return;
    }

    // Every image this battle needs, so preload can fetch them
    const keys = {};
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
    (this.nodeData.backgrounds || [this.nodeData.background]).forEach(function (bg) {
      if (bg) scene.load.image('bg_' + bg, imageFile(bg)); // every stage's background
    });
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

    // Background for the first stage
    this.background = null; // forget the picture from the last battle
    this.showBackground(0);

    // Top bar
    this.add.rectangle(W / 2, 30, W, 60, 0x000000, 0.6);
    // HOME goes back to the town. It sits above the VICTORY / DEFEAT screen so it still works there.
    makeLabel(this, 60, 30, 'HOME', 24).setPadding(18, 14, 18, 14).setDepth(3002).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.scene.start('Town'); });
    this.nodeText = makeLabel(this, 330, 30, String(this.nodeData.name), 22);
    makeLabel(this, W / 2 - 80, 30, 'Stamina 0/0', 24);
    makeLabel(this, W / 2 + 120, 30, 'Gold 0', 24);
    this.waveText = makeLabel(this, W - 100, 30, '', 24);
    this.limitText = makeLabel(this, W - 305, 30, '', 22).setVisible(false); // turn counter, near the turn limit only
    this.resultShown = false;
    this.resultTapped = false;

    // Ground pads for the 5 character positions (summon spots stay hidden until used)
    for (let i = 0; i < PLAYER_SLOTS.length; i++) {
      const p = slotPosition('player', i);
      const e = slotPosition('enemy', i);
      makePad(this, p.x, p.y, 0x3366cc, depthScale(p.y));
      makePad(this, e.x, e.y, 0xcc3333, depthScale(e.y));
    }

    // Battle state
    const scene = this;
    seedEngine(this.fight.seed); // so a retry can repeat the same dice rolls
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
      fontSize: '16px', color: '#ffffff', backgroundColor: '#000000', padding: { x: 8, y: 6 }, lineSpacing: 4, wordWrap: { width: 270 },
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
      fontSize: '18px', color: '#ffffff', align: 'center', backgroundColor: '#000000', padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(1000).setVisible(false);
    sprite.setInteractive(this.input.makePixelPerfect(HIT_ALPHA));
    sprite.on('pointerdown', function () {
      if (u.side === 'enemy') scene.selectTarget(u);
      else scene.selectAlly(u);
    });
    const tag = u.isMainCharacter ? this.add.text(slot.x, top - 8, '\u2605 YOU', {
      fontSize: '15px', fontStyle: 'bold', color: '#ffd34d', backgroundColor: '#000000', padding: { x: 5, y: 1 },
    }).setOrigin(0.5, 1).setDepth(1002) : null;
    this.views[u.id] = {
      slot: slot, ring: ring, sprite: sprite, hpBack: hpBack, hpFill: hpFill,
      wardBack: wardBack, wardFill: wardFill, status: status, pad: pad, h: h, bw: bw, barY: top, k: k, tag: tag,
    };
  },

  // Removes a character's picture, bars and text from the screen
  destroyView: function (id) {
    const v = this.views[id];
    if (!v) return;
    this.tweens.killTweensOf(v.sprite);
    [v.sprite, v.hpBack, v.hpFill, v.wardBack, v.wardFill, v.status, v.ring, v.pad, v.tag].forEach(function (o) {
      if (o) o.destroy();
    });
    delete this.views[id];
  },

  updateWaveText: function () {
    this.waveText.setText('Stage ' + (this.battle.waveIndex + 1) + '/' + this.battle.waves.length);
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
      if (u.ward > 0) lines.push('Ward ' + show(u.ward));
      u.effects.forEach(function (e) { lines.push(effectLabel(e)); });
      v.status.setText(u.alive ? lines.join('\n') : '').setVisible(u.alive && lines.length > 0);
      if (v.tag) v.tag.setAlpha(u.alive ? 1 : 0.35);
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

  // Shows one stage's background. A stage with no picture keeps the one already on screen.
  showBackground: function (stage) {
    const list = this.nodeData.backgrounds || [this.nodeData.background];
    const key = list[stage] ? 'bg_' + list[stage] : '';
    if (!key || !this.textures.exists(key)) {
      if (stage === 0) drawBackdrop(this, this.W, this.H); // no picture at all: the plain room
      return;
    }
    const old = this.background;
    if (old && old.texture.key === key) return;
    const picture = this.add.image(this.W / 2, this.H / 2, key).setDisplaySize(this.W, this.H).setDepth(-10);
    this.background = picture;
    if (old) {
      picture.setAlpha(0); // fade the new picture in over the old one
      this.tweens.add({ targets: picture, alpha: 1, duration: 500, onComplete: function () { old.destroy(); } });
    }
  },

  // "Turn 250 / 300", shown only when the turn limit is getting close
  updateTurnCounter: function () {
    const show = showTurnCounter(this.battle);
    this.limitText.setVisible(show);
    if (!show) return;
    const n = turnNumber(this.battle);
    this.limitText.setText('Turn ' + n + ' / ' + TURN_LIMIT).setColor(n > TURN_LIMIT - 10 ? '#ff6666' : '#ffd34d');
  },

  // The wave is cleared: its defeated enemies leave and the next wave walks in
  startNextWave: function () {
    const scene = this;
    const battle = this.battle;
    battle.units.filter(function (u) { return u.side === 'enemy'; })
      .forEach(function (u) { scene.destroyView(u.id); });
    const fresh = advanceWave(battle);
    this.showBackground(battle.waveIndex);
    fresh.forEach(function (u) { scene.makeView(u); });
    this.target = fresh.find(function (u) { return u.alive; });
    this.updateWaveText();
    this.active = null;
    this.awaitingPlayer = false;
    this.refresh();
    const banner = makeLabel(this, this.W / 2, this.H / 2 - 60, 'STAGE ' + (battle.waveIndex + 1), 64).setDepth(3000);
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
    this.updateTurnCounter();
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
    if (this.resultShown) return;
    this.resultShown = true;
    this.awaitingPlayer = false;
    this.refresh();
    const W = this.W;
    const H = this.H;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(3000).setInteractive(); // stops taps reaching the battle
    makeLabel(this, W / 2, H / 2 - 70, this.battle.over === 'victory' ? 'VICTORY' : 'DEFEAT', 72).setDepth(3001);
    if (this.battle.overReason === 'turnLimit') {
      makeLabel(this, W / 2, H / 2 + 4, 'Turn limit reached (' + TURN_LIMIT + ' turns)', 28).setDepth(3001);
    }
    // Victory: New Battle (gear up, then a fresh fight). Defeat: Retry (gear up for this same fight).
    // Town: leave; the Campaign Gate then gives a new fight.
    const won = this.battle.over === 'victory';
    this.resultButton(W / 2 - 175, H / 2 + 100, won ? 'New Battle' : 'Retry', function () {
      if (won) clearRetry(); else queueRetry(scene.fight);
      openBattlePrep(scene);
    });
    this.resultButton(W / 2 + 175, H / 2 + 100, 'Town', function () { scene.scene.start('Town'); });
  },

  resultButton: function (x, y, text, onTap) {
    const scene = this;
    const box = this.add.rectangle(x, y, 300, 96, 0x7a5a1e).setStrokeStyle(3, 0xf2c66a).setDepth(3001)
      .setInteractive({ useHandCursor: true });
    makeLabel(this, x, y, text, 38).setDepth(3001).setFontStyle('bold');
    box.on('pointerdown', function () {
      if (scene.resultTapped) return; // one choice per fight, even with a double tap
      scene.resultTapped = true;
      onTap();
    });
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
    scene: [townScene, battleScene], // the first scene opens first: the town, whose Campaign Gate opens battle preparation
  });
});
