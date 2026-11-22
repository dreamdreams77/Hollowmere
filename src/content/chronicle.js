// Hollowmere chronicle: short lines of story for the UI. Pure functions over the game state (or a
// view of it); no DOM and no randomness. Every choice between variants comes from a small hash of
// the seed, the Season or log sequence, and the ids involved, so a line stays the same on reload.
// Nothing here reads hidden information: rival Heirs, hands and an unexposed Cabal are never used.
import { CONFIG, REACHES, PLOTS, EVENTS, HOUSES } from '../rules/data.js';
import { LORE, TRAITS, dn, lordName } from './lore.js';

// ---------------------------------------------------------------- helpers

function h32(s) { let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
const pick = (arr, ...keys) => arr[h32(keys.join(':')) % arr.length];
// Fill {name} placeholders. Unknown placeholders are left for the checker to catch.
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const listOf = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const seedOf = (state) => (state && (state.nameSeed ?? state.seed) != null ? (state.nameSeed ?? state.seed) : '');   // nameSeed is public; the true seed is not
const reachName = (id) => REACHES[id - 1]?.name || `Reach ${id}`;

export const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];
export const seasonOfYear = (season) => (Math.max(1, season) - 1) % 4;
export const floodDue = (season) => CONFIG.floodSeasons.includes(season);

// ---------------------------------------------------------------- Season banner

const OPENING = {
  first: [
    'The first spring of the contest. Eight old grudges and twelve Seasons to settle them.',
    'Spring, and the Houses unpack their banners at the river\'s edge. Nobody unpacks their patience.',
    'The ice is off the Sellen. Twelve Seasons from now, someone will own this river.',
  ],
  calm: [
    [ // spring
      'Spring. The ice leaves the Sellen in grey slabs, and the Houses send riders after it.',
      'Thaw on the river. Mud to the axles and ambition to match.',
      'Spring reaches the Delta a week before the Upper Sellen. Nobody waits for it.',
      'Lambs in the water-meadows, Envoys on the roads. Spring is for promises.',
    ],
    [ // summer
      'Summer. Dust on the towpaths and tempers as short as the shade.',
      'The rivers run slow and warm. Good weather for marching, and everyone has noticed.',
      'Long days at the forges and longer nights at court.',
      'Haymaking in the meadows, whetstones in the barracks. Summer serves both.',
    ],
    [ // autumn
      'Autumn. Carts full, purses fuller, and every steward lying about both.',
      'Leaves on the Sellen, barges low in the water. Harvest money buys a great deal of trouble.',
      'The geese leave over the Delta. The Houses stay and quarrel.',
      'Cider in the presses, smoke from the charcoal pits. The year turns toward its accounts.',
    ],
    [ // winter
      'Winter. Ice in the reeds, and the forges never cold.',
      'Snow on the towpaths. Armies move slowly; letters move fast.',
      'Short days. The Houses spend them at court, where it is warm and nobody is honest.',
      'Frost on the quays. The barges wait, and so does no one else.',
    ],
  ],
  flood: [
    [ // spring (Season 9)
      'Spring, and the melt is fat. The Flood comes at the end of this Season; every House is counting fields.',
      'Snowmelt fills the Sellen bank to bank. The Flood will settle the Reaches before summer.',
      'The ferrymen raise their prices. High water is coming, and the Flood\'s reckoning with it.',
      'Spring rain on top of spring melt. Stewards walk the boundary stones before the Flood moves them.',
    ],
    [ // summer (Season 6)
      'Summer storms in the hills. The Varra rises brown, and the Flood is due before the Season turns.',
      'Midsummer, with a Flood at the Season\'s end. Hold what you hold.',
      'Thunderheads over the Upper Sellen. The millers repaint the old flood-marks on their walls.',
      'Hot, heavy air. The marsh-folk say the Flood is close, and the marsh-folk are rarely wrong.',
    ],
    [ // autumn (Season 3)
      'Autumn rain swells both rivers. The Flood comes at the Season\'s end and counts every marker.',
      'The Sellen is up to the second step at Tollbridge. A Flood is due.',
      'Grey skies over the Delta. The Flood comes before winter, and it will remember who held the Reaches.',
      'Wet leaves, wet roads, rising water. The Flood is coming to take its tally.',
    ],
    [ // winter (Season 12)
      'The last winter. The final Flood comes at the end of this Season, and it decides Hollowmere.',
      'Black ice on the Sellen and the twelfth Season begun. After this Flood there is no next year.',
      'Winter\'s end, and the contest\'s. Every marker on the river will be counted one last time.',
      'The bells of Owlward Abbey ring for the final Season. When the water falls, someone holds Hollowmere.',
    ],
  ],
};

// One line for the banner at the start of a Season.
export function seasonOpening(state) {
  const s = state?.season || 1;
  const soy = seasonOfYear(s);
  const pool = s === 1 ? OPENING.first : floodDue(s) ? OPENING.flood[soy] : OPENING.calm[soy];
  return pick(pool, seedOf(state), 'open', s);
}

// ---------------------------------------------------------------- Events

const EVENT_LINES = {
  dry_autumn: [
    'The wells drop a hand\'s width a week, and the millers start rationing their own flour.',
    'Stubble cracks underfoot. Farmers stand at the field\'s edge and say nothing.',
    'The Sellen runs low enough to show last year\'s lost cartwheels.',
  ],
  spring_flood: [
    'Sedge Bend goes under knee-deep, and the eel-catchers smile for the first time in months.',
    'Black water stands in the low fields of Sedge Bend. Old men say it will pay double.',
    'Boats tie up where the road used to be. The reed beds at Sedgewater drink it all.',
  ],
  iron_winter: [
    'Frost splits the bellows leather at Blackforge. The smiths work in mittens and swear.',
    'The ore carts freeze into the ruts. Nobody digs iron out of ground like this.',
    'Ice on the forge ponds, ice in the quench barrels. The hammers go quiet.',
  ],
  coronation_feast: [
    'A crown changes heads somewhere upriver, and every House gets a cask and a purse to cheer it.',
    'Heralds ride the towpaths throwing coins. Nobody asks whose coronation; everybody eats.',
    'Roast pig on every quay. The first toast is to the Crown, and the rest are to anything at all.',
  ],
  harvest_moon: [
    'A fat orange moon over the stubble. The court notes who has the most fields to stand in.',
    'Reapers work by moonlight, and the Houses with wide lands make sure they are seen doing it.',
    'The moon is bright enough to read by. Stewards read the land rolls and send the court a list.',
  ],
  caravan_fire: [
    'Smoke on the river road. By noon the story has three different villains.',
    'A wagon train burns at a ford. What does not burn walks off in the wrong direction.',
    'A caravan goes up in the night. The poorest House swears it only helped with the buckets.',
  ],
  levy_of_the_crown: [
    'Crown sergeants arrive with a list and a drum. Thin garrisons find themselves less thin.',
    'The Crown wants the river guarded and does not care by whom. Small Houses get spears for nothing.',
    'Conscripts in borrowed boots march to whichever House is shortest of them.',
  ],
  market_glut: [
    'Too much of everything at Merchant\'s Quay. Prices fall through the planks.',
    'The rich Houses find their storehouses rotting faster than they can sell.',
    'The quays are stacked to the eaves. Factors tip what they cannot move into the river.',
  ],
  council_of_houses: [
    'The Houses meet under one long roof and argue about who sits nearest the fire.',
    'A Council at Mill Crossing. Half the talk is seating; the rest is favours owed.',
    'Stewards bring ledgers of who owes whom. The fattest ledger gets the best chair.',
  ],
  death_in_the_court: [
    'Bells at dawn from one of the great seats. Everyone counts the heirs before the prayers.',
    'A lord does not wake. The cooks are questioned first, as is customary.',
    'Black ribbons on a gatehouse. The river waits to see who walks out wearing the chain.',
  ],
  lean_winter: [
    'Snow early and deep. Houses with thin granaries sell their plate to buy bread.',
    'A hungry winter. Coin goes south for grain and does not come back.',
    'Empty granary doors bang in the wind. Stewards short of grain pay dearly for more.',
  ],
  blood_moon: [
    'The moon rises red. The fishermen stay home; the fish do not mind.',
    'A red moon over the Delta. Everyone expects something. Nothing comes.',
    'Priests preach doom all night. By morning the doom has not turned up.',
  ],
  // Expanded rules X7: Events that put a choice to one House
  refugees: ['Carts, cradles and a goat on a rope wait at the ford. Everyone is watching to see who opens a gate.', 'The drowned villages walk upriver with what they could carry.'],
  bishops_purse: ['The bishop says the silver is for the poor. He says it very quietly.', 'A purse is left on a council chair, with a note that is not quite a request.'],
  captain: ['He has forty spears, one good eye and no master. He is not fussy about which.', 'A captain rides in under a bare pole and asks who pays best.'],
  granary_rot: ['The lowest sacks smell of wet earth. The steward has not slept.', 'Black bloom in the granary. Burn it, or pray it stays small.'],
  drowned_abbey: ['The flood has torn open the abbey undercroft. Something gilt shines under the water.', 'Divers say there are books down there that have not been read in two hundred years.'],
  fair_challenge: ['A champion in borrowed armour names the proudest House before the whole fair.', 'The challenge is shouted twice, so nobody can pretend they missed it.'],
  reedmen: ['The fen-folk come in punts, hats in hand and knives in belts, to ask for a charter.', 'The Reedmen want their own court. They have brought eels as a gift.'],
  crown_envoy: ['A rider in the Crown\'s colours arrives, three weeks late and very sure of himself.', 'The Crown has remembered Hollowmere. That is rarely good news.'],
};

// What people see and say when an Event is drawn (the rules text is shown separately).
export function eventFlavour(eventId, state) {
  const pool = EVENT_LINES[eventId];
  if (!pool) return 'Something stirs on the river, and nobody agrees what it means.';
  return pick(pool, seedOf(state), 'event', state?.season ?? 0, eventId);
}

// ---------------------------------------------------------------- Floods

const FLOOD_OPEN = [
  [
    'The first Flood. Water over the low fields, and clerks on the high ground counting markers.',
    'The river rises and the Houses hold their breath. The first reckoning begins.',
    'Brown water to the hedgerows. The Flood names its first favourites.',
  ],
  [
    'The second Flood. The river has a memory now, and so do the Houses.',
    'Halfway. The water climbs the same marks as before and settles the same questions again.',
    'The Flood returns, colder than the last. Some Houses have grown since; some have only grown louder.',
  ],
  [
    'The third Flood. One more after this, and that one counts double.',
    'The river rises a third time. The leaders look over their shoulders; the rest look at the leaders.',
    'Third water. The old flood-marks vanish under new ones.',
  ],
  [
    'The last Flood. Every Reach, every marker, every promise kept or broken: all counted now.',
    'The twelfth Season ends in high water. When it falls, Hollowmere has a master.',
    'The final Flood comes up the Delta slowly, like a judge taking the stairs. Nobody speaks.',
    'Last water. The clerks sharpen their quills. The lords have nothing left to sharpen.',
  ],
];
const FLOOD_EMPTY = ['Not one Reach has a clear master.', 'The water finds no single banner to favour.'];
const FLOOD_CATASTROPHE = ['Ember Pressure breaks, and {house} pays for everyone\'s Rites.', 'The ember-wells burst, and {house} takes the burn.'];
const FLOOD_DEATH = ['Black ribbons go up at {seat}.', 'A lord of {house} does not see the water fall.'];

// Opening line for a Flood presentation. `result` is the engine's Flood record (state.floods[k]).
export function floodFlavour(state, result) {
  const s = result?.season ?? state?.season ?? 3;
  const k = Math.max(0, CONFIG.floodSeasons.indexOf(s));
  const final = s === CONFIG.seasons;
  const out = [pick(final ? FLOOD_OPEN[3] : FLOOD_OPEN[Math.min(k, 2)], seedOf(state), 'flood', s)];
  if (result?.reaches && result.reaches.every((r) => r.first == null)) out.push(pick(FLOOD_EMPTY, seedOf(state), 'fe', s));
  const cat = result?.catastrophe;
  if (cat && state?.houses?.[cat.h]) out.push(fill(pick(FLOOD_CATASTROPHE, seedOf(state), 'fc', s), { house: dn(state.houses[cat.h].name) }));
  const dead = result?.deaths?.[0];
  if (dead != null && state?.houses?.[dead]) {
    const name = state.houses[dead].name;
    out.push(fill(pick(FLOOD_DEATH, seedOf(state), 'fd', s), { house: dn(name), seat: LORE[name]?.seat || dn(name) }));
  }
  return out.join(' ');
}

const REACH_WON = {
  1: ['{house} holds the Upper Sellen. The hill fords fly its colours.', 'The high valley answers to {house} this year.'],
  2: ['The reed-cutters of Sedge Bend pay their dues to {house}.', '{house} holds Sedge Bend, eels and all.'],
  3: ['Every millwheel at the Crossing turns for {house} now.', '{house} takes Mill Crossing, and the millers raise their tolls in its name.'],
  4: ['The marsh-folk pole their punts to {house}\'s landings now.', '{house} holds the Varra Marsh, as far as anyone holds a marsh.'],
  5: ['{house} takes the Delta Mouth, and the salt quays count double for it.', 'The Delta goes to {house}. Every barge bound for the sea pays it twice.'],
};
const REACH_WON_ANY = ['{reach} falls to {house}.', '{house} carries {reach}.'];
const REACH_TIED = [
  '{reach} is split down the middle, and the Flood rewards no one.',
  'Too many banners on {reach}. Nobody takes it.',
  '{reach} is deadlocked. The locals keep their own counsel and their own taxes.',
];
const REACH_EMPTY = ['Nobody holds {reach}. The water has it to itself.', '{reach} stands empty and scores for no one.'];

// One line per Reach in the Flood presentation. winnerKey is the internal House id (e.g. 'Ash').
export function reachVerdict(reachId, winnerKey, tied = false, salt = '') {
  const reach = reachName(reachId);
  if (winnerKey) {
    const pool = [...(REACH_WON[reachId] || []), ...REACH_WON_ANY];
    return fill(pick(pool, 'rv', reachId, winnerKey, salt), { reach, house: dn(winnerKey) });
  }
  return fill(pick(tied ? REACH_TIED : REACH_EMPTY, 'rv', reachId, tied ? 't' : 'e', salt), { reach });
}

// ---------------------------------------------------------------- lords

export const SITUATIONS = ['envoy_offer', 'envoy_accept', 'envoy_refuse', 'pact_broken_victim', 'oathbreak', 'raided',
  'won_skirmish', 'lost_skirmish', 'dynasty', 'succession_true', 'succession_false', 'victory', 'defeat'];

const Q = {
  bold: {
    envoy_offer: ['Take my hand or stand in my road. I would rather the hand.', 'I offer peace once. Ask any ferryman how often I offer twice.'],
    envoy_accept: ['Done. Now point me at someone who is not you.', 'A Pact, then. My spears were bored of your borders anyway.'],
    envoy_refuse: ['Keep your paper. I settle borders on horseback.', 'Peace is for Houses that cannot win the other thing.'],
    pact_broken_victim: ['Good. I was tired of being polite. Saddle everything.', 'They broke it with one Raid. I will answer it with ten.'],
    oathbreak: ['The Pact was in my way. Now it is not.', 'Let the clerks weep over the ink. The ground is mine.'],
    raided: ['They came while I slept. They will not sleep again this side of the Flood.', 'Count their tracks. Then follow them home.'],
    won_skirmish: ['Tell the singers. Tell them twice, the second time louder.', 'That is how a border gets drawn.'],
    lost_skirmish: ['A bad crossing. Next time we swim the cold part.', 'Bury them well. Then sharpen everything that is left.'],
    dynasty: ['A line of my blood on the river. Let them try to cut it.', 'Sons and daughters enough to hold every ford. Good.'],
    succession_true: ['My mother held this seat with a sword. I am keeping the sword.', 'The old lord is ash. The banner still burns.'],
    succession_false: ['A false heir. Hang the midwife, then find me a regent with a spine.', 'Lies in the cradle. I hold the seat until the blood is sorted.'],
    victory: ['The river is mine. Somebody fetch more wine and fewer clerks.', 'Every ford, every bridge. I said so on the first day.'],
    defeat: ['We lost the river, not the war. There is always next spring.', 'Beaten. Write it small, and write my name smaller.'],
  },
  cautious: {
    envoy_offer: ['Neither of us wants the other\'s spears at the door. Let us agree on that.', 'A quiet border for two Seasons. I will pay the ferryman.'],
    envoy_accept: ['Agreed. My walls stay up all the same; do not take it personally.', 'Two quiet Seasons suit me. Keep to your side of the reeds.'],
    envoy_refuse: ['I do not sign what I have not read three times. Not this Season.', 'A fair offer. Your Legions are too close for me to trust it.'],
    pact_broken_victim: ['I expected it. That is why the walls went up first.', 'Note the day and the hour. We will be repaid, slowly.'],
    oathbreak: ['It was them or us by the next Flood. I chose us.', 'I regret it. I would regret losing the ford more.'],
    raided: ['Double the watch. Then double it again.', 'One Raid is bad luck. Two is a lesson. Build higher.'],
    won_skirmish: ['We held. Do not cheer yet; they will come back with more.', 'The wall did its work. Mend it before supper.'],
    lost_skirmish: ['I said it was too early to march. Fall back to the walls.', 'Losses we can count are losses we can recover.'],
    dynasty: ['An heir, a spare, and a spare for the spare. Now we are safe.', 'The line is secured. I may even sleep tonight.'],
    succession_true: ['I will change nothing for a year. Then I will change very little.', 'My father\'s stewards stay. So do his walls.'],
    succession_false: ['Lock the gates. The heir was false; the walls are not.', 'I hold this seat as regent and nothing more. For now.'],
    victory: ['We won by not losing. It is the only kind I trust.', 'Hollowmere is ours. Check the locks.'],
    defeat: ['We are still standing. Many are not. Remember that.', 'Not enough. But the granaries are full and the walls are whole.'],
  },
  covetous: {
    envoy_offer: ['A Pact costs less than a war. I have done the sums; so should you.', 'Peace is profitable. I would hate to see you miss a profit.'],
    envoy_accept: ['Accepted. The gift was light, but I will remember it as heavy.', 'Two Seasons of trade without arrows. Agreed, and gladly.'],
    envoy_refuse: ['What does your Pact pay me? Exactly. Good day.', 'Come back with a heavier purse and a lighter smile.'],
    pact_broken_victim: ['They owe me for the Pact, the Raid and the insult. With interest.', 'Write it in the ledger in red. Red ink costs extra; bill them.'],
    oathbreak: ['The Pact was worth less than the ford. Simple arithmetic.', 'I will pay the Renown. It was cheaper than the alternative.'],
    raided: ['Every sack they took, I will take back three.', 'They stole grain I had already sold. Now I am angry.'],
    won_skirmish: ['Strip the field. Their boots are better than ours.', 'A good fight. Better spoils.'],
    lost_skirmish: ['Expensive. Very expensive. Who approved that march?', 'We lost good men and a good wagon. The wagon hurts.'],
    dynasty: ['Heirs are an investment. This one should pay out for decades.', 'A Dynasty. Dear to found, cheaper than losing everything.'],
    succession_true: ['I have inherited the seat and the debts. Fetch the ledgers.', 'The old lord left everything to me. Good. Now count it.'],
    succession_false: ['A fraud in the cradle. Freeze the accounts until we know who owes what.', 'The heir was false. The coffers, thankfully, are real.'],
    victory: ['Every toll, every quay, every sack. Mine. I will need a bigger counting room.', 'Hollowmere is the best purchase my House ever made.'],
    defeat: ['A loss, but not a ruinous one. Mark it down and move on.', 'They won the river. I kept the receipts.'],
  },
  proud: {
    envoy_offer: ['I offer you a Pact. Few are offered one. Consider the honour.', 'Stand beside me and be seen there. It will improve you.'],
    envoy_accept: ['I accept, as a favour to you.', 'Very well. It is proper that you came to me first.'],
    envoy_refuse: ['You presume. My House does not sign beneath yours.', 'A Pact with you would be noticed. I would rather it were not.'],
    pact_broken_victim: ['They broke faith with me. The whole river will hear what that costs.', 'I gave them my word and they spat on it. They will kneel for this.'],
    oathbreak: ['A Pact with a lesser House was always beneath me.', 'Call it a broken oath. I call it correcting a mistake.'],
    raided: ['On my land? Under my banner? Find who led them.', 'An insult. I answer insults in person.'],
    won_skirmish: ['Of course we won. Did anyone wager otherwise?', 'Let them remember whose ground this is.'],
    lost_skirmish: ['Bad ground and worse luck. It says nothing about my House.', 'Not one word of this at supper.'],
    dynasty: ['The river will speak my name for a hundred years. As it should.', 'My line is founded. Others will be measured against it.'],
    succession_true: ['I am my father\'s blood, and better dressed.', 'The seat fits. I expected it would.'],
    succession_false: ['A false heir in my House. Burn the records; I will deny it.', 'I hold the seat as regent. Nobody laughs.'],
    victory: ['Hollowmere bows. I always knew the shape of the day.', 'Carve it over the gate: we were first.'],
    defeat: ['Second place is for patient Houses. I am not patient.', 'They won by a trick. History will correct the tally.'],
  },
  cunning: {
    envoy_offer: ['A Pact suits us both. I have read it twice; you should read it once.', 'Let us be friends in public. It costs nothing to look kind.'],
    envoy_accept: ['Agreed. Every clause, and the spaces between them.', 'Gladly. A friend\'s borders are the easiest to watch.'],
    envoy_refuse: ['A generous offer. Too generous. What are you hiding?', 'Not now. Ask me again when you need it more.'],
    pact_broken_victim: ['I wondered when. Now I know, and so does everyone else.', 'They broke the Pact. I will see they paid more for it than I did.'],
    oathbreak: ['The Pact was clear. The timing was not. I chose the timing.', 'Promises are tools. This one was worn out.'],
    raided: ['Let them take it. Now I know which road they use.', 'A Raid tells me more than a spy. Who led it?'],
    won_skirmish: ['They came exactly where I wanted them.', 'Tell no one how. Tell everyone that.'],
    lost_skirmish: ['A small loss to learn a large thing. Acceptable.', 'They were stronger than my letters said. Someone lied to me.'],
    dynasty: ['A Dynasty is a promise. The trick is choosing who keeps it.', 'More heirs, more doors. I like doors.'],
    succession_true: ['The old lord left me letters. I have read them all; nobody else has.', 'Nothing changes, says the herald. I will say otherwise later.'],
    succession_false: ['An Impostor. I suspected; now I can prove it.', 'The heir was paper. I am regent until we find someone real.'],
    victory: ['They all watched the river. I watched them.', 'Hollowmere is mine, and only three people know how.'],
    defeat: ['They won. Let them hold it a while. Holding is tiring.', 'A loss on the board. The letters go on.'],
  },
  pious: {
    envoy_offer: ['The river sends no omen against us. Let us keep the peace it allows.', 'Swear with me at the water\'s edge. Oaths made there are heard.'],
    envoy_accept: ['The heron crossed from left to right this morning. I accept.', 'Peace is a kind of prayer. I will say it with you.'],
    envoy_refuse: ['The omens are against it. I do not argue with omens.', 'The water was cloudy the day your Envoy came. No.'],
    pact_broken_victim: ['They swore at the water. The water will remember for me.', 'An oath broken under the Flood\'s eye. I need not curse them.'],
    oathbreak: ['The signs turned. A vow made under false signs binds no one.', 'I will do penance for it. After the Flood.'],
    raided: ['The river tests us. It will test them harder.', 'Pray for the fallen. Then post more guards.'],
    won_skirmish: ['The ford chose us. Give thanks, then give chase.', 'It was granted. Do not boast; it can be taken back.'],
    lost_skirmish: ['A punishment. I will find out for what.', 'We marched on an ill day. I said the gulls were wrong.'],
    dynasty: ['The line is blessed. Ring the bells at both abbeys.', 'Children are the river\'s answer to death. Now we have ours.'],
    succession_true: ['The water carried my mother off and carried me in. So it goes.', 'Rightful blood, rightful seat. The bells can stop now.'],
    succession_false: ['A false child, set before the shrine. Someone will answer for that.', 'The river exposed the lie. I hold the seat in trust.'],
    victory: ['The Flood has spoken, and it spoke our name.', 'Not my victory. The river\'s. I only stand in it.'],
    defeat: ['The river chose otherwise. I accept it. I need not like it.', 'We were weighed and found short. Fewer sins next year.'],
  },
  honourable: {
    envoy_offer: ['I offer a Pact and I will keep it. That is all the speech I have.', 'Two Seasons of peace, on my word. My word has held so far.'],
    envoy_accept: ['Agreed. I will keep it if it ruins me.', 'You have my word. Do not make me regret giving it.'],
    envoy_refuse: ['I cannot swear to what I might not keep. No.', 'Not while your Legions sit on my border. Move them and ask again.'],
    pact_broken_victim: ['I kept my word. Let the river remember which of us did not.', 'Broken. I will not break mine back, but I will defend myself.'],
    oathbreak: ['I broke my word. I will not pretend otherwise, and I will answer for it.', 'Shameful, and done. Pay the cost and do not speak of it.'],
    raided: ['Without a word of war first? Then we owe them nothing.', 'They struck without warning. We will warn them before we strike back.'],
    won_skirmish: ['Return their dead with honour. Keep the field.', 'They fought well. We fought better. Leave it there.'],
    lost_skirmish: ['A fair fight, fairly lost. Bind the wounded.', 'Ask for our dead back. They will give them; it is proper.'],
    dynasty: ['A Dynasty is a promise to the future. I mean to keep it.', 'My heirs will inherit my word before my land.'],
    succession_true: ['I take my father\'s seat and his debts of honour, all of them.', 'Every oath he made, I make again.'],
    succession_false: ['The child was false, and the fault ours for not asking. I will hold the seat.', 'I am regent, not lord. I will tell every Envoy so.'],
    victory: ['We won without breaking a word. Remember that before the rest.', 'Hollowmere is ours, and honestly come by.'],
    defeat: ['Beaten fairly. I will shake their hand, once.', 'We lost, and lied to nobody. There are worse ways to lose.'],
  },
  treacherous: {
    envoy_offer: ['Friends, then. Friends are so much easier to reach.', 'Swear with me. I will mean every word of it. Today.'],
    envoy_accept: ['Of course. I have never broken a Pact that did not need breaking.', 'Agreed, warmly. Have your Envoy stay for supper.'],
    envoy_refuse: ['Your Pact would tie my hands. I like my hands free.', 'No. I would only have to break it later, and that is tiring.'],
    pact_broken_victim: ['Beaten to it. Well. That will not happen twice.', 'They broke it first? Then I am the honest one. How strange.'],
    oathbreak: ['It held as long as it was worth holding.', 'I kept that Pact faithfully, right up until this morning.'],
    raided: ['Remember the face of whoever led that. Smile at him later.', 'I will send them gifts. Then I will send something else.'],
    won_skirmish: ['They trusted the ford. Never trust the ford.', 'A clean win, and nobody saw the second column.'],
    lost_skirmish: ['Somebody sold my plans. I would like to know for how much.', 'Fall back, and tell them we sue for peace. We do not.'],
    dynasty: ['Heirs everywhere. Let them try to poison all of them.', 'A Dynasty. Now the knives have to wait their turn.'],
    succession_true: ['My mother died very suddenly. These things happen.', 'The seat was always going to be mine. I made sure of it.'],
    succession_false: ['False blood? Shocking. I take the regency, reluctantly.', 'I said that child had the wrong chin. The seat is mine to mind now.'],
    victory: ['Everyone I betrayed is congratulating me. That is how you know.', 'Hollowmere is mine. I keep things until they cost me. This never will.'],
    defeat: ['I should have broken one more promise.', 'They won. I will be their dearest friend by spring.'],
  },
};
export const LORD_QUOTES = Q;

// Something a lord says. `house` is a state house ({ name, lord: { given, epithet, trait } }).
// `salt` varies the line between two quotes in the same moment (e.g. an fx sequence number).
export function lordQuote(house, situation, state, salt = '') {
  const trait = Q[house?.lord?.trait] ? house.lord.trait : 'cautious';
  const pool = Q[trait][situation];
  if (!pool) return 'The lord says nothing, which says enough.';
  return pick(pool, seedOf(state), state?.seq ?? state?.season ?? 0, house?.name, house?.lord?.given, situation, salt);
}

// Which lord speaks, and in what situation, for an engine fx event. Returns [] when nobody speaks.
// Lets the UI put a quote beside a toast without knowing the mapping.
export function quotesForFx(state, e) {
  const out = [];
  const say = (h, situation) => { const house = state.houses[h]; if (house) out.push({ h, situation, speaker: lordName(house), text: lordQuote(house, situation, state, `${e.n ?? ''}:${h}`) }); };
  switch (e?.t) {
    case 'pact': say(e.h, 'envoy_offer'); say(e.with, 'envoy_accept'); break;
    case 'refused': say(e.by, 'envoy_refuse'); break;
    case 'oathbreak': say(e.h, 'oathbreak'); say(e.victim, 'pact_broken_victim'); break;
    case 'raid':
      if (e.target == null) break;
      if (!e.defended) { if (e.won) say(e.target, 'raided'); }
      else if (e.won) { say(e.h, 'won_skirmish'); say(e.target, 'raided'); }
      else { say(e.h, 'lost_skirmish'); say(e.target, 'won_skirmish'); }
      break;
    case 'dynasty': say(e.h, 'dynasty'); break;
    case 'succession': say(e.h, e.result === 'G' ? 'succession_true' : 'succession_false'); break;
    case 'over': for (const h of state.houses) say(h.i, (e.winners || []).includes(h.i) ? 'victory' : 'defeat'); break;
    default: break;
  }
  return out;
}

// ---------------------------------------------------------------- Plots

const PLOT_LORE = {
  1: 'The first wheat on the Upper Sellen ripens here, on slopes too steep for carts. It all comes down by sledge and by swearing.',
  2: 'Oaks older than any House, felled one at a time with a priest watching. The rule is a sapling for every trunk, and it is mostly kept.',
  3: 'A bare hill with a library cut into it, cold enough to keep vellum for centuries. The monks charge by the candle.',
  4: 'Black soil the Sellen left behind after some forgotten flood. It grows wheat so well that four Houses have bled for it.',
  5: 'A stone bridge over the Sellen with a toll at each end and a dispute in the middle. Whoever holds it collects twice.',
  6: 'Reed to the horizon, cut in summer and sold by the bundle. The cutters walk on stilts and know every channel.',
  7: 'Bog iron is dug from the edges of Sedge Bend and smelted where it lies. On a clear day the smoke can be seen from Tollbridge.',
  8: 'A heap of grey boulders the river forgot to carry off. Quarrymen take a stone and leave a coin, for luck.',
  9: 'A red moor where the streams run the colour of old rust. Its iron is easy to dig and hard to keep.',
  10: 'The grindstones of half the valley were cut here, and the quarry floor still shows the round scars.',
  11: 'A small abbey that keeps the river\'s oldest records and lends them to nobody. Owls nest in the bell tower; the monks count them as staff.',
  12: 'Water-meadows at Mill Crossing, mown twice a year. The Sellen drowns them each spring and they repay it in hay.',
  13: 'A walled island in the Varra Marsh, reached only by punt. Its garrison has not paid for fish in a century.',
  14: 'A still lake off the Varra with a market on its shore. Coin moves faster here than the water ever has.',
  15: 'The Varra runs shallow here over a bed of river stones. Every army on the river has crossed it, and some have stayed.',
  16: 'Alder and willow standing in water. The timber is soft, but every barge on the Varra is built from it.',
  17: 'A tower half sunk in the marsh. Its bell rings when the water rises, and its scholars read by that warning.',
  18: 'A sand spit at the Delta where the tide uncovers black iron sand. It is gathered at low water and fought over at high.',
  19: 'Wharves where the Sellen and the Varra reach the sea. Everything sold upriver is sold here again, at a markup.',
  20: 'Reed islands without end where the rivers meet the sea. The herons outnumber the people and are better organised.',
};
export function plotLore(plotId) {
  return PLOT_LORE[plotId] || `${PLOTS[plotId - 1]?.name || 'This Plot'} keeps its own counsel.`;
}

// ---------------------------------------------------------------- rumours

const TAVERNS = ['the Three Eels', 'the Leaky Punt', 'the Miller\'s Thumb', 'the Bent Oar', 'the Salt Lamb', 'the Drowned Bell', 'the Heron and Hook'];
const REGARD_WORD = (r) => (r <= -3 ? 'Hostile' : r <= -1 ? 'Wary' : r < 1 ? 'Neutral' : r < 3 ? 'Cordial' : 'Friendly');
export { REGARD_WORD as regardWord };

// Rumour templates. Each returns a line, or null when it does not apply. Only public facts.
const RUMOURS = [
  (c) => (c.leader && c.leader.renown > 0 ? `${c.n(c.leader)} is ahead, and buying drinks for anyone who says so twice.` : null),
  (c) => (c.leader && c.second && c.leader.renown - c.second.renown <= 2 && c.leader.renown > 0 ? `Nobody will bet between ${c.n(c.leader)} and ${c.n(c.second)}. The bookmaker has gone fishing.` : null),
  (c) => (c.last && c.leader && c.leader.renown - c.last.renown >= 6 ? `They say ${c.n(c.last)} sold its good tapestries. Nobody is betting on ${c.n(c.last)}.` : null),
  (c) => { const d = c.rivals.filter((h) => h.dynasty); return d.length ? `${c.n(d[0])} has a Dynasty now. The midwives at ${c.seat(d[0])} are already counting heads.` : null; },
  (c) => (c.season >= 4 && !c.all.some((h) => h.dynasty) ? 'No House has dared found a Dynasty yet. The marriage brokers are drinking on credit.' : null),
  (c) => { const p = c.pacts[0]; return p ? `${c.n(p[0])} and ${c.n(p[1])} drank from the same cup last week. Count the spoons before they leave.` : null; },
  (c) => { const o = c.all.filter((h) => h.oaths > 0).sort((a, b) => b.oaths - a.oaths)[0]; return o ? `${o.i === c.v ? 'Your House' : c.n(o)} broke a Pact${o.oaths > 1 ? ' more than once' : ''}. The ferrymen spit when they say the name.` : null; },
  (c) => (c.pressure >= CONFIG.pressureThreshold - 1 ? 'The ember-wells are warm to the touch. Somebody has cast one Rite too many.' : null),
  (c) => (c.pressure === 0 && c.season > 2 ? 'The ember-wells are cold. The abbots call it a good omen; the abbots call most things that.' : null),
  (c) => { const h = c.rivals.filter((x) => (x.regard?.[c.v] ?? 0) <= -3)[0]; return h ? `${c.n(h)}'s men curse your banner in every alehouse on the Sellen. Watch your borders.` : null; },
  (c) => { const h = c.rivals.filter((x) => (x.regard?.[c.v] ?? 0) >= 3)[0]; return h ? `${c.lord(h)} of ${c.n(h)} toasted your health at supper. Meant it, too, by the look of the cup.` : null; },
  (c) => { const r = c.all.filter((h) => h.i !== c.v && (h.stats?.raids || 0) >= 3).sort((a, b) => b.stats.raids - a.stats.raids)[0]; return r ? `${c.n(r)}'s Legions are always on the road. The innkeepers along it have started charging in advance.` : null; },
  (c) => { const l = c.rivals.find((h) => h.heirsLost > 0); return l ? `They still laugh about the false heir of ${c.n(l)}. Not in ${c.seat(l)}, mind.` : null; },
  (c) => { const s = c.rivals.find((h) => HOUSES[h.name]?.cabal && h.cabalExposed); return s ? `${c.n(s)}'s hidden agents were dragged into daylight. The Shuttered House has new locks.` : null; },
  (c) => { const h = c.rivals[c.k % c.rivals.length]; return h && TRAITS[h.lord?.trait] ? `${c.lord(h)} of ${c.n(h)}? ${cap(TRAITS[h.lord.trait].text)}, or so the stable boys say.` : null; },
  (c) => { const next = CONFIG.floodSeasons.find((s) => s >= c.season); return next ? (next === c.season ? 'The flood-marks are wet already. The Flood comes this Season.' : `The old women give it ${next - c.season} Season${next - c.season > 1 ? 's' : ''} till the Flood. The old women are usually right.`) : null; },
  (c) => (c.me && c.leader && c.me.i === c.leader.i && c.me.renown > 0 ? 'Every House on the river is talking about yours. That is rarely good news.' : null),
  () => 'A barge sank at Cobble Ford. Three Houses claim the cargo; none will say what it was.',
  () => 'The eels are running thick this year. Nobody knows what that means, but everyone has an opinion.',
];

// A tavern rumour for the player at seat `viewerIndex`, from public information only.
export function rumour(state, viewerIndex = 0) {
  const all = state.houses;
  const ranked = all.slice().sort((a, b) => b.renown - a.renown || a.i - b.i);
  const sole = ranked.length > 1 && ranked[0].renown > ranked[1].renown;
  const pacts = [];
  for (const h of all) for (const p of h.pacts || []) if (h.i < p.with) pacts.push([h, all[p.with]]);
  const c = {
    v: viewerIndex, me: all[viewerIndex], all, rivals: all.filter((h) => h.i !== viewerIndex),
    leader: sole ? ranked[0] : null, second: ranked[1] || null, last: ranked.length > 1 && ranked.at(-1).renown < ranked.at(-2).renown ? ranked.at(-1) : null,
    pacts, pressure: state.pressure || 0, season: state.season || 1,
    k: h32(`${seedOf(state)}:rk:${state.season}`),
    n: (h) => dn(h.name), lord: (h) => lordName(h), seat: (h) => LORE[h.name]?.seat || dn(h.name),
  };
  const lines = RUMOURS.map((f) => f(c)).filter(Boolean);
  const key = `${seedOf(state)}:rumour:${state.season}:${viewerIndex}`;
  const line = lines[h32(key) % lines.length];
  return `At ${pick(TAVERNS, key, 'tavern')}: ${line}`;
}

// ---------------------------------------------------------------- epilogue

// A 3-5 sentence ending for the results screen.
export function epilogue(state, winnerIndexes = state.winner || []) {
  const H = state.houses; const seed = seedOf(state);
  const st = (state.final?.standings || H.map((h) => ({ i: h.i, renown: h.renown }))).slice().sort((a, b) => b.renown - a.renown);
  const wins = winnerIndexes.length ? winnerIndexes : [st[0].i];
  const W = H[wins[0]]; const top = W.renown;
  const v = { house: dn(W.name), lord: lordName(W), seat: LORE[W.name]?.seat || dn(W.name), words: LORE[W.name]?.words || '', n: top };
  const out = [];
  if (wins.length > 1) {
    v.list = listOf(wins.map((i) => dn(H[i].name)));
    out.push(fill(pick([
      '{list} share Hollowmere at {n} Renown, an arrangement no lord among them enjoys.',
      'The river is split between {list}, {n} Renown apiece. The lawyers will be busy for a generation.',
    ], seed, 'ep1s'), v));
  } else {
    out.push(fill(pick([
      '{house} takes Hollowmere with {n} Renown, and {lord} rides down from {seat} to take the river\'s oath.',
      'When the last Flood drains, {house} holds Hollowmere with {n} Renown, and {lord} holds {house}.',
      '{n} Renown, and the river, for {house}. {lord} has the words "{words}" cut over the Tollbridge gate.',
    ], seed, 'ep1'), v));
  }
  const rest = st.filter((x) => !wins.includes(x.i));
  if (rest.length) {
    const r = H[rest[0].i]; const gap = top - r.renown;
    const rv = { house: dn(r.name), gap, last: dn(H[rest.at(-1).i].name), lastn: H[rest.at(-1).i].renown };
    if (gap === 0) out.push(fill('{house} finished level on Renown and lost on the count, which it calls a clerk\'s victory.', rv));
    else if (gap <= 2) out.push(fill('{house} finished {gap} short, and will mention it at every feast for twenty years.', rv));
    else if (gap >= 8) out.push(fill('Nobody came close; {house}, the nearest, trailed by {gap}.', rv));
    else out.push(fill(rest.length > 1 && rest.at(-1).i !== rest[0].i ? '{house} came second, {gap} behind, and {last} brought up the rear with {lastn}.' : '{house} came second, {gap} behind.', rv));
  }
  const extra = [];
  const oaths = H.filter((h) => h.oaths > 0).sort((a, b) => b.oaths - a.oaths);
  if (oaths.length) {
    const o = oaths[0];
    extra.push(wins.includes(o.i)
      ? `${dn(o.name)} broke ${o.oaths > 1 ? `${o.oaths} oaths` : 'an oath'} on the way to the top, and the river will remember that longer than the score.`
      : `${dn(o.name)} broke ${o.oaths > 1 ? `${o.oaths} oaths` : 'an oath'}, and has the reputation to show for it.`);
  } else if (state.rules === 'expanded') extra.push('In twelve Seasons not one Pact was broken, which nobody downriver will believe.');
  const lost = H.filter((h) => h.heirsLost > 0); const crowned = H.filter((h) => h.heirsCrowned > 0);
  if (lost.length) extra.push(`The false heir${lost.length > 1 ? 's' : ''} of ${listOf(lost.map((h) => dn(h.name)))} will be a tavern joke for years.`);
  else if (crowned.length) extra.push(`${listOf(crowned.map((h) => dn(h.name)))} buried a lord and crowned a true heir, and the line held.`);
  const reachWins = H.map(() => 0);
  for (const f of state.floods || []) for (const r of f.reaches || []) if (r.first != null) reachWins[r.first]++;
  const best = Math.max(0, ...reachWins);
  if (best > 0) {
    const tops = H.filter((h) => reachWins[h.i] === best);
    if (tops.length === 1) {
      const t = tops[0];
      extra.push(wins.includes(t.i)
        ? `Across ${state.floods.length} Floods ${dn(t.name)} carried ${best} Reaches, more than any other House.`
        : `${dn(t.name)} carried ${best} Reaches under the Floods, more than anyone, and still came up short.`);
    }
  }
  out.push(...extra.slice(0, 2));
  if (wins.length === 1 && v.words && !out[0].includes(v.words)) out.push(`"${v.words}," as they say at ${v.seat}, and this time it was true.`);
  return out.slice(0, 5).join(' ');
}
