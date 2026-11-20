// Achievements: pure checks over a finished game (state.phase === 'over'), seen from one seat.
// Every check reads only facts the engine keeps for the whole game: houses[i] (renown, renownBy,
// stats, oaths, heirsCrowned, ritesTotal), state.floods (complete), state.final / state.winner,
// state.rules and state.log (about 200 entries a game, well under its 400-entry cap). state.fx is
// capped at 200 and is not used.
import { HOUSE_ORDER } from '../rules/data.js';
import { LORE, dn } from '../content/lore.js';

const DELTA = 5;   // REACHES id of the Delta Mouth

// Facts about one seat in a finished game, gathered once for every check.
export function gameFacts(state, me) {
  const H = state.houses[me];
  const name = dn(H.name);
  const winners = state.winner || [];
  const won = winners.includes(me);
  const st = state.final?.standings || [];
  const mine = st.find((x) => x.i === me);
  const second = st.find((x) => x.i !== me);
  const margin = mine && second ? mine.renown - second.renown : 0;
  const log = state.log || [];
  const inkExposed = log.filter((l) => l.h === me && l.kind === 'magic' && /unmasked as an Impostor/.test(l.text)).length;
  const pactsSworn = log.filter((l) => l.kind === 'court' && /swear a Pact/.test(l.text) && (l.text.startsWith(`${name} and `) || l.text.includes(` and ${name} swear`))).length;
  const floods = state.floods || [];
  return {
    H, won, sole: won && winners.length === 1, shared: won && winners.length > 1, margin,
    players: state.houses.length, rules: state.rules || 'original', renown: H.renown,
    exposed: (H.stats?.exposed || 0) + inkExposed,
    pactsSworn, oaths: H.oaths || 0,
    deltaFloods: floods.filter((f) => f.reaches.some((r) => r.reach === DELTA && r.first === me)).length,
    floods: floods.length,
    catastrophes: floods.filter((f) => f.catastrophe && f.catastrophe.h === me).length,
    bestReachesAtFlood: Math.max(0, ...floods.map((f) => f.reaches.filter((r) => r.first === me).length)),
    genuineHeir: (H.renownBy?.['Genuine Heir'] || 0) > 0,
    tieBreak: state.final?.tieBreak || null,
  };
}

const houseWin = (key) => ({
  id: `win_${key}`, name: `${LORE[key].display} Ascendant`, desc: `Win as ${LORE[key].display} of ${LORE[key].seat}.`, house: key,
  check: (f) => f.won && f.H.name === key,
});

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Hollowmere Is Yours', desc: 'Win a game.', check: (f) => f.won },
  ...HOUSE_ORDER.map(houseWin),
  { id: 'old_ways', name: 'The Old Ways', desc: 'Win under the original rules.', check: (f) => f.won && f.rules === 'original' },
  { id: 'oathkeeper', name: 'Oathkeeper', desc: 'Win under the Expanded rules without breaking an oath.', check: (f) => f.won && f.rules === 'expanded' && f.oaths === 0 },
  { id: 'faithful', name: 'Word Is Bond', desc: 'Swear three or more Pacts in one game and keep every one.', check: (f) => f.pactsSworn >= 3 && f.oaths === 0 },
  { id: 'no_lie', name: 'No Lie Survives', desc: 'Expose three Impostors in one game (Seals or Ink of Names).', check: (f) => f.exposed >= 3 },
  { id: 'delta', name: 'Warden of the Delta', desc: 'Hold the Delta Mouth alone at all four Floods.', check: (f) => f.floods === 4 && f.deltaFloods === 4 },
  { id: 'true_born', name: 'True-Born', desc: 'Win with a Genuine Heir revealed or crowned.', check: (f) => f.won && f.genuineHeir },
  { id: 'dynast', name: 'The Blood Endures', desc: 'Crown a Genuine Heir when your Dynasty holder dies.', check: (f) => (f.H.heirsCrowned || 0) >= 1 },
  { id: 'through_fire', name: 'Through the Fire', desc: 'Survive a Catastrophe and still win.', check: (f) => f.won && f.catastrophes >= 1 },
  { id: 'undisputed', name: 'Undisputed', desc: 'Win a four-House game by 15 Renown or more.', check: (f) => f.sole && f.players === 4 && f.margin >= 15 },
  { id: 'never_yield', name: 'Never Yield', desc: 'Win without passing a single Action.', check: (f) => f.won && (f.H.stats?.passes || 0) === 0 },
  { id: 'warlord', name: 'Warlord', desc: 'Win six Skirmishes in one game.', check: (f) => (f.H.stats?.skirmishWon || 0) >= 6 },
  { id: 'untouched', name: 'Untouched', desc: 'Win without a single marker captured by a rival.', check: (f) => f.won && (f.H.stats?.lost || 0) === 0 },
  { id: 'three_reaches', name: 'Lord of Three Reaches', desc: 'Stand alone first in three Reaches at one Flood.', check: (f) => f.bestReachesAtFlood >= 3 },
  { id: 'fifty', name: 'Fifty Laurels', desc: 'End a game with 50 Renown or more.', check: (f) => f.renown >= 50 },
  { id: 'close_call', name: 'By a Hair', desc: 'Win when Renown is tied and the tie is broken in your favour.', check: (f) => f.sole && (f.tieBreak === 'markers' || f.tieBreak === 'resources') },
];
export const achievementById = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// ids of every achievement earned by seat `humanIndex` in a finished game. Pure.
export function evaluateAchievements(state, humanIndex) {
  if (!state || state.phase !== 'over' || !state.houses?.[humanIndex]) return [];
  const f = gameFacts(state, humanIndex);
  return ACHIEVEMENTS.filter((a) => { try { return !!a.check(f, state); } catch { return false; } }).map((a) => a.id);
}
