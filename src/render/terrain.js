// The land: a painted heightfield diorama with five Reaches, seven terrains, two rivers, roads,
// a northern range and a southern coast, standing on a carved slab on a walnut table.
import * as THREE from 'three';
import { PLOTS } from '../rules/data.js';
import { S, BOARD, WORLD, WATER_Y, plotAt, plotCentre, riverDist, roadDist, SLOT, LANDMARK, TOKEN } from './layout.js';
import { fbm, vnoise, hash2 } from './kit.js';

const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Height of one terrain type at world (x, z); (u, v) are Plot-local coordinates.
function biomeHeight(res, x, z, u, v) {
  const n = fbm(x * 0.22, z * 0.22);
  switch (res) {
    case 'G': return 0.35 + n * 0.9;
    case 'T': return 0.55 + fbm(x * 0.3 + 4, z * 0.3) * 1.5;
    case 'S': { const r = Math.abs(fbm(x * 0.32, z * 0.32 + 9) - 0.5) * 2; return 0.8 + (1 - r) * 1.5 + n * 0.4; }
    case 'I': { const c = fbm(x * 0.28 + 2, z * 0.28 - 3); return 1.0 + c * c * 3.4 + Math.max(0, 1.6 - Math.hypot(u + 1, v + 3) * 0.45); }
    case 'R': return -0.05 + (fbm(x * 0.5, z * 0.5) - 0.45) * 0.55;
    case 'C': return 0.3 + n * 0.5;
    case 'L': return 0.45 + 1.7 * Math.exp(-((u) ** 2 + (v + 2.4) ** 2) / 7) + n * 0.35;
  }
  return 0.3;
}

function boardHeight(x, z) {
  // blend nearby Plots by distance to their rectangles so borders are soft
  let hs = 0, ws = 0;
  for (const p of PLOTS) {
    const [cx, cz] = plotCentre(p.id);
    const dx = Math.max(0, Math.abs(x - cx) - S / 2), dz = Math.max(0, Math.abs(z - cz) - S / 2);
    const d = Math.hypot(dx, dz);
    const w = Math.max(0, 1 - d / 2.2);
    if (w <= 0) continue;
    const w2 = w * w * (3 - 2 * w);
    hs += biomeHeight(p.res, x, z, x - cx, z - cz) * w2; ws += w2;
  }
  return ws ? hs / ws : 0.4;
}

function wildHeight(x, z) {
  // outside the board: mountains to the north, hills east and west, coast to the south
  const n = fbm(x * 0.12, z * 0.12, 5);
  const north = sst(BOARD.z0 + 1, BOARD.z0 - 22, z);
  const ridge = 1 - Math.abs(fbm(x * 0.09 + 3, z * 0.09, 5) - 0.5) * 2;
  const mountains = north * (3 + ridge * 11 + n * 3);
  const side = sst(BOARD.x1 - 1, BOARD.x1 + 14, Math.abs(x));
  const hills = side * (1.2 + n * 3.2);
  const south = sst(BOARD.z1 - 1.5, BOARD.z1 + 6, z);
  let h = Math.max(mountains, hills, 0.5 + n * 0.6);
  h = lerp(h, -1.6 + n * 0.8, south);
  return h;
}

export function heightAt(x, z) {
  const inBoard = x >= BOARD.x0 - 1 && x <= BOARD.x1 + 1 && z >= BOARD.z0 - 1 && z <= BOARD.z1 + 1;
  const edge = Math.min(x - BOARD.x0, BOARD.x1 - x, z - BOARD.z0, BOARD.z1 - z);
  let h;
  if (edge > 2) h = boardHeight(x, z);
  else if (edge < -2) h = wildHeight(x, z);
  else { const t = sst(-2, 2, edge); h = lerp(wildHeight(x, z), boardHeight(x, z), t); }
  void inBoard;
  // flat pads for settlements, landmarks and dice tokens
  const pid = plotAt(x, z);
  if (pid) {
    const [cx, cz] = plotCentre(pid);
    for (const [sx, sz] of [...SLOT, LANDMARK, TOKEN]) {
      const d = Math.hypot(x - cx - sx, z - cz - sz);
      if (d < 2.2) { const ph = Math.max(WATER_Y + 0.35, padBase(pid, cx + sx, cz + sz)); h = lerp(h, ph, sst(2.2, 1.3, d)); }
    }
  }
  // roads are gently levelled
  const rd = roadDist(x, z);
  if (rd < 0.9 && h > WATER_Y) h = lerp(h, Math.max(h * 0.85, WATER_Y + 0.12), sst(0.9, 0.2, rd) * 0.5);
  // rivers carve
  const r = riverDist(x, z);
  if (r < 1.9) h = lerp(h, -0.95, sst(1.9, 0.55, r));
  return h;
}
const padCache = new Map();
function padBase(pid, x, z) {
  const k = `${pid}:${x.toFixed(2)}:${z.toFixed(2)}`;
  if (!padCache.has(k)) {
    const p = PLOTS[pid - 1]; const [cx, cz] = plotCentre(pid);
    padCache.set(k, Math.min(1.6, biomeHeight(p.res, x, z, x - cx, z - cz)));
  }
  return padCache.get(k);
}

// Painted colour of the ground at (x, z), height h and slope (0 flat .. 1 cliff).
const C = (hex) => new THREE.Color(hex);
const PAL = {
  wheat: [C('#cfa443'), C('#b98e3a'), C('#d8c27a'), C('#7f9a44'), C('#8d6c40'), C('#a99448')],
  forest: C('#2f4f2a'), forest2: C('#253f22'), grass: C('#6f8c47'), grass2: C('#86994f'), meadow: C('#7d9a4c'),
  rock: C('#938e86'), rockDark: C('#5f5f63'), heath: C('#6e6a4c'), rust: C('#8c5a3a'), marsh: C('#6f8f58'), mud: C('#6b5a3e'),
  cobble: C('#a99c84'), lore: C('#6f7a52'), road: C('#9c8458'), sand: C('#dfcf9b'), bank: C('#8a7a52'),
  snow: C('#f1f3f7'), cliff: C('#7d7b78'), seabed: C('#9c8a60'),
};
const tmp = new THREE.Color();
function groundColour(x, z, h, slope, out) {
  const pid = plotAt(x, z);
  const n = vnoise(x * 0.9, z * 0.9), n2 = fbm(x * 0.15, z * 0.15);
  if (pid) {
    const p = PLOTS[pid - 1]; const [cx, cz] = plotCentre(pid); const u = x - cx, v = z - cz;
    switch (p.res) {
      case 'G': {
        // patchwork fields with furrows and hedges
        const fx = Math.floor((u + 5 + (vnoise(v * 0.3, 1) - 0.5) * 1.2) / 2.4), fz = Math.floor((v + 5 + (vnoise(u * 0.3, 2) - 0.5) * 1.2) / 2.1);
        const k = Math.floor(hash2(fx + pid * 7, fz) * PAL.wheat.length);
        out.copy(PAL.wheat[k]);
        const ang = hash2(fz, fx + pid) < 0.5 ? u : v;
        const fur = 0.5 + 0.5 * Math.sin(ang * 9.5);
        out.multiplyScalar(0.88 + fur * 0.16);
        const ex = Math.abs(((u + 5) / 2.4) % 1 - 0.5) > 0.46 || Math.abs(((v + 5) / 2.1) % 1 - 0.5) > 0.45;
        if (ex) out.lerp(PAL.forest, 0.55);
        break;
      }
      case 'T': out.copy(PAL.forest).lerp(PAL.forest2, n).lerp(PAL.grass, n2 * 0.25); break;
      case 'S': out.copy(PAL.grass2).lerp(PAL.rock, sst(0.15, 0.5, slope) + n * 0.15); break;
      case 'I': out.copy(PAL.heath).lerp(PAL.rockDark, sst(0.1, 0.4, slope)).lerp(PAL.rust, sst(0.72, 0.9, n) * 0.6); break;
      case 'R': out.copy(PAL.marsh).lerp(PAL.mud, sst(0.15, -0.05, h) * 0.8 + n * 0.15); break;
      case 'C': out.copy(PAL.meadow).lerp(PAL.grass2, n); { const d = Math.hypot(u, v + 0.5); if (d < 2.4) out.lerp(PAL.cobble, sst(2.4, 1.6, d)); } break;
      case 'L': out.copy(PAL.lore).lerp(PAL.grass, n * 0.5).lerp(C('#8d7aa0'), sst(0.7, 0.9, n2) * 0.3); break;
      default: out.copy(PAL.grass);
    }
    // plot borders: a faint darker seam so Plots read as tiles of the board
    const bu = 5 - Math.abs(u), bv = 5 - Math.abs(v);
    const seam = Math.min(bu, bv);
    if (seam < 0.18) out.multiplyScalar(0.82);
  } else {
    out.copy(PAL.grass).lerp(PAL.forest, 0.35 + n2 * 0.55).lerp(C('#5b6b3a'), vnoise(x * 0.07, z * 0.07) * 0.4);
    if (z < BOARD.z0) out.lerp(PAL.cliff, sst(2, 6, h) * 0.85 + sst(0.3, 0.6, slope) * 0.5);
    if (h > 8.5 + n * 2) out.lerp(PAL.snow, sst(8.5, 10, h + n * 2));
    if (z > BOARD.z1 - 1) out.lerp(PAL.sand, sst(0.8, -0.2, h));
  }
  if (h < WATER_Y + 0.25) out.lerp(PAL.bank, sst(WATER_Y + 0.25, WATER_Y - 0.1, h));
  if (h < WATER_Y - 0.2) out.lerp(PAL.seabed, 0.6);
  const rd = roadDist(x, z);
  if (pid && rd < 0.42) out.lerp(PAL.road, sst(0.42, 0.18, rd) * 0.7);
  out.multiplyScalar(0.94 + n * 0.12);
  return out;
}

// GLSL painterly patch shared by terrain, trees and rocks: seasonal tint, snow, brush grain,
// drifting cloud shadows. Uniform objects are shared so one update moves the whole world.
export const WORLD_UNIFORMS = {
  uTime: { value: 0 }, uSnow: { value: 0 }, uAutumn: { value: 0 }, uSpring: { value: 0 }, uCloud: { value: 0.6 },
  uWind: { value: 1 }, uWet: { value: 0 },
};
const NOISE_GLSL = `
  float hmHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hmNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
    return mix(mix(hmHash(i), hmHash(i+vec2(1,0)), u.x), mix(hmHash(i+vec2(0,1)), hmHash(i+vec2(1,1)), u.x), u.y); }
  float hmFbm(vec2 p){ float a = 0., s = .5; for (int i = 0; i < 4; i++){ a += s*hmNoise(p); p *= 2.03; s *= .5; } return a; }
`;
export function paintPatch(mat, { sway = 0, snowCap = 1 } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WORLD_UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime, uWind; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${sway ? `
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
        #else
          vec2 ip = vec2(0.);
        #endif
        transformed.x += sin(uTime * 1.4 + ip.x * .7 + ip.y * .3) * ${sway.toFixed(3)} * uWind * max(position.y, 0.);
        transformed.z += cos(uTime * 1.1 + ip.y * .5) * ${(sway * 0.6).toFixed(3)} * uWind * max(position.y, 0.);` : ''}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        wp4 = modelMatrix * wp4; vWP = wp4.xyz;
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWN = normalize(mat3(modelMatrix) * wn);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime, uSnow, uAutumn, uSpring, uCloud, uWet; varying vec3 vWP; varying vec3 vWN;\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float green = clamp((c.g - max(c.r, c.b)) * 6., 0., 1.);
          vec3 autumn = vec3(c.g * 1.25 + .05, c.g * .78, c.b * .45);
          float leafy = hmNoise(vWP.xz * 1.3);
          autumn = mix(autumn, vec3(c.g * 1.35, c.g * .45, c.b * .3), step(.62, leafy));
          c = mix(c, autumn, uAutumn * green);
          c = mix(c, c * vec3(.92, 1.1, .9), uSpring * green);
          float up = smoothstep(.45, .9, vWN.y);
          float sn = uSnow * ${snowCap.toFixed(2)} * up * smoothstep(.35, .75, hmFbm(vWP.xz * .7) + uSnow * .35 + max(vWP.y, 0.) * .06);
          c = mix(c, vec3(.92, .94, .98), sn);
          c *= .9 + .2 * hmNoise(vWP.xz * 2.7);
          c *= 1. - uWet * .18;
          float cloud = smoothstep(.48, .72, hmFbm(vWP.xz * .035 + vec2(uTime * .012, uTime * .006)));
          c *= 1. - uCloud * .32 * cloud;
          diffuseColor.rgb = c;
        }`);
  };
  mat.customProgramCacheKey = () => `paint${sway}${snowCap}`;
  return mat;
}

export function buildTerrain(quality) {
  const step = quality === 'low' ? 0.42 : quality === 'medium' ? 0.38 : 0.33;
  const W = WORLD.x1 - WORLD.x0, D = WORLD.z1 - WORLD.z0;
  const nx = Math.round(W / step), nz = Math.round(D / step);
  const geo = new THREE.PlaneGeometry(W, D, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((WORLD.x0 + WORLD.x1) / 2, 0, (WORLD.z0 + WORLD.z1) / 2);
  const pos = geo.attributes.position;
  const H = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); H[i] = heightAt(x, z); pos.setY(i, H[i]); }
  geo.computeVertexNormals();
  const col = new Float32Array(pos.count * 3);
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const slope = 1 - nrm.getY(i);
    groundColour(pos.getX(i), pos.getZ(i), H[i], slope * 3, tmp);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = paintPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }));
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.castShadow = quality === 'high';
  mesh.name = 'terrain';
  return { mesh, nx, nz, step };
}

// A heightmap texture for the water shader (depth colour and shore foam).
export function heightTexture(res = 256) {
  const data = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = WORLD.x0 + (i + 0.5) / res * (WORLD.x1 - WORLD.x0), z = WORLD.z0 + (j + 0.5) / res * (WORLD.z1 - WORLD.z0);
    data[j * res + i] = heightAt(x, z);
  }
  const t = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.FloatType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

// The slab the diorama stands on: carved earth strata, a gilded rim, and the walnut table.
export function buildSlab(textures) {
  const g = new THREE.Group();
  const W = WORLD.x1 - WORLD.x0, D = WORLD.z1 - WORLD.z0, cx = (WORLD.x0 + WORLD.x1) / 2, cz = (WORLD.z0 + WORLD.z1) / 2;
  // skirt following the terrain edge
  const ring = [];
  const n = 200;
  for (let i = 0; i <= n; i++) ring.push([WORLD.x0 + W * i / n, WORLD.z0]);
  for (let i = 1; i <= n; i++) ring.push([WORLD.x1, WORLD.z0 + D * i / n]);
  for (let i = 1; i <= n; i++) ring.push([WORLD.x1 - W * i / n, WORLD.z1]);
  for (let i = 1; i <= n; i++) ring.push([WORLD.x0, WORLD.z1 - D * i / n]);
  const P = [], Cc = [];
  const strata = [C('#6b4f34'), C('#7d5f3e'), C('#5a4330'), C('#8a6e4a'), C('#4a3828')];
  const bottom = -7;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[i + 1];
    const ha = Math.max(heightAt(ax, az), WATER_Y), hb = Math.max(heightAt(bx, bz), WATER_Y);
    const layers = 6;
    for (let k = 0; k < layers; k++) {
      const t0 = k / layers, t1 = (k + 1) / layers;
      const ya0 = lerp(ha, bottom, t0), ya1 = lerp(ha, bottom, t1), yb0 = lerp(hb, bottom, t0), yb1 = lerp(hb, bottom, t1);
      const c = strata[(k + (i >> 5)) % strata.length];
      const quad = [[ax, ya0, az], [bx, yb0, bz], [bx, yb1, bz], [ax, ya0, az], [bx, yb1, bz], [ax, ya1, az]];
      for (const q of quad) { P.push(...q); Cc.push(c.r, c.g, c.b); }
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  sg.computeVertexNormals();
  const skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  skirt.receiveShadow = true; g.add(skirt);
  // gilded base plinth
  const goldMat = new THREE.MeshStandardMaterial({ color: '#c99a3e', metalness: 0.85, roughness: 0.32, map: textures.leaf || null });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 2.4, 1.4, D + 2.4), goldMat);
  plinth.position.set(cx, bottom - 0.7, cz); plinth.receiveShadow = true; plinth.castShadow = true; g.add(plinth);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 2.2, D + 4), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.6, metalness: 0.1 }));
  base.position.set(cx, bottom - 2.5, cz); base.receiveShadow = true; g.add(base);
  // walnut table
  const tmat = new THREE.MeshStandardMaterial({ map: textures.walnut, normalMap: textures.walnutN, roughnessMap: textures.walnutR, roughness: 0.55, color: '#b08a6a' });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), tmat);
  table.rotation.x = -Math.PI / 2; table.position.y = bottom - 3.6; table.receiveShadow = true; g.add(table);
  return g;
}
