Read `docs/jalisco-notes.md` and the painting notes in `docs/development.md` first, then `src/landscape/jalisco-country.js`, which paints Los Altos and Tequila: the new strip follows its style, scale and inks.

Add a **variant of the Jalisco scene with Sayula on the middle track**. `skyline: jalisco` stays exactly as it is, byte for byte, in every weather (`tools/conductor/gates/weather-unchanged.js`). `skyline: jalisco-sayula` keeps Guadalajara and Tequila untouched and paints Sayula, in the south of Jalisco, between them. A gate (`tools/conductor/gates/jalisco-sayula.js`) checks the contract below; read it.

**Contract**
- `parseSkyline('jalisco-sayula')` returns `{ name: 'Jalisco', preset: 'jalisco', variant: 'sayula', fill: false, buildings: [], region: undefined }`. Because the preset stays `jalisco`, the palette, the captions, the weather-over-seasons rule and `theme: local` keep working; `variant` only picks the middle strip. `parseSkyline('jalisco')` returns what it returns today, with no `variant`.
- `src/weather/places.js`: for the variant `placesFor` gives Guadalajara, `{ id: 'sayula', name: 'Sayula', latitude: 19.883, longitude: -103.6 }` and Tequila. Live weather, the temperature in the caption (`Sayula 24°C / Python 30%`) and the weather title then come from Sayula.
- `src/scene/backdrop.js`: the second track calls `paintSayula(g, base, height)` from a new `src/landscape/jalisco-sayula.js` when `skyline.variant === 'sayula'`. Export the helpers you need from `jalisco-country.js` (`sky`, `ridge`, `rancho`, `mesquite`) instead of copying them. Use your own `rng` seeds and never the backdrop's shared random numbers, so the ballast specks and signals stay put. Paint only inside the strip: the 40 rows above the second rail (rows 100 to 139).

**The art**, 448 × 40, painted back to front. Sayula is a valley town beside a broad salt lake, the Laguna de Sayula, with the Colima volcanoes on the southern horizon.
1. Sky: the shared `sky()` with a seed of its own.
2. Far away, on the right half: the Nevado de Colima, broad and high, with snow on its summit and down its gullies, and the Volcán de Fuego beside it, lower, a sharper cone with a thin plume. Keep them paler and lower in contrast than the Tequila volcano on the third track, so the scene doesn't show the same mountain twice.
3. A low ridge of hills closing the valley behind the lake.
4. The laguna across most of the width: a flat, pale salt crust with fine cracks, and a shallow sheet of water that mirrors the sky, with a fringe of reeds (tule) at its edge. Three or four American white pelicans on the water, white with black flight feathers and an orange bill, and one in flight. They must read in both themes.
5. On the left third, the town: whitewashed and ochre houses with red tile roofs, the main garden's kiosk (an octagonal bandstand on a raised base, slim posts, a small domed roof) and the parish church with its bell tower. Draw the church in its own function, `parroquiaSayula(g, x, b)`. It will be redrawn later from photos, so keep it self-contained and well placed rather than detailed, and don't reuse the Los Altos parroquia.
6. In front, near the rail: a dirt road and a few mesquites. No dry-stone wall and no red parcels: those are Los Altos, and their absence is part of what tells the two strips apart.
7. At night only, El Ánima de Sayula: a small figure in a white shroud holding a warm candle point, on the road at the edge of town. Hide it by day the way `@starlight` is hidden in `jalisco-palette.js`: in the light theme its inks repeat what lies behind it.

New inks go in `src/landscape/jalisco-palette.js`, each with a light and a dark value. Check that every part rests on the one below: no tower, roof or bird floating on air, and no pelican standing on the sky. The dark theme must keep the same reading.

**Weather** (`src/landscape/jalisco-weather*.js`): give Sayula its own entry in `JALISCO_WEATHER`, with its bolt, its scattered clouds (`partly`) and a `heat` design. Put its designs in a new `jalisco-weather-sayula.js` so no file passes 400 lines.
- Rain, drizzle and storm: the water sheet spreads over the salt crust and the tile roofs shine. Hail: hailstones on the crust.
- Fog: a bank lies low on the lake, with the church tower and the volcano tops above it.
- Frost: rime on the reeds, the roofs and the edge of the crust. Snow: on the roofs, and the Nevado white to its foot.
- Heat: a mirage shimmer over the salt flat, the way `tequilaShimmer` works.
- Wind (`jalisco-weather-wind.js`): pale dust streaks blow off the dry part of the lake (the valley's tolvaneras) instead of the red parcel dust, and the trees sway as they do in Los Altos. Choose the design by place id, not by track number, and keep Los Altos drawing exactly as before.
- Haze stays a Guadalajara design.

**Interfaces and docs:** describe `jalisco-sayula` in the `skyline` input of `action.yml` and in its `weather` input ("jalisco-sayula: Guadalajara, Sayula and Tequila"). Add a sentence on the variant to the Jalisco sections of `docs/reference.md` and `docs/es/reference.md`, and a row to the preset tables of `docs/customization.md` and `docs/es/customization.md`. Add the option `Jalisco · Guadalajara, Sayula, Tequila` (value `jalisco-sayula`) to the playground's skyline selector in `assets/preview/app.js`. Don't add or regenerate images in `docs/` or `examples/`.

**Tests** (`tests/scene/jalisco.test.js`, `tests/weather/`): the parse result, the places, the captions, the strip painted only inside its rows, every state with and without each modifier for the variant, and `skyline: jalisco` unchanged.

To look at it: `node scripts/zoom.js 0 100 448 152 --no-trains --scale 4 --skyline jalisco-sayula --out .scratch/sayula`, then the same with `--weather fog`, `--weather rain`, `--weather heat` and `--weather clear+wind`. Compare it with `--skyline jalisco`.
