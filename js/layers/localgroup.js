/* Local Group in millions of light-years: Andromeda and Triangulum as full
 * particle galaxies oriented as we see them, plus dwarf satellites.
 * Origin: centre of the Milky Way.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3, U, frames } = CA;
  const DEG = CA.DEG;

  // Orientation of a galaxy disk from its sky position, inclination and position angle.
  function diskBasis(raH, decD, incl, pa) {
    const a = raH * 15 * DEG, d = decD * DEG;
    const los = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
    const north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
    const east = [-Math.sin(a), Math.cos(a), 0];
    const P = pa * DEG, i = incl * DEG;
    const major = v3.add(v3.scale(north, Math.cos(P)), v3.scale(east, Math.sin(P)));
    const minor = v3.add(v3.scale(north, -Math.sin(P)), v3.scale(east, Math.cos(P)));
    const normal = v3.norm(v3.add(v3.scale(los, Math.cos(i)), v3.scale(minor, Math.sin(i))));
    const M = frames.eqToScene(major), N = frames.eqToScene(normal);
    const S = v3.cross(M, N);
    return { major: M, normal: N, second: S, north: frames.eqToScene(north), los: frames.eqToScene(los) };
  }

  class LocalGroupLayer extends CA.Layer {
    constructor() {
      super({ name: 'localgroup', unit: U.MLY, fade: [21.3, 22.05, 24.0, 24.75], bound: 14 });
    }
    home() { return v3.scale(CA.SUN_IN_GAL_KLY, 0.001); }

    *buildGalaxy(spec, center, B) {
      const out = { stars: new CA.Sink(spec.cap), young: new CA.Sink(60000), hii: new CA.Sink(12000), dust: new CA.Sink(30000) };
      const gen = CA.genSpiral(spec, out);
      while (!gen.next().done) yield 0.4;
      const tf = (x, y, z) => [
        center[0] + (B.major[0] * x + B.normal[0] * y + B.second[0] * z) * 0.001,
        center[1] + (B.major[1] * x + B.normal[1] * y + B.second[1] * z) * 0.001,
        center[2] + (B.major[2] * x + B.normal[2] * y + B.second[2] * z) * 0.001,
      ];
      const res = {};
      for (const k of Object.keys(out)) {
        out[k].transform(tf, 0.001);
        res[k] = out[k].data();
      }
      return res;
    }

    *build(gfx) {
      const sun = this.home();
      const R = CA.makeRandom(31);

      // Andromeda (M31)
      const m31 = CA.M31;
      const c31 = v3.add(sun, frames.lbd(m31.l, m31.b, m31.d));
      const B31 = diskBasis(m31.raH, m31.dec, m31.incl, m31.pa);
      const p9 = 9 * DEG;
      const s31 = {
        seed: 31, size: 1.7, Rd: 17, rMin: 1, Rmax: 100, h: 0.6, armBase: 0.55,
        arms: [
          { r180: 30, th180: Math.PI, pitch: p9, w: 3.2, str: 0.8, rStart: 18, rEnd: 85 },
          { r180: 30 * Math.exp(Math.PI * Math.tan(p9)), th180: Math.PI, pitch: p9, w: 3.2, str: 0.8, rStart: 18, rEnd: 85 },
        ],
        ring: { r: 33, w: 3.2, frac: 0.55 },
        bulgeA: 3.6, bulgeFlat: 0.72, bulgeMax: 30, bar: null, bulgeGain: 0.5,
        n: { bulge: 40000, bar: 0, disk: 70000, complexes: 1200, diffuse: 9000, dust: 24000, halo: 6000 },
        col: { bulge: [1.0, 0.72, 0.45], disk: [1.0, 0.84, 0.68], young: [0.58, 0.72, 1.0], hii: [1.0, 0.32, 0.48], dust: [0.42, 0.52, 0.66], halo: [0.07, 0.065, 0.06] },
        gain: 1, cap: 130000,
      };
      const g31 = yield* this.buildGalaxy(s31, c31, B31);
      // Triangulum (M33): small, flocculent, gas-rich.
      const m33 = CA.M33;
      const c33 = v3.add(sun, frames.lbd(m33.l, m33.b, m33.d));
      const B33 = diskBasis(m33.raH, m33.dec, m33.incl, m33.pa);
      const p28 = 28 * DEG;
      const arms33 = [];
      for (let i = 0; i < 6; i++) {
        arms33.push({ r180: 6 + i * 2.2, th180: Math.PI + i * 1.1, pitch: p28, w: 1.1, str: i < 2 ? 1 : 0.5, rStart: 2, rEnd: i < 2 ? 30 : 18 });
      }
      const s33 = {
        seed: 33, size: 0.9, Rd: 6, rMin: 0.3, Rmax: 34, h: 0.25, armBase: 0.45, arms: arms33, ring: null,
        bulgeA: 0.6, bulgeFlat: 0.8, bulgeMax: 4, bar: null,
        n: { bulge: 3000, bar: 0, disk: 26000, complexes: 900, diffuse: 6000, dust: 8000, halo: 1000 },
        col: { bulge: [1.0, 0.8, 0.6], disk: [0.95, 0.88, 0.8], young: [0.55, 0.7, 1.0], hii: [1.0, 0.3, 0.5], dust: [0.42, 0.52, 0.66], halo: [0.07, 0.065, 0.06] },
        gain: 1, cap: 40000,
      };
      const g33 = yield* this.buildGalaxy(s33, c33, B33);

      const cat = (a, b) => { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
      this.stars = new CA.PointCloud(gfx, cat(g31.stars, g33.stars));
      this.young = new CA.PointCloud(gfx, cat(g31.young, g33.young));
      this.hii = new CA.PointCloud(gfx, cat(g31.hii, g33.hii));
      this.dust = new CA.PointCloud(gfx, cat(g31.dust, g33.dust));
      yield 0.8;

      // Dwarf galaxies: small star swarms.
      const dw = [];
      const swarm = (c, sizeKly, kind, n) => {
        const s = sizeKly * 0.001 * 0.35;
        const col = kind === 'dirr' ? [0.7, 0.8, 1.0] : kind === 'de' ? [1.0, 0.82, 0.62] : [1.0, 0.88, 0.72];
        const b = kind === 'de' ? 1.4 : 0.8;
        for (let i = 0; i < n; i++) {
          const k = R.range(0.5, 1.2) * b;
          dw.push(c[0] + R.gauss() * s, c[1] + R.gauss() * s * 0.8, c[2] + R.gauss() * s, col[0] * k, col[1] * k, col[2] * k, 0, s * 0.6);
        }
      };
      for (const g of CA.LOCAL_GROUP) {
        const p = v3.add(sun, frames.lbd(g[1], g[2], g[3]));
        swarm(p, g[4], g[5], g[5] === 'dirr' ? 500 : 300);
        const zc = Math.log10(g[3] * U.MLY);
        this.label(g[0], p, [Math.max(21.6, zc - 0.5), Math.max(21.9, zc - 0.2), 23.4, 23.9], { pri: g[6] + 1, sub: g[3] < 1 ? CA.fmt.int(g[3] * 1000) + ',000 ly' : CA.fmt.sig(g[3], 2) + ' million ly' });
      }
      // Andromeda's companions.
      const off = (dn, dl, de) => v3.add(c31, v3.add(v3.add(v3.scale(B31.north, dn), v3.scale(B31.los, dl)), v3.scale(v3.cross(B31.los, B31.north), de)));
      const m32 = off(-0.0085, 0.004, 0.002);
      const m110 = off(0.03, -0.01, -0.02);
      const n147 = off(0.1, 0.05, -0.02);
      const n185 = off(0.08, -0.05, 0.05);
      swarm(m32, 8, 'de', 700);
      swarm(m110, 17, 'de', 700);
      swarm(n147, 10, 'dsph', 350);
      swarm(n185, 10, 'dsph', 350);
      for (let i = 0; i < 22; i++) {
        const d = R.dir();
        const r = R.range(0.05, 0.35);
        swarm(v3.madd(c31, d, r), R.range(2, 5), 'dsph', 160);
      }
      for (let i = 0; i < 6; i++) {
        const d = R.dir();
        swarm(v3.madd(c33, d, R.range(0.03, 0.15)), R.range(1.5, 3), 'dsph', 100);
      }
      this.dwarfs = new CA.PointCloud(gfx, new Float32Array(dw));

      this.label('Andromeda Galaxy', c31, [21.7, 22.05, 24.0, 24.5], { pri: 9, sub: '2.5 million ly · about a trillion stars', r: 0.11 });
      this.label('Triangulum Galaxy', c33, [21.9, 22.3, 23.8, 24.3], { pri: 7, sub: '2.7 million ly', r: 0.03 });
      this.label('Local Group', v3.lerp(sun, c31, 0.45), [23.35, 23.7, 24.2, 24.6], { pri: 8, cls: 'region', sub: 'about 10 million ly across' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr;
      gfx.depth(false, false);
      gfx.blend('add');
      const base = { u_minPx: 0.7 * dpr, u_maxPx: 12 * dpr };
      gfx.drawPoints(this.stars, cam, Object.assign({ u_gain: 0.34 * op }, base));
      gfx.drawPoints(this.young, cam, Object.assign({ u_gain: 0.8 * op }, base));
      gfx.blend('absorb');
      gfx.drawPoints(this.dust, cam, Object.assign({ u_gain: 0.22 * op, u_mode: 1 }, base));
      gfx.blend('add');
      gfx.drawPoints(this.hii, cam, Object.assign({ u_gain: 1.6 * op }, base));
      gfx.drawPoints(this.dwarfs, cam, Object.assign({ u_gain: 1.8 * op }, base));
    }
  }

  CA.layers.push(new LocalGroupLayer());
})();
