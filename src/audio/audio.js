// Procedural sound for Hollowmere, made with Web Audio (no recorded files):
// a soft ambient bed (wind, water, birds by Season), a slow modal score on plucked strings and a
// drone, and sound effects for each kind of moment. Starts on the first user gesture.
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

export class Audio {
  constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.vol = 0.8; this.season = 1; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicOn ? 0.32 : 0; this.musicBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.35; this.ambBus.connect(this.master);
    // a small room reverb from a decaying noise impulse
    const len = c.sampleRate * 2.4, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb = c.createConvolver(); this.verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.35; this.verb.connect(vg).connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.ambient(); this.music();
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? this.vol : 0, this.ctx.currentTime, 0.1); }
  setMusic(v) { this.musicOn = v; if (this.musicBus) this.musicBus.gain.setTargetAtTime(v ? 0.32 : 0, this.ctx.currentTime, 0.3); }
  setSeason(s) { this.season = s; }

  noiseSrc(loop = true) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = loop; return s; }
  ambient() {
    const c = this.ctx;
    // wind: band-passed noise with a slow wandering centre
    const w = this.noiseSrc(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
    const wg = c.createGain(); wg.gain.value = 0.25; w.connect(bp).connect(wg).connect(this.ambBus); w.start();
    // water: high-passed noise, gently gated
    const r = this.noiseSrc(); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    const rg = c.createGain(); rg.gain.value = 0.05; r.connect(hp).connect(rg).connect(this.ambBus); r.start();
    const tick = () => {
      if (!this.ctx) return;
      const t = c.currentTime; const sn = (this.season - 1) % 4;
      rg.gain.setTargetAtTime(0.03 + Math.random() * 0.05, t, 0.4);
      bp.frequency.setTargetAtTime(260 + Math.random() * 360, t, 1.2);
      wg.gain.setTargetAtTime(sn === 3 ? 0.42 : sn === 2 ? 0.33 : 0.2, t, 1.5);
      if (sn < 2 && Math.random() < 0.55) this.bird(t + Math.random());
      setTimeout(tick, 1400 + Math.random() * 1600);
    };
    tick();
  }
  bird(t) {
    const c = this.ctx; const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    const f = 2600 + Math.random() * 1600; const n = 2 + (Math.random() * 3 | 0);
    g.gain.value = 0; o.connect(g).connect(this.ambBus); o.start(t);
    for (let i = 0; i < n; i++) { const s = t + i * 0.12; o.frequency.setValueAtTime(f, s); o.frequency.exponentialRampToValueAtTime(f * 1.35, s + 0.07); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.05, s + 0.01); g.gain.linearRampToValueAtTime(0, s + 0.09); }
    o.stop(t + n * 0.12 + 0.1);
  }
  // Karplus-Strong pluck: a noise burst into a tuned feedback delay.
  pluck(freq, t, vel = 0.5, bus = this.musicBus, bright = 3000) {
    const c = this.ctx; const src = this.noiseSrc(false); const burst = c.createGain();
    burst.gain.setValueAtTime(vel, t); burst.gain.setValueAtTime(0, t + 0.012);
    const d = c.createDelay(0.05); d.delayTime.value = 1 / freq; const fb = c.createGain(); fb.gain.value = 0.985;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright;
    const out = c.createGain(); out.gain.setValueAtTime(0.9, t); out.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    src.connect(burst).connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(out); out.connect(bus); out.connect(this.verb);
    src.start(t, Math.random()); src.stop(t + 0.05);
    setTimeout(() => { try { out.disconnect(); fb.disconnect(); } catch { /* gone */ } }, (t - c.currentTime + 3) * 1000);
  }
  music() {
    const c = this.ctx;
    // drone: two detuned saws through a low-pass
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; const dg = c.createGain(); dg.gain.value = 0.05;
    for (const f of [73.42, 110]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = Math.random() * 8 - 4; o.connect(lp); o.start(); }
    lp.connect(dg).connect(this.musicBus);
    let step = 0; const root = 146.83; // D
    const phrase = () => {
      if (!this.ctx) return;
      const t = c.currentTime + 0.05; const sn = (this.season - 1) % 4;
      const tempo = sn === 3 ? 0.62 : 0.48;
      const shape = [0, 2, 4, 3, 1, 2, 0, -1][step % 8];
      for (let i = 0; i < 4; i++) {
        if (Math.random() < 0.18) continue;
        const deg = shape + [0, 2, 1, 4][i] + (step % 16 > 7 ? 2 : 0);
        const oct = Math.floor(deg / 7), sem = DORIAN[((deg % 7) + 7) % 7] + oct * 12;
        this.pluck(root * Math.pow(2, sem / 12), t + i * tempo, 0.35 + Math.random() * 0.2, this.musicBus, sn === 3 ? 1800 : 2800);
      }
      if (step % 4 === 0) this.pluck(root / 2 * Math.pow(2, DORIAN[(shape + 7) % 7] / 12), t, 0.5, this.musicBus, 900);
      step++;
      setTimeout(phrase, tempo * 4 * 1000);
    };
    phrase();
  }
  // ---- effects
  env(node, t, a, peak, dec) { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0008, t + a + dec); }
  bell(freq, t, vel = 0.3, dur = 2.2) {
    const c = this.ctx; const g = c.createGain(); g.connect(this.sfxBus); g.connect(this.verb);
    for (const [r, a] of [[1, 1], [2.76, 0.4], [5.4, 0.22], [8.9, 0.1]]) { const o = c.createOscillator(); o.frequency.value = freq * r; const og = c.createGain(); og.gain.value = a * vel; o.connect(og).connect(g); o.start(t); o.stop(t + dur); }
    this.env(g, t, 0.005, 1, dur);
  }
  thump(t, freq = 90, vel = 0.6) { const c = this.ctx; const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(freq * 2, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.12); o.connect(g).connect(this.sfxBus); this.env(g, t, 0.004, vel, 0.35); o.start(t); o.stop(t + 0.5); }
  hiss(t, f = 3000, vel = 0.3, dur = 0.3, type = 'highpass') { const c = this.ctx; const s = this.noiseSrc(false), fl = c.createBiquadFilter(), g = c.createGain(); fl.type = type; fl.frequency.value = f; s.connect(fl).connect(g).connect(this.sfxBus); this.env(g, t, 0.005, vel, dur); s.start(t, Math.random()); s.stop(t + dur + 0.1); }
  play(kind, arg) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime + 0.01;
    switch (kind) {
      case 'click': this.thump(t, 420, 0.08); break;
      case 'card': this.hiss(t, 1800, 0.18, 0.18, 'bandpass'); break;
      case 'build': for (let i = 0; i < 3; i++) this.thump(t + i * 0.13, 160 + i * 20, 0.35); break;
      case 'keep': for (let i = 0; i < 4; i++) this.thump(t + i * 0.11, 120 + i * 15, 0.4); this.bell(392, t + 0.45, 0.12); break;
      case 'muster': for (let i = 0; i < 4; i++) this.thump(t + i * 0.18, 70, 0.5); break;
      case 'march': for (let i = 0; i < 6; i++) this.thump(t + i * 0.2, 60 + (i % 2) * 10, 0.4); break;
      case 'clash': this.hiss(t, 4000, 0.5, 0.25); this.hiss(t + 0.15, 5200, 0.35, 0.2); this.thump(t, 55, 0.8); break;
      case 'harvest': [0, 4, 7, 12].forEach((s, i) => this.bell(392 * Math.pow(2, s / 12), t + i * 0.09, 0.16, 1.8)); break;
      case 'seven': this.bell(196, t, 0.18, 1.2); break;
      case 'coin': this.bell(1320, t, 0.15, 0.5); this.bell(1760, t + 0.06, 0.1, 0.4); break;
      case 'favor': this.bell(659, t, 0.16, 1); break;
      case 'renown': [0, 7, 12].forEach((s, i) => this.pluck(293.66 * Math.pow(2, s / 12), t + i * 0.08, 0.5, this.sfxBus)); break;
      case 'rite': { const c = this.ctx; const o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(), g = c.createGain(); o.frequency.value = 440; m.frequency.value = 3.5; mg.gain.value = 60; m.connect(mg).connect(o.frequency); o.type = 'triangle'; o.connect(g).connect(this.sfxBus); g.connect(this.verb); this.env(g, t, 0.3, 0.18, 1.6); o.frequency.exponentialRampToValueAtTime(880, t + 1.4); o.start(t); m.start(t); o.stop(t + 2); m.stop(t + 2); this.hiss(t, 6000, 0.08, 1.4); break; }
      case 'catastrophe': this.thump(t, 40, 1); this.hiss(t, 200, 0.6, 1.8, 'lowpass'); this.bell(110, t + 0.1, 0.3, 3); break;
      case 'flood': this.hiss(t, 500, 0.4, 3, 'lowpass'); [0, 3, 7].forEach((s, i) => this.bell(146.83 * Math.pow(2, s / 12), t + i * 0.4, 0.22, 3)); break;
      case 'event': this.bell(293.66, t, 0.18, 1.6); this.bell(440, t + 0.12, 0.12, 1.4); break;
      case 'intrigue': this.pluck(220, t, 0.4, this.sfxBus, 1400); this.pluck(207.65, t + 0.18, 0.4, this.sfxBus, 1400); break;
      case 'deny': this.thump(t, 130, 0.2); this.thump(t + 0.09, 110, 0.2); break;
      case 'victory': [0, 4, 7, 12, 16, 19].forEach((s, i) => { this.bell(293.66 * Math.pow(2, s / 12), t + i * 0.16, 0.2, 2.6); this.pluck(146.83 * Math.pow(2, s / 12), t + i * 0.16, 0.5, this.sfxBus); }); break;
      case 'defeat': [0, 3, 7].forEach((s, i) => this.bell(146.83 * Math.pow(2, s / 12), t + i * 0.3, 0.2, 3)); break;
    }
    void arg;
  }
}
