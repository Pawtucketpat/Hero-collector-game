// armory.js - the working Armory screen.
// SCREEN ONLY: every gear change and every number comes from playerGear.js.
// Load order in index.html: after buildingsAdventure.js (this replaces the sample Armory in buildingsCenter.js)
// and after playerGear.js and itemIcons.js, before main.js.

const ARM_SAMPLE = BUILDINGS.armory; // the Heroes and Gear Vault tabs still show the sample layouts
const ARM_SLOT_SHORT = { 'Main Hand': 'MH', 'Off Hand': 'OH', 'Head': 'H', 'Chest': 'C', 'Gloves': 'G', 'Legs': 'L', 'Feet': 'F' };

// The texture key for a picture, loading it the first time it is needed. '' while it is not there.
function armArt(scene, path) {
  const key = 'arm_' + path;
  if (scene.textures.exists(key)) return key;
  const tried = scene.bld.artTried || (scene.bld.artTried = {}); // forgotten when the screen is closed
  if (!tried[key]) {
    tried[key] = true;
    scene.load.image(key, imageFile(path));
    scene.load.once('complete', function () {
      if (!scene.bld.leaving && scene.scene.isActive()) bldRender(scene);
    });
    scene.load.start();
  }
  return '';
}

function armImage(ui, key, x, y, w, h) {
  const img = ui.scene.add.image(x + w / 2, y + h / 2, key);
  img.setScale(Math.min(w / img.width, h / img.height));
  const ctx = ui.scene.bld;
  if (ctx.layer) ctx.layer.add(img); else ctx.objs.push(img);
  return img;
}

// A scrolling window whose length is measured from what gets drawn. draw() returns the y where its content ends.
function armScroll(ui, key, x, y, w, h, draw) {
  let end = y;
  ui.scroll(key, x, y, w, h, 4000, function () { end = draw(); });
  const sc = ui.scene.bld.scrollers[ui.scene.bld.scrollers.length - 1];
  sc.max = Math.max(0, end - y - h);
  if ((sc.state.scroll[key] || 0) > sc.max) { sc.state.scroll[key] = sc.max; sc.box.y = -sc.max; }
  if (sc.bar) { sc.bar.clear(); if (sc.max > 0) bldDrawBar(sc); }
}

// Wrapped text that returns the y just under itself
function armPara(ui, x, y, str, o) {
  const t = ui.text(x, y, str, o);
  return y + t.height + 3;
}

// The numbers and needs of a gear passive come from gearPassives.js (blank if it is not loaded)
function armPassiveNote(id) { return typeof gearPassiveNote === 'function' ? gearPassiveNote(id) : ''; }
function armPassiveMissing(id, sheet) { return typeof gearPassiveMissing === 'function' ? gearPassiveMissing(id, sheet) : ''; }

function armNum(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); }
function armStatText(name, value) { return armNum(value) + (PERCENT_STATS.indexOf(name) !== -1 ? '%' : ''); }

function armWearerName(who) {
  if (who === MC_ID) return 'your main character';
  const row = GAME_DATA.heroes[who];
  return row ? String(field(row, ['Hero Name', 'Name'], who)) : who;
}

// Gear tiles come from itemIcons.js. Without it the screens show the old letter boxes.
function armHasIcons() { return typeof drawItemTile === 'function'; }

// The wearer's portrait, bottom right of an item tile
function armBadge(ui, x, y, who) {
  ui.rect(x, y, 30, 30, { fill: 0x0a090c, stroke: BLD_C.gold, sw: 2, r: 15 });
  const key = who === MC_ID ? armArt(ui.scene, mainCharacterSprite(mainCharacterSheet())) : '';
  if (key) armImage(ui, key, x + 2, y + 2, 26, 26);
  else ui.text(x + 15, y + 15, who === MC_ID ? 'MC' : armWearerName(who).slice(0, 2), { size: 14, bold: true, ox: 0.5, oy: 0.5, color: BLD_T.gold });
}

// A gold banner for a bonus that was just switched on
function armBanner(scene, lines) {
  if (scene.bld.banner) scene.bld.banner.destroy();
  const shown = lines.slice(0, 4);
  const t = scene.add.text(640, 190, '✦ UNLOCKED ✦\n' + shown.join('\n'), {
    fontFamily: BLD_TITLE, fontSize: '28px', fontStyle: 'bold', color: '#ffe08a', align: 'center',
    backgroundColor: '#1d1409f2', padding: { x: 36, y: 18 }, lineSpacing: 8,
  }).setOrigin(0.5).setDepth(120);
  scene.bld.banner = t;
  scene.tweens.add({ targets: t, alpha: 0, delay: 2400, duration: 500, onComplete: function () { t.destroy(); if (scene.bld.banner === t) scene.bld.banner = null; } });
}

// ----- changing gear -----

function armEquip(ui, item) {
  const before = mainCharacterSheet();
  const result = equipItem(MC_ID, item.itemId);
  if (!result.ok) { ui.toast(result.reason); return; }
  const fresh = newUnlocks(before, mainCharacterSheet());
  ui.refresh();
  if (fresh.length) armBanner(ui.scene, fresh);
  else ui.toast('Equipped ' + item.gear.name);
}

// ----- the loadout (left) -----

function armLoadout(ui, st, sheet) {
  ui.panel(16, 146, 452, 562, 'Main Character', 'In every battle');
  const spots = { 'Head': [28, 192], 'Chest': [28, 279], 'Gloves': [28, 366], 'Legs': [28, 453], 'Main Hand': [374, 192], 'Off Hand': [374, 279], 'Feet': [374, 366] };
  const art = armArt(ui.scene, mainCharacterSprite(sheet));
  if (art) { ui.rect(122, 192, 240, 340, { fill: 0x121017, alpha: 0.9, r: 4 }); armImage(ui, art, 126, 196, 232, 332); }
  else ui.art(122, 192, 240, 340, 'MAIN CHARACTER');
  const worn = getEquipped(MC_ID);
  GEAR_SLOTS.forEach(function (slot) {
    const item = worn[slot] ? getItem(worn[slot]) : null;
    const x = spots[slot][0], y = spots[slot][1];
    const pick = function () { st.slot = slot; st.setf = ''; st.afff = ''; st.item = item ? item.itemId : ''; st.scroll.inv = 0; st.scroll.insp = 0; ui.refresh(); };
    if (item && armHasIcons()) {
      drawItemTile(ui, x, y, 82, item.gear, { label: slot, fallback: ARM_SLOT_SHORT[slot] });
      if (st.slot === slot) ui.rect(x - 4, y - 4, 90, 90, { stroke: 0xffffff, sw: 3, r: 13 }); // white ring = picked
      ui.tap(x, y, 82, 82, pick);
      return;
    }
    ui.slot(x, y, 82, {
      filled: !!item, rarity: item ? RARITIES.indexOf(item.gear.rarity) : undefined, selected: st.slot === slot,
      icon: item ? ARM_SLOT_SHORT[slot] : '+', label: slot, onTap: pick,
    });
  });

  const s = sheet.stats;
  ui.text(28, 540, 'Health ' + sheet.maxHp + '    Armor ' + armNum(s.Armor) + '    Speed ' + armNum(s.Speed), { size: 20, bold: true, fit: 428 });
  ui.text(28, 568, 'STR ' + armNum(s.Strength) + '   DEX ' + armNum(s.Dexterity) + '   INT ' + armNum(s.Intelligence) + '   WIS ' + armNum(s.Wisdom) + '   VIT ' + armNum(s.Vitality), { size: 17, fit: 428 });

  ui.text(28, 598, 'Affinity', { size: 16, color: BLD_T.dim });
  const lit = sheet.affinities.filter(function (a) { return a.tier; });
  if (!lit.length) ui.text(96, 598, 'None lit yet (2 pieces of one class)', { size: 16, fit: 360 });
  let cx = 96;
  lit.forEach(function (a) {
    const dots = AFFINITY_TIERS.map(function (t) { return a.tier >= t ? '●' : '○'; }).join('');
    cx += ui.chip(cx, 592, a.name + ' ' + a.count + ' ' + dots, { on: true, h: 28, size: 15, w: Math.min(170, Math.floor((364 - 6 * (lit.length - 1)) / lit.length)) }) + 6;
  });

  const on = sheet.sets.filter(function (set) { return set.count >= 2; });
  const line = on.length ? on.map(function (set) { return set.name + ' ' + set.count + ' (' + set.tiers.filter(function (t) { return t.active; }).map(function (t) { return t.pieces; }).join('/') + ' on)'; }).join(',  ') : 'No set bonus yet (2 pieces of one set)';
  ui.text(28, 628, line, { size: 16, color: on.length ? BLD_T.good : BLD_T.dim, fit: 428 });
  ui.button(28, 654, 428, 46, 'All stats, skills and bonuses', function () { armDetails(ui); });
}

// ----- the inventory (middle) -----

function armPicker(ui, st, title, options, key) {
  ui.popup(title, 1100, 610, function (u, x, y, w, h) {
    u.grid('armpick', { x: x + 18, y: y + 66, w: w - 36, h: h - 84 }, options, 3, 54, function (opt, cx, cy, cw, ch) {
      u.button(cx, cy, cw, ch, opt[1], function () {
        st[key] = opt[0];
        if (key !== 'slot' && opt[0]) st.slot = ''; // a set or class filter looks across every slot
        st.scroll.inv = 0; u.close();
      }, { kind: st[key] === opt[0] ? 'main' : undefined, size: 19 });
    });
  });
}

function armInventory(ui, st, items) {
  const inv = ui.panel(480, 146, 440, 562, 'Your gear', items.length + (items.length === 1 ? ' item' : ' items'));
  const setRow = st.setf ? GAME_DATA.gearSets[st.setf] : null;
  const chip = function (i, label, on, fn) { ui.chip(inv.x + i * 140, inv.y, label, { w: 134, size: 16, on: on, onTap: fn }); };
  chip(0, (st.slot || 'All slots') + ' ▾', !!st.slot, function () {
    armPicker(ui, st, 'Show which slot?', [['', 'All slots']].concat(GEAR_SLOTS.map(function (s) { return [s, s]; })), 'slot');
  });
  chip(1, (setRow ? String(field(setRow, ['Set Name'], st.setf)) : 'Any set') + ' ▾', !!st.setf, function () {
    armPicker(ui, st, 'Show which set?', [['', 'Any set']].concat(Object.keys(GAME_DATA.gearSets).map(function (id) { return [id, String(field(GAME_DATA.gearSets[id], ['Set Name'], id))]; })), 'setf');
  });
  chip(2, (st.afff || 'Any class') + ' ▾', !!st.afff, function () {
    const classes = [];
    ownedItems().forEach(function (i) { i.gear.affinities.forEach(function (a) { if (classes.indexOf(a) === -1) classes.push(a); }); });
    armPicker(ui, st, 'Show which class affinity?', [['', 'Any class']].concat(classes.sort().map(function (c) { return [c, c]; })), 'afff');
  });

  const area = { x: inv.x, y: inv.y + 44, w: inv.w, h: inv.h - 44 };
  if (!items.length) ui.text(area.x + area.w / 2, area.y + 60, 'No gear matches these filters', { size: 19, color: BLD_T.dim, ox: 0.5 });
  ui.grid('inv', area, items, 3, 112, function (item, x, y, w, h) {
    const g = item.gear;
    ui.card(x, y, w, h, { selected: st.item === item.itemId, onTap: function () { st.item = item.itemId; st.scroll.insp = 0; ui.refresh(); } });
    const icons = armHasIcons(), size = icons ? 64 : 56;
    const ix = x + w / 2 - size / 2;
    if (icons) drawItemTile(ui, ix, y + 4, size, g, { fallback: ARM_SLOT_SHORT[g.slot] });
    else {
      ui.rect(ix, y + 8, size, size, { fill: 0x332a22, stroke: RARITY_COLOR[Math.max(0, RARITIES.indexOf(g.rarity))], sw: 3, r: 6 });
      ui.text(ix + 28, y + 36, ARM_SLOT_SHORT[g.slot] || '?', { size: 21, bold: true, color: BLD_T.gold, ox: 0.5, oy: 0.5 });
    }
    ui.text(x + w / 2, y + (icons ? 71 : 68), g.name, { size: 15, ox: 0.5, align: 'center', wrap: w - 8, lines: 2 });
    const who = wearerOfItem(item.itemId);
    if (who) armBadge(ui, ix + size - 16, y + (icons ? 40 : 34), who);
  }, 8);
}

// ----- the item you tapped (right) -----

function armInspect(ui, st, sheet) {
  const p = ui.panel(932, 146, 332, 562, 'Inspect');
  const item = st.item ? getItem(st.item) : null;
  if (!item) { ui.text(p.x, p.y + 12, 'Tap a piece of gear to inspect it.', { size: 18, color: BLD_T.dim, wrap: p.w }); return; }
  const g = item.gear;
  const who = wearerOfItem(item.itemId);
  const mine = who === MC_ID;
  const wornId = getEquipped(MC_ID)[g.slot];
  const worn = wornId && wornId !== item.itemId ? getItem(wornId).gear : null;
  const after = sheetForGear(wornGear(MC_ID).filter(function (x) { return x.slot !== g.slot; }).concat([g]));
  const w = p.w - 12;

  armScroll(ui, 'insp', p.x, p.y, p.w, 622 - p.y, function () {
    let y = p.y;
    let tx = p.x, tw = w, tileEnd = 0; // the name sits to the right of the picture
    if (armHasIcons()) {
      drawItemTile(ui, p.x, y + 2, 76, g, { fallback: ARM_SLOT_SHORT[g.slot] });
      tx = p.x + 86; tw = w - 86; tileEnd = y + 80;
    }
    y = armPara(ui, tx, y, g.name, { size: 21, bold: true, wrap: tw, color: RARITY_TEXT[Math.max(0, RARITIES.indexOf(g.rarity))] });
    y = armPara(ui, tx, y, g.rarity + ' · ' + g.slot, { size: 16, color: BLD_T.dim, wrap: tw });
    if (who) y = armPara(ui, tx, y, 'Worn by ' + armWearerName(who), { size: 16, color: BLD_T.gold, wrap: tw });
    y = Math.max(y, tileEnd) + 6;

    // skill
    const skill = g.skillId ? describeSkill(g.skillId, g.slot) : null;
    if (skill) {
      const kind = skill.passive ? 'Passive' : skill.basic ? 'Basic attack' : 'Skill';
      y = armPara(ui, p.x, y, kind + ': ' + skill.name, { size: 18, bold: true, wrap: w });
      if (!skill.passive && !skill.basic) y = armPara(ui, p.x, y, 'Cooldown: ' + skill.cooldown, { size: 15, color: BLD_T.dim });
      if (skill.text) y = armPara(ui, p.x, y, skill.text, { size: 16, wrap: w });
      if (!skill.works) y = armPara(ui, p.x, y, 'This passive does not work yet. The stats still count.', { size: 15, color: BLD_T.amber, wrap: w });
      const note = skill.passive ? armPassiveNote(skill.id) : '';
      if (note) y = armPara(ui, p.x, y, 'In battle: ' + note, { size: 16, color: BLD_T.good, wrap: w });
      const lacking = skill.passive ? armPassiveMissing(skill.id, after) : '';
      if (lacking) y = armPara(ui, p.x, y, lacking + ' to do anything.', { size: 15, color: BLD_T.amber, wrap: w });
    } else if (g.slot === 'Main Hand') {
      const borrowed = describeSkill(borrowedBasicFor(g), g.slot);
      y = armPara(ui, p.x, y, 'Basic attack: ' + (borrowed ? borrowed.name + ' (borrowed until this weapon has its own)' : 'none'), { size: 16, wrap: w });
    } else y = armPara(ui, p.x, y, 'No skill on this piece', { size: 16, color: BLD_T.dim });
    y += 8;

    // stats, compared with what is in that slot now
    y = armPara(ui, p.x, y, mine ? 'Stats' : worn ? 'Stats (▲▼ against ' + worn.name + ')' : 'Stats (this slot is empty)', { size: 15, color: BLD_T.dim, wrap: w });
    GEAR_STAT_NAMES.forEach(function (n) {
      const v = g.stats[n] || 0, old = worn ? worn.stats[n] || 0 : 0;
      if (!v && !old) return;
      ui.text(p.x, y, n, { size: 17 });
      ui.text(p.x + w - 56, y, armStatText(n, v), { size: 17, bold: true, ox: 1 });
      const diff = mine ? 0 : worn ? v - old : v;
      if (diff) ui.text(p.x + w, y, (diff > 0 ? '▲' : '▼') + armNum(Math.abs(diff)), { size: 16, bold: true, ox: 1, color: diff > 0 ? BLD_T.good : BLD_T.bad });
      y += 23;
    });
    if (!mine) y = armPara(ui, p.x, y + 4, 'Health ' + sheet.maxHp + ' → ' + after.maxHp + '   Armor ' + armNum(sheet.stats.Armor) + ' → ' + armNum(after.stats.Armor), { size: 16, bold: true, wrap: w });
    y += 8;

    // class affinity
    g.affinities.forEach(function (a) {
      const count = function (s) { const f = s.affinities.filter(function (x) { return x.name === a; })[0]; return f ? f.count : 0; };
      y = armPara(ui, p.x, y, 'Class affinity: ' + a, { size: 17, bold: true, wrap: w });
      y = armPara(ui, p.x, y, 'You have ' + count(sheet) + (mine ? '' : ' · with this on: ' + count(after)), { size: 15, color: BLD_T.dim, wrap: w });
    });

    // set
    if (g.setId) {
      const have = sheet.sets.filter(function (s) { return s.id === g.setId; })[0];
      const set = setBonusFor(g.setId, have ? have.count : 0);
      y += 6;
      y = armPara(ui, p.x, y, set.name + ' (wearing ' + set.count + ' of 7)', { size: 17, bold: true, color: BLD_T.gold, wrap: w });
      set.tiers.forEach(function (t) {
        y = armPara(ui, p.x, y, (t.active ? '● ' : '○ ') + t.pieces + ': ' + t.text, { size: 15, color: t.active ? BLD_T.good : BLD_T.dim, wrap: w });
      });
    }
    return y + 6;
  });

  ui.button(p.x, 630, p.w, 66, mine ? 'Unequip' : who ? 'Move to main character' : 'Equip', function () {
    if (mine) { unequipSlot(MC_ID, g.slot); ui.refresh(); }
    else armEquip(ui, item);
  }, { kind: 'main' });
}

// ----- the full picture (pop-up) -----

function armDetails(ui) {
  ui.popup('Main character: stats, skills and bonuses', 1220, 660, function (u, x, y, w, h) {
    const now = mainCharacterSheet(), bare = sheetForGear([]);
    const top = y + 66, tall = h - 150;

    // stats
    u.text(x + 24, top, 'Stat', { size: 16, color: BLD_T.dim });
    u.text(x + 292, top, 'No gear', { size: 16, color: BLD_T.dim, ox: 1 });
    u.text(x + 376, top, 'Now', { size: 16, color: BLD_T.dim, ox: 1 });
    armScroll(u, 'armstats', x + 24, top + 24, 368, tall - 24, function () {
      let ry = top + 24;
      const line = function (label, a, b) {
        u.text(x + 24, ry, label, { size: 17, fit: 200 });
        u.text(x + 292, ry, a, { size: 17, color: BLD_T.dim, ox: 1 });
        u.text(x + 376, ry, b, { size: 17, bold: true, ox: 1, color: a === b ? BLD_T.main : BLD_T.good });
        ry += 23;
      };
      line('Health', String(bare.maxHp), String(now.maxHp));
      ['Armor', 'Speed', 'Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Vitality', 'Accuracy', 'Critical Chance', 'Critical Bonus', 'Critical Resistance']
        .forEach(function (n) { line(n, armStatText(n, bare.stats[n]), armStatText(n, now.stats[n])); });
      const pct = function (v) { return armNum(v * 100) + '%'; };
      const extra = [['Healing done', 'healDone'], ['Healing received', 'healReceived'], ['Life steal', 'lifesteal'], ['Damage dealt', 'damagePct'], ['Less damage taken', 'damageTaken'], ['Heal each turn', 'turnHeal']];
      extra.forEach(function (e) { if (now.bonus[e[1]]) line(e[0], '0%', '+' + pct(now.bonus[e[1]])); });
      Object.keys(now.bonus.typePct).forEach(function (t) { line(t.charAt(0).toUpperCase() + t.slice(1) + ' damage', '0%', '+' + pct(now.bonus.typePct[t])); });
      if (now.bonus.dotTurns) line('Damage over time', '+0', '+' + now.bonus.dotTurns + ' turn');
      return ry;
    });

    // skills
    const sx = x + 424;
    u.text(sx, top, 'Skills in battle', { size: 20, title: true, color: BLD_T.gold });
    armScroll(u, 'armskills', sx, top + 32, 368, tall - 32, function () {
      let ry = top + 32;
      now.actives.forEach(function (a, i) {
        ry = armPara(u, sx, ry, 'Button ' + (i + 1) + ': ' + a.name, { size: 18, bold: true, wrap: 356 });
        ry = armPara(u, sx, ry, (a.borrowed ? 'Borrowed basic attack' : 'From ' + a.slot) + (a.basic ? '' : ' · cooldown ' + a.cooldown), { size: 15, color: BLD_T.dim, wrap: 356 }) + 4;
      });
      ry = armPara(u, sx, ry + 8, 'Passives', { size: 19, title: true, color: BLD_T.gold });
      if (!now.passives.length) ry = armPara(u, sx, ry, 'None equipped', { size: 16, color: BLD_T.dim });
      now.passives.forEach(function (a) {
        const lacking = a.works ? armPassiveMissing(a.id, now) : '';
        const on = a.works && !lacking;
        ry = armPara(u, sx, ry, (on ? '● ' : '○ ') + a.name + ' (' + a.slot + ')' + (a.works ? '' : ': not working yet'), { size: 16, color: on ? BLD_T.good : BLD_T.amber, wrap: 356 });
        const note = lacking || armPassiveNote(a.id);
        if (note) ry = armPara(u, sx, ry, note, { size: 15, color: lacking ? BLD_T.amber : BLD_T.dim, wrap: 356 }) + 4;
      });
      return ry;
    });

    // sets and affinities
    const bx = x + 826;
    u.text(bx, top, 'Sets and affinities', { size: 20, title: true, color: BLD_T.gold });
    armScroll(u, 'armsets', bx, top + 32, 370, tall - 32, function () {
      let ry = top + 32;
      const big = now.sets.filter(function (s) { return s.count >= 2; });
      big.forEach(function (s) {
        ry = armPara(u, bx, ry, s.name + '  ' + s.count + ' of 7', { size: 17, bold: true, wrap: 356 });
        s.tiers.forEach(function (t) { ry = armPara(u, bx, ry, (t.active ? '● ' : '○ ') + t.pieces + ': ' + t.text, { size: 15, color: t.active ? BLD_T.good : BLD_T.dim, wrap: 356 }); });
        ry += 8;
      });
      const small = now.sets.filter(function (s) { return s.count < 2; });
      if (small.length) ry = armPara(u, bx, ry, 'One piece only: ' + small.map(function (s) { return s.name; }).join(', '), { size: 15, color: BLD_T.dim, wrap: 356 }) + 8;
      now.affinities.forEach(function (a) { ry = armPara(u, bx, ry, a.name + ' affinity: ' + a.count + (a.tier ? ' (tier ' + a.tier + ' lit)' : ''), { size: 17, wrap: 356, color: a.tier ? BLD_T.good : BLD_T.dim }); });
      if (now.affinities.length) ry = armPara(u, bx, ry + 4, 'The 2, 4 and 6 piece class abilities are not written yet, so affinities do not change battles.', { size: 15, color: BLD_T.amber, wrap: 356 });
      return ry;
    });

    u.button(x + 24, y + h - 70, 300, 52, 'Reset to starting gear', function () {
      u.confirm('Reset gear?', 'The main character goes back to the starting set.', 'Reset', function () { resetPlayerSave(); bldState(u.id).item = ''; }, 'bad');
    });
    u.button(x + w - 324, y + h - 70, 300, 52, 'Close', function () { u.close(); }, { kind: 'main' });
  });
}

// ----- the three gear panels (used by the Armory and by the battle preparation screen) -----

// What a gear screen remembers between taps
function armGearState() { return { slot: 'Main Hand', setf: '', afff: '', item: '' }; }

function armGearScreen(ui, st) {
  if (typeof mainCharacterSheet !== 'function' || !Object.keys(GAME_DATA.gear).length) {
    ui.text(640, 360, 'The gear list did not load.\nCheck data/Gear.csv and that playerGear.js is uploaded.', { size: 26, ox: 0.5, oy: 0.5, align: 'center' });
    return;
  }
  const sheet = mainCharacterSheet();
  const setOrder = Object.keys(GAME_DATA.gearSets);
  const items = ownedItems().filter(function (i) {
    return (!st.slot || i.gear.slot === st.slot) && (!st.setf || i.gear.setId === st.setf) && (!st.afff || i.gear.affinities.indexOf(st.afff) !== -1);
  }).sort(function (a, b) {
    return setOrder.indexOf(a.gear.setId) - setOrder.indexOf(b.gear.setId) || GEAR_SLOTS.indexOf(a.gear.slot) - GEAR_SLOTS.indexOf(b.gear.slot) || a.itemId.localeCompare(b.itemId);
  });
  if (!st.item) st.item = getEquipped(MC_ID)[st.slot || 'Main Hand'] || (items[0] ? items[0].itemId : '');
  armLoadout(ui, st, sheet);
  armInventory(ui, st, items);
  armInspect(ui, st, sheet);
}

// =============================================================================================
BUILDINGS.armory = {
  title: 'Armory', area: 'Town Center  ·  gear for you and your heroes', money: ['gold'],
  tabs: ['Main Character', 'Heroes', 'Gear Vault'],
  init: function () { return Object.assign(ARM_SAMPLE.init(), armGearState()); },
  draw: function (ui, st, tab) {
    if (tab !== 0) {
      ARM_SAMPLE.draw(ui, st, tab);
      ui.tag(1264, 98, 'SAMPLE ONLY: not connected to your gear yet', { right: true });
      return;
    }
    armGearScreen(ui, st);
  },
};
