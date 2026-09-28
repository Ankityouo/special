/* Cosmic Address — generative ambient score (Web Audio, no samples).
 * A slowly beating drone that darkens as you travel outward, a wind that
 * rises with zoom speed, and sparse bell tones in the reverb.
 */
(function () {
  'use strict';
  const CA = window.CA;

  class Score {
    constructor() {
      this.ctx = null;
      this.on = false;
      this.z = 7;
      this.speed = 0;
      this.nextBell = 0;
    }

    impulse(ctx, seconds, decay) {
      const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    build() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = (this.ctx = new AC());
      const master = (this.master = ctx.createGain());
      master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 3;
      master.connect(comp).connect(ctx.destination);

      const verb = (this.verb = ctx.createConvolver());
      verb.buffer = this.impulse(ctx, 6, 2.6);
      const verbGain = ctx.createGain();
      verbGain.gain.value = 0.7;
      verb.connect(verbGain).connect(master);

      // Drone: an open fifth plus ninth, each voice gently detuned by an LFO.
      const filt = (this.filter = ctx.createBiquadFilter());
      filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 0.4;
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.16;
      filt.connect(droneGain);
      droneGain.connect(master);
      droneGain.connect(verb);
      this.voices = [];
      const ratios = [1, 1.5, 2, 2.25, 3, 4.5];
      ratios.forEach((r, i) => {
        const o = ctx.createOscillator();
        o.type = i < 2 ? 'sine' : 'triangle';
        const g = ctx.createGain();
        g.gain.value = [0.5, 0.32, 0.22, 0.12, 0.09, 0.05][i];
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.03 + i * 0.017;
        const lg = ctx.createGain();
        lg.gain.value = 3 + i * 1.5; // cents
        lfo.connect(lg).connect(o.detune);
        o.connect(g).connect(filt);
        o.start(); lfo.start();
        this.voices.push({ o, r });
      });

      // Wind: looping noise through a moving band-pass.
      const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < nd.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = nb; noise.loop = true;
      const bp = (this.windFilter = ctx.createBiquadFilter());
      bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
      const wg = (this.windGain = ctx.createGain());
      wg.gain.value = 0.0;
      noise.connect(bp).connect(wg);
      wg.connect(master); wg.connect(verb);
      noise.start();
      return true;
    }

    bell(t) {
      const ctx = this.ctx;
      const scale = [0, 3, 5, 7, 10, 12, 15, 17];
      const base = 440 * Math.pow(2, (this.z < -1 ? 17 : this.z < 18 ? 12 : 5) / 12);
      const f = base * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 2.76;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      const g2 = ctx.createGain();
      g2.gain.value = 0.18;
      o.connect(g); o2.connect(g2).connect(g);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan).connect(this.verb); } else g.connect(this.verb);
      o.start(t); o2.start(t); o.stop(t + 5); o2.stop(t + 5);
    }

    async setOn(on) {
      if (on && !this.ctx && !this.build()) return false;
      if (!this.ctx) return false;
      const ctx = this.ctx, now = ctx.currentTime;
      if (on) {
        if (ctx.state === 'suspended') await ctx.resume();
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(0.55, now, 1.2);
      } else {
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(0, now, 0.25);
      }
      this.on = on;
      return true;
    }

    update(z, zSpeed) {
      this.z = z;
      if (!this.ctx || !this.on) return;
      const ctx = this.ctx, now = ctx.currentTime;
      // Outward the drone darkens and sinks; inward it rises and opens up.
      const t = CA.clamp((z - 7) / 23, 0, 1), tin = CA.clamp((7 - z) / 42, 0, 1);
      const root = 55 * Math.pow(2, (-5 * t + 7 * tin) / 12);
      for (const v of this.voices) v.o.frequency.setTargetAtTime(root * v.r, now, 2.5);
      this.filter.frequency.setTargetAtTime(1400 - 1000 * t + 2600 * tin, now, 1.5);
      const s = CA.clamp(Math.abs(zSpeed) / 3, 0, 1);
      this.windGain.gain.setTargetAtTime(0.02 + 0.55 * s * s, now, 0.25);
      this.windFilter.frequency.setTargetAtTime(300 + 1400 * s + 400 * (1 - t), now, 0.3);
      if (now > this.nextBell) {
        this.bell(now + 0.05);
        const busy = (z > 15 && z < 23) || z < -1 ? 0.6 : 1;
        this.nextBell = now + (2.5 + Math.random() * 5) * busy;
      }
    }
  }
  CA.Score = Score;
})();
