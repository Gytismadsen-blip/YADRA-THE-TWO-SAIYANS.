// Headless test: sister mission stays out of the log until accepted, Golden Ramen now needs accept/decline.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function makeFakeObj() {
  const store = {};
  const handler = {
    get(t, p) { if (p === 'then' || typeof p === 'symbol') return undefined; if (!(p in store)) store[p] = makeFakeObj(); return store[p]; },
    set(t, p, v) { store[p] = v; return true; }, apply() { return makeFakeObj(); }
  };
  return new Proxy(function () {}, handler);
}
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
const { window } = dom;
const Y = window.__yadra;
function pump(n, dt) { let t = 1000; for (let i = 0; i < n; i++) { t += dt; if (pendingRAF) pendingRAF(t); } }

Y.press('ok'); Y.press('ok'); for (let i = 0; i < 6; i++) Y.press('ok'); Y.press('down'); Y.press('ok');
pump(5, 16);
if (!Y.saveData) throw new Error('save was not created');

let ok = true;
// --- sister mission must be hidden from the log before you accept it ---
const missionsBefore = Y.missions().map(m => m.id);
if (missionsBefore.includes('sister')) { ok = false; console.log('FAIL: sister mission visible before acceptance', missionsBefore); }
else console.log('ok: sister mission hidden before acceptance');

// accept it
Y.setQuestStep(1);
const missionsAfter = Y.missions().map(m => m.id);
if (!missionsAfter.includes('sister')) { ok = false; console.log('FAIL: sister mission still hidden after acceptance'); }
else console.log('ok: sister mission appears after acceptance');

// --- golden ramen must now ask before starting (no longer auto-starts on first talk) ---
Y.goto('village', 140, 178); // force out of the intro cutscene so 'ok' dismisses talk bubbles normally
Y.setQ2Step(0);
Y.cookTalk();
Y.press('ok'); // dismiss the ask-line bubble, which is what reveals the yes/no choice (same 2-step flow as the boy's quest)
const stepAfterFirstTalk = Y.saveData.q2.step;
const choiceShown = !!Y.choice;
if (stepAfterFirstTalk !== 0 || !choiceShown) { ok = false; console.log('FAIL: golden ramen still auto-starts, step=', stepAfterFirstTalk, 'choice=', Y.choice); }
else console.log('ok: golden ramen now shows a choice instead of auto-starting, choice=', JSON.stringify(Y.choice));

// pick "I WILL HELP YOU"
Y.pickYes();
const stepAfterYes = Y.saveData.q2.step;
if (stepAfterYes !== 1) { ok = false; console.log('FAIL: accepting golden ramen did not advance step, got', stepAfterYes); }
else console.log('ok: accepting golden ramen starts the quest (step=1)');

console.log(ok ? 'ALL QUEST FIXES OK' : 'QUEST FIX TEST FAILED');
process.exit(ok ? 0 : 1);
