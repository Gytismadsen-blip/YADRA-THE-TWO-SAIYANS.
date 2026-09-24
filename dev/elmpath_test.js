// Headless test for OLD ELM TRAIL: a real S-bend (west -> down around the elm -> east -> up -> east exit).
// Pass criteria: holding only RIGHT from the west end must NOT reach Elmvale; every corner must be free of stuck spots
// while diagonals are held; every walkable point must be connected to both exits; map marker + signs + reverse trip still work.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function makeFakeObj() {
  const store = {};
  const handler = { get(t, p) { if (p === 'then' || typeof p === 'symbol') return undefined; if (!(p in store)) store[p] = makeFakeObj(); return store[p]; }, set(t, p, v) { store[p] = v; return true; }, apply() { return makeFakeObj(); } };
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
    window.requestAnimationFrame = (cb) => { pendingRAF = cb; return 1; }; window.cancelAnimationFrame = () => {}; window.scrollTo = () => {};
  }
});
const { window } = dom; const Y = window.__yadra;
if (!Y) throw new Error('window.__yadra missing');
let tt = 1000;
function pump(frames, dtMs) { for (let i = 0; i < frames; i++) { tt += dtMs; if (pendingRAF) pendingRAF(tt); } }
const KEY = { right: 'ArrowRight', left: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown' };
function holdKeys(keys, frames) {
  keys.forEach(k => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: KEY[k] })));
  pump(frames, 16);
  keys.forEach(k => window.dispatchEvent(new window.KeyboardEvent('keyup', { key: KEY[k] })));
}
// hold until the hero stops moving (or the area changes)
function holdStill(keys, max = 400) {
  const a0 = Y.area; let last = null, still = 0;
  keys.forEach(k => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: KEY[k] })));
  for (let i = 0; i < max; i++) { pump(1, 16); const p = Y.pos; if (Y.area !== a0) break; if (last && Math.abs(p.x - last.x) < 0.01 && Math.abs(p.y - last.y) < 0.01) { if (++still > 4) break; } else still = 0; last = { x: p.x, y: p.y }; }
  keys.forEach(k => window.dispatchEvent(new window.KeyboardEvent('keyup', { key: KEY[k] })));
  return { x: Y.pos.x, y: Y.pos.y, area: Y.area };
}
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; }

// fresh save through the real UI
Y.press('ok'); Y.press('ok'); for (let i = 0; i < 6; i++) Y.press('ok'); Y.press('down'); Y.press('ok'); pump(5, 16);
if (!Y.saveData) throw new Error('save was not created');
Y.saveData.miles = 5; Y.saveData.wins = 3;
const I = Y.elmpathInfo(), inWalk = (x, y) => I.walk.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);

// 1. Holding only RIGHT from the west entry must stop at the elm - at every height of the west corridor
let allStop = true, worst = 0;
for (let y = 84; y <= 124; y += 4) { Y.goto('elmpath', 30, y); pump(2, 16); const r = holdStill(['right']); worst = Math.max(worst, r.x); if (r.area !== 'elmpath' || r.x > 149) allStop = false; }
check('hold RIGHT from the west end never gets through (stops at the elm)', allStop, 'furthest x=' + Math.round(worst) + ' (elm at x=' + I.landmark.x + ')');

// 2. The real route, one direction at a time: right, down, right, up, right -> Elmvale
Y.goto('elmpath', I.start[0], I.start[1]); pump(2, 16);
let r = holdStill(['right']); const s1 = r.x;
r = holdStill(['down']); const s2 = r.y;
r = holdStill(['right']); const s3 = r.x;
r = holdStill(['up']); const s4 = r.y;
r = holdStill(['right']);
check('west -> east needs right, DOWN, right, UP, right', r.area === 'elmvale', 'stops: x=' + Math.round(s1) + ', y=' + Math.round(s2) + ', x=' + Math.round(s3) + ', y=' + Math.round(s4) + ', end area=' + r.area);
check('first stop is at the elm bend', s1 > 140 && s1 <= 149);

// 3. Reverse trip, arriving for real from Elmvale
Y.goto('elmvale', 40, 104); pump(2, 16);
r = holdStill(['left'], 600);
check('walking west out of Elmvale arrives on the trail east end', r.area === 'elmpath' && r.x > 420, 'area=' + r.area + ' x=' + Math.round(r.x));
r = holdStill(['left']); const b1 = r.x;
check('holding LEFT from the east end stops at the second turn', r.area === 'elmpath' && b1 > 300 && b1 < 315, 'x=' + Math.round(b1));
r = holdStill(['down']); r = holdStill(['left']); r = holdStill(['up']); r = holdStill(['left'], 600);
check('reverse trip: left, down, left, up, left -> back to EAST ROAD', r.area === 'r1', 'area=' + r.area);
// and back in from EAST ROAD's south branch
Y.goto('r1', 200, 120); pump(2, 16); r = holdStill(['down'], 400);
check('EAST ROAD south branch leads onto the trail start', r.area === 'elmpath' && r.x < 40, 'area=' + r.area + ' pos=' + Math.round(r.x) + ',' + Math.round(r.y));

// 4. Diagonal holds at every inner and outer corner (all 8 held-key combos, several offsets), no wall clipping, never wedged
const combos = [['right'], ['left'], ['up'], ['down'], ['right', 'down'], ['right', 'up'], ['left', 'down'], ['left', 'up']];
const corners = []; I.walk.forEach(([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(c => corners.push(c)));
const seen = new Set(); let runs = 0, clipped = 0, wedged = 0;
corners.forEach(([cx, cy]) => {
  for (const ox of [-14, -6, -2, 0, 2, 6, 14]) for (const oy of [-14, -6, -2, 0, 2, 6, 14]) {
    const x = cx + ox, y = cy + oy; if (!inWalk(x, y) || Y.solid(x, y) || x < 6 || x > I.w - 8 || y < 60 || y > I.h - 8) continue;
    const k0 = x + ',' + y; if (seen.has(k0)) continue; seen.add(k0);
    for (const combo of combos) {
      Y.goto('elmpath', x, y); pump(1, 16); const a = holdStill(combo, 200); runs++;
      if (a.area !== 'elmpath') continue; // walked off an exit, fine
      if (Y.solid(a.x, a.y)) clipped++;
      // release, then some single direction must be able to move it (never wedged)
      let moved = false;
      for (const k of ['right', 'left', 'up', 'down']) { const before = { x: Y.pos.x, y: Y.pos.y }; holdKeys([k], 6); if (Math.abs(Y.pos.x - before.x) + Math.abs(Y.pos.y - before.y) > 0.5) { moved = true; break; } }
      if (!moved) wedged++;
    }
  }
});
check('diagonal holds at all corners: never clip into a wall', clipped === 0, runs + ' runs, ' + clipped + ' clipped');
check('diagonal holds at all corners: never wedged after release', wedged === 0, wedged + ' wedged');

// 5. Connectivity: every free point of the trail reaches BOTH exits (flood fill on the real solid function, 1px grid)
const key = (x, y) => x * 1000 + y, free = (x, y) => x >= 4 && x <= I.w - 4 && y >= 60 && y <= I.h - 6 && !Y.solid(x, y);
function flood(sx, sy) { const sf = new Set([key(sx, sy)]), st = [[sx, sy]]; while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (free(nx, ny) && !sf.has(key(nx, ny))) { sf.add(key(nx, ny)); st.push([nx, ny]); } } } return sf; }
const reach = flood(30, 104); let freeCount = 0, pocket = 0;
for (let x = 4; x <= I.w - 4; x++) for (let y = 60; y <= I.h - 6; y++) if (free(x, y)) { freeCount++; if (!reach.has(key(x, y))) pocket++; }
check('every walkable point connects to the rest (no pockets)', pocket === 0, freeCount + ' free points, ' + pocket + ' cut off');
check('west entry reaches the east exit strip', [...reach].some(k => Math.floor(k / 1000) >= I.w - 6));
let straightOpen = 0; for (let x = 150; x < 312; x++) if (free(x, 104)) straightOpen++;
check('the straight west-east row is cut off between the turns', straightOpen === 0, straightOpen + ' open points');

// 6. Map marker, woodcutter, old-save safeguard
Y.goto('elmpath', 235, 154); pump(2, 16);
check('map "here" is Elmvale while on the trail', Y.mapCurrent() === 'elmvale');
const mp = Y.mapYou(); check('map YOU marker is a real point', mp && isFinite(mp.x) && isFinite(mp.y), JSON.stringify(mp));
const wc = Y.people().find(p => p.n === 'WOODCUTTER');
check('woodcutter stands on the walkable trail', wc && inWalk(wc.x, wc.y), wc ? Math.round(wc.x) + ',' + Math.round(wc.y) : 'missing');
let off = 0; for (let i = 0; i < 40; i++) { pump(60, 16); const w = Y.people().find(p => p.n === 'WOODCUTTER'); if (!inWalk(w.x, w.y)) off++; }
check('woodcutter never wanders into the wall', off === 0, off + ' samples off-trail');
check('a point inside the wall is solid', Y.solid(235, 60));
console.log(fails ? '\nELMPATH TEST FAILED (' + fails + ')' : '\nELMPATH TEST OK');
process.exit(fails ? 1 : 0);
