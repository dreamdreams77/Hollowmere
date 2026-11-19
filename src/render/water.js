// Water: one surface for the Sellen, the Varra, the marsh pools and the sea. Colour comes from
// depth (read from the terrain heightmap), with shore foam, flowing ripples and sky reflection.
// uFlood raises the water during a Flood presentation.
import * as THREE from 'three';
import { WORLD, WATER_Y } from './layout.js';
import { WORLD_UNIFORMS } from './terrain.js';

export function buildWater(heightTex) {
  const W = WORLD.x1 - WORLD.x0, D = WORLD.z1 - WORLD.z0;
  const geo = new THREE.PlaneGeometry(W, D, 1, 1); geo.rotateX(-Math.PI / 2);
  geo.translate((WORLD.x0 + WORLD.x1) / 2, 0, (WORLD.z0 + WORLD.z1) / 2);
  const uniforms = { uHeight: { value: heightTex }, uBounds: { value: new THREE.Vector4(WORLD.x0, WORLD.z0, W, D) }, uLevel: { value: WATER_Y }, uFlood: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: '#2f6f8f', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.92, depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, { uTime: WORLD_UNIFORMS.uTime, uWet: WORLD_UNIFORMS.uWet });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uLevel, uFlood;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = uLevel + uFlood;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; uniform sampler2D uHeight; uniform vec4 uBounds; uniform float uTime, uLevel, uFlood, uWet;
        float wHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float wNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
          return mix(mix(wHash(i), wHash(i+vec2(1,0)), u.x), mix(wHash(i+vec2(0,1)), wHash(i+vec2(1,1)), u.x), u.y); }
        float waves(vec2 p){ return wNoise(p * 1.6 + vec2(uTime * .35, uTime * .9)) * .6 + wNoise(p * 4.1 - vec2(uTime * .6, -uTime * .4)) * .4; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 huv = (vWP.xz - uBounds.xy) / uBounds.zw;
        float ground = texture2D(uHeight, huv).r;
        float depth = (uLevel + uFlood) - ground;
        if (depth < -0.02) discard;
        vec3 shallow = vec3(.36, .62, .6), deep = vec3(.09, .27, .42), sea = vec3(.06, .2, .36);
        vec3 wc = mix(shallow, deep, smoothstep(.0, .9, depth));
        wc = mix(wc, sea, smoothstep(26., 34., vWP.z));
        float foam = smoothstep(.16, .0, depth) * (.55 + .45 * wNoise(vWP.xz * 6. + uTime));
        foam += smoothstep(.75, .95, waves(vWP.xz * .5)) * .25 * smoothstep(20., 30., vWP.z);
        wc = mix(wc, vec3(.93, .95, .92), clamp(foam, 0., 1.));
        diffuseColor.rgb = wc;
        diffuseColor.a = mix(.55, .95, smoothstep(0., .5, depth));`)
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
