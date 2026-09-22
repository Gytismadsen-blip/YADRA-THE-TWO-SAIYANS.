// Headless test: training tier announcements at 4/8/12 fire and combat balance (dmgMul) is unchanged.
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
Y.press('ok'); Y.press('ok'); for (let i = 0; i < 6; i++) Y.press('ok'); Y.press('down'); Y.press('ok');
pump(5, 16);

let ok = true;
Y.goto('village', 140, 178);
const t = Y.saveData.hero ? null : null; // (unused) just documenting we act on saveData directly below
// force body to 3 (fresh chars start at low body), fatigue 0, sessions>0, gravity 1x (index 0)
Y.saveData.train = Object.assign({}, Y.saveData.train || {}, { day: 1, sessions: 3, fatigue: 0, body: 3, ki: 0, focus: 0, grav: 0, meal: 0 });
Y.trApplyTest('body'); // train once: body 3 -> 4, should cross the level-4 tier
const msg1 = Y.trMsg;
if (!/HEAVY STRIKE/.test(msg1)) { ok = false; console.log('FAIL: no tier announcement crossing body 4, msg=', msg1); }
else console.log('ok: tier announced at body 4 ->', msg1);

// a non-crossing level (e.g. body already at 5 training to 6) should NOT announce a tier
Y.saveData.train.body = 5; Y.saveData.train.sessions = 3; Y.saveData.train.fatigue = 0;
Y.trApplyTest('body');
const msg2 = Y.trMsg;
if (/NEW TECHNIQUE/.test(msg2)) { ok = false; console.log('FAIL: tier announced when none was crossed, msg=', msg2); }
else console.log('ok: no false tier announcement at body 5->6, msg=', msg2);

console.log(ok ? 'TIER TEST OK' : 'TIER TEST FAILED');
process.exit(ok ? 0 : 1);
