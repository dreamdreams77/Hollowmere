// Records, achievements and lineages (src/meta/), and the engine's optional `lords` hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/rules/engine.js';
import { HOUSE_ORDER } from '../src/rules/data.js';
import { playAI } from '../src/ai/ai.js';
import { LORE, TRAIT_IDS } from '../src/content/lore.js';
import { ACHIEVEMENTS, evaluateAchievements, gameFacts } from '../src/meta/achievements.js';
import { loadRecords, recordGame, resetRecords, RECORDS_KEY } from '../src/meta/records.js';
import { nextLord, lineageText, lordsFor } from '../src/meta/legacy.js';

// A localStorage stand-in. `broken` makes every access throw, like a locked-down browser.
function fakeStorage({ broken = false } = {}) {
  const m = new Map();
  const guard = () => { if (broken) throw new Error('SecurityError: storage disabled'); };
  return {
    getItem: (k) => { guard(); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { guard(); m.set(k, String(v)); },
    removeItem: (k) => { guard(); m.delete(k); },
    _map: m,
  };
}
function withStorage(store, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => store });
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage; }
}
// AI plays every seat (nobody is human), index 0 is "the player" for evaluation.
// Finished games are cached by their options (AI games are the slow part) and handed out as copies.
const played = new Map();
function aiGame(houses, seed, rules = 'expanded') {
  const key = JSON.stringify([houses, seed, rules]);
  if (!played.has(key)) {
    const s = E.newGame({ houses, seed, rules });
    playAI(s, { maxSteps: 5000 });
    assert.equal(s.phase, 'over');
    played.set(key, JSON.stringify(s));
  }
  return JSON.parse(played.get(key));
}

test('achievements: about two dozen, unique ids, every one has a name, text and check', () => {
  assert.ok(ACHIEVEMENTS.length >= 22 && ACHIEVEMENTS.length <= 28, `${ACHIEVEMENTS.length}`);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) { assert.ok(a.name && a.desc); assert.equal(typeof a.check, 'function'); }
  for (const k of HOUSE_ORDER) assert.ok(ACHIEVEMENTS.some((a) => a.id === `win_${k}`));
});

test('achievements: evaluated over AI games agree with the facts of the game', () => {
  const seen = new Set();
  for (const k of [0, 3, 6]) {
    for (const rules of ['original', 'expanded']) {
      const houses = HOUSE_ORDER.slice(k).concat(HOUSE_ORDER.slice(0, k)).slice(0, k === 6 ? 3 : 2);
      const s = aiGame(houses, `meta-${k}-${rules}`, rules);
      for (let me = 0; me < s.houses.length; me++) {
        const ids = evaluateAchievements(s, me);
        ids.forEach((id) => seen.add(id));
        const won = s.winner.includes(me); const H = s.houses[me];
        assert.equal(ids.includes('first_win'), won);
        assert.equal(ids.includes(`win_${H.name}`), won);
        for (const o of HOUSE_ORDER) if (o !== H.name) assert.ok(!ids.includes(`win_${o}`));
        assert.equal(ids.includes('old_ways'), won && rules === 'original');
        assert.equal(ids.includes('oathkeeper'), won && rules === 'expanded' && H.oaths === 0);
        assert.equal(ids.includes('fifty'), H.renown >= 50);
        const f = gameFacts(s, me);
        assert.equal(ids.includes('delta'), f.deltaFloods === 4);
        assert.equal(f.deltaFloods, s.floods.filter((fl) => fl.reaches.find((r) => r.reach === 5).first === me).length);
        assert.ok(f.exposed >= H.stats.exposed);
        if (rules === 'original') assert.equal(f.pactsSworn, 0);
      }
    }
  }
  assert.ok(seen.size >= 3, `several different achievements occur in AI play: ${[...seen]}`);
});

test('achievements: none before the game is over; pacts sworn are read from the chronicle', () => {
  const s = E.newGame({ houses: ['Ash', 'Wren'], seed: 'early' });
  assert.deepEqual(evaluateAchievements(s, 0), []);
  // Expanded games swear Pacts; the count from the log matches the 'pact' entries naming the House.
  let total = 0;
  for (let k = 0; k < 2; k++) {
    const g = aiGame(['Thorne', 'Maelor', 'Verrin'], `pacts-${k}`);
    total += g.houses.reduce((a, _, i) => a + gameFacts(g, i).pactsSworn, 0);
  }
  assert.ok(total > 0 && total % 2 === 0, `each Pact counts for both Houses (${total})`);
});

test('records: recordGame counts once per game (idempotent by seed) and keeps lines and recent games', () => {
  withStorage(fakeStorage(), () => {
    resetRecords();
    const a = aiGame(['Thorne', 'Maelor', 'Verrin'], 'pacts-0');
    const first = recordGame(a, 0, { now: Date.UTC(2026, 10, 1) });
    assert.equal(first.records.games, 1);
    assert.equal(first.records.byHouse[a.houses[0].name].played, 1);
    assert.deepEqual(first.newAchievements.map((x) => x.id).sort(), evaluateAchievements(a, 0).sort());
    const again = recordGame(JSON.parse(JSON.stringify(a)), 0, { now: Date.UTC(2026, 10, 2) });
    assert.equal(again.records.games, 1, 'a reloaded finished game is not counted twice');
    assert.deepEqual(again.newAchievements, []);
    const b = aiGame(HOUSE_ORDER.slice(0, 2), 'meta-0-original', 'original');
    const second = recordGame(b, 0, { now: Date.UTC(2026, 10, 3) });
    assert.equal(second.records.games, 2);
    assert.equal(second.records.recent.length, 2);
    assert.equal(second.records.recent[0].seed, 'meta-0-original');
    assert.deepEqual(second.records.recent[0].rivals, [b.houses[1].name]);
    assert.equal(second.records.byRules.original.played, 1);
    assert.equal(second.records.byPlayers['3'].played, 1); assert.equal(second.records.byPlayers['2'].played, 1);
    assert.equal(second.records.streak, b.winner.includes(0) ? (a.winner.includes(0) ? 2 : 1) : 0);
    // Persisted: a fresh load sees the same.
    const loaded = loadRecords();
    assert.equal(loaded.games, 2);
    assert.equal(loaded.lines[a.houses[0].name].length, 1);
    assert.equal(loaded.lines[a.houses[0].name][0].given, a.houses[0].lord.given);
    // Unfinished games are ignored.
    const c = E.newGame({ houses: ['Ash', 'Maelor'], seed: 'rec-c' });
    assert.equal(recordGame(c, 0).records.games, 2);
    for (let k = 0; k < 22; k++) recordGame({ ...JSON.parse(JSON.stringify(a)), seed: `copy-${k}` }, 0);
    assert.equal(loadRecords().recent.length, 20, 'recent games keep the last twenty');
    resetRecords();
    assert.equal(loadRecords().games, 0);
  });
});

test('records: fastest win from the app seed time, best Renown kept', () => {
  withStorage(fakeStorage(), () => {
    resetRecords();
    for (let k = 0; k < 6; k++) {
      const s = { ...aiGame(HOUSE_ORDER.slice(0, 2), 'meta-0-expanded'), seed: `fast-${k}` };
      const me = s.winner[0];
      const t0 = Date.UTC(2026, 0, 1);
      const s2 = { ...s, seed: `hm-${t0.toString(36)}` };
      if (k === 0) { const r = recordGame(s2, me, { now: t0 + 25 * 60000 }); assert.equal(r.records.fastestWin.ms, 25 * 60000); }
      else recordGame(s, me, { now: t0, startedAt: t0 - (30 + k) * 60000 });
    }
    const r = loadRecords();
    assert.equal(r.fastestWin.ms, 25 * 60000);
    assert.ok(r.bestRenown.renown >= Math.max(...r.recent.map((g) => g.renown)));
    assert.equal(r.streak, 6); assert.equal(r.bestStreak, 6);
    resetRecords();
  });
});

test('records: a throwing localStorage falls back to memory without errors', () => {
  withStorage(fakeStorage({ broken: true }), () => {
    assert.doesNotThrow(() => resetRecords());
    const s = aiGame(HOUSE_ORDER.slice(3, 5), 'meta-3-expanded');
    const r = recordGame(s, 0);
    assert.equal(r.records.games, 1);
    assert.equal(loadRecords().games, 1, 'kept in memory for the session');
    assert.equal(recordGame(s, 0).records.games, 1, 'still idempotent in memory');
  });
  // A localStorage getter that itself throws, and corrupt stored JSON.
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
  try { assert.doesNotThrow(() => loadRecords()); assert.doesNotThrow(() => resetRecords()); }
  finally { if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage; }
  const bad = fakeStorage(); bad.setItem(RECORDS_KEY, '{not json');
  withStorage(bad, () => { const r = loadRecords(); assert.equal(typeof r.games, 'number'); assert.ok(Array.isArray(r.recent)); });
  withStorage(fakeStorage(), () => resetRecords());
});

test('legacy: nextLord is deterministic in the seed, follows the line, numbers repeated names', () => {
  const rec = { lines: { Ash: [{ given: 'Brann', epithet: 'Ironbrow', trait: 'bold', renown: 31, result: 'lost', oaths: 0 }] } };
  assert.equal(nextLord('Verrin', rec, 'x'), null, 'no line, no heir');
  assert.equal(lineageText('Verrin', rec), '');
  const a = nextLord('Ash', rec, 'seed-1'), b = nextLord('Ash', rec, 'seed-1');
  assert.deepEqual(a, b);
  assert.ok(LORE.Ash.given.includes(a.given));
  assert.notEqual(a.given, 'Brann', 'a child is not named for the parent');
  assert.ok(TRAIT_IDS.includes(a.trait));
  assert.equal(a.lineage.length, 1); assert.equal(a.lineage[0].given, 'Brann');
  assert.match(lineageText('Ash', rec), /^Second of the line of Brann Ironbrow/);
  // Different seeds give different heirs (some of the time).
  const names = new Set(Array.from({ length: 30 }, (_, k) => { const l = nextLord('Ash', rec, `s${k}`); return `${l.given}|${l.epithet}|${l.trait}`; }));
  assert.ok(names.size > 5);
  // After a loss, a fresh name takes a loss epithet.
  const lossEp = Array.from({ length: 30 }, (_, k) => nextLord('Ash', rec, `s${k}`).epithet);
  assert.ok(lossEp.includes('the Avenger') || lossEp.includes('the Unbowed'));
  // An ancestor's name returns with a regnal number.
  const rec2 = { lines: { Ash: [...rec.lines.Ash, { given: 'Kaedra', epithet: 'the Avenger', trait: 'proud', renown: 40, result: 'won', oaths: 0 }] } };
  const regnal = Array.from({ length: 60 }, (_, k) => nextLord('Ash', rec2, `r${k}`)).filter((l) => l.given === 'Brann');
  assert.ok(regnal.length > 0);
  for (const l of regnal) assert.equal(l.epithet, 'the Second');
  assert.match(lineageText('Ash', rec2), /^Third of the line of Brann Ironbrow of Emberlain, heir to Kaedra the Avenger, who took Hollowmere with 40 Renown\.$/);
  // Inherited trait sometimes, not always.
  const traits = Array.from({ length: 60 }, (_, k) => nextLord('Ash', rec2, `t${k}`).trait);
  const kept = traits.filter((t) => t === 'proud').length;
  assert.ok(kept > 10 && kept < 55, `trait inherited ${kept}/60`);
  assert.deepEqual(Object.keys(lordsFor('Ash', rec2, 'z')), ['Ash']);
  assert.equal(lordsFor('Ash', rec2, 'z', false), undefined);
});

test('engine: newGame without lords is unchanged; with lords only that lord changes', () => {
  const opts = { houses: ['Ash', 'Raven', 'Wren', 'Thorne'], seed: 'lords-fixed', rules: 'expanded' };
  const a = E.newGame(opts), b = E.newGame({ ...opts }), c = E.newGame({ ...opts, lords: null });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(JSON.stringify(a), JSON.stringify(c));
  for (let i = 0; i < 4; i++) assert.deepEqual(a.houses[i].lord, b.houses[i].lord);
  const lords = { Ash: { given: 'Brann', epithet: 'the Second', trait: 'cunning' } };
  const d = E.newGame({ ...opts, lords });
  const ia = d.houses.findIndex((x) => x.name === 'Ash');
  assert.deepEqual({ ...d.houses[ia].lord }, { ...a.houses[ia].lord, given: 'Brann', epithet: 'the Second', trait: 'cunning' });
  // Everything else, rng included, is identical.
  const strip = (s) => { const x = JSON.parse(JSON.stringify(s)); for (const h of x.houses) delete h.lord; return x; };
  assert.deepEqual(strip(d), strip(a));
  // An unknown trait falls back to the drawn one; the game plays to the end the same way.
  const e = E.newGame({ ...opts, lords: { Ash: { given: 'Brann', epithet: 'X', trait: 'nonsense' } } });
  assert.equal(e.houses[ia].lord.trait, a.houses[ia].lord.trait);
});

test('legacy end to end: a finished game seeds the next lord of the same House', () => {
  withStorage(fakeStorage(), () => {
    resetRecords();
    const s = aiGame(['Thorne', 'Maelor', 'Verrin'], 'pacts-1');
    const me = 0; const house = s.houses[me].name;
    const { records } = recordGame(s, me);
    const lords = lordsFor(house, records, 'line-2');
    const t = E.newGame({ houses: ['Thorne', 'Maelor', 'Verrin'], seed: 'line-2', rules: 'expanded', lords });
    const lord = t.houses.find((x) => x.name === house).lord;
    const heir = nextLord(house, records, 'line-2');
    assert.equal(lord.given, heir.given); assert.equal(lord.epithet, heir.epithet); assert.equal(lord.trait, heir.trait);
    assert.match(lineageText(house, records), /^Second of the line of /);
    resetRecords();
  });
});

test('the offline cache list (sw.js) matches the shipped files', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync('node', ['tools/gen-sw.mjs', '--check']);   // throws if stale
});
