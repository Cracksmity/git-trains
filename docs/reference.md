# Inputs and models

[git-trains](../README.md)

## Options

| Input | Default | What it does |
| --- | --- | --- |
| `train` | `auto` | `auto` evolves with your cars; or pick a [model](#models); or the path to [your own train](customization.md#make-your-own-train-by-hand-or-with-ai) in JSON |
| `skyline` | `city` | `city` (procedural, unique to you), `new-york`, `osaka` or the path to [your own skyline](customization.md#city-skylines) in JSON |
| `mode` | `single` | `single`: one train in your top language · `multi`: 3 tracks, one train per language, running opposite ways |
| `calendar` | `false` | `true` also writes the animated contribution calendar (see above) |
| `year-in-review` | `false` | `true` also writes `year-in-review.svg`: a poster of one calendar year, drawn as a train journey (see [Year in review](usage.md#year-in-review)) |
| `review-year` | current year | The year the poster shows (2008 to the current one). Empty: the current year so far, or the year that just ended in January |
| `seasons` | `true` | `true` dresses the scene for the season or holiday of the day it runs; `false` keeps it plain (see [Seasons and holidays](usage.md#seasons-and-holidays)) |
| `hemisphere` | `north` | `north` or `south`: which hemisphere the seasons follow. Holidays keep their dates |
| `theme` | `both` | `both` writes `train-light.svg`, `train-dark.svg` and `train.svg` (automatic); or `light`, `dark`, `auto` |
| `language` | `en` | `en` or `es`: the word on the sign (`STREAK` / `RACHA`), the image title and the card texts |
| `label` | from `language` | Word on the LED sign (overrides `language`) |
| `exclude-languages` | | Comma-separated languages to leave out, e.g. `HTML, Jupyter Notebook` |
| `unlocks` | `true` | Add a special car when you earn it (see [Unlockable cars](usage.md#unlockable-cars)); `false` skips the extra API request |
| `scale` | `2` | Size of each pixel (1 to 6) |
| `user` | repo owner | User to draw |
| `repo` | | `owner/name`: draw a repository instead of a user (see [In a repository README](usage.md#in-a-repository-readme)); `user` is then ignored |
| `github-token` | `github.token` | Use a PAT to count private contributions |
| `output-dir` | `dist` | Output folder |
| `cards` | `none` | Profile cards: `stats`, `languages`, `departures` or `both` (stats and languages); a list works too, e.g. `stats, departures` (see below) |
| `rank` | `letter` | Center of the stats card ring: `letter` (S, A+, B...) or `github` (the logo) |
| `border` | `true` | Card border |
| `max-languages` | `6` | Languages on the languages card (1 to 10) |
| `color-background`, `color-title`, `color-icon`, `color-text`, `color-ring` | GitHub dark | Card colors, hex without `#` |

The default `GITHUB_TOKEN` with `contents: read` is sufficient for reading the current repository and public data; publishing generated files requires `contents: write`. An optional PAT may expose private contributions visible to its owner. Store it as an Actions secret, grant only the access required, and review the generated SVGs before publishing: public images can reveal activity derived from private contributions.

Outputs: `files`, `cars`, `streak`, `state`, `model`.

> Coming from 0.x? The Spanish input names (`tren`, `fondo`, `modo`, `tema`, `idioma`...) and model ids (`tranvia`, `metro-blanco`, `bala`...) still work and log a deprecation warning. The output files are now `train-*.svg` and `card-*.svg`: update the paths in your README. See the [changelog](../CHANGELOG.md).
## Models

| id | Inspired by | Power |
| --- | --- | --- |
| `tram` | SITEUR TEG-90, Guadalajara: wine red with white stripes, two articulated bodies on a shared bogie | Overhead wire |
| `metro-orange` | Mexico City Metro NC-82: faceted front and rubber tyres | Guide bar |
| `metro-gray` | São Paulo Metro L fleet (like the L43): fluted stainless steel and a black mask | Third rail |
| `metro-yellow` | Refurbished Los Angeles A650: yellow front with an emergency door in the middle | Third rail |
| `metro-white` | Alstom Metropolis of Guadalajara Line 3: dark window band and black face | Overhead wire |
| `bullet` | High-speed train | Overhead wire |

With `train: auto` the model moves up as you gain cars: tram → orange metro → gray metro → yellow metro → white metro → bullet train.

Every train has a cab at both ends (white headlights in front, red lights at the back). The overhead wire only shows up over trains with a pantograph; the rest run on a third rail.

![Three tracks](example-multi.svg)
