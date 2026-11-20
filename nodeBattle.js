// nodeBattle.js
// Picks a random node and builds its three waves from GAME_DATA.

const WAVE_COUNT = 3;
const SLOTS_PER_WAVE = 5;

// Picks a random node ID. Avoids repeating the last node when there is a choice.
function pickRandomNodeId() {
  const ids = Object.keys(GAME_DATA.nodes);
  if (ids.length === 0) {
    console.error('No nodes loaded. Check data/nodes.csv');
    return null;
  }

  const last = localStorage.getItem('lastNodeId');
  let choices = ids;
  if (ids.length > 1) {
    choices = ids.filter(id => id !== last);
  }

  const picked = choices[Math.floor(Math.random() * choices.length)];
  localStorage.setItem('lastNodeId', picked);
  return picked;
}

// Builds a battle from a node ID.
// Returns { nodeId, name, background, waves: [ [mob, mob, ...], ... ] }
// Each wave is a list of 5 entries, one per slot. An empty slot is null.
function buildNodeBattle(nodeId) {
  const node = GAME_DATA.nodes[nodeId];
  if (!node) {
    console.error('Node not found: ' + nodeId);
    return null;
  }

  const waves = [];
  for (let w = 1; w <= WAVE_COUNT; w++) {
    const wave = [];
    for (let s = 1; s <= SLOTS_PER_WAVE; s++) {
      const mobId = node['Wave ' + w + ' Slot ' + s];
      if (!mobId) {
        wave.push(null);            // empty slot
      } else if (GAME_DATA.mobs[mobId]) {
        // copy the mob so changing health in battle never edits the database
        wave.push(Object.assign({}, GAME_DATA.mobs[mobId]));
      } else {
        console.warn('Mob ID not found: ' + mobId + ' (node ' + nodeId + ')');
        wave.push(null);
      }
    }
    waves.push(wave);
  }

  return {
    nodeId: nodeId,
    name: node['Name'] || nodeId,
    background: node['Background'] || '',
    waves: waves
  };
}

// Convenience: pick a random node and build it in one call.
function startRandomNodeBattle() {
  const id = pickRandomNodeId();
  if (!id) return null;
  const battle = buildNodeBattle(id);
  console.log('Node ' + id + ' loaded: ' + battle.waves.length + ' waves');
  return battle;
}