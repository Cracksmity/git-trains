# Contributing

Thanks for wanting to make the trains better. Everything runs on plain Node 24 with no dependencies.

```bash
npm test           # the whole suite, about a second
npm run preview    # the playground at http://localhost:4173
npm run docs       # regenerates docs/*.svg after a visual change
npm run export     # a sample scene as PNG and animated GIF, in sample/ (options atop scripts/export.js)
npm run export -- social   # docs/social.png and docs/og.png, the share images
npm run community  # checks community/ and rebuilds community/index.json
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

Add it to the community depot: a pull request with one file, `community/trains/<id>.json` or `community/skylines/<city>.json`, with `name`, `description` and `author`. Run `npm run community` and commit the regenerated `community/index.json` with it. A check validates it and comments with a preview; [community/README.md](community/README.md) has the rules. If the index conflicts, update your branch and regenerate it.

`examples/` stays as the small set the docs and the playground point to.

## Before opening a pull request

- `npm test` passes.
- After a visual change, `npm run docs` and commit the regenerated `docs/*.svg` (CI checks they are up to date). If it shows in the share images too, `npm run export -- social`.
- Changed a layer or an animation in `src/scene.js` or `src/scenery.js`? `scripts/export.js` paints the same grids and samples the same timing for PNG and GIF: keep them in step (`test/export.test.js` checks the basics).
- If you changed an input, a model or a skyline id, update `README.md` and `README.es.md`.

## Working with the conductor

Bigger mechanical jobs (translations, sweeping renames, research) can be delegated to Codex or Antigravity with [tools/conductor](tools/conductor). Read the patch before you apply it: the gates catch a lot, not everything. The conductor logs every attempt, and `npm run leaderboard` merges your logs into `docs/leaderboard.json` for the [AI leaderboard](https://cracksmity.github.io/git-trains/leaderboard/): commit that file with the work the runs did.

## Security and repository maintenance

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Maintainers should enable private vulnerability reporting and Dependabot security updates; keep secret scanning and push protection enabled. Once the pull-request index workflow reaches main, require pull requests and the `test`, `action`, and `action-repo` CI checks. CODEOWNERS requests review; require code-owner approval when a second eligible reviewer is available. Review Dependabot action-pin updates against upstream releases. GitHub settings are configured separately from this repository.

After the pull-request index workflow is deployed to `main`, an administrator can activate the prepared rule with `gh api -X PUT repos/Cracksmity/git-trains/branches/main/protection --input .github/main-protection.json`. It requires the three CI checks and pull requests without approvals; administrators can bypass the rule until `enforce_admins` is enabled. Review the rule and add a second eligible reviewer before requiring code-owner approval.
