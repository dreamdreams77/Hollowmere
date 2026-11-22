// Build a hostable copy of the committed game into dist/web/ (for a shareable link).
//   node tools/build-web.mjs [git-ref=HEAD]
// The repository runs on its vendored three.js r170; the hosted copy loads the identical
// three@0.170.0 build from jsDelivr (hosts often allow only listed CDNs), takes IM Fell English
// from Google Fonts, and embeds the walnut textures and icon as data URIs.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ref = process.argv[2] || 'HEAD';
const src = '/tmp/hm-build-src', out = path.join(root, 'dist/web');
fs.rmSync(src, { recursive: true, force: true }); fs.mkdirSync(src, { recursive: true });
execSync(`git -C "${root}" archive ${ref} | tar -x -C ${src}`);
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });

const copyDir = (from, to) => {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyDir(a, b); } else fs.copyFileSync(a, b);
  }
};
fs.mkdirSync(path.join(out, 'src'), { recursive: true }); copyDir(path.join(src, 'src'), path.join(out, 'src'));
fs.mkdirSync(path.join(out, 'styles'), { recursive: true });
for (const f of fs.readdirSync(path.join(src, 'styles'))) {
  let css = fs.readFileSync(path.join(src, 'styles', f), 'utf8');
  css = css.replace(/@font-face\s*{[^}]*}\s*/g, '');                     // fonts come from Google Fonts here
  fs.writeFileSync(path.join(out, 'styles', f), css);
}
const dataURI = (p, type) => `data:${type};base64,${fs.readFileSync(path.join(src, p)).toString('base64')}`;
// textures inlined into the world module
const worldPath = path.join(out, 'src/render/world.js');
let world = fs.readFileSync(worldPath, 'utf8');
for (const n of ['diff', 'nor', 'rough']) world = world.replace(`'assets/textures/walnut_${n}.jpg'`, `'${dataURI(`assets/textures/walnut_${n}.jpg`, 'image/jpeg')}'`);
fs.writeFileSync(worldPath, world);
// page
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace(/"three": "[^"]+"/, '"three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"')
  .replace(/"three\/addons\/": "[^"]+"/, '"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"')
  .replace('<link rel="icon" href="assets/icon.svg" type="image/svg+xml">', `<link rel="icon" href="${dataURI('assets/icon.svg', 'image/svg+xml')}" type="image/svg+xml">`)
  .replace('<link rel="stylesheet" href="styles/main.css">', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=block">\n<link rel="stylesheet" href="styles/main.css">');
// The artifact host is a single page without its own app scope: drop the install links there
// (the GitHub Pages copy, served from the repository as it is, keeps them and works offline).
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '').replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '');
fs.writeFileSync(path.join(out, 'index.html'), html);
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(out, p)); } };
walk(out);
const bytes = files.reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0);
console.log(JSON.stringify({ ref, out, files: files.length, kb: Math.round(bytes / 1024) }));
fs.writeFileSync(path.join(out, '.files.json'), JSON.stringify(files));
