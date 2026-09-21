const C = require('./combat-core.js');
const fs = require('fs');
const N = 800;
// combo player: follows the cycle, but if a move is not affordable it charges Ki (what a clever human would do)
function comboCharge(moves) { let i = 0; return (s, l) => { const m = moves[i % moves.length]; if (l.includes(m)) { i++; return m; } return l.includes('charge') ? 'charge' : l.includes('guard') ? 'guard' : l[0]; }; }
function cycle(moves) { let i = 0; return (s, l) => { for (let k = 0; k < moves.length; k++) { const m = moves[(i + k) % moves.length]; if (l.includes(m)) { i = (i + k + 1) % moves.length; return m; } } return l.includes('charge') ? 'charge' : l.includes('guard') ? 'guard' : l[0]; }; }
eval(fs.readFileSync('./sim.js', 'utf8').match(/function smart[\s\S]*?\n}\n/)[0]);
const bots = { 'B>L(c)': () => comboCharge(['blast', 'lance']), 'B>G>L(c)': () => comboCharge(['blast', 'guard', 'lance']), 'S>L>G': () => cycle(['strike', 'lance', 'guard']), 'P>B': () => cycle(['phantom', 'blast']), 'B>L': () => cycle(['blast', 'lance']), smart: () => smart, random: () => (s, l) => l[Math.floor(s.rng() * l.length)] };
const base = JSON.parse(JSON.stringify({ p: C.CFG.player, r: C.CFG.roku }));
function run(o) {
  C.CFG.player.hp = o.php; C.CFG.roku.hp = o.rhp; C.CFG.roku.phase2At = Math.floor(o.rhp / 2); C.CFG.roku.evadeCounter = 14;
  Object.assign(C.CFG, { lateReadChance: o.late, planReadChance: .7, minEvidence: .9, memoryDecay: o.decay });
  const out = {}; let turns = 0, cnt = 0;
  for (const k in bots) { let w = 0; for (let i = 0; i < N; i++) { const s = C.newFight(i + 1), b = bots[k](); while (!s.over) C.step(s, b(s, C.legalMoves(s))); if (s.over === 'win') w++; if (k === 'smart') { turns += s.t; cnt++; } } out[k] = Math.round(100 * w / N); }
  out.turns = (turns / cnt).toFixed(1); return out;
}
for (const rhp of [115, 150, 180]) for (const php of [130, 170]) for (const late of [.85, 1]) for (const decay of [.85, .93]) {
  console.log(`rokuHP ${rhp} playerHP ${php} late ${late} decay ${decay} ->`, JSON.stringify(run({ rhp, php, late, decay })));
}
