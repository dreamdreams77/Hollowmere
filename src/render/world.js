// The 3D world: renderer, scene, camera and controls, light by Season, post-processing, picking,
// and the bridge that turns engine fx events into animations.
import * as THREE from 'three';
import { PLOTS, HOUSES } from '../rules/data.js';
import { buildTerrain, buildSlab, heightTexture, heightAt, WORLD_UNIFORMS } from './terrain.js';
import { buildWater } from './water.js';
import { buildScenery } from './scenery.js';
import { Pieces } from './pieces.js';
import { FX } from './fx.js';
import { Life } from './life.js';
import { glowMat } from './kit.js';
import { makePost } from './post.js';
import { S, BOARD, WATER_Y, plotAt, plotCentre } from './layout.js';
import { goldLeaf } from '../content/art.js';

const SEASON_LOOK = [
  // spring, summer, autumn, winter
  { name: 'Spring', sun: '#fff1d6', sunI: 3.5, az: 2.05, el: 0.62, hemS: '#cfe0f2', hemG: '#6d7d4a', hemI: 0.55, snow: 0, autumn: 0, spring: 1, cloud: 0.55, wind: 1.0, weather: 'clear', expo: 0.95, warm: 0.15, sat: 1.08 },
  { name: 'Summer', sun: '#ffe7b8', sunI: 3.7, az: 1.85, el: 0.74, hemS: '#d6e6f6', hemG: '#7a7444', hemI: 0.55, snow: 0, autumn: 0, spring: 0, cloud: 0.35, wind: 0.7, weather: 'clear', expo: 0.95, warm: 0.3, sat: 1.1 },
  { name: 'Autumn', sun: '#ffc98a', sunI: 3.3, az: 2.25, el: 0.5, hemS: '#e2d6c4', hemG: '#7a5a3a', hemI: 0.52, snow: 0, autumn: 1, spring: 0, cloud: 0.7, wind: 1.4, weather: 'leaves', expo: 0.94, warm: 0.55, sat: 1.3 },
  { name: 'Winter', sun: '#e6eeff', sunI: 2.9, az: 2.1, el: 0.42, hemS: '#cfdcf2', hemG: '#8a8a9a', hemI: 0.7, snow: 0.62, autumn: 0, spring: 0, cloud: 0.8, wind: 1.2, weather: 'snow', expo: 1.05, warm: -0.1, sat: 0.98 },
];
export const seasonLook = (s) => SEASON_LOOK[(s - 1) % 4];

export class World {
  static async create(canvas, opts = {}) { const w = new World(canvas, opts); await w.init(); return w; }
  constructor(canvas, { quality = 'high', houses = [] } = {}) {
    this.canvas = canvas; this.quality = quality; this.houses = houses;
    this.listeners = { pick: [], hover: [] };
    this.cam = { target: new THREE.Vector3(0, 0, 4), yaw: 0, pitch: 0.98, dist: 104 };
    this.camGoal = { target: this.cam.target.clone(), yaw: 0, pitch: 0.98, dist: 104 };
    this.clock = new THREE.Clock(); this.time = 0; this.frameMs = 16; this.renderScale = 1;
    this.look = SEASON_LOOK[0]; this.lookNow = { ...SEASON_LOOK[0] };
    // day cycle inside each Season: dusk 0 (midday) .. 1 (evening), ~90 s period
    this.dayOn = true; this.dayT = 0; this.dusk = 0; this.dayPeriod = 90;
    this.sunBase = new THREE.Color('#fff1d6'); this.hemS = new THREE.Color('#cfe0f2'); this.hemG = new THREE.Color('#6d7d4a'); this._c = new THREE.Color();
  }
  async init() {
    const q = this.quality;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    r.shadowMap.enabled = true; r.shadowMap.type = q === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#1c140e'); scene.fog = new THREE.Fog('#1c140e', 140, 330);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 900);
    // light
    const sun = this.sun = new THREE.DirectionalLight('#fff1d6', 3.4);
    sun.castShadow = true; const sm = q === 'high' ? 4096 : 2048;
    sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    const sc = sun.shadow.camera; sc.left = -52; sc.right = 52; sc.top = 56; sc.bottom = -56; sc.near = 1; sc.far = 260;
    scene.add(sun, sun.target);
    this.hemi = new THREE.HemisphereLight('#cfe0f2', '#6d7d4a', 1.15); scene.add(this.hemi);
    this.lamp = new THREE.PointLight('#ffb070', 0, 400, 1.2); this.lamp.position.set(-60, 70, 80); scene.add(this.lamp);
    // environment for reflections: a warm room around the table
    const pm = new THREE.PMREMGenerator(r); const envScene = new THREE.Scene();
    const envMat = new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: 'varying vec3 vP; void main(){ float t = vP.y * .5 + .5; vec3 c = mix(vec3(.22,.15,.1), vec3(.95,.9,.82), smoothstep(.35, 1., t)); c += vec3(1.,.8,.55) * pow(max(dot(vP, normalize(vec3(-.4,.7,.6))), 0.), 24.) * 2.; gl_FragColor = vec4(c, 1.); }' });
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), envMat));
    scene.environment = pm.fromScene(envScene, 0.02).texture; scene.environmentIntensity = 0.35;
    // textures
    const tl = new THREE.TextureLoader();
    const load = (u, srgb) => new Promise((res) => tl.load(u, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.anisotropy = 8; res(t); }, undefined, () => res(null)));
    const [walnut, walnutN, walnutR] = await Promise.all([load('assets/textures/walnut_diff.jpg', true), load('assets/textures/walnut_nor.jpg'), load('assets/textures/walnut_rough.jpg')]);
    const leaf = new THREE.CanvasTexture(goldLeaf(256, 4)); leaf.colorSpace = THREE.SRGBColorSpace; leaf.wrapS = leaf.wrapT = THREE.RepeatWrapping; leaf.repeat.set(24, 1);
    // world
    const terr = buildTerrain(q); this.terrain = terr.mesh; scene.add(terr.mesh);
    scene.add(buildSlab({ walnut, walnutN, walnutR, leaf }));
    const water = buildWater(heightTexture(q === 'low' ? 160 : 256), q); this.water = water; scene.add(water.mesh);
    const scen = this.scenery = buildScenery(q); scene.add(scen.group);
    this.fx = new FX(scene, q);
    for (const s of scen.smokes) this.fx.addSmoke(s, { rate: 2.4, col: [0.45, 0.43, 0.42], size: 0.6 });
    this.pieces = new Pieces(scene, this.houses);
    this.life = new Life(scene, q);
    // picking proxies: one invisible tile per Plot
    this.pickers = [];
    const pg = new THREE.BoxGeometry(S * 0.98, 6, S * 0.98);
    for (const p of PLOTS) {
      const [x, z] = plotCentre(p.id);
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ visible: false })); m.position.set(x, 1.5, z); m.userData.plot = p.id;
      scene.add(m); this.pickers.push(m);
    }
    // post
    this.post = makePost(r, scene, this.camera, 16, 16, { ssaa: 1, ao: q === 'high', taps: q === 'high' ? 64 : 28, aoRadius: 1.2, aoScale: 1.4, fxaa: q !== 'high' });
    const d = this.post.dof; d.aper = 9; d.maxCoc = q === 'low' ? 0 : 9; d.band = { y: 0.48, w: 0.24, amp: 6, mix: 0.5, tilt: 0, pow: 1.5 };
    if (q === 'low') { this.post.bloom.enabled = false; }
    this.fit();
    this.post.bloom.strength = 0.22; this.post.bloom.threshold = 0.85;
    this.raycaster = new THREE.Raycaster();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setSeason(1, true);
    this.running = true;
    // Optional QA hooks (render-only): ?dayt=0..1 pins the time of day (0 midday, 1 evening);
    // ?flooddemo=N plays a Flood after N seconds (default 4).
    const qs = new URLSearchParams(location.search);
    if (qs.has('dayt')) { this.dayPinned = THREE.MathUtils.clamp(+qs.get('dayt') || 0, 0, 1); }
    if (qs.has('flooddemo')) setTimeout(() => this.play({ t: 'flood' }), (+qs.get('flooddemo') || 4) * 1000);
    // ?fps=N caps the frame rate (used by automated tests on machines without a GPU)
    const cap = +(new URLSearchParams(location.search).get('fps') || 0);
    let last = 0;
    const loop = (now = 0) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (cap && now - last < 1000 / cap) return;
      last = now; this.frame();
    };
    loop();
  }
  on(ev, fn) { this.listeners[ev].push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev]) f(...a); }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const forced = +(new URLSearchParams(location.search).get('scale') || 0);
    const dpr = forced || Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.75 : 1.6) * this.renderScale;
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
    this.post.composer.setPixelRatio(dpr); this.post.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.post.fxaa) this.post.fxaa.material.uniforms.resolution.value.set(1 / (w * dpr), 1 / (h * dpr));
    this.W = w; this.H = h; this.portrait = h > w;
    this.fit();
  }

  setSeason(s, snap = false) {
    this.season = s; this.look = SEASON_LOOK[(s - 1) % 4];
    if (snap) this.lookNow = { ...this.look };
    this.fx.setWeather(this.look.weather);
  }
  setWeather(kind) { this.fx.setWeather(kind); }
  // The gentle day cycle inside each Season (on by default). Off eases back to midday light.
  setDayCycle(on) { this.dayOn = !!on; }

  sync(view, animate = true) {
    this.pieces.sync(view, animate);
    const owners = new Map();
    for (const p of view.plots) {
      const entries = Object.entries(p.m).filter(([, n]) => n > 0);
      if (!entries.length) continue;
      entries.sort((a, b) => b[1] - a[1]);
      if (entries.length === 1 || entries[0][1] > entries[1][1]) owners.set(p.id, HOUSES[view.houses[+entries[0][0]].name].colour);
    }
    this.owners = owners; this.applyHighlights();
  }
  setSelection({ hover, selected, targets } = {}) {
    if (hover !== undefined) this.hoverPlot = hover;
    if (selected !== undefined) this.selectedPlot = selected;
    if (targets !== undefined) this.targets = targets;
    this.applyHighlights();
  }
  applyHighlights() { this.fx.setHighlights({ hover: this.hoverPlot, selected: this.selectedPlot, targets: this.targets || [], ownerColour: this.owners || new Map() }); }

  // Camera ------------------------------------------------------------------------------------
  focusPlot(pid, dist = 38) {
    const [x, z] = plotCentre(pid); this.camGoal.target.set(x, Math.max(heightAt(x, z), 0), z + 1.5);
    this.camGoal.dist = Math.min(this.camGoal.dist, dist); this.userMoved = true;
    if (dist < 45) this.camGoal.pitch = Math.min(this.camGoal.pitch, 0.86);   // close up: a lower, model-maker's angle
  }
  // Bring a set of Plots into the clear middle of the screen (used when an Action asks for a target).
  frameTargets(pids) {
    if (!pids.length) return;
    if (pids.length === 1) return this.focusPlot(pids[0], Math.min(this.camGoal.dist, 70));
    let x = 0, z = 0; for (const p of pids) { const [a, b] = plotCentre(p); x += a; z += b; }
    x /= pids.length; z /= pids.length;
    let spread = 0; for (const p of pids) { const [a, b] = plotCentre(p); spread = Math.max(spread, Math.hypot(a - x, b - z)); }
    this.camGoal.target.set(x, 0, z + 2);
    this.camGoal.dist = THREE.MathUtils.clamp(spread * 2.6 + 34, 40, this.fitDist || 104); this.userMoved = true;
  }
  // True if the Plot's centre is hidden behind the interface.
  plotCovered(pid) {
    const s = this.plotScreen(pid); const el = document.elementFromPoint(s.x, s.y);
    return !el || el !== this.canvas;
  }
  // The part of the screen not covered by the interface; the board is framed inside it.
  setSafeArea(r) { this.safe = r; this.fit(); }
  // Find the distance at which the whole board fits the safe area at the default angle.
  fit() {
    const W = this.W || window.innerWidth, H = this.H || window.innerHeight;
    const s = this.safe || { x: 0, y: 0, w: W, h: H };
    this.pitch0 = this.portrait ? 1.06 : 0.9;
    const cam = this.camera.clone(); cam.aspect = W / H; cam.clearViewOffset(); cam.updateProjectionMatrix();
    const corners = []; for (const x of [BOARD.x0 - 1, BOARD.x1 + 1]) for (const z of [BOARD.z0 - 1, BOARD.z1 + 1]) for (const y of [0, 2.5]) corners.push(new THREE.Vector3(x, y, z));
    const target = new THREE.Vector3(0, 0, 1.5);
    const fits = (d) => {
      cam.position.set(target.x, target.y + Math.sin(this.pitch0) * d, target.z + Math.cos(this.pitch0) * d); cam.lookAt(target); cam.updateMatrixWorld();
      for (const c of corners) { const p = c.clone().project(cam); const px = (p.x * 0.5 + 0.5) * W, py = (-p.y * 0.5 + 0.5) * H; if (Math.abs(px - W / 2) > s.w / 2 - 6 || Math.abs(py - H / 2) > s.h / 2 - 6) return false; }
      return true;
    };
    let lo = 20, hi = 400; for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
    this.fitDist = hi; this.fitTarget = target;
    // shift the picture so the board's centre sits in the middle of the safe area
    this.camera.setViewOffset(W, H, W / 2 - (s.x + s.w / 2), H / 2 - (s.y + s.h / 2), W, H);
    if (!this.userMoved) this.resetView();
  }
  resetView() { this.camGoal.target.copy(this.fitTarget || new THREE.Vector3(0, 0, 4)); this.camGoal.dist = this.fitDist || 104; this.camGoal.yaw = 0; this.camGoal.pitch = this.pitch0 || 0.98; this.userMoved = false; }
  zoom(f) { this.userMoved = true; this.camGoal.dist = THREE.MathUtils.clamp(this.camGoal.dist * f, 16, (this.fitDist || 104) * 1.3); }
  pan(dx, dz) {
    this.userMoved = true;
    const c = Math.cos(this.cam.yaw), s = Math.sin(this.cam.yaw); const k = this.cam.dist / 80;
    this.camGoal.target.x = THREE.MathUtils.clamp(this.camGoal.target.x + (dx * c + dz * s) * k, BOARD.x0 - 6, BOARD.x1 + 6);
    this.camGoal.target.z = THREE.MathUtils.clamp(this.camGoal.target.z + (-dx * s + dz * c) * k, BOARD.z0 - 6, BOARD.z1 + 6);
  }
  rotate(dyaw, dpitch = 0) { this.userMoved = true; this.camGoal.yaw = THREE.MathUtils.clamp(this.camGoal.yaw + dyaw, -1.1, 1.1); this.camGoal.pitch = THREE.MathUtils.clamp(this.camGoal.pitch + dpitch, 0.45, 1.4); }

  bindInput() {
    const el = this.canvas; const ptrs = new Map(); let drag = null, moved = 0, pinch = null;
    const pick = (cx, cy) => {
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = this.raycaster.intersectObject(this.terrain, false)[0];
      if (hit) return plotAt(hit.point.x, hit.point.z);
      const h2 = this.raycaster.intersectObjects(this.pickers, false)[0];
      return h2 ? h2.object.userData.plot : null;
    };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, rot: e.button === 2 || e.shiftKey }; moved = 0; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; drag = null; }
    });
    el.addEventListener('pointermove', (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.zoom(pinch.d / Math.max(d, 1)); this.rotate(-(ang - pinch.ang) * 0.9);
        this.pan(-(mid.x - pinch.mid.x) * 0.12, -(mid.y - pinch.mid.y) * 0.12);
        pinch = { d, ang, mid }; moved = 99; return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
        if (drag.rot) this.rotate(-dx * 0.005, dy * 0.004); else this.pan(-dx * 0.09, -dy * 0.09);
        drag.x = e.clientX; drag.y = e.clientY; return;
      }
      if (e.pointerType === 'mouse') { const p = pick(e.clientX, e.clientY); if (p !== this.hoverPlot) { this.setSelection({ hover: p }); this.emit('hover', p, e); } }
    });
    const up = (e) => {
      const wasTap = drag && moved < 8 && ptrs.size === 1;
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (wasTap) { const p = pick(e.clientX, e.clientY); this.emit('pick', p, e); }
      if (!ptrs.size) drag = null;
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { if (this.hoverPlot) { this.setSelection({ hover: null }); this.emit('hover', null); } });
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Screen position of a world point (for HUD callouts).
  toScreen(v) { const p = v.clone().project(this.camera); const r = this.canvas.getBoundingClientRect(); return { x: (p.x * 0.5 + 0.5) * r.width + r.left, y: (-p.y * 0.5 + 0.5) * r.height + r.top, behind: p.z > 1 }; }
  plotScreen(pid) { const [x, z] = plotCentre(pid); return this.toScreen(new THREE.Vector3(x, Math.max(heightAt(x, z), WATER_Y) + 1, z)); }

  // Frame -------------------------------------------------------------------------------------
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()); this.time += dt; const t = this.time;
    WORLD_UNIFORMS.uTime.value = t;
    // ease the Season look
    const L = this.lookNow, G = this.look, k = Math.min(1, dt * 0.8);
    for (const key of ['sunI', 'az', 'el', 'hemI', 'snow', 'autumn', 'spring', 'cloud', 'wind', 'expo', 'warm', 'sat']) L[key] += (G[key] - L[key]) * k;
    L.sun = G.sun; L.hemS = G.hemS; L.hemG = G.hemG;
    WORLD_UNIFORMS.uSnow.value = L.snow; WORLD_UNIFORMS.uAutumn.value = L.autumn; WORLD_UNIFORMS.uSpring.value = L.spring; WORLD_UNIFORMS.uCloud.value = L.cloud; WORLD_UNIFORMS.uWind.value = L.wind;
    // day cycle: the sun lowers and warms toward evening, then comes back; never dark
    if (this.dayOn) this.dayT += dt;
    const duskGoal = this.dayPinned != null ? this.dayPinned : this.dayOn ? 0.5 - 0.5 * Math.cos(this.dayT / this.dayPeriod * Math.PI * 2) : 0;
    this.dusk += (duskGoal - this.dusk) * Math.min(1, dt * 2); const D = this.dusk;
    const winter = L.snow > 0.3 ? 1 : 0;
    this.sunBase.lerp(this._c.set(L.sun), k); this.hemS.lerp(this._c.set(L.hemS), k); this.hemG.lerp(this._c.set(L.hemG), k);
    this.sun.color.copy(this.sunBase).lerp(this._c.set(winter ? '#ffc6a2' : '#ff9c5a'), D * 0.42); this.sun.intensity = L.sunI * (1 - 0.2 * D);
    const el = L.el - D * 0.2 * L.el, az = L.az + D * 0.38;
    this.sun.position.set(Math.sin(az) * 100 * Math.cos(el), Math.sin(el) * 100, Math.cos(az) * 100 * Math.cos(el));
    this.hemi.color.copy(this.hemS).lerp(this._c.set(winter ? '#c9cfe8' : '#e9c9b2'), D * 0.35); this.hemi.groundColor.copy(this.hemG); this.hemi.intensity = L.hemI * (1 - 0.14 * D);
    const gr = this.post.grade.uniforms; gr.warm.value = L.warm + D * (winter ? 0.06 : 0.15); gr.sat.value = L.sat; gr.expo.value = L.expo * (1 - 0.04 * D); gr.contrast.value = 0.38; gr.amt.value = 0.5;
    glowMat.emissiveIntensity = 1.6 + 2.4 * D;
    // camera
    const c = this.cam, gl = this.camGoal, e = 1 - Math.pow(0.002, dt);
    c.target.lerp(gl.target, e); c.yaw += (gl.yaw - c.yaw) * e; c.pitch += (gl.pitch - c.pitch) * e; c.dist += (gl.dist - c.dist) * e;
    const cp = Math.cos(c.pitch);
    this.camera.position.set(c.target.x + Math.sin(c.yaw) * cp * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(c.target);
    // depth-of-field band follows the camera target
    const d = this.post.dof; d.focus = this.camera.position.distanceTo(c.target);
    const sp = c.target.clone().project(this.camera); d.band.y = sp.y * 0.5 + 0.5;
    d.band.w = 0.2 + Math.min(0.22, c.dist / 420);
    // animated scenery
    for (const o of this.scenery.animated) o.rotation.z = t * o.userData.spin * L.wind;
    for (const b of this.scenery.boats) { const u = b.userData.bob; b.position.x = u.x + Math.sin(t * 0.08 + u.ph) * 3; b.position.y = WATER_Y + this.water.uniforms.uFlood.value * 1.45 + Math.sin(t * 1.6 + u.ph) * 0.05; b.rotation.z = Math.sin(t * 1.3 + u.ph) * 0.05; }
    this.pieces.update(dt, t);
    if (this.floodAnim) {
      // swell fast, spill over the banks, hold, then recede slowly
      const f = this.floodAnim; f.t += dt; const kk = Math.min(1, f.t / f.dur);
      const up = THREE.MathUtils.smoothstep(kk, 0, 0.3), down = 1 - THREE.MathUtils.smoothstep(kk, 0.55, 1);
      this.water.uniforms.uFlood.value = up * down * f.h;
      WORLD_UNIFORMS.uWet.value = Math.max(WORLD_UNIFORMS.uWet.value, up * down);
      if (kk >= 1) { this.floodAnim = null; this.water.uniforms.uFlood.value = 0; }
    } else WORLD_UNIFORMS.uWet.value = Math.max(0, WORLD_UNIFORMS.uWet.value - dt * 0.15);
    this.life.update(dt, t, { dusk: this.dusk, pieces: this.pieces, fx: this.fx, flood: this.water.uniforms.uFlood.value });
    this.fx.update(dt, t, this.camera);
    const t0 = performance.now();
    this.post.composer.render(dt);
    this.adapt(performance.now() - t0, dt);
  }
  // Dynamic resolution: drop the render scale when frames run slow, raise it when there is room.
  adapt(ms, dt) {
    this.frameMs = this.frameMs * 0.95 + dt * 1000 * 0.05;
    this.adaptT = (this.adaptT || 0) + dt; if (this.adaptT < 2) return; this.adaptT = 0;
    if (this.frameMs > 60 && this.post.dof.maxCoc > 0) { this.post.dof.maxCoc = 0; }                                      // drop the blur before the sharpness
    else if (this.frameMs > 48 && this.renderScale > 0.75) { this.renderScale = Math.max(0.75, this.renderScale - 0.1); this.resize(); }
    else if (this.frameMs < 22 && this.renderScale < 1) { this.renderScale = Math.min(1, this.renderScale + 0.05); this.resize(); }
    void ms;
  }

  // Animation of engine events. Returns a promise that resolves when the moment has played.
  play(e, view) {
    const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
    const P = (pid, dy) => this.fx.plotPos(pid, dy);
    const site = (pid, h) => this.pieces.slotPos(pid, h);
    switch (e.t) {
      case 'harvest': {
        let i = 0;
        for (const p of PLOTS) if (p.n === e.sum) { this.fx.ring(P(p.id, 0.1), '#f1d184', 4.5, 1.6); }
        e.gains.forEach((g, h) => { for (const pl of PLOTS) if (pl.n === e.sum && (view.plots[pl.id - 1].m[h] || 0) > 0) { this.fx.glyph(site(pl.id, h), pl.res, 0.2 + 0.15 * i++); } });
        return wait(e.sum === 7 ? 0.6 : 1.4);
      }
      case 'build': case 'keep': this.fx.dust(site(e.plot, e.h), 34); this.fx.ring(P(e.plot, 0.1), HOUSES[view.houses[e.h].name].colour, 3.5, 1.2); return wait(1.1);
      case 'muster': this.fx.dust(site(e.plot, e.h), 16); return wait(0.6);
      case 'raid': {
        const from = site(e.from, e.h), to = site(e.to, e.target);
        const model = this.pieces.squadModel(e.h);
        return new Promise((res) => this.fx.march(from, to, model, 1.4, async () => {
          if (e.defended) { this.fx.burst(to.clone().setY(to.y + 0.6), [1, 0.75, 0.4], 50, 3, 0.8, 0.3); this.fx.flash(to, '#ffcf8a', 30, 0.6); }
          if (e.won) this.fx.ring(to, HOUSES[view.houses[e.h].name].colour, 3, 1.1);
          await wait(0.5); res();
        }));
      }
      case 'recapture': this.fx.ring(P(e.plot, 0.1), HOUSES[view.houses[e.h].name].colour, 3.5, 1.2); this.fx.dust(site(e.plot, e.h), 24); return wait(0.9);
      case 'rite': {
        const SCH = { Tidewater: '#7fb3c9', Lorecraft: '#a89cf0', Ironveil: '#c9ced6', Verdant: '#9ee07a', Gilt: '#f1d184', Ashen: '#ff9a4a' };
        const holdings = view.plots.filter((p) => (p.m[e.h] || 0) > 0).map((p) => p.id);
        const col = SCH[e.school] || '#a89cf0';
        const c3 = new THREE.Color(col);
        for (const pid of holdings.slice(0, 4)) { this.fx.ring(P(pid, 0.1), col, 4, 1.5); this.fx.burst(site(pid, e.h).setY(site(pid, e.h).y + 1), [c3.r, c3.g, c3.b], 26, 1.6, 1.6, 0.35); }
        for (const tg of e.targets || []) { this.fx.burst(P(tg.plot, 0.8), [1, 0.55, 0.25], 50, 2.5, 1.2, 0.35); this.fx.flash(P(tg.plot, 0.5), '#ff8a3a', 25, 0.9); }
        return wait(1.4);
      }
      case 'catastrophe': if (e.plot) { const p = P(e.plot, 0.6); this.fx.burst(p, [1, 0.45, 0.15], 140, 4, 1.8, 0.4); this.fx.flash(p, '#ff6a2a', 70, 1.6); this.fx.addSmoke(p, { rate: 10, col: [0.3, 0.27, 0.25], life: 5, size: 1.2, until: this.time + 6 }); } return wait(1.8);
      case 'renown': { const h = e.h; const hold = view.plots.find((p) => (p.m[h] || 0) > 0); const pos = hold ? site(hold.id, h) : new THREE.Vector3(0, 2, 0); this.fx.renown(pos, e.n); return wait(0.1); }
      case 'favor': { const hold = view.plots.find((p) => (p.m[e.h] || 0) > 0); if (hold) this.fx.favor(site(hold.id, e.h), e.n); return wait(0.4); }
      case 'flood': {
        this.floodAnim = { t: 0, dur: 4.6, h: 0.56 }; this.setWeather('rain');
        clearTimeout(this.rainT); this.rainT = setTimeout(() => this.setWeather(this.look.weather), 2600);
        return wait(0.2);
      }
      case 'seal': case 'reveal': case 'succession': case 'dynasty': case 'vigil': { const hold = view.plots.find((p) => (p.m[e.h] || 0) > 0); if (hold) this.fx.ring(site(hold.id, e.h), '#f1d184', 2.4, 1.2); return wait(0.6); }
      case 'cabal': if (e.plot) this.fx.burst(P(e.plot, 0.6), [0.7, 0.6, 1], 30, 1, 1.4, 0.3); return wait(0.5);
      case 'disband': return wait(0.1);
      default: return wait(0.05);
    }
  }
}
