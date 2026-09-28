/* Fingertip, in millimeters, centred on the pad of the right index finger.
 *
 * The same finger the figure of light holds out, now ray-marched with its
 * friction ridges: a whorl of ridges 0.46 mm apart with sweat pores along the
 * crests. Zooming further, the surface resolves into a mosaic of cells whose
 * layout the cell layer reproduces exactly (both hash the same grid), so the
 * dive lands inside one of them.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3 } = CA;
  const F = CA.FINGER;
  const SEED = 1234;          // cell mosaic, shared with the cell layer
  const CELL = 0.028;         // mm: skin cells about 28 µm across
  const RIDGE = 0.46;         // mm between ridges

  // Pad frame (local-frame unit vectors): u runs around the finger, v along it.
  const axis = F.axis, nrm = F.normal, side = v3.norm(v3.cross(nrm, axis));
  const toMM = (p) => v3.scale(v3.sub(p, F.pad), 1000);
  const R = F.r * 1000;

  // The cell we dive into: the mosaic seed nearest the pad centre.
  const seedAt = (i, k) => [(i + CA.hash2i(i, k, SEED)) * CELL, (k + CA.hash2i(i, k, SEED + 1)) * CELL];
  let best = null;
  for (let i = -3; i <= 2; i++) {
    for (let k = -3; k <= 2; k++) {
      const s = seedAt(i, k), d = Math.hypot(s[0] - 0.004, s[1] - 0.003);
      if (!best || d < best.d) best = { d, s, i, k };
    }
  }
  const [uc, vc] = best.s;
  CA.LEVELS[2].a = v3.add(v3.add(v3.scale(side, uc), v3.scale(axis, vc)), v3.scale(nrm, -(uc * uc) / (2 * R)));
  CA.SKIN = { SEED, CELL, uc, vc, side, axis, nrm, cell: [best.i, best.k] };

  // Nearby fingers, in mm from the pad: index, middle, ring.
  const fingers = CA.FIGURE[4].parts.slice(0, 3).map((pt) => ({ a: toMM(pt.a), b: toMM(pt.b), r: pt.r * 1000 }));

  const FS = `
in vec3 v_rd;
uniform vec3 u_camPos, u_side, u_nrm, u_axis, u_key;
uniform vec3 u_fa[3], u_fb[3];
uniform float u_fr[3];
uniform float u_opacity, u_time, u_pxAngle, u_q;
out vec4 o;
${CA.GLSL.COMMON}
const float CELL = ${CELL.toFixed(4)};
const float RIDGE = ${RIDGE.toFixed(3)};
const float AMP = 0.045;
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
// Pad coordinates of p on the index finger: (u around, v along, cos of angle from the pad).
vec3 padUV(vec3 p){
  vec3 q = p - u_fa[0];
  float t = dot(q, u_axis);
  vec3 rv = q - u_axis * t;
  float th = atan(dot(rv, u_side), dot(rv, u_nrm));
  return vec3(th * u_fr[0], t + dot(u_fa[0], u_axis), cos(th));
}
// Whorl distance plus a noise warp that is zero at the pad centre (simplex noise
// vanishes at the origin), so phase(0) = PHASE0 exactly.
const float PHASE0 = ${Math.hypot(0.8, 1.5 * 0.82).toFixed(6)};
float phase(vec2 uv){
  vec2 d = (uv - vec2(0.8, -1.5)) * vec2(1.0, 0.82);
  return length(d) + snoise2(uv * 0.28) * 0.45 + snoise2(uv * 0.9) * 0.12;
}
float padMask(vec3 w){ return smoothstep(0.05, 0.45, w.z) * smoothstep(-17.0, -12.0, w.y) * smoothstep(9.0, 6.0, w.y); }
// 0 in valleys, 1 on crests; the pad centre sits exactly on a crest.
float ridge01(vec2 uv){
  float ph = (phase(uv) - PHASE0) / RIDGE;
  // Occasional breaks make ridge endings and islands, like real minutiae.
  float brk = smoothstep(-0.75, -0.55, snoise2(uv * 1.7 + 11.0));
  return (0.5 + 0.5 * cos(6.2831853 * ph)) * mix(0.35, 1.0, brk);
}
float map(vec3 p){
  float d = sdCap(p, u_fa[0], u_fb[0], u_fr[0]);
  if (d < 0.25) {
    vec3 w = padUV(p);
    float m = padMask(w);
    if (m > 0.0) d -= AMP * (ridge01(w.xy) - 1.0) * m;
  }
  d = min(d, sdCap(p, u_fa[1], u_fb[1], u_fr[1]));
  d = min(d, sdCap(p, u_fa[2], u_fb[2], u_fr[2]));
  return d;
}
vec3 normalAt(vec3 p, float e){
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}
void main(){
  vec3 rd = normalize(v_rd);
  vec3 ro = u_camPos;
  float t = 0.0, tHit = -1.0, dmin = 1e9, tAt = 0.0;
  int steps = int(mix(60.0, 140.0, u_q));
  for (int i = 0; i < 140; i++) {
    if (i >= steps || t > 400.0) break;
    float d = map(ro + rd * t);
    if (d < dmin) { dmin = d; tAt = t; }
    float eps = max(t * u_pxAngle * 0.35, 1e-7);
    if (d < eps) { tHit = t; break; }
    t += d * 0.72;
  }
  vec3 base = vec3(0.42, 0.72, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (tHit > 0.0) {
    vec3 p = ro + rd * tHit;
    float fp = max(tHit * u_pxAngle, 1e-7);
    vec3 n = normalAt(p, max(fp * 0.5, 1e-6));
    vec3 w = padUV(p);
    float m = padMask(w);
    float r01 = m > 0.0 ? ridge01(w.xy) : 0.6;
    float ndv = clamp(dot(n, -rd), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 3.0);
    float diff = max(dot(n, u_key), 0.0);
    // Sweat pores along the crests, fading out once smaller than a pixel.
    ivec2 pc;
    vec3 pv = voronoi2(w.xy / 0.42, 57u, pc);
    float poreK = smoothstep(0.02, 0.006, fp) * m;
    float pore = smoothstep(0.13, 0.07, pv.x) * smoothstep(0.55, 0.9, r01) * poreK;
    float poreRim = smoothstep(0.2, 0.13, pv.x) * smoothstep(0.07, 0.12, pv.x) * smoothstep(0.55, 0.9, r01) * poreK;
    col = base * (0.05 + 0.32 * r01 * m + 0.12 * (1.0 - m) + 0.3 * diff) + base * fres * 1.3;
    col = col * (1.0 - 0.85 * pore) + vec3(0.7, 0.9, 1.0) * poreRim * 0.35;
    // Skin cells: membranes and nuclei in fluorescence colours, as the cell layer draws them.
    float cellK = smoothstep(0.009, 0.0025, fp);
    if (cellK > 0.0) {
      ivec2 cc;
      vec3 cv = voronoi2(w.xy / CELL, ${SEED}u, cc);
      float lw = max(0.035, fp / CELL * 1.2);
      float mem = 1.0 - smoothstep(0.0, lw, cv.y - cv.x);
      vec2 seed = (vec2(cc) + vec2(hash2i(cc, ${SEED}u), hash2i(cc, ${SEED + 1}u))) * CELL;
      vec2 nuc = seed + (vec2(hash2i(cc, 71u), hash2i(cc, 72u)) - 0.5) * CELL * 0.18;
      float nd = length(w.xy - nuc) / (CELL * 0.2);
      float nucleus = exp(-nd * nd * 1.6);
      col = mix(col, col * 0.4, cellK * 0.6);
      col += cellK * (vec3(0.2, 0.95, 0.72) * mem * 0.9 + vec3(0.42, 0.34, 1.0) * nucleus * 0.55);
    }
    alpha = 1.0;
  }
  // Soft glow around the finger's silhouette, like the figure's aura.
  col += base * exp(-max(dmin, 0.0) / max(0.4, tAt * u_pxAngle * 3.0)) * (tHit > 0.0 ? 0.0 : 0.22);
  o = vec4(col * u_opacity, alpha * u_opacity);
}`;

  class SkinLayer extends CA.Layer {
    constructor() {
      super({ name: 'skin', unit: 1e-3, level: 'skin', fade: [-4.6, -4.0, -1.5, -0.95], bound: 120 });
    }

    *build(gfx) {
      gfx.define('skin', CA.SH.rayVS, FS);
      yield* gfx.whenReady('skin');
      this.fa = [].concat(...fingers.map((f) => f.a));
      this.fb = [].concat(...fingers.map((f) => f.b));
      this.fr = fingers.map((f) => f.r);
      this.label('Friction ridges', v3.add(v3.scale(side, -1.3), v3.scale(axis, -0.4)), [-3.0, -2.75, -1.95, -1.6], { pri: 4, sub: '0.46 mm apart' });
      this.label('Skin cells', v3.scale(side, 0.09), [-4.0, -3.7, -3.25, -3.0], { pri: 4, sub: 'about 28 µm across' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam;
      gfx.depth(false, false);
      gfx.blend('premul');
      const key = v3.norm([-0.35, 0.85, 0.4]);
      gfx.drawImpostor(gfx.p.skin, {
        u_invRotViewProj: cam.invRotViewProj, u_camPos: cam.pos, u_side: side, u_nrm: nrm, u_axis: axis, u_key: key,
        u_fa: this.fa, u_fb: this.fb, u_fr: this.fr,
        u_opacity: op, u_time: gfx.time, u_pxAngle: 2 * Math.tan(G.fovy / 2) / G.viewport[1], u_q: gfx.q,
      });
    }
  }

  CA.layers.push(new SkinLayer());
})();
