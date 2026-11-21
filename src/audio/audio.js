// Procedural sound for Hollowmere, made with Web Audio (no recorded files):
// a soft ambient bed (wind, water, birds by Season), a small book of modal airs (Mixolydian,
// Dorian, Aeolian) chosen by Season and crossfaded, and sound effects for each kind of moment.
// Starts on the first user gesture.
const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };

// The score. Melodies are [scale degree, length in beats] (0 = tonic; 7 = octave), bar by bar;
// chords give the harp's open-fifth arpeggio for each bar; drum is a velocity per beat of the bar.
const AIRS = [
  { name: 'The Sedge Wren', mode: 'mixolydian', root: 392, beat: 0.24, bar: 6, form: 'AABA', lead: { A: 'flute', B: 'flute' }, arp: [0, 2, 4],
    drum: [0.9, 0, 0.3, 0.6, 0, 0.3],
    A: [[4, 2], [4, 1], [5, 2], [4, 1], [2, 2], [0, 1], [1, 2], [2, 1], [4, 2], [4, 1], [5, 2], [6, 1], [7, 3], [6, 2], [5, 1],
      [4, 2], [4, 1], [5, 2], [4, 1], [2, 2], [0, 1], [1, 2], [2, 1], [3, 2], [1, 1], [-1, 2], [1, 1], [0, 6]],
    cA: [0, 0, 0, -1, 0, 0, -1, 0],
    B: [[7, 2], [7, 1], [6, 2], [7, 1], [8, 3], [7, 2], [6, 1], [5, 2], [4, 1], [5, 2], [6, 1], [7, 3], [4, 3],
      [7, 2], [7, 1], [6, 2], [7, 1], [8, 2], [9, 1], [8, 2], [7, 1], [6, 2], [4, 1], [5, 2], [3, 1], [4, 6]],
    cB: [0, 3, -1, 0, 0, 3, -1, 4] },
  { name: 'Long Light', mode: 'dorian', root: 293.66, beat: 0.3, bar: 6, form: 'ABAB', lead: { A: 'flute', B: 'harp' }, arp: [0, 2, 4],
    drum: [0.8, 0, 0.25, 0, 0.4, 0],
    A: [[0, 2], [2, 2], [4, 2], [5, 4], [4, 2], [3, 2], [2, 2], [0, 2], [1, 6], [0, 2], [2, 2], [4, 2], [7, 3], [5, 1], [4, 2], [3, 2], [1, 2], [-1, 2], [0, 6]],
    cA: [0, 3, -1, 4, 0, 3, -1, 0],
    B: [[4, 2], [5, 2], [7, 2], [8, 4], [7, 2], [5, 2], [4, 2], [3, 2], [4, 6], [7, 2], [5, 2], [4, 2], [3, 3], [2, 1], [3, 2], [1, 2], [2, 2], [-1, 2], [0, 6]],
    cB: [4, 0, 3, 4, -1, 3, -1, 0] },
  { name: 'The Drownbell', mode: 'aeolian', root: 220, beat: 0.32, bar: 6, form: 'AABA', lead: { A: 'harp', B: 'flute' }, arp: [0, 2, 4],
    drum: [0.7, 0, 0, 0, 0.3, 0],
    A: [[0, 2], [0, 1], [2, 1], [4, 2], [3, 2], [2, 2], [0, 2], [-1, 2], [0, 2], [2, 2], [1, 4], [-1, 2], [0, 2], [0, 1], [2, 1], [4, 2], [5, 3], [4, 1], [3, 2], [2, 2], [1, 2], [-1, 2], [0, 6]],
    cA: [0, -2, -1, -1, 0, -2, -1, 0],
    B: [[7, 2], [6, 2], [4, 2], [5, 4], [4, 2], [6, 2], [4, 2], [2, 2], [4, 6], [7, 2], [9, 2], [7, 2], [6, 2], [5, 2], [4, 2], [2, 2], [3, 2], [1, 2], [0, 6]],
    cB: [0, -2, -1, 4, 0, -2, -1, 0] },
  { name: 'Ember Vigil', mode: 'dorian', root: 329.63, beat: 0.36, bar: 8, form: 'ABA', lead: { A: 'flute', B: 'flute' }, arp: [0, 2, 4, 6], drone: 0.06,
    drum: [0.35, 0, 0, 0, 0.15, 0, 0, 0],
    A: [[0, 4], [2, 2], [3, 2], [4, 6], [3, 2], [2, 4], [0, 2], [1, 2], [-1, 8], [0, 4], [2, 2], [4, 2], [5, 4], [4, 2], [2, 2], [3, 4], [1, 2], [-1, 2], [0, 8]],
    cA: [0, 3, -1, -1, 0, 3, -1, 0],
    B: [[4, 4], [5, 2], [7, 2], [6, 6], [4, 2], [5, 4], [3, 2], [2, 2], [4, 8], [7, 4], [6, 2], [4, 2], [3, 4], [2, 2], [0, 2], [1, 4], [-1, 4], [0, 8]],
    cB: [4, -1, 3, 4, 0, 3, -1, 0] },
  { name: 'Tollbridge Fair', mode: 'dorian', root: 440, beat: 0.2, bar: 6, form: 'AABB', lead: { A: 'harp', B: 'flute' }, arp: [0, 2, 4],
    drum: [0.9, 0, 0.35, 0.6, 0.2, 0.35],
    A: [[0, 1], [2, 1], [4, 1], [4, 2], [2, 1], [3, 1], [4, 1], [5, 1], [4, 2], [2, 1], [0, 1], [2, 1], [4, 1], [7, 2], [5, 1], [4, 3], [2, 3],
      [0, 1], [2, 1], [4, 1], [4, 2], [2, 1], [3, 1], [4, 1], [5, 1], [6, 2], [4, 1], [3, 2], [1, 1], [-1, 2], [1, 1], [0, 6]],
    cA: [0, 0, 0, 4, 0, -1, -1, 0],
    B: [[7, 2], [5, 1], [7, 2], [8, 1], [9, 2], [8, 1], [7, 3], [6, 2], [4, 1], [6, 2], [7, 1], [8, 3], [6, 3],
      [7, 2], [5, 1], [7, 2], [8, 1], [9, 1], [8, 1], [7, 1], [6, 2], [4, 1], [3, 2], [4, 1], [1, 2], [-1, 1], [0, 6]],
    cB: [0, 0, -1, -1, 0, 0, -1, 0] },
];
// Expand each air's form into a playable score: notes by beat, chords by bar, total length.
export const PIECES = AIRS.map((a) => {
  const notes = new Map(), chords = []; let pos = 0;
  for (const sec of a.form) {
    for (const [deg, len] of a[sec]) { notes.set(pos, [deg, len, sec]); pos += len; }
    chords.push(...a['c' + sec]);
  }
  return { ...a, notes, chords, len: pos };
});
// Spring: The Sedge Wren / Tollbridge Fair; Summer: Long Light / Tollbridge Fair; Autumn: The Drownbell; Winter: Ember Vigil.
const SEASON_PIECES = [[0, 4], [1, 4], [2], [3]];

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
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = -6;   // no resonant peak: inside a feedback loop any gain above 1 makes the filter blow up
    const out = c.createGain(); out.gain.setValueAtTime(0.9, t); out.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    src.connect(burst).connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(out); out.connect(bus); out.connect(this.verb);
    src.start(t, Math.random()); src.stop(t + 0.05);
    setTimeout(() => { try { out.disconnect(); fb.disconnect(); } catch { /* gone */ } }, (t - c.currentTime + 3) * 1000);
  }
  // ---- music: a small book of modal airs, one or two per Season, played by a lookahead
  // scheduler (flute or harp lead, harp arpeggios on open fifths, a drone and a frame drum).
  music() {
    this.step = 0; this.pieceIdx = -1; this.cur = null; this.cycle = 0;
    this.choosePiece(true);
    this.sched = setInterval(() => this.schedule(), 140);
  }
  seasonPieces() { return SEASON_PIECES[(this.season - 1) % 4]; }
  choosePiece(first = false) {
    const list = this.seasonPieces();
    const next = first || !list.includes(this.pieceIdx) ? list[0] : list[(list.indexOf(this.pieceIdx) + 1) % list.length];
    if (this.cur && next === this.pieceIdx) { this.cur.pos = -this.cur.rest; this.cycle++; return; }
    this.startPiece(next);
  }
  // Crossfade: the old piece's bus fades out (its notes ring on under the fade), the new one fades in.
  startPiece(i) {
    const c = this.ctx; const t = c.currentTime; const P = PIECES[i];
    if (this.cur) { const old = this.cur; old.bus.gain.setTargetAtTime(0, t, 1.2); for (const o of old.osc) o.stop(t + 7); setTimeout(() => { try { old.bus.disconnect(); } catch { /* gone */ } }, 8000); }
    const bus = c.createGain(); bus.gain.setValueAtTime(0, t); bus.gain.setTargetAtTime(1, t + 0.4, 1.4); bus.connect(this.musicBus);
    // drone: tonic and fifth in the low register, through a slowly breathing low-pass
    let f = P.root; while (f > 140) f /= 2;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360; lp.Q.value = 0.6;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.06; lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency);
    const dg = c.createGain(); dg.gain.value = P.drone ?? 0.05; lp.connect(dg).connect(bus);
    const osc = [lfo];
    for (const [fr, type, det] of [[f, 'sawtooth', -3], [f * 1.5, 'triangle', 4], [f * 2, 'sine', 0]]) { const o = c.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = det; o.connect(lp); o.start(t); osc.push(o); }
    lfo.start(t);
    this.pieceIdx = i; this.cycle = 0;
    this.cur = { P, bus, osc, pos: -P.bar, rest: P.bar * 2, next: t + 0.6 };
  }
  setSeason(s) {
    this.season = s;
    if (this.ctx && this.cur && !this.seasonPieces().includes(this.pieceIdx)) this.startPiece(this.seasonPieces()[0]);
  }
  freq(P, deg, oct = 0) { const m = MODES[P.mode]; const o = Math.floor(deg / 7); return P.root * Math.pow(2, (m[((deg % 7) + 7) % 7] + (o + oct) * 12) / 12); }
  schedule() {
    const c = this.ctx; if (!c || !this.cur) return;
    const S = this.cur, P = S.P; const ahead = c.currentTime + 0.5;
    if (S.next < c.currentTime - 1) S.next = c.currentTime + 0.05;          // the tab slept: skip ahead
    while (S.next < ahead) {
      const t = S.next, pos = S.pos; S.next += P.beat; S.pos++;
      if (pos >= P.len) { this.choosePiece(); if (this.cur !== S) { this.cur.next = t + P.beat * 2; return; } continue; }
      if (pos < 0 || !this.musicOn) continue;
      const inBar = pos % P.bar, bar = Math.floor(pos / P.bar);
      const sway = 1 + (Math.random() - 0.5) * 0.12;
      // frame drum
      const dv = P.drum[inBar]; if (dv) this.drum(t + (Math.random() - 0.5) * 0.012, dv * sway, S.bus);
      // harp: open-fifth arpeggio on the bar's chord
      const ch = P.chords[bar]; const ai = P.arp.indexOf(inBar);
      if (ch != null && ai >= 0) this.harp(this.freq(P, ch + [0, 4, 7, 4][ai], -1), t, 0.12 * sway, S.bus, 1.2);
      // lead
      const ev = P.notes.get(pos);
      if (ev) {
        const [deg, len, sec] = ev; const fr = this.freq(P, deg);
        const lead = P.lead[sec] || 'flute'; const dur = len * P.beat;
        if (len >= 2 && Math.random() < 0.18) { const g = this.freq(P, deg + 1); if (lead === 'flute') this.flute(g, t - 0.07, 0.07, 0.06, S.bus); else this.harp(g, t - 0.05, 0.05, S.bus, 0.3); }
        if (lead === 'flute') this.flute(fr, t, dur * 0.96, 0.1 * sway, S.bus); else this.harp(fr, t, 0.17 * sway, S.bus, Math.max(1.2, dur * 1.2));
      }
    }
  }
  // Instruments (oscillator-based so pitch is exact at any register; a handful of nodes per note).
  flute(f, t, dur, vel, bus) {
    const c = this.ctx; const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain(); o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = f; o2.frequency.value = f * 2; g2.gain.value = 0.12;
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, dur));
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g); g.connect(bus); g.connect(this.verb);
    const end = t + Math.max(0.12, dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.05); g.gain.setValueAtTime(vel * 0.85, end - 0.04); g.gain.exponentialRampToValueAtTime(0.0005, end + 0.25);
    for (const x of [o, o2, vib]) { x.start(t); x.stop(end + 0.3); }
  }
  harp(f, t, vel, bus, dur = 1.6) {
    const c = this.ctx; const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(6000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + 0.35);
    const o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain(); o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 3.01; g2.gain.value = 0.18;
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g); g.connect(bus); g.connect(this.verb);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  // A frame drum (bodhran-like): a pitched skin thump and, on accents, a soft slap.
  drum(t, vel, bus) {
    const c = this.ctx; const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(105, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.16);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
    o.connect(g).connect(bus); o.start(t); o.stop(t + 0.45);
    if (vel > 0.5) { const s = this.noiseSrc(false), bp = c.createBiquadFilter(), sg = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 1.2; s.connect(bp).connect(sg).connect(bus); sg.gain.setValueAtTime(0.06 * vel, t); sg.gain.exponentialRampToValueAtTime(0.0005, t + 0.07); s.start(t, Math.random()); s.stop(t + 0.1); }
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
