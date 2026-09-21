// Balance test for the training system: how do different builds do against Roku?
// Usage: node sim-train.js [fightsPerCell] [difficulty]
const C = require('./combat-core.js'); const fs = require('fs');
const N = Number(process.argv[2]) || 800, DIFF = process.argv[3] || 'normal';
function comboCharge(moves) { let i = 0; return (s, l) => { const m = moves[i % moves.length]; if (l.includes(m)) { i++; return m; } return l.includes('charge') ? 'charge' : l.includes('guard') ? 'guard' : l[0]; }; }
// dev-only: loads the 'smart' bot function from our own local sim.js (trusted file, never user input)
eval(fs.readFileSync('./sim.js', 'utf8').match(/function smart[\s\S]*?\n}\n/)[0]);
const bots = { smart: () => smart, 'B>L(c)': () => comboCharge(['blast', 'lance']), 'B>G>L(c)': () => comboCharge(['blast', 'guard', 'lance']), 'P>B(c)': () => comboCharge(['phantom', 'blast']), random: () => (s, l) => l[Math.floor(s.rng() * l.length)] };
const builds = {
  'untrained 0/0/0': { body: 0, ki: 0, focus: 0 },
  'light 2/2/2': { body: 2, ki: 2, focus: 2 },
  'mixed 4/4/4': { body: 4, ki: 4, focus: 4 },
  'all body 12/0/0': { body: 12, ki: 0, focus: 0 },
  'all ki 0/12/0': { body: 0, ki: 12, focus: 0 },
  'all focus 0/0/12': { body: 0, ki: 0, focus: 12 },
  'body+ki 6/6/0': { body: 6, ki: 6, focus: 0 },
  'mixed 4/4/4 tired(50)': { body: 4, ki: 4, focus: 4, fatigue: 50 },
  'max 8/8/8': { body: 8, ki: 8, focus: 8 },
};
console.log('difficulty:', DIFF, ' fights per cell:', N);
console.log('build'.padEnd(24), Object.keys(bots).map(k => k.padStart(9)).join(' '));
for (const b in builds) {
  C.setDifficulty(DIFF); C.setStats(builds[b]);
  const row = [];
  for (const k in bots) { let w = 0; for (let i = 0; i < N; i++) { const s = C.newFight(i + 1), bot = bots[k](); while (!s.over) C.step(s, bot(s, C.legalMoves(s))); if (s.over === 'win') w++; } row.push((Math.round(100 * w / N) + '%').padStart(9)); }
  console.log(b.padEnd(24), row.join(' '));
}
