# Developer commands

Run commands from the repository root with Node 24+. `npm ci` installs lint/type tools; runtime commands use Node built-ins only.

| Command | Effect / output |
| --- | --- |
| `npm run preview` | Local playground at `http://127.0.0.1:4173`; accepts a port with `npm run preview -- 4174` |
| `npm run sample` | Offline Action output in ignored `sample/` |
| `npm test` | All `tests/**/*.test.js`; fixtures are excluded from discovery |
| `npm run lint` | ESLint across JavaScript source, tools, pages and tests |
| `npm run typecheck` | JSDoc/JavaScript checking, no emitted files |
| `npm run check:architecture` | Parse imports, detect cycles, enforce boundaries and 400-line limit |
| `npm run check:docs` | Compare generated assets in memory; check index, relative links and guide JSON |
| `npm run check` | All checks above, including tests |
| `npm run docs` | Regenerate the committed example SVGs in `docs/` |
| `npm run logo` | Regenerate the committed logo and favicon SVG/PNG files |
| `npm run export` | Sample PNG/GIF outputs in ignored `sample/` |
| `npm run export -- social` | Regenerate `docs/social.png` and `docs/og.png` |
| `npm run community` | Validate designs and regenerate `community/index.json` |
| `node scripts/community.js --check` | Validate designs without writing the index |
| `node scripts/community.js preview --out sample/community community/trains/nyc-subway.json` | Local preview sheet and SVG/PNG files |
| `npm run leaderboard -- --dry-run` | Inspect a merge of local conductor logs without writing the published board |
| `npm run leaderboard` | Merge safe, validated log fields into `docs/leaderboard.json` |
| `node scripts/sheet.js sample/models.png 5 3 0` | Zoomed model contact sheet |
| `node scripts/region-sheet.js examples/skylines/guadalajara.json sample/region.png` | Regional art contact sheet |

`export.js` and `community.js` are thin command entrypoints. Reusable implementations live in [`tools/export/`](../tools/export) and [`tools/community/`](../tools/community). The conductor has a separate [execution guide](../tools/conductor/README.md); running checks never launches an external AI agent.
