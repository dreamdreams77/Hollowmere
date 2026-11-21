import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/rules/engine.js';
import { applyDifficulty } from '../src/ai/ai.js';
import { SCENARIOS, scenarioById } from '../src/content/scenarios.js';

for (const sc of SCENARIOS) {
  test(`scenario ${sc.id} sets up and reports progress`, () => {
    const s = applyDifficulty(E.newGame({ houses: [sc.house, ...sc.rivals], humans: [sc.house], seed: `t-${sc.id}`, rules: sc.rules }), sc.difficulty);
    const me = s.houses.findIndex((x) => x.human);
    assert.equal(s.houses[me].name, sc.house);
    sc.setup(s, me);
    const r = sc.objective.check(s, me);
    assert.equal(typeof r.progress, 'string');
    assert.equal(r.done, false);
    assert.equal(scenarioById[sc.id], sc);
    // the hidden view must survive the scenario setup
    assert.doesNotThrow(() => E.view(s, me));
  });
}

test('pass-and-play: several humans in one game', () => {
  const s = E.newGame({ houses: ['Wren', 'Ash', 'Raven'], humans: ['Wren', 'Ash'], seed: 'hot' });
  assert.deepEqual(s.houses.filter((x) => x.human).map((x) => x.name).sort(), ['Ash', 'Wren']);
});
