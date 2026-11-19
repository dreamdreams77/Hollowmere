// Visual effects in the world: smoke, dust and sparks, Rite magic, catastrophe embers, harvest
// glyphs rising from Plots, floating Renown, weather (rain, snow, autumn leaves, mist), Plot
// highlight rings and marching Legions. Purely presentational; driven by engine fx events.
import * as THREE from 'three';
import { PLOTS } from '../rules/data.js';
import { heightAt, WORLD_UNIFORMS } from './terrain.js';
import { plotCentre, S, BOARD, WATER_Y } from './layout.js';
import { resourceGlyph, laurel, seal } from '../content/art.js';

const softDot = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
})();

// A pool of soft billboard particles (one draw call).
class Particles {
  constructor(max, { additive = false, size = 1 } = {}) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 4); this.life = new Float32Array(max); this.age = new Float32Array(max); this.sz = new Float32Array(max); this.grow = new Float32Array(max);
    this.base = new Float32Array(max * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: softDot }, scale: { value: 400 * size } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); if (gl_FragColor.a < .01) discard; }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  emit(x, y, z, vx, vy, vz, r, g, b, a, life, size, grow = 1) {
    let i = this.n < this.max ? this.n++ : (this.cursor = ((this.cursor || 0) + 1) % this.max);
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.base[i * 4] = r; this.base[i * 4 + 1] = g; this.base[i * 4 + 2] = b; this.base[i * 4 + 3] = a;
    this.life[i] = life; this.age[i] = 0; this.sz[i] = size; this.grow[i] = grow;
  }
  update(dt, drag = 0.98, gravity = 0) {
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) { this.c[i * 4 + 3] = 0; continue; }
      this.age[i] += dt; const k = this.age[i] / this.life[i];
      this.v[i * 3 + 1] -= gravity * dt;
      for (let j = 0; j < 3; j++) { this.p[i * 3 + j] += this.v[i * 3 + j] * dt; this.v[i * 3 + j] *= drag; }
      this.sz[i] *= 1 + (this.grow[i] - 1) * dt;
      const fade = Math.min(1, k * 6) * (1 - k);
      this.c[i * 4] = this.base[i * 4]; this.c[i * 4 + 1] = this.base[i * 4 + 1]; this.c[i * 4 + 2] = this.base[i * 4 + 2]; this.c[i * 4 + 3] = this.base[i * 4 + 3] * fade;
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
    g.setDrawRange(0, this.n);
  }
}

// Border ribbon around one Plot, following the ground (for hover, selection and legal targets).
function borderGeo(pid, inset = 0.35) {
  const [cx, cz] = plotCentre(pid); const h = S / 2 - inset;
  const pts = []; const n = 24;
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]];
  for (let c = 0; c < 4; c++) for (let i = 0; i < n; i++) {
    const t = i / n; const [ax, az] = corners[c], [bx, bz] = corners[c + 1];
    pts.push([cx + ax + (bx - ax) * t, cz + az + (bz - az) * t]);
  }
  pts.push(pts[0]);
  const P = [], w = 0.16;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w, nz = dx / L * w;
    const ya = Math.max(heightAt(ax, az), WATER_Y) + 0.12, yb = Math.max(heightAt(bx, bz), WATER_Y) + 0.12;
    const q = [[ax - nx, ya, az - nz], [bx - nx, yb, bz - nz], [bx + nx, yb, bz + nz], [ax - nx, ya, az - nz], [bx + nx, yb, bz + nz], [ax + nx, ya, az + nz]];
    for (const v of q) P.push(...v);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return g;
}

function textSprite(text, colour = '#f1d184', icon = null) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  if (icon) g.drawImage(icon, 4, 8, 80, 80);
  g.font = '700 58px "IM Fell English", Georgia, serif'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#2a1a10';
  g.strokeText(text, icon ? 92 : 16, 50); g.fillStyle = colour; g.fillText(text, icon ? 92 : 16, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.98, 1); s.renderOrder = 10; return s;
}

export class FX {
  constructor(scene, quality) {
    this.scene = scene; this.quality = quality;
    const k = quality === 'low' ? 0.4 : quality === 'medium' ? 0.7 : 1;
    this.smoke = new Particles(Math.round(900 * k), { size: 1 });
    this.glow = new Particles(Math.round(1400 * k), { additive: true, size: 1 });
    this.weather = new Particles(Math.round(2600 * k), { size: 0.35 });
    scene.add(this.smoke.points, this.glow.points, this.weather.points);
    this.emitters = []; this.sprites = []; this.marches = []; this.rings = []; this.flashes = [];
    this.weatherKind = 'clear'; this.acc = 0;
    // highlight rings for every Plot
    this.borders = new Map();
    for (const p of PLOTS) {
      const m = new THREE.Mesh(borderGeo(p.id), new THREE.MeshBasicMaterial({ color: '#f1d184', transparent: true, opacity: 0, depthWrite: false }));
      m.renderOrder = 4; m.visible = false; scene.add(m); this.borders.set(p.id, m);
    }
    this.highlight = { hover: null, selected: null, targets: new Set(), owners: new Map() };
  }
  addSmoke(pos, opts = {}) { this.emitters.push({ pos: pos.clone(), rate: opts.rate || 3, col: opts.col || [0.75, 0.73, 0.7], life: opts.life || 4, size: opts.size || 0.7, until: opts.until || Infinity, rise: opts.rise || 0.5 }); }
  plotPos(pid, dy = 0.4) { const [x, z] = plotCentre(pid); return new THREE.Vector3(x, Math.max(heightAt(x, z), WATER_Y) + dy, z); }

  setHighlights({ hover = null, selected = null, targets = [], ownerColour = new Map() } = {}) {
    this.highlight = { hover, selected, targets: new Set(targets), owners: ownerColour };
  }

  // --- event effects
  burst(pos, col, n = 40, speed = 2.2, life = 1.1, size = 0.35, additive = true) {
    const P = additive ? this.glow : this.smoke;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 0.9 + 0.1;
      P.emit(pos.x, pos.y, pos.z, Math.cos(a) * speed * u, speed * (0.4 + Math.random()), Math.sin(a) * speed * u, col[0], col[1], col[2], 1, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), 1.2);
    }
  }
  dust(pos, n = 30) { for (let i = 0; i < n; i++) { const a = Math.random() * 7; this.smoke.emit(pos.x + Math.cos(a) * 0.6, pos.y + 0.1, pos.z + Math.sin(a) * 0.6, Math.cos(a) * 1.3, 0.4 + Math.random() * 0.6, Math.sin(a) * 1.3, 0.72, 0.64, 0.5, 0.75, 1.4 + Math.random(), 0.9, 2.2); } }
  ring(pos, colour, radius = 4, dur = 1.4) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.2; m.renderOrder = 6; this.scene.add(m);
    this.rings.push({ m, t: 0, dur, radius });
  }
  flash(pos, colour = '#ffb45e', intensity = 40, dur = 0.8) {
    const l = new THREE.PointLight(colour, intensity, 14, 2); l.position.copy(pos); l.position.y += 1.5; this.scene.add(l);
    this.flashes.push({ l, t: 0, dur, intensity });
  }
  floater(pos, text, colour, icon, delay = 0) {
    const s = textSprite(text, colour, icon); s.position.copy(pos); s.position.y += 1.6; s.material.opacity = 0; this.scene.add(s);
    this.sprites.push({ s, t: -delay, dur: 2.4, y0: s.position.y });
  }
  glyph(pos, res, delay = 0) {
    const t = new THREE.CanvasTexture(resourceGlyph(res, 96)); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
    s.scale.setScalar(1.25); s.position.copy(pos); s.position.y += 0.8; s.material.opacity = 0; s.renderOrder = 9; this.scene.add(s);
    this.sprites.push({ s, t: -delay, dur: 2.0, y0: s.position.y, glyph: true });
  }
  renown(pos, n, delay = 0) { this.floater(pos, `${n > 0 ? '+' : ''}${n}`, n > 0 ? '#f1d184' : '#e46a4a', laurel(80), delay); }
  favor(pos, n, delay = 0) { this.floater(pos, `+${n}`, '#f3c0b0', seal(80), delay); }
  // Legions marching from one Plot to another along an arc, then a dust cloud on arrival.
  march(fromPos, toPos, model, dur = 1.3, onArrive) {
    const m = model.clone(); m.position.copy(fromPos); this.scene.add(m);
    this.marches.push({ m, from: fromPos.clone(), to: toPos.clone(), t: 0, dur, onArrive });
  }

  setWeather(kind) { this.weatherKind = kind; }

  update(dt, t, camera) {
    // emitters
    this.acc += dt;
    for (const e of this.emitters) {
      if (t > e.until) continue;
      const n = e.rate * dt + Math.random() * 0.5 * dt * e.rate;
      for (let i = 0; i < Math.floor(n + Math.random()); i++) this.smoke.emit(e.pos.x + (Math.random() - 0.5) * 0.2, e.pos.y, e.pos.z + (Math.random() - 0.5) * 0.2, 0.15 + Math.random() * 0.1, e.rise + Math.random() * 0.3, (Math.random() - 0.5) * 0.1, e.col[0], e.col[1], e.col[2], 0.5, e.life, e.size, 1.5);
    }
    this.emitters = this.emitters.filter((e) => t <= e.until);
    // weather over the board (the diorama has its own sky)
    const wk = this.weatherKind;
    if (wk !== 'clear') {
      const rate = { rain: 700, snow: 260, leaves: 40, mist: 18 }[wk] || 0;
      const n = Math.floor(rate * dt * (this.quality === 'low' ? 0.4 : 1) + Math.random());
      for (let i = 0; i < n; i++) {
        const x = BOARD.x0 - 6 + Math.random() * (BOARD.x1 - BOARD.x0 + 12), z = BOARD.z0 - 6 + Math.random() * (BOARD.z1 - BOARD.z0 + 12);
        if (wk === 'rain') this.weather.emit(x, 14, z, 0.6, -22, 0.2, 0.75, 0.82, 0.95, 0.55, 0.62, 0.35, 1);
        if (wk === 'snow') this.weather.emit(x, 14, z, 0.3, -1.6, 0.1, 1, 1, 1, 0.95, 8, 0.45, 1);
        if (wk === 'leaves') this.weather.emit(x, 8, z, 0.8, -0.9, 0.3, 0.86, 0.45 + Math.random() * 0.2, 0.15, 0.95, 8, 0.55, 1);
        if (wk === 'mist') this.smoke.emit(x, 0.6 + Math.random(), z, 0.3, 0.02, 0.1, 0.92, 0.93, 0.95, 0.22, 9, 6, 1.05);
      }
    }
    this.smoke.update(dt, 0.985, -0.05); this.glow.update(dt, 0.96, 1.2); this.weather.update(dt, 1, 0);
    // sprites
    for (const sp of this.sprites) {
      sp.t += dt; if (sp.t < 0) continue;
      const k = sp.t / sp.dur;
      sp.s.material.opacity = Math.min(1, sp.t * 4) * (1 - Math.max(0, (k - 0.7) / 0.3));
      sp.s.position.y = sp.y0 + k * (sp.glyph ? 2.2 : 1.6);
    }
    for (const sp of this.sprites.filter((x) => x.t >= x.dur)) { this.scene.remove(sp.s); sp.s.material.map?.dispose(); sp.s.material.dispose(); }
    this.sprites = this.sprites.filter((x) => x.t < x.dur);
    // rings and flashes
    for (const r of this.rings) { r.t += dt; const k = r.t / r.dur; r.m.scale.setScalar(0.5 + k * r.radius); r.m.material.opacity = 0.9 * (1 - k); }
    for (const r of this.rings.filter((x) => x.t >= x.dur)) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); }
    this.rings = this.rings.filter((x) => x.t < x.dur);
    for (const f of this.flashes) { f.t += dt; f.l.intensity = f.intensity * Math.max(0, 1 - f.t / f.dur); }
    for (const f of this.flashes.filter((x) => x.t >= x.dur)) this.scene.remove(f.l);
    this.flashes = this.flashes.filter((x) => x.t < x.dur);
    // marches
    for (const mv of this.marches) {
      mv.t += dt; const k = Math.min(1, mv.t / mv.dur); const e = k * k * (3 - 2 * k);
      mv.m.position.lerpVectors(mv.from, mv.to, e); mv.m.position.y += Math.sin(e * Math.PI) * 1.6 + Math.abs(Math.sin(mv.t * 16)) * 0.08;
      mv.m.rotation.y = Math.atan2(mv.to.x - mv.from.x, mv.to.z - mv.from.z);
      if (k >= 1 && !mv.done) { mv.done = true; this.scene.remove(mv.m); this.dust(mv.to, 26); if (mv.onArrive) mv.onArrive(); }
    }
    this.marches = this.marches.filter((x) => !x.done);
    // borders
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    for (const [pid, m] of this.borders) {
      const h = this.highlight; let col = null, op = 0;
      if (h.targets.has(pid)) { col = '#9ee07a'; op = 0.45 + 0.4 * pulse; }
      if (h.owners.has(pid) && !col) { col = h.owners.get(pid); op = 0.38; }
      if (h.hover === pid) { col = '#fff2c4'; op = 0.85; }
      if (h.selected === pid) { col = '#f1d184'; op = 1; }
      m.visible = op > 0; if (col) m.material.color.set(col); m.material.opacity = op;
    }
    void camera; void WORLD_UNIFORMS;
  }
}
