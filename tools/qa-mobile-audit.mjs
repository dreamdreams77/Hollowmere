// QA: photograph every main screen at phone sizes, and measure tap targets and text sizes.
// Usage: node tools/qa-mobile-audit.mjs [outDir] [WxH,WxH,...]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const OUT = process.argv[2] || 'qa/out/mobile-audit';
const SIZES = (process.argv[3] || '360x780,412x915,800x360').split(',').map((s) => s.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });
const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// Tap targets under 44 px and text under 12 px that are visible on screen.
const measure = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const small = [...document.querySelectorAll('button, [role=button], a, .act, input, select')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) < 40; })
    .map((el) => `${(el.textContent || el.getAttribute('aria-label') || el.className).trim().slice(0, 24)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
  const tiny = new Set();
  for (const el of document.querySelectorAll('body *')) { if (!vis(el) || !el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 12) tiny.add(`${el.tagName.toLowerCase()}.${el.className}`.slice(0, 40) + ` ${fs}px`); }
  const over = document.documentElement.scrollWidth > innerWidth + 1;
  return { small: small.slice(0, 30), nSmall: small.length, tiny: [...tiny].slice(0, 20), horizontalOverflow: over };
};

for (const [W, H] of SIZES) {
  const tag = `${W}x${H}`;
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8080/?q=low&fps=2&scale=0.35');
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  const snap = async (name) => { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${tag}-${name}.jpg`, type: 'jpeg', quality: 80, timeout: 150000 }); const m = await page.evaluate(measure); fs.writeFileSync(`${OUT}/${tag}-${name}.json`, JSON.stringify(m, null, 1)); console.log(tag, name, `small:${m.nSmall}`, m.horizontalOverflow ? 'OVERFLOW' : '', m.tiny.slice(0, 4).join(' | ')); };
  await snap('01-title');
  await page.evaluate(() => { const a = window.hollowmere.app; a.settings.speed = 'instant'; a.newGame({ house: 'Wren', players: 4, rivals: 'random', rules: 'expanded', difficulty: 'normal' }); });
  for (let k = 0; k < 90; k++) {
    const st = await page.evaluate(() => { const a = window.hollowmere.app; const ok = a.state.phase === 'actions' && a.state.turn === a.me && !a.busy && !document.getElementById('modal'); return { ok, pending: a.state.pending?.type, modal: !!document.getElementById('modal') }; });
    if (st.ok) break;
    if (k === 2 && st.pending === 'accords') await snap('02-accords');
    if (st.pending === 'accords') await page.evaluate(async () => { const E = await import('/src/rules/engine.js'); const a = window.hollowmere.app; a.closeModal(); E.decide(a.state, { accords: [] }); a.loop(); });
    else if (st.modal) await page.evaluate(() => document.querySelector('#modal .btn.primary, #modal .btn')?.click());
    await page.waitForTimeout(1000);
  }
  await snap('03-board');
  // open the sheet tabs
  for (const tab of ['Actions', 'House', 'Rivals', 'Chronicle']) {
    const ok = await page.evaluate((t) => { const b = [...document.querySelectorAll('#tabs button, button')].find((x) => (x.querySelector('.tl')?.textContent || x.textContent).trim() === t); b?.click(); return !!b; }, tab);
    if (ok) await snap(`04-${tab.toLowerCase()}`);
  }
  // a Plot panel
  await page.evaluate(() => { const a = window.hollowmere.app; const pid = a.state.plots.find((p) => p.m[a.me])?.id || 1; a.showPlot(pid); });
  await snap('05-plot');
  await page.evaluate(() => window.hollowmere.app.closePlot?.());
  // a chooser and a menu
  await page.evaluate(() => { const b = [...document.querySelectorAll('.act')].find((x) => /Build|Muster/.test(x.textContent) && !x.classList.contains('off')); b?.click(); });
  await snap('06-chooser');
  await page.evaluate(() => window.hollowmere.app.closeModal?.());
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /menu/i.test(x.getAttribute('aria-label') || x.textContent)); b?.click(); });
  await snap('07-menu');
  console.log(tag, 'errors', errors);
  await page.context().close();
}
await browser.close();
