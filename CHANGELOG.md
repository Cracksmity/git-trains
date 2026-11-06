# Changelog

## Unreleased

### Added

- **AI leaderboard.** A [page](https://cracksmity.github.io/git-trains/leaderboard/) on the site that shows which AI did which task in the conductor: one row per model with its tasks, first-try pass rate, median time, tokens, the routes it served and where it fell back to the next model, then a log of every task run. It reads `docs/leaderboard.json`, which `npm run leaderboard` builds by merging the conductor's `.conductor/runs.jsonl` logs (every git worktree of the checkout, plus `--from <file>` for other machines). Only the date, task id, route, backend, model, effort, attempt, result with the name of the check that failed, seconds and tokens are kept, never prompts, file paths or the user name, and a run already in the file is not added again. A run where the agent crashed before doing anything (a usage limit, say) is listed but does not count against the model. The page links to the Medellín benchmark, and the home page, both READMEs and the conductor README link to the page.
- **Seasons and holidays.** The scene now changes with the date the Action runs (UTC), so a profile feels alive all year: light snow with snow on the roofs and the ground in winter, drifting pink petals in spring, orange leaves in autumn, nothing in summer. A holiday wins over the season: Día de Muertos (Oct 31 – Nov 2, marigold papel picado along the line), Christmas (Dec 15 – Jan 6, blinking lights on the wire), Hacktoberfest (October, a pumpkin by the signal) and New Year (Dec 31 – Jan 1, fireworks behind the city). It is a few pixels on their own layers, behind the train, and stops with `prefers-reduced-motion`. New inputs: `seasons` (`true` by default; `false` keeps the scene plain) and `hemisphere` (`north` or `south`, which flips the seasons; holidays keep their dates). A day with no decoration draws exactly the same SVG as before. The playground has a date picker to preview any day, and `buildSpec` and `renderScene` accept a `date`.
- **Departures board card.** `cards: departures` writes `card-departures.svg`: a split-flap station board (TIME, DESTINATION, PLATFORM, STATUS) with your six most recently pushed public repositories. The status is `BOARDING` (pushed today), `ON TIME` (last 7 days), `DELAYED` (last 30) or `DEPARTED`; the characters flip into place with CSS only and it respects reduced motion. It reads `SALIDAS`, `ANDÉN`... with `language: es` and takes the same colors and border as the other cards. `cards` now accepts a list (`stats, departures`); `both` still means stats and languages. The profile repository is left out of the board.
- **Unlockable cars.** A special car joins the train, right behind the cab, when you earn it: a **dining car** (round windows, a lamp) for a 100-day streak, an **observation car** (glass roof) for 100+ stars, a **mail car** (no windows, a stripe) for 500+ pull requests. Only the rarest one is shown and the image title says which. It needs your profile numbers, so there is one extra API request per run (skipped with a notice if it fails); `unlocks: false` turns it off. With nothing earned the SVGs are exactly the same as before.
- A skyline can bring its region's countryside. The optional `region` block of a skyline JSON draws its own houses, trees, plants and landmark in the strips between tracks (and its plants on the slope in front of the city), a terrain (`hills`, `mountains`, `plains` or `sea`) behind them, and up to four accent colors with a light and a dark value, so they follow the theme. Osaka shows minka farmhouses, cherry trees and a torii; New York a Hudson Valley stone farmhouse and a Dutch barn. Mexico City, Medellín and the two new examples, Guadalajara and Malmö, carry theirs too. Without a `region` the countryside is exactly what it was. [docs/ai/region.md](docs/ai/region.md) tells an AI how to research a region and write the block; `node scripts/region-sheet.js <skyline>` draws its pieces zoomed in.
- `git-trains design`: one command has the AI CLI you already use (Codex, Antigravity or Claude Code) design a train or a skyline from a description and photos: `npx github:Cracksmity/git-trains design train "Osaka Metro 400 series" --photo train.jpg`. The agent runs headless and read-only in an empty temporary folder and only its answer is read; the JSON goes through the same validator as the Action and, if it fails, the problem list goes back for another try (`--tries`, 3 by default). On success it writes `.github/train.json` or `.github/skyline.json`, draws a preview in the terminal and prints a studio link to tweak it. Adds `bin/git-trains.js` (the `bin` of the package); still no dependencies.
- The [studio](https://cracksmity.github.io/git-trains/studio/): design a train by hand, with every field as a form, the nose or locomotive drawn pixel by pixel (over a photo if you like), a live preview with the calendar mini, and share links that carry the whole train in the URL (`studio/#train=...`).
- `calendar: true` writes an animated contribution calendar with a mini version of your train, including custom and steam models. It follows the scene's themes and reduced-motion setting.
- The community depot: anyone can add their city's train or skyline to `community/` with a pull request. A check validates it, draws light and dark previews and comments with them, and the [gallery](https://cracksmity.github.io/git-trains/gallery/) shows every entry live, with a link to open it in the studio. `npm run community` checks the depot and rebuilds `community/index.json`.

## 1.0.0 (2026-11-04)

The project is **git-trains** everywhere now, and it speaks English first. Everything from 0.x keeps working, with deprecation warnings, except the output file names.

### Breaking

- Output files are renamed. Update the paths in your README:

  | 0.x | 1.0 |
  | --- | --- |
  | `tren-light.svg`, `tren-dark.svg`, `tren.svg` | `train-light.svg`, `train-dark.svg`, `train.svg` |
  | `tarjeta-stats.svg` | `card-stats.svg` |
  | `tarjeta-lenguajes.svg` | `card-languages.svg` |

- `language` (formerly `idioma`) defaults to `en`: the sign reads `STREAK`. Set `language: es` to keep `RACHA` and Spanish cards.
- The Action's outputs are `files`, `cars`, `streak`, `state` and `model` (formerly `archivos`, `vagones`, `racha`, `estado`, `modelo`).
- `npm run muestra` is now `npm run sample` and writes to `./sample`.

### Renamed, old names still accepted

- Inputs: `usuario` → `user`, `tren` → `train`, `fondo` → `skyline`, `modo` → `mode`, `tema` → `theme`, `idioma` → `language`, `etiqueta` → `label`, `escala` → `scale`, `salida` → `output-dir`, `tarjetas` → `cards`, `rango` → `rank`, `borde` → `border`, `lenguajes-max` → `max-languages`, `color-fondo` → `color-background`, `color-titulo` → `color-title`, `color-icono` → `color-icon`, `color-texto` → `color-text`, `color-anillo` → `color-ring`. A Spanish input that is set wins over its English twin and logs a warning.
- Values: `rank: letra` → `letter`, `cards: langs` → `languages`.
- Models: `tranvia` → `tram`, `metro-naranja` → `metro-orange`, `metro-gris` → `metro-gray`, `metro-amarillo` → `metro-yellow`, `metro-blanco` (and `suburbano`) → `metro-white`, `bala` → `bullet`. Also inside custom trains (`"nose": "bala"`).
- Skylines: `ciudad` → `city`, `nueva-york` → `new-york`.
- AI guides: `docs/ia/tren.md` → `docs/ai/train.md`, `docs/ia/fondo.md` → `docs/ai/skyline.md`. Examples moved to `examples/trains/` and `examples/skylines/`. The benchmark moved to `benchmarks/medellin/` (the old URL redirects).

### Added

- **A city of your own.** The procedural city (and its bushes, villages and ballast) is seeded with your username: every user gets a different skyline, the same one every day.
- `exclude-languages`: leave languages such as `HTML` or `Jupyter Notebook` out of the stripes and the cards.
- Retries with backoff when GitHub's API answers 5xx or the network blips.
- The image title follows `language` ("octocat's train: 4 cars, 12-day streak").
- CI on every push and pull request: tests, up-to-date example SVGs, links, the AI guides' examples, and the Action run end to end.
- A live train in the README, redrawn daily by this repository's own workflow onto the `output` branch.
- The playground shows the per-user city (type any username) and the sign language.
- `tools/conductor`: delegates tasks to Codex or Antigravity (Gemini), checks them with gates and escalates along a model ladder.
- Issue templates, a pull request template and a contributing guide.

## 0.x

Built in Spanish as **git-trenes**: the train, the six catalog models, multi-track mode, profile cards, custom trains and skylines designed by AI, steam locomotives, and the Medellín benchmark.
