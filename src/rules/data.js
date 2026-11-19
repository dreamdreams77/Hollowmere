// Hollowmere rule data. Every number here is taken from the supplied sources:
//   docs/source/config.py          (SimConfig defaults: the current engine values)
//   docs/source/HOW_TO_PLAY.md     (checked against the engine by test_rules_doc.py)
//   docs/source/reference.html     (board, opening Coffers, action table)
//   docs/source/cards.html         (the 12 Rites and 12 Events)
// Where the sources disagree, the choice and its reason are recorded in docs/RULES.md.

export const RES = ['G', 'T', 'S', 'I', 'R', 'C', 'L'];
export const RES_NAME = { G: 'Grain', T: 'Timber', S: 'Stone', I: 'Iron', R: 'Reed', C: 'Coin', L: 'Lore' };

// config.py SimConfig defaults (rule v6.1).
export const CONFIG = Object.freeze({
  seasons: 12,
  floodSeasons: [3, 6, 9, 12],
  actionsPerSeason: 3,
  midFloodPoints: [3, 0],
  finalFloodPoints: [6, 3],
  deltaMultiplier: 2,
  ashConquestPerReach: 1,
  sableReachBonus: 1,
  cabalMax: 2,
  cabalCostCoin: 1,
  dynastyPurchaseRenown: 2,
  dynastyFloodRenown: 1,
  dynastyCostReed: 2,
  pressureThreshold: 4,
  sealRenown: 2,
  raidMaxLegions: 2,
  recaptureCost: { I: 1, G: 1 },
  passCostCoin: 1,
  buildCost: { G: 1, T: 1, S: 1 },
  holderDeathChance: 0.25,
  genuineHeirEndRenown: 4,
  impostorPenalty: 2,
  thorneSuccessionBonus: 3,
  investigationHandLimit: 3,
  accordFavor: 1,
  councilRenown: 2,
  legionCapPerPlot: 3,
  keepCap: 2,          // markers one House may hold on one Plot (a Keep)
  riteHandLimit: 3,
  riteOpeningHand: 2,
  revealCostFavor: 2,
  heirCards: 5,        // four Impostors and one Genuine
});

// Board: reference.html. Reach I is the top row; Reach V (Delta Mouth) the bottom.
// Plot ids P1..P20 run left to right, top to bottom. seat = starting seat letter.
export const REACHES = [
  { id: 1, roman: 'I', name: 'Upper Sellen' },
  { id: 2, roman: 'II', name: 'Sedge Bend' },
  { id: 3, roman: 'III', name: 'Mill Crossing' },
  { id: 4, roman: 'IV', name: 'Varra Marsh' },
  { id: 5, roman: 'V', name: 'Delta Mouth', delta: true },
];

export const PLOTS = [
  { id: 1, res: 'G', n: 5, seat: 'A', name: 'Wheatwold' },
  { id: 2, res: 'T', n: 8, seat: 'A', name: 'Oakhallow' },
  { id: 3, res: 'L', n: 3, name: 'Scriptorium Tor' },
  { id: 4, res: 'G', n: 10, name: 'Brightfurrow' },
  { id: 5, res: 'C', n: 9, seat: 'B', name: 'Tollbridge' },
  { id: 6, res: 'R', n: 6, seat: 'B', name: 'Sedgewater' },
  { id: 7, res: 'I', n: 8, name: 'Blackforge' },
  { id: 8, res: 'S', n: 4, name: 'Greycairn' },
  { id: 9, res: 'I', n: 11, seat: 'C', name: 'Rustmoor' },
  { id: 10, res: 'S', n: 6, seat: 'C', name: 'Millstone Quarry' },
  { id: 11, res: 'L', n: 2, name: 'Owlward Abbey' },
  { id: 12, res: 'G', n: 9, name: 'Haymead' },
  { id: 13, res: 'R', n: 4, seat: 'D', name: 'Reedholt' },
  { id: 14, res: 'C', n: 12, seat: 'D', name: 'Silvermere' },
  { id: 15, res: 'S', n: 5, name: 'Cobble Ford' },
  { id: 16, res: 'T', n: 8, name: 'Varrawood' },
  { id: 17, res: 'L', n: 6, name: 'Drownbell Library' },
  { id: 18, res: 'I', n: 10, name: 'Saltiron Spit' },
  { id: 19, res: 'C', n: 3, name: "Merchant's Quay" },
  { id: 20, res: 'R', n: 11, name: 'Heron Delta' },
].map((p) => ({ ...p, reach: Math.ceil(p.id / 4), col: (p.id - 1) % 4, row: Math.floor((p.id - 1) / 4) }));

export const plotById = (id) => PLOTS[id - 1];

// "Each Plot touches its neighbours in its row and the Plot directly above and below."
export const ADJ = PLOTS.map((p) => {
  const out = [];
  if (p.col > 0) out.push(p.id - 1);
  if (p.col < 3) out.push(p.id + 1);
  if (p.row > 0) out.push(p.id - 4);
  if (p.row < 4) out.push(p.id + 4);
  return out;
});
export const adjacent = (a, b) => ADJ[a - 1].includes(b);

// 36ths: how many of the 36 two-dice outcomes hit this number.
export const pips = (n) => (n === 7 ? 0 : 6 - Math.abs(7 - n));

// Rivers (reference.html board): drawn along Plot borders; they do not change adjacency.
// Sellen: down the gap between columns 0|1 to the III/IV border, east to the 1|2 gap, then south to the sea.
// Varra: from the east edge along the III/IV border, joining the Sellen.
export const RIVERS = {
  sellen: [[1, -0.5], [1, 3], [2, 3], [2, 5]],
  varra: [[4, 3], [2, 3]],
};

// Houses: opening Coffers and asymmetries from reference.html and HOW_TO_PLAY.md (current),
// not from SYSTEMS_DESIGN Phase 3 (superseded by v2 revisions and D1-D12).
export const HOUSES = {
  Ash: {
    title: 'Warlord', motto: 'By iron, the river is ours', winsBy: 'Conquest', weakAt: 'Thin economy; Iron is its main cost',
    colour: '#b23a2e', accent: '#e9b44c', coffer: { G: 3, T: 1, S: 1, I: 3 },
    muster: { I: 2 }, skirmish: 1, conquest: true,
    blurb: 'Takes Reaches by force and scores extra Renown where it has won a Skirmish. Cheap raids, cheap musters.',
  },
  Verrin: {
    title: 'Dynast', motto: 'The harvest outlives the harvester', winsBy: 'Dynasties', weakAt: 'No Lore',
    colour: '#4f7d3a', accent: '#d9c27a', coffer: { G: 3, T: 2, S: 2 },
    dynastyFavor: 2, granary: true, noLore: true, investigateCost: { G: 2 },
    blurb: 'Verdant Plots yield extra Grain, and Dynasties cost less Favor. Cannot draw Lore from the land.',
  },
  Maelor: {
    title: 'Merchant', motto: 'Every river is a ledger', winsBy: 'Trade', weakAt: 'Iron cost of Muster is high (3)',
    colour: '#c7962f', accent: '#3a2a12', coffer: { G: 1, T: 2, S: 1, C: 4 },
    muster: { I: 3, G: 1 }, writ: true,
    blurb: 'Bank trades at 2 to 1, once per Season, and the strongest Coffer.',
  },
  Thorne: {
    title: 'Succession', motto: 'The blood remembers', winsBy: 'Succession', weakAt: 'Starts with one fewer marker; no Musters before Season 3',
    colour: '#6b3fa0', accent: '#e6d3a3', coffer: { G: 2, T: 1, S: 1, R: 1, C: 3 },
    oneMarker: true, musterFrom: 3, successionBonus: true, vigil: true,
    blurb: 'Tests its own Heir privately, draws a second Heir on marriage, and gains Renown when a Genuine Heir takes a Dynasty.',
  },
  Wren: {
    title: 'Coalition', motto: 'Many hands, one hearth', winsBy: 'Alliances', weakAt: 'Starved of Iron and Lore; relies on Accords',
    colour: '#3f8fa6', accent: '#f1e6c8', coffer: { G: 2, T: 2, S: 1, R: 1, C: 2 },
    accords: 2,
    blurb: 'Forms up to two Accords a Season, which block Raids between partners and pay Favor at each Flood.',
  },
  Sable: {
    title: 'Cabal', motto: 'What is unseen cannot be taken', winsBy: 'Hidden production', weakAt: 'Cabal tokens cost one Coin and never count for control',
    colour: '#2d2a33', accent: '#a9a3b8', coffer: { G: 1, T: 3, S: 3, C: 2 },
    cabal: true,
    blurb: 'Two hidden Cabal tokens produce resources and count toward Reach majority, but never toward control.',
  },
  Caddoc: {
    title: 'Scribe', motto: 'Ink binds what steel cannot', winsBy: 'Rites', weakAt: 'Rites are its only Renown; a bad hand hurts',
    colour: '#a0522d', accent: '#f0d9a8', coffer: { G: 1, T: 1, S: 1, R: 2, C: 2, L: 2 },
    riteRenown: 2, reedForLore: true, halfPressure: true,
    blurb: 'Each Rite cast is two Renown, Reed can pay for Lore, and its Rites raise only half the Pressure.',
  },
  Raven: {
    title: 'Investigator', motto: 'No lie survives the morning', winsBy: 'Exposing lies', weakAt: 'Combat (Skirmish penalty of one)',
    colour: '#24344d', accent: '#c9d3e0', coffer: { G: 1, T: 1, S: 1, R: 1, C: 2, L: 3 },
    skirmish: -1, investigateCost: {}, seal: true,
    blurb: 'Seals test rival Heirs, and each Impostor found is worth Renown. Weak in arms.',
  },
};
export const HOUSE_ORDER = ['Ash', 'Verrin', 'Maelor', 'Thorne', 'Wren', 'Sable', 'Caddoc', 'Raven'];

// Rites: cards.html. pressure from the flame icons (half flame = 0.5).
export const RITES = [
  { id: 'ledger_ink', name: 'Ledger Ink', school: 'Tidewater', cost: { R: 2 }, pressure: 1, text: 'Gain 2 Coin.' },
  { id: 'mist_veil', name: 'Mist Veil', school: 'Tidewater', cost: { L: 2 }, pressure: 1, text: 'Take 1 resource at random from the richest rival.' },
  { id: 'silent_barge', name: 'Silent Barge', school: 'Tidewater', cost: { R: 2 }, pressure: 1, text: 'Place 1 Influence Marker, free, on an empty Plot next to one of yours.', target: 'emptyAdjacent' },
  { id: 'reed_oath', name: 'Reed Oath', school: 'Tidewater', cost: { R: 3 }, pressure: 0.5, text: 'Gain 1 Renown.' },
  { id: 'heron_cry', name: 'Heron Cry', school: 'Tidewater', cost: { L: 1, C: 1 }, pressure: 1, text: 'Remove up to 1 rival Influence Marker from Plots next to yours. No capture.', target: 'rivalAdjacent', count: 1 },
  { id: 'drowned_choir', name: 'Drowned Choir', school: 'Tidewater', cost: { R: 1, C: 2 }, pressure: 1, text: 'Take 2 resources at random from the richest rival.' },
  { id: 'ink_of_names', name: 'Ink of Names', school: 'Lorecraft', cost: { L: 2 }, pressure: 1, text: 'Reveal one unrevealed rival Heir at random. If it is an Impostor, gain 2 Renown.' },
  { id: 'star_chart', name: 'Star Chart', school: 'Lorecraft', cost: { L: 1 }, pressure: 0, text: 'Gain 1 Favor.' },
  { id: 'ironveil_oath', name: 'Ironveil Oath', school: 'Ironveil', cost: { I: 2 }, pressure: 1, text: 'Gain 2 Iron.' },
  { id: 'verdant_bloom', name: 'Verdant Bloom', school: 'Verdant', cost: { G: 2 }, pressure: 1, text: 'Gain 3 Grain.' },
  { id: 'gilt_ledger', name: 'Gilt Ledger', school: 'Gilt', cost: { C: 2 }, pressure: 1, text: 'Gain 1 Favor.' },
  { id: 'ashen_pyre', name: 'Ashen Pyre', school: 'Ashen', cost: { T: 2 }, pressure: 2, text: 'Remove up to 2 rival Influence Markers from Plots next to yours. No capture.', target: 'rivalAdjacent', count: 2 },
];
export const riteById = Object.fromEntries(RITES.map((r) => [r.id, r]));

// Events: cards.html. All resolve after the Actions, before any Flood (D11).
export const EVENTS = [
  { id: 'dry_autumn', name: 'Dry Autumn', text: 'Next Harvest only: Grain production is halved.' },
  { id: 'spring_flood', name: 'Spring Flood', text: 'Next Harvest only: production on Reach II Plots is doubled.' },
  { id: 'iron_winter', name: 'Iron Winter', text: 'Next Harvest only: Iron production is halved.' },
  { id: 'coronation_feast', name: 'Coronation Feast', text: 'Every House gains 1 Grain and 1 Coin.' },
  { id: 'harvest_moon', name: 'Harvest Moon', text: 'Every House with markers on at least three Plots gains 1 Favor.' },
  { id: 'caravan_fire', name: 'Caravan Fire', text: 'One House chosen at random loses one resource to the poorest House.' },
  { id: 'levy_of_the_crown', name: 'Levy of the Crown', text: 'Every House with fewer than three Legions gains one Legion on a Plot it holds.' },
  { id: 'market_glut', name: 'Market Glut', text: 'Every House holding more than six resources discards two at random.' },
  { id: 'council_of_houses', name: 'Council of Houses', text: 'The House with the most Favor (if it is the only leader) gains 2 Renown.' },
  { id: 'death_in_the_court', name: 'Death in the Court', text: 'A random Dynasty holder dies, which triggers its succession.' },
  { id: 'lean_winter', name: 'Lean Winter', text: 'Every House with fewer than three Grain loses one Coin.' },
  { id: 'blood_moon', name: 'Blood Moon', text: 'No effect.' },
];
export const eventById = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// Investigation cards (rule v5.0, D9). docs/INVESTIGATION.md was not supplied; the deck
// mixes below are this build's reconstruction (see docs/RULES.md, item R7).
export const INVESTIGATION = {
  testimony: { name: 'Testimony', text: 'Play: gain 1 Favor.' },
  document: { name: 'Document', text: 'Play: gain 1 Lore.' },
  witness: { name: 'Witness', text: "Play: take 1 resource at random from the richest rival. If that rival is Sable, its Cabal is exposed." },
  seal: { name: 'Seal', text: 'Raven only: spend with 1 Lore to test a rival Heir.' },
};
export const INVESTIGATION_DECK = {
  common: ['testimony', 'testimony', 'testimony', 'testimony', 'document', 'document', 'document', 'document', 'witness', 'witness', 'witness', 'witness'],
  raven: ['seal', 'seal', 'seal', 'seal', 'seal', 'testimony', 'testimony', 'document', 'document', 'witness', 'witness', 'witness'],
};

// Seats used for each player count (HOW_TO_PLAY gives four seats; see docs/RULES.md R11).
export const SEATS_FOR = { 2: ['A', 'C'], 3: ['A', 'B', 'C'], 4: ['A', 'B', 'C', 'D'] };
