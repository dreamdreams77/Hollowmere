# Art direction

**One idea: a living miniature of the Hollowmere, standing on a walnut table, and an illuminated
manuscript that keeps its accounts.** The world and the page are two faces of the same object.

## Where it comes from

The repository's art fork, lemo-opuscar, is a library of film styles for coding agents. Its useful
parts here are its three.js r170 post-processing (depth of field, ambient occlusion, bloom, grade),
its merged-geometry builder, its typefaces and textures, and its art-direction guides. Two guides
fit Hollowmere and were combined:

- **Tilt-Shift Miniature** for the board: a real-looking place seen from high above through a tilted
  lens, so it reads as a model. Kept: the high oblique camera, the sharp band that follows what you
  are looking at (it tracks the camera target), saturated model-paint colour with clean shadows,
  a hard sun moved for each Season, and model-like detail (walls, roofs, landmarks, small figures).
  Changed for play: the blur is gentle so every Plot stays readable, and the camera never goes below
  a playable angle.
- **Gilded Illumination** for everything you read: heraldry, cards, panels, portraits. Kept: flat
  mineral pigments in firm ink outlines; white-lead highlights and dots; gold as leaf laid in
  squares with seams, cracks and red bole, never a flat yellow; ultramarine grounds with gold stars;
  vermilion for what matters; IM Fell English.

## Rules the game follows

- **Every mark means something.** A manor is one Influence marker; a castle is a Keep; each squad
  of three soldiers is one Legion; a veiled shrine is a Cabal token; crossed blades mark a Plot
  that can be recaptured; coloured borders show who controls a Plot; glowing borders are legal
  targets. Banners and shields carry the House arms.
- **Houses are recognisable at a glance**: each has a field colour, an accent, a charge (flaming
  sword, wheat sheaf, bezants, thorned rose, wren, veiled eye, quill, raven) and roofs in its colour.
- **Terrains are distinct**: patchwork fields and a windmill for Grain, forest and a sawmill for
  Timber, terraced quarries for Stone, dark crags with a smoking forge for Iron, marsh pools and
  stilt houses for Reed, a market town for Coin, an abbey on a hill for Lore. The Sellen and the
  Varra run along the Plot borders exactly as on the printed board and meet the sea at the Delta
  Mouth.
- **Seasons change the world**: fresh spring greens, high summer, autumn ochre with falling leaves,
  winter snow on every upward face; each Flood swells the rivers under rain.
- **Nothing is a placeholder.** Buildings, figures and cards are modelled or painted for this game;
  there are no stand-in cubes and no stock images.

## Palette

Ultramarine `#22379a`, lapis `#16235f`, vermilion `#c8321f`, verdigris `#3f8f7a`, ink `#2a1a10`,
vellum `#efe2c4`, gold leaf (texture, mid `#c99a3e`). House colours are in `src/rules/data.js`.
