const WAVE_COUNT = 3;
const SLOTS_PER_WAVE = 5;
function pickRandomNodeId() {
  const ids = Object.keys(GAME_DATA.nodes);
  if (ids.length === 0) { console.error('No nodes loaded. Check data/nodes.csv'); return null; }
  const last = localStorage.getItem('lastNodeId');
  let choices = ids;
  if (ids.length > 1) { choices = ids.filter(id => id !== last); }
  const picked = choices[Math.floor(Math.random() * choices.length)];
  localStorage.setItem('lastNodeId', picked);
  return picked;
}
function buildNodeBattle(nodeId) {
  const node = GAME_DATA.nodes[nodeId];
  if (!node) { console.error('Node not found: ' + nodeId); return null; }
  const waves = [];
  for (let w = 1; w <= WAVE_COUNT; w++) {
    const wave = [];
    for (let s = 1; s <= SLOTS_PER_WAVE; s++) {
      const mobId = node['Wave ' + w + ' Slot ' + s];
      if (!mobId) { wave.push(null); }
      else if (GAME_DATA.mobs[mobId]) { wave.push(Object.assign({}, GAME_DATA.mobs[mobId])); }
      else { console.warn('Mob ID not found: ' + mobId + ' (node ' + nodeId + ')'); wave.push(null); }
    }
    waves.push(wave);
  }
  return { nodeId: nodeId, name: node['Name'] || nodeId, background: node['Background'] || '', waves: waves };
}
function startRandomNodeBattle() {
  const id = pickRandomNodeId();
  if (!id) return null;
  const battle = buildNodeBattle(id);
  console.log('Node ' + id + ' loaded: ' + battle.waves.length + ' waves');
  return battle;
}
function shuffleList(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]; copy[i] = copy[j]; copy[j] = temp;
  }
  return copy;
}
function pickRandomHeroes(count) {
  const howMany = count || 5;
  const ids = Object.keys(GAME_DATA.heroes);
  if (ids.length < howMany) { console.warn('Only ' + ids.length + ' heroes in the sheet, wanted ' + howMany); }
  const chosen = shuffleList(ids).slice(0, howMany);
  return chosen.map(id => Object.assign({}, GAME_DATA.heroes[id]));
}
