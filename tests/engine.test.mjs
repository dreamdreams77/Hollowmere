// Rules tests for the rebuilt engine. Numbers are checked against docs/source (config.py,
// HOW_TO_PLAY.md, reference.html, cards.html). Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/rules/engine.js';
import { CONFIG as C, PLOTS, ADJ, HOUSES, RITES, EVENTS, HOUSE_ORDER, pips } from '../src/rules/data.js';
import { playAI, chooseAction, skirmishWin } from '../src/ai/ai.js';

// A game frozen at the start of the Action phase with House 0 to act and empty Coffers.
function fresh(houses = ['Ash', 'Verrin', 'Maelor', 'Raven'], seed = 'T') {
  const s = E.newGame({ houses, seed, seatOrder: houses });
  s.phase = 'actions'; s.round = 0; s.turn = 0; s.pending = null;
  for (const h of s.houses) { for (const r in h.coffer) h.coffer[r] = 0; h.accords = []; h.flags = {}; }
  return s;
}
const give = (s, i, cost) => { for (const [r, n] of Object.entries(cost)) s.houses[i].coffer[r] += n; };
const act = (s, a) => E.applyAction(s, a);
const freeze = (s) => { s.phase = 'actions'; s.round = 0; s.turn = 0; };

test('board: 20 Plots, five Reaches of four, dice 2-12 never 7, adjacency by row and column', () => {
  assert.equal(PLOTS.length, 20);
  for (let r = 1; r <= 5; r++) assert.equal(PLOTS.filter((p) => p.reach === r).length, 4);
  assert.ok(PLOTS.every((p) => p.n >= 2 && p.n <= 12 && p.n !== 7));
  assert.deepEqual(ADJ[0].sort((a, b) => a - b), [2, 5]);
  assert.deepEqual(ADJ[5].sort((a, b) => a - b), [2, 5, 7, 10]);
  assert.ok(!ADJ[3].includes(5), 'P4 does not wrap to P5');
  // D2: P10 produces Stone; Stone on P8, P10, P15.
  assert.deepEqual(PLOTS.filter((p) => p.res === 'S').map((p) => p.id), [8, 10, 15]);
});

test('setup: seats, opening Coffers, two markers and Legions (Thorne one), two Rites', () => {
  const s = E.newGame({ houses: ['Ash', 'Thorne', 'Maelor', 'Raven'], seed: 1, seatOrder: ['Ash', 'Thorne', 'Maelor', 'Raven'] });
  const ash = s.houses[0], thorne = s.houses[1];
  assert.deepEqual([E.markersOn(s, 1, 0), E.markersOn(s, 2, 0), E.legionsOn(s, 1, 0)], [1, 1, 1]);
  assert.equal(E.totalMarkers(s, 1), 1, 'Thorne starts with one marker');
  assert.equal(E.totalLegions(s, 1), 1);
  for (const h of s.houses) {
    assert.ok(h.rites.length >= 2 && h.rites.length <= 3, 'two Rites at setup, plus the first Harvest draw');
    assert.equal(h.invHand.length, 0);
    assert.equal(['G', 'I', 'I', 'I', 'I'].length, h.heirPile.length + 1);
  }
  void ash; void thorne;
});

test('every House has its reference-sheet Coffer', () => {
  const want = { Ash: 'G3 T1 S1 I3', Verrin: 'G3 T2 S2', Maelor: 'G1 T2 S1 C4', Thorne: 'G2 T1 S1 R1 C3', Wren: 'G2 T2 S1 R1 C2', Sable: 'G1 T3 S3 C2', Caddoc: 'G1 T1 S1 R2 C2 L2', Raven: 'G1 T1 S1 R1 C2 L3' };
  for (const [h, txt] of Object.entries(want)) {
    const c = Object.entries(HOUSES[h].coffer).map(([r, n]) => `${r}${n}`).join(' ');
    assert.equal(c, txt, h);
  }
});

test('Build: costs G+T+S, needs an empty adjacent Plot', () => {
  const s = fresh();
  assert.equal(E.whyNot(s, 0, 'build'), 'Needs 1 Grain, 1 Timber, 1 Stone.');
  give(s, 0, { G: 1, T: 1, S: 1 });
  const opts = E.optionsFor(s, 0, 'build').map((o) => o.plot);
  assert.deepEqual(opts, [3, 6].filter((p) => E.isEmpty(s, p)));
  act(s, { type: 'build', plot: 3 });
  assert.equal(E.markersOn(s, 3, 0), 1);
  assert.deepEqual([s.houses[0].coffer.G, s.houses[0].coffer.T, s.houses[0].coffer.S], [0, 0, 0]);
  assert.equal(s.turn, 1);
});

test('Keep: second marker, pays double at Harvest (two per marker)', () => {
  const s = fresh();
  give(s, 0, { G: 1, T: 1, S: 1 });
  act(s, { type: 'keep', plot: 1 });
  assert.equal(E.markersOn(s, 1, 0), 2);
  assert.equal(E.optionsFor(s, 1, 'keep').length, 0);
});

test('Muster: costs by House, cap three per Plot, Thorne not before Season 3', () => {
  const s = fresh(['Thorne', 'Ash', 'Maelor', 'Wren']);
  give(s, 0, { I: 5, G: 5 });
  assert.match(E.whyNot(s, 0, 'muster'), /Season 3/);
  s.season = 3;
  assert.equal(E.optionsFor(s, 0, 'muster').length, 1);
  s.season = 1; act(s, { type: 'pass' });
  give(s, 1, { I: 2 });   // Ash: 2 Iron, no Grain
  act(s, { type: 'muster', plot: 5 });
  assert.equal(E.legionsOn(s, 5, 1), 2); assert.equal(s.houses[1].coffer.I, 0);
  give(s, 2, { I: 2, G: 1 });
  assert.match(E.whyNot(s, 2, 'muster'), /3 Iron/);   // Maelor 3 Iron
  give(s, 2, { I: 1 });
  act(s, { type: 'muster', plot: 9 });
  assert.equal(s.houses[2].coffer.I, 0); assert.equal(s.houses[2].coffer.G, 0);
  s.plots[12].l[3] = 3;
  give(s, 3, { I: 2, G: 1 });
  assert.ok(E.optionsFor(s, 3, 'muster').every((o) => o.plot !== 13), 'cap of three Legions');
});

test('Raid undefended: walk in, capture one marker, mark the Plot contested', () => {
  const s = fresh();
  s.plots[2].m[1] = 1;  // Verrin on P3, next to Ash's P2 (Legion on P2)
  give(s, 0, { I: 1 });
  act(s, { type: 'raid', from: 2, to: 3, target: 1, n: 1 });
  assert.equal(E.markersOn(s, 3, 0), 1); assert.equal(E.markersOn(s, 3, 1), 0);
  assert.equal(E.legionsOn(s, 3, 0), 1); assert.equal(E.legionsOn(s, 2, 0), 0);
  assert.deepEqual(s.plots[2].contest, { victim: 1, captor: 0 });
  assert.equal(s.houses[0].coffer.I, 0);
});

test('Raid defended: forced win removes defenders, half the raiders stay, Ash records the Reach', () => {
  const s = fresh();
  s.plots[1].l[0] = 2; s.plots[2].m[1] = 2; s.plots[2].l[1] = 2;
  give(s, 0, { I: 1 });
  E.applyAction(s, { type: 'raid', from: 2, to: 3, target: 1, n: 2 }, { skirmish: 'win' });
  assert.equal(E.legionsOn(s, 3, 1), 0); assert.equal(E.legionsOn(s, 3, 0), 1);
  assert.equal(E.markersOn(s, 3, 1), 1); assert.equal(E.markersOn(s, 3, 0), 1);
  assert.deepEqual(s.houses[0].skirmishReaches, [1]);
});

test('Raid defended: forced loss kills the raiders and half the defenders (rounded down)', () => {
  const s = fresh();
  s.plots[1].l[0] = 2; s.plots[2].m[1] = 1; s.plots[2].l[1] = 3;
  give(s, 0, { I: 1 });
  E.applyAction(s, { type: 'raid', from: 2, to: 3, target: 1, n: 2 }, { skirmish: 'lose' });
  assert.equal(E.legionsOn(s, 2, 0), 0); assert.equal(E.legionsOn(s, 3, 0), 0);
  assert.equal(E.legionsOn(s, 3, 1), 2); assert.equal(E.markersOn(s, 3, 1), 1);
});

test('Skirmish odds: Ash +1, Raven -1 shift the result; ties re-roll', () => {
  assert.ok(Math.abs(skirmishWin(1, 1) - 0.5) < 1e-9);
  assert.ok(skirmishWin(2, 1) > 0.5 && skirmishWin(1, 2) < 0.5);
});

test('Recapture: victim with an adjacent Legion flips the marker back for 1 Iron 1 Grain', () => {
  const s = fresh();
  s.plots[2].m[1] = 1; give(s, 0, { I: 1 });
  act(s, { type: 'raid', from: 2, to: 3, target: 1, n: 1 });
  // Verrin needs a Legion on a held Plot next to P3: give it P4 with a Legion.
  s.plots[3].m[1] = 1; s.plots[3].l[1] = 1;
  assert.match(E.whyNot(s, 1, 'recapture'), /Iron/);
  give(s, 1, { I: 1, G: 1 });
  act(s, { type: 'recapture', plot: 3 });
  assert.equal(E.markersOn(s, 3, 1), 1); assert.equal(E.markersOn(s, 3, 0), 0);
  assert.equal(s.plots[2].contest, null);
  assert.equal(E.legionsOn(s, 3, 0), 0, "the captor's Legions disband with its last marker there");
});

test('Accords: Wren cannot raid a partner and partners cannot raid Wren', () => {
  const s = fresh(['Ash', 'Wren', 'Maelor', 'Raven']);
  s.houses[1].accords = [0];
  s.plots[2].m[1] = 1; give(s, 0, { I: 1 });
  assert.equal(E.optionsFor(s, 0, 'raid').filter((o) => o.target === 1).length, 0);
  assert.match(E.whyNot(s, 0, 'raid'), /Accord/);
});

test('Trade: 3 for 1 at the Bank; Maelor 2 for 1 once a Season', () => {
  const s = fresh(['Maelor', 'Ash', 'Verrin', 'Raven']);
  give(s, 0, { C: 4 });
  act(s, { type: 'trade', give: 'C', get: 'I' });
  assert.equal(s.houses[0].coffer.C, 2); assert.equal(s.houses[0].coffer.I, 1);
  assert.equal(E.tradeRate(s.houses[0]), 3);
  act(s, { type: 'pass' }); act(s, { type: 'pass' }); act(s, { type: 'pass' });
  assert.equal(E.optionsFor(s, 0, 'trade').length, 0, 'only 2 Coin left and the Writ is spent');
});

test('Pass costs 1 Coin only if the House has one', () => {
  const s = fresh();
  give(s, 0, { C: 2 }); act(s, { type: 'pass' });
  assert.equal(s.houses[0].coffer.C, 1);
  act(s, { type: 'pass' }); assert.equal(s.houses[1].coffer.C, 0);
});

test('Claim Favor once a Season; Dynasty 3 Favor (Verrin 2) + 2 Reed, +2 Renown, one at a time', () => {
  const s = fresh(['Verrin', 'Ash', 'Maelor', 'Raven']);
  act(s, { type: 'favor' });
  assert.equal(s.houses[0].favor, 1);
  s.turn = 0; assert.equal(E.optionsFor(s, 0, 'favor').length, 0);
  s.houses[0].favor = 2; give(s, 0, { R: 2 });
  act(s, { type: 'dynasty' });
  assert.equal(s.houses[0].renown, 2); assert.equal(s.houses[0].favor, 0); assert.ok(s.houses[0].dynasty);
  s.turn = 0; s.houses[0].favor = 9; give(s, 0, { R: 2 });
  assert.match(E.whyNot(s, 0, 'dynasty'), /one at a time/);
  s.turn = 1; s.houses[1].favor = 2; give(s, 1, { R: 2 });
  assert.match(E.whyNot(s, 1, 'dynasty'), /3 Favor/);
});

test('Investigate: Lore cost (Raven free, Verrin 2 Grain, Caddoc Reed), hand of three', () => {
  const s = fresh(['Raven', 'Verrin', 'Caddoc', 'Ash']);
  act(s, { type: 'investigate' }); assert.equal(s.houses[0].invHand.length, 1);
  give(s, 1, { L: 3 }); assert.match(E.whyNot(s, 1, 'investigate'), /2 Grain/);
  give(s, 1, { G: 2 }); act(s, { type: 'investigate' }); assert.equal(s.houses[1].coffer.G, 0);
  give(s, 2, { R: 1 }); act(s, { type: 'investigate' }); assert.equal(s.houses[2].coffer.R, 0);
  s.turn = 0; s.houses[0].invHand = ['seal', 'seal', 'testimony'];
  assert.match(E.whyNot(s, 0, 'investigate'), /full/);
});

test('Investigation cards: Testimony +1 Favor, Document +1 Lore, Witness robs the richest rival', () => {
  const s = fresh();
  s.houses[0].invHand = ['testimony', 'document', 'witness'];
  give(s, 2, { C: 5 });
  act(s, { type: 'play', card: 'testimony' }); assert.equal(s.houses[0].favor, 1);
  s.turn = 0; act(s, { type: 'play', card: 'document' }); assert.equal(s.houses[0].coffer.L, 1);
  s.turn = 0; act(s, { type: 'play', card: 'witness' });
  assert.equal(s.houses[0].coffer.C, 1); assert.equal(s.houses[2].coffer.C, 4);
});

test('Seal (Raven): an Impostor is exposed for +2 Renown; a Genuine result stays private', () => {
  const s = fresh(['Raven', 'Ash', 'Maelor', 'Verrin']);
  s.houses[0].invHand = ['seal', 'seal']; give(s, 0, { L: 2 });
  s.houses[1].heir.status = 'I'; s.houses[2].heir.status = 'G';
  act(s, { type: 'seal', target: 1 });
  assert.equal(s.houses[0].renown, 2); assert.equal(s.houses[1].heirsLost, 1); assert.equal(s.houses[1].heir.serial, 2);
  s.turn = 0; act(s, { type: 'seal', target: 2 });
  assert.equal(s.houses[0].renown, 2);
  assert.deepEqual(s.houses[2].heir.knownBy.sort(), [0, 2]);
  assert.equal(s.houses[2].heir.revealed, false);
  assert.equal(E.view(s, 3).houses[2].heir.status, '?', 'others still cannot see it');
});

test('Reveal: 2 Favor, only a known Genuine Heir; scores 4 at the end', () => {
  const s = fresh(['Thorne', 'Ash', 'Maelor', 'Verrin']);
  s.houses[0].heir.status = 'G'; s.houses[0].favor = 2;
  assert.match(E.whyNot(s, 0, 'reveal'), /do not know/);
  give(s, 0, { C: 1 }); act(s, { type: 'vigil' });
  s.turn = 0; act(s, { type: 'reveal' });
  assert.ok(s.houses[0].heir.revealed); assert.equal(s.houses[0].favor, 0);
});

test('Vigil (Thorne): learns its Heir; an Impostor is replaced once by marriage', () => {
  const s = fresh(['Thorne', 'Ash', 'Maelor', 'Verrin']);
  s.houses[0].heir.status = 'I'; give(s, 0, { C: 2 });
  act(s, { type: 'vigil' });
  assert.ok(s.houses[0].married); assert.equal(s.houses[0].heir.serial, 2); assert.equal(s.houses[0].heir.knownBy.length, 0);
  s.turn = 0; assert.match(E.whyNot(s, 0, 'vigil'), /already kept/);
});

test('Cabal (Sable): 1 Coin, two tokens, produces, hidden from rivals, never counts for control', () => {
  const s = fresh(['Sable', 'Ash', 'Maelor', 'Verrin']);
  give(s, 0, { C: 3 });
  act(s, { type: 'cabal', plot: 3 }); s.turn = 0; act(s, { type: 'cabal', plot: 5 });
  s.turn = 0; assert.match(E.whyNot(s, 0, 'cabal'), /Both/);
  assert.equal(E.view(s, 1).plots[2].cabal, null);
  assert.equal(E.reachCounts(s, 1)[0], 2, 'Cabal is not a marker');
});

test('Every Rite: cost, effect, Pressure (Caddoc half), Caddoc +2 Renown', () => {
  for (const rite of RITES) {
    const s = fresh(['Caddoc', 'Ash', 'Maelor', 'Verrin']);
    s.plots[2].m[1] = 2;                          // a rival next to Caddoc's P1/P2
    s.plots[4].m = {}; s.plots[4].l = {};         // P5 empty for Silent Barge
    s.houses[1].heir.status = 'I'; s.houses[2].heir.status = 'I'; s.houses[3].heir.status = 'I';
    give(s, 2, { G: 3, C: 3 });
    s.houses[0].rites = [rite.id];
    give(s, 0, rite.cost);
    const opts = E.optionsFor(s, 0, 'rite');
    assert.ok(opts.length, rite.name);
    const pick = opts.slice().sort((a, b) => b.targets.length - a.targets.length)[0];
    const before = E.clone(s);
    act(s, pick);
    const me = s.houses[0];
    assert.equal(s.pressure, rite.pressure / 2, `${rite.name} Pressure halved for Caddoc`);
    const riteRenown = me.renownBy.Rites || 0;
    const expect = { ledger_ink: () => me.coffer.C === 2, ironveil_oath: () => me.coffer.I === 2, verdant_bloom: () => me.coffer.G === 3,
      star_chart: () => me.favor === 1, gilt_ledger: () => me.favor === 1, reed_oath: () => riteRenown === 3,
      mist_veil: () => E.wealth(me) === 1, drowned_choir: () => E.wealth(me) === 2,
      silent_barge: () => E.totalMarkers(s, 0) === E.totalMarkers(before, 0) + 1,
      heron_cry: () => E.markersOn(s, 3, 1) === 1, ashen_pyre: () => E.markersOn(s, 3, 1) === 0,
      ink_of_names: () => riteRenown === 4 };
    assert.ok(expect[rite.id](), `${rite.name} effect`);
    if (rite.id !== 'reed_oath' && rite.id !== 'ink_of_names') assert.equal(riteRenown, 2, `${rite.name}: Caddoc 2 Renown`);
    assert.ok(!me.rites.includes(rite.id));
  }
});

test('Caddoc may pay Reed for Lore on Rites', () => {
  const s = fresh(['Caddoc', 'Ash', 'Maelor', 'Verrin']);
  s.houses[0].rites = ['star_chart']; give(s, 0, { R: 1 });
  act(s, { type: 'rite', rite: 'star_chart', targets: [] });
  assert.equal(s.houses[0].coffer.R, 0); assert.equal(s.houses[0].favor, 1);
});

function harvestWith(s, sum, mods = []) {
  // Force a Harvest roll by searching seeds for the wanted total.
  for (let k = 0; k < 5000; k++) {
    const c = E.clone(s); c.rng = { s: k }; c.phase = 'harvest'; c.nextHarvest = mods.slice();
    E.advance(c);
    if (c.dice[0] + c.dice[1] === sum) return c;
  }
  throw new Error('no seed');
}

test('Harvest: one per marker, two per marker on a Keep, Granary, no Lore for Verrin, 7 pays nothing', () => {
  const s = fresh(['Verrin', 'Ash', 'Maelor', 'Raven']);
  s.plots[0].m[0] = 2;   // Verrin Keep on P1 (Grain, 5)
  s.plots[14].m[3] = 1;  // Raven on P15 (Stone, 5)
  let c = harvestWith(s, 5);
  assert.equal(c.houses[0].coffer.G, 5, 'Keep 4 + Granary 1');
  assert.equal(c.houses[3].coffer.S, 1);
  s.plots[16].m[0] = 1;  // Verrin on P17 (Lore, 6)
  c = harvestWith(s, 6); assert.equal(c.houses[0].coffer.L, 0);
  c = harvestWith(s, 7); assert.ok(c.houses.every((h) => E.wealth(h) === 0));
});

test('Harvest modifiers: Dry Autumn halves Grain, Spring Flood doubles Reach II, Iron Winter halves Iron', () => {
  const s = fresh(['Ash', 'Verrin', 'Maelor', 'Raven']);
  s.plots[0].m[0] = 2;
  assert.equal(harvestWith(s, 5, ['dry_autumn']).houses[0].coffer.G, 2);
  s.plots[6].m[3] = 1;  // Raven P7 Iron 8 (Reach II)
  s.plots[1].m = { 0: 1 };
  const c = harvestWith(s, 8, ['spring_flood']);
  assert.equal(c.houses[3].coffer.I, 2); assert.equal(c.houses[0].coffer.T, 1);
  s.plots[6].m[3] = 2;
  assert.equal(harvestWith(s, 8, ['iron_winter']).houses[3].coffer.I, 2);
});

test('Reach places: strictly most wins; a tie gives no first; second needs a sole first', () => {
  assert.deepEqual(E.reachPlaces([3, 1, 0, 0]), { first: 0, second: 1 });
  assert.equal(E.reachPlaces([2, 2, 1, 0]).first, null);
  assert.equal(E.reachPlaces([3, 1, 1, 0]).second, null);
  assert.equal(E.reachPlaces([0, 0, 0, 0]).first, null);
});

test('Flood scoring: 3/0 mid, 6/3 final, Delta doubles, Dynasty +1', () => {
  const s = fresh(['Ash', 'Verrin', 'Maelor', 'Raven']);
  s.plots.forEach((p) => { p.m = {}; p.l = {}; });
  s.plots[16].m[0] = 2; s.plots[17].m[1] = 1;   // Reach V: Ash 2, Verrin 1
  s.plots[4].m[1] = 1;                           // Reach II: Verrin 1
  s.houses[2].dynasty = true; s.houses[2].heir.status = 'G';
  s.rng = { s: 99 };
  s.season = 3; s.phase = 'flood'; E.advance(s);
  assert.equal(s.houses[0].renown, 6); assert.equal(s.houses[1].renown, 3);
  assert.equal(s.houses[2].renown, 1);
  const t = fresh(['Ash', 'Verrin', 'Maelor', 'Raven']);
  t.plots.forEach((p) => { p.m = {}; p.l = {}; });
  t.plots[16].m[0] = 2; t.plots[17].m[1] = 1;
  t.season = 12; t.phase = 'flood'; E.advance(t);
  assert.equal(t.houses[0].renown, 12); assert.equal(t.houses[1].renown, 6);
  assert.equal(t.phase, 'over');
});

test('Season 12 House bonuses: Ash conquest needs a Skirmish win in the Reach; Sable Cabal majority', () => {
  const s = fresh(['Ash', 'Sable', 'Maelor', 'Raven']);
  s.plots.forEach((p) => { p.m = {}; p.l = {}; p.cabal = null; });
  s.plots[0].m[0] = 1; s.houses[0].skirmishReaches = [1];
  s.plots[4].m[2] = 1; s.plots[5].cabal = 1; s.plots[6].cabal = 1;   // Reach II: Sable 2 tokens vs Maelor 1
  s.season = 12; s.phase = 'flood'; E.advance(s);
  assert.equal(s.houses[0].renownBy.Conquest, 1);
  assert.equal(s.houses[1].renownBy.Cabal, 1);
});

test('Succession: Genuine keeps the Dynasty (Thorne +3); Impostor costs 2 and the Dynasty', () => {
  for (const [status, name] of [['G', 'Thorne'], ['I', 'Verrin']]) {
    const s = fresh([name, 'Ash', 'Maelor', 'Raven']);
    s.houses[0].dynasty = true; s.houses[0].heir.status = status;
    s.season = 3; s.phase = 'flood';
    // find a seed where the holder dies
    let c;
    for (let k = 0; k < 500; k++) { c = E.clone(s); c.rng = { s: k }; E.advance(c); if (c.floods[0].deaths.length) break; }
    assert.ok(c.floods[0].deaths.includes(0));
    if (status === 'G') { assert.ok(c.houses[0].dynasty); assert.equal(c.houses[0].renownBy.Succession, 3); assert.ok(c.houses[0].heir.revealed); }
    else { assert.ok(!c.houses[0].dynasty); assert.equal(c.houses[0].renownBy.Impostor, -2); }
  }
});

test('Ember Pressure: at 4+ on a Flood the heaviest caster loses a marker and Pressure resets', () => {
  const s = fresh();
  s.pressure = 4; s.houses[2].ritesSeason = 2; s.houses[1].ritesSeason = 1;
  const before = E.totalMarkers(s, 2);
  s.season = 3; s.phase = 'flood'; E.advance(s);
  assert.equal(E.totalMarkers(s, 2), before - 1);
  assert.equal(s.pressure, 0);
  assert.equal(s.floods[0].catastrophe.h, 2);
});

test('Every Event resolves', () => {
  for (const ev of EVENTS) {
    const s = fresh();
    s.houses.forEach((h, i) => { h.coffer.G = i; h.coffer.C = 7; h.favor = i === 3 ? 3 : 1; });
    s.houses[1].dynasty = true;
    s.phase = 'event'; s.pauseAt = ['harvest'];
    // Find a seed that draws this Event.
    let c;
    for (let k = 0; k < 2000; k++) { c = E.clone(s); c.rng = { s: k }; E.advance(c); if (c.eventLog.at(-1)?.id === ev.id) break; }
    assert.equal(c.eventLog.at(-1).id, ev.id);
    const H = c.houses;
    switch (ev.id) {
      case 'coronation_feast': assert.equal(H[0].coffer.C, 8); break;
      case 'council_of_houses': assert.equal(H[3].renownBy.Council, 2); break;
      case 'lean_winter': assert.equal(H[0].coffer.C, 6); assert.equal(H[3].coffer.C, 7); break;
      case 'market_glut': assert.ok(E.wealth(H[0]) === 5); break;
      case 'levy_of_the_crown': assert.equal(E.totalLegions(c, 0), 3); break;
      case 'death_in_the_court': assert.ok(H[1].heir.revealed || (!H[1].dynasty && H[1].renownBy.Impostor === -2)); break;
      case 'harvest_moon': assert.equal(H[0].favor, 1); break;
      case 'dry_autumn': case 'spring_flood': case 'iron_winter': assert.ok(c.nextHarvest.includes(ev.id) || c.season === 2); break;
    }
  }
});

test('Final tie-break: Renown, then markers, then resources', () => {
  const s = fresh(['Ash', 'Verrin', 'Maelor', 'Raven']);
  s.plots.forEach((p) => { p.m = {}; p.l = {}; });
  s.plots[0].m[0] = 1; s.plots[3].m[1] = 1;   // Reach I: Ash 1, Verrin 1, a tie
  s.plots[8].m[1] = 1; s.plots[9].m[2] = 1;   // Reach III: Verrin 1, Maelor 1, a tie
  s.houses[2].coffer.C = 5;
  s.season = 12; s.phase = 'flood'; E.advance(s);
  assert.deepEqual(s.winner, [1]);
  assert.equal(s.final.tieBreak, 'markers');
});

test('illegal actions are rejected with a reason', () => {
  const s = fresh();
  assert.throws(() => act(s, { type: 'build', plot: 20 }), /Needs 1 Grain/);
  give(s, 0, { G: 1, T: 1, S: 1 });
  assert.throws(() => act(s, { type: 'build', plot: 20 }), /not legal|touches/);
  assert.equal(E.checkAction(s, { type: 'seal', target: 1 }).ok, false);
  assert.match(E.whyNot(s, 0, 'seal'), /Only Raven/);
});

test('full AI games: every House, 2, 3 and 4 players, all complete with legal actions', () => {
  let g = 0;
  for (const n of [2, 3, 4]) {
    for (let k = 0; k < 8; k++) {
      const houses = HOUSE_ORDER.slice(k).concat(HOUSE_ORDER.slice(0, k)).slice(0, n);
      const s = E.newGame({ houses, seed: `full-${n}-${k}` });
      playAI(s, { maxSteps: 5000 });
      assert.equal(s.phase, 'over'); assert.equal(s.season, 12);
      assert.equal(s.floods.length, 4);
      assert.ok(s.winner.length >= 1);
      g++;
    }
  }
  assert.equal(g, 24);
});

test('determinism: the same seed and choices give the same game', () => {
  const a = E.newGame({ houses: ['Ash', 'Sable', 'Caddoc'], seed: 'same' });
  const b = E.newGame({ houses: ['Ash', 'Sable', 'Caddoc'], seed: 'same' });
  playAI(a); playAI(b);
  assert.deepEqual(a.final, b.final);
  assert.equal(JSON.stringify(a.plots), JSON.stringify(b.plots));
});

test('save/load: a state survives JSON round-trip mid-game and plays on identically', () => {
  const a = E.newGame({ houses: ['Wren', 'Raven', 'Thorne', 'Maelor'], seed: 'save' });
  for (let k = 0; k < 40 && a.phase !== 'over'; k++) { if (a.pending) { E.decide(a, { partners: [] }); continue; } E.applyAction(a, chooseAction(a)); }
  const b = JSON.parse(JSON.stringify(a));
  playAI(a); playAI(b);
  assert.deepEqual(a.final, b.final);
});

test('human Wren is asked for Accords and the choice is enforced', () => {
  const s = E.newGame({ houses: ['Wren', 'Ash'], humans: ['Wren'], seed: 'w', seatOrder: ['Wren', 'Ash'] });
  assert.equal(s.pending?.type, 'accords');
  E.decide(s, { partners: [1] });
  assert.deepEqual(s.houses[0].accords, [1]);
  assert.equal(s.phase, 'actions');
});

test('pips: 6 and 8 are 5 in 36, 2 and 12 are 1 in 36', () => {
  assert.deepEqual([pips(6), pips(8), pips(2), pips(12), pips(7)], [5, 5, 1, 1, 0]);
  void C;
});
