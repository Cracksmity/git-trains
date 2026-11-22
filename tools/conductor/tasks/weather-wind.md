Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task.

Add **wind** to the Jalisco weather. Wind is a modifier, not a state: it combines with any of the ten states. A gate (`tools/conductor/gates/weather-wind.js`) checks the contract below; read it.

**Data** (`src/weather/conditions.js`, `src/weather/open-meteo.js`):
- Export `WEATHER_MODIFIERS = ['wind']` from `conditions.js`. Haze joins it later, so write the input code for a list of modifiers, not for wind alone.
- Ask Open-Meteo for `wind_speed_10m` too (`current=weather_code,temperature_2m,wind_speed_10m`; it answers in km/h).
- `readCurrentWeather` keeps it as `windSpeed` on each place: a number from 0 to 200, otherwise null with one problem. A reading without the field gives null and no problem. A bad wind never loses the state.
- `skyOfReading` adds `wind: true` from 40 km/h. Document the field in the `PlaceSky` typedef.
- The Action's log line names the wind where it blows: `Guadalajara rain 18°C, wind 45 km/h, Los Altos ...`.

**Input:** `<state>+wind`, case-insensitive like the states, for every place (`rain+wind`) or per place (`storm+wind, clear, hail+wind`). A place with a modifier becomes `{ state: 'rain', wind: true }`; a plain state stays a name (`'rain'`), so everything that exists keeps working. An unknown modifier throws with the options, modifiers included.

**Title** (`src/scene/spec.js`): `Weather: Guadalajara rain with wind, Los Altos clear, Tequila storm`; in Spanish `Clima: Guadalajara lluvia con viento, ...`. Write it so a second modifier joins as "with wind and haze" / "con viento y calima".

**Art:** wind shows in every state. The art reads it from `scene.sky[band.k].wind` in `weatherArt`.
- Rain, drizzle, storm and hail fall slanted, the way the wind pushes them. Draw the particles on a diagonal and move them diagonally: give the `fall` layers a sideways shift so their keyframes (`w-fall…`) translate on x as well as y. The loop must stay seamless, and `tools/export/raster.js` must move them the same way.
- Los Altos: a few red dust streaks blow off the plowed parcels, low over the ground.
- The plaza trees in Guadalajara and the mesquites and pirul trees in the countryside sway one pixel with a slow `step-end` animation (a class starting with `w-`, stopped for reduced motion).
- In clear weather the dust and the trees are what shows the wind. Keep it light: at most 60 KB more than the same state without wind.
- Leave every scene without wind exactly as it is (`weather-unchanged.js`).

**Interfaces:** add a "Rain with wind" and a "Clear with wind" option to the playground's weather selector (`assets/preview/app.js`). Describe `+wind` in the `weather` input of `action.yml` and in the Weather / Clima sections of `docs/reference.md` and `docs/es/reference.md`. Remove the Wind row and section from `docs/weather-backlog.md` and the Viento ones from `docs/es/clima-pendiente.md`.

**Tests** (`tests/weather/`): the reading, the threshold on both sides, the input, the title in both languages, wind combined with every state, seamless slanted loops and reduced motion.

To see it: `node scripts/zoom.js 0 0 448 204 --no-trains --scale 3 --weather rain+wind --out .scratch/wind`, and the same with `clear+wind` and `--time 1.3`.
