"""Comeback experiments: does a rule change reduce how decisive the early lead is, without breaking House balance?

    PYTHONPATH=src python tools/snowball.py --part leader      # how often the leader after each Flood wins
    PYTHONPATH=src python tools/snowball.py --part houses      # House win rates under each rule
Appends to results/experiments_snowball.txt.
"""
import argparse
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from hollowmere_sim.config import SimConfig
from hollowmere_sim.houses import HOUSE_PROFILES
from hollowmere_sim.runner import play, summarize_houses, _pick_winner
import insights

ROOT = pathlib.Path(__file__).resolve().parent.parent
VARIANTS = [
    ("current rules", {}),
    ("escalating mid Floods (2, 3, 4)", {"flood_schedule": ((3, 2, 0), (6, 3, 0), (9, 4, 0))}),
    ("bigger finale (first 9, second 4)", {"flood_schedule": ((12, 9, 4),)}),
    ("escalating + bigger finale", {"flood_schedule": ((3, 2, 0), (6, 3, 0), (9, 4, 0), (12, 9, 4))}),
    ("underdog Favor 2 after each Flood", {"underdog_favor": 2}),
    ("frontier discount (fewest markers, no Stone)", {"frontier_discount": True}),
    ("escalating + finale + underdog Favor 2", {"flood_schedule": ((3, 2, 0), (6, 3, 0), (9, 4, 0), (12, 9, 4)), "underdog_favor": 2}),
]


def leader_stats(cfg, games, seed):
    rng = random.Random(seed)
    names = list(HOUSE_PROFILES)
    lead = {3: [0, 0], 6: [0, 0], 9: [0, 0]}
    for _ in range(games):
        houses = rng.sample(names, 4)
        result, _counts, flood = insights.play_tracked(houses, rng, cfg)
        winner, _ = _pick_winner(result, houses)
        for s in lead:
            top = max(flood[s])
            if flood[s].count(top) == 1:
                lead[s][0] += 1
                lead[s][1] += flood[s].index(top) == winner
    return {s: v[1] / max(1, v[0]) for s, v in lead.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--part", choices=("leader", "houses"), required=True)
    ap.add_argument("--games", type=int, default=0)
    ap.add_argument("--variant", default="", help="only run variants whose label contains this text")
    args = ap.parse_args()
    out = ROOT / "results" / "experiments_snowball.txt"
    lines = []
    for label, over in VARIANTS:
        if args.variant and args.variant not in label:
            continue
        cfg = SimConfig().with_(**over)
        if args.part == "leader":
            r = leader_stats(cfg, args.games or 3000, 42)
            lines.append(f"{label:42s} leader wins after Flood 3: {r[3]*100:4.0f}%   6: {r[6]*100:4.0f}%   9: {r[9]*100:4.0f}%")
        else:
            rows = play(args.games or 12000, seed=42, config=cfg)
            h = summarize_houses(rows)
            lo = min(v[2] for v in h.values()) * 100
            hi = max(v[2] for v in h.values()) * 100
            out_band = [k for k, v in h.items() if not 0.20 <= v[2] <= 0.30]
            lines.append(f"{label:42s} Houses {lo:4.1f}% to {hi:4.1f}%  outside 20-30: {', '.join(out_band) or 'none'}")
        print(lines[-1], flush=True)
    with out.open("a", encoding="utf-8") as f:
        f.write(f"\n[{args.part}]\n" + "\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
