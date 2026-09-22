// Headless test for the new coin sink: Golden Spice + Spirit Feast (Trin 7, "more to spend coins on").
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
Y.goto('village', 140, 178);

let ok = true;
function check(cond, label) { if (!cond) { ok = false; console.log('FAIL:', label); } else console.log('ok:', label); }

Y.saveData.coins = 100;
Y.buyIng('spice');
check(Y.ing.spice === 1 && Y.saveData.coins === 78, 'bought 1 spice for 22 coins, ing=' + JSON.stringify(Y.ing) + ' coins=' + Y.saveData.coins);

Y.saveData.train = Object.assign({}, Y.saveData.train, { sessions: 3 });
Y.buyIng('herb'); Y.buyIng('root'); Y.buyIng('honey');
Y.saveData.train.inv = ['small']; // a fish in the bag, the feast needs one
const before = Y.did20x; // unrelated, just touching a getter to make sure nothing throws first
Y.cookDish('feast');
check(Y.buff.body === 3 && Y.buff.focus === 3, 'cooking the Spirit Feast gives +3 Body and +3 Focus for the day, buff=' + JSON.stringify(Y.buff));
check(Y.ing.spice === 0 && Y.ing.herb === 0 && Y.ing.root === 0 && Y.ing.honey === 0, 'all 4 ingredients were consumed, ing=' + JSON.stringify(Y.ing));

console.log(ok ? 'FEAST TEST OK' : 'FEAST TEST FAILED');
process.exit(ok ? 0 : 1);
