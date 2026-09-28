/* The Milky Way in kilo-light-years, plus a reusable spiral-galaxy generator.
 *
 * Model: Hernquist bulge, a bar tilted 27° to the Sun–centre line, an
 * exponential disk modulated by four trailing log-spiral arms (pitch 12°),
 * star-forming complexes with H II regions, dust lanes on the arms' inner
 * edges, a faint halo, globular clusters and the Magellanic Clouds.
 * Frame: galactic centre at the origin, disk in the XZ plane, the Sun at
 * (-26.66, 0.068, 0); rotation runs toward +θ (clockwise seen from +Y).
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3, U, frames } = CA;
  const TAU = Math.PI * 2;
  const DEG = CA.DEG;

  class Sink {
    constructor(cap) { this.a = new Float32Array(cap * 8); this.n = 0; this.cap = cap; }
    push(x, y, z, r, g, b, s, w) {
      if (this.n >= this.cap) return;
      const o = this.n * 8, a = this.a;
      a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = r; a[o + 4] = g; a[o + 5] = b; a[o + 6] = w || 0; a[o + 7] = s;
      this.n++;
    }
    data() { return this.a.subarray(0, this.n * 8); }
    // Apply a transform (x,y,z) -> [x,y,z] and a size scale to every point.
    transform(fn, sizeScale) {
      const a = this.a;
      for (let i = 0; i < this.n; i++) {
        const o = i * 8;
        const p = fn(a[o], a[o + 1], a[o + 2]);
        a[o] = p[0]; a[o + 1] = p[1]; a[o + 2] = p[2];
        a[o + 7] *= sizeScale;
      }
    }
  }
  CA.Sink = Sink;

  // Angle of a trailing log-spiral arm at radius r.
  const armTheta = (a, r) => a.th180 - Math.log(r / a.r180) / Math.tan(a.pitch);
  CA.armTheta = armTheta;

  // Hernquist radius sample with scale a, truncated at rmax.
  function hernquist(R, a, rmax) {
    for (;;) {
      const s = Math.sqrt(R.next());
      const r = (a * s) / (1 - s + 1e-9);
      if (r < rmax) return r;
    }
  }

  /* Generic spiral generator. Units are kly; returns via sinks.
   * S: { seed, Rd, rMin, Rmax, h, arms:[{r180, th180, pitch, w, str, rStart, rEnd}], armBase,
   *      bulgeA, bulgeFlat, bulgeMax, bar:{len, w, angle}|null, ring:{r, w}|null,
   *      n:{bulge, bar, disk, complexes, diffuse, dust, halo},
   *      col:{bulge, disk, young, hii, dust, halo}, gain }
   */
  CA.genSpiral = function* (S, out) {
    const R = CA.makeRandom(S.seed);
    const N = CA.makeNoise(S.seed + 7);
    const arms = S.arms;
    const wsum = arms.reduce((s, a) => s + a.str, 0);
    const pickArm = () => {
      let u = R.next() * wsum;
      for (const a of arms) { u -= a.str; if (u <= 0) return a; }
      return arms[arms.length - 1];
    };
    const armDen = (r, th) => {
      let best = 0;
      for (const a of arms) {
        if (r < a.rStart * 0.85 || r > a.rEnd * 1.15) continue;
        if (a.thMin !== undefined) {
          const t = CA.wrapAngle(th - (a.thMin + a.thMax) / 2);
          if (Math.abs(t) > (a.thMax - a.thMin) / 2) continue;
        }
        const d = CA.wrapAngle(th - armTheta(a, r));
        const perp = Math.abs(d) * r * Math.sin(a.pitch);
        const v = a.str * Math.exp(-(perp * perp) / (a.w * a.w));
        if (v > best) best = v;
      }
      return best;
    };
    // A point on an arm (optionally restricted in angle) with in-plane normal.
    const onArm = (a) => {
      let r, th;
      if (a.thMin !== undefined) {
        th = a.thMin + R.next() * (a.thMax - a.thMin);
        r = a.r180 * Math.exp(-(th - a.th180) * Math.tan(a.pitch));
      } else {
        r = a.rStart + (a.rEnd - a.rStart) * Math.pow(R.next(), 1.25);
        th = armTheta(a, r);
      }
      const c = Math.cos(th), s = Math.sin(th);
      const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
      // e_r = (c, s), e_th = (-s, c); outward normal to the arm
      const nx = c * cp - s * sp, nz = s * cp + c * sp;
      return { x: r * c, z: r * s, nx, nz, r, th };
    };
    const C = S.col, g = S.gain || 1;
    const flare = (r) => 1 + Math.pow(r / (S.Rmax * 0.55), 2) * 0.6;

    // bulge
    for (let i = 0; i < S.n.bulge; i++) {
      const r = hernquist(R, S.bulgeA, S.bulgeMax);
      const d = R.dir();
      const k = 0.75 + 0.5 * R.next();
      const kb = k * (S.bulgeGain || 1);
      out.stars.push(d[0] * r, d[1] * r * S.bulgeFlat, d[2] * r, C.bulge[0] * kb * g, C.bulge[1] * kb * g, C.bulge[2] * kb * g, R.range(0.35, 0.8) * S.size);
    }
    yield;
    // bar
    if (S.bar) {
      const ca = Math.cos(S.bar.angle), sa = Math.sin(S.bar.angle);
      for (let i = 0; i < S.n.bar; i++) {
        let xp = R.gauss() * S.bar.len * 0.42;
        if (Math.abs(xp) > S.bar.len) xp *= 0.5;
        const zp = R.gauss() * S.bar.w * (1 - 0.5 * Math.abs(xp) / S.bar.len);
        const y = R.gauss() * S.bar.w * 0.55;
        const k = 0.7 + 0.5 * R.next();
        const kb = k * 0.9 * (S.bulgeGain || 1);
        out.stars.push(xp * ca - zp * sa, y, xp * sa + zp * ca, C.bulge[0] * kb * g, C.bulge[1] * kb * g, C.bulge[2] * kb * g, R.range(0.35, 0.75) * S.size);
      }
    }
    yield;
    // old disk, modulated by the arms
    let made = 0;
    const inner = S.bar ? S.bar.len : S.bulgeA * 3;
    while (made < S.n.disk) {
      const r = S.rMin + R.exp(S.Rd);
      if (r > S.Rmax) continue;
      if (R.next() > 0.25 + 0.75 * CA.smoothstep(inner * 0.35, inner * 1.05, r)) continue;
      const th = R.next() * TAU;
      const a = armDen(r, th);
      if (R.next() > S.armBase + (1 - S.armBase) * a) continue;
      const y = R.laplace(S.h * flare(r));
      const k = (0.55 + 0.9 * a) * (0.8 + 0.4 * R.next());
      const warm = CA.smoothstep(S.Rmax * 0.15, S.Rmax * 0.02, r) * 0.3;
      out.stars.push(r * Math.cos(th), y, r * Math.sin(th),
        (C.disk[0] + warm * 0.1) * k * g, (C.disk[1] - warm * 0.05) * k * g, (C.disk[2] - warm * 0.15) * k * g, R.range(0.5, 1.05) * S.size);
      made++;
      if (made % 40000 === 0) yield;
    }
    // star-forming complexes along the arms (and ring)
    for (let c = 0; c < S.n.complexes; c++) {
      let x, z, nx = 0, nz = 0;
      if (S.ring && R.next() < S.ring.frac) {
        const th = R.next() * TAU, r = S.ring.r + R.gauss() * S.ring.w;
        x = r * Math.cos(th); z = r * Math.sin(th);
      } else {
        const a = pickArm();
        const p = onArm(a);
        const off = R.gauss() * a.w * 0.4;
        x = p.x + p.nx * off; z = p.z + p.nz * off; nx = p.nx; nz = p.nz;
      }
      const y0 = R.gauss() * S.h * 0.25;
      const m = 6 + R.int(26);
      const sig = R.range(0.12, 0.45) * S.size;
      const hue = R.next();
      for (let k = 0; k < m; k++) {
        const b = R.range(0.5, 1.5) * g;
        const col = hue < 0.8 ? C.young : [0.9, 0.93, 1.0];
        out.young.push(x + R.gauss() * sig, y0 + R.gauss() * sig * 0.3, z + R.gauss() * sig, col[0] * b, col[1] * b, col[2] * b, R.range(0.08, 0.22) * S.size);
      }
      if (R.next() < 0.55) {
        const h = 1 + R.int(5);
        for (let k = 0; k < h; k++) {
          const b = R.range(0.8, 1.8) * g;
          out.hii.push(x + R.gauss() * sig * 0.6, y0, z + R.gauss() * sig * 0.6, C.hii[0] * b, C.hii[1] * b, C.hii[2] * b, R.range(0.06, 0.15) * S.size);
        }
      }
      if (c % 2000 === 1999) yield;
    }
    // diffuse young population
    for (let i = 0; i < S.n.diffuse; i++) {
      const a = pickArm();
      const p = onArm(a);
      const off = R.gauss() * a.w * 0.75;
      const b = R.range(0.2, 0.6) * g;
      out.young.push(p.x + p.nx * off + R.gauss() * 0.3 * S.size, R.laplace(S.h * 0.45), p.z + p.nz * off + R.gauss() * 0.3 * S.size,
        C.young[0] * b, C.young[1] * b, C.young[2] * b, R.range(0.2, 0.5) * S.size);
    }
    yield;
    // dust: lanes on the inner (concave) side of the arms, patchy
    made = 0;
    let guard = 0;
    while (made < S.n.dust && guard++ < S.n.dust * 6) {
      let x, z, r;
      if (S.ring && R.next() < S.ring.frac * 0.8) {
        const th = R.next() * TAU;
        r = S.ring.r + R.gauss() * S.ring.w * 0.8;
        x = r * Math.cos(th); z = r * Math.sin(th);
      } else if (R.next() < 0.78) {
        const a = pickArm();
        const p = onArm(a);
        const off = -a.w * 0.3 + R.gauss() * a.w * 0.3;
        x = p.x + p.nx * off; z = p.z + p.nz * off; r = p.r;
      } else {
        r = S.rMin + R.exp(S.Rd * 1.1);
        if (r > S.Rmax * 0.85 || r < inner * 0.6) continue;
        const th = R.next() * TAU;
        x = r * Math.cos(th); z = r * Math.sin(th);
      }
      const n = N.fbm(x * 0.22 / S.size, 0.3, z * 0.22 / S.size, 4);
      if (R.next() > CA.smoothstep(-0.25, 0.3, n)) continue;
      const k = R.range(0.5, 1.0);
      out.dust.push(x, R.gauss() * S.h * 0.18, z, C.dust[0] * k, C.dust[1] * k, C.dust[2] * k, R.range(0.7, 1.6) * S.size);
      made++;
    }
    yield;
    // stellar halo
    for (let i = 0; i < S.n.halo; i++) {
      const r = hernquist(R, S.Rd * 1.6, S.Rmax * 1.6);
      const d = R.dir();
      out.stars.push(d[0] * r, d[1] * r * 0.8, d[2] * r, C.halo[0] * g, C.halo[1] * g, C.halo[2] * g, R.range(1.2, 2.6) * S.size);
    }
  };

  // The Milky Way's arms.
  const MW_ARMS = [
    { name: 'Norma / Outer Arm', r180: 12.3, th180: Math.PI, pitch: 12 * DEG, w: 1.25, str: 0.75, rStart: 14.5, rEnd: 58 },
    { name: 'Scutum–Centaurus Arm', r180: 17.2, th180: Math.PI, pitch: 12 * DEG, w: 1.6, str: 1.0, rStart: 15.0, rEnd: 58 },
    { name: 'Sagittarius–Carina Arm', r180: 24.0, th180: Math.PI, pitch: 12 * DEG, w: 1.25, str: 0.75, rStart: 15.0, rEnd: 56 },
    { name: 'Perseus Arm', r180: 33.5, th180: Math.PI, pitch: 12 * DEG, w: 1.6, str: 1.0, rStart: 15.0, rEnd: 60 },
    { name: 'Orion Spur', r180: 26.66, th180: Math.PI, pitch: 20 * DEG, w: 0.8, str: 0.4, rStart: 19, rEnd: 34, thMin: 150 * DEG, thMax: 225 * DEG },
  ];

  class GalaxyLayer extends CA.Layer {
    constructor() {
      super({ name: 'galaxy', unit: U.KLY, fade: [19.55, 20.45, 23.2, 24.1], bound: 260 });
      this.tune = { stars: 0.08, young: 0.38, dust: 0.22, hii: 1.1 };
    }
    home() { return CA.SUN_IN_GAL_KLY; }

    *build(gfx) {
      const out = { stars: new Sink(330000), young: new Sink(110000), hii: new Sink(16000), dust: new Sink(52000) };
      const spec = {
        seed: 2024, size: 0.5, Rd: 9.5, rMin: 0.5, Rmax: 62, h: 0.32, arms: MW_ARMS, armBase: 0.5, bulgeGain: 0.22,
        bulgeA: 1.6, bulgeFlat: 0.62, bulgeMax: 14,
        bar: { len: 14, w: 3.2, angle: 207 * DEG },
        n: { bulge: 50000, bar: 36000, disk: 220000, complexes: 2600, diffuse: 26000, dust: 50000, halo: 5000 },
        col: {
          bulge: [1.0, 0.74, 0.46], disk: [1.0, 0.86, 0.7], young: [0.52, 0.68, 1.0],
          hii: [1.0, 0.3, 0.46], dust: [0.42, 0.52, 0.66], halo: [0.07, 0.065, 0.06],
        },
        gain: 1,
      };
      const gen = CA.genSpiral(spec, out);
      while (!gen.next().done) yield 0.5;

      // Magellanic Clouds: irregular, gas-rich, blue.
      const R = CA.makeRandom(99);
      const sun = CA.SUN_IN_GAL_KLY;
      const lmc = v3.add(sun, frames.lbd(280.5, -32.9, 163));
      const smc = v3.add(sun, frames.lbd(302.8, -44.3, 200));
      this.lmc = lmc; this.smc = smc;
      const blob = (c, n, sx, sy, sz, rot, col, size) => {
        const cr = Math.cos(rot), sr = Math.sin(rot);
        for (let i = 0; i < n; i++) {
          const x = R.gauss() * sx, y = R.gauss() * sy, z = R.gauss() * sz;
          const k = R.range(0.5, 1.2);
          out.young.push(c[0] + x * cr - z * sr, c[1] + y, c[2] + x * sr + z * cr, col[0] * k, col[1] * k, col[2] * k, size * R.range(0.6, 1.4));
        }
      };
      blob(lmc, 5000, 3.5, 0.9, 1.1, 0.6, [0.5, 0.47, 0.44], 0.2);
      blob(lmc, 5000, 5.5, 1.5, 4.5, 0.2, [0.34, 0.4, 0.56], 0.22);
      const tar = v3.add(lmc, [2.2, 0.3, -1.4]);
      for (let i = 0; i < 70; i++) out.hii.push(tar[0] + R.gauss() * 0.35, tar[1] + R.gauss() * 0.2, tar[2] + R.gauss() * 0.35, 1.0 * 1.6, 0.3 * 1.6, 0.46 * 1.6, 0.18);
      blob(smc, 4500, 3.0, 1.2, 1.6, 1.1, [0.36, 0.42, 0.56], 0.2);
      yield 0.9;

      this.stars = new CA.PointCloud(gfx, out.stars.data());
      this.young = new CA.PointCloud(gfx, out.young.data());
      this.hii = new CA.PointCloud(gfx, out.hii.data());
      this.dust = new CA.PointCloud(gfx, out.dust.data());

      // Globular clusters.
      const gc = [];
      for (let i = 0; i < 150; i++) {
        const r = i < 130 ? 2 + 45 * Math.pow(R.next(), 2.2) : R.range(50, 120);
        const d = R.dir();
        gc.push(d[0] * r, d[1] * r, d[2] * r, 1.0, 0.86, 0.66, 0, R.range(1.0, 1.6));
      }
      const oc = v3.add(sun, frames.lbd(309.1, 15.0, 17.1));
      gc.push(oc[0], oc[1], oc[2], 1.0, 0.88, 0.7, 0, 1.9);
      this.globulars = new CA.PointCloud(gfx, new Float32Array(gc));

      // Labels.
      const at = (a, r) => { const th = armTheta(a, r); return [r * Math.cos(th), 0, r * Math.sin(th)]; };
      const F = [19.75, 20.2, 21.9, 22.4];
      this.label('Perseus Arm', at(MW_ARMS[3], 37.5), F, { pri: 4, cls: 'region' });
      this.label('Sagittarius–Carina Arm', at(MW_ARMS[2], 21.5), F, { pri: 4, cls: 'region' });
      this.label('Scutum–Centaurus Arm', at(MW_ARMS[1], 24), F, { pri: 4, cls: 'region' });
      this.label('Outer Arm', at(MW_ARMS[0], 50), F, { pri: 3, cls: 'region' });
      this.label('Norma Arm', at(MW_ARMS[0], 17.5), [20.2, 20.6, 21.9, 22.4], { pri: 3, cls: 'region' });
      this.label('Orion Arm', [-28.6, 0, -3.2], [19.35, 19.75, 21.2, 21.7], { pri: 5, cls: 'region' });
      this.label('Galactic Center', [0, 0, 0], [19.6, 20.1, 22.2, 22.7], { pri: 6, sub: 'Sagittarius A*, a black hole of 4 million Suns' });
      this.label('You are here', sun, [19.35, 19.8, 23.1, 23.6], { pri: 10, cls: 'you', sub: 'the Sun, 26,000 ly from the center' });
      this.label('Large Magellanic Cloud', lmc, [21.2, 21.6, 23.1, 23.6], { pri: 5, sub: '163,000 ly' });
      this.label('Small Magellanic Cloud', smc, [21.3, 21.7, 23.0, 23.5], { pri: 4, sub: '200,000 ly' });
      this.label('Omega Centauri', oc, [20.3, 20.7, 21.4, 21.8], { pri: 2, sub: 'globular cluster · 10 million stars' });
      this.label('Milky Way', [0, 0, 0], [22.3, 22.7, 23.3, 23.8], { pri: 9, cls: 'you', sub: 'you are here', r: 50 });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr;
      gfx.depth(false, false);
      gfx.blend('add');
      const base = { u_minPx: 0.7 * dpr, u_maxPx: 12 * dpr };
      const T = this.tune;
      gfx.drawPoints(this.stars, cam, Object.assign({ u_gain: T.stars * op }, base));
      gfx.drawPoints(this.young, cam, { u_gain: T.young * op, u_minPx: 0.7 * dpr, u_maxPx: 6 * dpr });
      gfx.blend('absorb');
      gfx.drawPoints(this.dust, cam, Object.assign({ u_gain: T.dust * op, u_mode: 1 }, base));
      gfx.blend('add');
      gfx.drawPoints(this.hii, cam, { u_gain: T.hii * op, u_minPx: 0.7 * dpr, u_maxPx: 5 * dpr });
      const gcF = CA.fadeIn([19.8, 20.3, 22.6, 23.2], G.z);
      if (gcF > 0) gfx.drawPoints(this.globulars, cam, { u_gain: 1.6 * op * gcF, u_constFlux: 2, u_sizeMul: dpr });
    }
  }

  CA.layers.push(new GalaxyLayer());
})();
