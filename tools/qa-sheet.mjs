// QA: the phone bottom sheet. Targeting a Plot drops it to peek; Cancel restores it; the handle drags it.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const dir = 'qa/out/sheet'; fs.mkdirSync(dir, { recursive: true });
const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8080/?q=low&fps=2&scale=0.35');
await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
await page.evaluate(() => { const a = window.hollowmere.app; a.settings.speed = 'instant'; a.newGame({ house: 'Ash', players: 3, rivals: 'random', rules: 'expanded' }); });
for (let k = 0; k < 90; k++) { const ok = await page.evaluate(() => { const a = window.hollowmere.app; const r = a.state.phase === 'actions' && a.state.turn === a.me && !a.busy && !document.getElementById('modal') && !document.getElementById('banner'); if (!r) document.querySelector('#modal .btn.primary')?.click(); return r; }); if (ok) break; await page.waitForTimeout(1000); }
const H = () => page.evaluate(() => { const s = document.getElementById('sheet'); return { snap: s.dataset.snap, h: Math.round(s.getBoundingClientRect().height), sheetVar: getComputedStyle(document.documentElement).getPropertyValue('--sheet-h') }; });
console.log('start', JSON.stringify(await H()));
await page.evaluate(() => [...document.querySelectorAll('.act')].find((b) => b.textContent.startsWith('Build')).click());
await page.waitForTimeout(900);
console.log('targeting', JSON.stringify(await H()), await page.evaluate(() => document.querySelector('.act-hint')?.textContent));
await page.screenshot({ path: `${dir}/01-targeting.jpg`, type: 'jpeg', quality: 80, timeout: 150000 });
await page.evaluate(() => [...document.querySelectorAll('.act-hint button')].find((b) => b.textContent === 'Cancel').click());
await page.waitForTimeout(900);
console.log('cancelled', JSON.stringify(await H()));
// drag the handle up to full, then down to peek
const g = await page.evaluate(() => { const r = document.querySelector('.grab-zone').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
const drag = async (dy) => {
  await page.evaluate(({ x, y, dy }) => {
    const el = document.querySelector('.grab-zone'); const o = { pointerId: 7, bubbles: true, clientX: x, isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientY: y })); el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: y + dy / 2 }));
    el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: y + dy })); el.dispatchEvent(new PointerEvent('pointerup', { ...o, clientY: y + dy }));
  }, { ...g, dy });
  await page.waitForTimeout(900);
};
await drag(-380); console.log('dragged up', JSON.stringify(await H()));
await page.screenshot({ path: `${dir}/02-full.jpg`, type: 'jpeg', quality: 80, timeout: 150000 });
const g2 = await page.evaluate(() => { const r = document.querySelector('.grab-zone').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
Object.assign(g, g2); await drag(560); console.log('dragged down', JSON.stringify(await H()));
await page.screenshot({ path: `${dir}/03-peek.jpg`, type: 'jpeg', quality: 80, timeout: 150000 });
console.log('errors', errors); await browser.close();
