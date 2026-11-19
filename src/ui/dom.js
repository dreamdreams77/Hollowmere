// Tiny DOM helpers and cached image URLs for the interface.
import { shield, resourceGlyph, seal, laurel, flameGlyph, cardArt, heirPortrait, toURL } from '../content/art.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const urlCache = new Map();
const cached = (k, f) => { if (!urlCache.has(k)) urlCache.set(k, toURL(f())); return urlCache.get(k); };
export const img = {
  shield: (name, s = 128) => cached(`sh:${name}:${s}`, () => shield(name, s)),
  res: (r) => cached(`res:${r}`, () => resourceGlyph(r, 96)),
  favor: () => cached('favor', () => seal(80)),
  renown: () => cached('renown', () => laurel(80)),
  flame: (lit) => cached(`fl:${lit}`, () => flameGlyph(48, lit)),
  heir: (house, status) => cached(`heir:${house}:${status}`, () => heirPortrait(house, status)),
  art: (kind, key, obj) => cached(`art:${kind}:${key}`, () => cardArt(kind, obj)),
};
export const icon = (src, cls = 'icon', alt = '') => h('img', { src, class: cls, alt, draggable: 'false' });
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
