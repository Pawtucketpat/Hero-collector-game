// town.js - Town hub for the Hero Collector prototype.
//
// Three screens (Adventure District / Town Center / Town Hall) with arrows to turn left and right,
// tappable landmarks read from assets/town/town_hits.json, and the Campaign Gate that opens the
// battle prototype. Plain-object scene config like main.js (no classes).
//
// Load this file BEFORE main.js and put townScene first in the game's scene list.

const TOWN_BATTLE_SCENE_KEY = 'Battle';   // key of the battle scene in main.js
const TOWN_START_SCREEN = 'town_center';  // screen shown when the town opens
const TOWN_DEBUG = false;                 // true = draw every tap area outline

const TOWN_IMG_W = 2560;                  // the art is 2560x1440; tap areas use these coordinates
const TOWN_IMG_H = 1440;

// Which screen each arrow leads to
const TOWN_LAYOUT = {
  adventure_district: { right: 'town_center' },
  town_center:        { left: 'adventure_district', right: 'town_hall' },
  town_hall:          { left: 'town_center' },
};
const TOWN_TITLES = {
  adventure_district: 'Adventure District',
  town_center: 'Town Center',
  town_hall: 'Town Hall',
};

// What happens when a landmark is tapped. Anything not listed flashes and says "coming soon".
const TOWN_ACTIONS = {
  campaign_gate: function (scene) { townGo(scene, TOWN_BATTLE_SCENE_KEY); },
};

const townScene = {
  key: 'Town',

  preload: function () {
    Object.keys(TOWN_TITLES).forEach((id) => {
      this.load.image('town_' + id, 'assets/town/' + id + '.jpg');
    });
    this.load.json('town_hits', 'assets/town/town_hits.json');
  },

  create: function () {
    const t = (this.town = { current: null, busy: false, polys: {}, lastHit: null });
    t.screens = this.cache.json.get('town_hits').screens;

    this.cameras.main.setBackgroundColor('#0b0a0c');
    t.image = this.add.image(0, 0, 'town_' + TOWN_START_SCREEN).setOrigin(0, 0).setDepth(0);
    t.ui = this.add.graphics().setDepth(10);
    t.debug = this.add.graphics().setDepth(11);
    const label = { fontFamily: 'Georgia, serif', color: '#f3e6c4', stroke: '#000000' };
    t.leftLabel = this.add.text(0, 0, '', label).setOrigin(0.5, 0).setDepth(10);
    t.rightLabel = this.add.text(0, 0, '', label).setOrigin(0.5, 0).setDepth(10);

    townLayout(this);
    townShow(this, TOWN_START_SCREEN, true);

    this.input.on('pointerup', (pointer) => townTap(this, pointer));
    const onResize = () => townLayout(this);
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  },
};

// ---------------------------------------------------------------------------------------------

// Fit the picture to the screen (no cropping) and rebuild everything that depends on the size.
function townLayout(scene) {
  const t = scene.town;
  const W = scene.scale.width, H = scene.scale.height;
  t.s = Math.min(W / TOWN_IMG_W, H / TOWN_IMG_H);
  t.ox = (W - TOWN_IMG_W * t.s) / 2;
  t.oy = (H - TOWN_IMG_H * t.s) / 2;
  t.k = Math.min(W, H) / 720;                      // UI scale: 1 at 720 tall
  t.image.setPosition(t.ox, t.oy).setDisplaySize(TOWN_IMG_W * t.s, TOWN_IMG_H * t.s);

  // tap areas in screen coordinates
  t.polys = {};
  Object.keys(t.screens).forEach((sid) => {
    t.polys[sid] = {};
    t.screens[sid].hits.forEach((h) => {
      t.polys[sid][h.id] = h.polygons_px.map((pts) => {
        const flat = [];
        pts.forEach((p) => { flat.push(t.ox + p[0] * t.s, t.oy + p[1] * t.s); });
        return new Phaser.Geom.Polygon(flat);
      });
    });
  });

  const fs = Math.round(17 * t.k);
  [t.leftLabel, t.rightLabel].forEach((l) => l.setFontSize(fs + 'px').setStroke('#000000', Math.round(4 * t.k)));
  t.arrow = {
    left:  { x: 46 * t.k,     y: H / 2, r: 34 * t.k },
    right: { x: W - 46 * t.k, y: H / 2, r: 34 * t.k },
  };
  townDrawUi(scene);
}

function townDrawUi(scene) {
  const t = scene.town;
  if (!t.current) return;
  const g = t.ui;
  g.clear();
  const nav = TOWN_LAYOUT[t.current];
  ['left', 'right'].forEach((side) => {
    const label = side === 'left' ? t.leftLabel : t.rightLabel;
    const target = nav[side];
    label.setVisible(!!target);
    if (!target) return;
    const a = t.arrow[side], r = a.r, dir = side === 'left' ? -1 : 1;
    g.fillStyle(0x0b0a0c, 0.62); g.fillCircle(a.x, a.y, r);
    g.lineStyle(Math.max(2, 3 * t.k), 0xd9b66a, 0.95); g.strokeCircle(a.x, a.y, r);
    g.lineStyle(Math.max(3, 6 * t.k), 0xf3e6c4, 1);
    const cx = a.x - dir * 6 * t.k, h = 15 * t.k, w = 14 * t.k;   // chevron pointing outward
    g.beginPath();
    g.moveTo(cx - dir * w * 0.5, a.y - h);
    g.lineTo(cx + dir * w * 0.7, a.y);
    g.lineTo(cx - dir * w * 0.5, a.y + h);
    g.strokePath();
    // label sits under the arrow, kept fully on screen
    const W = scene.scale.width, ly = a.y + r + 6 * t.k;
    label.setText(TOWN_TITLES[target]).setOrigin(side === 'left' ? 0 : 1, 0)
      .setPosition(side === 'left' ? 8 * t.k : W - 8 * t.k, ly);
  });

  t.debug.clear();
  if (TOWN_DEBUG) {
    t.debug.lineStyle(2, 0x66ffcc, 0.9);
    Object.keys(t.polys[t.current]).forEach((id) => {
      t.polys[t.current][id].forEach((poly) => t.debug.strokePoints(poly.points, true));
    });
  }
}

// Switch screens with a quick fade.
function townShow(scene, id, instant) {
  const t = scene.town;
  const apply = () => { t.current = id; t.image.setTexture('town_' + id); townDrawUi(scene); };
  if (instant) { apply(); return; }
  t.busy = true;
  const cam = scene.cameras.main;
  cam.fadeOut(170, 0, 0, 0);
  cam.once('camerafadeoutcomplete', () => {
    apply();
    cam.fadeIn(170, 0, 0, 0);
    cam.once('camerafadeincomplete', () => { t.busy = false; });
  });
}

// Leave the town for another scene (the battle) with a fade.
function townGo(scene, key) {
  const t = scene.town;
  t.busy = true;
  const cam = scene.cameras.main;
  cam.fadeOut(260, 0, 0, 0);
  cam.once('camerafadeoutcomplete', () => { scene.scene.start(key); });
}

function townTap(scene, pointer) {
  const t = scene.town;
  if (t.busy) return;
  // ignore drags and long presses
  if (Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.x, pointer.y) > 16 * t.k) return;
  if (pointer.upTime - pointer.downTime > 700) return;
  const x = pointer.x, y = pointer.y;

  // arrows first (a little bigger than they look, easier on a thumb)
  const nav = TOWN_LAYOUT[t.current];
  for (const side of ['left', 'right']) {
    const a = t.arrow[side];
    if (nav[side] && Phaser.Math.Distance.Between(x, y, a.x, a.y) <= a.r * 1.4) {
      townShow(scene, nav[side]);
      return;
    }
  }

  // landmarks: highest z wins where tap areas overlap
  const hits = t.screens[t.current].hits.slice().sort((p, q) => q.z - p.z);
  for (const h of hits) {
    if (t.polys[t.current][h.id].some((poly) => poly.contains(x, y))) {
      townLandmark(scene, h);
      return;
    }
  }
}

function townLandmark(scene, h) {
  const t = scene.town;
  t.lastHit = h.id;
  townFlash(scene, h);
  const action = TOWN_ACTIONS[h.id];
  if (action) action(scene, h);
  else townToast(scene, h.name + ' - coming soon');
}

function townFlash(scene, h) {
  const t = scene.town;
  const g = scene.add.graphics().setDepth(5);
  t.polys[t.current][h.id].forEach((poly) => {
    g.fillStyle(0xffe2a0, 0.32); g.fillPoints(poly.points, true);
    g.lineStyle(Math.max(2, 3 * t.k), 0xffd98a, 0.95); g.strokePoints(poly.points, true);
  });
  scene.tweens.add({ targets: g, alpha: 0, duration: 520, onComplete: () => g.destroy() });
}

function townToast(scene, msg) {
  const t = scene.town;
  if (t.toast) t.toast.destroy();
  const W = scene.scale.width, H = scene.scale.height;
  t.toast = scene.add.text(W / 2, H - 56 * t.k, msg, {
    fontFamily: 'Georgia, serif', fontSize: Math.round(26 * t.k) + 'px',
    color: '#f3e6c4', stroke: '#000000', strokeThickness: Math.round(5 * t.k),
  }).setOrigin(0.5).setDepth(20);
  scene.tweens.add({ targets: t.toast, alpha: 0, delay: 900, duration: 500 });
}
