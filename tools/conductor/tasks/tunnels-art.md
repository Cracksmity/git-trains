Redesign the tunnels of the calendar mode in `src/calendar/tunnels.js` so they look like proper pixel-art hills with tunnel portals, not flat green blocks.

Context: the calendar mode (`src/calendar/render.js`) draws the GitHub contribution calendar with a small train running through it row by row. At the end of each row the train enters a hill on the side and comes out of the same hill one row down, going the other way. So each side has hills covering two rows each, plus a one-row entrance at the top left and a one-row exit at the bottom right. Each hill sits in a side margin about 34 px wide; a contribution cell is 10 px, rows are 13 px apart; the train is 10 px high, plus 2 px for a chimney.

Look at the current result first. `node scripts/docs.js` writes `docs/example-calendar.svg`; to see pixels, write yourself a small script under `.scratch/` (it is git-ignored) that draws the tunnel layer (`paintTunnels` on a `Grid` from `src/graphics/pixel.js`, with `tunnelLayout` and `calendarGeometry` from `src/calendar/render.js`) into a zoomed PNG; `scripts/sheet.js` shows how to write a PNG without dependencies. Map the theme colors to the light values in `CALENDAR_THEMES`. Iterate looking at it.

What good looks like:

- Each hill reads as its own hill: a rounded or stepped silhouette with some variety between hills (heights, bumps), not one continuous wall down the side.
- A clear tunnel portal where each row enters: a stone arch or frame around a dark opening, facing the grid.
- A little life on the slopes: grass edge, a few bushes or a small tree, darker shading at the bottom. Pixel art: few colors, clean shapes, no noise.
- It must read well at 1x (the SVG is shown at its real size, about 760 px wide) and in both themes.

Hard rules:

- Only edit `src/calendar/tunnels.js`, plus, if you need more colors, the `CALENDAR_THEMES` object in `src/calendar/render.js` (add the same new keys to both `light` and `dark`, with values that work on a white page and on GitHub's dark page). Nothing else in `src/calendar/render.js` may change.
- Use only theme colors (`'@name'` with a key of `CALENDAR_THEMES`), never fixed hex colors, so the hills follow light and dark.
- Keep the exported function `paintTunnels(g, layout)` and its layout fields. The rule in the comment at the top of `src/calendar/tunnels.js` must still hold: every pixel of each row's band outside the grid is covered (tests/calendar/calendar.test.js checks it). That is where the train hides while it turns.
- Keep the size budget: the calendar SVG stays under 100 KB (the tests check it).
