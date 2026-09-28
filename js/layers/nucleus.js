/* The carbon-12 nucleus, in femtometers: six protons and six neutrons.
 *
 * Carbon-12 is well described as three alpha particles (two protons and two
 * neutrons each) in a triangle, so the nucleons are packed that way. They
 * jiggle, because nothing this small ever sits still. Nucleons are about
 * 1.7 fm across; the whole nucleus about 5 fm.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3 } = CA;
  const RN = 0.84;                 // nucleon (proton charge) radius, fm
  const P_COL = [1.0, 0.36, 0.22], N_COL = [0.42, 0.6, 1.0];

  // Three tetrahedral alpha clusters on a triangle, tilted off the axes.
  const NUCLEONS = [];
  {
    const tet = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((p) => v3.scale(v3.norm(p), 0.92));
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2 + 0.3;
      const cc = [1.62 * Math.cos(a), 0.25 * Math.sin(a * 2), 1.62 * Math.sin(a)];
      const spin = v3.norm([Math.cos(a * 1.7), 0.6, Math.sin(a * 1.3)]);
      tet.forEach((t, i) => {
        const p = v3.add(cc, v3.rotate(t, spin, a * 2.1));
        NUCLEONS.push({ p, proton: i < 2 });
      });
    }
  }
  // The proton we zoom into: the one most exposed toward the Proton chapter's
  // camera (yaw 0.85, pitch 0.3 in app.js).
  const back = [Math.sin(0.85) * Math.cos(0.3), Math.sin(0.3), Math.cos(0.85) * Math.cos(0.3)];
  let best = null;
  for (const n of NUCLEONS) if (n.proton && (!best || v3.dot(n.p, back) > v3.dot(best.p, back))) best = n;
  CA.LEVELS[CA.levelIndex('nucleus')].a = best.p;
  const TARGET = best;

  class NucleusLayer extends CA.Layer {
    constructor() {
      super({ name: 'nucleus', unit: 1e-15, level: 'nucleus', fade: [-14.55, -14.2, -13.3, -12.6], bound: 60 });
    }

    *build(gfx) {
      this.data = new Float32Array(NUCLEONS.length * 8);
      this.halo = new Float32Array(NUCLEONS.length * 8);
      this.phase = NUCLEONS.map((n, i) => [i * 1.7, i * 2.3 + 1, i * 0.9 + 2]);
      this.spheres = new CA.SpriteSet(gfx, this.data);
      this.glow = new CA.SpriteSet(gfx, this.halo);
      this.aura = new CA.SpriteSet(gfx, new Float32Array([0, 0, 0, 0.9, 0.55, 0.45, 0, 4.2]));
      const n0 = NUCLEONS.find((n) => !n.proton && v3.dot(n.p, back) > -0.5) || NUCLEONS.find((n) => !n.proton);
      this.label('Proton', () => this.pos(TARGET), [-14.3, -14.0, -13.4, -13.1], { pri: 7, sub: 'positive charge', r: RN });
      this.label('Neutron', () => this.pos(n0), [-14.2, -13.95, -13.4, -13.1], { pri: 6, sub: 'no charge', r: RN });
      this.label('Carbon-12 nucleus', [0, 3.4, 0], [-13.3, -13.1, -12.9, -12.6], { pri: 8, cls: 'region' });
      this.ready = true;
    }

    // Nucleon position with a gentle quantum jiggle (the target proton stays put,
    // since the zoom is heading straight for it).
    pos(n) {
      if (n === TARGET) return n.p;
      const i = NUCLEONS.indexOf(n), t = CA.world.t, ph = this.phase[i];
      return [n.p[0] + 0.07 * Math.sin(t * 1.9 + ph[0]), n.p[1] + 0.07 * Math.sin(t * 2.3 + ph[1]), n.p[2] + 0.07 * Math.sin(t * 1.6 + ph[2])];
    }

    update() {
      NUCLEONS.forEach((n, i) => {
        const p = this.pos(n), c = n.proton ? P_COL : N_COL, o = i * 8;
        this.data.set([p[0], p[1], p[2], c[0], c[1], c[2], 0.9, RN], o);
        this.halo.set([p[0], p[1], p[2], c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0, RN * 1.9], o);
      });
    }

    draw(gfx, G, op) {
      const gl = gfx.gl, cam = this.cam, dpr = G.dpr;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spheres.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glow.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.halo);
      gfx.depth(false, false);
      gfx.blend('add');
      gfx.drawSprites(this.aura, cam, { u_mode: 0, u_gain: op * 0.35, u_minPx: 1, u_maxPx: 3000 * dpr });
      gfx.depth(true, true);
      gfx.blend('premul');
      gfx.drawSpheres(this.spheres, cam, { u_minPx: 1.2 * dpr, u_gain: 1.2, u_opacity: op, u_emit: 0.45, u_nearFade: cam.d * 0.45 });
      gfx.depth(false, false);
      gfx.blend('add');
      gfx.drawSprites(this.glow, cam, { u_mode: 0, u_gain: op * 0.5, u_minPx: 1, u_maxPx: 3000 * dpr });
    }
  }

  CA.layers.push(new NucleusLayer());
})();
