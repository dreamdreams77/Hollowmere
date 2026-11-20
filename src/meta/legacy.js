// Lineages: each House's line of lords carries over between games. records.lines[house] holds the
// lords who ended a game for that House, oldest first (written by records.recordGame). When the
// player chooses to continue a line, the next lord is the last one's heir.
import { LORE, TRAITS, TRAIT_IDS, dn } from '../content/lore.js';

function h32(s) { let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];
export const ordinal = (n) => ORDINAL[n - 1] || `${n}th`;

// Epithets an heir takes from how the last reign ended.
const BY_RESULT = {
  won: ['the Magnificent', 'Goldcrown', 'the Fortunate', 'Laurel-Born', 'the Proud'],
  shared: ['the Even-Handed', 'Half-Crowned', 'the Patient'],
  lost: ['the Avenger', 'the Unbowed', 'the Bitter', 'Ashen-Heart', 'the Resolute'],
  oathbroken: ['the Penitent', 'Clean-Hands'],
};

export const lineOf = (houseKey, records) => (records?.lines?.[houseKey] || []).slice();

// The heir to the last lord of houseKey's line, or null if the House has no line yet.
// Deterministic in seedString. Returns { given, epithet, trait, lineage } where lineage is the
// earlier lords, oldest first.
export function nextLord(houseKey, records, seedString = '') {
  const line = lineOf(houseKey, records);
  const L = LORE[houseKey];
  if (!line.length || !L) return null;
  const last = line[line.length - 1];
  const k = (salt) => h32(`${seedString}:${houseKey}:${line.length}:${salt}`);
  // Given name: one time in three the heir is named for an ancestor; otherwise a fresh name from
  // the House's pool (never the parent's own name, unless the pool has nothing else).
  let given;
  const ancestors = [...new Set(line.map((x) => x.given))].filter((g) => g !== last.given);
  if (ancestors.length && k('honour') % 3 === 0) given = ancestors[k('which') % ancestors.length];
  else {
    const pool = L.given.filter((g) => g !== last.given);
    given = (pool.length ? pool : L.given)[k('given') % (pool.length || L.given.length)];
  }
  // Epithet: a regnal number if the name has been borne before in this line; else one earned by
  // the last reign's end.
  const before = line.filter((x) => x.given === given).length;
  let epithet;
  if (before) epithet = `the ${ordinal(before + 1)}`;
  else {
    const pool = last.oaths ? BY_RESULT.oathbroken : BY_RESULT[last.result] || BY_RESULT.lost;
    epithet = pool[k('epithet') % pool.length];
  }
  // Trait: inherited two times in five; otherwise drawn afresh.
  const trait = TRAITS[last.trait] && k('trait') % 5 < 2 ? last.trait : TRAIT_IDS[k('newtrait') % TRAIT_IDS.length];
  return { given, epithet, trait, lineage: line.map(({ given: g, epithet: e, trait: t, renown, result }) => ({ given: g, epithet: e, trait: t, renown, result })) };
}

// "Third of the line of Brann Ironbrow, heir to Kaedra the Avenger, who fell short with 31 Renown."
// Empty string if the House has no line.
export function lineageText(houseKey, records) {
  const line = lineOf(houseKey, records);
  if (!line.length) return '';
  const first = line[0], last = line[line.length - 1];
  const how = last.result === 'won' ? `who took Hollowmere with ${last.renown} Renown`
    : last.result === 'shared' ? `who shared Hollowmere with ${last.renown} Renown`
      : `who fell short with ${last.renown} Renown`;
  const pos = `${ordinal(line.length + 1)} of the line of ${first.given} ${first.epithet}`;
  return line.length === 1 ? `${pos} of ${dn(houseKey)}, ${how}.` : `${pos} of ${dn(houseKey)}, heir to ${last.given} ${last.epithet}, ${how}.`;
}

// The lords map for newGame({ lords }) when the player continues houseKey's line, else undefined.
export function lordsFor(houseKey, records, seedString, enabled = true) {
  if (!enabled) return undefined;
  const l = nextLord(houseKey, records, seedString);
  return l ? { [houseKey]: { given: l.given, epithet: l.epithet, trait: l.trait } } : undefined;
}
