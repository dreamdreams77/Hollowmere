// Art direction, painted in code. One palette and one set of drawing rules serve both the 3D
// world (textures) and the interface (images), so the game reads as a single illuminated work.
// Direction follows two lemo-opuscar styles (see docs/ART_DIRECTION.md): the board is a tilt-shift
// miniature; heraldry, cards and frames are gilded illumination (flat pigment, firm ink line,
// white-lead highlights and dots, gold laid as leaf squares).
import { HOUSES } from '../rules/data.js';

export const PIGMENT = {
  ultramarine: '#22379a', lapis: '#16235f', vermilion: '#c8321f', verdigris: '#3f8f7a', rose: '#d97a8a',
  ink: '#2a1a10', vellum: '#efe2c4', vellumDark: '#d9c59a', gold: '#c99a3e', goldLight: '#f1d184', goldDark: '#8a6420',
  white: '#fbf5e6', azure: '#4f7fc4', ochre: '#c58a3b', umber: '#5a3b22',
};
export const RES_COLOUR = { G: '#d9a93a', T: '#4f7d3a', S: '#8d8a84', I: '#4b5563', R: '#6f9a6b', C: '#d8b04a', L: '#5b6fb8' };

const cache = new Map();
const canvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};
function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};
export { shade };

// Gold leaf: squares of leaf, each its own tone, with seams, overlaps, cracks and red bole.
export function goldLeaf(size = 256, seed = 7) {
  const key = `leaf${size}:${seed}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const g = c.getContext('2d'); const rnd = seeded(seed);
  g.fillStyle = '#7a2c1c'; g.fillRect(0, 0, size, size);            // red bole beneath
  const sq = size / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const t = rnd();
    const ox = x * sq + (rnd() - 0.5) * 3, oy = y * sq + (rnd() - 0.5) * 3;
    const grad = g.createLinearGradient(ox, oy, ox + sq, oy + sq);
    const base = [201 + t * 30, 154 + t * 28, 62 + t * 20];
    grad.addColorStop(0, `rgb(${base[0] + 12},${base[1] + 14},${base[2] + 8})`);
    grad.addColorStop(1, `rgb(${base[0] - 18},${base[1] - 20},${base[2] - 14})`);
    g.fillStyle = grad; g.fillRect(ox, oy, sq + 2, sq + 2);
    g.strokeStyle = 'rgba(255,240,190,.45)'; g.lineWidth = 1; g.strokeRect(ox + 1, oy + 1, sq, sq);    // overlap ridge
    g.strokeStyle = 'rgba(90,55,15,.55)'; g.strokeRect(ox, oy, sq + 1, sq + 1);                      // seam
    for (let k = 0; k < 3; k++) {                                                                       // cracks
      g.strokeStyle = 'rgba(110,45,25,.45)'; g.beginPath();
      let px = ox + rnd() * sq, py = oy + rnd() * sq; g.moveTo(px, py);
      for (let j = 0; j < 4; j++) { px += (rnd() - 0.5) * 10; py += (rnd() - 0.5) * 10; g.lineTo(px, py); }
      g.stroke();
    }
  }
  for (let k = 0; k < size * 1.2; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,245,200,.35)' : 'rgba(120,60,20,.3)'; g.fillRect(rnd() * size, rnd() * size, 1, 1); }
  cache.set(key, c); return c;
}

// Vellum: warm sheet with grain and faint stains.
export function vellum(w = 512, h = 512, seed = 3) {
  const key = `vel${w}x${h}:${seed}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h); const g = c.getContext('2d'); const rnd = seeded(seed);
  g.fillStyle = PIGMENT.vellum; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 14; k++) {
    const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 160;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(170,130,70,${0.05 + rnd() * 0.06})`); gr.addColorStop(1, 'rgba(170,130,70,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  for (let k = 0; k < w * h / 60; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,30' : '255,250,235'},${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); }
  for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(120,90,50,${rnd() * 0.06})`; g.beginPath(); const y = rnd() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rnd() * 20 - 10, w * .6, y + rnd() * 20 - 10, w, y + rnd() * 20 - 10); g.stroke(); }
  cache.set(key, c); return c;
}

// Granular ultramarine ground (coarse grains, not noise).
export function lapisGround(w = 256, h = 256, seed = 11) {
  const key = `lap${w}x${h}:${seed}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h); const g = c.getContext('2d'); const rnd = seeded(seed);
  g.fillStyle = PIGMENT.ultramarine; g.fillRect(0, 0, w, h);
  for (let k = 0; k < w * h / 10; k++) { const t = rnd(); g.fillStyle = t < 0.5 ? `rgba(14,22,70,${0.25 + rnd() * .3})` : `rgba(80,110,210,${0.1 + rnd() * .25})`; const s = 1 + rnd() * 2; g.fillRect(rnd() * w, rnd() * h, s, s); }
  // gold stars
  for (let k = 0; k < 6; k++) star(g, rnd() * w, rnd() * h, 3 + rnd() * 3, PIGMENT.goldLight);
  cache.set(key, c); return c;
}
function star(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }

// ------------------------------------------------------------------ heraldry

const CHARGE = {
  Ash: { field: ['#b23a2e', '#7c2016'], div: 'pale', tincture: PIGMENT.goldLight, draw: flamingSword },
  Verrin: { field: ['#4f7d3a', '#2f5525'], div: 'none', tincture: PIGMENT.goldLight, draw: wheatSheaf },
  Maelor: { field: ['#c7962f', '#26201a'], div: 'bend', tincture: PIGMENT.goldLight, draw: bezants },
  Thorne: { field: ['#6b3fa0', '#45266c'], div: 'none', tincture: PIGMENT.white, draw: thornRose },
  Wren: { field: ['#3f8fa6', '#22617a'], div: 'chief', tincture: PIGMENT.white, draw: wrenBird },
  Sable: { field: ['#2d2a33', '#151318'], div: 'none', tincture: '#c9c3d8', draw: veiledEye },
  Caddoc: { field: ['#a0522d', '#6c3417'], div: 'none', tincture: PIGMENT.vellum, draw: quill },
  Raven: { field: ['#24344d', '#141e30'], div: 'none', tincture: '#e6ecf3', draw: raven },
};

function shieldPath(g, w, h) {
  g.beginPath();
  g.moveTo(w * 0.08, h * 0.06); g.lineTo(w * 0.92, h * 0.06); g.lineTo(w * 0.92, h * 0.5);
  g.bezierCurveTo(w * 0.92, h * 0.78, w * 0.66, h * 0.9, w * 0.5, h * 0.97);
  g.bezierCurveTo(w * 0.34, h * 0.9, w * 0.08, h * 0.78, w * 0.08, h * 0.5);
  g.closePath();
}
function inkStroke(g, w, col = PIGMENT.ink) { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }

// A heraldic shield for House `name` on a canvas of size s (square-ish). gilt: gold-leaf rim.
export function shield(name, s = 256, { gilt = true } = {}) {
  const key = `sh:${name}:${s}:${gilt}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(s, Math.round(s * 1.12)); const g = c.getContext('2d'); const W = c.width, H = c.height;
  const ch = CHARGE[name];
  // rim of gold leaf
  g.save(); shieldPath(g, W, H);
  if (gilt) { g.fillStyle = g.createPattern(goldLeaf(128, name.length * 13), 'repeat'); g.fill(); }
  g.restore();
  // field
  g.save(); g.translate(W * 0.05, H * 0.045); g.scale(0.9, 0.91); shieldPath(g, W, H); g.clip();
  g.fillStyle = ch.field[0]; g.fillRect(0, 0, W, H);
  g.fillStyle = ch.field[1];
  if (ch.div === 'pale') g.fillRect(W / 2, 0, W / 2, H);
  if (ch.div === 'bend') { g.beginPath(); g.moveTo(0, 0); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill(); }
  if (ch.div === 'chief') g.fillRect(0, 0, W, H * 0.28);
  // granular texture over the pigment
  const rnd = seeded(name.length * 97);
  for (let k = 0; k < W * H / 14; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.06)'; g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
  // rim shade inside the outline
  shieldPath(g, W, H); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = W * 0.07; g.stroke();
  ch.draw(g, W, H, ch.tincture);
  g.restore();
  // ink outline + white-lead edge
  g.save(); g.translate(W * 0.05, H * 0.045); g.scale(0.9, 0.91); shieldPath(g, W, H); inkStroke(g, W * 0.022); g.restore();
  shieldPath(g, W, H); inkStroke(g, W * 0.018);
  g.save(); g.translate(W * 0.05, H * 0.045); g.scale(0.9, 0.91);
  g.beginPath(); g.moveTo(W * 0.12, H * 0.1); g.lineTo(W * 0.88, H * 0.1); g.strokeStyle = 'rgba(255,250,235,.55)'; g.lineWidth = W * 0.012; g.stroke();
  g.restore();
  cache.set(key, c); return c;
}

function charge(g, W, H, fn) { g.save(); g.translate(W / 2, H * 0.46); const s = W / 256; g.scale(s, s); fn(); g.restore(); }
function fillInk(g, col, lw = 6) { g.fillStyle = col; g.fill(); inkStroke(g, lw); }
function whiteDots(g, pts) { g.fillStyle = PIGMENT.white; for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill(); } }

function flamingSword(g, W, H, col) {
  charge(g, W, H, () => {
    g.beginPath(); g.moveTo(0, -95); g.lineTo(12, -70); g.lineTo(10, 55); g.lineTo(-10, 55); g.lineTo(-12, -70); g.closePath(); fillInk(g, '#e8e4dc');
    g.beginPath(); g.moveTo(-48, 55); g.lineTo(48, 55); g.lineTo(48, 68); g.lineTo(-48, 68); g.closePath(); fillInk(g, col);
    g.beginPath(); g.rect(-8, 68, 16, 34); fillInk(g, '#5a3b22');
    g.beginPath(); g.arc(0, 108, 10, 0, Math.PI * 2); fillInk(g, col);
    for (const sx of [-1, 1]) {   // flames licking the blade
      g.beginPath(); g.moveTo(sx * 12, 40);
      g.bezierCurveTo(sx * 46, 20, sx * 20, -10, sx * 40, -40); g.bezierCurveTo(sx * 22, -26, sx * 26, -5, sx * 12, -2); g.closePath();
      fillInk(g, '#f08a2c', 4);
    }
    g.strokeStyle = PIGMENT.white; g.lineWidth = 3; g.beginPath(); g.moveTo(-3, -80); g.lineTo(-3, 45); g.stroke();
  });
}
function wheatSheaf(g, W, H, col) {
  charge(g, W, H, () => {
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.13;
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(-3, 100); g.lineTo(3, 100); g.lineTo(3, -40); g.lineTo(-3, -40); g.closePath(); fillInk(g, col, 3);
      for (let k = 0; k < 5; k++) { for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 8, -50 - k * 14, 6, 11, sx * 0.4, 0, Math.PI * 2); fillInk(g, col, 3); } }
      g.beginPath(); g.ellipse(0, -122, 6, 12, 0, 0, Math.PI * 2); fillInk(g, col, 3);
      g.restore();
    }
    g.beginPath(); g.rect(-34, 30, 68, 16); fillInk(g, PIGMENT.vermilion, 5);
    whiteDots(g, [[-20, 38], [0, 38], [20, 38]]);
  });
}
function bezants(g, W, H, col) {
  charge(g, W, H, () => {
    for (const [x, y] of [[-48, -40], [48, -40], [0, 50]]) {
      g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); fillInk(g, col, 6);
      g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.strokeStyle = 'rgba(90,55,15,.6)'; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.arc(x - 8, y - 10, 9, Math.PI, Math.PI * 1.7); g.strokeStyle = PIGMENT.white; g.lineWidth = 4; g.stroke();
    }
  });
}
function thornRose(g, W, H, col) {
  charge(g, W, H, () => {
    g.strokeStyle = '#1f3a1c'; g.lineWidth = 10; g.beginPath(); g.moveTo(0, 105); g.bezierCurveTo(-30, 70, 30, 40, 0, 20); g.stroke();
    for (const [x, y, s] of [[-14, 80, -1], [12, 60, 1], [-8, 40, -1]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 18, y - 6); g.lineTo(x + s * 2, y - 10); g.closePath(); fillInk(g, '#1f3a1c', 3); }
    for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * Math.PI * 2 / 5); g.beginPath(); g.ellipse(0, -48, 30, 38, 0, 0, Math.PI * 2); g.translate(0, -18); fillInk(g, col, 6); g.restore(); }
    g.beginPath(); g.arc(0, -18, 22, 0, Math.PI * 2); fillInk(g, PIGMENT.goldLight, 5);
    whiteDots(g, [[-8, -24], [6, -10], [8, -28]]);
  });
}
function wrenBird(g, W, H, col) {
  charge(g, W, H, () => {
    g.beginPath(); g.ellipse(0, 20, 58, 40, -0.15, 0, Math.PI * 2); fillInk(g, col, 6);
    g.beginPath(); g.arc(46, -14, 24, 0, Math.PI * 2); fillInk(g, col, 6);
    g.beginPath(); g.moveTo(66, -16); g.lineTo(92, -10); g.lineTo(66, -6); g.closePath(); fillInk(g, PIGMENT.goldLight, 4);
    g.beginPath(); g.moveTo(-50, 6); g.lineTo(-90, -60); g.lineTo(-74, -64); g.lineTo(-36, -4); g.closePath(); fillInk(g, col, 5);   // cocked tail
    g.beginPath(); g.ellipse(-4, 12, 34, 18, -0.4, 0, Math.PI * 2); g.strokeStyle = PIGMENT.ink; g.lineWidth = 4; g.stroke();
    g.fillStyle = PIGMENT.ink; g.beginPath(); g.arc(52, -18, 4.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = PIGMENT.ink; g.lineWidth = 5; for (const x of [-8, 14]) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x - 4, 84); g.stroke(); }
    g.fillStyle = PIGMENT.goldLight; for (const x of [-70, 0, 70]) star(g, x, -98, 10, PIGMENT.goldLight);
  });
}
function veiledEye(g, W, H, col) {
  charge(g, W, H, () => {
    g.beginPath(); g.moveTo(-90, 0); g.quadraticCurveTo(0, -70, 90, 0); g.quadraticCurveTo(0, 70, -90, 0); g.closePath(); fillInk(g, col, 6);
    g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); fillInk(g, '#5b3f86', 5);
    g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fillStyle = PIGMENT.ink; g.fill();
    g.beginPath(); g.arc(-8, -9, 6, 0, Math.PI * 2); g.fillStyle = PIGMENT.white; g.fill();
    g.beginPath(); g.moveTo(-100, -20); g.quadraticCurveTo(0, -120, 100, -20); g.lineTo(100, -42); g.quadraticCurveTo(0, -140, -100, -42); g.closePath(); fillInk(g, '#3d3647', 5);  // veil
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 28, 60); g.lineTo(i * 28, 92); g.strokeStyle = col; g.lineWidth = 5; g.stroke(); }
  });
}
function quill(g, W, H, col) {
  charge(g, W, H, () => {
    g.save(); g.rotate(-0.55);
    g.beginPath(); g.moveTo(0, -120); g.bezierCurveTo(46, -80, 40, 20, 4, 90); g.lineTo(-4, 90); g.bezierCurveTo(-36, 20, -40, -80, 0, -120); g.closePath(); fillInk(g, col, 6);
    g.strokeStyle = PIGMENT.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -110); g.lineTo(0, 100); g.stroke();
    for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(0, -90 + k * 22); g.lineTo(22, -100 + k * 22); g.moveTo(0, -90 + k * 22); g.lineTo(-22, -100 + k * 22); g.strokeStyle = 'rgba(42,26,16,.5)'; g.lineWidth = 2; g.stroke(); }
    g.restore();
    g.beginPath(); g.moveTo(-40, 64); g.lineTo(40, 64); g.lineTo(32, 108); g.lineTo(-32, 108); g.closePath(); fillInk(g, PIGMENT.ink, 5);
    g.beginPath(); g.ellipse(0, 64, 40, 9, 0, 0, Math.PI * 2); fillInk(g, PIGMENT.goldLight, 4);
  });
}
function raven(g, W, H, col) {
  charge(g, W, H, () => {
    g.beginPath();
    g.moveTo(-96, 40); g.bezierCurveTo(-60, 10, -40, -10, -10, -18); g.bezierCurveTo(10, -60, 40, -70, 58, -54);
    g.lineTo(96, -50); g.lineTo(62, -36); g.bezierCurveTo(60, -10, 40, 30, 10, 46); g.bezierCurveTo(-20, 60, -60, 70, -96, 40); g.closePath();
    fillInk(g, col, 6);
    g.beginPath(); g.moveTo(-20, 0); g.bezierCurveTo(-40, -70, -90, -90, -110, -80); g.bezierCurveTo(-70, -50, -60, -20, -40, 20); g.closePath(); fillInk(g, col, 5);   // raised wing
    g.fillStyle = PIGMENT.ink; g.beginPath(); g.arc(50, -50, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = PIGMENT.ink; g.lineWidth = 5; for (const x of [0, 18]) { g.beginPath(); g.moveTo(x, 48); g.lineTo(x - 2, 82); g.lineTo(x + 10, 90); g.stroke(); }
    g.strokeStyle = 'rgba(42,26,16,.55)'; g.lineWidth = 3; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-60 + k * 10, -40 + k * 8); g.lineTo(-80 + k * 6, -70 + k * 6); g.stroke(); }
    star(g, -80, 80, 9, PIGMENT.goldLight); star(g, 80, 70, 9, PIGMENT.goldLight);
  });
}

// A swallow-tailed banner for the 3D world (cloth texture).
export function banner(name, w = 128, h = 256) {
  const key = `ban:${name}:${w}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h); const g = c.getContext('2d'); const H = HOUSES[name];
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w / 2, h * 0.82); g.lineTo(0, h); g.closePath();
  g.fillStyle = H.colour; g.fill();
  g.save(); g.clip();
  const rnd = seeded(name.length * 31);
  for (let k = 0; k < w * h / 8; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.05)'; g.fillRect(rnd() * w, rnd() * h, 1, 2); }
  g.fillStyle = H.accent; g.fillRect(0, 0, w, h * 0.08); g.fillRect(0, h * 0.08, w * 0.06, h); g.fillRect(w * 0.94, h * 0.08, w * 0.06, h);
  g.restore();
  const sh = shield(name, 96, { gilt: true });
  g.drawImage(sh, w * 0.14, h * 0.18, w * 0.72, w * 0.72 * sh.height / sh.width);
  cache.set(key, c); return c;
}

// Resource glyphs as small illuminated roundels (used in the HUD, cards and floating harvest tokens).
export function resourceGlyph(res, s = 96) {
  const key = `res:${res}:${s}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(s, s); const g = c.getContext('2d');
  g.save(); g.translate(s / 2, s / 2); g.scale(s / 100, s / 100);
  g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.fillStyle = g.createPattern(goldLeaf(64, 5), 'repeat'); g.fill(); inkStroke(g, 3);
  g.beginPath(); g.arc(0, 0, 38, 0, Math.PI * 2); g.fillStyle = shade(RES_COLOUR[res], -0.25); g.fill(); inkStroke(g, 3);
  g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fillStyle = RES_COLOUR[res]; g.fill();
  const W = PIGMENT.white, I = PIGMENT.ink;
  const P = (fn, fill, lw = 3) => { g.beginPath(); fn(); g.fillStyle = fill; g.fill(); inkStroke(g, lw); };
  switch (res) {
    case 'G': for (let i = -1; i <= 1; i++) { g.save(); g.rotate(i * 0.3); g.strokeStyle = I; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 26); g.lineTo(0, -6); g.stroke(); for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) P(() => g.ellipse(sx * 5, -10 - k * 8, 3.5, 6, sx * .4, 0, 7), '#f6d77a', 1.6); g.restore(); } break;
    case 'T': P(() => { g.rect(-24, -8, 48, 16); }, '#9a6a3a'); P(() => g.ellipse(24, 0, 6, 8, 0, 0, 7), '#e2bf86'); P(() => { g.rect(-20, 8, 40, 12); }, '#8a5a2e'); P(() => g.ellipse(20, 14, 5, 6, 0, 0, 7), '#e2bf86'); break;
    case 'S': P(() => { g.moveTo(-26, 18); g.lineTo(-18, -12); g.lineTo(6, -20); g.lineTo(26, -4); g.lineTo(20, 20); g.closePath(); }, '#b9b5ad'); g.strokeStyle = 'rgba(42,26,16,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, -14); g.lineTo(-2, 18); g.moveTo(6, -20); g.lineTo(10, 4); g.stroke(); break;
    case 'I': P(() => { g.moveTo(-26, 10); g.lineTo(-18, -8); g.lineTo(18, -8); g.lineTo(26, 10); g.closePath(); }, '#69707c'); P(() => { g.rect(-22, 10, 44, 10); }, '#4a5160'); g.strokeStyle = W; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-14, -4); g.lineTo(12, -4); g.stroke(); break;
    case 'R': for (let i = -2; i <= 2; i++) { g.strokeStyle = I; g.lineWidth = 2.5; g.beginPath(); g.moveTo(i * 8, 26); g.quadraticCurveTo(i * 10, 0, i * 6 + 4, -20); g.stroke(); P(() => g.ellipse(i * 6 + 4, -22, 3.5, 9, 0.2, 0, 7), '#7a4a26', 1.5); } break;
    case 'C': for (const [x, y] of [[-10, 8], [10, 8], [0, -10]]) { P(() => g.arc(x, y, 14, 0, 7), '#f1d184'); g.strokeStyle = 'rgba(90,55,15,.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); } break;
    case 'L': P(() => { g.moveTo(-26, -16); g.lineTo(0, -10); g.lineTo(26, -16); g.lineTo(26, 18); g.lineTo(0, 24); g.lineTo(-26, 18); g.closePath(); }, PIGMENT.vellum); g.strokeStyle = I; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 24); for (let k = 0; k < 3; k++) { g.moveTo(-20, -6 + k * 8); g.lineTo(-6, -3 + k * 8); g.moveTo(6, -3 + k * 8); g.lineTo(20, -6 + k * 8); } g.stroke(); break;
  }
  g.beginPath(); g.arc(-12, -22, 10, Math.PI * 1.05, Math.PI * 1.55); g.strokeStyle = 'rgba(255,250,235,.7)'; g.lineWidth = 3; g.stroke();
  g.restore();
  cache.set(key, c); return c;
}

// Favor (a wax seal) and Renown (a laurel crown) glyphs.
export function seal(s = 96, col = PIGMENT.vermilion) {
  const key = `seal:${s}:${col}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(s, s); const g = c.getContext('2d'); g.translate(s / 2, s / 2); g.scale(s / 100, s / 100);
  g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = 42 + (i % 2 ? 4 : 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = col; g.fill(); inkStroke(g, 3);
  g.beginPath(); g.arc(0, 0, 28, 0, 7); g.fillStyle = shade(col, -0.25); g.fill(); inkStroke(g, 2);
  star(g, 0, 0, 16, PIGMENT.goldLight);
  g.beginPath(); g.arc(-10, -16, 14, Math.PI * 1.1, Math.PI * 1.5); g.strokeStyle = 'rgba(255,240,230,.6)'; g.lineWidth = 3; g.stroke();
  cache.set(key, c); return c;
}
export function laurel(s = 96) {
  const key = `laurel:${s}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(s, s); const g = c.getContext('2d'); g.translate(s / 2, s / 2); g.scale(s / 100, s / 100);
  g.fillStyle = g.createPattern(goldLeaf(64, 9), 'repeat');
  for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) {
    const a = Math.PI / 2 + sx * (0.4 + k * 0.32);
    const x = Math.cos(a) * 32, y = Math.sin(a) * 32;
    g.save(); g.translate(x, y); g.rotate(a + sx * 1.2); g.beginPath(); g.ellipse(0, 0, 6, 13, 0, 0, 7);
    g.fill(); inkStroke(g, 2); g.restore();
  }
  g.beginPath(); g.arc(0, 0, 32, Math.PI * 0.6, Math.PI * 2.4); inkStroke(g, 2);
  cache.set(key, c); return c;
}
export function flameGlyph(s = 64, lit = true) {
  const key = `flame:${s}:${lit}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(s, s); const g = c.getContext('2d'); g.translate(s / 2, s / 2); g.scale(s / 100, s / 100);
  g.beginPath(); g.moveTo(0, 44); g.bezierCurveTo(-36, 40, -34, 0, -12, -20); g.bezierCurveTo(-14, -2, -2, 0, 0, -44); g.bezierCurveTo(14, -16, 36, 0, 30, 20); g.bezierCurveTo(26, 38, 12, 44, 0, 44); g.closePath();
  g.fillStyle = lit ? '#e8873a' : 'rgba(90,70,60,.35)'; g.fill(); inkStroke(g, 4, lit ? PIGMENT.ink : 'rgba(42,26,16,.4)');
  if (lit) { g.beginPath(); g.moveTo(0, 38); g.bezierCurveTo(-16, 34, -14, 10, 0, -6); g.bezierCurveTo(10, 10, 16, 30, 0, 38); g.fillStyle = '#ffd36b'; g.fill(); }
  cache.set(key, c); return c;
}

// Card art: a small illuminated miniature per Rite school / Investigation type / Event.
export function cardArt(kind, id, w = 300, h = 180) {
  const key = `art:${kind}:${id}:${w}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h); const g = c.getContext('2d'); const rnd = seeded([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const SCHOOL = { Tidewater: ['#2d5f8a', '#7fb3c9'], Lorecraft: ['#3b2f6b', '#8f86c8'], Ironveil: ['#3a3f48', '#9aa3ad'], Verdant: ['#2f5a2a', '#8fbf6a'], Gilt: ['#6b4a12', '#e2bc5a'], Ashen: ['#5a1e12', '#e8873a'] };
  let pal = ['#22379a', '#4f7fc4'];
  if (kind === 'rite') pal = SCHOOL[id.school] || pal;
  if (kind === 'inv') pal = { testimony: ['#7a2c1c', '#d97a8a'], document: ['#5a3b22', '#d9c59a'], witness: ['#24344d', '#8aa6d6'], seal: ['#6b1a10', '#c8321f'] }[id.type] || pal;
  if (kind === 'event') pal = ['#16235f', '#4f7fc4'];
  // sky ground with gold stars
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, pal[0]); gr.addColorStop(1, shade(pal[0], -0.35)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 9; k++) star(g, rnd() * w, rnd() * h * 0.5, 2 + rnd() * 4, PIGMENT.goldLight);
  // stepped, leaning hills (medieval landscape)
  for (let layer = 0; layer < 3; layer++) {
    const base = h * (0.55 + layer * 0.15);
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 6) { const y = base - rnd() * 30 - (layer === 0 ? 20 : 0); g.lineTo(x, y); g.lineTo(x + w / 12, y - 14 - rnd() * 18); }
    g.lineTo(w, h); g.closePath();
    g.fillStyle = shade(pal[1], -0.15 - layer * 0.2); g.fill(); inkStroke(g, 2.5);
  }
  // emblem in the sky
  const cx = w * 0.5, cy = h * 0.38;
  g.save(); g.translate(cx, cy); g.scale(w / 300, w / 300);
  emblem(g, kind, id, pal);
  g.restore();
  // white-lead dots on the ridges
  g.fillStyle = 'rgba(251,245,230,.75)';
  for (let k = 0; k < 18; k++) { g.beginPath(); g.arc(rnd() * w, h * (0.6 + rnd() * 0.35), 1.6, 0, 7); g.fill(); }
  cache.set(key, c); return c;
}
function emblem(g, kind, id, pal) {
  const P = (fn, fill, lw = 4) => { g.beginPath(); fn(); g.fillStyle = fill; g.fill(); inkStroke(g, lw); };
  const gold = PIGMENT.goldLight;
  const k = kind === 'rite' ? id.id : kind === 'inv' ? id.type : id.id;
  switch (k) {
    case 'ledger_ink': case 'gilt_ledger': P(() => g.rect(-46, -30, 92, 60), PIGMENT.vellum); g.strokeStyle = PIGMENT.ink; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-36, -16 + i * 12); g.lineTo(36, -16 + i * 12); g.stroke(); } P(() => g.arc(30, 24, 14, 0, 7), gold); break;
    case 'mist_veil': for (let i = 0; i < 4; i++) P(() => g.ellipse(-40 + i * 26, -10 + (i % 2) * 14, 34, 12, 0, 0, 7), `rgba(230,236,243,${0.55 + i * 0.1})`, 2); break;
    case 'silent_barge': P(() => { g.moveTo(-60, 0); g.lineTo(60, 0); g.lineTo(44, 22); g.lineTo(-44, 22); g.closePath(); }, '#7a4a26'); P(() => { g.moveTo(0, -50); g.lineTo(0, 0); g.lineTo(34, -6); g.closePath(); }, PIGMENT.vellum, 3); break;
    case 'reed_oath': for (let i = -3; i <= 3; i++) { g.strokeStyle = PIGMENT.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(i * 12, 50); g.quadraticCurveTo(i * 14, 0, i * 9, -30); g.stroke(); P(() => g.ellipse(i * 9, -36, 6, 14, 0, 0, 7), '#7a4a26', 2); } star(g, 0, -60, 14, gold); break;
    case 'heron_cry': P(() => { g.moveTo(-50, 30); g.quadraticCurveTo(-10, 20, 0, -20); g.quadraticCurveTo(4, -50, 30, -50); g.lineTo(70, -44); g.lineTo(30, -38); g.quadraticCurveTo(20, 0, 10, 30); g.closePath(); }, '#e6ecf3'); g.strokeStyle = PIGMENT.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 30); g.lineTo(-4, 70); g.stroke(); break;
    case 'drowned_choir': for (let i = 0; i < 3; i++) P(() => g.arc(-40 + i * 40, 0, 16, 0, 7), '#cfe3ec', 3); g.strokeStyle = '#cfe3ec'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 40, 30 + i * 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } break;
    case 'ink_of_names': P(() => { g.moveTo(-30, 40); g.lineTo(30, 40); g.lineTo(22, 10); g.lineTo(-22, 10); g.closePath(); }, PIGMENT.ink, 3); P(() => { g.moveTo(10, 10); g.bezierCurveTo(40, -20, 30, -60, 50, -70); g.bezierCurveTo(20, -50, 10, -20, 2, 10); g.closePath(); }, PIGMENT.vellum, 3); break;
    case 'star_chart': g.strokeStyle = gold; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 48, 0, 7); g.stroke(); for (let i = 0; i < 7; i++) star(g, Math.cos(i) * 36, Math.sin(i * 1.7) * 30, 6 + (i % 3) * 3, gold); break;
    case 'ironveil_oath': P(() => { g.moveTo(-36, -40); g.lineTo(36, -40); g.lineTo(36, 10); g.quadraticCurveTo(36, 40, 0, 56); g.quadraticCurveTo(-36, 40, -36, 10); g.closePath(); }, '#9aa3ad'); g.strokeStyle = PIGMENT.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -40); g.lineTo(0, 56); g.moveTo(-36, -6); g.lineTo(36, -6); g.stroke(); break;
    case 'verdant_bloom': for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); P(() => g.ellipse(0, -28, 14, 26, 0, 0, 7), '#8fbf6a', 3); g.restore(); } P(() => g.arc(0, 0, 14, 0, 7), gold); break;
    case 'ashen_pyre': for (let i = -1; i <= 1; i++) P(() => { g.moveTo(i * 30, 50); g.bezierCurveTo(i * 30 - 30, 30, i * 30 - 14, -10, i * 30, -50 + Math.abs(i) * 20); g.bezierCurveTo(i * 30 + 14, -10, i * 30 + 30, 30, i * 30, 50); }, i ? '#e8873a' : '#ffd36b', 3); break;
    case 'testimony': P(() => g.arc(0, -10, 24, 0, 7), PIGMENT.rose); P(() => { g.moveTo(-34, 50); g.quadraticCurveTo(0, 0, 34, 50); g.closePath(); }, PIGMENT.rose); break;
    case 'document': P(() => { g.rect(-40, -44, 80, 88); }, PIGMENT.vellum); g.strokeStyle = PIGMENT.ink; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-30, -30 + i * 12); g.lineTo(30, -30 + i * 12); g.stroke(); } P(() => g.arc(24, 38, 12, 0, 7), PIGMENT.vermilion, 2); break;
    case 'witness': P(() => { g.moveTo(-60, 0); g.quadraticCurveTo(0, -40, 60, 0); g.quadraticCurveTo(0, 40, -60, 0); }, PIGMENT.white); P(() => g.arc(0, 0, 16, 0, 7), '#4f7fc4', 3); g.fillStyle = PIGMENT.ink; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); break;
    case 'seal': g.drawImage(seal(110), -55, -55); break;
    default: { // events
      const ev = { dry_autumn: ['#c58a3b', 'leaf'], spring_flood: ['#7fb3c9', 'wave'], iron_winter: ['#cfe3ec', 'snow'], coronation_feast: [gold, 'crown'], harvest_moon: ['#f1d184', 'moon'], caravan_fire: ['#e8873a', 'fire'], levy_of_the_crown: [PIGMENT.vermilion, 'spears'], market_glut: [gold, 'coins'], council_of_houses: [PIGMENT.vermilion, 'table'], death_in_the_court: ['#e6ecf3', 'skull'], lean_winter: ['#cfe3ec', 'snow'], blood_moon: ['#b23a2e', 'moon'] }[k] || [gold, 'moon'];
      const col = ev[0];
      switch (ev[1]) {
        case 'moon': P(() => g.arc(0, 0, 40, 0, 7), col); break;
        case 'wave': for (let i = 0; i < 3; i++) { g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); for (let x = -60; x <= 60; x += 5) g.lineTo(x, i * 18 - 18 + Math.sin(x / 9 + i) * 8); g.stroke(); } break;
        case 'snow': for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -44); g.moveTo(0, -26); g.lineTo(10, -36); g.moveTo(0, -26); g.lineTo(-10, -36); g.stroke(); g.restore(); } break;
        case 'crown': P(() => { g.moveTo(-44, 26); g.lineTo(-44, -20); g.lineTo(-22, 0); g.lineTo(0, -36); g.lineTo(22, 0); g.lineTo(44, -20); g.lineTo(44, 26); g.closePath(); }, col); break;
        case 'fire': P(() => { g.moveTo(0, 50); g.bezierCurveTo(-50, 40, -30, -10, 0, -50); g.bezierCurveTo(30, -10, 50, 40, 0, 50); }, col); break;
        case 'spears': for (let i = -2; i <= 2; i++) { g.strokeStyle = PIGMENT.ink; g.lineWidth = 4; g.beginPath(); g.moveTo(i * 16, 50); g.lineTo(i * 12, -40); g.stroke(); P(() => { g.moveTo(i * 12, -56); g.lineTo(i * 12 + 7, -40); g.lineTo(i * 12 - 7, -40); g.closePath(); }, '#cfd5dd', 2); } break;
        case 'coins': for (let i = 0; i < 5; i++) P(() => g.ellipse(-40 + i * 20, 30 - (i % 2) * 14, 16, 8, 0, 0, 7), col, 2); break;
        case 'table': P(() => g.ellipse(0, 20, 60, 18, 0, 0, 7), '#7a4a26'); for (let i = 0; i < 5; i++) P(() => g.arc(-48 + i * 24, -6, 9, 0, 7), [PIGMENT.vermilion, '#4f7d3a', '#3f8fa6', '#c7962f', '#6b3fa0'][i], 2); break;
        case 'skull': P(() => g.arc(0, -6, 30, 0, 7), col); g.fillStyle = PIGMENT.ink; for (const x of [-11, 11]) { g.beginPath(); g.arc(x, -6, 8, 0, 7); g.fill(); } P(() => g.rect(-14, 20, 28, 14), col, 3); break;
        case 'leaf': for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * 1.26); P(() => g.ellipse(0, -26, 10, 22, 0, 0, 7), [col, PIGMENT.vermilion, '#d9a93a'][i % 3], 2); g.restore(); } break;
      }
    }
  }
}

export const toURL = (c) => (c.toDataURL ? c.toDataURL() : '');
