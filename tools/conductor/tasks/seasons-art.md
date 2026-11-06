Draw the seasonal and holiday decorations of the git-trains scene, and animate them, in `src/scene/decor.js`.

Context: git-trains draws a GitHub profile as an animated pixel-art SVG: a train running in front of a city. Everything is pixel art built on `Grid`s (`src/graphics/pixel.js`) and animated with CSS inside the SVG, 1 px at a time. Read first: `src/scene/render.js` (how layers and CSS are assembled; look at the clouds `.cl`, the twinkling stars `.tw`/`.twa`/`.twb` and the wheels `.wa`/`.wb`), `src/scene/backdrop.js` (sky, clouds, the city, rails, signal, overhead wire, station sign, and the theme colors in `THEMES`), `src/graphics/pixel.js` (`Grid`, `rng`), `src/activity/seasons.js` (which decoration applies on which day) and `tests/activity/seasons.test.js` (the tests your code must pass: read them closely, they define what "done" is).

`src/scene/decor.js` is already wired in: `renderScene` calls `decorLayers(kind, scene, used)` when the day has a decoration and puts the result in the SVG. Today it is a stub that draws nothing. Keep its exports and signature (`DECORATIONS`, `DECOR_THEMES`, `decorLayers`) and make it real. Edit only `src/scene/decor.js`.

## The contract

`decorLayers(kind, { W, H, tracks, user, backdrop }, used)` returns `{ back, front, css, vars }`:

- `back`: SVG string drawn after the sky and clouds but BEHIND the city (so buildings cover it). For fireworks.
- `front`: SVG string drawn over the city, the rails and the ground, but BEHIND the trains (the train is always the star and is never covered). Everything else goes here.
- `css`: extra CSS: your `@keyframes` and rules. It is appended to the scene's `<style>`.
- `vars`: `{ light: {...}, dark: {...} }` with the entries of `DECOR_THEMES` that you used (the colors you added to the theme). Build it from `used` or from the names you painted.
- `kind` is a key of `DECORATIONS` (`src/activity/seasons.js`): `winter`, `spring`, `autumn`, `muertos`, `christmas`, `hacktoberfest`, `newyear`. Anything else throws.
- Build every layer from a `Grid` and call `grid.paths(used)`, which emits the `<path class="c-name">` elements and records the color names in `used`. Wrap layers in `<g class="...">` to animate them. Hand-written SVG shapes are not needed.
- Colors are theme colors only: `'@name'` with a key of `DECOR_THEMES`, which you define with the same keys for `light` and `dark` (hex or rgba values; the scene's light sky is pale blue `#bfe0f5`..`#f4fafe`, the dark sky is navy `#070b1e`..`#1d2e5c`; pick values that read on both). No fixed hex colors anywhere else in the file (a gate checks it). The scene turns each name into a CSS variable and a `.c-name` class by itself.
- Everything is deterministic: use `rng(seed)` from `pixel.js` with a fixed seed; the same day must always draw the same SVG.

## The scene you draw on (pixels; the SVG is shown at 2x)

- `W` = 448 wide. `GY0` = 88 is the rail row of the first track (`gy = 88 + 52*k` for track `k`); `H` = 100 for one track, 204 for three. The sky is y 0..87.
- The procedural city is behind: buildings 8..44 px tall standing on y = 88. Custom skylines can have taller spires.
- `backdrop` is the `Grid` (W x H) that `paintBackdrop` painted: city (`@city2` far, `@city` near, `@cityWin` windows), the slope with bushes in front of the city (`@hill` at y 85..87, `@tree`/`@tree2` bushes), houses with `@houseRoof` roofs on the extra tracks, the signal, the overhead wires and masts, the station sign. You can scan it, for example to find the topmost building pixel of each column and put a 1 px snow cap on it.
- A train is `TRAIN_H` = 34 px tall and runs with its wheels on `gy`; it is drawn after your layers, so it passes in front of everything. Keep the band y = gy-34..gy+2 mostly free: the decoration must not compete with the train.
- Overhead wire: only for tracks with `track.overhead === true`. `wireY = gy - 34`; the wire is a 1 px line across the whole width at `wireY`; masts at `x = 30 + 96*n` (while `x < W`): 2 px wide from `wireY - 8` down to `gy`, with a crossarm at `y = wireY - 6` from `x + 2` to `x + 11` and a drop at `x + 11` from `wireY - 6` to `wireY`. Tracks without a pantograph (`overhead === false`) have no wire and no masts.
- Signal on every track at `x = track.dir === -1 ? 8 : W - 17`: mast 2 px wide at `x + 1` from `gy - 19` to `gy - 1`, head 5 x 13 at `x`, `y = gy - 32`.
- Station sign, only when the user name is not empty (track 0 only): a board with the name at `x = 14`, `y = 10`, height 13 and width `textWidth(clean(user).replace(/ /g, '').slice(0, 16)) + 8` (`font.js`), on a mast at x = 24..25 down to y = 88. When `user` is empty there is no sign.
- Sun/moon at (392, 20), radius ~6, rays to 10.
- Ground: ballast from `gy + 2` to `gy + 11`, rails at `gy` and `gy + 1`.
- Trains come in all sorts: the six models in `src/trains/models.js` (some with a pantograph, some without) and 1 to 3 tracks (multi mode). Every decoration must look right on all of them, so adapt to `track.overhead` and to a missing sign. `tests/activity/seasons.test.js` renders every decoration with every model.

## The decorations (few pixels, pixel art, subtle; the scene is still about the train)

Aim for clean shapes and 2 or 3 tones per object, no noise. If you want to see it, write a throwaway script under `.scratch/` (git-ignored): print layers as ASCII, or paint them zoomed into a PNG (`scripts/sheet.js` shows how to write a PNG without dependencies; `scripts/export.js` can rasterize the base scene to paint your grids on top). Check both themes. The result has to read at 1x.

1. **winter**: light snowfall (two layers falling at different speeds, roughly 20 to 40 flakes visible over the whole scene, 1 px each, some 2 px), snow on the roofs and the ground strip: a 1 px cap on top of the city buildings and the house roofs, snow on the slope strip in front of the city (y 85..87) and a thin line of snow on the ballast edge, maybe on top of the signal head and the sign board. Snow must read on the pale light sky as well as on the dark one (a bluish shade pixel next to the white one helps).
2. **spring**: a few pink petals drifting down with a little sideways sway (about 8 to 14 of them, 1 to 2 px each, two tones of pink); optionally a few pink blossom pixels on top of the bushes of the slope. Cherry blossom feel.
3. **autumn**: orange and red-brown leaves falling and swaying (about 8 to 12, 2 to 3 px), same idea as the petals but heavier and slower.
4. **muertos** (Día de Muertos): papel picado, the cut-paper banners, strung along the line: little rectangular flags (about 5 x 6 px, with small cut-out holes so it reads as papel picado) hung from a sagging string. Marigold orange is the main color, with one or two accents (magenta/pink, purple). With an overhead wire, string them between the mast tops (`wireY - 8`) so they hang above the wire and the train; without one, find a good place of your own (between the sign mast and the signal, or short posts of your own) and say so in a comment. They sway gently: two poses a second or two apart, swapped with `step-end`.
5. **christmas**: small blinking lights along the catenary: 1 px bulbs every 5 or 6 px under the wire between the masts (red, amber, green, blue) in two groups that blink alternately like `.wa`/`.wb`; on a track without a wire, put them around the station sign's border, and if there is no sign either, around the signal head. Subtle: bulbs are single pixels.
6. **hacktoberfest**: a small pumpkin (about 7 x 6 px: orange with a darker shade, a little green stem, a carved face) standing by the signal, on the side the train arrives from, on every track. The face glows like a candle and flickers: two or three poses with `step-end`.
7. **newyear**: a few fireworks in the sky (about 3 bursts), BEHIND the city (`back` layer), clear of the sun and of the station sign. Each burst is a short sequence of frames (a spark rising, a ring opening, sparks falling, gone) played with `step-end` opacity keyframes, with long dark gaps and staggered with negative delays so there is always one going. Three colors (for example gold, pink, cyan) that show on both skies.

## Animation rules

- All motion is CSS in the `css` string, advancing in whole pixels: `steps(N)` where the layer moves exactly N px (the clouds do this: two periods stacked, translated by one period in `steps(period)`), or `step-end` swaps between poses. No smooth interpolation, no fractional px. Use periods that look calm (snow ~16 to 30 s per loop of the scene height, petals/leaves slower, blinking ~1 to 2.4 s).
- For falling things, build a tile twice as tall as the loop (or exactly as tall, wrapped) so the loop is seamless. Sway: nest a second `<g>` that swaps position by 1 px with `step-end`.
- Every animation has to stop with `prefers-reduced-motion`: your `css` ends with its own `@media (prefers-reduced-motion:reduce){...{animation:none!important}}` listing every class you animate. With the animation off the scene must still look right: falling things stay where they are, and for blinking or burst frames define the base state in CSS so a sensible still shows (for the fireworks, the bursts at full size; for the lights, one group on).
- Every decoration animates at least one thing.
- Class names: short and unique, not used by `scene.js` (`cl tw twa twb tr b lit wa wb do led sm pa pb sp sa sb`, `c-*`, `s-*`, `tr0`...). A prefix of your own such as `d-` is fine.
- Size: a decorated scene may be at most about 5 KB larger than the plain one (the test allows 12 KB). Paths come out small if you keep shapes regular.

## Hard rules

- Edit only `src/scene/decor.js`. Do not touch `src/scene/render.js`, `src/scene/backdrop.js`, `src/activity/seasons.js` or the tests: if you think the contract is wrong, say so in your final message instead.
- No dependencies, plain ES modules, comments in English, explain the non-obvious (why a layer is `back`, where the fallbacks go).
- The gates: `node --check src/scene/decor.js`, `node tools/conductor/gates/theme-colors.js src/scene/decor.js DECOR_THEMES` (no fixed colors outside `DECOR_THEMES`), `node --test tests/activity/seasons.test.js` and `npm test` must pass.
