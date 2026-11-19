"""The generated page: links, anchors, icon references and structure. Needs no browser."""
import collections
import html.parser
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build_index  # noqa: E402

VOID = {"meta", "br", "img", "input", "hr", "link", "line", "rect", "path", "circle", "ellipse", "use", "stop", "polyline"}


class Scan(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = collections.Counter()
        self.hrefs = []
        self.uses = []
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids[a["id"]] += 1
        if tag == "a" and "href" in a:
            self.hrefs.append(a["href"])
        if tag == "use" and "href" in a:
            self.uses.append(a["href"])
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        a = dict(attrs)
        if tag == "use" and "href" in a:
            self.uses.append(a["href"])
        if "id" in a:
            self.ids[a["id"]] += 1

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        else:
            self.errors.append(f"unexpected </{tag}> after {self.stack[-3:]}")


def _scan():
    s = Scan()
    s.feed(build_index.build())
    return s


def test_page_is_well_formed():
    s = _scan()
    assert not s.errors, s.errors[:3]
    assert not s.stack, f"unclosed tags: {s.stack}"


def test_no_duplicate_ids():
    dup = [k for k, v in _scan().ids.items() if v > 1]
    assert not dup, dup


def test_every_anchor_link_has_a_target():
    s = _scan()
    missing = [h for h in s.hrefs if h.startswith("#") and h[1:] and h[1:] not in s.ids]
    assert not missing, missing


def test_every_icon_reference_points_at_a_defined_symbol():
    s = _scan()
    missing = sorted({u for u in s.uses if u.startswith("#") and u[1:] not in s.ids})
    assert not missing, f"icons used but never defined: {missing}"


def test_every_relative_link_points_at_a_file_that_exists():
    s = _scan()
    bad = []
    for h in s.hrefs:
        if h.startswith(("#", "http://", "https://", "mailto:")):
            continue
        if not (ROOT / h.split("#")[0]).exists():
            bad.append(h)
    assert not bad, bad


def test_every_house_has_a_crest_glyph_and_a_colour():
    from hollowmere_sim.houses import HOUSE_PROFILES
    import graphics
    for name in HOUSE_PROFILES:
        assert f'id="g-{name.lower()}"' in graphics.SPRITE, name
        assert f".h-{name} " in graphics.CSS, name


def test_every_resource_has_an_icon_and_a_colour():
    import graphics
    for res, icon in graphics.ICON.items():
        assert f'id="i-{icon}"' in graphics.SPRITE, res
        assert f"--res-{res.lower()}:" in graphics.CSS, res


def test_the_board_draws_every_plot_once():
    import graphics
    from hollowmere_sim.board import PLOTS
    svg = graphics.board_svg()
    for p in PLOTS:
        assert svg.count(f">P{p}<") == 1, p


def test_stats_on_the_page_are_real_counts():
    page = build_index.build()
    n = build_index.test_count()
    assert f'<div class="n">{n}</div><div class="l">Tests</div>' in page
    assert n >= 100


def test_page_is_one_file_with_no_external_requests():
    page = build_index.build()
    for token in ("http://", "https://cdn", "src=\"http", "@import", "<script"):
        assert token not in page, token
