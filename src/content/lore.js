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

// What a lord says when the player opens that House's dossier: three lines in the House's own voice
// and two by the lord's trait. greeting() picks one without randomness, so it holds steady while the
// dossier stays open in a Season and changes with the Season.
export const GREETINGS = {
  Ash: ['Speak quickly. The forge cools while you talk.', 'Come in. Mind the spears; they are all sharp.', 'Cinderholt welcomes you. Cinderholt has also counted your escort.'],
  Verrin: ['Sit. Eat something; it is our own bread.', 'Everything at Sheafhall takes patience, including me.', 'Wipe your boots. That is good soil you are carrying off.'],
  Maelor: ['Welcome to the Countinghouse. Your visit has been noted, and priced.', 'Say what you want. Then say what it is worth.', 'Every guest is a customer. Sit, customer.'],
  Thorne: ['My grandmother\'s grandmother received yours in this hall. She was kinder.', 'Briarkeep is poor in land and rich in memory. What do you want remembered?', 'Sit below the portraits. They are all listening.'],
  Wren: ['Pull up a bench. Mind the dog; he votes.', 'The Hearthmoot hears anyone once. Speak up, it is noisy.', 'You have caught us between arguments. That is lucky.'],
  Sable: ['You found the Shuttered House. Most do not.', 'Sit where the lamp is. I prefer to see my guests.', 'We were not expecting you. We were, of course, prepared.'],
  Caddoc: ['State your business. A novice will write it down.', 'Quietly, please. The archive is sleeping.', 'Inkwell Abbey records every visit. Make this one worth the ink.'],
  Raven: ['Before you speak: we already know about the barge.', 'Watchfall sees you. Sit, and tell me something true.', 'Lie if you like. It saves us time later.'],
};
export const TRAIT_GREETINGS = {
  bold: ['Say what you came for. I will answer yes or no, and loudly.', 'If this is about war, you are early. If it is peace, you are late.'],
  cautious: ['Leave your escort outside. Then we can talk.', 'Whatever it is, I will think about it. For a while.'],
  covetous: ['Did you bring anything? It helps the conversation.', 'Talk is free here. Everything after the talk is not.'],
  proud: ['You may approach.', 'You are fortunate to find me receiving.'],
  cunning: ['I wondered when you would come. Sooner than I guessed.', 'Tell me what you want. Then tell me what you actually want.'],
  pious: ['The river brought you. Let us see why.', 'Wash your hands in the basin first. It is the custom.'],
  honourable: ['Ask a straight question and you will get a straight answer.', 'Welcome. You have safe conduct while you are under my roof.'],
  treacherous: ['My dear friend. Have we ever quarrelled? I do not remember quarrelling.', 'Sit, sit. You look tired. Wine?'],
};
export function greeting(house, state = null, salt = '') {
  const lines = [...(GREETINGS[house.name] || []), ...(TRAIT_GREETINGS[house.lord?.trait] || [])];
  if (!lines.length) return `${dn(house.name)} receives you.`;
  return lines[h32(`${state?.seed ?? ''}:${state?.season ?? 0}:${house.name}:${house.lord?.given ?? ''}:${salt}`) % lines.length];
}
