/* Cosmic Address — application: render loop, input, journey, interface. */
(function () {
  'use strict';
  const CA = window.CA;
  const { v3, clamp, frames } = CA;
  const DEG = CA.DEG;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ------------------------------------------------------------------ boot
  const canvas = $('cosmos');
  let gfx, post;
  try {
    gfx = new CA.GFX(canvas);
    post = new CA.Post(gfx);
  } catch (e) {
    console.error(e);
    fail(e && /WebGL 2/.test(e.message) ? null : e);
    return;
  }
  function fail(err) {
    $('fallback').hidden = false;
    $('intro').hidden = true;
    if (err) $('fallback-detail').textContent = String(err.message || err);
  }

  const CH = CA.CHAPTERS;
  const byId = {};
  CH.forEach((c, i) => { byId[c.id] = i; });
  const EARTH = byId.earth, YOU = byId.you;
  const home = (CA.world.home = CA.guessHome());
  CA.updateWorld(Date.now(), 0);

  // Far to near: each layer clears depth, so later layers draw over earlier ones.
  const ORDER = ['sky', 'beyond', 'universe', 'web', 'laniakea', 'localgroup', 'galaxy', 'stars', 'solar', 'earth',
    'you', 'skin', 'cell', 'dna', 'atom', 'nucleus', 'proton', 'foam'];
  const layers = ORDER.map((n) => CA.layers.find((l) => l.name === n)).filter(Boolean);
  const byName = {};
  layers.forEach((l) => { byName[l.name] = l; });
  const labels = new CA.Labels($('labels'));
  const score = new CA.Score();

  // ------------------------------------------------------------------ camera state
  // Two orientations: (yaw, pitch) in the space frames (Earth axis, ecliptic, galaxy)
  // and (yawL, pitchL) about your local vertical, used below the Earth scale.
  const FOV = 45 * DEG;
  const ZMIN = CA.Z_MIN, ZMAX = CA.Z_MAX;
  const clampZ = (z) => clamp(z, ZMIN, ZMAX);
  const earthPitch = clamp(home.lat - 7, -70, 70) * DEG;
  const TOP_DOWN = 1.449;               // 83°: looking down on your spot, as from orbit
  const LOCAL_Z = 7.19;                 // below this, dragging steers the local orientation
  const S = {
    z: CH[EARTH].z + 0.45, zT: CH[EARTH].z, prevZ: CH[EARTH].z,
    yaw: 0.15, pitch: earthPitch, yawL: 0, pitchL: TOP_DOWN, vYaw: 0, vPitch: 0,
    zSpeed: 0, mode: 'intro', dragging: false, text: true,
    shift: 0, fade: 0, lastDrag: 0,
  };
  const localActive = () => S.z < LOCAL_Z;

  // Lowest local pitch that keeps the camera above the ground (flat-ground bound).
  function pitchFloor(z) {
    if (z < -1.8 || z > 7.4) return -1.45;
    const d = Math.pow(10, z);
    const s0 = 1 - CA.smoothstep(6.3, 7.05, z);
    const fy = CA.levelMeters(z)[1] - (1 - s0) * CA.U.R_EARTH;
    const s = (Math.max(0.05, d * 0.02) - fy) / d;
    if (s <= -1) return -1.45;
    return clamp(Math.asin(Math.min(1, s)), -1.45, 1.45);
  }
  // Preferred local pitch while zooming near the ground (Google Earth-style tilt).
  const TILT = [[7.6, 83], [6.9, 83], [6.2, 70], [5.0, 30], [3.2, 20], [1.5, 12], [0.45, 9], [-0.3, 35], [-1.3, 62], [-2.6, 66]];
  function prefPitch(z) {
    if (z > TILT[0][0] || z < TILT[TILT.length - 1][0]) return null;
    for (let i = 1; i < TILT.length; i++) {
      if (z >= TILT[i][0]) {
        const a = TILT[i - 1], b = TILT[i];
        return CA.lerp(b[1], a[1], (z - b[0]) / (a[0] - b[0])) * DEG;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ progressive world building
  const jobs = layers.map((L) => ({ L, gen: null, done: false, wait: 0, ms: 0 }));
  function pickJob(now) {
    let best = null, bestD = Infinity;
    for (const j of jobs) {
      if (j.done || j.wait > now) continue;
      const f = j.L.fade;
      let d = S.z < f[0] ? f[0] - S.z : S.z > f[3] ? S.z - f[3] + 4 : 0;
      if (d < bestD) { bestD = d; best = j; }
    }
    return best;
  }
  function runJobs(budget) {
    const t0 = performance.now();
    while (performance.now() - t0 < budget) {
      const now = performance.now();
      const j = pickJob(now);
      if (!j) break;
      try {
        if (!j.gen) j.gen = j.L.build(gfx);
        const r = j.gen.next();
        j.ms += performance.now() - now;
        if (r.done) j.done = true;
        else if (r.value === 0) j.wait = now + 40;
      } catch (e) {
        console.error('Building layer "' + j.L.name + '" failed:', e);
        j.done = true;
      }
    }
    return jobs.filter((j) => j.done).length / jobs.length;
  }

  // ------------------------------------------------------------------ quality governor
  // One dial, 0..1, trades render resolution and shader detail (loop counts in the
  // heavy shaders). It drops quickly when frames run slow and climbs back slowly,
  // never straight back to a level that just proved too much. ?q=low|mid|high|ultra
  // pins it.
  const DEV = CA.device;
  const Q = { level: [0.25, 0.6, 1, 1][DEV.tier], ceiling: 1, lastDown: -1e9, lastUp: -1e9, upFrom: -1 };
  const ULTRA = DEV.tier === 3;
  function applyQuality() {
    const L = Q.level;
    Q.res = 0.42 + 0.58 * L;
    gfx.q = 0.25 + 0.75 * L;
  }
  applyQuality();
  let frameEMA = 16.7, lastAdapt = 0;
  const view = { w: 1, h: 1, dpr: 1 };
  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2) * Q.res;
    const maxPix = ULTRA ? 8.3e6 : 3.4e6;
    if (w * h * dpr * dpr > maxPix) dpr = Math.sqrt(maxPix / (w * h));
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W; canvas.height = H;
      post.resize(W, H);
    }
    view.w = w; view.h = h; view.dpr = W / w;
  }
  function adapt(now, dt, buildMs) {
    if (dt > 0.12) return;                       // a hitch (tab switch, GC): ignore
    frameEMA += (Math.max(dt * 1000 - buildMs * 0.8, 1) - frameEMA) * 0.06;
    if (DEV.forced || now - lastAdapt < 1200) return;
    if (now - Q.lastDown > 60000) Q.ceiling = 1; // try again after a minute
    if (frameEMA > 24 && Q.level > 0) {
      if (now - Q.lastUp < 5000 && Q.upFrom >= 0) Q.ceiling = Q.upFrom;
      Q.level = Math.max(0, Q.level - 0.125);
      Q.lastDown = lastAdapt = now;
      applyQuality();
    } else if (frameEMA < 18.2 && Q.level < Q.ceiling && now - Q.lastDown > 4000 && now - Q.lastUp > 4000) {
      Q.upFrom = Q.level;
      Q.level = Math.min(Q.ceiling, Q.level + 0.125);
      Q.lastUp = lastAdapt = now;
      applyQuality();
    }
  }

  // ------------------------------------------------------------------ journey (autopilot)
  // Out from Earth to the edge of everything, then back and in to the Planck length.
  const PLAY = [];
  for (let i = EARTH; i < CH.length; i++) PLAY.push(i);
  for (let i = EARTH - 1; i >= 0; i--) PLAY.push(i);
  const J = { on: false, phase: 'idle', i: 0, p: 0, t: 0, from: null, to: null, dur: 1, oneShot: false };

  function viewFor(ch) {
    const F = CA.frameAt(ch.z);
    const W = CA.world;
    let dir = null;
    switch (ch.id) {
      case 'planck': return { yawL: 1.25, pitchL: 0.3 };
      case 'uncharted': return { yawL: 1.0, pitchL: 0.35 };
      case 'proton': return { yawL: 0.85, pitchL: 0.3 };
      case 'nucleus': return { yawL: 0.7, pitchL: 0.42 };
      case 'atom': return { yawL: 0.55, pitchL: 0.38 };
      case 'dna': return CA.DNA_VIEW || { yawL: 0.45, pitchL: 0.5 };
      case 'cell': return { yawL: 0.3, pitchL: 0.95 };
      case 'skin': return { yawL: 0.25, pitchL: 1.1 };
      case 'you': return { yawL: 0.35, pitchL: 0.16 };
      case 'edge': return { yawL: 0.0, pitchL: 16 * DEG };
      case 'earth': return { yaw: 0, pitch: earthPitch, yawL: 0, pitchL: TOP_DOWN };
      case 'moon': {
        const m = v3.norm(W.moon);
        dir = v3.norm(v3.madd(v3.norm(v3.cross(m, F.u)), F.u, 0.5));
        break;
      }
      case 'inner': return { yaw: 0.3, pitch: 36 * DEG };
      case 'planets': return { yaw: 0.75, pitch: 30 * DEG };
      case 'helio': {
        const a = byName.solar && byName.solar.helioAxis ? byName.solar.helioAxis : F.b;
        dir = v3.norm(v3.madd(v3.norm(v3.cross(a, F.u)), F.u, 0.3));
        break;
      }
      case 'oort': return { yaw: 1.0, pitch: 24 * DEG };
      case 'neighbors': return { yaw: 0.5, pitch: 24 * DEG };
      case 'orion': return { yaw: -0.4, pitch: 42 * DEG };
      case 'milkyway': return { yaw: 0.1, pitch: 58 * DEG };
      case 'localgroup': {
        const m = v3.norm(frames.lbd(121.17, -21.57, 1));
        dir = v3.norm(v3.madd(v3.norm(v3.cross(m, [0, 1, 0])), [0, 1, 0], 0.4));
        break;
      }
      case 'virgo': {
        const N = frames.NSGP, vd = v3.norm(frames.lbd(283.8, 74.5, 1));
        dir = v3.norm(v3.madd(N, v3.norm(v3.cross(vd, N)), 1.2));
        break;
      }
      case 'laniakea': {
        const N = frames.NSGP, ga = v3.norm(frames.lbd(320, 0, 1));
        dir = v3.norm(v3.madd(N, v3.norm(v3.cross(ga, N)), 0.8));
        break;
      }
      case 'web': return { yaw: S.yaw + 0.5, pitch: 16 * DEG };
      case 'observable': return { yaw: S.yaw + 0.35, pitch: 13 * DEG };
      case 'beyond': return { yaw: S.yaw + 0.3, pitch: 9 * DEG };
    }
    return dir ? CA.anglesFor(F, dir) : { yaw: S.yaw, pitch: S.pitch };
  }

  function travelTo(idx, opts) {
    opts = opts || {};
    const ch = CH[idx];
    const v = viewFor(ch);
    J.phase = 'travel';
    J.t = 0;
    J.i = idx;
    J.p = Math.max(0, PLAY.indexOf(idx));
    J.from = { z: S.z, yaw: S.yaw, pitch: S.pitch, yawL: S.yawL, pitchL: S.pitchL };
    const to = { z: ch.z, yaw: S.yaw, pitch: S.pitch, yawL: S.yawL, pitchL: S.pitchL };
    if (v.yaw !== undefined) { to.yaw = S.yaw + CA.wrapAngle(v.yaw - S.yaw); to.pitch = clamp(v.pitch, -1.4, 1.4); }
    else if (ch.z < LOCAL_Z) { to.yaw = S.yaw + CA.wrapAngle(-S.yaw); to.pitch = earthPitch; }
    if (v.yawL !== undefined) { to.yawL = S.yawL + CA.wrapAngle(v.yawL - S.yawL); to.pitchL = clamp(v.pitchL, -1.4, TOP_DOWN); }
    else if (ch.z > LOCAL_Z) { to.yawL = S.yawL + CA.wrapAngle(-S.yawL); to.pitchL = TOP_DOWN; }
    J.to = to;
    const dz = Math.abs(ch.z - S.z);
    const fast = opts.fast || dz > 12;
    J.dur = fast ? clamp(dz * 0.42, 2.5, 9) : clamp(dz * 1.55, 3.2, 10);
    if (reduceMotion) J.dur = Math.min(J.dur, 2.5);
    J.oneShot = !!opts.oneShot;
    S.vYaw = S.vPitch = 0;
  }

  function startJourney() {
    J.on = true;
    S.mode = 'journey';
    const cur = chapterAt(S.z);
    const p = PLAY.indexOf(cur);
    // At either end of the map, the journey starts over from home.
    if (p === PLAY.length - 1 || (cur === CH.length - 1 && S.z > CH[cur].z - 0.2)) {
      goHome();
      return;
    }
    if (Math.abs(CH[cur].z - S.z) < 0.25) travelTo(cur);
    else {
      // Between stops: continue in the playlist's direction.
      const inward = cur < EARTH;
      const past = inward ? S.z < CH[cur].z : S.z > CH[cur].z;
      travelTo(past ? PLAY[Math.min(p + 1, PLAY.length - 1)] : cur);
    }
    syncButtons();
  }
  function pauseJourney() {
    if (!J.on && J.phase === 'idle') return;
    J.on = false;
    J.phase = 'idle';
    S.mode = 'free';
    S.zT = S.z;
    syncButtons();
  }
  function goHome() {
    J.on = false;
    S.mode = 'free';
    travelTo(EARTH, { fast: true, oneShot: true });
    syncButtons();
  }
  function flyTo(idx) {
    J.on = false;
    S.mode = 'free';
    travelTo(idx, { oneShot: true, fast: Math.abs(CH[idx].z - S.z) > 6 });
    syncButtons();
  }
  const dwellFor = (ch) => (reduceMotion ? 5 : 3.6) + ch.text.length * 0.035;

  function stepJourney(dt) {
    if (J.phase === 'travel') {
      J.t += dt;
      const u = clamp(J.t / J.dur, 0, 1);
      const e = CA.easeInOut(u);
      S.z = S.zT = CA.lerp(J.from.z, J.to.z, e);
      S.yaw = CA.lerp(J.from.yaw, J.to.yaw, e);
      S.pitch = CA.lerp(J.from.pitch, J.to.pitch, e);
      S.yawL = CA.lerp(J.from.yawL, J.to.yawL, e);
      S.pitchL = CA.lerp(J.from.pitchL, J.to.pitchL, e);
      if (u >= 1) {
        if (J.oneShot && !J.on) { J.phase = 'idle'; S.mode = 'free'; syncButtons(); }
        else { J.phase = 'dwell'; J.t = 0; }
      }
    } else if (J.phase === 'dwell' && J.on) {
      J.t += dt;
      if (!reduceMotion) {
        if (localActive()) S.yawL += dt * 0.028;
        else S.yaw += dt * 0.028;
      }
      if (J.t > dwellFor(CH[J.i])) {
        if (J.p < PLAY.length - 1) travelTo(PLAY[J.p + 1], { fast: Math.abs(CH[PLAY[J.p + 1]].z - S.z) > 12 });
        else { J.on = false; J.phase = 'idle'; S.mode = 'free'; syncButtons(); }
      }
    }
  }

  // ------------------------------------------------------------------ input
  const pointers = new Map();
  let pinch = 0;
  function userAct() {
    if (J.on || J.phase === 'travel') pauseJourney();
    if (S.mode === 'intro') closeIntro(false);
  }
  function turn(dYaw, dPitch) {
    if (localActive()) {
      S.yawL += dYaw;
      S.pitchL = clamp(S.pitchL + dPitch, -1.45, 1.45);
    } else {
      S.yaw += dYaw;
      S.pitch = clamp(S.pitch + dPitch, -1.45, 1.45);
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    S.dragging = true;
    canvas.classList.add('drag');
    userAct();
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    S.lastMove = S.lastDrag = performance.now();
    if (pointers.size === 1) {
      const k = 0.0042 * (e.pointerType === 'touch' ? 1.3 : 1);
      S.vYaw = -dx * k;
      S.vPitch = dy * k;
      turn(S.vYaw, S.vPitch);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) S.zT = clampZ(S.zT - Math.log10(d / pinch) * 1.6);
      pinch = d;
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (!pointers.size) {
      S.dragging = false;
      canvas.classList.remove('drag');
      // Held still before letting go: no fling.
      if (performance.now() - (S.lastMove || 0) > 90) S.vYaw = S.vPitch = 0;
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 32;
    else if (e.deltaMode === 2) dy *= 600;
    dy = clamp(dy, -240, 240);
    S.zT = clampZ(S.zT + dy * (e.ctrlKey ? 0.006 : 0.0019));
    userAct();
  }, { passive: false });

  // Digits jump outward; Shift+digits jump inward; , and . step one scale.
  const OUT_KEYS = { 1: 'earth', 2: 'inner', 3: 'planets', 4: 'helio', 5: 'neighbors', 6: 'milkyway', 7: 'localgroup', 8: 'laniakea', 9: 'web', 0: 'observable' };
  const IN_KEYS = { 1: 'you', 2: 'skin', 3: 'cell', 4: 'dna', 5: 'atom', 6: 'nucleus', 7: 'proton', 8: 'uncharted', 9: 'planck', 0: 'edge' };
  function step(dir) {
    const cur = chapterAt(S.zT);
    let i = cur;
    if (dir > 0) i = S.zT < CH[cur].z - 0.05 ? cur : cur + 1;
    else i = S.zT > CH[cur].z + 0.05 ? cur : cur - 1;
    flyTo(clamp(i, 0, CH.length - 1));
  }
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = e.target && e.target.closest && e.target.closest('button');
    const digit = /^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : /^[0-9]$/.test(e.key) ? e.key : null;
    if (digit !== null) {
      const id = (e.shiftKey ? IN_KEYS : OUT_KEYS)[digit];
      if (S.mode === 'intro') closeIntro(false);
      flyTo(byId[id]);
      return;
    }
    switch (e.key) {
      case ' ':
        if (onButton) return;
        e.preventDefault();
        if (S.mode === 'intro') { closeIntro(true); return; }
        if (J.on) pauseJourney(); else startJourney();
        break;
      case 'ArrowUp': case '+': case '=': e.preventDefault(); userAct(); S.zT = clampZ(S.zT - 0.25); break;
      case 'ArrowDown': case '-': case '_': e.preventDefault(); userAct(); S.zT = clampZ(S.zT + 0.25); break;
      case 'ArrowLeft': e.preventDefault(); userAct(); S.vYaw = 0.035; break;
      case 'ArrowRight': e.preventDefault(); userAct(); S.vYaw = -0.035; break;
      case ',': case '<': case 'PageDown': e.preventDefault(); if (S.mode === 'intro') closeIntro(false); step(-1); break;
      case '.': case '>': case 'PageUp': e.preventDefault(); if (S.mode === 'intro') closeIntro(false); step(1); break;
      case 'l': case 'L': toggleLabels(); break;
      case 't': case 'T': toggleText(); break;
      case 'm': case 'M': toggleSound(); break;
      case 'f': case 'F': toggleFull(); break;
      case 'h': case 'H': document.body.classList.toggle('bare'); break;
      case 'Escape': if (S.mode === 'intro') closeIntro(false); break;
      case 'Home': goHome(); break;
    }
  });

  // ------------------------------------------------------------------ interface
  const ui = {
    story: $('story'), kicker: $('ch-kicker'), title: $('ch-title'), text: $('ch-text'), homeBtn: $('btn-home'),
    exp: $('pow-exp'), human: $('human'), light: $('light'), live: $('live'),
    addr: $('addr'), knob: $('ruler-knob'), track: $('ruler-track'), loading: $('loading'), pct: $('load-pct'),
  };
  // Chapter boundaries at midpoints.
  const bounds = CH.map((c, i) => (i === 0 ? -Infinity : (CH[i - 1].z + c.z) / 2));
  function chapterAt(z) {
    let k = 0;
    for (let i = 0; i < CH.length; i++) if (z >= bounds[i]) k = i;
    return k;
  }

  // Cosmic address: one line per chapter that has one, smallest scale first.
  // Lines appear as their scale is reached, outward or inward from you.
  const ADDR = [];
  CH.forEach((c, i) => {
    if (!c.addr) return;
    const inner = i < YOU;
    const a = { text: c.addr, idx: i, sub: i === YOU && home.exact ? 'near ' + home.place : '' };
    if (i === YOU) a.seen = true;
    else if (inner) a.reveal = (z) => z <= c.z + 0.6;
    else a.reveal = (z) => z >= (c.id === 'earth' ? 7.95 : c.z - 0.6);
    ADDR.push(a);
  });
  // The address line that stays lit for each chapter.
  const lineOf = CH.map((c, i) => {
    let j = i;
    if (c.at) j = byId[c.at];
    else if (!c.addr) {
      const d = i > YOU ? -1 : 1;              // toward home
      while (!CH[j].addr) j += d;
    }
    return ADDR.findIndex((a) => a.idx === j);
  });
  ADDR.forEach((a) => {
    const li = document.createElement('li');
    li.className = a.seen ? 'seen' : 'pending';
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="name"></span>' + (a.sub ? '<span class="where"></span>' : '');
    b.querySelector('.name').textContent = a.text;
    if (a.sub) b.querySelector('.where').textContent = a.sub;
    b.setAttribute('aria-label', 'Go to ' + (a.text === 'You' ? 'yourself' : a.text === '…' ? CH[a.idx].title : a.text));
    b.addEventListener('click', () => { if (S.mode === 'intro') closeIntro(false); flyTo(a.idx); });
    li.appendChild(b);
    ui.addr.appendChild(li);
    a.li = li;
  });

  // Scale ruler.
  const rz = (z) => ((z - ZMIN) / (ZMAX - ZMIN)) * 100;
  for (let k = Math.ceil(ZMIN); k <= Math.floor(ZMAX); k++) {
    const t = document.createElement('i');
    t.className = 'tick' + (k % 5 === 0 ? ' major' : '');
    t.style.bottom = rz(k) + '%';
    if (k % 5 === 0) t.dataset.label = '10' + sup(k);
    ui.track.appendChild(t);
  }
  CH.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'stop' + (i === EARTH ? ' home-stop' : '');
    b.style.bottom = rz(c.z) + '%';
    b.title = c.title;
    b.setAttribute('aria-label', 'Go to ' + c.title);
    b.addEventListener('click', (e) => { e.stopPropagation(); if (S.mode === 'intro') closeIntro(false); flyTo(i); });
    ui.track.appendChild(b);
  });
  let scrub = false;
  const scrubTo = (e) => {
    const r = ui.track.getBoundingClientRect();
    const u = clamp((r.bottom - e.clientY) / r.height, 0, 1);
    S.zT = clampZ(ZMIN + u * (ZMAX - ZMIN));
  };
  ui.track.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('stop')) return;
    scrub = true;
    ui.track.setPointerCapture(e.pointerId);
    userAct();
    scrubTo(e);
  });
  ui.track.addEventListener('pointermove', (e) => { if (scrub) scrubTo(e); });
  ui.track.addEventListener('pointerup', () => { scrub = false; });
  ui.track.addEventListener('pointercancel', () => { scrub = false; });

  function sup(n) {
    const m = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    return String(n).split('').map((c) => m[c]).join('');
  }

  let shownChapter = -1, swapTimer = 0;
  function showChapter(i) {
    shownChapter = i;
    const c = CH[i];
    ui.story.classList.add('swap');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      ui.kicker.textContent = c.kicker || (c.speculative ? 'Speculative' : 'Scale ' + (i + 1) + ' of ' + CH.length);
      ui.kicker.classList.toggle('spec', !!(c.speculative || c.kicker));
      ui.title.textContent = c.title;
      ui.text.textContent = c.text;
      ui.homeBtn.hidden = !c.end;
      ui.story.classList.remove('swap');
    }, reduceMotion ? 0 : 260);
  }

  let lastExp = null, lastHuman = '', lastLive = 0, lastCur = -1;
  function updateUI(now) {
    const ci = chapterAt(S.z);
    if (ci !== shownChapter) showChapter(ci);
    const viewH = 2 * Math.pow(10, S.z) * Math.tan(FOV / 2);
    const e = Math.round(Math.log10(viewH));
    if (e !== lastExp) { ui.exp.textContent = String(e).replace('-', '−'); lastExp = e; }
    const human = CA.humanLength(viewH);
    if (human !== lastHuman) {
      ui.human.textContent = human + ' across';
      ui.light.textContent = 'light crosses this view in ' + CA.lightTime(viewH);
      lastHuman = human;
    }
    // Address: reveal lines as their scale is reached; highlight the current one.
    for (const a of ADDR) {
      if (!a.seen && a.reveal(S.z)) {
        a.seen = true;
        a.li.classList.remove('pending'); a.li.classList.add('seen');
      }
    }
    const cur = lineOf[ci];
    if (cur >= 0 && !ADDR[cur].seen) {
      ADDR[cur].seen = true;
      ADDR[cur].li.classList.remove('pending'); ADDR[cur].li.classList.add('seen');
    }
    if (cur !== lastCur) {
      ADDR.forEach((a, i) => {
        a.li.classList.toggle('current', i === cur);
        a.li.classList.toggle('far', Math.abs(i - cur) > 3);
      });
      lastCur = cur;
    }
    ui.knob.style.bottom = rz(S.z) + '%';
    if (now - lastLive > 15000) {
      const d = new Date();
      const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
      ui.live.textContent = 'Live · Sun, Moon and planets as of ' + hh + ':' + mm + ' UTC';
      lastLive = now;
    }
  }

  // Buttons.
  const btn = { journey: $('btn-journey'), labels: $('btn-labels'), text: $('btn-text'), sound: $('btn-sound'), full: $('btn-full') };
  const PREFS = 'cosmic-address:prefs';
  function savePrefs() {
    try { localStorage.setItem(PREFS, JSON.stringify({ text: S.text, labels: labels.enabled })); } catch (e) { /* storage unavailable */ }
  }
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS) || '{}') || {}; } catch (e) { return {}; }
  }
  function syncButtons() {
    btn.journey.setAttribute('aria-pressed', String(J.on));
    btn.journey.querySelector('span').textContent = J.on ? 'Pause' : 'Journey';
    btn.journey.classList.toggle('playing', J.on);
    btn.labels.setAttribute('aria-pressed', String(labels.enabled));
    btn.text.setAttribute('aria-pressed', String(S.text));
    btn.sound.setAttribute('aria-pressed', String(score.on));
  }
  function setLabels(on) {
    labels.enabled = on;
    CA.showGuides = on;
    document.body.classList.toggle('no-labels', !on);
    syncButtons();
  }
  function setText(on) {
    S.text = on;
    document.body.classList.toggle('no-text', !on);
    syncButtons();
  }
  function toggleLabels() { setLabels(!labels.enabled); savePrefs(); }
  function toggleText() { setText(!S.text); savePrefs(); }
  async function toggleSound() {
    await score.setOn(!score.on);
    syncButtons();
  }
  function toggleFull() {
    const d = document;
    try {
      if (d.fullscreenElement) d.exitFullscreen();
      else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => {});
    } catch (err) { /* not available here */ }
  }
  btn.journey.addEventListener('click', () => { if (S.mode === 'intro') { closeIntro(true); return; } if (J.on) pauseJourney(); else startJourney(); });
  btn.labels.addEventListener('click', toggleLabels);
  btn.text.addEventListener('click', toggleText);
  btn.sound.addEventListener('click', toggleSound);
  btn.full.addEventListener('click', toggleFull);
  if (!document.documentElement.requestFullscreen) btn.full.hidden = true;
  ui.homeBtn.addEventListener('click', goHome);

  // Intro.
  function closeIntro(journey) {
    if (S.mode !== 'intro') return;
    $('intro').classList.add('gone');
    document.body.classList.remove('intro-open');
    setTimeout(() => { $('intro').hidden = true; }, 700);
    S.mode = 'free';
    if (journey) {
      score.setOn(true).then(syncButtons);
      startJourney();
    }
    syncButtons();
  }
  $('btn-begin').addEventListener('click', () => closeIntro(true));
  $('btn-explore').addEventListener('click', () => closeIntro(false));
  document.body.classList.add('intro-open');

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    fail(new Error('The graphics context was lost. Reload the page to continue.'));
  });

  // ------------------------------------------------------------------ frame loop
  let last = performance.now();
  const t0 = last;
  let avoid = [], lastAvoid = 0;
  const avoidEls = [document.querySelector('.story'), document.querySelector('.address'), document.querySelector('.readout'),
    document.querySelector('.brand'), document.querySelector('.controls'), document.querySelector('.ruler')];
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    gfx.time = (now - t0) / 1000;
    CA.updateWorld(Date.now(), gfx.time);

    const tb = performance.now();
    const progress = runJobs(S.mode === 'intro' ? 12 : frameEMA > 30 ? 3 : 7);
    const buildMs = performance.now() - tb;
    if (progress < 1) ui.pct.textContent = Math.round(progress * 100);
    else if (!ui.loading.hidden) ui.loading.hidden = true;

    // camera
    const zBefore = S.z;
    if (J.phase === 'travel' || (J.on && J.phase === 'dwell')) stepJourney(dt);
    else {
      const k = 1 - Math.exp(-dt / 0.26);
      S.z += (S.zT - S.z) * k;
      if (!S.dragging) {
        const f = dt * 60;                 // velocities are per 60 Hz frame
        turn(S.vYaw * f, S.vPitch * f);
        const damp = Math.exp(-dt * 5);
        S.vYaw *= damp; S.vPitch *= damp;
      }
      if (S.mode === 'intro' && !reduceMotion) S.yaw += dt * 0.012 * Math.cos(gfx.time * 0.06);
      // Zooming near the ground tilts the view toward the horizon (and back),
      // unless you have just steered it yourself.
      const dz = Math.abs(S.z - zBefore);
      const pref = prefPitch(S.z);
      if (pref !== null && dz > 1e-5 && !S.dragging && now - S.lastDrag > 2500) {
        const w = Math.min(1, dz * 0.9);
        S.pitchL += (pref - S.pitchL) * w;
        if (S.z > 6.8) S.yawL += CA.wrapAngle(-S.yawL) * w;
      }
    }
    S.pitchL = Math.max(S.pitchL, pitchFloor(S.z));
    S.zSpeed = (S.z - S.prevZ) / dt;
    S.prevZ = S.z;
    const wantShift = S.mode === 'intro' && view.w > 900 ? 0.36 : 0;
    S.shift += (wantShift - S.shift) * (1 - Math.exp(-dt * 2.2));
    S.fade = Math.min(1, S.fade + dt / 1.6);
    post.fade = S.fade;
    post.zoomBlur = reduceMotion ? 0 : clamp((Math.abs(S.zSpeed) - 1.2) / 5, 0, 1);

    resize();
    adapt(now, dt, buildMs);
    const F = CA.frameAt(S.z);
    const wL = 1 - CA.smoothstep(7.0, 7.38, S.z);
    const basis = CA.slerpBasis(CA.orient(F, S.yaw, S.pitch), CA.orient(CA.localFrame(), S.yawL, S.pitchL), wL);
    const basisL = { r: CA.toLocal(basis.r), u: CA.toLocal(basis.u), b: CA.toLocal(basis.b) };
    const G = {
      z: S.z, focus: CA.focusAt(S.z), basis, basisL,
      fovy: FOV, aspect: canvas.width / canvas.height,
      pxScale: canvas.height / (2 * Math.tan(FOV / 2)), viewport: [canvas.width, canvas.height],
      dpr: view.dpr, shift: S.shift, zSpeed: S.zSpeed,
    };

    post.begin();
    for (const L of layers) {
      const op = L.ready ? L.vis(S.z) : 0;
      L.opacity = op;
      if (op < 0.002) continue;
      try {
        L.camera(G);
        L.update(G);
        post.clearDepth();
        L.draw(gfx, G, op);
      } catch (e) {
        // One broken layer (say, a shader this GPU rejects) must not stop the rest.
        console.error('Layer "' + L.name + '" failed and was turned off:', e);
        L.ready = false;
        L.opacity = 0;
      }
    }
    post.end();

    if (now - lastAvoid > 400) {
      avoid = [];
      for (const el of avoidEls) {
        if (!el || el.hidden) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && getComputedStyle(el).opacity !== '0') avoid.push([r.left - 8, r.top - 6, r.right + 8, r.bottom + 6]);
      }
      lastAvoid = now;
    }
    labels.update(layers, G, view.w, view.h, avoid);
    updateUI(now);
    score.update(S.z, S.zSpeed);
  }
  const prefs = loadPrefs();
  CA.showGuides = true;
  if (prefs.text === false) setText(false);
  if (prefs.labels === false) setLabels(false);
  syncButtons();

  // Deep link: #milkyway, #cell, #planck, … opens directly at that scale.
  const hashId = (location.hash || '').replace('#', '');
  if (byId[hashId] !== undefined) {
    const i = byId[hashId];
    closeIntro(false);
    const v = viewFor(CH[i]);
    S.z = S.prevZ = CH[i].z + 0.3;
    S.zT = CH[i].z;
    if (v.yaw !== undefined) { S.yaw = v.yaw; S.pitch = v.pitch; }
    if (v.yawL !== undefined) { S.yawL = v.yawL; S.pitchL = v.pitchL; }
  }
  requestAnimationFrame(frame);

  // For testing and deep links.
  CA.app = { S, J, Q, gfx, post, flyTo, startJourney, pauseJourney, goHome, closeIntro, layers, jobs, chapterAt, viewFor, byId, PLAY };
})();
