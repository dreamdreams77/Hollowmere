// The guided first game: short lessons that appear at the moment they matter, each once.
// The App calls tutorial.on(moment, context); the coach card can be dismissed or switched off.
import { h, img, icon, put, clear } from './dom.js';
import { HOUSES, RES_NAME, PLOTS, pips } from '../rules/data.js';
import { dn } from '../content/lore.js';

const LESSONS = {
  welcome: (c) => ({
    title: `Welcome, ${dn(c.house)}`,
    body: [
      'Hollowmere is played over twelve Seasons. The House with the most Renown after the twelfth Flood wins.',
      'The board is twenty Plots in five rows, the Reaches. Every third Season the rivers flood and each Reach goes to the House with the most markers in it.',
      'Your manors fly your banner. Tap any Plot to see what it yields and what you can do there.',
    ],
  }),
  harvest: (c) => ({
    title: 'The Harvest',
    body: [
      `Each Season begins with two dice. This time they show ${c.sum}.`,
      c.sum === 7 ? 'A seven pays nothing. Some Seasons are lean.' : `Every Plot marked ${c.sum} pays its resource to each House on it: one per marker, two per marker on a Keep.`,
      'The numbers 6 and 8 come up most often (5 rolls in 36); 2 and 12 least (1 in 36). The pips on each Plot\'s token show its odds.',
    ],
  }),
  firstTurn: (c) => ({
    title: 'Your first Action',
    body: [
      'You take three Actions a Season, one at a time, in turn with your rivals. Each Action has a cost shown under its name; a greyed one tells you why it is unavailable.',
      c.canBuild ? 'A good start: Build on an empty Plot next to one of yours. More Plots mean more Harvests and more weight in the Reaches.' : 'You cannot Build yet (it costs 1 Grain, 1 Timber and 1 Stone). Trade at the Bank, or Toil, to gather what you need.',
      'Unsure? Press Advise for the three moves a seasoned steward would make, and why.',
    ],
    point: 'build',
  }),
  coffer: () => ({
    title: 'Your Coffer',
    body: [
      'Your resources sit in your House panel (the House tab on a phone). Grain, Timber and Stone build; Iron fights; Reed founds Dynasties; Coin trades and pays; Lore feeds Investigation and Rites.',
      'Favor (the red seal) buys Dynasties. Renown (the laurel) is the score.',
    ],
  }),
  raidReady: () => ({
    title: 'Legions and Raids',
    body: [
      'Your Legions can Raid a rival Plot next to them. An undefended Plot falls at once; a defended one is fought with two dice plus Legions.',
      'A captured marker can be Recaptured by its owner, if they have a Legion next to it. Muster Legions to guard what you hold.',
    ],
    point: 'raid',
  }),
  floodSoon: () => ({
    title: 'A Flood is coming',
    body: [
      'At the end of this Season the rivers flood. Each Reach scores 3 Renown for the House with strictly the most markers there; the Delta Mouth, at the bottom, scores double.',
      'A tie scores nothing. One more marker in the right Reach now can be worth more than anything else you could do.',
    ],
  }),
  flood: () => ({
    title: 'After the Flood',
    body: [
      'Dynasties pay 1 Renown at every Flood. But a Dynasty holder may die (one chance in four), and if their Heir is an Impostor, the Dynasty and 2 Renown are lost.',
      'Four Heirs in five are Impostors. Your own is hidden even from you until something shows it.',
    ],
  }),
  rites: () => ({
    title: 'Rites and Ember Pressure',
    body: [
      'Rites are powerful cards you draw each Harvest. Each one raises Ember Pressure (the flames at the top).',
      'If the Pressure stands at 4 or more at a Flood, the House that cast the most Rites that Season loses a marker.',
    ],
    point: 'rite',
  }),
  diplomacy: () => ({
    title: 'Envoys and Pacts',
    body: [
      'Rivals remember how you treat them: see how each regards you in the Rivals panel.',
      'An Envoy offers a Pact: neither of you may Raid the other until the end of next Season. Breaking a Pact costs Renown, Favor and everyone\'s trust.',
    ],
    point: 'envoy',
  }),
  done: () => ({
    title: 'You know enough to rule',
    body: ['That is the heart of Hollowmere. The rest, Seals, Vigils, Cabals and Accords, belongs to particular Houses: open How to play from the menu whenever you like.'],
  }),
};

export class Tutorial {
  constructor(app, enabled) { this.app = app; this.enabled = enabled; this.seen = new Set(); this.queue = []; this.el = null; }
  on(moment, ctx = {}) {
    if (!this.enabled || this.seen.has(moment) || !LESSONS[moment]) return;
    this.seen.add(moment);
    this.queue.push(LESSONS[moment](ctx));
    if (!this.el) this.next();
  }
  next() {
    this.el?.remove(); this.el = null;
    document.querySelectorAll('.coach-point').forEach((x) => x.classList.remove('coach-point'));
    const l = this.queue.shift(); if (!l || !this.enabled) return;
    const card = h('div', { id: 'coach', class: 'vellum gilt', role: 'dialog', 'aria-label': l.title },
      h('div', { class: 'coach-head' }, icon(img.shield(this.app.state?.houses[this.app.me]?.name || 'Verrin'), 'icon lg'), h('h3', {}, l.title)),
      l.body.map((p) => h('p', {}, p)),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn primary', onclick: () => this.next() }, this.queue.length ? 'Next' : 'Got it'),
        h('button', { class: 'btn', onclick: () => { this.enabled = false; this.next(); this.app.toast('Guidance switched off. Turn it on again from the menu.'); } }, 'No more tips')));
    this.app.ui.append(card); this.el = card;
    if (l.point) requestAnimationFrame(() => { for (const b of document.querySelectorAll('.act')) if (b.firstChild?.textContent === { build: 'Build', raid: 'Raid', rite: 'Rite', envoy: 'Envoy' }[l.point]) b.classList.add('coach-point'); });
  }
}
void put; void clear; void HOUSES; void RES_NAME; void PLOTS; void pips;
