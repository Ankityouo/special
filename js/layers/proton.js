/* Inside a proton, in femtometers: two up quarks and a down quark.
 *
 * Quarks carry "colour" charge (red, green or blue), always one of each; the
 * colours keep swapping as gluons pass between them, shown here as a steady
 * rotation of hue. Gluon flux tubes meet in a Y at a junction; the space
 * between is a turbulent gluon field, and quark-antiquark pairs flicker in
 * and out of existence. The proton's edge is fuzzy, about 0.84 fm out.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3 } = CA;

  // Quark home positions: a triangle 0.32 fm from the centre, tilted.
  const tilt = (p) => v3.rotate(v3.rotate(p, [1, 0, 0], 0.5), [0, 1, 0], 0.4);
  const QUARKS = [
    { name: 'Up quark', p: tilt([0.32, 0, 0]), charge: '+2/3' },
    { name: 'Up quark', p: tilt([-0.16, 0, 0.277]), charge: '+2/3' },
    { name: 'Down quark', p: tilt([-0.16, 0, -0.277]), charge: '−1/3' },
  ];
  // The zoom continues into the first up quark, the one most exposed toward the
  // Uncharted chapter's camera (yaw 1.0, pitch 0.35 in app.js).
  {
    const back = [Math.sin(1.0) * Math.cos(0.35), Math.sin(0.35), Math.cos(1.0) * Math.cos(0.35)];
    const ups = QUARKS.slice(0, 2);
    const q = v3.dot(ups[0].p, back) >= v3.dot(ups[1].p, back) ? ups[0] : ups[1];
    q.target = true;
    CA.LEVELS[CA.levelIndex('proton')].a = q.p;
  }
  // Colour charge as a hue, 120° apart for the three quarks.
  function hue(h) {
    const k = (n) => (n + h * 6) % 6;
    const f = (n) => 1 - Math.max(0, Math.min(k(n), 4 - k(n), 1));
    return [f(5), f(3), f(1)];
  }
  const TUBE = 16;

  class ProtonLayer extends CA.Layer {
    constructor() {
      super({ name: 'proton', unit: 1e-15, level: 'proton', fade: [-18.0, -17.2, -14.3, -13.9], bound: 20 });
    }

    *build(gfx) {
      const R = CA.makeRandom(1911);
      const dens = CA.device.density;
      this.phase = QUARKS.map((q, i) => [i * 2.1, i * 1.3 + 0.7, i * 0.6 + 1.9]);
      this.cores = new Float32Array(3 * 8);
      this.halos = new Float32Array(3 * 8);
      this.tubes = new Float32Array(3 * TUBE * 8);
      this.coreSet = new CA.SpriteSet(gfx, this.cores);
      this.haloSet = new CA.SpriteSet(gfx, this.halos);
      this.tubeSet = new CA.SpriteSet(gfx, this.tubes);
      // Gluon field: turbulent glow filling the proton.
      const field = [];
      for (let i = 0; i < 46; i++) {
        const p = v3.scale(R.ball(), 0.62);
        const w = R.range(0.5, 1.0);
        field.push(p[0], p[1], p[2], 0.85 * w, 0.38 * w, 0.2 * w, R.next() * 10, R.range(0.2, 0.38));
      }
      this.field = new CA.SpriteSet(gfx, new Float32Array(field));
      // The sea: short-lived quark-antiquark pairs (the twinkle is their coming and going).
      const sea = new CA.Sink(Math.round(2400 * dens) + 400);
      const SEA = [[1, 0.3, 0.3], [0.3, 1, 0.4], [0.35, 0.5, 1], [0.3, 1, 1], [1, 0.35, 1], [1, 1, 0.35]];
      for (let i = 0; i < sea.cap; i += 2) {
        const p = v3.scale(R.ball(), 0.86);
        const d = v3.scale(R.dir(), R.range(0.02, 0.06));
        const c = SEA[R.int(6)], ph = R.next();
        sea.push(p[0] + d[0], p[1] + d[1], p[2] + d[2], c[0], c[1], c[2], 0.007, ph);
        sea.push(p[0] - d[0], p[1] - d[1], p[2] - d[2], 1 - c[0] * 0.6, 1 - c[1] * 0.6, 1 - c[2] * 0.6, 0.007, ph);
      }
      this.sea = new CA.PointCloud(gfx, sea.data());
      this.edge = new CA.SpriteSet(gfx, new Float32Array([0, 0, 0, 0.55, 0.35, 0.3, 0, 1.05]));
      QUARKS.forEach((q) => this.label(q.name, () => this.qpos(q), [-15.4, -15.0, -14.5, -14.2], { pri: q.target ? 8 : 6, sub: 'charge ' + q.charge }));
      this.label('Gluon field', () => this.junction, [-15.1, -14.85, -14.5, -14.2], { pri: 5, sub: 'most of the proton’s mass' });
      this.label('Virtual quarks', [0, -0.72, 0.2], [-15.2, -14.95, -14.55, -14.3], { pri: 3, sub: 'borrowed for an instant' });
      this.junction = [0, 0, 0];
      this.ready = true;
    }

    qpos(q) {
      if (q.target) return q.p;
      const i = QUARKS.indexOf(q), t = CA.world.t, ph = this.phase[i];
      return [q.p[0] + 0.05 * Math.sin(t * 2.7 + ph[0]), q.p[1] + 0.05 * Math.sin(t * 3.1 + ph[1]), q.p[2] + 0.05 * Math.sin(t * 2.3 + ph[2])];
    }

    update() {
      const t = CA.world.t;
      const P = QUARKS.map((q) => this.qpos(q));
      this.junction = v3.add(v3.scale(v3.add(v3.add(P[0], P[1]), P[2]), 1 / 3), [0.03 * Math.sin(t * 1.7), 0.03 * Math.sin(t * 2.1), 0.03 * Math.sin(t * 1.3)]);
      P.forEach((p, i) => {
        const c = hue(((i / 3 + t * 0.12) % 1 + 1) % 1);
        this.cores.set([p[0], p[1], p[2], 0.6 + 0.4 * c[0], 0.6 + 0.4 * c[1], 0.6 + 0.4 * c[2], 0, 0], i * 8);
        this.halos.set([p[0], p[1], p[2], c[0], c[1], c[2], 0, 0.15], i * 8);
        // Flux tube from this quark to the junction, narrowing toward the middle.
        for (let k = 0; k < TUBE; k++) {
          const s = (k + 0.5) / TUBE;
          const q = v3.lerp(p, this.junction, s);
          const w = 0.55 + 0.45 * Math.sin(t * 3 + k * 0.9 + i);
          const cc = v3.lerp(c, [1, 0.85, 0.6], s);
          this.tubes.set([q[0], q[1], q[2], cc[0] * w, cc[1] * w, cc[2] * w, (i * TUBE + k) * 0.37, 0.06 + 0.03 * (1 - s)], (i * TUBE + k) * 8);
        }
      });
    }

    draw(gfx, G, op) {
      const gl = gfx.gl, cam = this.cam, dpr = G.dpr;
      for (const [set, arr] of [[this.coreSet, this.cores], [this.haloSet, this.halos], [this.tubeSet, this.tubes]]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, set.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
      }
      gfx.depth(false, false);
      gfx.blend('add');
      // Glows fade once they swell past a few hundred pixels, so diving into a
      // quark does not white out the view.
      const big = { u_minPx: 1, u_maxPx: 2600 * dpr }, mid = { u_minPx: 1, u_maxPx: 420 * dpr };
      gfx.drawSprites(this.edge, cam, Object.assign({ u_mode: 0, u_gain: op * 0.4 }, big));
      gfx.drawSprites(this.field, cam, Object.assign({ u_mode: 3, u_gain: op * 0.26 }, mid));
      gfx.drawSprites(this.tubeSet, cam, Object.assign({ u_mode: 3, u_gain: op * 2.6 }, mid));
      gfx.drawPoints(this.sea, cam, { u_gain: op * 0.9, u_minPx: 0.7 * dpr, u_maxPx: 3 * dpr, u_twinkle: 1.0 });
      gfx.drawSprites(this.haloSet, cam, Object.assign({ u_mode: 0, u_gain: op * 2.8 }, mid));
      // Quarks are points, as far as anyone can measure: a fixed-size spark at any zoom.
      gfx.drawSprites(this.coreSet, cam, { u_fixedPx: 7 * dpr, u_mode: 2, u_gain: op * 6 });
    }
  }

  CA.layers.push(new ProtonLayer());
})();
