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
  const home = (CA.world.home = CA.guessHome());
  CA.updateWorld(Date.now(), 0);

  const ORDER = ['sky', 'beyond', 'universe', 'web', 'laniakea', 'localgroup', 'galaxy', 'stars', 'solar', 'earth'];
  const layers = ORDER.map((n) => CA.layers.find((l) => l.name === n)).filter(Boolean);
  const byName = {};
  layers.forEach((l) => { byName[l.name] = l; });
  const labels = new CA.Labels($('labels'));
  const score = new CA.Score();

  // ------------------------------------------------------------------ camera state
  const FOV = 45 * DEG;
  const ZMIN = CA.Z_MIN, ZMAX = CA.Z_MAX;
  const clampZ = (z) => clamp(z, ZMIN, ZMAX);
  const earthPitch = clamp(home.lat - 7, -70, 70) * DEG;
  const S = {
    z: CH[0].z + 0.45, zT: CH[0].z, prevZ: CH[0].z,
    yaw: 0.35, pitch: earthPitch, vYaw: 0, vPitch: 0,
    zSpeed: 0, mode: 'intro', dragging: false,
    shift: 0, fade: 0,
  };

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

  // ------------------------------------------------------------------ resolution
  let quality = 1, frameEMA = 16, lastAdapt = 0;
  const view = { w: 1, h: 1, dpr: 1 };
  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
    const maxPix = 3.4e6;
    if (w * h * dpr * dpr > maxPix) dpr = Math.sqrt(maxPix / (w * h));
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W; canvas.height = H;
      post.resize(W, H);
    }
    view.w = w; view.h = h; view.dpr = W / w;
  }
  function adapt(now, dt) {
    frameEMA += (dt * 1000 - frameEMA) * 0.05;
    if (now - lastAdapt < 1800) return;
    if (frameEMA > 27 && quality > 0.55) { quality = Math.max(0.55, quality - 0.1); lastAdapt = now; }
    else if (frameEMA < 15 && quality < 1) { quality = Math.min(1, quality + 0.1); lastAdapt = now; }
  }

  // ------------------------------------------------------------------ journey (autopilot)
  const J = { on: false, phase: 'idle', i: 0, t: 0, from: null, to: null, dur: 1, oneShot: false };

  function viewFor(ch) {
    const F = CA.frameAt(ch.z);
    const W = CA.world;
    let dir = null;
    switch (ch.id) {
      case 'earth': return { yaw: 0, pitch: earthPitch };
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
    J.from = { z: S.z, yaw: S.yaw, pitch: S.pitch };
    J.to = { z: ch.z, yaw: S.yaw + CA.wrapAngle(v.yaw - S.yaw), pitch: clamp(v.pitch, -1.4, 1.4) };
    const dz = Math.abs(ch.z - S.z);
    J.dur = opts.fast ? clamp(dz * 0.42, 2.5, 9) : clamp(dz * 1.55, 3.2, 10);
    if (reduceMotion) J.dur = Math.min(J.dur, 2.5);
    J.oneShot = !!opts.oneShot;
    S.vYaw = S.vPitch = 0;
  }

  function startJourney() {
    J.on = true;
    S.mode = 'journey';
    const cur = chapterAt(S.z);
    if (Math.abs(CH[cur].z - S.z) < 0.25 && cur < CH.length - 1) {
      J.phase = 'dwell'; J.i = cur; J.t = Math.max(0, dwellFor(CH[cur]) - 3.5);
    } else if (S.z > CH[CH.length - 1].z - 0.2) {
      goHome();
      return;
    } else travelTo(Math.min(cur + (S.z > CH[cur].z ? 1 : 0), CH.length - 1));
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
    travelTo(0, { fast: true, oneShot: true });
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
      if (u >= 1) {
        if (J.oneShot && !J.on) { J.phase = 'idle'; S.mode = 'free'; syncButtons(); }
        else { J.phase = 'dwell'; J.t = 0; }
      }
    } else if (J.phase === 'dwell' && J.on) {
      J.t += dt;
      if (!reduceMotion) S.yaw += dt * 0.028;
      if (J.t > dwellFor(CH[J.i])) {
        if (J.i < CH.length - 1) travelTo(J.i + 1);
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
    S.lastMove = performance.now();
    if (pointers.size === 1) {
      const k = 0.0042 * (e.pointerType === 'touch' ? 1.3 : 1);
      S.vYaw = -dx * k;
      S.vPitch = dy * k;
      S.yaw += S.vYaw;
      S.pitch = clamp(S.pitch + S.vPitch, -1.45, 1.45);
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
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = e.target && e.target.closest && e.target.closest('button');
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
      case 'l': case 'L': toggleLabels(); break;
      case 'm': case 'M': toggleSound(); break;
      case 'f': case 'F': toggleFull(); break;
      case 'h': case 'H': document.body.classList.toggle('bare'); break;
      case 'Escape': if (S.mode === 'intro') closeIntro(false); break;
      case 'Home': goHome(); break;
      default:
        if (/^[0-9]$/.test(e.key)) {
          // 1 Earth · 2 inner planets · 3 planets · 4 heliosphere · 5 neighbors
          // 6 Milky Way · 7 Local Group · 8 Laniakea · 9 cosmic web · 0 observable universe
          const map = { 1: 0, 2: 2, 3: 3, 4: 4, 5: 6, 6: 8, 7: 9, 8: 11, 9: 12, 0: 13 };
          if (S.mode === 'intro') closeIntro(false);
          flyTo(map[e.key]);
        }
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

  // Cosmic address lines.
  const ADDR = [{ text: 'You', sub: home.exact ? 'near ' + home.place : '', z: -Infinity, idx: 0 }];
  CH.forEach((c, i) => {
    if (!c.addr) return;
    ADDR.push({ text: c.addr, z: c.id === 'earth' ? 7.95 : c.z - 0.6, idx: i });
  });
  ADDR.forEach((a, i) => {
    const li = document.createElement('li');
    li.className = i === 0 ? 'seen' : 'pending';
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="name"></span>' + (a.sub ? '<span class="where"></span>' : '');
    b.querySelector('.name').textContent = a.text;
    if (a.sub) b.querySelector('.where').textContent = a.sub;
    b.setAttribute('aria-label', 'Go to ' + (a.text === 'You' ? 'your location on Earth' : a.text));
    b.addEventListener('click', () => { if (S.mode === 'intro') closeIntro(false); flyTo(a.idx); });
    li.appendChild(b);
    ui.addr.appendChild(li);
    a.li = li;
  });

  // Scale ruler.
  const rz = (z) => ((z - ZMIN) / (ZMAX - ZMIN)) * 100;
  for (let k = 7; k <= 30; k++) {
    const t = document.createElement('i');
    t.className = 'tick' + (k % 5 === 0 ? ' major' : '');
    t.style.bottom = rz(k) + '%';
    if (k % 5 === 0) t.dataset.label = '10' + sup(k);
    ui.track.appendChild(t);
  }
  CH.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'stop';
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
      ui.kicker.textContent = c.speculative ? 'Speculative' : 'Scale ' + (i + 1) + ' of ' + CH.length;
      ui.kicker.classList.toggle('spec', !!c.speculative);
      ui.title.textContent = c.title;
      ui.text.textContent = c.text;
      ui.homeBtn.hidden = i < CH.length - 2;
      ui.story.classList.remove('swap');
    }, reduceMotion ? 0 : 260);
  }

  let lastExp = null, lastHuman = '', lastLive = 0;
  function updateUI(now) {
    const ci = chapterAt(S.z);
    if (ci !== shownChapter) showChapter(ci);
    const viewH = 2 * Math.pow(10, S.z) * Math.tan(FOV / 2);
    const e = Math.round(Math.log10(viewH));
    if (e !== lastExp) { ui.exp.textContent = e; lastExp = e; }
    const human = CA.humanLength(viewH);
    if (human !== lastHuman) {
      ui.human.textContent = human + ' across';
      ui.light.textContent = 'light crosses this view in ' + CA.lightTime(viewH);
      lastHuman = human;
    }
    // Address: reveal lines as their scale is reached; highlight the current one.
    let cur = 0;
    ADDR.forEach((a, i) => {
      if (S.z >= a.z) {
        cur = i;
        if (a.li.classList.contains('pending')) { a.li.classList.remove('pending'); a.li.classList.add('seen'); }
      }
    });
    ADDR.forEach((a, i) => a.li.classList.toggle('current', i === cur));
    ui.knob.style.bottom = rz(S.z) + '%';
    if (now - lastLive > 15000) {
      const d = new Date();
      const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
      ui.live.textContent = 'Live · Sun, Moon and planets as of ' + hh + ':' + mm + ' UTC';
      lastLive = now;
    }
  }

  // Buttons.
  const btn = { journey: $('btn-journey'), labels: $('btn-labels'), sound: $('btn-sound'), full: $('btn-full') };
  function syncButtons() {
    btn.journey.setAttribute('aria-pressed', String(J.on));
    btn.journey.querySelector('span').textContent = J.on ? 'Pause' : 'Journey';
    btn.journey.classList.toggle('playing', J.on);
    btn.labels.setAttribute('aria-pressed', String(labels.enabled));
    btn.sound.setAttribute('aria-pressed', String(score.on));
  }
  function toggleLabels() {
    labels.enabled = !labels.enabled;
    document.body.classList.toggle('no-labels', !labels.enabled);
    syncButtons();
  }
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

    const progress = runJobs(S.mode === 'intro' ? 12 : 7);
    if (progress < 1) ui.pct.textContent = Math.round(progress * 100);
    else if (!ui.loading.hidden) ui.loading.hidden = true;

    // camera
    if (J.phase === 'travel' || (J.on && J.phase === 'dwell')) stepJourney(dt);
    else {
      const k = 1 - Math.exp(-dt / 0.26);
      S.z += (S.zT - S.z) * k;
      if (!S.dragging) {
        const f = dt * 60;                 // velocities are per 60 Hz frame
        S.yaw += S.vYaw * f;
        S.pitch = clamp(S.pitch + S.vPitch * f, -1.45, 1.45);
        const damp = Math.exp(-dt * 5);
        S.vYaw *= damp; S.vPitch *= damp;
      }
      if (S.mode === 'intro' && !reduceMotion) S.yaw += dt * 0.012;
    }
    S.zSpeed = (S.z - S.prevZ) / dt;
    S.prevZ = S.z;
    const wantShift = S.mode === 'intro' && view.w > 900 ? 0.36 : 0;
    S.shift += (wantShift - S.shift) * (1 - Math.exp(-dt * 2.2));
    S.fade = Math.min(1, S.fade + dt / 1.6);
    post.fade = S.fade;

    resize();
    adapt(now, dt);
    const F = CA.frameAt(S.z);
    const G = {
      z: S.z, focus: CA.focusAt(S.z), basis: CA.orient(F, S.yaw, S.pitch),
      fovy: FOV, aspect: canvas.width / canvas.height,
      pxScale: canvas.height / (2 * Math.tan(FOV / 2)), viewport: [canvas.width, canvas.height],
      dpr: view.dpr, shift: S.shift,
    };

    post.begin();
    for (const L of layers) {
      const op = L.ready ? L.vis(S.z) : 0;
      L.opacity = op;
      if (op < 0.002) continue;
      L.camera(G);
      L.update(G);
      post.clearDepth();
      L.draw(gfx, G, op);
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
  syncButtons();

  // Deep link: #milkyway, #laniakea, … opens directly at that scale.
  const hashId = (location.hash || '').replace('#', '');
  const linked = CH.findIndex((c) => c.id === hashId);
  if (linked >= 0) {
    closeIntro(false);
    const v = viewFor(CH[linked]);
    S.z = S.zT = S.prevZ = CH[linked].z + 0.3;
    S.zT = CH[linked].z;
    S.yaw = v.yaw; S.pitch = v.pitch;
  }
  requestAnimationFrame(frame);

  // For testing and deep links.
  CA.app = { S, J, flyTo, startJourney, pauseJourney, goHome, closeIntro, layers, jobs, chapterAt, viewFor };
})();
