// Water: one surface for the Sellen, the Varra, the marsh pools and the sea. Colour comes from
// depth (read from the terrain heightmap), with shore foam, flowing ripples and sky reflection.
// uFlood raises the water during a Flood presentation: everything swells a little, and the
// low ground near the Sellen, the Varra and the Delta goes under (a baked spill mask), keeping
// the settlement pads dry so House pieces stay visible.
import * as THREE from 'three';
import { PLOTS } from '../rules/data.js';
import { WORLD, BOARD, WATER_Y, riverDist, plotAt, plotCentre, SLOT, LANDMARK, TOKEN } from './layout.js';
import { WORLD_UNIFORMS } from './terrain.js';

const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Water level at (x, z) for a flood amount f (same formula as the shader): base swell plus spill.
export const FLOOD_SPILL = 1.05, FLOOD_BASE = 0.4;
// R: how far the spill reaches (1 next to a river / the Delta, 0 far away or on a pad);
// G: fade toward the slab edge so the raised sheet never shows over the carved skirt.
function spillTexture(res) {
  const data = new Uint8Array(res * res * 4);
  const pads = PLOTS.map((p) => { const [cx, cz] = plotCentre(p.id); return [...SLOT, LANDMARK, TOKEN].map(([sx, sz]) => [cx + sx, cz + sz]); }).flat();
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = WORLD.x0 + (i + 0.5) / res * (WORLD.x1 - WORLD.x0), z = WORLD.z0 + (j + 0.5) / res * (WORLD.z1 - WORLD.z0);
    // cheap pre-test against the straightened river courses (layout.RIVER) before the exact distance
    const near = Math.min(z < 5 + 6 ? Math.abs(x + 10) : 99, Math.abs(z - 5) < 6 && x > -16 ? 0 : 99, z > -1 ? Math.abs(x) : 99);
    let m = near < 7.5 ? sst(3.4, 1.3, riverDist(x, z)) : 0;
    m = Math.max(m, sst(BOARD.z1 - 6, BOARD.z1 - 1, z) * sst(14, 4, Math.abs(x)));           // the Delta Mouth
    m = Math.max(m, sst(BOARD.z1 - 2, BOARD.z1 + 2, z));                                       // the coast
    if (plotAt(x, z)) { let pd = 9; for (const [px, pz] of pads) pd = Math.min(pd, Math.hypot(x - px, z - pz)); m *= sst(1.5, 2.3, pd); }
    const edge = Math.min(x - WORLD.x0, WORLD.x1 - x, z - WORLD.z0, WORLD.z1 - z);
    const k = (j * res + i) * 4; data[k] = Math.round(m * 255); data[k + 1] = Math.round(sst(0.5, 6, edge) * 255); data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, res, res, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export function buildWater(heightTex, quality = 'high') {
  const W = WORLD.x1 - WORLD.x0, D = WORLD.z1 - WORLD.z0;
  const seg = quality === 'low' ? 56 : 96;
  const geo = new THREE.PlaneGeometry(W, D, seg, seg); geo.rotateX(-Math.PI / 2);
  geo.translate((WORLD.x0 + WORLD.x1) / 2, 0, (WORLD.z0 + WORLD.z1) / 2);
  const uniforms = { uHeight: { value: heightTex }, uSpill: { value: spillTexture(quality === 'low' ? 112 : 176) }, uBounds: { value: new THREE.Vector4(WORLD.x0, WORLD.z0, W, D) }, uLevel: { value: WATER_Y }, uFlood: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: '#2f6f8f', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.92, depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, { uTime: WORLD_UNIFORMS.uTime, uWet: WORLD_UNIFORMS.uWet });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vSpill; uniform float uLevel, uFlood; uniform sampler2D uSpill; uniform vec4 uBounds;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 sp = texture2D(uSpill, ((modelMatrix * vec4(position, 1.)).xz - uBounds.xy) / uBounds.zw).rg;
        vSpill = sp.r;
        transformed.y = uLevel + uFlood * sp.g * (${FLOOD_BASE.toFixed(2)} + ${FLOOD_SPILL.toFixed(2)} * sp.r);`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying float vSpill; uniform sampler2D uHeight; uniform vec4 uBounds; uniform float uTime, uLevel, uFlood, uWet;
        float wHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float wNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
          return mix(mix(wHash(i), wHash(i+vec2(1,0)), u.x), mix(wHash(i+vec2(0,1)), wHash(i+vec2(1,1)), u.x), u.y); }
        float waves(vec2 p){ return wNoise(p * 1.6 + vec2(uTime * .35, uTime * .9)) * .6 + wNoise(p * 4.1 - vec2(uTime * .6, -uTime * .4)) * .4; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 huv = (vWP.xz - uBounds.xy) / uBounds.zw;
        float ground = texture2D(uHeight, huv).r;
        float depth = vWP.y - ground;
        if (depth < -0.02) discard;
        float fl = clamp(uFlood * 1.8, 0., 1.);
        vec3 shallow = vec3(.36, .62, .6), deep = vec3(.09, .27, .42), sea = vec3(.06, .2, .36);
        vec3 wc = mix(shallow, deep, smoothstep(.0, .9, depth));
        wc = mix(wc, sea, smoothstep(26., 34., vWP.z));
        float foam = smoothstep(.16, .0, depth) * (.55 + .45 * wNoise(vWP.xz * 6. + uTime));
        foam += smoothstep(.75, .95, waves(vWP.xz * .5)) * .25 * smoothstep(20., 30., vWP.z);
        // flood: silt-brown spill water with foam drifting downstream
        wc = mix(wc, vec3(.15, .13, .075), fl * (.35 + .4 * vSpill));
        vec2 drift = vWP.xz * vec2(1.3, .8) - vec2(uTime * .25, uTime * 1.1);
        foam += fl * (.25 + .75 * vSpill) * smoothstep(.68, .9, wNoise(drift) * .65 + wNoise(drift * 2.7 + 3.) * .35) * .6;
        foam *= 1. - fl * .45 * smoothstep(.05, .2, depth);
        wc = mix(wc, vec3(.93, .95, .92), clamp(foam, 0., 1.));
        diffuseColor.rgb = wc;
        diffuseColor.a = mix(.55, .95, smoothstep(0., .5, depth));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, .55, clamp(uFlood * 1.8, 0., 1.) * .8);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float e = .15; vec2 p = vWP.xz * .9;
          float h0 = waves(p), hx = waves(p + vec2(e, 0.)), hz = waves(p + vec2(0., e));
          vec3 bump = normalize(vec3((h0 - hx) * 1.4, 1., (h0 - hz) * 1.4));
          normal = normalize((viewMatrix * vec4(bump, 0.)).xyz);
        }`);
  };
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.renderOrder = 2; mesh.name = 'water';
  return { mesh, uniforms };
}
