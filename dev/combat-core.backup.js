// Yadra combat rules: pure logic, no drawing. Same file is tested in Node and later inlined in index.html.
(function (root) {
  'use strict';

  const CFG = {
    player: { hp: 130, ki: 100, st: 50 },
    roku: { hp: 115, rush: 16, blast: 18, weak: 10, counterHit: 12, deflectHit: 14, tracking: 20, phase2At: 57, phase2Mult: 1.3 },
    strainDecay: 3,
    staminaRegen: 3,
    collapseStrain: 60,
    planReadChance: 0.5, lateReadChance: 0.5,
    strainTier1: 50, strainTier2: 75, kiPenalty: 1.25, dmgPenalty: 0.8, phantomFail: 0.25,
    moves: {
      strike:  { st: 10, dmg: 12 },
      blast:   { ki: 15, dmg: 18 },
      charge:  { gainKi: 40 },
      guard:   {},
      sense:   { ki: 5 },
      phantom: { ki: 20, st: 10, dmg: 15, strain: 15 },
      lance:   { ki: 40, st: 15, dmg: 36, strain: 45 },
    },
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function kiCost(s, base) { return s.p.strain >= CFG.strainTier1 ? Math.ceil(base * CFG.kiPenalty) : base; }

  function newFight(seed) {
    const s = {
      rng: mulberry32(seed || 1),
      t: 0,
      p: { hp: CFG.player.hp, ki: CFG.player.ki, st: CFG.player.st, strain: 0, collapsed: false, last: null },
      r: { hp: CFG.roku.hp, phase: 1, lieOwed: false, queue: [] },
      hist: [],
      known: [],
      over: null,
      log: [],
    };
    s.r.queue.push(planNext(s), planNext(s));
    return s;
  }

  // Look at the player's last 3 moves. If one move shows up 2+ times, maybe read it.
  function readHabit(s, chance) {
    const h = s.hist.slice(-3);
    if (h.length < 3) return null;
    const c = {};
    h.forEach(m => { if (m !== 'collapse' && m !== 'sense') c[m] = (c[m] || 0) + 1; });
    let top = null, n = 0;
    for (const m in c) if (c[m] > n || (c[m] === n && h[h.length - 1] === m)) { top = m; n = c[m]; }
    if (top && n >= 2 && s.rng() < chance) return { type: 'read', target: top, late: true };
    return null;
  }

  function planNext(s) {
    const r = readHabit(s, CFG.planReadChance);
    if (r) { r.late = false; return r; }
    const x = s.rng();
    return { type: x < 0.4 ? 'rush' : x < 0.75 ? 'blast' : 'guard' };
  }

  function legalMoves(s) {
    if (s.p.collapsed) return ['collapse'];
    const out = [];
    for (const name in CFG.moves) {
      const M = CFG.moves[name];
      if (M.ki && s.p.ki < kiCost(s, M.ki)) continue;
      if (M.st && s.p.st < M.st) continue;
      if (name === 'guard' && s.p.last === 'guard') continue;
      out.push(name);
    }
    return out;
  }

  function step(s, move) {
    if (s.over) return s;
    const R = CFG.roku;
    let rm = s.r.queue.shift();
    // Roku can change his mind at the last moment if he has just spotted a habit
    if (rm.type !== 'read') {
      const late = readHabit(s, CFG.lateReadChance);
      if (late) { rm = late; }
    }
    const pm = s.p.collapsed ? 'collapse' : move;
    if (!s.p.collapsed && legalMoves(s).indexOf(pm) < 0) throw new Error('illegal move ' + pm);
    const M = CFG.moves[pm] || {};
    const ev = { t: s.t, roku: rm, player: pm, toRoku: 0, toPlayer: 0, notes: [] };

    // costs
    if (M.ki) s.p.ki -= kiCost(s, M.ki);
    if (M.st) s.p.st -= M.st;

    const dm = s.p.strain >= CFG.strainTier2 ? CFG.dmgPenalty : 1;
    const p2 = s.r.phase === 2 ? R.phase2Mult : 1;

    // what is Roku doing this turn?
    let incoming = 0, guardBreak = false, tracking = false, evade = false, rokuGuard = false, counterAmt = 0;
    let strikeHalved = false, blastHalved = false, interruptCharge = false;
    if (rm.type === 'rush') { incoming = R.rush; interruptCharge = true; }
    else if (rm.type === 'blast') incoming = R.blast;
    else if (rm.type === 'guard') rokuGuard = true;
    else if (rm.type === 'read') {
      if (pm === rm.target) {
        ev.notes.push('read');
        if (pm === 'lance') evade = true;
        else if (pm === 'strike') { strikeHalved = true; counterAmt = R.counterHit; }
        else if (pm === 'blast') { blastHalved = true; counterAmt = R.deflectHit; }
        else if (pm === 'phantom') { incoming = R.tracking; tracking = true; }
        else if (pm === 'charge') { incoming = R.rush; interruptCharge = true; }
        else if (pm === 'guard') { incoming = R.rush; guardBreak = true; }
        else incoming = R.rush;
      } else incoming = R.weak;
    }
    incoming = incoming * p2;

    // player action
    let toRoku = 0, phantomFailed = false;
    if (pm === 'strike' || pm === 'blast' || pm === 'lance') {
      let d = M.dmg * dm;
      if (rokuGuard) d *= 0.5;
      if (evade) d = 0;
      if (strikeHalved || blastHalved) d *= 0.5;
      toRoku += d;
      if (rokuGuard && pm === 'strike') counterAmt = R.counterHit;
    } else if (pm === 'phantom') {
      phantomFailed = s.p.strain >= CFG.strainTier2 && s.rng() < CFG.phantomFail;
      if (phantomFailed) ev.notes.push('phantom-failed');
      else if (!tracking && incoming > 0) { incoming = 0; toRoku += M.dmg * dm; ev.notes.push('dodged'); }
    } else if (pm === 'charge') {
      s.p.ki = Math.min(100, s.p.ki + (interruptCharge && incoming > 0 ? CFG.moves.charge.gainKi / 2 : CFG.moves.charge.gainKi));
    } else if (pm === 'guard') {
      s.p.st = Math.min(CFG.player.st, s.p.st + 15);
      s.p.ki = Math.min(100, s.p.ki + 10);
      s.p.strain = Math.max(0, s.p.strain - 15);
      if (!guardBreak) incoming *= 0.5;
    }
    counterAmt *= p2;
    const toPlayer = Math.round(incoming + counterAmt);
    toRoku = Math.round(toRoku);
    s.p.hp -= toPlayer;
    s.r.hp -= toRoku;
    ev.toRoku = toRoku; ev.toPlayer = toPlayer;

    // strain, stamina
    let justCollapsed = false;
    if (pm === 'collapse') { s.p.collapsed = false; s.p.strain = CFG.collapseStrain; }
    else {
      if (M.strain) s.p.strain += M.strain;
      if (s.p.strain >= 100) { s.p.strain = 100; s.p.collapsed = true; justCollapsed = true; ev.notes.push('collapse-next'); }
      else s.p.strain = Math.max(0, s.p.strain - CFG.strainDecay);
    }
    s.p.st = Math.min(CFG.player.st, s.p.st + CFG.staminaRegen);
    s.p.last = pm;
    s.hist.push(pm);

    // phase 2
    if (s.r.phase === 1 && s.r.hp <= R.phase2At && s.r.hp > 0) { s.r.phase = 2; s.r.lieOwed = true; ev.notes.push('phase2'); }

    // plan, sense
    s.r.queue.push(planNext(s));
    if (pm === 'sense') {
      const shown = s.r.queue.map(m => m);
      if (s.r.lieOwed) {
        const wrong = { type: shown[0].type === 'rush' ? 'blast' : 'rush' };
        shown[0] = wrong; s.r.lieOwed = false; ev.notes.push('sense-lied');
      }
      s.known = shown;
    } else s.known.shift();

    s.t++;
    s.log.push(ev);
    if (s.r.hp <= 0) { s.over = 'win'; if (s.p.hp <= 0) s.p.hp = 1; } // if both fall in the same turn, Gytis barely stands
    else if (s.p.hp <= 0) s.over = 'lose';
    else if (s.t >= 60) s.over = 'timeout';
    return s;
  }

  const api = { CFG, newFight, legalMoves, step, kiCost };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YadraCombat = api;
})(typeof window !== 'undefined' ? window : globalThis);
