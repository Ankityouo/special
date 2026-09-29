/* A skin cell and its neighbours, in micrometers, drawn the way a confocal
 * fluorescence microscope sees them: membranes, nucleus, chromatin,
 * mitochondria, endoplasmic reticulum, Golgi, vesicles, desmosomes,
 * microtubules and keratin, each in its own stain colour.
 *
 * The tissue is the same Voronoi mosaic the skin layer draws on the fingertip
 * (same hashed grid), extruded into 12 µm tall cells, so the zoom lands on
 * exactly the cell it was heading for. The focus then sinks into its nucleus.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3 } = CA;
  const K = CA.SKIN;
  const CELL = K.CELL * 1000;       // µm
  const H = 12;                     // cell height, µm
  const [FI, FK] = K.cell;          // the cell we dive into
  const h = (i, k, s) => CA.hash2i(i, k, s);
  const seed = (i, k) => [((i + h(i, k, K.SEED)) * K.CELL - K.uc) * 1000, ((k + h(i, k, K.SEED + 1)) * K.CELL - K.vc) * 1000];
  const nucleusOf = (i, k) => {
    const s = seed(i, k);
    return {
      c: [s[0] + (h(i, k, 71) - 0.5) * CELL * 0.18, -6.2 + (h(i, k, 73) - 0.5) * 1.2, s[1] + (h(i, k, 72) - 0.5) * CELL * 0.18],
      r: [3.9 + h(i, k, 74) * 0.7, 3.0 + h(i, k, 75) * 0.5, 3.9 + h(i, k, 76) * 0.7],
    };
  };
  const FN = nucleusOf(FI, FK);
  CA.LEVELS[3].a = v3.add(FN.c, [0.9, 0.7, -0.6]);    // a strand of chromatin in the nucleus

  // Voronoi cell outline by clipping a square with the bisectors of its neighbours.
  function clip(P, m, n) {
    const out = [];
    const side = (p) => (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1];
    for (let j = 0; j < P.length; j++) {
      const a = P[j], b = P[(j + 1) % P.length];
      const sa = side(a), sb = side(b);
      if (sa <= 0) out.push(a);
      if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  function polygon(i, k) {
    const s = seed(i, k), E = CELL * 2;
    let P = [[s[0] - E, s[1] - E], [s[0] + E, s[1] - E], [s[0] + E, s[1] + E], [s[0] - E, s[1] + E]];
    for (let a = -2; a <= 2; a++) {
      for (let b = -2; b <= 2; b++) {
        if (!a && !b) continue;
        const t = seed(i + a, k + b);
        P = clip(P, [(t[0] + s[0]) / 2, (t[1] + s[1]) / 2], [t[0] - s[0], t[1] - s[1]]);
      }
    }
    return P;
  }
  function inside(P, x, z) {
    for (let j = 0; j < P.length; j++) {
      const a = P[j], b = P[(j + 1) % P.length];
      if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false;
    }
    return true;
  }
  const inEll = (N, p, s) => {
    const dx = (p[0] - N.c[0]) / (N.r[0] * s), dy = (p[1] - N.c[1]) / (N.r[1] * s), dz = (p[2] - N.c[2]) / (N.r[2] * s);
    return dx * dx + dy * dy + dz * dz;
  };

  const COL = {
    mem: [0.2, 0.95, 0.72], desmo: [0.85, 1.0, 0.9], env: [0.5, 0.45, 1.0], chrom: [0.36, 0.32, 1.0], nucleolus: [0.75, 0.6, 1.0],
    mito: [1.0, 0.3, 0.5], cristae: [1.0, 0.55, 0.7], er: [1.0, 0.82, 0.3], golgi: [1.0, 0.55, 0.18], ves: [0.9, 0.92, 1.0],
  };

  class CellLayer extends CA.Layer {
    constructor() {
      super({ name: 'cell', unit: 1e-6, level: 'cell', fade: [-7.0, -6.4, -4.0, -3.5], bound: 400 });
    }

    *build(gfx) {
      const R = CA.makeRandom(4321);
      const N3 = CA.makeNoise(99);
      const dens = CA.device.density;
      const mem = new CA.Sink(Math.round(420000 * dens) + 1000);
      const nuc = new CA.Sink(Math.round(260000 * dens) + 1000);
      const org = new CA.Sink(Math.round(240000 * dens) + 1000);
      const lines = new CA.LineBuilder();
      const cells = [];
      for (let a = -7; a <= 7; a++) {
        for (let b = -7; b <= 7; b++) {
          const i = FI + a, k = FK + b;
          const s = seed(i, k);
          const dist = Math.hypot(s[0], s[1]);
          if (dist > 190) continue;
          cells.push({ i, k, s, dist, ring: dist < 1 ? 0 : dist < CELL * 1.6 ? 1 : dist < CELL * 3.2 ? 2 : 3 });
        }
      }
      cells.sort((p, q) => p.dist - q.dist);
      let n = 0;
      for (const c of cells) {
        const P = polygon(c.i, c.k);
        const Nc = nucleusOf(c.i, c.k);
        const lod = [1, 0.34, 0.12, 0.05][c.ring] * dens;
        const dome = (x, z) => 1.2 * Math.max(0, 1 - ((x - c.s[0]) ** 2 + (z - c.s[1]) ** 2) / (CELL * CELL * 0.35));
        // Membrane walls, gently wavy, and the domed top.
        for (let j = 0; j < P.length; j++) {
          const a = P[j], b = P[(j + 1) % P.length];
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const cnt = Math.round(L * H * 16 * lod);
          const nx = (b[1] - a[1]) / (L || 1), nz = -(b[0] - a[0]) / (L || 1);
          for (let q = 0; q < cnt; q++) {
            const u = R.next(), y = -H + R.next() * (H + 0.2);
            const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
            const w = N3.noise(x * 0.35, y * 0.35, z * 0.35) * 0.45;
            const g = R.range(0.55, 1.0);
            mem.push(x + nx * w, y, z + nz * w, COL.mem[0] * g, COL.mem[1] * g, COL.mem[2] * g, R.range(0.1, 0.16));
          }
          // Desmosomes: the spot welds that hold skin cells together.
          const dcount = Math.round(L * 0.9 * Math.max(lod, 0.1));
          for (let q = 0; q < dcount; q++) {
            const u = R.next(), y = -H + R.next() * H;
            const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
            for (let m = 0; m < 14; m++) mem.push(x + R.gauss() * 0.12, y + R.gauss() * 0.12, z + R.gauss() * 0.12, COL.desmo[0], COL.desmo[1], COL.desmo[2], 0.09);
          }
        }
        const xs = P.map((p) => p[0]), zs = P.map((p) => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
        const area = (x1 - x0) * (z1 - z0);
        for (let q = 0, cnt = Math.round(area * 5 * lod); q < cnt; q++) {
          const x = R.range(x0, x1), z = R.range(z0, z1);
          if (!inside(P, x, z)) continue;
          const g = R.range(0.3, 0.6);
          mem.push(x, dome(x, z) + R.gauss() * 0.08, z, COL.mem[0] * g, COL.mem[1] * g, COL.mem[2] * g, 0.14);
        }
        // Nucleus: envelope, clumped chromatin (densest at the rim), nucleolus.
        const envN = Math.round(18000 * lod);
        for (let q = 0; q < envN; q++) {
          const d = R.dir();
          const g = R.range(0.5, 1.0);
          nuc.push(Nc.c[0] + d[0] * Nc.r[0], Nc.c[1] + d[1] * Nc.r[1], Nc.c[2] + d[2] * Nc.r[2], COL.env[0] * g, COL.env[1] * g, COL.env[2] * g, 0.09);
        }
        let chrom = 0, guard = 0;
        const chromN = Math.round(52000 * lod);
        while (chrom < chromN && guard++ < chromN * 5) {
          const b = R.ball();
          const p = [Nc.c[0] + b[0] * Nc.r[0], Nc.c[1] + b[1] * Nc.r[1], Nc.c[2] + b[2] * Nc.r[2]];
          const rim = v3.len(b);
          const clump = N3.fbm(p[0] * 0.9 + c.i * 7, p[1] * 0.9, p[2] * 0.9 + c.k * 7, 3);
          if (R.next() > 0.08 + Math.max(0, clump + 0.1) * 2.2 + Math.pow(rim, 8) * 0.8) continue;
          const g = R.range(0.35, 0.9);
          nuc.push(p[0], p[1], p[2], COL.chrom[0] * g, COL.chrom[1] * g, COL.chrom[2] * g, R.range(0.05, 0.09));
          chrom++;
        }
        const nlc = v3.add(Nc.c, [R.gauss() * 0.8, R.gauss() * 0.5, R.gauss() * 0.8]);
        for (let q = 0, cnt = Math.round(7000 * lod); q < cnt; q++) {
          const g = R.range(0.5, 1.0);
          nuc.push(nlc[0] + R.gauss() * 0.65, nlc[1] + R.gauss() * 0.5, nlc[2] + R.gauss() * 0.65, COL.nucleolus[0] * g, COL.nucleolus[1] * g, COL.nucleolus[2] * g, 0.07);
        }
        if (c.ring <= 1) this.organelles(R, N3, c, P, Nc, lod, org, lines, x0, x1, z0, z1);
        if (++n % 4 === 0) yield 0.1 + 0.8 * n / cells.length;
      }
      this.mem = new CA.PointCloud(gfx, mem.data());
      this.nuc = new CA.PointCloud(gfx, nuc.data());
      this.org = new CA.PointCloud(gfx, org.data());
      this.lines = lines.build(gfx);

      this.label('Nucleus', v3.add(FN.c, [0, FN.r[1] + 0.3, 0]), [-5.6, -5.1, -3.95, -3.6], { pri: 7, sub: 'holding your genome' });
      this.label('Cell membrane', this.wallPoint, [-5.0, -4.6, -3.9, -3.6], { pri: 5 });
      if (this.mitoAt) this.label('Mitochondrion', this.mitoAt, [-5.6, -5.2, -4.3, -4.0], { pri: 6, sub: 'the cell’s power plant' });
      if (this.golgiAt) this.label('Golgi apparatus', this.golgiAt, [-5.6, -5.2, -4.4, -4.1], { pri: 4 });
      if (this.erAt) this.label('Endoplasmic reticulum', this.erAt, [-5.8, -5.3, -4.6, -4.3], { pri: 4 });
      this.label('Chromatin', CA.LEVELS[3].a, [-6.6, -6.3, -5.5, -5.2], { pri: 6, sub: 'DNA packed with proteins' });
      this.ready = true;
    }

    organelles(R, N3, c, P, Nc, lod, org, lines, x0, x1, z0, z1) {
      const focus = c.ring === 0;
      const inCyto = (p, margin) => inside(P, p[0], p[2]) && p[1] > -H + 0.6 && p[1] < -0.6 && inEll(Nc, p, 1) > margin;
      const randCyto = (margin) => {
        for (let g = 0; g < 60; g++) {
          const p = [R.range(x0, x1), R.range(-H + 0.8, -0.8), R.range(z0, z1)];
          if (inCyto(p, margin)) return p;
        }
        return null;
      };
      // Mitochondria: bent tubes with cristae folded inside.
      const nm = focus ? 38 : 12;
      for (let m = 0; m < nm; m++) {
        const c0 = randCyto(1.5);
        if (!c0) continue;
        const dir = v3.norm([R.gauss(), R.gauss() * 0.35, R.gauss()]);
        const len = R.range(1.2, 3.6), rad = R.range(0.26, 0.4);
        const bend = v3.scale(v3.norm(v3.cross(dir, R.dir())), R.range(-0.5, 0.5));
        const at = (t) => v3.add(v3.madd(c0, dir, (t - 0.5) * len), v3.scale(bend, 4 * t * (1 - t)));
        const ptsN = Math.round(len * rad * 900 * (focus ? 1 : 0.35) * CA.device.density);
        for (let q = 0; q < ptsN; q++) {
          const t = R.next(), th = R.next() * Math.PI * 2;
          const cen = at(t);
          const tan = v3.norm(v3.sub(at(Math.min(1, t + 0.01)), at(Math.max(0, t - 0.01))));
          const e1 = v3.norm(v3.cross(tan, Math.abs(tan[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = v3.cross(tan, e1);
          const taper = Math.sqrt(Math.max(0.05, 1 - Math.pow(2 * t - 1, 8)));
          const p = v3.add(cen, v3.add(v3.scale(e1, Math.cos(th) * rad * taper), v3.scale(e2, Math.sin(th) * rad * taper)));
          const g = R.range(0.5, 1.0);
          org.push(p[0], p[1], p[2], COL.mito[0] * g, COL.mito[1] * g, COL.mito[2] * g, 0.05);
        }
        if (focus) {
          for (let cr = 0.12; cr < 0.9; cr += R.range(0.07, 0.12)) {
            const cen = at(cr);
            const tan = v3.norm(v3.sub(at(cr + 0.01), at(cr - 0.01)));
            const e1 = v3.norm(v3.cross(tan, [0, 1, 0])), e2 = v3.cross(tan, e1);
            for (let q = 0; q < 50; q++) {
              const a = R.range(-0.8, 0.8) * rad, b = R.range(-0.25, 0.25) * rad;
              const p = v3.add(cen, v3.add(v3.scale(e1, a), v3.scale(e2, b)));
              org.push(p[0], p[1], p[2], COL.cristae[0], COL.cristae[1], COL.cristae[2], 0.035);
            }
          }
          if (!this.mitoAt && v3.len(c0) < 14) this.mitoAt = c0;
        }
      }
      // Endoplasmic reticulum: sheets wrapped around the nucleus, found as thin
      // iso-surfaces of a noise field.
      const erN = Math.round((focus ? 60000 : 9000) * CA.device.density);
      let made = 0, guard = 0;
      while (made < erN && guard++ < erN * 14) {
        const d = R.dir();
        const s = R.range(1.08, 1.9);
        const p = [Nc.c[0] + d[0] * Nc.r[0] * s, Nc.c[1] + d[1] * Nc.r[1] * s * 1.2, Nc.c[2] + d[2] * Nc.r[2] * s];
        if (!inCyto(p, 1.05)) continue;
        const f = N3.noise(p[0] * 0.55 + 31, p[1] * 0.55, p[2] * 0.55);
        if (Math.abs(f) > 0.035) continue;
        const g = R.range(0.4, 0.9) * (1.3 - s * 0.45);
        org.push(p[0], p[1], p[2], COL.er[0] * g, COL.er[1] * g, COL.er[2] * g, 0.05);
        if (focus && !this.erAt && s > 1.5) this.erAt = p;
        made++;
      }
      if (!focus) return;
      // Golgi: a stack of curved cisternae beside the nucleus, budding vesicles.
      const gdir = v3.norm([0.7, 0.15, 0.7]);
      const gc = v3.add(Nc.c, [gdir[0] * (Nc.r[0] + 1.3), gdir[1] * (Nc.r[1] + 1.0), gdir[2] * (Nc.r[2] + 1.3)]);
      this.golgiAt = gc;
      const ge1 = v3.norm(v3.cross(gdir, [0, 1, 0])), ge2 = v3.cross(gdir, ge1);
      for (let st = 0; st < 6; st++) {
        const rad = 1.7 - st * 0.12;
        for (let q = 0; q < 900; q++) {
          const rr = Math.sqrt(R.next()) * rad, th = R.next() * Math.PI * 2;
          const a = Math.cos(th) * rr, b = Math.sin(th) * rr * 0.55;
          const curve = (a * a + b * b) * 0.18;
          const p = v3.add(gc, v3.add(v3.add(v3.scale(ge1, a), v3.scale(ge2, b)), v3.scale(gdir, st * 0.16 - curve)));
          const g = R.range(0.5, 1.0);
          org.push(p[0], p[1], p[2], COL.golgi[0] * g, COL.golgi[1] * g, COL.golgi[2] * g, 0.04);
        }
      }
      // Vesicles.
      for (let q = 0; q < 110; q++) {
        const c0 = q < 40 ? v3.add(gc, [R.gauss() * 1.4, R.gauss() * 0.8, R.gauss() * 1.4]) : randCyto(1.1);
        if (!c0) continue;
        const r = R.range(0.05, 0.13);
        for (let m = 0; m < 16; m++) {
          const d = R.dir();
          org.push(c0[0] + d[0] * r, c0[1] + d[1] * r, c0[2] + d[2] * r, COL.ves[0], COL.ves[1], COL.ves[2], 0.03);
        }
      }
      // Microtubules radiating from the centrosome beside the nucleus; keratin
      // bundles running between the cell's desmosomes.
      const cs = v3.add(gc, v3.scale(gdir, -0.9));
      for (let m = 0; m < 56; m++) {
        let p = cs.slice(), d = v3.norm([R.gauss(), R.gauss() * 0.5, R.gauss()]);
        const pts = [p];
        for (let s = 0; s < 60; s++) {
          d = v3.norm(v3.madd(d, R.dir(), 0.12));
          const q = v3.madd(p, d, 0.5);
          if (!inside(P, q[0], q[2]) || q[1] < -H + 0.3 || q[1] > -0.3) break;
          if (inEll(Nc, q, 1) < 1.1) { d = v3.norm(v3.sub(q, Nc.c)); continue; }
          p = q; pts.push(p);
        }
        if (pts.length > 3) lines.polyline(pts, (j, nn) => [0.35, 1.0, 0.45, 0.3 * (1 - 0.6 * j / nn)], false);
      }
      for (let m = 0; m < 34; m++) {
        let p = randCyto(1.2);
        if (!p) continue;
        let d = v3.norm([R.gauss(), R.gauss() * 0.3, R.gauss()]);
        const pts = [p];
        for (let s = 0; s < 50; s++) {
          d = v3.norm(v3.madd(d, R.dir(), 0.06));
          const q = v3.madd(p, d, 0.55);
          if (!inside(P, q[0], q[2]) || q[1] < -H + 0.3 || q[1] > -0.3 || inEll(Nc, q, 1) < 1.05) break;
          p = q; pts.push(p);
        }
        if (pts.length > 4) lines.polyline(pts, () => [0.3, 0.72, 1.0, 0.16], false);
      }
      this.wallPoint = [P[0][0], -3, P[0][1]];
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr, z = G.z;
      gfx.depth(false, false);
      gfx.blend('add');
      // An optical section, as in a confocal microscope: only structures near the
      // focal distance glow, so looking through the whole cell never washes out.
      const base = { u_minPx: 0.6 * dpr, u_maxPx: 6 * dpr, u_slabDepth: cam.d, u_slabWidth: cam.d * 0.75 };
      const inN = CA.smoothstep(-5.2, -6.2, z);
      gfx.drawPoints(this.mem, cam, Object.assign({ u_gain: op * 0.25 * (1 - 0.7 * inN) }, base));
      gfx.drawPoints(this.org, cam, Object.assign({ u_gain: op * 0.5 * (1 - 0.6 * inN) }, base));
      gfx.drawLines(this.lines, cam, { u_width: 1.1 * dpr, u_gain: op * 0.8 * (1 - 0.8 * inN) });
      gfx.drawPoints(this.nuc, cam, Object.assign({ u_gain: op * 0.16 * (1 - 0.35 * inN) }, base));
    }
  }

  CA.layers.push(new CellLayer());
})();
