// Runs many fights with different bots and prints balance numbers.
// Usage: node sim.js [fightsPerBot]
const C = require('./combat-core.js');
const N = Number(process.argv[2]) || 5000;

const pick = (s, arr) => arr[Math.floor(s.rng() * arr.length)];

const bots = {
  random: (s, legal) => pick(s, legal),
  'lance-spam': (s, legal) => legal.includes('lance') ? 'lance' : legal.includes('charge') ? 'charge' : pick(s, legal),
  'phantom-spam': (s, legal) => legal.includes('phantom') ? 'phantom' : legal.includes('charge') ? 'charge' : pick(s, legal),
  'strike-spam': (s, legal) => legal.includes('strike') ? 'strike' : pick(s, legal),
  'blast-spam': (s, legal) => legal.includes('blast') ? 'blast' : 'charge',
  'guard-heavy': (s, legal) => legal.includes('guard') ? 'guard' : legal.includes('blast') ? 'blast' : 'charge',
  smart: smart,
};

function smart(s, legal) {
  const has = m => legal.includes(m);
  if (legal[0] === 'collapse') return 'collapse';
  const k = s.known.length ? s.known[0] : null;
  const last3 = s.hist.slice(-3);
  const avoid = m => last3.filter(x => x === m).length >= 1; // don't repeat: Roku reads patterns

  if (s.p.strain >= 75 && has('guard')) return 'guard';

  if (k) {
    if (k.type === 'rush' || k.type === 'blast') {
      if (has('phantom') && s.p.strain < 75) return 'phantom';
      if (has('guard')) return 'guard';
    }
    if (k.type === 'guard') {
      if (has('lance') && s.p.strain < 50 && !avoid('lance')) return 'lance';
      if (has('blast') && !avoid('blast')) return 'blast';
      if (has('charge')) return 'charge';
    }
    if (k.type === 'read') {
      const opts = ['lance', 'blast', 'strike', 'charge'].filter(m => has(m) && m !== k.target);
      if (opts.length) return opts[0];
    }
  }
  // unknown: keep Ki up, vary moves, use Sense now and then
  if (has('sense') && s.p.ki >= 45 && s.t % 4 === 1 && s.p.strain < 60) return 'sense';
  if (s.p.ki < 25 && has('charge')) return 'charge';
  if (has('lance') && s.p.strain < 40 && !avoid('lance') && s.r.hp > 30) return 'lance';
  if (has('blast') && !avoid('blast')) return 'blast';
  if (has('strike') && !avoid('strike')) return 'strike';
  if (has('charge') && s.p.ki < 70) return 'charge';
  if (has('guard')) return 'guard';
  return legal[0];
}

function run(name, bot) {
  let wins = 0, len = 0, collapses = 0, reads = 0, timeouts = 0, hpLeft = 0, turnsWin = 0;
  const moveUse = {};
  for (let i = 0; i < N; i++) {
    const s = C.newFight(i + 1);
    while (!s.over) {
      const legal = C.legalMoves(s);
      C.step(s, bot(s, legal));
    }
    if (s.over === 'win') { wins++; turnsWin += s.t; hpLeft += s.p.hp; }
    if (s.over === 'timeout') timeouts++;
    len += s.t;
    for (const e of s.log) {
      if (e.notes.includes('collapse-next')) collapses++;
      if (e.notes.includes('read')) reads++;
      moveUse[e.player] = (moveUse[e.player] || 0) + 1;
    }
  }
  const pct = x => (100 * x / N).toFixed(1).padStart(5) + '%';
  console.log(
    name.padEnd(13),
    'win', pct(wins),
    '| avg turns', (len / N).toFixed(1).padStart(4),
    '| collapse/fight', (collapses / N).toFixed(2),
    '| Roku reads/fight', (reads / N).toFixed(2),
    '| timeouts', pct(timeouts),
    '| HP left when won', wins ? (hpLeft / wins).toFixed(0) : '-'
  );
  return moveUse;
}

console.log(`Fights per bot: ${N}\n`);
let smartUse;
for (const name in bots) { const u = run(name, bots[name]); if (name === 'smart') smartUse = u; }
const total = Object.values(smartUse).reduce((a, b) => a + b, 0);
console.log('\nsmart bot move mix:', Object.entries(smartUse).map(([m, n]) => m + ' ' + (100 * n / total).toFixed(0) + '%').join(', '));
