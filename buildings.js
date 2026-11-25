// buildings.js - Placeholder interiors for every town building: the shared screen kit and the town hookup.
//
// Load order in index.html (after town.js, before main.js):
//   buildings.js, buildingsCenter.js, buildingsHall.js, buildingsAdventure.js
//
// These are UI placeholders. Buttons move things around on screen so you can try the layout,
// but nothing is saved and all numbers marked as sample are made up for looks.
// Plain objects like main.js and town.js (no classes).
//
// ADDING ART LATER (no code changes needed):
//   assets/interiors/<id>.jpg           full screen background, 1280 x 720
//   assets/interiors/<id>_feature.png   the large art box on that screen (character, boss, room detail)
// <id> is the building id, for example inn, armory, blacksmith or endless_tower.

const BLD_ART_FOLDER = 'assets/interiors/';
const BLD_SHOW_TAGS = true;      // amber tags on parts that are ideas or not decided. false hides them.

// ===== LOOK =====
const BLD_C = {
  bg: 0x0f0d12, panel: 0x19151d, card: 0x262029, cardHi: 0x352b24,
  line: 0x6b5836, gold: 0xd9b66a, btn: 0x3b3022, btnMain: 0x84591c, btnBad: 0x5c2323,
  off: 0x29282e, offLine: 0x4f4d57, good: 0x4f9e58, bad: 0xb04545, blue: 0x3f7fc4, amber: 0xc98a1e,
};
const BLD_T = { main: '#ece3cf', dim: '#a89f90', gold: '#f0cf82', off: '#77737f', good: '#7fd18a', bad: '#ef8a8a', amber: '#ffc861' };
const BLD_BODY = 'Arial, Helvetica, sans-serif';
const BLD_TITLE = 'Georgia, serif';

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical'];
const RARITY_COLOR = [0x9d9d9d, 0x4faf5c, 0x3f86d8, 0x9a58d6, 0xe39524, 0xd83a50];
const RARITY_TEXT = ['#c4c4c4', '#7fd18a', '#7db7ff', '#c797f2', '#ffbe55', '#ff7a8c'];

// Sample wallet shown in the top bar
const BLD_WALLET = {
  gold: ['Gold', '12,450', 0xe8c04a], gems: ['Gems', '320', 0x58c7e8], stamina: ['Stamina', '180 / 250', 0x6fd06f],
  stone: ['Stone', '864', 0x9a9a9a], wood: ['Wood', '540', 0xa8713d], dust: ['Crystal Dust', '210', 0xb784f0],
};

// ===== SAMPLE HEROES (taken from your hero roster, H0010 and up) =====
function bldHero(id, name, cls, species, traits, stats, spd, skills, level, stars) {
  return { id: id, name: name, cls: cls, species: species, traits: traits, stats: stats, spd: spd, skills: skills, level: level, stars: stars };
}
const BLD_HEROES = [
  bldHero('H0010', 'Brannoch Ironwall', 'Guardian', 'Dwarf', ['Stalwart', 'Hardy', 'Honorable'], [8, 3, 3, 5, 14], 2, ['Slam', 'Bulwark Stance', 'Hold the Line'], 12, 3),
  bldHero('H0015', 'Seraphine Vale', 'Paladin', 'Human', ['Gentle', 'Devout', 'Charming'], [6, 3, 5, 10, 10], 3, ['Radiant Strike', 'Mending Light', 'Guardian Angel'], 11, 2),
  bldHero('H0017', 'Brakka Skullsplitter', 'Barbarian', 'Orc', ['Brawny', 'Fearless', 'Ruthless'], [12, 5, 2, 3, 12], 5, ['Slash', 'Rending Strike', 'Berserk Howl'], 10, 2),
  bldHero('H0020', 'Wen Liu', 'Monk', 'Human', ['Nimble', 'Honorable', 'Mystic'], [6, 10, 3, 5, 10], 6, ['Quick Palms', 'Nerve Strike', 'Flowing Stance'], 9, 2),
  bldHero('H0023', 'Vesper Nightshade', 'Assassin', 'Elf', ['Sneaky', 'Cunning', 'Nimble'], [4, 11, 4, 5, 9], 8, ['Kidney Shot', 'Venomous Blade', 'Shadowstep Strike'], 12, 3),
  bldHero('H0027', 'Elowen Swiftbow', 'Ranger', 'Elf', ['Keen-Eyed', 'Nimble', 'Wild'], [4, 11, 4, 6, 8], 7, ['Release Arrow', 'Piercing Shot', 'Eagle Eye'], 8, 1),
  bldHero('H0030', 'Lysander Silverlute', 'Bard', 'Human', ['Charming', 'Dashing', 'Scholarly'], [4, 8, 9, 5, 7], 6, ['Harmonious Strike', 'Rousing Anthem', 'Cutting Jibe'], 7, 1),
  bldHero('H0033', 'Idris Brightwater', 'Cleric', 'Human', ['Gentle', 'Devout', 'Charming'], [3, 3, 6, 12, 10], 4, ['Radiant Strike', 'Prayer of Renewal', 'Sanctuary'], 12, 3),
  bldHero('H0036', 'Malachar Gravewhisper', 'Necromancer', 'Human', ['Cursed', 'Scholarly', 'Cunning'], [3, 4, 11, 7, 8], 3, ['Death Bolt', 'Soul Rot', 'Harvest of Souls'], 6, 1),
  bldHero('H0039', 'Taka Spiritwalker', 'Shaman', 'Beastkin', ['Mystic', 'Wild', 'Gentle'], [4, 5, 6, 10, 9], 5, ['Spirit Strike', 'Ancestral Ward', 'Stoneward Chant'], 9, 2),
  bldHero('H0042', 'Fennel Greenbriar', 'Druid', 'Halfling', ['Gentle', 'Wild', 'Resourceful'], [3, 5, 6, 11, 9], 4, ['Natures Wrath', 'Rejuvenating Rain', 'Entangling Roots'], 4, 1),
  bldHero('H0045', 'Pyra Emberheart', 'Elementalist', 'Ashborn', ['Fiery', 'Arcane', 'Dashing'], [3, 5, 12, 6, 8], 5, ['Elemental Blast', 'Inferno', 'Flame Wall'], 11, 2),
  bldHero('H0048', 'Vael Stormwright', 'Stormcaller', 'Human', ['Dashing', 'Arcane', 'Fearless'], [3, 6, 12, 4, 9], 6, ['Lightning Bolt', 'Overcharge', 'Thunder Spear'], 5, 1),
  bldHero('H0051', 'Cornelius Quillfeather', 'Wizard', 'Gnome', ['Scholarly', 'Arcane', 'Mischievous'], [2, 4, 13, 7, 8], 3, ['Arcane Bolt', 'Arcane Missiles', 'Mana Shield'], 5, 1),
  bldHero('H0054', 'Odo Bubblecauldron', 'Alchemist', 'Gnome', ['Tinkerer', 'Resourceful', 'Scholarly'], [3, 5, 10, 6, 9], 4, ['Acid Flask', 'Healing Draught', 'Volatile Mixture'], 3, 1),
  bldHero('H0057', 'Xandria Hexweaver', 'Warlock', 'Human', ['Cursed', 'Cunning', 'Arcane'], [3, 4, 12, 7, 8], 4, ['Dark Curse', 'Curse of Frailty', 'Pact of Shadows'], 6, 1),
  bldHero('H0012', 'Gorm Thornback', 'Guardian', 'Orc', ['Brawny', 'Fearless', 'Hardy'], [9, 4, 2, 3, 14], 3, ['Slam', 'Barbed Plate', 'Intimidating Bellow'], 3, 1),
  bldHero('H0024', 'Dax Quickfinger', 'Assassin', 'Goblin', ['Sneaky', 'Mischievous', 'Resourceful'], [4, 11, 4, 4, 9], 8, ['Quick Cut', 'Pickpocket', 'Dirty Trick'], 2, 1),
  bldHero('H0019', 'Dunkel Ironjaw', 'Barbarian', 'Orc', ['Brawny', 'Ruthless', 'Hardy'], [13, 3, 2, 2, 13], 4, ['Slam', 'Skull Crusher', 'Unbreakable Rage'], 2, 1),
  bldHero('H0044', 'Zephyra Windwhisper', 'Druid', 'Fae', ['Nimble', 'Wild', 'Mystic'], [3, 8, 6, 10, 7], 6, ['Wind Blade', 'Cyclone', 'Tailwind'], 4, 1),
];

function bldHeroById(id) { return BLD_HEROES.filter((h) => h.id === id)[0]; }
function bldShort(h) { return h.name.split(' ')[0]; }
function bldInitials(h) { return h.name.split(' ').map((w) => w[0]).join('').slice(0, 2); }

// Who is working where (sample). A hero with a job is not available for anything else.
const BLD_JOBS = {
  'mine.dig': ['H0012'], 'mine.vein0': ['H0019'], 'farm.crop': ['H0042'], 'farm.forage': ['H0044'],
  'lumber.wood0': ['H0024'], 'alchemist.track': ['H0054'],
};
// Heroes who are away on expeditions (sample)
const BLD_AWAY = [
  { name: 'Escort the Caravan', length: '2 hours', left: '1h 12m left', done: 0.4, team: ['H0027', 'H0030', 'H0015', 'H0020'] },
  { name: 'Errand to the Mill', length: '10 minutes', left: 'Finished', done: 1, team: ['H0051'] },
];

const BLD_JOB_NAMES = { mine: 'Mine', farm: 'Farm', lumber: 'Lumber Mill', alchemist: 'Alchemist' };

// '' when the hero is free, otherwise where they are
function bldHeroBusy(id) {
  for (const key in BLD_JOBS) {
    if (BLD_JOBS[key].indexOf(id) !== -1) return BLD_JOB_NAMES[key.split('.')[0]];
  }
  if (BLD_AWAY.some((e) => e.team.indexOf(id) !== -1)) return 'Expedition';
  return '';
}

// ===== THE LIST OF BUILDINGS =====
// Filled in by buildingsCenter.js, buildingsHall.js and buildingsAdventure.js.
// Each entry: { title, area, money: [], tabs: [], art, init(), draw(ui, state, tabIndex) }
const BUILDINGS = {};
const BLD_STATE = {};      // what you tapped on each screen, kept until the page is reloaded
const BLD_ART_TRIED = {};  // art files already looked for

function bldState(id) {
  if (!BLD_STATE[id]) {
    BLD_STATE[id] = Object.assign({ tab: 0, scroll: {}, modal: null }, BUILDINGS[id].init ? BUILDINGS[id].init() : {});
  }
  return BLD_STATE[id];
}

// =============================================================================================
// THE SCREEN KIT
// A screen is redrawn from scratch after every tap. Screens only call the ui.* helpers below.
// =============================================================================================

function bldMakeUI(scene) {
  const ctx = scene.bld;
  const ui = { scene: scene, id: scene.bldId, W: 1280, H: 720 };

  function add(obj) {
    if (ctx.layer) ctx.layer.add(obj);
    else ctx.objs.push(obj);
    return obj;
  }

  ui.rect = function (x, y, w, h, o) {
    o = o || {};
    const g = scene.add.graphics();
    const r = o.r === undefined ? 8 : o.r;
    if (o.fill !== undefined && o.fill !== null) {
      g.fillStyle(o.fill, o.alpha === undefined ? 1 : o.alpha);
      if (r) g.fillRoundedRect(x, y, w, h, r); else g.fillRect(x, y, w, h);
    }
    if (o.stroke !== undefined) {
      g.lineStyle(o.sw || 2, o.stroke, o.sa === undefined ? 1 : o.sa);
      if (r) g.strokeRoundedRect(x, y, w, h, r); else g.strokeRect(x, y, w, h);
    }
    return add(g);
  };

  // o: size, color, bold, title (serif font), ox, oy (0 to 1), wrap (width), align, fit (max width), lines (max lines)
  ui.text = function (x, y, str, o) {
    o = o || {};
    const style = {
      fontFamily: o.title ? BLD_TITLE : BLD_BODY, fontSize: (o.size || 20) + 'px',
      color: o.color || BLD_T.main, fontStyle: o.bold ? 'bold' : 'normal',
      align: o.align || 'left', lineSpacing: o.gap === undefined ? 3 : o.gap,
    };
    if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: false };
    if (o.lines) style.maxLines = o.lines;
    const t = scene.add.text(x, y, String(str), style).setOrigin(o.ox || 0, o.oy || 0);
    if (o.fit) {
      let size = o.size || 20;
      while (t.width > o.fit && size > 14) { size -= 1; t.setFontSize(size + 'px'); }
      let s = String(str);
      while (t.width > o.fit && s.length > 1) { s = s.slice(0, -1); t.setText(s.trim() + '…'); }
    }
    return add(t);
  };

  ui.tap = function (x, y, w, h, fn) {
    ctx.hits.push({ x: x, y: y, w: w, h: h, fn: fn, scroller: ctx.scroller });
  };

  // A titled box. Returns the space inside it.
  ui.panel = function (x, y, w, h, title, right) {
    ui.rect(x, y, w, h, { fill: BLD_C.panel, alpha: 0.94, stroke: BLD_C.line, r: 10 });
    let top = y + 10;
    if (title) {
      const room = w > 700 ? 420 : 170;
      ui.text(x + 14, y + 10, title, { size: 23, title: true, color: BLD_T.gold, fit: w - (right ? room + 20 : 28) });
      if (right) ui.text(x + w - 14, y + 14, right, { size: 18, color: BLD_T.dim, ox: 1, fit: room });
      top = y + 46;
    }
    return { x: x + 12, y: top, w: w - 24, h: y + h - top - 10 };
  };

  ui.card = function (x, y, w, h, o) {
    o = o || {};
    ui.rect(x, y, w, h, {
      fill: o.selected ? BLD_C.cardHi : (o.fill === undefined ? BLD_C.card : o.fill),
      stroke: o.selected ? BLD_C.gold : (o.stroke === undefined ? 0x4a404f : o.stroke), sw: o.selected ? 3 : 2,
    });
    if (o.stripe !== undefined) ui.rect(x + 4, y + 6, 6, h - 12, { fill: o.stripe, r: 2 });
    if (o.onTap) ui.tap(x, y, w, h, o.onTap);
  };

  // kind: 'main' (the big action), 'bad' (permanent), 'off' (greyed out), or leave it out
  ui.button = function (x, y, w, h, label, fn, o) {
    o = o || {};
    const off = o.kind === 'off';
    const fill = off ? BLD_C.off : o.kind === 'main' ? BLD_C.btnMain : o.kind === 'bad' ? BLD_C.btnBad : BLD_C.btn;
    ui.rect(x, y, w, h, { fill: fill, stroke: off ? BLD_C.offLine : BLD_C.gold, sw: 2 });
    ui.text(x + w / 2, y + h / 2, label, {
      size: o.size || 20, bold: true, color: off ? BLD_T.off : '#fff1d2', ox: 0.5, oy: 0.5, fit: w - 12, align: 'center',
    });
    ui.tap(x, y, w, h, function () {
      if (off) ui.toast(o.why || 'Not available yet');
      else if (fn) fn();
      else ui.todo(label);
    });
  };

  // A labelled box where art will go. feature: true uses assets/interiors/<id>_feature.png when it exists.
  ui.art = function (x, y, w, h, label, o) {
    o = o || {};
    const key = 'bld_feat_' + ui.id;
    if (o.feature && scene.textures.exists(key)) {
      const img = scene.add.image(x + w / 2, y + h / 2, key);
      img.setScale(Math.min(w / img.width, h / img.height));
      add(img);
      return;
    }
    ui.rect(x, y, w, h, { fill: 0x121017, alpha: 0.9, r: 4 });
    const g = scene.add.graphics();
    g.lineStyle(2, 0x6f6677, 0.9);
    for (let i = 0; i < w; i += 16) {
      g.lineBetween(x + i, y, x + Math.min(i + 9, w), y);
      g.lineBetween(x + i, y + h, x + Math.min(i + 9, w), y + h);
    }
    for (let j = 0; j < h; j += 16) {
      g.lineBetween(x, y + j, x, y + Math.min(j + 9, h));
      g.lineBetween(x + w, y + j, x + w, y + Math.min(j + 9, h));
    }
    if (w > 90 && h > 60) { g.lineStyle(1, 0x3c3642, 0.8); g.lineBetween(x, y, x + w, y + h); g.lineBetween(x + w, y, x, y + h); }
    add(g);
    if (label) {
      ui.text(x + w / 2, y + h / 2, label, {
        size: o.size || (w > 200 ? 20 : 15), color: '#bdb3c6', bold: true, ox: 0.5, oy: 0.5, align: 'center', wrap: w - 8,
      });
    }
  };

  // A square slot: gear, worker, crystal and so on
  ui.slot = function (x, y, size, o) {
    o = o || {};
    ui.rect(x, y, size, size, {
      fill: o.locked ? 0x1b1a1f : o.filled ? 0x332a22 : 0x141218,
      stroke: o.selected ? BLD_C.gold : o.rarity !== undefined ? RARITY_COLOR[o.rarity] : o.locked ? 0x3a3840 : 0x716478,
      sw: o.selected ? 4 : 2, r: 6,
    });
    if (o.icon) {
      ui.text(x + size / 2, y + size / 2 - (o.label ? 9 : 0), o.icon, {
        size: Math.round(size * 0.36), bold: true, ox: 0.5, oy: 0.5, color: o.locked ? BLD_T.off : o.filled ? BLD_T.gold : '#8f8599',
      });
    }
    if (o.label) {
      ui.text(x + size / 2, y + size - 4, o.label, {
        size: 14, ox: 0.5, oy: 1, fit: size - 4, color: o.locked ? BLD_T.off : o.filled ? BLD_T.main : BLD_T.dim,
      });
    }
    if (o.onTap) ui.tap(x, y, size, size, o.onTap);
  };

  ui.bar = function (x, y, w, h, frac, color, label) {
    ui.rect(x, y, w, h, { fill: 0x0c0b0f, stroke: 0x4a404f, sw: 1, r: 4 });
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) ui.rect(x + 2, y + 2, (w - 4) * f, h - 4, { fill: color || BLD_C.blue, r: 3 });
    if (label) ui.text(x + w / 2, y + h / 2, label, { size: Math.min(18, h - 4), ox: 0.5, oy: 0.5, bold: true, fit: w - 8 });
  };

  ui.pips = function (x, y, done, total) {
    for (let i = 0; i < total; i++) ui.rect(x + i * 24, y, 18, 18, { fill: i < done ? BLD_C.gold : 0x100e13, stroke: BLD_C.line, r: 9 });
  };

  // A small pill. Returns its width so chips can sit side by side.
  ui.chip = function (x, y, label, o) {
    o = o || {};
    const h = o.h || 34;
    const size = o.size || 17;
    const probe = scene.add.text(0, 0, label, { fontFamily: BLD_BODY, fontSize: size + 'px', fontStyle: 'bold' });
    const w = o.w || Math.ceil(probe.width) + 22;
    probe.destroy();
    ui.rect(x, y, w, h, { fill: o.on ? BLD_C.btnMain : o.fill === undefined ? 0x221d27 : o.fill, stroke: o.on ? BLD_C.gold : o.stroke === undefined ? 0x5a4f62 : o.stroke, r: h / 2 });
    ui.text(x + w / 2, y + h / 2, label, { size: size, bold: true, ox: 0.5, oy: 0.5, color: o.color || BLD_T.main, fit: w - 8 });
    if (o.onTap) ui.tap(x, y, w, h, o.onTap);
    return w;
  };

  // A row of chips where one is picked. state[key] holds the picked number.
  ui.choice = function (x, y, labels, state, key, o) {
    o = o || {};
    let cx = x;
    labels.forEach(function (label, i) {
      cx += ui.chip(cx, y, label, { on: state[key] === i, w: o.w, h: o.h, size: o.size, onTap: function () { state[key] = i; ui.refresh(); } }) + 8;
    });
    return cx;
  };

  // Amber tag for anything that is an idea or not decided
  ui.tag = function (x, y, label, o) {
    if (!BLD_SHOW_TAGS) return 0;
    o = o || {};
    const t = scene.add.text(0, 0, label, { fontFamily: BLD_BODY, fontSize: '14px', fontStyle: 'bold' });
    const w = Math.ceil(t.width) + 14;
    t.destroy();
    const lx = o.right ? x - w : x;
    ui.rect(lx, y, w, 22, { fill: 0x3a2a08, stroke: BLD_C.amber, sw: 1, r: 4 });
    ui.text(lx + w / 2, y + 11, label, { size: 14, bold: true, color: BLD_T.amber, ox: 0.5, oy: 0.5 });
    return w;
  };

  // A drag-to-scroll window. height = how tall the contents are. draw() uses normal screen positions.
  ui.scroll = function (key, x, y, w, h, height, draw) {
    const state = bldState(ui.id);
    const max = Math.max(0, height - h);
    const offset = Math.max(0, Math.min(max, state.scroll[key] || 0));
    state.scroll[key] = offset;
    const box = scene.add.container(0, -offset);
    add(box);
    const shape = scene.make.graphics({}, false);
    shape.fillStyle(0xffffff); shape.fillRect(x - 3, y - 3, w + 6, h + 6);
    box.setMask(shape.createGeometryMask());
    ctx.masks.push(shape);
    const sc = { key: key, x: x, y: y, w: w, h: h, max: max, box: box, bar: null, state: state };
    const keepLayer = ctx.layer, keepScroll = ctx.scroller;
    ctx.layer = box; ctx.scroller = sc;
    draw();
    ctx.layer = keepLayer; ctx.scroller = keepScroll;
    if (max > 0) { sc.bar = scene.add.graphics(); add(sc.bar); bldDrawBar(sc); }
    ctx.scrollers.push(sc);
  };

  // A scrolling list of equal rows
  ui.list = function (key, area, items, rowH, drawRow) {
    ui.scroll(key, area.x, area.y, area.w, area.h, items.length * rowH, function () {
      items.forEach(function (item, i) { drawRow(item, area.x, area.y + i * rowH, area.w - 10, rowH - 8, i); });
    });
  };

  // A scrolling grid
  ui.grid = function (key, area, items, cols, cellH, drawCell, gap) {
    const g = gap === undefined ? 10 : gap;
    const cw = (area.w - 10 - g * (cols - 1)) / cols;
    const rows = Math.ceil(items.length / cols);
    ui.scroll(key, area.x, area.y, area.w, area.h, rows * (cellH + g) - g, function () {
      items.forEach(function (item, i) {
        drawCell(item, area.x + (i % cols) * (cw + g), area.y + Math.floor(i / cols) * (cellH + g), cw, cellH, i);
      });
    });
  };

  ui.toast = function (msg) { bldToast(scene, msg); };
  ui.todo = function (what) { bldToast(scene, 'Placeholder: "' + what + '" is not built yet'); };
  ui.refresh = function () { bldRender(scene); };
  ui.go = function (id, tab) { scene.scene.restart({ id: id, tab: tab }); };
  ui.close = function () { bldState(ui.id).modal = null; ui.refresh(); };

  // A pop-up. draw(x, y, w, h) fills it in.
  ui.popup = function (title, w, h, draw) {
    bldState(ui.id).modal = { title: title, w: w, h: h, draw: draw };
    ui.refresh();
  };

  ui.confirm = function (title, message, yesLabel, onYes, kind) {
    ui.popup(title, 640, 300, function (u, x, y, w, h) {
      u.text(x + 24, y + 70, message, { size: 22, wrap: w - 48 });
      u.button(x + 24, y + h - 84, 280, 62, 'Cancel', function () { u.close(); });
      u.button(x + w - 304, y + h - 84, 280, 62, yesLabel, function () { bldState(u.id).modal = null; onYes(); u.refresh(); }, { kind: kind || 'main' });
    });
  };

  // Pick a hero who is free. skip = hero ids already chosen on this screen.
  ui.pickHero = function (title, onPick, skip, ignoreBusy) {
    const list = BLD_HEROES.filter(function (h) { return (skip || []).indexOf(h.id) === -1; });
    list.sort(function (a, b) { return (!ignoreBusy && bldHeroBusy(a.id) ? 1 : 0) - (!ignoreBusy && bldHeroBusy(b.id) ? 1 : 0); });
    ui.popup(title, 1080, 600, function (u, x, y, w, h) {
      u.grid('picker', { x: x + 18, y: y + 62, w: w - 36, h: h - 82 }, list, 3, 96, function (hero, cx, cy, cw, ch) {
        const busy = ignoreBusy ? '' : bldHeroBusy(hero.id);
        u.card(cx, cy, cw, ch, { onTap: function () {
          if (busy) { u.toast(hero.name + ' is busy: ' + busy); return; }
          bldState(u.id).modal = null; onPick(hero); u.refresh();
        } });
        u.slot(cx + 8, cy + 12, 72, { icon: bldInitials(hero), filled: !busy });
        u.text(cx + 90, cy + 10, hero.name, { size: 19, bold: true, color: busy ? BLD_T.off : BLD_T.main, fit: cw - 98 });
        u.text(cx + 90, cy + 38, hero.cls + '  ·  Lv ' + hero.level, { size: 17, color: BLD_T.dim, fit: cw - 98 });
        u.text(cx + 90, cy + 64, busy ? 'Busy: ' + busy : hero.traits.join(', '), { size: 16, color: busy ? BLD_T.bad : BLD_T.good, fit: cw - 98 });
      });
    });
  };

  // A row of hero slots for one job. cap = 0 means no limit.
  ui.workers = function (x, y, jobKey, cap, o) {
    o = o || {};
    const size = o.size || 66, gap = o.gap === undefined ? 8 : o.gap;
    const list = BLD_JOBS[jobKey] || [];
    const count = cap || list.length + 1;
    const perRow = o.perRow || count;
    for (let i = 0; i < count; i++) {
      const sx = x + (i % perRow) * (size + gap), sy = y + Math.floor(i / perRow) * (size + gap);
      const hero = list[i] ? bldHeroById(list[i]) : null;
      if (o.locked) { ui.slot(sx, sy, size, { locked: true, icon: '×' }); continue; }
      ui.slot(sx, sy, size, {
        filled: !!hero, icon: hero ? bldInitials(hero) : '+', label: hero ? bldShort(hero) : '',
        onTap: hero ? function () {
          ui.confirm('Remove ' + hero.name + '?', 'They stop working here and are free for your team again. Anything not collected yet is paid out.', 'Remove', function () {
            BLD_JOBS[jobKey] = BLD_JOBS[jobKey].filter(function (id) { return id !== hero.id; });
          });
        } : function () {
          ui.pickHero('Assign a hero', function (h) { BLD_JOBS[jobKey] = (BLD_JOBS[jobKey] || []).concat([h.id]); });
        },
      });
    }
  };

  // The "since last collection" box used by the production buildings
  ui.output = function (x, y, w, h, state, items, vaultLines) {
    const a = ui.panel(x, y, w, h, 'Ready to collect');
    const rows = state.collected ? [] : items;
    if (!rows.length) ui.text(a.x + 4, a.y + 10, 'Nothing new yet.', { size: 19, color: BLD_T.dim });
    rows.forEach(function (it, i) {
      const ry = a.y + i * 40;
      ui.art(a.x, ry, 32, 32, '');
      ui.text(a.x + 42, ry + 6, it[0], { size: 19, fit: a.w - 110 });
      ui.text(a.x + a.w - 4, ry + 6, '+' + it[1], { size: 19, bold: true, ox: 1, color: BLD_T.good });
    });
    let vy = y + h - 82 - vaultLines.length * 46;
    vaultLines.forEach(function (v) {
      ui.text(a.x, vy, v[0] + ' vault', { size: 16, color: BLD_T.dim });
      ui.bar(a.x, vy + 20, a.w, 20, v[1] / v[2], v[1] >= v[2] ? BLD_C.bad : BLD_C.blue, v[1] + ' / ' + v[2] + ' slots');
      vy += 46;
    });
    ui.button(a.x, y + h - 74, a.w, 62, 'Collect', function () {
      state.collected = true; ui.refresh(); ui.toast('Collected into the vaults (placeholder)');
    }, { kind: rows.length ? 'main' : 'off', why: 'Nothing to collect' });
  };

  return ui;
}

function bldDrawBar(sc) {
  if (!sc.bar) return;
  const len = Math.max(30, sc.h * sc.h / (sc.h + sc.max));
  const pos = sc.y + (sc.h - len) * ((sc.state.scroll[sc.key] || 0) / sc.max);
  sc.bar.clear();
  sc.bar.fillStyle(0x000000, 0.5); sc.bar.fillRect(sc.x + sc.w - 5, sc.y, 5, sc.h);
  sc.bar.fillStyle(BLD_C.gold, 0.9); sc.bar.fillRect(sc.x + sc.w - 5, pos, 5, len);
}

function bldToast(scene, msg) {
  if (scene.bld.toast) scene.bld.toast.destroy();
  const t = scene.add.text(640, 662, msg, {
    fontFamily: BLD_BODY, fontSize: '23px', fontStyle: 'bold', color: '#fff1d2', backgroundColor: '#000000ee',
    padding: { x: 22, y: 14 }, align: 'center', wordWrap: { width: 900 },
  }).setOrigin(0.5).setDepth(100);
  scene.bld.toast = t;
  scene.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 450 });
}

function bldClear(scene) {
  const ctx = scene.bld;
  ctx.objs.forEach((o) => o.destroy());
  ctx.masks.forEach((m) => m.destroy());
  ctx.objs = []; ctx.masks = []; ctx.hits = []; ctx.scrollers = [];
  ctx.layer = null; ctx.scroller = null; ctx.hitFloor = 0; ctx.scrollFloor = 0; ctx.drag = null;
}

// Draws the whole screen: background, top bar, tabs, the building's own content, then any pop-up
function bldRender(scene) {
  bldClear(scene);
  const ctx = scene.bld;
  const id = scene.bldId, b = BUILDINGS[id], state = bldState(id);
  const ui = bldMakeUI(scene);

  // background
  const bgKey = 'bld_bg_' + id;
  if (scene.textures.exists(bgKey)) {
    const img = scene.add.image(640, 360, bgKey);
    img.setScale(Math.max(1280 / img.width, 720 / img.height));
    ctx.objs.push(img);
    ui.rect(0, 0, 1280, 720, { fill: 0x000000, alpha: 0.3, r: 0 });
  } else {
    ui.rect(0, 0, 1280, 720, { fill: BLD_C.bg, r: 0 });
    ui.text(1264, 718, 'Background art: ' + BLD_ART_FOLDER + id + '.jpg', { size: 11, color: '#6f6677', ox: 1, oy: 1 });
  }

  // top bar
  ui.rect(0, 0, 1280, 72, { fill: 0x0a090c, alpha: 0.94, r: 0 });
  ui.rect(0, 72, 1280, 2, { fill: BLD_C.line, r: 0 });
  ui.button(12, 8, 148, 56, '‹  Town', function () { bldLeave(scene); }, { size: 23 });
  const title = ui.text(180, 6, b.title, { size: 32, title: true, color: BLD_T.gold, fit: 430 });
  const sub = ui.text(181, 47, b.area, { size: 16, color: BLD_T.dim });
  if (b.draft) ui.tag(180 + Math.max(title.width, sub.width) + 20, 26, 'DRAFT LAYOUT: rules mostly not decided');
  let mx = 1268;
  (b.money || []).slice().reverse().forEach(function (m) {
    const w = BLD_WALLET[m];
    const t = ui.text(mx - 12, 36, w[0] + '  ' + w[1], { size: 19, bold: true, ox: 1, oy: 0.5 });
    const left = mx - 12 - t.width - 38;
    const g = ui.rect(left, 17, t.width + 50, 38, { fill: 0x221d27, stroke: 0x5a4f62, r: 19 });
    scene.children.moveBelow(g, t);
    ui.rect(left + 11, 28, 16, 16, { fill: w[2], r: 8 });
    mx = left - 10;
  });

  // tabs
  const tabs = b.tabs || [];
  if (tabs.length) {
    if (state.tab >= tabs.length) state.tab = 0;
    const tw = Math.min(240, (1248 - (tabs.length - 1) * 8) / tabs.length);
    tabs.forEach(function (name, i) {
      const x = 16 + i * (tw + 8), on = state.tab === i;
      ui.rect(x, 82, tw, 54, { fill: on ? BLD_C.btnMain : 0x1d1922, stroke: on ? BLD_C.gold : 0x52485a });
      const label = typeof name === 'function' ? name(state) : name;
      ui.text(x + tw / 2, 109, label, { size: 21, bold: true, ox: 0.5, oy: 0.5, color: on ? '#fff1d2' : BLD_T.dim, fit: tw - 14 });
      ui.tap(x, 82, tw, 54, function () { state.tab = i; ui.refresh(); });
    });
  }

  b.draw(ui, state, state.tab);

  // pop-up on top, and only it can be tapped
  if (state.modal) {
    const m = state.modal;
    ui.rect(0, 0, 1280, 720, { fill: 0x000000, alpha: 0.78, r: 0 });
    ctx.hitFloor = ctx.hits.length;
    ctx.scrollFloor = ctx.scrollers.length;
    const x = 640 - m.w / 2, y = 360 - m.h / 2;
    ui.rect(x, y, m.w, m.h, { fill: BLD_C.panel, stroke: BLD_C.gold, sw: 3, r: 12 });
    ui.text(x + 24, y + 16, m.title, { size: 28, title: true, color: BLD_T.gold, fit: m.w - 130 });
    ui.button(x + m.w - 70, y + 8, 60, 48, '×', function () { ui.close(); }, { size: 30 });
    m.draw(ui, x, y, m.w, m.h);
  }
  if (ctx.toast) scene.children.bringToTop(ctx.toast);
}

function bldInside(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

// Taps and drag scrolling
function bldInput(scene) {
  const ctx = scene.bld;
  const scrollerAt = (x, y) => ctx.scrollers.slice(ctx.scrollFloor).reverse().filter((s) => s.max > 0 && bldInside(s, x, y))[0];
  const move = (sc, to) => {
    const v = Math.max(0, Math.min(sc.max, to));
    sc.state.scroll[sc.key] = v;
    sc.box.y = -v;
    bldDrawBar(sc);
  };
  scene.input.on('pointerdown', (p) => {
    const sc = scrollerAt(p.x, p.y);
    ctx.press = { x: p.x, y: p.y, moved: false };
    ctx.drag = sc ? { sc: sc, start: sc.state.scroll[sc.key] || 0 } : null;
  });
  scene.input.on('pointermove', (p) => {
    if (!p.isDown || !ctx.press) return;
    if (Math.abs(p.y - ctx.press.y) > 14 || Math.abs(p.x - ctx.press.x) > 14) ctx.press.moved = true;
    if (ctx.drag && ctx.press.moved) move(ctx.drag.sc, ctx.drag.start - (p.y - ctx.press.y));
  });
  scene.input.on('pointerup', (p) => {
    const press = ctx.press;
    ctx.press = null; ctx.drag = null;
    if (!press || press.moved || ctx.leaving) return;
    for (let i = ctx.hits.length - 1; i >= ctx.hitFloor; i--) {
      const h = ctx.hits[i];
      let y = p.y;
      if (h.scroller) {
        if (!bldInside(h.scroller, p.x, p.y)) continue;
        y += h.scroller.state.scroll[h.scroller.key] || 0;
      }
      if (bldInside(h, p.x, y)) { h.fn(); return; }
    }
  });
  scene.input.on('wheel', (p, over, dx, dy) => {
    const sc = scrollerAt(p.x, p.y);
    if (sc) move(sc, (sc.state.scroll[sc.key] || 0) + dy * 0.6);
  });
}

function bldLeave(scene) {
  if (scene.bld.leaving) return;
  scene.bld.leaving = true;
  bldState(scene.bldId).modal = null;
  const cam = scene.cameras.main;
  cam.fadeOut(150, 0, 0, 0);
  cam.once('camerafadeoutcomplete', () => { scene.scene.stop(); scene.scene.wake('Town'); });
}

const buildingScene = {
  key: 'Building',

  init: function (data) {
    this.bldId = data.id;
    this.bldTab = data.tab;
  },

  preload: function () {
    const id = this.bldId;
    if (BLD_ART_TRIED[id]) return;
    BLD_ART_TRIED[id] = true;  // a missing art file is fine: the labelled placeholder box shows instead
    this.load.image('bld_bg_' + id, BLD_ART_FOLDER + id + '.jpg');
    this.load.image('bld_feat_' + id, BLD_ART_FOLDER + id + '_feature.png');
  },

  create: function () {
    this.bld = { objs: [], masks: [], hits: [], scrollers: [], toast: null, press: null, drag: null, leaving: false };
    if (this.bldTab !== undefined) bldState(this.bldId).tab = this.bldTab;
    this.cameras.main.fadeIn(150, 0, 0, 0);
    bldInput(this);
    bldRender(this);
  },
};

// ===== HOOKUP TO THE TOWN (no edits to town.js or main.js needed) =====
function bldOpen(town, id) {
  town.town.busy = true;
  const cam = town.cameras.main;
  cam.fadeOut(170, 0, 0, 0);
  cam.once('camerafadeoutcomplete', () => {
    town.scene.launch('Building', { id: id });  // start the building screen...
    town.scene.sleep();                          // ...and put the town to sleep so it remembers where you were
  });
}

// Coming back from a building: the town is still on the same district you left it on
function bldTownWake() {
  const t = this.town;
  if (t.toast) { t.toast.destroy(); t.toast = null; }
  this.cameras.main.resetFX();
  this.cameras.main.fadeIn(170, 0, 0, 0);
  t.busy = false;
}

const bldTownCreate = townScene.create;
townScene.create = function () {
  bldTownCreate.apply(this, arguments);
  if (!this.scene.get('Building')) this.scene.add('Building', buildingScene, false);
  Object.keys(BUILDINGS).forEach((id) => {
    if (!TOWN_ACTIONS[id]) TOWN_ACTIONS[id] = (scene) => bldOpen(scene, id);
  });
  this.events.off('wake', bldTownWake, this);
  this.events.on('wake', bldTownWake, this);
};
