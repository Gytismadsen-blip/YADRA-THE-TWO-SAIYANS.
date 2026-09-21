  // Roku's brain: he counts what the player did AFTER each 1 or 2 earlier moves (recent moves count more),
  // then guesses the next move. He only trusts a guess part of the time, so a fixed combo is not safe, but he is not a cheat.
  function predictNext(s, extra) {
    const h = s.hist.concat(extra || []).filter(m => m !== 'collapse');
    const d = CFG.memoryDecay, n = h.length, o2 = {}, o1 = {};
    for (let i = 1; i < n; i++) {
      const w = Math.pow(d, n - 1 - i), k1 = h[i - 1];
      o1[k1] = o1[k1] || {}; o1[k1][h[i]] = (o1[k1][h[i]] || 0) + w;
      if (i >= 2) { const k2 = h[i - 2] + '>' + h[i - 1]; o2[k2] = o2[k2] || {}; o2[k2][h[i]] = (o2[k2][h[i]] || 0) + w; }
    }
    const pick = tbl => {
      if (!tbl) return null;
      let best = null, tot = 0, bv = 0;
      for (const m in tbl) { tot += tbl[m]; if (tbl[m] > bv) { bv = tbl[m]; best = m; } }
      return tot >= CFG.minEvidence ? { move: best, conf: bv / tot } : null;
    };
    if (n >= 2) { const r = pick(o2[h[n - 2] + '>' + h[n - 1]]); if (r && r.conf >= .5) return r; }
    if (n >= 1) { const r = pick(o1[h[n - 1]]); if (r && r.conf >= .6) return r; }
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
    const x = s.rng();
    return { type: x < 0.4 ? 'rush' : x < 0.75 ? 'blast' : 'guard' };
  }

