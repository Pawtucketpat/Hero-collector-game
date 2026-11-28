// fullscreen.js - a small full screen button in the bottom left corner (like the one on a video).
// Android and iPad: one tap fills the screen. Android also turns the game sideways.
// iPhone: the browser does not let a web page do this, so the button explains how to add the game to the Home Screen.
// The button is hidden when the game is opened from a Home Screen icon. This file works on its own.
(function () {
  // ===== SETTINGS =====
  const BUTTON_SIZE = 40;   // button width and height

  const openedFromIcon = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
  if (openedFromIcon) return;

  const page = document.documentElement;
  const enter = page.requestFullscreen || page.webkitRequestFullscreen;
  const canFill = !!enter && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const isFull = function () { return !!(document.fullscreenElement || document.webkitFullscreenElement); };
  const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  // a square with four arrows: pointing out to the corners = go full screen, pointing in = leave
  const icon = function (arrows) {
    return '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2" y="2" width="20" height="20" rx="2"/><path d="' + arrows + '"/></svg>';
  };
  const OPEN = icon('M10 10L6 6M6 9.5V6H9.5 M14 10L18 6M14.5 6H18V9.5 M14 14L18 18M18 14.5V18H14.5 M10 14L6 18M9.5 18H6V14.5');
  const CLOSE = icon('M5.5 5.5L10 10M10 6.5V10H6.5 M18.5 5.5L14 10M14 6.5V10H17.5 M18.5 18.5L14 14M14 17.5V14H17.5 M5.5 18.5L10 14M6.5 14H10V17.5');

  const button = document.createElement('button');
  button.id = 'fullscreen-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Full screen');
  button.style.cssText = 'position:fixed;left:max(2px,env(safe-area-inset-left));bottom:max(1px,env(safe-area-inset-bottom));' +
    'width:' + BUTTON_SIZE + 'px;height:' + BUTTON_SIZE + 'px;padding:0;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,.55);border:0;border-radius:6px;z-index:10;touch-action:manipulation';
  button.innerHTML = OPEN;

  let help = null;
  function closeHelp() {
    if (help) help.remove();
    help = null;
  }
  function showHelp() {
    closeHelp();
    const steps = isApple
      ? 'In Safari, tap Share, then <b>Add to Home Screen</b>. Leave "Open as Web App" on if you see it. Then open the game from its new icon.'
      : 'Open the game in Chrome. In the ⋮ menu, tap <b>Add to Home screen</b>, then open the game from its new icon.';
    help = document.createElement('div');
    help.id = 'fullscreen-help';
    help.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.8);z-index:11';
    help.innerHTML = '<div style="max-width:420px;margin:16px;padding:18px;background:#14141c;border:2px solid #f2c66a;border-radius:10px;' +
      'color:#fff;font:17px/1.4 Arial,sans-serif;text-align:center"><div style="font-size:20px;font-weight:bold;margin-bottom:8px">Play full screen</div>' +
      'This browser can\'t fill the screen from a button. ' + steps + '<div style="margin-top:14px;color:#ffcc66">Tap anywhere to close</div></div>';
    help.addEventListener('click', closeHelp);
    keepTapsFromGame(help);
    document.body.appendChild(help);
  }

  // The game also listens to touches on the whole window. These stop a tap on the button from reaching it.
  function keepTapsFromGame(element) {
    ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(function (type) {
      element.addEventListener(type, function (e) { e.stopPropagation(); });
    });
  }

  // Turning the game sideways only works while full screen, and only in some browsers (Android Chrome does)
  function turnSideways() {
    if (!screen.orientation || !screen.orientation.lock) return;
    const asked = screen.orientation.lock('landscape');
    if (asked && asked.catch) asked.catch(function () {});
  }

  button.addEventListener('click', function () {
    if (isFull()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    if (!canFill) { showHelp(); return; }
    let asked;
    try { asked = enter.call(page, { navigationUI: 'hide' }); }
    catch (e) { showHelp(); return; }
    if (asked && asked.then) asked.then(turnSideways, showHelp);
    else turnSideways(); // older Safari gives no answer back
  });
  keepTapsFromGame(button);

  const changed = function () { button.innerHTML = isFull() ? CLOSE : OPEN; };
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);
  document.body.appendChild(button);
})();
