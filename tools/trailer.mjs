// HOLLOWMERE trailer, filmed in the game's own engine (three r170, lemo-opuscar tilt-shift post).
// Every frame is rendered at a fixed 1/30 s step with a scripted camera, captured from the page
// (3D canvas plus the title overlay), and piped into one H.264 file per shot. The soundtrack is
// the game's own modal score, rendered offline through an OfflineAudioContext.
// Usage: node tools/trailer.mjs [outDir]   (shots already rendered are kept; delete to redo)
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const OUT = process.argv[2] || 'qa/out/trailer';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;     // render only these shots
const PREVIEW = process.env.PREVIEW;                                     // "name:t" → one still, no video
fs.mkdirSync(OUT, { recursive: true });
const W = 1280, H = 720, FPS = 30;
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.on('pageerror', (e) => log('PAGEERROR', e.message));
await page.goto('http://localhost:8080/?q=high&scale=1&fps=1');
await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });

// ---- set the stage: a real game played by the AI to Season 6, the UI hidden, the title overlay
await page.evaluate(async () => {
  const E = await import('/src/rules/engine.js'); const A = await import('/src/ai/ai.js'); const T = await import('/src/render/terrain.js');
  const V = (x, y, z) => ({ x, y, z });
  const w = window.hollowmere.world; w.running = false; cancelAnimationFrame(w.raf);
  w.camera.clearViewOffset(); w.camera.aspect = innerWidth / innerHeight; w.camera.updateProjectionMatrix();
  const st = document.createElement('style');
  st.textContent = `body > *:not(canvas):not(#trailer){display:none!important}
  #trailer{position:fixed;inset:0;pointer-events:none;font-family:'IM Fell English',Georgia,serif;color:#f6ecd2;text-align:center}
  #trailer .line{position:absolute;left:0;right:0;bottom:12%;font-size:46px;letter-spacing:.02em;text-shadow:0 2px 3px rgba(0,0,0,.75),0 0 28px rgba(0,0,0,.55)}
  #trailer .line i{color:#f1d184}
  #trailer .title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(12,8,4,.55),rgba(12,8,4,.15) 70%,transparent)}
  #trailer .big{font-size:128px;line-height:1;letter-spacing:.06em;color:#f3d98e;text-shadow:0 3px 0 #6b4a16,0 6px 18px rgba(0,0,0,.8)}
  #trailer .big span{color:#f6ecd2}
  #trailer .tr-rule{width:420px;height:2px;margin:18px 0 14px;background:linear-gradient(90deg,transparent,#e2b851,transparent)}
  #trailer .tr-tag{font-size:34px;font-style:italic}
  #trailer .cta{margin-top:22px;font-size:26px;letter-spacing:.08em;color:#f1d184}`;
  document.head.append(st);
  const ov = document.createElement('div'); ov.id = 'trailer'; document.body.append(ov);
  await document.fonts.load("46px 'IM Fell English'"); await document.fonts.load("italic 34px 'IM Fell English'");

  const s = E.newGame({ houses: ['Ash', 'Verrin', 'Wren', 'Raven'], humans: [], seed: 'trailer-7', rules: 'expanded' });
  let guard = 0;
  while (s.season < 6 && s.phase !== 'over' && guard++ < 5000) { const n = A.playAI(s, { maxSteps: 1 }); if (!n && !s.pending) E.advance(s); }
  w.pieces.houses = s.houses; w.sync(E.view(s, 0), false);
  // the strongest seat on the board, for the orbit
  const best = s.plots.map((p) => [p, Object.values(p.m).reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1])[0][0];
  const pc = [((best.id - 1) % 4 - 1.5) * 10, (Math.floor((best.id - 1) / 4) - 2) * 10];
  const ph = T.heightAt(pc[0], pc[1]);

  const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t), clamp = (t) => Math.max(0, Math.min(1, t));
  const L3 = (a, b, t) => V(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  const fade = (t, a, b, dur) => clamp((t - a) / 0.6) * clamp((b - t) / 0.6);   // text fade in at a, out at b
  const line = (html, o) => `<div class="line" style="opacity:${o.toFixed(3)}">${html}</div>`;
  const look = (w, setup) => { w.setSeason(setup.season, true); w.dayPinned = setup.dusk; w.dusk = setup.dusk; w.setWeather(setup.weather || w.look.weather); };
  window.SHOTS = {
    dawn: { dur: 5, setup: () => look(w, { season: 1, dusk: 0.55 }),
      cam: (t) => { const k = ease(t / 5); return { pos: L3(V(-6, 78, 104), V(0, 46, 62), k), look: L3(V(0, 0, -12), V(0, 0, -4), k), fov: 30 }; },
      text: (t) => line('Twelve Seasons on the river <i>Sellen</i>', fade(t, 1.2, 4.6)) },
    river: { dur: 5, setup: () => look(w, { season: 2, dusk: 0.25 }),
      cam: (t) => { const k = ease(t / 5); return { pos: L3(V(-4, 6.5, 16), V(-7, 7.5, -10), k), look: L3(V(-10, 0.5, 0), V(-10, 2, -32), k), fov: 42, band: 0.16 }; },
      text: (t) => line('Eight Houses. <i>One</i> inheritance.', fade(t, 0.8, 4.6)) },
    castle: { dur: 5, setup: () => look(w, { season: 2, dusk: 0.15 }),
      cam: (t) => { const a = lerp(-0.5, 0.55, ease(t / 5)); const r = 17 - t * 0.5; return { pos: V(pc[0] + Math.sin(a) * r, ph + 10.5, pc[1] + Math.cos(a) * r), look: V(pc[0], ph + 0.8, pc[1]), fov: 36, band: 0.14 }; },
      text: (t) => line('Build. Raid. Swear Pacts, and <i>break</i> them.', fade(t, 0.8, 4.6)) },
    flood: { dur: 5, setup: () => { look(w, { season: 3, dusk: 0.3 }); w.floodStart = true; },
      cam: (t) => { const k = ease(t / 5); return { pos: L3(V(10, 17, 30), V(5, 13, 23), k), look: L3(V(0, 0, 9), V(0, 0, 7), k), fov: 36 }; },
      text: (t) => line('The Flood takes what it will.', fade(t, 1.4, 4.7)) },
    winter: { dur: 4, setup: () => look(w, { season: 4, dusk: 0.2 }),
      cam: (t) => { const k = ease(t / 4); return { pos: L3(V(28, 28, 38), V(18, 36, 46), k), look: V(0, 0, 0), fov: 32 }; },
      text: (t) => line('Heirs may be <i>false</i>. Winters are long.', fade(t, 0.6, 3.7)) },
    finale: { dur: 5, setup: () => look(w, { season: 2, dusk: 1 }),
      cam: (t) => { const k = ease(t / 5); return { pos: L3(V(0, 20, 30), V(0, 70, 92), k), look: L3(V(0, 0, 5), V(0, 0, 0), k), fov: 32 }; },
      text: (t) => { const o = clamp((t - 1.4) / 1.2); return `<div class="title" style="opacity:${o.toFixed(3)}"><div class="big">Hollow<span>mere</span></div><div class="tr-rule"></div><div class="tr-tag">A game of Houses, floods and false heirs</div><div class="cta">PLAY IN YOUR BROWSER · PHONE OR DESKTOP</div></div>`; } },
  };
  window.SHOT = null;
  window.prepShot = (name) => { const S = window.SHOTS[name]; S.setup(); window.SHOT = S; w.fixedDt = 1 / 30; w.shot = () => { const c = S.cam(window.TL); const THREE = w.camera.position.constructor; return { pos: new THREE(c.pos.x, c.pos.y, c.pos.z), look: new THREE(c.look.x, c.look.y, c.look.z), fov: c.fov, band: c.band }; };
    // let the light and weather settle before the first frame is kept
    window.TL = 0; for (let i = 0; i < 8; i++) w.frame(); };
  window.stepShot = (t) => {
    window.TL = t; const S = window.SHOT;
    if (w.floodStart && t >= 0.4) { w.floodStart = false; w.floodAnim = { t: 0, dur: 4.4, h: 0.62 }; w.setWeather('rain'); }
    if (w.floodAnim && t > 3.2) w.setWeather(w.look.weather);
    ov.innerHTML = S.text(t); w.frame();
  };
});

const shots = await page.evaluate(() => Object.entries(window.SHOTS).map(([k, v]) => [k, v.dur]));

if (PREVIEW) {
  for (const p of PREVIEW.split(',')) {
    const [name, t] = p.split(':');
    await page.evaluate(({ name, t }) => { window.prepShot(name); window.stepShot(+t); }, { name, t: +t });
    await page.screenshot({ path: `${OUT}/preview-${name}-${t}.jpg`, type: 'jpeg', quality: 92, timeout: 240000 });
    log('preview', name, t);
  }
  await browser.close(); process.exit(0);
}

// ---- shots: one file per shot, dips to black inside each file
for (const [i, [name, dur]] of shots.entries()) {
  const file = `${OUT}/${String(i + 1).padStart(2, '0')}-${name}.mp4`;
  if (ONLY && !ONLY.includes(name)) continue;
  if (fs.existsSync(file)) { log('have', file); continue; }
  await page.evaluate((n) => window.prepShot(n), name);
  const n = Math.round(dur * FPS);
  const fadeIn = i === 0 ? 1.0 : 0.25, fadeOut = i === shots.length - 1 ? 0 : 0.25;
  const vf = [`scale=1920:1080:flags=lanczos`, `fade=t=in:st=0:d=${fadeIn}`, fadeOut ? `fade=t=out:st=${(dur - fadeOut).toFixed(3)}:d=${fadeOut}` : null, 'format=yuv420p'].filter(Boolean).join(',');
  const tmp = `${OUT}/.tmp-${name}.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', vf, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))));
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    await page.evaluate((t) => window.stepShot(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92, timeout: 240000 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 30 === 0) log(name, `${f}/${n}`, `${((Date.now() - t0) / (f + 1) / 1000).toFixed(1)} s/frame`);
    if (f === n - 1) fs.writeFileSync(`${OUT}/last-${name}.jpg`, buf);
  }
  ff.stdin.end(); await done; fs.renameSync(tmp, file); log('wrote', file);
}

// ---- the score, rendered offline with the game's own instruments
const TOTAL = shots.reduce((a, [, d]) => a + d, 0) + 3;
const wavFile = `${OUT}/score.wav`;
if (!fs.existsSync(wavFile)) {
  const b64 = await page.evaluate(async (TOTAL) => {
    const { Audio } = await import('/src/audio/audio.js');
    const off = new OfflineAudioContext(2, Math.ceil(48000 * TOTAL), 48000); let ft = 0;
    const proxy = new Proxy(off, { get(t, k) { if (k === 'currentTime') return ft; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
    const realAC = window.AudioContext; window.AudioContext = function () { return proxy; };
    const A = new Audio(); A.season = 4; A.start(); clearInterval(A.sched); window.AudioContext = realAC;
    const cues = [[9.6, () => A.startPiece(4)], [15.5, () => A.play('flood')], [24, () => A.startPiece(1)], [25.4, () => A.play('victory')]];
    for (; ft < TOTAL; ft += 0.05) { while (cues.length && cues[0][0] <= ft) cues.shift()[1](); A.schedule(); }
    const buf = await off.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1), N = L.length;
    const ab = new ArrayBuffer(44 + N * 4), dv = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + N * 4, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
    dv.setUint32(24, 48000, true); dv.setUint32(28, 48000 * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, N * 4, true);
    for (let i = 0; i < N; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    let s = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, TOTAL);
  fs.writeFileSync(wavFile, Buffer.from(b64, 'base64')); log('wrote', wavFile);
}
await browser.close();

// ---- assemble: shots + a held end card, then the score
const last = shots[shots.length - 1][0];
const hold = `${OUT}/${String(shots.length + 1).padStart(2, '0')}-hold.mp4`;
if (fs.existsSync(`${OUT}/last-${last}.jpg`) && !fs.existsSync(hold)) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${OUT}/last-${last}.jpg`, '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p,loop=-1:1,trim=duration=3,fade=t=out:st=2:d=1', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(FPS), `${OUT}/.tmp-hold.mp4`]);
  fs.renameSync(`${OUT}/.tmp-hold.mp4`, hold);
}
const parts = fs.readdirSync(OUT).filter((f) => /^\d\d-.*\.mp4$/.test(f)).sort();
if (parts.length === shots.length + 1) {
  fs.writeFileSync(`${OUT}/list.txt`, parts.map((p) => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${OUT}/list.txt`, '-c', 'copy', `${OUT}/.tmp-silent.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/.tmp-silent.mp4`, '-i', wavFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', `afade=t=in:d=0.8,afade=t=out:st=${TOTAL - 2.5}:d=2.5,loudnorm=I=-16:TP=-1.5`, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', `${OUT}/.tmp-final.mp4`]);
  fs.renameSync(`${OUT}/.tmp-final.mp4`, `${OUT}/Hollowmere-trailer.mp4`);
  log('trailer', `${OUT}/Hollowmere-trailer.mp4`);
}
