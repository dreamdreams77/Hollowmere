// Scenarios: curated starts with their own goal. The rules are the normal ones; a scenario only
// chooses the table, adjusts the opening position, and judges an objective at the end
// (separately from who wins). Objectives read only facts recorded in the game state.
import { REACHES } from '../rules/data.js';
import * as E from '../rules/engine.js';

const delta = REACHES.find((r) => r.delta).id;
const ledDelta = (flood, i) => flood.reaches.find((r) => r.reach === delta)?.first === i;

export const SCENARIOS = [
  {
    id: 'delta_holds',
    title: 'The Delta Holds',
    house: 'Maelor', rivals: ['Ash', 'Raven'], rules: 'expanded', difficulty: 'normal',
    blurb: "Tessaly's barges carry half the salt of the Delta. Emberlain wants the river mouth, and Ostrander is counting your sins. Keep the Delta Mouth through every Flood.",
    setup(s, me) {
      // Tessaly starts with a foothold on the Delta and a lean Coffer.
      s.plots[18].m[me] = 1; s.houses[me].coffer.C = Math.max(0, s.houses[me].coffer.C - 2);
    },
    objective: { text: 'Take the Delta Mouth (strictly the most markers) at all four Floods.',
      check: (s, me) => { const won = s.floods.filter((f) => ledDelta(f, me)).length; return { done: won === 4 && s.floods.length === 4, progress: `${won} of 4 Floods held`, failed: s.floods.some((f) => !ledDelta(f, me)) }; } },
  },
  {
    id: 'last_rose',
    title: 'Last of the Rose',
    house: 'Thorne', rivals: ['Verrin', 'Caddoc', 'Wren'], rules: 'expanded', difficulty: 'hard',
    blurb: 'Rosenvael has one manor, one Legion and the oldest blood on the river. Three richer Houses have already divided the spoils. Prove the line is true and still standing at the end.',
    setup() {},
    objective: { text: 'End the game with a Genuine Heir proclaimed or crowned, and at least 20 Renown.',
      check: (s, me) => { const h = s.houses[me]; const true_ = (h.heir.revealed && h.heir.status === 'G') || h.heirsCrowned > 0; return { done: true_ && h.renown >= 20, progress: `${true_ ? 'Line proven' : 'Line unproven'} · ${h.renown} of 20 Renown`, failed: false }; } },
  },
  {
    id: 'oathbound',
    title: 'Oathbound',
    house: 'Wren', rivals: ['Ash', 'Sable', 'Maelor'], rules: 'expanded', difficulty: 'normal',
    blurb: 'Bramwell has sworn Pacts with every House on the river. Two of their lords would sell their mothers. Win without ever breaking your word.',
    setup(s, me) {
      for (const x of s.houses) if (x.i !== me) {
        s.houses[me].pacts.push({ with: x.i, until: 2 }); x.pacts.push({ with: me, until: 2 });
        E.shiftRegard(s, x.i, me, 2); E.shiftRegard(s, me, x.i, 2);
      }
      const ash = s.houses.find((x) => x.name === 'Ash'), sable = s.houses.find((x) => x.name === 'Sable');
      if (ash) ash.lord.trait = 'treacherous'; if (sable) sable.lord.trait = 'treacherous';
    },
    objective: { text: 'Win the game without breaking a single Pact.',
      check: (s, me) => ({ done: s.phase === 'over' && s.winner.includes(me) && s.houses[me].oaths === 0, progress: s.houses[me].oaths ? 'An oath is broken' : 'Every oath kept', failed: s.houses[me].oaths > 0 }) },
  },
  {
    id: 'iron_tide',
    title: 'The Iron Tide',
    house: 'Verrin', rivals: ['Ash', 'Raven'], rules: 'expanded', difficulty: 'hard',
    blurb: 'Two warbands have come down the Upper Sellen. Aldermoor has granaries, not garrisons. Survive the Iron Tide with your lands, and your harvest, intact.',
    setup(s, me) {
      for (const x of s.houses) if (x.i !== me) { x.coffer.I += 2; const pid = E.heldPlots(s, x.i)[0]; if (pid != null) s.plots[pid - 1].l[x.i] = (s.plots[pid - 1].l[x.i] || 0) + 1; }
      if (s.houses.find((x) => x.name === 'Raven')) s.houses.find((x) => x.name === 'Raven').lord.trait = 'bold';
    },
    objective: { text: 'Finish with at least 5 markers on the board and a Dynasty founded at some point.',
      check: (s, me) => { const m = E.totalMarkers(s, me), d = s.houses[me].dynastiesBought; return { done: m >= 5 && d > 0, progress: `${m} of 5 markers · ${d ? 'Dynasty founded' : 'no Dynasty yet'}`, failed: false }; } },
  },
];
export const scenarioById = Object.fromEntries(SCENARIOS.map((x) => [x.id, x]));
