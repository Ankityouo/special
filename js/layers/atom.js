/* A carbon atom, in picometers, as a cloud of probability.
 *
 * Points are sampled from real one-electron densities (hydrogen-like orbitals
 * with Slater's effective charges): two 1s electrons in a tight core and four
 * valence electrons in sp3 hybrids that point at the atom's actual bonded
 * neighbours in the DNA model (O4', C2', the base's nitrogen, and a hydrogen).
 * The neighbours appear as fainter clouds. The nucleus, at the centre, is tens
 * of thousands of times smaller than the cloud: invisible here.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3 } = CA;
  const A0 = 52.9177;          // Bohr radius, pm
  const Z1 = 5.67, Z2 = 3.25;  // Slater effective charges for carbon 1s and 2s/2p

  // Gamma(3) radius (in bohr) for a density ∝ e^(-k r): the sum of three exponentials.
  const gamma3 = (R, k) => -(Math.log(1 - R.next() * 0.999999) + Math.log(1 - R.next() * 0.999999) + Math.log(1 - R.next() * 0.999999)) / k;
  // Gamma(5): the radial density r⁴e^(-kr) of an outer 2p shell (1s for hydrogen uses gamma3).
  const gamma5 = (R, k) => gamma3(R, k) - (Math.log(1 - R.next() * 0.999999) + Math.log(1 - R.next() * 0.999999)) / k;

  class AtomLayer extends CA.Layer {
    constructor() {
      super({ name: 'atom', unit: 1e-12, level: 'atom', fade: [-13.4, -12.9, -9.3, -8.8], bound: 900 });
    }

    *build(gfx) {
      const R = CA.makeRandom(612);
      const dens = CA.device.density;
      const cloud = new CA.Sink(Math.round(260000 * dens) + 20000);
      // Bond directions: the three heavy neighbours from the DNA model, plus the
      // hydrogen completing the tetrahedron.
      const nb = (CA.CARBON && CA.CARBON.neighbors.length === 3) ? CA.CARBON.neighbors : [['O', [120, 60, 50]], ['C', [-100, 90, -80]], ['N', [-40, -140, 60]]];
      const dirs = nb.map((n) => v3.norm(n[1]));
      const hDir = v3.norm(v3.scale(v3.add(v3.add(dirs[0], dirs[1]), dirs[2]), -1));
      const bonds = [...dirs, hDir];
      // Valence density: four sp3 hybrids, h = ½ψ2s + (√3/2)ψ2p·n, one electron each.
      const n2s = Math.sqrt(Z2 ** 3 / (32 * Math.PI)), n2p = Math.sqrt(Z2 ** 5 / (32 * Math.PI));
      const valence = (p) => {
        const r = Math.hypot(p[0], p[1], p[2]);
        const e = Math.exp(-Z2 * r / 2);
        const s = n2s * (2 - Z2 * r) * e;
        let sum = 0;
        for (const b of bonds) {
          const h = 0.5 * s + 0.8660254 * n2p * v3.dot(p, b) * e;
          sum += h * h;
        }
        return sum;
      };
      const proposal = (r) => (Z2 ** 3 / (8 * Math.PI)) * Math.exp(-Z2 * r);
      // Bound the acceptance ratio numerically.
      let M = 0;
      for (let i = 0; i < 4000; i++) {
        const r = gamma3(R, Z2), d = R.dir(), p = [d[0] * r, d[1] * r, d[2] * r];
        M = Math.max(M, valence(p) / proposal(r));
      }
      M *= 1.2;
      const nVal = Math.round(170000 * dens) + 8000;
      let made = 0, guard = 0;
      while (made < nVal && guard++ < nVal * 40) {
        const r = gamma3(R, Z2), d = R.dir(), p = [d[0] * r, d[1] * r, d[2] * r];
        if (R.next() * M * proposal(r) > valence(p)) continue;
        const k = R.range(0.45, 1.0);
        cloud.push(p[0] * A0, p[1] * A0, p[2] * A0, 0.32 * k, 0.72 * k, 1.0 * k, R.range(0.25, 0.45), R.next());
        made++;
        if (made % 30000 === 0) yield 0.1 + 0.5 * made / nVal;
      }
      this.valEnd = cloud.n;
      // 1s core: r² e^(-2 Z1 r) is a Gamma(3) distribution.
      for (let i = 0, n = Math.round(50000 * dens) + 4000; i < n; i++) {
        const r = gamma3(R, 2 * Z1), d = R.dir();
        const k = R.range(0.6, 1.0);
        cloud.push(d[0] * r * A0, d[1] * r * A0, d[2] * r * A0, 1.0 * k, 0.86 * k, 0.75 * k, R.range(0.1, 0.22), R.next());
      }
      yield 0.7;
      // Neighbouring atoms: simpler spherical valence clouds, dimmer.
      const col = { O: [1.0, 0.42, 0.36], N: [0.42, 0.6, 1.0], C: [0.72, 0.76, 0.86], H: [0.9, 0.9, 0.96] };
      const zeta = { O: 4.55, N: 3.9, C: 3.25, H: 2.0 };      // 2Z_eff/n, Slater
      const others = nb.map((n) => [n[0], n[1]]).concat([['H', v3.scale(hDir, 109)]]);
      this.others = others;
      for (const [el, pos] of others) {
        const n = Math.round((el === 'H' ? 9000 : 26000) * dens) + 1000;
        for (let i = 0; i < n; i++) {
          const r = el === 'H' ? gamma3(R, zeta[el]) : gamma5(R, zeta[el]), d = R.dir();
          const k = R.range(0.3, 0.75);
          const c = col[el];
          cloud.push(pos[0] + d[0] * r * A0, pos[1] + d[1] * r * A0, pos[2] + d[2] * r * A0, c[0] * k, c[1] * k, c[2] * k, R.range(0.25, 0.45), R.next());
        }
      }
      this.cloud = new CA.PointCloud(gfx, cloud.data());
      // The smooth core of the density, which the zoom falls into on the way to the nucleus.
      this.core = new CA.SpriteSet(gfx, new Float32Array([0, 0, 0, 0.45, 0.4, 0.9, 0, 16, 0, 0, 0, 0.8, 0.62, 0.5, 0, 4]));
      this.pin = new CA.SpriteSet(gfx, new Float32Array([0, 0, 0, 1.0, 0.9, 0.8, 0, 1]));
      const names = { O: 'Oxygen', N: 'Nitrogen', C: 'Carbon', H: 'Hydrogen' };
      others.forEach(([el, pos]) => this.label(names[el], v3.scale(pos, 1.12), [-10.3, -10.0, -9.3, -9.0], { pri: 4, sub: 'bonded neighbour' }));
      this.label('Electron cloud', v3.scale(bonds[0], -95), [-10.4, -10.1, -9.4, -9.1], { pri: 6, sub: 'where the six electrons are likely to be' });
      this.label('Nucleus', [0, 0, 0], [-12.6, -12.2, -10.4, -10.0], { pri: 8, sub: 'here, far too small to see' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, dpr = G.dpr, z = G.z;
      gfx.depth(false, false);
      gfx.blend('add');
      // Closer in, the dense 1s core becomes a smooth glow filling the view, and the
      // sampled points (which would only look like static) give way to it.
      const coreK = CA.smoothstep(-10.1, -11.3, z);
      const base = { u_minPx: 0.6 * dpr, u_maxPx: 2.6 * dpr, u_twinkle: 0.6 };
      const pk = 1 - 0.92 * coreK;
      gfx.drawPoints(this.cloud, cam, Object.assign({ u_gain: op * 0.13 * pk, first: 0, count: this.valEnd }, base));
      gfx.drawPoints(this.cloud, cam, Object.assign({ u_gain: op * 0.2 * pk, first: this.valEnd, count: this.cloud.count - this.valEnd }, base));
      if (coreK > 0) gfx.drawSprites(this.core, cam, { u_mode: 0, u_gain: op * coreK * 0.45, u_minPx: 1, u_maxPx: 4000 });
      const pinK = CA.fadeIn([-12.9, -12.4, -10.6, -10.0], z);
      if (pinK > 0) gfx.drawSprites(this.pin, cam, { u_fixedPx: 1.6 * dpr, u_mode: 2, u_gain: op * pinK * 6 });
    }
  }

  CA.layers.push(new AtomLayer());
})();
