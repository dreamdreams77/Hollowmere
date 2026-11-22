// Hollowmere rules engine. Pure functions over a plain-JSON state; no DOM, no rendering.
// The engine is authoritative: the UI and the AI only ever call legalActions / checkAction /
// applyAction / advance / decide. Random outcomes come from the seeded generator in state.rng.
import {
  CONFIG, RES, RES_NAME, PLOTS, ADJ, REACHES, HOUSES, RITES, riteById, EVENTS, DILEMMAS, eventById,
  INVESTIGATION, INVESTIGATION_DECK, SEATS_FOR, pips, plotById,
} from './data.js';
import * as R from './rng.js';
import { dn, LORE, TRAIT_IDS, EPITHETS, heirName, lordName } from '../content/lore.js';

const C = CONFIG;
export const FORTIFY_COST = { S: 1, T: 1 };   // Expanded rules X3
export const clone = (s) => JSON.parse(JSON.stringify(s));

// ---------------------------------------------------------------- setup

export function newGame({ houses, humans = [], seed = Date.now(), seatOrder = null, rules = 'original', lords = null } = {}) {
  if (!houses || houses.length < 2 || houses.length > 4) throw new Error('Hollowmere is for 2 to 4 Houses');
  if (new Set(houses).size !== houses.length) throw new Error('each House may be played once');
  const rng = { s: R.hashSeed(seed) };
  const seats = SEATS_FOR[houses.length];
  // "Houses are dealt to the four seats A to D at random."
  const dealt = seatOrder ? seatOrder.slice() : R.shuffle(rng, houses);
  const state = {
    v: 2, seed: String(seed), nameSeed: String(R.hashSeed(`${seed}:names`)), rng, rules,
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
      heir: { status: pile.pop(), serial: 1, pub: 1, revealed: false, knownBy: [] }, heirPile: pile, heirsLost: 0,
      dynasty: false, dynastiesBought: 0,
      rites: [], invHand: [], invDeck: deck, invDiscard: [],
      cabalTokens: 0, cabalExposed: false,
      flags: {}, ritesSeason: 0, ritesSinceReset: 0, ritesTotal: 0,
      skirmishReaches: [], accords: [], married: false, betrothed: null,
      lord: null, regard: {}, pacts: [], oaths: 0,
      stats: { builds: 0, raids: 0, skirmishWon: 0, skirmishLost: 0, captures: 0, lost: 0, produced: 0, passes: 0, seals: 0, exposed: 0 },
    });
  });
  // Every House is ruled by a named lord with a trait (story; the AI reads the trait).
  for (const h of state.houses) { h.lord = newLord(state, h); for (const o of state.houses) if (o.i !== h.i) h.regard[o.i] = 0; }
  // Optional chosen lords ({ houseKey: { given, epithet, trait } }, e.g. a continued lineage). The random
  // lord is still drawn above, so the rng sequence and every other part of the game are unchanged.
  for (const h of state.houses) {
    const o = lords && lords[h.name];
    if (!o) continue;
    h.lord = { ...h.lord, given: o.given || h.lord.given, epithet: o.epithet || h.lord.epithet, trait: TRAIT_IDS.includes(o.trait) ? o.trait : h.lord.trait };
  }
  // Setup step 2: two markers on the seat Plots, one Legion on each (Thorne: one marker).
  for (const h of state.houses) {
    let seatPlots = PLOTS.filter((p) => p.seat === h.seat).map((p) => p.id);
    if (HOUSES[h.name].oneMarker) seatPlots = [seatPlots.slice().sort((a, b) => pips(plotById(b).n) - pips(plotById(a).n) || a - b)[0]];
    for (const pid of seatPlots) { addMarker(state, pid, h.i, 1); addLegion(state, pid, h.i, 1); }
    // X9 (balance): Briarkeep, the oldest seat on the river, starts behind walls (Rosenvael only).
    if (rules === 'expanded' && HOUSES[h.name].oneMarker) for (const pid of seatPlots) state.plots[pid - 1].walls = h.i;
    // Setup step 4: two Rite cards.
    for (let k = 0; k < C.riteOpeningHand; k++) drawRite(state, h);
  }
  log(state, null, `Twelve Seasons begin. ${state.houses.map((h) => `${dn(h.name)} holds seat ${h.seat}`).join(', ')}.`);
  advance(state);
  return state;
}

// ---------------------------------------------------------------- lords, regard, pacts (story + Expanded rules)

function newLord(state, house, given) {
  const L = LORE[house.name];
  return { given: given || R.pick(state.rng, L.given), epithet: R.pick(state.rng, EPITHETS), trait: R.pick(state.rng, TRAIT_IDS), since: state.season || 1 };
}
export const expanded = (state) => state.rules === 'expanded';
// A House's Skirmish modifier. Expanded rules X9 (balance): Emberlain's +1 and Ostrander's -1 count
// only when that House attacks (with Raids common, they otherwise decided too many defences too).
// X9: a proven Rosenvael line is worth 6 at the end, not 4; and Rosenvael may Muster from Season 2.
export const heirEndRenown = (state, house) => C.genuineHeirEndRenown + (expanded(state) && HOUSES[house.name].vigil ? 2 : 0);
export const musterFrom = (state, house) => { const f = HOUSES[house.name].musterFrom; return f && expanded(state) ? Math.min(f, 2) : f; };
export function skirmishMod(state, name, attacking) {
  const m = HOUSES[name].skirmish || 0;
  return expanded(state) && !attacking ? 0 : m;
}
export function shiftRegard(state, from, toward, d) {
  if (from === toward || from == null || toward == null) return;
  const r = state.houses[from].regard; r[toward] = Math.max(-5, Math.min(5, (r[toward] || 0) + d));
}
export const pactWith = (state, a, b) => state.houses[a].pacts.find((p) => p.with === b) || null;
function endPact(state, a, b) {
  state.houses[a].pacts = state.houses[a].pacts.filter((p) => p.with !== b);
  state.houses[b].pacts = state.houses[b].pacts.filter((p) => p.with !== a);
}
// Breaking a Pact (Expanded rules X4): the oathbreaker loses 1 Renown and 2 Favor, and every House
// thinks less of it, the betrayed most of all.
function breakOath(state, h, victim) {
  if (!pactWith(state, h, victim)) return;
  endPact(state, h, victim);
  const house = state.houses[h]; house.oaths++;
  const kin = house.betrothed === victim;   // X8: betraying the House your line married into costs twice as much
  if (kin) { house.betrothed = null; state.houses[victim].betrothed = null; }
  gainRenown(state, h, kin ? -2 : -1, 'Oathbreaking'); house.favor = Math.max(0, house.favor - (kin ? 3 : 2));
  for (const o of state.houses) if (o.i !== h) shiftRegard(state, o.i, h, (o.i === victim ? -4 : -2) * (kin ? 1.5 : 1));
  log(state, h, kin ? `${dn(house.name)} breaks faith with ${dn(state.houses[victim].name)}, the House its own line married into. No crime on the river is spoken of more.` : `${dn(house.name)} breaks its Pact with ${dn(state.houses[victim].name)}. The river remembers oathbreakers.`, 'court');
  fx(state, { t: 'oathbreak', h, victim });
}
// Would AI-ruled House j accept a Pact from h? Deterministic, so a proposer can foresee the answer.
export function pactScore(state, j, h, gift) {
  const J = state.houses[j], Hh = state.houses[h];
  let s = (J.regard[h] || 0) + (gift ? 1.5 : 0);
  const near = heldPlots(state, j).some((pid) => ADJ[pid - 1].some((q) => legionsOn(state, q, h) > 0));
  if (near) s += 1.5;                                                     // fear of the proposer's Legions
  const lead = Math.max(...state.houses.filter((x) => x.i !== h).map((x) => x.renown));
  if (Hh.renown > lead + 4) s -= 2;                                       // nobody helps the runaway leader
  if (Hh.oaths) s -= 1.5 * Hh.oaths;                                      // a known oathbreaker
  const tr = J.lord?.trait;
  if (tr === 'treacherous') s += 2; if (tr === 'honourable') s += 0.5; if (tr === 'cautious') s += 1;
  if (tr === 'bold') s -= 1; if (tr === 'proud' && Hh.renown >= J.renown) s -= 1.5;
  return s;
}
export const pactAccepts = (state, j, h, gift) => pactScore(state, j, h, gift) >= 0.5;
function formPact(state, a, b, gift) {
  const until = state.season + 1;
  state.houses[a].pacts.push({ with: b, until }); state.houses[b].pacts.push({ with: a, until });
  if (gift) { state.houses[a].coffer[gift]--; state.houses[b].coffer[gift]++; }
  shiftRegard(state, a, b, 2); shiftRegard(state, b, a, 2);
  log(state, a, `${dn(state.houses[a].name)} and ${dn(state.houses[b].name)} swear a Pact until the end of Season ${until}${gift ? `, sealed with a gift of ${RES_NAME[gift]}` : ''}.`, 'court');
  fx(state, { t: 'pact', h: a, with: b });
}

// Betrothal (Expanded rules X8): a House with a Pact offers its Heir's hand. If accepted, the Pact
// lasts the rest of the game, both Houses gain 1 Renown, and each learns the truth of the other's
// Heir. The proposer pays a 2-Coin dowry to the other House (Rosenvael, the oldest blood, pays none).
export const BETROTH_DOWRY = 2;
export const BETROTH_LIFE = 99;
export function betrothScore(state, j, h) {
  const J = state.houses[j];
  let s = pactScore(state, j, h, 'C') + 0.5;
  if (J.heir.knownBy.includes(j) && J.heir.status === 'I' && !J.heir.revealed) s -= 2;   // an Impostor fears the in-laws
  if (J.lord?.trait === 'honourable') s += 0.5;
  return s;
}
export const betrothAccepts = (state, j, h) => betrothScore(state, j, h) >= 1.5;
function formBetrothal(state, a, b) {
  const A = state.houses[a], B = state.houses[b];
  if (!HOUSES[A.name].vigil) { A.coffer.C -= BETROTH_DOWRY; B.coffer.C += BETROTH_DOWRY; }
  A.betrothed = b; B.betrothed = a;
  for (const [x, y] of [[A, b], [B, a]]) { const p = x.pacts.find((q) => q.with === y); if (p) p.until = BETROTH_LIFE; else x.pacts.push({ with: y, until: BETROTH_LIFE }); }
  if (!A.heir.knownBy.includes(b)) A.heir.knownBy.push(b);
  if (!B.heir.knownBy.includes(a)) B.heir.knownBy.push(a);
  for (const x of [A, B]) gainRenown(state, x.i, HOUSES[x.name].vigil ? 2 : 1, 'Betrothal');   // X9: the oldest blood is worth more
  shiftRegard(state, a, b, 2); shiftRegard(state, b, a, 2);
  log(state, a, `${heirName(state, A)} of ${dn(A.name)} is betrothed to ${heirName(state, B)} of ${dn(B.name)}. Their Pact now lasts the rest of the game, and each House knows the truth of the other's Heir.`, 'court');
  fx(state, { t: 'betrothal', h: a, with: b });
}

// Bring a saved state from an older version up to date.
export function migrate(state) {
  if (!state.rules) state.rules = 'original';
  if (!state.nameSeed) state.nameSeed = String(R.hashSeed(`${state.seed}:names`));
  for (const h of state.houses) {
    if (!h.heir.pub) h.heir.pub = h.heir.serial;
    if (!h.lord) h.lord = newLord(state, h);
    if (!h.regard) { h.regard = {}; for (const o of state.houses) if (o.i !== h.i) h.regard[o.i] = 0; }
    if (!h.pacts) h.pacts = []; if (h.oaths == null) h.oaths = 0;
  }
  for (const p of state.plots) { if (!p.contests) p.contests = p.contest ? [p.contest] : []; delete p.contest; }
  state.v = 2;
  return state;
}

// ---------------------------------------------------------------- small helpers

function log(state, h, text, kind = 'info') {
  state.log.push({ n: ++state.seq, season: state.season, phase: state.phase, h: h == null ? null : h, text, kind });
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}
// e.only = [houses] limits who may see the details of an effect (see view()).
function fx(state, e) { state.fx.push({ ...e, n: ++state.seq }); if (state.fx.length > 200) state.fx.splice(0, state.fx.length - 200); }
const hname = (state, i) => dn(state.houses[i].name);   // display name for the chronicle
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
    if (p.walls === h) p.walls = null;
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
  house.heir = { status, serial: house.heir.serial + 1, pub: (house.heir.pub || house.heir.serial) + 1, revealed: false, knownBy: [] };
}

// Cost helpers that depend on the House.
export function musterCost(house, state = null) { void state; return HOUSES[house.name].muster || { I: 2, G: 1 }; }
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
  'seal', 'reveal', 'rite', 'dynasty', 'cabal', 'vigil', 'toil', 'fortify', 'envoy', 'betroth', 'pass',
];
export const EXPANDED_TYPES = ['toil', 'fortify', 'envoy', 'betroth'];
export const ACTION_LABEL = {
  build: 'Build', keep: 'Keep', muster: 'Muster', raid: 'Raid', recapture: 'Recapture', trade: 'Trade',
  favor: 'Claim Favor', investigate: 'Investigate', play: 'Play Card', seal: 'Seal', reveal: 'Reveal Heir',
  rite: 'Rite', dynasty: 'Dynasty', cabal: 'Cabal', vigil: 'Vigil', toil: 'Toil', fortify: 'Fortify', envoy: 'Envoy', betroth: 'Betroth', pass: 'Pass',
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
      if (musterFrom(state, house) && state.season < musterFrom(state, house)) return `${dn(house.name)} cannot Muster before Season ${musterFrom(state, house)}.`;
      if (!canPay(house, musterCost(house, state))) return `Needs ${costText(musterCost(house, state))}.`;
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
    case 'toil':
      if (!expanded(state)) return 'Only in the Expanded rules.';
      return house.flags.toil ? 'You have already toiled this Season.' : 'You hold no Plot to work.';
    case 'fortify':
      if (!expanded(state)) return 'Only in the Expanded rules.';
      if (!canPay(house, FORTIFY_COST)) return 'Needs 1 Stone and 1 Timber.';
      return 'Every Plot you hold is already walled.';
    case 'envoy':
      if (!expanded(state)) return 'Only in the Expanded rules.';
      if ((house.flags.envoy || 0) >= (H.vigil ? 2 : 1)) return 'You have already sent your Envoys this Season.';
      if (!H.vigil && house.coffer.C < 1) return 'Needs 1 Coin.';
      return 'You already have a Pact with every rival.';
    case 'betroth':
      if (!expanded(state)) return 'Only in the Expanded rules.';
      if (house.betrothed != null) return `Your line is already joined to ${hname(state, house.betrothed)}.`;
      if (!house.pacts.length) return 'A Betrothal needs a Pact first: send an Envoy.';
      if (!H.vigil && house.coffer.C < BETROTH_DOWRY) return `Needs ${BETROTH_DOWRY} Coin for the dowry.`;
      return 'Every House you have a Pact with is already betrothed.';
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
      if (musterFrom(state, house) && state.season < musterFrom(state, house)) break;
      if (!canPay(house, musterCost(house, state))) break;
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
    case 'toil': {
      if (!expanded(state) || house.flags.toil) break;
      // X1: a House with two Plots or fewer has its smallfolk's every skill to call on: any resource.
      const kinds = mine.length <= 2 ? new Set(RES.filter((r) => !(r === 'L' && H.noLore))) : new Set(mine.map((pid) => plotById(pid).res).filter((r) => !(r === 'L' && H.noLore)));
      for (const r of RES) if (kinds.has(r)) out.push({ type, res: r });
      break;
    }
    case 'fortify':
      if (!expanded(state) || !canPay(house, FORTIFY_COST)) break;
      for (const pid of mine) if (state.plots[pid - 1].walls == null) out.push({ type, plot: pid });
      break;
    case 'envoy':
      // X6: Rosenvael (Thorne), the oldest blood, sends Envoys for nothing and twice a Season.
      const envoyFree = !!H.vigil, envoyMax = H.vigil ? 2 : 1;
      if (!expanded(state) || (!envoyFree && house.coffer.C < 1) || (house.flags.envoy || 0) >= envoyMax) break;
      for (const x of state.houses) {
        if (x.i === h || pactWith(state, h, x.i)) continue;
        out.push({ type, target: x.i, gift: null });
        for (const r of RES) if (house.coffer[r] >= (r === 'C' && !envoyFree ? 2 : 1)) out.push({ type, target: x.i, gift: r });
      }
      break;
    case 'betroth':
      if (!expanded(state) || house.betrothed != null || (!H.vigil && house.coffer.C < BETROTH_DOWRY)) break;
      for (const p of house.pacts) if (state.houses[p.with].betrothed == null) out.push({ type, target: p.with });
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
  return ACTION_TYPES.filter((t) => expanded(state) || !EXPANDED_TYPES.includes(t))
    .filter((t) => t !== 'seal' || HOUSES[state.houses[h].name].seal)
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
  const h = state.turn; const house = state.houses[h]; const me = dn(house.name);
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
      pay(house, musterCost(house, state)); addLegion(state, action.plot, h);
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
      if (HOUSES[house.name].writ && rate === 2) house.flags.writ = true;
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
      log(state, h, `${me} investigates.`, 'intrigue'); fx(state, { t: 'investigate', h, card: c, only: [h] });
      break;
    }
    case 'play': {
      house.invHand.splice(house.invHand.indexOf(action.card), 1); house.invDiscard.push(action.card);
      if (action.card === 'testimony') { house.favor += 1; log(state, h, `${me} plays a Testimony: +1 Favor.`, 'intrigue'); }
      if (action.card === 'document') { house.coffer.L += 1; log(state, h, `${me} plays a Document: +1 Lore.`, 'intrigue'); }
      if (action.card === 'witness') {
        const t = richestRival(state, h);
        const got = t == null ? [] : takeRandom(state, t, h, 1);
        if (t != null) shiftRegard(state, t, h, -1);
        let extra = '';
        if (t != null && HOUSES[state.houses[t].name].cabal && state.houses[t].cabalTokens && !state.houses[t].cabalExposed) {
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
        log(state, h, `${me}'s Seal exposes ${dn(tgt.name)}'s Heir as an Impostor.`, 'intrigue');
        shiftRegard(state, tgt.i, h, -2);
        gainRenown(state, h, C.sealRenown, 'Seals'); house.stats.exposed++;
        tgt.heirsLost++; newHeir(state, tgt);
        fx(state, { t: 'seal', h, target: tgt.i, result: 'I' });
      } else {
        for (const k of [h, tgt.i]) if (!tgt.heir.knownBy.includes(k)) tgt.heir.knownBy.push(k);
        log(state, h, `${me}'s Seal tests ${dn(tgt.name)}'s Heir. The result is kept private.`, 'intrigue');
        fx(state, { t: 'seal', h, target: tgt.i, result: 'G', only: [h, tgt.i] });
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
      log(state, h, `${me} moves in the shadows.`, 'intrigue'); fx(state, { t: 'cabal', h, plot: action.plot, only: [h] });
      break;
    case 'vigil': {
      house.coffer.C -= 1; house.flags.vigil = true;
      house.heir.knownBy.push(h);
      const text = `${me} keeps a Vigil over its Heir.`;   // the result is private (R5): rivals learn nothing
      if (house.heir.status === 'I' && !house.married) {
        const pub = house.heir.pub;
        house.married = true; house.heirsLost++; newHeir(state, house); house.heir.pub = pub;
        fx(state, { t: 'vigil', h, result: 'remarried', only: [h] });
      } else fx(state, { t: 'vigil', h, result: 'known', only: [h] });
      log(state, h, text, 'court');
      break;
    }
    case 'toil':
      house.flags.toil = true; house.coffer[action.res] += 1;
      log(state, h, `${me} puts its people to work: +1 ${RES_NAME[action.res]}.`); fx(state, { t: 'toil', h, res: action.res });
      break;
    case 'fortify':
      pay(house, FORTIFY_COST); state.plots[action.plot - 1].walls = h;
      log(state, h, `${me} raises walls at ${P(action.plot)}.`); fx(state, { t: 'fortify', h, plot: action.plot });
      break;
    case 'envoy': {
      if (!HOUSES[house.name].vigil) house.coffer.C -= 1;
      house.flags.envoy = (house.flags.envoy || 0) + 1;
      const tgt = state.houses[action.target];
      if (tgt.human) {
        state.pending = { type: 'pact', h: tgt.i, from: h, gift: action.gift };
        log(state, h, `${me} sends an Envoy to ${dn(tgt.name)} offering a Pact${action.gift ? ` and a gift of ${RES_NAME[action.gift]}` : ''}.`, 'court');
      } else if (pactAccepts(state, tgt.i, h, action.gift)) formPact(state, h, tgt.i, action.gift);
      else {
        shiftRegard(state, h, tgt.i, -1);
        log(state, h, `${me}'s Envoy is turned away by ${dn(tgt.name)}.`, 'court'); fx(state, { t: 'refused', h, by: tgt.i });
      }
      break;
    }
    case 'betroth': {
      const tgt = state.houses[action.target];
      if (tgt.human) {
        state.pending = { type: 'betroth', h: tgt.i, from: h };
        log(state, h, `${me} offers the hand of its Heir to ${dn(tgt.name)}.`, 'court');
      } else if (betrothAccepts(state, tgt.i, h)) formBetrothal(state, h, tgt.i);
      else {
        shiftRegard(state, h, tgt.i, -1);
        log(state, h, `${dn(tgt.name)} declines ${me}'s offer of a marriage.`, 'court'); fx(state, { t: 'refused', h, by: tgt.i, what: 'betroth' });
      }
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
  const house = state.houses[h]; const me = dn(house.name); const tgt = a.target; const reach = plotById(a.to).reach;
  house.coffer.I -= 1; house.stats.raids++;
  if (pactWith(state, h, tgt)) breakOath(state, h, tgt);
  shiftRegard(state, tgt, h, -2);
  removeLegions(state, a.from, h, a.n);
  const dLeg = legionsOn(state, a.to, tgt);
  const tp = state.plots[a.to - 1];
  const walls = expanded(state) && tp.walls === tgt ? 1 : 0;   // X3: walls defend even an empty Plot
  const capture = () => {
    removeMarker(state, a.to, tgt);
    if (markersOn(state, a.to, h) < C.keepCap) addMarker(state, a.to, h);   // R28: a capture never makes a third marker
    if (!tp.contests.some((c) => c.victim === tgt && c.captor === h)) tp.contests.push({ victim: tgt, captor: h });
    house.stats.captures++; state.houses[tgt].stats.lost++;
  };
  if (!dLeg && !walls) {
    addLegion(state, a.to, h, a.n); capture();
    log(state, h, `${me} raids ${plotById(a.to).name}, finds it undefended, and takes a marker from ${hname(state, tgt)}.`, 'war');
    fx(state, { t: 'raid', h, from: a.from, to: a.to, target: tgt, n: a.n, defended: false, won: true });
    return;
  }
  const am = skirmishMod(state, house.name, true), dm = skirmishMod(state, state.houses[tgt].name, false);
  const already = legionsOn(state, a.to, h);   // R26: the raider's Legions already on the Plot fight too
  const rolls = [];
  let won = false;
  for (let guard = 0; guard < 50; guard++) {
    const ar = [R.d6(state.rng), R.d6(state.rng)], dr = [R.d6(state.rng), R.d6(state.rng)];
    const at = ar[0] + ar[1] + Math.min(a.n + already, 3) + am, dt = dr[0] + dr[1] + Math.min(dLeg, 3) + dm + walls;
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
  if (won) shiftRegard(state, tgt, h, -1);
  fx(state, { t: 'raid', h, from: a.from, to: a.to, target: tgt, n: a.n, defended: true, dLeg, won, rolls, am, dm, walls });
}

function castRite(state, h, a) {
  const house = state.houses[h]; const rite = riteById[a.rite]; const me = dn(house.name);
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
      if (t != null) shiftRegard(state, t, h, -1);
      if (t != null) text += ` ${got.map((r) => RES_NAME[r]).join(' and ') || 'Nothing'} slips from ${hname(state, t)}'s Coffer.`;
      break;
    }
    case 'silent_barge':
      for (const t of a.targets) { addMarker(state, t.plot, h); text += ` A marker drifts ashore at ${plotById(t.plot).name}.`; }
      break;
    case 'heron_cry': case 'ashen_pyre':
      for (const t of a.targets) { if (pactWith(state, h, t.house)) breakOath(state, h, t.house); shiftRegard(state, t.house, h, -2); removeMarker(state, t.plot, t.house); text += ` ${hname(state, t.house)} loses a marker at ${plotById(t.plot).name}.`; }
      break;
    case 'ink_of_names': {
      const cands = state.houses.filter((x) => x.i !== h && !x.heir.revealed);
      if (cands.length) {
        const t = R.pick(state.rng, cands);
        if (t.heir.status === 'I') {
          text += ` ${dn(t.name)}'s Heir is unmasked as an Impostor.`; gainRenown(state, h, C.sealRenown, 'Rites');
          t.heirsLost++; newHeir(state, t);
        } else { t.heir.revealed = true; t.heir.knownBy = state.houses.map((x) => x.i); text += ` ${dn(t.name)}'s Heir is shown to be Genuine.`; }
      }
      break;
    }
  }
  if (HOUSES[house.name].riteRenown) gainRenown(state, h, HOUSES[house.name].riteRenown, 'Rites');
  log(state, h, text, 'magic');
  fx(state, { t: 'rite', h, rite: rite.id, school: rite.school, targets: a.targets || [], pressure: state.pressure });
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
  for (const h of state.houses) for (const p of h.pacts.slice()) if (p.until < state.season) {
    endPact(state, h.i, p.with); shiftRegard(state, h.i, p.with, 1); shiftRegard(state, p.with, h.i, 1);
    log(state, h.i, `The Pact between ${dn(h.name)} and ${dn(state.houses[p.with].name)} ends, kept to the last day.`, 'court');
  }
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
  if (sable && JSON.stringify(gains[sable.i]) !== JSON.stringify(pub[sable.i])) fx(state, { t: 'cabalHarvest', h: sable.i, gains: gains[sable.i], only: [sable.i] });
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
  for (const p of state.houses[w].accords) { shiftRegard(state, w, p, 1); shiftRegard(state, p, w, 1); }
  if (partners.length) {
    log(state, w, `Bramwell signs Accords with ${partners.map((p) => hname(state, p)).join(' and ')} for the Season.`, 'court');
    fx(state, { t: 'accord', h: w, partners });
  }
}

// Answer a pending choice (currently Wren's Accords).
export function decide(state, choice) {
  const p = state.pending;
  if (!p) throw new Error('Nothing to decide.');
  if (p.type === 'pact') {
    state.pending = null;
    if (choice.accept) formPact(state, p.from, p.h, p.gift);
    else { shiftRegard(state, p.from, p.h, -1); log(state, p.h, `${dn(state.houses[p.h].name)} refuses the Pact offered by ${dn(state.houses[p.from].name)}.`, 'court'); }
    return advance(state);
  }
  if (p.type === 'betroth') {
    state.pending = null;
    const ok = choice.accept && pactWith(state, p.from, p.h) && state.houses[p.from].betrothed == null && state.houses[p.h].betrothed == null
      && (HOUSES[state.houses[p.from].name].vigil || state.houses[p.from].coffer.C >= BETROTH_DOWRY);
    if (ok) formBetrothal(state, p.from, p.h);
    else { shiftRegard(state, p.from, p.h, -1); log(state, p.h, `${dn(state.houses[p.h].name)} declines the marriage offered by ${dn(state.houses[p.from].name)}.`, 'court'); }
    return advance(state);
  }
  if (p.type === 'dilemma') {
    state.pending = null;
    resolveDilemma(state, p.h, p.id, choice.pick === 'a' ? 'a' : 'b');
    return advance(state);
  }
  if (p.type === 'accords') {
    const picks = [...new Set(choice.partners || [])].filter((x) => p.options.some((o) => o.house === x)).slice(0, p.max);
    state.pending = null;
    formAccords(state, p.h, picks);
  }
  return advance(state);
}

function eventPhase(state) {
  const ev = R.pick(state.rng, expanded(state) ? [...EVENTS, ...DILEMMAS] : EVENTS);  // event_draw = 'random' (config.py); X7 adds the Dilemmas
  state.eventLog.push({ season: state.season, id: ev.id });
  if (ev.a) {   // Expanded X7: a choice falls to one House
    const h = dilemmaHouse(state, ev.id);
    log(state, null, `Event: ${ev.name}. The choice falls to ${hname(state, h)}.`, 'event');
    fx(state, { t: 'event', id: ev.id, h });
    if (state.houses[h].human) { state.pending = { type: 'dilemma', h, id: ev.id, options: dilemmaOptions(state, h, ev.id) }; return; }
    resolveDilemma(state, h, ev.id, dilemmaPick(state, h, ev.id));
    return;
  }
  let text = `Event: ${ev.name}. `;
  let after = null;
  const H = state.houses;
  switch (ev.id) {
    case 'dry_autumn': case 'spring_flood': case 'iron_winter': state.nextHarvest.push(ev.id); text += ev.text; break;
    case 'coronation_feast': H.forEach((h) => { h.coffer.G++; h.coffer.C++; }); text += 'Every House gains 1 Grain and 1 Coin.'; break;
    case 'harvest_moon': {
      const got = H.filter((h) => heldPlots(state, h.i).length >= 3); got.forEach((h) => h.favor++);
      text += got.length ? `${got.map((h) => dn(h.name)).join(', ')} gain 1 Favor.` : 'No House holds three Plots.'; break;
    }
    case 'caravan_fire': {
      const victim = R.pick(state.rng, H);
      const low = Math.min(...H.filter((h) => h.i !== victim.i).map(wealth));
      const poor = R.pick(state.rng, H.filter((h) => h.i !== victim.i && wealth(h) === low));
      const got = takeRandom(state, victim.i, poor.i, 1);
      text += got.length ? `${dn(victim.name)} loses 1 ${RES_NAME[got[0]]} to ${dn(poor.name)}.` : `${dn(victim.name)}'s Coffer is already bare.`; break;
    }
    case 'levy_of_the_crown': {
      const got = [];
      for (const h of H) {
        if (totalLegions(state, h.i) >= 3) continue;
        const spot = heldPlots(state, h.i).filter((pid) => legionsOn(state, pid, h.i) < C.legionCapPerPlot)
          .sort((a, b) => legionsOn(state, a, h.i) - legionsOn(state, b, h.i) || a - b)[0];
        if (spot) { addLegion(state, spot, h.i); got.push(dn(h.name)); fx(state, { t: 'muster', h: h.i, plot: spot }); }
      }
      text += got.length ? `${got.join(', ')} gain a Legion.` : 'No House qualifies.'; break;
    }
    case 'market_glut': {
      const hit = H.filter((h) => wealth(h) > 6); hit.forEach((h) => takeRandom(state, h.i, null, 2));
      text += hit.length ? `${hit.map((h) => dn(h.name)).join(', ')} discard two resources.` : 'No Coffer is over six.'; break;
    }
    case 'council_of_houses': {
      const top = Math.max(...H.map((h) => h.favor)); const lead = H.filter((h) => h.favor === top);
      if (lead.length === 1 && top > 0) { gainRenown(state, lead[0].i, C.councilRenown, 'Council'); text += `${dn(lead[0].name)} leads the Council and gains 2 Renown.`; }
      else text += 'No single House leads the Council.'; break;
    }
    case 'death_in_the_court': {
      const holders = H.filter((h) => h.dynasty);
      if (holders.length) { const v = R.pick(state.rng, holders); text += `${dn(v.name)}'s Dynasty holder dies.`; after = () => succession(state, v.i); }
      else text += 'No House holds a Dynasty.';
      break;
    }
    case 'lean_winter': {
      const hit = H.filter((h) => h.coffer.G < 3 && h.coffer.C > 0); hit.forEach((h) => h.coffer.C--);
      text += hit.length ? `${hit.map((h) => dn(h.name)).join(', ')} lose 1 Coin.` : 'Every granary holds.'; break;
    }
    case 'blood_moon': text += 'The moon rises red. Nothing happens.'; break;
  }
  log(state, null, text, 'event');
  fx(state, { t: 'event', id: ev.id });
  if (after) after();
  endEventPhase(state);
}
function endEventPhase(state) { if (isFloodSeason(state.season)) state.phase = 'flood'; else nextSeason(state); }

// ---------------------------------------------------------------- Event choices (Expanded X7)
// Which House a Dilemma falls to (see DILEMMAS[].falls); ties are broken at random.
function dilemmaHouse(state, id) {
  const H = state.houses;
  const on = (h, f) => state.plots.filter((p) => f(plotById(p.id))).reduce((a, p) => a + (p.m[h] || 0), 0);
  const val = {
    refugees: (h) => on(h.i, (p) => p.reach === 2), bishops_purse: (h) => h.favor, captain: (h) => -totalLegions(state, h.i),
    granary_rot: (h) => h.coffer.G, drowned_abbey: (h) => -h.coffer.L, fair_challenge: (h) => h.renown,
    reedmen: (h) => on(h.i, (p) => p.res === 'R'), crown_envoy: (h) => -h.renown,
  }[id];
  const v = H.map(val); const best = Math.max(...v);
  return R.pick(state.rng, H.filter((h, k) => v[k] === best)).i;
}
const legionRoom = (state, h) => heldPlots(state, h).filter((pid) => legionsOn(state, pid, h) < C.legionCapPerPlot);
export function dilemmaOptions(state, h, id) {
  const house = state.houses[h]; const D = eventById[id];
  let ok = true, why = null;
  if (id === 'refugees' && house.coffer.G < 2) { ok = false; why = 'Needs 2 Grain.'; }
  if (id === 'captain') { if (!legionRoom(state, h).length) { ok = false; why = 'No Plot of yours has room for Legions.'; } else if (house.coffer.C < 2) { ok = false; why = 'Needs 2 Coin.'; } }
  if (id === 'drowned_abbey') { if (HOUSES[house.name].noLore) { ok = false; why = `${dn(house.name)} keeps no Lore.`; } else if (house.coffer.T < 1) { ok = false; why = 'Needs 1 Timber.'; } }
  if (id === 'reedmen' && house.coffer.C < 1) { ok = false; why = 'Needs 1 Coin.'; }
  return [{ key: 'a', label: D.a.label, text: D.a.text, ok, why }, { key: 'b', label: D.b.label, text: D.b.text, ok: true, why: null }];
}
// How an AI lord answers a Dilemma: rough value of choice a over choice b, coloured by the lord's trait.
export function dilemmaPick(state, h, id) {
  const house = state.houses[h]; const tr = house.lord?.trait;
  if (!dilemmaOptions(state, h, id)[0].ok) return 'b';
  const rivals = state.houses.length - 1; const strongest = Math.max(0, ...heldPlots(state, h).map((pid) => legionsOn(state, pid, h)));
  let d = 0;
  switch (id) {
    case 'refugees': d = 0.5 + 0.15 * rivals - 0.6 + (tr === 'honourable' || tr === 'pious' ? 0.6 : 0) - (tr === 'covetous' ? 0.6 : 0); break;
    case 'bishops_purse': d = 0.25 - 1 + (tr === 'covetous' ? 1.1 : 0) + (tr === 'treacherous' ? 0.6 : 0) - (tr === 'pious' ? 0.5 : 0); break;
    case 'captain': d = 0.9 + (tr === 'bold' ? 0.4 : 0) - (tr === 'covetous' ? 0.5 : 0); break;
    case 'granary_rot': { const G = house.coffer.G; d = -0.25 * Math.ceil(G / 2) + 0.5 * (0.25 * G + 0.5) + (tr === 'cautious' ? 0.4 : 0) - (tr === 'bold' ? 0.6 : 0); break; }
    case 'drowned_abbey': d = 0.05 + (HOUSES[house.name].riteRenown ? 0.5 : 0) + (tr === 'cunning' || tr === 'pious' ? 0.3 : 0); break;
    case 'fair_challenge': { const p = Math.max(0, Math.min(1, (strongest + 2) / 6)); d = p * 2 - (1 - p) + 0.5 + (tr === 'bold' || tr === 'proud' ? 0.6 : 0) - (tr === 'cautious' ? 0.6 : 0); break; }
    case 'reedmen': d = 0.55 - (totalLegions(state, h) ? -0.1 : 0.5) + (tr === 'covetous' ? -0.5 : 0); break;
    case 'crown_envoy': d = 0.3 - (house.coffer.I ? 0.3 : 0) + (tr === 'bold' ? -0.6 : 0) + (tr === 'pious' ? 0.3 : 0); break;
  }
  return d >= 0 ? 'a' : 'b';
}
function resolveDilemma(state, h, id, key) {
  const house = state.houses[h]; const me = dn(house.name); const D = eventById[id];
  if (key === 'a' && !dilemmaOptions(state, h, id)[0].ok) key = 'b';
  const rivals = state.houses.filter((x) => x.i !== h);
  const raise = (who, n) => { let got = 0; for (let k = 0; k < n; k++) { const spot = legionRoom(state, who).sort((a, b) => legionsOn(state, a, who) - legionsOn(state, b, who) || a - b)[0]; if (!spot) break; addLegion(state, spot, who); fx(state, { t: 'muster', h: who, plot: spot }); got++; } return got; };
  const loseFavor = (n) => { const was = house.favor; house.favor = Math.max(0, house.favor - n); return was - house.favor; };
  let text = '';
  switch (`${id}:${key}`) {
    case 'refugees:a': house.coffer.G -= 2; house.favor++; rivals.forEach((x) => shiftRegard(state, x.i, h, 1)); text = `${me} shelters the refugees: 2 Grain given, 1 Favor gained, and the river speaks well of it.`; break;
    case 'refugees:b': rivals.forEach((x) => shiftRegard(state, x.i, h, -1)); text = `${me} turns the refugees away. The other Houses take note.`; break;
    case 'bishops_purse:a': house.coffer.C += 3; loseFavor(1); text = `${me} takes the bishop's purse: 3 Coin, and a little less Favor.`; break;
    case 'bishops_purse:b': gainRenown(state, h, 1, 'Event'); text = `${me} refuses the bishop's silver in the square and gains 1 Renown.`; break;
    case 'captain:a': { house.coffer.C -= 2; const n = raise(h, 2); text = `${me} hires the captain's company: ${n} Legion${n === 1 ? '' : 's'} for 2 Coin.`; break; }
    case 'captain:b': {
      const top = Math.max(...rivals.map((x) => totalLegions(state, x.i))); const pool = rivals.filter((x) => totalLegions(state, x.i) === top && legionRoom(state, x.i).length);
      const to = pool.length ? R.pick(state.rng, pool) : null;
      text = to && raise(to.i, 1) ? `${me} lets the captain ride on. He sells his sword to ${dn(to.name)}.` : `${me} lets the captain ride on, and nobody hires him.`; break;
    }
    case 'granary_rot:a': { const n = Math.ceil(house.coffer.G / 2); house.coffer.G -= n; text = `${me} burns the stores and loses ${n} Grain.`; break; }
    case 'granary_rot:b': { const d = R.d6(state.rng); if (d <= 3) { const n = house.coffer.G; house.coffer.G = 0; loseFavor(1); text = `${me} says nothing. The rot spreads (${d}): ${n} Grain lost, and the Favor of the market with it.`; } else text = `${me} says nothing, and the rot goes no further (${d}).`; break; }
    case 'drowned_abbey:a': house.coffer.T -= 1; house.coffer.L += 2; text = `${me} sends divers into the undercroft and brings up 2 Lore.`; break;
    case 'drowned_abbey:b': house.coffer.C += 2; text = `${me} sells the salvage rights for 2 Coin.`; break;
    case 'fair_challenge:a': {
      const L = Math.max(0, ...heldPlots(state, h).map((pid) => legionsOn(state, pid, h))); const d = R.d6(state.rng);
      if (d + L >= 5) { gainRenown(state, h, 2, 'Event'); text = `${me} accepts the challenge and wins (${d} + ${L}): 2 Renown.`; }
      else { gainRenown(state, h, -1, 'Event'); text = `${me} accepts the challenge and is beaten (${d} + ${L}): 1 Renown lost.`; }
      break;
    }
    case 'fair_challenge:b': text = loseFavor(1) ? `${me} declines the challenge and loses 1 Favor.` : `${me} declines the challenge.`; break;
    case 'reedmen:a': house.coffer.C -= 1; house.favor++; house.coffer.R++; text = `${me} grants the Reedmen their charter: 1 Favor and 1 Reed.`; break;
    case 'reedmen:b': {
      house.coffer.C += 2;
      const spot = heldPlots(state, h).filter((pid) => legionsOn(state, pid, h) > 0).sort((a, b) => legionsOn(state, b, h) - legionsOn(state, a, h) || a - b)[0];
      if (spot) removeLegions(state, spot, h, 1);
      text = `${me} taxes the fens for 2 Coin${spot ? `, and a Legion deserts at ${plotById(spot).name}` : ''}.`; break;
    }
    case 'crown_envoy:a': { house.favor += 2; const paid = house.coffer.I > 0; if (paid) house.coffer.I--; text = `${me} swears fealty to the Crown: 2 Favor${paid ? ', and 1 Iron in tribute' : ''}.`; break; }
    case 'crown_envoy:b': { const n = raise(h, 1); house.coffer.I++; loseFavor(1); text = `${me} asks the Crown for arms: 1 Iron${n ? ' and a Legion' : ''}.`; break; }
  }
  house.dilemmas = (house.dilemmas || 0) + 1;
  log(state, h, `${D.name}: ${text}`, 'event');
  fx(state, { t: 'dilemma', h, id, key });
  endEventPhase(state);
}

function succession(state, i) {
  const h = state.houses[i];
  if (!h.dynasty) return;
  const heir = h.heir;
  heir.revealed = true; heir.knownBy = state.houses.map((x) => x.i);
  const dead = lordName(h); const heirN = heirName(state, h);
  if (heir.status === 'G') {
    log(state, i, `${dead} of ${dn(h.name)} dies. ${heirN}, a true-born Heir, takes the Dynasty.`, 'court');
    h.lord = { ...newLord(state, h, heirN), since: state.season };
    if (HOUSES[h.name].successionBonus) gainRenown(state, i, C.thorneSuccessionBonus, 'Succession');
    if (h.betrothed != null) { gainRenown(state, i, 1, 'Betrothal'); log(state, i, `${dn(state.houses[h.betrothed].name)}, kin by marriage, stands beside the new lord: 1 Renown.`, 'court'); }
    h.heirsCrowned = (h.heirsCrowned || 0) + 1;
    newHeir(state, h);   // R23: the Heir now holds the Dynasty; the line needs a new, hidden Heir
    fx(state, { t: 'succession', h: i, result: 'G' });
  } else {
    h.dynasty = false; gainRenown(state, i, -C.impostorPenalty, 'Impostor');
    log(state, i, `${dead} of ${dn(h.name)} dies, and ${heirN} is unmasked as an Impostor. The Dynasty falls, and 2 Renown with it; a regent takes the seat.`, 'court');
    h.lord = newLord(state, h);
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
    log(state, v.i, `Ember Pressure breaks at ${state.pressure}. Catastrophe strikes ${dn(v.name)}${lost != null ? `, which loses a marker at ${plotById(lost).name}` : ''}.`, 'magic');
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
  for (const h of state.houses) if ((h.heir.revealed && h.heir.status === 'G') || h.heirsCrowned) gainRenown(state, h.i, heirEndRenown(state, h), 'Genuine Heir');
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
  delete s.seed;   // the seed regenerates every hidden pile and deck
  s.fx = s.fx.filter((e) => !e.only || e.only.includes(viewer));
  for (const h of s.houses) {
    const knows = h.heir.revealed || h.heir.knownBy.includes(viewer);
    if (!knows) h.heir.status = '?';
    if (!h.heir.revealed) h.heir.knownBy = h.heir.knownBy.includes(viewer) ? h.heir.knownBy.filter((k) => k === viewer || k === h.i) : [];
    h.heirPile = h.heirPile.length; h.invDeck = h.invDeck.length;
    if (h.i === viewer) continue;
    h.heir.serial = h.heir.pub || h.heir.serial; delete h.married; delete h.heirsLost;   // a Vigil's marriage stays private
    h.rites = h.rites.length; h.invHand = h.invHand.length; h.invDiscard = h.invDiscard.length;
    if (!h.cabalExposed) { h.cabalTokens = '?'; for (const p of s.plots) if (p.cabal === h.i) p.cabal = null; }
  }
  return s;
}
