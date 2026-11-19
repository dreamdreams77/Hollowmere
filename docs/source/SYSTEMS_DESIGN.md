> **Repository note:** Phase 6.8 numbers in this document describe simulator v2. The current balance state, configuration values and open items are in `docs/BALANCE_LOG.md` and `docs/MODEL_SCOPE.md`. Where those files and this document disagree, they win.

# HOLLOWMERE: Systems Design Document

**Status:** Core engine simulated. Content (cards, Houses' full card pools, Events, Magic, Objectives) is **not yet generated**. Earlier content files in `/cards` were written before this design and are superseded. They must be regenerated from the rules below.

**Design target:** a 2–4 player, 90–120 minute strategy game in which territory control, economy, military, investigation, succession and magic interact through shared resources.

---

## PHASE 1: SYSTEM ARCHITECTURE

### 1.0 The Shared Currency Model
Every loop produces or consumes one of four currencies, so every system competes for the same scarce inputs.

- **Resources** (Grain, Timber, Stone, Iron, Reed, Coin, Lore): produced by Plots, traded, spent.
- **Influence** (Influence Markers on Plots): the board-presence currency. Controls Reach scoring and production.
- **Favor** (Seals): the political currency. Buys Dynasty cards, reveals Heirs, cancels Events, forms Accords.
- **Renown** (score): the victory currency. Earned from Reach control, Dynasties, Objectives, Genuine Heirs, Investigation exposure, and Magic.

Renown never converts directly into anything else. Every other currency converts into Renown only through a system that carries a risk.

---

### 1.1 Core Gameplay Loop
**Inputs:** Board state, hands, Coffers, Courts, Heirs (hidden).
**Outputs:** Resource income, board changes, Renown, information.
**Structure:** Twelve Seasons. Each Season: Harvest → Action (3 actions per House, round-robin) → Event → Flood (Seasons 3, 6, 9, 12) → Life.

**Risks:** Spending Actions on the wrong loop wastes the Season. Overextended Influence can be captured.
**Rewards:** Compounding income from production; Renown spikes at Floods.
**Counterplay:** Raids, Events, Investigation exposure, Accords.
**Strategic uses:** Pacing. Early Seasons favor economy; Flood Seasons reward position; late Seasons reward conversion of resources to Renown.

---

### 1.2 Economy Loop
**Inputs:** Plots (20), Influence Markers on Plots, dice rolls.
**Outputs:** Eight resource types.
**Production rule:** Each Plot has a production number (2–12, not 7) and a resource type. On a matching roll, each House produces 1 resource per Influence Marker on that Plot. A House with two markers on one Plot produces 2 per marker (4 total), the Keep bonus.

**Conversion:**
- Bank: 3:1 default. Gilt (Maelor) House: 2:1, once per Season.
- Trade: any ratio agreed by both parties (Section 1.11).

**Sinks:** Build (1 Grain, 1 Timber, 1 Stone), Muster (2 Iron, 1 Grain), Court (2 Coin), Rites (Magic costs), Dynasty purchase (3 Favor, 2 Reed).

**Risks:** Plots hold the same production number, so a single roll can hit several Houses at once. Income is volatile.
**Rewards:** Keeps compound: 2 markers on a 6 produces 4 resources per hit.
**Counterplay:** Raids remove markers and therefore production. Events target specific resources.
**Strategic uses:** Choosing where to build decides which resources you can count on for the next four Seasons.

---

### 1.3 Political Loop
**Inputs:** Favor, Court Row Characters, Accords, Event votes.
**Outputs:** Dynasty cards, Accords (non-aggression and trade pacts), Event influence, Heir reveals.
**Mechanics:**
- **Accord:** two Houses sign a pact for one Season (renewable). Pact terms are binding: breaking an Accord costs 3 Favor and 1 Renown, paid to the wronged House.
- **Council votes:** Events that call a vote resolve by majority. Ties go to the House with fewer Renown.
- **Favor generation:** Claim Favor (free Action, once per Season), Events, and Dynasty bonuses.

**Risks:** Accords restrict your Raids. Breaking them is expensive but sometimes worth it.
**Rewards:** Accords deliver safety and trade access. Council votes can reshape the board.
**Counterplay:** Refusing Accords, reporting breaches (the wronged House gains 1 Favor), and voting against leaders.
**Strategic uses:** Turning a rival's military strength into a defensive pact; packing the council vote with allies.

---

### 1.4 Military Loop
**Inputs:** Iron, Grain, Legions on Plots.
**Outputs:** Captured Influence Markers, removed Legions, Raider movement, Skirmish Renown (from Military Dynasties and Objectives).
**Mechanics:** Muster (2 Iron, 1 Grain): add a Legion to a Plot you hold. Raid (1 Iron): move up to 2 Legions into an adjacent Plot. Skirmish if opposing Legions are present (Rulebook Section 13). Winner captures markers.

**Risks:** Each Legion is a 2–3 resource investment. Losing a Skirmish costs everything you moved.
**Rewards:** Capturing markers removes an opponent's production and Reach control in one action.
**Counterplay:** Stacking Legions on a Plot, Shieldwall-style Magic, Accords.
**Strategic uses:** Pinning an opponent's production; setting up a Reach capture before a Flood.

---


### 1.4a Recapture (rule v3.2)
When one House takes a Plot's Influence Marker from another (by Skirmish or walk-in), the Plot is marked **contested** and the losing House is recorded as its victim. Any time later in its Action Phase, the victim may **Recapture**: pay 1 Iron and 1 Grain, and have a Legion on a Plot adjacent to the contested Plot that the victim still holds. The victim then exchanges the captor's marker on the contested Plot for one of its own, and the contest ends. A Plot can be contested only once at a time.

**Intent:** make territory swings costly to hold, so a Militarist cannot take a Plot for free and keep it.


### 9.10a Passing (rule v3.3)
A House that passes an Action slot pays 1 Coin, if it has one. A House with no Coin passes for free. This applies only to a real pass: a House that takes any other Action does not pay.

### 1.5 Investigation Loop
**Inputs:** Lore, Investigation Cards (Testimony, Document, Witness, Seal), Heir status.
**Outputs:** Information about hands, Coffers, Heirs and Objectives; Renown when exposure lands; Favor from Seals.
**Mechanics:** Investigate (1 Lore) draws 2 cards, keep one. Investigation cards may be played freely in your Action Phase. Seal cards test a House's Heir (Genuine or Impostor). A House that lies under a Seal loses 2 Renown.

**Risks:** Investigation is slow to accumulate. A false accusation costs 5 Renown.
**Rewards:** Exposing Impostors and Genuine Heirs swings Renown by 4–6 points.
**Counterplay:** Ciphers (Magic), Witness refusal, Secrecy Seals.
**Strategic uses:** Information dominance; forcing rivals to reveal weak positions before Floods.

---

### 1.6 Character Progression Loop
**Inputs:** Court slots (4 per House), Coin (2 per Court), Characters.
**Outputs:** Abilities, Renown at game end, Dynasty succession candidates.
**Ages:** Characters age each Life Phase. Thresholds: 20 (may marry), 45 (ability upgrade), 60 (must pass Death Checks at Floods).
**Death Check:** roll 2d6; die on 9+, minus 1 per full 5 years above 60.

**Risks:** Elder characters die; the Dynasty passes to a possibly-false heir.
**Rewards:** Long-lived Characters give stable abilities and end-game Renown.
**Counterplay:** Characters can be removed by Events and Assassination Magic.
**Strategic uses:** Timing Court investments to match ability thresholds.

---

### 1.7 Magic Loop
**Inputs:** Magic cards (six Schools), Lore, Coin, Reed, Iron, Stone, Timber, Grain, School discounts.
**Outputs:** Instant, Sorcery, Standing, and Relic effects.
**Rules:**
- Each School is tied to one resource. A House matching a School's resource discounts that School by 1.
- **Ember Pressure:** every Rite cast adds 1 Pressure to a shared track. Pressure resolves at each Flood. At 4 Pressure, a Magical Catastrophe fires (Section 1.7.1). Pressure resets to 0 after a catastrophe.

#### 1.7.1 Magical Catastrophe
At Pressure 4 or higher during a Flood Phase, the House that cast the most Rites this Season suffers the catastrophe on its card. The Catastrophe Deck contains 6 cards. Each Catastrophe has a one-time effect on the caster's Reaches (for example, a Verdant Plot's production is lost for two Seasons, or a Legion is removed from every Plot).

**Risks:** Heavy casting triggers catastrophes that hit the leader, not the field.
**Rewards:** Magic gives fast, reliable effects that are difficult to counter with resources alone.
**Counterplay:** Cancel Instants; the catastrophe is pinned on the caster.
**Strategic uses:** Magic-heavy Houses use Pressure to force catastrophes on rivals by casting from a second House's School.

---

### 1.8 Inheritance Loop
**Inputs:** Dynasty holder, Heir Cards (hidden), Death Checks.
**Outputs:** Dynasty transfer, Renown changes, a new Character in the Court Row.
**Mechanics:** When a Dynasty holder dies, the House must reveal its Heir. Genuine: +4 Renown and the Heir enters the Court Row at its printed Age. Impostor: -2 Renown, the Heir is discarded, and the House draws a replacement from its own pile.

**Risks:** A House with an Impostor loses Renown and may lose its Dynasty bonus for one Season.
**Rewards:** Genuine Heirs are worth 4 Renown and a Dynasty bonus.
**Counterplay:** Seals, Witness cards, Secrecy Seals.
**Strategic uses:** Hiding an Impostor until the rival's Dynasty bonus outweighs the risk.

---

### 1.9 Diplomacy Loop
**Inputs:** Accords, Favor, Trade proposals, Council votes.
**Outputs:** Shared production bonuses, safe borders, joint objectives, betrayal opportunities.
**Mechanics:** Accords (1.3); Joint Projects (two Houses fund a Plot's Keep together; the Keep produces for both); Trade Pacts (agreed ratio, lasts one Season).

**Risks:** Partners can break Accords; Joint Projects can be sabotaged.
**Rewards:** Shared production and protected Reaches.
**Counterplay:** Refusing to join; Raid-breaking Accords.
**Strategic uses:** Forming an alliance to isolate the leader, then betraying the ally at the moment it pays most.

---

### 1.10 Endgame Loop
**Trigger:** End of Season 12, or a House reaching 40 Renown earlier (game ends after that Season).
**Scoring:** Renown from all sources; Favor converts at 3 Favor = 1 Renown; Characters score printed Renown; Genuine Heirs score 4; unfinished Objectives score nothing.
**Tiebreakers:** most Influence Markers, then most total resources in Coffer.

---

## PHASE 2: PLAYER DECISION SPACE

Each game presents 50+ meaningful decisions. Information is either visible (V), partially visible (P), or hidden (H).

### Early Game (Seasons 1–3)
1. **Opening Build placement**: Which Plot to add first. *Why it matters:* determines which resource is secured for the next 4 Seasons. *Visible:* Plot numbers. *Hidden:* opponents' hands. *Opportunity cost:* the other Plot you forgo.
2. **Keep vs. new Plot**: Spend 1 Grain/Timber/Stone to add a second marker to a high-probability Plot or spread to a new Plot. *Visible:* production numbers. *Opportunity cost:* Reach breadth versus production depth.
3. **First Muster timing**: Whether to muster before Flood 1. *Visible:* opponent markers. *Hidden:* opponent Legions. *Opportunity cost:* delaying Build.
4. **Which Court Character to take**: *Visible:* Character cards in Row. *Hidden:* what your opponents will draw. *Opportunity cost:* 2 Coin in a resource-starved opening.
5. **Claim Favor vs. Trade**: Favor is slow; trades are fast. *Visible:* prices. *Opportunity cost:* the Trade Action.
6. **Bank trade targeting**: Which surplus resource to convert. *Visible:* Coffers (if public). *Opportunity cost:* blocking your own future Build.
7. **Whether to Investigate in Season 1**: Lore is scarce. *Hidden:* Heir status. *Opportunity cost:* a Build.
8. **Accord with the neighbor**: *Visible:* their Build pattern. *Hidden:* their intent. *Opportunity cost:* the Reach you could have raided.
9. **Which Dynasty to buy first**: Dynasty costs 3 Favor and 2 Reed, which is a large early investment. *Visible:* the Dynasty Row. *Opportunity cost:* 3 Favor.
10. **Whether to sell Reed for Favor**: Trades for Favor are rare. *Visible:* prices.
11. **Raider placement**: Moving the Raider onto a rival's high-probability Plot. *Visible:* production numbers. *Opportunity cost:* the Raider's Plot is blocked for you too.
12. **Delta Mouth first contact**: Whether to place the first marker on Delta Mouth. *Visible:* scoring value (doubled).
13. **Keep the first Heir reveal or hide it**: *Hidden:* Heir status. *Opportunity cost:* 2 Favor to reveal.
14. **Early Raid or wait**: Raiding in Season 2 costs 1 Iron and forces a Skirmish on a stacked Plot. *Visible:* opponent Legions on the Plot. *Opportunity cost:* the Muster.
15. **Economy versus Investigation split**: Investigation needs Lore; Lore Plots are rare.

### Mid Game (Seasons 4–8)
16. **Flood 1 preparation**: Which Reach to contest for the 3-point 1st place. *Visible:* marker counts. *Hidden:* Legions. *Opportunity cost:* contesting a second Reach.
17. **Raid into a rival's Reach**: Capturing 1 marker versus losing 2 Legions. *Visible:* counts. *Hidden:* the defender's Magic in hand.
18. **Cast Rite now or hold for a Sorcery window**: Each Rite adds Pressure. *Visible:* Pressure track. *Hidden:* the opponent's Catastrophe exposure.
19. **Death Check timing on an elder Character**: Replace the Dynasty holder before the Check or hold. *Visible:* Character Age. *Hidden:* the Heir's status.
20. **Reveal Heir voluntarily**: Costs 2 Favor, public and final. *Opportunity cost:* Favor for Dynasty purchase.
21. **Seal test on a rival's Heir**: Costs 2–5 Lore. *Visible:* the result only to you. *Opportunity cost:* the Build you could have paid for.
22. **Form an Accord with a leader**: Protects you, limits your Raids. *Visible:* the leader's position.
23. **Break an Accord**: Costs 3 Favor and 1 Renown. *Visible:* the wronged House's Legions. *Opportunity cost:* the Renown you would have gained.
24. **Bank Trade at 3:1 versus waiting for a counter-offer**: *Visible:* open trade proposals.
25. **Joint Project with an ally**: Splits a Keep's production. *Opportunity cost:* the Keep you could have built alone.
26. **Court a Character aged 20 for marriage**: Creates a cross-House claim. *Visible:* both Characters. *Hidden:* the baby's Heir status.
27. **Vote for or against the council leader**: *Visible:* the vote tally. *Hidden:* alliances.
28. **Capture a rival Keep**: Two markers on one Plot is the most valuable capture. *Visible:* marker counts.
29. **Save Coin for Courts or spend on Trades**: Coin is the most flexible resource. *Opportunity cost:* the option value.
30. **Protect Legions with Magic or let them die**: Magic is limited by Pressure.
31. **Feed a Character Grain**: Some Characters require feeding in the Life Phase. *Opportunity cost:* a Build.
32. **Fund an Investigation Document**: Costs Lore; reveals a rival's Reach count.
33. **Hold a Dynasty Card versus trade it**: Dynasties give Flood bonuses. *Visible:* the Dynasty.
34. **Bluff with an Impostor Heir**: Hidden status makes a false claim credible.
35. **Attack the Delta**: Delta Mouth doubles scoring but is contested by every House.

### Late Game (Seasons 9–12)
36. **Final Flood contest**: Which Reach to defend or capture for 6 vs. 3 points. *Visible:* counts.
37. **Convert Favor to Renown**: 3 Favor = 1 Renown. *Opportunity cost:* a Dynasty purchase.
38. **Buy a late Dynasty for its end-game Renown**: *Visible:* Dynasty Row.
39. **Reveal Heir for final scoring**: Genuine Heirs score 4 at the end.
40. **Force a Seal on the leader**: Costs Lore; may reveal the leader's Impostor Heir.
41. **Spend final Coin on Courts**: Characters score printed Renown.
42. **Last Muster or hold Iron**: Iron is worth nothing at game end.
43. **Break the final Accord**: The last betrayal before scoring.
44. **Cast the final Rite that triggers a catastrophe**: Pressure can backfire on the caster.
45. **Trade with a desperate rival at inflated prices**: *Visible:* their Coffer shortage.
46. **Whether to end the game early at 40 Renown**: Only the leader can trigger this.
47. **Protect the Heir's Age threshold**: Age 18 unlocks marriage and reveal.
48. **Deny the leader's final Reach**: Raids to drop a rival below 1st place.
49. **Choose which Objective to chase**: Objectives are secret; progress is inferred.
50. **Whether to hold back and defend**: Defending Reach control costs Iron and Grain.
51. **Use the Raider to block the final Flood Reach**: Raider blocks production.
52. **Decide to bluff about Objectives**: Declaring a false Objective is risky.
53. **Pay for a Seal to expose a false claimant**: Costs 5 Lore; +4 Renown if correct.
54. **Choose between Renown from Investigation and Renown from Reach control**: Both are limited by Actions.

---

## PHASE 3: ASYMMETRY

Eight Houses. Each has a different win path. Each has one fixed passive, one ability that changes a core loop, and one structural weakness.

### House Raven (Investigation)
- **Passive: Ciphered Ledgers.** Investigation costs 1 less Lore (minimum 0).
- **Core change:** Raven draws 3 Investigation cards per Investigate, keeps 2.
- **Win path:** Renown from Exposure. Each Seal that exposes a lie gives Raven +2 Renown.
- **Weakness:** Military. Raven's Legions have -1 in Skirmish rolls.
- **Strategy:** Information dominance; Raven rarely needs to fight.

### House Ash (Military)
- **Passive: Iron Discipline.** Skirmish rolls +1.
- **Core change:** Raid costs 0 Iron. Muster costs 1 Iron.
- **Win path:** Conquest. Ash gains 2 Renown for each Reach where it holds the most markers at the Flood.
- **Weakness:** Economy. Production numbers are reduced by 1 (minimum 0) for Ash's Plots. Ash starts with 2 Grain.
- **Strategy:** Raid early, force opponents into Accords, convert captured Plots into Reach control.

### House Verrin (Agriculture and Dynasty)
- **Passive: Granary Law.** Each Verdant Plot produces +1 Grain.
- **Core change:** Dynasty cards cost 2 Favor (not 3).
- **Win path:** Dynasty stacking. Each Dynasty held gives +1 Renown per Flood.
- **Weakness:** Lore. Verrin cannot produce Lore. Investigation costs 2 Grain instead of Lore.
- **Strategy:** Build a large, stable economy and buy the best Dynasties.

### House Maelor (Trade and Finance)
- **Passive: Merchant's Writ.** Once per Season, trade 2:1 with the Bank.
- **Core change:** Coin is worth 1.5 resources for trade purposes (rounded down when paying Court costs).
- **Win path:** Trade wins. Maelor gains 1 Renown per completed trade with a different House (once per pair per Season).
- **Weakness:** Iron and Stone. Maelor's Muster costs 3 Iron.
- **Strategy:** Monopolize trade, lend resources, buy out rivals' Dynasty cards.

### House Caddoc (Ritual and Magic)
- **Passive: Scribe's Ink.** Caddoc may pay Reed in place of Lore for any Investigation or Rite cost.
- **Core change:** Pressure from Caddoc's Rites is halved (rounded down).
- **Win path:** Magic supremacy. Caddoc gains 1 Renown per Rite cast.
- **Weakness:** Economy. Caddoc's Plots produce only 3 resources per hit (Keep bonus is halved).
- **Strategy:** Cast many Rites cheaply, use Pressure to catastrophe rivals.

### House Thorne (Faith and Succession)
- **Passive: Consecrated Heirs.** Thorne's Heirs are revealed as Genuine on a Death Check of 10+ (it counts as a Seal test).
- **Core change:** Thorne Characters may marry at Age 18 (not 20). Marriages create an extra Heir draw.
- **Win path:** Dynasty succession. Thorne gains 3 Renown when a Genuine Heir takes a Dynasty.
- **Weakness:** Board presence. Thorne starts with 1 marker fewer and cannot Muster until Season 3.
- **Strategy:** Build a large family tree and hold many potential heirs.

### House Sable (Secret Society)
- **Passive: The Cabal.** Sable may place up to 2 hidden Cabal tokens on any Plot. Cabal tokens count as markers for production but not for Reach control, and are revealed only when a Seal or Witness card targets them.
- **Core change:** Sable's production is secret until revealed. Other Houses cannot know Sable's full production.
- **Win path:** Shadow control. Sable gains 2 Renown for each Reach where its Cabal tokens are the majority, revealed at the Flood.
- **Weakness:** Renown visibility. Sable's Renown cannot be seen by others until Flood. Seals cost Sable 1 extra Lore.
- **Strategy:** Income without target, Reach control that appears only at Flood.

### House Wren (Diplomacy and Coalitions)
- **Passive: Open Court.** Wren may form Accords with any number of Houses at once (Accords are not exclusive).
- **Core change:** Wren gains 1 Favor for each Accord it holds at the Flood Phase.
- **Win path:** Coalition. Wren gains 2 Renown when a Council vote it supports wins, and 1 Renown when a coalition partner gains Renown.
- **Weakness:** Military. Wren cannot Raid into a Plot held by an Accord partner, and its Legions cost +1 Iron to Muster.
- **Strategy:** Build a bloc; betray at the moment the bloc is most valuable.

---

### Asymmetry Matrix (summary)

| House | Primary strength | Primary weakness | Win condition |
|---|---|---|---|
| Raven | Investigation | Military | Exposure Renown |
| Ash | Military | Economy | Reach conquest |
| Verrin | Economy | Lore | Dynasty stacking |
| Maelor | Trade | Iron/Stone | Trade Renown |
| Caddoc | Magic | Production | Rite Renown |
| Thorne | Succession | Board presence | Genuine Heir Renown |
| Sable | Hidden production | Visibility | Hidden Reach control |
| Wren | Diplomacy | Military | Coalition Renown |

**Check:** Every House has at least one win path that does not rely on another House's loss, which keeps all eight viable in 2–4 player games.

---

## PHASE 4: EMERGENT GAMEPLAY

Each emergent behavior is produced by specific mechanics. Listed below with the exact triggers.

### Alliances
- **Mechanism:** Accords (1.3) and Joint Projects (1.9). An Accord prevents Raids between two Houses for one Season. A Joint Project splits a Keep's output.
- **Emergence:** Two Houses that both benefit from a third House's weakness sign an Accord and divide the target's Reaches.

### Betrayal
- **Mechanism:** Breaking an Accord costs 3 Favor and 1 Renown, paid to the wronged House. Raids are the only way to break an Accord in practice.
- **Emergence:** When the ally's Plot gives the largest payoff at the Flood, the cost is worth paying. A betrayal at the right moment can swing a Reach by 6 Renown.

### Trade Wars
- **Mechanism:** Trade proposals may be refused. Bank trades cost 3:1. Maelor's Writ creates a 2:1 advantage.
- **Emergence:** Maelor and a rival stop trading. Each House then monopolizes a resource the other needs; the price of that resource rises at the Bank as Houses buy from it.

### Religious Conflict
- **Mechanism:** Thorne's Consecrated Heirs and Pilgrim/Priest characters (for example, Harvest Priest Gell) produce Faith-related effects. Death Checks on Priest Characters grant Renown to the House with the most Priests.
- **Emergence:** Thorne's succession claims are tested by rivals who use Seal cards to question the Heirs. The conflict is a public contest over whose heirs count.

### Secret Societies
- **Mechanism:** Sable's Cabal tokens count for production but not Reach control, and are hidden.
- **Emergence:** Other Houses see resources appear where they did not expect. The Cabal is discovered through Witness and Seal cards, and the discovery triggers Accords against Sable.

### False Heirs
- **Mechanism:** Each House's Heir pile contains four Impostors and one Genuine (Section 1.8).
- **Emergence:** A House reveals an Impostor at the worst time, or chooses to keep its Impostor hidden and bluff. Players infer Genuine Heirs from Seal results and Dynasty transfers.

### Political Coups
- **Mechanism:** Council votes (1.3) by majority; ties go to the lower-Renown House. Coup Events (for example, Coup Rumor) remove Legions from Reach V.
- **Emergence:** A coalition of Houses with the fewest Renown uses a vote to unseat the leader's Dynasty bonus, then the new leader is targeted in the next vote.

### Resource Monopolies
- **Mechanism:** Each resource type has at most 4 producing Plots (one per Plot number cluster). A House holding 3 or more of a resource's Plots controls its production.
- **Emergence:** A monopolist raises the trade price; other Houses must trade through the monopolist or build Keeps on remaining Plots, starting a race for the last Plots.

### Magical Catastrophes
- **Mechanism:** Ember Pressure (1.7). At 4 Pressure during a Flood, the Rite-heaviest House suffers its catastrophe.
- **Emergence:** Caddoc or Raven casts Rites until Pressure is 3, then a rival casts a free Rite to force the catastrophe onto the caster. Players learn to watch the Pressure track and time their Rites.

---

## PHASE 5: BALANCE ANALYSIS

**Note on status:** the fixes in 5.2–5.7 are proposed rules. Only the scoring change in 5.1 and 6.4 has been run through the simulation. The rest must be tested in Phase 6.7 before they count as balanced.

### 5.1 Dominant Strategies Found
**Breadth Expansion.** Spreading single markers across all five Reaches maximizes Reach placement. Because each Reach scores independently, the Expander approach wins Reach placements in every Flood. Under the original scoring (3/1 at Floods, 6/2 at the end), Expanders won 34.8% of simulated games against a fair 25% baseline. *Fixed by the scoring change in Section 6.4.*

**Shallow Decisions.** A random policy wins about 20–24% of simulated games. Core economy and territory decisions alone have too little skill ceiling. *Addressed by House asymmetry, Magic, Investigation, and Heirs (Phase 3, 1.5, 1.7, 1.8). These must be simulated before release.*

### 5.2 Infinite Loops
- **Trade loop.** Two Houses trading the same resource back and forth at 1:1 to pass the Trade Action. *Fix:* a trade pair may trade the same resource type only once per Season.
- **Bank loop.** Trading surplus at the Bank and immediately re-trading the same resource. *Fix:* a resource received from the Bank may not be traded to the Bank in the same Season.
- **Rite loop.** Instants cancelling each other indefinitely. *Fix:* a Rite may only cancel another Rite once per Season.
- **Accord renewal loop.** Renewing an Accord each Season with no cost. *Fix:* renewal costs 1 Favor.

### 5.3 Economic Exploits
- **Keep stacking.** Adding a third marker to a Plot has no benefit. *Fix:* Keeps are capped at 2 markers per Plot.
- **Maelor Writ abuse.** Maelor can trade 2:1 every Season and convert all surplus. *Fix:* Writ is once per Season (already in place) and cannot convert Coin to Coin.
- **Coffer hoarding.** Hoarding Coin to pay for Courts later with no cost. *Fix:* Coffer resources are visible at the Flood; hoarding above 10 of one resource triggers an Event (Market Glut).

### 5.4 Military Exploits
- **Raid cycling.** Moving Legions in and out of a Plot for free captures markers each Season. *Fix:* a Plot may be the target of only one Raid per Season.
- **Stack defense.** Four Legions on one Plot cannot be removed. *Fix:* Legions on a Plot beyond 3 count as 1 for Skirmish rolls.
- **Raider abuse.** The Raider blocks a rival's best Plot every Season. *Fix:* the Raider moves only on 7s and cannot return to a Plot it left in the previous Season.

### 5.5 Political Exploits
- **Accord shielding.** Two Houses form an Accord and Raid the third with impunity. *Fix:* Accords do not protect against Raids from a third House.
- **Council stacking.** A coalition wins every vote. *Fix:* each House can vote for only one target per Event.
- **Favor hoarding.** Hoarding Favor to buy the best Dynasty and then discard it. *Fix:* Dynasties discarded this way return to the Row and the House loses 2 Favor.

### 5.6 Negotiation Exploits
- **Blackmail.** Using Seals to force rivals to give resources. *Fix:* Seal results can be refused, but a refused Seal reveals the refuser's Heir to the table.
- **Non-binding trades.** Promising a trade and never completing it. *Fix:* accepted trades are resolved immediately (1.10).
- **Bribery through Court.** Trading a Character for a rival's resources. *Fix:* Characters cannot be traded, only transferred through Court Actions.

### 5.7 Magic Exploits
- **Pressure forcing.** A House casts a single free Rite to push Pressure to 4 at a rival's Flood. *Fix:* Rites cast in the same Season count only once for Pressure per House.
- **Catastrophe immunity.** A House with no Rites never suffers a catastrophe. *Fix:* the catastrophe falls on the House that cast the most Rites this Season, or, if tied, on the House with the most Renown.

---

## PHASE 6: PLAYTESTING (SIMULATION)

### 6.1 What Was Simulated
A Python simulation of the core engine (`design/hollowmere_core_sim.py`) runs the 20-Plot board, production dice, Build, Muster, Raid (with Skirmish), Bank Trade, the twelve-Season structure, and Reach scoring. It runs four AI policies seated against each other with randomized seats and home Plots.

**Not simulated:** Events, Magic, Investigation, Heirs, Dynasties, Objectives, Accords, House passives, Pressure. The simulation therefore tests the territory, economy and military core only. It does not test the full engine.

### 6.2 The 20 Playtest Games (final rules)

| Game | Winner policy | Winning score | Note |
|---|---|---|---|
| 1 | Expander | 18 | Tied with Opportunist, tie broken by markers |
| 2 | Expander | 15 | 4-way tie on Renown, broken by markers |
| 3 | Opportunist | 21 | Outlier; Expander collapsed to 6 |
| 4 | Economist | 18 | Tied with Militarist |
| 5 | Expander | 18 | Tied with Militarist |
| 6 | Economist | 24 | Economist's best score |
| 7 | Opportunist | 18 | Militarist collapsed to 9 |
| 8 | Militarist | 18 | Economist collapsed to 9 |
| 9 | Militarist | 18 | Tied with Expander, tie broken by markers |
| 10 | Opportunist | 21 | |
| 11 | Militarist | 27 | Highest score in the 20 games |
| 12 | Expander | 18 | Tied with Militarist |
| 13 | Militarist | 18 | |
| 14 | Economist | 15 | 4-way tie, broken by wealth |
| 15 | Economist | 15 | Expander collapsed to 3 |
| 16 | Economist | 18 | Tied with Opportunist |
| 17 | Expander | 18 | |
| 18 | Expander | 21 | |
| 19 | Economist | 18 | Tied with Opportunist |
| 20 | Opportunist | 15 | 4-way tie, broken by wealth |

Sample win counts: Expander 6, Militarist 4, Economist 7, Opportunist 3.

**Interpretation:** the 20-game sample is noise. The 20,000-game check is the one to trust.

### 6.3 The 20,000-Game Balance Check (final rules)

| Policy | Wins | Win rate | Avg Renown |
|---|---|---|---|
| Expander | 5,647 | 28.2% | 15.08 |
| Militarist | 5,093 | 25.5% | 15.11 |
| Economist | 4,563 | 22.8% | 15.32 |
| Opportunist | 4,697 | 23.5% | 15.07 |

Ties broken by markers, then by Coffer wealth: **4.3%** of games.

### 6.4 Balance History (what changed and why)

| Version | Scoring | Expander | Militarist | Economist | Opportunist | Ties |
|---|---|---|---|---|---|---|
| v1 (original) | 3/1 Floods, 6/2 final | 34.8% | 28.9% | 15.9% | 20.4% | 13.8% |
| v2 (no mid 2nd) | 3/0 Floods, 6/0 final | 20.6% | 16.9% | 38.7% | 23.9% | 30.2% |
| v3 (final) | 3/0 Floods, 6/3 final | 28.2% | 25.5% | 22.8% | 23.5% | 4.3% |

v1 overrewarded spreading. v2 overcorrected and made ties common. v3 keeps Expander and Militarist modestly ahead of the Economist and random baseline (about 25% each) with almost no ties. The final-round second-place value had little effect (Section 6.5), so it was set for tie-breaking.

### 6.5 Sensitivity Test
Changing only the final-round second-place score (2, 3, or 4) changed Expander's win rate by less than 0.5 percentage points. Changing the mid-game second-place score is the decisive lever.

### 6.6 Overperforming Strategies
- **Early breadth** (Expander) overperformed under v1 and is now close to fair.
- **Military pressure** (Militarist) is competitive in the final rules and wins most often in games where a rival's Economist stalls.
- **Economist** is fragile: it underperforms in small-board situations and overperforms only when the scoring rewards depth.
- **Random play** winning 23.5% is the key warning. It means the core engine has too little skill expression. Balance cannot be declared final until Houses, Magic, Investigation, and Heirs add decisions to the simulation.

### 6.7 Balance Iteration Plan (next steps)
1. Add Houses' passives to the simulation and rerun 20,000 games. Target: each House within 20–30% win rate.
2. Add Ember Pressure and Catastrophes. Target: no House above 30% win rate in Magic-heavy seats.
3. Add Investigation and Heirs. Target: Random policy below 20% win rate, showing skill expression.

---

## PHASE 7: CONTENT (DEFERRED)

Content is not generated in this document. Per the design rule, cards cannot be written until the systems pass the balance targets in 6.7. The earlier card files were written before this design and do not match the final rules (scoring values, Heir setup, Pressure, the eight-House roster). They are superseded.

**Content generation order once systems are locked:**
1. Eight House boards with passives and starting Coffers.
2. Event deck, mapped to each loop's inputs and outputs (1.1–1.10).
3. Magic deck with School costs, Pressure values, and catastrophe cards.
4. Investigation deck mapped to Seal and Witness rules.
5. Character and Dynasty decks mapped to Court and Inheritance.
6. Objective deck mapped to scored game states that the simulation can detect.

Every card must reference a rule in this document. A card that does not is filler and is removed.

---

## PHASE 6.8: SIMULATOR v2 RESULTS AND REVISIONS

**Simulator:** `design/hollowmere_sim_v2.py`. Output saved to `design/results_sample20.txt` (20 games) and `design/results_20000.txt` (20,000 games, seed 42). The 20-game sample is noise; the 20,000-game run is the one to read.

### 6.8.1 What v2 Adds
- All eight Houses from Phase 3, each with its starting Coffer and modeled passives.
- Favor (one free Claim per Season), Dynasties (purchase for Favor and Reed, +2 Renown on purchase, +1 per Flood while held).
- Investigation as information only. Renown from exposure comes only from Raven's Seal action, at an 80% success rate (the Impostor base rate of 4 in 5).
- Rites with Ember Pressure. A Flood with Pressure at 4 or more triggers a Catastrophe on the House with the most Rites that Season.
- Sable's Cabal tokens. They add production but not Reach control.

### 6.8.2 What v2 Does Not Model
- **Thorne's Genuine Heir Renown and marriage.** Thorne's win path is absent, so its low result (8.5%) is not a balance signal.
- **Wren's Accords and coalition votes.** Wren plays as a core House. Its 28% result reflects the core only.
- **Maelor's house-to-house trade Renown.** Maelor's Writ is modeled only as the 2:1 Bank rate.
- **Real Rite effects.** A Rite gives one random resource as a stand-in. Magic results are therefore unreliable.
- **Events, Objectives, Death Checks.**

### 6.8.3 Balance Changes Made in v2 (these are design revisions)
Each change below must be applied to the Phase 3 and Phase 1 text. Until then the design and the simulator disagree.

| House / Rule | Original design | v2 value | Reason |
|---|---|---|---|
| Ash, Raid cost | 0 Iron | **1 Iron** | Free Raids let Ash capture Plots with no cost, giving 78% wins under the first v2 run. |
| Ash, Muster cost | 1 Iron | **2 Iron** | Same cause. |
| Ash, conquest bonus | +2 Renown per Reach at every Flood | **+1 Renown per Reach at Season 12 only** | The original stacked on top of Reach scoring and gave Ash 78%. |
| Sable, Cabal token cap | 2 | **1** | Free production from tokens. |
| Sable, Cabal placement | free | **1 Coin** | Same cause. |
| Sable, Reach majority Renown | +2 per Reach at every Flood | **+1 per Reach at Season 12 only** | Stacked with Reach scoring. |
| Verrin, starting Coffer | G3 T2 S1 | **G2 T1 S1** | Verrin was the only House that could Build on its first action. |
| Verrin, Granary Law | +1 Grain on Verdant Plots | **disabled in the final test** | Testing isolated effects. **Must be restored** in the final design. The result (38%) is with the passive off. |
| Investigation Renown | Renown from every Investigate | **Information only; Renown only from Raven's Seal** | Raven could farm Renown with free Investigations (75% wins). |
| Rite cost | 2 Lore | **2 Lore, 2 Coin, or 2 Reed** | Only three Plots produce Lore. Magic was starved and Ember Pressure never reached 4. |

Trade-off: Verrin's start change and the disabled Granary Law are the only two changes that touch the Verrin win path, and Verrin is still the top House. Both need re-testing with the passive restored.

### 6.8.4 Final v2 Results (20,000 games, final configuration)

| House | Win rate | Fair share | Status |
|---|---|---|---|
| Verrin | 38.4% | 25% | **Outlier.** Cause not isolated (see 6.8.5). |
| Sable | 31.3% | 25% | Elevated. Cabal production remains the likely cause. |
| Wren | 28.3% | 25% | Core only; Accords not modeled. |
| Raven | 28.1% | 25% | Acceptable. |
| Ash | 25.2% | 25% | On target. |
| Maelor | 21.2% | 25% | Slightly low; Trade Renown not modeled. |
| Caddoc | 19.0% | 25% | Low; Rite Renown is weak in the stand-in model. |
| Thorne | 8.5% | 25% | **Not balanced.** Heir win path not modeled. |

| Policy | Win rate |
|---|---|
| Militarist | 31.5% |
| Expander | 28.1% |
| Opportunist | 23.1% |
| Economist | 17.3% |

Tie rate: 1.4%. Average Catastrophes per game: 0.21 (Pressure is nearly inert).

**Interpretation:**
- Militarist leads the policy table. Military remains the strongest generic approach in the core.
- Economist is weakest. Its keep-first, trade-second order is too slow in the core, and it has no Reach-control advantage.
- Catastrophes are rare, so Ember Pressure is not yet a meaningful risk. Magic cannot be called balanced.

### 6.8.5 Open Issues (not yet resolved)
1. **Verrin at 38%.** Removing the Rite stand-in (benefit off) raised Verrin to 45%, so Rites are not the cause. Removing the Coffer advantage lowered it only to about 27–28% in one test. The likely cause is the Dynasty and Favor engine, which is simple and heavily weighted toward Verrin's cheaper Dynasty purchase. **Next test:** remove Dynasties entirely and rerun.
2. **Sable at 31%.** Cabal tokens still produce free resources once placed. **Next test:** Cabal tokens produce at half rate.
3. **Thorne and Wren.** Need Heir and Accord mechanics in the simulator before they can be judged.
4. **Magic.** The Rite stand-in is not a design. Pressure needs a real Magic deck before any catastrophe rate is meaningful.
5. **Economist.** Its weakness needs diagnosis: either the policy order or the core economy.

### 6.8.6 Status
The core engine with eight Houses is **not balanced**. Three Houses (Verrin, Sable, Thorne) are outside the 20–30% band, and Thorne's result is unreliable because its win path is missing. The changes in 6.8.3 are the current best settings and are recorded as design revisions.

Content generation remains deferred until the open issues in 6.8.5 are resolved.


---

## DECISIONS (post Phase 6.8)

### D1: Build placement (v3.4)
A House chooses where to Build by its own placement rule. The rule is part of its play style, not a fixed engine rule. The reference rule (Expander) builds on the empty Plot adjacent to its markers with the highest chance of matching the Harvest roll. This is accepted as the strongest scripted plan and is not to be weakened for balance reasons alone.

### D2: Board production (v3.4)
Plot P10 produces Stone, not Timber. Stone is now held by three Plots (P8, P10, P15). Timber is held by two.

### D3: Build cost (decided: keep Grain, Timber and Stone)
A Build costs 1 Grain, 1 Timber and 1 Stone (or 1 Grain and 3 Timber, as an alternative). Tested in `results/experiments_build_cost.txt`:
- Drop Stone (1 Grain, 1 Timber): Builds rise to 11.1 per game and Thorne to 25%, but Caddoc falls to 14% and Raven to 18%, and Economist rises to 23%. Rejected for now.
- Stone or 3 Timber as an alternative: no meaningful change from the current cost. Rejected.
- Keep the current cost. Dropping Stone is the lever to revisit once Caddoc's Rite path is fixed.

### D4: Heir Renown at game end (decided: revealed Genuine Heirs only)
A Genuine Heir scores 4 Renown at game end only if it has been revealed (by voluntary reveal, by succession, or by a Seal exposing an Impostor). Unrevealed Genuine Heirs score nothing. This resolves the ambiguity between Rulebook 10.6 and 11.4.


### D5: Ash's conquest bonus (rule v3.7)
Ash gains 1 Renown for each Reach it wins at the final Flood, but only if Ash also won a Skirmish in that Reach during the game. The bonus measures conquest, not simple control. Ash's Reach control still scores as normal.

Evidence (`results/experiments_ash.txt`, `results/experiments_ash_conquest.txt`): the conquest bonus was the main driver of Ash's win rate (33% with it, 26% without it). Requiring a Skirmish win brings Ash to 27%, inside the band, while keeping its conquest identity. A margin requirement alone did not work (32%).


### D6: Investigation hand and Seals (rule v3.9)
Investigate draws one Investigation card into the House's hand. A House may hold at most three. Investigate is illegal when the hand is full. A Seal spends one Investigation card, as well as its Lore cost.

Why: Investigate had no effect in the simulator and cost Raven nothing, so the Investigator style spent about 33 Actions per game on it and built almost nothing (11% wins, 1.7 markers at game end). A hand limit makes Investigation a resource with a purpose: cards are held for Seals, and a full hand forces the House to act.

Evidence (`results/experiments_raven.txt`): hand limit 3 gives Raven 25%, with about 6 Investigate Actions per game and 2.7 markers at game end.


### D7: Wren's Accords and Caddoc's Rite Renown (rule v4.0)
- **Accords (Wren, Open Court).** At each Harvest, Wren forms Accords with up to two of the Houses that border it most. An Accord forbids Raids between the two Houses for that Season. Each Accord Wren holds at a Flood gives it 1 Favor. Accords are free to form in this model. The design's renewal cost is not yet modelled.
- **Caddoc (Rites).** Each Rite cast gives Caddoc 2 Renown. Phase 3 specified 1. The change was needed because Caddoc cast about 1.9 Rites per game and its Renown from them was worth only about 2 points.

Evidence: `results/experiments_caddoc_wren.txt`. Wren 21% to 25%, Caddoc 21% to 26%. Sable drops slightly (to 21%) because Wren's Accord partners cannot raid it.


### D8: Sable's Cabal tokens (rule v4.1)
Sable may hold two Cabal tokens, as Phase 3 specified. The simulator had capped them at one since v2, when Sable's free production was overpowered. Since then the economy has changed, and at one token Sable sits at 21%.

Evidence (`results/experiments_sable.txt`): two tokens give Sable 23%. Two tokens plus a Reach bonus at every Flood give 26%, but that needs two changes, so it was not adopted.


### D9: Investigation card types (rule v5.0, confirmed)
Investigation cards are typed: Testimony, Document, Witness and Seal. The types, draw rules and effects are in `docs/INVESTIGATION.md` and are confirmed by the designer. Raven's deck is Seal-heavy.

### D10: Open balance items (v5.0; Wren resolved in v6.1)
- Wren's Accord renewal cost (1 Favor): tested. Wren falls to 20%. Not adopted. The Accord's value needs raising before the cost can be added.
- Ash: 27.5%, inside the band. Removing its Skirmish bonus gives 25.8%, but it changes Ash's identity. Not adopted.
- Verrin: 26.2%. Granary Law and the Dynasty cost barely affect it. Not adopted.


### D11: Events (rule v6.0, confirmed)
Each Season's Event Phase draws one of twelve Events at random after the Actions and before any Flood. Events, their effects and the reasons for their targeting are in `docs/EVENTS.md`. Caravan Fire targets a random House, not the richest. Council rewards only a sole Favor leader. Awaiting designer confirmation.


### D10 (resolution, v6.1): Wren's Accords stay free to form
The designed renewal cost (1 Favor to form each Accord) was tested with several Wren levers and with several Accord payouts (`results/experiments_wren_lever.txt`, `results/experiments_open_items_2.txt`). Wren stayed at 21% or lower whenever the cost applied, and at 25% when Accords were free. The cost drains the Favor that Wren needs for Dynasties, so it does not fit Wren's balance. Decision: Accords are free to form, and Wren gets 1 Favor per Accord held at a Flood. The renewal cost is recorded as not adopted. This is a balance decision and can be reversed by the designer.


### D12: Comeback rules tested, none adopted (post v6.1)
The leader after the first Flood goes on to win 77% of games (87% after Flood 6). Five rule changes were tested behind switches (`flood_schedule`, `underdog_favor`, `frontier_discount`): escalating Flood points, a bigger finale, underdog Favor, a Stone-free Build for the House at the back, and combinations. None lowered the Flood 6 and Flood 9 figures, so none was adopted. All keep every House inside the 20 to 30 percent band. Full reasoning, the table, and untested next steps are in `docs/ANALYSIS.md`.
