// Scenery: forests, rocks, reeds, landmarks for each terrain, bridges, boats, dice tokens and
// Reach plaques. Static pieces of the world; House pieces live in pieces.js.
import * as THREE from 'three';
import { PLOTS, REACHES, pips } from '../rules/data.js';
import { Kit, mesh, paintMat, glowMat, rng, vnoise, fbm } from './kit.js';
import { heightAt, paintPatch } from './terrain.js';
import { S, BOARD, WORLD, WATER_Y, plotAt, plotCentre, riverDist, roadDist, SLOT, LANDMARK, TOKEN, bridgeSites } from './layout.js';
import { goldLeaf, vellum, PIGMENT } from '../content/art.js';

const R = rng(20251118);
const nearPad = (x, z) => {
  const pid = plotAt(x, z); if (!pid) return false;
  const [cx, cz] = plotCentre(pid);
  return [...SLOT, LANDMARK, TOKEN].some(([sx, sz]) => Math.hypot(x - cx - sx, z - cz - sz) < 1.75);
};

function coniferGeo() {
  const k = new Kit();
  k.cyl(0.07, 0.1, 0.5, '#5a3b22', [0, 0.25, 0], 6);
  k.cone(0.55, 0.8, '#2f5a32', [0, 0.75, 0], 7); k.cone(0.43, 0.7, '#376838', [0, 1.1, 0], 7); k.cone(0.28, 0.6, '#3f733e', [0, 1.42, 0], 7);
  return k.build();
}
function broadleafGeo() {
  const k = new Kit();
  k.cyl(0.08, 0.12, 0.7, '#5f3f25', [0, 0.35, 0], 6);
  const ico = new THREE.IcosahedronGeometry(0.42, 0);
  k.add(ico, '#4f7d3a', { p: [0, 1.0, 0], s: [1, 0.85, 1] });
  k.add(ico, '#5b8a40', { p: [0.25, 0.85, 0.1], s: 0.7 });
  k.add(ico, '#46703a', { p: [-0.22, 0.88, -0.1], s: 0.72 });
  return k.build();
}
function rockGeo() { const k = new Kit(); k.add(new THREE.DodecahedronGeometry(0.4, 0), '#9a958c', { s: [1, 0.7, 0.9] }); return k.build(); }
function reedGeo() {
  const k = new Kit();
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = 0.08 + (i % 3) * 0.05, h = 0.45 + (i % 4) * 0.12;
    k.cone(0.025, h, '#7f9a5a', [Math.cos(a) * r, h / 2, Math.sin(a) * r], 4);
    if (i % 2) k.cyl(0.03, 0.03, 0.1, '#6a4422', [Math.cos(a) * r, h - 0.02, Math.sin(a) * r], 4);
  }
  return k.build();
}

function instanced(geo, count, sway = 0) {
  const mat = paintPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { sway });
  const im = new THREE.InstancedMesh(geo, mat, count); im.castShadow = true; im.receiveShadow = true;
  im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  return im;
}

function scatter(quality) {
  const conifers = [], broad = [], rocks = [], reeds = [];
  const tryPlace = (x, z, list, opts = {}) => {
    const h = heightAt(x, z);
    if (h < WATER_Y + 0.12 && !opts.wet) return false;
    if (opts.wet && (h > 0.25 || h < WATER_Y - 0.15)) return false;
    if (riverDist(x, z) < 1.25) return false;
    if (plotAt(x, z) && (nearPad(x, z) || roadDist(x, z) < 0.6)) return false;
    list.push([x, h, z, 0.7 + R() * 0.6, R() * Math.PI * 2]);
    return true;
  };
  const scale = quality === 'low' ? 0.65 : quality === 'medium' ? 0.8 : 1;
  for (const p of PLOTS) {
    const [cx, cz] = plotCentre(p.id);
    const rnd = (n) => Array.from({ length: Math.round(n * scale) }, () => [cx + (R() - 0.5) * 9.4, cz + (R() - 0.5) * 9.4]);
    switch (p.res) {
      case 'T': for (const [x, z] of rnd(150)) tryPlace(x, z, R() < 0.6 ? conifers : broad); break;
      case 'G': for (const [x, z] of rnd(14)) tryPlace(x, z, broad); break;
      case 'S': for (const [x, z] of rnd(16)) tryPlace(x, z, conifers); for (const [x, z] of rnd(30)) tryPlace(x, z, rocks); break;
      case 'I': for (const [x, z] of rnd(10)) tryPlace(x, z, conifers); for (const [x, z] of rnd(40)) tryPlace(x, z, rocks); break;
      case 'R': for (const [x, z] of rnd(260)) tryPlace(x, z, reeds, { wet: true }); for (const [x, z] of rnd(6)) tryPlace(x, z, broad); break;
      case 'C': for (const [x, z] of rnd(10)) tryPlace(x, z, broad); break;
      case 'L': for (const [x, z] of rnd(16)) tryPlace(x, z, R() < 0.5 ? conifers : broad); break;
    }
  }
  // wild lands beyond the board
  const wild = Math.round(1700 * scale);
  for (let i = 0; i < wild; i++) {
    const x = WORLD.x0 + R() * (WORLD.x1 - WORLD.x0), z = WORLD.z0 + R() * (WORLD.z1 - WORLD.z0);
    if (plotAt(x, z)) continue;
    const h = heightAt(x, z);
    const dens = fbm(x * 0.08, z * 0.08);
    if (dens < 0.42 || h > 7.5) { if (h > 3 && R() < 0.25) tryPlace(x, z, rocks); continue; }
    tryPlace(x, z, h > 3 ? conifers : (R() < 0.5 ? broad : conifers));
  }
  return { conifers, broad, rocks, reeds };
}

function fill(im, list, scaleK = 1, tint) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  list.forEach(([x, y, z, sc, rot], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot); s.setScalar(sc * scaleK); p.set(x, y - 0.05, z);
    m.compose(p, q, s); im.setMatrixAt(i, m);
    const v = 0.82 + vnoise(x * 2, z * 2) * 0.36; c.setRGB(v, v * (tint ? tint : 1), v); im.setColorAt(i, c);
  });
  im.count = list.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- landmarks

function windmill() {
  const k = new Kit();
  k.cyl(0.45, 0.7, 1.7, '#e8dcc0', [0, 0.85, 0], 10);
  k.cone(0.6, 0.7, '#8a4a2a', [0, 2.05, 0], 10);
  k.box(0.3, 0.45, 0.06, '#5a3b22', [0, 0.25, 0.68]);
  for (const h of [0.6, 1.2]) k.box(0.18, 0.2, 0.06, '#2a1a10', [0.3, h, 0.58]);
  for (let i = 0; i < 3; i++) k.cyl(0.35, 0.42, 0.6, '#d9b04c', [-1.4 + i * 0.6, 0.3, 1.2], 8), k.cone(0.38, 0.35, '#c99a3e', [-1.4 + i * 0.6, 0.78, 1.2], 8);
  const sails = new Kit();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    sails.box(0.06, 1.2, 0.03, '#5a3b22', [Math.sin(a) * 0.6, Math.cos(a) * 0.6, 0], [0, 0, -a]);
    sails.box(0.3, 0.9, 0.02, '#efe2c4', [Math.sin(a) * 0.7 + Math.cos(a) * 0.12, Math.cos(a) * 0.7 - Math.sin(a) * 0.12, 0.02], [0, 0, -a]);
  }
  const g = new THREE.Group(); g.add(mesh(k.build()));
  const s = mesh(sails.build()); s.position.set(0, 1.6, 0.75); s.userData.spin = 0.6; g.add(s);
  return g;
}
function sawmill() {
  const k = new Kit();
  k.box(1.6, 0.8, 1.1, '#8a6a46', [0, 0.4, 0]); k.gable(1.75, 1.25, 0.6, '#5a3b22', [0, 0.8, 0]);
  for (let i = 0; i < 5; i++) k.cyl(0.11, 0.11, 1.4, '#9a6a3a', [1.5, 0.12 + (i % 3) * 0.2, -0.4 + i * 0.2], 7, [0, 0, Math.PI / 2]);
  k.cyl(0.4, 0.4, 0.08, '#6a4a2a', [-1.0, 0.45, 0.6], 12, [Math.PI / 2, 0, 0]);
  return mesh(k.build());
}
function quarry() {
  const k = new Kit();
  for (let i = 0; i < 3; i++) k.box(2.2 - i * 0.5, 0.25, 1.6 - i * 0.35, ['#8f8a80', '#9c968a', '#a8a194'][i], [0, 0.12 + i * 0.25, -0.2], [0, 0.1, 0]);
  for (let i = 0; i < 6; i++) k.box(0.35, 0.3, 0.35, ['#b3ab9b', '#a59d8e', '#bdb5a4'][i % 3], [-1.4 + (i % 3) * 0.4, 0.15 + Math.floor(i / 3) * 0.3, 1.0], [0, (i % 2) * 0.2, 0]);
  for (let i = 0; i < 7; i++) k.add(new THREE.DodecahedronGeometry(0.12, 0), '#8a8578', { p: [0.9 + Math.sin(i * 2.3) * 0.5, 0.06, 0.6 + Math.cos(i * 1.7) * 0.4] });
  k.cyl(0.05, 0.06, 2.2, '#5a3b22', [1.3, 1.1, 0], 6); k.box(1.4, 0.06, 0.06, '#5a3b22', [0.8, 2.1, 0], [0, 0, -0.25]);
  k.box(0.02, 0.8, 0.02, '#2a1a10', [0.25, 1.75, 0]); k.box(0.25, 0.2, 0.25, '#d7d2c6', [0.25, 1.3, 0]);
  return mesh(k.build());
}
function mine() {
  const g = new THREE.Group(); const k = new Kit();
  // headframe
  for (const x of [-0.5, 0.5]) k.box(0.1, 2.0, 0.1, '#5a3b22', [x, 1.0, 0], [0, 0, x > 0 ? 0.12 : -0.12]);
  k.box(1.3, 0.1, 0.12, '#5a3b22', [0, 1.95, 0]); k.cyl(0.25, 0.25, 0.08, '#3a3f48', [0, 2.05, 0.1], 12, [Math.PI / 2, 0, 0]);
  k.box(0.9, 0.7, 0.5, '#2a1a10', [0, 0.35, -0.5]);
  // forge with chimney
  k.box(1.2, 0.8, 1.0, '#6b6458', [1.5, 0.4, 0.6]); k.gable(1.3, 1.1, 0.5, '#3a3f48', [1.5, 0.8, 0.6]);
  k.box(0.35, 1.6, 0.35, '#5a5248', [1.95, 1.1, 0.3]);
  for (let i = 0; i < 4; i++) k.sphere(0.35, '#3a3830', [-1.3 + i * 0.25, 0.15, 1.0 + (i % 2) * 0.3], [1, 0.5, 1], 6);
  g.add(mesh(k.build()));
  const fire = new Kit(); fire.box(0.4, 0.3, 0.05, '#ff9a3c', [1.5, 0.3, 1.11]);
  g.add(mesh(fire.build(), glowMat, { cast: false }));
  g.userData.smoke = [1.95, 1.95, 0.3];
  return g;
}
function stilts() {
  const k = new Kit();
  for (const [x, z] of [[-0.9, 0], [0.9, 0.5]]) {
    for (const dx of [-0.35, 0.35]) for (const dz of [-0.3, 0.3]) k.cyl(0.04, 0.04, 0.8, '#5a3b22', [x + dx, 0.2, z + dz], 5);
    k.box(0.9, 0.06, 0.8, '#7a5a36', [x, 0.6, z]); k.box(0.8, 0.5, 0.7, '#8f7a52', [x, 0.88, z]);
    k.gable(0.95, 0.95, 0.5, '#c9a65a', [x, 1.13, z]);
  }
  for (let i = 0; i < 8; i++) k.box(0.32, 0.04, 0.5, '#7a5a36', [-0.4 + i * 0.12, 0.42, -0.9 - i * 0.18], [0, 0.4, 0]);
  return mesh(k.build());
}
function market() {
  const k = new Kit(); const r = rng(77);
  const roofs = ['#a8432c', '#8a4a2a', '#b55a36', '#6b4a3a', '#9a3a2a'];
  const ring = [[-1.6, -0.6], [-0.6, -1.4], [0.7, -1.3], [1.6, -0.4], [1.5, 0.9], [-1.5, 0.8]];
  ring.forEach(([x, z], i) => {
    const w = 0.7 + r() * 0.4, d = 0.6 + r() * 0.3, h = 0.55 + r() * 0.45, ang = Math.atan2(z, x);
    k.box(w, h, d, i % 2 ? '#e8dcc0' : '#d8c8a2', [x, h / 2, z], [0, -ang, 0]);
    k.gable(w + 0.12, d + 0.18, 0.42, roofs[i % roofs.length], [x, h, z], -ang);
  });
  // church with spire
  k.box(0.7, 1.1, 1.2, '#cfc3a8', [0, 0.55, 0.2]); k.gable(0.82, 1.3, 0.5, '#5f5a66', [0, 1.1, 0.2], Math.PI / 2);
  k.box(0.45, 1.6, 0.45, '#cfc3a8', [0, 0.8, -0.55]); k.cone(0.36, 1.0, '#5f5a66', [0, 2.1, -0.55], 4, [0, Math.PI / 4, 0]);
  // market stalls
  for (let i = 0; i < 3; i++) { k.box(0.4, 0.3, 0.3, '#7a5a36', [-0.6 + i * 0.6, 0.15, 1.6]); k.gable(0.5, 0.4, 0.15, ['#c8321f', '#3f8f7a', '#c99a3e'][i], [-0.6 + i * 0.6, 0.38, 1.6]); }
  return mesh(k.build());
}
function abbey() {
  const g = new THREE.Group(); const k = new Kit();
  k.box(1.8, 0.9, 1.0, '#d8ceb6', [0.4, 0.45, 0.2]); k.gable(1.95, 1.15, 0.55, '#4a4f6a', [0.4, 0.9, 0.2]);
  k.box(0.7, 2.3, 0.7, '#d8ceb6', [-0.85, 1.15, 0]); k.cone(0.55, 1.1, '#4a4f6a', [-0.85, 2.85, 0], 4, [0, Math.PI / 4, 0]);
  k.box(1.6, 0.35, 1.3, '#cfc3a8', [0.45, 0.17, 1.4]);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; k.box(0.18, 0.6 + (i % 2) * 0.2, 0.12, '#8a8680', [2.0 + Math.cos(a) * 0.6, 0.3, -1.3 + Math.sin(a) * 0.6], [0, a, 0]); }
  g.add(mesh(k.build()));
  const win = new Kit();
  for (const y of [0.9, 1.5]) win.box(0.14, 0.26, 0.02, '#ffcf7a', [-0.85, y, 0.36]);
  for (let i = 0; i < 4; i++) win.box(0.12, 0.25, 0.02, '#ffcf7a', [-0.2 + i * 0.35, 0.5, 0.71]);
  const wm = mesh(win.build(), glowMat, { cast: false }); wm.userData.nightGlow = true; g.add(wm);
  return g;
}
const LANDMARK_FOR = { G: windmill, T: sawmill, S: quarry, I: mine, R: stilts, C: market, L: abbey };

// ---------------------------------------------------------------- tokens and plaques

function tokenTexture(n) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.drawImage(vellum(256, 256, n), 0, 0);
  const hot = n === 6 || n === 8;
  g.beginPath(); g.arc(128, 128, 120, 0, 7); g.lineWidth = 14; g.strokeStyle = PIGMENT.ink; g.stroke();
  g.beginPath(); g.arc(128, 128, 104, 0, 7); g.lineWidth = 3; g.strokeStyle = 'rgba(42,26,16,.5)'; g.stroke();
  g.fillStyle = hot ? PIGMENT.vermilion : PIGMENT.ink;
  g.font = 'bold 150px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';   // IM Fell's 1 reads as a Roman I: 11 would look like II
  g.lineWidth = 6; g.strokeStyle = g.fillStyle; g.strokeText(String(n), 128, 112); g.fillText(String(n), 128, 112);
  const k = pips(n);
  for (let i = 0; i < k; i++) { g.beginPath(); g.arc(128 + (i - (k - 1) / 2) * 26, 206, 10, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function plaqueTexture(reach) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = g.createPattern(goldLeaf(128, reach.id * 5), 'repeat'); g.fillRect(0, 0, 512, 256);
  g.drawImage(vellum(472, 216, reach.id), 20, 20);
  g.strokeStyle = PIGMENT.ink; g.lineWidth = 6; g.strokeRect(20, 20, 472, 216);
  g.textAlign = 'center'; g.fillStyle = PIGMENT.vermilion; g.font = '700 92px "IM Fell English", Georgia, serif'; g.fillText(reach.roman, 256, 112);
  g.fillStyle = PIGMENT.ink; g.font = 'italic 46px "IM Fell English", Georgia, serif'; g.fillText(reach.name, 256, 176);
  if (reach.delta) { g.font = 'italic 30px "IM Fell English", Georgia, serif'; g.fillStyle = PIGMENT.vermilion; g.fillText('scores double', 256, 216); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function bridge(len) {
  const k = new Kit(); const w = 0.8;
  k.box(len, 0.16, w, '#a9a090', [0, 0.42, 0]);
  for (const s of [-1, 1]) k.box(len, 0.16, 0.1, '#968c7c', [0, 0.56, s * w / 2]);
  const arch = new THREE.TorusGeometry(len * 0.32, 0.12, 6, 12, Math.PI);
  for (const s of [-1, 1]) k.add(arch, '#968c7c', { p: [0, 0.05, s * (w / 2 - 0.06)], s: [1, 0.6, 1] });
  for (const x of [-len / 2 + 0.2, len / 2 - 0.2]) k.box(0.4, 0.8, w + 0.1, '#968c7c', [x, 0.1, 0]);
  return mesh(k.build());
}
function boat() {
  const k = new Kit();
  k.box(1.0, 0.18, 0.34, '#6a4422', [0, 0.05, 0]); k.box(0.3, 0.14, 0.3, '#6a4422', [0.55, 0.08, 0], [0, 0, 0.3]);
  k.cyl(0.025, 0.025, 1.1, '#5a3b22', [0, 0.6, 0], 5);
  k.add(new THREE.PlaneGeometry(0.55, 0.75), '#efe2c4', { p: [0.15, 0.65, 0], r: [0, Math.PI / 2, 0] });
  const m = mesh(k.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
  return m;
}

export function buildScenery(quality) {
  const g = new THREE.Group(); g.name = 'scenery';
  const { conifers, broad, rocks, reeds } = scatter(quality);
  const sway = 0.04;
  const ci = instanced(coniferGeo(), conifers.length, sway); fill(ci, conifers, 1.05); g.add(ci);
  const bi = instanced(broadleafGeo(), broad.length, sway); fill(bi, broad, 1.1); g.add(bi);
  const ri = instanced(rockGeo(), rocks.length); fill(ri, rocks, 1.1); g.add(ri);
  const reedI = instanced(reedGeo(), reeds.length, sway * 1.5); fill(reedI, reeds, 1.2); reedI.castShadow = false; g.add(reedI);
  // dry-stone walls along every Plot border: the board reads as tiles; roads pass through gates
  const walls = [];
  const seg = 0.9;
  const lines = [];
  for (let c = 0; c <= 4; c++) lines.push([[BOARD.x0 + c * S, BOARD.z0], [BOARD.x0 + c * S, BOARD.z1]]);
  for (let r = 0; r <= 5; r++) lines.push([[BOARD.x0, BOARD.z0 + r * S], [BOARD.x1, BOARD.z0 + r * S]]);
  for (const [[ax, az], [bx, bz]] of lines) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / seg), ang = Math.atan2(bz - az, bx - ax);
    for (let i = 0; i < n; i++) {
      const tt = (i + 0.5) / n; const x = ax + (bx - ax) * tt, z = az + (bz - az) * tt;
      if (riverDist(x, z) < 1.5 || roadDist(x, z) < 0.75) continue;
      const y = heightAt(x, z); if (y < WATER_Y + 0.1) continue;
      walls.push([x, y, z, ang]);
    }
  }
  const wk = new Kit(); wk.box(seg * 0.96, 0.22, 0.2, '#a39a88', [0, 0.11, 0]); wk.box(seg * 0.7, 0.07, 0.16, '#8c8475', [0.05, 0.255, 0]);
  const wallI = new THREE.InstancedMesh(wk.build(), paintPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { snowCap: 1 }), walls.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    walls.forEach(([x, y, z, ang], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang); m.compose(new THREE.Vector3(x, y - 0.04, z), q, new THREE.Vector3(1, 0.9 + vnoise(x * 3, z * 3) * 0.4, 1)); wallI.setMatrixAt(i, m); const v = 0.85 + vnoise(x * 5, z * 5) * 0.3; wallI.setColorAt(i, c.setRGB(v, v, v)); }); }
  wallI.castShadow = true; wallI.receiveShadow = true; g.add(wallI);
  const animated = [], smokes = [], glows = [], boats = [];
  for (const p of PLOTS) {
    const [cx, cz] = plotCentre(p.id);
    const lm = LANDMARK_FOR[p.res]();
    const x = cx + LANDMARK[0], z = cz + LANDMARK[1];
    lm.position.set(x, heightAt(x, z) - 0.02, z); lm.rotation.y = (p.id * 1.7) % 0.6 - 0.3;
    lm.traverse((o) => { if (o.userData.spin) animated.push(o); if (o.userData.nightGlow) glows.push(o); });
    if (lm.userData.smoke) { const [sx, sy, sz] = lm.userData.smoke; const v = new THREE.Vector3(sx, sy, sz); lm.updateMatrixWorld(true); smokes.push(lm.localToWorld(v)); }
    g.add(lm);
    // dice token: a vellum disc painted with the number and its odds
    const tx = cx + TOKEN[0], tz = cz + TOKEN[1];
    const side = new THREE.MeshStandardMaterial({ color: '#7a4a26', roughness: 0.7 });
    const top = new THREE.MeshStandardMaterial({ map: tokenTexture(p.n), roughness: 0.75 });
    const tok = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.24, 32), [side, top, side]);
    tok.position.set(tx, heightAt(tx, tz) + 0.12, tz); tok.rotation.y = Math.PI;   // upright for the default camera (a 6 must not read as a 9) tok.castShadow = true; tok.receiveShadow = true;
    tok.userData.plot = p.id; g.add(tok);
  }
  for (const b of bridgeSites()) {
    const m = bridge(b.len); m.position.set(b.x, WATER_Y, b.z); m.rotation.y = -b.ang; g.add(m);
  }
  for (const reach of REACHES) {
    const z = (reach.id - 3) * S; const x = BOARD.x0 - 3.2;
    const k = new Kit(); k.box(1.4, 2.0, 0.8, '#8a8680', [0, 1.0, 0]); k.box(1.6, 0.25, 1.0, '#6f6b66', [0, 2.1, 0]);
    const st = mesh(k.build()); st.position.set(x - 0.6, heightAt(x, z) - 0.1, z); st.rotation.y = 0.45; st.scale.setScalar(1.3);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshStandardMaterial({ map: plaqueTexture(reach), roughness: 0.4, metalness: 0.2 }));
    pl.position.set(0, 1.25, 0.45); pl.rotation.x = -0.25; st.add(pl);
    st.userData.reach = reach.id; g.add(st);
  }
  for (let i = 0; i < 4; i++) {
    const b = boat(); const x = -18 + i * 11, z = 33 + (i % 2) * 4;
    b.position.set(x, WATER_Y, z); b.rotation.y = i; b.userData.bob = { x, z, ph: i * 1.7 }; boats.push(b); g.add(b);
  }
  return { group: g, animated, smokes, glows, boats };
}
