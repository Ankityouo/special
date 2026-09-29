/* Cosmic Address — HTML labels anchored to 3D positions in any layer.
 * Greedy placement by priority avoids overlaps; sphere occluders hide labels
 * on the far side of Earth.
 */
(function () {
  'use strict';
  const CA = window.CA;

  class Labels {
    constructor(root) {
      this.root = root;
      this.els = new Map();
      this.enabled = true;
    }

    el(l) {
      let e = this.els.get(l);
      if (e) return e;
      const d = document.createElement('div');
      d.className = 'lbl ' + (l.cls || '');
      const dot = document.createElement('i');
      dot.className = 'dot';
      const t = document.createElement('div');
      t.className = 'txt';
      const b = document.createElement('b');
      b.textContent = l.text;
      t.appendChild(b);
      if (l.sub) {
        const s = document.createElement('span');
        s.className = 'sub';
        s.textContent = l.sub;
        t.appendChild(s);
      }
      d.appendChild(dot);
      d.appendChild(t);
      d.style.opacity = '0';
      this.root.appendChild(d);
      const w = Math.max(l.text.length * (l.cls === 'region' ? 9.5 : 7.4), l.sub ? l.sub.length * 6.1 : 0) + 18;
      e = { d, t, w, h: l.sub ? 32 : 18, shown: false, flip: false, lastT: '', lastO: '' };
      this.els.set(l, e);
      return e;
    }

    occluded(l, cam, p) {
      if (!l.occluders) return false;
      const o = cam.pos;
      const dx = p[0] - o[0], dy = p[1] - o[1], dz = p[2] - o[2];
      const len = Math.hypot(dx, dy, dz);
      const rd = [dx / len, dy / len, dz / len];
      for (const s of l.occluders) {
        const ox = o[0] - s.c[0], oy = o[1] - s.c[1], oz = o[2] - s.c[2];
        const b = ox * rd[0] + oy * rd[1] + oz * rd[2];
        const c = ox * ox + oy * oy + oz * oz - s.r * s.r;
        const h = b * b - c;
        if (h < 0) continue;
        const t = -b - Math.sqrt(h);
        if (t > 0 && t < len * 0.999) return true;
      }
      return false;
    }

    update(layers, G, W, H, avoid) {
      const cand = [];
      const pxCss = H / (2 * Math.tan(G.fovy / 2));
      if (this.enabled) {
        for (const L of layers) {
          if (!L.ready || L.opacity < 0.02 || !L.cam) continue;
          for (const l of L.labels) {
            let f = CA.fadeIn(l.fade, G.z) * Math.min(1, L.opacity * 1.5);
            if (f < 0.03) continue;
            const p = typeof l.pos === 'function' ? l.pos() : l.pos;
            if (!p) continue;
            const c = CA.m4.project(L.cam.viewProj, p);
            if (c[3] <= 1e-9) continue;
            const nx = c[0] / c[3], ny = c[1] / c[3];
            if (nx < -1.05 || nx > 1.05 || ny < -1.05 || ny > 1.05) continue;
            if (this.occluded(l, L.cam, p)) continue;
            if (l.hide && l.hide(p)) continue;
            const x = (nx * 0.5 + 0.5) * W, y = (0.5 - ny * 0.5) * H;
            const rpx = l.r ? (l.r * pxCss) / c[3] : 0;
            // Hide object labels once the object fills much of the screen.
            if (rpx > H * 0.3) f *= 1 - CA.smoothstep(H * 0.3, H * 0.45, rpx);
            if (f < 0.03) continue;
            cand.push({ l, x, y, f, rpx, pri: l.pri || 0 });
          }
        }
      }
      cand.sort((a, b) => b.pri - a.pri || b.f - a.f);
      const boxes = avoid ? avoid.slice() : [];
      const nAvoid = boxes.length;
      const used = new Set();
      for (const c of cand) {
        const e = this.el(c.l);
        const region = c.l.cls === 'region' || c.l.cls === 'spec-region';
        let x0, x1, y0, y1, flip = false;
        if (region) {
          x0 = c.x - e.w / 2; x1 = c.x + e.w / 2; y0 = c.y - e.h / 2; y1 = c.y + e.h / 2;
        } else {
          const off = 10 + Math.min(c.rpx, 400);
          flip = c.x + off + e.w > W - 70;
          if (flip) { x1 = c.x - off; x0 = x1 - e.w; } else { x0 = c.x + off; x1 = x0 + e.w; }
          y0 = c.y - 9; y1 = y0 + e.h;
        }
        if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
        let hit = false;
        for (let k = 0; k < boxes.length; k++) {
          const b = boxes[k], pad = k < nAvoid ? 0 : 6;
          if (x0 < b[2] + pad && x1 > b[0] - pad && y0 < b[3] + pad * 0.5 && y1 > b[1] - pad * 0.5) { hit = true; break; }
        }
        if (hit) continue;
        boxes.push([x0, y0, x1, y1]);
        used.add(c.l);
        const tr = 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0)';
        if (tr !== e.lastT) { e.d.style.transform = tr; e.lastT = tr; }
        const op = c.f.toFixed(2);
        if (op !== e.lastO) { e.d.style.opacity = op; e.lastO = op; }
        if (flip !== e.flip) { e.d.classList.toggle('flip', flip); e.flip = flip; }
        if (!region) {
          const off = (10 + Math.min(c.rpx, 400)).toFixed(0) + 'px';
          if (e.off !== off) { e.t.style.setProperty('--off', off); e.off = off; }
        }
        if (!e.shown) { e.d.style.visibility = 'visible'; e.shown = true; }
      }
      for (const [l, e] of this.els) {
        if (!used.has(l) && e.shown) {
          e.d.style.visibility = 'hidden';
          e.d.style.opacity = '0';
          e.lastO = '0';
          e.shown = false;
        }
      }
    }
  }
  CA.Labels = Labels;
})();
