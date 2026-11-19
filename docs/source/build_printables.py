"""Printable tabletop sheets, generated from the same data as the page.

    python tools/build_printables.py

Writes printables/reference.html (board, Season order, Action costs, scoring, the eight Houses) and
printables/cards.html (the twelve Rite cards and twelve Event cards, cut-out size). Light colours only,
so they print the same from any device.
"""
import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tools"))

import build_index as bi  # noqa: E402
import graphics as gx  # noqa: E402
from hollowmere_sim.events import EVENT_DECK, EVENT_TEXT  # noqa: E402
from hollowmere_sim.houses import HOUSE_PROFILES  # noqa: E402
from hollowmere_sim.rites import RITE_DECK, effect_text  # noqa: E402

E = html.escape
ORDER = ("Ash", "Verrin", "Maelor", "Thorne", "Wren", "Sable", "Caddoc", "Raven")


def light_css():
    css = bi.CSS + gx.CSS
    return re.sub(r"@media \(prefers-color-scheme: dark\) \{\n.*?\n\}\n", "", css, flags=re.S)


PRINT_CSS = """
@page { size: A4; margin: 10mm; }
html, body { background:#fff !important; color:#1d1b17; }
body { font:12px/1.45 Georgia,serif; }
.sheet { max-width:190mm; margin:0 auto; padding:0; }
.sheet h1 { font-size:26px; margin:0 0 4px; } .sheet h2 { font-size:17px; margin:18px 0 6px; border-bottom:1px solid #d9d0bf; padding-bottom:3px; }
.sheet .lede { margin:0 0 10px; color:#6b645a; font-size:12px; }
.board { max-width:158mm; margin:0 auto; } .tablewrap { overflow:visible; } table { font-size:10.5px; } th, td { padding:3px 6px; }
.legend { margin:6px 0 0; } .note { font-size:10px; margin:6px 0 0; } .sheet ol { margin:6px 0 0; padding-left:18px; } .sheet li { margin:0 0 3px; font-size:11px; }
.page-break { break-before:page; }
.hgrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .hcard { border:1px solid #d9d0bf; border-radius:8px; padding:8px 10px; break-inside:avoid; border-top:4px solid var(--c); }
.hcard .house-name { font-size:15px; } .hcard p { margin:6px 0; font-size:11px; }
.hcard .row { font-size:11px; margin:3px 0; } .hcard .row b { font:700 10px system-ui,sans-serif; text-transform:uppercase; letter-spacing:.5px; color:#6b645a; margin-right:4px; }
.cards-h { margin:0 0 4px; } .cutgrid { display:grid; grid-template-columns:repeat(3, 63mm); gap:0; justify-content:center; }
.cut { width:63mm; height:82mm; border:1px dashed #9a9384; padding:5mm; box-sizing:border-box; display:flex; flex-direction:column; gap:3mm; break-inside:avoid; background:#fff; }
.cut h3 { font-size:15px; margin:0; } .cut p { margin:0; font-size:11.5px; flex:1; } .cut .tag { font:700 9px system-ui,sans-serif; text-transform:uppercase; letter-spacing:1px; color:var(--sc,#6b645a); }
.cut.ev { --sc:#7a3e1d; border-top:3mm solid #7a3e1d; } .cut.rite { border-top:3mm solid var(--sc); }
.cut .foot { font:10px system-ui,sans-serif; color:#6b645a; display:flex; justify-content:space-between; align-items:center; }
.cut .pr { display:inline-flex; gap:1px; color:#e8873a; }
.note-print { font-size:10px; color:#6b645a; margin-top:8px; }
@media screen { body { padding:16px; background:#eee !important; } .sheet { background:#fff; padding:12mm; box-shadow:0 2px 12px rgba(0,0,0,.15); } }
"""


def head(title):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>{E(title)}</title><style>{light_css()}{PRINT_CSS}</style></head><body>{gx.SPRITE}<div class="sheet">')


def house_sheet():
    out = []
    for name in ORDER:
        prof = HOUSE_PROFILES[name]
        style, win, weak = bi.HOUSE_DEPTH[name]
        chips = "".join(gx.res_chip(r, prof.coffer[r]) for r in gx.RES_ORDER if prof.coffer.get(r))
        out.append(f'<article class="hcard" style="--c:var(--h-{name})"><div class="house-top">{gx.crest(name, 38)}'
                   f'<div><div class="house-name">{E(name)}</div><div class="pill">{E(style)}</div></div></div>'
                   f'<p>{E(bi.BLURB[name])}</p><div class="row"><b>Wins by</b>{E(win)}</div>'
                   f'<div class="row"><b>Weak at</b>{E(weak)}</div><div class="row"><b>Opening Coffer</b>{chips}</div></article>')
    return '<div class="hgrid">' + "".join(out) + "</div>"


def reference_html():
    acts = "".join(f"<tr><td><b>{E(a)}</b></td><td>{E(c)}</td><td>{E(e)}</td></tr>" for a, c, e in bi.ACTIONS_TABLE)
    score = "".join(f"<tr><td>{E(a)}</td><td>{E(b)}</td></tr>" for a, b in bi.SCORING)
    turn = "".join(f"<li><b>{E(n)}.</b> {E(t)}</li>" for n, t in bi.PLAY_TURN)
    page = [head("Hollowmere reference sheet"),
            '<h1>Hollowmere</h1><p class="lede">Reference sheet. Twelve Seasons; the most Renown wins. Full rules: docs/HOW_TO_PLAY.md.</p>',
            gx.board_svg(), gx.board_legend(),
            f'<h2>A Season</h2><ol>{turn}</ol>',
            '<div class="page-break"></div><h2>Actions and costs</h2>'
            f'<table class="depth"><tr><th>Action</th><th>Cost</th><th>Effect</th></tr>{acts}</table>',
            f'<h2>How points are scored</h2><table class="depth"><tr><th>Source</th><th>Renown</th></tr>{score}</table>',
            '<div class="page-break"></div><h2>The eight Houses</h2>', house_sheet(),
            '<p class="note-print">Houses are dealt to the four seats A to D at random. A Reach is won by strictly more markers than anyone else in it.</p>',
            "</div></body></html>"]
    return bi.wrap_tables("".join(page)) if hasattr(bi, "wrap_tables") else "".join(page)


def cards_html():
    names = {"Tidewater": "tide", "Lorecraft": "lore", "Ironveil": "iron", "Verdant": "verd", "Gilt": "gilt", "Ashen": "ash"}
    rites = []
    for r in RITE_DECK:
        cost = "".join(gx.res_chip(k, n) for k, n in r.cost)
        full = int(r.pressure)
        flames = gx.icon("flame", 14, "flame") * full + (gx.icon("flame", 14, "flame half") if r.pressure % 1 else "")
        rites.append(f'<div class="cut rite sc-{names[r.school]}"><span class="tag">{E(r.school)} Rite</span><h3>{E(r.name)}</h3>'
                     f'<p>{E(effect_text(r))}</p><div class="foot"><span>{cost}</span><span class="pr">{flames or "no Pressure"}</span></div></div>')
    events = []
    for e in EVENT_DECK:
        events.append(f'<div class="cut ev"><span class="tag">Event</span><h3>{E(e.name)}</h3><p>{E(EVENT_TEXT[e.name])}</p>'
                      f'<div class="foot"><span>Resolve after the Actions</span></div></div>')
    return "".join([head("Hollowmere cards"),
                    '<h1 style="font-size:18px;margin:0">Hollowmere cards</h1><p class="lede" style="margin:0 0 4px">Print at 100 percent and cut along the dashed lines. Cards are 63 by 82 mm. '
                    'Rites are cast from a hand of up to three. Shuffle the Events and draw one each Season.</p>',
                    f'<h2 style="margin:4px 0">Rite cards (12)</h2><div class="cutgrid">{"".join(rites)}</div>',
                    f'<h2>Event cards (12)</h2><div class="cutgrid">{"".join(events)}</div>',
                    "</div></body></html>"])


def main():
    out = ROOT / "printables"
    out.mkdir(exist_ok=True)
    (out / "reference.html").write_text(reference_html(), encoding="utf-8")
    (out / "cards.html").write_text(cards_html(), encoding="utf-8")
    print("wrote", out / "reference.html", out / "cards.html")


if __name__ == "__main__":
    main()
