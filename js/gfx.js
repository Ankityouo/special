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
`;

  // ------------------------------------------------------------------ shaders
  const SH = {};

  // Particle clouds as point sprites. Size is a world radius; brightness is a
  // surface brightness, so distant particles fade (flux-conserving clamp).
  SH.pointsVS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
layout(location=2) in float a_size;
uniform mat4 u_view, u_proj;
uniform float u_pxScale, u_minPx, u_maxPx, u_gain, u_sizeMul, u_constFlux;
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
  v_col = a_col.rgb * (u_gain * flux * nearFade * radial);
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

  // Earth: Blue Marble day map, city lights, moving clouds, ocean glint and a
  // single-scattering atmosphere (Rayleigh + Mie), all ray-traced per pixel.
  SH.earthFS = `
in vec3 v_wp;
uniform vec3 u_camPos, u_sunDir;
uniform mat4 u_viewProj;
uniform mat3 u_toEarth;
uniform sampler2D u_day, u_lights, u_clouds, u_water;
uniform float u_cloudShift, u_sunI, u_atmoGain, u_opacity, u_lightsGain;
out vec4 o;
${COMMON}
const float RA = 1.025;
const float HR = 0.0032;
const float HM = 0.0006;
const vec3 BR = vec3(14.8, 34.4, 84.4);
const float BM = 36.0;

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

vec3 atmosphere(vec3 ro, vec3 rd, float t0, float t1, vec3 L, float jit, out vec3 trans){
  const int N = 14;
  const int NL = 4;
  float ds = (t1 - t0) / float(N);
  float mu = dot(rd, L);
  float pr = 0.0596831 * (1.0 + mu * mu);
  const float g = 0.76;
  float pm = 0.1193662 * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 p = ro + rd * (t0 + (float(i) + jit) * ds);
    float h = max(length(p) - 1.0, 0.0);
    float dR = exp(-h / HR) * ds;
    float dM = exp(-h / HM) * ds;
    odR += dR; odM += dM;
    vec2 tpl = raySphere(p, L, 1.0);
    if (tpl.x > 0.0 && tpl.x < 1e19) continue;
    float tl = raySphere(p, L, RA).y;
    float dsl = tl / float(NL);
    float lR = 0.0, lM = 0.0;
    for (int j = 0; j < NL; j++) {
      vec3 q = p + L * ((float(j) + 0.5) * dsl);
      float hq = max(length(q) - 1.0, 0.0);
      lR += exp(-hq / HR) * dsl;
      lM += exp(-hq / HM) * dsl;
    }
    vec3 att = exp(-(BR * (odR + lR) + BM * 1.1 * (odM + lM)));
    sumR += dR * att;
    sumM += dM * att;
  }
  trans = exp(-(BR * odR + BM * 1.1 * odM));
  return sumR * BR * pr + sumM * BM * pm;
}

void main(){
  vec3 rd = normalize(v_wp - u_camPos);
  vec3 ro = v_wp;                       // ray origin near the planet: no float cancellation
  float tCam = -length(v_wp - u_camPos);
  vec2 ta = raySphere(ro, rd, RA);
  vec2 tp = raySphere(ro, rd, 1.0);
  bool hitP = tp.x < 1e19 && tp.x > tCam;
  bool hitA = ta.x < 1e19 && ta.y > tCam;

  float tc = -dot(ro, rd);
  vec3 pc = ro + rd * (hitP ? tp.x : tc);
  vec3 n = normalize(pc);
  vec3 q = u_toEarth * n;
  vec3 Le = u_toEarth * u_sunDir;
  vec3 day = texEq(u_day, q, 0.0).rgb;
  float lights = texEq(u_lights, q, 0.0).r;
  float cloud = texEq(u_clouds, q, u_cloudShift).r;
  float cloudSh = texEq(u_clouds, normalize(q + Le * 0.012), u_cloudShift).r;
  float water = texEq(u_water, q, 0.0).r;

  if (!hitA) discard;

  vec3 L = u_sunDir;
  float NdL = dot(n, L);
  float diff = clamp((NdL + 0.02) / 1.02, 0.0, 1.0);
  vec3 V = -rd;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (hitP) {
    cloud = smoothstep(0.08, 0.95, cloud);
    cloudSh = smoothstep(0.08, 0.95, cloudSh);
    vec3 H = normalize(L + V);
    float nh = max(dot(n, H), 0.0);
    float spec = pow(nh, 120.0) * 3.0 + pow(nh, 18.0) * 0.12;
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    vec3 ground = day * (1.0 - 0.55 * cloudSh * (1.0 - cloud));
    ground = mix(ground, ground * vec3(0.85, 0.95, 1.1), water * 0.4);
    vec3 surf = ground * diff * u_sunI;
    surf += vec3(1.0, 0.9, 0.75) * (spec + fres * 0.25) * water * (1.0 - cloud) * u_sunI * smoothstep(0.0, 0.25, NdL);
    float cl = clamp((NdL + 0.08) / 1.08, 0.0, 1.0);
    vec3 cloudCol = vec3(0.98, 0.99, 1.0) * cl * u_sunI * 1.1;
    surf = mix(surf, cloudCol, cloud * 0.95);
    float night = smoothstep(0.1, -0.15, NdL);
    surf += vec3(1.0, 0.7, 0.4) * pow(lights, 1.4) * u_lightsGain * (1.0 - cloud * 0.8) * night;
    surf += mix(day, vec3(0.8), cloud) * vec3(0.55, 0.65, 0.9) * 0.018 * night;
    col = surf;
    alpha = 1.0;
  }
  float t0 = max(ta.x, tCam);
  float t1 = hitP ? tp.x : ta.y;
  vec3 trans;
  float jit = hash12(gl_FragCoord.xy);
  vec3 sc = atmosphere(ro, rd, t0, t1, L, jit, trans) * u_sunI * u_atmoGain;
  if (hitP) col = col * trans + sc;
  else col = sc;
  // Airglow: a faint rim on the night side keeps the silhouette readable.
  float limbH = length(ro + rd * tc) - 1.0;
  float airglow = exp(-pow((limbH - 0.012) / 0.006, 2.0)) * smoothstep(0.15, -0.2, dot(normalize(ro + rd * tc), L));
  if (!hitP) col += vec3(0.25, 0.55, 0.45) * airglow * 0.35;

  vec3 hitW = hitP ? pc : ro + rd * tc;
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
      this.p = {};
      this.buildPrograms();
    }

    buffer(data, usage) {
      const gl = this.gl;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
      return b;
    }

    compile(type, src, name) {
      const gl = this.gl;
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        const log = gl.getShaderInfoLog(s);
        const numbered = src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n');
        console.error('Shader error in ' + name + ':\n' + log + '\n' + numbered);
        throw new Error('Shader compile failed: ' + name + ' — ' + log);
      }
      return s;
    }

    program(name, vs, fs) {
      const gl = this.gl;
      const p = gl.createProgram();
      gl.attachShader(p, this.compile(gl.VERTEX_SHADER, HEADER + vs, name + '.vs'));
      gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, HEADER + fs, name + '.fs'));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
        throw new Error('Program link failed: ' + name + ' — ' + gl.getProgramInfoLog(p));
      }
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        const key = info.name.replace(/\[0\]$/, '');
        u[key] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
      }
      return { p, u, name };
    }

    buildPrograms() {
      const P = this.p;
      P.points = this.program('points', SH.pointsVS, SH.pointsFS);
      P.stars = this.program('stars', SH.starsVS, SH.starsFS);
      P.skyStars = this.program('skyStars', SH.skyStarsVS, SH.starsFS);
      P.sprites = this.program('sprites', SH.spritesVS, SH.spritesFS);
      P.lines = this.program('lines', SH.linesVS, SH.linesFS);
      P.earth = this.program('earth', SH.impostorVS, SH.earthFS);
      P.moon = this.program('moon', SH.impostorVS, SH.moonFS);
      P.sun = this.program('sun', SH.impostorVS, SH.sunFS);
      P.shell = this.program('shell', SH.impostorVS, SH.shellFS);
      P.skyBake = this.program('skyBake', SH.fullVS, SH.skyBakeFS);
      P.skyDraw = this.program('skyDraw', SH.fullVS, SH.skyDrawFS);
      P.down = this.program('down', SH.fullVS, SH.downFS);
      P.up = this.program('up', SH.fullVS, SH.upFS);
      P.composite = this.program('composite', SH.fullVS, SH.compositeFS);
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
      const u = Object.assign({ u_minPx: 1, u_maxPx: 24, u_gain: 1, u_sizeMul: 1, u_constFlux: 0,
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
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          if (opts.gray) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, img);
          else if (opts.srgb) gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
          else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
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
