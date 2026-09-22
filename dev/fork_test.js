// Headless test for the new route-fork system (multiple lanes, only one continues on).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function makeFakeObj() {
  const store = {};
  const handler = {
    get(t, p) {
      if (p === 'then' || p === Symbol.toPrimitive || typeof p === 'symbol') return undefined;
      if (!(p in store)) store[p] = makeFakeObj();
      return store[p];
    },
    set(t, p, v) { store[p] = v; return true; },
    apply() { return makeFakeObj(); }
  };
  return new Proxy(function () {}, handler);
}

let pendingRAF = null;
const dom = new JSDOM(html, {
  url: 'https://yadra.test/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = () => makeFakeObj();
    window.AudioContext = function () { return makeFakeObj(); };
    window.webkitAudioContext = window.AudioContext;
    window.speechSynthesis = { speak() {}, cancel() {}, getVoices() { return []; }, onvoiceschanged: null };
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.requestAnimationFrame = (cb) => { pendingRAF = cb; return 1; };
    window.cancelAnimationFrame = () => {};
    window.scrollTo = () => {};
  }
});

const { window } = dom;
const Y = window.__yadra;
if (!Y) throw new Error('window.__yadra missing - harness not exposed');

function pump(frames, dtMs) {
  let t = 1000;
  for (let i = 0; i < frames; i++) { t += dtMs; if (pendingRAF) pendingRAF(t); }
}

// ---- create a fresh save through the real UI flow ----
// with no save yet, toTitle() already sets titleIdx=1 (NEW GAME), so no 'down' press needed
Y.press('ok');   // -> slots
Y.press('ok');   // -> creator row0
for (let i = 0; i < 6; i++) Y.press('ok'); // row0..row6 (name -> hair -> hairC -> eyes -> skin -> outfit -> randomize)
Y.press('down'); // row6 -> row7 (confirm row)
Y.press('ok');   // confirm creation -> newGame({intro:true})
pump(5, 16);
console.log('after creation: mode=', Y.mode, 'area=', Y.area, 'hasSave=', !!Y.saveData);
if (!Y.saveData) throw new Error('save was not created');

// give some milestones/time so nothing blocks us, then warp straight into route r2 (tavora<->keshin, 5 lanes since it has branches)
Y.saveData.miles = 5;
Y.saveData.wins = 3;

function testRoute(key) {
  const before = Y.area;
  Y.goto(key, 40, 150); // spawn in the open trunk zone, well before the fork
  pump(2, 16);
  const T_correct = null; // unknown from outside; we discover it by trying every lane
  console.log('--- route', key, '---');
  return true;
}

// Drive movement helper: hold a direction for N frames of dt, using real key events so `held` updates via the game's own listener.
function hold(key, frames, dt) {
  const ev = new window.KeyboardEvent('keydown', { key });
  window.dispatchEvent(ev);
  pump(frames, dt);
  window.dispatchEvent(new window.KeyboardEvent('keyup', { key }));
}

function tryLane(routeKey, laneIndex) {
  Y.goto(routeKey, 40, 150); pump(2, 16);
  const info = Y.routeInfo(routeKey);
  const laneY = Math.round((info.laneBands[laneIndex][0] + info.laneBands[laneIndex][1]) / 2);
  Y.goto(routeKey, info.forkX - 10, laneY); pump(2, 16);
  // walk east through the fork and toward the far edge
  hold('ArrowRight', 220, 16);
  const posAfter = Y.pos, areaAfter = Y.area;
  return { info, laneY, posAfter, areaAfter, wasCorrect: laneIndex === info.correctLane };
}

const ROUTE_KEYS = ['r1','r2','r3','r4','r5','r6','r7','r8','r9','r10','r11','r12','r13'];
let allOk = true;
for (const rk of ROUTE_KEYS) {
  const ri = Y.routeInfo(rk), meta = { laneCount: ri.laneCount, correctLane: ri.correctLane, forkX: ri.forkX, dest: ri.exits.find(e => e.side === 'e').to };
  console.log(rk, 'lanes=', meta.laneCount, 'correctLane=', meta.correctLane, 'forkX=', meta.forkX, 'dest=', meta.dest);
  for (let li = 0; li < meta.laneCount; li++) {
    const r = tryLane(rk, li);
    const reachedDest = r.areaAfter === meta.dest;
    const ok = r.wasCorrect ? reachedDest : !reachedDest;
    if (!ok) { allOk = false; console.log('  FAIL lane', li, 'correct=', r.wasCorrect, 'areaAfter=', r.areaAfter, 'pos=', r.posAfter); }
    else console.log('  ok lane', li, r.wasCorrect ? '(correct, reached ' + r.areaAfter + ')' : '(wrong, blocked at x=' + Math.round(r.posAfter.x) + ')');
  }
}
console.log(allOk ? 'ALL ROUTES OK' : 'SOME ROUTES FAILED');

// ---- reverse-direction spot check: arriving at a route from its east town should place you in the CORRECT lane, and walking west should get you back to the west town without hitting any hedge ----
function reverseCheck(routeKey) {
  const ri = Y.routeInfo(routeKey);
  const eastExit = ri.exits.find(e => e.side === 'e'), westExit = ri.exits.find(e => e.side === 'w');
  const laneY = Math.round((ri.laneBands[ri.correctLane][0] + ri.laneBands[ri.correctLane][1]) / 2);
  Y.goto(routeKey, ri.forkX + (560 - ri.forkX) - 6, laneY); pump(2, 16);
  hold('ArrowLeft', 900, 16);
  return { areaAfter: Y.area, expected: westExit.to, pos: Y.pos };
}
let revOk = true;
for (const rk of ['r2', 'r5', 'r9', 'r12']) {
  const r = reverseCheck(rk);
  const ok = r.areaAfter === r.expected;
  if (!ok) revOk = false;
  console.log('reverse', rk, ok ? 'ok' : 'FAIL', '-> areaAfter=' + r.areaAfter, 'expected=' + r.expected, 'pos=', Math.round(r.pos.x));
}
console.log(revOk ? 'REVERSE OK' : 'REVERSE FAILED');
process.exit((allOk && revOk) ? 0 : 1);
