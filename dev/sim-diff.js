const C = require('./combat-core.js'); const fs = require('fs');
const N = Number(process.argv[2]) || 1500;
function comboCharge(moves) { let i = 0; return (s, l) => { const m = moves[i % moves.length]; if (l.includes(m)) { i++; return m; } return l.includes('charge') ? 'charge' : l.includes('guard') ? 'guard' : l[0]; }; }
function cycle(moves) { let i = 0; return (s, l) => { for (let k = 0; k < moves.length; k++) { const m = moves[(i + k) % moves.length]; if (l.includes(m)) { i = (i + k + 1) % moves.length; return m; } } return l.includes('charge') ? 'charge' : l.includes('guard') ? 'guard' : l[0]; }; }
eval(fs.readFileSync('./sim.js', 'utf8').match(/function smart[\s\S]*?\n}\n/)[0]);
const bots = { 'B>L': () => cycle(['blast', 'lance']), 'B>L(c)': () => comboCharge(['blast', 'lance']), 'B>G>L': () => cycle(['blast', 'guard', 'lance']), 'S>L>G': () => cycle(['strike', 'lance', 'guard']), 'P>B': () => cycle(['phantom', 'blast']), lance: () => (s, l) => l.includes('lance') ? 'lance' : 'charge', smart: () => smart, random: () => (s, l) => l[Math.floor(s.rng() * l.length)] };
for (const d of ['training', 'normal', 'master']) {
  C.setDifficulty(d); const out = {}; let turns = 0;
  for (const k in bots) { let w = 0; for (let i = 0; i < N; i++) { const s = C.newFight(i + 1), b = bots[k](); while (!s.over) C.step(s, b(s, C.legalMoves(s))); if (s.over === 'win') w++; if (k === 'smart') turns += s.t; } out[k] = Math.round(100 * w / N); }
  console.log(d.padEnd(9), JSON.stringify(out), 'smart turns', (turns / N).toFixed(1));
}
