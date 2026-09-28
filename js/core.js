/* Cosmic Address — core: namespace, units, math, random, noise, astronomy.
 *
 * Coordinate convention used everywhere ("scene frame"):
 *   Galactic-aligned and right-handed. +X points from the Sun toward the
 *   Galactic Center, +Y points to the North Galactic Pole, +Z = X × Y
 *   (which is the direction of galactic longitude 270°).
 */
(function () {
  'use strict';
  const CA = (window.CA = window.CA || {});

  const DEG = Math.PI / 180;
  CA.DEG = DEG;

  // ---------------------------------------------------------------- units (meters)
  const U = {
    KM: 1e3,
    R_EARTH: 6.371e6,
    R_MOON: 1.7374e6,
    R_SUN: 6.957e8,
    AU: 1.495978707e11,
    LY: 9.4607304725808e15,
    PC: 3.0856775814913673e16,
    KLY: 9.4607304725808e18,
    MLY: 9.4607304725808e21,
    GLY: 9.4607304725808e24,
    C: 299792458,
  };
  CA.U = U;

  // ---------------------------------------------------------------- scalar helpers
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wrapAngle = (a) => {
    a = (a + Math.PI) % (2 * Math.PI);
    if (a < 0) a += 2 * Math.PI;
    return a - Math.PI;
  };
  CA.clamp = clamp;
  CA.lerp = lerp;
  CA.smoothstep = smoothstep;
  CA.easeInOut = easeInOut;
  CA.wrapAngle = wrapAngle;

  // ---------------------------------------------------------------- vec3 (plain arrays)
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  };
  CA.v3 = v3;

  // Rotate vector v around unit axis k by angle a (Rodrigues).
  v3.rotate = (v, k, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    const kv = v3.cross(k, v), kd = v3.dot(k, v) * (1 - c);
    return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
  };

  // ---------------------------------------------------------------- mat4 (column-major Float64Array)
  const m4 = {
    create() {
      const m = new Float64Array(16);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },
    perspective(out, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) * nf;
      out[11] = -1;
      out[14] = 2 * far * near * nf;
      return out;
    },
    // View matrix from an orthonormal camera basis: r (right), u (up), b (back = -forward).
    viewFromBasis(out, r, u, b, eye) {
      out[0] = r[0]; out[1] = u[0]; out[2] = b[0]; out[3] = 0;
      out[4] = r[1]; out[5] = u[1]; out[6] = b[1]; out[7] = 0;
      out[8] = r[2]; out[9] = u[2]; out[10] = b[2]; out[11] = 0;
      out[12] = -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]);
      out[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
      out[14] = -(b[0] * eye[0] + b[1] * eye[1] + b[2] * eye[2]);
      out[15] = 1;
      return out;
    },
    multiply(out, a, b) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      for (let i = 0; i < 4; i++) {
        const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
        out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      }
      return out;
    },
    invert(out, a) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
      const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
      const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1.0 / det;
      out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return out;
    },
    // Returns clip coordinates [x, y, z, w] of point p.
    project(m, p) {
      const x = p[0], y = p[1], z = p[2];
      return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
        m[3] * x + m[7] * y + m[11] * z + m[15],
      ];
    },
  };
  CA.m4 = m4;

  // ---------------------------------------------------------------- quaternions for frame blending
  const quat = {
    // From an orthonormal basis given as columns (x, y, z).
    fromBasis(x, y, z) {
      const m00 = x[0], m10 = x[1], m20 = x[2];
      const m01 = y[0], m11 = y[1], m21 = y[2];
      const m02 = z[0], m12 = z[1], m22 = z[2];
      const tr = m00 + m11 + m22;
      let qw, qx, qy, qz;
      if (tr > 0) {
        const s = Math.sqrt(tr + 1) * 2;
        qw = 0.25 * s; qx = (m21 - m12) / s; qy = (m02 - m20) / s; qz = (m10 - m01) / s;
      } else if (m00 > m11 && m00 > m22) {
        const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
        qw = (m21 - m12) / s; qx = 0.25 * s; qy = (m01 + m10) / s; qz = (m02 + m20) / s;
      } else if (m11 > m22) {
        const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
        qw = (m02 - m20) / s; qx = (m01 + m10) / s; qy = 0.25 * s; qz = (m12 + m21) / s;
      } else {
        const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
        qw = (m10 - m01) / s; qx = (m02 + m20) / s; qy = (m12 + m21) / s; qz = 0.25 * s;
      }
      return [qx, qy, qz, qw];
    },
    slerp(a, b, t) {
      let bx = b[0], by = b[1], bz = b[2], bw = b[3];
      let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
      if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
      let s0, s1;
      if (cos > 0.9995) { s0 = 1 - t; s1 = t; }
      else {
        const om = Math.acos(cos), so = Math.sin(om);
        s0 = Math.sin((1 - t) * om) / so;
        s1 = Math.sin(t * om) / so;
      }
      const q = [s0 * a[0] + s1 * bx, s0 * a[1] + s1 * by, s0 * a[2] + s1 * bz, s0 * a[3] + s1 * bw];
      const l = Math.hypot(q[0], q[1], q[2], q[3]);
      return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
    },
    toBasis(q) {
      const [x, y, z, w] = q;
      return [
        [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)],
        [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)],
        [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)],
      ];
    },
  };
  CA.quat = quat;

  // ---------------------------------------------------------------- random
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // A seeded random source with helpers.
  function makeRandom(seed) {
    const r = mulberry32(seed);
    let spare = null;
    const R = {
      next: r,
      range: (a, b) => a + (b - a) * r(),
      int: (n) => Math.floor(r() * n),
      gauss() {
        if (spare !== null) { const s = spare; spare = null; return s; }
        let u = 0, v = 0;
        while (u < 1e-12) u = r();
        v = r();
        const m = Math.sqrt(-2 * Math.log(u));
        spare = m * Math.sin(2 * Math.PI * v);
        return m * Math.cos(2 * Math.PI * v);
      },
      // Exponential with given scale.
      exp: (scale) => -Math.log(1 - r() * 0.999999) * scale,
      // Laplace (two-sided exponential).
      laplace: (scale) => (r() < 0.5 ? -1 : 1) * -Math.log(1 - r() * 0.999999) * scale,
      // Uniform direction on the unit sphere.
      dir() {
        const z = 2 * r() - 1, t = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z);
        return [s * Math.cos(t), z, s * Math.sin(t)];
      },
      // Point uniformly inside the unit ball.
      ball() {
        const d = R.dir(), s = Math.cbrt(r());
        return [d[0] * s, d[1] * s, d[2] * s];
      },
      pick(arr) { return arr[Math.floor(r() * arr.length)]; },
    };
    return R;
  }
  CA.makeRandom = makeRandom;

  // ---------------------------------------------------------------- noise (improved Perlin, seeded)
  function makeNoise(seed) {
    const rnd = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const grad = (h, x, y, z) => {
      h &= 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };
    function noise(x, y, z) {
      const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
      const X = fx & 255, Y = fy & 255, Z = fz & 255;
      x -= fx; y -= fy; z -= fz;
      const u = fade(x), v = fade(y), w = fade(z);
      const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
      const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
      return lerp(
        lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
          lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
          lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
        w);
    }
    function fbm(x, y, z, oct, lac, gain) {
      oct = oct || 4; lac = lac || 2.0; gain = gain || 0.5;
      let s = 0, a = 1, f = 1, n = 0;
      for (let i = 0; i < oct; i++) {
        s += a * noise(x * f, y * f, z * f);
        n += a; a *= gain; f *= lac;
      }
      return s / n;
    }
    return { noise, fbm };
  }
  CA.makeNoise = makeNoise;

  // ---------------------------------------------------------------- color
  // Approximate linear-RGB chromaticity of a blackbody (normalized so max channel = 1).
  function kelvinToRGB(T) {
    T = clamp(T, 1000, 40000) / 100;
    let r, g, b;
    if (T <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(T) - 161.1195681661;
      b = T <= 19 ? 0 : 138.5177312231 * Math.log(T - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(T - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(T - 60, -0.0755148492);
      b = 255;
    }
    const s = (c) => {
      c = clamp(c, 0, 255) / 255;
      // sRGB -> linear
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const out = [s(r), s(g), s(b)];
    const m = Math.max(out[0], out[1], out[2]) || 1;
    return [out[0] / m, out[1] / m, out[2] / m];
  }
  CA.kelvinToRGB = kelvinToRGB;

  // Temperature from a spectral type string such as "G2V", "M5.5Ve", "B0.5IV", "DZ".
  function spectralTemp(sp) {
    if (!sp) return 5800;
    const cls = sp[0].toUpperCase();
    if (cls === 'D') return 9000; // white dwarf
    if (cls === 'L') return 1800;
    if (cls === 'T') return 1100;
    const sub = parseFloat(sp.slice(1)) || 0;
    const table = { O: [42000, 30000], B: [30000, 10500], A: [10000, 7400], F: [7300, 6100], G: [6000, 5300], K: [5250, 3950], M: [3900, 2400] };
    const t = table[cls] || [5800, 5800];
    return lerp(t[0], t[1], clamp(sub / 10, 0, 1));
  }
  CA.spectralTemp = spectralTemp;

  // ---------------------------------------------------------------- frames
  // Equatorial (J2000) -> galactic rotation matrix (rows).
  const EQ2GAL = [
    [-0.0548755604, -0.8734370902, -0.4838350155],
    [0.4941094279, -0.44482963, 0.7469822445],
    [-0.867666149, -0.1980763734, 0.4559837762],
  ];
  const OBLIQUITY = 23.4392911 * DEG;

  const frames = {
    galToScene: (g) => [g[0], g[2], -g[1]],
    sceneToGal: (s) => [s[0], -s[2], s[1]],
    eqToGal(e) {
      const M = EQ2GAL;
      return [
        M[0][0] * e[0] + M[0][1] * e[1] + M[0][2] * e[2],
        M[1][0] * e[0] + M[1][1] * e[1] + M[1][2] * e[2],
        M[2][0] * e[0] + M[2][1] * e[1] + M[2][2] * e[2],
      ];
    },
    galToEq(g) {
      const M = EQ2GAL;
      return [
        M[0][0] * g[0] + M[1][0] * g[1] + M[2][0] * g[2],
        M[0][1] * g[0] + M[1][1] * g[1] + M[2][1] * g[2],
        M[0][2] * g[0] + M[1][2] * g[1] + M[2][2] * g[2],
      ];
    },
    eclToEq(v) {
      const c = Math.cos(OBLIQUITY), s = Math.sin(OBLIQUITY);
      return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
    },
    eqToScene(e) { return frames.galToScene(frames.eqToGal(e)); },
    sceneToEq(s) { return frames.galToEq(frames.sceneToGal(s)); },
    eclToScene(v) { return frames.eqToScene(frames.eclToEq(v)); },
    // Galactic longitude/latitude (degrees) and distance -> scene position.
    lbd(l, b, d) {
      const L = l * DEG, B = b * DEG;
      return frames.galToScene([d * Math.cos(B) * Math.cos(L), d * Math.cos(B) * Math.sin(L), d * Math.sin(B)]);
    },
    // Right ascension (hours), declination (degrees), distance -> scene position.
    radec(raH, decD, d) {
      const a = raH * 15 * DEG, dd = decD * DEG;
      const e = [Math.cos(dd) * Math.cos(a), Math.cos(dd) * Math.sin(a), Math.sin(dd)];
      const s = frames.eqToScene(e);
      return [s[0] * d, s[1] * d, s[2] * d];
    },
    // Ecliptic longitude/latitude (degrees) -> unit scene vector.
    eclDir(lon, lat) {
      const L = lon * DEG, B = lat * DEG;
      return frames.eclToScene([Math.cos(B) * Math.cos(L), Math.cos(B) * Math.sin(L), Math.sin(B)]);
    },
  };
  frames.NCP = frames.eqToScene([0, 0, 1]); // Earth's rotation axis
  frames.NEP = frames.eclToScene([0, 0, 1]); // ecliptic north pole
  frames.NGP = [0, 1, 0];
  // North supergalactic pole: l = 47.37°, b = +6.32°
  frames.NSGP = frames.lbd(47.37, 6.32, 1);
  CA.frames = frames;

  // ---------------------------------------------------------------- astronomy
  // J2000 Keplerian elements and rates per century (Standish, JPL).
  // [a (AU), e, I (deg), L (deg), long. perihelion (deg), long. asc. node (deg)]
  const PLANETS = [
    { name: 'Mercury', r: 2.4397e6, color: [0.66, 0.62, 0.58],
      el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
      rt: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
    { name: 'Venus', r: 6.0518e6, color: [1.0, 0.9, 0.7],
      el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
      rt: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] },
    { name: 'Earth', r: 6.371e6, color: [0.45, 0.65, 1.0],
      el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
      rt: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
    { name: 'Mars', r: 3.3895e6, color: [1.0, 0.52, 0.32],
      el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
      rt: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
    { name: 'Jupiter', r: 6.9911e7, color: [0.95, 0.82, 0.66],
      el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
      rt: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
    { name: 'Saturn', r: 5.8232e7, color: [0.97, 0.88, 0.64],
      el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
      rt: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
    { name: 'Uranus', r: 2.5362e7, color: [0.66, 0.9, 0.96],
      el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
      rt: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
    { name: 'Neptune', r: 2.4622e7, color: [0.42, 0.58, 1.0],
      el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
      rt: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
    { name: 'Pluto', r: 1.1883e6, color: [0.86, 0.76, 0.66], dwarf: true,
      el: [39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
      rt: [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482] },
  ];

  function solveKepler(M, e) {
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 12; i++) {
      const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return E;
  }

  // Heliocentric ecliptic position (AU) from elements at eccentric anomaly E.
  function orbitPoint(a, e, I, w, O, E) {
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
    return [
      (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
      (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
      sw * sI * xp + cw * sI * yp,
    ];
  }

  const astro = {
    PLANETS,
    solveKepler,
    orbitPoint,
    julian: (ms) => ms / 86400000 + 2440587.5,
    centuries: (jd) => (jd - 2451545.0) / 36525,
    // Greenwich mean sidereal time (radians).
    gmst(jd) {
      const d = jd - 2451545.0;
      let g = (280.46061837 + 360.98564736629 * d) % 360;
      if (g < 0) g += 360;
      return g * DEG;
    },
    elements(p, T) {
      const el = p.el, rt = p.rt;
      const a = el[0] + rt[0] * T, e = el[1] + rt[1] * T, I = (el[2] + rt[2] * T) * DEG;
      const L = el[3] + rt[3] * T, wb = el[4] + rt[4] * T, O = el[5] + rt[5] * T;
      return { a, e, I, w: (wb - O) * DEG, O: O * DEG, M: wrapAngle((L - wb) * DEG) };
    },
    // Heliocentric ecliptic position (AU).
    planetEcl(p, T) {
      const k = astro.elements(p, T);
      const E = solveKepler(k.M, k.e);
      return orbitPoint(k.a, k.e, k.I, k.w, k.O, E);
    },
    // Heliocentric position (AU) in the scene frame.
    planetScene(p, T) { return frames.eclToScene(astro.planetEcl(p, T)); },
    // Geocentric Moon position in ecliptic coordinates (Earth radii). ~0.3° accuracy.
    moonEcl(T) {
      const s = (x) => Math.sin(x * DEG), c = (x) => Math.cos(x * DEG);
      const lam = 218.32 + 481267.881 * T
        + 6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T)
        + 0.66 * s(235.7 + 890534.22 * T) + 0.21 * s(269.9 + 954397.74 * T)
        - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T);
      const bet = 5.13 * s(93.3 + 483202.02 * T) + 0.28 * s(228.2 + 960400.89 * T)
        - 0.28 * s(318.3 + 6003.15 * T) - 0.17 * s(217.6 - 407332.21 * T);
      const par = 0.9508 + 0.0518 * c(135.0 + 477198.87 * T) + 0.0095 * c(259.3 - 413335.36 * T)
        + 0.0078 * c(235.7 + 890534.22 * T) + 0.0028 * c(269.9 + 954397.74 * T);
      const r = 1 / Math.sin(par * DEG);
      const L = lam * DEG, B = bet * DEG;
      return [r * Math.cos(B) * Math.cos(L), r * Math.cos(B) * Math.sin(L), r * Math.sin(B)];
    },
    moonScene(T) { return frames.eclToScene(astro.moonEcl(T)); },
  };
  CA.astro = astro;

  // ---------------------------------------------------------------- formatting
  const fmt = {
    int(n) { return Math.round(n).toLocaleString('en-US'); },
    sig(n, d) {
      if (n === 0) return '0';
      const p = Math.pow(10, d - 1 - Math.floor(Math.log10(Math.abs(n))));
      const v = Math.round(n * p) / p;
      return v >= 1000 ? v.toLocaleString('en-US') : String(+v.toPrecision(d));
    },
  };
  CA.fmt = fmt;

  // A human-readable length for a size in meters.
  CA.humanLength = function (m) {
    const ly = m / U.LY;
    if (m < 1e6) return fmt.sig(m / 1e3, 3) + ' km';
    if (m < 1e9) return fmt.int(m / 1e3) + ' km';
    if (m < 0.1 * U.AU) return fmt.sig(m / 1e9, 3) + ' million km';
    if (ly < 0.1) return fmt.sig(m / U.AU, 3) + ' AU';
    if (ly < 1e6) return fmt.sig(ly, 3) + ' light-years';
    if (ly < 1e9) return fmt.sig(ly / 1e6, 3) + ' million light-years';
    if (ly < 1e12) return fmt.sig(ly / 1e9, 3) + ' billion light-years';
    return fmt.sig(ly / 1e12, 3) + ' trillion light-years';
  };

  // How long light takes to cross a distance in meters.
  CA.lightTime = function (m) {
    const s = m / U.C;
    if (s < 1) return fmt.sig(s * 1000, 2) + ' milliseconds';
    if (s < 60) return fmt.sig(s, 2) + ' seconds';
    if (s < 3600) return fmt.sig(s / 60, 2) + ' minutes';
    if (s < 86400 * 2) return fmt.sig(s / 3600, 2) + ' hours';
    const y = s / (365.25 * 86400);
    if (y < 1) return fmt.sig(s / 86400, 2) + ' days';
    if (y < 1e6) return fmt.sig(y, 3) + ' years';
    if (y < 1e9) return fmt.sig(y / 1e6, 3) + ' million years';
    if (y < 1e12) return fmt.sig(y / 1e9, 3) + ' billion years';
    return fmt.sig(y / 1e12, 3) + ' trillion years';
  };
})();
