// House pieces on the board, kept in sync with the game state:
//   one Influence marker  -> a fortified manor with its House banner
//   two markers (a Keep)  -> a walled castle with towers in the House colours
//   each Legion           -> a squad of three miniature soldiers with House shields
//   Sable's Cabal         -> a veiled shrine with a lantern (only seen by Sable or once exposed)
//   a contested Plot      -> crossed blades and smoke until the marker is recaptured
import * as THREE from 'three';
import { HOUSES } from '../rules/data.js';
import { Kit, mesh, paintMat } from './kit.js';
import { heightAt, WORLD_UNIFORMS } from './terrain.js';
import { plotCentre, SLOT } from './layout.js';
import { banner, shade } from '../content/art.js';

const geoCache = new Map();
const tint = (hex, k) => shade(hex, k);

function manorGeo(name) {
  const key = `manor:${name}`; if (geoCache.has(key)) return geoCache.get(key);
  const H = HOUSES[name]; const k = new Kit(); const roof = tint(H.colour, -0.1);
  k.cyl(1.0, 1.1, 0.16, '#8f8676', [0, 0.08, 0], 14);                     // stone footing
  k.box(1.1, 0.62, 0.7, '#e3d6b8', [0, 0.47, 0]);
  k.gable(1.22, 0.86, 0.5, roof, [0, 0.78, 0]);
  k.box(0.38, 1.25, 0.38, '#d2c4a4', [-0.55, 0.78, -0.2]);
  k.cone(0.32, 0.5, roof, [-0.55, 1.65, -0.2], 4, [0, Math.PI / 4, 0]);
  k.box(0.16, 0.26, 0.03, '#3a2614', [0.1, 0.29, 0.36]);
  for (const x of [-0.3, 0.38]) k.box(0.1, 0.13, 0.02, '#2a1a10', [x, 0.56, 0.36]);
  // palisade
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2; if (Math.abs(a - Math.PI / 2) < 0.28) continue;
    k.cyl(0.035, 0.04, 0.34 + (i % 2) * 0.05, '#7a5a36', [Math.cos(a) * 0.95, 0.24, Math.sin(a) * 0.95], 5);
  }
  k.cyl(0.02, 0.02, 1.1, '#5a3b22', [0.5, 1.05, -0.25], 5);
  const g = k.build(); geoCache.set(key, g); return g;
}
function castleGeo(name) {
  const key = `castle:${name}`; if (geoCache.has(key)) return geoCache.get(key);
  const H = HOUSES[name]; const k = new Kit(); const roof = tint(H.colour, -0.08); const wall = '#d6cbb2', dark = '#bdb19a';
  k.box(2.2, 0.18, 2.2, '#8f8676', [0, 0.09, 0]);
  const r = 0.92, wh = 0.75;
  for (const [a, b] of [[[-r, -r], [r, -r]], [[r, -r], [r, r]], [[r, r], [-r, r]], [[-r, r], [-r, -r]]]) {
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    k.box(len, wh, 0.18, wall, [mx, 0.18 + wh / 2, mz], [0, -ang, 0]);
    k.crenels(a, b, 0.18 + wh, dark, 0.12, 2);
  }
  for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]]) {
    k.cyl(0.24, 0.27, 1.25, wall, [x, 0.8, z], 10);
    k.cyl(0.28, 0.28, 0.08, dark, [x, 1.46, z], 10);
    k.cone(0.3, 0.6, roof, [x, 1.8, z], 10);
  }
  k.box(0.32, 0.42, 0.06, '#3a2614', [0, 0.38, r + 0.07]);                // gate
  k.box(0.62, 0.9, 0.62, '#cbbf9f', [0, 1.33, r - 0.05]);                 // gatehouse
  k.crenels([-0.31, r + 0.26], [0.31, r + 0.26], 1.78, dark, 0.1, 2);
  // donjon
  k.box(0.9, 1.9, 0.9, wall, [-0.05, 1.13, -0.1]);
  k.crenels([-0.5, -0.55], [0.4, -0.55], 2.08, dark, 0.12, 2); k.crenels([-0.5, 0.35], [0.4, 0.35], 2.08, dark, 0.12, 2);
  k.box(0.42, 0.6, 0.42, wall, [0.15, 2.35, 0.05]); k.cone(0.34, 0.6, roof, [0.15, 2.95, 0.05], 4, [0, Math.PI / 4, 0]);
  for (const y of [1.2, 1.7]) for (const x of [-0.3, 0.2]) k.box(0.08, 0.16, 0.02, '#2a1a10', [x, y, 0.36]);
  k.cyl(0.02, 0.02, 1.0, '#5a3b22', [0.15, 3.6, 0.05], 5);
  const g = k.build(); geoCache.set(key, g); return g;
}
function soldierKit(k, name, x, z, bearer) {
  const H = HOUSES[name];
  k.box(0.09, 0.14, 0.06, '#3b2e24', [x, 0.07, z]);
  k.cyl(0.07, 0.085, 0.18, H.colour, [x, 0.23, z], 7);
  k.sphere(0.05, '#e2b892', [x, 0.36, z], 1, 7);
  k.cone(0.06, 0.08, '#9aa3ad', [x, 0.42, z], 7);
  k.cyl(0.075, 0.075, 0.025, H.accent, [x + 0.02, 0.24, z + 0.075], 9, [Math.PI / 2, 0, 0]);
  k.cyl(0.05, 0.05, 0.027, H.colour, [x + 0.02, 0.24, z + 0.088], 9, [Math.PI / 2, 0, 0]);
  if (bearer) { k.cyl(0.012, 0.012, 0.62, '#5a3b22', [x - 0.08, 0.38, z], 4); k.box(0.16, 0.12, 0.01, H.colour, [x - 0.0, 0.62, z]); k.box(0.16, 0.025, 0.012, H.accent, [x, 0.55, z]); }
  else k.cyl(0.01, 0.01, 0.55, '#7a5a36', [x - 0.08, 0.3, z], 4), k.cone(0.02, 0.06, '#c9ced6', [x - 0.08, 0.6, z], 4);
}
function squadGeo(name) {
  const key = `squad:${name}`; if (geoCache.has(key)) return geoCache.get(key);
  const k = new Kit();
  soldierKit(k, name, 0, -0.12, true); soldierKit(k, name, -0.14, 0.1, false); soldierKit(k, name, 0.14, 0.1, false);
  k.cyl(0.26, 0.28, 0.04, '#5a4a3a', [0, 0.0, 0], 12);
  const g = k.build(); geoCache.set(key, g); return g;
}
function shrineGeo() {
  const key = 'shrine'; if (geoCache.has(key)) return geoCache.get(key);
  const k = new Kit();
  k.cyl(0.22, 0.3, 0.12, '#3d3647', [0, 0.06, 0], 8);
  k.cone(0.2, 0.75, '#2d2a33', [0, 0.5, 0], 8);
  k.sphere(0.07, '#a9a3b8', [0, 0.92, 0], 1, 8);
  const g = k.build(); geoCache.set(key, g); return g;
}
function bladesGeo() {
  const key = 'blades'; if (geoCache.has(key)) return geoCache.get(key);
  const k = new Kit();
  for (const s of [-1, 1]) { k.box(0.06, 0.9, 0.02, '#d8dde3', [0, 0.45, 0], [0, 0, s * 0.55]); k.box(0.26, 0.05, 0.05, '#c99a3e', [s * -0.17, 0.12, 0], [0, 0, s * 0.55]); }
  const g = k.build(); geoCache.set(key, g); return g;
}

// Banner cloth with a waving vertex shader.
const bannerMats = new Map();
function bannerMat(name) {
  if (bannerMats.has(name)) return bannerMats.get(name);
  const tex = new THREE.CanvasTexture(banner(name, 128, 256)); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85, alphaTest: 0.5, transparent: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WORLD_UNIFORMS.uTime; sh.uniforms.uWind = WORLD_UNIFORMS.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uWind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat w = uv.x; transformed.z += sin(uTime * 3.2 + uv.x * 5. + modelMatrix[3].x) * .07 * w * uWind; transformed.y += sin(uTime * 2.1 + uv.x * 3.) * .02 * w;');
  };
  bannerMats.set(name, m); return m;
}
function bannerMesh(name, w = 0.42, h = 0.84) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 2); geo.translate(w / 2, -h / 2, 0);
  geo.rotateZ(-Math.PI / 2); // hang as a pennant: long axis horizontal, flowing in the wind
  const m = new THREE.Mesh(geo, bannerMat(name)); m.castShadow = true; return m;
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

export class Pieces {
  constructor(scene, houses) {
    this.scene = scene; this.group = new THREE.Group(); this.group.name = 'pieces'; scene.add(this.group);
    this.houses = houses;                  // [{i, name}]
    this.sites = new Map();                // `${plot}:${h}` -> {group, kind, squads:[], banner}
    this.cabals = new Map(); this.blades = new Map();
    this.tweens = [];
  }
  slotPos(plot, h) {
    const [cx, cz] = plotCentre(plot); const [sx, sz] = SLOT[h % SLOT.length];
    const x = cx + sx, z = cz + sz; return new THREE.Vector3(x, heightAt(x, z), z);
  }
  tween(obj, to, dur = 0.7, delay = 0, done) {
    this.tweens.push({ obj, from: { y: obj.position.y, s: obj.scale.x }, to, t: -delay, dur, done });
  }
  // Bring the pieces in line with a (viewer-filtered) state. animate=false snaps.
  sync(view, animate = true) {
    const want = new Map();
    for (const p of view.plots) for (const [hk, n] of Object.entries(p.m)) if (n > 0) want.set(`${p.id}:${hk}`, { plot: p.id, h: +hk, m: n, l: p.l[hk] || 0 });
    for (const p of view.plots) for (const [hk, n] of Object.entries(p.l)) if (n > 0 && !want.has(`${p.id}:${hk}`)) want.set(`${p.id}:${hk}`, { plot: p.id, h: +hk, m: 0, l: n });
    for (const [key, site] of this.sites) if (!want.has(key)) { this.removeSite(key, site, animate); }
    for (const [key, w] of want) this.updateSite(key, w, animate);
    // Cabal shrines (only what this viewer may see)
    const shrines = new Set(view.plots.filter((p) => p.cabal != null).map((p) => p.id));
    for (const [pid, o] of this.cabals) if (!shrines.has(pid)) { this.group.remove(o); this.cabals.delete(pid); }
    for (const pid of shrines) if (!this.cabals.has(pid)) {
      const [cx, cz] = plotCentre(pid); const x = cx, z = cz + 1.3;
      const o = new THREE.Group(); o.add(mesh(shrineGeo()));
      const lamp = new THREE.PointLight('#b49cff', 1.6, 3.5, 2); lamp.position.y = 0.9; o.add(lamp);
      o.position.set(x, heightAt(x, z), z); this.group.add(o); this.cabals.set(pid, o);
      if (animate) { o.scale.setScalar(0.01); this.tween(o, { s: 1 }, 0.8); }
    }
    // contested Plots
    const contested = new Set(view.plots.filter((p) => (p.contests || []).length).map((p) => p.id));
    for (const [pid, o] of this.blades) if (!contested.has(pid)) { this.group.remove(o); this.blades.delete(pid); }
    for (const pid of contested) if (!this.blades.has(pid)) {
      const [cx, cz] = plotCentre(pid); const x = cx - 1.2, z = cz + 1.6;
      const o = mesh(bladesGeo()); o.position.set(x, heightAt(x, z) + 0.05, z); o.userData.spinSlow = true;
      this.group.add(o); this.blades.set(pid, o);
    }
  }
  updateSite(key, w, animate) {
    const name = this.houses[w.h].name;
    let site = this.sites.get(key);
    const kind = w.m >= 2 ? 'castle' : w.m === 1 ? 'manor' : 'camp';
    if (!site) {
      site = { group: new THREE.Group(), kind: null, squads: [], plot: w.plot, h: w.h };
      site.group.position.copy(this.slotPos(w.plot, w.h));
      site.group.rotation.y = ((w.plot * 7 + w.h * 3) % 5) * 0.12 - 0.24;
      site.group.userData = { plot: w.plot, house: w.h };
      this.group.add(site.group); this.sites.set(key, site);
    }
    if (site.kind !== kind) {
      if (site.building) { site.group.remove(site.building); }
      if (kind !== 'camp') {
        const b = new THREE.Group();
        b.add(mesh(kind === 'castle' ? castleGeo(name) : manorGeo(name)));
        const ban = bannerMesh(name, kind === 'castle' ? 0.6 : 0.5, kind === 'castle' ? 1.15 : 0.95);
        ban.position.set(kind === 'castle' ? 0.17 : 0.52, kind === 'castle' ? 4.05 : 1.58, kind === 'castle' ? 0.05 : -0.25);
        b.add(ban);
        b.scale.setScalar(kind === 'castle' ? 1.5 : 1.6);
        site.group.add(b); site.building = b;
        if (animate) { b.position.y = -1.6; b.scale.setScalar(0.6); this.tween(b, { y: 0, s: kind === 'castle' ? 1.5 : 1.6 }, 1.1); }
      } else site.building = null;
      site.kind = kind;
    }
    // Legions: squads arranged in front of the settlement, toward the Plot centre
    const want = Math.min(3, w.l);
    while (site.squads.length > want) { const s = site.squads.pop(); if (animate) this.tween(s, { y: -0.6, s: 0.01 }, 0.5, 0, () => site.group.remove(s)); else site.group.remove(s); }
    while (site.squads.length < want) {
      const i = site.squads.length; const s = mesh(squadGeo(name));
      const [sx] = SLOT[w.h % SLOT.length]; const dir = sx < 0 ? 1 : -1;
      s.position.set(dir * (1.25 + (i % 2) * 0.35), 0.02, 0.85 - i * 0.55);
      s.scale.setScalar(1.6);
      site.group.add(s); site.squads.push(s);
      if (animate) { s.scale.setScalar(0.01); this.tween(s, { s: 1.6 }, 0.6, i * 0.12); }
    }
  }
  removeSite(key, site, animate) {
    this.sites.delete(key);
    if (!animate) { this.group.remove(site.group); return; }
    this.tween(site.group, { y: site.group.position.y - 2.2, s: 0.4 }, 1.0, 0, () => this.group.remove(site.group));
  }
  update(dt, t) {
    for (const tw of this.tweens) {
      tw.t += dt; if (tw.t < 0) continue;
      const k = ease(Math.min(1, tw.t / tw.dur));
      if (tw.to.y != null) tw.obj.position.y = tw.from.y + (tw.to.y - tw.from.y) * k;
      if (tw.to.s != null) tw.obj.scale.setScalar(tw.from.s + (tw.to.s - tw.from.s) * k);
      if (tw.t >= tw.dur && tw.done) { tw.done(); tw.done = null; }
    }
    this.tweens = this.tweens.filter((tw) => tw.t < tw.dur);
    for (const o of this.blades.values()) o.rotation.y = t * 0.6;
    for (const o of this.cabals.values()) o.children[1].intensity = 1.3 + Math.sin(t * 3) * 0.4;
  }
  squadModel(h) { const m = mesh(squadGeo(this.houses[h].name)); m.scale.setScalar(1.6); return m; }
  siteObject(plot, h) { return this.sites.get(`${plot}:${h}`)?.group || null; }
}

void paintMat;
