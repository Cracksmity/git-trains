# Regional countryside art: the shared brief

git-trains is a dependency-free Node GitHub Action that draws a person's GitHub activity as an animated pixel-art train in front of a city skyline. A skyline JSON file can now carry an optional `region` block: the houses, trees, plants and landmark of the countryside around its city, plus a terrain and up to four accent colors. You are drawing those blocks. Everything is pixel art: you write the drawings as rows of symbols inside JSON.

Read these first, in this order:

1. `docs/ai/region.md`: the format, the symbols, the limits, where each part is drawn, and one complete worked example (Córdoba). This is your specification.
2. `docs/research/regions.md`: the research for the eight regions, with, for each house, plant and landmark: its size in pixels (width x height), its colors as hex, and its distinctive detail. Draw from it: same sizes (within about 2 px), same colors, same detail.
3. `src/region.js` (the validator and the painter) and the `paintBandFront` / `paintTerrain` functions of `src/scenery.js` (how the drawings are placed). Do not edit them.

## Looking at your work

Do not draw blind. Two small tools write PNGs you can open:

```bash
# every drawing of a region, zoomed, light on the left and dark on the right
node scripts/region-sheet.js <skyline id or path.json> .scratch/sheet.png 8
# the real scene in multi mode (the countryside shows between the tracks)
node scripts/export.js --skyline <skyline id or path.json> --mode multi --theme light --out .scratch/light --seconds 1 --fps 1 --scale 4
node scripts/export.js --skyline <skyline id or path.json> --mode multi --theme dark --out .scratch/dark --seconds 1 --fps 1 --scale 4
```

`.scratch/` is git-ignored. Iterate: draw, render, look, fix. The scene shows each strip 40 px tall and the train on the track below covers its lower 25 px, so what people see is the top half of every drawing: put the identifying shape (the roof, the crown, the sails) up there. Houses, trees and plants are mirrored at random.

For a built-in skyline id (`osaka`, `new-york`) the region is read from `src/regions.js`; for a file it is the `region` key.

## What good looks like

- **Recognizable at 1x.** A minka farmhouse reads as a steep thatched roof with deep eaves, not as a brown box; an agave reads as a rosette, not a tree. Real pixel art: clean shapes, few colors, a light and a shaded tone per mass (`l` and `d` for leaves, an accent and `#`/`t` for the rest), no noise.
- **True to the research.** Same sizes, same hex colors, same distinctive detail. Do not invent: if the research does not say it, keep it simple.
- **Variety.** The trees of one region must look like different species (different silhouette and color), not recolors of one blob. Two houses are better than one when the research gives two variants.
- **Both themes.** The symbols `# w r t l d` take the theme colors (day and night), the accents `1-4` have a `light` and a `dark` value. Pick `dark` as the same color darkened and slightly desaturated (about 40-55 % as bright) so it sits in a night scene; windows (`w`) light up by themselves at night.
- **Use the accents for what has a color of its own** (thatch, adobe, blossom, agave blue, violet jacaranda, vermilion): at most four per region, so choose the four that matter most and map the rest to the theme symbols.
- **The terrain** is the one named in your task.

## Hard rules

- Only edit the files your task allows. The rest of the repository (including `src/scene.js`, `src/cards.js`, `src/github.js`, `src/index.js`, `studio/`, `bin/`) is off limits.
- No letters, signs or logos in any drawing.
- Each drawing: all rows, a last row with pixels (the ground), only the symbols `. # w r t l d 1 2 3 4`, and no accent that is not defined. The validator (`parseSkyline`) lists every problem; the gates run it.
- Every drawing is within its limit: houses up to 24 x 16, trees 20 x 22, plants 16 x 12, landmark 32 x 28. Aim for the researched sizes, not the limits.
- Give every house, tree, plant and the landmark a `name` (a note: it is not drawn).
- `region.source` (optional note): list the sources of the research file for that region, short.
- English in names and notes. JSON formatted like the files in `examples/skylines/`: two-space indent, one drawing row per line.
- Do not run `git commit`.
