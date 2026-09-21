const C = require('./combat-core.js');
const fs = require('fs');
const N = 700;
function comboCharge(moves) { let i = 0; return (s, l) => { const m = moves[i % moves.length]; if (l.includes(m)) { i++; return m; } return l.includes('charge') ? 'charge' : l.includes('guard') ? 'guard' : l[0]; }; }
function cycle(moves) { let i = 0; return (s, l) => { for (let k = 0; k < moves.length; k++) { const m = moves[(i + k) % moves.length]; if (l.includes(m)) { i = (i + k + 1) % moves.length; return m; } } return l.includes('charge') ? 'charge' : l.includes('guard') ? 'guard' : l[0]; }; }
eval(fs.readFileSync('./sim.js', 'utf8').match(/function smart[\s\S]*?\n}\n/)[0]);
const bots = { 'B>L': () => cycle(['blast', 'lance']), 'B>L(c)': () => comboCharge(['blast', 'lance']), 'B>G>L': () => cycle(['blast', 'guard', 'lance']), 'S>L>G': () => cycle(['strike', 'lance', 'guard']), 'P>B': () => cycle(['phantom', 'blast']), 'L>C': () => cycle(['lance', 'charge']), blast: () => (s, l) => l.includes('blast') ? 'blast' : 'charge', lance: () => (s, l) => l.includes('lance') ? 'lance' : 'charge', smart: () => smart, random: () => (s, l) => l[Math.floor(s.rng() * l.length)] };
function run(o) {
  C.CFG.player.hp = o.php; C.CFG.roku.hp = o.rhp; C.CFG.roku.phase2At = Math.floor(o.rhp / 2); C.CFG.roku.evadeCounter = 14; C.CFG.roku.rush = Math.round(16 * o.dmg); C.CFG.roku.blast = Math.round(18 * o.dmg);
  Object.assign(C.CFG, { lateReadChance: o.late, planReadChance: .7, minEvidence: .9, memoryDecay: .88 });
  const out = {}; let turns = 0, cnt = 0;
  for (const k in bots) { let w = 0; for (let i = 0; i < N; i++) { const s = C.newFight(i + 1), b = bots[k](); while (!s.over) C.step(s, b(s, C.legalMoves(s))); if (s.over === 'win') w++; if (k === 'smart') { turns += s.t; cnt++; } } out[k] = Math.round(100 * w / N); }
  out.t = (turns / cnt).toFixed(1); return out;
}
for (const [rhp, php, dmg] of [[125,140,1],[130,150,1],[135,150,1],[125,150,1.1],[120,140,1.1],[140,160,1]]) for (const late of [.85]) {
  console.log(`R${rhp} P${php} dmgx${dmg}`, JSON.stringify(run({ rhp, php, dmg, late })));
}
