Give the **year in review** poster of git-trains its pixel art, in `src/review/art.js`.

Context: git-trains draws a GitHub profile as small animated SVGs. The year in review is a poster of one calendar year of a user's activity, drawn as a train journey: four stat panels with a big LED number each, a route map with a rail line and **12 month stations** (a tower per month, as tall as that month was busy), and the user's mini train running the line and stopping longest at the busiest month. Below sit the busiest month and the top languages. Read first: `src/review/render.js` (it lays the poster out, draws the text, the train and the animation, and calls the painters in `src/review/art.js`), `src/review/art.js` (a working **baseline**: plain, correct and a bit dull), `tests/review/review-art.test.js` (the contract the painters must keep: read it closely, it defines what "done" is), and, for the house style, `src/calendar/render.js` (the contribution calendar with the same mini train, cut-corner cells, stone tunnels in `src/calendar/tunnels.js`), `src/cards/board.js` and `src/cards/profile.js`.

Your job is **the art only**: make the painters in `src/review/art.js` beautiful, the way the calendar and the departures board are: pixel art with clean shapes, 2 or 3 tones per object, a light direction, small details that reward a second look, nothing noisy. It must read at 1x and on a README.

## What you paint

Every painter paints into a `Grid` (`src/graphics/pixel.js`) in **art pixels**; the poster draws the grid at 2x, so one art pixel is 2 SVG units. The poster is 320 art pixels wide. Keep the exports and signatures of `review-art.js` (`TONES`, `STAT_ICONS`, `ICON_SIZE`, `STATION_W`, `STATION_MIN_H`, `STATION_MAX_H`, `stationHeight`, `paintPanel`, `paintStatIcon`, `paintBackdrop`, `paintRoute`, `paintStation`); you can add tones and helpers.

- `paintPanel(g, x, y, w, h)`: a stat panel (72 x 42). Today a flat cut-corner tile. Think of the LED sign on the train: a slightly recessed display with a bevel, a hint of a screw or bracket in a corner, a lit-from-above edge. The big number is drawn **over** it by `review.js` (pixel-font digits in the `led` tone, 20 art-pixel units tall, left side), the icon is on the right (`paintStatIcon`), the label sits at the top and a small text line at the bottom: keep the middle readable and quiet.
- `paintStatIcon(g, kind, x, y)`: four 7 x 7 icons (`total` contributions, `days` active days, `streak` longest streak, `busiest` busiest day), all `@icon`. Make them read better: bars, a calendar page with a check, a flame, a star or trophy. They may use two tones if the tones read.
- `paintBackdrop(g, { width, railY })`: what stands behind the stations: today two ranges of sine hills. Make it a landscape worth looking at: layered hills with a few trees, a distant village or a water tower, a couple of lamp posts... all low, **at most 80 art pixels above `railY`** (the test checks it; the month values are SVG text above the tall stations and must stay readable), and always above the rail. Must be deterministic (`rng(seed)` from `pixel.js`, or plain math).
- `paintRoute(g, { width, railY, stops })`: the line: the running rail on row `railY` (the train's wheels sit on the row above), then ties, a second rail, ballast; `stops` are the x centers of the 12 stations, where it should show a platform edge. Today flat bars. Give it ties with a rhythm, a metal highlight on the rail, gravel, a platform with a yellow safety edge, a small station sign post at each stop. Nothing may go below `railY + 6`: the month names (SVG text) start there.
- `paintStation(g, { x, railY, height, busiest })`: one month. `height` is in art pixels (8 to 54, from `stationHeight`), 0 for a month with no contributions (a closed hut: small). It stands on the rail row (its base is `railY - 1`), centered on `x`, 14 columns wide (`STATION_W`), and the busiest month also flies something on top (a flag today; at most 8 art pixels above the tower; the test checks it). Today a flat tower with square windows. Make them stations and not boxes: a roof or crown, a clock or a sign near the top, lit and dark windows in a pattern, door and awning at the base, antenna or chimney on the tall ones, a brick or panel texture, light from the upper left. Remember the user's **train runs in front of the stations** and hides their bottom 12 art pixels while it passes, so put the detail above that. The busiest month uses the `star*` tones (the title color) for **all** of its art, the others the `tower*` tones (the ring color): the test checks it. Heights must be what they are told: the top of the drawing is exactly `railY - height` for a tower (a flag may add to it).

## Colors

There are no colors in `review-art.js`, only **tones**: `TONES` maps a name to a poster role (`background`, `title`, `icon`, `text`, `ring`) and an opacity, and you paint with `'@name'`. The user can set any hex for each of the five roles, and the light and dark themes have their own defaults (dark: background 0d1117, title f0b429 amber, icon 58a6ff blue, text c9d1d9, ring 3fb950 green; light: background ffffff, title b45309, icon 0969da, text 24292f, ring 1a7f37), so lean on contrast between roles, not on a hue: `win` is the background color, so windows read as holes in a tower; a lit window can be the title color; the `text` role at low opacity makes a neutral shade on either theme; a darker shade of a role on a light poster is the same role at a lower opacity on the dark one, so check **both**. A gate rejects any `#hex` or `rgb()` in the file outside `TONES`, and the tests check that every color you paint is in `TONES`. Add as many tones as you need (30 is fine), each with a role and an opacity in (0, 1].

## How to see your work

Write a script under `.scratch/` (git-ignored) such as:

```js
import { writeFileSync } from 'node:fs';
import { sampleYear } from '../src/demo/sample.js';
import { buildReview, renderReview } from '../src/review/render.js';
const review = buildReview(sampleYear(2025), { year: 2025 });
review.unlock = 'observation';
for (const theme of ['light', 'dark']) writeFileSync(`.scratch/review-${theme}.svg`, renderReview(review, { theme, model: 'metro-white', stripe: '#3178c6' }));
```

and screenshot it with headless Edge, which is installed: `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=1000 --screenshot=<out.png> --window-size=660,500 file:///<path to the svg>`. Look at the PNGs, at both themes, and iterate. Also try a month with nothing (`review.months[7] = 0`), a very uneven year, and tiny and huge values. Zoom in (a larger `--window-size` with a `--force-device-scale-factor=3`) to check the pixels. If you cannot run the browser, say so in your final message and reason carefully about the coordinates instead.

## Hard rules

- Only edit `src/review/art.js`. Do not edit `src/review/render.js`, `src/trains/mini.js`, any test or `src/graphics/pixel.js`: if you think the contract is wrong or you need something from `review.js`, say so in your final message instead.
- Plain ES modules, no dependencies, comments in English that explain the non-obvious (why a detail is where it is, what the train hides, which tone does what).
- The whole poster must stay under 32 KB (it is 22 KB now): merge pixels into regular shapes, do not scatter single pixels everywhere (`Grid.paths` already merges runs and columns).
- The gates: `node --check src/review/art.js`, `node tools/conductor/gates/theme-colors.js src/review/art.js TONES` and `node --test tests/review/review-art.test.js` must pass.
