/* Laniakea in millions of light-years. Real clusters and superclusters are
 * placed at their true directions and distances; galaxies fill filaments
 * between them and a foam beyond. Animated flow lines trace peculiar
 * velocities: those that drain into the Great Attractor define Laniakea.
 * Origin: centre of the Milky Way.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3, U, frames } = CA;

  const EDGES = [
    ['LG', 'Virgo Cluster'], ['LG', 'M81 Group'], ['LG', 'Centaurus A Group'], ['LG', 'Sculptor Group'],
    ['Virgo Cluster', 'Leo II Groups'], ['Virgo Cluster', 'Centaurus Cluster'], ['Virgo Cluster', 'Coma Cluster'],
    ['Centaurus Cluster', 'Norma Cluster'], ['Hydra Cluster', 'Centaurus Cluster'], ['Antlia Cluster', 'Hydra Cluster'],
    ['Norma Cluster', 'Pavo-Indus Supercluster'], ['Pavo-Indus Supercluster', 'Fornax Cluster'], ['Fornax Cluster', 'Eridanus Group'],
    ['Eridanus Group', 'LG'], ['Norma Cluster', 'Shapley Supercluster'], ['Centaurus Cluster', 'Shapley Supercluster'],
    ['Perseus Cluster', 'Perseus–Pisces Supercluster'], ['Coma Cluster', 'Hercules Supercluster'], ['Centaurus A Group', 'Centaurus Cluster'],
    ['Leo II Groups', 'Hydra Cluster'], ['Sculptor Group', 'Fornax Cluster'], ['Antlia Cluster', 'Virgo Cluster'],
    ['Perseus–Pisces Supercluster', 'LG'],
  ];
  // [cluster name, relative mass, softening Mly, part of Laniakea?]
  const ATTRACTORS = [
    ['Norma Cluster', 14, 45, true], ['Centaurus Cluster', 3, 18, true], ['Virgo Cluster', 2.2, 10, true],
    ['Pavo-Indus Supercluster', 2.5, 25, true], ['Hydra Cluster', 1.5, 15, true],
    ['Shapley Supercluster', 34, 90, false], ['Perseus–Pisces Supercluster', 11, 45, false],
    ['Coma Cluster', 5, 35, false], ['Hercules Supercluster', 6, 45, false],
  ];

  class LaniakeaLayer extends CA.Layer {
    constructor() {
      super({ name: 'laniakea', unit: U.MLY, fade: [22.35, 23.35, 25.25, 26.05], bound: 900 });
    }
    home() { return v3.scale(CA.SUN_IN_GAL_KLY, 0.001); }

    *build(gfx) {
      const R = CA.makeRandom(1310);
      const sink = new CA.Sink(90000);
      const nodes = {};
      for (const c of CA.CLUSTERS) nodes[c[0]] = { name: c[0], p: frames.lbd(c[1], c[2], c[3]), w: c[4], r: c[5], lan: c[6], pri: c[7], d: c[3] };
      nodes.LG = { name: 'LG', p: [0, 0, 0], w: 0, r: 1, lan: true };
      const spiral = [0.72, 0.8, 1.0], elliptical = [1.0, 0.84, 0.66];
      const put = (p, col, b, s) => {
        if (v3.len(p) < 6) return;          // the Local Group layer draws our neighborhood
        sink.push(p[0], p[1], p[2], col[0] * b, col[1] * b, col[2] * b, s);
      };
      // Clusters: dense cores of mostly elliptical galaxies.
      for (const k in nodes) {
        const n = nodes[k];
        if (!n.w) continue;
        const count = Math.round(n.w * 1.5);
        const sup = n.name.indexOf('Supercluster') >= 0;
        const ax = R.dir();
        for (let i = 0; i < count; i++) {
          const d = R.dir();
          let rr = n.r * Math.pow(R.next(), sup ? 0.9 : 1.7);
          let q = v3.scale(d, rr);
          if (sup) q = v3.madd(q, ax, v3.dot(q, ax) * 1.6);
          const ell = R.next() < (sup ? 0.35 : 0.7);
          put(v3.add(n.p, q), ell ? elliptical : spiral, R.range(0.5, 1.1), R.range(0.7, 1.0));
        }
      }
      yield 0.15;
      // Filaments between nodes (gently curved).
      for (const [a, b] of EDGES) {
        const A = nodes[a].p, B = nodes[b].p;
        const L = v3.dist(A, B);
        const mid = v3.lerp(A, B, 0.5);
        const ctrl = v3.madd(mid, R.dir(), L * 0.14);
        const count = Math.round(L * 7);
        const sig = 2.2 + L * 0.018;
        for (let i = 0; i < count; i++) {
          const t = R.next();
          const p1 = v3.lerp(A, ctrl, t), p2 = v3.lerp(ctrl, B, t);
          const p = v3.lerp(p1, p2, t);
          put([p[0] + R.gauss() * sig, p[1] + R.gauss() * sig, p[2] + R.gauss() * sig], spiral, R.range(0.35, 0.9), R.range(0.6, 0.95));
        }
      }
      yield 0.3;
      // Local Sheet and the flattened Local (Virgo) Supercluster.
      const N = frames.NSGP;
      const X = v3.norm(v3.cross(N, [0, 1, 0]));
      const Y = v3.cross(N, X);
      for (let i = 0; i < 1800; i++) {
        const r = 25 * Math.sqrt(R.next()), a = R.next() * Math.PI * 2;
        const p = v3.add(v3.add(v3.scale(X, r * Math.cos(a)), v3.scale(Y, r * Math.sin(a))), v3.scale(N, R.gauss() * 1.3));
        put(p, spiral, R.range(0.35, 0.8), 0.7);
      }
      const vc = v3.scale(nodes['Virgo Cluster'].p, 0.55);
      for (let i = 0; i < 6500; i++) {
        let p = v3.add(v3.add(v3.scale(X, R.gauss() * 26), v3.scale(Y, R.gauss() * 26)), v3.scale(N, R.gauss() * 6.5));
        p = v3.add(vc, p);
        put(p, R.next() < 0.3 ? elliptical : spiral, R.range(0.3, 0.75), 0.7);
      }
      yield 0.4;
      // Beyond: a foam of filaments and voids out to ~750 Mly.
      const foam = new CA.Foam(760, 70, 4040, 0.95);
      yield* CA.sampleFoam(foam, {
        n: 30000, radial: (R) => 740 * Math.cbrt(R.next()), mix: [0.14, 0.52, 0.34], jit: [3.0, 2.2, 3.0],
        col: (kind) => { const b = kind === 0 ? 0.9 : kind === 1 ? 0.5 : 0.25; return [spiral[0] * b, spiral[1] * b, spiral[2] * b]; },
        size: [0.8, 0.7, 0.65],
      }, { push: (x, y, z, r, g, b, s) => put([x, y, z], [r, g, b], 1, s) }, R);
      this.galaxies = new CA.PointCloud(gfx, sink.data());
      yield 0.7;

      // Peculiar-velocity flow lines.
      const att = ATTRACTORS.map((a) => ({ p: nodes[a[0]].p, m: a[1], s: a[2], lan: a[3] }));
      const vel = (p) => {
        let vx = 0, vy = 0, vz = 0;
        for (const a of att) {
          const dx = a.p[0] - p[0], dy = a.p[1] - p[1], dz = a.p[2] - p[2];
          const d2 = dx * dx + dy * dy + dz * dz + a.s * a.s;
          const k = a.m / (d2 * Math.sqrt(d2));
          vx += dx * k; vy += dy * k; vz += dz * k;
        }
        const l = Math.hypot(vx, vy, vz) || 1;
        return [vx / l, vy / l, vz / l];
      };
      const lan = new CA.LineBuilder(), other = new CA.LineBuilder();
      const data = sink.data();
      const total = data.length / 8;
      let lines = 0;
      for (let tries = 0; tries < 6000 && lines < 1500; tries++) {
        const i = R.int(total);
        let p = [data[i * 8], data[i * 8 + 1], data[i * 8 + 2]];
        if (v3.len(p) > 620) continue;
        const pts = [p];
        let end = null;
        for (let s = 0; s < 110; s++) {
          const v = vel(p);
          p = v3.madd(p, v, 2.6);
          pts.push(p);
          for (const a of att) if (v3.dist(p, a.p) < a.s * 0.55) { end = a; break; }
          if (end) break;
        }
        if (!end || pts.length < 10) continue;
        const b = end.lan ? lan : other;
        const col = end.lan ? [0.7, 0.86, 1.0] : [1.0, 0.64, 0.36];
        const peak = end.lan ? 0.5 : 0.28;
        b.polyline(pts, (j, n) => [col[0], col[1], col[2], peak * Math.pow(j / (n - 1), 0.8)], false, 1);
        lines++;
      }
      this.flowLan = lan.build(gfx);
      this.flowOther = other.build(gfx);

      // Labels.
      for (const k in nodes) {
        const n = nodes[k];
        if (!n.w) continue;
        const zc = Math.log10(n.d * U.MLY);
        const fade = [Math.max(23.1, zc - 0.55), Math.max(23.4, zc - 0.25), 25.4, 25.9];
        this.label(n.name, n.p, fade, { pri: n.pri + 2, sub: CA.fmt.int(n.d) + ' million ly' });
      }
      const ga = frames.lbd(CA.GREAT_ATTRACTOR.l, CA.GREAT_ATTRACTOR.b, CA.GREAT_ATTRACTOR.d);
      this.label('Great Attractor', ga, [24.0, 24.35, 25.3, 25.8], { pri: 8, cls: 'region', sub: 'where our flows converge' });
      this.label('Virgo Supercluster', vc, [23.55, 23.8, 24.35, 24.7], { pri: 8, cls: 'region' });
      this.label('Laniakea', v3.scale(CA.anchors.lanFromGC, 1 / U.MLY), [24.35, 24.65, 25.4, 25.85], { pri: 9, cls: 'region', sub: 'about 520 million ly across' });
      this.label('Milky Way', [0, 0, 0], [23.2, 23.5, 25.6, 26.05], { pri: 10, cls: 'you', sub: 'you are here' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr, z = G.z;
      gfx.depth(false, false);
      gfx.blend('add');
      const fl = CA.fadeIn([23.9, 24.35, 25.3, 25.9], z);
      if (fl > 0) {
        const o = { u_width: 1.1 * dpr, u_dash: 0.045, u_dashSpeed: 0.35 };
        gfx.drawLines(this.flowOther, cam, Object.assign({ u_gain: op * fl * 0.8 }, o));
        gfx.drawLines(this.flowLan, cam, Object.assign({ u_gain: op * fl }, o));
      }
      gfx.drawPoints(this.galaxies, cam, { u_gain: op * 0.9, u_constFlux: 2, u_sizeMul: dpr });
    }
  }

  CA.layers.push(new LaniakeaLayer());
})();
