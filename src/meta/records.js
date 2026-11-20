// Persistent records across games, kept in localStorage. Every storage access is guarded: if
// storage is missing, full or throws (private browsing, sandboxed frames), the records live in
// memory for the session and nothing breaks.
import { evaluateAchievements, achievementById } from './achievements.js';

export const RECORDS_KEY = 'hollowmere.records.v1';
const RECENT_MAX = 20, SEEN_MAX = 500, LINE_MAX = 40;
let memory = null;   // the last records loaded or saved; used whenever storage fails

export function emptyRecords() {
  return {
    v: 1, games: 0, wins: 0,
    byHouse: {}, byPlayers: {}, byRules: {},
    bestRenown: null, fastestWin: null, biggestMargin: null,
    streak: 0, bestStreak: 0,
    recent: [], achievements: {}, lines: {}, seen: [],
  };
}
const copy = (x) => JSON.parse(JSON.stringify(x));
function storage() { try { return globalThis.localStorage || null; } catch { return null; } }
function normalise(r) {
  const base = emptyRecords();
  if (!r || typeof r !== 'object') return base;
  for (const k of Object.keys(base)) if (r[k] === undefined || (Array.isArray(base[k]) && !Array.isArray(r[k]))) r[k] = base[k];
  return r;
}

export function loadRecords() {
  try {
    const raw = storage()?.getItem(RECORDS_KEY);
    if (raw) { memory = normalise(JSON.parse(raw)); return copy(memory); }
  } catch { /* fall through to memory */ }
  return copy(memory || (memory = emptyRecords()));
}
function saveRecords(r) {
  memory = copy(r);
  try { storage()?.setItem(RECORDS_KEY, JSON.stringify(r)); return true; } catch { return false; }
}
export function resetRecords() {
  memory = emptyRecords();
  try { storage()?.removeItem(RECORDS_KEY); } catch { /* memory only */ }
  return copy(memory);
}

// When did this game start? The app's seeds are `hm-<Date.now() in base 36>`; other seeds are unknown.
function startOf(state, startedAt) {
  if (Number.isFinite(startedAt)) return startedAt;
  const m = /^hm-([0-9a-z]+)$/.exec(String(state.seed || ''));
  const t = m ? parseInt(m[1], 36) : NaN;
  return Number.isFinite(t) && t > 1e12 ? t : null;
}
const bump = (map, key, won) => { const e = map[key] || (map[key] = { played: 0, won: 0 }); e.played++; if (won) e.won++; };

// Record a finished game for seat humanIndex. Idempotent per game (keyed by state.seed): a second
// call for the same game changes nothing and reports no new achievements.
// opts.now (ms) and opts.startedAt (ms) are for tests and for apps that track play time themselves.
export function recordGame(state, humanIndex, { now = Date.now(), startedAt } = {}) {
  const records = loadRecords();
  if (!state || state.phase !== 'over' || !state.houses?.[humanIndex]) return { newAchievements: [], records };
  const key = String(state.seed);
  if (records.seen.includes(key)) return { newAchievements: [], records };
  const H = state.houses[humanIndex];
  const winners = state.winner || [];
  const won = winners.includes(humanIndex);
  const result = won ? (winners.length > 1 ? 'shared' : 'won') : 'lost';
  const st = state.final?.standings || [];
  const place = st.findIndex((x) => x.i === humanIndex) + 1 || null;
  const rival = st.find((x) => x.i !== humanIndex);
  const margin = rival ? H.renown - rival.renown : 0;
  const date = new Date(now).toISOString();
  const rules = state.rules || 'original';

  records.games++; if (won) records.wins++;
  bump(records.byHouse, H.name, won); bump(records.byPlayers, String(state.houses.length), won); bump(records.byRules, rules, won);
  if (!records.bestRenown || H.renown > records.bestRenown.renown) records.bestRenown = { renown: H.renown, house: H.name, date };
  if (won) {
    const t0 = startOf(state, startedAt);
    const ms = t0 != null ? now - t0 : null;
    if (ms != null && ms > 0 && (!records.fastestWin || ms < records.fastestWin.ms)) records.fastestWin = { ms, house: H.name, date };
    if (!records.biggestMargin || margin > records.biggestMargin.margin) records.biggestMargin = { margin, house: H.name, date };
    records.streak++; records.bestStreak = Math.max(records.bestStreak, records.streak);
  } else records.streak = 0;

  records.recent.unshift({
    seed: key, date, house: H.name, rivals: state.houses.filter((x) => x.i !== humanIndex).map((x) => x.name),
    players: state.houses.length, result, place, renown: H.renown, rules,
    lord: H.lord ? { given: H.lord.given, epithet: H.lord.epithet } : null,
  });
  records.recent = records.recent.slice(0, RECENT_MAX);

  // The House's lord line (legacy.js): the lord ruling at the end of the game.
  if (H.lord) {
    const line = records.lines[H.name] || (records.lines[H.name] = []);
    line.push({ given: H.lord.given, epithet: H.lord.epithet, trait: H.lord.trait, renown: H.renown, result, place, oaths: H.oaths || 0, rules, date, seed: key });
    if (line.length > LINE_MAX) line.splice(0, line.length - LINE_MAX);
  }

  const newAchievements = [];
  for (const id of evaluateAchievements(state, humanIndex)) {
    if (!records.achievements[id]) { records.achievements[id] = date; newAchievements.push(achievementById[id]); }
  }
  records.seen.push(key); if (records.seen.length > SEEN_MAX) records.seen.splice(0, records.seen.length - SEEN_MAX);
  saveRecords(records);
  return { newAchievements: newAchievements.map(({ id, name, desc }) => ({ id, name, desc })), records: copy(records) };
}
