// Boot: paint the shared textures, pick a graphics tier, build the world, open the title.
import { World } from './render/world.js';
import { App } from './ui/app.js';
import { Audio } from './audio/audio.js';
import { vellum, goldLeaf, lapisGround, toURL } from './content/art.js';

function chooseQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q) return q;
  const saved = (() => { try { return JSON.parse(localStorage.getItem('hollowmere.settings.v1') || '{}').quality; } catch { return null; } })();
  if (saved) return saved;
  const touch = matchMedia('(pointer: coarse)').matches; const small = Math.min(screen.width, screen.height) < 820;
  const mem = navigator.deviceMemory || 8; const cores = navigator.hardwareConcurrency || 8;
  if (touch && small) return mem <= 3 || cores <= 4 ? 'low' : 'medium';
  return mem <= 4 || cores <= 4 ? 'medium' : 'high';
}

function fail(msg) {
  document.getElementById('loading')?.remove();
  document.getElementById('ui').innerHTML = `<div id="title"><div class="title-card vellum gilt"><h1>Hollow<span>mere</span></h1><p class="subtitle">${msg}</p></div></div>`;
}

async function boot() {
  await document.fonts.load('48px "IM Fell English"').catch(() => {});
  await document.fonts.load('italic 48px "IM Fell English"').catch(() => {});
  const root = document.documentElement.style;
  root.setProperty('--vellum', `url(${toURL(vellum(512, 512, 3))})`);
  root.setProperty('--leaf', `url(${toURL(goldLeaf(96, 11))})`);
  root.setProperty('--lapis', `url(${toURL(lapisGround(256, 256, 11))})`);
  const canvas = document.getElementById('world');
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) { fail('This browser cannot draw the board: WebGL 2 is required.'); return; }
  const quality = chooseQuality();
  const lt = document.getElementById('loadingText');
  lt.textContent = 'Raising the five Reaches…'; await new Promise((r) => setTimeout(r, 30));
  const audio = new Audio();
  let world;
  try { world = await World.create(canvas, { quality }); }
  catch (err) { console.error(err); fail('The board could not be built on this device. Try the Low graphics setting (add ?q=low to the address).'); return; }
  const app = new App(world, audio);
  window.hollowmere = { app, world };
  const params = new URLSearchParams(location.search);
  if (params.get('autoplay')) {
    // QA hook: start a game straight away (?autoplay=House&players=N&speed=fast)
    app.settings.speed = params.get('speed') || 'fast';
    app.newGame({ house: params.get('autoplay'), players: +(params.get('players') || 4), rivals: 'random' });
  } else app.showTitle();
  if (params.get('focus')) setTimeout(() => world.focusPlot(+params.get('focus'), +(params.get('dist') || 30)), 1500);   // QA: look closely at one Plot
  document.addEventListener('pointerdown', () => audio.start(), { once: true });
  const veil = document.getElementById('loading'); veil.classList.add('gone'); setTimeout(() => veil.remove(), 900);
  window.READY = true;
}
boot();
