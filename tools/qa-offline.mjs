// QA: the installed game loads with no network (service worker cache) and the manifest is valid.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8080/?sw=1&q=low&fps=2&scale=0.35');
await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 60000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return { keys, cached: (await c.keys()).length, manifest: await (await fetch('manifest.webmanifest')).json().then((m) => m.name) }; });
console.log('online', JSON.stringify(info));
await ctx.setOffline(true);
await page.reload();
const ok = await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 }).then(() => true).catch(() => false);
const title = await page.evaluate(() => document.querySelector('#title h1, #title .title-card')?.textContent?.slice(0, 40));
console.log('offline reload READY', ok, 'title', title);
await page.screenshot({ path: 'qa/out/offline.png', timeout: 120000 });
console.log('errors', errors);
await browser.close();
