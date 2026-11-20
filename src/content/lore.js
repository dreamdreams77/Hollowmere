// Story and character for the Houses. The rules keep the original House ids from the source
// documents (Ash, Verrin, Maelor, Thorne, Wren, Sable, Caddoc, Raven) so the engine, tests and
// docs/source stay traceable; players only ever see the display names below.
export const LORE = {
  Ash: {
    display: 'Emberlain', seat: 'Cinderholt',
    history: 'Emberlain came down the Upper Sellen behind a burning standard three generations ago and never went home. Its lords keep the forges hot through every winter and count their wealth in spears, not grain.',
    words: 'By iron, the river is ours',
    given: ['Brann', 'Hadrik', 'Torvald', 'Ysolde', 'Kaedra', 'Merek', 'Sigrun', 'Owain', 'Rhosyn', 'Galt'],
  },
  Verrin: {
    display: 'Aldermoor', seat: 'Sheafhall',
    history: 'The Aldermoors were tenant farmers who bought their land acre by acre and their titles a generation later. They plant orchards their grandchildren will harvest and expect the same patience of everyone else.',
    words: 'The harvest outlives the harvester',
    given: ['Edwyn', 'Maud', 'Alaric', 'Hesper', 'Godric', 'Wenna', 'Osric', 'Liesel', 'Cuthbert', 'Avelina'],
  },
  Maelor: {
    display: 'Tessaly', seat: 'the Countinghouse',
    history: 'Tessaly holds no oath it cannot price. Its barges carry half the salt of the Delta, and its daughters marry into whichever House is owed the most.',
    words: 'Every river is a ledger',
    given: ['Orsino', 'Benedetta', 'Lucan', 'Ilaria', 'Dario', 'Fiora', 'Marzio', 'Sabina', 'Teodor', 'Calla'],
  },
  Thorne: {
    display: 'Rosenvael', seat: 'Briarkeep',
    history: 'The Rosenvaels are the oldest blood on the river and the poorest in land. They have outlived richer Houses by marrying well and remembering everything, and they will tell you so.',
    words: 'The blood remembers',
    given: ['Aurelian', 'Isolde', 'Lucien', 'Morwenna', 'Tristan', 'Seraphine', 'Evrard', 'Clemence', 'Raoul', 'Elinor'],
  },
  Wren: {
    display: 'Bramwell', seat: 'the Hearthmoot',
    history: 'Bramwell is less a House than a quarrelsome alliance of hamlets that elects its lord at midwinter. Alone it is weak; it has never once been alone.',
    words: 'Many hands, one hearth',
    given: ['Hal', 'Nell', 'Pip', 'Rowan', 'Tamsin', 'Ned', 'Bryony', 'Wat', 'Elsie', 'Col'],
  },
  Sable: {
    display: 'Veylin', seat: 'the Shuttered House',
    history: 'Nobody remembers the Veylins arriving. Their accounts show more coin than their land could ever yield, and the clerks who asked why have taken positions far away.',
    words: 'What is unseen cannot be taken',
    given: ['Silas', 'Nerys', 'Corvin', 'Ottilie', 'Lazar', 'Vesna', 'Anselm', 'Mireille', 'Quill', 'Daska'],
  },
  Caddoc: {
    display: 'Scrivane', seat: 'Inkwell Abbey',
    history: 'The Scrivanes began as copyists to the river abbeys and learned too much from what they copied. Their Rites are written, not spoken, and they keep the only complete library of the old floods.',
    words: 'Ink binds what steel cannot',
    given: ['Aldous', 'Perpetua', 'Ambrose', 'Hildreth', 'Jerome', 'Ottoline', 'Bede', 'Scholastica', 'Gervase', 'Ione'],
  },
  Raven: {
    display: 'Ostrander', seat: 'Watchfall',
    history: 'Ostrander served three dead kings as their eyes and outlived each of them. It keeps no great army; it keeps a ledger of every lie told on the river, and it collects.',
    words: 'No lie survives the morning',
    given: ['Mordaunt', 'Ilse', 'Casimir', 'Agathe', 'Leopold', 'Henrike', 'Valerian', 'Odile', 'Konrad', 'Thessaly'],
  },
};

// A lord's trait colours how that rival plays (see ai.js TRAIT) and how the chronicle speaks of it.
export const TRAITS = {
  bold: { name: 'Bold', text: 'quick to march and slow to forgive' },
  cautious: { name: 'Cautious', text: 'walls first, banners second' },
  covetous: { name: 'Covetous', text: 'counts every sack twice' },
  proud: { name: 'Proud', text: 'cannot bear to see another ahead' },
  cunning: { name: 'Cunning', text: 'trusts paper more than people' },
  pious: { name: 'Pious', text: 'reads omens in every flood' },
  honourable: { name: 'Honourable', text: 'keeps an oath even when it costs' },
  treacherous: { name: 'Treacherous', text: 'keeps an oath until it costs' },
};
export const TRAIT_IDS = Object.keys(TRAITS);
export const EPITHETS = ['the Elder', 'the Younger', 'Greyhand', 'the Tall', 'the Quiet', 'Ironbrow', 'the Fair', 'of the Long Winter', 'Half-Drowned', 'the Lame', 'Goldtongue', 'the Patient', 'Ashborn', 'the Last'];

export const dn = (key) => LORE[key]?.display || key;

// Heir names follow from the seed, the House and the Heir's serial number, so they need no extra
// state and stay the same on reload.
function h32(s) { let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
export function heirName(state, house) {
  const L = LORE[house.name]; const k = h32(`${state.seed}:${house.name}:${house.heir.serial}`);
  const given = L.given[k % L.given.length];
  return given === house.lord?.given ? L.given[(k + 3) % L.given.length] : given;
}
export function lordName(house) { return house.lord ? `${house.lord.given} ${house.lord.epithet}` : dn(house.name); }
