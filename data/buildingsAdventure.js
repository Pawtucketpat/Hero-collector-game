// buildingsAdventure.js - Adventure District interiors: Endless Tower, Raids, PvP Arena, Dungeons, Hellmouth.
// Most of the rules for these are not decided yet, so these are draft layouts to react to.
// Needs buildings.js loaded first.

// Row of enemy picture boxes
function bldEnemies(ui, x, y, w, h, n, label) {
  const bw = (w - (n - 1) * 10) / n;
  for (let i = 0; i < n; i++) ui.art(x + i * (bw + 10), y, bw, h, (label || 'enemy') + ' ' + (i + 1));
}

// Reward icons in a row
function bldRewards(ui, x, y, labels, size) {
  const s = size || 82;
  labels.forEach(function (l, i) { ui.slot(x + i * (s + 10), y, s, { icon: '▪', label: l, filled: true }); });
}

// =============================================================================================
BUILDINGS.endless_tower = {
  title: 'Endless Tower', area: 'Adventure District', money: ['stamina'], draft: true,
  init: function () { return { floor: 24, scroll: { floors: 4580 } }; },
  draw: function (ui, st) {
    const l = ui.panel(16, 84, 290, 624, 'Floors', '100 (sample)');
    const floors = []; for (let f = 100; f >= 1; f--) floors.push(f);
    ui.list('floors', l, floors, 62, function (f, x, y, w, h) {
      const done = f < 24, now = f === 24;
      ui.card(x, y, w, h, { selected: st.floor === f, fill: now ? 0x4a3512 : done ? 0x1f2a20 : 0x18161c, onTap: function () { st.floor = f; ui.refresh(); } });
      ui.text(x + 14, y + 15, 'Floor ' + f + (f % 10 === 0 ? '  ★ boss' : ''), { size: 19, bold: now, color: done ? BLD_T.good : now ? BLD_T.gold : BLD_T.off });
      ui.text(x + w - 12, y + 15, done ? '✓' : now ? '◀' : '', { size: 20, ox: 1, color: done ? BLD_T.good : BLD_T.gold });
    });
    ui.art(318, 84, 330, 624, 'THE TOWER', { feature: true });
    const f = st.floor;
    const d = ui.panel(660, 84, 604, 624, 'Floor ' + f, 'Resets in 12 days (sample)');
    ui.text(d.x, d.y, 'Enemies', { size: 20, bold: true });
    bldEnemies(ui, d.x, d.y + 30, d.w, 128, 5);
    ui.text(d.x, d.y + 174, 'First clear reward', { size: 20, bold: true });
    bldRewards(ui, d.x, d.y + 204, ['Gold', 'Material', 'Shard']);
    ui.text(d.x, d.y + 306, 'Next milestone: floor ' + Math.ceil((f + 1) / 10) * 10, { size: 20, bold: true });
    ui.tag(d.x + 300, d.y + 307, 'IDEA');
    ui.bar(d.x, d.y + 340, d.w, 28, (f % 10) / 10, BLD_C.amber, (f % 10) + ' / 10 floors');
    ui.button(d.x, d.y + 388, 284, 54, 'Weekly leaderboard', function () { ui.todo('Leaderboard'); });
    ui.tag(d.x + 296, d.y + 404, 'IDEA');
    const state = f < 24 ? 'Cleared' : f === 24 ? 'Climb' : 'Clear floor ' + (f - 1) + ' first';
    ui.button(d.x, 620, d.w, 76, state, function () { ui.todo('Team prep and battle'); }, { kind: f === 24 ? 'main' : 'off', why: f < 24 ? 'Already cleared this reset' : 'Floors go in order', size: 28 });
  },
};

// =============================================================================================
BUILDINGS.raids = {
  title: 'Raids', area: 'Adventure District  ·  big boss fights', money: ['stamina'], draft: true,
  init: function () { return { diff: 0, boss: 0 }; },
  draw: function (ui, st) {
    const l = ui.panel(16, 84, 280, 624, 'Raid bosses');
    ['Sample Boss: Dragon', 'Sample Boss: Lich', 'Sample Boss: Colossus'].forEach(function (n, i) {
      const y = l.y + i * 150;
      ui.card(l.x, y, l.w, 140, { selected: st.boss === i, onTap: function () { st.boss = i; ui.refresh(); } });
      ui.art(l.x + 10, y + 10, l.w - 20, 88, 'boss thumbnail');
      ui.text(l.x + l.w / 2, y + 108, n, { size: 18, bold: true, ox: 0.5, fit: l.w - 12 });
    });
    ui.art(308, 84, 560, 440, 'RAID BOSS ART', { feature: true });
    ui.panel(308, 536, 560, 172, 'Boss mechanics', 'sample');
    ['Shields', 'Wards', 'Damage over time'].forEach(function (m, i) {
      ui.card(322 + i * 180, 586, 172, 108);
      ui.art(376 + i * 180, 594, 64, 58, 'icon');
      ui.text(408 + i * 180, 664, m, { size: 18, bold: true, ox: 0.5, fit: 164 });
    });
    const r = ui.panel(880, 84, 384, 624, 'This week', 'ends in 4d');
    ui.choice(r.x, r.y, ['Normal', 'Hard', 'Nightmare'], st, 'diff', { w: 114, h: 46, size: 18 });
    ui.text(r.x, r.y + 66, 'Your best damage', { size: 19, color: BLD_T.dim });
    ui.bar(r.x, r.y + 94, r.w, 32, 0.35, BLD_C.bad, '35% of boss health (sample)');
    ui.text(r.x, r.y + 146, 'Rewards by damage dealt', { size: 20, bold: true });
    ['25% damage', '50% damage', '100% damage'].forEach(function (t, i) {
      const y = r.y + 174 + i * 78;
      ui.card(r.x, y, r.w, 70, { selected: i === 0 });
      ui.text(r.x + 14, y + 23, (i === 0 ? '✓ ' : '') + t, { size: 19 });
      bldRewards(ui, r.x + r.w - 134, y + 7, ['Shard', 'Gear'], 56);
    });
    ui.button(r.x, 550, r.w, 56, 'Guild raid (later)', null, { kind: 'off', why: 'An idea for later' });
    ui.button(r.x, 620, r.w, 76, 'Prepare Team', function () { ui.todo('Team prep and battle'); }, { kind: 'main', size: 28 });
  },
};

// =============================================================================================
BUILDINGS.pvp = {
  title: 'PvP Arena', area: 'Adventure District  ·  opens after campaign Chapter 1', money: ['gold', 'gems'], draft: true,
  tabs: ['Arena', 'Defense Team', 'Season Rewards'],
  init: function () { return { def: [], tries: 5 }; },
  draw: function (ui, st, tab) {
    if (tab === 0) {
      ui.art(16, 146, 330, 330, 'ARENA ART', { feature: true });
      const p = ui.panel(16, 488, 330, 220, 'Your standing', 'sample');
      ui.text(p.x, p.y, 'League: Bronze', { size: 24, bold: true });
      ui.text(p.x, p.y + 38, 'Rank 1,204', { size: 21 });
      ui.text(p.x, p.y + 72, 'Free attacks left: ' + st.tries + ' of 5', { size: 20, color: BLD_T.good });
      ui.button(p.x, 640, p.w, 56, 'More attacks (gems)', function () { ui.todo('Buy attacks'); });
      const a = ui.panel(358, 146, 906, 562, 'Opponents');
      ui.chip(a.x + a.w - 150, 152, 'Refresh', { w: 150, onTap: function () { ui.todo('New opponents'); } });
      [0, 1, 2].forEach(function (i) {
        const y = a.y + i * 168;
        ui.card(a.x, y, a.w, 158);
        ui.text(a.x + 16, y + 12, 'Sample Rival ' + (i + 1), { size: 24, title: true, color: BLD_T.gold });
        ui.text(a.x + 16, y + 48, 'Rank ' + (1150 + i * 22), { size: 18, color: BLD_T.dim });
        bldEnemies(ui, a.x + 16, y + 78, 560, 68, 5, 'hero');
        ui.text(a.x + 130, y + 48, '·  Reward: arena coins', { size: 18, color: BLD_T.dim });
        ui.button(a.x + a.w - 186, y + 42, 170, 74, 'Attack', function () { ui.todo('Arena battle'); }, { kind: st.tries ? 'main' : 'off', size: 26 });
      });
      ui.tag(a.x + a.w - 164, 158, 'IDEA: arena coins and replays', { right: true });
    }
    if (tab === 1) {
      ui.panel(16, 146, 900, 562, 'Your defense team', 'others attack this saved team');
      const spots = [['Front 1', 250, 230], ['Front 2', 530, 230], ['Back 1', 110, 460], ['Back 2', 390, 460], ['Back 3', 670, 460]];
      spots.forEach(function (s, i) {
        const h = st.def[i] ? bldHeroById(st.def[i]) : null;
        ui.text(s[1] + 75, s[2] - 30, s[0], { size: 20, ox: 0.5, color: BLD_T.dim });
        ui.slot(s[1], s[2], 150, { filled: !!h, icon: h ? bldInitials(h) : '+', label: h ? h.name : '', onTap: function () {
          if (h) { st.def[i] = null; ui.refresh(); return; }
          ui.pickHero('Defense: ' + s[0], function (hero) { st.def[i] = hero.id; }, st.def, true);
        } });
      });
      ui.text(466, 650, 'Formation: 2 front, 3 back', { size: 19, ox: 0.5, color: BLD_T.dim });
      const r = ui.panel(928, 146, 336, 562, 'Notes');
      ui.text(r.x, r.y, 'Attacks hit saved teams, so no live matches are needed.', { size: 20, wrap: r.w });
      ui.tag(r.x, r.y + 84, 'NOT DECIDED');
      ui.text(r.x, r.y + 118, 'Does your main character have to be on defense? Can working heroes defend?', { size: 20, wrap: r.w, color: BLD_T.amber });
      ui.button(r.x, 628, r.w, 68, 'Save Defense', function () { ui.toast('Defense team saved (placeholder)'); }, { kind: 'main' });
    }
    if (tab === 2) {
      const a = ui.panel(16, 146, 1248, 562, 'Season rewards', 'season ends in 18 days (sample)');
      ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion'].forEach(function (n, i) {
        const y = a.y + i * 82;
        ui.card(a.x, y, a.w, 74, { selected: i === 0, stripe: RARITY_COLOR[i] });
        ui.art(a.x + 22, y + 9, 56, 56, 'badge');
        ui.text(a.x + 96, y + 22, n + ' league', { size: 24, title: true, color: RARITY_TEXT[i] });
        ui.text(a.x + 380, y + 26, 'Paid when the season ends', { size: 18, color: BLD_T.dim });
        bldRewards(ui, a.x + a.w - 220, y + 7, ['Coins', 'Gems', 'Shard'], 60);
      });
    }
  },
};

// =============================================================================================
BUILDINGS.dungeons = {
  title: 'Dungeons', area: 'Adventure District  ·  farm gear, materials and shards', money: ['stamina'], draft: true,
  init: function () { return { set: 0, tier: 0 }; },
  draw: function (ui, st) {
    const sets = ['Bulwark Plate', 'Wildgrove Leathers', 'Sanctified Vestments', 'Warbringer Gear', 'Nightblade Leathers', 'Ironfist Wraps', 'Gravebound Regalia', 'Spiritcaller Garb',
      'Prismatic Robes', 'Hexbound Vestments', 'Troubadour Finery', 'Dawnforged Plate', 'Wildstalker Leathers', 'Tempest Regalia'];
    const l = ui.panel(16, 84, 340, 624, 'Dungeons');
    ui.tag(l.x + l.w, 96, 'IDEA: one per set', { right: true });
    ui.list('dungeons', l, sets, 76, function (n, x, y, w, h, i) {
      ui.card(x, y, w, h, { selected: st.set === i, onTap: function () { st.set = i; ui.refresh(); } });
      ui.art(x + 8, y + 8, 52, 52, '');
      ui.text(x + 70, y + 11, 'Sample Dungeon ' + (i + 1), { size: 19, bold: true, fit: w - 76 });
      ui.text(x + 70, y + 38, 'Drops: ' + n, { size: 16, color: BLD_T.dim, fit: w - 76 });
    });
    const d = ui.panel(368, 84, 896, 624, 'Sample Dungeon ' + (st.set + 1), sets[st.set]);
    ui.art(d.x, d.y, d.w, 210, 'DUNGEON ART', { feature: true });
    ui.text(d.x, d.y + 228, 'Difficulty', { size: 20, bold: true });
    ui.choice(d.x + 110, d.y + 218, ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'], st, 'tier', { w: 136, h: 46, size: 19 });
    ui.text(d.x, d.y + 282, 'Enemies', { size: 20, bold: true });
    bldEnemies(ui, d.x, d.y + 312, 480, 96, 5);
    ui.text(d.x + 500, d.y + 282, 'Possible drops', { size: 20, bold: true });
    bldRewards(ui, d.x + 500, d.y + 312, ['Set piece', 'Part', 'Material', 'Shard']);
    ui.text(d.x, d.y + 424, 'Set pieces can be salvaged at the Blacksmith to learn their recipes.', { size: 18, color: BLD_T.dim });
    ui.text(d.x, d.y + 452, 'Entry cost: Stamina (amount not set)', { size: 19 });
    ui.button(d.x, 620, 430, 76, 'Auto Battle', null, { kind: 'off', why: 'Clear this tier once first. Auto Battle still costs Stamina.', size: 26 });
    ui.button(d.x + 442, 620, d.w - 442, 76, 'Prepare Team', function () { ui.todo('Team prep and battle'); }, { kind: 'main', size: 28 });
  },
};

// =============================================================================================
BUILDINGS.hellmouth = {
  title: 'Hellmouth', area: 'Adventure District  ·  limited-time roguelike event', money: ['stamina'], draft: true,
  tabs: ['Event', 'Run Upgrades (preview)', 'Event Rewards'],
  init: function () { return { curse: 0, pick: -1 }; },
  draw: function (ui, st, tab) {
    if (tab === 0) {
      ui.art(16, 146, 760, 562, 'THE GATEWAY', { feature: true });
      const r = ui.panel(788, 146, 476, 562, 'Event is open', 'ends in 3d 5h (sample)');
      ui.text(r.x, r.y, 'Hold your ground as waves come at you. Upgrades you pick last only for this run.', { size: 20, wrap: r.w });
      ui.text(r.x, r.y + 76, 'Best run: wave 7 (sample)', { size: 22, bold: true, color: BLD_T.gold });
      ui.bar(r.x, r.y + 112, r.w, 28, 7 / 20, BLD_C.bad, 'Wave 7 reached');
      ui.text(r.x, r.y + 166, 'Pick a curse for better loot', { size: 20, bold: true });
      ui.tag(r.x + r.w, r.y + 167, 'IDEA', { right: true });
      ['No curse', 'Frail: less health', 'Starved: less healing'].forEach(function (c, i) {
        const y = r.y + 200 + i * 62;
        ui.card(r.x, y, r.w, 54, { selected: st.curse === i, onTap: function () { st.curse = i; ui.refresh(); } });
        ui.text(r.x + 16, y + 15, c, { size: 20 });
      });
      ui.button(r.x, 620, r.w, 76, 'Start Run', function () { st.tab = 1; ui.refresh(); }, { kind: 'main', size: 30 });
    }
    if (tab === 1) {
      ui.text(640, 156, 'Wave cleared! Pick one upgrade for the rest of this run', { size: 28, title: true, color: BLD_T.gold, ox: 0.5 });
      ['Sharper Blades', 'Hellfire Ward', 'Second Wind'].forEach(function (n, i) {
        const x = 130 + i * 350;
        ui.card(x, 210, 320, 390, { selected: st.pick === i, onTap: function () { st.pick = i; ui.refresh(); } });
        ui.art(x + 30, 232, 260, 210, 'upgrade art');
        ui.text(x + 160, 464, n, { size: 26, title: true, color: BLD_T.gold, ox: 0.5 });
        ui.text(x + 160, 514, 'Sample upgrade. Lasts until this run ends.', { size: 19, ox: 0.5, align: 'center', wrap: 270 });
      });
      ui.button(420, 622, 440, 76, 'Take upgrade', function () { st.pick = -1; ui.refresh(); ui.toast('Next wave would start now (placeholder)'); }, { kind: st.pick < 0 ? 'off' : 'main', why: 'Pick an upgrade first', size: 26 });
    }
    if (tab === 2) {
      const a = ui.panel(16, 146, 1248, 562, 'Reward track', 'sample');
      const marks = [3, 5, 8, 10, 12, 15, 18, 20];
      ui.list('hellrewards', a, marks, 86, function (m, x, y, w, h) {
        const done = m <= 7;
        ui.card(x, y, w, h, { selected: done });
        ui.text(x + 20, y + 24, 'Reach wave ' + m, { size: 24, title: true, color: done ? BLD_T.gold : BLD_T.off });
        bldRewards(ui, x + 360, y + 8, ['Loot', 'Material', 'Cosmetic'], 62);
        ui.button(x + w - 200, y + 11, 184, 56, done ? 'Claim' : 'Locked', function () { ui.todo('Claim reward'); }, { kind: done ? 'main' : 'off', why: 'Reach that wave first' });
      });
    }
  },
};
