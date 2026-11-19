// Batch simulation: AI against AI. Reports House win rates, average Renown and game length.
//   node tools/sim.mjs [games=200] [players=4] [seed=1]
import * as E from '../src/rules/engine.js';
import { playAI } from '../src/ai/ai.js';
import { HOUSE_ORDER } from '../src/rules/data.js';
import * as R from '../src/rules/rng.js';

const games = +(process.argv[2] || 200), players = +(process.argv[3] || 4), seed = process.argv[4] || '1';
const rng = { s: R.hashSeed(seed) };
const stat = Object.fromEntries(HOUSE_ORDER.map((h) => [h, { seated: 0, wins: 0, renown: 0, markers: 0, sources: {} }]));
let ties = 0, t0 = Date.now(), catas = 0, rites = 0, raids = 0, seals = 0, dyn = 0;
for (let g = 0; g < games; g++) {
  const houses = R.shuffle(rng, HOUSE_ORDER).slice(0, players);
  const s = E.newGame({ houses, seed: `${seed}-${g}` });
  playAI(s, { maxSteps: 5000 });
  if (s.phase !== 'over') throw new Error('game did not finish');
  const share = 1 / s.winner.length;
  if (s.final.tieBreak) ties++;
  for (const h of s.houses) {
    const st = stat[h.name]; st.seated++; st.renown += h.renown; st.markers += E.totalMarkers(s, h.i);
    if (s.winner.includes(h.i)) st.wins += share;
    for (const [k, v] of Object.entries(h.renownBy)) st.sources[k] = (st.sources[k] || 0) + v;
    rites += h.ritesTotal; raids += h.stats.raids; seals += h.stats.seals; dyn += h.dynastiesBought;
  }
  catas += s.floods.filter((f) => f.catastrophe).length;
}
const ms = Date.now() - t0;
console.log(`${games} games, ${players} players, ${(ms / games).toFixed(0)} ms/game, tie-breaks ${(100 * ties / games).toFixed(1)}%`);
console.log(`per game: Rites ${(rites / games).toFixed(1)}, Raids ${(raids / games).toFixed(1)}, Seals ${(seals / games).toFixed(1)}, Dynasties ${(dyn / games).toFixed(1)}, Catastrophes ${(catas / games).toFixed(2)}`);
for (const [h, st] of Object.entries(stat)) {
  if (!st.seated) continue;
  const src = Object.entries(st.sources).map(([k, v]) => `${k} ${(v / st.seated).toFixed(1)}`).join(', ');
  console.log(`${h.padEnd(7)} win ${(100 * st.wins / st.seated).toFixed(1).padStart(5)}%  renown ${(st.renown / st.seated).toFixed(1).padStart(5)}  markers ${(st.markers / st.seated).toFixed(1)}  [${src}]`);
}
