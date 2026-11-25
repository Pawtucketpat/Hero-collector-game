// buildingsCenter.js - Town Center interiors: Inn, Armory, Shop, Quest Board, Wandering Merchant.
// Needs buildings.js loaded first.

function bldStars(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

// ===== SAMPLE GEAR (names from your class and generic gear sets; numbers are made up) =====
const BLD_MC_SLOTS = ['Main Hand', 'Off Hand', 'Head', 'Chest', 'Gloves', 'Legs', 'Feet'];
const BLD_EXTRA_SLOTS = ['Necklace', 'Earring', 'Ring', 'Relic', 'Cloak', 'Familiar'];
const BLD_HERO_SLOTS = ['Weapon', 'Armor', 'Off Hand', 'Trinket', 'Ear', 'Neck', 'Wrist'];

const BLD_GEAR = [];
(function () {
  function addSet(set, cls, rarity, rows) {
    rows.forEach(function (r) {
      const n = BLD_GEAR.length;
      BLD_GEAR.push({
        id: 'g' + n, name: r[1], slot: r[0], set: set, cls: cls, skill: r[2] || '', rarity: rarity,
        level: 1 + (n % 5), stats: { Armor: 2 + (n % 7), Vitality: 3 + (n % 4), Strength: 1 + ((n * 3) % 6), 'Crit Chance %': 1 + (n % 3) },
      });
    });
  }
  addSet('Bulwark Plate', 'Guardian', 2, [
    ['Main Hand', 'Bulwark Maul', 'Shield Breaker'], ['Off Hand', 'Bulwark Tower Shield', 'Stalwart Guard'], ['Head', 'Bulwark Greathelm', 'Enraging Roar'],
    ['Chest', 'Bulwark Breastplate', 'Fortify'], ['Gloves', 'Bulwark Gauntlets', 'Iron Constitution'], ['Legs', 'Bulwark Greaves', 'Provoke'], ['Feet', 'Bulwark Sabatons', 'Death Ward']]);
  addSet('Wildgrove Leathers', 'Druid', 2, [
    ['Main Hand', 'Wildgrove Staff', 'Natures Wrath'], ['Off Hand', 'Wildgrove Totem', "Nature's Blessing"], ['Head', 'Wildgrove Circlet', 'Poison Bloom'],
    ['Chest', 'Wildgrove Vestments', 'Armor of Vines'], ['Legs', 'Wildgrove Leggings', 'Regrowth']]);
  addSet('Nightblade Leathers', 'Assassin', 3, [
    ['Main Hand', 'Nightblade Dagger', 'Kidney Shot'], ['Head', 'Nightblade Hood', 'Vulnerability'], ['Chest', 'Nightblade Vest', 'Execute'], ['Gloves', 'Nightblade Gloves', 'Deadly Precision']]);
  addSet('Ironbound Battlegear', '', 2, [
    ['Head', 'Ironbound Helm'], ['Chest', 'Ironbound Cuirass'], ['Gloves', 'Ironbound Gauntlets'], ['Legs', 'Ironbound Legguards'], ['Feet', 'Ironbound Boots']]);
  [['Necklace', 'Sample Necklace'], ['Earring', 'Sample Earring'], ['Ring', 'Sample Ring'], ['Relic', 'Sample Relic'], ['Cloak', 'Sample Cloak'], ['Familiar', 'Sample Familiar']]
    .forEach(function (r, i) { addSet('Jewelry (sample)', '', i % 4, [r]); });
  ['Weapon', 'Armor', 'Off Hand', 'Trinket', 'Ear', 'Neck', 'Wrist'].forEach(function (slot, i) {
    addSet('Hero gear (sample)', 'hero', i % 3, [[slot, 'Sample Hero ' + slot]]);
    addSet('Hero gear (sample)', 'hero', 1 + (i % 4), [[slot, 'Fine Hero ' + slot]]);
  });
})();
function bldGear(id) { return BLD_GEAR.filter((g) => g.id === id)[0]; }
function bldMainGear() { return BLD_GEAR.filter((g) => g.cls !== 'hero'); }
function bldHeroGear() { return BLD_GEAR.filter((g) => g.cls === 'hero'); }
function bldSlotLetter(slot) { return slot.split(' ').map((w) => w[0]).join('') ; }

// What the main character is wearing (sample)
const BLD_EQUIPPED = { 'Main Hand': 'g0', 'Head': 'g2', 'Chest': 'g15', 'Legs': 'g19', 'Necklace': 'g21' };
const BLD_HERO_EQUIPPED = {};

// A class unlocks with 2 of its pieces in the main seven slots, 3 classes at most
function bldClassCounts(equipped) {
  const count = {};
  BLD_MC_SLOTS.forEach(function (s) {
    const g = equipped[s] ? bldGear(equipped[s]) : null;
    if (g && g.cls) count[g.cls] = (count[g.cls] || 0) + 1;
  });
  return count;
}
function bldUnlocked(equipped) {
  const c = bldClassCounts(equipped);
  return Object.keys(c).filter((k) => c[k] >= 2).slice(0, 3);
}

// Item details with a comparison against what is worn now
function bldInspect(ui, x, y, w, item, worn) {
  ui.art(x, y, 78, 78, 'item art');
  ui.text(x + 90, y, item.name, { size: 20, bold: true, color: RARITY_TEXT[item.rarity], wrap: w - 90, lines: 2 });
  ui.text(x + 90, y + 52, RARITIES[item.rarity] + ' · ' + item.slot + ' · Lv ' + item.level, { size: 16, color: BLD_T.dim, fit: w - 90 });
  let cy = y + 90;
  ui.text(x, cy, worn && worn.id !== item.id ? 'Compared with ' + worn.name : worn ? 'Equipped now' : 'Nothing in this slot', { size: 16, color: BLD_T.dim, fit: w });
  cy += 24;
  Object.keys(item.stats).forEach(function (k) {
    const diff = worn && worn.id !== item.id ? item.stats[k] - worn.stats[k] : 0;
    ui.text(x, cy, k, { size: 18 });
    ui.text(x + w - 62, cy, item.stats[k], { size: 18, bold: true, ox: 1 });
    if (diff) ui.text(x + w, cy, (diff > 0 ? '▲' : '▼') + Math.abs(diff), { size: 18, bold: true, ox: 1, color: diff > 0 ? BLD_T.good : BLD_T.bad });
    cy += 25;
  });
  return cy + 4;
}

// =============================================================================================
BUILDINGS.inn = {
  title: 'The Inn', area: 'Town Center  ·  heroes and recruiting', money: ['gold', 'gems'],
  tabs: ['Roster', 'Recruit & Star Up', 'Buy Shards', 'Daily Meal'],
  init: function () { return { hero: 'H0010', sort: 0 }; },
  draw: function (ui, st, tab) {
    if (tab === 0) {
      const a = ui.panel(16, 146, 756, 562, 'Your heroes', BLD_HEROES.length + ' owned (sample)');
      ui.choice(a.x, a.y, ['All', 'By class', 'By stars', 'By level'], st, 'sort');
      const heroes = BLD_HEROES.slice();
      if (st.sort === 1) heroes.sort((p, q) => p.cls.localeCompare(q.cls));
      if (st.sort === 2) heroes.sort((p, q) => q.stars - p.stars);
      if (st.sort === 3) heroes.sort((p, q) => q.level - p.level);
      ui.grid('roster', { x: a.x, y: a.y + 46, w: a.w, h: a.h - 46 }, heroes, 4, 204, function (h, x, y, w, ch) {
        const busy = bldHeroBusy(h.id);
        ui.card(x, y, w, ch, { selected: st.hero === h.id, onTap: function () { st.hero = h.id; ui.refresh(); } });
        ui.art(x + 10, y + 10, w - 20, 108, 'portrait');
        ui.text(x + w / 2, y + 124, h.name, { size: 18, bold: true, ox: 0.5, fit: w - 12 });
        ui.text(x + w / 2, y + 148, h.cls + ' · Lv ' + h.level, { size: 16, color: BLD_T.dim, ox: 0.5, fit: w - 12 });
        ui.text(x + w / 2, y + 170, busy ? busy : bldStars(h.stars), { size: busy ? 16 : 19, color: busy ? BLD_T.amber : BLD_T.gold, ox: 0.5 });
      });
      const h = bldHeroById(st.hero);
      const d = ui.panel(784, 146, 480, 562, h.name, h.species + ' ' + h.cls);
      ui.art(d.x, d.y, 160, 206, 'HERO ART');
      ui.text(d.x + 176, d.y, 'Level ' + h.level, { size: 22, bold: true });
      ui.text(d.x + 176, d.y + 30, bldStars(h.stars), { size: 26, color: BLD_T.gold });
      ['Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Vitality', 'Speed'].forEach(function (n, i) {
        ui.text(d.x + 176, d.y + 70 + i * 23, n, { size: 18, color: BLD_T.dim });
        ui.text(d.x + d.w - 4, d.y + 70 + i * 23, i < 5 ? h.stats[i] : h.spd, { size: 18, bold: true, ox: 1 });
      });
      h.skills.forEach(function (s, i) {
        const y = d.y + 220 + i * 48;
        ui.card(d.x, y, d.w, 42);
        ui.art(d.x + 6, y + 5, 32, 32, '');
        ui.text(d.x + 48, y + 11, s, { size: 19, fit: d.w - 160 });
        ui.text(d.x + d.w - 12, y + 12, i ? 'Skill' : 'Basic', { size: 16, color: BLD_T.dim, ox: 1 });
      });
      ui.text(d.x, d.y + 368, 'Expedition traits: ' + h.traits.join(', '), { size: 17, color: BLD_T.good, fit: d.w });
      if (bldHeroBusy(h.id)) ui.text(d.x, d.y + 394, 'Not available for your team: ' + bldHeroBusy(h.id), { size: 17, color: BLD_T.amber });
      ui.button(d.x, 634, 222, 62, 'Star Up', function () { st.tab = 1; ui.refresh(); }, { kind: 'main' });
      ui.button(d.x + 234, 634, 222, 62, 'Gear in Armory', function () { bldState('armory').hero = h.id; ui.go('armory', 1); });
    }

    if (tab === 1) {
      ui.text(24, 150, 'Collected shards recruit new heroes and add star ranks (5 stars at most).', { size: 20, color: BLD_T.dim });
      const cards = [
        ['Kessa Dawnpetal', 'Cleric', 25, 25, 'Recruit'], ['Ruk Skyhunter', 'Ranger', 18, 25, 'Recruit'], ['Sable Moonblade', 'Assassin', 6, 25, 'Recruit'],
        ['Brannoch Ironwall', 'Guardian', 40, 40, 'Star Up'], ['Pyra Emberheart', 'Elementalist', 12, 30, 'Star Up'], ['Wen Liu', 'Monk', 29, 30, 'Star Up'],
        ['Glacia Frostmantle', 'Elementalist', 0, 25, 'Recruit'], ['Draven Voidcaller', 'Wizard', 3, 25, 'Recruit'], ['Oriel Calmwater', 'Monk', 11, 25, 'Recruit'],
      ];
      ui.grid('recruit', { x: 16, y: 182, w: 1248, h: 524 }, cards, 3, 254, function (c, x, y, w, h) {
        const ready = c[2] >= c[3];
        ui.card(x, y, w, h, { selected: ready });
        ui.art(x + 14, y + 14, 130, 150, 'portrait');
        ui.text(x + 158, y + 18, c[0], { size: 21, bold: true, wrap: w - 170, lines: 2 });
        ui.text(x + 158, y + 74, c[1], { size: 18, color: BLD_T.dim });
        ui.text(x + 158, y + 104, c[4] === 'Recruit' ? 'Not recruited' : 'Next star rank', { size: 18, color: BLD_T.gold });
        ui.chip(x + 158, y + 134, 'Where to find', { onTap: function () { ui.todo('Where shards drop'); } });
        ui.bar(x + 14, y + 174, w - 28, 24, c[2] / c[3], ready ? BLD_C.good : BLD_C.blue, c[2] + ' / ' + c[3] + ' shards (sample)');
        ui.button(x + 14, y + 204, w - 28, 42, c[4], null, { kind: ready ? 'main' : 'off', why: 'Not enough shards yet' });
      });
    }

    if (tab === 2) {
      const a = ui.panel(16, 146, 1248, 562, 'Buy hero shards', 'Prices not set yet');
      ui.art(a.x, a.y, 320, a.h, 'INNKEEPER', { feature: true });
      const offers = ['Brannoch Ironwall', 'Vesper Nightshade', 'Idris Brightwater', 'Pyra Emberheart', 'Elowen Swiftbow', 'Wen Liu', 'Sable Moonblade', 'Kessa Dawnpetal'];
      ui.grid('shards', { x: a.x + 336, y: a.y, w: a.w - 336, h: a.h }, offers, 4, 250, function (n, x, y, w, h) {
        ui.card(x, y, w, h);
        ui.art(x + 12, y + 12, w - 24, 112, 'shard art');
        ui.text(x + w / 2, y + 134, n, { size: 18, bold: true, ox: 0.5, fit: w - 12 });
        ui.text(x + w / 2, y + 162, '5 shards', { size: 18, color: BLD_T.dim, ox: 0.5 });
        ui.button(x + 12, y + h - 58, w - 24, 46, 'Buy', function () { ui.todo('Buy shards'); });
      });
    }

    if (tab === 3) {
      ui.tag(24, 152, 'IDEA: the 3-a-day gem claim could live here');
      ['Morning meal', 'Afternoon meal', 'Before bed meal'].forEach(function (n, i) {
        const x = 16 + i * 420;
        ui.card(x, 186, 408, 450);
        ui.text(x + 204, 200, n, { size: 28, title: true, color: BLD_T.gold, ox: 0.5 });
        ui.art(x + 24, 248, 360, 230, 'MEAL ART');
        ui.text(x + 204, 500, i === 0 ? 'Claimed' : i === 1 ? 'Ready now' : 'Starts 6 hours after the last claim', { size: 20, ox: 0.5, color: i === 1 ? BLD_T.good : BLD_T.dim, fit: 380 });
        ui.button(x + 24, 546, 360, 66, 'Claim gems', null, { kind: i === 1 ? 'main' : 'off', why: i === 0 ? 'Already claimed' : 'Timer still running' });
      });
      ui.text(640, 664, 'Stays open until claimed, then a 6 hour timer starts. 3 claims a day at most.', { size: 20, color: BLD_T.dim, ox: 0.5 });
    }
  },
};

// =============================================================================================
BUILDINGS.armory = {
  title: 'Armory', area: 'Town Center  ·  gear for you and your heroes', money: ['gold'],
  tabs: ['Main Character', 'Heroes', 'Gear Vault'],
  init: function () { return { slot: '', item: 'g1', hero: 'H0010', hslot: '', hitem: '', vitem: '' }; },
  draw: function (ui, st, tab) {
    if (tab === 0) {
      // loadout
      ui.panel(16, 146, 452, 562, 'Loadout');
      ui.art(122, 192, 240, 340, 'MAIN CHARACTER', { feature: true });
      const pos = { 'Head': [28, 192], 'Chest': [28, 279], 'Gloves': [28, 366], 'Legs': [28, 453], 'Main Hand': [374, 192], 'Off Hand': [374, 279], 'Feet': [374, 366] };
      const worn = function (slot, x, y, size, label) {
        const g = BLD_EQUIPPED[slot] ? bldGear(BLD_EQUIPPED[slot]) : null;
        ui.slot(x, y, size, {
          filled: !!g, rarity: g ? g.rarity : undefined, selected: st.slot === slot, icon: g ? bldSlotLetter(slot) : '+', label: label || slot,
          onTap: function () { st.slot = st.slot === slot ? '' : slot; if (g) st.item = g.id; st.scroll.inv = 0; ui.refresh(); },
        });
      };
      BLD_MC_SLOTS.forEach((s) => worn(s, pos[s][0], pos[s][1], 82));
      BLD_EXTRA_SLOTS.forEach((s, i) => worn(s, 28 + i * 72, 542, 68));
      const counts = bldClassCounts(BLD_EQUIPPED), open = bldUnlocked(BLD_EQUIPPED);
      ui.text(28, 619, 'Classes unlocked (2 pieces each, 3 max):', { size: 17, color: BLD_T.dim });
      let cx = 28;
      if (!open.length) ui.text(28, 644, 'None yet', { size: 19 });
      open.forEach(function (c) { cx += ui.chip(cx, 642, c + ' ' + counts[c], { on: true, h: 28, size: 16 }) + 6; });
      const sets = {};
      BLD_MC_SLOTS.forEach(function (s) { const g = BLD_EQUIPPED[s] && bldGear(BLD_EQUIPPED[s]); if (g) sets[g.set] = (sets[g.set] || 0) + 1; });
      const top = Object.keys(sets).sort((p, q) => sets[q] - sets[p])[0];
      if (top) {
        ui.text(28, 679, top + ':', { size: 17, fit: 210 });
        [2, 4, 6].forEach(function (n, i) { ui.text(250 + i * 70, 679, (sets[top] >= n ? '● ' : '○ ') + n + 'pc', { size: 17, bold: true, color: sets[top] >= n ? BLD_T.good : BLD_T.off }); });
      }

      // inventory
      const inv = ui.panel(480, 146, 440, 562, 'Inventory', st.slot ? st.slot : 'All slots');
      let fx = inv.x;
      ['Slot', 'Set', 'Affinity', 'Rarity'].forEach(function (f) { fx += ui.chip(fx, inv.y, f + ' ▾', { onTap: function () { ui.todo('Filter by ' + f); } }) + 6; });
      if (st.slot) ui.chip(inv.x, inv.y + 42, 'Show all slots  ×', { on: true, onTap: function () { st.slot = ''; ui.refresh(); } });
      const items = bldMainGear().filter((g) => !st.slot || g.slot === st.slot);
      const top2 = st.slot ? 84 : 44;
      ui.grid('inv', { x: inv.x, y: inv.y + top2, w: inv.w, h: inv.h - top2 }, items, 4, 96, function (g, x, y, w, h) {
        const isOn = BLD_EQUIPPED[g.slot] === g.id;
        ui.slot(x + (w - 94) / 2, y, 94, { filled: true, rarity: g.rarity, selected: st.item === g.id, icon: bldSlotLetter(g.slot), label: g.name,
          onTap: function () { st.item = g.id; ui.refresh(); } });
        if (isOn) ui.chip(x + (w - 94) / 2 + 60, y + 3, 'E', { on: true, w: 30, h: 22, size: 14 });
      });

      // inspect
      const p = ui.panel(932, 146, 332, 562, 'Inspect');
      const item = bldGear(st.item);
      const current = BLD_EQUIPPED[item.slot] ? bldGear(BLD_EQUIPPED[item.slot]) : null;
      let y = bldInspect(ui, p.x, p.y, p.w, item, current);
      ui.text(p.x, y, 'Set: ' + item.set, { size: 17, color: BLD_T.gold, fit: p.w });
      ui.text(p.x, y + 24, 'Affinity: ' + (item.cls || 'none'), { size: 17, fit: p.w });
      ui.text(p.x, y + 48, 'Skill: ' + (item.skill || 'none (crystal slot)'), { size: 17, fit: p.w });
      ui.chip(p.x, 580, 'Lock item', { onTap: function () { ui.todo('Lock item'); } });
      ui.tag(p.x + 128, 586, 'IDEA');
      const on = current && current.id === item.id;
      ui.button(p.x, 628, p.w, 68, on ? 'Unequip' : 'Equip', function () {
        const before = bldUnlocked(BLD_EQUIPPED);
        if (on) delete BLD_EQUIPPED[item.slot]; else BLD_EQUIPPED[item.slot] = item.id;
        const fresh = bldUnlocked(BLD_EQUIPPED).filter((c) => before.indexOf(c) === -1);
        ui.refresh();
        if (fresh.length) ui.toast('✦ Class unlocked: ' + fresh.join(', ') + ' ✦');
      }, { kind: 'main' });
    }

    if (tab === 1) {
      const l = ui.panel(16, 146, 296, 562, 'Heroes');
      ui.list('gearheroes', l, BLD_HEROES, 74, function (h, x, y, w, rh) {
        ui.card(x, y, w, rh, { selected: st.hero === h.id, onTap: function () { st.hero = h.id; st.hslot = ''; ui.refresh(); } });
        ui.slot(x + 6, y + 7, 52, { icon: bldInitials(h), filled: true });
        ui.text(x + 66, y + 10, h.name, { size: 18, bold: true, fit: w - 72 });
        ui.text(x + 66, y + 36, h.cls + ' · Lv ' + h.level, { size: 16, color: BLD_T.dim });
      });
      const hero = bldHeroById(st.hero);
      const mine = BLD_HERO_EQUIPPED[hero.id] || (BLD_HERO_EQUIPPED[hero.id] = {});
      ui.panel(324, 146, 456, 562, hero.name);
      ui.art(436, 192, 232, 348, 'HERO ART');
      const spots = [[340, 192], [340, 281], [340, 370], [340, 459], [682, 192], [682, 281], [682, 370]];
      BLD_HERO_SLOTS.forEach(function (s, i) {
        const g = mine[s] ? bldGear(mine[s]) : null;
        ui.slot(spots[i][0], spots[i][1], 82, { filled: !!g, rarity: g ? g.rarity : undefined, selected: st.hslot === s, icon: g ? bldSlotLetter(s) : '+', label: s,
          onTap: function () { st.hslot = st.hslot === s ? '' : s; if (g) st.hitem = g.id; st.scroll.hinv = 0; ui.refresh(); } });
      });
      ui.text(340, 556, 'Hero gear gives stats and passives, never skills.', { size: 17, color: BLD_T.dim });
      ui.text(340, 592, 'Loadout presets', { size: 18, bold: true });
      ui.tag(490, 593, 'IDEA');
      [1, 2, 3].forEach(function (n, i) { ui.button(340 + i * 146, 628, 134, 62, 'Preset ' + n, null); });

      const r = ui.panel(792, 146, 472, 562, 'Hero gear', st.hslot || 'All slots');
      const items = bldHeroGear().filter((g) => !st.hslot || g.slot === st.hslot);
      ui.grid('hinv', { x: r.x, y: r.y, w: r.w, h: 185 }, items, 5, 86, function (g, x, y, w) {
        ui.slot(x + (w - 82) / 2, y, 82, { filled: true, rarity: g.rarity, selected: st.hitem === g.id, icon: bldSlotLetter(g.slot), label: g.slot,
          onTap: function () { st.hitem = g.id; ui.refresh(); } });
      });
      const item = st.hitem ? bldGear(st.hitem) : null;
      if (!item) ui.text(r.x + r.w / 2, 480, 'Tap a piece to inspect it', { size: 20, color: BLD_T.dim, ox: 0.5 });
      else {
        const current = mine[item.slot] ? bldGear(mine[item.slot]) : null;
        bldInspect(ui, r.x, 394, r.w, item, current);
        const on = current && current.id === item.id;
        ui.button(r.x, 636, r.w, 60, on ? 'Unequip' : 'Equip on ' + bldShort(hero), function () {
          if (on) delete mine[item.slot]; else mine[item.slot] = item.id;
          ui.refresh();
        }, { kind: 'main' });
      }
    }

    if (tab === 2) {
      ui.rect(16, 146, 1248, 52, { fill: 0x3d1c1c, stroke: BLD_C.bad });
      ui.text(32, 161, '!  Overflow preview: shows only when gear is waiting. Normal play pauses until it is empty.', { size: 20, bold: true, fit: 970 });
      ui.chip(1066, 155, 'Open Overflow', { w: 184, on: true, onTap: function () {
        ui.popup('Overflow', 700, 330, function (u, x, y, w) {
          u.text(x + 24, y + 68, 'Gear here cannot be equipped. Sell it, or make room and move it into the vault.', { size: 20, wrap: w - 48 });
          [0, 1].forEach(function (i) {
            u.card(x + 24, y + 136 + i * 84, w - 48, 74);
            u.text(x + 40, y + 160 + i * 84, 'Sample drop ' + (i + 1), { size: 20 });
            u.button(x + w - 360, y + 147 + i * 84, 160, 52, 'Move to vault', null, { size: 18 });
            u.button(x + w - 188, y + 147 + i * 84, 150, 52, 'Sell', null, { kind: 'bad' });
          });
        });
      } });
      const a = ui.panel(16, 210, 912, 498, 'Gear vault', '38 / 50 slots (sample)');
      ui.bar(a.x, a.y, a.w, 22, 38 / 50, BLD_C.blue);
      ui.grid('vault', { x: a.x, y: a.y + 34, w: a.w, h: a.h - 34 }, BLD_GEAR.slice(0, 38), 8, 100, function (g, x, y, w) {
        ui.slot(x + (w - 96) / 2, y, 96, { filled: true, rarity: g.rarity, selected: st.vitem === g.id, icon: bldSlotLetter(g.slot), label: g.name,
          onTap: function () { st.vitem = g.id; ui.refresh(); } });
      });
      const p = ui.panel(940, 210, 324, 498, 'Details');
      if (st.vitem) bldInspect(ui, p.x, p.y, p.w, bldGear(st.vitem), null);
      else ui.text(p.x, p.y + 10, 'Tap a piece to inspect it.', { size: 19, color: BLD_T.dim });
      ui.text(p.x, 538, 'Vault upgrades (town 1-10)', { size: 18, bold: true });
      ui.pips(p.x, 566, 1, 3);
      ui.text(p.x, 592, '2,000 gold · 500 stone · 500 wood', { size: 17, color: BLD_T.dim, fit: p.w });
      ui.button(p.x, 628, p.w, 68, 'Upgrade Vault', null, { kind: 'main' });
    }
  },
};

// =============================================================================================
BUILDINGS.shop = {
  title: 'Shop', area: 'Town Center  ·  the regular shop, same stock every visit', money: ['gold', 'gems', 'stamina'],
  tabs: ['Goods', 'Sell Gear', 'Stamina', 'Premium'],
  init: function () { return { coin: 0, sell: '', sold: [] }; },
  draw: function (ui, st, tab) {
    if (tab === 0) {
      ui.art(16, 146, 330, 562, 'SHOPKEEPER', { feature: true });
      const a = ui.panel(358, 146, 906, 562, 'Goods');
      const end = ui.choice(a.x, a.y, ['Gold', 'Arena Coins', 'Tower Coins', 'Raid Tokens'], st, 'coin');
      ui.tag(end + 6, a.y + 6, 'IDEA: extra currencies');
      const coin = ['gold', 'arena coins', 'tower coins', 'raid tokens'][st.coin];
      const goods = ['Material bundle', 'Crafting component', 'Common gear', 'Uncommon gear', 'Basic crystal', 'Food ingredient', 'Potion ingredient', 'Mystery item'];
      ui.grid('goods' + st.coin, { x: a.x, y: a.y + 48, w: a.w, h: a.h - 48 }, goods, 4, 224, function (n, x, y, w, h) {
        ui.card(x, y, w, h);
        ui.art(x + 12, y + 12, w - 24, 106, 'item art');
        ui.text(x + w / 2, y + 128, n, { size: 19, bold: true, ox: 0.5, fit: w - 12 });
        ui.text(x + w / 2, y + 154, 'Sample item', { size: 16, color: BLD_T.dim, ox: 0.5 });
        ui.button(x + 12, y + h - 52, w - 24, 42, '--- ' + coin, function () { ui.todo('Buy ' + n); }, { size: 18 });
      });
    }

    if (tab === 1) {
      const a = ui.panel(16, 146, 780, 562, 'Your unequipped gear');
      const worn = Object.keys(BLD_EQUIPPED).map((k) => BLD_EQUIPPED[k]);
      const items = bldMainGear().filter((g) => worn.indexOf(g.id) === -1 && st.sold.indexOf(g.id) === -1);
      ui.list('sell', a, items, 72, function (g, x, y, w, h) {
        ui.card(x, y, w, h, { selected: st.sell === g.id, stripe: RARITY_COLOR[g.rarity], onTap: function () { st.sell = g.id; ui.refresh(); } });
        ui.art(x + 20, y + 8, 48, 48, '');
        ui.text(x + 82, y + 10, g.name, { size: 20, bold: true, color: RARITY_TEXT[g.rarity] });
        ui.text(x + 82, y + 37, RARITIES[g.rarity] + ' · ' + g.slot, { size: 16, color: BLD_T.dim });
        ui.text(x + w - 16, y + 22, 'Price not set', { size: 18, ox: 1, color: BLD_T.dim });
      });
      const p = ui.panel(808, 146, 456, 562, 'Sell');
      const item = items.filter((g) => g.id === st.sell)[0];
      if (item) bldInspect(ui, p.x, p.y, p.w, item, null);
      else ui.text(p.x, p.y + 10, 'Tap a piece on the left.', { size: 20, color: BLD_T.dim });
      ui.text(p.x, 540, 'Gear must be unequipped to be sold. Selling is permanent and there is no buyback.', { size: 18, color: BLD_T.amber, wrap: p.w });
      ui.button(p.x, 626, p.w, 70, 'Sell', function () {
        ui.confirm('Sell ' + item.name + '?', 'This is permanent. There is no buyback.', 'Sell it', function () { st.sold.push(item.id); st.sell = ''; }, 'bad');
      }, { kind: item ? 'bad' : 'off', why: 'Pick a piece first' });
    }

    if (tab === 2) {
      ui.card(16, 146, 1248, 108);
      ui.text(36, 160, 'Stamina', { size: 28, title: true, color: BLD_T.gold });
      ui.bar(36, 204, 700, 32, 180 / 250, BLD_C.good, '180 / 250');
      ui.text(760, 208, '1 point back every 6 minutes', { size: 20, color: BLD_T.dim });
      ui.tag(1248, 162, 'PROPOSED NUMBERS', { right: true });
      [['Refreshes 1 to 3', '50 gems', 'The cheap daily ones', 1], ['Refreshes 4 to 6', '100 gems', 'Price doubles', 0], ['Refresh 7 and up', 'Rising', 'Price curve not set yet', 0]].forEach(function (c, i) {
        const x = 16 + i * 420;
        ui.card(x, 268, 408, 360, { selected: !!c[3] });
        ui.text(x + 204, 284, c[0], { size: 26, title: true, color: BLD_T.gold, ox: 0.5 });
        ui.art(x + 94, 328, 220, 130, 'STAMINA ART');
        ui.text(x + 204, 470, '+250 Stamina', { size: 26, bold: true, ox: 0.5, color: BLD_T.good });
        ui.text(x + 204, 506, c[2], { size: 18, color: BLD_T.dim, ox: 0.5 });
        ui.button(x + 24, 542, 360, 68, c[1], function () { ui.todo('Buy Stamina'); }, { kind: c[3] ? 'main' : 'off', why: 'Use the cheaper refreshes first' });
      });
      ui.text(640, 658, 'Part of the gems you spend on refreshes comes back as gems (percent not set).', { size: 20, color: BLD_T.dim, ox: 0.5 });
    }

    if (tab === 3) {
      [['Membership', '1,500 gems', ['Stamina boost', 'About 50 gems a day', 'Can be bought with earned gems']],
        ['Battle Pass', 'Price not set', ['Free track', 'Paid track', 'New each month']],
        ['Monthly Cosmetic', '800 gems', ['One new look each month', 'Cosmetic only']]].forEach(function (c, i) {
        const x = 16 + i * 420;
        ui.card(x, 146, 408, 562);
        ui.text(x + 204, 164, c[0], { size: 30, title: true, color: BLD_T.gold, ox: 0.5 });
        ui.art(x + 24, 216, 360, 240, c[0].toUpperCase() + ' ART');
        c[2].forEach(function (line, j) { ui.text(x + 30, 474 + j * 34, '•  ' + line, { size: 20, fit: 350 }); });
        ui.tag(x + 30, 590, 'PROPOSED');
        ui.button(x + 24, 624, 360, 68, c[1], function () { ui.todo(c[0]); }, { kind: 'main' });
      });
    }
  },
};

// =============================================================================================
const BLD_QUESTS = [
  ['Easy', 'Gather the Harvest', 'Collect from the Farm once', 1],
  ['Easy', 'Strong Arm', 'Craft 1 item at the Blacksmith', 1],
  ['Medium', 'Road Work', 'Win 5 campaign nodes', 5],
  ['Medium', 'Far Horizons', 'Send 2 expeditions', 2],
  ['Hard', 'Delver', 'Clear 3 dungeons', 3],
  ['Hard', 'Arena Blood', 'Win 3 arena fights', 3],
];

BUILDINGS.quest_board = {
  title: 'Quest Board', area: 'Town Center  ·  daily quests', money: ['gems'],
  init: function () { return { held: [2], progress: { 2: 2 }, gone: [], discards: 2 }; },
  draw: function (ui, st) {
    ui.text(24, 88, '6 quests a day, mixed difficulty', { size: 21, bold: true });
    ui.text(430, 88, 'New quests in 7h 12m (sample)', { size: 21, color: BLD_T.dim });
    ui.text(1256, 88, 'Sample quests', { size: 18, color: BLD_T.dim, ox: 1 });
    const diffColor = { Easy: BLD_C.good, Medium: BLD_C.amber, Hard: BLD_C.bad };
    BLD_QUESTS.forEach(function (q, i) {
      const x = 16 + (i % 3) * 288, y = 124 + Math.floor(i / 3) * 296;
      const gone = st.gone.indexOf(i) !== -1, held = st.held.indexOf(i) !== -1;
      ui.card(x, y, 276, 284, { fill: gone ? 0x17151a : 0x2e251b, stroke: BLD_C.line, selected: held });
      ui.chip(x + 12, y + 12, q[0], { h: 28, size: 15, fill: gone ? 0x222025 : diffColor[q[0]] });
      ui.text(x + 14, y + 52, q[1], { size: 23, title: true, color: gone ? BLD_T.off : BLD_T.gold, fit: 250 });
      ui.text(x + 14, y + 90, q[2], { size: 19, wrap: 248, color: gone ? BLD_T.off : BLD_T.main });
      ui.art(x + 14, y + 154, 52, 52, '');
      ui.text(x + 78, y + 170, 'Reward: not set', { size: 17, color: BLD_T.dim });
      const label = gone ? 'Discarded today' : held ? 'In your quests' : 'Accept';
      ui.button(x + 14, y + 216, 248, 56, label, function () { st.held.push(i); ui.refresh(); },
        { kind: gone || held || st.held.length >= 3 ? 'off' : 'main', why: gone ? 'Gone until tomorrow' : held ? 'You already have it' : 'You can only hold 3 quests' });
    });

    ui.panel(880, 124, 384, 584, 'Your quests', st.held.length + ' / 3');
    ui.text(894, 172, 'Discards left today: ' + st.discards + ' of 2', { size: 19, color: st.discards ? BLD_T.amber : BLD_T.bad });
    for (let s = 0; s < 3; s++) {
      const y = 202 + s * 138, i = st.held[s];
      ui.card(892, y, 360, 130);
      if (i === undefined) { ui.text(1072, y + 65, 'Empty slot', { size: 20, color: BLD_T.off, ox: 0.5, oy: 0.5 }); continue; }
      const q = BLD_QUESTS[i], done = st.progress[i] || 0;
      ui.text(906, y + 10, q[1], { size: 21, title: true, color: BLD_T.gold, fit: 220 });
      ui.text(906, y + 42, q[2], { size: 17, fit: 330 });
      ui.bar(906, y + 78, 196, 30, done / q[3], BLD_C.blue, done + ' / ' + q[3]);
      ui.button(1116, y + 68, 124, 50, 'Discard', function () {
        ui.confirm('Discard "' + q[1] + '"?', 'It is gone for today and its progress is lost. Discards left: ' + st.discards + '.', 'Discard', function () {
          st.held = st.held.filter((n) => n !== i); st.gone.push(i); delete st.progress[i]; st.discards -= 1;
        }, 'bad');
      }, { kind: st.discards ? 'bad' : 'off', why: 'No discards left today' });
    }
    ui.text(894, 624, 'Finish all 3 for a gem bonus', { size: 19, bold: true });
    ui.bar(894, 652, 356, 30, 0, BLD_C.good, '0 / 3 finished');
    ui.text(894, 686, 'Unfinished quests carry over.', { size: 16, color: BLD_T.dim });
  },
};

// =============================================================================================
BUILDINGS.wandering_merchant = {
  title: 'Wandering Merchant', area: 'Town Center  ·  the covered wagon', money: ['gold'],
  tabs: ['Wares', 'Barter'],
  init: function () { return {}; },
  draw: function (ui, st, tab) {
    ui.panel(16, 146, 380, 562, 'At the wagon');
    ui.art(28, 192, 356, 344, 'MERCHANT AND WAGON', { feature: true });
    ui.text(28, 548, 'Sample Merchant: the Ore Trader', { size: 21, bold: true, fit: 356 });
    ui.text(28, 580, 'Specialty: materials', { size: 18, color: BLD_T.dim });
    ui.text(28, 612, 'Leaves in 1 day 14 hours', { size: 20, color: BLD_T.amber });
    ui.text(28, 646, 'Merchants take turns, each for a couple of days. Only the one here is selling.', { size: 16, color: BLD_T.dim, wrap: 356 });

    if (tab === 0) {
      ui.card(408, 146, 856, 150, { selected: true });
      ui.art(424, 160, 122, 122, 'deal art');
      ui.text(564, 164, 'Special deal this visit', { size: 28, title: true, color: BLD_T.gold });
      ui.tag(564, 204, 'IDEA');
      ui.text(564, 240, 'Sample rare bundle', { size: 20 });
      ui.button(1044, 188, 200, 66, 'Trade', null, { kind: 'main' });
      const a = ui.panel(408, 308, 856, 400, 'Rotating stock');
      ui.tag(a.x + a.w, 318, 'IDEA: paid in gold or materials, not gems', { right: true });
      const wares = ['Rare ore', 'Hardwood', 'Rare hide', 'Silk bolt', 'Foraged bundle', 'Rare gear', 'Hero shards', 'Crystal'];
      ui.grid('wares', a, wares, 4, 212, function (n, x, y, w, h) {
        ui.card(x, y, w, h);
        ui.art(x + 12, y + 12, w - 24, 98, 'item art');
        ui.text(x + w / 2, y + 120, n, { size: 19, bold: true, ox: 0.5, fit: w - 12 });
        ui.text(x + w / 2, y + 144, 'Stock: 3', { size: 15, color: BLD_T.dim, ox: 0.5 });
        ui.button(x + 12, y + h - 46, w - 24, 38, 'Cost not set', function () { ui.todo('Buy ' + n); }, { size: 17 });
      });
    } else {
      ui.panel(408, 146, 856, 562, 'Barter');
      ui.tag(1250, 158, 'IDEA: trade overflow materials', { right: true });
      [['You give', 450], ['You get', 970]].forEach(function (c) {
        ui.text(c[1] + 124, 220, c[0], { size: 26, title: true, color: BLD_T.gold, ox: 0.5 });
        ui.slot(c[1] + 44, 264, 160, { icon: '+', label: 'Choose material', onTap: function () { ui.todo('Choose material'); } });
        ui.text(c[1] + 124, 444, 'Amount: 0', { size: 20, ox: 0.5 });
        ui.button(c[1] + 44, 478, 74, 56, '−', function () { ui.todo('Amount'); }, { size: 28 });
        ui.button(c[1] + 130, 478, 74, 56, '+', function () { ui.todo('Amount'); }, { size: 28 });
      });
      ui.text(836, 330, '→', { size: 90, color: BLD_T.gold, ox: 0.5 });
      ui.button(616, 610, 440, 74, 'Make the trade', null, { kind: 'main' });
    }
  },
};
