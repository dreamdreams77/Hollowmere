"""Tunable rule values. Every balance knob lives here so experiments are reproducible."""
from dataclasses import dataclass, field, replace


@dataclass
class SimConfig:
    # Reach scoring at Floods: (first, second) at Seasons 3, 6, 9; (first, second) at Season 12.
    mid_flood_points: tuple = (3, 0)
    final_flood_points: tuple = (6, 3)
    delta_multiplier: int = 2

    # Ash conquest bonus (per Reach won).
    ash_conquest_per_reach: int = 1
    ash_every_flood: bool = False
    ash_conquest_margin: int = 1       # Ash needs this many more markers than the runner-up in a Reach
    ash_conquest_needs_capture: bool = True   # rule v3.7: Ash must have won a Skirmish in that Reach this game

    # Sable Cabal majority bonus (per Reach).
    sable_reach_bonus: int = 1
    sable_every_flood: bool = False
    cabal_max: int = 2                # v4.1: two Cabal tokens, as in Phase 3 (was 1)
    cabal_cost_coin: int = 1
    cabal_yield_chance: float = 1.0   # chance a Cabal token produces on a matching hit

    # Dynasties.
    dynasty_enabled: bool = True
    dynasty_purchase_renown: int = 2
    dynasty_flood_renown: int = 1
    dynasty_cost_reed: int = 2

    # Magic / Ember Pressure.
    rite_enabled: bool = True
    rite_mode: str = 'cards'          # 'cards' (real Rite deck) or 'standin' (old placeholder)
    rite_benefit: bool = True         # standin mode only: one random resource per Rite
    pressure_threshold: int = 4
    catastrophe_removes_marker: bool = True

    # Raider and Verrin passives.
    verrin_granary_enabled: bool = True

    # Seal: exposes a rival's Impostor Heir for seal_renown.
    seal_renown: int = 2

    # Raid rules.
    raid_max_legions: int = 2
    skirmish_captures: bool = True    # a won Skirmish takes one enemy marker from the Plot
    recapture_enabled: bool = True   # a House that lost a marker may flip it back (rule v3.2)
    recapture_cost: tuple = (('I', 1), ('G', 1))
    fresh_legions_cannot_raid: bool = False  # Legions mustered this Season may not Raid until the next
    harvest_bonus: int = 0           # extra resource per producing Influence Marker on a matching Harvest
    pass_cost_coin: int = 1          # Coin paid when a House passes an Action slot (rule v3.3; if it can pay)
    pass_avoidance: bool = False     # policies take any legal Action before paying the pass fee
    plot_overrides: tuple = ()      # ((plot, (number, resource, reach)), ...) to test alternative boards
    build_placement: str = 'policy'  # 'policy' (each policy's own rule), or force 'probability', 'need', 'frontier' or 'random'
    build_cost: tuple = (('G', 1), ('T', 1), ('S', 1))   # cost of a Build (and of a Keep)
    build_cost_alternatives: tuple = ()  # if set, a Build may be paid with any of these (tried in order)
    # Heirs and succession (stand-in for Characters and Death Checks; see docs/MODEL_SCOPE.md).
    heir_enabled: bool = True
    holder_death_chance: float = 0.25     # chance a Dynasty holder dies at each Flood
    genuine_heir_end_renown: int = 4      # revealed Genuine Heir scores this at game end
    impostor_penalty: int = 2             # Renown lost when an Impostor is revealed by succession
    thorne_succession_bonus: int = 3      # Thorne: Renown when a Genuine Heir takes a Dynasty
    policy_mode: str = 'aligned'      # 'aligned': each House plays its intended style; 'random': scripted policies shuffled
    investigation_hand_limit: int = 3  # Investigation cards a House may hold; Investigate is illegal when full
    accord_favor: int = 1            # Favor a House gains per Accord it holds at a Flood
    accord_formation_favor: int = 0  # Favor paid to form each Accord at Harvest (design: renewal costs Favor)
    investigation_cards: bool = True   # typed Investigation cards (rule v5.0); False = untyped stand-in
    events_enabled: bool = True       # draw and resolve one Event each Season (rule v6.0)
    event_targets: str = 'random'     # Caravan Fire takes from a random House ('richest' is the first draft)
    council_renown: int = 2           # Council of Houses reward to the Favor leader
    event_draw: str = 'random'        # 'random': each Season draws an Event at random; 'deck': play the 12-card deck once
    favor_free_of_slot: bool = False  # Claim Favor does not use one of the three Action slots (experiment)
    # Comeback experiments (off by default). See docs/ANALYSIS.md.
    flood_schedule: tuple = ()        # ((season, first, second), ...) overrides that Season's Reach points
    underdog_favor: int = 0           # Favor the lowest-Renown House(s) gain after each Flood
    frontier_discount: bool = False   # the House(s) with the fewest markers Build without needing Stone
    walk_in_captures: bool = True     # a Raid into an undefended enemy Plot takes one marker
    legion_cap_per_plot: int = 3

    def with_(self, **kwargs):
        return replace(self, **kwargs)
