// Hollowmere rules engine. Pure functions over a plain-JSON state; no DOM, no rendering.
// The engine is authoritative: the UI and the AI only ever call legalActions / checkAction /
// applyAction / advance / decide. Random outcomes come from the seeded generator in state.rng.
import {
  CONFIG, RES, RES_NAME, PLOTS, ADJ, REACHES, HOUSES, RITES, riteById, EVENTS, eventById,
  INVESTIGATION, INVESTIGATION_DECK, SEATS_FOR, pips, plotById,
} from './data.js';
import * as R from './rng.js';

const C = CONFIG;
export const clone = (s) => JSON.parse(JSON.stringify(s));

// ---------------------------------------------------------------- setup

export function newGame({ houses, humans = [], seed = Date.now(), seatOrder = null } = {}) {
  if (!houses || houses.length < 2 || houses.length > 4) throw new Error('Hollowmere is for 2 to 4 Houses');
  if (new Set(houses).size !== houses.length) throw new Error('each House may be played once');
  const rng = { s: R.hashSeed(seed) };
  const seats = SEATS_FOR[houses.length];
  // "Houses are dealt to the four seats A to D at random."
  const dealt = seatOrder ? seatOrder.slice() : R.shuffle(rng, houses);
  const state = {
    v: 1, seed: String(seed), rng,
    season: 1, phase: 'harvest', round: 0, turn: 0,
    houses: [], plots: PLOTS.map((p) => ({ id: p.id, m: {}, l: {}, contests: [], cabal: null })),
    pressure: 0, riteDeck: R.shuffle(rng, RITES.map((r) => r.id)), riteDiscard: [],
    nextHarvest: [], eventLog: [], dice: null, log: [], fx: [], pending: null,
    floods: [], winner: null, final: null, seq: 0,
  };
  dealt.forEach((name, i) => {
    const H = HOUSES[name];
    const pile = R.shuffle(rng, ['G', 'I', 'I', 'I', 'I']);
    const deck = R.shuffle(rng, name === 'Raven' ? INVESTIGATION_DECK.raven : INVESTIGATION_DECK.common);
    state.houses.push({
      i, name, seat: seats[i], human: humans.includes(name),
      coffer: Object.fromEntries(RES.map((r) => [r, H.coffer[r] || 0])),
      favor: 0, renown: 0, renownBy: {},
      heir: { status: pile.pop(), serial: 1, revealed: false, knownBy: [] }, heirPile: pile, heirsLost: 0,
      dynasty: false, dynastiesBought: 0,
      rites: [], invHand: [], invDeck: deck, invDiscard: [],
      cabalTokens: 0, cabalExposed: false,
      flags: {}, ritesSeason: 0, ritesSinceReset: 0, ritesTotal: 0,
      skirmishReaches: [], accords: [], married: false,
      stats: { builds: 0, raids: 0, skirmishWon: 0, skirmishLost: 0, captures: 0, lost: 0, produced: 0, passes: 0, seals: 0, exposed: 0 },
    });
  });
  // Setup step 2: two markers on the seat Plots, one Legion on each (Thorne: one marker).
  for (const h of state.houses) {
    let seatPlots = PLOTS.filter((p) => p.seat === h.seat).map((p) => p.id);
    if (HOUSES[h.name].oneMarker) seatPlots = [seatPlots.slice().sort((a, b) => pips(plotById(b).n) - pips(plotById(a).n) || a - b)[0]];
    for (const pid of seatPlots) { addMarker(state, pid, h.i, 1); addLegion(state, pid, h.i, 1); }
    // Setup step 4: two Rite cards.
    for (let k = 0; k < C.riteOpeningHand; k++) drawRite(state, h);
  }
  log(state, null, `Twelve Seasons begin. ${state.houses.map((h) => `${h.name} holds seat ${h.seat}`).join(', ')}.`);
  advance(state);
  return state;
}

// ---------------------------------------------------------------- small helpers

function log(state, h, text, kind = 'info') {
  state.log.push({ n: ++state.seq, season: state.season, phase: state.phase, h: h == null ? null : h, text, kind });
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}
// e.to = [houses] limits who may see the details of an effect (see view()).
function fx(state, e) { state.fx.push({ ...e, n: ++state.seq }); if (state.fx.length > 200) state.fx.splice(0, state.fx.length - 200); }
const hname = (state, i) => state.houses[i].name;
export const markersOn = (state, pid, h) => state.plots[pid - 1].m[h] || 0;
export const legionsOn = (state, pid, h) => state.plots[pid - 1].l[h] || 0;
export const holds = (state, pid, h) => markersOn(state, pid, h) > 0;
export const isEmpty = (state, pid) => Object.values(state.plots[pid - 1].m).every((n) => !n);
export const heldPlots = (state, h) => state.plots.filter((p) => (p.m[h] || 0) > 0).map((p) => p.id);
export const totalMarkers = (state, h) => state.plots.reduce((a, p) => a + (p.m[h] || 0), 0);
export const totalLegions = (state, h) => state.plots.reduce((a, p) => a + (p.l[h] || 0), 0);
export const wealth = (house) => RES.reduce((a, r) => a + house.coffer[r], 0);
export const isFloodSeason = (s) => C.floodSeasons.includes(s);
export const currentHouse = (state) => (state.phase === 'actions' ? state.houses[state.turn] : null);

function addMarker(state, pid, h, n = 1) { const p = state.plots[pid - 1]; p.m[h] = (p.m[h] || 0) + n; }
function addLegion(state, pid, h, n = 1) { const p = state.plots[pid - 1]; p.l[h] = (p.l[h] || 0) + n; }
function removeMarker(state, pid, h, n = 1) {
  const p = state.plots[pid - 1];
  p.m[h] = Math.max(0, (p.m[h] || 0) - n);
  if (!p.m[h]) {
    delete p.m[h];
    // Legions are stationed on Plots their House holds; with the last marker gone they disband (R13).
    if (p.l[h]) { fx(state, { t: 'disband', plot: pid, h, n: p.l[h] }); delete p.l[h]; }
    p.contests = p.contests.filter((c) => c.captor !== h);
  }
}
function removeLegions(state, pid, h, n) {
  const p = state.plots[pid - 1];
  p.l[h] = Math.max(0, (p.l[h] || 0) - n);
  if (!p.l[h]) delete p.l[h];
}
function gainRenown(state, h, n, why) {
  if (!n) return;
  const house = state.houses[h];
  house.renown += n;
  house.renownBy[why] = (house.renownBy[why] || 0) + n;
  fx(state, { t: 'renown', h, n, why });
}
function canPay(house, cost) { return Object.entries(cost).every(([r, n]) => house.coffer[r] >= n); }
function pay(house, cost) { for (const [r, n] of Object.entries(cost)) house.coffer[r] -= n; }
export const costText = (cost) => Object.entries(cost).filter(([, n]) => n).map(([r, n]) => `${n} ${RES_NAME[r]}`).join(', ') || 'free';

function drawRite(state, house) {
  if (house.rites.length >= C.riteHandLimit) return null;
  if (!state.riteDeck.length) { state.riteDeck = R.shuffle(state.rng, state.riteDiscard); state.riteDiscard = []; }
  if (!state.riteDeck.length) return null;
  const id = state.riteDeck.pop();
  house.rites.push(id);
  return id;
}
function drawInvestigation(state, house) {
  if (!house.invDeck.length) { house.invDeck = R.shuffle(state.rng, house.invDiscard); house.invDiscard = []; }
  const c = house.invDeck.pop();
  house.invHand.push(c);
  return c;
}
function newHeir(state, house) {
  // Draw the next Heir card from the House's own pile. A pile emptied of Impostors leaves the Genuine.
  const status = house.heirPile.length ? house.heirPile.pop() : 'G';
  house.heir = { status, serial: house.heir.serial + 1, revealed: false, knownBy: [] };
}

// Cost helpers that depend on the House.
export function musterCost(house) { return HOUSES[house.name].muster || { I: 2, G: 1 }; }
// Caddoc may pay Reed for any part of a Lore cost: every split of the Lore between Lore and Reed.
function loreSplits(house, cost) {
  if (!HOUSES[house.name].reedForLore || !cost.L) return [cost];
  const out = [];
  for (let reed = 0; reed <= cost.L; reed++) {
    const c = { ...cost }; c.L = cost.L - reed; c.R = (cost.R || 0) + reed;
    if (!c.L) delete c.L;
    out.push(c);
  }
  return out;
}
export function investigateCosts(house) {
  const H = HOUSES[house.name];
  if (H.investigateCost) return [H.investigateCost];             // Raven free, Verrin 2 Grain
  return loreSplits(house, { L: 1 });                             // Caddoc may pay Reed for Lore
}
export function riteCosts(house, rite) { return loreSplits(house, rite.cost); }
function firstPayable(house, opts) { return opts.find((c) => canPay(house, c)); }
export const dynastyFavor = (house) => HOUSES[house.name].dynastyFavor || 3;
export const tradeRate = (house) => (HOUSES[house.name].writ && !house.flags.writ ? 2 : 3);
export const riteMaker = (house, rite) => (HOUSES[house.name].halfPressure ? rite.pressure / 2 : rite.pressure);

export function hasAccord(state, a, b) {
  return state.houses[a].accords.includes(b) || state.houses[b].accords.includes(a);
}
export function richestRival(state, h, rng = state.rng) {
  const rivals = state.houses.filter((x) => x.i !== h);
  const top = Math.max(...rivals.map(wealth));
  if (top <= 0) return null;
  return R.pick(rng, rivals.filter((x) => wealth(x) === top)).i;
}
function takeRandom(state, from, to, n) {
  const got = [];
  for (let k = 0; k < n; k++) {
    const pool = RES.flatMap((r) => Array(state.houses[from].coffer[r]).fill(r));
    if (!pool.length) break;
    const r = R.pick(state.rng, pool);
    state.houses[from].coffer[r]--; if (to != null) state.houses[to].coffer[r]++;
    got.push(r);
  }
  return got;
}

// ---------------------------------------------------------------- actions

export const ACTION_TYPES = [
  'build', 'keep', 'muster', 'raid', 'recapture', 'trade', 'favor', 'investigate', 'play',
  'seal', 'reveal', 'rite', 'dynasty', 'cabal', 'vigil', 'pass',
];
export const ACTION_LABEL = {
  build: 'Build', keep: 'Keep', muster: 'Muster', raid: 'Raid', recapture: 'Recapture', trade: 'Trade',
  favor: 'Claim Favor', investigate: 'Investigate', play: 'Play Card', seal: 'Seal', reveal: 'Reveal Heir',
  rite: 'Rite', dynasty: 'Dynasty', cabal: 'Cabal', vigil: 'Vigil', pass: 'Pass',
};

// Why an action type cannot be taken right now, or null if at least one form of it can.
// The UI shows these strings to explain unavailable actions.
export function whyNot(state, h, type) {
  const house = state.houses[h]; const H = HOUSES[house.name];
  if (state.phase !== 'actions') return 'It is not the Action phase.';
  if (state.turn !== h) return `It is ${hname(state, state.turn)}'s Action.`;
  const opts = optionsFor(state, h, type);
  if (opts.length) return null;
  const mine = heldPlots(state, h);
  switch (type) {
    case 'build': case 'keep':
      if (!canPay(house, C.buildCost)) return `Needs ${costText(C.buildCost)}.`;
      if (type === 'keep') return mine.length ? 'Every Plot you hold already has a Keep.' : 'You hold no Plot.';
      return mine.length ? 'No empty Plot touches one of yours.' : 'You hold no Plot to build from.';
    case 'muster':
      if (H.musterFrom && state.season < H.musterFrom) return `${house.name} cannot Muster before Season ${H.musterFrom}.`;
      if (!canPay(house, musterCost(house))) return `Needs ${costText(musterCost(house))}.`;
      return `Every Plot you hold already has ${C.legionCapPerPlot} Legions.`;
    case 'raid':
      if (house.coffer.I < 1) return 'Needs 1 Iron.';
      if (!totalLegions(state, h)) return 'You have no Legions.';
      return 'No rival markers next to your Legions (Accord partners cannot be raided).';
    case 'recapture':
      if (!canPay(house, C.recaptureCost)) return `Needs ${costText(C.recaptureCost)}.`;
      return 'You have no lost marker with one of your Legions on a held Plot next to it.';
    case 'trade': return `Needs ${tradeRate(house)} of one resource.`;
    case 'favor': return 'Favor already claimed this Season.';
    case 'investigate':
      if (house.invHand.length >= C.investigationHandLimit) return 'Your Investigation hand is full (three).';
      return `Needs ${investigateCosts(house).map(costText).join(' or ')}.`;
    case 'play': return house.invHand.length ? 'Seal cards are spent by the Seal action.' : 'You hold no Investigation card.';
    case 'seal':
      if (!H.seal) return 'Only Raven can Seal.';
      if (!house.invHand.includes('seal')) return 'Needs a Seal card from Investigation.';
      if (house.coffer.L < 1) return 'Needs 1 Lore.';
      return 'No rival Heir is left to test.';
    case 'reveal':
      if (house.heir.revealed) return 'Your Heir is already revealed.';
      if (!house.heir.knownBy.includes(h)) return 'You do not know whether your Heir is Genuine.';
      if (house.heir.status !== 'G') return 'Your Heir is an Impostor.';
      return `Needs ${C.revealCostFavor} Favor.`;
    case 'rite':
      if (!house.rites.length) return 'You hold no Rite card.';
      return 'You cannot pay for any Rite in your hand, or it has no target.';
    case 'dynasty':
      if (house.dynasty) return 'You already hold a Dynasty (one at a time).';
      return `Needs ${dynastyFavor(house)} Favor and ${C.dynastyCostReed} Reed.`;
    case 'cabal':
      if (!H.cabal) return 'Only Sable has a Cabal.';
      if (house.cabalTokens >= C.cabalMax) return `Both Cabal tokens are placed.`;
      if (house.coffer.C < C.cabalCostCoin) return 'Needs 1 Coin.';
      return 'No Plot on or next to yours is free of a Cabal token.';
    case 'vigil':
      if (!H.vigil) return 'Only Thorne keeps Vigil.';
      if (house.flags.vigil) return 'Vigil already kept this Season.';
      if (house.heir.knownBy.includes(h)) return 'You already know your Heir.';
      return 'Needs 1 Coin.';
    case 'pass': return null;
    default: return 'Unknown action.';
  }
}

// Every concrete, legal form of one action type for House h.
export function optionsFor(state, h, type) {
  if (state.phase !== 'actions' || state.turn !== h || state.pending) return [];
  const house = state.houses[h]; const H = HOUSES[house.name];
  const mine = heldPlots(state, h);
  const out = [];
  switch (type) {
    case 'build':
      if (!canPay(house, C.buildCost)) break;
      for (const pid of emptyAdjacent(state, h)) out.push({ type, plot: pid });
      break;
    case 'keep':
      if (!canPay(house, C.buildCost)) break;
      for (const pid of mine) if (markersOn(state, pid, h) < C.keepCap) out.push({ type, plot: pid });
      break;
    case 'muster':
      if (H.musterFrom && state.season < H.musterFrom) break;
      if (!canPay(house, musterCost(house))) break;
      for (const pid of mine) if (legionsOn(state, pid, h) < C.legionCapPerPlot) out.push({ type, plot: pid });
      break;
    case 'raid': {
      if (house.coffer.I < 1) break;
      for (const p of state.plots) {
        const have = p.l[h] || 0; if (!have) continue;
        for (const to of ADJ[p.id - 1]) {
          for (const [tk, m] of Object.entries(state.plots[to - 1].m)) {
            const t = +tk; if (t === h || !m || hasAccord(state, h, t)) continue;
            const room = C.legionCapPerPlot - legionsOn(state, to, h);
            for (let n = 1; n <= Math.min(C.raidMaxLegions, have, room); n++) out.push({ type, from: p.id, to, target: t, n });
          }
        }
      }
      break;
    }
    case 'recapture':
      if (!canPay(house, C.recaptureCost)) break;
      for (const p of state.plots) {
        if (!p.contests.some((c) => c.victim === h && (p.m[c.captor] || 0) > 0)) continue;
        if (ADJ[p.id - 1].some((q) => holds(state, q, h) && legionsOn(state, q, h) > 0)) out.push({ type, plot: p.id });
      }
      break;
    case 'trade': {
      const rate = tradeRate(house);
      for (const give of RES) if (house.coffer[give] >= rate) for (const get of RES) if (get !== give) out.push({ type, give, get });
      break;
    }
    case 'favor': if (!house.flags.favor) out.push({ type }); break;
    case 'investigate':
      if (house.invHand.length >= C.investigationHandLimit) break;
      if (firstPayable(house, investigateCosts(house))) out.push({ type });
      break;
    case 'play':
      house.invHand.forEach((c, idx) => { if (c !== 'seal' && !out.some((o) => o.card === c)) out.push({ type, card: c }); });
      break;
    case 'seal':
      if (!H.seal || !house.invHand.includes('seal') || house.coffer.L < 1) break;
      for (const x of state.houses) if (x.i !== h && !x.heir.revealed) out.push({ type, target: x.i });
      break;
    case 'reveal':
      if (!house.heir.revealed && house.heir.status === 'G' && house.heir.knownBy.includes(h) && house.favor >= C.revealCostFavor) out.push({ type });
      break;
    case 'rite':
      for (const id of new Set(house.rites)) {
        const rite = riteById[id];
        if (!firstPayable(house, riteCosts(house, rite))) continue;
        for (const targets of riteTargetSets(state, h, rite)) out.push({ type, rite: id, targets });
      }
      break;
    case 'dynasty':
      if (!house.dynasty && house.favor >= dynastyFavor(house) && house.coffer.R >= C.dynastyCostReed) out.push({ type });
      break;
    case 'cabal': {
      if (!H.cabal || house.cabalTokens >= C.cabalMax || house.coffer.C < C.cabalCostCoin) break;
      const near = new Set(mine.flatMap((pid) => [pid, ...ADJ[pid - 1]]));
      for (const pid of [...near].sort((a, b) => a - b)) if (state.plots[pid - 1].cabal == null) out.push({ type, plot: pid });
      break;
    }
    case 'vigil':
      if (H.vigil && !house.flags.vigil && !house.heir.knownBy.includes(h) && house.coffer.C >= 1) out.push({ type });
      break;
    case 'pass': out.push({ type }); break;
  }
  return out;
}

export function emptyAdjacent(state, h) {
  const set = new Set();
  for (const pid of heldPlots(state, h)) for (const q of ADJ[pid - 1]) if (isEmpty(state, q)) set.add(q);
  return [...set].sort((a, b) => a - b);
}
function rivalMarkerSpots(state, h) {
  const near = new Set(heldPlots(state, h).flatMap((pid) => ADJ[pid - 1]));
  const spots = [];
  for (const pid of [...near].sort((a, b) => a - b)) for (const [tk, m] of Object.entries(state.plots[pid - 1].m)) if (+tk !== h && m) spots.push({ plot: pid, house: +tk });
  return spots;
}
// Target choices for a Rite. "Up to" removals may also be cast with fewer (or no) targets.
export function riteTargetSets(state, h, rite) {
  if (rite.target === 'emptyAdjacent') return emptyAdjacent(state, h).map((pid) => [{ plot: pid }]);
  if (rite.target === 'rivalAdjacent') {
    const spots = rivalMarkerSpots(state, h);
    const sets = [[]];
    spots.forEach((a) => sets.push([a]));
    if (rite.count >= 2) {
      for (let i = 0; i < spots.length; i++) for (let j = i; j < spots.length; j++) {
        const a = spots[i], b = spots[j];
        if (i === j && markersOn(state, a.plot, a.house) < 2) continue;  // two from one Plot needs two markers there
        sets.push([a, b]);
      }
    }
    return sets;
  }
  return [[]];
}

export function legalActions(state, h = state.turn) {
  return ACTION_TYPES.flatMap((t) => optionsFor(state, h, t));
}
export function actionCatalog(state, h = state.turn) {
  return ACTION_TYPES.filter((t) => t !== 'seal' || HOUSES[state.houses[h].name].seal)
    .filter((t) => t !== 'cabal' || HOUSES[state.houses[h].name].cabal)
    .filter((t) => t !== 'vigil' || HOUSES[state.houses[h].name].vigil)
    .map((t) => { const options = optionsFor(state, h, t); return { type: t, label: ACTION_LABEL[t], ok: options.length > 0, reason: options.length ? null : whyNot(state, h, t), options }; });
}

const sameAction = (a, b) => JSON.stringify(normal(a)) === JSON.stringify(normal(b));
function normal(a) {
  const o = { ...a }; delete o.label;
  if (o.targets) o.targets = o.targets.map((t) => ({ plot: t.plot, house: t.house }));
  return Object.keys(o).sort().reduce((x, k) => ((x[k] = o[k]), x), {});
}
export function checkAction(state, action) {
  const h = state.turn;
  if (state.phase !== 'actions') return { ok: false, reason: 'It is not the Action phase.' };
  if (state.pending) return { ok: false, reason: 'A choice must be made first.' };
  if (!ACTION_TYPES.includes(action.type)) return { ok: false, reason: 'Unknown action.' };
  const opts = optionsFor(state, h, action.type);
  if (opts.some((o) => sameAction(o, action))) return { ok: true };
  return { ok: false, reason: whyNot(state, h, action.type) || 'That move is not legal here.' };
}

// Apply one Action for the House whose turn it is. opts.skirmish ('win' | 'lose') forces a
// Skirmish result (used by the AI to weigh outcomes; never by the game itself).
export function applyAction(state, action, opts = {}) {
  const chk = checkAction(state, action);
  if (!chk.ok) throw new Error(`Illegal action ${action.type}: ${chk.reason}`);
  const h = state.turn; const house = state.houses[h]; const me = house.name;
  const P = (pid) => plotById(pid).name;
  switch (action.type) {
    case 'build':
      pay(house, C.buildCost); addMarker(state, action.plot, h); house.stats.builds++;
      log(state, h, `${me} builds on ${P(action.plot)}.`); fx(state, { t: 'build', h, plot: action.plot });
      break;
    case 'keep':
      pay(house, C.buildCost); addMarker(state, action.plot, h); house.stats.builds++;
      log(state, h, `${me} raises a Keep at ${P(action.plot)}.`); fx(state, { t: 'keep', h, plot: action.plot });
      break;
    case 'muster':
      pay(house, musterCost(house)); addLegion(state, action.plot, h);
      log(state, h, `${me} musters a Legion at ${P(action.plot)}.`); fx(state, { t: 'muster', h, plot: action.plot });
      break;
    case 'raid': resolveRaid(state, h, action, opts); break;
    case 'recapture': {
      pay(house, C.recaptureCost);
      const p = state.plots[action.plot - 1];
      const ct = p.contests.find((c) => c.victim === h && (p.m[c.captor] || 0) > 0); const captor = ct.captor;
      p.contests = p.contests.filter((c) => c !== ct);
      removeMarker(state, action.plot, captor);
      if (markersOn(state, action.plot, h) < C.keepCap) addMarker(state, action.plot, h);   // R28: never above a Keep
      log(state, h, `${me} recaptures ${P(action.plot)} from ${hname(state, captor)}.`, 'war');
      fx(state, { t: 'recapture', h, plot: action.plot, from: captor });
      break;
    }
    case 'trade': {
      const rate = tradeRate(house);
      if (HOUSES[me].writ && rate === 2) house.flags.writ = true;
      house.coffer[action.give] -= rate; house.coffer[action.get] += 1;
      log(state, h, `${me} trades ${rate} ${RES_NAME[action.give]} for 1 ${RES_NAME[action.get]}${rate === 2 ? " (Merchant's Writ)" : ''}.`);
      fx(state, { t: 'trade', h, give: action.give, get: action.get, rate });
      break;
    }
    case 'favor':
      house.flags.favor = true; house.favor += 1;
      log(state, h, `${me} claims Favor at court.`); fx(state, { t: 'favor', h, n: 1 });
      break;
    case 'investigate': {
      pay(house, firstPayable(house, investigateCosts(house)));
      const c = drawInvestigation(state, house);
      log(state, h, `${me} investigates.`, 'intrigue'); fx(state, { t: 'investigate', h, card: c, to: [h] });
      break;
    }
    case 'play': {
      house.invHand.splice(house.invHand.indexOf(action.card), 1); house.invDiscard.push(action.card);
      if (action.card === 'testimony') { house.favor += 1; log(state, h, `${me} plays a Testimony: +1 Favor.`, 'intrigue'); }
      if (action.card === 'document') { house.coffer.L += 1; log(state, h, `${me} plays a Document: +1 Lore.`, 'intrigue'); }
      if (action.card === 'witness') {
        const t = richestRival(state, h);
        const got = t == null ? [] : takeRandom(state, t, h, 1);
        let extra = '';
        if (t != null && HOUSES[hname(state, t)].cabal && state.houses[t].cabalTokens && !state.houses[t].cabalExposed) {
          state.houses[t].cabalExposed = true; extra = ' The Sable Cabal is exposed.';
        }
        log(state, h, `${me} calls a Witness against ${t == null ? 'no one' : hname(state, t)}${got.length ? ` and takes 1 ${RES_NAME[got[0]]}` : ''}.${extra}`, 'intrigue');
      }
      fx(state, { t: 'play', h, card: action.card });
      break;
    }
    case 'seal': {
      house.coffer.L -= 1; house.invHand.splice(house.invHand.indexOf('seal'), 1); house.invDiscard.push('seal');
      house.stats.seals++;
      const tgt = state.houses[action.target];
      if (tgt.heir.status === 'I') {
        log(state, h, `${me}'s Seal exposes ${tgt.name}'s Heir as an Impostor.`, 'intrigue');
        gainRenown(state, h, C.sealRenown, 'Seals'); house.stats.exposed++;
        tgt.heirsLost++; newHeir(state, tgt);
        fx(state, { t: 'seal', h, target: tgt.i, result: 'I' });
      } else {
        for (const k of [h, tgt.i]) if (!tgt.heir.knownBy.includes(k)) tgt.heir.knownBy.push(k);
        log(state, h, `${me}'s Seal tests ${tgt.name}'s Heir. The result is kept private.`, 'intrigue');
        fx(state, { t: 'seal', h, target: tgt.i, result: 'G', to: [h, tgt.i] });
      }
      break;
    }
    case 'reveal':
      house.favor -= C.revealCostFavor; house.heir.revealed = true;
      log(state, h, `${me} proclaims its Genuine Heir before the court.`, 'intrigue'); fx(state, { t: 'reveal', h });
      break;
    case 'rite': castRite(state, h, action); break;
    case 'dynasty':
      house.favor -= dynastyFavor(house); house.coffer.R -= C.dynastyCostReed; house.dynasty = true; house.dynastiesBought++;
      gainRenown(state, h, C.dynastyPurchaseRenown, 'Dynasty');
      log(state, h, `${me} founds a Dynasty.`, 'court'); fx(state, { t: 'dynasty', h });
      break;
    case 'cabal':
      house.coffer.C -= C.cabalCostCoin; house.cabalTokens++; state.plots[action.plot - 1].cabal = h;
      log(state, h, `${me} moves in the shadows.`, 'intrigue'); fx(state, { t: 'cabal', h, plot: action.plot, to: [h] });
      break;
    case 'vigil': {
      house.coffer.C -= 1; house.flags.vigil = true;
      house.heir.knownBy.push(h);
      let text = `${me} keeps a Vigil over its Heir.`;
      if (house.heir.status === 'I' && !house.married) {
        house.married = true; house.heirsLost++; newHeir(state, house);
        text += ' A marriage brings a second claimant into the line.';
        fx(state, { t: 'vigil', h, result: 'remarried', to: [h] });
      } else fx(state, { t: 'vigil', h, result: 'known', to: [h] });
      log(state, h, text, 'court');
      break;
    }
    case 'pass': {
      const paid = house.coffer.C >= C.passCostCoin ? C.passCostCoin : 0;
      house.coffer.C -= paid; house.stats.passes++;
      log(state, h, `${me} passes${paid ? ' and pays 1 Coin' : ''}.`); fx(state, { t: 'pass', h });
      break;
    }
  }
  endTurn(state);
  return state;
}

function resolveRaid(state, h, a, opts) {
  const house = state.houses[h]; const me = house.name; const tgt = a.target; const reach = plotById(a.to).reach;
  house.coffer.I -= 1; house.stats.raids++;
  removeLegions(state, a.from, h, a.n);
  const dLeg = legionsOn(state, a.to, tgt);
  const tp = state.plots[a.to - 1];
  const capture = () => {
    removeMarker(state, a.to, tgt);
    if (markersOn(state, a.to, h) < C.keepCap) addMarker(state, a.to, h);   // R28: a capture never makes a third marker
    if (!tp.contests.some((c) => c.victim === tgt && c.captor === h)) tp.contests.push({ victim: tgt, captor: h });
    house.stats.captures++; state.houses[tgt].stats.lost++;
  };
  if (!dLeg) {
    addLegion(state, a.to, h, a.n); capture();
    log(state, h, `${me} raids ${plotById(a.to).name}, finds it undefended, and takes a marker from ${hname(state, tgt)}.`, 'war');
    fx(state, { t: 'raid', h, from: a.from, to: a.to, target: tgt, n: a.n, defended: false, won: true });
    return;
  }
  const am = HOUSES[me].skirmish || 0, dm = HOUSES[hname(state, tgt)].skirmish || 0;
  const already = legionsOn(state, a.to, h);   // R26: the raider's Legions already on the Plot fight too
  const rolls = [];
  let won = false;
  for (let guard = 0; guard < 50; guard++) {
    const ar = [R.d6(state.rng), R.d6(state.rng)], dr = [R.d6(state.rng), R.d6(state.rng)];
    const at = ar[0] + ar[1] + Math.min(a.n + already, 3) + am, dt = dr[0] + dr[1] + Math.min(dLeg, 3) + dm;
    rolls.push({ ar, dr, at, dt });
    if (at !== dt) { won = at > dt; break; }
  }
  if (opts.skirmish) won = opts.skirmish === 'win';
  if (won) {
    removeLegions(state, a.to, tgt, dLeg);
    const stay = Math.ceil(a.n / 2);
    addLegion(state, a.to, h, stay); capture();
    if (!house.skirmishReaches.includes(reach)) house.skirmishReaches.push(reach);
    house.stats.skirmishWon++; state.houses[tgt].stats.skirmishLost++;
    log(state, h, `${me} wins a Skirmish at ${plotById(a.to).name} (${rolls.at(-1).at} to ${rolls.at(-1).dt}) and takes a marker from ${hname(state, tgt)}.`, 'war');
  } else {
    removeLegions(state, a.to, tgt, Math.floor(dLeg / 2));
    house.stats.skirmishLost++; state.houses[tgt].stats.skirmishWon++;
    log(state, h, `${me}'s Raid on ${plotById(a.to).name} is thrown back (${rolls.at(-1).at} to ${rolls.at(-1).dt}).`, 'war');
  }
  fx(state, { t: 'raid', h, from: a.from, to: a.to, target: tgt, n: a.n, defended: true, dLeg, won, rolls, am, dm });
}

function castRite(state, h, a) {
  const house = state.houses[h]; const rite = riteById[a.rite]; const me = house.name;
  pay(house, firstPayable(house, riteCosts(house, rite)));
  house.rites.splice(house.rites.indexOf(a.rite), 1); state.riteDiscard.push(a.rite);
  const p = riteMaker(house, rite);
  state.pressure += p; house.ritesSeason++; house.ritesSinceReset++; house.ritesTotal++;
  let text = `${me} casts ${rite.name}.`;
  switch (rite.id) {
    case 'ledger_ink': house.coffer.C += 2; break;
    case 'ironveil_oath': house.coffer.I += 2; break;
    case 'verdant_bloom': house.coffer.G += 3; break;
    case 'star_chart': case 'gilt_ledger': house.favor += 1; break;
    case 'reed_oath': gainRenown(state, h, 1, 'Rites'); break;
    case 'mist_veil': case 'drowned_choir': {
      const t = richestRival(state, h);
      const got = t == null ? [] : takeRandom(state, t, h, rite.id === 'mist_veil' ? 1 : 2);
      if (t != null) text += ` ${got.map((r) => RES_NAME[r]).join(' and ') || 'Nothing'} slips from ${hname(state, t)}'s Coffer.`;
      break;
    }
    case 'silent_barge':
      for (const t of a.targets) { addMarker(state, t.plot, h); text += ` A marker drifts ashore at ${plotById(t.plot).name}.`; }
      break;
    case 'heron_cry': case 'ashen_pyre':
      for (const t of a.targets) { removeMarker(state, t.plot, t.house); text += ` ${hname(state, t.house)} loses a marker at ${plotById(t.plot).name}.`; }
      break;
    case 'ink_of_names': {
      const cands = state.houses.filter((x) => x.i !== h && !x.heir.revealed);
      if (cands.length) {
        const t = R.pick(state.rng, cands);
        if (t.heir.status === 'I') {
          text += ` ${t.name}'s Heir is unmasked as an Impostor.`; gainRenown(state, h, C.sealRenown, 'Rites');
          t.heirsLost++; newHeir(state, t);
        } else { t.heir.revealed = true; t.heir.knownBy = state.houses.map((x) => x.i); text += ` ${t.name}'s Heir is shown to be Genuine.`; }
      }
      break;
    }
  }
  if (HOUSES[me].riteRenown) gainRenown(state, h, HOUSES[me].riteRenown, 'Rites');
  log(state, h, text, 'magic');
  fx(state, { t: 'rite', h, rite: rite.id, targets: a.targets || [], pressure: state.pressure });
}

function endTurn(state) {
  state.turn++;
  if (state.turn >= state.houses.length) { state.turn = 0; state.round++; }
  if (state.round >= C.actionsPerSeason) { state.phase = 'event'; state.round = 0; state.turn = 0; }
  advance(state);
}

// ---------------------------------------------------------------- phases

// Resolve every phase that needs no decision. Stops at an Action, a pending choice, or the end.
export function advance(state) {
  for (let guard = 0; guard < 20; guard++) {
    if (state.pending || state.phase === 'over' || state.phase === 'actions') return state;
    if (state.pauseAt && state.pauseAt.includes(state.phase)) return state;   // the UI and tests may hold a phase
    if (state.phase === 'harvest') harvest(state);
    else if (state.phase === 'event') eventPhase(state);
    else if (state.phase === 'flood') flood(state);
  }
  return state;
}

function harvest(state) {
  for (const h of state.houses) { h.flags = {}; h.ritesSeason = 0; h.accords = []; }
  const d = [R.d6(state.rng), R.d6(state.rng)]; const n = d[0] + d[1];
  state.dice = d;
  const mods = state.nextHarvest; state.nextHarvest = [];
  const gains = state.houses.map(() => ({}));
  const pub = state.houses.map(() => ({}));   // what rivals see: Cabal yield stays hidden until exposed
  if (n !== 7) {
    for (const p of PLOTS) {
      if (p.n !== n) continue;
      const plot = state.plots[p.id - 1];
      for (const h of state.houses) {
        if (p.res === 'L' && HOUSES[h.name].noLore) continue;           // Verrin draws no Lore
        const m = plot.m[h.i] || 0;
        const cab = plot.cabal === h.i ? 1 : 0;                          // a Cabal token produces like a marker
        const yieldOf = (markers, tokens) => {
          let amt = (markers >= 2 ? markers * 2 : markers) + tokens;    // one per marker; two per marker on a Keep
          if (!amt) return {};
          const gain = { [p.res]: amt };
          if (p.res === 'G' && HOUSES[h.name].granary && markers > 0) gain.G += 1;   // Granary Law
          if (mods.includes('spring_flood') && p.reach === 2) for (const r in gain) gain[r] *= 2;
          if (mods.includes('dry_autumn') && gain.G) gain.G = Math.floor(gain.G / 2);
          if (mods.includes('iron_winter') && gain.I) gain.I = Math.floor(gain.I / 2);
          return gain;
        };
        const gain = yieldOf(m, cab);
        const seen = cab && !h.cabalExposed ? yieldOf(m, 0) : gain;
        for (const [r, a] of Object.entries(gain)) { h.coffer[r] += a; gains[h.i][r] = (gains[h.i][r] || 0) + a; h.stats.produced += a; }
        for (const [r, a] of Object.entries(seen)) if (a) pub[h.i][r] = (pub[h.i][r] || 0) + a;
      }
    }
  }
  for (const h of state.houses) drawRite(state, h);
  const paid = pub.map((g, i) => (Object.keys(g).length ? `${hname(state, i)} ${Object.entries(g).map(([r, a]) => `+${a} ${RES_NAME[r]}`).join(', ')}` : null)).filter(Boolean);
  log(state, null, `Season ${state.season} Harvest: the dice show ${d[0]} and ${d[1]} (${n}). ${n === 7 ? 'Seven pays nothing.' : paid.length ? paid.join('; ') + '.' : 'No Plot answers.'}`, 'harvest');
  fx(state, { t: 'harvest', dice: d, sum: n, gains: pub, mods });
  const sable = state.houses.find((x) => HOUSES[x.name].cabal);
  if (sable && JSON.stringify(gains[sable.i]) !== JSON.stringify(pub[sable.i])) fx(state, { t: 'cabalHarvest', h: sable.i, gains: gains[sable.i], to: [sable.i] });
  // Wren (Open Court): up to two Accords for the Season with the Houses that border it most.
  const wren = state.houses.find((x) => HOUSES[x.name].accords);
  if (wren) {
    const options = accordCandidates(state, wren.i);
    if (wren.human && options.length) { state.pending = { type: 'accords', h: wren.i, options, max: Math.min(HOUSES.Wren.accords, options.length) }; }
    else formAccords(state, wren.i, options.slice(0, HOUSES.Wren.accords).map((o) => o.house));
  }
  state.phase = 'actions'; state.round = 0; state.turn = 0;
}

// Houses ranked by shared borders with Wren (the model's choice rule, D7).
export function accordCandidates(state, w) {
  const mine = heldPlots(state, w);
  return state.houses.filter((x) => x.i !== w).map((x) => {
    let border = 0;
    for (const pid of mine) for (const q of ADJ[pid - 1]) if (holds(state, q, x.i)) border++;
    return { house: x.i, border };
  }).sort((a, b) => b.border - a.border || a.house - b.house);
}
function formAccords(state, w, partners) {
  state.houses[w].accords = partners.slice(0, HOUSES.Wren.accords);
  if (partners.length) {
    log(state, w, `Wren signs Accords with ${partners.map((p) => hname(state, p)).join(' and ')} for the Season.`, 'court');
    fx(state, { t: 'accord', h: w, partners });
  }
}

// Answer a pending choice (currently Wren's Accords).
export function decide(state, choice) {
  const p = state.pending;
  if (!p) throw new Error('Nothing to decide.');
  if (p.type === 'accords') {
    const picks = [...new Set(choice.partners || [])].filter((x) => p.options.some((o) => o.house === x)).slice(0, p.max);
    state.pending = null;
    formAccords(state, p.h, picks);
  }
  return advance(state);
}

function eventPhase(state) {
  const ev = R.pick(state.rng, EVENTS);  // event_draw = 'random' (config.py)
  state.eventLog.push({ season: state.season, id: ev.id });
  let text = `Event: ${ev.name}. `;
  let after = null;
  const H = state.houses;
  switch (ev.id) {
    case 'dry_autumn': case 'spring_flood': case 'iron_winter': state.nextHarvest.push(ev.id); text += ev.text; break;
    case 'coronation_feast': H.forEach((h) => { h.coffer.G++; h.coffer.C++; }); text += 'Every House gains 1 Grain and 1 Coin.'; break;
    case 'harvest_moon': {
      const got = H.filter((h) => heldPlots(state, h.i).length >= 3); got.forEach((h) => h.favor++);
      text += got.length ? `${got.map((h) => h.name).join(', ')} gain 1 Favor.` : 'No House holds three Plots.'; break;
    }
    case 'caravan_fire': {
      const victim = R.pick(state.rng, H);
      const low = Math.min(...H.filter((h) => h.i !== victim.i).map(wealth));
      const poor = R.pick(state.rng, H.filter((h) => h.i !== victim.i && wealth(h) === low));
      const got = takeRandom(state, victim.i, poor.i, 1);
      text += got.length ? `${victim.name} loses 1 ${RES_NAME[got[0]]} to ${poor.name}.` : `${victim.name}'s Coffer is already bare.`; break;
    }
    case 'levy_of_the_crown': {
      const got = [];
      for (const h of H) {
        if (totalLegions(state, h.i) >= 3) continue;
        const spot = heldPlots(state, h.i).filter((pid) => legionsOn(state, pid, h.i) < C.legionCapPerPlot)
          .sort((a, b) => legionsOn(state, a, h.i) - legionsOn(state, b, h.i) || a - b)[0];
        if (spot) { addLegion(state, spot, h.i); got.push(h.name); fx(state, { t: 'muster', h: h.i, plot: spot }); }
      }
      text += got.length ? `${got.join(', ')} gain a Legion.` : 'No House qualifies.'; break;
    }
    case 'market_glut': {
      const hit = H.filter((h) => wealth(h) > 6); hit.forEach((h) => takeRandom(state, h.i, null, 2));
      text += hit.length ? `${hit.map((h) => h.name).join(', ')} discard two resources.` : 'No Coffer is over six.'; break;
    }
    case 'council_of_houses': {
      const top = Math.max(...H.map((h) => h.favor)); const lead = H.filter((h) => h.favor === top);
      if (lead.length === 1 && top > 0) { gainRenown(state, lead[0].i, C.councilRenown, 'Council'); text += `${lead[0].name} leads the Council and gains 2 Renown.`; }
      else text += 'No single House leads the Council.'; break;
    }
    case 'death_in_the_court': {
      const holders = H.filter((h) => h.dynasty);
      if (holders.length) { const v = R.pick(state.rng, holders); text += `${v.name}'s Dynasty holder dies.`; after = () => succession(state, v.i); }
      else text += 'No House holds a Dynasty.';
      break;
    }
    case 'lean_winter': {
      const hit = H.filter((h) => h.coffer.G < 3 && h.coffer.C > 0); hit.forEach((h) => h.coffer.C--);
      text += hit.length ? `${hit.map((h) => h.name).join(', ')} lose 1 Coin.` : 'Every granary holds.'; break;
    }
    case 'blood_moon': text += 'The moon rises red. Nothing happens.'; break;
  }
  log(state, null, text, 'event');
  fx(state, { t: 'event', id: ev.id });
  if (after) after();
  if (isFloodSeason(state.season)) state.phase = 'flood'; else nextSeason(state);
}

function succession(state, i) {
  const h = state.houses[i];
  if (!h.dynasty) return;
  const heir = h.heir;
  heir.revealed = true; heir.knownBy = state.houses.map((x) => x.i);
  if (heir.status === 'G') {
    log(state, i, `${h.name}'s Genuine Heir takes the Dynasty.`, 'court');
    if (HOUSES[h.name].successionBonus) gainRenown(state, i, C.thorneSuccessionBonus, 'Succession');
    h.heirsCrowned = (h.heirsCrowned || 0) + 1;
    newHeir(state, h);   // R23: the Heir now holds the Dynasty; the line needs a new, hidden Heir
    fx(state, { t: 'succession', h: i, result: 'G' });
  } else {
    h.dynasty = false; gainRenown(state, i, -C.impostorPenalty, 'Impostor');
    log(state, i, `${h.name}'s Heir is an Impostor. The Dynasty is lost and 2 Renown with it.`, 'court');
    h.heirsLost++; newHeir(state, h);
    fx(state, { t: 'succession', h: i, result: 'I' });
  }
}

export function reachCounts(state, reach) {
  const counts = state.houses.map(() => 0);
  for (const p of PLOTS) if (p.reach === reach) for (const [k, m] of Object.entries(state.plots[p.id - 1].m)) counts[+k] += m;
  return counts;
}
// Places in a Reach: first = strictly most markers; second = strictly most of the rest (needs a sole first).
export function reachPlaces(counts) {
  const top = Math.max(...counts);
  if (top <= 0) return { first: null, second: null };
  const firsts = counts.map((c, i) => (c === top ? i : -1)).filter((i) => i >= 0);
  if (firsts.length > 1) return { first: null, second: null, tied: firsts };
  const rest = counts.map((c, i) => (i === firsts[0] ? -1 : c));
  const top2 = Math.max(...rest);
  const seconds = rest.map((c, i) => (c === top2 && c > 0 ? i : -1)).filter((i) => i >= 0);
  return { first: firsts[0], second: seconds.length === 1 ? seconds[0] : null };
}

function flood(state) {
  const s = state.season; const final = s === C.seasons;
  const [p1, p2] = final ? C.finalFloodPoints : C.midFloodPoints;
  const result = { season: s, reaches: [], dynasty: [], accords: [], deaths: [], catastrophe: null, bonuses: [] };
  for (const reach of REACHES) {
    const counts = reachCounts(state, reach.id); const pl = reachPlaces(counts);
    const mult = reach.delta ? C.deltaMultiplier : 1;
    const row = { reach: reach.id, counts, first: pl.first, second: pl.second, pts: [0, 0] };
    if (pl.first != null && p1) { gainRenown(state, pl.first, p1 * mult, 'Reaches'); row.pts[0] = p1 * mult; }
    if (pl.second != null && p2) { gainRenown(state, pl.second, p2 * mult, 'Reaches'); row.pts[1] = p2 * mult; }
    result.reaches.push(row);
  }
  for (const h of state.houses) if (h.dynasty) { gainRenown(state, h.i, C.dynastyFloodRenown, 'Dynasty'); result.dynasty.push(h.i); }
  for (const h of state.houses) if (h.accords.length) { h.favor += C.accordFavor * h.accords.length; result.accords.push([h.i, h.accords.length]); }
  // Death checks: each Dynasty holder dies with chance 1 in 4.
  for (const h of state.houses) if (h.dynasty && R.next(state.rng) < C.holderDeathChance) { result.deaths.push(h.i); succession(state, h.i); }
  // Ember Pressure.
  if (state.pressure >= C.pressureThreshold) {
    const H = state.houses.slice();
    H.sort((a, b) => b.ritesSeason - a.ritesSeason || b.ritesSinceReset - a.ritesSinceReset || b.renown - a.renown || a.i - b.i);
    const v = H[0];
    const held = heldPlots(state, v.i).sort((a, b) => pips(plotById(a).n) - pips(plotById(b).n) || b - a);
    const lost = held[0] ?? null;
    if (lost != null) removeMarker(state, lost, v.i);
    result.catastrophe = { h: v.i, plot: lost, pressure: state.pressure };
    log(state, v.i, `Ember Pressure breaks at ${state.pressure}. Catastrophe strikes ${v.name}${lost != null ? `, which loses a marker at ${plotById(lost).name}` : ''}.`, 'magic');
    fx(state, { t: 'catastrophe', h: v.i, plot: lost });
    state.pressure = 0; state.houses.forEach((x) => { x.ritesSinceReset = 0; });
  }
  if (final) {
    for (const row of result.reaches) {
      const ash = state.houses.find((x) => HOUSES[x.name].conquest);
      if (ash && row.first === ash.i && ash.skirmishReaches.includes(row.reach)) { gainRenown(state, ash.i, C.ashConquestPerReach, 'Conquest'); result.bonuses.push({ h: ash.i, why: 'Conquest', reach: row.reach }); }
      const sable = state.houses.find((x) => HOUSES[x.name].cabal);
      if (sable) {
        const tokens = PLOTS.filter((p) => p.reach === row.reach && state.plots[p.id - 1].cabal === sable.i).length;
        const beats = tokens > 0 && row.counts.every((c, i) => i === sable.i || tokens > c);
        if (beats) { gainRenown(state, sable.i, C.sableReachBonus, 'Cabal'); result.bonuses.push({ h: sable.i, why: 'Cabal', reach: row.reach }); }
      }
    }
  }
  state.floods.push(result);
  const scored = result.reaches.filter((r) => r.first != null).map((r) => `${REACHES[r.reach - 1].name} to ${hname(state, r.first)}${r.second != null ? ` (second ${hname(state, r.second)})` : ''}`);
  log(state, null, `The Flood of Season ${s}. ${scored.length ? scored.join('; ') + '.' : 'No Reach has a sole leader.'}`, 'flood');
  fx(state, { t: 'flood', season: s, result });
  if (final) endGame(state); else nextSeason(state);
}

function nextSeason(state) {
  state.season++;
  state.phase = 'harvest';
}

export function standings(state) {
  return state.houses.map((h) => ({ i: h.i, name: h.name, renown: h.renown, markers: totalMarkers(state, h.i), wealth: wealth(h) }))
    .sort((a, b) => b.renown - a.renown || b.markers - a.markers || b.wealth - a.wealth);
}

function endGame(state) {
  // A revealed Genuine Heir scores 4 (D4). One that already took the Dynasty counts as revealed (R23). Once per House.
  for (const h of state.houses) if ((h.heir.revealed && h.heir.status === 'G') || h.heirsCrowned) gainRenown(state, h.i, C.genuineHeirEndRenown, 'Genuine Heir');
  const st = standings(state);
  const top = st[0];
  const winners = st.filter((x) => x.renown === top.renown && x.markers === top.markers && x.wealth === top.wealth).map((x) => x.i);
  const tieOnRenown = st.filter((x) => x.renown === top.renown).length > 1;
  state.final = { standings: st, tieBreak: tieOnRenown ? (st[1].markers !== top.markers ? 'markers' : st[1].wealth !== top.wealth ? 'resources' : 'shared') : null };
  state.winner = winners;
  state.phase = 'over';
  log(state, null, `The twelfth Flood recedes. ${winners.map((i) => hname(state, i)).join(' and ')} ${winners.length > 1 ? 'share' : 'takes'} Hollowmere with ${top.renown} Renown${state.final.tieBreak && state.final.tieBreak !== 'shared' ? ` (tie broken by ${state.final.tieBreak})` : ''}.`, 'flood');
  fx(state, { t: 'over', winners });
}

// What House `viewer` may see of the state. Hidden: rival Heirs (unless known), rival hands,
// Sable's Cabal (unless exposed), deck order. Used by the UI and by the AI so neither cheats.
export function view(state, viewer) {
  const s = clone(state);
  delete s.rng; s.riteDeck = s.riteDeck.length; s.riteDiscard = s.riteDiscard.length;
  s.fx = s.fx.filter((e) => !e.to || e.to.includes(viewer));
  for (const h of s.houses) {
    const knows = h.heir.revealed || h.heir.knownBy.includes(viewer);
    if (!knows) h.heir.status = '?';
    if (!h.heir.revealed) h.heir.knownBy = h.heir.knownBy.includes(viewer) ? h.heir.knownBy.filter((k) => k === viewer || k === h.i) : [];
    h.heirPile = h.heirPile.length; h.invDeck = h.invDeck.length;
    if (h.i === viewer) continue;
    h.rites = h.rites.length; h.invHand = h.invHand.length; h.invDiscard = h.invDiscard.length;
    if (!h.cabalExposed) { h.cabalTokens = '?'; for (const p of s.plots) if (p.cabal === h.i) p.cabal = null; }
  }
  return s;
}
