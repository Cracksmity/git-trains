Read `tools/conductor/tasks/regions-brief.md` first: it is the brief for this task.

Draw the regions of the two built-in skylines, in `src/regions.js` (the only file you may edit). Today it holds placeholders:

```js
export const REGIONS = {
  osaka: { terrain: 'mountains' },
  'new-york': { terrain: 'hills' },
};
```

Replace each with a complete region object (plain JS object literals with the same shape as the JSON `region`, drawings as arrays of strings; keep the file's header comment, and add one short comment line per region saying what it is based on). `src/skyline.js` already uses `REGIONS.osaka` and `REGIONS['new-york']` as the `region` of the two presets.

1. **osaka**: Kansai, Japan (research section 1). Terrain `mountains` (layered mountains behind the villages). Houses: the minka farmhouse (one, or two variants: the thatched one and a tiled one if you can keep both recognizable). Trees: the mountain cherry (yamazakura), the Japanese red pine, the Japanese maple. Plants: at least one low plant for the slope and the fields (for example tea bushes in a row, rice seedlings or a low azalea clump; keep it to what Kansai really has). Landmark: the shrine torii, `place: "village"`. Accents (up to 4): thatch, cherry blossom, maple red and torii vermilion are the natural four; the rest map to the theme symbols.
2. **new-york**: Hudson Valley, United States (research section 5). Terrain `hills`. Houses: the early stone farmhouse (with its squat end chimney). Trees: the sugar maple, the eastern white pine, the white oak. Plants: at least one low plant (for example goldenrod or a clump of tall grass, a low berry shrub, a cornstalk row). Landmark: the New World Dutch barn, `place: "village"`. Accents: stone wall gray, autumn orange, barn timber and shingle roof are good candidates.

Check each region with `node scripts/region-sheet.js osaka .scratch/osaka.png 8` and in the scene (see the brief). The gates run `node tools/conductor/gates/region-art.js osaka:mountains new-york:hills` and the tests.
