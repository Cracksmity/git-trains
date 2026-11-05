Document the new calendar mode and add edge-case tests for it.

The feature (already implemented, read `src/calendar.js`, `src/mini.js`, `src/tunnels.js` and `test/calendar.test.js`):

- New Action input `calendar` (`"true"` / `"false"`, default `"false"`). With `true` the Action also writes `train-calendar.svg`, and with `theme: both` also `train-calendar-light.svg` and `train-calendar-dark.svg`, next to the train scene.
- The SVG is the GitHub contribution calendar (53 weeks, 7 rows) with the user's train running through it like a snake: left to right on the first row, into a tunnel at the end, out one row down going right to left, and so on. Every day with contributions it passes is eaten (the cell goes blank). It starts with the lead car (or locomotive) alone and grows a car at a time, as it eats each share of the year, up to the same number of cars as the big train. At the end it leaves through the last tunnel, the calendar fills up again and the loop restarts.
- The train is a one-cell-high "mini" version of the user's train, derived automatically from its palette and its nose or locomotive drawing, so custom JSON trains and steam engines get one too. Its stripe is the top language's color and its windows light up with the streak, like the big train.
- Its speed follows yesterday's activity. The caption shows the user and the year's contributions, and the LED sign the streak (`language` and `label` apply). It follows light/dark like the scene, and nothing moves with `prefers-reduced-motion` (the train is parked at the end).
- Examples: `docs/example-calendar.svg` (white metro) and `docs/example-calendar-steam.svg` (steam engine).

Do this:

1. `README.md`: a "Calendar mode" section right after "What each part means" (use the example image and a short YAML snippet with `calendar: true` and the `<picture>` HTML for `dist/train-calendar-dark.svg` / `dist/train-calendar-light.svg`), and a `calendar` row in the Options table (after `mode`).
2. `README.es.md`: the same, in natural Spanish ("Modo calendario"), consistent with the rest of that file.
3. `CHANGELOG.md`: change the heading `## 1.0.0 (unreleased)` to `## 1.0.0 (2026-11-04)`, and add above it a `## Unreleased` section with an "Added" list describing the calendar mode in one or two bullets.
4. `test/calendar-edge.test.js`: edge cases for `renderCalendar` and `calendarCells`: a year with no contributions at all (no cell is eaten, the train has one unit, the SVG is valid); a single busy day; a year spanning 54 week columns; every example train in `examples/trains/` (parse them with `parseCustomModel`); the Action run end to end with `INPUT_CALENDAR=true` and `--sample` writing the three calendar files (see how `test/cards.test.js` runs the Action with `spawnSync`, `INPUT_OUTPUT-DIR` and a temp folder), and with `INPUT_CALENDAR` unset writing none.

Edit only those four files. Keep the READMEs' tone: short, concrete, no hype.
