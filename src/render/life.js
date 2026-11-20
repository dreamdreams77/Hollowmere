// Life on the board: tiny villagers walking short loops around the market towns, abbeys and
// villages, ox-carts on a few roads, flocks of birds wheeling over the marsh and the coast,
// herons standing in the reeds, chimney smoke from House manors and lanterns that light at dusk.
// Everything is instanced (one draw call per kind) and paths are pre-sampled, so the per-frame
// cost is a few dozen matrix writes. The Low tier keeps every kind, with fewer of each.
import * as THREE from 'three';
import { PLOTS } from '../rules/data.js';
import { Kit, paintMat, rng } from './kit.js';
import { heightAt } from './terrain.js';
import { WATER_Y, plotCentre, riverDist, LANDMARK, ROADS, SLOT, TOKEN } from './layout.js';
import { vnoise } from './kit.js';

const R = rng(9137);
const TAU = Math.PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function villagerGeo() {
  const k = new Kit();
  k.cyl(0.06, 0.1, 0.22, '#ffffff', [0, 0.13, 0], 6);           // tunic (tinted per instance)
  k.sphere(0.055, '#e6c7a4', [0, 0.29, 0], null, 6);              // head
  k.cyl(0.02, 0.025, 0.05, '#4a3020', [-0.035, 0.015, 0], 4); k.cyl(0.02, 0.025, 0.05, '#4a3020', [0.035, 0.015, 0], 4);
  return k.build();
}
function cartGeo() {
  const k = new Kit();
  k.box(0.42, 0.12, 0.7, '#8a6a46', [0, 0.22, -0.15]);                          // bed
  k.box(0.38, 0.14, 0.6, '#d9b04c', [0, 0.34, -0.15]);                          // load of sheaves / sacks
  for (const x of [-0.24, 0.24]) k.cyl(0.13, 0.13, 0.04, '#4a3020', [x, 0.13, -0.15], 10, [0, 0, Math.PI / 2]);
  k.box(0.04, 0.04, 0.5, '#5a3b22', [0, 0.2, 0.42]);                           // shaft
  k.box(0.2, 0.2, 0.46, '#6b4a32', [0, 0.27, 0.62]);                           // ox
  k.box(0.13, 0.13, 0.16, '#5a3b22', [0, 0.3, 0.9]);
  for (const [x, z] of [[-0.07, 0.45], [0.07, 0.45], [-0.07, 0.78], [0.07, 0.78]]) k.box(0.05, 0.16, 0.05, '#4a3020', [x, 0.08, z]);
  k.sphere(0.05, '#e6c7a4', [0.12, 0.47, 0.1], null, 6); k.cyl(0.05, 0.07, 0.14, '#7a3a2a', [0.12, 0.37, 0.1], 6);   // carter
  return k.build();
}
function heronGeo() {
  const k = new Kit();
  k.sphere(0.11, '#b8bcc4', [0, 0.36, 0], [0.75, 0.8, 1.5], 7);              // body
  k.cyl(0.018, 0.025, 0.22, '#c8ccd2', [0, 0.53, 0.12], 5, [0.5, 0, 0]);      // neck
  k.sphere(0.035, '#d8dce2', [0, 0.64, 0.18], null, 6);                        // head
  k.cone(0.014, 0.12, '#d9a03c', [0, 0.635, 0.27], 4, [Math.PI / 2, 0, 0]);    // beak
  k.box(0.01, 0.26, 0.01, '#6f6a50', [-0.03, 0.13, 0]); k.box(0.01, 0.26, 0.01, '#6f6a50', [0.03, 0.13, 0]);
  k.box(0.1, 0.03, 0.2, '#5d6470', [0, 0.4, -0.12], [0.2, 0, 0]);
  return k.build();
}
function birdGeo() {
  // a shallow V: wing tips raised so a negative y-scale flaps them down
  const P = [0, 0, 0.09, -0.32, 0.1, -0.06, 0, 0, -0.05, 0, 0, 0.09, 0, 0, -0.05, 0.32, 0.1, -0.06];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
function lanternGeo() {
  const k = new Kit();
  k.cyl(0.025, 0.03, 0.62, '#3a2614', [0, 0.31, 0], 5); k.box(0.16, 0.025, 0.025, '#3a2614', [0.06, 0.6, 0]);
  return k.build();
}

// Sample a closed loop (n points) of heights so walkers never call heightAt per frame.
function loop(cx, cz, rx, rz, rot, n = 40) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU; const w = 1 + (vnoise(cx + Math.cos(a), cz + Math.sin(a)) - 0.5) * 0.25;
    const lx = Math.cos(a) * rx * w, lz = Math.sin(a) * rz * w;
    const x = cx + lx * Math.cos(rot) - lz * Math.sin(rot), z = cz + lx * Math.sin(rot) + lz * Math.cos(rot);
    const h = heightAt(x, z); if (h < WATER_Y + 0.06) return null;
    pts.push([x, h, z]);
  }
  return pts;
}
function along(pts, u, closed = true) {
  const n = pts.length; const f = ((u % 1) + 1) % 1 * (closed ? n : n - 1); const i = Math.floor(f), k = f - i;
  const a = pts[i % n], b = pts[(i + 1) % n];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, Math.atan2(b[0] - a[0], b[2] - a[2])];
}

export class Life {
  constructor(scene, quality) {
    this.q = quality; const low = quality === 'low', k = low ? 0.5 : quality === 'medium' ? 0.85 : 1;
    this.group = new THREE.Group(); this.group.name = 'life'; scene.add(this.group);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    // villagers
    this.walkers = [];
    const per = { C: 9, L: 4, G: 2, R: 2, T: 1 };
    const tunics = ['#8a3a2a', '#3f6f8f', '#6f7a3a', '#c99a3e', '#7a5a8a', '#efe2c4', '#5a4a3a', '#a8432c'];
    for (const p of PLOTS) {
      const n = Math.round((per[p.res] || 0) * k); if (!n) continue;
      const [cx, cz] = plotCentre(p.id); const lx = cx + LANDMARK[0], lz = cz + LANDMARK[1];
      for (let i = 0; i < n; i++) {
        const big = p.res === 'C' || p.res === 'L';
        const rx = big ? 1.9 + R() * 0.5 : 1.4 + R() * 0.5, rz = big ? 1.5 + R() * 0.5 : 1.0 + R() * 0.4;
        const pts = loop(lx + (R() - 0.5) * 0.4, lz + 0.3 + (R() - 0.5) * 0.4, rx, rz, R() * TAU);
        if (!pts) continue;
        this.walkers.push({ pts, u: R(), speed: (0.35 + R() * 0.25) / (TAU * (rx + rz) / 2) * (R() < 0.5 ? 1 : -1), ph: R() * TAU, col: tunics[(R() * tunics.length) | 0], pause: 0 });
      }
    }
    // tint only the white tunic with the instance colour (heads and legs keep their paint)
    const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    vmat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
      #if defined(USE_INSTANCING_COLOR) && defined(USE_COLOR)
        if (min(color.r, min(color.g, color.b)) < .99) vColor.rgb = color.rgb;
      #endif`); };
    vmat.customProgramCacheKey = () => 'villager';
    this.villagers = new THREE.InstancedMesh(villagerGeo(), vmat, Math.max(1, this.walkers.length));
    this.villagers.count = this.walkers.length;
    this.walkers.forEach((w, i) => this.villagers.setColorAt(i, _c.set(w.col)));
    this.villagers.castShadow = !low; this.villagers.receiveShadow = false; this.villagers.frustumCulled = false;
    this.villagers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.villagers);
    // carts on roads that stay dry (no bridge to climb)
    const dry = ROADS.filter(([[ax, az], [bx, bz]]) => { for (let i = 1; i < 30; i++) { const t = i / 30; if (riverDist(ax + (bx - ax) * t, az + (bz - az) * t) < 1.5) return false; } return true; });
    dry.sort((a, b) => vnoise(a[0][0] * 0.7, a[1][1] * 0.3) - vnoise(b[0][0] * 0.7, b[1][1] * 0.3));
    this.carts = [];
    for (const [[ax, az], [bx, bz]] of dry.slice(0, low ? 2 : 4)) {
      // follow the same gentle curve the road is painted with (see layout.roadDist)
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, off = (vnoise(mx * 0.3, mz * 0.3) - 0.5) * 2.2;
      const nx = -(bz - az), nz = bx - ax, L = Math.hypot(nx, nz) || 1; const ccx = mx + nx / L * off, ccz = mz + nz / L * off;
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const t = 0.22 + 0.56 * i / 48; let x, z;
        if (t < 0.5) { const s = t / 0.5; x = ax + (ccx - ax) * s; z = az + (ccz - az) * s; } else { const s = (t - 0.5) / 0.5; x = ccx + (bx - ccx) * s; z = ccz + (bz - ccz) * s; }
        pts.push([x, Math.max(heightAt(x, z), WATER_Y + 0.1), z]);
      }
      this.carts.push({ pts, u: R(), speed: 0.022 + R() * 0.01, dir: 1, wait: 0 });
    }
    this.cartMesh = new THREE.InstancedMesh(cartGeo(), mat, Math.max(1, this.carts.length)); this.cartMesh.count = this.carts.length;
    this.cartMesh.castShadow = !low; this.cartMesh.frustumCulled = false; this.cartMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.cartMesh);
    // herons in the shallows of the marsh Plots
    this.herons = [];
    const wantH = low ? 2 : 3;
    for (const p of PLOTS) {
      if (p.res !== 'R') continue;
      const [cx, cz] = plotCentre(p.id); let got = 0;
      for (let tries = 0; tries < 300 && got < wantH; tries++) {
        const x = cx + (R() - 0.5) * 8.6, z = cz + (R() - 0.5) * 8.6; const h = heightAt(x, z);
        if (h > WATER_Y + 0.08 || h < WATER_Y - 0.12 || riverDist(x, z) < 1.4) continue;
        if ([...SLOT, LANDMARK, TOKEN].some(([sx, sz]) => Math.hypot(x - cx - sx, z - cz - sz) < 2.2)) continue;
        this.herons.push({ x, y: Math.max(h, WATER_Y - 0.08), z, rot: R() * TAU, goal: R() * TAU, t: R() * 8, dip: 0 }); got++;
      }
    }
    this.heronMesh = new THREE.InstancedMesh(heronGeo(), mat, Math.max(1, this.herons.length)); this.heronMesh.count = this.herons.length;
    this.heronMesh.castShadow = !low; this.heronMesh.frustumCulled = false; this.heronMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.heronMesh);
    // flocks wheeling over the marsh and the coast
    const centres = [[plotCentre(6)[0], plotCentre(6)[1], 7.5], [plotCentre(20)[0] - 3, plotCentre(20)[1] + 4, 6.5], [-14, 33, 6], [plotCentre(13)[0], plotCentre(13)[1], 8.5]].slice(0, low ? 2 : 4);
    this.flocks = centres.map(([x, z, y], i) => ({ x, z, y, r: 6 + i * 1.3, w: (0.14 + 0.03 * i) * (i % 2 ? -1 : 1), ph: i * 2.1, n: low ? 6 : 8 }));
    this.birds = [];
    for (const [fi, f] of this.flocks.entries()) for (let j = 0; j < f.n; j++) {
      const row = Math.ceil(j / 2), side = j === 0 ? 0 : j % 2 ? 1 : -1;      // a loose V
      this.birds.push({ f: fi, back: row * 0.55 + R() * 0.2, side: side * row * 0.45, up: (R() - 0.5) * 0.4, ph: R() * TAU, fr: 7 + R() * 3 });
    }
    this.birdMesh = new THREE.InstancedMesh(birdGeo(), new THREE.MeshBasicMaterial({ color: '#2f2a26', side: THREE.DoubleSide }), this.birds.length);
    this.birdMesh.frustumCulled = false; this.birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.birdMesh);
    // lanterns at the market towns, abbeys and stilt villages; their lamps brighten at dusk
    const lamps = [];
    for (const p of PLOTS) {
      const n = { C: 6, L: 3, R: 2 }[p.res] || 0; if (!n) continue;
      const [cx, cz] = plotCentre(p.id); const lx = cx + LANDMARK[0], lz = cz + LANDMARK[1];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + p.id; const r = p.res === 'C' ? 2.45 : 2.2;
        const x = lx + Math.cos(a) * r, z = lz + 0.25 + Math.sin(a) * r * 0.85; const h = heightAt(x, z);
        if (h < WATER_Y + 0.05) continue; lamps.push([x, h, z, a]);
      }
    }
    this.lampMat = new THREE.MeshStandardMaterial({ color: '#2a1a10', emissive: '#ffb45e', emissiveIntensity: 0.4, roughness: 0.5 });
    const posts = new THREE.InstancedMesh(lanternGeo(), paintMat, lamps.length);
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.12, 0.09), this.lampMat, lamps.length);
    lamps.forEach(([x, y, z, a], i) => {
      _q.setFromAxisAngle(UP, -a); _m.compose(_p.set(x, y - 0.03, z), _q, _s.set(1, 1, 1)); posts.setMatrixAt(i, _m);
      _m.compose(_p.set(x + Math.cos(a) * 0.12, y + 0.5, z + Math.sin(a) * 0.12), _q, _s.set(1, 1, 1)); heads.setMatrixAt(i, _m);
    });
    posts.castShadow = !low; heads.castShadow = false; this.group.add(posts, heads);
    this.smokeAcc = 0;
  }

  // dusk: 0 midday .. 1 evening. pieces: the Pieces instance (manor chimneys). fx: FX (smoke pool).
  update(dt, t, { dusk = 0, pieces = null, fx = null, flood = 0 } = {}) {
    // villagers
    const vm = this.villagers;
    this.walkers.forEach((w, i) => {
      if (w.pause > 0) w.pause -= dt; else { w.u += w.speed * dt; if (Math.random() < dt * 0.04) w.pause = 1 + Math.random() * 2.5; }
      const [x, y, z, yaw] = along(w.pts, w.u);
      const step = w.pause > 0 ? 0 : Math.abs(Math.sin(t * 9 + w.ph)) * 0.03;
      _q.setFromAxisAngle(UP, w.speed < 0 ? yaw + Math.PI : yaw); _m.compose(_p.set(x, y + step, z), _q, _s.setScalar(1.45)); vm.setMatrixAt(i, _m);
    });
    vm.instanceMatrix.needsUpdate = true;
    // carts: back and forth along their road, resting at each end
    const cm = this.cartMesh;
    this.carts.forEach((c, i) => {
      if (c.wait > 0) c.wait -= dt; else { c.u += c.dir * c.speed * dt; if (c.u > 1 || c.u < 0) { c.u = Math.max(0, Math.min(1, c.u)); c.dir *= -1; c.wait = 2 + Math.random() * 3; } }
      const [x, y, z, yaw] = along(c.pts, c.u * 0.9999, false);
      _q.setFromAxisAngle(UP, c.dir > 0 ? yaw : yaw + Math.PI); _m.compose(_p.set(x, y + (c.wait > 0 ? 0 : Math.abs(Math.sin(t * 6 + i)) * 0.012), z), _q, _s.set(1.15, 1.15, 1.15)); cm.setMatrixAt(i, _m);
    });
    cm.instanceMatrix.needsUpdate = true;
    // herons: stand, turn now and then, dip to fish; they step back onto the bank in a Flood
    const hm = this.heronMesh;
    this.herons.forEach((h, i) => {
      h.t -= dt; if (h.t < 0) { h.t = 4 + Math.random() * 7; if (Math.random() < 0.5) h.goal = h.rot + (Math.random() - 0.5) * 2.4; else h.dip = 1; }
      h.rot += (h.goal - h.rot) * Math.min(1, dt * 1.5); h.dip = Math.max(0, h.dip - dt * 0.8);
      _e.set(Math.sin(h.dip * Math.PI) * 0.55, h.rot, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(h.x, h.y + flood * 0.5, h.z), _q, _s.set(1.1, 1.1, 1.1)); hm.setMatrixAt(i, _m);
    });
    hm.instanceMatrix.needsUpdate = true;
    // birds
    const bm = this.birdMesh;
    this.birds.forEach((b, i) => {
      const f = this.flocks[b.f]; const a = t * f.w + f.ph;
      const r = f.r * (1 + 0.25 * Math.sin(t * 0.21 + f.ph));
      const dir = Math.sign(f.w);
      const fx = f.x + Math.cos(a) * r, fz = f.z + Math.sin(a) * r * 0.7, fy = f.y + Math.sin(t * 0.37 + f.ph) * 0.8;
      const tx = -Math.sin(a) * dir, tz = Math.cos(a) * 0.7 * dir; const tl = Math.hypot(tx, tz) || 1;
      const hx = tx / tl, hz = tz / tl;                                           // heading
      const x = fx - hx * b.back + hz * b.side, z = fz - hz * b.back - hx * b.side, y = fy + b.up + Math.sin(t * 1.3 + b.ph) * 0.12;
      const flap = Math.sin(t * b.fr + b.ph); const glide = Math.sin(t * 0.5 + b.ph) > 0.3 ? 0.25 : 1;
      _e.set(0, Math.atan2(hx, hz), -dir * 0.25); _q.setFromEuler(_e);
      _m.compose(_p.set(x, y, z), _q, _s.set(1.25, 1.25 * (0.15 + flap * glide), 1.25)); bm.setMatrixAt(i, _m);
    });
    bm.instanceMatrix.needsUpdate = true;
    // lanterns
    this.lampMat.emissiveIntensity = 0.35 + dusk * 2.6;
    // manor chimney smoke (a thin, slow plume; denser toward evening)
    if (pieces && fx) {
      this.smokeAcc += dt * (this.q === 'low' ? 0.7 : 1.3) * (0.8 + dusk * 0.6);
      if (this.smokeAcc >= 1) {
        this.smokeAcc -= 1;
        for (const site of pieces.sites.values()) {
          if (site.kind !== 'manor' || !site.building) continue;
          const b = site.building; if (b.scale.x < 1.5) continue;            // still rising into place
          _p.set(0.36, 1.52, 0.12); b.localToWorld(_p);
          fx.smoke.emit(_p.x + (Math.random() - 0.5) * 0.05, _p.y, _p.z, 0.08 + Math.random() * 0.05, 0.32 + Math.random() * 0.12, (Math.random() - 0.5) * 0.05, 0.8, 0.78, 0.76, 0.5, 3.6, 0.42, 1.7);
        }
      }
    }
  }
}
