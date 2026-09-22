// Headless regression test for Gytis' real bug report: with all 3 stats already maxed at 12,
// the '20X GRAVITY' side mission (questReady('keshin') needs saveData.did20x) could never be
// completed, because the maxed-stat check returned before ever reaching trApply() (the only
// place that set did20x) - a genuine softlock for anyone who trains to full before trying 20x.
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

let ok = true;
function check(cond, label) { if (!cond) { ok = false; console.log('FAIL:', label); } else console.log('ok:', label); }

Y.goto('village', 140, 178);
Y.saveData.train = Object.assign({}, Y.saveData.train, { body: 12, ki: 12, focus: 12, sessions: 3, fatigue: 0, grav: 0 });
check(!Y.did20x, 'did20x starts false');
Y.enterGravityHall();
Y.setTrIdx(3); Y.press('ok'); Y.press('ok'); Y.press('ok'); Y.press('ok'); // GRAVITY row: cycle 1x->3x->5x->10x->20x (4 presses)
Y.setTrIdx(0); Y.press('ok'); // train BODY (already maxed at 12) while gravity is set to 20x
check(Y.did20x, 'holding 20x with a fully maxed stat still completes the 20X GRAVITY mission');
check(/20X GRAVITY/.test(Y.trMsg), 'training screen explains what happened -> ' + Y.trMsg);

console.log(ok ? 'GRAVITY SOFTLOCK TEST OK' : 'GRAVITY SOFTLOCK TEST FAILED');
process.exit(ok ? 0 : 1);
