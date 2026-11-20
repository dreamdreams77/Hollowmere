// Hollowmere app: game flow, input, HUD, cards, presentations and saving. The engine is the only
// source of truth; the interface reads a viewer-filtered copy (engine.view) for the human House.
import * as E from '../rules/engine.js';
import { CONFIG, HOUSES, HOUSE_ORDER, PLOTS, REACHES, RES, RES_NAME, RITES, riteById, EVENTS, eventById, INVESTIGATION, pips, plotById } from '../rules/data.js';
import { chooseAction, suggestAccords, PERSONA } from '../ai/ai.js';
import { h, img, icon, clear, put } from './dom.js';
import { seasonLook } from '../render/world.js';
import { LORE, TRAITS, dn, heirName, lordName } from '../content/lore.js';

const SAVE_KEY = 'hollowmere.save.v1', SETTINGS_KEY = 'hollowmere.settings.v1';
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const costChips = (cost) => Object.entries(cost).filter(([, n]) => n).flatMap(([r, n]) => [String(n), icon(img.res(r), 'icon')]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// How hard each House is to win with, from AI-vs-AI simulation (tools/sim.mjs).
const DIFFICULTY = { Thorne: 'Challenging' };
export function attitude(r) {
  if (r <= -3) return { word: 'Hostile', cls: 'v' };
  if (r <= -1) return { word: 'Wary', cls: '' };
  if (r === 0) return { word: 'Neutral', cls: '' };
  if (r <= 2) return { word: 'Cordial', cls: 'g' };
  return { word: 'Friendly', cls: 'b' };
}

export class App {
  constructor(world, audio) {
    this.world = world; this.audio = audio; this.ui = document.getElementById('ui');
    this.settings = { speed: 'normal', sound: true, music: true, quality: null, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    audio.setOn(this.settings.sound); audio.setMusic(this.settings.music);
    this.state = null; this.me = null; this.mode = null; this.selected = null; this.lastFx = 0; this.busy = false; this.tab = 'act';
    world.on('pick', (p) => this.onPick(p)); world.on('hover', (p, e) => this.onHover(p, e));
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.layoutChanged());
    this.mobileQ = window.matchMedia('(max-width: 820px), (max-height: 520px) and (max-width: 1000px)');
    this.mobileQ.addEventListener?.('change', () => { this.buildHUD(); this.refresh(); });
    // Watchdog: if a rival should be acting and nothing is driving the game, start the loop again.
    setInterval(() => { const s = this.state; if (s && s.phase === 'actions' && !s.pending && !this.looping && !this.presenting && !s.houses[s.turn].human && !document.getElementById('modal')) { console.warn('watchdog restarted the game loop'); this.loop(); } }, 3000);
  }
  saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); }
  get mobile() { return this.mobileQ.matches; }
  get view() { return E.view(this.state, this.me); }
  speedK() { return { slow: 1.5, normal: 1, fast: 0.45, instant: 0.05 }[this.settings.speed] ?? 1; }

  // ------------------------------------------------------------------ title and setup
  showTitle() {
    clear(this.ui);
    const saved = localStorage.getItem(SAVE_KEY);
    const pick = { house: 'Verrin', players: 4, rivals: 'random', rules: this.settings.rules || 'expanded' };
    const detail = h('div', { class: 'house-detail' });
    const grid = h('div', { class: 'house-grid' });
    const renderDetail = () => {
      const H = HOUSES[pick.house]; const L = LORE[pick.house];
      put(clear(detail), h('div', {}, h('b', {}, `House ${L.display} of ${L.seat}, the ${H.title}. `), h('span', { class: 'it' }, `"${L.words}"`), DIFFICULTY[pick.house] ? h('span', { class: 'tag v', style: { marginLeft: '6px' } }, DIFFICULTY[pick.house]) : null),
        h('div', { class: 'small it' }, L.history),
        h('div', { class: 'small' }, H.blurb), h('div', { class: 'small muted' }, `Wins by: ${H.winsBy}. Weak at: ${H.weakAt}.`));
    };
    for (const name of HOUSE_ORDER) {
      const b = h('button', { class: `house-pick${name === pick.house ? ' sel' : ''}`, onclick: () => { pick.house = name; this.audio.start(); this.audio.play('click'); for (const x of grid.children) x.classList.toggle('sel', x.dataset.h === name); renderDetail(); }, 'data-h': name },
        h('img', { src: img.shield(name), alt: '' }), h('div', { class: 'nm' }, dn(name)), h('div', { class: 'tt' }, HOUSES[name].title));
      grid.append(b);
    }
    renderDetail();
    const seg = (label, key, vals) => h('div', { class: 'setup-row' }, h('span', { class: 'it' }, label),
      h('div', { class: 'seg' }, vals.map(([v, t]) => h('button', { class: pick[key] === v ? 'on' : '', onclick: (e) => { pick[key] = v; for (const x of e.target.parentNode.children) x.classList.toggle('on', x === e.target); this.audio.play('click'); } }, t))));
    const card = h('div', { class: 'title-card vellum gilt' },
      h('h1', {}, 'Hollow', h('span', {}, 'mere')),
      h('p', { class: 'subtitle' }, 'Twelve Seasons. Five Reaches. One House shall hold the river.'),
      h('div', { class: 'rule' }),
      h('div', { class: 'it' }, 'Choose your House'),
      grid, detail,
      seg('Houses at the table', 'players', [[2, 'Two'], [3, 'Three'], [4, 'Four']]),
      seg('Rival Houses', 'rivals', [['random', 'Drawn by lot'], ['strong', 'Strongest Houses']]),
      seg('Rules', 'rules', [['expanded', 'Expanded: Pacts, Toil, walls'], ['original', 'Original rules']]),
      h('div', { class: 'setup-row' },
        h('button', { class: 'btn primary', onclick: () => { this.audio.start(); this.settings.rules = pick.rules; this.saveSettings(); this.newGame(pick); } }, 'Begin the first Season'),
        saved ? h('button', { class: 'btn blue', onclick: () => { this.audio.start(); this.load(); } }, 'Continue saved game') : null,
        h('button', { class: 'btn', onclick: () => { this.audio.start(); this.showRules(); } }, 'How to play')),
      h('p', { class: 'small muted it' }, 'Drag to move the board, scroll or pinch to zoom, right-drag or twist to turn it.'));
    this.ui.append(h('div', { id: 'title' }, card));
    this.world.resetView(); this.world.camGoal.yaw = 0.35; this.world.camGoal.dist = 70;
  }
  newGame({ house, players, rivals, rules = this.settings.rules || 'expanded' }) {
    const pool = HOUSE_ORDER.filter((x) => x !== house);
    const strong = ['Ash', 'Maelor', 'Verrin', 'Wren', 'Caddoc', 'Raven', 'Sable', 'Thorne'].filter((x) => x !== house);
    let foes;
    if (rivals === 'strong') foes = strong.slice(0, players - 1);
    else foes = pool.map((x) => [x, Math.random()]).sort((a, b) => a[1] - b[1]).map((x) => x[0]).slice(0, players - 1);
    const seed = `hm-${Date.now().toString(36)}`;
    this.start(E.newGame({ houses: [house, ...foes], humans: [house], seed, rules }));
  }
  start(state) {
    this.state = state; this.me = state.houses.findIndex((x) => x.human); this.mode = null; this.selected = null;
    this.world.pieces.houses = state.houses; this.world.setSeason(state.season, true); this.audio.setSeason(state.season);
    this.lastFx = 0;
    clear(this.ui); this.buildHUD();
    this.world.resetView();
    this.world.sync(this.view, false);
    this.lastFx = Math.max(0, ...this.state.fx.map((f) => f.n)) - 0;
    this.banner(`Season ${ROMAN[state.season]}`, `${seasonLook(state.season).name} · the dice show ${state.dice[0]} and ${state.dice[1]}`);
    this.refresh();
    this.save(true);
    this.loop();
  }

  // ------------------------------------------------------------------ HUD scaffolding
  buildHUD() {
    clear(this.ui);
    const ui = this.ui;
    this.el = {};
    this.el.top = h('div', { id: 'top', class: 'vellum gilt' });
    this.el.menu = h('button', { id: 'menuBtn', class: 'btn', 'aria-label': 'Menu', onclick: () => this.showMenu() }, '☰');
    this.el.actions = h('div', { id: 'actions', class: this.mobile ? '' : 'vellum gilt' });
    this.el.mine = h('div', { id: 'mine', class: 'vellum gilt' });
    this.el.rivals = h('div', { id: 'rivals' });
    this.el.chron = h('div', { id: 'chron', class: 'vellum gilt' });
    this.el.plot = h('div', { id: 'plot', class: 'vellum gilt hidden' });
    this.el.tip = h('div', { id: 'tip', class: 'vellum gilt hidden' });
    ui.append(this.el.top, this.el.menu, this.el.plot, this.el.tip);
    if (this.mobile) {
      this.el.tabs = h('div', { id: 'tabs' });
      this.el.sheetBody = h('div', { id: 'sheetBody' });
      this.el.sheet = h('div', { id: 'sheet', class: 'vellum gilt' }, h('div', { class: 'grab' }), this.el.tabs, this.el.sheetBody);
      ui.append(this.el.sheet);
    } else ui.append(this.el.mine, this.el.rivals, this.el.chron, this.el.actions);
  }
  layoutChanged() { if (this.state && this.selected) this.showPlot(this.selected); }

  refresh() {
    if (!this.state) return;
    const v = this.view; this.v = v;
    this.renderTop(v);
    if (this.mobile) this.renderSheet(v);
    else { this.renderMine(v, this.el.mine); this.renderRivals(v, this.el.rivals); this.renderChron(v, this.el.chron); this.renderActions(v, this.el.actions); }
    if (this.selected) this.showPlot(this.selected, false);
  }
  renderTop(v) {
    const top = clear(this.el.top);
    const seasons = h('div', { class: 'seasons', 'aria-label': 'Seasons' });
    for (let s = 1; s <= 12; s++) seasons.append(h('div', { class: `sdot${s < v.season ? ' past' : ''}${s === v.season ? ' now' : ''}${CONFIG.floodSeasons.includes(s) ? ' flood' : ''}`, title: `Season ${s}${CONFIG.floodSeasons.includes(s) ? ' · Flood' : ''}` }, ROMAN[s]));
    const cur = v.phase === 'actions' ? v.houses[v.turn] : null;
    const look = seasonLook(v.season);
    const phaseTxt = v.phase === 'over' ? 'The game is over' : v.pending ? (v.pending.type === 'pact' ? 'An Envoy awaits your answer' : 'Bramwell chooses Accords') : cur ? `${cur.i === this.me ? 'Your' : dn(cur.name) + "'s"} Action · round ${v.round + 1} of 3` : v.phase;
    const nextFlood = CONFIG.floodSeasons.find((f) => f >= v.season);
    const pressure = h('div', { class: 'pressure', title: `Ember Pressure ${v.pressure} of ${CONFIG.pressureThreshold}. At 4 or more at a Flood, the heaviest caster loses a marker.` });
    for (let i = 0; i < CONFIG.pressureThreshold; i++) pressure.append(icon(img.flame(v.pressure >= i + 1), 'icon'));
    if (v.pressure % 1) pressure.append(h('span', { class: 'small' }, '½'));
    top.append(...[seasons,
      h('div', { class: 'phase' }, h('b', {}, `Season ${ROMAN[v.season]} · ${look.name}`), h('span', {}, phaseTxt + (nextFlood && v.phase !== 'over' ? ` · Flood ${nextFlood === v.season ? 'this Season' : 'in Season ' + ROMAN[nextFlood]}` : ''))),
      pressure,
      cur ? h('img', { class: 'turn-shield', src: img.shield(cur.name), alt: dn(cur.name), title: `${dn(cur.name)} to act` }) : null].filter(Boolean));
  }
  heirText(x, v) {
    if (x.heir.revealed) return x.heir.status === 'G' ? 'Genuine, revealed' : 'Impostor, exposed';
    if (x.heir.status === 'G') return 'Genuine (known to you)';
    if (x.heir.status === 'I') return 'Impostor (known to you)';
    return 'Hidden';
  }
  renderMine(v, el) {
    const me = v.houses[this.me]; const H = HOUSES[me.name];
    put(clear(el), 
      h('div', { class: 'house-head' }, h('img', { src: img.shield(me.name), alt: '' }), h('div', {}, h('h2', {}, dn(me.name)), h('div', { class: 'tt' }, `the ${H.title} · ${LORE[me.name].seat}`))),
      h('div', { class: 'small it', title: TRAITS[me.lord.trait].text }, `Ruled by ${lordName(me)}, ${TRAITS[me.lord.trait].name.toLowerCase()}: ${TRAITS[me.lord.trait].text}.`),
      h('div', { class: 'scores' },
        h('span', { title: 'Renown: the score. The most at the end of Season XII wins.' }, icon(img.renown(), 'icon lg'), String(me.renown)),
        h('span', { title: 'Favor: buys Dynasties and reveals Heirs.' }, icon(img.favor(), 'icon lg'), String(me.favor))),
      h('div', { class: 'coffer' }, RES.map((r) => h('div', { title: RES_NAME[r], 'data-r': r }, icon(img.res(r)), h('span', { class: me.coffer[r] ? '' : 'z' }, String(me.coffer[r]))))),
      h('ul', { class: 'facts' },
        h('li', {}, h('span', {}, 'Markers · Legions'), h('span', {}, `${E.totalMarkers(this.state, this.me)} · ${E.totalLegions(this.state, this.me)}`)),
        h('li', {}, h('span', {}, 'Dynasty'), h('span', {}, me.dynasty ? 'Held (+1 each Flood)' : `None (costs ${E.dynastyFavor(me)} Favor, 2 Reed)`)),
        H.cabal ? h('li', {}, h('span', {}, 'Cabal tokens'), h('span', {}, `${me.cabalTokens} of 2${me.cabalExposed ? ' · exposed' : ' · hidden'}`)) : null,
        me.pacts.length ? h('li', {}, h('span', {}, 'Pacts'), h('span', {}, me.pacts.map((p) => `${dn(v.houses[p.with].name)} (to Season ${ROMAN[Math.min(12, p.until)]})`).join(', '))) : null,
        me.oaths ? h('li', {}, h('span', { class: 'ver' }, 'Oaths broken'), h('span', { class: 'ver' }, String(me.oaths))) : null,
        me.accords.length ? h('li', {}, h('span', {}, 'Accords'), h('span', {}, me.accords.map((a) => dn(v.houses[a].name)).join(', '))) : null,
        h('li', {}, h('span', {}, 'Wins by'), h('span', { class: 'it' }, H.winsBy))),
      h('div', { class: 'heir' }, h('img', { src: img.heir(me.name, me.heir.status), alt: 'Your Heir' }),
        h('div', {}, h('div', {}, h('b', {}, `Your Heir, ${heirName(this.state, this.state.houses[this.me])}: `), this.heirText(me, v)), h('div', { class: 'it muted' }, me.heir.status === '?' ? 'Four in five are Impostors. A Vigil, a Seal or a succession will show the truth.' : me.heir.status === 'G' && !me.heir.revealed ? 'Reveal it (2 Favor) to score 4 at the end.' : me.heir.status === 'I' ? 'Should your Dynasty holder die, the Dynasty is lost.' : 'It will score 4 Renown at the end.'))),
      h('div', { class: 'hands' },
        h('button', { class: 'btn', onclick: () => this.showHand('rite') }, `Rites ${me.rites.length}/3`),
        h('button', { class: 'btn', onclick: () => this.showHand('inv') }, `Investigation ${me.invHand.length}/3`)));
  }
  renderRivals(v, el) {
    clear(el);
    for (const x of v.houses) {
      if (x.i === this.me) continue;
      const tags = [];
      if (x.dynasty) tags.push(h('span', { class: 'tag g' }, 'Dynasty'));
      if (x.heir.revealed) tags.push(h('span', { class: `tag ${x.heir.status === 'G' ? 'b' : 'v'}` }, x.heir.status === 'G' ? 'Genuine Heir' : 'Impostor'));
      else if (x.heir.status !== '?') tags.push(h('span', { class: 'tag b' }, x.heir.status === 'G' ? 'Heir: Genuine (you know)' : 'Heir: Impostor (you know)'));
      if (x.accords.length) tags.push(h('span', { class: 'tag' }, `Accord: ${x.accords.map((a) => dn(v.houses[a].name)).join(', ')}`));
      if (v.houses.some((y) => y.accords.includes(x.i) && y.i === this.me)) tags.push(h('span', { class: 'tag' }, 'Accord with you'));
      if (x.pacts.some((p) => p.with === this.me)) tags.push(h('span', { class: 'tag b' }, 'Pact with you'));
      if (x.oaths) tags.push(h('span', { class: 'tag v' }, `Oathbreaker${x.oaths > 1 ? ' ×' + x.oaths : ''}`));
      if (v.rules === 'expanded') { const a = attitude(x.regard[this.me] || 0); tags.push(h('span', { class: `tag ${a.cls}`, title: 'How this House regards you' }, a.word)); }
      tags.push(h('span', { class: 'tag' }, `${E.totalMarkers(this.state, x.i)} markers`), h('span', { class: 'tag' }, `${E.totalLegions(this.state, x.i)} Legions`), h('span', { class: 'tag' }, `${x.favor} Favor`));
      el.append(h('div', { class: `rival vellum gilt${v.phase === 'actions' && v.turn === x.i ? ' active' : ''}`, onclick: () => this.showRival(x.i), role: 'button', tabindex: 0 },
        h('img', { class: 'sh', src: img.shield(x.name), alt: '' }),
        h('div', {}, h('div', { class: 'nm' }, dn(x.name)), h('div', { class: 'st' }, `${lordName(x)} · ${TRAITS[x.lord.trait].name}`)),
        h('div', { class: 'rn', title: 'Renown' }, icon(img.renown(), 'icon'), String(x.renown)),
        h('div', { class: 'tags' }, tags)));
    }
  }
  renderChron(v, el) {
    clear(el);
    for (const l of v.log.slice(-40)) el.append(h('p', { class: `k-${l.kind}${l.h === this.me ? ' yours' : ''}` }, l.text));
    el.scrollTop = el.scrollHeight;
  }
  renderSheet(v) {
    const tabs = clear(this.el.tabs); const body = clear(this.el.sheetBody);
    const T = [['act', 'Actions'], ['house', 'House'], ['rivals', 'Rivals'], ['log', 'Chronicle']];
    for (const [k, t] of T) tabs.append(h('button', { class: this.tab === k ? 'on' : '', onclick: () => { this.tab = k; this.audio.play('click'); this.renderSheet(this.view); } }, t));
    const pane = h('div', { class: 'sheet-pane' }); body.append(pane);
    if (this.tab === 'act') this.renderActions(v, pane);
    if (this.tab === 'house') this.renderMine(v, pane);
    if (this.tab === 'rivals') this.renderRivals(v, pane);
    if (this.tab === 'log') { this.renderChron(v, pane); body.scrollTop = body.scrollHeight; }
  }
  renderActions(v, el) {
    clear(el);
    const cur = v.phase === 'actions' ? v.houses[v.turn] : null;
    if (v.phase === 'over') { el.append(h('div', { class: 'waiting' }, 'The twelfth Flood has receded.', h('button', { class: 'btn primary', onclick: () => this.showResults() }, 'See the results'))); return; }
    if (!cur || cur.i !== this.me || v.pending || this.busy) {
      const key = v.pending ? v.houses[v.pending.h].name : cur ? cur.name : v.houses[0].name;
      const msg = v.pending ? (v.pending.type === 'pact' ? 'An Envoy waits on your answer' : `${dn(key)} weighs its Accords`) : cur ? `${lordName(cur)} of ${dn(key)} is deciding` : 'The world turns';
      el.append(h('div', { class: 'waiting' }, icon(img.shield(key), 'quill'), `${msg}…`));
      return;
    }
    const me = v.houses[this.me]; const H = HOUSES[me.name];
    const cat = E.actionCatalog(this.state, this.me);
    const hint = this.mode ? this.modeHint() : 'Choose an Action, or tap a Plot to see what you can do there.';
    el.append(h('div', { class: 'act-head' }, h('div', { class: 'who' }, `Your Action ${v.round + 1} of 3`), h('div', { class: 'hint' }, hint, this.mode ? [' ', h('button', { class: 'btn', style: { minHeight: '34px', padding: '0 10px', fontSize: '15px' }, onclick: () => this.cancelMode() }, 'Cancel')] : null)));
    const grid = h('div', { class: 'act-grid' });
    const costOf = {
      build: CONFIG.buildCost, keep: CONFIG.buildCost, muster: E.musterCost(me), raid: { I: 1 }, recapture: CONFIG.recaptureCost,
      trade: null, favor: {}, investigate: E.investigateCosts(me)[0], play: {}, seal: { L: 1 }, reveal: null, rite: null, dynasty: { R: 2 }, cabal: { C: 1 }, vigil: { C: 1 }, toil: {}, fortify: E.FORTIFY_COST, envoy: H.vigil ? {} : { C: 1 }, pass: me.coffer.C ? { C: 1 } : {},
    };
    const extra = { trade: `${E.tradeRate(me)} for 1`, reveal: '2 Favor', rite: 'card cost', dynasty: `${E.dynastyFavor(me)} Favor +`, favor: 'free', play: 'free', investigate: H.investigateCost && !Object.keys(H.investigateCost).length ? 'free' : null };
    for (const c of cat) {
      const cost = costOf[c.type];
      const b = h('button', { class: `btn act${c.ok ? '' : ' off'}${this.mode?.type === c.type ? ' pending' : ''}`, 'aria-disabled': !c.ok, title: c.ok ? this.actionHelp(c.type) : c.reason,
        onclick: () => (c.ok ? this.chooseType(c.type, c.options) : this.deny(c.reason)) },
        h('span', {}, c.label), h('span', { class: 'cost' }, extra[c.type] ? [extra[c.type], ' ', cost ? costChips(cost) : null] : cost && Object.keys(cost).length ? costChips(cost) : 'free'));
      grid.append(b);
    }
    el.append(grid);
  }
  actionHelp(t) {
    return {
      build: 'Place a marker on an empty Plot next to one of yours.', keep: 'Add a second marker to a Plot you hold. A Keep pays double.',
      muster: 'Add a Legion to a Plot you hold (three at most).', raid: 'March up to two Legions into an adjacent rival Plot. Win to take a marker.',
      recapture: 'Flip back a marker you lost, with a Legion next to it.', trade: 'Trade a surplus at the Bank.', favor: 'Gain 1 Favor (once a Season).',
      investigate: 'Draw an Investigation card (hand of three).', play: 'Play a Testimony, Document or Witness.', seal: "Test a rival's Heir. An Impostor is worth 2 Renown.",
      reveal: 'Proclaim your known Genuine Heir. It scores 4 at the end.', rite: 'Cast a Rite from your hand. It raises Ember Pressure.',
      dynasty: 'Found a Dynasty: 2 Renown now, 1 more at each Flood.', cabal: 'Place a hidden Cabal token on or next to your Plots.',
      vigil: 'Learn your own Heir. An Impostor may be replaced once by marriage.', pass: 'Do nothing. Costs 1 Coin if you have one.',
      toil: 'Once a Season, gain 1 resource your Plots produce (any, if you hold two Plots or fewer).',
      fortify: 'Wall a Plot you hold: +1 to its defence, and Raiders must fight even if it is empty.',
      envoy: 'Offer a rival a Pact: no Raids or Rite attacks between you until the end of next Season. Breaking it costs Renown, Favor and trust.',
    }[t];
  }
  modeHint() {
    const m = this.mode;
    return { fortify: 'Tap one of your glowing Plots to raise walls.', build: 'Tap a glowing Plot to build there.', keep: 'Tap one of your glowing Plots to raise a Keep.', muster: 'Tap a glowing Plot to muster a Legion.', raid: 'Tap the rival Plot to raid.', recapture: 'Tap the Plot to recapture.', cabal: 'Tap a glowing Plot to hide a Cabal token.', riteTarget: `Tap a glowing Plot for ${m?.rite ? riteById[m.rite].name : 'the Rite'}.` }[m.kind || m.type] || '';
  }

  // ------------------------------------------------------------------ choosing actions
  deny(reason) { this.audio.play('deny'); this.toast(reason || 'Not available now.'); }
  cancelMode() { this.mode = null; this.world.setSelection({ targets: [] }); this.refresh(); }
  chooseType(type, options) {
    this.audio.play('click');
    const plotTypes = { build: 'plot', keep: 'plot', muster: 'plot', recapture: 'plot', cabal: 'plot', fortify: 'plot', raid: 'to' };
    if (plotTypes[type]) {
      this.mode = { type, options, key: plotTypes[type] };
      const targets = [...new Set(options.map((o) => o[plotTypes[type]]))];
      this.world.setSelection({ targets });
      if (targets.some((p) => this.world.plotCovered(p))) this.world.frameTargets(targets);
      this.refresh();
      return;
    }
    this.mode = null; this.world.setSelection({ targets: [] });
    switch (type) {
      case 'favor': case 'investigate': case 'dynasty': case 'vigil': case 'reveal': return this.act(options[0]);
      case 'pass': return this.confirm('Pass this Action?', this.v.houses[this.me].coffer.C ? 'Passing costs 1 Coin.' : 'You have no Coin, so passing is free.', () => this.act(options[0]));
      case 'trade': return this.showTrade(options);
      case 'toil': return this.choose('Toil', 'Your people work the land for one resource.', options.map((o) => ({ label: `+1 ${RES_NAME[o.res]}`, img: img.res(o.res), action: o })));
      case 'envoy': return this.showEnvoy(options);
      case 'play': return this.showHand('inv');
      case 'rite': return this.showHand('rite');
      case 'seal': return this.choose('Seal a rival Heir', 'Spend 1 Lore and a Seal card. An Impostor is exposed and you gain 2 Renown; a Genuine result stays private.',
        options.map((o) => ({ label: `${dn(this.state.houses[o.target].name)}'s Heir${this.v.houses[o.target].heir.status !== '?' ? ` (you know: ${this.v.houses[o.target].heir.status === 'G' ? 'Genuine' : 'Impostor'})` : ''}`, img: img.shield(this.state.houses[o.target].name), action: o })));
    }
  }
  onPick(pid) {
    if (!this.state || pid == null) { if (!pid) this.closePlot(); return; }
    this.audio.play('click');
    if (this.mode && this.mode.kind !== 'riteTarget') {
      const opts = this.mode.options.filter((o) => o[this.mode.key] === pid);
      if (!opts.length) { this.deny(`${plotById(pid).name} is not a legal target for ${E.ACTION_LABEL[this.mode.type]}.`); return; }
      if (opts.length === 1) return this.act(opts[0]);
      return this.choose(`${E.ACTION_LABEL[this.mode.type]} at ${plotById(pid).name}`, null, opts.map((o) => ({ label: this.describe(o), action: o })));
    }
    if (this.mode && this.mode.kind === 'riteTarget') {
      const opts = this.mode.options.filter((o) => o.targets.some((t) => t.plot === pid));
      if (!opts.length) { this.deny('Not a target for this Rite.'); return; }
      return opts.length === 1 ? this.act(opts[0]) : this.choose(riteById[this.mode.rite].name, null, opts.map((o) => ({ label: this.describe(o), action: o })));
    }
    this.selected = pid; this.world.setSelection({ selected: pid }); this.showPlot(pid);
  }
  onHover(pid, e) {
    const tip = this.el?.tip; if (!tip) return;
    if (!pid || !e) { tip.classList.add('hidden'); return; }
    const p = plotById(pid); const plot = this.state?.plots[pid - 1];
    const holders = plot ? Object.entries(plot.m).filter(([, n]) => n).map(([k, n]) => `${dn(this.state.houses[k].name)} ${n === 2 ? '(Keep)' : ''}`.trim()) : [];
    put(clear(tip), h('b', {}, p.name), h('div', { class: 'small it' }, `${RES_NAME[p.res]} on ${p.n} (${pips(p.n)} in 36) · Reach ${REACHES[p.reach - 1].roman}`), holders.length ? h('div', { class: 'small' }, holders.join(', ')) : null);
    tip.classList.remove('hidden');
    tip.style.left = `${Math.min(window.innerWidth - 290, e.clientX + 16)}px`; tip.style.top = `${e.clientY + 14}px`;
  }
  describe(a) {
    const S = this.state; const P = (id) => plotById(id).name;
    switch (a.type) {
      case 'raid': return `Raid ${P(a.to)} from ${P(a.from)} with ${a.n} Legion${a.n > 1 ? 's' : ''} against ${dn(S.houses[a.target].name)} (defended by ${E.legionsOn(S, a.to, a.target)}${S.plots[a.to - 1].walls === a.target && S.rules === 'expanded' ? ', walled' : ''})${E.pactWith(S, this.me, a.target) ? ' · BREAKS YOUR PACT' : ''}`;
      case 'recapture': return `Recapture ${P(a.plot)}`;
      case 'rite': { const r = riteById[a.rite]; if (!a.targets.length) return r.target ? `${r.name} with no target` : r.name; return `${r.name}: ${a.targets.map((t) => (t.house != null ? `${dn(S.houses[t.house].name)} at ${P(t.plot)}` : P(t.plot))).join(' and ')}`; }
      default: return `${E.ACTION_LABEL[a.type]}${a.plot ? ' at ' + P(a.plot) : ''}`;
    }
  }
  async act(action) {
    const chk = E.checkAction(this.state, action);
    if (!chk.ok) { this.deny(chk.reason); return; }
    this.closeModal(); this.mode = null; this.world.setSelection({ targets: [] });
    const before = this.state.houses[this.me].coffer;
    const snapshot = { ...before };
    E.applyAction(this.state, action);
    this.bumpCoffer(snapshot);
    try { await this.present(); } catch (err) { console.error('presentation failed', err); }
    this.save(true);
    this.loop();
  }
  bumpCoffer(before) {
    requestAnimationFrame(() => { for (const el of document.querySelectorAll('.coffer div')) if (before[el.dataset.r] !== this.state.houses[this.me].coffer[el.dataset.r]) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } });
  }

  // ------------------------------------------------------------------ game loop and presentation
  async loop() {
    if (this.looping) return; this.looping = true;
    try {
      while (this.state && this.state.phase !== 'over') {
        const s = this.state;
        if (s.pending) {
          if (s.houses[s.pending.h].human) { this.refresh(); if (s.pending.type === 'pact') this.showPact(); else this.showAccords(); break; }
          E.decide(s, { partners: suggestAccords(s, s.pending.h) }); try { await this.present(); } catch (err) { console.error('presentation failed', err); } continue;
        }
        const cur = s.houses[s.turn];
        if (cur.human) { this.busy = false; this.refresh(); break; }
        this.busy = true; this.refresh();
        await sleep(380 * this.speedK());
        const a = chooseAction(s, cur.i);
        E.applyAction(s, a);
        try { await this.present(); } catch (err) { console.error('presentation failed', err); }
      }
      if (this.state?.phase === 'over') { this.busy = false; this.refresh(); this.save(true); await sleep(600); this.showResults(); }
    } finally { this.looping = false; }
  }
  async present() {
    this.presenting = true;
    try { await this.presentInner(); } finally { this.presenting = false; }
  }
  async presentInner() {
    const v = this.view;
    const fresh = v.fx.filter((f) => f.n > this.lastFx);
    this.lastFx = Math.max(this.lastFx, ...this.state.fx.map((f) => f.n));
    const k = this.speedK();
    const travel = fresh.filter((f) => f.t === 'raid');
    for (const f of travel) { this.audio.play('march'); await this.world.play(f, v); if (f.defended) this.audio.play('clash'); }
    this.world.sync(v, k > 0.1);
    this.refresh();
    for (const f of fresh) {
      if (f.t === 'raid') continue;
      await this.presentOne(f, v, k);
    }
    this.refresh();
  }
  async presentOne(f, v, k) {
    const W = this.world; const name = f.h != null ? dn(v.houses[f.h].name) : null;
    const mine = f.h === this.me;
    switch (f.t) {
      case 'harvest': {
        W.setSeason(v.season); this.audio.setSeason(v.season);
        this.banner(`Season ${ROMAN[v.season]}`, `${seasonLook(v.season).name} · Harvest`);
        if (k > 0.1) await this.dice(f.dice, k);
        this.audio.play(f.sum === 7 ? 'seven' : 'harvest');
        await W.play(f, v);
        return;
      }
      case 'event': {
        this.audio.play('event');
        const line = [...v.log].reverse().find((l) => l.kind === 'event');
        await this.showEvent(f.id, line?.text);
        return;
      }
      case 'flood': {
        this.audio.play('flood'); W.play(f, v);
        await this.showFlood(f.result, v);
        return;
      }
      case 'over': return;
      case 'build': this.audio.play('build'); break;
      case 'keep': this.audio.play('keep'); break;
      case 'muster': this.audio.play('muster'); break;
      case 'rite': this.audio.play('rite'); if (!mine) this.toast(`${name} casts ${riteById[f.rite].name}.`); break;
      case 'catastrophe': this.audio.play('catastrophe'); this.toast(`Ember Pressure breaks! Catastrophe strikes ${name}.`); break;
      case 'renown': if (f.n) this.audio.play('renown'); break;
      case 'favor': this.audio.play('favor'); break;
      case 'trade': this.audio.play('coin'); break;
      case 'seal': this.audio.play('intrigue'); if (f.result === 'G' && (mine || f.target === this.me)) this.toast(mine ? `Your Seal shows ${dn(v.houses[f.target].name)}'s Heir is Genuine. Only you and they know.` : `${name}'s Seal found your Heir Genuine. You may now reveal it.`); break;
      case 'vigil': if (mine) this.toast(f.result === 'remarried' ? 'Your Heir was an Impostor. A marriage brings a new claimant into your line.' : `Your Heir is ${v.houses[this.me].heir.status === 'G' ? 'Genuine. Reveal it for 4 Renown at the end.' : 'an Impostor.'}`); break;
      case 'investigate': if (mine && f.card) this.toast(`You draw a ${INVESTIGATION[f.card].name} card.`); this.audio.play('card'); break;
      case 'play': case 'cabal': case 'reveal': case 'dynasty': case 'accord': this.audio.play(f.t === 'dynasty' ? 'renown' : 'intrigue'); break;
      case 'succession': this.toast(`${name}'s Dynasty passes to ${f.result === 'G' ? 'a Genuine Heir' : 'an Impostor! 2 Renown lost'}.`); break;
      case 'cabalHarvest': break;
      case 'pact': this.audio.play('favor'); if (f.with === this.me || mine) this.toast(`A Pact is sworn between ${dn(v.houses[f.h].name)} and ${dn(v.houses[f.with].name)}.`); break;
      case 'oathbreak': this.audio.play('deny'); this.toast(`${name} breaks its Pact with ${dn(v.houses[f.victim].name)}! Every House marks it.`); break;
      case 'refused': if (mine) this.toast(`${dn(v.houses[f.by].name)} turns your Envoy away.`); break;
      case 'toil': this.audio.play('build'); break;
      case 'fortify': this.audio.play('keep'); break;
    }
    if (k > 0.1) await Promise.race([W.play(f, v), sleep(2500)]);
  }
  dice(d, k) {
    const wrap = h('div', { id: 'dice' });
    const ROT = { 1: 'rotateX(0deg)', 2: 'rotateX(-90deg)', 3: 'rotateY(-90deg)', 4: 'rotateY(90deg)', 5: 'rotateX(90deg)', 6: 'rotateX(180deg)' };
    const FACE = { 1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 2: 'rotateX(90deg)', 5: 'rotateX(-90deg)', 3: 'rotateY(90deg)', 4: 'rotateY(-90deg)' };
    const PIP = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
    for (const n of d) {
      const die = h('div', { class: 'die', style: { '--end': `${ROT[n]} rotateZ(${(Math.random() * 30 - 15).toFixed(0)}deg)`, animationDuration: `${1.1 * Math.max(k, 0.4)}s` } });
      for (let f = 1; f <= 6; f++) {
        const face = h('div', { class: `f${f === 1 ? ' red' : ''}`, style: { transform: `${FACE[f]} translateZ(32px)` } });
        for (let i = 1; i <= 9; i++) face.append(h('i', { style: { visibility: PIP[f].includes(i) ? 'visible' : 'hidden' } }));
        die.append(face);
      }
      wrap.append(die);
    }
    const sum = d[0] + d[1];
    wrap.append(h('div', { class: 'sum' }, sum === 7 ? 'Seven: nothing grows' : `${sum}: ${PLOTS.filter((p) => p.n === sum).map((p) => p.name).join(', ')}`));
    this.ui.append(wrap);
    return sleep(2100 * Math.max(k, 0.5)).then(() => wrap.remove());
  }
  banner(title, sub) {
    document.getElementById('banner')?.remove();
    const b = h('div', { id: 'banner', class: 'lapis gilt' }, h('h2', {}, title), h('p', {}, sub));
    this.ui.append(b); setTimeout(() => b.remove(), 2700);
  }
  toast(text) {
    document.getElementById('toast')?.remove();
    const t = h('div', { id: 'toast', class: 'vellum gilt' }, text); this.ui.append(t); setTimeout(() => t.remove(), 3300);
  }

  // ------------------------------------------------------------------ plot inspector
  closePlot() { this.selected = null; this.el?.plot?.classList.add('hidden'); this.world.setSelection({ selected: null }); }
  showPlot(pid, reposition = true) {
    const v = this.v || this.view; const p = plotById(pid); const plot = v.plots[pid - 1]; const el = this.el.plot;
    const holders = v.houses.filter((x) => (plot.m[x.i] || 0) > 0 || (plot.l[x.i] || 0) > 0);
    const myTurn = v.phase === 'actions' && v.turn === this.me && !this.busy && !v.pending;
    const here = [];
    if (myTurn) {
      for (const t of ['build', 'keep', 'muster', 'recapture', 'cabal', 'fortify']) for (const o of E.optionsFor(this.state, this.me, t)) if (o.plot === pid) here.push(o);
      const raids = E.optionsFor(this.state, this.me, 'raid').filter((o) => o.to === pid);
      if (raids.length) here.push({ type: 'raidMenu', raids });
    }
    const reach = REACHES[p.reach - 1];
    put(clear(el), 
      h('button', { class: 'close', 'aria-label': 'Close', onclick: () => this.closePlot() }, '×'),
      h('h3', {}, p.name),
      h('div', { class: 'meta' }, icon(img.res(p.res)), ` ${RES_NAME[p.res]} on a ${p.n} · pays on ${pips(p.n)} rolls in 36 · Reach ${reach.roman}, ${reach.name}${reach.delta ? ' (scores double)' : ''}`),
      h('div', { class: 'holders' }, holders.length ? holders.map((x) => h('div', { class: 'holder' }, h('img', { src: img.shield(x.name), alt: '' }),
        `${dn(x.name)}: ${plot.m[x.i] === 2 ? 'Keep (2 markers)' : plot.m[x.i] ? '1 marker' : 'no marker'}${plot.l[x.i] ? `, ${plot.l[x.i]} Legion${plot.l[x.i] > 1 ? 's' : ''}` : ''}`)) : h('div', { class: 'it muted' }, 'Unclaimed land.')),
      (plot.contests || []).length ? h('div', { class: 'small ver' }, `Contested: ${plot.contests.map((c) => `${dn(v.houses[c.victim].name)} may recapture from ${dn(v.houses[c.captor].name)}`).join('; ')}.`) : null,
      plot.walls != null && v.rules === 'expanded' ? h('div', { class: 'small' }, `Walled by ${dn(v.houses[plot.walls].name)}: +1 to its defence.`) : null,
      plot.cabal != null ? h('div', { class: 'small it' }, `A Cabal token of ${dn(v.houses[plot.cabal].name)} lies hidden here.`) : null,
      here.length ? h('div', { class: 'pacts' }, here.map((o) => o.type === 'raidMenu'
        ? h('button', { class: 'btn primary', onclick: () => (o.raids.length === 1 ? this.act(o.raids[0]) : this.choose(`Raid ${p.name}`, 'Choose your Legions and your target.', o.raids.map((r) => ({ label: this.describe(r), action: r })))) }, 'Raid here')
        : h('button', { class: 'btn', onclick: () => this.act(o) }, `${E.ACTION_LABEL[o.type]} here`))) : null);
    el.classList.remove('hidden');
    if (reposition && !this.mobile) {
      const sp = this.world.plotScreen(pid);
      const w = 290, hgt = el.offsetHeight || 180;
      let x = sp.x + 40, y = sp.y - hgt / 2;
      if (x + w > window.innerWidth - 270) x = sp.x - w - 40;
      el.style.left = `${Math.max(320, Math.min(window.innerWidth - w - 260, x))}px`; el.style.top = `${Math.max(80, Math.min(window.innerHeight - hgt - 170, y))}px`;
    }
  }

  // ------------------------------------------------------------------ modals
  modal(content, { dismiss = true, cls = '' } = {}) {
    this.closeModal();
    const m = h('div', { id: 'modal', onclick: (e) => { if (dismiss && e.target === m) this.closeModal(); } }, h('div', { class: `sheet vellum gilt ${cls}` }, content));
    this.ui.append(m); return m;
  }
  closeModal() { document.getElementById('modal')?.remove(); if (this.modalResolve) { const r = this.modalResolve; this.modalResolve = null; r(); } }
  confirm(title, text, yes) {
    this.modal([h('h2', {}, title), h('p', { class: 'lede' }, text), h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => { this.closeModal(); yes(); } }, 'Yes'), h('button', { class: 'btn', onclick: () => this.closeModal() }, 'No'))]);
  }
  choose(title, text, items) {
    this.modal([h('h2', {}, title), text ? h('p', { class: 'lede' }, text) : null,
      h('div', { class: 'pick-list' }, items.map((it) => h('button', { class: 'btn', onclick: () => this.act(it.action) }, it.img ? h('img', { src: it.img, class: 'icon lg', alt: '' }) : null, it.label))),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => this.closeModal() }, 'Cancel'))]);
  }
  showTrade(options) {
    const me = this.state.houses[this.me]; const rate = E.tradeRate(me);
    let give = options[0].give, get = options.find((o) => o.give === give).get;
    const body = h('div');
    const render = () => {
      const gives = [...new Set(options.map((o) => o.give))];
      put(clear(body), h('div', { class: 'trade' },
        h('div', { class: 'col' }, h('div', { class: 'it' }, `Give ${rate}`), gives.map((r) => h('button', { class: `btn${r === give ? ' on' : ''}`, onclick: () => { give = r; if (get === give) get = RES.find((x) => x !== give); render(); } }, icon(img.res(r)), RES_NAME[r], h('span', { class: 'muted' }, `(${me.coffer[r]})`)))),
        h('div', { class: 'col' }, h('div', { class: 'it' }, 'Receive 1'), RES.filter((r) => r !== give).map((r) => h('button', { class: `btn${r === get ? ' on' : ''}`, onclick: () => { get = r; render(); } }, icon(img.res(r)), RES_NAME[r], h('span', { class: 'muted' }, `(${me.coffer[r]})`))))),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => this.act({ type: 'trade', give, get }) }, `Trade ${rate} ${RES_NAME[give]} for 1 ${RES_NAME[get]}`), h('button', { class: 'btn', onclick: () => this.closeModal() }, 'Cancel')));
    };
    render();
    this.modal([h('h2', {}, 'The Bank'), h('p', { class: 'lede' }, rate === 2 ? "Merchant's Writ: two for one, once this Season." : 'Three of one resource buys one of another.'), body]);
  }
  cardEl(kind, id, { onclick, off, why } = {}) {
    if (kind === 'rite') {
      const r = riteById[id]; const me = this.state.houses[this.me];
      const p = E.riteMaker(me, r);
      return h('div', { class: `card${off ? ' off' : ''}`, onclick, title: why || '' },
        h('img', { class: 'art', src: img.art('rite', id, { school: r.school, id }), alt: '' }),
        h('div', { class: 'body' }, h('div', { class: 'kind' }, `${r.school} Rite`), h('h4', {}, r.name), h('p', {}, r.text),
          why ? h('div', { class: 'why' }, why) : null,
          h('div', { class: 'foot' }, h('span', {}, costChips(r.cost)), h('span', { title: 'Ember Pressure' }, p ? [icon(img.flame(true)), p % 1 ? String(p) : p > 1 ? `×${p}` : ''] : 'no Pressure'))));
    }
    const c = INVESTIGATION[id];
    return h('div', { class: `card${off ? ' off' : ''}`, onclick, title: why || '' },
      h('img', { class: 'art', src: img.art('inv', id, { type: id, id }), alt: '' }),
      h('div', { class: 'body' }, h('div', { class: 'kind' }, 'Investigation'), h('h4', {}, c.name), h('p', {}, c.text), why ? h('div', { class: 'why' }, why) : null));
  }
  showHand(kind) {
    const me = this.state.houses[this.me]; const myTurn = this.state.phase === 'actions' && this.state.turn === this.me && !this.busy && !this.state.pending;
    const cards = [];
    if (kind === 'rite') {
      const opts = myTurn ? E.optionsFor(this.state, this.me, 'rite') : [];
      for (const id of me.rites) {
        const mine = opts.filter((o) => o.rite === id); const r = riteById[id];
        const why = !myTurn ? 'Cast on your turn.' : mine.length ? null : `Needs ${E.riteCosts(me, r).map(E.costText).join(' or ')}${r.target === 'emptyAdjacent' ? ' and an empty Plot next to yours' : ''}.`;
        cards.push(this.cardEl('rite', id, { off: !mine.length, why, onclick: () => (mine.length ? this.castRite(id, mine) : this.deny(why)) }));
      }
    } else {
      const opts = myTurn ? E.optionsFor(this.state, this.me, 'play') : [];
      for (const id of me.invHand) {
        const o = opts.find((x) => x.card === id);
        const why = id === 'seal' ? (HOUSES[me.name].seal ? 'Spent by the Seal action.' : 'Only Raven can use Seals.') : !myTurn ? 'Play on your turn.' : null;
        cards.push(this.cardEl('inv', id, { off: !o, why, onclick: () => (o ? this.act(o) : this.deny(why)) }));
      }
    }
    this.audio.play('card');
    this.modal([h('h2', {}, kind === 'rite' ? 'Your Rites' : 'Your Investigation cards'),
      h('p', { class: 'lede' }, kind === 'rite' ? `Ember Pressure stands at ${this.state.pressure}. At ${CONFIG.pressureThreshold} or more at a Flood, the heaviest caster loses a marker.` : 'Hold up to three. Testimony, Document and Witness are played as an Action.'),
      cards.length ? h('div', { class: 'cards' }, cards) : h('p', { class: 'lede' }, 'Your hand is empty.'),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => this.closeModal() }, 'Close'))]);
  }
  castRite(id, options) {
    const r = riteById[id];
    if (!r.target) return this.act(options[0]);
    if (r.target === 'emptyAdjacent') {
      this.closeModal(); this.mode = { kind: 'riteTarget', rite: id, options };
      this.world.setSelection({ targets: [...new Set(options.flatMap((o) => o.targets.map((t) => t.plot)))] }); this.refresh(); return;
    }
    this.choose(r.name, r.text, options.map((o) => ({ label: this.describe(o), action: o })));
  }
  showRival(i) {
    const v = this.view; const x = v.houses[i]; const H = HOUSES[x.name];
    this.modal([h('div', { class: 'house-head', style: { justifyContent: 'center' } }, h('img', { src: img.shield(x.name), alt: '' }), h('div', {}, h('h2', {}, `House ${dn(x.name)}`), h('div', { class: 'it' }, `the ${H.title} · "${LORE[x.name].words}"`))),
      h('p', { class: 'lede' }, `${lordName(x)}, ${TRAITS[x.lord.trait].name.toLowerCase()} lord of ${LORE[x.name].seat}: ${TRAITS[x.lord.trait].text}.`),
      h('p', { class: 'small it', style: { textAlign: 'center' } }, LORE[x.name].history),
      h('p', { class: 'small', style: { textAlign: 'center' } }, H.blurb),
      v.rules === 'expanded' ? h('p', { class: 'small', style: { textAlign: 'center' } }, `Regards you as ${attitude(x.regard[this.me] || 0).word.toLowerCase()}${x.pacts.length ? ` · Pacts with ${x.pacts.map((p) => dn(v.houses[p.with].name)).join(', ')}` : ''}${x.oaths ? ` · has broken ${x.oaths} oath${x.oaths > 1 ? 's' : ''}` : ''}.`) : null,
      h('div', { class: 'heir', style: { justifyContent: 'center' } }, h('img', { src: img.heir(x.name, x.heir.status === '?' ? '?' : x.heir.status), alt: '' }), h('div', {}, h('b', {}, `Heir, ${heirName(this.state, this.state.houses[x.i])}: `), this.heirText(x, v))),
      h('p', { class: 'small it', style: { textAlign: 'center' } }, `Its counsel: ${PERSONA[x.name]?.style || ''}`),
      h('div', { class: 'coffer' }, RES.map((r) => h('div', { title: RES_NAME[r] }, icon(img.res(r)), String(x.coffer[r])))),
      h('ul', { class: 'facts' },
        h('li', {}, h('span', {}, 'Renown · Favor'), h('span', {}, `${x.renown} · ${x.favor}`)),
        h('li', {}, h('span', {}, 'Markers · Legions'), h('span', {}, `${E.totalMarkers(this.state, i)} · ${E.totalLegions(this.state, i)}`)),
        h('li', {}, h('span', {}, 'Dynasty'), h('span', {}, x.dynasty ? 'Held' : 'None')),
        h('li', {}, h('span', {}, 'Heir'), h('span', {}, this.heirText(x, v))),
        h('li', {}, h('span', {}, 'Cards'), h('span', {}, `${x.rites} Rites · ${x.invHand} Investigation`)),
        H.cabal ? h('li', {}, h('span', {}, 'Cabal'), h('span', {}, x.cabalExposed ? `${x.cabalTokens} tokens, exposed` : 'unknown')) : null,
        h('li', {}, h('span', {}, 'Renown by source'), h('span', {}, Object.entries(x.renownBy).map(([k, n]) => `${k} ${n}`).join(', ') || 'none yet')),
        h('li', {}, h('span', {}, 'Wins by · weak at'), h('span', { class: 'it' }, `${H.winsBy} · ${H.weakAt}`))),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => this.closeModal() }, 'Close'))]);
  }
  showEnvoy(options) {
    const me = this.state.houses[this.me];
    const byT = new Map(); for (const o of options) { if (!byT.has(o.target)) byT.set(o.target, []); byT.get(o.target).push(o); }
    let target = [...byT.keys()][0], gift = null;
    const body = h('div');
    const render = () => {
      const x = this.state.houses[target]; const a = attitude(x.regard[this.me] || 0);
      const gifts = byT.get(target).map((o) => o.gift);
      put(clear(body),
        h('div', { class: 'pick-list' }, [...byT.keys()].map((i) => { const y = this.state.houses[i]; return h('button', { class: `btn${i === target ? ' pending act' : ''}`, onclick: () => { target = i; gift = null; render(); } },
          h('img', { src: img.shield(y.name), class: 'icon lg', alt: '' }), `${dn(y.name)} · ${lordName(y)} (${TRAITS[y.lord.trait].name}) · regards you as ${attitude(y.regard[this.me] || 0).word.toLowerCase()}`); })),
        h('p', { class: 'lede' }, `${lordName(x)} is ${TRAITS[x.lord.trait].text}. They regard you as ${a.word.toLowerCase()}.${me.oaths ? ' Your broken oaths are remembered.' : ''}`),
        h('div', { class: 'setup-row' }, h('span', { class: 'it' }, 'A gift to sweeten it:'),
          h('div', { class: 'seg' }, gifts.map((g) => h('button', { class: g === gift ? 'on' : '', onclick: () => { gift = g; render(); } }, g ? icon(img.res(g)) : 'None')))),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => this.act({ type: 'envoy', target, gift }) }, `Send the Envoy${HOUSES[me.name].vigil ? '' : ' (1 Coin)'}`), h('button', { class: 'btn', onclick: () => this.closeModal() }, 'Cancel')));
    };
    render();
    this.modal([h('h2', {}, 'Send an Envoy'), h('p', { class: 'lede' }, 'Offer a Pact: neither House may Raid the other or strike it with a Rite until the end of next Season. A Pact can be broken, at a price in Renown, Favor and every House\'s trust.'), body]);
  }
  showPact() {
    const p = this.state.pending; const from = this.state.houses[p.from];
    const a = attitude(this.state.houses[this.me].regard[p.from] || 0);
    const answer = async (accept) => { this.closeModal(); E.decide(this.state, { accept }); try { await this.present(); } catch (err) { console.error(err); } this.loop(); };
    this.modal([h('div', { style: { textAlign: 'center' } }, h('img', { src: img.shield(from.name, 160), alt: '', style: { width: '84px' } })),
      h('h2', {}, `An Envoy from ${dn(from.name)}`),
      h('p', { class: 'lede' }, `${lordName(from)} of ${LORE[from.name].seat} offers a Pact until the end of Season ${ROMAN[Math.min(12, this.state.season + 1)]}: no Raids and no Rites against each other${p.gift ? `, and sends a gift of ${RES_NAME[p.gift]} if you accept` : ''}.`),
      h('p', { class: 'small it', style: { textAlign: 'center' } }, `They are ${TRAITS[from.lord.trait].text}${from.oaths ? `, and have broken ${from.oaths} oath${from.oaths > 1 ? 's' : ''} before` : ''}. You regard them as ${a.word.toLowerCase()}.`),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => answer(true) }, 'Swear the Pact'), h('button', { class: 'btn', onclick: () => answer(false) }, 'Send them away'))], { dismiss: false });
  }
  showAccords() {
    const p = this.state.pending; const sug = new Set(suggestAccords(this.state, p.h)); const sel = new Set(sug);
    const list = h('div', { class: 'pick-list' });
    const render = () => put(clear(list), p.options.map((o) => h('button', { class: `btn${sel.has(o.house) ? ' pending act' : ''}`, onclick: () => { if (sel.has(o.house)) sel.delete(o.house); else if (sel.size < p.max) sel.add(o.house); render(); } },
      h('img', { src: img.shield(this.state.houses[o.house].name), class: 'icon lg', alt: '' }), `${dn(this.state.houses[o.house].name)}: ${o.border} shared border${o.border === 1 ? '' : 's'}${sel.has(o.house) ? ' ✓' : ''}`)));
    render();
    this.modal([h('h2', {}, 'Open Court'), h('p', { class: 'lede' }, `Choose up to ${p.max} Accords for Season ${ROMAN[this.state.season]}. Partners cannot raid you, nor you them, and each Accord pays 1 Favor at a Flood.`), list,
      h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: async () => { this.closeModal(); E.decide(this.state, { partners: [...sel] }); await this.present(); this.loop(); } }, 'Seal the Accords'))], { dismiss: false });
  }
  waitModal(content, autoMs) {
    return new Promise((res) => {
      this.modal(content, { dismiss: true }); this.modalResolve = res;
      if (autoMs) { const t = setTimeout(() => this.closeModal(), autoMs); const old = this.modalResolve; this.modalResolve = () => { clearTimeout(t); old(); }; }
    });
  }
  showEvent(id, line) {
    const ev = eventById[id];
    const card = h('div', { class: 'card event-card' }, h('img', { class: 'art', src: img.art('event', id, { id }), alt: '' }),
      h('div', { class: 'body' }, h('div', { class: 'kind' }, 'Event'), h('h4', {}, ev.name), h('p', {}, ev.text)));
    const auto = this.settings.speed === 'instant' ? 400 : 5200 * this.speedK();
    return this.waitModal([card, line ? h('p', { class: 'lede' }, line.replace(/^Event: [^.]+\. /, '')) : null, h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => this.closeModal() }, 'Continue'))], auto);
  }
  showFlood(res, v) {
    const rows = res.reaches.map((r) => {
      const reach = REACHES[r.reach - 1];
      const counts = r.counts.map((n, i) => (n ? `${dn(v.houses[i].name)} ${n}` : null)).filter(Boolean).join(', ') || 'empty';
      return h('tr', {}, h('td', {}, `${reach.roman} ${reach.name}${reach.delta ? ' (×2)' : ''}`), h('td', { class: 'small' }, counts),
        h('td', {}, r.first != null ? [h('img', { src: img.shield(v.houses[r.first].name), alt: '' }), ` +${r.pts[0]}`] : h('span', { class: 'it muted' }, 'tied or empty')),
        h('td', {}, r.second != null && r.pts[1] ? [h('img', { src: img.shield(v.houses[r.second].name), alt: '' }), ` +${r.pts[1]}`] : '–'));
    });
    const life = [];
    for (const i of res.dynasty) life.push(`${dn(v.houses[i].name)}'s Dynasty pays 1 Renown.`);
    for (const [i, n] of res.accords) life.push(`${dn(v.houses[i].name)} gains ${n} Favor from its Accords.`);
    const court = v.log.filter((l) => l.season === res.season && l.phase === 'flood' && l.kind === 'court').map((l) => l.text);
    for (const line of court) life.push(line);
    if (!res.deaths.length && res.dynasty.length) life.push('Every Dynasty holder survives the Season.');
    if (res.catastrophe) life.push(`Ember Pressure breaks at ${res.catastrophe.pressure}: ${dn(v.houses[res.catastrophe.h].name)} loses a marker${res.catastrophe.plot ? ` at ${plotById(res.catastrophe.plot).name}` : ''}.`);
    for (const b of res.bonuses) life.push(`${dn(v.houses[b.h].name)} scores ${b.why} in Reach ${REACHES[b.reach - 1].roman}.`);
    const final = res.season === 12;
    const standings = E.standings(this.state);
    return this.waitModal([h('h2', {}, `The Flood of Season ${ROMAN[res.season]}`), h('p', { class: 'lede' }, final ? 'The last Flood: first place 6, second 3, the Delta Mouth doubled.' : 'Each Reach goes to the House with strictly the most markers: 3 Renown, the Delta Mouth 6.'),
      h('table', { class: 'score-table' }, h('tr', {}, h('th', {}, 'Reach'), h('th', {}, 'Markers'), h('th', {}, 'First'), h('th', {}, 'Second')), rows),
      life.length ? [h('div', { class: 'rule' }), h('h3', { style: { textAlign: 'center', fontSize: '22px' } }, 'Life of the Houses'), h('ul', { class: 'facts' }, life.map((t) => h('li', {}, t)))] : null,
      h('div', { class: 'rule' }),
      h('p', { class: 'lede' }, `Standing: ${standings.map((x) => `${dn(x.name)} ${x.renown}`).join(' · ')}`),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => this.closeModal() }, final ? 'To the final reckoning' : 'Continue'))],
      this.settings.speed === 'instant' ? 600 : null);
  }
  showResults() {
    const s = this.state; const st = s.final.standings; const won = s.winner.includes(this.me);
    this.audio.play(won ? 'victory' : 'defeat');
    const rows = st.map((x, k) => {
      const hs = s.houses[x.i];
      return h('tr', {}, h('td', {}, `${k + 1}.`), h('td', {}, h('img', { src: img.shield(x.name), alt: '' }), ` ${dn(x.name)}${x.i === this.me ? ' (you)' : ''}`),
        h('td', {}, h('b', {}, String(x.renown))), h('td', { class: 'small' }, Object.entries(hs.renownBy).filter(([, n]) => n).map(([kk, n]) => `${kk} ${n}`).join(', ')),
        h('td', {}, String(x.markers)), h('td', {}, String(x.wealth)));
    });
    const tb = s.final.tieBreak && s.final.tieBreak !== 'shared' ? `Renown was tied; broken by ${s.final.tieBreak}.` : s.final.tieBreak === 'shared' ? 'A perfect tie: the victory is shared.' : '';
    this.modal([h('div', { style: { textAlign: 'center' } }, h('img', { src: img.shield(s.houses[s.winner[0]].name, 192), alt: '', style: { width: '110px' } })),
      h('h2', {}, won ? 'Hollowmere is yours' : `${s.winner.map((i) => dn(s.houses[i].name)).join(' and ')} take${s.winner.length > 1 ? '' : 's'} Hollowmere`),
      h('p', { class: 'lede' }, won ? 'The river bends to your banner.' : 'Your House endures, but another holds the river.', tb ? ` ${tb}` : ''),
      h('table', { class: 'score-table' }, h('tr', {}, h('th', {}, ''), h('th', {}, 'House'), h('th', {}, 'Renown'), h('th', {}, 'From'), h('th', {}, 'Markers'), h('th', {}, 'Coffer')), rows),
      h('div', { class: 'rule' }),
      h('details', {}, h('summary', { class: 'it', style: { cursor: 'pointer', textAlign: 'center', fontSize: '18px' } }, 'The Chronicle of these twelve Seasons'),
        h('ul', { class: 'facts' }, s.log.filter((l) => l.kind === 'court' || (l.kind === 'flood' && /Flood of/.test(l.text)) || /Catastrophe|breaks its Pact|Seal exposes|unmasked/.test(l.text))
          .map((l) => h('li', {}, h('span', { class: 'it muted', style: { minWidth: '44px' } }, ROMAN[l.season]), h('span', { style: { flex: 1 } }, l.text))))),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn primary', onclick: () => { this.closeModal(); localStorage.removeItem(SAVE_KEY); this.showTitle(); } }, 'A new game'),
        h('button', { class: 'btn', onclick: () => { this.closeModal(); this.newGame({ house: s.houses[this.me].name, players: s.houses.length, rivals: 'random' }); } }, 'Play the same House again'),
        h('button', { class: 'btn', onclick: () => this.closeModal() }, 'Look at the board'))], { dismiss: false });
  }
  showMenu() {
    this.audio.start(); this.audio.play('click');
    const opt = (label, key, vals, after) => h('div', { class: 'setup-row' }, h('span', { class: 'it' }, label), h('div', { class: 'seg' }, vals.map(([val, t]) => h('button', { class: this.settings[key] === val ? 'on' : '', onclick: (e) => { this.settings[key] = val; this.saveSettings(); for (const x of e.target.parentNode.children) x.classList.toggle('on', x === e.target); after?.(val); } }, t))));
    this.modal([h('h2', {}, 'Hollowmere'),
      h('div', { class: 'pick-list' },
        h('button', { class: 'btn primary', onclick: () => this.closeModal() }, 'Return to the board'),
        this.state ? h('button', { class: 'btn', onclick: () => { this.save(); this.toast('Game saved.'); this.closeModal(); } }, 'Save game') : null,
        localStorage.getItem(SAVE_KEY) ? h('button', { class: 'btn', onclick: () => { this.closeModal(); this.load(); } }, 'Load saved game') : null,
        h('button', { class: 'btn', onclick: () => { this.closeModal(); this.showRules(); } }, 'How to play'),
        h('button', { class: 'btn', onclick: () => { this.closeModal(); this.world.resetView(); } }, 'Reset the view'),
        h('button', { class: 'btn', onclick: () => this.confirm('Abandon this game?', 'Return to the title and choose again. Your autosave is kept until a new game begins.', () => this.showTitle()) }, 'New game')),
      h('div', { class: 'rule' }),
      opt('Sound', 'sound', [[true, 'On'], [false, 'Off']], (v) => this.audio.setOn(v)),
      opt('Music', 'music', [[true, 'On'], [false, 'Off']], (v) => this.audio.setMusic(v)),
      opt('Rival speed', 'speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']]),
      opt('Graphics', 'quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], [null, 'Auto']], () => this.confirm('Reload to apply?', 'The board is rebuilt at the new quality. Your game is saved first.', () => { if (this.state) this.save(); location.reload(); })),
      h('p', { class: 'small muted it', style: { textAlign: 'center' } }, 'Keys: arrows or WASD move, Q and E turn, + and − zoom, Esc cancels, R resets the view, M opens this menu.')]);
  }
  showRules() {
    const sec = (title, ...kids) => [h('h3', { style: { fontSize: '22px', marginTop: '10px' } }, title), ...kids];
    const acts = [['Build', '1 Grain, 1 Timber, 1 Stone', 'A marker on an empty Plot next to one of yours.'], ['Keep', '1 Grain, 1 Timber, 1 Stone', 'A second marker on your Plot. Keeps pay double.'], ['Muster', '2 Iron, 1 Grain (Ash 2 Iron; Maelor 3 Iron, 1 Grain)', 'A Legion on your Plot, three at most. Thorne not before Season III.'], ['Raid', '1 Iron', 'Up to two Legions into an adjacent rival Plot. Undefended: take a marker. Defended: a Skirmish of two dice plus Legions (Ash +1, Raven −1).'], ['Recapture', '1 Iron, 1 Grain', 'Flip back a lost marker with a Legion next to it.'], ['Trade', '3 for 1 (Maelor 2 for 1 once a Season)', 'At the Bank.'], ['Claim Favor', 'free, once a Season', '+1 Favor.'], ['Investigate', '1 Lore (Raven free, Verrin 2 Grain, Caddoc may pay Reed)', 'Draw an Investigation card; hold three.'], ['Play Card', 'free', 'Testimony +1 Favor, Document +1 Lore, Witness takes from the richest rival.'], ['Seal (Raven)', '1 Lore + a Seal card', "Test a rival Heir; an Impostor is exposed for +2 Renown."], ['Reveal', '2 Favor', 'Proclaim a Genuine Heir you know. +4 at the end.'], ['Rite', 'card cost', 'Cast from your hand; adds Ember Pressure.'], ['Dynasty', '3 Favor (Verrin 2), 2 Reed', '+2 Renown now, +1 each Flood. One at a time.'], ['Cabal (Sable)', '1 Coin', 'A hidden token that produces. Two at most.'], ['Vigil (Thorne)', '1 Coin', 'Learn your Heir; replace one Impostor by marriage.'], ['Pass', '1 Coin if you have one', 'Do nothing.']];
    this.modal([h('h2', {}, 'How to play Hollowmere'),
      h('p', { class: 'lede' }, 'Two to four Houses, twelve Seasons. The House with the most Renown when the twelfth Flood recedes wins.'),
      sec('A Season', h('ol', {}, h('li', {}, 'Harvest: two dice are rolled. Every Plot with that number pays its resource to each House on it: one per marker, two per marker on a Keep. A seven pays nothing. Everyone draws a Rite (hand of three).'), h('li', {}, 'Actions: in seat order, each House takes one Action, three times round.'), h('li', {}, 'Event: one of twelve Events is drawn and resolved.'), h('li', {}, 'Flood (Seasons III, VI, IX, XII): every Reach is scored, Dynasties pay, Accords pay Favor, Dynasty holders may die (one in four), and Ember Pressure is checked.'))),
      sec('Actions', h('table', { class: 'score-table' }, acts.map(([a, c, e]) => h('tr', {}, h('td', {}, h('b', {}, a)), h('td', { class: 'small it' }, c), h('td', { class: 'small' }, e))))),
      sec('Scoring', h('ul', { class: 'facts' }, h('li', {}, 'Reach at Seasons III, VI, IX: 3 for strictly the most markers.'), h('li', {}, 'Reach at Season XII: 6 first, 3 second.'), h('li', {}, 'The Delta Mouth (Reach V) doubles all Reach scoring.'), h('li', {}, 'Dynasty: 2 on purchase, 1 each Flood. A Genuine Heir revealed: 4 at the end. An Impostor succession: −2 and the Dynasty.'), h('li', {}, 'Seal: 2 per Impostor. Caddoc: 2 per Rite. Thorne: 3 when a Genuine Heir succeeds. Ash and Sable: Season XII bonuses.'), h('li', {}, 'Ties: most markers, then most resources.'))),
      sec('Heirs and magic', h('p', {}, 'Each House holds one hidden Heir from five cards: four Impostors and one Genuine. You do not know your own until a Vigil, a Seal or a succession shows it. Each Rite raises Ember Pressure; at 4 or more at a Flood the House that cast the most Rites that Season loses a marker and the Pressure resets.')),
      sec('The eight Houses', h('table', { class: 'score-table' }, HOUSE_ORDER.map((n) => h('tr', {}, h('td', {}, h('img', { src: img.shield(n), alt: '' }), ` ${dn(n)}`), h('td', { class: 'small' }, HOUSES[n].blurb))))),
      sec('Expanded rules (optional)', h('p', { class: 'small it' }, 'Additions to the original game, chosen at the start. Every one is listed in docs/RULES.md (X1 to X6).'),
        h('ul', { class: 'facts' },
          h('li', {}, 'Toil (free, once a Season): gain 1 resource your Plots produce. A House holding two Plots or fewer may take any resource.'),
          h('li', {}, 'Fortify (1 Stone, 1 Timber): wall a Plot you hold. Its defenders gain 1, and Raiders must fight even an empty walled Plot.'),
          h('li', {}, 'Envoy (1 Coin; free and twice a Season for Rosenvael): offer a Pact, with an optional gift. Partners may not Raid each other or strike each other with Rites until the end of next Season.'),
          h('li', {}, 'Oathbreaking: a Pact can be broken by Raiding or striking your partner. It costs 1 Renown and 2 Favor, and every House trusts you less.'),
          h('li', {}, 'Regard: Houses remember Raids, thefts, Seals, Pacts and betrayals. Rivals who resent you raid you sooner and refuse your Envoys.'),
          h('li', {}, 'Lords: each House is ruled by a named lord whose trait shapes how it plays. A Dynasty holder who dies is succeeded by the Heir, or by a regent if the Heir was false.'))),
      h('p', { class: 'small muted it' }, 'Where the source rules were silent or contradictory, the decisions taken are listed in docs/RULES.md.'),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => this.closeModal() }, 'Close'))]);
  }

  // ------------------------------------------------------------------ keys and saving
  onKey(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const W = this.world; const k = e.key;
    if (k === 'Escape') { if (document.getElementById('modal')) this.closeModal(); else if (this.mode) this.cancelMode(); else this.closePlot(); return; }
    if (document.getElementById('modal')) { if (k === 'Enter' || k === ' ') { const b = document.querySelector('#modal .btn.primary'); if (b) { e.preventDefault(); b.click(); } } return; }
    const step = 4;
    if (k === 'ArrowLeft' || k === 'a') W.pan(-step, 0); if (k === 'ArrowRight' || k === 'd') W.pan(step, 0);
    if (k === 'ArrowUp' || k === 'w') W.pan(0, -step); if (k === 'ArrowDown' || k === 's') W.pan(0, step);
    if (k === 'q') W.rotate(0.15); if (k === 'e') W.rotate(-0.15);
    if (k === '+' || k === '=') W.zoom(0.85); if (k === '-' || k === '_') W.zoom(1.18);
    if (k === 'r') W.resetView(); if (k === 'm') this.showMenu();
    if (k === 'f' && this.selected) W.focusPlot(this.selected);
  }
  save(quiet = false) {
    if (!this.state) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, at: Date.now(), state: this.state })); } catch (err) { if (!quiet) this.toast('Could not save: storage is full or blocked.'); }
  }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!d?.state) { this.toast('There is no saved game.'); return; }
      this.start(E.migrate(d.state));
      this.toast(`Saved game restored: Season ${ROMAN[d.state.season]}.`);
    } catch { this.toast('The saved game could not be read.'); }
  }
}

void RITES; void EVENTS;
