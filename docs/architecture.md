# Architecture

git-trains is a Node 24 Action and CLI with a static browser interface. Both interfaces use the same plain ES modules. The Action runs directly; the site needs no bundler.

| Boundary | Ownership |
| --- | --- |
| Activity | Contribution summaries, car counts, language colors, seasons and unlock rules |
| Graphics | Pixel grid, font and color blending |
| Trains | Catalog, geometry, palette, validation, regular/special cars and locomotive drawing |
| Landscape | Presets, skyline/region parsing and drawing |
| Scene | Layout, themes, sky, terrain, rails, backdrop and composition |
| Formats | Cards, calendar and annual review; annual calculation is separate from rendering |
| GitHub | Shared request retry policy plus user and repository response interpretation |
| Interfaces | Action, terminal CLI, static pages and studio controllers |
| Tooling | PNG/GIF codecs, raster export, community validation/previews, conductor |

The dependency direction is interface → domain/rendering → graphics and validation primitives. Core modules use browser-compatible APIs; Node filesystem and process APIs stay in adapters and tooling. `npm run check:architecture` parses modules without executing them and rejects missing imports, cycles, forbidden boundaries and modules over 400 lines.

## Entries and paths

- [`src/index.js`](../src/index.js) invokes the Action adapter. [`action.yml`](../action.yml) keeps the existing public input and output interface.
- [`bin/git-trains.js`](../bin/git-trains.js) parses terminal arguments and delegates to `src/cli/`.
- Root HTML files retain their published locations. Their scripts and styles are in `assets/<page>/`.
- `src/studio/train/` and `src/studio/skyline/` separate controllers, fields and JSON formatting. Skyline canvas interaction is a separate module. Form/canvas factories receive explicit session contexts; importing them does not access the DOM.
- `src/sharing/codec.js` owns bounded sharing for both browser and CLI.
- `config/action-inputs.js` owns enums and legacy input mappings. Environment reads and custom file loading live in `src/action/inputs.js`; filesystem/workflow writes live in `outputs.js`.

## Assets and data

New site resources belong in `assets/`. Existing generated images remain under `docs/` to preserve README embeds and public URLs. `scripts/docs.js`, `scripts/logo.js` and the social export command own those outputs; hand edits will fail the generated-asset check.

`examples/` holds documented starter JSON, `community/` holds contributed designs and its generated index, and `benchmarks/` preserves comparison evidence. The old `comparativa/medellin/` page is an intentional redirect. None is an orphaned duplicate.

The Action's sample mode and interactive pages both use `src/demo/sample.js`. Keep it available in production checkouts.

## Verification

Run `npm ci` then `npm run check`. There is no compile target: production targets are exercised by sample Action integration tests, CLI fixture tests, deterministic asset generation and static-module validation. The preview server serves only explicit public directories and rejects traversal, dotfiles and symlink escapes.

`npm test` selects only `tests/**/*.test.js`; the fake AI fixture is launched only by its owning tests. Linux CI covers symlink behavior unavailable to unprivileged Windows sessions. Live GitHub jobs remain in CI and need their workflow token.

## Dependency maintenance

Development tools are exact versions. The `minimatch` override selects the patched 11.0.1 release used by the supported ESLint toolchain; retain it until upstream ranges include a patched release. Run `npm audit` after changing the toolchain and validate with `npm ci` and `npm run check`.
