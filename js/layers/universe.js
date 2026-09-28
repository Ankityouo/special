/* The observable universe in billions of light-years: a sphere 93 billion
 * light-years across centred on us. Looking outward is looking back in time:
 * mature galaxies, then young blue ones, then the dark ages, then the cosmic
 * microwave background — the oldest light there is.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { U } = CA;
  const R_CMB = 45.7;

  class UniverseLayer extends CA.Layer {
    constructor() {
      super({ name: 'universe', unit: U.GLY, fade: [25.9, 26.55, 28.35, 29.05], bound: 50 });
    }
    home() { return [0, 0, 0]; }

    *build(gfx) {
      const R = CA.makeRandom(13800);
      const foam = new CA.Foam(44, 2.3, 138, 0.95);
      yield 0.2;
      const sink = new CA.Sink(240000);
      const col = (kind, q, R) => {
        const r = Math.hypot(q[0], q[1], q[2]);
        const t = CA.smoothstep(6, 40, r);               // look-back
        const warm = [1.0, 0.84, 0.62], blue = [0.55, 0.62, 1.0], young = [0.62, 0.45, 1.0];
        let c = t < 0.6 ? CA.v3.lerp(warm, blue, t / 0.6) : CA.v3.lerp(blue, young, (t - 0.6) / 0.4);
        const b = (kind === 0 ? 2.2 : kind === 1 ? 0.8 : 0.3) * (1 - 0.55 * t);
        return [c[0] * b, c[1] * b, c[2] * b];
      };
      yield* CA.sampleFoam(foam, {
        n: 220000,
        radial: (R) => {
          // uniform in volume between 3.5 and 42 Gly (the dark ages lie beyond)
          const a = 3.5 / 42;
          return 42 * Math.cbrt(a * a * a + R.next() * (1 - a * a * a));
        },
        mix: [0.16, 0.48, 0.36], jit: [0.06, 0.05, 0.08], col, size: [0.14, 0.14, 0.2],
      }, sink, R);
      this.deep = new CA.PointCloud(gfx, sink.data());

      const D = CA.v3.norm([0.62, 0.35, 0.7]);
      this.label('Observable Universe', [0, R_CMB * 1.02, 0], [26.75, 27.05, 28.3, 28.8], { pri: 9, cls: 'region', sub: '93 billion light-years across' });
      this.label('Cosmic microwave background', CA.v3.scale(D, R_CMB), [26.8, 27.1, 28.1, 28.6], { pri: 8, sub: 'light from 380,000 years after the Big Bang' });
      this.label('Dark Ages', CA.v3.scale(CA.v3.norm([-0.7, -0.2, 0.68]), 43.6), [26.9, 27.2, 27.9, 28.3], { pri: 5, cls: 'region', sub: 'before the first stars' });
      this.label('First galaxies', CA.v3.scale(CA.v3.norm([-0.3, 0.8, -0.5]), 38), [26.9, 27.2, 27.9, 28.3], { pri: 5, cls: 'region', sub: '13 billion years ago' });
      this.label('You are here', [0, 0, 0], [26.6, 27.0, 28.5, 29.0], { pri: 10, cls: 'you', sub: 'the center of your own observable universe' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr;
      gfx.depth(false, false);
      gfx.blend('add');
      gfx.drawPoints(this.deep, cam, { u_gain: 0.5 * op, u_minPx: 0.7 * dpr, u_maxPx: 20 * dpr });
      const dist = Math.hypot(cam.pos[0], cam.pos[1], cam.pos[2]);
      const inside = dist < R_CMB * 1.02;
      // From inside, the CMB is a faint all-sky glow; from outside, a globe.
      const inner = inside ? 0.18 * CA.smoothstep(26.1, 26.6, G.z) : 1;
      gfx.blend('premul');
      gfx.drawImpostor(gfx.p.shell, Object.assign(gfx.camUniforms(cam), {
        u_center: [0, 0, 0], u_radius: R_CMB, u_full: inside ? 1 : 0, u_mode: 1, u_opacity: op * inner,
        u_tint: [1, 1, 1], u_axis: [0, 1, 0], u_seed: 0,
      }));
      gfx.blend('add');
    }
  }

  CA.layers.push(new UniverseLayer());
})();
