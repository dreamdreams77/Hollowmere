// QA: Event choice and Betrothal screens on a phone-sized page (Expanded rules X7, X8).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const dir = 'qa/out/x78'; fs.mkdirSync(dir, { recursive: true });
const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:8080/?q=low&fps=2&scale=0.35');
await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
const shot = (n) => page.screenshot({ path: `${dir}/${n}.png`, timeout: 120000 });
await page.evaluate(() => { const a = window.hollowmere.app; a.settings.speed = 'instant'; a.newGame({ house: 'Wren', players: 3, rivals: 'random', rules: 'expanded', difficulty: 'normal' }); });
for (let k = 0; k < 120; k++) {
  const st = await page.evaluate(() => { const a = window.hollowmere.app; const m = document.querySelector('#modal .btn.primary, #modal .btn'); const ready = a.state.phase === 'actions' && a.state.turn === a.me && !a.busy && !document.getElementById('modal'); if (!ready && m && !a.state.pending) m.click(); return { ready, phase: a.state.phase, turn: a.state.turn, me: a.me, busy: a.busy, modal: document.querySelector('#modal h2')?.textContent, pending: a.state.pending?.type }; });
  if (st.ready) break; if (k % 10 === 0) console.log(JSON.stringify(st));
  if (st.pending) await page.evaluate(() => { const a = window.hollowmere.app; document.querySelector('#modal .btn.primary, #modal .btn')?.click(); });
  await page.waitForTimeout(1000);
}
// 1. the Actions sheet with the new Betroth button
await shot('01-actions');
// 2. an Event choice put to the player
const r1 = await page.evaluate(async () => {
  const E = await import('/src/rules/engine.js'); const a = window.hollowmere.app; const s = a.state;
  s.houses[a.me].coffer.C = 1;
  s.pending = { type: 'dilemma', h: a.me, id: 'captain', options: E.dilemmaOptions(s, a.me, 'captain') }; s.phase = 'event';
  a.refresh(); a.showDilemma();
  return [...document.querySelectorAll('#modal .btn.choice')].map((b) => b.textContent);
});
console.log('dilemma buttons', r1);
await shot('02-dilemma');
const r2 = await page.evaluate(async () => {
  const a = window.hollowmere.app; const s = a.state; const L = s.houses[a.me].stats; void L;
  [...document.querySelectorAll('#modal .btn.choice')][1].click();
  await new Promise((r) => setTimeout(r, 3000));
  return { pending: s.pending, phase: s.phase, last: s.log.filter((l) => l.kind === 'event').slice(-1)[0]?.text };
});
console.log('after choice', JSON.stringify(r2));
// 3. an incoming marriage offer
await page.waitForFunction(() => { const a = window.hollowmere.app; return !a.busy && !document.getElementById('modal'); }, null, { timeout: 120000 }).catch(() => {});
const r3 = await page.evaluate(() => {
  const a = window.hollowmere.app; const s = a.state; const o = s.houses.find((x) => x.i !== a.me);
  s.houses[a.me].pacts.push({ with: o.i, until: s.season + 1 }); o.pacts.push({ with: a.me, until: s.season + 1 }); o.coffer.C += 3;
  s.pending = { type: 'betroth', h: a.me, from: o.i }; a.refresh(); a.showBetroth();
  return document.querySelector('#modal h2')?.textContent;
});
console.log('betroth modal', r3);
await shot('03-betroth');
const r4 = await page.evaluate(async () => {
  const a = window.hollowmere.app; const s = a.state;
  [...document.querySelectorAll('#modal .btn')].find((b) => b.textContent === 'Accept the match').click();
  await new Promise((r) => setTimeout(r, 3000));
  const me = s.houses[a.me]; return { betrothed: me.betrothed, pact: me.pacts.map((p) => p.until), know: a.view.houses[me.betrothed]?.heir.status };
});
console.log('after accept', JSON.stringify(r4));
await page.evaluate(() => { const a = window.hollowmere.app; a.tab = 'house'; a.refresh(); [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'House')?.click(); });
await page.waitForTimeout(800); await shot('04-house');
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Rivals')?.click());
await page.waitForTimeout(800); await shot('05-rivals');
console.log('errors', errors);
await browser.close();
