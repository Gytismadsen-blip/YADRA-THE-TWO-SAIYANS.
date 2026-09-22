// Headless test: desktop mouse click-to-move + auto-interact on arrival (new feature, Gytis asked
// for it mid-session: "on computer you should also be able to click around with the mouse").
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function makeFakeObj() { const store = {}; const h = { get(t, p) { if (p === 'then' || typeof p === 'symbol') return undefined; if (!(p in store)) store[p] = makeFakeObj(); return store[p]; }, set(t, p, v) { store[p] = v; return true; }, apply() { return makeFakeObj(); } }; return new Proxy(function () {}, h); }
let pendingRAF = null;
const dom = new JSDOM(html, {
  url: 'https://yadra.test/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = () => makeFakeObj();
    window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 320, bottom: 240, width: 320, height: 240 });
    window.AudioContext = function () { return makeFakeObj(); }; window.webkitAudioContext = window.AudioContext;
    window.speechSynthesis = { speak() {}, cancel() {}, getVoices() { return []; }, onvoiceschanged: null };
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.requestAnimationFrame = (cb) => { pendingRAF = cb; return 1; };
    window.cancelAnimationFrame = () => {}; window.scrollTo = () => {};
  }
});
const { window } = dom;
const Y = window.__yadra;
function pump(n, dt) { let t = 1000; for (let i = 0; i < n; i++) { t += dt; if (pendingRAF) pendingRAF(t); } }
Y.press('ok'); Y.press('ok'); for (let i = 0; i < 6; i++) Y.press('ok'); Y.press('down'); Y.press('ok'); pump(5, 16);

let ok = true;
function check(cond, label) { if (!cond) { ok = false; console.log('FAIL:', label); } else console.log('ok:', label); }

function click(x, y) {
  const cv = window.document.getElementById('c');
  const evt = new window.Event('pointerdown', { bubbles: true });
  evt.clientX = x; evt.clientY = y;
  cv.dispatchEvent(evt);
}

// plain ground click: character should walk toward it (CW===320 here, so screen px == world px in village mode)
Y.goto('village', 140, 178); pump(2, 16);
const before = Y.pos;
click(300, 178); // somewhere to the right, open ground
pump(90, 16); // let it walk for ~1.4s of simulated time
const after = Y.pos;
check(after.x > before.x + 20, 'clicking open ground makes the character walk toward it (x ' + before.x.toFixed(0) + ' -> ' + after.x.toFixed(0) + ')');

// clicking a stationary interactable (a town sign) and letting the walk finish should auto-interact on arrival
Y.saveData.miles = 5; Y.saveData.wins = 3;
Y.goto('tavora', 200, 112); pump(2, 16); // same street band as the sign at (30, 112), so the straight-line walk has a clear path
click(30, 112);
pump(300, 16); // plenty of time to walk across town
check(!!Y.talk, 'arriving at a clicked sign auto-reads it (talk=' + JSON.stringify(Y.talk) + ')');

// pressing an arrow key should cancel an in-progress mouse walk (keyboard always wins)
Y.goto('village', 40, 178); pump(2, 16);
click(400, 300); // far off-target
pump(5, 16);
const midway = Y.pos;
const kd = new window.KeyboardEvent('keydown', { key: 'ArrowUp' });
window.dispatchEvent(kd);
pump(20, 16);
const afterKey = Y.pos;
check(Math.abs(afterKey.x - midway.x) < 5, 'pressing an arrow key cancels the mouse walk (x barely moved: ' + midway.x.toFixed(0) + ' -> ' + afterKey.x.toFixed(0) + ')');
check(afterKey.y < midway.y - 5, 'and the keyboard press actually moved the character up instead (y ' + midway.y.toFixed(0) + ' -> ' + afterKey.y.toFixed(0) + ')');

console.log(ok ? 'MOUSE CLICK TEST OK' : 'MOUSE CLICK TEST FAILED');
process.exit(ok ? 0 : 1);
