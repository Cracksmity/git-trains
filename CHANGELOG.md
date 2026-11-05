# Changelog

## Unreleased

### Added

- `calendar: true` writes an animated contribution calendar with a mini version of your train, including custom and steam models. It follows the scene's themes and reduced-motion setting.

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
