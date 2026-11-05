# Contributing

Thanks for wanting to make the trains better. Everything runs on plain Node 24 with no dependencies.

```bash
npm test           # the whole suite, about a second
npm run preview    # the playground at http://localhost:4173
npm run docs       # regenerates docs/*.svg after a visual change
```

## Ground rules

- **No dependencies, no build step.** The Action runs `src/index.js` directly on the runner.
- **Pixel art in code.** Trains and skylines are drawn on a grid (`src/pixel.js`); no bitmaps go into the SVG.
- **Outside JSON is data.** Custom trains and skylines are validated field by field, and every problem is reported in one list, worded so a person can paste it back to an AI. Keep new fields to that standard.
- **No logos or lettering** from real operators: colors and shapes only.
- **English** for code, comments, messages and docs. User-facing texts have an `es` version (cards, sign word, image title, `README.es.md`).

## Adding a model to the catalog

1. Design it as a custom train first (see [docs/ai/train.md](docs/ai/train.md)) and check it in the playground.
2. Add it to `MODELS` in [src/models.js](src/models.js), with the same keys as the JSON, and to `MODEL_ORDER` if it should take part in the `auto` evolution.
3. `npm test` checks that it builds with 1 to 6 cars in both directions, fits the scene and has a cab at each end.

## Adding a built-in skyline

Add it to `SKYLINES` in [src/skyline.js](src/skyline.js). Keep tall towers away from `x < 90` (the station sign) and remember the train covers the bottom ~25 rows.

## Sharing your city or train

Open an issue or a pull request with the JSON under `examples/trains/` or `examples/skylines/`, plus a screenshot from the playground. Add a `description` saying which real train or city inspired it.

## Before opening a pull request

- `npm test` passes.
- After a visual change, `npm run docs` and commit the regenerated `docs/*.svg` (CI checks they are up to date).
- If you changed an input, a model or a skyline id, update `README.md` and `README.es.md`.

## Working with the conductor

Bigger mechanical jobs (translations, sweeping renames, research) can be delegated to Codex or Antigravity with [tools/conductor](tools/conductor). Read the patch before you apply it: the gates catch a lot, not everything.
