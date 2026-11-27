// fightRules.js - rules about a whole fight: the turn limit, and which node and heroes it is (so it can be retried).
// RULES ONLY: nothing here draws on the screen.
// Load order in index.html: after combatEngine.js, passives.js, gearPassives.js and playerGear.js, before main.js.

// ===== SETTINGS =====
const TURN_LIMIT = 300;        // a fight still going after this many turns is a defeat (a turn = one character acting, either side, all stages together)
const TURN_WARNING_AT = 250;   // the battle screen shows the turn counter from this turn on
const RETRY_SAME_LUCK = true;  // true: Retry repeats the same turn order and dice rolls. false: Retry rolls new ones

// ===== THE FIGHT =====
// This small record is all it takes to set a fight up again:
//   { nodeId: the node, heroIds: the 4 heroes beside the main character, seed: where the dice rolls start }
// Your gear is not part of it, so you can change gear before a retry.
let retryFight = null; // the fight waiting to be retried, if there is one

function newSeed() { return Math.floor(Math.random() * 4294967296); }

function newFight() {
  return { nodeId: pickRandomNodeId(), heroIds: shuffleList(Object.keys(GAME_DATA.heroes)).slice(0, 4), seed: newSeed() };
}

function queueRetry(fight) {
  retryFight = { nodeId: fight.nodeId, heroIds: fight.heroIds.slice(), seed: RETRY_SAME_LUCK ? fight.seed : newSeed() };
}
function queuedRetry() { return retryFight; }
function clearRetry() { retryFight = null; }

// The fight that starts now: the one being retried, or else a new one
function takeNextFight() {
  const fight = retryFight || newFight();
  retryFight = null;
  return fight;
}

// ===== TURN LIMIT =====
// The number of the turn being played now (1 for the first turn)
function turnNumber(state) { return Math.min((state.turnsTaken || 0) + 1, TURN_LIMIT); }
function showTurnCounter(state) { return turnNumber(state) >= TURN_WARNING_AT; }

// Called when a turn ends. A win or loss on the very last turn still counts as what it is.
function countTurn(state) {
  state.turnsTaken = (state.turnsTaken || 0) + 1;
  if (!state.over && state.turnsTaken >= TURN_LIMIT) {
    state.over = 'defeat';
    state.overReason = 'turnLimit';
    state.waveCleared = false; // clearing a stage on the last turn leaves no turns for the next one
  }
}

// Every finished turn is counted, after everything else that happens at the end of a turn
const endTurnBeforeLimit = endTurn;
endTurn = function (state) {
  const result = endTurnBeforeLimit.apply(this, arguments);
  countTurn(state);
  return result;
};
