const C = require('./combat-core.js');
const fs = require('fs');
const code = fs.readFileSync('./sim.js', 'utf8');
eval(code.match(/function smart[\s\S]*?\n}\n/)[0]);
const N = 2500;
const lanceSpam = (s, l) => l.includes('lance') ? 'lance' : l.includes('charge') ? 'charge' : l[0];
const rnd = (s, l) => l[Math.floor(s.rng() * l.length)];
function wr(bot) { let w = 0, len = 0; for (let i = 0; i < N; i++) { const s = C.newFight(i + 1); while (!s.over) C.step(s, bot(s, C.legalMoves(s))); if (s.over === 'win') w++; len += s.t; } return [(100 * w / N).toFixed(0), (len / N).toFixed(1)]; }
for (const dmg of [45, 40, 36]) for (const str of [35, 40, 45]) for (const rHp of [130, 115]) {
  C.CFG.moves.lance.dmg = dmg; C.CFG.moves.lance.strain = str; C.CFG.roku.hp = rHp; C.CFG.roku.phase2At = rHp / 2;
  const a = wr(smart), b = wr(lanceSpam), c = wr(rnd);
  console.log(`lance dmg ${dmg} strain ${str} rokuHP ${rHp} -> smart ${a[0]}% (${a[1]}t)  lance-spam ${b[0]}%  random ${c[0]}%`);
}
