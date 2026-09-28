/* Cosmic Address — scene graph across 65 orders of magnitude.
 *
 * Every scale lives in its own "layer" with its own unit (Planck lengths, fm,
 * pm, nm, µm, mm, m, Earth radii, AU, light-years, kly, Mly, Gly…) so
 * single-precision GPU math stays exact.
 * The camera is defined once, globally, as:
 *   z      = log10(distance from camera to focus, in meters)
 *   focus  = offset (meters) from Earth's centre, which glides between
 *            you → Earth → Sun → Galactic Centre → Local Group → Laniakea → us
 *   frame  = reference orientation, blended local horizon → Earth → ecliptic → galactic
 * and each layer derives its own camera from that.
 *
 * Below the human scale a single offset from Earth's centre cannot hold the
 * precision (a double resolves about a nanometre at Earth's radius), so the
 * inner scales are nested "levels": each has its own unit, and its origin is
 * the previous level's anchor. A layer only ever sees coordinates of its own
 * size, from a fingertip down to the Planck length.
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
      if (o.level !== undefined) this.level = typeof o.level === 'string' ? CA.levelIndex(o.level) : o.level;
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

  // The viewer's local frame (scene vectors): East, Up and South at home. Local
  // coordinates are x = east, y = up, z = south (right-handed).
  world.local = { E: [1, 0, 0], U: [0, 1, 0], S: [0, 0, 1] };
  CA.toLocal = (v) => {
    const L = world.local;
    return [v3.dot(v, L.E), v3.dot(v, L.U), v3.dot(v, L.S)];
  };
  CA.fromLocal = (p) => {
    const L = world.local;
    return [L.E[0] * p[0] + L.U[0] * p[1] + L.S[0] * p[2], L.E[1] * p[0] + L.U[1] * p[1] + L.S[1] * p[2], L.E[2] * p[0] + L.U[2] * p[1] + L.S[2] * p[2]];
  };

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
    const h = world.home || { lat: 20, lon: 0 };
    const Up = CA.latLonToScene(h.lat, h.lon, world.gmst);
    const N = v3.norm(v3.sub(frames.NCP, v3.scale(Up, v3.dot(frames.NCP, Up))));
    world.local = { E: v3.cross(N, Up), U: Up, S: v3.scale(N, -1) };
    world.sunLocal = CA.toLocal(world.sunDir);
  };

  // ------------------------------------------------------------------ inner scales
  // Nested levels below the human scale. Level k's origin is level k-1's anchor;
  // 'a' is this level's anchor in its own units, and z = [start, end] is where the
  // focus drifts from the origin to the anchor. Anchors that depend on geometry
  // (the fingertip, the chosen cell, the chosen carbon atom) are filled in by the
  // layers that own that geometry. Axes follow the local frame (x east, y up, z south).
  const LEVELS = [
    { name: 'ground', unit: 1, a: [0, 1.0, 0.05], z: [3.2, 0.9] },   // your spot on the ground -> your chest
    { name: 'body', unit: 1, a: [-0.23, 0.05, 0.42], z: [0.2, -1.45] }, // chest -> index fingertip
    { name: 'skin', unit: 1e-3, a: [0.02, 0, 0.01], z: [-2.95, -3.9] },   // fingertip -> one skin cell
    { name: 'cell', unit: 1e-6, a: [1, -5, 0], z: [-5.0, -6.45] },    // cell -> a strand of chromatin in its nucleus
    { name: 'dna', unit: 1e-9, a: [0, 0, 0], z: [-7.9, -8.6] },       // nucleosome -> one carbon atom
    { name: 'atom', unit: 1e-12, a: [0, 0, 0], z: [-20, -21] },       // the carbon's own nucleus sits at its centre
    { name: 'nucleus', unit: 1e-15, a: [1.1, 0.4, -0.6], z: [-14.0, -14.45] }, // nucleus -> one proton
    { name: 'proton', unit: 1e-15, a: [0.3, 0.1, 0.1], z: [-15.1, -16.4] },    // proton -> one up quark
    { name: 'foam', unit: U.PLANCK, a: [0, 0, 0], z: [-60, -61] },
  ];
  CA.LEVELS = LEVELS;
  CA.levelIndex = (name) => LEVELS.findIndex((l) => l.name === name);
  // 0 while zoomed out past the level's start, 1 once zoomed in past its end.
  const levelBlend = (L, z) => 1 - smoothstep(L.z[1], L.z[0], z);
  // Focus in level k's own coordinates.
  CA.levelFocus = function (k, z) {
    const f = [0, 0, 0];
    const uk = LEVELS[k].unit;
    for (let j = 0; j < LEVELS.length; j++) {
      const L = LEVELS[j];
      const b = levelBlend(L, z);
      const c = (j < k ? b - 1 : b) * (L.unit / uk);
      if (c === 0) continue;
      f[0] += L.a[0] * c; f[1] += L.a[1] * c; f[2] += L.a[2] * c;
    }
    return f;
  };
  // Offset (meters, local frame) of the focus from your spot on the ground.
  CA.levelMeters = function (z) {
    const f = [0, 0, 0];
    for (const L of LEVELS) {
      const c = levelBlend(L, z) * L.unit;
      f[0] += L.a[0] * c; f[1] += L.a[1] * c; f[2] += L.a[2] * c;
    }
    return f;
  };
  // Where level k's origin sits in level j's coordinates (j < k).
  CA.levelOrigin = function (k, j) {
    const f = [0, 0, 0];
    const uj = LEVELS[j].unit;
    for (let i = j; i < k; i++) {
      const c = LEVELS[i].unit / uj;
      f[0] += LEVELS[i].a[0] * c; f[1] += LEVELS[i].a[1] * c; f[2] += LEVELS[i].a[2] * c;
    }
    return f;
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
    const s0 = 1 - smoothstep(6.3, 7.05, z);   // Earth's centre -> your spot on the surface
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
    if (s0 > 0) {
      const m = CA.levelMeters(z);
      const p = v3.add(v3.scale(world.local.U, U.R_EARTH), CA.fromLocal(m));
      F = v3.madd(F, p, s0);
    }
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

  // The local horizon frame: yaw turns about your vertical, pitch 0 looks north
  // from the south, pitch 90° looks straight down.
  CA.localFrame = function () {
    const L = world.local;
    return { r: L.E, u: L.U, b: L.S };
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
  // Layers with a `level` live in the viewer's local frame at that level's scale;
  // all others live in the scene frame, positioned by G.focus.
  CA.layerCamera = function (layer, G) {
    const u = layer.unit;
    const d = Math.pow(10, G.z) / u;
    let target, B = G.basis;
    if (layer.level !== undefined) {
      target = CA.levelFocus(layer.level, G.z);
      B = G.basisL;
    } else {
      const home = layer.home();
      target = [home[0] + G.focus[0] / u, home[1] + G.focus[1] / u, home[2] + G.focus[2] / u];
    }
    const pos = v3.madd(target, B.b, d);
    const distC = v3.dist(pos, layer.center);
    const far = Math.max(distC + layer.bound * 1.2, d * 3);
    const near = Math.max(Math.min(d * 2e-3, Math.max(distC - layer.bound, d * 2e-3)), far * 2e-7);
    const cam = layer.cam || (layer.cam = {
      view: m4.create(), proj: m4.create(), viewProj: m4.create(), invViewProj: m4.create(),
      rot: m4.create(), rotViewProj: m4.create(), invRotViewProj: m4.create(), rotProj: m4.create(),
    });
    m4.viewFromBasis(cam.view, B.r, B.u, B.b, pos);
    m4.perspective(cam.proj, G.fovy, G.aspect, near, far);
    cam.proj[8] = -(G.shift || 0);          // lens shift keeps the focus off-centre when needed
    m4.multiply(cam.viewProj, cam.proj, cam.view);
    m4.invert(cam.invViewProj, cam.viewProj);
    // Rotation-only matrices: exact view directions however large the coordinates.
    m4.viewFromBasis(cam.rot, B.r, B.u, B.b, [0, 0, 0]);
    m4.perspective(cam.rotProj, G.fovy, G.aspect, 0.1, 10);
    cam.rotProj[8] = -(G.shift || 0);
    m4.multiply(cam.rotViewProj, cam.rotProj, cam.rot);
    m4.invert(cam.invRotViewProj, cam.rotViewProj);
    cam.pos = pos;
    cam.target = target;
    cam.d = d;
    cam.near = near;
    cam.far = far;
    cam.up = B.u;
    cam.right = B.r;
    cam.back = B.b;
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
