// battlePrep.js - the screen before every battle: gear up the main character, then tap Start Battle.
// SCREEN ONLY. It shows the same gear panels as the Armory (armory.js).
// Load order in index.html: after armory.js, before main.js.

const PREP_ID = 'battle_prep';

BUILDINGS[PREP_ID] = {
  title: 'Battle Preparation', area: 'No battle starts until you tap the battle button', money: [], tabs: [],
  init: function () { return armGearState(); },
  draw: function (ui, st) {
    const again = typeof queuedRetry === 'function' ? queuedRetry() : null; // set when you tapped Retry on the result screen
    if (again) {
      ui.text(24, 96, 'Retry: ' + prepNodeName(again.nodeId) + ', with the same heroes. Change your gear if you like.', { size: 21, oy: 0.5, fit: 880 });
      ui.text(24, 126, 'Heroes: ' + again.heroIds.map(prepHeroName).join(', '), { size: 17, oy: 0.5, color: BLD_T.dim, fit: 880 });
    } else ui.text(24, 109, 'Choose your main character\'s gear, then start the fight.', { size: 21, oy: 0.5, fit: 880 });
    ui.button(932, 80, 332, 58, again ? 'Retry Battle  ›' : 'Start Battle  ›', function () { prepStartBattle(ui.scene); }, { kind: 'main', size: 26 });
    armGearScreen(ui, st);
  },
};

function prepNodeName(id) { const n = GAME_DATA.nodes[id]; return String((n && n['Name']) || id); }
function prepHeroName(id) { const h = GAME_DATA.heroes[id]; return String((h && h['Hero Name']) || id); }

// Opens the preparation screen from another scene (the battle's result screen uses this)
function openBattlePrep(fromScene) {
  fromScene.scene.start('Building', { id: PREP_ID });
}

function prepFadeTo(scene, then) {
  if (scene.bld.leaving) return; // already on the way out, so a double tap does nothing
  scene.bld.leaving = true;
  bldState(PREP_ID).modal = null;
  const cam = scene.cameras.main;
  cam.fadeOut(200, 0, 0, 0);
  cam.once('camerafadeoutcomplete', then);
}

function prepStartBattle(scene) {
  prepFadeTo(scene, function () {
    scene.scene.stop('Town');            // the town may be waiting asleep behind this screen
    scene.scene.start(battleScene.key);  // closes this screen and starts the fight
  });
}

// The "‹ Town" button. After a battle the town is not waiting behind this screen, so it has to be opened again.
const prepBaseLeave = bldLeave;
bldLeave = function (scene) {
  if (scene.bldId !== PREP_ID || scene.scene.isSleeping('Town')) { prepBaseLeave(scene); return; }
  prepFadeTo(scene, function () { scene.scene.start('Town'); });
};

// The Campaign Gate opens the preparation screen instead of starting a battle. Coming in this way always means a new fight.
TOWN_ACTIONS.campaign_gate = function (scene) { if (typeof clearRetry === 'function') clearRetry(); bldOpen(scene, PREP_ID); };
