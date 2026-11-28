// itemIcons.js - the class-colored tile behind each piece of gear, with room for your own gear icons.
// SCREEN ONLY. Load order in index.html: after playerGear.js, before armory.js.

// ===== CLASS COLORS (change these to taste) =====
//             middle of tile, edge of tile, outline
const ITEM_TILE_COLORS = {
  Berserker:    ['#9e5d58', '#703c38', '#d13b34'],
  Monk:         ['#9c6a4b', '#70482f', '#e07a22'],
  Paladin:      ['#937a44', '#695529', '#e8bd2e'],
  Cleric:       ['#958f7d', '#6e695b', '#f1ead2'],
  Ranger:       ['#6e7749', '#4a512c', '#98a51f'],
  Druid:        ['#527e58', '#345739', '#2f9e46'],
  Necromancer:  ['#57685e', '#36443c', '#a9e6b4'],
  Shaman:       ['#34807a', '#185853', '#12a89c'],
  Elementalist: ['#418599', '#255d6e', '#45cdf2'],
  Guardian:     ['#617484', '#404f5c', '#93a9c4'],
  Stormcaller:  ['#586ca3', '#384874', '#3f63e6'],
  Warlock:      ['#7a6295', '#534069', '#8d46d9'],
  Assassin:     ['#685768', '#423643', '#a6246f'],
  Bard:         ['#9c6577', '#6f4352', '#f27bab'],
  Generic:      ['#74716e', '#4f4c4a', '#77716b'],
};
const ITEM_OUTLINE = 0.058;      // outline thickness, as a share of the tile (bigger = thicker)
const ITEM_RARITY_GEM = true;    // the small gem in the top left corner that shows rarity

// ===== YOUR OWN ICONS =====
// Type a picture's path in the "Gear Icon" column of the Gear tab, for example assets/Icon/bulwark_maul.png,
// then upload the new data/Gear.csv and the picture. Capital letters must match the file name exactly.
// Best picture: a square PNG, 128 x 128, with a see-through background so the class color shows.
// A piece with a blank cell, or a picture that is not found, shows its slot letters.

// ===== DRAWING =====

// The color group for a piece: its class, or Generic when it has no class
function itemTileName(gear) {
  const cls = gear.affinities[0];
  return cls && ITEM_TILE_COLORS[cls] ? cls : 'Generic';
}

function itemRoundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// The colored background, made once per class
function itemTileTexture(scene, name) {
  const key = 'itemtile_' + name;
  if (scene.textures.exists(key)) return key;
  const S = 128, colors = ITEM_TILE_COLORS[name];
  const tex = scene.textures.createCanvas(key, S, S);
  const c = tex.getContext();
  const glow = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.68);
  glow.addColorStop(0, colors[0]);
  glow.addColorStop(1, colors[1]);
  const line = Math.max(1, Math.round(S * ITEM_OUTLINE));
  itemRoundRect(c, 0, 0, S, S, S * 0.11);
  c.fillStyle = glow;
  c.fill();
  itemRoundRect(c, line / 2, line / 2, S - line, S - line, S * 0.09);
  c.lineWidth = line;
  c.strokeStyle = colors[2];
  c.stroke();
  itemRoundRect(c, line + 1, line + 1, S - 2 * line - 2, S - 2 * line - 2, S * 0.05);
  c.lineWidth = 2;
  c.strokeStyle = '#120f15';
  c.stroke();
  tex.refresh();
  return key;
}

// The picture named in the piece's "Gear Icon" cell, or ''
function itemPicturePath(gear) {
  const row = GAME_DATA.gear[gear.id];
  const value = row ? String(field(row, ['Gear Icon'], '')).trim() : '';
  return value ? imageFile(value) : '';
}

// That picture, loaded the first time it is needed. '' while it is not there.
function itemPictureKey(scene, gear) {
  const path = itemPicturePath(gear);
  if (!path) return '';
  const key = 'itemart_' + path;
  if (scene.textures.exists(key)) return key;
  const ctx = scene.bld;
  const tried = ctx.artTried || (ctx.artTried = {});
  if (!tried[key]) {
    tried[key] = true;
    scene.load.image(key, path);
    if (!ctx.itemWaiting) { // redraw once when the whole batch has arrived, not once per picture
      ctx.itemWaiting = true;
      scene.load.once('complete', function () {
        ctx.itemWaiting = false;
        if (!ctx.leaving && scene.scene.isActive()) bldRender(scene);
      });
    }
    scene.load.start();
  }
  return '';
}

function itemAdd(ui, obj) {
  const ctx = ui.scene.bld;
  if (ctx.layer) ctx.layer.add(obj); else ctx.objs.push(obj);
  return obj;
}

// One gear tile. o.fallback = letters to show if there is no picture. o.label = a name band along the bottom.
function drawItemTile(ui, x, y, size, gear, o) {
  o = o || {};
  const back = itemAdd(ui, ui.scene.add.image(x + size / 2, y + size / 2, itemTileTexture(ui.scene, itemTileName(gear))));
  back.setDisplaySize(size, size);

  const own = itemPictureKey(ui.scene, gear);
  const art = Math.round(size * (o.label ? 0.72 : 0.84));
  const artY = o.label ? y + 5 + art / 2 : y + size / 2;
  if (own) {
    const pic = itemAdd(ui, ui.scene.add.image(x + size / 2, artY, own));
    pic.setScale(art / Math.max(pic.width, pic.height)); // fits the tile without stretching
  } else {
    ui.text(x + size / 2, artY, o.fallback || '?', { size: Math.round(size * 0.34), bold: true, ox: 0.5, oy: 0.5, color: '#fff1d2' });
  }

  if (o.label) {
    ui.rect(x + 6, y + size - 23, size - 12, 17, { fill: 0x0a090c, alpha: 0.74, r: 4 });
    ui.text(x + size / 2, y + size - 14.5, o.label, { size: 14, ox: 0.5, oy: 0.5, fit: size - 14 });
  }

  if (ITEM_RARITY_GEM) {
    const r = Math.max(7, Math.round(size * 0.11));
    const cx = x + r + 2, cy = y + r + 2;
    const g = itemAdd(ui, ui.scene.add.graphics());
    const diamond = function (d, color) {
      g.fillStyle(color, 1);
      g.fillTriangle(cx - d, cy, cx, cy - d, cx + d, cy);
      g.fillTriangle(cx - d, cy, cx, cy + d, cx + d, cy);
    };
    diamond(r + 2.5, 0x0a090c);
    diamond(r, RARITY_COLOR[Math.max(0, RARITIES.indexOf(gear.rarity))]);
    g.fillStyle(0xffffff, 0.55);
    g.fillTriangle(cx - r * 0.5, cy, cx, cy - r * 0.5, cx, cy);
  }
}
