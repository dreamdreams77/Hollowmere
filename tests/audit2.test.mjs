// Audit 2: regression tests and invariant guards (engine, AI, hidden information, saves).
// Run: node --test tests/audit2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/rules/engine.js';
import { HOUSE_ORDER } from '../src/rules/data.js';
import { playAI } from '../src/ai/ai.js';
import * as R from '../src/rules/rng.js';
import { CONFIG as C, RITES, RES } from '../src/rules/data.js';

// Shared helpers for the audit2 tests: random-legal-action play and state invariants.

// Returns a list of invariant violations (empty when the state is sound).
function invariants(s) {
  const bad = [];
  const n = s.houses.length;
  if (!['harvest', 'actions', 'event', 'flood', 'over'].includes(s.phase)) bad.push(`phase ${s.phase}`);
  if (s.phase === 'actions' && (s.turn < 0 || s.turn >= n || s.round < 0 || s.round >= C.actionsPerSeason)) bad.push(`turn ${s.turn} round ${s.round}`);
  if (s.season < 1 || s.season > C.seasons) bad.push(`season ${s.season}`);
  for (const h of s.houses) {
    for (const r of RES) if (!Number.isInteger(h.coffer[r]) || h.coffer[r] < 0) bad.push(`${h.name} coffer ${r}=${h.coffer[r]}`);
    if (!Number.isInteger(h.favor) || h.favor < 0) bad.push(`${h.name} favor ${h.favor}`);
    if (h.rites.length > C.riteHandLimit) bad.push(`${h.name} rites ${h.rites.length}`);
    if (h.invHand.length > C.investigationHandLimit) bad.push(`${h.name} invHand ${h.invHand.length}`);
    if (h.invHand.length + h.invDeck.length + h.invDiscard.length !== 12) bad.push(`${h.name} inv cards not conserved`);
    if (!['G', 'I'].includes(h.heir.status)) bad.push(`${h.name} heir ${h.heir.status}`);
    if (h.cabalTokens > C.cabalMax) bad.push(`${h.name} cabal tokens ${h.cabalTokens}`);
    if (h.cabalTokens !== s.plots.filter((p) => p.cabal === h.i).length) bad.push(`${h.name} cabal token count mismatch`);
    for (const [k, r] of Object.entries(h.regard || {})) {
      if (+k === h.i) bad.push(`${h.name} regards itself`);
      if (!Number.isInteger(r) || r < -5 || r > 5) bad.push(`${h.name} regard ${k}=${r}`);
    }
    if (h.accords.length > 2 || h.accords.includes(h.i)) bad.push(`${h.name} accords ${h.accords}`);
    for (const p of h.pacts || []) {
      if (p.with === h.i) bad.push(`${h.name} pact with self`);
      const back = s.houses[p.with].pacts.filter((q) => q.with === h.i);
      if (back.length !== 1 || back[0].until !== p.until) bad.push(`${h.name} pact not symmetric`);
      if (h.pacts.filter((q) => q.with === p.with).length > 1) bad.push(`${h.name} duplicate pact`);
      if (s.phase !== 'over' && p.until < s.season && s.phase !== 'harvest') bad.push(`${h.name} pact with ${p.with} outlived Season ${p.until} (now ${s.season})`);
      const life = h.betrothed === p.with && p.until === E.BETROTH_LIFE;   // X8: a betrothal Pact lasts the game
      if (p.until > s.season + 1 && !life) bad.push(`${h.name} pact until ${p.until} in Season ${s.season}`);
      if (h.betrothed != null && s.houses[h.betrothed].betrothed !== h.i) bad.push(`${h.name} betrothal is one-sided`);
    }
    if (s.rules !== 'expanded' && (h.pacts || []).length) bad.push(`${h.name} pact in original rules`);
  }
  let ritesSeen = s.riteDeck.length + s.riteDiscard.length;
  for (const h of s.houses) ritesSeen += h.rites.length;
  if (ritesSeen !== RITES.length) bad.push(`rite cards not conserved: ${ritesSeen}`);
  for (const p of s.plots) {
    for (const [k, m] of Object.entries(p.m)) {
      if (!Number.isInteger(m) || m < 1 || m > C.keepCap) bad.push(`P${p.id} markers ${k}=${m}`);
      if (+k < 0 || +k >= n) bad.push(`P${p.id} bad house ${k}`);
    }
    for (const [k, l] of Object.entries(p.l)) {
      if (!Number.isInteger(l) || l < 1 || l > C.legionCapPerPlot) bad.push(`P${p.id} legions ${k}=${l}`);
      if (!(p.m[k] > 0)) bad.push(`P${p.id} legions of ${k} without a marker`);
    }
    if (p.walls != null && !(p.m[p.walls] > 0)) bad.push(`P${p.id} walls of ${p.walls} without a marker`);
    if (p.walls != null && s.rules !== 'expanded') bad.push(`P${p.id} walls in original rules`);
    for (const c of p.contests) if (c.victim === c.captor) bad.push(`P${p.id} self contest`);
  }
  if (s.pending) {
    const ph = s.houses[s.pending.h];
    if (!ph || !ph.human) bad.push(`pending ${s.pending.type} for a non-human House`);
  }
  if (s.phase === 'over' && (!s.winner || !s.winner.length)) bad.push('over without winner');
  return bad;
}

// Random legal play. Returns { state, trace } with every action or decision taken.
function randomGame({ houses, rules, seed, humans = [], maxSteps = 3000, check, rngSeed }) {
  const s = E.newGame({ houses, seed, rules, humans });
  const rng = { s: R.hashSeed(rngSeed ?? `rand:${seed}`) };
  const trace = [];
  for (let step = 0; step < maxSteps && s.phase !== 'over'; step++) {
    if (s.pending) {
      let choice;
      if (s.pending.type === 'pact' || s.pending.type === 'betroth') choice = { accept: R.next(rng) < 0.5 };
      else if (s.pending.type === 'dilemma') choice = { pick: R.next(rng) < 0.5 ? 'a' : 'b' };
      else choice = { partners: R.shuffle(rng, s.pending.options.map((o) => o.house)).slice(0, R.int ? R.int(rng, 3) : Math.floor(R.next(rng) * 3)) };
      trace.push({ decide: choice });
      E.decide(s, choice);
    } else {
      const acts = E.legalActions(s);
      if (!acts.length) throw new Error(`no legal actions at season ${s.season}`);
      // Bias away from Pass so games are busy.
      let a = R.pick(rng, acts);
      if (a.type === 'pass' && acts.length > 1 && R.next(rng) < 0.9) a = R.pick(rng, acts.filter((x) => x.type !== 'pass'));
      trace.push({ act: a });
      E.applyAction(s, a);
    }
    if (check) check(s, trace);
  }
  return { state: s, trace };
}

function replay({ houses, rules, seed, humans = [] }, trace) {
  const s = E.newGame({ houses, seed, rules, humans });
  for (const t of trace) { if (t.decide) E.decide(s, t.decide); else E.applyAction(s, t.act); }
  return s;
}

const atActions = (s, turn = 0) => { s.phase = 'actions'; s.round = 0; s.turn = turn; s.pending = null; return s; };

// ------------------------------------------------------------------ invariant guards (pass today)

test('fuzz: random legal play keeps every invariant (2-4 players, both rule sets, with and without a human)', () => {
  const rng = { s: 4242 };
  for (let g = 0; g < 240; g++) {
    const players = 2 + (g % 3); const rules = g % 2 ? 'expanded' : 'original';
    const houses = R.shuffle(rng, HOUSE_ORDER).slice(0, players);
    const humans = g % 4 < 2 ? [houses[g % players]] : [];
    const seed = `a2-${g}`;
    const { state } = randomGame({ houses, rules, seed, humans, check: (s, t) => {
      const bad = invariants(s);
      assert.deepEqual(bad, [], `${seed} ${houses} ${rules} humans=${humans} step ${t.length}: ${bad.join('; ')}`);
    } });
    assert.equal(state.phase, 'over', `${seed} finished`);
  }
});

test('fuzz: replaying the same actions is deterministic, and a JSON save mid-game plays on identically', () => {
  for (const [houses, rules] of [[['Wren', 'Thorne', 'Sable', 'Raven'], 'expanded'], [['Ash', 'Caddoc', 'Maelor'], 'original'], [['Verrin', 'Wren'], 'expanded']]) {
    const cfg = { houses, rules, seed: `det-${houses.length}`, humans: [houses[0]] };
    const { state, trace } = randomGame(cfg);
    assert.equal(JSON.stringify(replay(cfg, trace)), JSON.stringify(state));
    const half = trace.slice(0, trace.length >> 1);
    const a = replay(cfg, half); const b = E.migrate(JSON.parse(JSON.stringify(a)));
    for (const t of trace.slice(half.length)) for (const z of [a, b]) { if (t.decide) E.decide(z, t.decide); else E.applyAction(z, t.act); }
    assert.equal(JSON.stringify(b), JSON.stringify(a));
  }
});

test('AI-only Expanded games never stall on a pending choice and keep every invariant', () => {
  for (let g = 0; g < 6; g++) {
    const houses = R.shuffle({ s: 77 + g }, HOUSE_ORDER).slice(0, 2 + (g % 3));
    const s = E.newGame({ houses, seed: `ai-${g}`, rules: 'expanded' });
    while (s.phase !== 'over') {
      const n = playAI(s, { maxSteps: 1 });
      assert.ok(n === 1 || s.phase === 'over', 'playAI made progress');
      assert.equal(s.pending, null);
      assert.deepEqual(invariants(s), []);
    }
  }
});

test('engine.migrate brings an older (v1-shaped) save up to date, and it plays to the end', () => {
  const s = E.newGame({ houses: ['Wren', 'Ash', 'Raven'], seed: 'old', rules: 'original' });
  playAI(s, { maxSteps: 25 });
  const old = JSON.parse(JSON.stringify(s));
  old.v = 1; delete old.rules;
  for (const h of old.houses) { delete h.lord; delete h.regard; delete h.pacts; delete h.oaths; }
  for (const p of old.plots) { p.contest = p.contests[0] || null; delete p.contests; }
  const m = E.migrate(old);
  assert.equal(m.rules, 'original'); assert.equal(m.v, 2);
  for (const h of m.houses) { assert.ok(h.lord && h.lord.trait); assert.deepEqual(h.pacts, []); assert.equal(Object.keys(h.regard).length, 2); }
  assert.deepEqual(invariants(m), []);
  playAI(m, { maxSteps: 5000 });
  assert.equal(m.phase, 'over');
});

test('Pacts: a human target gets a pending choice; acceptance moves the gift; the Pact ends at the second Harvest', () => {
  const s = atActions(E.newGame({ houses: ['Maelor', 'Ash'], humans: ['Ash'], seed: 'pact', rules: 'expanded', seatOrder: ['Maelor', 'Ash'] }));
  s.houses[0].coffer.C = 3; const s0 = s.season;
  E.applyAction(s, { type: 'envoy', target: 1, gift: 'C' });
  assert.equal(s.pending?.type, 'pact'); assert.equal(s.houses[0].coffer.C, 2);
  assert.equal(playAI(s), 0, 'the AI waits for the human answer');
  E.decide(s, { accept: true });
  assert.equal(s.houses[0].coffer.C, 1); assert.ok(E.pactWith(s, 0, 1)); assert.equal(E.pactWith(s, 0, 1).until, s0 + 1);
  // Kept through Season s0 + 1, gone at the Harvest of s0 + 2.
  for (const [season, kept] of [[s0 + 1, true], [s0 + 2, false]]) {
    s.season = season; s.phase = 'harvest'; s.pending = null; E.advance(s); s.pending = null;
    assert.equal(!!E.pactWith(s, 0, 1), kept, `Season ${season}`);
  }
});

test('oathbreaking: Ashen Pyre with both targets on one partner breaks the Pact once', () => {
  const s = atActions(E.newGame({ houses: ['Ash', 'Verrin'], seed: 'pyre', rules: 'expanded', seatOrder: ['Ash', 'Verrin'] }));
  // Verrin keeps two markers next to Ash.
  const spot = [3, 6].find((p) => E.isEmpty(s, p));
  s.plots[spot - 1].m[1] = 2;
  s.houses[0].rites = ['ashen_pyre']; s.houses[0].coffer.T = 2; s.houses[0].favor = 3; s.houses[0].renown = 5;
  s.houses[0].pacts = [{ with: 1, until: s.season + 1 }]; s.houses[1].pacts = [{ with: 0, until: s.season + 1 }];
  E.applyAction(s, { type: 'rite', rite: 'ashen_pyre', targets: [{ plot: spot, house: 1 }, { plot: spot, house: 1 }] });
  assert.equal(s.houses[0].oaths, 1); assert.equal(s.houses[0].renown, 4); assert.equal(s.houses[0].favor, 1);
  assert.equal(E.pactWith(s, 0, 1), null); assert.equal(E.markersOn(s, spot, 1), 0);
});

// ------------------------------------------------------------------ confirmed defects (fail today)

test('DEFECT view(): no viewer may see the game seed (it regenerates every Heir pile and deck order)', () => {
  const s = E.newGame({ houses: ['Verrin', 'Ash', 'Raven', 'Thorne'], humans: ['Verrin'], seed: 'hm-abc123', rules: 'expanded' });
  for (const h of s.houses) {
    const v = E.view(s, h.i);
    // With the seed a viewer replays setup and reads every rival Heir.
    assert.equal(v.seed, undefined, `view for ${h.name} exposes the seed`);
  }
});

test('DEFECT Vigil is a private test (R5): rivals cannot tell whether Rosenvael found an Impostor', () => {
  const seen = (status) => {
    const s = atActions(E.newGame({ houses: ['Thorne', 'Raven'], seed: 'vig', rules: 'expanded', seatOrder: ['Thorne', 'Raven'] }));
    s.houses[0].heir.status = status; s.houses[0].coffer.C = 3;
    E.applyAction(s, { type: 'vigil' });
    const t = E.view(s, 1);
    return { log: t.log.at(-1).text, heirsLost: t.houses[0].heirsLost, married: t.houses[0].married, serial: t.houses[0].heir.serial };
  };
  assert.deepEqual(seen('I'), seen('G'));
});

test('DEFECT whyNot(envoy): Rosenvael sends Envoys free, so an exhausted Envoy is not explained as "Needs 1 Coin"', () => {
  const s = atActions(E.newGame({ houses: ['Thorne', 'Raven'], seed: 'env', rules: 'expanded', seatOrder: ['Thorne', 'Raven'] }));
  s.houses[0].coffer.C = 0; s.houses[0].flags.envoy = 2;
  assert.deepEqual(E.optionsFor(s, 0, 'envoy'), []);
  assert.equal(E.whyNot(s, 0, 'envoy'), 'You have already sent your Envoys this Season.');
});
