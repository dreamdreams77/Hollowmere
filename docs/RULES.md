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
All are fixed and covered by regression tests.

## Known balance status

`tools/sim.mjs` plays AI against AI. The design's own last measured results put every House inside
20-30% under its scripted policies. The rebuilt AI is a different player: it is weighted per
House, so its win rates measure the AI as much as the rules. Thorne remains the weakest House,
matching the design's open item (6.8.5).
