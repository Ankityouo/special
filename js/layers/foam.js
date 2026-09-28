/* Below the proton: 16 orders of magnitude no experiment has reached, then the
 * Planck length. Units: Planck lengths (1.6 × 10⁻³⁵ m).
 *
 * The desert is drawn as a self-similar field of vacuum fluctuations: sparks
 * and threads at every scale, so it looks the same at every zoom (quantum
 * field theory has no preferred scale here). At the bottom the view dissolves
 * into a speculative "spacetime foam", ray-marched as an animated iridescent
 * froth. The quark we fell into stays a single point all the way down.
 */
(function () {
  'use strict';
  const CA = window.CA;

  const FS = `
in vec3 v_rd;
in vec2 v_ndc;
uniform vec3 u_camPos;
uniform float u_z, u_time, u_opacity, u_aspect, u_vac, u_foam, u_q;
out vec4 o;
${CA.GLSL.COMMON}
// One octave of the vacuum: sparse sparks (virtual pairs) and faint threads.
vec3 octave(vec2 uv, float n){
  vec3 c = vec3(0.0);
  vec2 g = uv * 7.0;
  vec2 ci = floor(g);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 cc = ivec2(ci) + ivec2(i, j) + ivec2(int(n) * 131, int(n) * 71);
    float h = hash2i(cc, 404u);
    if (h > 0.55) continue;
    vec2 pos = ci + vec2(i, j) + vec2(hash2i(cc, 405u), hash2i(cc, 406u));
    vec2 d = g - pos;
    float life = fract(u_time * (0.12 + h * 0.4) + h * 9.0);
    float blink = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.45, life);
    // A pair: two sparks drifting apart, then annihilating.
    vec2 sep = vec2(cos(h * 40.0), sin(h * 40.0)) * life * 0.18;
    float a = exp(-dot(d - sep, d - sep) * 900.0) + exp(-dot(d + sep, d + sep) * 900.0);
    vec3 col = mix(vec3(0.55, 0.45, 1.0), vec3(0.35, 0.95, 1.0), fract(h * 7.3));
    c += col * a * blink;
  }
  float th = snoise(vec3(uv * 3.0, n * 3.7 + u_time * 0.05));
  c += vec3(0.45, 0.35, 0.9) * exp(-abs(th) * 28.0) * 0.06;
  return c;
}
// Spacetime foam: the zero set of an animated field, seen as thin iridescent films.
float field(vec3 p){
  return snoise(p * 0.55 + vec3(0.0, 0.0, u_time * 0.3)) + 0.5 * snoise(p * 1.3 - vec3(u_time * 0.18, 0.0, 0.0));
}
void main(){
  vec3 col = vec3(0.0);
  vec2 uv = v_ndc * vec2(u_aspect, 1.0) * 0.5;
  if (u_vac > 0.001) {
    float e = -u_z * 0.5;                   // one octave per two decades of zoom
    float fe = fract(e), be = floor(e);
    for (int k = 0; k < 4; k++) {
      float x = float(k) + 1.0 - fe;        // 0..4: coarse to fine
      float w = sin(3.14159 * x / 4.0); w *= w;
      col += octave(uv * pow(10.0, (x - 1.0) * 0.5) * 0.6, be + float(k)) * w;
    }
    col *= u_vac;
  }
  if (u_foam > 0.001) {
    vec3 rd = normalize(v_rd);
    vec3 ro = u_camPos;
    float t = 0.02, acc = 0.0;
    vec3 film = vec3(0.0);
    int steps = int(mix(28.0, 56.0, u_q));
    float prev = field(ro);
    for (int i = 0; i < 56; i++) {
      if (i >= steps) break;
      vec3 p = ro + rd * t;
      float f = field(p);
      if (sign(f) != sign(prev)) {
        // Crossing a film: thin-film interference colours, brighter at grazing angles.
        vec3 g = vec3(field(p + vec3(0.02, 0.0, 0.0)) - f, field(p + vec3(0.0, 0.02, 0.0)) - f, field(p + vec3(0.0, 0.0, 0.02)) - f);
        float mu = abs(dot(normalize(g + 1e-6), rd));
        float ph = 2.5 / max(mu, 0.2) + f * 3.0 + t * 0.4;
        vec3 irid = 0.5 + 0.5 * cos(6.28318 * (ph + vec3(0.0, 0.33, 0.67)));
        float wgt = exp(-t * 0.45) * (0.15 + 0.85 * pow(1.0 - mu, 3.0));
        film += irid * wgt;
        acc += wgt;
      }
      prev = f;
      t += 0.11 + t * 0.07;
    }
    col += film * 0.32 * u_foam + vec3(0.2, 0.15, 0.4) * u_foam * 0.03;
  }
  o = vec4(col * u_opacity, 0.0);
}`;

  class FoamLayer extends CA.Layer {
    constructor() {
      super({ name: 'foam', unit: CA.U.PLANCK, level: 'foam', fade: [-1e9, -1e9, -16.3, -15.5], bound: 1e30 });
    }

    *build(gfx) {
      gfx.define('foam', CA.SH.rayVS, FS);
      yield* gfx.whenReady('foam');
      this.quark = new CA.SpriteSet(gfx, new Float32Array([0, 0, 0, 1.0, 0.75, 0.6, 0, 1]));
      this.label('Up quark', [0, 0, 0], [-21.5, -20.5, -17.2, -16.6], { pri: 8, sub: 'still a point, as far as anyone can tell' });
      this.label('Spacetime foam?', [0, 0, 0], [-35, -34.9, -33.6, -33.1], { pri: 8, cls: 'spec', sub: 'if space itself is grainy, this is where' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, z = G.z;
      gfx.depth(false, false);
      gfx.blend('add');
      const vac = CA.fadeIn([-34.2, -33.2, -17.2, -16.3], z);
      const foam = CA.smoothstep(-32.4, -33.8, z);
      gfx.drawImpostor(gfx.p.foam, {
        u_invRotViewProj: cam.invRotViewProj, u_camPos: cam.pos, u_z: z, u_time: gfx.time, u_opacity: op,
        u_aspect: G.aspect, u_vac: vac, u_foam: foam, u_q: gfx.q,
      });
      const qk = CA.fadeIn([-26, -22, -16.4, -15.8], z);
      if (qk > 0) gfx.drawSprites(this.quark, cam, { u_fixedPx: 5 * G.dpr, u_mode: 2, u_gain: op * qk * 3.5 });
    }
  }

  CA.layers.push(new FoamLayer());
})();
