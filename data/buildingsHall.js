// buildingsHall.js - Town Hall district interiors: Town Hall, Mine, Farm, Lumber Mill, Blacksmith,
// Alchemist, Enchanter, Expedition Hall. Needs buildings.js and buildingsCenter.js loaded first.

const BLD_SAMPLE_TOWN_LEVEL = 3;   // the pretend town these screens show

// ===== WORKING NUMBERS (placeholders from your latest notes; change them here) =====
const BLD_HIRES = {
  townLevel: [0, 10, 20, 30, 40, 50],
  enchanter: ['Free', '2,500', '12,500', '60,000', '300,000', '1,500,000'],
  smith: ['Free', '1,250', '6,250', '30,000', '150,000', '750,000'],
};
const BLD_UPGRADE_COSTS = [ // Enchanter, one rung at a time: [dust, gold]
  ['50', '500'], ['150', '2,000'], ['450', '8,000'], ['1,500', '30,000'], ['5,000', '120,000']];
const BLD_DUST = ['10', '25', '60', '150', '400', '1,000'];
const BLD_SALVAGES = [1, 2, 3, 4, 5, 6];

// Pick-a-gear list shared by the Blacksmith and Enchanter
function bldGearList(ui, st, key, area, items, note) {
  ui.list(key + 'list', area, items, 70, function (g, x, y, w, h) {
    ui.card(x, y, w, h, { selected: st[key] === g.id, stripe: RARITY_COLOR[g.rarity], onTap: function () { st[key] = g.id; ui.refresh(); } });
    ui.art(x + 18, y + 8, 46, 46, '');
    ui.text(x + 74, y + 9, g.name, { size: 19, bold: true, color: RARITY_TEXT[g.rarity], fit: w - 80 });
    ui.text(x + 74, y + 35, note ? note(g) : RARITIES[g.rarity] + ' · ' + g.slot, { size: 16, color: BLD_T.dim, fit: w - 80 });
  });
}

// Rows of "material   have / need"
function bldCosts(ui, x, y, w, rows) {
  rows.forEach(function (r, i) {
    const ry = y + i * 54;
    ui.card(x, ry, w, 48);
    ui.art(x + 6, ry + 6, 36, 36, '');
    ui.text(x + 50, ry + 13, r[0], { size: 18, fit: w - 156 });
    const unknown = /not set|—/.test(String(r[1]));
    ui.text(x + w - 10, ry + 13, r[1], { size: 18, bold: true, ox: 1, color: unknown ? BLD_T.dim : r[2] === false ? BLD_T.bad : BLD_T.good });
  });
  return y + rows.length * 54;
}

// Six hire cards for the smiths or enchanters
function bldHireScreen(ui, st, costs, who, perk) {
  ui.text(24, 150, 'One hire per rarity tier. A new hire replaces the one you have. Main character level also needed (table not set).', { size: 19, color: BLD_T.dim, fit: 1230 });
  RARITIES.forEach(function (r, i) {
    const x = 16 + (i % 3) * 420, y = 184 + Math.floor(i / 3) * 266;
    const current = i === st.hired, next = i === st.hired + 1, past = i < st.hired;
    const locked = BLD_HIRES.townLevel[i] > BLD_SAMPLE_TOWN_LEVEL;
    ui.card(x, y, 408, 258, { selected: current });
    ui.art(x + 14, y + 14, 130, 166, r + ' ' + who);
    ui.text(x + 160, y + 18, r + ' ' + who, { size: 22, title: true, color: RARITY_TEXT[i], fit: 236 });
    ui.text(x + 160, y + 58, 'Town level ' + BLD_HIRES.townLevel[i], { size: 19 });
    ui.text(x + 160, y + 88, costs[i] === 'Free' ? 'Free' : costs[i] + ' gold', { size: 21, bold: true, color: BLD_T.gold });
    ui.text(x + 160, y + 124, perk(r), { size: 17, color: BLD_T.dim, wrap: 236 });
    const label = current ? 'Working for you' : past ? 'Replaced' : locked ? 'Locked' : 'Hire';
    ui.button(x + 14, y + 192, 380, 54, label, function () {
      ui.confirm('Hire the ' + r + ' ' + who + '?', 'Costs ' + costs[i] + ' gold. They replace your current ' + who.toLowerCase() + '.', 'Hire', function () { st.hired = i; });
    }, { kind: current || past || locked ? 'off' : next ? 'main' : undefined, why: current ? 'Already hired' : past ? 'You have a better one' : 'Needs town level ' + BLD_HIRES.townLevel[i] });
  });
}

// =============================================================================================
BUILDINGS.town_hall = {
  title: 'Town Hall', area: 'Town management', money: ['gold', 'stone', 'wood'],
  tabs: ['Overview', 'Vaults', 'Town Level', 'Profile'],
  init: function () { return { collected: false, upgrades: {} }; },
  draw: function (ui, st, tab) {
    if (tab === 0) {
      const a = ui.panel(16, 146, 880, 562, 'Production since last collection');
      const rows = [
        ['Mine', 'mine', 'mine', '38 stone, 31 copper, 1 tin'], ['Farm', 'farm', 'farm', '24 turnip, 9 parsley'],
        ['Lumber Mill', 'lumber', 'lumber_mill', '30 pine, 14 rawhide, 6 squirrel'], ['Alchemist', 'alchemist', 'alchemist', '3 strength food'],
      ];
      rows.forEach(function (r, i) {
        const y = a.y + i * 100;
        const crew = Object.keys(BLD_JOBS).filter((k) => k.split('.')[0] === r[1]).reduce((n, k) => n + BLD_JOBS[k].length, 0);
        ui.card(a.x, y, a.w, 92);
        ui.art(a.x + 10, y + 10, 72, 72, r[0]);
        ui.text(a.x + 98, y + 14, r[0], { size: 24, title: true, color: BLD_T.gold });
        ui.text(a.x + 98, y + 54, crew + (crew === 1 ? ' hero working' : ' heroes working'), { size: 18, color: BLD_T.dim });
        ui.text(a.x + 300, y + 34, st.collected ? 'Nothing new yet' : r[3], { size: 20, color: st.collected ? BLD_T.dim : BLD_T.good, fit: 380 });
        if (i === 1 && !st.collected) ui.text(a.x + 300, y + 62, 'Food vault full: extra is in worker Overflow', { size: 16, color: BLD_T.amber });
        ui.button(a.x + a.w - 136, y + 18, 124, 56, 'Visit  ›', function () { ui.go(r[2]); });
      });
      ui.button(a.x, 628, a.w, 68, 'Collect All', function () { st.collected = true; ui.refresh(); ui.toast('Everything collected into the vaults (placeholder)'); },
        { kind: st.collected ? 'off' : 'main', why: 'Nothing to collect', size: 26 });

      const w = ui.panel(908, 146, 356, 562, 'Where heroes are');
      const people = [];
      Object.keys(BLD_JOBS).forEach((k) => BLD_JOBS[k].forEach((id) => people.push([bldHeroById(id), BLD_JOB_NAMES[k.split('.')[0]]])));
      BLD_AWAY.forEach((e) => e.team.forEach((id) => people.push([bldHeroById(id), 'Expedition'])));
      ui.list('people', w, people, 68, function (p, x, y, cw, h) {
        ui.card(x, y, cw, h);
        ui.slot(x + 6, y + 6, 48, { icon: bldInitials(p[0]), filled: true });
        ui.text(x + 62, y + 8, p[0].name, { size: 18, bold: true, fit: cw - 68 });
        ui.text(x + 62, y + 33, p[1], { size: 16, color: BLD_T.amber });
      });
    }

    if (tab === 1) {
      ui.text(24, 150, 'Town levels 1-10: three upgrades per vault, each 2,000 gold + 500 stone + 500 wood. A full vault stops its production.', { size: 19, color: BLD_T.dim, fit: 1232 });
      const vaults = [['Ore', 31], ['Wood & Hide', 18], ['Food', 50], ['Foraging', 9], ['Cloth', 4], ['Crystals', 12], ['Crystal Dust', 3], ['Consumables', 7]];
      vaults.forEach(function (v, i) {
        const x = 16 + (i % 4) * 314, y = 184 + Math.floor(i / 4) * 266;
        const full = v[1] >= 50, done = st.upgrades[v[0]] === undefined ? (i === 0 ? 1 : 0) : st.upgrades[v[0]];
        ui.card(x, y, 306, 258, { stroke: full ? BLD_C.bad : undefined });
        ui.text(x + 153, y + 10, v[0], { size: 23, title: true, color: BLD_T.gold, ox: 0.5 });
        ui.art(x + 16, y + 46, 70, 70, 'vault');
        ui.text(x + 100, y + 52, full ? 'FULL' : 'Slots used', { size: 18, color: full ? BLD_T.bad : BLD_T.dim, bold: full });
        ui.text(x + 100, y + 78, v[1] + ' / 50', { size: 26, bold: true });
        ui.bar(x + 16, y + 128, 274, 18, v[1] / 50, full ? BLD_C.bad : BLD_C.blue);
        ui.text(x + 16, y + 157, 'Upgrades', { size: 17, color: BLD_T.dim });
        ui.pips(x + 108, y + 158, done, 3);
        ui.button(x + 16, y + 192, 130, 54, 'Open', function () {
          ui.popup(v[0] + ' vault', 1000, 560, function (u, mx, my, mw) {
            u.text(mx + 24, my + 62, 'One kind of item per slot, stacks of up to 100. (Sample contents.)', { size: 19, color: BLD_T.dim });
            const cells = []; for (let n = 0; n < 50; n++) cells.push(n);
            u.grid('vaultopen', { x: mx + 24, y: my + 98, w: mw - 48, h: 440 }, cells, 10, 84, function (n, cx, cy, cw) {
              u.slot(cx + (cw - 80) / 2, cy, 80, n < v[1] ? { filled: true, icon: '▪', label: 'x' + (100 - (n * 13) % 80) } : {});
            });
          });
        });
        ui.button(x + 158, y + 192, 132, 54, 'Upgrade', function () { st.upgrades[v[0]] = done + 1; ui.refresh(); },
          { kind: done >= 3 ? 'off' : 'main', why: 'All upgrades for this town level band are done' });
      });
    }

    if (tab === 2) {
      const a = ui.panel(16, 146, 620, 562, 'Town level 3 of 50', 'sample');
      ui.art(a.x, a.y, a.w, 156, 'TOWN HALL ART', { feature: true });
      ui.text(a.x, a.y + 170, 'To buy town level 4 you need:', { size: 22, bold: true });
      [['Main character level', 'per level table (not final)', true], ['Mine level 4', 'now 4', true], ['Farm level 4', 'now 3', false], ['Lumber Mill level 4', 'now 4', true]].forEach(function (r, i) {
        const y = a.y + 204 + i * 52;
        ui.card(a.x, y, a.w, 46);
        ui.text(a.x + 14, y + 10, (r[2] ? '✓  ' : '✗  ') + r[0], { size: 21, bold: true, color: r[2] ? BLD_T.good : BLD_T.bad });
        ui.text(a.x + a.w - 14, y + 13, r[1], { size: 17, ox: 1, color: BLD_T.dim });
      });
      ui.button(a.x, 628, a.w, 68, 'Upgrade Town', null, { kind: 'off', why: 'The Farm is not high enough yet', size: 24 });

      const t = ui.panel(648, 146, 616, 562, 'What each tier opens');
      ui.text(t.x + 190, t.y, 'Town level', { size: 17, color: BLD_T.dim });
      ui.text(t.x + 340, t.y, 'Main character needed', { size: 17, color: BLD_T.dim });
      const need = ['-', '8', '17', '26', '35', '45'];
      RARITIES.forEach(function (r, i) {
        const y = t.y + 28 + i * 60;
        ui.card(t.x, y, t.w, 54, { stripe: RARITY_COLOR[i], selected: i === 0 });
        ui.text(t.x + 24, y + 15, r, { size: 21, bold: true, color: RARITY_TEXT[i] });
        ui.text(t.x + 232, y + 15, BLD_HIRES.townLevel[i], { size: 21, ox: 0.5 });
        ui.text(t.x + 430, y + 15, need[i], { size: 21, ox: 0.5 });
      });
      ui.text(t.x, t.y + 400, 'New smiths, enchanters and material tiers open at these levels.', { size: 18, color: BLD_T.dim, wrap: t.w });
      ui.text(t.x, t.y + 460, 'Main character gates are working drafts.', { size: 18, color: BLD_T.amber });
    }

    if (tab === 3) {
      ui.tag(24, 154, 'NOT DESIGNED YET: suggested spots only');
      const p = ui.panel(16, 186, 420, 522, 'Account');
      ui.art(p.x + 118, p.y, 160, 160, 'AVATAR');
      ui.text(p.x + p.w / 2, p.y + 178, 'Player name', { size: 24, bold: true, ox: 0.5 });
      ui.text(p.x + p.w / 2, p.y + 216, 'Account level 12 of 100', { size: 20, ox: 0.5 });
      ui.bar(p.x + 20, p.y + 252, p.w - 40, 24, 0.4, BLD_C.blue, 'XP to next level');
      const s = ui.panel(448, 186, 408, 522, 'Stats');
      ['Heroes owned', 'Campaign progress', 'Tower best floor', 'Arena rank', 'Quests finished', 'Items crafted'].forEach(function (n, i) {
        ui.card(s.x, s.y + i * 60, s.w, 52);
        ui.text(s.x + 14, s.y + i * 60 + 15, n, { size: 20 });
        ui.text(s.x + s.w - 14, s.y + i * 60 + 15, '—', { size: 20, ox: 1 });
      });
      const o = ui.panel(868, 186, 396, 522, 'Settings');
      ['Music', 'Sound effects', 'Notifications', 'Battle speed', 'Save data', 'Help'].forEach(function (n, i) {
        ui.button(o.x, o.y + i * 72, o.w, 62, n, null);
      });
    }
  },
};

// A "digging" or "clearing" crew panel with no worker limit
function bldLevelCrew(ui, title, art, jobKey, level, frac, note) {
  const a = ui.panel(16, 84, 304, 624, title);
  ui.art(a.x, a.y, a.w, 154, art, { feature: true });
  ui.text(a.x, a.y + 166, level, { size: 24, bold: true });
  ui.bar(a.x, a.y + 200, a.w, 24, frac, BLD_C.amber, Math.round(frac * 100) + '% to next level');
  ui.text(a.x, a.y + 238, 'Crew (no limit)', { size: 19, color: BLD_T.gold, bold: true });
  ui.scroll(jobKey, a.x, a.y + 266, a.w, 226, Math.ceil(((BLD_JOBS[jobKey] || []).length + 1) / 4) * 74, function () {
    ui.workers(a.x, a.y + 266, jobKey, 0, { perRow: 4, size: 64 });
  });
  ui.text(a.x, a.y + 502, note, { size: 17, color: BLD_T.dim, wrap: a.w });
}

// =============================================================================================
BUILDINGS.mine = {
  title: 'Mine', area: 'Town Hall district  ·  stone, ore and the odd crystal', money: ['gold', 'stone'],
  init: function () { return { collected: false }; },
  draw: function (ui, st) {
    bldLevelCrew(ui, 'Digging crew', 'MINE ENTRANCE', 'mine.dig', 'Mine level 4', 0.62, 'Digging levels the Mine and opens new veins. It also has a small chance of finding ore.');
    const a = ui.panel(332, 84, 656, 624, 'Veins', 'up to 5 miners each');
    const veins = [['Copper', 'Tin', '0.2%'], ['Tin', 'Iron', 'higher'], ['Iron', 'Silver', 'higher'], ['Silver', 'Mithril', 'higher'], ['Mithril', 'Adamant', 'higher'], ['Adamant', '', 'highest']];
    ui.list('veins', a, veins, 140, function (v, x, y, w, h, i) {
      const open = i < 1;
      ui.card(x, y, w, h, { stripe: RARITY_COLOR[i], fill: open ? BLD_C.card : 0x18161c });
      ui.art(x + 20, y + 12, 58, 58, 'ore');
      ui.text(x + 90, y + 12, v[0] + ' vein', { size: 23, title: true, color: open ? RARITY_TEXT[i] : BLD_T.off });
      ui.text(x + 90, y + 45, RARITIES[i] + (open ? ' · about 4 per miner each hour' : ' · locked, keep digging'), { size: 16, color: BLD_T.dim, fit: w - 100 });
      ui.workers(x + w - 5 * 62 - 6, y + 70, 'mine.vein' + i, 5, { size: 56, gap: 6, locked: !open });
      ui.text(x + 20, y + 80, v[0] + ' 45%' + (v[1] ? ' · ' + v[1] + ' about 1%' : ''), { size: 16, color: open ? BLD_T.main : BLD_T.off, fit: 300 });
      ui.text(x + 20, y + 104, 'Crystal chance ' + v[2] + ' · rest stone', { size: 16, color: open ? BLD_T.main : BLD_T.off, fit: 300 });
    });
    ui.output(1000, 84, 264, 624, st, [['Stone', 38], ['Copper ore', 31], ['Tin ore', 1]], [['Ore', 31, 50]]);
  },
};

// =============================================================================================
const BLD_CROPS = [
  ['Wisdom crops', ['Turnip', 'Carrot', 'Beet', 'Moonroot', 'Starbloom Squash', 'Sunroot']],
  ['Intelligence crops', ['Apple', 'Pear', 'Blueberry', 'Pomegranate', 'Glowing Starfruit', 'Dreamfruit']],
  ['Cloth', ['Flax', 'Cotton', 'Wool', 'Silk', 'Moonsilk', 'Starweave']],
];

BUILDINGS.farm = {
  title: 'Farm', area: 'Town Hall district  ·  crops, foraging, cloth', money: ['gold'],
  tabs: ['Crop Fields', 'Foraging', 'Animals'],
  init: function () { return { collected: false, crops: ['Turnip', '', '', '', ''] }; },
  draw: function (ui, st, tab) {
    ui.card(16, 146, 968, 52);
    ui.text(32, 160, 'Farm level 3', { size: 22, bold: true });
    ui.bar(196, 160, 380, 24, 0.45, BLD_C.amber, '45% to level 4');
    ui.text(592, 163, 'Crops and foraging both add to it', { size: 18, color: BLD_T.dim });

    if (tab === 0) {
      const crew = (BLD_JOBS['farm.crop'] || []).length;
      const need = [1, 3, 5, 7, null];
      st.crops.forEach(function (crop, i) {
        const x = 16 + i * 195;
        const open = need[i] !== null && crew >= need[i];
        ui.card(x, 210, 188, 322, { fill: open ? BLD_C.card : 0x18161c });
        ui.text(x + 94, 220, 'Field ' + (i + 1), { size: 21, title: true, color: open ? BLD_T.gold : BLD_T.off, ox: 0.5 });
        ui.art(x + 12, 254, 164, 150, open ? (crop || 'empty field') : 'LOCKED');
        ui.text(x + 94, 416, open ? (crop || 'Nothing planted') : need[i] ? 'Needs ' + need[i] + ' crop workers' : 'Rule not set yet', { size: 17, ox: 0.5, color: open ? BLD_T.main : BLD_T.off, fit: 176 });
        if (open) ui.text(x + 94, 442, 'about 3 per worker an hour', { size: 14, color: BLD_T.dim, ox: 0.5 });
        ui.button(x + 12, 470, 164, 50, 'Choose crop', function () {
          ui.popup('Plant in field ' + (i + 1), 1100, 450, function (u, mx, my) {
            BLD_CROPS.forEach(function (group, g) {
              u.text(mx + 24, my + 68 + g * 122, group[0], { size: 21, bold: true, color: BLD_T.gold });
              group[1].forEach(function (name, r) {
                u.button(mx + 24 + r * 176, my + 100 + g * 122, 168, 70, name, function () {
                  if (r > 0) { u.toast(RARITIES[r] + ' crops unlock later (sample town)'); return; }
                  st.crops[i] = name; u.close();
                }, { size: 18 });
                u.rect(mx + 34 + r * 176, my + 159 + g * 122, 148, 5, { fill: RARITY_COLOR[r], r: 2 });
              });
            });
          });
        }, { kind: open ? 'main' : 'off', why: need[i] ? 'Add more crop workers' : 'The fifth field rule is not set yet' });
      });
      ui.panel(16, 544, 968, 164, 'Crop workers', crew + ' working');
      ui.scroll('cropcrew', 30, 592, 940, 100, Math.ceil((crew + 1) / 12) * 74, function () { ui.workers(30, 592, 'farm.crop', 0, { perRow: 12 }); });
    }

    if (tab === 1) {
      const fam = [['Herbs', 'parsley, mint, clover'], ['Mushrooms', 'button, field, puffball'], ['Roots', 'dandelion, burdock, chicory'],
        ['Flowers', 'daisy, buttercup, violet'], ['Berries', 'blackberry, raspberry, elderberry'], ['Bark, Sap, Moss', 'pine bark, birch sap, moss']];
      fam.forEach(function (f, i) {
        const x = 16 + (i % 3) * 326, y = 210 + Math.floor(i / 3) * 163;
        ui.card(x, y, 316, 156);
        ui.art(x + 12, y + 12, 92, 92, f[0]);
        ui.text(x + 116, y + 16, f[0], { size: 21, title: true, color: BLD_T.gold, fit: 190 });
        ui.text(x + 116, y + 52, 'Common finds: ' + f[1], { size: 16, color: BLD_T.dim, wrap: 188 });
        ui.text(x + 12, y + 122, 'Three finds in each of six rarities', { size: 16 });
      });
      ui.panel(16, 544, 968, 164, 'Foragers', 'finds are random');
      const n = (BLD_JOBS['farm.forage'] || []).length;
      ui.scroll('forage', 30, 592, 940, 100, Math.ceil((n + 1) / 12) * 74, function () { ui.workers(30, 592, 'farm.forage', 0, { perRow: 12 }); });
    }

    if (tab === 2) {
      ui.tag(24, 214, 'NOT DECIDED: how animals are worked');
      ['Chicken', 'Sheep', 'Pig', 'Cow', 'Milk Goat of the High Pastures', 'Golden Stag'].forEach(function (n, i) {
        const x = 16 + (i % 3) * 326, y = 248 + Math.floor(i / 3) * 232;
        ui.card(x, y, 316, 220, { stripe: RARITY_COLOR[i] });
        ui.art(x + 24, y + 14, 278, 122, n);
        ui.text(x + 24, y + 146, n, { size: 20, bold: true, color: RARITY_TEXT[i], fit: 278 });
        ui.text(x + 24, y + 178, RARITIES[i] + ' · raises Vitality', { size: 17, color: BLD_T.dim });
      });
    }

    ui.output(996, 146, 268, 562, st, [['Turnip', 24], ['Parsley', 6], ['Mint', 3]], [['Food', 50, 50], ['Foraging', 9, 50]]);
  },
};

// =============================================================================================
BUILDINGS.lumber_mill = {
  title: 'Lumber Mill', area: 'Town Hall district  ·  wood, hide and meat', money: ['gold', 'wood'],
  init: function () { return { collected: false }; },
  draw: function (ui, st) {
    bldLevelCrew(ui, 'Clearing crew', 'SAWMILL', 'lumber.dig', 'Mill level 4', 0.3, 'Clearing levels the Mill. Each level opens a new area.');
    const a = ui.panel(332, 84, 656, 624, 'Groves and hunting grounds');
    const areas = [['Pine', 'Rawhide', 'squirrel, boar'], ['Oak', 'Tanned Leather', 'hare, goat'], ['Ash', 'Thick Hide', 'deer, bear'],
      ['Yew', 'Drake Hide', 'elk, ox'], ['Ironwood', 'Wyvern Hide', 'panther, direwolf'], ['Heartwood', 'Dragon Hide', 'wyvern cut, dragon cut']];
    ui.list('areas', a, areas, 166, function (v, x, y, w, h, i) {
      const open = i < 1;
      ui.card(x, y, w, h, { stripe: RARITY_COLOR[i], fill: open ? BLD_C.card : 0x18161c });
      ui.art(x + 20, y + 12, 150, 66, 'area art');
      ui.text(x + 182, y + 12, 'Area ' + (i + 1) + ': ' + v[0], { size: 23, title: true, color: open ? RARITY_TEXT[i] : BLD_T.off, fit: w - 192 });
      ui.text(x + 182, y + 45, v[1] + ' · ' + v[2], { size: 17, color: BLD_T.dim, fit: w - 192 });
      if (!open) ui.text(x + 182, y + 66, 'Locked: keep clearing', { size: 15, color: BLD_T.off });
      ui.text(x + 20, y + 90, 'Woodworkers', { size: 15, color: BLD_T.dim });
      ui.workers(x + 20, y + 108, 'lumber.wood' + i, 3, { size: 46, gap: 6, locked: !open });
      ui.text(x + 204, y + 90, 'Hunters', { size: 15, color: BLD_T.dim });
      ui.workers(x + 204, y + 108, 'lumber.hunt' + i, 2, { size: 46, gap: 6, locked: !open });
      ui.chip(x + w - 190, y + 112, 'Encounters', { w: 176, h: 40, onTap: function () {
        ui.popup('Area ' + (i + 1) + ' encounters', 640, 270, function (u, mx, my, mw) {
          u.text(mx + 24, my + 74, 'Things like a wandering goblin party or bandits. They only give a rare chance at extra items or rare materials.', { size: 21, wrap: mw - 48 });
          u.art(mx + 24, my + 160, mw - 48, 90, 'encounter list');
        });
      } });
    });
    ui.output(1000, 84, 264, 624, st, [['Pine', 30], ['Rawhide', 14], ['Squirrel', 6]], [['Wood & Hide', 18, 50], ['Food', 50, 50]]);
  },
};

// =============================================================================================
BUILDINGS.blacksmith = {
  title: 'Blacksmith', area: 'Town Hall district  ·  craft, improve and salvage gear', money: ['gold'],
  tabs: ['Craft', 'Level Up', 'Reforge', 'Salvage', 'Hire a Smith'],
  init: function () { return { recipe: 'g0', lvl: 'g2', ref: 'g2', sal: 'g8', line: 0, reforges: 1, hired: 0, salvaged: [], taught: { g8: 1 } }; },
  draw: function (ui, st, tab) {
    if (tab === 4) { bldHireScreen(ui, st, BLD_HIRES.smith, 'Smith', (r) => 'Works ' + r + ' materials'); return; }
    const gear = bldMainGear().filter((g) => g.slot && BLD_MC_SLOTS.indexOf(g.slot) !== -1 && st.salvaged.indexOf(g.id) === -1);

    if (tab === 0) {
      const l = ui.panel(16, 146, 372, 562, 'Recipes', 'Smith: ' + RARITIES[st.hired]);
      const known = (g) => g.set === 'Ironbound Battlegear' || g.set === 'Bulwark Plate';
      bldGearList(ui, st, 'recipe', l, gear, (g) => known(g) ? RARITIES[g.rarity] + ' · ' + g.slot : 'Locked: salvage to learn');
      const g = bldGear(st.recipe) || gear[0];
      const m = ui.panel(400, 146, 480, 562, g.name);
      ui.art(m.x, m.y, m.w, 214, 'FORGE AND SMITH', { feature: true });
      ui.text(m.x, m.y + 228, 'How the stats come out', { size: 21, bold: true, color: BLD_T.gold });
      [['Armor', 'fixed, same every time'], ['Vitality', 'fixed, same every time'], ['1 or 2 other attributes', 'roll within a range'], ['Combat stat lines', 'roll: 2 Common, 3 Rare, 4 Legendary']].forEach(function (r, i) {
        const y = m.y + 262 + i * 42;
        ui.card(m.x, y, m.w, 37);
        ui.text(m.x + 10, y + 9, r[0], { size: 18 });
        ui.text(m.x + m.w - 10, y + 10, r[1], { size: 16, ox: 1, color: BLD_T.dim });
      });
      ui.text(m.x, m.y + 436, 'Crafted set pieces can also be worn by heroes (stats only).', { size: 16, color: BLD_T.dim, fit: m.w });
      const c = ui.panel(892, 146, 372, 562, 'Materials needed');
      bldCosts(ui, c.x, c.y, c.w, [['Base material (tier)', '14 / 12'], ['Dungeon set component', '1 / 1'], ['Quest part (best sets)', '0 / 1', false], ['Gold', 'cost not set']]);
      ui.text(c.x, c.y + 236, 'Counts are samples. The base material tier sets the level of gear you can make.', { size: 17, color: BLD_T.dim, wrap: c.w });
      ui.button(c.x, 628, c.w, 68, 'Craft', null, { kind: known(g) ? 'main' : 'off', why: 'Learn this recipe by salvaging dropped copies', size: 26 });
    }

    if (tab === 1 || tab === 2) {
      const key = tab === 1 ? 'lvl' : 'ref';
      const l = ui.panel(16, 146, 372, 562, 'Pick a piece');
      bldGearList(ui, st, key, l, gear);
      const g = bldGear(st[key]) || gear[0];
      const m = ui.panel(400, 146, 480, 562, g.name, RARITIES[g.rarity]);
      ui.art(m.x + 138, m.y, 180, 180, 'item art');
      const c = ui.panel(892, 146, 372, 562, 'Cost');
      if (tab === 1) {
        ui.text(m.x + m.w / 2, m.y + 196, 'Equipment level ' + g.level + '  →  ' + (g.level + 1), { size: 26, bold: true, ox: 0.5 });
        Object.keys(g.stats).forEach(function (k, i) {
          const y = m.y + 244 + i * 44;
          ui.card(m.x, y, m.w, 38);
          ui.text(m.x + 12, y + 9, k, { size: 19 });
          ui.text(m.x + m.w - 12, y + 9, g.stats[k] + '  →  ' + (g.stats[k] + 1), { size: 19, ox: 1, color: BLD_T.good, bold: true });
        });
        ui.text(m.x, m.y + 436, 'Cannot go above your main character level (sample: 12).', { size: 17, color: BLD_T.amber, fit: m.w });
        bldCosts(ui, c.x, c.y, c.w, [['Materials', '20 / 8'], ['Gold', 'cost not set']]);
        ui.button(c.x, 628, c.w, 68, 'Raise Level', null, { kind: 'main', size: 26 });
      } else {
        ui.text(m.x, m.y + 196, 'Tap the one stat to reroll', { size: 21, bold: true, color: BLD_T.gold });
        Object.keys(g.stats).forEach(function (k, i) {
          const y = m.y + 232 + i * 54;
          ui.card(m.x, y, m.w, 48, { selected: st.line === i, onTap: function () { st.line = i; ui.refresh(); } });
          ui.text(m.x + 14, y + 13, k, { size: 20 });
          ui.text(m.x + m.w - 14, y + 13, g.stats[k], { size: 20, ox: 1, bold: true });
        });
        ui.text(m.x, m.y + 460, 'The cost goes up with every reroll.', { size: 17, color: BLD_T.amber });
        bldCosts(ui, c.x, c.y, c.w, [['Materials', '20 / 10'], ['Gold', 'cost not set']]);
        ui.text(c.x, c.y + 124, 'Times reforged: ' + st.reforges, { size: 20 });
        ui.button(c.x, 628, c.w, 68, 'Reforge', null, { kind: 'main', size: 26 });
      }
    }

    if (tab === 3) {
      const l = ui.panel(16, 146, 560, 562, 'Pick a piece to break down');
      bldGearList(ui, st, 'sal', l, gear.filter((g) => g.cls !== 'hero'));
      const g = gear.filter((x) => x.id === st.sal)[0];
      const m = ui.panel(588, 146, 356, 562, 'Salvages needed', 'by drop rarity');
      RARITIES.forEach(function (r, i) {
        const y = m.y + i * 46;
        ui.card(m.x, y, m.w, 40, { selected: g && g.rarity === i, stripe: RARITY_COLOR[i] });
        ui.text(m.x + 22, y + 10, r, { size: 19, color: RARITY_TEXT[i] });
        ui.text(m.x + m.w - 14, y + 10, BLD_SALVAGES[i], { size: 19, bold: true, ox: 1 });
      });
      ui.chip(m.x, 640, 'Auto-salvage rules', { w: 200, onTap: function () { ui.todo('Auto-salvage'); } });
      ui.tag(m.x + 210, 646, 'IDEA');
      const c = ui.panel(956, 146, 308, 562, 'This piece');
      if (!g) ui.text(c.x, c.y + 10, 'Pick a piece.', { size: 20, color: BLD_T.dim });
      else {
        const need = BLD_SALVAGES[g.rarity], have = Math.min(need, st.taught[g.id] || 0);
        ui.art(c.x + 72, c.y, 140, 140, 'item art');
        ui.text(c.x + c.w / 2, c.y + 150, g.name, { size: 20, bold: true, ox: 0.5, color: RARITY_TEXT[g.rarity], fit: c.w });
        ui.text(c.x, c.y + 192, 'Recipe progress', { size: 18, color: BLD_T.dim });
        ui.bar(c.x, c.y + 218, c.w, 28, have / need, BLD_C.amber, have + ' / ' + need);
        ui.text(c.x, c.y + 262, have < need ? 'This salvage teaches the recipe and gives no materials.' : 'Recipe learned. You get a random range of materials.', { size: 19, wrap: c.w });
        ui.text(c.x, c.y + 346, 'The piece is destroyed for good.', { size: 18, color: BLD_T.amber, wrap: c.w });
      }
      ui.button(c.x, 628, c.w, 68, 'Salvage', function () {
        ui.confirm('Salvage ' + g.name + '?', 'This destroys the piece for good.', 'Salvage', function () { st.salvaged.push(g.id); st.sal = ''; }, 'bad');
      }, { kind: g ? 'bad' : 'off', why: 'Pick a piece first', size: 26 });
    }
  },
};

// =============================================================================================
const BLD_BREWS = [
  ['Strength food', 0, 'Boar'], ['Dexterity food', 0, 'Squirrel'], ['Wisdom food', 0, 'Turnip'], ['Intelligence food', 0, 'Apple'], ['Vitality food', 0, 'Chicken product'],
  ['Crit Chance potion', 1, ''], ['Damage potion', 1, ''], ['Armor potion', 1, ''], ['Accuracy potion', 1, ''], ['Fire resistance potion', 1, ''], ['Poison resistance potion', 1, ''],
];

BUILDINGS.alchemist = {
  title: 'Alchemist', area: 'Town Hall district  ·  food and potions', money: ['gold'],
  tabs: ['Brew', 'Transmute'],
  init: function () { return { filter: 0, brew: 0, qty: 1, queue: [['Strength food', 3], ['Armor potion', 2]], collected: false }; },
  draw: function (ui, st, tab) {
    const crew = (BLD_JOBS['alchemist.track'] || []).length;
    ui.panel(16, 146, 1248, 138, 'Worker track', crew + ' working');
    const reward = ['Base queue', '+ Queue time', 'Extra copy', 'Rarity up'];
    const list = BLD_JOBS['alchemist.track'] || [];
    ui.scroll('track', 28, 190, 1222, 86, 86, function () {
      for (let i = 0; i < 10; i++) {
        const x = 62 + i * 121;
        const kind = i === 0 ? 0 : 1 + ((i - 1) % 3);
        const hero = list[i] ? bldHeroById(list[i]) : null;
        ui.slot(x, 190, 60, { filled: !!hero, icon: hero ? bldInitials(hero) : (i === list.length ? '+' : ''), onTap: hero ? function () {
          ui.confirm('Remove ' + hero.name + '?', 'They stop working here and are free for your team again.', 'Remove', function () { BLD_JOBS['alchemist.track'] = list.filter((id) => id !== hero.id); });
        } : i === list.length ? function () {
          ui.pickHero('Assign a hero', function (h) { BLD_JOBS['alchemist.track'] = list.concat([h.id]); });
        } : undefined });
        ui.text(x + 30, 256, reward[kind], { size: 15, ox: 0.5, color: hero ? BLD_T.good : BLD_T.dim, fit: 116 });
      }
    });

    if (tab === 0) {
      const l = ui.panel(16, 296, 400, 412, 'Recipes');
      ui.choice(l.x, l.y, ['All', 'Food', 'Potions'], st, 'filter');
      const shown = BLD_BREWS.map((b, i) => i).filter((i) => st.filter === 0 || BLD_BREWS[i][1] === st.filter - 1);
      ui.list('brews' + st.filter, { x: l.x, y: l.y + 44, w: l.w, h: l.h - 44 }, shown, 60, function (i, x, y, w, h) {
        ui.card(x, y, w, h, { selected: st.brew === i, onTap: function () { st.brew = i; ui.refresh(); } });
        ui.art(x + 8, y + 8, 36, 36, '');
        ui.text(x + 54, y + 7, BLD_BREWS[i][0], { size: 19, bold: true });
        ui.text(x + 54, y + 31, BLD_BREWS[i][1] ? 'Potion · Common' : 'Food · Common', { size: 15, color: BLD_T.dim });
      });
      const b = BLD_BREWS[st.brew];
      const m = ui.panel(428, 296, 424, 412, b[0]);
      ui.art(m.x, m.y, 130, 130, 'BREW ART', { feature: true });
      ui.text(m.x + 144, m.y + 4, b[1] ? 'Passive combat bonus' : 'Attribute boost', { size: 20, bold: true, wrap: m.w - 148 });
      ui.text(m.x + 144, m.y + 62, 'Lasts until the node or activity ends', { size: 17, color: BLD_T.dim, wrap: m.w - 148 });
      bldCosts(ui, m.x, m.y + 142, m.w, [[b[2] ? 'Main ingredient: ' + b[2] : 'Ingredients not set', b[2] ? '12 / 3' : '—'], ['Brew time', 'not set']]);
      ui.button(m.x, 636, 62, 60, '−', function () { st.qty = Math.max(1, st.qty - 1); ui.refresh(); }, { size: 30 });
      ui.text(m.x + 92, 666, st.qty, { size: 28, bold: true, ox: 0.5, oy: 0.5 });
      ui.button(m.x + 122, 636, 62, 60, '+', function () { st.qty = Math.min(20, st.qty + 1); ui.refresh(); }, { size: 30 });
      ui.button(m.x + 196, 636, m.w - 196, 60, 'Add to queue', function () { st.queue.push([b[0], st.qty]); st.qty = 1; ui.refresh(); }, { kind: 'main' });

      const q = ui.panel(864, 296, 400, 412, 'Brew queue', 'one queue for all');
      const hours = st.queue.reduce((n, x) => n + x[1] * 1.5, 0);
      const cap = Math.min(48, 8 + Math.max(0, Math.ceil((list.length - 1) / 3)) * 4);
      ui.bar(q.x, q.y, q.w, 24, hours / cap, hours > cap ? BLD_C.bad : BLD_C.blue, hours + 'h of ' + cap + 'h (sample)');
      ui.list('queue', { x: q.x, y: q.y + 34, w: q.w, h: 196 }, st.queue, 50, function (row, x, y, w, h, i) {
        ui.card(x, y, w, h);
        ui.text(x + 10, y + 11, (i === 0 ? '▶ ' : '') + row[0] + '  x' + row[1], { size: 18, fit: w - 70 });
        ui.chip(x + w - 48, y + 5, '×', { w: 40, h: 32, onTap: function () { st.queue.splice(i, 1); ui.refresh(); } });
      });
      ui.text(q.x, 598, 'Brewing stops when the consumables vault is full.', { size: 15, color: BLD_T.dim, fit: q.w });
      ui.text(q.x, 618, st.collected ? 'Nothing ready yet' : 'Ready: 3 strength food', { size: 17, color: BLD_T.good });
      ui.button(q.x, 646, q.w, 50, 'Collect', function () { st.collected = true; ui.refresh(); }, { kind: st.collected ? 'off' : 'main', why: 'Nothing ready' });
    } else {
      ui.panel(16, 296, 1248, 412, 'Transmute', 'instant, does not use the brew queue');
      ui.slot(90, 370, 170, { icon: '+', label: 'Surplus material', onTap: function () { ui.todo('Choose material'); } });
      ui.text(354, 400, '→', { size: 90, color: BLD_T.gold, ox: 0.5 });
      ui.slot(450, 370, 170, { icon: '?', label: 'Scarcer material' });
      ui.text(90, 560, 'Trade ratio: not set', { size: 20, color: BLD_T.dim });
      ui.button(90, 614, 530, 72, 'Transmute', null, { kind: 'main', size: 26 });
      ui.text(668, 354, 'Possible bonuses', { size: 24, title: true, color: BLD_T.gold });
      ['Uses one fewer item', 'Result comes out one tier higher', 'Double or extra items'].forEach(function (t, i) {
        const y = 396 + i * 78;
        ui.card(668, y, 580, 68);
        ui.text(688, y + 22, t, { size: 21 });
        ui.text(1230, y + 22, 'chance not set', { size: 18, ox: 1, color: BLD_T.dim });
      });
      ui.text(668, 650, 'More heroes on the track means better odds.', { size: 20, color: BLD_T.good });
    }
  },
};

// =============================================================================================
BUILDINGS.enchanter = {
  title: 'Enchanter', area: 'Town Hall district  ·  rarity and crystals', money: ['gold', 'dust'],
  tabs: ['Upgrade Rarity', 'Skill Crystals', 'Bonus Crystals', 'Combine', 'Break Down', 'Hire'],
  init: function () { return { up: 'g2', skill: 'g21', opt: -1, bonus: 'g0', hired: 0, dupe: 2, socket: ['Damage', 'Resist'] }; },
  draw: function (ui, st, tab) {
    if (tab === 5) { bldHireScreen(ui, st, BLD_HIRES.enchanter, 'Enchanter', () => 'Upgrade limit per hire: to confirm'); return; }
    const gear = bldMainGear().filter((g) => BLD_MC_SLOTS.indexOf(g.slot) !== -1);

    if (tab === 0) {
      const l = ui.panel(16, 146, 372, 562, 'Pick a piece');
      bldGearList(ui, st, 'up', l, gear);
      const g = bldGear(st.up);
      const m = ui.panel(400, 146, 480, 562, g.name, 'Dropped piece (sample)');
      ui.art(m.x, m.y, m.w, 250, 'ENCHANTING TABLE', { feature: true });
      ui.text(m.x, m.y + 264, 'Rarity ladder', { size: 21, bold: true, color: BLD_T.gold });
      RARITIES.forEach(function (r, i) {
        const y = m.y + 296 + Math.floor(i / 3) * 50, x = m.x + (i % 3) * 153;
        ui.card(x, y, 146, 43, { selected: i === g.rarity, stroke: RARITY_COLOR[i] });
        ui.text(x + 73, y + 21, (i === g.rarity + 1 ? '→ ' : '') + r, { size: 18, bold: i >= g.rarity, color: i < g.rarity ? BLD_T.off : RARITY_TEXT[i], ox: 0.5, oy: 0.5 });
      });
      ui.text(m.x, m.y + 404, 'Dropped gear can reach Mythical. Crafted gear can climb 3 rungs.', { size: 17, color: BLD_T.dim, wrap: m.w });
      const c = ui.panel(892, 146, 372, 562, 'Next rung');
      const cost = BLD_UPGRADE_COSTS[g.rarity];
      bldCosts(ui, c.x, c.y, c.w, [['Crystal dust', cost[0], g.rarity < 2], ['Gold', cost[1], g.rarity < 3]]);
      ui.text(c.x, c.y + 126, 'The last rung before a piece reaches its ceiling costs about 3 times as much.', { size: 18, color: BLD_T.amber, wrap: c.w });
      ui.text(c.x, c.y + 214, 'Your hire: ' + RARITIES[st.hired] + ' Enchanter. A better enchanter can take pieces higher.', { size: 18, color: BLD_T.dim, wrap: c.w });
      ui.button(c.x, 628, c.w, 68, 'Upgrade', null, { kind: 'main', size: 26 });
    }

    if (tab === 1) {
      const l = ui.panel(16, 146, 372, 562, 'Your generic pieces', 'main character only');
      const generic = gear.filter((g) => !g.cls);
      bldGearList(ui, st, 'skill', l, generic);
      const g = bldGear(st.skill) && !bldGear(st.skill).cls && bldGear(st.skill).slot ? (generic.filter((x) => x.id === st.skill)[0] || generic[0]) : generic[0];
      const passive = ['Off Hand', 'Gloves', 'Feet'].indexOf(g.slot) !== -1;
      const m = ui.panel(400, 146, 336, 562, g.name);
      ui.art(m.x + 76, m.y, 160, 150, 'item art');
      ui.text(m.x + m.w / 2, m.y + 164, g.slot + ': ' + (g.slot === 'Main Hand' ? 'basic attack' : passive ? 'passive skill' : 'active skill'), { size: 21, bold: true, ox: 0.5 });
      ui.slot(m.x + 96, m.y + 202, 120, { icon: '◆', label: 'Crystal', filled: true, onTap: function () { ui.todo('Choose a crystal'); } });
      ui.text(m.x, m.y + 340, g.slot === 'Main Hand' ? "The weapon's damage tag decides which basic attacks open. A rare second crystal can change the damage type." : 'Active crystals fit active slots and passive crystals fit passive slots.', { size: 17, color: BLD_T.dim, wrap: m.w });
      ui.text(m.x, m.y + 460, 'Class set pieces keep their own skills, so they are not listed.', { size: 16, color: BLD_T.amber, wrap: m.w });
      const r = ui.panel(748, 146, 516, 562, 'Choose 1 of 3 skills', 'sample');
      [0, 1, 2].forEach(function (i) {
        const y = r.y + i * 130;
        ui.card(r.x, y, r.w, 120, { selected: st.opt === i, onTap: function () { st.opt = i; ui.refresh(); } });
        ui.art(r.x + 12, y + 18, 82, 82, 'icon');
        ui.text(r.x + 108, y + 20, (passive ? 'Passive' : g.slot === 'Main Hand' ? 'Basic attack' : 'Active') + ' option ' + (i + 1), { size: 22, bold: true, color: BLD_T.gold });
        ui.text(r.x + 108, y + 58, 'Skill description goes here once crystal skills are written.', { size: 17, wrap: r.w - 122 });
      });
      ui.button(r.x, 628, r.w, 68, 'Attach to piece', function () {
        ui.confirm('Attach this skill?', 'Attaching is permanent once crafted.', 'Attach', function () { st.opt = -1; });
      }, { kind: st.opt < 0 ? 'off' : 'main', why: 'Pick a skill first', size: 24 });
    }

    if (tab === 2) {
      const l = ui.panel(16, 146, 372, 562, 'Your gear or hero gear');
      bldGearList(ui, st, 'bonus', l, bldMainGear().slice(0, 8).concat(bldHeroGear()));
      const g = bldGear(st.bonus);
      const m = ui.panel(400, 146, 480, 562, g.name, 'Bonus sockets');
      ui.art(m.x + 138, m.y, 180, 180, 'item art');
      for (let i = 0; i < 4; i++) {
        const name = st.socket[i];
        ui.slot(m.x + 10 + i * 114, m.y + 204, 98, { icon: name ? '◆' : '+', filled: !!name, label: name || 'Empty', onTap: function () { ui.todo('Socket a crystal'); } });
      }
      ui.text(m.x, m.y + 324, 'Cap is about 3 or 4 per piece (not final).', { size: 18, color: BLD_T.amber });
      ui.text(m.x, m.y + 362, 'Only one crystal per category. A new one of the same category replaces the old one. Different categories can sit together.', { size: 19, wrap: m.w });
      const c = ui.panel(892, 146, 372, 562, 'Your bonus crystals', 'sample');
      ['Fire Damage', 'Ice Damage', 'Fire Resistance', 'Physical Resistance'].forEach(function (n, i) {
        ui.card(c.x, c.y + i * 72, c.w, 64, { onTap: function () { ui.todo('Socket ' + n); } });
        ui.text(c.x + 16, c.y + i * 72 + 9, '◆  ' + n, { size: 20, bold: true });
        ui.text(c.x + 16, c.y + i * 72 + 38, 'Category: ' + (i < 2 ? 'Damage Type' : 'Resistance Type'), { size: 15, color: BLD_T.dim });
      });
      ui.button(c.x, 628, c.w, 68, 'Apply', null, { kind: 'main', size: 26 });
    }

    if (tab === 3) {
      ui.panel(16, 146, 1248, 562, 'Combine crystals', 'sharpens one main character loadout');
      [['First crystal', 90], ['Second crystal', 460], ['Result', 990]].forEach(function (c, i) {
        ui.text(c[1] + 100, 224, c[0], { size: 26, title: true, color: BLD_T.gold, ox: 0.5 });
        ui.slot(c[1], 268, 200, { icon: i === 2 ? '?' : '+', label: i === 2 ? 'Preview' : 'Choose', onTap: i === 2 ? undefined : function () { ui.todo('Choose crystal'); } });
      });
      ui.text(375, 326, '+', { size: 70, color: BLD_T.gold, ox: 0.5 });
      ui.text(825, 326, '→', { size: 70, color: BLD_T.gold, ox: 0.5 });
      ui.text(640, 512, 'An attack crystal plus a rare modifier crystal can change the damage type.', { size: 21, ox: 0.5 });
      ui.text(640, 546, 'Combine rules are not set yet.', { size: 19, color: BLD_T.amber, ox: 0.5 });
      ui.button(420, 604, 440, 76, 'Combine', null, { kind: 'main', size: 26 });
    }

    if (tab === 4) {
      const a = ui.panel(16, 146, 820, 562, 'Duplicate crystals', 'sample');
      const dupes = []; for (let i = 0; i < 14; i++) dupes.push(i % 5);
      ui.grid('dupes', a, dupes, 6, 122, function (r, x, y, w, h, i) {
        ui.slot(x + (w - 116) / 2, y, 116, { icon: '◆', label: RARITIES[r], filled: true, rarity: r, selected: st.dupe === i, onTap: function () { st.dupe = i; ui.refresh(); } });
      });
      const c = ui.panel(848, 146, 416, 562, 'Dust you get back');
      const pick = dupes[st.dupe];
      RARITIES.forEach(function (r, i) {
        ui.card(c.x, c.y + i * 52, c.w, 46, { selected: pick === i, stripe: RARITY_COLOR[i] });
        ui.text(c.x + 22, c.y + i * 52 + 12, r, { size: 20, color: RARITY_TEXT[i] });
        ui.text(c.x + c.w - 14, c.y + i * 52 + 12, BLD_DUST[i] + ' dust', { size: 20, bold: true, ox: 1 });
      });
      ui.button(c.x, 628, c.w, 68, 'Break down for ' + BLD_DUST[pick] + ' dust', null, { kind: 'bad', size: 22 });
    }
  },
};

// =============================================================================================
// name, time, heroes needed, rarity, wanted traits, bad traits
const BLD_MISSIONS = [
  ['Errand to the Mill', '10 minutes', 1, 0, ['Resourceful'], []],
  ['Clear the Old Manor', '1 hour', 3, 1, ['Sneaky', 'Fearless', 'Keen-Eyed'], ['Dashing']],
  ['Escort the Caravan', '2 hours', 4, 1, ['Stalwart', 'Honorable', 'Charming'], ['Ruthless']],
  ['Marsh Survey', '30 minutes', 2, 0, ['Wild', 'Keen-Eyed'], ['Scholarly']],
  ['The Sunken Chapel', '5 hours', 5, 2, ['Devout', 'Seafaring', 'Fearless'], ['Cursed']],
  ['The Arcane Library', '8 hours', 3, 3, ['Scholarly', 'Arcane', 'Mystic'], ['Brawny', 'Mischievous']],
  ['Siege Rubble', '16 hours', 8, 2, ['Brawny', 'Hardy', 'Tinkerer'], ['Gentle']],
];

BUILDINGS.expedition_hall = {
  title: 'Expedition Hall', area: 'Town Hall district  ·  timed missions', money: ['gold'],
  tabs: [() => 'Active (' + BLD_AWAY.length + ')', 'Mission Board'],
  init: function () { return { tab: 1, mission: 1, team: [] }; },
  draw: function (ui, st, tab) {
    if (tab === 0) {
      if (!BLD_AWAY.length) ui.text(640, 400, 'No one is away. Pick a mission on the board.', { size: 26, color: BLD_T.dim, ox: 0.5 });
      const area = { x: 16, y: 146, w: 1248, h: 562 };
      ui.list('active', area, BLD_AWAY, 156, function (e, x, y, w, h, i) {
        const done = e.done >= 1;
        ui.card(x, y, w, h, { selected: done });
        ui.art(x + 12, y + 12, 190, 124, 'mission art');
        ui.text(x + 220, y + 16, e.name, { size: 28, title: true, color: BLD_T.gold });
        ui.text(x + 220, y + 58, 'Length: ' + e.length, { size: 18, color: BLD_T.dim });
        ui.bar(x + 220, y + 94, 380, 30, e.done, done ? BLD_C.good : BLD_C.blue, e.left);
        e.team.forEach(function (id, n) { const hr = bldHeroById(id); ui.slot(x + 626 + n * 62, y + 46, 56, { filled: true, icon: bldInitials(hr), label: bldShort(hr) }); });
        ui.button(x + w - 200, y + 42, 184, 66, done ? 'Collect' : 'In progress', function () {
          BLD_AWAY.splice(i, 1); ui.refresh(); ui.toast('Rewards collected, heroes are home (placeholder)');
        }, { kind: done ? 'main' : 'off', why: 'Expeditions cannot be cancelled or ended early' });
      });
      return;
    }
    const l = ui.panel(16, 146, 452, 562, 'Missions', 'rotating board');
    ui.list('missions', l, BLD_MISSIONS, 98, function (m, x, y, w, h, i) {
      ui.card(x, y, w, h, { selected: st.mission === i, stripe: RARITY_COLOR[m[3]], onTap: function () { st.mission = i; st.team = []; ui.refresh(); } });
      ui.text(x + 22, y + 10, m[0], { size: 21, title: true, color: BLD_T.gold, fit: w - 32 });
      ui.text(x + 22, y + 40, m[1] + '  ·  ' + m[2] + (m[2] === 1 ? ' hero' : ' heroes') + '  ·  ' + RARITIES[m[3]], { size: 16, color: RARITY_TEXT[m[3]], fit: w - 32 });
      ui.text(x + 22, y + 64, 'Wants: ' + m[4].join(', '), { size: 16, color: BLD_T.dim, fit: w - 32 });
    });
    const m = BLD_MISSIONS[st.mission];
    const d = ui.panel(480, 146, 784, 562, m[0], m[1] + ' · ' + RARITIES[m[3]]);
    ui.art(d.x, d.y, d.w, 126, 'MISSION ART', { feature: true });
    const traits = [];
    st.team.forEach((id) => bldHeroById(id).traits.forEach((t) => traits.push(t)));
    let y = d.y + 138;
    [['Wants', m[4], BLD_C.good], ['Hurts', m[5], BLD_C.bad]].forEach(function (row) {
      ui.text(d.x, y + 7, row[0], { size: 19, bold: true });
      let x = d.x + 66;
      if (!row[1].length) ui.text(x, y + 7, 'nothing', { size: 18, color: BLD_T.dim });
      row[1].forEach(function (t) {
        const n = traits.filter((v) => v === t).length;
        x += ui.chip(x, y, t + (n ? ' x' + n : ''), { fill: n ? row[2] : 0x221d27, stroke: row[2] }) + 8;
      });
      y += 42;
    });
    ui.text(d.x, d.y + 232, 'Team  ' + st.team.length + ' / ' + m[2], { size: 21, bold: true, color: BLD_T.gold });
    for (let i = 0; i < m[2]; i++) {
      const hr = st.team[i] ? bldHeroById(st.team[i]) : null;
      ui.slot(d.x + i * 95, d.y + 264, 86, { filled: !!hr, icon: hr ? bldInitials(hr) : '+', label: hr ? bldShort(hr) : '', onTap: function () {
        if (hr) { st.team.splice(i, 1); ui.refresh(); return; }
        ui.pickHero('Send who?', function (h) { st.team.push(h.id); }, st.team);
      } });
    }
    const good = traits.filter((t) => m[4].indexOf(t) !== -1).length;
    const bad = traits.filter((t) => m[5].indexOf(t) !== -1).length;
    const score = good - bad;
    ui.bar(d.x, d.y + 362, d.w, 28, Math.max(0, score) / (m[2] * 2), score < 0 ? BLD_C.bad : BLD_C.good,
      'Reward strength:  ' + good + ' matching  −  ' + bad + ' hurting');
    ui.text(d.x, d.y + 402, 'Pays materials and gold. Rare: shards of the heroes sent, a quest hook, or a new expedition.', { size: 17, fit: d.w });
    ui.text(d.x, d.y + 428, 'No cost to send. Heroes are unavailable until it ends, and it cannot be cancelled.', { size: 17, color: BLD_T.amber, fit: d.w });
    const full = st.team.length === m[2];
    ui.button(d.x, 646, d.w, 52, 'Send expedition', function () {
      ui.confirm('Send the team?', 'They are gone for ' + m[1] + '. This cannot be cancelled.', 'Send', function () {
        BLD_AWAY.push({ name: m[0], length: m[1], left: m[1] + ' left', done: 0.02, team: st.team.slice() });
        st.team = []; st.tab = 0;
      });
    }, { kind: full ? 'main' : 'off', why: 'Fill every team slot first', size: 23 });
  },
};
