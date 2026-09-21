// Grid search: which (player HP, Roku HP, Roku damage scale) gives smart ~55-65% and length 8-12?
const C = require('./combat-core.js');
const fs = require('fs');
const code = fs.readFileSync('./sim.js', 'utf8');
eval(code.match(/function smart[\s\S]*?\n}\n/)[0]);
const N = 1500;
const base = JSON.parse(JSON.stringify(C.CFG.roku));
function test(pHp, rHp, scale, kiGain) {
  C.CFG.player.hp = pHp; C.CFG.roku.hp = rHp; C.CFG.roku.phase2At = rHp / 2;
  C.CFG.roku.rush = Math.round(base.rush * scale); C.CFG.roku.blast = Math.round(base.blast * scale);
  C.CFG.moves.charge.gainKi = kiGain;
  let w = 0, len = 0;
  for (let i = 0; i < N; i++) {
    const s = C.newFight(i + 1);
    while (!s.over) C.step(s, smart(s, C.legalMoves(s)));
    if (s.over === 'win') w++; len += s.t;
  }
  return [(100 * w / N).toFixed(0), (len / N).toFixed(1)];
}
for (const kiGain of [30, 40])
for (const scale of [0.7, 0.85, 1])
for (const pHp of [100, 130])
for (const rHp of [120, 150, 180]) {
  const [w, l] = test(pHp, rHp, scale, kiGain);
  console.log(`chargeKi ${kiGain} rokuDmg x${scale} playerHP ${pHp} rokuHP ${rHp} -> win ${w}%  turns ${l}`);
}
