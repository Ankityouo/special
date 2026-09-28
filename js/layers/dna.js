/* DNA, in nanometers: chromatin as "beads on a string" — nucleosomes, each
 * 147 base pairs of DNA wound 1.65 times around a spool of eight histone
 * proteins, joined by linker DNA into a fiber that wanders through the
 * nucleus.
 *
 * Near the focus every heavy atom is drawn (space-filling, CPK colours):
 * bases from the standard base-pair reference frames (Olson et al. 2001), a
 * sugar-phosphate backbone on each strand, and histone cores coloured by
 * chain (H3 blue, H4 green, H2A yellow, H2B red) with flexible tails. Farther
 * away, each base pair and histone lobe is one bead. The zoom ends on one
 * carbon atom of a sugar, turned toward the camera.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3 } = CA;
  const DEG = CA.DEG;

  // ---------------------------------------------------------------- one nucleotide pair
  // Standard bases in the base-pair frame (Å): x toward the major groove, y
  // toward strand I's backbone, z up the helix. Strand II is the dyad image
  // (x, -y, -z).
  const BASES = {
    A: [['N', -1.291, 4.498], ['C', 0.024, 4.897], ['N', 0.877, 3.902], ['C', 0.071, 2.771], ['C', 0.369, 1.398], ['N', 1.611, 0.909],
      ['N', -0.668, 0.532], ['C', -1.912, 1.023], ['N', -2.32, 2.29], ['C', -1.267, 3.124]],
    G: [['N', -1.289, 4.551], ['C', 0.023, 4.962], ['N', 0.87, 3.969], ['C', 0.071, 2.833], ['C', 0.424, 1.46], ['O', 1.554, 0.955],
      ['N', -0.7, 0.641], ['C', -1.999, 1.087], ['N', -2.949, 0.139], ['N', -2.342, 2.364], ['C', -1.265, 3.177]],
    T: [['N', -1.284, 4.5], ['C', -1.462, 3.135], ['O', -2.562, 2.608], ['N', -0.298, 2.407], ['C', 0.994, 2.897], ['O', 1.944, 2.119],
      ['C', 1.106, 4.338], ['C', 2.466, 4.961], ['C', -0.024, 5.057]],
    C: [['N', -1.285, 4.542], ['C', -1.472, 3.158], ['O', -2.628, 2.709], ['N', -0.391, 2.344], ['C', 0.837, 2.868], ['N', 1.875, 2.027],
      ['C', 1.056, 4.275], ['C', -0.023, 5.068]],
  };
  const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
  // Sugar-phosphate backbone of strand I (Å), from this pair's phosphate to its 3' oxygen.
  const BACKBONE = [
    ['P', 0.0, 8.9, -2.0], ['O', 0.35, 10.25, -2.45], ['O', -1.2, 9.2, -2.95], ['O', -0.84, 8.46, -1.44], ['C', -1.74, 8.63, -0.57],
    ['C', -2.37, 7.64, -0.41], ['O', -2.9, 6.55, -0.6], ['C', -2.479, 5.346, 0.0], ['C', -3.55, 6.45, 0.85], ['C', -3.0, 7.6, 0.75],
    ['O', -4.0, 8.2, 0.35],
  ];
  const C1P = 7;                       // index of C1' in BACKBONE
  const RAD = { C: 0.17, N: 0.155, O: 0.152, P: 0.18 };
  const COL = { C: [0.8, 0.82, 0.86], N: [0.36, 0.55, 1.0], O: [1.0, 0.34, 0.28], P: [1.0, 0.62, 0.2] };
  const HISTONE = [[0.35, 0.55, 1.0], [0.3, 0.88, 0.45], [1.0, 0.84, 0.3], [1.0, 0.42, 0.4]];  // H3 H4 H2A H2B
  const TWIST = 34.3 * DEG, RISE = 0.338;

  // Atoms of one base pair in its frame (nm), both strands.
  function pairAtoms(base) {
    const out = [];
    const put = (el, x, y, z, strand, part) => out.push({ el, p: strand ? [x * 0.1, -y * 0.1, -z * 0.1] : [x * 0.1, y * 0.1, z * 0.1], strand, part });
    for (const s of [0, 1]) {
      const b = s ? PAIR[base] : base;
      for (const a of BASES[b]) put(a[0], a[1], a[2], 0, s, 'base');
      BACKBONE.forEach((a, i) => put(a[0], a[1], a[2], a[3], s, i === C1P ? 'c1' : 'bb'));
    }
    return out;
  }

  // ---------------------------------------------------------------- nucleosome geometry
  const RS = 4.7, PS = 2.6, TURNS = 1.65, NBP = 147;
  const DA = (TURNS * 2 * Math.PI) / (NBP - 1);
  // DNA axis point, tangent and inward normal at base pair j, in the nucleosome frame (z = spool axis).
  function spool(j) {
    const a = (j - (NBP - 1) / 2) * DA;
    const c = [RS * Math.cos(a), RS * Math.sin(a), -PS * a / (2 * Math.PI)];
    const t = v3.norm([-RS * Math.sin(a), RS * Math.cos(a), -PS / (2 * Math.PI)]);
    const n = [-Math.cos(a), -Math.sin(a), 0];
    return { c, t, n };
  }
  const perp = (t) => v3.norm(v3.cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  // Orientation that takes local unit vector a to world unit vector b, rolled by r about b.
  function orientTo(a, b, roll) {
    const a1 = perp(a), a2 = v3.cross(a, a1);
    let b1 = perp(b);
    b1 = v3.rotate(b1, b, roll);
    const b2 = v3.cross(b, b1);
    // world = Bw * (La^T * local)
    return (p) => {
      const la = [v3.dot(p, a), v3.dot(p, a1), v3.dot(p, a2)];
      return [b[0] * la[0] + b1[0] * la[1] + b2[0] * la[2], b[1] * la[0] + b1[1] * la[1] + b2[1] * la[2], b[2] * la[0] + b1[2] * la[1] + b2[2] * la[2]];
    };
  }

  // The fiber: a chain of nucleosomes placed link by link, so the DNA is continuous.
  function buildFiber(R, count) {
    const nucs = [{ center: [0, 0, 0], rot: (p) => p.slice() }];
    const S0 = spool(0), S1 = spool(NBP - 1);
    for (let dir = 1; dir >= -1; dir -= 2) {
      let prev = nucs[0];
      for (let k = 1; k <= count; k++) {
        const link = Math.round(R.range(18, 48));
        let n;
        if (dir > 0) {
          const exitP = v3.add(prev.center, prev.rot(S1.c)), exitT = prev.rot(S1.t);
          const q = v3.madd(exitP, exitT, link * RISE);
          const rot = orientTo(S0.t, exitT, R.next() * Math.PI * 2);
          n = { center: v3.sub(q, rot(S0.c)), rot, linkIn: link };
        } else {
          const entP = v3.add(prev.center, prev.rot(S0.c)), entT = prev.rot(S0.t);
          const q = v3.madd(entP, entT, -link * RISE);
          const rot = orientTo(S1.t, entT, R.next() * Math.PI * 2);
          n = { center: v3.sub(q, rot(S1.c)), rot, linkOut: link };
          prev.linkIn = link;
        }
        if (dir > 0) nucs.push(n); else nucs.unshift(n);
        prev = n;
      }
    }
    return nucs;
  }

  // Walk the DNA of a fiber base pair by base pair: fn(center, tangent, normal, twistIndex, nucleosomeIndex).
  // The twist index counts base pairs from the start of nucleosome `zero`, so the
  // helix phase is continuous along the fiber and fixed on the central spool.
  function walkDNA(nucs, fn, zero) {
    let start = 0;
    for (let ni = 0; ni < (zero || 0); ni++) start += (ni > 0 ? nucs[ni].linkIn || 0 : 0) + NBP;
    start += zero > 0 ? nucs[zero].linkIn || 0 : 0;
    let bp = -start;
    nucs.forEach((nu, ni) => {
      const S0 = spool(0);
      if (nu.linkIn && ni > 0) {
        const st = v3.add(nu.center, nu.rot(S0.c)), t = nu.rot(S0.t), n0 = nu.rot(S0.n);
        for (let j = nu.linkIn; j >= 1; j--) fn(v3.madd(st, t, -j * RISE), t, n0, bp++, ni);
      }
      for (let j = 0; j < NBP; j++) {
        const s = spool(j);
        fn(v3.add(nu.center, nu.rot(s.c)), nu.rot(s.t), nu.rot(s.n), bp++, ni);
      }
    });
  }

  // ---------------------------------------------------------------- the carbon we zoom into
  // The whole fiber is turned so that one sugar carbon on the central spool faces
  // the camera of the Carbon Atom chapter (yaw 0.55, pitch 0.38 in app.js). The
  // carbon is chosen by ray-testing lines of sight: the path in must be clear of
  // every other atom, the histone core and the neighbouring nucleosomes.
  const R0 = CA.makeRandom(20260928);
  const FIBER = buildFiber(R0, 30);
  const CENTER = FIBER.findIndex((n) => v3.len(n.center) === 0);
  const SEQ = (() => { const R = CA.makeRandom(47); const s = []; for (let i = 0; i < 20000; i++) s.push('ACGT'[R.int(4)]); return s; })();
  const baseAt = (tw) => SEQ[(tw + 5000) % SEQ.length];
  function framePair(c, t, n, twistIndex) {
    const w = twistIndex * TWIST + Math.PI - 73 * TWIST;   // minor groove faces the spool at the dyad
    const b = v3.cross(t, n);
    const x = v3.add(v3.scale(n, Math.cos(w)), v3.scale(b, Math.sin(w)));
    const y = v3.cross(t, x);
    return (p) => [c[0] + x[0] * p[0] + y[0] * p[1] + t[0] * p[2], c[1] + x[1] * p[0] + y[1] * p[1] + t[1] * p[2], c[2] + x[2] * p[0] + y[2] * p[1] + t[2] * p[2]];
  }
  const yawA = 0.55, pitchA = 0.38;
  const back = [Math.sin(yawA) * Math.cos(pitchA), Math.sin(pitchA), Math.cos(yawA) * Math.cos(pitchA)];
  const central = [];
  for (let j = 0; j < NBP; j++) {
    const s = spool(j), f = framePair(s.c, s.t, s.n, j);
    for (const a of pairAtoms(baseAt(j))) central.push({ p: f(a.p), r: RAD[a.el], a, j, axis: s.c });
  }
  const obstacles = [[[0, 0, 0], 3.75]];
  for (const k of [-2, -1, 1, 2]) {
    const nu = FIBER[CENTER + k];
    if (nu) obstacles.push([nu.center, 6.2]);
  }
  // Linker DNA leaving and entering the central spool.
  for (const k of [0, 1]) {
    const nu = FIBER[CENTER + k];
    if (!nu || !nu.linkIn) continue;
    const S0 = spool(0), st = v3.add(nu.center, nu.rot(S0.c)), t = nu.rot(S0.t);
    for (let j = 1; j <= nu.linkIn; j += 2) obstacles.push([v3.madd(st, t, -j * RISE), 1.15]);
  }
  const rayHits = (c, u, q, r) => {
    const w = v3.sub(q, c), t = CA.clamp(v3.dot(w, u), 0.3, 26);
    return v3.dist(v3.madd(c, u, t), q) < r;
  };
  let pick = null;
  search: for (let dj = 0; dj <= 30 && !pick; dj++) {
    for (const j of [78 + dj, 78 - dj]) {
      for (const cand of central) {
        if (cand.j !== j || cand.a.part !== 'c1') continue;
        const outs = [v3.norm(v3.sub(cand.p, cand.axis)), v3.norm(cand.p), v3.norm(v3.add(v3.norm(v3.sub(cand.p, cand.axis)), v3.norm(cand.p)))];
        for (const u of outs) {
          let ok = true;
          for (const o of central) if (o !== cand && rayHits(cand.p, u, o.p, o.r + 0.05)) { ok = false; break; }
          if (ok) for (const [q, r] of obstacles) if (rayHits(cand.p, u, q, r)) { ok = false; break; }
          if (ok) { pick = { cand, u }; break search; }
        }
      }
    }
  }
  if (!pick) pick = { cand: central.find((c) => c.a.part === 'c1' && c.j === 78), u: [0, 0, 1] };
  const ALIGN = orientTo(pick.u, back, 0);
  const J0 = pick.cand.j, S0N = pick.cand.a.strand;
  CA.LEVELS[4].a = ALIGN(pick.cand.p);
  // The carbon's bonded partners (O4', C2', and the base's glycosidic nitrogen), in pm from it.
  {
    const same = central.filter((c) => c.j === J0 && c.a.strand === S0N);
    const byXY = (el, x, y) => same.find((c) => c.a.el === el && Math.abs(c.a.p[0] - x) < 0.01 && Math.abs(Math.abs(c.a.p[1]) - Math.abs(y)) < 0.01);
    const parts = [byXY('O', -0.29, 0.655), byXY('C', -0.355, 0.645), same.find((c) => c.a.part === 'base')].filter(Boolean);
    const c0 = ALIGN(pick.cand.p);
    CA.CARBON = { neighbors: parts.map((c) => [c.a.el, v3.scale(v3.sub(ALIGN(c.p), c0), 1000)]) };
  }
  // A three-quarter view for the DNA chapter: between face-on and the carbon's side.
  {
    let ax = ALIGN([0, 0, 1]);
    if (ax[1] < 0) ax = v3.scale(ax, -1);
    const dir = v3.norm(v3.add(v3.scale(back, 0.75), v3.scale(ax, 0.7)));
    CA.DNA_VIEW = { yawL: Math.atan2(dir[0], dir[2]), pitchL: CA.clamp(Math.asin(dir[1]), -1.3, 1.35) };
  }

  class DNALayer extends CA.Layer {
    constructor() {
      super({ name: 'dna', unit: 1e-9, level: 'dna', fade: [-9.25, -8.85, -6.9, -6.3], bound: 600 });
    }

    *build(gfx) {
      const R = CA.makeRandom(7);
      const dens = CA.device.density;
      const atoms = [];      // {p, el|col, r}
      const beads = new CA.Sink(Math.round(100000 * dens) + 20000);
      const near = new CA.Sink(4000);      // the detailed nucleosomes as beads, for distant views
      const detail = (ni) => Math.abs(ni - CENTER) <= 1;
      // DNA: atoms near the focus, one bead per base pair elsewhere.
      walkDNA(FIBER, (c, t, n, tw, ni) => {
        const p0 = ALIGN(c);
        if (detail(ni)) {
          const f = framePair(p0, ALIGN(t), ALIGN(n), tw);
          const base = baseAt(tw);
          for (const a of pairAtoms(base)) atoms.push({ p: f(a.p), el: a.el });
          near.push(p0[0], p0[1], p0[2], 0.66, 0.74, 0.9, 1.0, 1);
        } else {
          beads.push(p0[0], p0[1], p0[2], 0.66, 0.74, 0.9, 1.0, 1);
        }
      }, CENTER);
      yield 0.3;
      // Histone cores: the central three in pseudo-atoms with tails, the rest as lobes.
      FIBER.forEach((nu, ni) => {
        const rot = (p) => ALIGN(v3.add(nu.center, nu.rot(p)));
        if (detail(ni)) {
          for (let q = 0; q < 2200; q++) {
            // Only the outer shell of the core can ever be seen.
            const a = R.next() * Math.PI * 2, rr = 3.5 * Math.sqrt(R.next()), z = R.range(-2.5, 2.5);
            const e = (rr / 3.5) ** 2 + (z / 2.7) ** 2;
            if (e > 1.05 || e < 0.45) continue;
            const chain = (Math.floor(((a / (Math.PI * 2)) * 4 + (z > 0 ? 0.5 : 0)) + 4) % 4);
            atoms.push({ p: rot([rr * Math.cos(a), rr * Math.sin(a), z]), col: HISTONE[chain], r: R.range(0.16, 0.2) });
          }
          for (let tail = 0; tail < 8; tail++) {
            let p = [3.2 * Math.cos(tail * 0.785), 3.2 * Math.sin(tail * 0.785), (tail % 2 ? 1 : -1) * 1.6];
            let d = v3.norm([p[0], p[1], p[2] * 0.3]);
            const col = HISTONE[tail % 4];
            for (let s = 0; s < 34; s++) {
              d = v3.norm(v3.madd(d, R.dir(), 0.45));
              p = v3.madd(p, d, 0.36);
              atoms.push({ p: rot(p), col, r: 0.19 });
            }
          }
        }
        const sink = detail(ni) ? near : beads;
        for (let q = 0; q < 16; q++) {
          const a = (q / 8) * Math.PI * 2, z = q < 8 ? -1.2 : 1.2;
          const p = rot([2.3 * Math.cos(a), 2.3 * Math.sin(a), z]);
          const c = HISTONE[(q + (z > 0 ? 1 : 0)) % 4];
          sink.push(p[0], p[1], p[2], c[0], c[1], c[2], 1.55, 1.0);
        }
      });
      yield 0.5;
      // Other fibers passing through the nucleus, as beads only.
      for (let f = 0; f < Math.round(4 * dens + 1); f++) {
        const Rf = CA.makeRandom(900 + f);
        const fiber = buildFiber(Rf, Math.round(14 + 10 * dens));
        const off = v3.scale(R.dir(), R.range(90, 260));
        const turn = orientTo([0, 0, 1], R.dir(), R.next() * 6.28);
        walkDNA(fiber, (c) => { const p = v3.add(turn(c), off); beads.push(p[0], p[1], p[2], 0.6, 0.68, 0.88, 1.0, 1); }, 0);
        fiber.forEach((nu) => {
          for (let q = 0; q < 8; q++) {
            const a = (q / 8) * Math.PI * 2;
            const p = v3.add(turn(v3.add(nu.center, nu.rot([2.2 * Math.cos(a), 2.2 * Math.sin(a), 0]))), off);
            const c = HISTONE[q % 4];
            beads.push(p[0], p[1], p[2], c[0], c[1], c[2], 1.9, 1.0);
          }
        });
        yield 0.5 + 0.2 * f / 8;
      }
      // Ambient occlusion for the atoms: buried atoms get darker.
      const cell = 0.7, grid = new Map();
      const key = (x, y, z) => x + ',' + y + ',' + z;
      atoms.forEach((a, i) => {
        const k = key(Math.floor(a.p[0] / cell), Math.floor(a.p[1] / cell), Math.floor(a.p[2] / cell));
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      });
      const data = new Float32Array(atoms.length * 8);
      atoms.forEach((a, i) => {
        const gx = Math.floor(a.p[0] / cell), gy = Math.floor(a.p[1] / cell), gz = Math.floor(a.p[2] / cell);
        let cnt = 0;
        for (let x = gx - 1; x <= gx + 1; x++) for (let y = gy - 1; y <= gy + 1; y++) for (let z = gz - 1; z <= gz + 1; z++) {
          const l = grid.get(key(x, y, z));
          if (!l) continue;
          for (const j of l) {
            const b = atoms[j].p;
            const d2 = (b[0] - a.p[0]) ** 2 + (b[1] - a.p[1]) ** 2 + (b[2] - a.p[2]) ** 2;
            if (d2 < 0.49) cnt++;
          }
        }
        const col = a.col || COL[a.el];
        const o = i * 8;
        data[o] = a.p[0]; data[o + 1] = a.p[1]; data[o + 2] = a.p[2];
        data[o + 3] = col[0]; data[o + 4] = col[1]; data[o + 5] = col[2];
        data[o + 6] = 1 - CA.clamp((cnt - 9) / 26, 0, 0.85);
        data[o + 7] = a.r || RAD[a.el];
      });
      this.atoms = new CA.SpriteSet(gfx, data);
      this.beads = new CA.SpriteSet(gfx, beads.data());
      this.near = new CA.SpriteSet(gfx, near.data());
      yield 0.9;

      const c0 = ALIGN(FIBER[CENTER].center);
      const up = ALIGN(FIBER[CENTER].rot([0, 0, 1]));
      this.label('Nucleosome', v3.madd(c0, up, 5.2), [-8.3, -7.9, -7.0, -6.7], { pri: 7, sub: '147 base pairs on a histone spool' });
      this.label('Histone proteins', v3.madd(c0, up, -3.4), [-8.2, -7.9, -7.4, -7.1], { pri: 5 });
      this.label('Linker DNA', ALIGN(v3.add(FIBER[CENTER + 1].center, FIBER[CENTER + 1].rot(spool(0).c))), [-7.7, -7.4, -6.9, -6.6], { pri: 4 });
      this.label('Chromatin fiber', [60, 30, 0], [-7.0, -6.8, -6.5, -6.3], { pri: 3, cls: 'region' });
      this.label('Base pairs', v3.madd(CA.LEVELS[4].a, back, 0.2), [-9.1, -8.8, -8.4, -8.1], { pri: 5, sub: 'A pairs with T, G with C' });
      this.label('Carbon', CA.LEVELS[4].a, [-9.4, -9.2, -8.9, -8.7], { pri: 7 });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr;
      gfx.depth(true, true);
      gfx.blend('premul');
      // Level of detail: atoms up close, one bead per base pair from afar.
      const cull = cam.d * 8, d = cam.d, nf = d * 0.5;
      const atomsA = 1 - CA.smoothstep(45, 80, d), nearA = CA.smoothstep(35, 60, d);
      gfx.drawSpheres(this.beads, cam, { u_minPx: 0.9 * dpr, u_gain: 1.05, u_opacity: op, u_emit: 0.12, u_cullR: cull, u_nearFade: nf });
      if (nearA > 0) gfx.drawSpheres(this.near, cam, { u_minPx: 0.9 * dpr, u_gain: 1.05, u_opacity: op * nearA, u_emit: 0.12, u_cullR: cull, u_nearFade: nf });
      if (atomsA > 0) gfx.drawSpheres(this.atoms, cam, { u_minPx: 0.8 * dpr, u_gain: 1.1, u_opacity: op * atomsA, u_emit: 0.08, u_cullR: cull, u_nearFade: nf });
      gfx.depth(false, false);
    }
  }

  CA.layers.push(new DNALayer());
})();
