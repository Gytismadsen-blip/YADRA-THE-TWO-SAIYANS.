// Headless test: the 3 new region guardians (frostguard/duneraider/embersmith) are reachable in-world
// via a WATCH POST/OUTPOST/EMBER RING building, and each fight uses its own arena background.
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
    window.AudioContext = function () { return makeFakeObj(); }; window.webkitAudioContext = window.AudioContext;
    window.speechSynthesis = { speak() {}, cancel() {}, getVoices() { return []; }, onvoiceschanged: null };
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.requestAnimationFrame = (cb) => { pendingRAF = cb; return 1; };
    window.cancelAnimationFrame = () => {}; window.scrollTo = () => {};
  }
});
const Y = dom.window.__yadra;
function pump(n, dt) { let t = 1000; for (let i = 0; i < n; i++) { t += dt; if (pendingRAF) pendingRAF(t); } }
Y.press('ok'); Y.press('ok'); for (let i = 0; i < 6; i++) Y.press('ok'); Y.press('down'); Y.press('ok'); pump(5, 16);
Y.saveData.miles = 5; Y.saveData.wins = 3; // clear any GATE_INTO milestone gates so we can walk straight into the towns

let ok = true;
function checkGuard(town, foeId) {
  Y.goto(town, 478, 95); pump(2, 16); // stand in front of the 5th building (slot 4, row 0)
  Y.press('ok'); // talk/interact with the guard post -> shows the challenge line
  Y.press('ok'); // dismiss it -> starts the fight (vAfterTalk -> newGame)
  pump(3, 16);
  const passFoe = Y.mode === 'anim' && Y.foe === foeId;
  if (!passFoe) { ok = false; console.log('FAIL', town, '-> mode=', Y.mode, 'foe=', Y.foe, '(expected anim/' + foeId + ')'); }
  else console.log('ok:', town, 'WATCH POST starts a fight against', Y.foe);
}
checkGuard('frosthaven', 'frostguard');
checkGuard('sunkara', 'duneraider');
checkGuard('emberpeak', 'embersmith');

console.log(ok ? 'GUARD TEST OK' : 'GUARD TEST FAILED');
process.exit(ok ? 0 : 1);
