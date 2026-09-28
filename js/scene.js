/* Cosmic Address — scene graph across 23 orders of magnitude.
 *
 * Every scale lives in its own "layer" with its own unit (Earth radii, AU,
 * light-years, kly, Mly, Gly…) so single-precision GPU math stays exact.
 * The camera is defined once, globally, as:
 *   z      = log10(distance from camera to focus, in meters)
 *   focus  = offset (meters) from Earth's centre, which glides between
 *            Earth → Sun → Galactic Centre → Local Group → Laniakea → us
 *   frame  = reference orientation, blended Earth → ecliptic → galactic
 * and each layer derives its own camera from that.
 */
(function () {
  'use strict';
  const CA = window.CA;
  const { U, v3, m4, quat, frames, smoothstep, astro } = CA;

  // ------------------------------------------------------------------ layer base
  class Layer {
    constructor(o) {
      this.name = o.name;
      this.unit = o.unit;
      this.fade = o.fade || [-1e9, -1e9, 1e9, 1e9];
      this.bound = o.bound || 1e6;        // content radius around this.center (layer units)
      this.center = o.center || [0, 0, 0];
      this.ready = false;
      this.opacity = 0;
      this.labels = [];
      this.cam = null;
    }
    vis(z) {
      const f = this.fade;
      if (z <= f[0] || z >= f[3]) return 0;
      if (z < f[1]) return smoothstep(f[0], f[1], z);
      if (z > f[2]) return 1 - smoothstep(f[2], f[3], z);
      return 1;
    }
    // Earth's position in this layer's coordinates.
    home() { return [0, 0, 0]; }
    camera(G) { return (this.cam = CA.layerCamera(this, G)); }
    *build() { this.ready = true; }
    update() {}
    draw() {}
    label(text, pos, fade, opts) {
      const l = Object.assign({ text, pos, fade, cls: '', pri: 1, sub: '' }, opts || {});
      this.labels.push(l);
      return l;
    }
  }
  CA.Layer = Layer;

  // Element-level fade helper (same 4-number convention as Layer.fade).
  CA.fadeIn = function (f, z) {
    if (z <= f[0] || z >= f[3]) return 0;
    if (z < f[1]) return smoothstep(f[0], f[1], z);
    if (z > f[2]) return 1 - smoothstep(f[2], f[3], z);
    return 1;
  };

  // ------------------------------------------------------------------ world state (time-dependent)
  const world = {
    t: 0,              // seconds since start (animation)
    jd: 0, T: 0, gmst: 0,
    earthHelio: [1, 0, 0],   // AU, scene frame
    sunDir: [-1, 0, 0],      // unit vector from Earth toward the Sun
    moon: [60, 0, 0],        // Earth radii, scene frame
    home: null,              // viewer's approximate location
  };
  CA.world = world;

  // Fixed large-scale anchors (meters, scene frame).
  const SUN_IN_GAL_KLY = [-26.66, 0.068, 0];
  CA.SUN_IN_GAL_KLY = SUN_IN_GAL_KLY;
  const anchors = {
    gcFromSun: v3.scale([26.66, -0.068, 0], U.KLY),
    lgFromGC: v3.scale(frames.lbd(121.17, -21.57, 1.2), U.MLY),
    virgoFromGC: v3.scale(frames.lbd(283.8, 74.5, 22), U.MLY),
    lanFromGC: v3.scale(frames.lbd(318, 12, 110), U.MLY),
  };
  CA.anchors = anchors;

  CA.updateWorld = function (nowMs, tSec) {
    world.t = tSec;
    world.jd = astro.julian(nowMs);
    world.T = astro.centuries(world.jd);
    world.gmst = astro.gmst(world.jd);
    const earth = astro.PLANETS[2];
    world.earthHelio = astro.planetScene(earth, world.T);
    world.sunDir = v3.norm(v3.scale(world.earthHelio, -1));
    world.moon = astro.moonScene(world.T);
  };

  // scene vector -> Earth-fixed (x: lon 0, z: north pole)
  CA.sceneToEarthFixed = function (s, gmst) {
    const e = frames.sceneToEq(s);
    const c = Math.cos(gmst), sn = Math.sin(gmst);
    return [c * e[0] + sn * e[1], -sn * e[0] + c * e[1], e[2]];
  };
  CA.earthFixedToScene = function (q, gmst) {
    const c = Math.cos(gmst), sn = Math.sin(gmst);
    return frames.eqToScene([c * q[0] - sn * q[1], sn * q[0] + c * q[1], q[2]]);
  };
  CA.latLonToScene = function (lat, lon, gmst) {
    const la = lat * CA.DEG, lo = lon * CA.DEG;
    return CA.earthFixedToScene([Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)], gmst);
  };

  // ------------------------------------------------------------------ focus path
  CA.focusAt = function (z) {
    const sun = v3.scale(world.earthHelio, -U.AU);
    const s1 = smoothstep(9.3, 11.0, z);
    const s2 = smoothstep(19.55, 21.0, z);
    const s3 = smoothstep(22.0, 22.9, z);
    const s4 = smoothstep(23.25, 23.95, z);
    const s5 = smoothstep(24.15, 24.85, z);
    const s6 = smoothstep(25.05, 26.3, z);
    const A = anchors;
    let F = v3.scale(sun, s1);
    F = v3.madd(F, A.gcFromSun, s2);
    F = v3.madd(F, A.lgFromGC, s3);
    F = v3.madd(F, v3.sub(A.virgoFromGC, A.lgFromGC), s4);
    F = v3.madd(F, v3.sub(A.lanFromGC, A.virgoFromGC), s5);
    F = v3.madd(F, v3.scale(A.lanFromGC, -1), s6);
    return F;
  };

  // ------------------------------------------------------------------ reference frames
  function basisQuat(r, u, b) { return quat.fromBasis(r, u, b); }
  CA.frameAt = function (z) {
    // Earth frame: co-rotates with the viewer's meridian; up = celestial pole.
    const home = world.home || { lat: 20, lon: 0 };
    const th = world.gmst + home.lon * CA.DEG;
    const upE = frames.NCP;
    const backE = v3.norm(frames.eqToScene([Math.cos(th), Math.sin(th), 0]));
    const rightE = v3.cross(upE, backE);
    // Ecliptic frame: up = ecliptic pole; back points from the Sun toward Earth, turned 50° ahead.
    const upC = frames.NEP;
    let backC = v3.sub(world.earthHelio, v3.scale(upC, v3.dot(world.earthHelio, upC)));
    backC = v3.rotate(v3.norm(backC), upC, 50 * CA.DEG);
    const rightC = v3.cross(upC, backC);
    // Galactic frame: up = north galactic pole; camera on the Sun's side of the centre.
    const upG = [0, 1, 0], backG = [-1, 0, 0], rightG = v3.cross(upG, backG);
    const qE = basisQuat(rightE, upE, backE);
    const qC = basisQuat(rightC, upC, backC);
    const qG = basisQuat(rightG, upG, backG);
    const a = smoothstep(9.2, 11.2, z);
    const b = smoothstep(16.2, 19.4, z);
    let q = quat.slerp(qE, qC, a);
    q = quat.slerp(q, qG, b);
    const B = quat.toBasis(q);
    return { r: B[0], u: B[1], b: B[2] };
  };

  // Camera basis from yaw/pitch in a frame.
  CA.orient = function (F, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const back = v3.norm([
      F.r[0] * cp * sy + F.u[0] * sp + F.b[0] * cp * cy,
      F.r[1] * cp * sy + F.u[1] * sp + F.b[1] * cp * cy,
      F.r[2] * cp * sy + F.u[2] * sp + F.b[2] * cp * cy,
    ]);
    const right = v3.norm([F.r[0] * cy - F.b[0] * sy, F.r[1] * cy - F.b[1] * sy, F.r[2] * cy - F.b[2] * sy]);
    const up = v3.cross(back, right);
    return { r: right, u: up, b: back };
  };

  // Yaw/pitch that would put the camera along direction dir (unit, scene) in frame F.
  CA.anglesFor = function (F, dir) {
    const x = v3.dot(dir, F.r), y = v3.dot(dir, F.u), zz = v3.dot(dir, F.b);
    return { yaw: Math.atan2(x, zz), pitch: Math.asin(CA.clamp(y, -1, 1)) };
  };

  // ------------------------------------------------------------------ per-layer cameras
  CA.layerCamera = function (layer, G) {
    const u = layer.unit;
    const home = layer.home();
    const d = Math.pow(10, G.z) / u;
    const target = [home[0] + G.focus[0] / u, home[1] + G.focus[1] / u, home[2] + G.focus[2] / u];
    const pos = v3.madd(target, G.basis.b, d);
    const distC = v3.dist(pos, layer.center);
    const far = Math.max(distC + layer.bound * 1.2, d * 3);
    const near = Math.max(Math.min(d * 2e-3, Math.max(distC - layer.bound, d * 2e-3)), far * 2e-7);
    const cam = layer.cam || (layer.cam = {
      view: m4.create(), proj: m4.create(), viewProj: m4.create(), invViewProj: m4.create(),
      rot: m4.create(), rotViewProj: m4.create(), invRotViewProj: m4.create(),
    });
    m4.viewFromBasis(cam.view, G.basis.r, G.basis.u, G.basis.b, pos);
    m4.perspective(cam.proj, G.fovy, G.aspect, near, far);
    cam.proj[8] = -(G.shift || 0);          // lens shift keeps the focus off-centre when needed
    m4.multiply(cam.viewProj, cam.proj, cam.view);
    m4.invert(cam.invViewProj, cam.viewProj);
    m4.viewFromBasis(cam.rot, G.basis.r, G.basis.u, G.basis.b, [0, 0, 0]);
    cam.pos = pos;
    cam.target = target;
    cam.d = d;
    cam.near = near;
    cam.far = far;
    cam.up = G.basis.u;
    cam.right = G.basis.r;
    cam.back = G.basis.b;
    cam.pxScale = G.pxScale;
    cam.viewport = G.viewport;
    cam.z = G.z;
    cam.fovy = G.fovy;
    cam.aspect = G.aspect;
    return cam;
  };

  // Rotation-only camera for things at infinity (sky backdrop).
  CA.skyCamera = function (G, cam) {
    cam = cam || { view: m4.create(), proj: m4.create(), viewProj: m4.create(), invViewProj: m4.create() };
    m4.viewFromBasis(cam.view, G.basis.r, G.basis.u, G.basis.b, [0, 0, 0]);
    m4.perspective(cam.proj, G.fovy, G.aspect, 0.1, 10);
    cam.proj[8] = -(G.shift || 0);
    m4.multiply(cam.viewProj, cam.proj, cam.view);
    m4.invert(cam.invViewProj, cam.viewProj);
    cam.pxScale = G.pxScale;
    cam.viewport = G.viewport;
    cam.up = G.basis.u;
    cam.pos = [0, 0, 0];
    cam.near = 0.1;
    cam.z = G.z;
    return cam;
  };

  CA.layers = [];
})();
