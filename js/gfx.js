/* Cosmic Address — WebGL2 engine.
 * Shader library, geometry containers (points, instanced sprites, instanced
 * anti-aliased line segments, sphere impostors) and an HDR post chain
 * (13-tap downsample / tent upsample bloom, ACES tonemap, grain, vignette).
 */
(function () {
  'use strict';
  const CA = window.CA;

  const HEADER = '#version 300 es\nprecision highp float;\nprecision highp int;\n';

  // ------------------------------------------------------------------ shared GLSL
  const COMMON = `
#define PI 3.141592653589793
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * snoise(p); n += a;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s / n;
}
// Ray/sphere intersection (sphere at origin). Returns (tNear, tFar) or (1e20, -1e20) on miss.
vec2 raySphere(vec3 ro, vec3 rd, float r){
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e20, -1e20);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
// 2D simplex noise (Ashima / McEwan), range about -1..1.
vec3 permute3(vec3 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec2 mod289v2(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
float snoise2(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
// Integer hash; hash2i matches CA.hash2i in JavaScript bit for bit.
uint hashu(uint x){ x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float hash2i(ivec2 c, uint seed){ return float(hashu((uint(c.x) * 1597334677u) ^ (uint(c.y) * 0x3c6ef372u) ^ seed) >> 8u) / 16777216.0; }
float hash3i(ivec3 c, uint seed){ return float(hashu((uint(c.x) * 1597334677u) ^ (uint(c.y) * 0x3c6ef372u) ^ (uint(c.z) * 0x9e3779b9u) ^ seed) >> 8u) / 16777216.0; }
// Nearest and second-nearest feature distances of a jittered-grid Voronoi (F1, F2), plus the cell id.
vec3 voronoi2(vec2 p, uint seed, out ivec2 cell){
  vec2 ip = floor(p);
  float d1 = 1e9, d2 = 1e9;
  cell = ivec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 c = ivec2(ip) + ivec2(i, j);
    vec2 s = vec2(c) + vec2(hash2i(c, seed), hash2i(c, seed + 1u));
    float d = length(s - p);
    if (d < d1) { d2 = d1; d1 = d; cell = c; } else if (d < d2) { d2 = d; }
  }
  return vec3(d1, d2, 0.0);
}
// Bump mapping without tangents (Mikkelsen): perturb n by a height field h over surface points pos.
vec3 bumpNormal(vec3 n, vec3 pos, float h){
  vec3 dpdx = dFdx(pos), dpdy = dFdy(pos);
  float dhdx = dFdx(h), dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  if (abs(det) < 1e-30) return n;
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * n - grad);
}
`;

  // ------------------------------------------------------------------ shaders
  const SH = {};
  CA.GLSL = { COMMON };
  CA.SH = SH;

  // Fullscreen pass that hands each pixel its exact view direction (rotation-only
  // matrices), for ray-marched layers.
  SH.rayVS = `
layout(location=0) in vec2 a_corner;
uniform mat4 u_invRotViewProj;
out vec3 v_rd;
out vec2 v_ndc;
void main(){
  vec4 w = u_invRotViewProj * vec4(a_corner, 1.0, 1.0);
  v_rd = w.xyz / w.w;
  v_ndc = a_corner;
  gl_Position = vec4(a_corner, 0.0, 1.0);
}`;

  // Particle clouds as point sprites. Size is a world radius; brightness is a
  // surface brightness, so distant particles fade (flux-conserving clamp).
  SH.pointsVS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
layout(location=2) in float a_size;
uniform mat4 u_view, u_proj;
uniform float u_pxScale, u_minPx, u_maxPx, u_gain, u_sizeMul, u_constFlux, u_twinkle, u_time;
uniform vec3 u_fadeCenter;
uniform float u_fadeR0, u_fadeR1, u_slabDepth, u_slabWidth;
out vec3 v_col;
void main(){
  vec4 vp = u_view * vec4(a_pos, 1.0);
  float dist = -vp.z;
  if (dist <= 1e-9) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; v_col = vec3(0.0); return; }
  float r = a_size * u_sizeMul * u_pxScale / dist;
  float rc = clamp(r, u_minPx, u_maxPx);
  float flux = u_constFlux > 0.5 ? 1.0 : min(1.0, (r * r) / (rc * rc));
  float nearFade = 1.0 - smoothstep(u_maxPx * 0.8, u_maxPx * 3.0, r);
  if (u_constFlux > 0.5) nearFade = 1.0;
  if (u_constFlux > 1.5) rc = a_size * u_sizeMul;   // a_size is a pixel radius
  float radial = 1.0;
  if (u_fadeR1 > 0.0) radial = 1.0 - smoothstep(u_fadeR0, u_fadeR1, length(a_pos - u_fadeCenter));
  if (u_slabWidth > 0.0) { float s = (dist - u_slabDepth) / u_slabWidth; radial *= exp(-s * s); }
  // Optional flicker; a_col.a carries each point's phase.
  float tw = u_twinkle > 0.0 ? 1.0 - u_twinkle * (0.5 + 0.5 * sin(u_time * (1.3 + fract(a_col.a * 13.7) * 4.0) + a_col.a * 6.2831853)) : 1.0;
  v_col = a_col.rgb * (u_gain * flux * nearFade * radial * tw);
  if (nearFade * radial < 0.003) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  gl_Position = u_proj * vp;
  gl_PointSize = rc * 4.0;
}`;
  SH.pointsFS = `
in vec3 v_col;
uniform int u_mode;
out vec4 o;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float a;
  if (u_mode == 2) a = 1.0 - smoothstep(0.18, 0.28, d2) + 0.25 * exp(-d2 * 5.0);
  else a = (exp(-d2 * 4.0) - 0.0183) * 1.0187;
  o = vec4(v_col * a, u_mode == 1 ? 0.0 : 1.0);
}`;

  // Point-source stars in 3D (a_col.a = log10 luminosity in solar units).
  SH.starsVS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
layout(location=2) in float a_size;
uniform mat4 u_view, u_proj;
uniform float u_logRef, u_gain, u_minPx, u_maxPx, u_sizeK, u_spikeK;
uniform float u_fadeNear;
out vec3 v_col;
out float v_spike;
void main(){
  vec4 vp = u_view * vec4(a_pos, 1.0);
  if (vp.z > -1e-9) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; v_col = vec3(0.0); v_spike = 0.0; return; }
  float d2 = dot(vp.xyz, vp.xyz);
  float lf = a_col.a - 0.30103 * log2(d2) - u_logRef + a_size;
  float b = exp2(lf * 1.3952);               // 10^(0.42 lf): compressive
  float rc = clamp(u_sizeK * sqrt(b), u_minPx, u_maxPx);
  float inten = b * u_sizeK * u_sizeK / (rc * rc);
  float nf = u_fadeNear > 0.0 ? smoothstep(u_fadeNear * 0.3, u_fadeNear, sqrt(d2)) : 1.0;
  v_col = a_col.rgb * min(inten, 30.0) * u_gain * nf;
  v_spike = u_spikeK * smoothstep(u_maxPx * 0.35, u_maxPx * 0.9, rc);
  gl_PointSize = rc * 6.0;
  gl_Position = u_proj * vp;
}`;
  // Stars at infinity (a_pos = direction, a_col.a = apparent magnitude).
  SH.skyStarsVS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
layout(location=2) in float a_size;
uniform mat4 u_view, u_proj;
uniform float u_magRef, u_gain, u_minPx, u_maxPx, u_sizeK, u_spikeK;
out vec3 v_col;
out float v_spike;
void main(){
  vec4 vp = vec4((u_view * vec4(a_pos, 0.0)).xyz, 1.0);
  if (vp.z > -1e-6) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; v_col = vec3(0.0); v_spike = 0.0; return; }
  float b = exp2(-(a_col.a - u_magRef) * 0.4 * 3.321928 * 0.85);
  float rc = clamp(u_sizeK * sqrt(b), u_minPx, u_maxPx);
  float inten = b * u_sizeK * u_sizeK / (rc * rc);
  v_col = a_col.rgb * min(inten, 30.0) * u_gain;
  v_spike = u_spikeK * smoothstep(u_maxPx * 0.45, u_maxPx, rc);
  gl_PointSize = rc * 6.0;
  vec4 cp = u_proj * vp;
  gl_Position = vec4(cp.xy, cp.w * 0.99999, cp.w);
}`;
  SH.starsFS = `
in vec3 v_col;
in float v_spike;
out vec4 o;
void main(){
  vec2 p = (gl_PointCoord * 2.0 - 1.0) * 3.0;
  float d2 = dot(p, p);
  if (d2 > 9.0) discard;
  float edge = 1.0 - d2 / 9.0;
  float core = exp(-d2 * 1.7);
  float halo = 0.03 / (0.25 + d2) * edge;
  float sp = 0.0;
  if (v_spike > 0.0) {
    float ax = abs(p.x), ay = abs(p.y);
    sp = (exp(-ay * 6.0 - ax * 0.9) + exp(-ax * 6.0 - ay * 0.9)) * 0.35 * v_spike * edge;
  }
  o = vec4(v_col * (core + halo + sp), 1.0);
}`;

  // Instanced camera-facing quads (big glows, nebulae, galaxies, dust).
  SH.spritesVS = `
layout(location=0) in vec2 a_corner;
layout(location=1) in vec3 a_pos;
layout(location=2) in vec4 a_col;
layout(location=3) in float a_size;
uniform mat4 u_view, u_proj;
uniform float u_pxScale, u_minPx, u_maxPx, u_gain, u_fixedPx;
out vec2 v_uv;
out vec3 v_col;
out float v_param;
void main(){
  vec4 vp = u_view * vec4(a_pos, 1.0);
  float dist = -vp.z;
  if (dist <= 1e-9) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_col = vec3(0.0); v_uv = vec2(0.0); v_param = 0.0; return; }
  float r = a_size * u_pxScale / dist;
  float rc = clamp(r, u_minPx, u_maxPx);
  float flux = min(1.0, (r * r) / (rc * rc));
  float nearFade = 1.0 - smoothstep(u_maxPx * 0.9, u_maxPx * 2.5, r);
  if (u_fixedPx > 0.0) { rc = u_fixedPx; flux = 1.0; nearFade = 1.0; }
  float wr = rc * dist / u_pxScale;
  vp.xy += a_corner * wr;
  v_uv = a_corner;
  v_col = a_col.rgb * (u_gain * flux * nearFade);
  v_param = a_col.a;
  gl_Position = u_proj * vp;
}`;
  SH.spritesFS = `
in vec2 v_uv;
in vec3 v_col;
in float v_param;
uniform int u_mode;
uniform float u_time;
out vec4 o;
${COMMON}
void main(){
  float d2 = dot(v_uv, v_uv);
  if (d2 > 1.0) discard;
  float edge = 1.0 - smoothstep(0.7, 1.0, d2);
  float a;
  if (u_mode == 1) {            // absorption
    a = (exp(-d2 * 3.0) - 0.0498) * 1.052;
    o = vec4(v_col * a, 0.0);
    return;
  } else if (u_mode == 2) {     // glow
    a = (1.0 / (1.0 + d2 * 60.0) + 0.25 * exp(-d2 * 8.0)) * edge;
  } else if (u_mode == 3) {     // turbulent nebula
    vec3 q = vec3(v_uv * 1.7, v_param * 17.0);
    float n = fbm(q + vec3(0.0, 0.0, u_time * 0.01), 5);
    float w = fbm(q * 2.3 + 4.0, 3);
    a = exp(-d2 * 2.4) * clamp(0.55 + 1.6 * n + 0.5 * w, 0.0, 2.5) * edge;
  } else {                      // gaussian
    a = (exp(-d2 * 4.0) - 0.0183) * 1.0187;
  }
  o = vec4(v_col * a, 1.0);
}`;

  // Ray-traced sphere impostors (atoms, nucleons): exact silhouettes and depth,
  // lit in view space; spheres smaller than a pixel keep a minimum footprint and
  // dim to conserve their light. a_col.a = ambient occlusion (1 open, 0 buried).
  SH.spheresVS = `
layout(location=0) in vec2 a_corner;
layout(location=1) in vec3 a_pos;
layout(location=2) in vec4 a_col;
layout(location=3) in float a_size;
uniform mat4 u_view, u_proj;
uniform float u_pxScale, u_minPx, u_radMul, u_cullR, u_focusD, u_nearFade;
out vec3 v_c;
out vec3 v_q;
out float v_r;
out vec3 v_col;
out float v_ao;
out float v_flux;
void main(){
  vec4 c = u_view * vec4(a_pos, 1.0);
  float r = a_size * u_radMul;
  float dist = -c.z;
  v_col = a_col.rgb; v_ao = a_col.a;
  // Beyond u_cullR of the focus a sphere fades out and is skipped: far behind a
  // close-up atom, thousands of others would only add overdraw.
  float fd = u_cullR > 0.0 ? length(c.xyz - vec3(0.0, 0.0, -u_focusD)) / u_cullR : 0.0;
  if (dist <= r * 1.02 || fd > 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_r = 0.0; v_c = vec3(0.0); v_q = vec3(0.0); v_flux = 0.0; return; }
  float rpx = r * u_pxScale / dist;
  float grow = max(1.0, u_minPx / max(rpx, 1e-6));
  float R = r * grow;
  // Spheres crowding the camera (between it and the focus) fade out of the way.
  v_flux = 1.0 / (grow * grow) * (1.0 - smoothstep(0.7, 1.0, fd)) * (u_nearFade > 0.0 ? smoothstep(u_nearFade * 0.45, u_nearFade, dist) : 1.0);
  if (v_flux < 0.004) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_r = 0.0; return; }
  float k = R * dist / sqrt(max(dist * dist - R * R, 1e-20)) * 1.04;
  vec3 q = c.xyz + vec3(a_corner * k, 0.0);
  v_c = c.xyz; v_q = q; v_r = R;
  gl_Position = u_proj * vec4(q, 1.0);
}`;
  SH.spheresFS = `
in vec3 v_c;
in vec3 v_q;
in float v_r;
in vec3 v_col;
in float v_ao;
in float v_flux;
uniform mat4 u_proj;
uniform vec3 u_light;
uniform float u_gain, u_opacity, u_emit;
out vec4 o;
void main(){
  if (v_r <= 0.0) discard;
  vec3 rd = normalize(v_q);
  float b = dot(rd, v_c);
  float c = dot(v_c, v_c) - v_r * v_r;
  float h = b * b - c;
  if (h < 0.0) discard;
  float t = b - sqrt(h);
  vec3 p = rd * t;
  vec3 n = (p - v_c) / v_r;
  float diff = max(dot(n, u_light), 0.0);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
  float spec = pow(max(dot(reflect(-u_light, n), -rd), 0.0), 28.0);
  float ao = mix(0.3, 1.0, v_ao);
  vec3 col = v_col * ((0.1 + 0.85 * diff) * ao + u_emit) + v_col * rim * 0.4 + vec3(spec) * 0.3 * ao;
  vec4 clip = u_proj * vec4(p, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  o = vec4(col * u_gain * v_flux * u_opacity, u_opacity);
}`;

  // Instanced anti-aliased line segments with optional traveling dashes.
  SH.linesVS = `
layout(location=0) in vec2 a_corner;   // x: 0/1 endpoint, y: -1/1 side
layout(location=1) in vec4 a_p0;       // xyz, t (arc parameter)
layout(location=2) in vec4 a_p1;
layout(location=3) in vec4 a_c0;
layout(location=4) in vec4 a_c1;
uniform mat4 u_viewProj;
uniform vec2 u_viewport;
uniform float u_width, u_near, u_gain;
out vec4 v_col;
out float v_side;
out float v_halfW;
out float v_t;
void main(){
  vec4 c0 = u_viewProj * vec4(a_p0.xyz, 1.0);
  vec4 c1 = u_viewProj * vec4(a_p1.xyz, 1.0);
  float e = u_near;
  if (c0.w < e && c1.w < e) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); v_col = vec4(0.0); v_side = 0.0; v_halfW = 1.0; v_t = 0.0; return; }
  float t0 = a_p0.w, t1 = a_p1.w;
  if (c0.w < e) { float k = (e - c0.w) / (c1.w - c0.w); c0 = mix(c0, c1, k); t0 = mix(t0, t1, k); }
  if (c1.w < e) { float k = (e - c1.w) / (c0.w - c1.w); c1 = mix(c1, c0, k); t1 = mix(t1, t0, k); }
  vec2 s0 = c0.xy / c0.w * 0.5 * u_viewport;
  vec2 s1 = c1.xy / c1.w * 0.5 * u_viewport;
  vec2 d = s1 - s0;
  float len = length(d);
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  bool second = a_corner.x > 0.5;
  vec4 c = second ? c1 : c0;
  vec2 s = second ? s1 : s0;
  float halfW = u_width * 0.5 + 1.0;
  s += nrm * a_corner.y * halfW + dir * (second ? 1.0 : -1.0);
  gl_Position = vec4(s / (0.5 * u_viewport) * c.w, c.z, c.w);
  v_side = a_corner.y * halfW;
  v_halfW = u_width * 0.5;
  v_col = (second ? a_c1 : a_c0) * vec4(vec3(u_gain), 1.0);
  v_t = second ? t1 : t0;
}`;
  SH.linesFS = `
in vec4 v_col;
in float v_side;
in float v_halfW;
in float v_t;
uniform float u_dash, u_dashSpeed, u_time;
out vec4 o;
void main(){
  float d = abs(v_side);
  float a = clamp(v_halfW + 0.5 - d, 0.0, 1.0);
  if (v_halfW < 0.5) a *= v_halfW * 2.0;
  float dash = 1.0;
  if (u_dash > 0.0) {
    float f = fract(v_t * u_dash - u_time * u_dashSpeed);
    dash = 0.12 + pow(f, 5.0) * 2.2;
  }
  o = vec4(v_col.rgb * v_col.a * a * dash, 0.0);
}`;

  // Impostor quad covering the silhouette of a sphere (or fullscreen if inside).
  SH.impostorVS = `
layout(location=0) in vec2 a_corner;
uniform mat4 u_viewProj, u_invViewProj;
uniform vec3 u_camPos, u_center, u_camUp;
uniform float u_radius;
uniform int u_full;
out vec3 v_wp;
void main(){
  if (u_full == 1) {
    vec4 w = u_invViewProj * vec4(a_corner, 1.0, 1.0);
    v_wp = w.xyz / w.w;
    gl_Position = vec4(a_corner, 0.99999, 1.0);
    return;
  }
  vec3 toCam = u_camPos - u_center;
  float D = length(toCam);
  vec3 f = toCam / D;
  vec3 up = abs(dot(u_camUp, f)) > 0.99 ? vec3(1.0, 0.0, 0.0) : u_camUp;
  vec3 r = normalize(cross(up, f));
  vec3 u = cross(f, r);
  float R = u_radius;
  float k = D > R * 1.0001 ? R * D / sqrt(D * D - R * R) : R * 1000.0;
  k *= 1.03;
  vec3 wp = u_center + (r * a_corner.x + u * a_corner.y) * k;
  v_wp = wp;
  gl_Position = u_viewProj * vec4(wp, 1.0);
}`;

  // Earth's impostor also passes the view ray; in fullscreen mode (camera in or
  // near the atmosphere) the ray comes from a rotation-only matrix, so it stays
  // exact however close the camera is to the ground.
  SH.earthVS = `
layout(location=0) in vec2 a_corner;
uniform mat4 u_viewProj, u_invRotViewProj;
uniform vec3 u_camPos, u_center, u_camUp;
uniform float u_radius;
uniform int u_full;
out vec3 v_rd;
void main(){
  if (u_full == 1) {
    vec4 w = u_invRotViewProj * vec4(a_corner, 1.0, 1.0);
    v_rd = w.xyz / w.w;
    gl_Position = vec4(a_corner, 0.99999, 1.0);
    return;
  }
  vec3 toCam = u_camPos - u_center;
  float D = length(toCam);
  vec3 f = toCam / D;
  vec3 up = abs(dot(u_camUp, f)) > 0.99 ? vec3(1.0, 0.0, 0.0) : u_camUp;
  vec3 r = normalize(cross(up, f));
  vec3 u = cross(f, r);
  float R = u_radius;
  float k = R * D / sqrt(max(D * D - R * R, 1e-6)) * 1.03;
  vec3 wp = u_center + (r * a_corner.x + u * a_corner.y) * k;
  v_rd = wp - u_camPos;
  gl_Position = u_viewProj * vec4(wp, 1.0);
}`;

  // Earth: Blue Marble day map, city lights, clouds on a deck 6 km up, ocean
  // glint, aurora and a single-scattering atmosphere (Rayleigh, Mie, ozone), all
  // ray-traced per pixel from the camera. Close to the ground, band-limited
  // noise in local meters adds terrain, coastlines, waves, cloud edges and
  // streets that the satellite maps are far too coarse to show.
  SH.earthFS = `
in vec3 v_rd;
uniform vec3 u_camPos, u_camRad, u_sunDir, u_camLocal, u_geoPole;
uniform float u_camAlt;
uniform mat4 u_viewProj;
uniform mat3 u_toEarth, u_toLocal;
uniform sampler2D u_day, u_lights, u_clouds, u_water;
uniform float u_cloudShift, u_sunI, u_atmoGain, u_opacity, u_lightsGain, u_pxAngle, u_time, u_aurora, u_q;
uniform vec2 u_homeUV;
out vec4 o;
${COMMON}
const float RA = 1.025;
const float RX = 1.045;       // outer edge of the aurora
const float HR = 0.0032;
const float HM = 0.0006;
const vec3 BR = vec3(14.8, 34.4, 84.4);
const float BM = 36.0;
const vec3 BO = vec3(3.1, 8.75, 0.4);   // ozone absorption (follows the Rayleigh profile)
const float HC = 0.0009;                // cloud deck altitude
const float REM = 6371000.0;

vec4 texEq(sampler2D t, vec3 q, float shift){
  float lon = atan(q.y, q.x);
  float lat = asin(clamp(q.z, -1.0, 1.0));
  float u = lon / (2.0 * PI) + 0.5 + shift;
  float v = 0.5 - lat / PI;
  float u1 = fract(u);
  float u2 = fract(u + 0.5) - 0.5;
  float dx1 = dFdx(u1), dx2 = dFdx(u2), dy1 = dFdy(u1), dy2 = dFdy(u2);
  vec2 ddx = vec2(abs(dx1) < abs(dx2) ? dx1 : dx2, dFdx(v));
  vec2 ddy = vec2(abs(dy1) < abs(dy2) ? dy1 : dy2, dFdy(v));
  return textureGrad(t, vec2(u1, v), ddx, ddy);
}

// Optical depth to space from height h (in scale heights) along cos(zenith) mu,
// in units of scale height x density: Schüler's Chapman-function approximation.
float chapman(float X, float h, float mu){
  float c = sqrt(X + h);
  if (mu >= 0.0) return c / (c * mu + 1.0) * exp(-h);
  float x0 = sqrt(1.0 - mu * mu) * (X + h);
  float c0 = sqrt(x0);
  return 2.0 * c0 * exp(X - x0) - c / (1.0 - c * mu) * exp(-h);
}
// Transmittance of sunlight reaching a point at radius r (0 if the planet is in the way).
vec3 sunTrans(float r, float mu){
  if (mu < -sqrt(max(1.0 - 1.0 / (r * r), 0.0))) return vec3(0.0);
  float h = max(r - 1.0, 0.0);
  float oR = HR * chapman(1.0 / HR, h / HR, mu);
  float oM = HM * chapman(1.0 / HM, h / HM, mu);
  return exp(-((BR + BO) * oR + BM * 1.1 * oM));
}

// Single scattering along [t0, t1]. Samples crowd toward the dense end of the ray.
// At tMark (a cloud) it also returns the light scattered in front of it (Sm) and
// the transmittance to it (Tm).
vec3 inscatter(vec3 ro, vec3 rd, float t0, float t1, vec3 L, float jit, int dense, float tMark,
               out vec3 T, out vec3 Sm, out vec3 Tm){
  int N = int(mix(8.0, 16.0, u_q));
  float mu = dot(rd, L);
  float pr = 0.0596831 * (1.0 + mu * mu);
  const float g = 0.76;
  float pm = 0.1193662 * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  float span = t1 - t0;
  bool marked = false;
  Sm = vec3(0.0); Tm = vec3(1.0);
  for (int i = 0; i < 16; i++) {
    if (i >= N) break;
    float x = (float(i) + jit) / float(N);
    float s, w;
    if (dense == 1) { s = x * x; w = 2.0 * x; }                          // near the camera
    else if (dense == 2) { s = 1.0 - (1.0 - x) * (1.0 - x); w = 2.0 * (1.0 - x); } // near the far end
    else { s = x; w = 1.0; }
    float t = t0 + span * s;
    float ds = span * w / float(N);
    if (!marked && t > tMark) {
      marked = true;
      Sm = sumR * BR * pr + sumM * BM * pm;
      Tm = exp(-((BR + BO) * odR + BM * 1.1 * odM));
    }
    vec3 p = ro + rd * t;
    float r = length(p);
    float h = max(r - 1.0, 0.0);
    float dR = exp(-h / HR) * ds;
    float dM = exp(-h / HM) * ds;
    odR += dR * 0.5; odM += dM * 0.5;
    vec3 tv = exp(-((BR + BO) * odR + BM * 1.1 * odM));
    vec3 ts = sunTrans(r, dot(p, L) / r);
    sumR += dR * ts * tv;
    sumM += dM * ts * tv;
    odR += dR * 0.5; odM += dM * 0.5;
  }
  T = exp(-((BR + BO) * odR + BM * 1.1 * odM));
  if (!marked) { Sm = sumR * BR * pr + sumM * BM * pm; Tm = T; }
  return sumR * BR * pr + sumM * BM * pm;
}

// Band-limited fractal detail over local ground coordinates (meters): x = albedo
// variation, y = relief height (m). Octaves finer than a few pixels fade out, so
// distant ground keeps the plain satellite colours.
vec2 groundDetail(vec2 p, float fp){
  float v = 0.0, h = 0.0, w = 6000.0, a = 1.0;
  int oct = int(mix(10.0, 18.0, u_q));
  for (int i = 0; i < 18; i++) {
    if (i >= oct) break;
    float k = smoothstep(fp * 2.5, fp * 7.0, w);
    if (k <= 0.0) break;
    float n = snoise2(p / w + vec2(float(i) * 17.31, float(i) * -9.73));
    v += n * a * k;
    h += n * w * 0.03 * k;
    w *= 0.5; a *= 0.82;
  }
  return vec2(v * 0.16, h);
}
float cloudDetail(vec2 p, float fp){
  float v = 0.0, w = 9000.0, a = 1.0, n = 0.0;
  int oct = int(mix(5.0, 9.0, u_q));
  for (int i = 0; i < 9; i++) {
    if (i >= oct) break;
    float k = smoothstep(fp * 2.0, fp * 6.0, w);
    if (k <= 0.0) break;
    v += snoise2(p / w + vec2(float(i) * 5.1, 3.7)) * a * k;
    n += a;
    w *= 0.5; a *= 0.6;
  }
  return n > 0.0 ? v / 1.6 : 0.0;
}
// Night-time city texture with mean ~1: districts of rotated street grids,
// anti-aliased against the pixel footprint fp (meters) so it never sparkles.
float cityPattern(vec2 p, float fp){
  ivec2 dc;
  vec3 dv = voronoi2(p / 1300.0, 5u, dc);
  float ang = hash2i(dc, 21u) * 3.14159;
  float B = mix(70.0, 190.0, hash2i(dc, 22u));          // block size
  float bright = 0.06 + 1.5 * smoothstep(-0.45, 0.55, snoise2(p / 2600.0 + 7.1)); // parks, rivers and bright centres
  vec2 cs = vec2(cos(ang), sin(ang));
  vec2 u = vec2(dot(p, cs), dot(p, vec2(-cs.y, cs.x))) / B + vec2(hash2i(dc, 23u), hash2i(dc, 24u));
  vec2 f = fract(u);
  ivec2 bc = ivec2(floor(u));
  vec2 dd = min(f, 1.0 - f) * B;                         // distance to streets, meters
  bool majorX = (bc.x % 4 == 0 && f.x < 0.5) || ((bc.x + 1) % 4 == 0 && f.x >= 0.5);
  bool majorY = (bc.y % 4 == 0 && f.y < 0.5) || ((bc.y + 1) % 4 == 0 && f.y >= 0.5);
  float hx = majorX ? 9.0 : 4.5, hy = majorY ? 9.0 : 4.5;
  // Line intensity with exact coverage when the street is thinner than a pixel.
  float lx = clamp((hx + 0.5 * fp - dd.x) / fp, 0.0, 1.0);
  float ly = clamp((hy + 0.5 * fp - dd.y) / fp, 0.0, 1.0);
  float wx = majorX ? 1.6 : 1.0, wy = majorY ? 1.6 : 1.0;
  float streets = max(lx * wx, ly * wy);
  // Lit windows: a dim per-block glow.
  float blockGlow = 0.02 + 0.1 * hash2i(bc + dc * 97, 25u);
  float covS = clamp((2.0 * 5.5) / B * 2.0, 0.0, 1.0);    // share of ground that is street
  float mean = covS * 1.2 + (1.0 - covS) * 0.07;
  return (streets * 1.0 + (1.0 - min(streets, 1.0)) * blockGlow) / mean * bright;
}

// Aurora: curtains on ovals around the geomagnetic poles, glowing on the night side.
vec3 aurora(vec3 ro, vec3 rd, float tMax, vec3 L, float jit){
  vec2 to = raySphere(ro, rd, RX);
  if (to.y <= 0.0) return vec3(0.0);
  float ta = max(to.x, 0.0), tb = min(to.y, tMax);
  vec2 ti = raySphere(ro, rd, 1.012);
  if (ti.x > 0.0 && ti.x < 1e19) tb = min(tb, ti.x);
  if (tb <= ta) return vec3(0.0);
  vec3 P = u_geoPole;
  vec3 e1 = normalize(cross(P, abs(P.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
  vec3 e2 = cross(P, e1);
  vec3 Le = u_toEarth * L;
  int N = int(mix(7.0, 14.0, u_q));
  float ds = (tb - ta) / float(N);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    if (i >= N) break;
    vec3 p = ro + rd * (ta + (float(i) + jit) * ds);
    float r = length(p);
    vec3 qe = u_toEarth * (p / r);
    float sl = dot(qe, P);
    float night = smoothstep(0.08, -0.25, dot(qe, Le));
    if (night <= 0.0) continue;
    // Oval centred ~23 deg from the magnetic pole, a little wider toward midnight.
    float anti = -dot(normalize(qe - P * sl), normalize(Le - P * dot(Le, P)));
    float colat = acos(clamp(abs(sl), -1.0, 1.0));
    float c0 = 0.36 + 0.07 * anti;
    float band = exp(-pow((colat - c0) / (0.045 + 0.02 * max(anti, 0.0)), 2.0));
    if (band < 0.02) continue;
    float lon = atan(dot(qe, e2), dot(qe, e1));
    float fold = snoise(vec3(lon * 6.0, colat * 30.0, u_time * 0.035));
    float curtain = smoothstep(-0.2, 0.7, fold) * (0.45 + 0.55 * smoothstep(-0.4, 0.6, snoise(vec3(lon * 23.0, u_time * 0.06, sl * 5.0))));
    float rays = 0.55 + 0.45 * snoise(vec3(lon * 190.0, colat * 12.0, u_time * 0.25));
    float h = r - 1.0;
    float green = exp(-pow((h - 0.019) / 0.007, 2.0)) + 0.35 * exp(-pow((h - 0.03) / 0.01, 2.0));
    float red = exp(-pow((h - 0.036) / 0.008, 2.0));
    acc += (vec3(0.15, 1.0, 0.42) * green + vec3(0.85, 0.18, 0.5) * red * 0.55) * band * curtain * rays * night * ds;
  }
  return acc * 55.0;
}

void main(){
  vec3 rd = normalize(v_rd);
  float r0 = 1.0 + u_camAlt;
  vec3 ro = u_camRad * r0;
  float b = r0 * dot(u_camRad, rd);
  // Planet, cloud deck and atmosphere, solved without cancellation near the ground.
  float cP = u_camAlt * (2.0 + u_camAlt);
  float dP = b * b - cP;
  bool hitP = dP >= 0.0 && b < 0.0;
  float tP = hitP ? cP / (-b + sqrt(dP)) : 1e20;
  float cA = r0 * r0 - RA * RA;
  float dA = b * b - cA;
  float sA = sqrt(max(dA, 0.0));
  float tA0 = max(-b - sA, 0.0), tA1 = -b + sA;
  bool hitA = dA >= 0.0 && tA1 > 0.0;
  float cX = r0 * r0 - RX * RX;
  bool hitX = b * b - cX >= 0.0 && -b + sqrt(max(b * b - cX, 0.0)) > 0.0;
  float tEnd = hitP ? tP : tA1;
  float cC = (u_camAlt - HC) * (2.0 + u_camAlt + HC);
  float dC = b * b - cC;
  float tC = 1e20;
  if (dC >= 0.0) {
    float sC = sqrt(dC);
    if (cC > 0.0) { if (b < 0.0) tC = cC / (-b + sC); }
    else tC = -b + sC;
  }
  bool hitC = hitA && tC > 0.0 && tC < tEnd;

  // Surface point for texturing: the ground hit, else the ray's closest approach
  // (keeps screen-space derivatives well behaved at the limb).
  float tS = hitP ? tP : max(-b, 0.0);
  vec3 ps = ro + rd * tS;
  vec3 n = normalize(ps);
  vec3 q = u_toEarth * n;
  vec3 L = u_sunDir;
  vec3 LL = u_toLocal * L;
  vec3 rdL = u_toLocal * rd;
  vec3 nL0 = u_toLocal * n;
  vec3 pl = u_camLocal + rdL * (tS * REM);
  float fp = max(tS * REM * u_pxAngle, 1e-3) / max(abs(dot(n, rd)), 0.15);

  vec3 day = texEq(u_day, q, 0.0).rgb;
  float lights = texEq(u_lights, q, 0.0).r;
  float water = texEq(u_water, q, 0.0).r;
  float NdL0 = dot(n, L);
  // Cloud shadow: the deck above this point, toward the Sun.
  vec3 shP = normalize(ps + L * (HC / max(NdL0, 0.12)));
  float cloudSh = texEq(u_clouds, u_toEarth * shP, u_cloudShift).r;
  // Cloud deck where the ray crosses it (or above the ground point).
  float tc = hitC ? tC : tS;
  vec3 pc = ro + rd * tc;
  vec3 nc = normalize(pc);
  float cBase = texEq(u_clouds, u_toEarth * nc, u_cloudShift).r;

  // Close-up detail, band-limited by the pixel footprint.
  vec2 det = groundDetail(pl.xz, fp);
  float coastK = smoothstep(5000.0, 500.0, fp);
  water = mix(water, smoothstep(0.38, 0.62, water + det.x * 0.9), coastK);
  float land = 1.0 - water;
  float waveK = smoothstep(60.0, 4.0, fp);
  float waveH = waveK * (snoise2(pl.xz / 41.0 + u_time * vec2(0.021, 0.008)) * 0.35 + snoise2(pl.xz / 13.0 - u_time * vec2(0.013, 0.03)) * 0.12);
  vec3 nL = bumpNormal(nL0, pl, det.y * land + waveH * water);
  vec3 wind = vec3(u_time * 6.0, 0.0, u_time * 2.5);
  vec3 pcl = u_camLocal + rdL * (tc * REM) + wind;
  float fpc = max(tc * REM * u_pxAngle, 1e-3) / max(abs(dot(nc, rd)), 0.1);
  float cSharp = smoothstep(5000.0, 400.0, fpc);
  float cDet = cSharp > 0.0 ? cloudDetail(pcl.xz, fpc) : 0.0;
  float cov = mix(smoothstep(0.08, 0.95, cBase), smoothstep(0.4, 0.66, cBase + cDet * 0.42), cSharp);
  vec3 plS = pl + LL * (HC * REM / max(NdL0, 0.12)) + wind;
  float shSharp = smoothstep(3000.0, 300.0, fp);
  float shDet = shSharp > 0.0 && u_q > 0.5 ? cloudDetail(plS.xz, max(fp * 4.0, 60.0)) : 0.0;
  float shadow = mix(smoothstep(0.08, 0.95, cloudSh), smoothstep(0.4, 0.66, cloudSh + shDet * 0.42), shSharp);

  if (!hitA && !hitX) discard;

  vec3 V = -rd;
  float jit = hash12(gl_FragCoord.xy);
  vec3 ground = vec3(0.0);
  if (hitP) {
    float NdL = dot(nL, LL);
    float diff = clamp((NdL + 0.02) / 1.02, 0.0, 1.0);
    vec3 alb = day * (1.0 + det.x * land) * mix(vec3(1.0), vec3(1.04, 1.0, 0.92), clamp(det.x * 3.0, -1.0, 1.0) * land * 0.5 + 0.5);
    alb = mix(alb, alb * vec3(0.85, 0.95, 1.1), water * 0.4);
    vec3 sunC = sunTrans(1.0006, NdL0) * u_sunI;
    vec3 surf = alb * diff * sunC * (1.0 - 0.6 * shadow);
    // Skylight keeps shadows and dusk from going pitch black.
    surf += alb * vec3(0.35, 0.5, 0.8) * 0.05 * u_sunI * smoothstep(-0.25, 0.3, NdL0);
    vec3 H = normalize(LL - rdL);
    float nh = max(dot(nL, H), 0.0);
    float rough = mix(1.0, 0.35, waveK);
    float spec = pow(nh, 120.0 * rough) * 3.0 * rough + pow(nh, 18.0) * 0.12;
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(nL, -rdL), 0.0), 5.0);
    surf += vec3(1.0, 0.9, 0.75) * (spec + fres * 0.25) * water * (1.0 - shadow) * sunC * smoothstep(0.0, 0.25, NdL0);
    float night = smoothstep(0.1, -0.15, NdL0);
    // Up close, streets stop being points of light and become dimly lit ground.
    float city = mix(1.0, cityPattern(pl.xz, fp), smoothstep(2500.0, 300.0, fp));
    // Exposure: a whole view of city centre would otherwise glare white.
    city *= mix(0.16, 1.0, smoothstep(300.0, 5000.0, fp)) * mix(0.1, 1.0, smoothstep(0.8, 15.0, fp));
    surf += vec3(1.0, 0.7, 0.4) * pow(lights, 1.4) * city * u_lightsGain * night;
    surf += day * vec3(0.55, 0.65, 0.9) * 0.018 * night;
    ground = surf;
  }
  vec3 cloudCol = vec3(0.0);
  if (hitC) {
    float NdLc = dot(nc, L);
    float cl = clamp((NdLc + 0.08) / 1.08, 0.0, 1.0);
    vec3 sunC = sunTrans(1.0006 + HC, NdLc) * u_sunI;
    bool below = u_camAlt < HC;
    float lit = below ? mix(0.9, 0.3, cov) : 1.0;
    cloudCol = vec3(0.98, 0.99, 1.0) * cl * sunC * 1.1 * lit;
    cloudCol += vec3(0.4, 0.5, 0.75) * 0.04 * u_sunI * smoothstep(-0.3, 0.2, NdLc);
    float nightC = smoothstep(0.1, -0.15, NdLc);
    float lc = texEq(u_lights, u_toEarth * nc, 0.0).r;
    cloudCol += vec3(1.0, 0.62, 0.35) * lc * u_lightsGain * 0.08 * nightC;
  }

  vec3 T, Sm, Tm;
  int dense = (hitP && u_camAlt > 0.006) ? 2 : (u_camAlt < 0.02 ? 1 : (hitP ? 2 : 0));
  float t0 = hitA ? tA0 : 0.0;
  float t1 = hitA ? tEnd : 0.0;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (hitA && t1 > t0) {
    vec3 sc = inscatter(ro, rd, t0, t1, L, jit, dense, hitC ? tc : 1e20, T, Sm, Tm);
    float k = u_sunI * u_atmoGain;
    sc *= k; Sm *= k;
    col = sc + T * ground;
    float c = hitC ? cov * 0.97 : 0.0;
    if (hitC) col = Sm + Tm * c * cloudCol + (1.0 - c) * (col - Sm);
    alpha = hitP ? 1.0 : 1.0 - dot(T, vec3(0.3333)) * (1.0 - c);
  } else if (hitP) {
    col = ground;
    alpha = 1.0;
  }
  // Airglow: a faint rim on the night side keeps the silhouette readable.
  float tcl = max(-b, 0.0);
  vec3 pclose = ro + rd * tcl;
  float limbH = length(pclose) - 1.0;
  float airglow = exp(-pow((limbH - 0.008) / 0.011, 2.0)) * smoothstep(0.15, -0.2, dot(normalize(pclose), L));
  if (!hitP) col += vec3(0.22, 0.42, 0.4) * airglow * 0.07 * smoothstep(0.004, 0.03, u_camAlt);
  // Light pollution glowing low in the sky above cities, at night.
  float el = dot(rd, u_camRad);
  float inside = 1.0 - smoothstep(0.004, 0.02, u_camAlt);
  float nightHere = smoothstep(0.05, -0.15, dot(u_camRad, L));
  float homeL = textureLod(u_lights, u_homeUV, 4.5).r;
  if (!hitP) col += vec3(1.0, 0.6, 0.33) * homeL * u_lightsGain * 0.035 * exp(-max(el, 0.0) * 9.0) * inside * nightHere;
  if (u_aurora > 0.0 && hitX) col += aurora(ro, rd, hitP ? tP : 1e20, L, jit) * u_aurora * (hitA ? mix(vec3(1.0), T, 0.5) : vec3(1.0));

  vec3 hitW = u_camPos + rd * tS;
  vec4 clip = u_viewProj * vec4(hitW, 1.0);
  gl_FragDepth = hitP ? clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0) : 0.9999999;
  o = vec4(col * u_opacity, alpha * u_opacity);
}`;

  // Moon: procedural maria and craters, Lommel–Seeliger-ish lighting.
  SH.moonFS = `
in vec3 v_wp;
uniform vec3 u_camPos, u_center, u_sunDir, u_earthDir;
uniform float u_radius, u_sunI, u_opacity;
uniform mat4 u_viewProj;
uniform mat3 u_toMoon;
out vec4 o;
${COMMON}
void main(){
  vec3 rd = normalize(v_wp - u_camPos);
  vec3 ro = (v_wp - u_center) / u_radius;
  float tCam = -length(v_wp - u_camPos) / u_radius;
  float pd = length(cross(ro, rd));
  float fw = max(fwidth(pd), 1e-5);
  vec2 t = raySphere(ro, rd, 1.0);
  if (t.x > 1e19 || t.y < tCam) discard;
  vec3 n = normalize(ro + rd * t.x);
  vec3 q = u_toMoon * n;
  float maria = smoothstep(0.05, 0.35, fbm(q * 1.6 + vec3(3.1, 1.2, 0.4), 4));
  maria *= smoothstep(-0.2, 0.6, q.x);
  float cr = fbm(q * 9.0, 4);
  float albedo = mix(0.16, 0.085, maria) * (0.85 + 0.3 * cr);
  float mu0 = max(dot(n, u_sunDir), 0.0);
  float mu = max(dot(n, -rd), 0.0);
  float ls = mu0 / (mu0 + mu + 1e-4);
  float lit = mix(mu0, 2.0 * ls, 0.7);
  float earthshine = max(dot(n, u_earthDir), 0.0) * 0.004;
  vec3 col = vec3(1.0, 0.97, 0.93) * albedo * (lit * u_sunI + earthshine);
  vec4 clip = u_viewProj * vec4(u_center + (ro + rd * t.x) * u_radius, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  float aa = clamp((1.0 - pd) / fw, 0.0, 1.0);
  o = vec4(col * u_opacity * aa, aa * u_opacity);
}`;

  // Sun: emissive disk with limb darkening and granulation.
  SH.sunFS = `
in vec3 v_wp;
uniform vec3 u_camPos, u_center;
uniform float u_radius, u_intensity, u_time, u_opacity;
out vec4 o;
${COMMON}
void main(){
  vec3 rd = normalize(v_wp - u_camPos);
  vec3 ro = (v_wp - u_center) / u_radius;
  float tCam = -length(v_wp - u_camPos) / u_radius;
  float pd = length(cross(ro, rd));
  float fw = max(fwidth(pd), 1e-5);
  vec2 t = raySphere(ro, rd, 1.0);
  if (t.x > 1e19 || t.y < tCam) discard;
  vec3 n = normalize(ro + rd * t.x);
  float mu = max(dot(n, -rd), 0.0);
  float limb = 1.0 - 0.6 * (1.0 - mu) - 0.15 * (1.0 - mu) * (1.0 - mu);
  float gran = 0.9 + 0.1 * snoise(n * 40.0 + vec3(u_time * 0.05));
  vec3 col = vec3(1.0, 0.93, 0.82) * mix(vec3(1.0), vec3(1.0, 0.7, 0.45), 1.0 - mu) * limb * gran * u_intensity;
  float aa = clamp((1.0 - pd) / fw, 0.0, 1.0);
  o = vec4(col * aa * u_opacity, aa * u_opacity);
}`;

  // Translucent shells: heliosphere (0), cosmic microwave background (1),
  // speculative bubble universes (2).
  SH.shellFS = `
in vec3 v_wp;
uniform vec3 u_camPos, u_center;
uniform float u_radius, u_opacity, u_time, u_seed;
uniform int u_mode;
uniform vec3 u_axis;        // heliosphere nose direction
uniform vec3 u_tint;
out vec4 o;
${COMMON}

// Chord length through an ellipsoid (axis-aligned to 'ax', semi-axes along/perp) centred at c.
float chord(vec3 ro, vec3 rd, vec3 c, vec3 ax, float along, float perp){
  vec3 p = ro - c;
  // local scaling: component along ax divided by 'along', rest by 'perp'
  float pa = dot(p, ax), da = dot(rd, ax);
  vec3 pp = p - ax * pa, dp = rd - ax * da;
  vec3 P = pp / perp + ax * (pa / along);
  vec3 D = dp / perp + ax * (da / along);
  float A = dot(D, D), B = dot(P, D), C = dot(P, P) - 1.0;
  float h = B * B - A * C;
  if (h <= 0.0) return 0.0;
  h = sqrt(h);
  float t0 = (-B - h) / A, t1 = (-B + h) / A;
  t0 = max(t0, 0.0);
  return max(t1 - t0, 0.0);
}

vec3 planck(float x){
  // Planck-style diverging map for temperature anisotropies (-1..1)
  vec3 c0 = vec3(0.0, 0.03, 0.25), c1 = vec3(0.1, 0.45, 0.95), c2 = vec3(0.95, 0.93, 0.85), c3 = vec3(1.0, 0.55, 0.12), c4 = vec3(0.65, 0.05, 0.02);
  x = clamp(x * 0.5 + 0.5, 0.0, 1.0);
  if (x < 0.25) return mix(c0, c1, x / 0.25);
  if (x < 0.5) return mix(c1, c2, (x - 0.25) / 0.25);
  if (x < 0.75) return mix(c2, c3, (x - 0.5) / 0.25);
  return mix(c3, c4, (x - 0.75) / 0.25);
}

void main(){
  vec3 rd = normalize(v_wp - u_camPos);
  vec3 ro = u_camPos;
  if (u_mode == 0) {
    // heliopause (outer) minus termination shock (inner): the heliosheath glows at the rim
    vec3 ax = u_axis;
    float outer = chord(ro, rd, u_center - ax * 30.0, ax, 150.0, 128.0);
    float inner = chord(ro, rd, u_center - ax * 8.0, ax, 94.0, 92.0);
    float sheath = max(outer - inner, 0.0);
    float g = pow(clamp(sheath / 240.0, 0.0, 1.2), 2.4) * 0.9 + sheath / 240.0 * 0.05;
    float wisps = 0.7 + 0.6 * fbm(rd * 7.0 + vec3(u_time * 0.004), 4);
    vec3 col = u_tint * g * wisps + vec3(0.45, 0.65, 1.0) * pow(inner / 190.0, 3.0) * 0.12;
    o = vec4(col * u_opacity, 0.0);
    return;
  }
  vec3 p0 = (ro - u_center) / u_radius;
  vec2 t = raySphere(p0, rd, 1.0);
  if (t.x > 1e19 || t.y < 0.0) discard;
  bool inside = t.x < 0.0;
  if (u_mode == 1) {
    // CMB: seen from inside it is the whole sky; from outside a glowing globe.
    vec3 nb = normalize(p0 + rd * t.y);          // back surface
    vec3 nf = normalize(p0 + rd * max(t.x, 0.0)); // front surface
    float cmbB = fbm(nb * 22.0, 5) * 0.8 + fbm(nb * 5.0, 3) * 0.35;
    float cmbF = fbm(nf * 22.0, 5) * 0.8 + fbm(nf * 5.0, 3) * 0.35;
    vec3 back = planck(cmbB * 1.6) * 0.55;
    if (inside) { o = vec4(back * u_opacity, u_opacity); return; }
    float mu = abs(dot(nf, rd));
    float rim = pow(1.0 - mu, 3.0);
    vec3 front = planck(cmbF * 1.6);
    float a = mix(0.2, 0.92, rim);
    vec3 col = front * (0.22 + 0.6 * rim) * a + back * (1.0 - a) * 0.16 + vec3(1.0, 0.6, 0.35) * rim * 0.22;
    o = vec4(col * u_opacity, a * u_opacity);
    return;
  }
  // bubble universe: thin-film iridescence
  vec3 nf = normalize(p0 + rd * max(t.x, 0.0));
  float mu = abs(dot(nf, rd));
  float thick = 1.0 + 0.6 * fbm(nf * 2.5 + vec3(u_seed * 7.1, u_time * 0.01, 0.0), 3);
  float phase = thick / max(mu, 0.15) * 4.0 + u_seed * 3.0;
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
  float rim = pow(1.0 - mu, 2.5);
  float body = (t.y - max(t.x, 0.0)) * 0.5;
  float inner = 0.5 + 0.5 * fbm(nf * 4.0 + u_seed * 3.3, 4);
  vec3 col = film * pow(rim, 1.6) * 1.4 * u_tint + u_tint * body * body * 0.035 * inner;
  o = vec4(col * u_opacity, 0.0);
}`;

  // The Milky Way as seen from the Sun, baked once into a cube map.
  SH.fullVS = `
out vec2 v_uv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
  SH.skyBakeFS = `
in vec2 v_uv;
uniform int u_face;
uniform vec3 u_lmc, u_smc, u_m31;
out vec4 o;
${COMMON}
vec3 faceDir(int f, vec2 uv){
  float sc = uv.x * 2.0 - 1.0, tc = uv.y * 2.0 - 1.0;
  if (f == 0) return vec3(1.0, -tc, -sc);
  if (f == 1) return vec3(-1.0, -tc, sc);
  if (f == 2) return vec3(sc, 1.0, tc);
  if (f == 3) return vec3(sc, -1.0, -tc);
  if (f == 4) return vec3(sc, -tc, 1.0);
  return vec3(-sc, -tc, -1.0);
}
float blob(vec3 d, vec3 c, float s){ float x = 1.0 - dot(d, c); return exp(-x / (s * s)); }
void main(){
  vec3 d = normalize(faceDir(u_face, v_uv));
  vec3 g = vec3(d.x, -d.z, d.y);             // scene -> galactic
  float b = asin(clamp(g.z, -1.0, 1.0));
  float l = atan(g.y, g.x);
  float cl = cos(l);
  float inner = pow(0.5 + 0.5 * cl, 1.6);
  float sig = 0.055 + 0.07 * inner;
  float band = exp(-pow(b / sig, 2.0));
  float wide = exp(-pow(b / (sig * 3.2), 2.0));
  float bulge = exp(-(l * l) / (2.0 * 0.22 * 0.22) - (b * b) / (2.0 * 0.12 * 0.12)) * 0.6;
  float n1 = fbm(d * 5.0, 6);
  float n2 = fbm(d * 17.0 + 3.0, 5);
  float clump = clamp(0.55 + 1.1 * n1 + 0.45 * n2, 0.05, 2.5);
  float I = (band * 0.85 + wide * 0.22) * (0.3 + 0.7 * inner) * clump + bulge * 1.1 * (0.7 + 0.6 * n2);
  float dn = fbm(d * 8.0 + 7.0, 6);
  float dustBand = exp(-pow((b - 0.012) / (0.03 + 0.02 * inner), 2.0));
  float rift = dustBand * smoothstep(-0.15, 0.3, dn) * (0.35 + 0.65 * smoothstep(-0.4, 0.9, cl));
  float fil = smoothstep(0.1, 0.5, fbm(d * 24.0 + 1.3, 4)) * wide * 0.6;
  I *= exp(-rift * 2.6 - fil);
  I = pow(I, 1.3) * 1.15;
  vec3 warm = vec3(1.0, 0.8, 0.58), cool = vec3(0.7, 0.78, 1.0);
  vec3 col = mix(cool, warm, clamp(bulge * 1.6 + 0.45 * inner, 0.0, 1.0)) * I;
  float h = smoothstep(0.35, 0.8, fbm(d * 34.0 + 11.0, 3)) * band * (0.4 + 0.6 * inner);
  col += vec3(1.0, 0.28, 0.42) * h * 0.22;
  col += vec3(0.85, 0.85, 1.0) * (blob(d, u_lmc, 0.045) * 0.5 + blob(d, u_smc, 0.03) * 0.3);
  col += vec3(1.0, 0.92, 0.8) * blob(d, u_m31, 0.012) * 0.25;
  col += vec3(0.5, 0.55, 0.7) * 0.012;       // faint zodiacal/airglow floor
  o = vec4(sqrt(clamp(col * 0.55, 0.0, 1.0)), 1.0);
}`;
  SH.skyDrawFS = `
in vec2 v_uv;
uniform mat4 u_invViewProj;
uniform samplerCube u_sky;
uniform float u_gain;
out vec4 o;
void main(){
  vec4 w = u_invViewProj * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(w.xyz / w.w);
  vec3 c = texture(u_sky, d).rgb;
  o = vec4(c * c * u_gain / 0.55, 1.0);
}`;

  // Post: bloom downsample (13 tap, Karis average on the first pass).
  SH.downFS = `
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform int u_first;
uniform float u_threshold;
out vec4 o;
vec3 S(vec2 off){ return texture(u_src, v_uv + u_texel * off).rgb; }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 c){ return c / (1.0 + luma(c) * 0.25); }
void main(){
  vec3 a = S(vec2(-2.0, 2.0)), b = S(vec2(0.0, 2.0)), c = S(vec2(2.0, 2.0));
  vec3 d = S(vec2(-2.0, 0.0)), e = S(vec2(0.0)), f = S(vec2(2.0, 0.0));
  vec3 g = S(vec2(-2.0, -2.0)), h = S(vec2(0.0, -2.0)), i = S(vec2(2.0, -2.0));
  vec3 j = S(vec2(-1.0, 1.0)), k = S(vec2(1.0, 1.0)), l = S(vec2(-1.0, -1.0)), m = S(vec2(1.0, -1.0));
  vec3 col;
  if (u_first == 1) {
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    col = karis(g0) * 0.125 + karis(g1) * 0.125 + karis(g2) * 0.125 + karis(g3) * 0.125 + karis(g4) * 0.5;
    float lum = luma(col);
    float w = max(lum - u_threshold, 0.0) / max(lum, 1e-5);
    col *= smoothstep(0.0, 1.0, w) ;
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  o = vec4(col, 1.0);
}`;
  SH.upFS = `
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_weight;
out vec4 o;
vec3 S(vec2 off){ return texture(u_src, v_uv + u_texel * off).rgb; }
void main(){
  vec3 c = S(vec2(-1.0, 1.0)) + S(vec2(0.0, 1.0)) * 2.0 + S(vec2(1.0, 1.0))
         + S(vec2(-1.0, 0.0)) * 2.0 + S(vec2(0.0)) * 4.0 + S(vec2(1.0, 0.0)) * 2.0
         + S(vec2(-1.0, -1.0)) + S(vec2(0.0, -1.0)) * 2.0 + S(vec2(1.0, -1.0));
  o = vec4(c * (u_weight / 16.0), 1.0);
}`;
  SH.compositeFS = `
in vec2 v_uv;
uniform sampler2D u_scene, u_bloom;
uniform float u_bloomStrength, u_exposure, u_time, u_grain, u_vignette, u_fade;
uniform vec2 u_res;
out vec4 o;
${COMMON}
vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec3 c = texture(u_scene, v_uv).rgb;
  vec3 b = texture(u_bloom, v_uv).rgb;
  c += b * u_bloomStrength;
  c *= u_exposure;
  c = aces(c);
  vec2 q = v_uv - 0.5;
  q.x *= u_res.x / u_res.y;
  c *= 1.0 - u_vignette * smoothstep(0.35, 1.25, length(q));
  c = toSRGB(c) * u_fade;
  float n = hash12(gl_FragCoord.xy + fract(u_time * 7.13) * 431.7) - 0.5;
  c += n * (u_grain + 1.5 / 255.0);
  o = vec4(c, 1.0);
}`;

  // ------------------------------------------------------------------ engine
  class GFX {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', {
        antialias: false, alpha: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
      });
      if (!gl) throw new Error('WebGL 2 is not available');
      this.gl = gl;
      this.canvas = canvas;
      this.floatRT = !!gl.getExtension('EXT_color_buffer_float');
      this.halfRT = this.floatRT || !!gl.getExtension('EXT_color_buffer_half_float');
      this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      const ps = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
      this.maxPointSize = ps ? ps[1] : 64;
      this.emptyVAO = gl.createVertexArray();
      this.quadBuf = this.buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
      this.lineCornerBuf = this.buffer(new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]));
      this.quadVAO = gl.createVertexArray();
      gl.bindVertexArray(this.quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.f32 = { 9: new Float32Array(9), 16: new Float32Array(16) };
      this.time = 0;
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      // Device class sets the starting quality and particle budgets; the governor in
      // app.js then tunes resolution and shader detail to the measured frame rate.
      let renderer = '';
      try {
        renderer = String(gl.getParameter(gl.RENDERER) || '');
        if (/^WebKit/i.test(renderer)) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbg) renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || renderer);
        }
      } catch (e) { /* renderer string unavailable */ }
      const soft = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
      const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      const cores = navigator.hardwareConcurrency || 4;
      let tier = soft ? 0 : coarse ? (cores >= 8 ? 1 : 0) : (cores >= 6 ? 2 : 1);
      const qp = (location.search.match(/[?&]q(?:uality)?=(low|mid|high|ultra)/i) || [])[1];
      if (qp) tier = { low: 0, mid: 1, high: 2, ultra: 3 }[qp.toLowerCase()];
      CA.device = { tier, renderer, coarse, forced: !!qp, density: [0.45, 0.75, 1, 1][tier] };
      this.parallel = gl.getExtension('KHR_parallel_shader_compile');
      this.p = {};
      this.defs = {};
      this.q = 1;                 // shader detail, 0..1 (set by the quality governor)
      this.buildPrograms();
    }

    buffer(data, usage) {
      const gl = this.gl;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
      return b;
    }

    // Programs compile in the background where the browser allows it
    // (KHR_parallel_shader_compile). gfx.p.<name> finishes a program on first use;
    // layers can wait with `yield* gfx.whenReady(name)` so nothing ever stalls a frame.
    define(name, vs, fs) {
      if (this.defs[name]) return;
      const gl = this.gl;
      const p = gl.createProgram();
      const mk = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, HEADER + src);
        gl.compileShader(sh);
        gl.attachShader(p, sh);
        return sh;
      };
      const d = { p, v: mk(gl.VERTEX_SHADER, vs), f: mk(gl.FRAGMENT_SHADER, fs), vs, fs, prog: null, err: null };
      gl.linkProgram(p);
      this.defs[name] = d;
      Object.defineProperty(this.p, name, { configurable: true, enumerable: true, get: () => this.finish(name) });
    }
    ready(name) {
      const d = this.defs[name];
      if (!d) return false;
      if (d.prog || d.err) return true;
      return !this.parallel || this.gl.getProgramParameter(d.p, this.parallel.COMPLETION_STATUS_KHR);
    }
    *whenReady() {
      for (const n of arguments) while (!this.ready(n)) yield 0;
      for (const n of arguments) this.finish(n);
    }
    finish(name) {
      const d = this.defs[name];
      if (d.prog) return d.prog;
      if (d.err) throw d.err;
      const gl = this.gl;
      if (!gl.getProgramParameter(d.p, gl.LINK_STATUS) && !gl.isContextLost()) {
        const logs = [];
        for (const [sh, src, tag] of [[d.v, d.vs, 'vs'], [d.f, d.fs, 'fs']]) {
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const numbered = (HEADER + src).split('\n').map((l, i) => i + 1 + ': ' + l).join('\n');
            console.error('Shader error in ' + name + '.' + tag + ':\n' + gl.getShaderInfoLog(sh) + '\n' + numbered);
            logs.push(tag + ': ' + gl.getShaderInfoLog(sh));
          }
        }
        d.err = new Error('Program failed: ' + name + ' — ' + (logs.join(' ') || gl.getProgramInfoLog(d.p)));
        throw d.err;
      }
      const u = {};
      const n = gl.getProgramParameter(d.p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(d.p, i);
        const key = info.name.replace(/\[0\]$/, '');
        u[key] = { loc: gl.getUniformLocation(d.p, info.name), type: info.type, size: info.size };
      }
      gl.deleteShader(d.v); gl.deleteShader(d.f);
      d.prog = { p: d.p, u, name };
      return d.prog;
    }

    buildPrograms() {
      const D = (n, v, f) => this.define(n, v, f);
      D('points', SH.pointsVS, SH.pointsFS);
      D('stars', SH.starsVS, SH.starsFS);
      D('skyStars', SH.skyStarsVS, SH.starsFS);
      D('sprites', SH.spritesVS, SH.spritesFS);
      D('lines', SH.linesVS, SH.linesFS);
      D('earth', SH.earthVS, SH.earthFS);
      D('moon', SH.impostorVS, SH.moonFS);
      D('sun', SH.impostorVS, SH.sunFS);
      D('shell', SH.impostorVS, SH.shellFS);
      D('skyBake', SH.fullVS, SH.skyBakeFS);
      D('skyDraw', SH.fullVS, SH.skyDrawFS);
      D('down', SH.fullVS, SH.downFS);
      D('up', SH.fullVS, SH.upFS);
      D('composite', SH.fullVS, SH.compositeFS);
    }

    use(prog, uniforms) {
      this.gl.useProgram(prog.p);
      if (uniforms) this.set(prog, uniforms);
      return prog;
    }

    set(prog, vals) {
      const gl = this.gl;
      for (const k in vals) {
        const info = prog.u[k];
        if (!info) continue;
        const v = vals[k], loc = info.loc;
        switch (info.type) {
          case gl.FLOAT: if (info.size > 1) gl.uniform1fv(loc, v); else gl.uniform1f(loc, v); break;
          case gl.FLOAT_VEC2: if (info.size > 1) gl.uniform2fv(loc, v); else gl.uniform2f(loc, v[0], v[1]); break;
          case gl.FLOAT_VEC3: if (info.size > 1) gl.uniform3fv(loc, v); else gl.uniform3f(loc, v[0], v[1], v[2]); break;
          case gl.FLOAT_VEC4: if (info.size > 1) gl.uniform4fv(loc, v); else gl.uniform4f(loc, v[0], v[1], v[2], v[3]); break;
          case gl.FLOAT_MAT3: { const a = this.f32[9]; for (let i = 0; i < 9; i++) a[i] = v[i]; gl.uniformMatrix3fv(loc, false, a); break; }
          case gl.FLOAT_MAT4: { const a = this.f32[16]; for (let i = 0; i < 16; i++) a[i] = v[i]; gl.uniformMatrix4fv(loc, false, a); break; }
          default: gl.uniform1i(loc, v | 0);
        }
      }
    }

    // Standard per-layer camera uniforms.
    camUniforms(cam) {
      return {
        u_view: cam.view, u_proj: cam.proj, u_viewProj: cam.viewProj, u_invViewProj: cam.invViewProj,
        u_pxScale: cam.pxScale, u_camPos: cam.pos, u_camUp: cam.up, u_viewport: cam.viewport,
        u_near: cam.near * 1.01, u_time: this.time,
      };
    }

    // Blend presets.
    blend(mode) {
      const gl = this.gl;
      if (mode === 'none') { gl.disable(gl.BLEND); return; }
      gl.enable(gl.BLEND);
      if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
      else if (mode === 'absorb') gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
      else if (mode === 'premul') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    depth(test, write) {
      const gl = this.gl;
      if (test) { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); } else gl.disable(gl.DEPTH_TEST);
      gl.depthMask(!!write);
    }

    // Draw helpers that always set every tunable uniform (GL keeps stale values otherwise).
    drawPoints(geo, cam, o) {
      if (!geo) return;
      const u = Object.assign({ u_minPx: 1, u_maxPx: 24, u_gain: 1, u_sizeMul: 1, u_constFlux: 0, u_twinkle: 0, u_time: this.time,
        u_fadeCenter: [0, 0, 0], u_fadeR0: 0, u_fadeR1: 0, u_slabDepth: 0, u_slabWidth: 0, u_mode: 0 }, o);
      u.u_view = cam.view; u.u_proj = cam.proj; u.u_pxScale = cam.pxScale;
      this.use(this.p.points, u);
      geo.draw(u.first, u.count);
    }
    drawSprites(geo, cam, o) {
      if (!geo) return;
      const u = Object.assign({ u_minPx: 1, u_maxPx: 64, u_gain: 1, u_fixedPx: 0, u_mode: 0, u_time: this.time }, o);
      u.u_view = cam.view; u.u_proj = cam.proj; u.u_pxScale = cam.pxScale;
      this.use(this.p.sprites, u);
      geo.draw();
    }
    drawStars(geo, cam, o) {
      if (!geo) return;
      const u = Object.assign({ u_logRef: 0, u_gain: 1, u_minPx: 1, u_maxPx: 8, u_sizeK: 2, u_spikeK: 0, u_fadeNear: 0 }, o);
      u.u_view = cam.view; u.u_proj = cam.proj;
      this.use(this.p.stars, u);
      geo.draw();
    }
    // Instanced sphere impostors (a SpriteSet: xyz | rgb ao | radius).
    drawSpheres(geo, cam, o) {
      if (!geo) return;
      if (!this.defs.spheres) this.define('spheres', SH.spheresVS, SH.spheresFS);
      const u = Object.assign({ u_minPx: 1, u_radMul: 1, u_gain: 1, u_opacity: 1, u_emit: 0.08, u_light: [-0.45, 0.6, 0.66], u_cullR: 0, u_nearFade: 0 }, o);
      u.u_view = cam.view; u.u_proj = cam.proj; u.u_pxScale = cam.pxScale; u.u_focusD = cam.d;
      this.use(this.p.spheres, u);
      geo.draw();
    }
    drawLines(geo, cam, o) {
      if (!geo) return;
      const u = Object.assign({ u_width: 1, u_gain: 1, u_dash: 0, u_dashSpeed: 0, u_time: this.time }, o);
      u.u_viewProj = cam.viewProj; u.u_viewport = cam.viewport; u.u_near = cam.near * 1.01;
      this.use(this.p.lines, u);
      geo.draw();
    }

    drawImpostor(prog, uniforms) {
      const gl = this.gl;
      this.use(prog, uniforms);
      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawFullscreen() {
      const gl = this.gl;
      gl.bindVertexArray(this.emptyVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Load an image (data: URI or relative URL) into a mipmapped texture.
    loadTexture(url, opts) {
      opts = opts || {};
      const gl = this.gl;
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // GPUs that cannot hold the full map get a downscaled copy.
          let src = img;
          const lim = Math.min(this.maxTex, opts.maxSize || 16384);
          if (img.width > lim || img.height > lim) {
            const k = lim / Math.max(img.width, img.height);
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.floor(img.width * k)); c.height = Math.max(1, Math.floor(img.height * k));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            src = c;
          }
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          if (opts.gray) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, src);
          else if (opts.srgb) gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
          else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
          resolve(tex);
        };
        img.onerror = () => reject(new Error('texture failed to load'));
        img.src = url;
      });
    }

    // 1×1 fallback texture.
    solidTexture(rgba, gray) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (gray) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([rgba[0]]));
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      return tex;
    }
  }
  CA.GFX = GFX;

  // ------------------------------------------------------------------ geometry containers
  // Interleaved vertex: x y z | r g b a | size  (8 floats)
  class PointCloud {
    constructor(gfx, data, count) {
      const gl = gfx.gl;
      this.gfx = gfx;
      this.count = count === undefined ? data.length / 8 : count;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      this.buf = gfx.buffer(data);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);
      gl.bindVertexArray(null);
    }
    draw(first, count) {
      const gl = this.gfx.gl;
      if (!this.count) return;
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.POINTS, first || 0, count === undefined ? this.count : count);
    }
  }
  CA.PointCloud = PointCloud;

  class SpriteSet {
    constructor(gfx, data, count) {
      const gl = gfx.gl;
      this.gfx = gfx;
      this.count = count === undefined ? data.length / 8 : count;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gfx.quadBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.buf = gfx.buffer(data);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 12); gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 32, 28); gl.vertexAttribDivisor(3, 1);
      gl.bindVertexArray(null);
    }
    draw() {
      const gl = this.gfx.gl;
      if (!this.count) return;
      gl.bindVertexArray(this.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    }
  }
  CA.SpriteSet = SpriteSet;

  // Segment instance: p0.xyz t0 | p1.xyz t1 | c0 rgba | c1 rgba  (16 floats)
  class LineSet {
    constructor(gfx, data) {
      const gl = gfx.gl;
      this.gfx = gfx;
      this.count = data.length / 16;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gfx.lineCornerBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.buf = gfx.buffer(data);
      for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(1 + i);
        gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 64, i * 16);
        gl.vertexAttribDivisor(1 + i, 1);
      }
      gl.bindVertexArray(null);
    }
    draw() {
      const gl = this.gfx.gl;
      if (!this.count) return;
      gl.bindVertexArray(this.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    }
  }
  CA.LineSet = LineSet;

  class LineBuilder {
    constructor() { this.a = []; }
    seg(p0, p1, c0, c1, t0, t1) {
      c1 = c1 || c0;
      this.a.push(p0[0], p0[1], p0[2], t0 || 0, p1[0], p1[1], p1[2], t1 || 0,
        c0[0], c0[1], c0[2], c0[3], c1[0], c1[1], c1[2], c1[3]);
    }
    // points: array of [x,y,z]; colorFn(i, n) -> [r,g,b,a]
    polyline(points, colorFn, closed, tScale) {
      const n = points.length;
      const segs = closed ? n : n - 1;
      let t = 0;
      for (let i = 0; i < segs; i++) {
        const a = points[i], b = points[(i + 1) % n];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * (tScale || 1);
        this.seg(a, b, colorFn(i, n), colorFn(i + 1, n), t, t + len);
        t += len;
      }
    }
    // Circle of radius r centred at c in the plane spanned by unit vectors u, v.
    circle(c, u, v, r, n, color) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        pts.push([c[0] + u[0] * ca + v[0] * sa, c[1] + u[1] * ca + v[1] * sa, c[2] + u[2] * ca + v[2] * sa]);
      }
      this.polyline(pts, typeof color === 'function' ? color : () => color, true);
    }
    build(gfx) { return new LineSet(gfx, new Float32Array(this.a)); }
  }
  CA.LineBuilder = LineBuilder;

  // ------------------------------------------------------------------ post-processing
  class Post {
    constructor(gfx) {
      this.gfx = gfx;
      this.w = 0; this.h = 0;
      this.mips = [];
      this.bloomStrength = 0.55;
      this.threshold = 1.1;
      this.exposure = 1.0;
      this.grain = 0.012;
      this.vignette = 0.45;
      this.fade = 1;
    }
    tex(w, h, depth) {
      const gl = this.gfx.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      const hdr = this.gfx.halfRT;
      gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      let rb = null;
      if (depth) {
        rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      }
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex: t, fb, rb, w, h, ok };
    }
    free(t) {
      if (!t) return;
      const gl = this.gfx.gl;
      gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb);
      if (t.rb) gl.deleteRenderbuffer(t.rb);
    }
    resize(w, h) {
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      this.free(this.scene);
      this.mips.forEach((m) => this.free(m));
      this.scene = this.tex(w, h, true);
      if (!this.scene.ok && this.gfx.halfRT) {
        // Some drivers refuse half-float targets: fall back to 8-bit.
        this.gfx.halfRT = false;
        this.free(this.scene);
        this.scene = this.tex(w, h, true);
      }
      this.mips = [];
      let mw = w >> 1, mh = h >> 1;
      for (let i = 0; i < 7 && mw >= 4 && mh >= 4; i++) {
        this.mips.push(this.tex(mw, mh, false));
        mw >>= 1; mh >>= 1;
      }
    }
    begin() {
      const gl = this.gfx.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
      gl.viewport(0, 0, this.w, this.h);
      gl.clearColor(0, 0, 0, 1);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    clearDepth() {
      const gl = this.gfx.gl;
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
    }
    end() {
      const g = this.gfx, gl = g.gl, P = g.p;
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.disable(gl.BLEND);
      // downsample chain
      let src = this.scene;
      for (let i = 0; i < this.mips.length; i++) {
        const dst = this.mips[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        gl.viewport(0, 0, dst.w, dst.h);
        g.use(P.down, { u_src: 0, u_texel: [1 / src.w, 1 / src.h], u_first: i === 0 ? 1 : 0, u_threshold: this.threshold });
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        g.drawFullscreen();
        src = dst;
      }
      // upsample + accumulate
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = this.mips.length - 1; i > 0; i--) {
        const s = this.mips[i], d = this.mips[i - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb);
        gl.viewport(0, 0, d.w, d.h);
        g.use(P.up, { u_src: 0, u_texel: [1 / s.w, 1 / s.h], u_weight: 1.0 });
        gl.bindTexture(gl.TEXTURE_2D, s.tex);
        g.drawFullscreen();
      }
      gl.disable(gl.BLEND);
      // composite to screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, g.canvas.width, g.canvas.height);
      g.use(P.composite, {
        u_scene: 0, u_bloom: 1, u_bloomStrength: this.bloomStrength / Math.max(1, this.mips.length - 1),
        u_exposure: this.exposure, u_time: g.time, u_grain: this.grain, u_vignette: this.vignette,
        u_res: [g.canvas.width, g.canvas.height], u_fade: this.fade,
      });
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.mips.length ? this.mips[0].tex : this.scene.tex);
      g.drawFullscreen();
      gl.activeTexture(gl.TEXTURE0);
    }
  }
  CA.Post = Post;
})();
