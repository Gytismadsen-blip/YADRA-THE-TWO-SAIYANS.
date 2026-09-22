// Yadra combat rules: pure logic, no drawing. Same file is tested in Node and later inlined in index.html.
(function (root) {
  'use strict';

  const CFG = {
    player: { hp: 170, ki: 100, kiMax: 100, st: 50 },
    roku: { hp: 150, rush: 16, blast: 18, weak: 10, counterHit: 12, deflectHit: 14, tracking: 20, phase2At: 75, phase2Mult: 1.3, evadeCounter: 14 },
    strainDecay: 3, startStrain: 0, noSenseLie: false,
    staminaRegen: 3,
    collapseStrain: 60,
    planReadChance: 0.7, lateReadChance: 0.85, memoryDecay: 0.88, minEvidence: 0.9, chargeReadMult: 0.25,
    train: { hpPerBody: 3, decayPerBody: 0.10, kiPerKi: 4, lanceStrainPerKi: 1.5, readCutPerFocus: 0.04, dmgPerLevel: 0.02 },
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

  // Difficulty: Training (Roku does not read you), Normal, Master (Roku reads you every time and hits harder)
  const DIFFS = {
    training: { playerHp: 190, rokuHp: 140, dmg: 0.85, late: 0.3, plan: 0.3 },
    normal:   { playerHp: 170, rokuHp: 150, dmg: 1,    late: 0.85, plan: 0.7 },
    master:   { playerHp: 175, rokuHp: 155, dmg: 1.05, late: 0.95, plan: 0.75 },
  };
  function setDifficulty(name) {
    const d = DIFFS[name] || DIFFS.normal;
    CFG.player.hp = d.playerHp; CFG.roku.hp = d.rokuHp; CFG.roku.phase2At = Math.floor(d.rokuHp / 2);
    CFG.roku.rush = Math.round(16 * d.dmg); CFG.roku.blast = Math.round(18 * d.dmg);
    CFG.lateReadChance = d.late; CFG.planReadChance = d.plan; CFG.difficulty = DIFFS[name] ? name : 'normal';
    // reset everything training can change
    CFG.player.kiMax = 100; CFG.player.ki = 100; CFG.strainDecay = 3; CFG.startStrain = 0; CFG.noSenseLie = false;
    CFG.moves.lance.strain = 45; CFG.moves.sense.ki = 5; CFG.moves.charge.gainKi = 40; CFG.moves.phantom.ki = 20; CFG.moves.phantom.strain = 15;
    CFG.dmgMul = { strike: 1, blast: 1, lance: 1, phantom: 1 }; CFG.crit = 0; // training makes attacks hit harder
    CFG.ai = { rush: .4, blast: .35, chargeHunter: 0, flee: 0 }; // enemy habits: rush/blast weights (guard = the rest), punishes Charge Ki, runs away at low HP
  }
  // Training: three trainable things. Call setDifficulty first, then setStats (it adds on top).
  //   body  -> more life, Strain wears off faster
  //   ki    -> bigger Ki bar, Spirit Lance costs less Strain
  //   focus -> Roku reads you less, Spirit Sense gets cheaper (and stops being lied to at 5)
  //   fatigue (0-80) = Body Strain you carry into the fight from over-training
  function setStats(st) {
    st = st || {};
    const n = v => Math.max(0, v | 0); // no cap: training keeps paying off past level 12
    const b = n(st.body), k = n(st.ki), fo = n(st.focus), fat = Math.max(0, Math.min(80, st.fatigue | 0));
    CFG.player.hp += CFG.train.hpPerBody * b + Math.max(0, Math.min(80, st.meal | 0)); CFG.strainDecay += CFG.train.decayPerBody * b;
    CFG.player.kiMax = 100 + CFG.train.kiPerKi * k; CFG.player.ki = CFG.player.kiMax; CFG.moves.lance.strain = Math.max(25, 45 - CFG.train.lanceStrainPerKi * k);
    const rm = Math.max(0.4, 1 - CFG.train.readCutPerFocus * fo); CFG.lateReadChance *= rm; CFG.planReadChance *= rm;
    CFG.moves.sense.ki = fo >= 3 ? 3 : 5; CFG.noSenseLie = fo >= 5; CFG.startStrain = fat;
    CFG.dmgMul.strike = 1 + CFG.train.dmgPerLevel * b; CFG.dmgMul.blast = CFG.dmgMul.lance = 1 + CFG.train.dmgPerLevel * k; CFG.dmgMul.phantom = 1 + CFG.train.dmgPerLevel * fo; CFG.crit = Math.min(.24, .02 * fo); // Body: Strike, Ki: Blast+Lance, Focus: Phantom Step + critical hits
    if (Array.isArray(st.tech) && st.tech.indexOf('steady') >= 0) CFG.moves.lance.strain = Math.max(20, CFG.moves.lance.strain - 10); // the Steady Spirit technique
    const T = Array.isArray(st.tech) ? st.tech : []; // techniques learned from missions
    if (T.indexOf('breath') >= 0) CFG.moves.charge.gainKi = 50;                                  // Deep Breath: Charge Ki gives more
    if (T.indexOf('quick') >= 0) { CFG.moves.phantom.ki = 15; CFG.moves.phantom.strain = 10; }   // Quick Step: Phantom Step is cheaper
    if (T.indexOf('iron') >= 0) CFG.strainDecay += 1;                                            // Iron Body: Strain wears off faster
    if (T.indexOf('calm') >= 0) { CFG.moves.sense.ki = 3; CFG.noSenseLie = true; }               // Calm Mind: Spirit Sense is cheap and never lies
    if (T.indexOf('champion') >= 0) CFG.player.hp += 10;                                         // Champion: a little more life
  }

  // A weaker/other enemy on the same brain. Call after setDifficulty and BEFORE setStats.
  //   hp/dmg = multipliers, late/plan = read chances, fury:false = no second phase
  function setFoe(f) {
    f = f || {}; const R = CFG.roku;
    R.hp = Math.round(R.hp * (f.hp || 1)); R.rush = Math.round(R.rush * (f.dmg || 1)); R.blast = Math.round(R.blast * (f.dmg || 1));
    R.phase2At = f.fury === false ? -1 : Math.floor(R.hp / 2);
    if (f.late != null) CFG.lateReadChance = f.late; if (f.plan != null) CFG.planReadChance = f.plan;
    if (f.ai) CFG.ai = Object.assign({}, CFG.ai, f.ai);
  }

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
      p: { hp: CFG.player.hp, ki: CFG.player.ki, st: CFG.player.st, strain: CFG.startStrain || 0, collapsed: false, last: null },
      r: { hp: CFG.roku.hp, phase: 1, lieOwed: false, queue: [] },
      hist: [],
      known: [],
      over: null,
      log: [],
    };
    s.r.queue.push(planNext(s), planNext(s));
    return s;
  }

  // Roku's brain: he counts what the player did AFTER each 1 or 2 earlier moves (recent moves count more),
  // then guesses the next move. He only trusts a guess part of the time, so a fixed combo is not safe, but he is not a cheat.
  function predictNext(s, extra) {
    const h = s.hist.concat(extra || []).filter(m => m !== 'collapse');
    const legal = extra ? null : legalMoves(s); // Roku can see your Ki and Stamina bars, like you can
    if (legal && legal[0] === 'collapse') return null;
    const d = CFG.memoryDecay, n = h.length, o2 = {}, o1 = {};
    for (let i = 1; i < n; i++) {
      const w = Math.pow(d, n - 1 - i), k1 = h[i - 1];
      o1[k1] = o1[k1] || {}; o1[k1][h[i]] = (o1[k1][h[i]] || 0) + w;
      if (i >= 2) { const k2 = h[i - 2] + '>' + h[i - 1]; o2[k2] = o2[k2] || {}; o2[k2][h[i]] = (o2[k2][h[i]] || 0) + w; }
    }
    const pick = tbl => {
      if (!tbl) return null;
      let best = null, tot = 0, bv = 0;
      for (const m in tbl) { if (legal && legal.indexOf(m) < 0) continue; tot += tbl[m]; if (tbl[m] > bv) { bv = tbl[m]; best = m; } }
      return tot >= CFG.minEvidence ? { move: best, conf: bv / tot } : null;
    };
    if (n >= 2) { const r = pick(o2[h[n - 2] + '>' + h[n - 1]]); if (r && r.conf >= .5) return r; }
    if (n >= 1) { const r = pick(o1[h[n - 1]]); if (r && r.conf >= .6) return r; }
    // no habit found, but you cannot afford any attack: you will most likely charge
    if (legal && !legal.some(m => m === 'blast' || m === 'lance' || m === 'phantom' || m === 'strike') && legal.indexOf('charge') >= 0) return { move: 'charge', conf: .7 };
    return null;
  }
  function readHabit(s, chance, extra) {
    if (chance <= 0) return null;
    const p = predictNext(s, extra);
    if (p && s.rng() < chance) return { type: 'read', target: p.move, late: true };
    return null;
  }

  function planNext(s) {
    if (CFG.planReadChance > 0) {
      const p1 = predictNext(s), p2 = p1 ? predictNext(s, [p1.move]) : null; // the move after the next one
      if (p2 && s.rng() < CFG.planReadChance) return { type: 'read', target: p2.move, late: false };
    }
    const A = CFG.ai;
    if (A.chargeHunter && s.p.last === 'charge' && s.rng() < A.chargeHunter) return { type: 'rush' }; // he jumps on a charge
    const x = s.rng();
    return { type: x < A.rush ? 'rush' : x < A.rush + A.blast ? 'blast' : 'guard' };
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
        if (pm === 'lance') { evade = true; counterAmt = R.evadeCounter || 0; }
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
      let d = M.dmg * dm * (CFG.dmgMul[pm] || 1);
      if (CFG.crit > 0 && s.rng() < CFG.crit) { d *= 1.5; ev.notes.push('crit'); }
      if (rokuGuard) d *= 0.5;
      if (evade) d = 0;
      if (strikeHalved || blastHalved) d *= 0.5;
      toRoku += d;
      if (rokuGuard && pm === 'strike') counterAmt = R.counterHit;
    } else if (pm === 'phantom') {
      phantomFailed = s.p.strain >= CFG.strainTier2 && s.rng() < CFG.phantomFail;
      if (phantomFailed) ev.notes.push('phantom-failed');
      else if (!tracking && incoming > 0) { incoming = 0; toRoku += M.dmg * dm * (CFG.dmgMul.phantom || 1); ev.notes.push('dodged'); }
    } else if (pm === 'charge') {
      const gm = ev.notes.includes('read') ? CFG.chargeReadMult : (interruptCharge && incoming > 0 ? .5 : 1); // Roku breaks a charge he saw coming
      s.p.ki = Math.min(CFG.player.kiMax, s.p.ki + CFG.moves.charge.gainKi * gm);
    } else if (pm === 'guard') {
      s.p.st = Math.min(CFG.player.st, s.p.st + 15);
      s.p.ki = Math.min(CFG.player.kiMax, s.p.ki + 10);
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
      if (s.r.lieOwed && !CFG.noSenseLie) {
        const wrong = { type: shown[0].type === 'rush' ? 'blast' : 'rush' };
        shown[0] = wrong; s.r.lieOwed = false; ev.notes.push('sense-lied');
      }
      s.known = shown;
    } else s.known.shift();

    s.t++;
    s.log.push(ev);
    if (s.r.hp <= 0) { s.over = 'win'; if (s.p.hp <= 0) s.p.hp = 1; } // if both fall in the same turn, Gytis barely stands
    else if (s.p.hp <= 0) s.over = 'lose';
    else if (CFG.ai.flee && s.r.hp <= CFG.ai.flee * CFG.roku.hp && s.rng() < .4) { s.over = 'win'; ev.notes.push('fled'); } // a nervous enemy gives up
    else if (s.t >= 60) s.over = 'timeout';
    return s;
  }

  const api = { CFG, newFight, legalMoves, step, kiCost, setDifficulty, setStats, setFoe, DIFFS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YadraCombat = api;
})(typeof window !== 'undefined' ? window : globalThis);
