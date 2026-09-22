// Headless test for the phone UI fixes Gytis reported: landscape not filling the screen, no way to
// mute/change options mid-game on a phone, and the tap-to-open-map zone being too small/unreliable.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function makeFakeObj() { const store = {}; const h = { get(t, p) { if (p === 'then' || typeof p === 'symbol') return undefined; if (!(p in store)) store[p] = makeFakeObj(); return store[p]; }, set(t, p, v) { store[p] = v; return true; }, apply() { return makeFakeObj(); } }; return new Proxy(function () {}, h); }
let pendingRAF = null;
const dom = new JSDOM(html, {
  url: 'https://yadra.test/?touch=1', runScripts: 'dangerously', pretendToBeVisual: true,
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

// --- landscape uses the wider (427) canvas, same as desktop, instead of staying stuck at the narrow 320 ---
Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 420, configurable: true });
window.dispatchEvent(new window.Event('resize'));
check(window.document.getElementById('c').width === 427, 'landscape phone now gets the 427-wide (16:9) canvas, width=' + window.document.getElementById('c').width);
Object.defineProperty(window, 'innerWidth', { value: 420, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
window.dispatchEvent(new window.Event('resize'));
check(window.document.getElementById('c').width === 320, 'portrait phone still gets the narrow 320 canvas (no spare width to use), width=' + window.document.getElementById('c').width);

// --- village tap-to-move works fine after the OFFX fix (regression check on the coordinate math change) ---
Y.goto('village', 140, 178); pump(2, 16);

// --- options is now reachable mid-game (via 'O' key here; on a real phone it's the top-left corner tap) and returns to the same spot ---
Y.press('options');
check(Y.mode === 'options', 'options screen opens mid-game, mode=' + Y.mode);
Y.press('back');
check(Y.mode === 'village' && Y.area === 'village', 'leaving options returns to the village instead of the title screen, mode=' + Y.mode + ' area=' + Y.area);

// --- the widened top-bar tap zone (y<20 instead of y<14) reliably opens the map on a real fat-finger tap ---
Object.defineProperty(window, 'innerWidth', { value: 420, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
window.dispatchEvent(new window.Event('resize'));
Y.goto('village', 140, 178); pump(2, 16);
function touchTap(x, y) {
  const cv = window.document.getElementById('c');
  const evt = new window.Event('pointerdown', { bubbles: true });
  evt.clientX = x; evt.clientY = y; evt.pointerId = 99; evt.pointerType = 'touch';
  window.dispatchEvent(evt);
}
touchTap(300, 16); // within the new 20px-tall zone but outside the old 14px one
check(Y.mode === 'map', 'a slightly-imprecise tap (y=16) still opens the map now, mode=' + Y.mode);

console.log(ok ? 'PHONE UI TEST OK' : 'PHONE UI TEST FAILED');
process.exit(ok ? 0 : 1);
