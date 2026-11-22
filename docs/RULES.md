# Hollowmere: digital rules and source decisions

The original repository was lost. This build reconstructs the game from the ten files in
`docs/source/` (preserved unchanged). The engine (`src/rules/`) is authoritative; every number
it uses is in `src/rules/data.js` and checked by `tests/engine.test.mjs`.

## Order of authority

1. `config.py` (SimConfig defaults, rule v6.1): the last tested engine values.
2. `HOW_TO_PLAY.md`, `reference.html`, `cards.html`: generated from, or tested against, the engine
   (`test_rules_doc.py`, `build_printables.py`).
3. `SYSTEMS_DESIGN.md` decisions D1-D12 and Phase 6.8 revisions.
4. `SYSTEMS_DESIGN.md` Phases 1-5: the original design, superseded wherever 1-3 disagree. Its own
   header says `docs/BALANCE_LOG.md` and `docs/MODEL_SCOPE.md` win; **neither file survived** and the
   new repository was empty, so nothing could be recovered from Git history.

Missing modules referenced by the bundle (`hollowmere_sim` package, `build_index.py`, `graphics.py`,
`insights.py`, `docs/EVENTS.md`, `docs/RITES.md`, `docs/INVESTIGATION.md`, `docs/ANALYSIS.md`) were
not invented. Where their content is needed, the decision below says what was used instead.

## The rules as built

A Season is Harvest, three rounds of Actions in seat order, one Event, a Flood in Seasons 3, 6, 9
and 12, then a short Life summary (presentation only; see R1). Costs, scoring and House abilities
are exactly those in `HOW_TO_PLAY.md` and the reference sheet, with the decisions below.

## Decisions on incomplete or conflicting rules

| # | Topic | Sources disagree / are silent | Decision |
|---|---|---|---|
| R1 | Characters, Court, ages, Life phase, Death Checks on 2d6 | SYSTEMS_DESIGN 1.6 describes them; config.py replaces them with "Heirs and succession (stand-in for Characters and Death Checks; see docs/MODEL_SCOPE.md)": a Dynasty holder dies on 1 in 4 at each Flood. No Character cards exist. | Current rules: 25% death check per Dynasty holder per Flood. No Character cards invented. The Life phase is a presentation of deaths and successions after each Flood. Confirmed with the designer before building. |
| R2 | Ash Muster cost | HOW_TO_PLAY: "2 Iron, 1 Grain (Maelor 3 Iron)"; reference sheet: "(Ash 2 Iron; Maelor 3 Iron)" and "cheap musters"; v2 table: Ash Muster 2 Iron. | Ash musters for 2 Iron and no Grain. |
| R3 | Ash Raid cost | Phase 3: 0 Iron; v2: 1 Iron; HOW_TO_PLAY: 1 Iron for all. | 1 Iron for every House. |
| R4 | Opening Coffers | v2 lowered Verrin to G2 T1 S1; the reference sheet (later, generated from code) shows G3 T2 S2. | Reference sheet values for all eight Houses. |
| R5 | Thorne's private Heir test and "second Heir draw on marriage" | Named on the reference sheet; no cost or timing anywhere. | New Action **Vigil** (Thorne only): 1 Coin, once a Season. Thorne learns its Heir. If it is an Impostor and Thorne has not yet married, it is set aside and a new Heir is drawn face down (one marriage per game). |
| R6 | Who knows a House's own Heir | "Do not look at the others"; Reveal needs "a Genuine Heir you know about". | A House does not know its own Heir until a Vigil, a Seal on it, Ink of Names or succession shows it. A Seal that finds a Genuine Heir tells the tester and the owner privately. |
| R7 | Investigation deck (INVESTIGATION.md missing) | Effects of Testimony/Document/Witness are in HOW_TO_PLAY; "Raven's deck is Seal-heavy" (D9). | Each House has its own 12-card deck, reshuffled when empty. Common: 4 Testimony, 4 Document, 4 Witness. Raven: 5 Seal, 2 Testimony, 2 Document, 3 Witness. Only Raven can use Seals. A Witness against Sable also exposes its Cabal (Phase 3). |
| R8 | Impostor exposed by Seal or Ink of Names | Succession discards an Impostor and draws a replacement (1.8). | The same for any exposure: discard, draw the next Heir face down. |
| R9 | Rite costs and Schools | 6.8.3 "2 Lore, 2 Coin or 2 Reed" was a stand-in; cards.html prints real costs. School discounts (1.7) appear on no card. | Printed card costs. Caddoc may pay Reed for any Lore. No School discount. |
| R10 | Catastrophe effect and target | 1.7.1 mentions a six-card Catastrophe deck (not supplied); HOW_TO_PLAY: the heaviest caster "loses a marker". Tie rule only in 5.7. | The House with most Rites this Season loses one marker (its lowest-yield Plot). Ties: most Rites since the last reset, then most Renown (5.7), then seat. Pressure resets to 0. |
| R11 | Seats for 2 and 3 players | Four seats A-D; no rule for fewer players. | 2 players: seats A and C. 3 players: A, B, C. Houses dealt to seats at random. |
| R12 | Second place when first is tied | "If there is a tie, nobody takes first." Second place undefined. | No first means no second. Second place also needs a sole holder. |
| R13 | Legions on a Plot whose last marker is lost | Legions are "stationed on a Plot you hold". | They disband. |
| R14 | Raid target and defenders on shared Plots | A Plot can hold several Houses' markers. | The raider names one rival with markers there; only that House's Legions defend; Accords are checked against that House. |
| R15 | Accords | Wren forms up to two at Harvest with "the Houses that border it most" (D7). Breaking Accords and Council votes (1.3) are not in current rules. | AI Wren uses the border rule; a human Wren chooses up to two partners each Harvest. Accords are free (D10). No Accord breaking, no Council votes: the Council of Houses Event is the only Council. |
| R16 | Cabal placement | "next to your markers" (HOW_TO_PLAY) / "any Plot" (Phase 3). | On or next to a Plot Sable holds, one token per Plot. Tokens produce like a marker, never count for Reach control, and score only Sable's Season 12 majority bonus. |
| R17 | Thorne's opening marker | "Thorne starts with one marker." | On the seat Plot with the better dice number. |
| R18 | Renown below zero | Not stated. | Allowed (an early Impostor succession can show negative Renown). |
| R19 | Game end at 40 Renown, Favor to Renown at 3:1, Objectives, Raider, Joint Projects, Trade Pacts | Phase 1 and 2 only; absent from the current rules and engine config. | Not used. Game ends after Season 12. |
| R20 | Events with "next Harvest" | Halved production rounding not stated. | Rounded down, per Plot. Events are drawn at random each Season (`event_draw = 'random'`). |
| R21 | Investigate when Raven draws | Phase 3 "draws 3 keeps 2" vs D6 "draws one". | One card (D6). |
| R22 | Sable's secret Renown, Seal +1 Lore for Sable, Ash production -1, Caddoc halved Keeps | Phase 3 only; dropped by later versions. | Not used. |

| R23 | A Genuine Heir that takes the Dynasty | Not stated whether a new Heir follows. Without one the same Heir could "succeed" at every death. | The crowned Heir becomes the holder; a new Heir is drawn face down from the pile. The crowned Genuine still scores its 4 at the end (once per House). |
| R24 | Caddoc's halved Pressure | Phase 3: "halved (rounded down)"; reference sheet: "Halved Pressure"; cards already print a half flame. | Exact halves on the Pressure track (a 1-flame Rite adds 0.5). |
| R25 | Defenders "lose half" after a failed Raid | Rounding not stated. | Rounded down (a lone defender survives). |
| R26 | Raider's Legions already on the target Plot | "add their Legions on the Plot". | They fight too (still at most 3 counted). Only the moved Legions are halved on a win. |
| R27 | Maelor's Muster | "2 Iron, 1 Grain (Maelor 3 Iron)". | 3 Iron and 1 Grain: the parenthesis changes only the Iron. |
| R28 | Capturing on a Plot where the captor already has a Keep | Keeps are capped at two markers. | The rival loses its marker; the captor gains none. Each victim keeps its own Recapture right on a shared Plot. |

An independent review (a separate agent reading only the sources and the code) found and confirmed
the issues behind R23 and R26-R28, plus four information leaks (the AI could simulate its own
hidden Heir and deck order; the viewer state exposed private Seal results, draws and the Cabal).
All are fixed and covered by regression tests. A second review (fuzzing 6,000 random games, 659,000 steps, plus browser checks) found that the viewer state exposed the game seed (from which hidden piles can be rebuilt) and that a Vigil's marriage was announced publicly; the seed is now withheld, Heir names come from a public name seed, and a Vigil reveals nothing to rivals. It also found interface faults (Esc on a must-answer dialog, rotating a tablet, abandoning a game, stale clicks), all fixed and checked in the browser.

## House names

Players see new names; the rules keep the source ids so the documents and tests stay traceable
(`src/content/lore.js` holds each House's seat, words, history and the given names of its lords).

| Source id | Shown as | Seat |
|---|---|---|
| Ash | Emberlain | Cinderholt |
| Verrin | Aldermoor | Sheafhall |
| Maelor | Tessaly | the Countinghouse |
| Thorne | Rosenvael | Briarkeep |
| Wren | Bramwell | the Hearthmoot |
| Sable | Veylin | the Shuttered House |
| Caddoc | Scrivane | Inkwell Abbey |
| Raven | Ostrander | Watchfall |

## Expanded rules (optional, chosen at setup; not in the source design)

The source game leaves a House passing about 15 of its 36 Actions (measured with the AI). The
Expanded rules add choices, politics and character. They are off in the engine by default
(`newGame({ rules: 'original' })`); the app offers them on by default, with the original rules one
switch away. Nothing in the original rules changes when they are off.

| # | Addition | Rule |
|---|---|---|
| X1 | Toil | Free, once a Season: gain 1 resource of a kind your Plots produce. A House with two Plots or fewer may take any resource (Verrin still no Lore). |
| X2 | Lords and traits | Every House is ruled by a named lord with one of eight traits (bold, cautious, covetous, proud, cunning, pious, honourable, treacherous). Traits change how the AI plays and how it answers Envoys. When a Dynasty holder dies, a Genuine Heir becomes the new lord; after an Impostor a regent takes the seat. Lords exist in both rule sets (story); only their effect on Pacts is Expanded. |
| X3 | Fortify | 1 Stone, 1 Timber: wall a Plot you hold (one wall per Plot). Its defenders add 1 in a Skirmish, and a Raid on an empty walled Plot is still a Skirmish. Walls fall with the House's last marker there. |
| X4 | Envoy and Pacts | 1 Coin, once a Season: offer a rival a Pact, optionally with a gift of one resource (two Coin needed to gift Coin). If accepted, neither may Raid the other or target the other with Heron Cry or Ashen Pyre until the end of next Season. AI Houses decide by a public, deterministic rule (regard, fear of the proposer's Legions, a runaway leader, past oathbreaking, the lord's trait). A human answers in a dialog. |
| X5 | Oathbreaking and regard | Raiding a Pact partner or striking it with a Rite breaks the Pact: the oathbreaker loses 1 Renown and 2 Favor; the betrayed House's regard falls by 4 and everyone else's by 2. Regard (-5 to +5) also moves with Raids, captures, thefts, Seals, refusals, Accords and kept Pacts, and is shown to the player as Hostile, Wary, Neutral, Cordial or Friendly. Wren's Accords are unchanged and still cannot be broken. |
| X6 | Rosenvael's courtiers | Thorne, the weakest House in every simulation (as the source design itself notes), sends Envoys for free and up to twice a Season. |
| X7 | Event choices | Eight extra Event cards join the twelve (drawn at random from all twenty). Each puts a choice between two outcomes to one House, named on the card (the most markers in Reach II, the most Favor, the fewest Legions, the most Grain, the least Lore, the most Renown, the most markers on Reed Plots, the least Renown; ties at random). A choice that cannot be paid is unavailable. AI lords choose by a public value rule coloured by their trait. Cards: Refugees at the Ford, The Bishop's Purse, A Captain Without a Banner, Rot in the Granaries, The Drowned Abbey, A Challenge at the Fair, The Reedmen's Charter, Envoy of the Crown (texts in `src/rules/data.js`, `DILEMMAS`). |
| X8 | Betrothal | Action: offer your Heir in marriage to a House you have a Pact with, paying a 2-Coin dowry to it if accepted (Rosenvael, the oldest blood, pays none). One match per House for the game. If accepted, the Pact lasts the rest of the game, both Houses gain 1 Renown, and each learns whether the other's Heir (at that moment) is Genuine; a later new Heir is unknown again. When a betrothed House's Genuine Heir succeeds, it gains 1 more Renown. Breaking faith with kin (Raiding them or striking them with a Rite) dissolves the match and costs 2 Renown, 3 Favor and half again the usual loss of regard. AI Houses accept by the Pact rule plus a dowry bonus, and refuse while hiding an Impostor they know of. Not to be confused with Rosenvael's Vigil, which can replace an Impostor 'by marriage' privately (source rule). |
| X9 | Balance | From simulation, to narrow the spread of win rates: Emberlain's +1 and Ostrander's −1 Skirmish modifiers count only when that House attacks; Briarkeep (Rosenvael's seat) starts the game walled; Rosenvael may Muster from Season 2 (not 3); a proven Genuine Rosenvael Heir scores 6 at the end (not 4); and a Betrothal is worth 2 Renown to Rosenvael (1 to everyone else). |

Measured over 240 AI games each (`node tools/sim.mjs 240 4 5 <rules>`), passes fall from 14.8 to
0.4 per House per game, Raids rise from 4.6 to about 10, and a game sees about ten Pacts and one
broken oath in every three games.

With X7 and X8 (`node tools/sim.mjs 300 4 7 expanded`), a game sees about 4.5 Event choices and
1.5 Betrothals; about one game in thirteen has a House betray its kin by marriage. Win rates after
X7/X8: Emberlain 42%, Tessaly 30%, Aldermoor 27%, Bramwell 26%, Scrivane 25%, Veylin 24%,
Ostrander 14%, Rosenvael 11% (up from 7%; its free dowry and succession bonus help).

## Known balance status

After X9 (Expanded rules, two runs of 240 four-player games, seeds 11 and 13; one run's spread is
about ±4 points): Emberlain 32–38%, Veylin 27–32%, Bramwell 24–29%, Scrivane 22–28%, Aldermoor
18–25%, Tessaly 22–24%, Ostrander about 20%, Rosenvael 17–22%. Before X9 the spread was 7–42%.
Emberlain stays the strongest; the setup screen marks it as a good first House and Rosenvael as
challenging. The table below is the earlier measurement, kept for the original rules.

`tools/sim.mjs` plays AI against AI (four players, 240 games). The rebuilt AI plans two Actions
ahead within a Season, scores itself against the strongest rival, reads threats (walls, Pacts,
grudges) and plays its lord's trait; it beats the first version of itself 62% to 38%.

| House | Original rules | Expanded rules |
|---|---|---|
| Ash / Emberlain | 36% | 41% |
| Verrin / Aldermoor | 22% | 29% |
| Maelor / Tessaly | 31% | 23% |
| Thorne / Rosenvael | 11% | 7% |
| Wren / Bramwell | 24% | 28% |
| Sable / Veylin | 20% | 19% |
| Caddoc / Scrivane | 31% | 30% |
| Raven / Ostrander | 27% | 25% |

(Even share is 25%.) Thorne remains the weakest House, matching the design's open item (6.8.5);
the setup screen marks it as Challenging. Ash's +1 Skirmish is worth more once Raids are common.
