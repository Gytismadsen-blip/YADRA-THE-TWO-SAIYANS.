// Headless end-to-end test for the chapter 2 storyline: astronomer gate -> 3 guardian shards -> rift -> final boss.
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
Y.saveData.miles = 5;

let ok = true;
function check(cond, label) { if (!cond) { ok = false; console.log('FAIL:', label); } else console.log('ok:', label); }

// gate: before being Champion of Yardrat, the astronomer should refuse
Y.saveData.quests = Object.assign({}, Y.saveData.quests, { oraya: 1 });
Y.ch2Talk();
check(!Y.ch2 || Y.ch2.step === 0, 'chapter 2 does not start before Champion of Yardrat is done');

// become Champion of Yardrat, then the astronomer offers the quest
Y.saveData.quests.oraya = 2;
Y.ch2Talk(); // shows the ask line
Y.press('ok'); // dismiss the ask-line bubble to reveal the actual yes/no choice
check(!!Y.choice, 'astronomer offers a real accept/decline choice, not an auto-start');
Y.pickYes();
check(Y.ch2.step === 1, 'accepting starts chapter 2 (step 1)');

// beating a guardian before accepting the quest should not grant a shard (sanity: quest gates the reward)
// beat all three guardians now that the quest is active
function beatGuardian(town, foeId) {
  Y.goto(town, 478, 95); pump(2, 16);
  Y.press('ok'); Y.press('ok'); pump(3, 16); // talk to the guard post, dismiss challenge line -> fight starts
  check(Y.mode === 'anim' && Y.foe === foeId, 'fight started against ' + foeId);
  // force a win via the debug win path used elsewhere in this game's own test suite pattern: play out via the 'over' screen
  // simplest reliable path: use the engine's own foeAfter through a direct debug call
  Y.forceWin();
}
beatGuardian('frosthaven', 'frostguard');
beatGuardian('sunkara', 'duneraider');
beatGuardian('emberpeak', 'embersmith');
check(Y.ch2.frost === 1 && Y.ch2.dune === 1 && Y.ch2.ember === 1, 'all 3 shards collected: ' + JSON.stringify(Y.ch2));

// talk to the astronomer again: should advance to step 2 (rift open)
Y.goto('village', 140, 178);
Y.ch2Talk();
check(Y.ch2.step === 2, 'astronomer opens the rift once all 3 shards are in, step=' + (Y.ch2 && Y.ch2.step));

// entering the rift starts the final boss fight
Y.ch2Talk(); // "the rift is open, are you ready?"
Y.press('ok'); // dismiss to reveal the enter/not-yet choice
Y.press('ok'); // this choice uses a pick() callback (idx 0 = "ENTER THE RIFT", already selected by default)
pump(3, 16);
check(Y.mode === 'anim' && Y.foe === 'shadow', 'entering the rift starts the fight against the Shadow of Yardrat, foe=' + Y.foe);
Y.forceWin();
check(Y.ch2.step === 3, 'chapter 2 completes after beating the Shadow, step=' + (Y.ch2 && Y.ch2.step));

console.log(ok ? 'CHAPTER 2 TEST OK' : 'CHAPTER 2 TEST FAILED');
process.exit(ok ? 0 : 1);
