// Hollowmere AI. Each opponent looks one Action ahead: it tries every legal Action on a copy of
// the game, scores the result with a value function seen from its own seat, and plays the best.
// The value function only reads what that House may know (engine.view rules): rival Heirs stay
// unknown unless revealed or tested, Sable's hidden Cabal is ignored, and random results are
// re-rolled on the copy so the AI never peeks at the real dice.
// Personality comes from per-House weights that pull each House toward its own win path.
import * as E from '../rules/engine.js';
import { CONFIG as C, PLOTS, REACHES, HOUSES, RES, riteById, pips, plotById, ADJ } from '../rules/data.js';
import * as R from '../rules/rng.js';

// Weights per House. Unlisted keys fall back to BASE.
const BASE = {
  reach: 1, prod: 1, res: 1, legion: 1, favor: 1, dynasty: 1, heir: 1, rite: 1, inv: 1, threat: 1,
  raid: 0, aggression: 1, keep: 1, wide: 1,
};
export const PERSONA = {
  Ash: { legion: 1.4, raid: 0.45, aggression: 1.2, prod: 0.85, favor: 0.7, inv: 0.6, style: 'Conquers neighbouring Plots and contests every Reach by force.' },
  Verrin: { prod: 1.15, favor: 1.4, dynasty: 1.5, keep: 1.2, aggression: 0.7, style: 'Builds a deep granary economy and buys Dynasties early.' },
  Maelor: { res: 1.3, prod: 1.1, favor: 1.1, aggression: 0.75, style: "Hoards and converts through the Merchant's Writ, then buys position." },
  Thorne: { heir: 1.8, dynasty: 1.5, favor: 1.4, reach: 1.1, aggression: 0.7, style: 'Tends its bloodline: Vigil, reveal, Dynasty, succession.' },
  Wren: { favor: 1.3, dynasty: 1.2, wide: 1.2, aggression: 0.6, threat: 1.2, style: 'Spreads wide behind its Accords and turns Favor into Dynasty.' },
  Sable: { prod: 1.3, reach: 1.1, aggression: 0.8, style: 'Builds hidden income with the Cabal and claims late Reaches.' },
  Caddoc: { rite: 2.2, res: 1.1, aggression: 0.7, style: 'Feeds its Rite hand and casts whenever the Pressure allows.' },
  Raven: { inv: 1.8, heir: 1.2, aggression: 0.5, legion: 0.8, style: 'Draws Seals and exposes Impostors, avoiding open battle.' },
};
const W = (name) => ({ ...BASE, ...(PERSONA[name] || {}) });

const ROUND_SEASONS = (s) => C.floodSeasons.filter((f) => f >= s.season && !(f === s.season && (s.phase === 'flood' || s.phase === 'over')));
function seasonsLeft(s) { return Math.max(0, C.seasons - s.season + (s.phase === 'harvest' ? 1 : 0.5)); }

// Probability helpers --------------------------------------------------------------------------
const TWO_D6 = (() => { const d = {}; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) d[a + b] = (d[a + b] || 0) + 1 / 36; return d; })();
// Chance the attacker strictly wins a Skirmish (ties re-roll, so normalise them away).
export function skirmishWin(att, def) {
  let w = 0, l = 0;
  for (const [x, px] of Object.entries(TWO_D6)) for (const [y, py] of Object.entries(TWO_D6)) {
    const d = (+x + att) - (+y + def);
    if (d > 0) w += px * py; else if (d < 0) l += px * py;
  }
  return w / (w + l);
}
const sig = (x) => 0.5 + 0.5 * Math.tanh(x);

// Value of the state for House h --------------------------------------------------------------
export function value(s, h) {
  const me = s.houses[h]; const w = W(me.name); const H = HOUSES[me.name];
  const left = seasonsLeft(s); const floods = ROUND_SEASONS(s);
  let v = me.renown * 1.0;

  // 1. Reach positions for each Flood still to come.
  for (const reach of REACHES) {
    const counts = E.reachCounts(s, reach.id);
    const mine = counts[h]; const others = counts.filter((_, i) => i !== h);
    const best = Math.max(0, ...others); const second = others.slice().sort((a, b) => b - a)[1] || 0;
    const mult = reach.delta ? C.deltaMultiplier : 1;
    for (const f of floods) {
      const far = Math.max(0, f - s.season);
      const blur = 1 + far * 0.45;            // the further the Flood, the less a lead is worth
      const pFirst = mine === 0 ? 0 : sig((mine - best - 0.5) / blur);
      const [p1, p2] = f === C.seasons ? C.finalFloodPoints : C.midFloodPoints;
      let pSecond = 0;
      if (p2 && mine > 0) pSecond = (1 - pFirst) * sig((mine - second - 0.5) / blur);
      v += w.reach * mult * (p1 * pFirst + p2 * pSecond) * (f === C.seasons ? 1 : 0.95);
    }
    // Ash: conquest bonus in Reaches where it has won a Skirmish.
    if (H.conquest && me.skirmishReaches.includes(reach.id) && mine > best) v += 0.8;
  }

  // 2. Production: expected resources per Harvest from markers (and own Cabal).
  let prod = 0;
  for (const p of PLOTS) {
    const plot = s.plots[p.id - 1]; const m = plot.m[h] || 0;
    let amt = m >= 2 ? m * 2 : m;
    if (plot.cabal === h) amt += 1;
    if (!amt) continue;
    if (p.res === 'L' && H.noLore) continue;
    if (p.res === 'G' && H.granary && m) amt += 1;
    prod += amt * pips(p.n) / 36 * resWeight(me, p.res);
  }
  v += w.prod * prod * Math.min(left, 9) * 0.55;

  // 3. Coffer: resources are worth less the more you have of one kind, and nothing at the end.
  const endFade = Math.min(1, left / 3);
  let res = 0;
  for (const r of RES) { const n = me.coffer[r]; res += resWeight(me, r) * (Math.min(n, 4) * 0.32 + Math.max(0, n - 4) * 0.08); }
  const sets = Math.min(me.coffer.G, me.coffer.T, me.coffer.S);
  res += Math.min(sets, 2) * 0.35;                         // a Build in hand
  v += w.res * res * endFade;
  v += Math.min(me.coffer.C, 2) * 0.12;                    // keep Coin to avoid paying passes into nothing

  // 4. Military: Legions guard Plots and enable Raids; exposed Plots are a risk.
  let leg = 0, threat = 0;
  for (const p of s.plots) {
    const mine = p.l[h] || 0; if (mine) leg += Math.min(mine, 3) * (0.55 + 0.1 * (p.m[h] || 0));
    if (!(p.m[h] > 0)) continue;
    let enemy = 0;
    for (const q of ADJ[p.id - 1]) for (const [k, n] of Object.entries(s.plots[q - 1].l)) if (+k !== h && !E.hasAccord(s, h, +k)) enemy = Math.max(enemy, Math.min(2, n));
    if (enemy) threat += (mine ? (1 - skirmishWin(enemy, mine)) * 0.6 : 1.1) * (p.m[h] >= 2 ? 1.3 : 1);
  }
  v += w.legion * leg * Math.min(1, left / 2);
  v -= w.threat * threat * (floods.length ? 0.9 : 0.2) * Math.min(1, left / 2);

  // 5. Favor and Dynasty.
  const dynCost = E.dynastyFavor(me);
  const favorUse = !me.dynasty ? Math.min(me.favor, dynCost) * 0.55 + Math.max(0, me.favor - dynCost) * 0.15 : me.favor * 0.2;
  v += w.favor * favorUse * Math.min(1, left / 4);
  if (me.dynasty) {
    const known = me.heir.knownBy.includes(h) || me.heir.revealed;
    const qImp = known ? (me.heir.status === 'I' ? 1 : 0) : 0.8;
    const n = floods.length;
    v += w.dynasty * (n * C.dynastyFloodRenown * (1 - 0.25 * qImp * 0.5) - n * C.holderDeathChance * qImp * C.impostorPenalty);
    if (H.successionBonus && !qImp) v += n * C.holderDeathChance * C.thorneSuccessionBonus;
  }
  if (!me.dynasty && me.coffer.R) v += Math.min(me.coffer.R, 2) * 0.15 * w.dynasty * endFade;

  // 6. Heir: a revealed Genuine Heir scores at the end; a known one can be revealed.
  if (me.heir.status === 'G' && me.heir.revealed) v += w.heir * C.genuineHeirEndRenown;
  else if (me.heir.status === 'G' && me.heir.knownBy.includes(h)) v += w.heir * C.genuineHeirEndRenown * 0.7;
  else if (H.vigil && !me.heir.knownBy.includes(h)) v += w.heir * 0.5 * (me.married ? 0.2 : 0.36) * C.genuineHeirEndRenown;

  // 7. Cards in hand.
  v += w.rite * me.rites.length * (H.riteRenown ? 1.4 : 0.45) * Math.min(1, left / 2);
  const seals = me.invHand.filter((c) => c === 'seal').length;
  v += w.inv * ((me.invHand.length - seals) * 0.45 + seals * (H.seal ? 1.3 : 0)) * Math.min(1, left / 2);

  // 8. Ember Pressure: being the heaviest caster when it breaks costs a marker.
  if (s.pressure >= C.pressureThreshold - 0.5 && floods.includes(s.season)) {
    const most = Math.max(...s.houses.map((x) => x.ritesSeason));
    if (me.ritesSeason && me.ritesSeason === most) v -= 2.2;
  }
  return v;
}

function resWeight(me, r) {
  const H = HOUSES[me.name];
  let w = { G: 1.05, T: 0.95, S: 0.95, I: 0.8, R: 0.8, C: 0.85, L: 0.7 }[r];
  if (r === 'I' && (H.conquest || H.muster)) w *= 1.3;
  if (r === 'L' && (H.seal || H.reedForLore)) w *= 1.5;
  if (r === 'R' && (H.reedForLore || H.dynastyFavor)) w *= 1.25;
  if (r === 'C' && H.writ) w *= 1.2;
  if (r === 'L' && H.noLore) w *= 0.4;
  return w;
}

// Strip what h cannot know before simulating on a copy.
// Hidden things are replaced: unknown Heirs (rivals' and its own) become a neutral guess,
// deck order is reshuffled, and a rival's hidden Cabal is removed.
function belief(state, h, salt) {
  const s = { ...state, log: [], fx: [] };
  const c = E.clone(s);
  c.rng = { s: R.hashSeed(`${state.seed}:${state.seq}:${h}:${salt}`) };
  c.riteDeck = R.shuffle(c.rng, c.riteDeck);
  for (const x of c.houses) {
    x.invDeck = R.shuffle(c.rng, x.invDeck);
    x.heirPile = R.shuffle(c.rng, x.heirPile);
    if (!x.heir.revealed && !x.heir.knownBy.includes(h)) x.heir.status = 'G';
    if (x.i === h) continue;
    if (!x.cabalExposed) for (const p of c.plots) if (p.cabal === x.i) p.cabal = null;
  }
  return c;
}
// Chance a House's unknown Heir is Genuine, from what is public: one Genuine among the cards left.
function pGenuine(house) { return 1 / (house.heirPile.length + 1); }

const BONUS = {
  // Small per-House leanings so styles show on the board even when values are close.
  Ash: { raid: 0.1, muster: 0.15 },
  Verrin: { dynasty: 0.5, keep: 0.15 },
  Maelor: { trade: 0.1 },
  Thorne: { vigil: 0.4, reveal: 0.5, dynasty: 0.3 },
  Wren: { favor: 0.15, dynasty: 0.3 },
  Sable: { cabal: 0.7 },
  Caddoc: { rite: 0.4 },
  Raven: { seal: 0.5, investigate: 0.25 },
};

// Score every legal Action; return them best first.
export function rankActions(state, h = state.turn, { noise = 0.15 } = {}) {
  const me = state.houses[h]; const w = W(me.name);
  const acts = E.legalActions(state, h);
  const base = belief(state, h, 'base');
  const scored = [];
  const rng = { s: R.hashSeed(`${state.seed}:${state.seq}:${h}:noise`) };
  for (const a of acts) {
    let score;
    if (a.type === 'raid') {
      const tgt = state.houses[a.target];
      const def = E.legionsOn(state, a.to, a.target);
      const att = Math.min(a.n, 3) + (HOUSES[me.name].skirmish || 0);
      const dm = def ? Math.min(def, 3) + (HOUSES[tgt.name].skirmish || 0) : 0;
      const p = def ? skirmishWin(att, dm) : 1;
      const sw = applyOn(base, a, h, { skirmish: 'win' });
      const sl = def ? applyOn(base, a, h, { skirmish: 'lose' }) : null;
      score = p * sw + (sl == null ? 0 : (1 - p) * sl) + w.raid * (def ? 0.5 : 0.8) * w.aggression;
    } else if (a.type === 'seal' || (a.type === 'rite' && a.rite === 'ink_of_names')) {
      // Expected value without peeking at the hidden Heir.
      const after = applyOn(base, a, h, {});
      const tgt = a.target != null ? state.houses[a.target] : null;
      const known = tgt && tgt.heir.knownBy.includes(h);
      const pImp = known ? (tgt.heir.status === 'I' ? 1 : 0) : tgt ? 1 - pGenuine(tgt) : 0.8;
      score = after + pImp * C.sealRenown * (a.type === 'seal' ? 1 : 0.9);
      if (a.type === 'seal' && known) score -= 3;     // testing a Heir you already know is wasted
    } else if (a.type === 'play' && a.card === 'witness') {
      score = applyOn(base, a, h) + 0.35;
    } else score = applyOn(base, a, h);
    score += (BONUS[me.name]?.[a.type] || 0);
    if (a.type === 'pass') score -= 0.05;
    score += (R.next(rng) - 0.5) * noise;
    scored.push({ a, score });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored;
}

// Value after action a. If h does not know its own Heir, average the Genuine and Impostor worlds.
function applyOn(base, a, h, opts = {}) {
  const me = base.houses[h];
  const ownUnknown = !me.heir.revealed && !me.heir.knownBy.includes(h);
  const once = (status) => { const c = E.clone(base); if (status) c.houses[h].heir.status = status; E.applyAction(c, a, opts); return value(c, h); };
  if (!ownUnknown || !(a.type === 'vigil' || me.dynasty || a.type === 'dynasty')) return once(null);
  const p = pGenuine(me);
  return p * once('G') + (1 - p) * once('I');
}

export function chooseAction(state, h = state.turn, opts) {
  return rankActions(state, h, opts)[0].a;
}

// Wren's Accords when Wren is played by the AI are formed by the engine's border rule; this is
// the suggestion offered to a human Wren.
export function suggestAccords(state, h) {
  return E.accordCandidates(state, h).slice(0, HOUSES.Wren.accords).map((o) => o.house);
}

// Run AI turns until a human must act or the game ends. Returns the number of Actions played.
export function playAI(state, { maxSteps = 1000 } = {}) {
  let n = 0;
  while (n < maxSteps && state.phase !== 'over') {
    if (state.pending) {
      const p = state.pending;
      if (state.houses[p.h].human) break;
      E.decide(state, { partners: suggestAccords(state, p.h) });
      continue;
    }
    const cur = state.houses[state.turn];
    if (cur.human) break;
    E.applyAction(state, chooseAction(state, cur.i));
    n++;
  }
  return n;
}
