// Full-game browser playthrough driven through the real interface: title screen clicks, action
// buttons, taps on Plots in the 3D view, choosers, the trade dialog, card hands, Event and Flood
// presentations. The human House's choices come from the AI's ranking (so the game is played
// sensibly), but every move is entered with mouse clicks or touch taps like a player would.
// Usage: node tools/play.mjs <House> <players> <WxH> [mobile] [shotsDir]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/npm-tools/node_modules/playwright'); }
const [, , house = 'Verrin', players = '4', size = '1440x900', mobileArg = '', dir = 'qa/out/play'] = process.argv;
const mobile = mobileArg === 'mobile';
const [W, H] = size.split('x').map(Number);
fs.mkdirSync(dir, { recursive: true });
const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = []; const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /watchdog/.test(m.text()))) { errors.push(m.text()); log('CONSOLE', m.type(), m.text().slice(0, 300)); } });
page.on('pageerror', (e) => { errors.push(`pageerror: ${e.message}`); log('PAGEERROR', e.message, e.stack?.slice(0, 400)); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });
await page.goto('http://localhost:8080/?q=low&fps=2&scale=0.35');
await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
const tap = async (sel) => { const el = page.locator(sel).first(); await el.waitFor({ timeout: 20000 }); if (mobile) await el.tap({ force: true }); else await el.click({ force: true }); };
// settings: fast rivals
await page.evaluate(() => { const a = window.hollowmere.app; a.settings.speed = 'instant'; a.saveSettings(); });
await page.screenshot({ path: `${dir}/00-title.png` });
await tap(`.house-pick[data-h="${house}"]`);
await tap(`.seg button:has-text("${{ 2: 'Two', 3: 'Three', 4: 'Four' }[players]}")`);
await tap('button:has-text("Begin the first Season")');
let shots = 0, humanActions = 0, lastSeason = 0; const used = {};
const t0 = Date.now();
let stuck = 0;
for (let guard = 0; guard < 4000; guard++) {
  await page.waitForTimeout(250);
  const st = await page.evaluate(() => { const a = window.hollowmere.app, s = a.state; return { phase: s.phase, season: s.season, turn: s.turn, me: a.me, human: s.houses[s.turn]?.human, pending: !!s.pending, busy: a.busy, looping: a.looping, modal: !!document.getElementById('modal'), modalText: document.querySelector('#modal h2')?.textContent || '', mode: a.mode?.type || a.mode?.kind || null }; });
  if (guard % 40 === 0) log('state', JSON.stringify(st));
  if (st.season !== lastSeason) { lastSeason = st.season; log(`Season ${st.season}`); if ([1, 3, 6, 9, 12].includes(st.season)) await page.screenshot({ path: `${dir}/${String(++shots).padStart(2, '0')}-season${st.season}.png` }); }
  if (st.phase === 'over') {
    await page.waitForSelector('#modal', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/99-results.png` });
    break;
  }
  if (st.modal) {
    if (/Flood/.test(st.modalText) && Math.random() < 0.6) await page.screenshot({ path: `${dir}/${String(++shots).padStart(2, '0')}-flood${st.season}.png` });
    if (/Open Court/.test(st.modalText)) { await tap('#modal .btn.primary'); continue; }
    const primary = await page.locator('#modal .btn.primary').count();
    if (primary && !/^(Your|The Bank|Seal|Raid|Recapture|Build|Keep|Muster|Cabal)/.test(st.modalText) && !st.modalText.includes(':')) { await tap('#modal .btn.primary'); continue; }
  }
  if (!st.human || st.busy || st.looping || st.pending || st.phase !== 'actions') continue;
  if (st.mode) { stuck++; if (stuck > 4) { errors.push(`stuck in mode ${st.mode} at Season ${st.season}`); await page.keyboard.press('Escape'); stuck = 0; } } else stuck = 0;
  // Human turn: ask the AI what to do, then do it through the interface.
  const plan = await page.evaluate(async () => {
    const { rankActions } = await import('/src/ai/ai.js');
    const a = window.hollowmere.app; const top = rankActions(a.state, a.me, { noise: 0.4 });
    // explore: occasionally use a different legal action type
    const pick = top[Math.random() < 0.15 && top.length > 3 ? 1 + Math.floor(Math.random() * 2) : 0].a;
    return pick;
  });
  used[plan.type] = (used[plan.type] || 0) + 1; log(`S${st.season} you: ${JSON.stringify(plan)}`);
  humanActions++;
  const label = { build: 'Build', keep: 'Keep', muster: 'Muster', raid: 'Raid', recapture: 'Recapture', trade: 'Trade', favor: 'Claim Favor', investigate: 'Investigate', play: 'Play Card', seal: 'Seal', reveal: 'Reveal Heir', rite: 'Rite', dynasty: 'Dynasty', cabal: 'Cabal', vigil: 'Vigil', pass: 'Pass' }[plan.type];
  if (mobile) { const tabBtn = page.locator('#tabs button:has-text("Actions")'); if (await tabBtn.count()) await tabBtn.tap(); }
  await tap(`.act:has-text("${label}")`);
  await page.waitForTimeout(200);
  const plotOf = plan.plot ?? plan.to ?? (plan.targets && plan.targets[0] && plan.targets[0].plot);
  const clickPlot = async (pid) => {
    // If the Plot is hidden behind a panel, drag the board like a player would.
    for (let k = 0; k < 6; k++) {
      await page.waitForTimeout(700);
      const info = await page.evaluate((p) => { const w = window.hollowmere.world; const s = w.plotScreen(p); return { ...s, covered: w.plotCovered(p) }; }, pid);
      if (!info.covered) break;
      const cx = W / 2, cy = H / 2, dx = (cx - info.x) * 0.6, dy = (cy - info.y) * 0.6;
      if (mobile) { await page.evaluate(([p]) => window.hollowmere.world.focusPlot(p, 60), [pid]); }
      else { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 6 }); await page.mouse.up(); }
    }
    await page.waitForTimeout(500);
    const pos = await page.evaluate((p) => window.hollowmere.world.plotScreen(p), pid);
    if (mobile) await page.touchscreen.tap(pos.x, pos.y); else await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(300);
  };
  const pickChoice = async (text) => {
    const items = page.locator('#modal .pick-list .btn');
    const n = await items.count();
    for (let i = 0; i < n; i++) { const t = await items.nth(i).textContent(); if (t.includes(text)) { mobile ? await items.nth(i).tap({ force: true }) : await items.nth(i).click({ force: true }); return true; } }
    if (n) { mobile ? await items.first().tap({ force: true }) : await items.first().click({ force: true }); return true; }
    return false;
  };
  switch (plan.type) {
    case 'build': case 'keep': case 'muster': case 'recapture': case 'cabal': await clickPlot(plan.plot); break;
    case 'raid': {
      await clickPlot(plan.to);
      if (await page.locator('#modal').count()) {
        const names = await page.evaluate((p) => { const s = window.hollowmere.app.state; return { from: (window.__pn = (id) => '')(0), tgt: s.houses[p.target].name }; }, plan);
        await pickChoice(`with ${plan.n} Legion`); void names;
      }
      break;
    }
    case 'trade': {
      const names = { G: 'Grain', T: 'Timber', S: 'Stone', I: 'Iron', R: 'Reed', C: 'Coin', L: 'Lore' };
      await tap(`#modal .trade .col:first-child .btn:has-text("${names[plan.give]}")`);
      await tap(`#modal .trade .col:last-child .btn:has-text("${names[plan.get]}")`);
      await tap('#modal .btn.primary');
      break;
    }
    case 'play': await tap(`#modal .card:has-text("${{ testimony: 'Testimony', document: 'Document', witness: 'Witness' }[plan.card]}")`); break;
    case 'rite': {
      const name = await page.evaluate((id) => import('/src/rules/data.js').then((d) => d.riteById[id].name), plan.rite);
      await tap(`#modal .card:has-text("${name}")`); await page.waitForTimeout(300);
      if (plan.targets.length && await page.locator('#modal .pick-list').count()) await pickChoice(plan.targets.length ? '' : 'no target');
      else if (plan.targets.length) await clickPlot(plan.targets[0].plot);
      break;
    }
    case 'seal': { const nm = await page.evaluate((t) => window.hollowmere.app.state.houses[t].name, plan.target); await pickChoice(nm); break; }
    case 'pass': await tap('#modal .btn.primary'); break;
    default: break;
  }
  void plotOf;
  await page.waitForTimeout(300);
  if (humanActions === 5) await page.screenshot({ path: `${dir}/${String(++shots).padStart(2, '0')}-myturn.png` });
}
const result = await page.evaluate(() => { const s = window.hollowmere.app.state; return { phase: s.phase, season: s.season, winner: s.winner?.map((i) => s.houses[i].name), standings: s.final?.standings, log: s.log.slice(-3).map((l) => l.text) }; });
log(JSON.stringify({ result, humanActions, used, minutes: ((Date.now() - t0) / 60000).toFixed(1), errors: errors.slice(0, 20) }, null, 1));
await browser.close();
