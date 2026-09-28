/* Solar System in astronomical units: planets at today's positions from
 * Keplerian elements, orbit trails, belts, heliosphere, Oort cloud.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3, U, astro, frames } = CA;
  const TAU = Math.PI * 2;

  // Pixel radius of each planet's dot (log-ish of true size).
  const DOT = { Mercury: 1.5, Venus: 2.0, Earth: 2.1, Mars: 1.7, Jupiter: 3.0, Saturn: 2.7, Uranus: 2.2, Neptune: 2.2, Pluto: 1.3 };

  class SolarLayer extends CA.Layer {
    constructor() {
      super({ name: 'solar', unit: U.AU, fade: [-1.7, -1.0, 16.75, 17.5], bound: 1.1e5 });
    }
    home() { return CA.world.earthHelio; }

    *build(gfx) {
      const W = CA.world, T = W.T;
      const R = CA.makeRandom(4242);
      const P = astro.PLANETS;

      // ---- planets (dynamic buffer) and orbits with trails
      this.pData = new Float32Array(P.length * 8);
      this.planets = new CA.PointCloud(gfx, this.pData);
      const inner = new CA.LineBuilder(), outer = new CA.LineBuilder();
      P.forEach((p, i) => {
        const k = astro.elements(p, T);
        const E0 = astro.solveKepler(k.M, k.e);
        const N = i >= 4 ? 720 : 400;
        const pts = [];
        for (let j = 0; j <= N; j++) {
          const E = E0 - (j / N) * TAU;
          pts.push(frames.eclToScene(astro.orbitPoint(k.a, k.e, k.I, k.w, k.O, E)));
        }
        const c = p.name === 'Earth' ? [0.62, 0.82, 1.0] : [0.62, 0.72, 0.95];
        const peak = p.name === 'Earth' ? 0.95 : p.dwarf ? 0.4 : 0.6;
        (i < 4 ? inner : outer).polyline(pts, (j, n) => {
          const x = 1 - j / (n - 1);
          return [c[0], c[1], c[2], 0.07 + peak * Math.pow(x, 2.4)];
        }, false);
      });
      this.innerOrbits = inner.build(gfx);
      this.outerOrbits = outer.build(gfx);
      yield 0.2;

      // ---- belts: asteroid belt, Jupiter trojans, Kuiper belt & scattered disk
      const pts = [];
      const push = (p, col, size) => pts.push(p[0], p[1], p[2], col[0], col[1], col[2], 0, size);
      const kep = (a, e, inc) => {
        const O = R.next() * TAU, w = R.next() * TAU, M = R.next() * TAU;
        const E = astro.solveKepler(M, e);
        return frames.eclToScene(astro.orbitPoint(a, e, inc, w, O, E));
      };
      const astCol = [0.72, 0.64, 0.55];
      let n = 0;
      while (n < 14000) {
        const a = R.range(2.1, 3.35);
        // Kirkwood gaps (resonances with Jupiter)
        if ((Math.abs(a - 2.5) < 0.03 || Math.abs(a - 2.82) < 0.025 || Math.abs(a - 2.95) < 0.02) && R.next() < 0.85) continue;
        const e = Math.min(0.3, Math.abs(R.gauss()) * 0.08);
        const inc = Math.abs(R.gauss()) * 7 * CA.DEG;
        push(kep(a, e, inc), astCol, 0.0045);
        n++;
      }
      this.astCount = n;
      // Trojans lead and trail Jupiter by 60°.
      const jk = astro.elements(P[4], T);
      for (let i = 0; i < 2600; i++) {
        const side = i % 2 ? 1 : -1;
        const a = 5.2 + R.gauss() * 0.08;
        const e = Math.abs(R.gauss()) * 0.05;
        const inc = Math.abs(R.gauss()) * 10 * CA.DEG;
        const M = jk.M + side * (60 + R.gauss() * 13) * CA.DEG;
        const E = astro.solveKepler(CA.wrapAngle(M), e);
        const O = jk.O + R.gauss() * 0.3, w = jk.w;
        push(frames.eclToScene(astro.orbitPoint(a, e, inc, w, O, E)), astCol, 0.006);
      }
      this.trojanEnd = pts.length / 8;
      yield 0.3;
      const kbCol = [0.55, 0.66, 0.9];
      for (let i = 0; i < 16000; i++) {
        const u = R.next();
        let a, e, inc;
        if (u < 0.55) { a = R.range(42, 48); e = Math.abs(R.gauss()) * 0.05; inc = Math.abs(R.gauss()) * 3 * CA.DEG; }
        else if (u < 0.75) { a = 39.4 + R.gauss() * 0.3; e = R.range(0.1, 0.3); inc = Math.abs(R.gauss()) * 10 * CA.DEG; }
        else { a = R.range(45, 110); e = R.range(0.25, 0.6); inc = Math.abs(R.gauss()) * 16 * CA.DEG; }
        push(kep(a, e, inc), kbCol, 0.05);
      }
      this.kuiperStart = this.trojanEnd;
      this.belts = new CA.PointCloud(gfx, new Float32Array(pts));
      yield 0.5;

      // ---- Oort cloud: flattened inner Hills cloud + spherical outer shell
      const oort = [];
      const ecl = (x, y, z) => frames.eclToScene([x, y, z]);
      for (let i = 0; i < 36000; i++) {
        let p;
        if (i < 14000) {
          const r = 2000 * Math.pow(10, R.next() * 1.0);
          const lon = R.next() * TAU, lat = R.gauss() * 0.45;
          p = ecl(r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat));
        } else {
          const r = 20000 * Math.pow(5, Math.pow(R.next(), 0.8));
          const d = R.dir();
          p = [d[0] * r, d[1] * r, d[2] * r];
        }
        const rr = v3.len(p);
        oort.push(p[0], p[1], p[2], 0.6, 0.72, 1.0, 0, rr * 0.0022);
      }
      this.oort = new CA.PointCloud(gfx, new Float32Array(oort));
      yield 0.7;

      // ---- Sun glow, glare and spacecraft
      this.sunGlow = new CA.SpriteSet(gfx, new Float32Array([0, 0, 0, 1.0, 0.82, 0.58, 0, 1]));
      this.sunGlare = new CA.SpriteSet(gfx, new Float32Array([0, 0, 0, 1.0, 0.88, 0.7, 3.7, 1]));
      const craft = [];
      for (const s of CA.SPACECRAFT) {
        const p = frames.radec(s[1], s[2], s[3]);
        craft.push(p[0], p[1], p[2], 0.75, 0.9, 1.0, 0, 1.4);
        this.label(s[0], p, [13.25, 13.6, 14.6, 15.1], { pri: 3, sub: s[4], cls: 'craft' });
      }
      this.craft = new CA.PointCloud(gfx, new Float32Array(craft));

      // Heliosphere nose points upwind into the interstellar wind (ecliptic λ 255.4°, β 5.2°).
      this.helioAxis = frames.eclDir(255.4, 5.2);

      // ---- labels
      this.label('Sun', [0, 0, 0], [9.6, 10.2, 16.2, 16.8], { pri: 8, r: 0.00465 });
      P.forEach((p, i) => {
        const get = () => this.planetPos[i];
        if (p.name === 'Earth') {
          this.label('Earth', get, [9.9, 10.35, 13.9, 14.5], { pri: 9, cls: 'you', sub: 'you are here' });
          return;
        }
        const f = i < 4 ? [10.2, 10.7, 13.2, 13.9] : p.dwarf ? [12.5, 12.9, 14.5, 15.1] : [11.0, 11.6, 14.4, 15.0];
        this.label(p.name, get, f, { pri: p.dwarf ? 2 : 5, sub: p.dwarf ? 'dwarf planet' : '' });
      });
      this.label('Asteroid belt', frames.eclToScene([2.75 * Math.cos(1.1), 2.75 * Math.sin(1.1), 0]), [11.25, 11.6, 12.6, 13.1], { pri: 3, cls: 'region' });
      this.label('Kuiper belt', frames.eclToScene([44 * Math.cos(2.2), 44 * Math.sin(2.2), 0]), [12.7, 13.1, 14.2, 14.7], { pri: 3, cls: 'region' });
      this.label('Heliopause', v3.scale(this.helioAxis, 122), [13.3, 13.7, 14.7, 15.2], { pri: 4, cls: 'region', sub: 'edge of the solar wind' });
      this.label('Oort Cloud', frames.eclToScene([0, 0, 42000]), [15.3, 15.8, 16.8, 17.3], { pri: 4, cls: 'region', sub: 'up to 100,000 AU' });
      this.ready = true;
    }

    update(G) {
      const T = CA.world.T;
      const P = astro.PLANETS;
      if (!this.planetPos) this.planetPos = [];
      for (let i = 0; i < P.length; i++) {
        const p = astro.planetScene(P[i], T);
        this.planetPos[i] = p;
        const o = i * 8, c = P[i].color;
        // Seen from Earth's own neighbourhood, Earth is not a dot in the sky.
        const bright = P[i].name === 'Earth' ? (G.z > 8.8 ? 3.2 : 0) : 2.4;
        this.pData[o] = p[0]; this.pData[o + 1] = p[1]; this.pData[o + 2] = p[2];
        this.pData[o + 3] = c[0] * bright; this.pData[o + 4] = c[1] * bright; this.pData[o + 5] = c[2] * bright;
        this.pData[o + 6] = 0; this.pData[o + 7] = DOT[P[i].name];
      }
    }

    draw(gfx, G, op) {
      const gl = gfx.gl, cam = this.cam, z = G.z, dpr = G.dpr;
      gfx.depth(false, false);
      gfx.blend('add');

      const oortF = CA.fadeIn([14.9, 15.7, 16.7, 17.4], z);
      if (oortF > 0) gfx.drawPoints(this.oort, cam, { u_gain: 0.9 * op * oortF, u_minPx: 0.7 * dpr, u_maxPx: 2.2 * dpr });

      const astF = CA.fadeIn([11.3, 11.9, 12.7, 13.5], z);
      if (astF > 0) gfx.drawPoints(this.belts, cam, { u_gain: 0.75 * op * astF, u_minPx: 0.7 * dpr, u_maxPx: 2.2 * dpr, first: 0, count: this.trojanEnd });
      const kbF = CA.fadeIn([12.3, 12.9, 14.2, 15.0], z);
      if (kbF > 0) gfx.drawPoints(this.belts, cam, { u_gain: 0.6 * op * kbF, u_minPx: 0.7 * dpr, u_maxPx: 2.2 * dpr, first: this.kuiperStart, count: this.belts.count - this.kuiperStart });

      const inF = CA.fadeIn([9.3, 10.1, 13.3, 14.0], z);
      if (inF > 0) gfx.drawLines(this.innerOrbits, cam, { u_width: 1.25 * dpr, u_gain: op * inF });
      const outF = CA.fadeIn([10.9, 11.6, 14.6, 15.4], z);
      if (outF > 0) gfx.drawLines(this.outerOrbits, cam, { u_width: 1.25 * dpr, u_gain: op * outF });

      const hF = CA.fadeIn([13.1, 13.7, 14.6, 15.3], z);
      if (hF > 0) {
        const inside = v3.len(cam.pos) < 200;
        gfx.drawImpostor(gfx.p.shell, Object.assign(gfx.camUniforms(cam), {
          u_center: [0, 0, 0], u_radius: 200, u_full: inside ? 1 : 0, u_mode: 0, u_axis: this.helioAxis,
          u_tint: [0.35, 0.62, 1.0], u_opacity: op * hF * 0.9, u_seed: 0,
        }));
      }

      // Sun: a fixed-size glow plus the resolved disk when close enough.
      const sunF = op * (1 - CA.smoothstep(16.0, 16.9, z));
      if (sunF > 0) {
        const near = 1 - CA.smoothstep(12.5, 15.5, z);
        gfx.drawSprites(this.sunGlow, cam, { u_fixedPx: (30 + 26 * near) * dpr, u_mode: 2, u_gain: (1.1 + 1.2 * near) * sunF });
        // A lens's view of the Sun: spikes and a ragged corona, strongest up close.
        const glare = CA.fadeIn([-1.2, -0.6, 14.5, 16.0], z) * sunF * (1 - 0.55 * CA.smoothstep(11.5, 14.5, z));
        if (glare > 0) gfx.drawSprites(this.sunGlare, cam, { u_fixedPx: (90 + 230 * near) * dpr, u_mode: 4, u_gain: 0.6 * glare });
        gfx.drawImpostor(gfx.p.sun, Object.assign(gfx.camUniforms(cam), {
          u_center: [0, 0, 0], u_radius: 0.00465047, u_full: 0, u_intensity: 60, u_opacity: sunF,
        }));
      }

      // Planets: dots with orbits from space; wandering stars in the sky from the ground.
      const plF = Math.max(CA.fadeIn([9.2, 9.9, 14.4, 15.2], z), CA.fadeIn([-1.2, -0.7, 5.8, 6.6], z) * 0.55 * (1 - 0.9 * (CA.world.daylight || 0)));
      if (plF > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.planets.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pData);
        gfx.drawPoints(this.planets, cam, { u_gain: op * plF, u_constFlux: 2, u_sizeMul: dpr, u_mode: 2 });
      }
      const cF = CA.fadeIn([13.2, 13.6, 14.6, 15.1], z);
      if (cF > 0) gfx.drawPoints(this.craft, cam, { u_gain: 2.5 * op * cF, u_constFlux: 2, u_sizeMul: dpr, u_mode: 2 });
    }
  }

  CA.layers.push(new SolarLayer());
})();
