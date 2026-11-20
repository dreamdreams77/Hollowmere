// Interface for records, achievements and lineages. DOM only; styled by main.css and meta.css.
import { h, img, icon } from './dom.js';
import { HOUSE_ORDER } from '../rules/data.js';
import { dn, LORE, TRAITS } from '../content/lore.js';
import { ACHIEVEMENTS, achievementById } from '../meta/achievements.js';
import { lineOf, lineageText, nextLord } from '../meta/legacy.js';

const pct = (e) => (e && e.played ? `${Math.round((100 * e.won) / e.played)}%` : '–');
const day = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
function dur(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
const RESULT = { won: 'Victory', shared: 'Shared crown', lost: 'Defeat' };
const RULES = { original: 'Original', expanded: 'Expanded' };

// The records sheet: content for the app's modal (pass cls 'meta-sheet' to widen it).
// opts.onClose and opts.onReset add buttons; onReset should confirm, call resetRecords() and re-render.
export function renderRecordsSheet(records, { onClose, onReset } = {}) {
  const r = records || {};
  const stat = (label, value, sub) => h('div', { class: 'meta-stat' }, h('div', { class: 'mv' }, value), h('div', { class: 'ml' }, label), sub ? h('div', { class: 'ms small muted it' }, sub) : null);
  const unlocked = Object.keys(r.achievements || {}).filter((id) => achievementById[id]).length;

  const summary = h('div', { class: 'meta-stats' },
    stat('Games', String(r.games || 0)),
    stat('Victories', String(r.wins || 0), r.games ? `${pct({ played: r.games, won: r.wins })} of games` : null),
    stat('Streak', String(r.streak || 0), `best ${r.bestStreak || 0}`),
    stat('Best Renown', r.bestRenown ? String(r.bestRenown.renown) : '–', r.bestRenown ? dn(r.bestRenown.house) : null),
    stat('Fastest win', r.fastestWin ? dur(r.fastestWin.ms) : '–', r.fastestWin ? dn(r.fastestWin.house) : null),
    stat('Laurels', `${unlocked} / ${ACHIEVEMENTS.length}`));

  const byHouse = h('table', { class: 'score-table meta-houses' },
    h('tr', {}, h('th', {}, 'House'), h('th', {}, 'Played'), h('th', {}, 'Won'), h('th', {}, 'Rate')),
    HOUSE_ORDER.map((k) => { const e = r.byHouse?.[k]; return h('tr', { class: e ? '' : 'muted' }, h('td', {}, h('img', { src: img.shield(k), alt: '' }), ` ${dn(k)}`), h('td', {}, String(e?.played || 0)), h('td', {}, String(e?.won || 0)), h('td', {}, pct(e))); }));
  const split = (title, map, label) => h('div', { class: 'meta-split' }, h('span', { class: 'it' }, title),
    Object.keys(map || {}).sort().map((k) => h('span', { class: 'tag' }, `${label(k)}: ${map[k].won}/${map[k].played}`)));

  const recent = (r.recent || []).length
    ? h('ul', { class: 'meta-recent' }, r.recent.map((g) => h('li', { class: `res-${g.result}` },
      h('img', { src: img.shield(g.house), alt: '' }),
      h('div', { class: 'mr-main' },
        h('div', {}, h('b', {}, dn(g.house)), g.lord ? h('span', { class: 'it' }, ` · ${g.lord.given} ${g.lord.epithet}`) : null),
        h('div', { class: 'small muted' }, `${day(g.date)} · against ${g.rivals.map(dn).join(', ')} · ${RULES[g.rules] || g.rules} rules`)),
      h('div', { class: 'mr-res' }, h('span', { class: `tag ${g.result === 'lost' ? '' : g.result === 'won' ? 'g' : 'b'}` }, RESULT[g.result] || g.result), h('div', { class: 'small' }, `${g.renown} Renown${g.place ? ` · ${ordinalPlace(g.place)}` : ''}`)))))
    : h('p', { class: 'it muted meta-empty' }, 'No game has yet been finished.');

  const grid = h('div', { class: 'ach-grid' }, ACHIEVEMENTS.map((a) => {
    const when = r.achievements?.[a.id];
    return h('div', { class: `ach${when ? ' on' : ' locked'}`, title: when ? `Earned ${day(when)}` : 'Not yet earned' },
      a.house ? h('img', { class: 'ach-ic', src: img.shield(a.house), alt: '' }) : icon(img.renown(), 'ach-ic'),
      h('div', { class: 'ach-t' }, h('div', { class: 'ach-n' }, a.name), h('div', { class: 'ach-d small' }, a.desc), when ? h('div', { class: 'ach-w small it' }, day(when)) : null));
  }));

  const lines = HOUSE_ORDER.filter((k) => lineOf(k, r).length).map((k) => {
    const line = lineOf(k, r);
    return h('div', { class: 'meta-line' }, h('img', { src: img.shield(k), alt: '' }),
      h('div', {}, h('div', {}, h('b', {}, `The line of ${dn(k)}`), h('span', { class: 'small muted it' }, ` · ${LORE[k].seat}`)),
        h('ol', { class: 'small' }, line.slice(-6).map((x) => h('li', {}, `${x.given} ${x.epithet}`, h('span', { class: 'muted it' }, ` (${TRAITS[x.trait]?.name || x.trait}) · ${RESULT[x.result] || x.result}, ${x.renown} Renown`)))),
        h('div', { class: 'small it' }, lineageText(k, r))));
  });

  return h('div', { class: 'meta-records' },
    h('h2', {}, 'The Annals of Hollowmere'),
    h('p', { class: 'lede' }, 'Every game you finish is written here: your victories, your laurels, and the lords who ruled for you.'),
    summary,
    h('div', { class: 'rule' }),
    h('h3', { class: 'meta-h' }, 'Houses'), byHouse,
    split('By table', r.byPlayers, (k) => `${k} Houses`), split('By rules', r.byRules, (k) => RULES[k] || k),
    h('div', { class: 'rule' }),
    h('h3', { class: 'meta-h' }, 'Recent games'), recent,
    h('div', { class: 'rule' }),
    h('h3', { class: 'meta-h' }, `Laurels (${unlocked} of ${ACHIEVEMENTS.length})`), grid,
    lines.length ? [h('div', { class: 'rule' }), h('h3', { class: 'meta-h' }, 'Lineages'), h('div', { class: 'meta-lines' }, lines)] : null,
    (onClose || onReset) ? h('div', { class: 'row-btns' },
      onClose ? h('button', { class: 'btn primary', onclick: onClose }, 'Close') : null,
      onReset ? h('button', { class: 'btn', onclick: onReset }, 'Erase the annals') : null) : null);
}
function ordinalPlace(n) { return ['first', 'second', 'third', 'fourth'][n - 1] || `${n}th`; }

// A toast announcing a newly earned achievement ({ id, name, desc }). Removes itself when its
// animation ends; append it to the interface root (or document.body). Stack several by
// appending them one after another (they share a column).
export function unlockToast(achievement) {
  const a = achievementById[achievement?.id] || achievement || {};
  const el = h('div', { class: 'meta-toast vellum gilt', role: 'status' },
    a.house ? h('img', { class: 'mt-ic', src: img.shield(a.house), alt: '' }) : icon(img.renown(), 'mt-ic'),
    h('div', {}, h('div', { class: 'mt-k small it' }, 'A laurel is earned'), h('div', { class: 'mt-n' }, a.name || ''), h('div', { class: 'small' }, a.desc || '')));
  el.addEventListener('animationend', (e) => { if (e.animationName === 'metaToast') el.remove(); });
  return el;
}

// Setup-screen toggle: "Continue the line of …". Returns null when the House has no line yet.
// onChange(checked) is called on every change. seedString (optional) shows the heir that will be named.
export function lineageChoice(houseKey, records, onChange, { checked = false, seedString } = {}) {
  const line = lineOf(houseKey, records);
  if (!line.length) return null;
  const last = line[line.length - 1];
  const heir = seedString != null ? nextLord(houseKey, records, seedString) : null;
  const box = h('input', { type: 'checkbox', checked, onchange: (e) => { el.classList.toggle('on', e.target.checked); onChange?.(e.target.checked); } });
  const el = h('label', { class: `lineage-choice${checked ? ' on' : ''}` }, box,
    h('span', { class: 'lc-t' },
      h('span', {}, `Continue the line of ${last.given} ${last.epithet}`),
      h('span', { class: 'small it muted' }, lineageText(houseKey, records), heir ? ` Your lord: ${heir.given} ${heir.epithet}, ${TRAITS[heir.trait]?.name.toLowerCase() || heir.trait}.` : '')));
  return el;
}
