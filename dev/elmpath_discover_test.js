// Headless test: finding OLD ELM TRAIL is remembered on the map, even if you turn back before Elmvale.
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function makeFakeObj() { const store = {}; return new Proxy(function () {}, { get(t, p) { if (p === 'then' || typeof p === 'symbol') return undefined; if (!(p in store)) store[p] = makeFakeObj(); return store[p]; }, set(t, p, v) { store[p] = v; return true; }, apply() { return makeFakeObj(); } }); }
let log = { moveTo: 0, fillRect: 0 }, pendingRAF = null;
function recCtx() { const base = makeFakeObj(); return new Proxy(base, { get(t, p) { if (p === 'moveTo') return () => { log.moveTo++; }; if (p === 'fillRect') return () => { log.fillRect++; }; return t[p]; }, set(t, p, v) { t[p] = v; return true; } }); }
const dom = new JSDOM(html, { url: 'https://yadra.test/', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
  const c = recCtx(); w.HTMLCanvasElement.prototype.getContext = () => c;
  w.AudioContext = function () { return makeFakeObj(); }; w.webkitAudioContext = w.AudioContext;
  w.speechSynthesis = { speak() {}, cancel() {}, getVoices() { return []; }, onvoiceschanged: null }; w.SpeechSynthesisUtterance = function (t) { this.text = t; };
  w.requestAnimationFrame = cb => { pendingRAF = cb; return 1; }; w.cancelAnimationFrame = () => {}; w.scrollTo = () => {};
} });
const { window } = dom, Y = window.__yadra; let tt = 1000;
const pump = n => { for (let i = 0; i < n; i++) { tt += 16; if (pendingRAF) pendingRAF(tt); } };
let fails = 0; const check = (n, ok, x) => { console.log((ok ? 'ok   ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!ok) fails++; };
function mapCounts() { Y.goto('village', 160, 384); pump(2); Y.press('map'); if (Y.mode !== 'map') throw new Error('map did not open, mode=' + Y.mode); pump(3); log = { moveTo: 0, fillRect: 0 }; pump(1); const r = { ...log }; Y.press('map'); pump(1); return r; }

Y.press('ok'); Y.press('ok'); for (let i = 0; i < 6; i++) Y.press('ok'); Y.press('down'); Y.press('ok'); pump(5);
Y.saveData.miles = 5; Y.saveData.wins = 3;
const before = mapCounts();
check('fresh save: trail not found yet', !Y.saveData.foundElmTrail);
// walk in from EAST ROAD's south branch, then straight back out again without reaching Elmvale
Y.goto('r1', 200, 120); pump(2);
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown' })); for (let i = 0; i < 400 && Y.area === 'r1'; i++) pump(1); window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'ArrowDown' }));
check('walked onto OLD ELM TRAIL', Y.area === 'elmpath', 'area=' + Y.area);
check('entering the trail saves foundElmTrail', Y.saveData.foundElmTrail === 1);
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft' })); for (let i = 0; i < 400 && Y.area === 'elmpath'; i++) pump(1); window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'ArrowLeft' }));
check('turned back to EAST ROAD without visiting Elmvale', Y.area === 'r1' && !(Y.saveData.visited || {}).elmvale, 'area=' + Y.area);
const after = mapCounts();
check('map still draws the trail road + junction after turning back', after.moveTo > before.moveTo && after.fillRect > before.fillRect, 'moveTo ' + before.moveTo + ' -> ' + after.moveTo + ', fillRect ' + before.fillRect + ' -> ' + after.fillRect);
// old save that already stands on the trail: loaded through toPlace (Continue), never through enterArea
delete Y.saveData.foundElmTrail; Y.goto('village', 160, 384); pump(2);
check('old save: flag is missing before loading onto the trail', !Y.saveData.foundElmTrail);
Y.toPlace('elmpath', 30, 104, ''); pump(2);
check('loading onto OLD ELM TRAIL via toPlace sets foundElmTrail', Y.area === 'elmpath' && Y.saveData.foundElmTrail === 1, 'area=' + Y.area);
check('...and it is written to the save slot', JSON.stringify(JSON.parse(window.localStorage.getItem(window.localStorage.key(0)) || 'null')).indexOf('foundElmTrail') >= 0 || Object.keys(window.localStorage).some(k => (window.localStorage.getItem(k) || '').indexOf('foundElmTrail') >= 0));
Y.toPlace('r1', 200, 120, ''); pump(2);
const again = mapCounts();
check('old save: turning back to EAST ROAD keeps the trail road on the map', again.moveTo > before.moveTo && again.fillRect > before.fillRect, 'moveTo ' + before.moveTo + ' -> ' + again.moveTo);
console.log(fails ? '\nDISCOVER TEST FAILED (' + fails + ')' : '\nDISCOVER TEST OK'); process.exit(fails ? 1 : 0);
