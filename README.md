# Hollowmere

A 2–4 player, twelve-Season fantasy political strategy game, rebuilt from the surviving design
bundle (`docs/source/`). Play one House against one, two or three AI Houses on a living 3D diorama
of the five Reaches of the Sellen and the Varra.

## Play

```sh
npm install          # three.js r170 (already vendored in vendor/three; npm is only for tools)
npm run serve        # http://localhost:8080/
```

Any static web server works: the game is plain ES modules with an import map, no build step and
no requests to outside hosts. Add `?q=low|medium|high` to force a graphics tier.

Controls: drag to move the board, scroll or pinch to zoom, right-drag or two-finger twist to turn
it. Tap a Plot to inspect it and see the Actions you can take there. Keys: arrows/WASD, Q/E, +/−,
R (reset view), M (menu), Esc (cancel). The game autosaves after every one of your Actions.

## What is in the box

| Folder | What it holds |
|---|---|
| `src/rules/` | The rules engine: pure, deterministic functions over a JSON state (`engine.js`), all rule data (`data.js`), seeded random numbers. No rendering. |
| `src/ai/` | AI opponents: one-Action lookahead with a value function seen from the AI's own seat, weighted per House. Never reads hidden information. |
| `src/render/` | three.js r170 world: terrain, water, scenery, House pieces, effects, camera and controls, tilt-shift post-processing. |
| `src/ui/` | Interface: setup, HUD, Plot inspector, cards, presentations, save/load, phone layouts. |
| `src/content/art.js` | Every painted texture and image: heraldry, gold leaf, vellum, resource glyphs, card art, Heir portraits. |
| `src/audio/` | Procedural sound (Web Audio): ambience, a plucked-string score, effects. |
| `tests/` | 46 rules tests, including full AI games for all eight Houses at 2, 3 and 4 players. |
| `tools/` | `sim.mjs` (AI vs AI statistics), `serve.mjs`, `shots.mjs` and `play.mjs` (headless-browser screenshots and full playthroughs through the real interface). |
| `docs/` | `RULES.md` (every rule decision and source conflict), `ART_DIRECTION.md`, `source/` (the original bundle, unchanged). |

```sh
npm test                      # rules tests
node tools/sim.mjs 300 4      # AI balance over 300 games
node tools/play.mjs Raven 3 1440x900            # a full game through the UI in headless Chrome
node tools/play.mjs Wren 4 390x844 mobile       # the same on a phone viewport
```

## Rules

The rules are those of `docs/source/HOW_TO_PLAY.md`, the reference sheet and the card sheet, with
the engine values of `config.py`. Where the sources were silent or disagreed, the decision taken
is listed in `docs/RULES.md` (R1–R28). The newer `BALANCE_LOG.md` and `MODEL_SCOPE.md` referenced
by the design document did not survive and could not be recovered from Git history.

## Credits

See `CREDITS.md`.
