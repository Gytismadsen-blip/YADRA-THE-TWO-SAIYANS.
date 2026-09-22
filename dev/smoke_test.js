// Smoke test: stand next to every single building in every town/route and render a frame there.
// Catches crashes like the guard-building bug (townInfo threw for ANY building in ANY town
// because the lookup object's 'guard' branch was evaluated unconditionally).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function makeFakeObj() { const store = {}; const h = { get(t, p) { if (p === 'then' || typeof p === 'symbol') return undefined; if (!(p in store)) store[p] = makeFakeObj(); return store[p]; }, set(t, p, v) { store[p] = v; return true; }, apply() { return makeFakeObj(); } }; return new Proxy(function () {}, h); }
let pendingRAF = null, pageErrors = [];
const dom = new JSDOM(html, {
  url: 'https://yadra.test/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = () => makeFakeObj();
    window.AudioContext = function () { return makeFakeObj(); }; window.webkitAudioContext = window.AudioContext;
    window.speechSynthesis = { speak() {}, cancel() {}, getVoices() { return []; }, onvoiceschanged: null };
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.requestAnimationFrame = (cb) => { pendingRAF = cb; return 1; };
    window.cancelAnimationFrame = () => {}; window.scrollTo = () => {};
    window.addEventListener('error', e => pageErrors.push(e.message));
  }
});
const Y = dom.window.__yadra;
function pump(n, dt) { let t = 1000; for (let i = 0; i < n; i++) { t += dt; try { if (pendingRAF) pendingRAF(t); } catch (e) { pageErrors.push(e.message); } } }
Y.press('ok'); Y.press('ok'); for (let i = 0; i < 6; i++) Y.press('ok'); Y.press('down'); Y.press('ok'); pump(5, 16);
Y.saveData.miles = 5; Y.saveData.wins = 3;

let ok = true;
for (const town of Y.allTowns()) {
  for (const spot of Y.buildingSpots(town)) {
    pageErrors = [];
    Y.goto(town, spot.x, spot.y); pump(3, 16);
    if (pageErrors.length) { ok = false; console.log('FAIL near', town, spot.label, '->', pageErrors[0]); }
  }
}
console.log(ok ? 'SMOKE TEST OK (no crashes standing next to any building)' : 'SMOKE TEST FAILED');
process.exit(ok ? 0 : 1);
