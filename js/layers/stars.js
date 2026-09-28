/* Stellar neighborhood in light-years: real named stars in 3D, a procedural
 * field following the galactic disk, nebulae, clusters and distance rings.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3, U, frames } = CA;
  const LOG10_LY_M = Math.log10(U.LY);

  function logLum(vmag, distLy) {
    const dpc = distLy / 3.26156;
    const M = vmag - 5 * Math.log10(dpc) + 5;
    return -0.4 * (M - 4.83);
  }

  class StarsLayer extends CA.Layer {
    constructor() {
      super({ name: 'stars', unit: U.LY, fade: [15.35, 16.25, 20.3, 21.1], bound: 9000 });
      this.tune = { field: 0.6, named: 1.0, cluster: 1.1, neb: 0.5, glow: 1.0, ref: 0.15 };
    }

    *build(gfx) {
      const R = CA.makeRandom(61);
      const named = [];
      const seen = new Set();
      const add = (s, near) => {
        if (seen.has(s[0])) return;
        seen.add(s[0]);
        const p = frames.radec(s[1], s[2], s[4]);
        const T = CA.spectralTemp(s[5]);
        let c = CA.kelvinToRGB(T);
        let L = logLum(s[3], s[4]);
        if (s[5][0] === 'L') { L = -4.2; c = [1.0, 0.35, 0.2]; }
        L = Math.max(L, -4.0);
        named.push(p[0], p[1], p[2], c[0], c[1], c[2], L, 0.25);
        const zc = LOG10_LY_M + Math.log10(Math.max(s[4], 3));
        const note = near ? s[6] : '';
        const pri = near ? (note ? 4 : 2) : s[6];
        const sub = note || (s[4] < 100 ? CA.fmt.sig(s[4], 2) + ' ly' : CA.fmt.int(s[4]) + ' ly');
        const late = near ? 0.75 : 0.35;
        this.label(s[0], p, [zc - 1.0, zc - 0.6, zc + late, zc + late + 0.4], { pri: pri + 1, sub, cls: 'star' });
        if (s[4] < 26) this.drops.push(p);
      };
      this.drops = [];
      // The Sun itself.
      named.push(0, 0, 0, 1.0, 0.93, 0.84, 0, 0.35);
      for (const s of CA.NEAR_STARS) add(s, true);
      for (const s of CA.BRIGHT_STARS) add(s, false);
      this.named = new CA.PointCloud(gfx, new Float32Array(named));
      this.label('Sun', [0, 0, 0], [15.3, 15.8, 19.45, 19.95], { pri: 10, cls: 'you', sub: 'you are here' });
      yield 0.1;

      // Procedural field: log-uniform in distance so every zoom level has stars.
      const field = [], wide = [];
      const cls = [
        [0.72, -2.6, 1.0, 2600, 3700], [0.14, -0.9, 0.5, 3900, 5200], [0.07, -0.25, 0.35, 5300, 6000],
        [0.04, 0.3, 0.6, 6000, 7300], [0.02, 0.9, 1.1, 7400, 10000], [0.008, 2.3, 1.3, 10500, 28000], [0.002, 2.0, 0.8, 3600, 4800],
      ];
      const cum = [];
      let acc = 0;
      for (const c of cls) { acc += c[0]; cum.push(acc); }
      const N = 60000;
      for (let i = 0; i < N; i++) {
        let x, y, z, s;
        if (i % 5 < 2) {
          // log-uniform in distance: every zoom level near the Sun has stars
          s = 11 * Math.pow(1500 / 11, R.next());
          const d = R.dir();
          x = d[0] * s; z = d[2] * s; y = d[1] * s;
          if (Math.abs(y) > 280) y = R.laplace(300);
        } else {
          // uniform over the local disk: the wider field seen from farther out
          const rh = 9000 * Math.sqrt(R.next()), a = R.next() * Math.PI * 2;
          x = rh * Math.cos(a); z = rh * Math.sin(a); y = R.laplace(320);
          s = Math.hypot(x, y, z);
          if (s < 11) continue;
        }
        const u = R.next() * acc;
        let k = 0;
        while (cum[k] < u) k++;
        const c = cls[k];
        const L = c[1] + R.next() * c[2];
        const col = CA.kelvinToRGB(R.range(c[3], c[4]));
        // Farther samples stand in for many stars.
        const boost = i % 5 < 2 ? 1.2 * Math.log10(s / 100) : 2.72;
        (i % 5 < 2 ? field : wide).push(x, y, z, col[0], col[1], col[2], L + boost, 0);
        if (i % 20000 === 19999) yield 0.2 + (0.4 * i) / N;
      }
      this.field = new CA.PointCloud(gfx, new Float32Array(field));
      this.wide = new CA.PointCloud(gfx, new Float32Array(wide));

      // Nebulae, clusters and dark clouds.
      const glow = [], neb = [], dark = [], cl = [];
      for (const n of CA.NEBULAE) {
        const p = frames.radec(n[1], n[2], n[3]);
        const r = n[4], kind = n[5], c = n[6];
        const zc = LOG10_LY_M + Math.log10(n[3]);
        if (kind === 'cluster') {
          const count = n[0] === 'Double Cluster' ? 140 : 70;
          for (let i = 0; i < count; i++) {
            const q = R.ball(), rr = r * Math.pow(R.next(), 0.6);
            const L = R.range(0.4, 2.6) + (n[0] === 'Pleiades' ? 0.4 : 0);
            cl.push(p[0] + q[0] * rr, p[1] + q[1] * rr, p[2] + q[2] * rr, c[0], c[1], c[2], L, 0);
          }
          glow.push(p[0], p[1], p[2], c[0] * 0.18, c[1] * 0.18, c[2] * 0.18, 0, r * 1.4);
        } else if (kind === 'dark') {
          dark.push(p[0], p[1], p[2], 0.55, 0.62, 0.75, 0, r);
        } else {
          const b = kind === 'planetary' ? 2.2 : kind === 'remnant' ? 1.1 : 1.3;
          neb.push(p[0], p[1], p[2], c[0] * b, c[1] * b, c[2] * b, R.next() * 10, r);
          if (kind === 'emission') neb.push(p[0], p[1], p[2], c[0] * 0.5, c[1] * 0.6, c[2] * 0.7, R.next() * 10, r * 2.2);
        }
        this.label(n[0], p, [zc - 0.7, zc - 0.35, zc + 0.7, zc + 1.1], { pri: 3, sub: n[7] || CA.fmt.int(n[3]) + ' ly', cls: 'neb' });
      }
      this.glow = new CA.SpriteSet(gfx, new Float32Array(glow));
      this.neb = new CA.SpriteSet(gfx, new Float32Array(neb));
      this.dark = new CA.SpriteSet(gfx, new Float32Array(dark));
      this.clusterStars = new CA.PointCloud(gfx, new Float32Array(cl));
      yield 0.8;

      // Distance rings in the galactic plane, centred on the Sun.
      this.rings = [];
      for (const r of [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]) {
        const lb = new CA.LineBuilder();
        lb.circle([0, 0, 0], [1, 0, 0], [0, 0, 1], r, 256, [0.5, 0.62, 0.9, 0.3]);
        const zr = LOG10_LY_M + Math.log10(r);
        const fade = [zr - 0.25, zr + 0.1, zr + 0.85, zr + 1.25];
        this.rings.push({ geo: lb.build(gfx), fade });
        const lab = r < 1000 ? r + ' light-years' : CA.fmt.int(r) + ' light-years';
        this.label(lab, [0, 0, -r], fade, { pri: 1, cls: 'ring' });
      }
      // Drop lines from nearby stars to the galactic plane.
      const lb = new CA.LineBuilder();
      for (const p of this.drops) lb.seg(p, [p[0], 0, p[2]], [0.55, 0.7, 1.0, 0.22], [0.55, 0.7, 1.0, 0.04]);
      this.dropLines = lb.build(gfx);
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, z = G.z, dpr = G.dpr;
      gfx.depth(false, false);
      gfx.blend('add');
      for (const r of this.rings) {
        const f = CA.fadeIn(r.fade, z);
        if (f > 0) gfx.drawLines(r.geo, cam, { u_width: 1.0 * dpr, u_gain: op * f });
      }
      const dF = CA.fadeIn([16.4, 16.9, 17.7, 18.1], z);
      if (dF > 0) gfx.drawLines(this.dropLines, cam, { u_width: 1.0 * dpr, u_gain: op * dF });

      // Auto-exposure: a Sun-like star at the focus distance has fixed brightness.
      const T = this.tune;
      const logRef = -2 * Math.log10(Math.max(cam.d, 1e-9)) + T.ref;
      gfx.drawSprites(this.glow, cam, { u_mode: 0, u_gain: op * T.glow, u_minPx: 0.5, u_maxPx: 400 * dpr });
      gfx.drawSprites(this.neb, cam, { u_mode: 3, u_gain: op * T.neb, u_minPx: 0.5, u_maxPx: 500 * dpr });
      gfx.blend('absorb');
      gfx.drawSprites(this.dark, cam, { u_mode: 1, u_gain: op * 0.8, u_minPx: 0.5, u_maxPx: 500 * dpr });
      gfx.blend('add');
      const common = { u_logRef: logRef, u_minPx: 0.6 * dpr, u_maxPx: 6 * dpr, u_sizeK: 1.4 * dpr };
      // The near field (dense around the Sun) hands over to the wide disk field as we pull back.
      const nearF = CA.fadeIn([-1e9, -1e9, 18.45, 19.15], z), wideF = CA.fadeIn([16.9, 17.8, 1e9, 1e9], z);
      if (nearF > 0) gfx.drawStars(this.field, cam, Object.assign({}, common, { u_gain: op * T.field * nearF, u_spikeK: 0 }));
      if (wideF > 0) gfx.drawStars(this.wide, cam, Object.assign({}, common, { u_gain: op * T.field * wideF, u_spikeK: 0 }));
      gfx.drawStars(this.clusterStars, cam, Object.assign({}, common, { u_gain: op * T.cluster, u_spikeK: 0.4 }));
      gfx.drawStars(this.named, cam, Object.assign({}, common, { u_gain: op * T.named, u_maxPx: 9 * dpr, u_spikeK: 1.0 }));
    }
  }

  CA.layers.push(new StarsLayer());
})();
