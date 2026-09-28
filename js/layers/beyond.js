/* Beyond the horizon. Nothing here is observed; it is labelled as such.
 * Units: 100 billion light-years. Our observable universe is a speck at the
 * centre of a larger bubble; other bubbles illustrate eternal inflation.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { U, v3 } = CA;
  const UNIT = 100 * U.GLY;

  class BeyondLayer extends CA.Layer {
    constructor() {
      super({ name: 'beyond', unit: UNIT, fade: [27.95, 28.75, 1e9, 1e9], bound: 900 });
      this.tune = { haze: 0.015, bubble: 0.3, inside: 0.12 };
    }
    home() { return [0, 0, 0]; }

    *build(gfx) {
      const R = CA.makeRandom(8);
      this.bubbles = [{ c: [0, 0, 0], r: 16, tint: [0.75, 0.85, 1.0], seed: 0.37 }];
      let guard = 0;
      while (this.bubbles.length < 46 && guard++ < 4000) {
        const d = R.dir();
        const dist = 34 + Math.pow(R.next(), 0.7) * 260;
        const c = v3.scale(d, dist);
        const r = R.range(5, 30) * (0.6 + dist / 300);
        if (this.bubbles.some((b) => v3.dist(b.c, c) < (b.r + r) * 0.92)) continue;
        const h = R.next();
        const tint = h < 0.33 ? [1.0, 0.72, 0.55] : h < 0.66 ? [0.7, 0.8, 1.0] : [0.85, 0.7, 1.0];
        this.bubbles.push({ c, r, tint, seed: R.next() * 10 });
      }
      // A faint shimmering "false vacuum" haze between bubbles.
      const haze = [];
      for (let i = 0; i < 90; i++) {
        const p = v3.scale(R.dir(), R.range(20, 420));
        haze.push(p[0], p[1], p[2], 0.1, 0.1, 0.16, R.next() * 10, R.range(40, 110));
      }
      this.haze = new CA.SpriteSet(gfx, new Float32Array(haze));
      this.marker = new CA.SpriteSet(gfx, new Float32Array([0, 0, 0, 1.0, 0.85, 0.7, 0, 1]));
      this.label('Observable universe', [0, 0, 0], [28.55, 28.9, 1e9, 1e9], { pri: 10, cls: 'you', sub: 'everything we can ever see' });
      this.label('Our universe?', [0, 16.5, 0], [28.6, 29.0, 1e9, 1e9], { pri: 8, cls: 'spec', sub: 'size unknown, perhaps infinite' });
      const other = this.bubbles.slice(1).sort((a, b) => v3.len(a.c) - v3.len(b.c))[1];
      this.label('Other universes?', v3.madd(other.c, [0, 1, 0], other.r * 1.02), [28.9, 29.2, 1e9, 1e9], { pri: 7, cls: 'spec', sub: 'a hypothesis called eternal inflation' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr;
      gfx.depth(false, false);
      gfx.blend('add');
      gfx.drawSprites(this.haze, cam, { u_mode: 3, u_gain: op * this.tune.haze, u_minPx: 1, u_maxPx: 2000 });
      const base = gfx.camUniforms(cam);
      for (const b of this.bubbles) {
        const inside = CA.v3.dist(cam.pos, b.c) < b.r * 1.02;
        gfx.drawImpostor(gfx.p.shell, Object.assign({}, base, {
          u_center: b.c, u_radius: b.r, u_full: inside ? 1 : 0, u_mode: 2, u_opacity: op * (inside ? this.tune.inside : this.tune.bubble),
          u_tint: b.tint, u_seed: b.seed, u_axis: [0, 1, 0],
        }));
      }
      const m = CA.fadeIn([28.5, 28.9, 1e9, 1e9], G.z);
      if (m > 0) gfx.drawSprites(this.marker, cam, { u_fixedPx: 7 * dpr, u_mode: 2, u_gain: 4 * op * m });
    }
  }

  CA.layers.push(new BeyondLayer());
})();
