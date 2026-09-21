const C = require('./combat-core.js');
const fs = require('fs');
const N = 1200;
function cycle(moves) { let i = 0; return (s, l) => { for (let k = 0; k < moves.length; k++) { const m = moves[(i + k) % moves.length]; if (l.includes(m)) { i = (i + k + 1) % moves.length; return m; } } return l.includes('charge') ? 'charge' : l.includes('guard') ? 'guard' : l[0]; }; }
eval(fs.readFileSync('./sim.js', 'utf8').match(/function smart[\s\S]*?\n}\n/)[0]);
const bots = { 'B>L': () => cycle(['blast', 'lance']), 'B>G>L': () => cycle(['blast', 'guard', 'lance']), 'S>L>G': () => cycle(['strike', 'lance', 'guard']), 'P>B': () => cycle(['phantom', 'blast']), 'B>C>L': () => cycle(['blast', 'charge', 'lance']), smart: () => smart, random: () => (s, l) => l[Math.floor(s.rng() * l.length)] };
function run(cfg) {
  Object.assign(C.CFG, cfg.top); Object.assign(C.CFG.roku, cfg.roku);
  const out = {};
  for (const k in bots) { let w = 0; for (let i = 0; i < N; i++) { const s = C.newFight(i + 1), b = bots[k](); while (!s.over) C.step(s, b(s, C.legalMoves(s))); if (s.over === 'win') w++; } out[k] = Math.round(100 * w / N); }
  return out;
}
for (const late of [.6, .85, 1]) for (const plan of [.35, .7]) for (const ev of [0, 14]) for (const me of [1.5, .9]) {
  const r = run({ top: { lateReadChance: late, planReadChance: plan, minEvidence: me }, roku: { evadeCounter: ev } });
  console.log(`late ${late} plan ${plan} evadeCtr ${ev} minEv ${me} ->`, JSON.stringify(r));
}
