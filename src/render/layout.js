// World layout: where every Plot, river, road and settlement slot sits in 3D.
// The board is 4 columns x 5 rows of 10-unit Plots; Reach I is north (negative z), the Delta
// Mouth and the sea are south (positive z).
import { PLOTS, ADJ } from '../rules/data.js';
import { fbm, vnoise } from './kit.js';

export const S = 10;
export const BOARD = { x0: -2 * S, x1: 2 * S, z0: -2.5 * S, z1: 2.5 * S };
export const WORLD = { x0: -44, x1: 44, z0: -50, z1: 44 };
export const WATER_Y = -0.18;

export const plotCentre = (id) => { const p = PLOTS[id - 1]; return [(p.col - 1.5) * S, (p.row - 2) * S]; };
export function plotAt(x, z) {
  if (x < BOARD.x0 || x >= BOARD.x1 || z < BOARD.z0 || z >= BOARD.z1) return null;
  const col = Math.floor((x - BOARD.x0) / S), row = Math.floor((z - BOARD.z0) / S);
  return row * 4 + col + 1;
}

// Rivers along Plot borders (see data.js RIVERS). Sellen: from the mountains down x=-10 to the
// III/IV border (z=5), east to x=0, south to the sea. Varra: from the east along z=5 to x=0.
const wig = (x, z, k) => (vnoise(x * 0.35 + k, z * 0.35 - k) - 0.5) * 0.9;
function riverPath(points, k) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.8);
    for (let j = 0; j < n; j++) {
      const t = j / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const horiz = Math.abs(bz - az) < 1e-6;
      out.push(horiz ? [x, z + wig(x, z, k)] : [x + wig(x, z, k), z]);
    }
  }
  out.push(points.at(-1));
  return out;
}
export const RIVER = {
  sellen: riverPath([[-S, -50], [-S, 0.5 * S], [0, 0.5 * S], [0, 2.5 * S], [0, 44]], 1.3),
  varra: riverPath([[44, 0.5 * S], [0, 0.5 * S]], 7.1),
};
export const RIVER_W = { sellen: 1.55, varra: 1.3 };

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const L = dx * dx + dz * dz;
  let t = L ? ((px - ax) * dx + (pz - az) * dz) / L : 0; t = Math.max(0, Math.min(1, t));
  const x = ax + dx * t, z = az + dz * t; return Math.hypot(px - x, pz - z);
}
export function riverDist(x, z) {
  let best = 1e9, w = 1;
  for (const [name, pts] of Object.entries(RIVER)) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      if (x < Math.min(ax, bx) - 3 || x > Math.max(ax, bx) + 3 || z < Math.min(az, bz) - 3 || z > Math.max(az, bz) + 3) continue;
      const d = segDist(x, z, ax, az, bx, bz);
      if (d < best) { best = d; w = RIVER_W[name]; }
    }
  }
  // widen toward the delta
  const delta = z > 15 ? 1 + (z - 15) / 18 : 1;
  return best / (w * delta);
}

// Settlement slots inside a Plot, one per seat index, and the landmark/dice-token spots.
export const SLOT = [[-2.55, -0.4], [2.55, -0.4], [-2.55, 2.55], [2.55, 2.55]];
export const LANDMARK = [0, -2.7];
export const TOKEN = [0, 3.85];

// Roads between every pair of adjacent Plot centres (drawn as worn earth; bridges where they cross water).
export const ROADS = [];
for (const p of PLOTS) for (const q of ADJ[p.id - 1]) if (q > p.id) ROADS.push([plotCentre(p.id), plotCentre(q)]);
export function roadDist(x, z) {
  let best = 1e9;
  for (const [[ax, az], [bx, bz]] of ROADS) {
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (Math.abs(x - mx) > 7 || Math.abs(z - mz) > 7) continue;
    // gentle curve: offset the midpoint
    const off = (vnoise(mx * 0.3, mz * 0.3) - 0.5) * 2.2;
    const nx = -(bz - az), nz = bx - ax, L = Math.hypot(nx, nz) || 1;
    const cx = mx + nx / L * off, cz = mz + nz / L * off;
    best = Math.min(best, segDist(x, z, ax, az, cx, cz), segDist(x, z, cx, cz, bx, bz));
  }
  return best;
}
// Where each road crosses a river: a bridge site (midpoint of the river-crossing segment).
export function bridgeSites() {
  const out = [];
  for (const [[ax, az], [bx, bz]] of ROADS) {
    const n = 60; let prev = riverDist(ax, az) < 1;
    for (let i = 1; i <= n; i++) {
      const t = i / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t; const wet = riverDist(x, z) < 1;
      if (wet && !prev) {
        let k = i; while (k < n && riverDist(ax + (bx - ax) * k / n, az + (bz - az) * k / n) < 1) k++;
        const tm = (i + k) / 2 / n;
        out.push({ x: ax + (bx - ax) * tm, z: az + (bz - az) * tm, ang: Math.atan2(bz - az, bx - ax), len: (k - i) / n * Math.hypot(bx - ax, bz - az) + 1.4 });
        break;
      }
      prev = wet;
    }
  }
  return out;
}

export { fbm };
