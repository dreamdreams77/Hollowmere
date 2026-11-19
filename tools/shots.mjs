// Browser QA: open the game in headless Chrome, record console errors and failed requests, and
// take screenshots. Usage: node tools/shots.mjs <url-path> <out.png> [WxH] [waitMs] [script.js]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const [, , path = '/', out = 'qa/out/shot.png', size = '1440x900', wait = '6000', mobile = ''] = process.argv;
const [W, H] = size.split('x').map(Number);
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
await page.goto(`http://localhost:8080${path}`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 }).catch(() => errors.push('READY timeout'));
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(JSON.stringify({ out, errors: errors.slice(0, 30) }, null, 1));
await browser.close();
