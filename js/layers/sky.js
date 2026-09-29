/* Sky backdrop: the Milky Way and stars as seen from the Sun, at infinity.
 * The band is procedural, baked once into a cube map; the brightest ~130
 * stars are real and sit at their true positions, so constellations work.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { frames } = CA;

  class SkyLayer extends CA.Layer {
    constructor() {
      super({ name: 'sky', unit: 1, fade: [-1.7, -1.0, 16.5, 17.9] });
      this.skyCam = null;
    }

    *build(gfx) {
      yield* gfx.whenReady('skyBake', 'skyDraw', 'skyStars');
      const gl = gfx.gl;
      const size = Math.min(1024, gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE));
      this.cube = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cube);
      gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 1, gl.SRGB8_ALPHA8, size, size);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      const prevVp = gl.getParameter(gl.VIEWPORT);
      for (let f = 0; f < 6; f++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, this.cube, 0);
        gl.viewport(0, 0, size, size);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gfx.use(gfx.p.skyBake, {
          u_face: f,
          u_lmc: frames.lbd(280.5, -32.9, 1), u_smc: frames.lbd(302.8, -44.3, 1), u_m31: frames.lbd(121.17, -21.57, 1),
        });
        gfx.drawFullscreen();
        gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb);
        gl.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3]);
        yield 0.1;
      }
      gl.deleteFramebuffer(fb);

      // Stars: real bright ones + a procedural field concentrated to the galactic plane.
      const R = CA.makeRandom(1977);
      const out = [];
      for (const s of CA.BRIGHT_STARS) {
        const d = frames.radec(s[1], s[2], 1);
        const c = CA.kelvinToRGB(CA.spectralTemp(s[5]));
        out.push(d[0], d[1], d[2], c[0], c[1], c[2], s[3], 0);
      }
      const n = 9000;
      const lo = Math.pow(10, 0.36 * 2.2), hi = Math.pow(10, 0.36 * 7.8);
      let made = 0;
      while (made < n) {
        const d = R.dir();
        const b = Math.asin(d[1]);
        if (R.next() > 0.3 + 0.7 * Math.exp(-Math.pow(b / 0.22, 2))) continue;
        const m = Math.log10(lo + R.next() * (hi - lo)) / 0.36;
        const u = R.next();
        const T = u < 0.12 ? R.range(9000, 25000) : u < 0.55 ? R.range(5600, 8000) : u < 0.9 ? R.range(4200, 5600) : R.range(3000, 4200);
        const c = CA.kelvinToRGB(T);
        out.push(d[0], d[1], d[2], c[0], c[1], c[2], m, 0);
        made++;
      }
      this.stars = new CA.PointCloud(gfx, new Float32Array(out));

      // Constellation figures as great-circle arcs, and their names.
      const lb = new CA.LineBuilder();
      for (const [name, strokes] of CA.CONSTELLATIONS) {
        let sum = [0, 0, 0], cnt = 0;
        for (const st of strokes) {
          for (let i = 0; i + 1 < st.length; i++) {
            const a = CA.starByName(st[i]), b = CA.starByName(st[i + 1]);
            if (!a || !b) continue;
            const pa = frames.radec(a[0], a[1], 1), pb = frames.radec(b[0], b[1], 1);
            const pts = [];
            for (let k = 0; k <= 8; k++) pts.push(CA.v3.norm(CA.v3.lerp(pa, pb, k / 8)));
            // Leave a small gap at each star so the lines do not cover it.
            const trim = 0.012 / Math.max(CA.v3.dist(pa, pb), 0.024);
            const q0 = CA.v3.norm(CA.v3.lerp(pa, pb, trim)), q1 = CA.v3.norm(CA.v3.lerp(pa, pb, 1 - trim));
            pts[0] = q0; pts[8] = q1;
            lb.polyline(pts, () => [0.5, 0.66, 1.0, 0.22], false);
            sum = CA.v3.add(sum, pa); cnt++;
          }
        }
        // Names hide below the horizon and in daylight.
        const hide = (p) => {
          const W = CA.world;
          if ((W.daylight || 0) > 0.5) return true;
          return !!W.horizon && CA.v3.dot(p, W.horizon.up) < -W.horizon.dip + 0.03;
        };
        if (cnt) this.label(name, CA.v3.norm(sum), [-1.2, -0.7, 6.1, 6.6], { pri: 2, cls: 'region', hide });
      }
      this.figures = lb.build(gfx);
      this.ready = true;
    }

    camera(G) { return (this.cam = this.skyCam = CA.skyCamera(G, this.skyCam)); }

    draw(gfx, G, op) {
      const gl = gfx.gl;
      const cam = this.cam;
      gfx.depth(false, false);
      gfx.blend('add');
      // Dim the backdrop a little while the bright day side of Earth fills the view,
      // and almost completely under a daytime sky.
      const day = CA.world.daylight || 0;
      const g = op * (0.5 + 0.5 * Math.max(CA.smoothstep(7.2, 8.6, G.z), 1 - CA.smoothstep(5.2, 6.4, G.z))) * (1 - 0.97 * day);
      gfx.use(gfx.p.skyDraw, { u_invViewProj: cam.invViewProj, u_sky: 0, u_gain: g * 0.11 });
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cube);
      gfx.drawFullscreen();
      const dpr = G.dpr;
      gfx.use(gfx.p.skyStars, {
        u_view: cam.view, u_proj: cam.proj, u_magRef: 0.5, u_gain: g * 1.0,
        u_minPx: 0.55 * dpr, u_maxPx: 5.0 * dpr, u_sizeK: 1.6 * dpr, u_spikeK: 0.8,
      });
      this.stars.draw();
      // Stick figures: over your head, and around Earth, fading once we leave it.
      const fig = CA.fadeIn([-1.2, -0.7, 9.4, 10.2], G.z) * (1 - 0.6 * day);
      if (fig > 0 && CA.showGuides) gfx.drawLines(this.figures, cam, { u_width: 1.0 * dpr, u_gain: op * fig });
    }
  }

  CA.layers.push(new SkyLayer());
})();
