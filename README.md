# git-trenes

**English** · [Español](README.es.md)

A GitHub Action that turns your public activity into a **pixel-art train** and saves it as an animated SVG for your profile README. It's the train version of [git-koi](https://github.com/yalongwastaken/git-koi).

![Example train](docs/ejemplo-claro.svg)

## What each part means

| Your activity | On the train |
| --- | --- |
| Contributions in the last year | **Cars**, from 1 to 6 (50 / 200 / 500 / 1000 / 2000) |
| Top language | A **stripe** in that language's official GitHub color |
| Current streak | LED sign **"STREAK 12"** and lit windows (30 days = all of them) |
| What you did yesterday | **0**: stopped with its doors open · **1-3**: slow · **4-9**: normal · **10+**: fast, with sparks and speed lines |
| Same activity | A **signal** by the track: red (0), amber (a little) or green (normal or a lot) |

Your streak doesn't break first thing in the morning: if there's no activity yet today, it counts from yesterday.

## Usage

Create `.github/workflows/tren.yml` in your profile repository (the one named after your username):

```yaml
name: GitHub train
on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:
permissions:
  contents: write
jobs:
  train:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: Cracksmity/git-trains@main
        with:
          idioma: en # the LED sign reads STREAK instead of RACHA
      - run: |
          git config user.name "git-trenes"
          git config user.email "git-trenes@users.noreply.github.com"
          git add dist
          git diff --cached --quiet || (git commit -m "chore: update train" && git push)
```

Then add this to your `README.md` so it follows GitHub's light or dark theme:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="dist/tren-dark.svg">
  <img alt="My GitHub train" src="dist/tren-light.svg">
</picture>
```

## Options

The inputs keep their original Spanish names.

| Input | Default | What it does |
| --- | --- | --- |
| `tren` (train) | `auto` | `auto` evolves with your cars; or pick a model (see below); or the path to [your own train](#make-your-own-train-with-ai) in JSON |
| `fondo` (background) | `ciudad` | `ciudad` (random city), `nueva-york`, `osaka` or the path to [your own skyline](#city-skylines) in JSON |
| `modo` (mode) | `single` | `single`: one train with your top language · `multi`: 3 tracks, one train per language, going opposite ways |
| `tema` (theme) | `both` | `both` writes `tren-light.svg`, `tren-dark.svg` and `tren.svg` (automatic); or `light`, `dark`, `auto` |
| `idioma` (language) | `es` | `es` or `en`: the word on the sign (`RACHA` / `STREAK`) and the card texts |
| `etiqueta` (label) | depends on `idioma` | Word on the LED sign (overrides `idioma`) |
| `escala` (scale) | `2` | Size of each pixel (1 to 6) |
| `usuario` (user) | repo owner | User to draw |
| `github-token` | `github.token` | Use a PAT to count private contributions |
| `salida` (output) | `dist` | Output folder |
| `tarjetas` (cards) | `none` | Profile cards: `stats`, `langs` or `both` (see below) |
| `rango` (rank) | `letra` | Center of the stats card ring: `letra` (S, A+, B...) or `github` (the logo) |
| `borde` (border) | `true` | Card border |
| `lenguajes-max` | `6` | Languages on the languages card (1 to 10) |
| `color-fondo`, `color-titulo`, `color-icono`, `color-texto`, `color-anillo` | GitHub dark theme | Card colors (background, title, icon, text, ring), hex without `#` |

Outputs: `archivos` (files), `vagones` (cars), `racha` (streak), `estado` (state), `modelo` (model).

## Profile cards

With `tarjetas: both` the Action also writes `tarjeta-stats.svg` and `tarjeta-lenguajes.svg`: a stats card (stars, commits in the last year, PRs, issues and repos you contributed to, with a rank ring) and a card with your most used languages. They follow the layout of the [github-readme-stats](https://github.com/anuraghazra/github-readme-stats) cards, but they're **generated inside your workflow** with this project's own code: no external service that can go down, and no third-party actions.

![Stats](docs/tarjeta-stats.svg) ![Languages](docs/tarjeta-lenguajes.svg)

```yaml
      - uses: Cracksmity/git-trains@main
        with:
          tarjetas: both
          idioma: en
          rango: github
          borde: "false"
          color-fondo: 0F1115
          color-titulo: C9A04A
          color-icono: 12A5A5
          color-texto: EEE8DC
          color-anillo: C9A04A
```

If the stats query fails (for example, an API limit), the Action logs a `::warning::` and keeps going: the train is still generated. The rank is an approximation (a weighted mix of commits, PRs, issues, reviews, stars and followers). To count private contributions, use a PAT in `github-token`.

![Three tracks](docs/ejemplo-multi.svg)

## Models

| id | Inspired by | Power |
| --- | --- | --- |
| `tranvia` | SITEUR TEG-90, Guadalajara: wine red with white stripes, two articulated bodies on a shared bogie | Overhead wire |
| `metro-naranja` | Mexico City Metro NC-82: faceted front and rubber tyres | Guide bar |
| `metro-gris` | São Paulo Metro L fleet (like the L43): fluted stainless steel and a black mask | Third rail |
| `metro-amarillo` | Refurbished Los Angeles A650: yellow front with an emergency door in the middle | Third rail |
| `metro-blanco` | Alstom Metropolis of Guadalajara Line 3: dark window band and black face | Overhead wire |
| `bala` | High-speed train | Overhead wire |

With `tren: auto` the model moves up as you gain cars: tram → orange metro → grey metro → yellow metro → white metro → bullet train. The old name `suburbano` still works as `metro-blanco`.

Every train has a cab at both ends (white headlights in front, red lights at the back). The overhead wire only shows up over trains with a pantograph; the rest run on a third rail.

## Make your own train (with AI)

Any train fits in a small JSON file: colors, stripes, doors, and the front drawn row by row. You don't need to code; an AI writes it from a photo or a description:

1. Paste [docs/ia/tren.md](docs/ia/tren.md) into your AI chat (Claude, ChatGPT, Gemini...) and, at the end, describe your train or attach a photo. The instructions are in Spanish; any current AI follows them and you can talk to it in English.
2. Save the JSON it gives you in your profile repository, for example as `.github/tren.json`.
3. In the workflow, use `tren: .github/tren.json`.

```yaml
      - uses: Cracksmity/git-trains@main
        with:
          tren: .github/tren.json
          fondo: nueva-york
          idioma: en
```

If something doesn't add up (a mistyped color, an extra row), the Action stops and lists **every** problem in the log; paste them back to the AI so it fixes them. In the playground (`npm run preview`) you can paste the JSON and see it right away, with the same error messages.

![New York subway](docs/ejemplo-nueva-york.svg)

Examples: [examples/tren-nueva-york.json](examples/tren-nueva-york.json), inspired by New York's R160 subway cars, and [examples/tren-osaka.json](examples/tren-osaka.json), based on Osaka Metro's 400 series. The format uses the same keys as [src/models.js](src/models.js), so a train people love can join the catalog as is. The file is only read as data: nothing in it runs, and every color and size is checked before drawing.

## City skylines

There's a city behind the train. By default it's random; with `fondo: .github/fondo.json` it's yours. Two come built in:

| `fondo` | What you see |
| --- | --- |
| `nueva-york` | One World Trade Center, Empire State, Chrysler, the Brooklyn Bridge and the Statue of Liberty |
| `osaka` | Shitennō-ji pagoda, the Ferris wheel, Tsutenkaku, Abeno Harukas, the Umeda Sky Building, a cable-stayed bridge and the castle |

A skyline is a list of pixel-art buildings, **without too much detail**: each one is a block with a top (stepped, spire, antenna, dome, pyramid) or a row-by-row drawing for landmarks with their own shape. It has no colors of its own: it uses the theme's, so it switches between light and dark by itself and the windows light up at night. To make yours, paste [docs/ia/fondo.md](docs/ia/fondo.md) into your AI with the city you want or a photo. Example: [examples/fondo-cdmx.json](examples/fondo-cdmx.json) (Mexico City).

The photo is only a reference: what gets saved is the silhouette, never the image.

![Osaka](docs/ejemplo-osaka.svg)

This is how Osaka came out from two photos (a skyline and a 400 series train on the Chuo line), following those same instructions: the background is `fondo: osaka` and the train is [examples/tren-osaka.json](examples/tren-osaka.json).

## How it works

- No dependencies and no build step: plain JavaScript (Node 24) that runs directly on the runner.
- Every train is drawn **in code on a shared grid** (64 px cars with 2 or 3 doors per side, bogies with two 7 px disc wheels, frame and axle boxes, painted with each model's palette), not from images. The layers (body, doors, wheels, sign, sparks) are animated separately.
- The result is a ~50 KB SVG (~80 KB in `multi` mode) with CSS: the train moves **1 px at a time** (`steps()`), the wheel disc marks alternate between two frames rotated 60°, the clouds drift slowly and the stars twinkle in the dark theme. It respects `prefers-reduced-motion`.
- The scene has a city, an embankment with bushes, overhead wire or a third rail depending on the train and, in `multi` mode, a different landscape behind each extra track (village, forest).
- The LED sign uses its own 3×5 pixel font; the train uses no SVG text, so it doesn't depend on fonts. (The cards do use text, in the viewer's system font.)

## Development

```bash
npm run preview    # playground at http://localhost:4173 (live controls)
npm run muestra    # writes SVGs from sample data to ./muestra
npm test           # tests
node scripts/sheet.js sheet.png 5 3 0   # zoomed PNG sheet of every model
node scripts/sheet.js mine.png 5 2 0 examples/tren-nueva-york.json   # ...or of a JSON train
INPUT_TREN=examples/tren-nueva-york.json INPUT_FONDO=examples/fondo-cdmx.json npm run muestra
node scripts/docs.js                    # regenerates the SVGs in docs/
```

To add a built-in skyline, add it to `SKYLINES` in [src/skyline.js](src/skyline.js).

To add a model, add an entry to [src/models.js](src/models.js) (palette, stripes, front shape) and its id to `MODEL_ORDER`.

The images in `reference/` are only a reference for color and shape; they aren't used in the SVG and the logos in them aren't reproduced.

## License

[MIT](LICENSE).
