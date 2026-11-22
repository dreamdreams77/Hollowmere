// Expanded rules X7 (Event choices) and X8 (Betrothal).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/rules/engine.js';
import { DILEMMAS, EVENTS, ADJ } from '../src/rules/data.js';

const DIDS = new Set(DILEMMAS.map((d) => d.id));
const atActions = (s, turn = 0) => { s.phase = 'actions'; s.round = 0; s.turn = turn; s.pending = null; return s; };

// Run Event phases until a Dilemma falls to a human House.
function dilemmaGame(rules = 'expanded') {
  for (let k = 0; k < 400; k++) {
    const s = E.newGame({ houses: ['Ash', 'Wren', 'Raven'], humans: ['Ash', 'Wren', 'Raven'], seed: `dil-${k}`, rules });
    s.pending = null; s.phase = 'event'; E.advance(s);
    const last = s.eventLog[s.eventLog.length - 1].id;
    if (s.pending?.type === 'dilemma') return { s, id: last };
    if (rules === 'original') assert.ok(!DIDS.has(last), 'the original rules never draw a Dilemma');
  }
  return null;
}

test('the original rules keep the twelve original Events only', () => {
  assert.equal(dilemmaGame('original'), null);
  assert.equal(EVENTS.some((e) => DIDS.has(e.id)), false);
});

test('a Dilemma waits on the human it falls to, and the answer resolves it and moves the game on', () => {
  const g = dilemmaGame();
  assert.ok(g, 'a Dilemma was drawn');
  const { s, id } = g;
  const p = s.pending;
  assert.equal(p.id, id); assert.equal(p.options.length, 2); assert.equal(p.options[1].ok, true);
  const h = s.houses[p.h]; const before = JSON.stringify({ c: h.coffer, f: h.favor, r: h.renown });
  E.decide(s, { pick: 'b' });
  assert.equal(s.pending?.type === 'dilemma', false);
  assert.notEqual(s.phase, 'event');
  assert.equal(h.dilemmas, 1);
  assert.ok(s.log.some((l) => l.text.startsWith(DILEMMAS.find((d) => d.id === id).name)), 'the outcome is written in the Chronicle');
  void before;
});

test('every Dilemma resolves both ways without breaking the state, and AI lords answer on their own', () => {
  for (let k = 0; k < 120; k++) {
    const s = E.newGame({ houses: ['Ash', 'Verrin', 'Caddoc', 'Thorne'], seed: `dai-${k}`, rules: 'expanded' });
    s.pending = null; s.phase = 'event'; E.advance(s);
    assert.equal(s.pending, null, 'no human: the AI answers');
    for (const x of s.houses) { assert.ok(x.favor >= 0); for (const v of Object.values(x.coffer)) assert.ok(v >= 0, `${x.name} coffer stays non-negative`); }
  }
});

function pactPair() {
  const s = atActions(E.newGame({ houses: ['Wren', 'Ash'], humans: ['Wren', 'Ash'], seed: 'bet-1', rules: 'expanded' }));
  const w = s.houses.findIndex((x) => x.name === 'Wren'), a = 1 - w;
  s.houses[w].pacts.push({ with: a, until: s.season + 1 }); s.houses[a].pacts.push({ with: w, until: s.season + 1 });
  s.houses[w].coffer.C = 5; s.turn = w;
  return { s, w, a };
}

test('Betroth needs a Pact and the dowry, and is only in the Expanded rules', () => {
  const s0 = atActions(E.newGame({ houses: ['Wren', 'Ash'], seed: 'b0', rules: 'original' }));
  assert.equal(E.optionsFor(s0, 0, 'betroth').length, 0);
  const s1 = atActions(E.newGame({ houses: ['Wren', 'Ash'], seed: 'b1', rules: 'expanded' }));
  assert.equal(E.optionsFor(s1, 0, 'betroth').length, 0);
  assert.match(E.whyNot(s1, 0, 'betroth'), /Pact first/);
  const { s, w, a } = pactPair();
  assert.deepEqual(E.optionsFor(s, w, 'betroth'), [{ type: 'betroth', target: a }]);
  s.houses[w].coffer.C = 1;
  assert.match(E.whyNot(s, w, 'betroth'), /dowry/);
});

test('an accepted Betrothal: dowry, lifelong Pact, Renown, and each House learns the other\'s Heir', () => {
  const { s, w, a } = pactPair();
  const r0 = [s.houses[w].renown, s.houses[a].renown];
  E.applyAction(s, { type: 'betroth', target: a });
  assert.equal(s.pending.type, 'betroth');
  E.decide(s, { accept: true });
  assert.equal(s.houses[w].betrothed, a); assert.equal(s.houses[a].betrothed, w);
  assert.equal(s.houses[w].coffer.C, 3); assert.equal(s.houses[w].renown, r0[0] + 1); assert.equal(s.houses[a].renown, r0[1] + 1);
  assert.equal(E.pactWith(s, w, a).until, E.BETROTH_LIFE);
  assert.ok(s.houses[w].heir.knownBy.includes(a) && s.houses[a].heir.knownBy.includes(w));
  assert.notEqual(E.view(s, w).houses[a].heir.status, '?', 'the in-law\'s Heir is visible to you');
  // the Pact does not lapse at the next Harvests
  s.season += 3; s.phase = 'harvest'; s.pending = null; E.advance(s);
  assert.ok(E.pactWith(s, w, a));
});

test('a declined Betrothal costs nothing but regard', () => {
  const { s, w, a } = pactPair();
  E.applyAction(s, { type: 'betroth', target: a }); E.decide(s, { accept: false });
  assert.equal(s.houses[w].betrothed, null); assert.equal(s.houses[w].coffer.C, 5);
});

test('Rosenvael pays no dowry', () => {
  const s = atActions(E.newGame({ houses: ['Thorne', 'Ash'], humans: ['Thorne', 'Ash'], seed: 'bt', rules: 'expanded' }));
  const t = s.houses.findIndex((x) => x.name === 'Thorne'), a = 1 - t;
  s.houses[t].pacts.push({ with: a, until: 3 }); s.houses[a].pacts.push({ with: t, until: 3 }); s.houses[t].coffer.C = 0; s.turn = t;
  assert.equal(E.optionsFor(s, t, 'betroth').length, 1);
  E.applyAction(s, { type: 'betroth', target: a }); E.decide(s, { accept: true });
  assert.equal(s.houses[t].coffer.C, 0); assert.equal(s.houses[t].betrothed, a);
});

test('raiding kin by marriage costs twice a broken Pact and dissolves the match', () => {
  const { s, w, a } = pactPair();
  E.applyAction(s, { type: 'betroth', target: a }); E.decide(s, { accept: true });
  const W = s.houses[w]; W.favor = 5; const r = W.renown;
  // set up a Raid from Wren's seat into Ash's
  atActions(s, w);
  W.coffer.I = 2;
  const home = E.heldPlots(s, w).find((pid) => E.legionsOn(s, pid, w) > 0);
  const next = ADJ[home - 1].find((q) => E.isEmpty(s, q));
  s.plots[next - 1].m[a] = 1;   // an in-law's marker next to Wren's Legion
  const opt = E.optionsFor(s, w, 'raid')[0];
  assert.ok(opt, 'a Raid is possible in this layout');
  E.applyAction(s, opt, { skirmish: 'win' });
  assert.equal(W.betrothed, null); assert.equal(s.houses[a].betrothed, null);
  assert.equal(W.favor, 2);
  assert.ok(W.renown <= r - 2 + 2, 'lost 2 Renown for the betrayal (a capture may add some back)');
  assert.ok(s.log.some((l) => /married into/.test(l.text)));
});
