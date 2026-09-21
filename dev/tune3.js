const C = require('./combat-core.js');
const fs = require('fs');
const code = fs.readFileSync('./sim.js', 'utf8');
eval(code.match(/function smart[\s\S]*?\n}\n/)[0]);
const N = 2500;
const lanceSpam = (s, l) => l.includes('lance') ? 'lance' : l.includes('charge') ? 'charge' : l[0];
const blastSpam = (s, l) => l.includes('blast') ? 'blast' : 'charge';
const rnd = (s, l) => l[Math.floor(s.rng() * l.length)];
function wr(bot) { let w = 0, len = 0; for (let i = 0; i < N; i++) { const s = C.newFight(i + 1); while (!s.over) C.step(s, bot(s, C.legalMoves(s))); if (s.over === 'win') w++; len += s.t; } return [(100 * w / N).toFixed(0), (len / N).toFixed(1)]; }
for (const bd of [18, 14, 12]) for (const bk of [15, 20]) for (const rHp of [115, 100]) for (const deflect of [8, 14]) {
  C.CFG.moves.blast.dmg = bd; C.CFG.moves.blast.ki = bk; C.CFG.roku.hp = rHp; C.CFG.roku.phase2At = Math.floor(rHp / 2); C.CFG.roku.deflectHit = deflect;
  const a = wr(smart), b = wr(lanceSpam), c = wr(blastSpam), d = wr(rnd);
  console.log(`blast ${bd}dmg/${bk}ki deflect ${deflect} rokuHP ${rHp} -> smart ${a[0]}% (${a[1]}t) lance-spam ${b[0]}% blast-spam ${c[0]}% random ${d[0]}%`);
}
