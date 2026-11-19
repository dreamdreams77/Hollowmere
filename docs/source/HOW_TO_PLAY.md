# How to play Hollowmere

Two to four players. A game is twelve Seasons. Each player is a House fighting for **Renown**; the House with the most Renown when Season 12 ends wins. This is the short version. The full reasoning behind every rule is in [SYSTEMS_DESIGN.md](SYSTEMS_DESIGN.md).

You can play it now in a terminal: `PYTHONPATH=src python -m hollowmere_sim.play`.

## The board

Twenty **Plots** in five **Reaches** (rows of four). Each Plot has a resource, a dice number from 2 to 12 (never 7), and touches its neighbours in its row and the Plot directly above and below. Two rivers, the Sellen and the Varra, run down to the Delta Mouth, the bottom Reach, where all scoring is doubled. The board is drawn on the [project page](../index.html) and the [printable sheet](../printables/reference.html).

You hold a Plot with **Influence markers**. Two markers on one Plot is a **Keep**, which pays double. A **Legion** is a soldier you station on a Plot you hold, up to three per Plot.

## Resources

Grain, Timber, Stone, Iron, Reed, Coin and Lore, kept in your Coffer. **Favor** is a separate political currency. **Renown** is score and cannot be spent.

## Setup

1. Take your House's opening Coffer.
2. Place two markers on your starting seat Plots, with one Legion on each (Thorne starts with one marker).
3. Draw one Heir face down from your five Heir cards. One in five is Genuine. Do not look at the others.
4. Draw two Rite cards. Start with no Investigation cards.

## A Season

1. **Harvest.** Roll two dice. Every Plot with that number pays its resource to each House with markers on it: one resource per marker, two per marker on a Keep. A 7 pays nothing. Everyone draws a Rite card (hand of three at most).
2. **Actions.** In seat order, each House takes one Action, three times round. If you cannot or will not act, you pass, which costs 1 Coin if you have one.
3. **Event.** One Event card is resolved. The twelve Events are in [EVENTS.md](EVENTS.md).
4. **Flood** (Seasons 3, 6, 9 and 12 only). Score every Reach, pay Dynasty bonuses and Accord Favor, check whether a Dynasty holder dies, and check Ember Pressure.

## Actions

| Action | Cost | What it does |
|---|---|---|
| Build | 1 Grain, 1 Timber, 1 Stone | Place a marker on an empty Plot next to one of yours. |
| Keep | 1 Grain, 1 Timber, 1 Stone | Add a second marker to a Plot you hold. |
| Muster | 2 Iron, 1 Grain (Maelor 3 Iron) | Add a Legion to a Plot you hold. Not before Season 1 (Thorne: not before Season 3). |
| Raid | 1 Iron | Move up to two Legions onto an adjacent Plot where a rival holds markers. |
| Recapture | 1 Iron, 1 Grain | Flip back a marker you lost, if you have a Legion on a Plot you hold next to it. |
| Trade | 3 of one resource | Take 1 of another from the Bank (Maelor pays 2, once a Season). |
| Claim Favor | free, once a Season | Gain 1 Favor. |
| Investigate | 1 Lore (Raven free, Verrin 2 Grain) | Draw an Investigation card. You can hold three. |
| Play Card | free | Testimony: 1 Favor. Document: 1 Lore. Witness: take a resource from the richest rival. |
| Seal (Raven) | 1 Lore and a Seal card | Test a rival's Heir. If it is an Impostor, it is exposed and you gain 2 Renown. |
| Reveal | 2 Favor | Make a Genuine Heir you know about public. |
| Rite | the cost on the card | Cast one Rite from your hand. Each adds Ember Pressure. |
| Dynasty | 3 Favor (Verrin 2) and 2 Reed | Buy a Dynasty: 2 Renown now and 1 more at every Flood. One at a time. |
| Cabal (Sable) | 1 Coin | Place a hidden token next to your markers. Two at most. |
| Pass | 1 Coin if you have it | Do nothing. |

## Fighting

A **Raid** needs 1 Iron and at least one Legion. You move up to two Legions to an adjacent Plot holding rival markers.

- **Undefended** (no rival Legions there): your Legions move in and you capture one marker.
- **Defended**: a **Skirmish**. Both sides roll two dice and add their Legions on the Plot. Ash adds 1 and Raven subtracts 1. Higher total wins; a tie is rolled again. If you win, the defenders are removed, half of your Legions stay (rounded up), and you capture one marker. If you lose, the Legions you moved are lost and the defenders lose half of theirs.
- You cannot raid a House you have an **Accord** with this Season (Wren).
- A House that loses a marker can **Recapture** it.

## Scoring Renown

| Source | Renown |
|---|---|
| Reach, Seasons 3, 6 and 9 | 3 for the most markers in that Reach. Second place scores nothing. |
| Reach, Season 12 | 6 for first, 3 for second. |
| Delta Mouth (bottom Reach) | Doubles every Reach award. |
| Dynasty | 2 when bought, 1 at each Flood while held. |
| Seal | 2 each time you expose an Impostor. |
| Genuine Heir, revealed | 4 at the end. |
| Impostor Heir takes over a Dynasty | Lose 2 and the Dynasty. |
| House bonuses | Caddoc 2 per Rite. Ash 1 per Reach won at Season 12 where it also won a Skirmish. Sable 1 per Reach at Season 12 where its Cabal outnumbers every rival's markers. Thorne 3 when a Genuine Heir takes a Dynasty. |

A Reach is won by holding strictly more markers than anyone else in it. If there is a tie, nobody takes first.

## Heirs and Dynasties

Each House has five Heir cards: four Impostors and one Genuine. At a Flood, a Dynasty holder may die (about one in four). Their Heir then takes over. A Genuine Heir keeps the Dynasty and is revealed. An Impostor costs you 2 Renown and the Dynasty. Only a Seal, a Rite, your own test (Thorne) or a succession shows an Heir, so bluffing and deduction matter.

## Magic and Ember Pressure

Each Rite adds Pressure to a shared track. If Pressure is 4 or more at a Flood, the House that cast the most Rites that Season loses a marker, and Pressure resets. The twelve Rites are in [RITES.md](RITES.md).

## Ending

After Season 12's Flood, revealed Genuine Heirs score 4. The most Renown wins. A tie is broken by most markers, then by most resources.

## The eight Houses

| House | Wins by | Weak at |
|---|---|---|
| Ash | Conquest | Economy |
| Verrin | Dynasties | Lore |
| Maelor | Trade | Iron to muster |
| Thorne | Succession | Early board presence |
| Wren | Alliances | Iron and Lore |
| Sable | Hidden production | Visibility |
| Caddoc | Rites | Needs a good hand |
| Raven | Exposing lies | Combat |

## Good to know

- **Territory carries the game.** The simulation shows the House ahead after the first Flood wins about three games in four. Early expansion matters. See [ANALYSIS.md](ANALYSIS.md).
- Rules and numbers in this file are checked against the code by the test suite, so they cannot drift without a test failing.
