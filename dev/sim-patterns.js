// Tests fixed repeating combinations (2 and 3 moves), the kind of pattern a human finds quickly.
const C = require('./combat-core.js');
const N = Number(process.argv[2]) || 5000;
function cycle(moves) {
  let i = 0;
  return (s, legal) => {
    for (let k = 0; k < moves.length; k++) { const m = moves[(i + k) % moves.length]; if (legal.includes(m)) { i = (i + k + 1) % moves.length; return m; } }
    return legal.includes('charge') ? 'charge' : legal.includes('guard') ? 'guard' : legal[0];
  };
}
const bots = {
  'blast>lance': () => cycle(['blast', 'lance']),
  'blast>guard>lance': () => cycle(['blast', 'guard', 'lance']),
  'strike>lance>guard': () => cycle(['strike', 'lance', 'guard']),
  'blast>charge>lance': () => cycle(['blast', 'charge', 'lance']),
  'lance>charge': () => cycle(['lance', 'charge']),
  'phantom>blast': () => cycle(['phantom', 'blast']),
  'blast>strike>phantom>lance': () => cycle(['blast', 'strike', 'phantom', 'lance']),
  random: () => (s, l) => l[Math.floor(s.rng() * l.length)],
};
for (const name in bots) {
  let w = 0, len = 0;
  for (let i = 0; i < N; i++) { const s = C.newFight(i + 1), b = bots[name](); while (!s.over) C.step(s, b(s, C.legalMoves(s))); if (s.over === 'win') w++; len += s.t; }
  console.log(name.padEnd(28), 'win', (100 * w / N).toFixed(1).padStart(5) + '%', '| avg turns', (len / N).toFixed(1));
}
