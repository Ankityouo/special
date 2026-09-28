/* You, in meters: a figure of light standing on your spot on Earth, under the
 * real sky at this moment (drawn by the Earth layer behind it).
 *
 * The body is a signed distance field built from ellipsoids, capsules and
 * rounded boxes, smoothly blended and ray-marched per pixel. One spec below
 * generates the GLSL and also yields the exact point on the right index
 * fingertip where the zoom continues into the skin.
 * Local frame: x east, y up, z south; the figure faces south, toward the camera,
 * its right forearm held out with the palm up.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3 } = CA;

  // [type, ...geometry, blend radius]. m: mirrored across x (legs, shoulders).
  const FIGURE = [
    { name: 'core', parts: [
      { t: 'ell', c: [0, 1.31, -0.005], r: [0.162, 0.15, 0.098] },
      { t: 'ell', c: [0, 1.13, 0.0], r: [0.132, 0.12, 0.088], k: 0.07 },
      { t: 'ell', c: [0, 0.975, -0.005], r: [0.162, 0.1, 0.098], k: 0.06 },
      { t: 'sph', c: [0.172, 1.418, -0.012], r: 0.056, k: 0.06, m: 1 },
    ] },
    { name: 'head', parts: [
      { t: 'cap', a: [0, 1.435, -0.012], b: [0, 1.545, 0.0], r: 0.05, k: 0.04 },
      { t: 'ell', c: [0, 1.618, 0.006], r: [0.074, 0.1, 0.089], k: 0.035 },
    ] },
    { name: 'armL', parts: [
      { t: 'cone', a: [0.19, 1.405, -0.012], b: [0.222, 1.12, -0.018], r1: 0.045, r2: 0.037, k: 0.03 },
      { t: 'cone', a: [0.222, 1.12, -0.018], b: [0.243, 0.87, 0.012], r1: 0.036, r2: 0.027, k: 0.015 },
      { t: 'ell', c: [0.248, 0.792, 0.022], r: [0.021, 0.07, 0.04], k: 0.025 },
    ] },
    { name: 'armR', parts: [
      { t: 'cone', a: [-0.19, 1.405, -0.012], b: [-0.214, 1.13, 0.035], r1: 0.045, r2: 0.037, k: 0.03 },
      { t: 'cone', a: [-0.214, 1.13, 0.035], b: [-0.206, 1.078, 0.31], r1: 0.036, r2: 0.027, k: 0.015 },
      { t: 'box', c: [-0.206, 1.07, 0.366], h: [0.041, 0.0125, 0.05], r: 0.011, k: 0.02 },
    ] },
    { name: 'fingers', parts: [
      { t: 'cap', a: [-0.231, 1.0715, 0.412], b: [-0.231, 1.0735, 0.486], r: 0.0088, k: 0.006, id: 'index' },
      { t: 'cap', a: [-0.2115, 1.0715, 0.414], b: [-0.2115, 1.0735, 0.495], r: 0.0091, k: 0.006 },
      { t: 'cap', a: [-0.192, 1.0715, 0.412], b: [-0.192, 1.0735, 0.488], r: 0.0087, k: 0.006 },
      { t: 'cap', a: [-0.1735, 1.0705, 0.407], b: [-0.1735, 1.0725, 0.468], r: 0.0077, k: 0.006 },
      { t: 'cap', a: [-0.246, 1.074, 0.338], b: [-0.274, 1.085, 0.402], r: 0.0105, k: 0.008 },
    ] },
    { name: 'legs', parts: [
      { t: 'cone', a: [0.09, 0.935, 0.0], b: [0.1, 0.5, 0.012], r1: 0.074, r2: 0.052, k: 0.05, m: 1 },
      { t: 'cone', a: [0.1, 0.5, 0.012], b: [0.105, 0.088, -0.008], r1: 0.05, r2: 0.034, k: 0.02, m: 1 },
      { t: 'box', c: [0.108, 0.036, 0.048], h: [0.043, 0.034, 0.112], r: 0.024, k: 0.025, m: 1 },
    ] },
  ];
  CA.FIGURE = FIGURE;

  // Where the zoom enters the skin: the pad of the right index fingertip, 13 mm
  // from its end, on the side facing up.
  const index = FIGURE[4].parts[0];
  const axis = v3.norm(v3.sub(index.b, index.a));
  const along = v3.len(v3.sub(index.b, index.a)) + index.r - 0.013;
  const onAxis = v3.madd(index.a, axis, along);
  const padN = v3.norm(v3.sub([0, 1, 0], v3.scale(axis, axis[1])));
  const PAD = v3.madd(onAxis, padN, index.r);
  CA.FINGER = { a: index.a, b: index.b, r: index.r, pad: PAD, normal: padN, axis };
  const FRAME_AT = [0, 0.92, 0.04];            // centre of the full-figure view
  CA.LEVELS[0].a = FRAME_AT;
  CA.LEVELS[1].a = v3.sub(PAD, FRAME_AT);

  // ---------------------------------------------------------------- GLSL from the spec
  const f = (x) => (Math.abs(x) < 1e-9 ? '0.0' : x.toFixed(5));
  const vec = (a) => 'vec3(' + a.map(f).join(', ') + ')';
  function partSDF(pt) {
    const P = pt.m ? 'q' : 'p';
    switch (pt.t) {
      case 'ell': return 'sdEll(' + P + ' - ' + vec(pt.c) + ', ' + vec(pt.r) + ')';
      case 'sph': return '(length(' + P + ' - ' + vec(pt.c) + ') - ' + f(pt.r) + ')';
      case 'cap': return 'sdCap(' + P + ', ' + vec(pt.a) + ', ' + vec(pt.b) + ', ' + f(pt.r) + ')';
      case 'cone': return 'sdCone(' + P + ', ' + vec(pt.a) + ', ' + vec(pt.b) + ', ' + f(pt.r1) + ', ' + f(pt.r2) + ')';
      case 'box': return 'sdRBox(' + P + ' - ' + vec(pt.c) + ', ' + vec(pt.h) + ', ' + f(pt.r) + ')';
    }
    return '1e9';
  }
  function partBound(pt) {
    const pts = [], rads = [];
    if (pt.c) { pts.push(pt.c); rads.push(Array.isArray(pt.r) ? Math.max(...pt.r) : pt.h ? v3.len(pt.h) : pt.r); }
    if (pt.a) { pts.push(pt.a, pt.b); rads.push(pt.r || pt.r1, pt.r || Math.max(pt.r1, pt.r2)); }
    const c = pts.reduce((s, q) => v3.add(s, q), [0, 0, 0]).map((x) => x / pts.length);
    let R = 0;
    pts.forEach((q, i) => { R = Math.max(R, v3.dist(q, c) + rads[i]); });
    return { c, R: R + (pt.k || 0) };
  }
  function bodyGLSL() {
    const lines = ['float body(vec3 p){', '  vec3 q = vec3(abs(p.x), p.y, p.z);', '  float d = 1e9;'];
    FIGURE.forEach((g, gi) => {
      let body = '';
      g.parts.forEach((pt) => {
        body += '    d = ' + (pt.k ? 'smin(d, ' + partSDF(pt) + ', ' + f(pt.k) + ')' : 'min(d, ' + partSDF(pt) + ')') + ';\n';
      });
      if (gi === 0) { lines.push(body); return; }
      // Skip a whole limb when p is farther from its bounding sphere than the current distance.
      const mir = g.parts.every((pt) => pt.m);
      const bs = g.parts.map(partBound);
      const c = bs.reduce((s, b) => v3.add(s, b.c), [0, 0, 0]).map((x) => x / bs.length);
      const R = Math.max(...bs.map((b) => v3.dist(b.c, c) + b.R));
      lines.push('  if (length(' + (mir ? 'q' : 'p') + ' - ' + vec(c) + ') - ' + f(R) + ' < d) {\n' + body + '  }');
    });
    lines.push('  return d;', '}');
    return lines.join('\n');
  }

  const FS = () => `
in vec3 v_rd;
uniform vec3 u_camPos, u_sunL, u_boxMin, u_boxMax;
uniform float u_opacity, u_time, u_pxAngle, u_day, u_q, u_glowGain;
out vec4 o;
${CA.GLSL.COMMON}
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float sdEll(vec3 p, vec3 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv); float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
${bodyGLSL()}
vec3 bodyNormal(vec3 p, float e){
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * body(p + k.xyy * e) + k.yyx * body(p + k.yyx * e) + k.yxy * body(p + k.yxy * e) + k.xxx * body(p + k.xxx * e));
}
void main(){
  vec3 rd = normalize(v_rd);
  vec3 ro = u_camPos;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float tG = rd.y < 0.0 ? -ro.y / rd.y : 1e20;
  vec3 inv = 1.0 / rd;
  vec3 ta = (u_boxMin - ro) * inv, tb = (u_boxMax - ro) * inv;
  vec3 tlo = min(ta, tb), thi = max(ta, tb);
  float tn = max(max(tlo.x, tlo.y), max(tlo.z, 0.0));
  float tf = min(min(thi.x, thi.y), thi.z);
  float tHit = -1.0, dmin = 1e9, tAt = 0.0;
  if (tf > tn) {
    float t = tn;
    int steps = int(mix(56.0, 120.0, u_q));
    for (int i = 0; i < 120; i++) {
      if (i >= steps || t > tf) break;
      float d = body(ro + rd * t);
      if (d < dmin) { dmin = d; tAt = t; }
      if (d < max(t * u_pxAngle * 0.35, 1e-6)) { tHit = t; break; }
      t += d * 0.92;
    }
  }
  vec3 base = vec3(0.42, 0.72, 1.0);
  if (tHit > 0.0 && tHit < tG) {
    vec3 p = ro + rd * tHit;
    float fp = tHit * u_pxAngle;
    vec3 n = bodyNormal(p, max(fp * 0.5, 2e-6));
    float ndv = clamp(dot(n, -rd), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 3.2);
    // Light flowing upward through the body.
    float flow = 0.55 + 0.45 * sin(p.y * 38.0 - u_time * 1.4 + snoise(p * 7.0 + vec3(0.0, -u_time * 0.2, 0.0)) * 2.2);
    // Motes: tiny sparks on the surface, dropped once smaller than a pixel.
    vec3 cp = p / 0.0035;
    ivec3 ci = ivec3(floor(cp));
    float h = hash3i(ci, 91u);
    vec3 cc = vec3(ci) + vec3(hash3i(ci, 92u), hash3i(ci, 93u), hash3i(ci, 94u));
    float spark = step(0.86, h) * smoothstep(0.4, 0.0, length(cp - cc)) * (0.5 + 0.5 * sin(u_time * (2.0 + h * 6.0) + h * 40.0));
    spark *= smoothstep(0.004, 0.0012, fp) * smoothstep(0.00012, 0.0004, fp);
    float sunD = max(dot(n, u_sunL), 0.0) * u_day;
    // Up close the rim narrows to a pixel or two, so it is dimmed as the figure fills the view.
    float near = smoothstep(0.0005, 0.003, fp);
    col = base * (0.09 + 0.14 * flow) + base * fres * mix(1.1, 2.1, near) + vec3(0.85, 0.95, 1.0) * pow(fres, 5.0) * mix(0.6, 1.3, near)
        + vec3(1.0, 0.95, 0.85) * sunD * 0.28 + vec3(0.85, 0.93, 1.0) * spark * 2.0;
    alpha = 0.74;
  } else if (tG < 1e19) {
    // A pool of the figure's light on the ground around its feet.
    vec3 pg = ro + rd * tG;
    float r = length(pg.xz - vec2(0.0, 0.03));
    col = base * (0.2 / (1.0 + pow(r / 0.33, 2.0)) + 0.045 / (1.0 + pow(r / 1.5, 2.0))) * u_glowGain;
  }
  // Aura hugging the silhouette.
  float w = max(0.016, tAt * u_pxAngle * 2.5);
  col += vec3(0.45, 0.75, 1.0) * exp(-max(dmin, 0.0) / w) * (tHit > 0.0 ? 0.08 : 0.3);
  o = vec4(col * u_opacity, alpha * u_opacity);
}`;

  class YouLayer extends CA.Layer {
    constructor() {
      super({ name: 'you', unit: 1, level: 'ground', fade: [-2.0, -1.4, 4.8, 5.4], bound: 12000 });
    }

    *build(gfx) {
      gfx.define('figure', CA.SH.rayVS, FS());
      yield* gfx.whenReady('figure');
      // Distance rings on the ground, labelled on the side facing the default view.
      this.rings = [];
      const toward = [Math.sin(0.35), 0, Math.cos(0.35)];
      for (const r of [1, 10, 100, 1000, 10000]) {
        const lb = new CA.LineBuilder();
        lb.circle([0, 0.004, 0], [1, 0, 0], [0, 0, 1], r, 192, [0.5, 0.72, 1.0, 0.34]);
        const zr = Math.log10(r);
        const fade = [zr - 1.0, zr - 0.55, zr + 0.75, zr + 1.2];
        this.rings.push({ geo: lb.build(gfx), fade });
        this.label(r < 1000 ? r + ' m' : r / 1000 + ' km', v3.scale(toward, r), fade, { pri: 1, cls: 'ring' });
      }
      this.beaconData = new Float32Array([0, 1.0, 0, 0.55, 0.8, 1.0, 0, 0]);
      this.beacon = new CA.SpriteSet(gfx, this.beaconData);
      this.label('You', [0, 1.84, 0.02], [-0.7, -0.2, 2.3, 3.0], { pri: 10, cls: 'you', sub: 'about 1.7 m tall · 37 trillion cells' });
      this.label('Fingertip', PAD, [-1.9, -1.45, -0.5, -0.1], { pri: 6, sub: 'where we are going' });
      this.ready = true;
    }

    draw(gfx, G, op) {
      const cam = this.cam, z = G.z, dpr = G.dpr, W = CA.world;
      gfx.depth(false, false);
      gfx.blend('add');
      if (CA.showGuides) {
        for (const r of this.rings) {
          const f = CA.fadeIn(r.fade, z);
          if (f > 0) gfx.drawLines(r.geo, cam, { u_width: 1.1 * dpr, u_gain: op * f });
        }
      }
      const day = W.daylight || 0;
      gfx.blend('premul');
      gfx.drawImpostor(gfx.p.figure, {
        u_invRotViewProj: cam.invRotViewProj, u_camPos: cam.pos, u_sunL: W.sunLocal || [0, 1, 0],
        u_boxMin: [-0.4, -0.02, -0.22], u_boxMax: [0.38, 1.78, 0.56],
        u_opacity: op, u_time: gfx.time, u_pxAngle: 2 * Math.tan(G.fovy / 2) / G.viewport[1],
        u_day: day, u_q: gfx.q, u_glowGain: 1 - 0.85 * day,
      });
      gfx.blend('add');
      const bf = CA.fadeIn([1.7, 2.5, 4.8, 5.4], z);
      if (bf > 0) {
        const pulse = 0.65 + 0.35 * Math.sin(W.t * 2.4);
        gfx.drawSprites(this.beacon, cam, { u_fixedPx: 9 * dpr, u_mode: 2, u_gain: 5.0 * op * bf * pulse });
        gfx.drawSprites(this.beacon, cam, { u_fixedPx: 2.2 * dpr, u_mode: 0, u_gain: 14.0 * op * bf });
      }
    }
  }

  CA.layers.push(new YouLayer());
})();
