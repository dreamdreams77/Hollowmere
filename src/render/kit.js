// Geometry kit: builds miniature models from three.js primitives, baked with vertex colours and
// merged into one BufferGeometry per model (one draw call each). Used for buildings, Keeps,
// Legions and landmarks. Pairs with lemo-opuscar's GB builder (vendor/lemo-opuscar/geo.js).
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

export class Kit {
  constructor() { this.pos = []; this.nrm = []; this.col = []; }
  // add(geometry, colour, {p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz] | number})
  add(geo, colour, t = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _p.fromArray(t.p || [0, 0, 0]); _e.set(...(t.r || [0, 0, 0])); _q.setFromEuler(_e);
    const sc = t.s == null ? 1 : t.s; _s.set(...(Array.isArray(sc) ? sc : [sc, sc, sc]));
    _m.compose(_p, _q, _s); g.applyMatrix4(_m);
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    _c.set(colour);
    const jitter = t.jitter || 0;
    for (let i = 0; i < P.length; i += 3) {
      this.pos.push(P[i], P[i + 1], P[i + 2]); this.nrm.push(N[i], N[i + 1], N[i + 2]);
      const j = jitter ? 1 + (Math.sin(P[i] * 12.9 + P[i + 2] * 78.2) * 0.5) * jitter : 1;
      this.col.push(_c.r * j, _c.g * j, _c.b * j);
    }
    g.dispose();
    return this;
  }
  box(w, h, d, colour, p, r) { return this.add(new THREE.BoxGeometry(w, h, d), colour, { p, r }); }
  cyl(rt, rb, h, colour, p, seg = 10, r) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), colour, { p, r }); }
  cone(rad, h, colour, p, seg = 10, r) { return this.add(new THREE.ConeGeometry(rad, h, seg), colour, { p, r }); }
  sphere(rad, colour, p, s, seg = 8) { return this.add(new THREE.SphereGeometry(rad, seg, Math.max(4, seg * 0.6 | 0)), colour, { p, s }); }
  // Gabled roof (prism) along x, width w (x), depth d (z), rise h; base at y.
  gable(w, d, h, colour, p = [0, 0, 0], ry = 0) {
    const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2);
    return this.add(g, colour, { p, r: [0, ry, 0] });
  }
  // Ring of crenellations on top of a wall run from a to b at height y.
  crenels(a, b, y, colour, size = 0.12, gap = 2) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = Math.max(2, Math.floor(L / (size * gap)));
    const ang = Math.atan2(dz, dx);
    for (let i = 0; i <= n; i++) {
      if (i % 2) continue;
      const t = i / n;
      this.box(size, size, size * 0.9, colour, [a[0] + dx * t, y + size / 2, a[1] + dz * t], [0, -ang, 0]);
    }
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// A soft painted material shared by every vertex-coloured model.
export const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
export const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#ffb45e', emissiveIntensity: 1.6 });

export function mesh(geo, mat = paintMat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m;
}

// Small deterministic noise used across the world builders.
export function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 4) { let a = 0, amp = 0.5, f = 1; for (let i = 0; i < oct; i++) { a += amp * vnoise(x * f, z * f); f *= 2.03; amp *= 0.5; } return a; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
