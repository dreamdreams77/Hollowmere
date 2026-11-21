// QA: pass-and-play (two people, one phone) and a Scenario start, driven through the real interface.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const dir = 'qa/out/hotseat'; fs.mkdirSync(dir, { recursive: true });
const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
await page.goto('http://localhost:8080/?q=low&fps=2&scale=0.35');
await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
await page.evaluate(() => { const a = window.hollowmere.app; a.settings.speed = 'instant'; a.saveSettings(); });
const click = (sel) => page.evaluate((s) => { const el = [...document.querySelectorAll(s.css)].find((e) => !s.text || e.textContent.trim() === s.text); if (!el) throw new Error(`missing ${s.css} ${s.text}`); el.click(); }, sel);

// Set up: Wren and Ash both played here, plus one rival.
await click({ css: '.house-pick[data-h="Wren"]' });
await click({ css: '.seg button', text: 'Three' });
await click({ css: '.seg button', text: '2' });
await click({ css: '.house-pick[data-h="Ash"]' });
await page.screenshot({ path: `${dir}/01-setup.png` });
const sel = await page.evaluate(() => [...document.querySelectorAll('.house-pick.ally')].map((x) => x.dataset.h));
log('allies', sel);
await click({ css: 'button', text: 'Begin the first Season' });

let handovers = 0, moves = 0; const seenMe = new Set();
for (let g = 0; g < 600 && moves < 14; g++) {
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => { const a = window.hollowmere.app, s = a.state; return { phase: s.phase, season: s.season, turn: s.turn, me: a.me, human: s.houses[s.turn]?.human, hotseat: s.hotseat, ho: !!document.getElementById('handover'), hoText: document.querySelector('#handover h2')?.textContent, busy: a.busy, modal: !!document.getElementById('modal') }; });
  if (st.ho) {
    handovers++; log('handover', st.hoText);
    if (handovers <= 2) await page.screenshot({ path: `${dir}/0${handovers + 1}-handover.png` });
    await click({ css: '#handover button' }); continue;
  }
  if (st.modal) { await page.evaluate(() => { const b = document.querySelector('#modal .btn.primary') || document.querySelector('#modal .btn'); b?.click(); }); continue; }
  if (st.phase === 'actions' && st.human && !st.busy && st.turn === st.me) {
    seenMe.add(st.me);
    await page.evaluate(async () => { const { rankActions } = await import('/src/ai/ai.js'); const a = window.hollowmere.app; const top = rankActions(a.state, a.me, { noise: 0.3 }); await a.act(top[0].a); });
    moves++;
  }
}
await page.screenshot({ path: `${dir}/04-after.png` });
log('handovers', handovers, 'moves', moves, 'humans seen as me', [...seenMe]);

// Scenario start from the title screen.
await page.evaluate(() => window.hollowmere.app.showTitle());
await page.waitForTimeout(500);
await click({ css: 'button', text: 'Scenarios' });
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/05-scenarios.png` });
await click({ css: '.scen button' });
await page.waitForTimeout(3000);
const obj = await page.evaluate(() => ({ scen: window.hollowmere.app.state.scenario, text: document.querySelector('.objective')?.textContent }));
log('scenario', JSON.stringify(obj));
await page.screenshot({ path: `${dir}/06-scenario-game.png` });
log('errors', errors.length, errors.slice(0, 5));
await browser.close();
