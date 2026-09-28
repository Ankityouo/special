/* Earth and Moon, in Earth radii. Lighting follows the real Sun direction at
 * the current moment; the Moon sits where it actually is today. The same
 * ray tracer draws Earth from the Moon's distance and the sky over your head:
 * the shader works relative to the camera, and below the atmosphere it covers
 * the whole screen.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3, U } = CA;
  const DEG = CA.DEG;
  // Geomagnetic north pole (IGRF, 2025): 80.8° N, 72.7° W, Earth-fixed.
  const GEO_POLE = [Math.cos(80.8 * DEG) * Math.cos(-72.7 * DEG), Math.cos(80.8 * DEG) * Math.sin(-72.7 * DEG), Math.sin(80.8 * DEG)];

  class EarthLayer extends CA.Layer {
    constructor() {
      super({ name: 'earth', unit: U.R_EARTH, fade: [-1.6, -0.9, 9.75, 10.4], bound: 70 });
      this.toEarth = new Float64Array(9);
      this.toMoon = new Float64Array(9);
      this.toLocal = new Float64Array(9);
      this.homePos = [1, 0, 0];
    }

    *build(gfx) {
      yield* gfx.whenReady('earth', 'moon');
      const T = window.CA_TEXTURES || {};
      const load = (key, opts, fb) => (T[key]
        ? gfx.loadTexture(T[key], opts).catch(() => gfx.solidTexture(fb, opts.gray))
        : Promise.resolve(gfx.solidTexture(fb, opts.gray)));
      let tex = null;
      Promise.all([
        load('day', { srgb: true }, [40, 70, 130, 255]),
        load('lights', { gray: true }, [0]),
        load('clouds', { gray: true }, [0]),
        load('water', { gray: true }, [255]),
      ]).then((t) => { tex = t; });
      while (!tex) yield 0;
      this.tex = tex;

      // The Moon's path over one month, brightest just behind it.
      const W = CA.world;
      const N = 260, pts = [];
      for (let i = 0; i <= N; i++) {
        const dt = (i / N - 1) * 27.32 / 36525;
        pts.push(CA.astro.moonScene(W.T + dt));
      }
      const lb = new CA.LineBuilder();
      lb.polyline(pts, (i, n) => {
        const x = i / (n - 1);
        return [0.72, 0.82, 1.0, 0.05 + 0.5 * Math.pow(x, 3)];
      }, false);
      this.moonPath = lb.build(gfx);

      this.beaconData = new Float32Array([1, 0, 0, 0.55, 0.8, 1.0, 0, 0]);
      this.beacon = new CA.SpriteSet(gfx, this.beaconData);

      const home = W.home;
      this.label('You are here', () => this.homePos, [4.6, 5.2, 8.3, 8.85], {
        cls: 'you', pri: 10, sub: home.exact ? 'near ' + home.place : 'your time zone', occluders: [{ c: [0, 0, 0], r: 0.999 }],
      });
      this.label('Earth', [0, 0, 0], [8.35, 8.75, 9.85, 10.3], { r: 1, pri: 6, cls: 'you', sub: 'you are here' });
      this.label('Moon', () => CA.world.moon, [8.05, 8.45, 9.9, 10.35], { r: 0.2727, pri: 5, sub: '384,400 km', occluders: [{ c: [0, 0, 0], r: 1 }] });
      this.ready = true;
    }

    update(G) {
      const W = CA.world;
      const g = W.gmst;
      const ex = CA.sceneToEarthFixed([1, 0, 0], g), ey = CA.sceneToEarthFixed([0, 1, 0], g), ez = CA.sceneToEarthFixed([0, 0, 1], g);
      this.toEarth.set([ex[0], ex[1], ex[2], ey[0], ey[1], ey[2], ez[0], ez[1], ez[2]]);
      const L = W.local;
      this.toLocal.set([L.E[0], L.U[0], L.S[0], L.E[1], L.U[1], L.S[1], L.E[2], L.U[2], L.S[2]]);
      const m = W.moon;
      const x = v3.norm(v3.scale(m, -1));
      let zz = CA.frames.NEP;
      zz = v3.norm(v3.sub(zz, v3.scale(x, v3.dot(zz, x))));
      const y = v3.cross(zz, x);
      this.toMoon.set([x[0], y[0], zz[0], x[1], y[1], zz[1], x[2], y[2], zz[2]]);
      this.homePos = L.U;

      // Camera altitude and position relative to your spot, kept in doubles: near
      // the ground these are far below single precision at Earth's radius.
      const cp = this.cam.pos;
      const D = Math.hypot(cp[0], cp[1], cp[2]);
      this.camAlt = D - 1;
      this.camRad = [cp[0] / D, cp[1] / D, cp[2] / D];
      this.camLocal = CA.toLocal([(cp[0] - L.U[0]) * U.R_EARTH, (cp[1] - L.U[1]) * U.R_EARTH, (cp[2] - L.U[2]) * U.R_EARTH]);
      // Daylight over your head hides the stars (read by the sky and solar layers).
      const inside = 1 - CA.smoothstep(0.004, 0.02, this.camAlt);
      W.daylight = inside * CA.smoothstep(-0.12, 0.06, v3.dot(W.sunDir, L.U)) * this.opacity;
    }

    draw(gfx, G, op) {
      const gl = gfx.gl, cam = this.cam, W = CA.world, z = G.z;
      const base = gfx.camUniforms(cam);
      gfx.depth(true, true);
      gfx.blend('premul');
      for (let i = 0; i < 4; i++) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
      }
      gl.activeTexture(gl.TEXTURE0);
      const h = W.home;
      const earth = () => gfx.drawImpostor(gfx.p.earth, Object.assign({}, base, {
        u_center: [0, 0, 0], u_radius: 1.045, u_full: this.camAlt < 0.3 ? 1 : 0, u_sunDir: W.sunDir, u_toEarth: this.toEarth,
        u_toLocal: this.toLocal, u_camRad: this.camRad, u_camAlt: this.camAlt, u_camLocal: this.camLocal,
        u_invRotViewProj: cam.invRotViewProj, u_pxAngle: 2 * Math.tan(G.fovy / 2) / G.viewport[1],
        u_geoPole: GEO_POLE, u_aurora: CA.smoothstep(9.2, 8.4, z), u_homeUV: [h.lon / 360 + 0.5, 0.5 - h.lat / 180],
        u_day: 0, u_lights: 1, u_clouds: 2, u_water: 3, u_cloudShift: (W.t * 0.00012) % 1,
        u_sunI: 2.1, u_atmoGain: 3.6, u_opacity: op, u_lightsGain: 3.2, u_q: gfx.q,
      }));
      const moon = () => gfx.drawImpostor(gfx.p.moon, Object.assign({}, base, {
        u_center: W.moon, u_radius: 0.2727, u_full: 0, u_sunDir: W.sunDir, u_earthDir: v3.norm(v3.scale(W.moon, -1)),
        u_toMoon: this.toMoon, u_sunI: 2.4, u_opacity: op,
      }));
      // Inside the atmosphere the sky pass must go last so it can veil the Moon.
      if (this.camAlt < 0.3 || v3.dist(cam.pos, W.moon) > v3.len(cam.pos)) { moon(); earth(); } else { earth(); moon(); }

      // Moon's path and the beacon marking the viewer's location.
      gfx.depth(true, false);
      gfx.blend('add');
      const pathFade = CA.fadeIn([8.1, 8.6, 9.9, 10.4], z);
      if (pathFade > 0) gfx.drawLines(this.moonPath, cam, { u_width: 1.3 * G.dpr, u_gain: op * pathFade });
      const bf = CA.fadeIn([4.8, 5.4, 8.2, 8.8], z);
      if (bf > 0) {
        const p = v3.scale(this.homePos, 1 + 20 / U.R_EARTH);
        this.beaconData[0] = p[0]; this.beaconData[1] = p[1]; this.beaconData[2] = p[2];
        const pulse = 0.65 + 0.35 * Math.sin(W.t * 2.4);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.beacon.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.beaconData);
        gfx.depth(false, false);
        gfx.drawSprites(this.beacon, cam, { u_fixedPx: 9 * G.dpr, u_mode: 2, u_gain: 5.0 * op * bf * pulse });
        gfx.drawSprites(this.beacon, cam, { u_fixedPx: 2.2 * G.dpr, u_mode: 0, u_gain: 14.0 * op * bf });
      }
      gfx.depth(false, false);
    }
  }

  CA.layers.push(new EarthLayer());
})();
