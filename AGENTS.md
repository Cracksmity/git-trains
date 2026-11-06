# Repository instructions

## Runtime and public contracts
- Node.js 24+, plain JavaScript ES modules, `.js` extensions in relative imports.
- No runtime dependencies and no compilation step. Development dependencies are exact versions in `package-lock.json`.
- Stable entries: `src/index.js` for the GitHub Action, `bin/git-trains.js` for the CLI.
- Keep Action input names, Spanish aliases, annotation escaping, output names and JSON error messages compatible.
- Preserve published routes: `/`, `/preview/`, `/studio/`, `/gallery/`, `/leaderboard/`, `/benchmarks/medellin/`, `/comparativa/medellin/`.
- Existing `docs/*.svg`, `docs/*.png`, `docs/leaderboard.json`, examples and community URLs are public contracts.

## Navigation
- `config/`: Action input enums and compatibility mappings; `action.yml` declares its public interface.
- `src/activity/`: statistics, language colors, seasons, unlock rules.
- `src/graphics/`, `src/trains/`, `src/landscape/`, `src/scene/`: pure pixel rendering and validated scene data.
- `src/cards/`, `src/calendar/`, `src/review/`: output formats. Review calculation lives separately in `data.js`.
- `src/github/`: HTTP retry policy and user/repository adapters. Tests inject fetch; do not require live tokens.
- `src/action/`, `src/cli/`: I/O adapters; `src/studio/`, `src/browser/`, `assets/`: browser interfaces.
- `src/sharing/`: bounded share-link codec, reused by CLI and browser.
- `src/demo/`: sample data used by the Action, pages and tests, not just fixtures.
- `tests/`: suites grouped by domain; `tests/fixtures/fake-ai.js` is a child-process fixture.
- `scripts/`: executable commands; `tools/`: reusable export, community and conductor implementations.
- See [architecture](docs/architecture.md) and [script reference](scripts/README.md).

## Commands — run from the repository root
```sh
npm ci
npm run check
npm test
npm run lint
npm run typecheck
npm run check:architecture
npm run check:docs
npm run preview
npm run sample
node --test tests/trains/custom.test.js
```
`npm run check:docs` compares 29 generated assets in memory and checks the community index, links and AI examples. Use `npm run docs`, `npm run logo` and `npm run export -- social` to intentionally regenerate images.

## Change rules
- Prefer feature folders, lower-case kebab-case filenames, named exports and explicit interfaces documented with JSDoc.
- Keep JavaScript modules at or below 400 lines; split responsibilities rather than compressing statements.
- Core rendering/activity modules may not import Node APIs or interface adapters. Nothing in `src/` imports `tools/`, `scripts/`, `tests/` or `assets/`.
- Keep the import graph acyclic. Shared geometry and colors belong below train rendering.
- Untrusted custom JSON is data: validate every field, collect all problems, enforce size limits, escape SVG text.
- Train validation deliberately checks rendered bounds; keep that validation until an equivalent bounded check exists.
- Preserve deterministic pixel output and random-number consumption. SVG and raster export share geometry and animation timing.
- Respect reduced motion, light/dark themes, English/Spanish output and all model directions.
- Browser fetch URLs are relative to the page; module imports are relative to the module. Do not rewrite them interchangeably.
- Readmes are concise entrypoints. Detailed guides are in `docs/` and `docs/es/`; update both languages for user-visible options.
- On Windows, symlink checks may lack privileges. Linux CI must exercise them; never silently remove those checks.
- Conductor task definitions are runnable examples: update their gates and allowlists when moving referenced files.
- Local `output/`, `.scratch/`, `.conductor/`, `.claude/`, `reference/`, `sample/` and `muestra/` are ignored working data. Do not delete them without understanding their purpose.
- When the user invokes `/graphify`, read the installed graphify skill before graph operations. Generated knowledge graphs do not replace source verification.

## Sensitive areas
- Changes to `.github/`, `action.yml`, the CLI's execution restrictions, share decoding or preview-server path validation need their existing regression checks.
- Do not run conductor tasks, external AI CLIs, publish workflows or deployments as incidental verification.
- Never record tokens, prompts, local usernames or private paths in the published leaderboard.
