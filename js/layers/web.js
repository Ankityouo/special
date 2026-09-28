/* Cosmic web in billions of light-years, plus the Voronoi-foam generator it
 * shares with the Laniakea and observable-universe layers.
 *
 * Voids are the cells of a Voronoi tessellation seeded on a jittered grid.
 * Galaxies are projected onto cell walls (faint sheets), wall intersections
 * (filaments) and cell vertices (clusters), which is how large-scale
 * structure actually looks in surveys and simulations.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { U } = CA;

  class Foam {
    constructor(radius, cell, seed, jitter) {
      this.cell = cell;
      this.g = Math.ceil((2 * radius) / cell) + 2;
      this.o = -this.g * cell * 0.5;
      const R = CA.makeRandom(seed);
      const g = this.g, n = g * g * g;
      this.s = new Float64Array(n * 3);
      const j = jitter === undefined ? 0.9 : jitter;
      for (let i = 0; i < g; i++) for (let k = 0; k < g; k++) for (let l = 0; l < g; l++) {
        const id = ((i * g + k) * g + l) * 3;
        this.s[id] = this.o + (i + 0.5 + (R.next() - 0.5) * j) * cell;
        this.s[id + 1] = this.o + (k + 0.5 + (R.next() - 0.5) * j) * cell;
        this.s[id + 2] = this.o + (l + 0.5 + (R.next() - 0.5) * j) * cell;
      }
      this.best = new Int32Array(4);
      this.bestD = new Float64Array(4);
    }
    // Fills this.best / this.bestD with the 4 nearest seeds (sorted).
    nearest(x, y, z) {
      const g = this.g, c = this.cell, s = this.s, B = this.best, D = this.bestD;
      D.fill(Infinity); B.fill(-1);
      const ci = Math.floor((x - this.o) / c), ck = Math.floor((y - this.o) / c), cl = Math.floor((z - this.o) / c);
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (i < 0 || i >= g) continue;
        for (let k = ck - 1; k <= ck + 1; k++) {
          if (k < 0 || k >= g) continue;
          for (let l = cl - 1; l <= cl + 1; l++) {
            if (l < 0 || l >= g) continue;
            const id = ((i * g + k) * g + l) * 3;
            const dx = s[id] - x, dy = s[id + 1] - y, dz = s[id + 2] - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < D[3]) {
              let p = 3;
              while (p > 0 && D[p - 1] > d) { D[p] = D[p - 1]; B[p] = B[p - 1]; p--; }
              D[p] = d; B[p] = id;
            }
          }
        }
      }
    }
    seed(id) { return [this.s[id], this.s[id + 1], this.s[id + 2]]; }
    // Project p onto the bisector plane between seeds a and b.
    static toPlane(p, a, b) {
      const nx = b[0] - a[0], ny = b[1] - a[1], nz = b[2] - a[2];
      const l2 = nx * nx + ny * ny + nz * nz;
      const mx = (a[0] + b[0]) * 0.5, my = (a[1] + b[1]) * 0.5, mz = (a[2] + b[2]) * 0.5;
      const t = ((p[0] - mx) * nx + (p[1] - my) * ny + (p[2] - mz) * nz) / l2;
      return [p[0] - nx * t, p[1] - ny * t, p[2] - nz * t];
    }
    // Point equidistant from four seeds (a Voronoi vertex), or null.
    static vertex(a, b, c, d) {
      const r = (p, q) => [2 * (q[0] - p[0]), 2 * (q[1] - p[1]), 2 * (q[2] - p[2]), q[0] * q[0] + q[1] * q[1] + q[2] * q[2] - p[0] * p[0] - p[1] * p[1] - p[2] * p[2]];
      const A = r(a, b), Bv = r(a, c), Cv = r(a, d);
      const det = A[0] * (Bv[1] * Cv[2] - Bv[2] * Cv[1]) - A[1] * (Bv[0] * Cv[2] - Bv[2] * Cv[0]) + A[2] * (Bv[0] * Cv[1] - Bv[1] * Cv[0]);
      if (Math.abs(det) < 1e-12) return null;
      const dx = A[3] * (Bv[1] * Cv[2] - Bv[2] * Cv[1]) - A[1] * (Bv[3] * Cv[2] - Bv[2] * Cv[3]) + A[2] * (Bv[3] * Cv[1] - Bv[1] * Cv[3]);
      const dy = A[0] * (Bv[3] * Cv[2] - Bv[2] * Cv[3]) - A[3] * (Bv[0] * Cv[2] - Bv[2] * Cv[0]) + A[2] * (Bv[0] * Cv[3] - Bv[3] * Cv[0]);
      const dz = A[0] * (Bv[1] * Cv[3] - Bv[3] * Cv[1]) - A[1] * (Bv[0] * Cv[3] - Bv[3] * Cv[0]) + A[3] * (Bv[0] * Cv[1] - Bv[1] * Cv[0]);
      return [dx / det, dy / det, dz / det];
    }
  }
  CA.Foam = Foam;

  /* Sample n galaxies on a foam.
   * o: { n, radial(R) -> radius, mix: [node, fil, wall], jit: [node, fil, wall],
   *      col(kind, p, R) -> [r,g,b], size: [node, fil, wall], every: yield interval }
   */
  CA.sampleFoam = function* (foam, o, sink, R) {
    const mix = o.mix, jit = o.jit;
    let made = 0, tries = 0;
    const tol = foam.cell * 0.08;
    while (made < o.n && tries < o.n * 4) {
      tries++;
      const r = o.radial(R);
      const d = R.dir();
      let p = [d[0] * r, d[1] * r, d[2] * r];
      foam.nearest(p[0], p[1], p[2]);
      if (foam.best[3] < 0) continue;
      const s1 = foam.seed(foam.best[0]), s2 = foam.seed(foam.best[1]), s3 = foam.seed(foam.best[2]), s4 = foam.seed(foam.best[3]);
      const u = R.next();
      let kind, q;
      if (u < mix[0]) {
        kind = 0;
        q = Foam.vertex(s1, s2, s3, s4);
        if (!q) continue;
      } else if (u < mix[0] + mix[1]) {
        kind = 1;
        q = p;
        for (let it = 0; it < 6; it++) { q = Foam.toPlane(q, s1, s2); q = Foam.toPlane(q, s1, s3); }
      } else {
        kind = 2;
        q = Foam.toPlane(p, s1, s2);
      }
      // Reject projections that left their cells (spurious structure).
      foam.nearest(q[0], q[1], q[2]);
      const need = kind === 0 ? 3 : kind === 1 ? 2 : 1;
      const d0 = Math.sqrt(foam.bestD[0]);
      if (Math.sqrt(foam.bestD[need]) - d0 > tol) continue;
      const j = jit[kind];
      q = [q[0] + R.gauss() * j, q[1] + R.gauss() * j, q[2] + R.gauss() * j];
      const c = o.col(kind, q, R);
      sink.push(q[0], q[1], q[2], c[0], c[1], c[2], o.size[kind] * R.range(0.7, 1.3));
      made++;
      if (made % (o.every || 6000) === 0) yield made / o.n;
    }
  };

  class WebLayer extends CA.Layer {
    constructor() {
      super({ name: 'web', unit: U.GLY, fade: [25.1, 25.8, 26.8, 27.6], bound: 6 });
      this.tune = { gain: 0.35, slab: 0.05, slabFar: 3 };
    }
    home() { return [0, 0, 0]; }

    *build(gfx) {
      const R = CA.makeRandom(1e5 + 7);
      const foam = new Foam(4.4, 0.3, 777, 0.95);
      yield 0.1;
      const colFor = (dens) => (kind, q) => {
        const r = Math.hypot(q[0], q[1], q[2]);
        const far = CA.smoothstep(1.5, 4.0, r);
        let c;
        if (kind === 0) c = [1.0, 0.8, 0.55];
        else if (kind === 1) c = [0.72, 0.7, 1.0];
        else c = [0.38, 0.44, 1.0];
        const b = (kind === 0 ? 3.2 : kind === 1 ? 0.8 : 0.07) * dens;
        return [c[0] * b * (1 - 0.35 * far), c[1] * b * (1 - 0.15 * far), c[2] * b];
      };
      const bulk = new CA.Sink(300000);
      yield* CA.sampleFoam(foam, {
        n: 300000, radial: (R) => 4.2 * Math.cbrt(R.next()), mix: [0.16, 0.5, 0.34], jit: [0.01, 0.006, 0.008],
        col: colFor(1), size: [0.012, 0.012, 0.016],
      }, bulk, R);
      const local = new CA.Sink(160000);
      yield* CA.sampleFoam(foam, {
        n: 160000, radial: (R) => 1.1 * Math.cbrt(R.next()), mix: [0.14, 0.5, 0.36], jit: [0.006, 0.004, 0.006],
        col: colFor(0.12), size: [0.007, 0.007, 0.01],
      }, local, R);
      this.bulk = new CA.PointCloud(gfx, bulk.data());
      this.local = new CA.PointCloud(gfx, local.data());
      this.label('You are here', [0, 0, 0], [25.2, 25.6, 26.9, 27.3], { pri: 10, cls: 'you', sub: 'somewhere in one filament' });
      this.label('Void', [0.55, 0.35, -0.4], [25.1, 25.5, 26.0, 26.4], { pri: 2, cls: 'region', sub: 'nearly empty' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr;
      gfx.depth(false, false);
      gfx.blend('add');
      const base = { u_minPx: 0.7 * dpr, u_maxPx: 9 * dpr };
      // Focus on a thick slice around the focal distance; it widens as we pull back.
      const T = this.tune;
      const slab = { u_slabDepth: cam.d, u_slabWidth: cam.d * CA.lerp(T.slab, T.slabFar, CA.smoothstep(26.2, 27.1, G.z)) };
      gfx.drawPoints(this.bulk, cam, Object.assign({ u_gain: T.gain * op }, base, slab));
      gfx.drawPoints(this.local, cam, Object.assign({ u_gain: T.gain * op }, base, slab));
    }
  }

  CA.layers.push(new WebLayer());
})();
