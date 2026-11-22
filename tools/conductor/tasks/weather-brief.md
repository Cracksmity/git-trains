# Brief: a new weather state for the Jalisco scene

git-trains draws a GitHub profile as an animated pixel-art SVG of trains. Its `jalisco` scene has three strips, one per track: **Guadalajara** (the city: Cathedral, Teatro Degollado, Hospicio Cabañas, Estadio Jalisco, La Minerva, three west-side towers), **Los Altos** (red-earth parcels, ranches, a parish church, a dry-stone wall) and **Tequila** (blue agave in furrows below the Volcán de Tequila). The `weather` input draws each place's weather. Four states are done and approved: `clear`, `cloudy`, `rain` and `storm`. You add one more.

## Read first

- `src/weather/conditions.js`: `WEATHER_STATES`, `WEATHER_NAMES` (English and Spanish), the WMO `CODES` table, `readCurrentWeather` (reads Open-Meteo `current.weather_code` and `current.temperature_2m`) and `parseWeatherInput`.
- `src/weather/inks.js`: every weather ink, with a light and a dark value. `skyInk(state, part)` builds a state's sky and cloud ink names; the `SKIES` table holds them.
- `src/scene/weather.js`: the layers.
  - `weatherArt` returns a list of layers.
  - Each layer has a `grid`, a depth `z` (`sky` is behind the city and countryside; `ground` is over them and behind the trains) and a row `y`.
  - A layer may also have `fall` (looping falling particles, clipped to `clip`), `drift` (shares the clouds' horizontal loop), `blink` (lightning keyframes) or `svg` (a lighter SVG drawing of the same grid).
  - `weatherLayers` writes them as SVG and CSS. `tools/export/raster.js` paints the same layers with the same timing, so anything you add through these layer types works in both.
  - The rest of the file holds `citySky`, `cityDeck`, `bank`, `countrySky`, `veil`, `rainLayers`, `lightning` and `weatherBands` (each strip's `top`, `base` = rail row, `bottom`).
- `src/landscape/jalisco-weather.js`: what each place does in each state.
  - It reads the painted backdrop grid (`backdrop.get(x, y)` returns an ink such as `'@stoneShade'`) to find roofs, furrows, the volcano or the plaza row, and paints into the weather grid.
  - `JALISCO_WEATHER` also gives each place's lightning position.
- `src/landscape/jalisco-city.js`, `jalisco-country.js`, `jalisco-centro.js`, `jalisco-landmarks.js`, `jalisco-towers.js` and `jalisco-palette.js`: how the places are painted, read only. They tell you which inks to look for.
- `tests/weather/`: the existing tests.
- `docs/reference.md`, section "Weather", and `docs/es/reference.md`, section "Clima".

## What a new state needs

1. **Data.** In `src/weather/conditions.js`:
   - Add the state to `WEATHER_STATES`, in calm-to-wild order, and to both languages of `WEATHER_NAMES`.
   - Move its codes in `CODES`. A state chosen by temperature is decided in `readCurrentWeather`, from the code and `temperature_2m` together.
2. **Inks.** Add them to `src/weather/inks.js`, each with a light and a dark value. The dark theme is night: no daylight colors there.
3. **Art.** Add the shared parts to `src/scene/weather.js` and the place-specific parts to `src/landscape/jalisco-weather.js`.
   - If a file would pass 400 lines, put your state's art in a new module: `src/scene/weather-<state>.js` or `src/landscape/jalisco-weather-<state>.js`.
   - Reuse the existing helpers before writing new machinery.
4. **Tests.** In `tests/weather/`:
   - Update the expectations that change, such as the option list in error messages or a code that moved to your state.
   - Add tests for the new state: its codes or readings, and anything special it draws.
5. **Docs.**
   - `action.yml`: list the state in the `weather` description.
   - `docs/reference.md` and `docs/es/reference.md`: add a row to the Weather / Clima table, written in Spanish in the Spanish file, and fix the sentence that says which weather borrows which state.
   - `docs/weather-backlog.md` and `docs/es/clima-pendiente.md`: remove your state's row from the pending table and its section.

## Rules

- **Leave the four approved states exactly as they are.** A gate compares their scenes byte for byte. Add to the shared code; do not restyle it.
- **Deterministic output.** Use `rng(seed)` from `src/graphics/pixel.js` with a fixed seed, never `Math.random` or the clock.
- **Pixel art.** Use crisp pixels on the scene grid and dithering rather than blur. Translucent inks are allowed sparingly, as the rain veil shows.
- **Everything rests on something.** Nothing floats, and the landmarks must stay recognisable to someone from Guadalajara.
- **Both themes.** Light is daytime and dark is night. Check both.
- **Motion.**
  - Any animation stops with `prefers-reduced-motion`; `weatherLayers` already does this for `fall` and `blink` layers.
  - Loops must be seamless.
  - Flashes stay under three per second.
- **Size.** Keep it light: the gate allows at most 120 KB more SVG than the scene without weather.
- **No dependencies.**
- **Keep the house style.** Comments explain why, in short sentences.

## How to see your work

```sh
node scripts/zoom.js 0 0 448 204 --no-trains --scale 3 --weather <state> --out .scratch/<state>
node scripts/zoom.js 0 0 448 204 --no-trains --scale 3 --weather rain --out .scratch/rain
node scripts/zoom.js --scale 2 --weather <state> --out .scratch/<state>-scene
node scripts/zoom.js 0 0 448 204 --no-trains --scale 3 --weather <state> --time 1.3 --out .scratch/<state>-later
```

The commands above draw, in order:

1. Your state.
2. A neighbour to compare with.
3. The README-size scene with the trains at frame 0, which the static PNG shows.
4. Another moment of the animation.

Each writes `-light.png` and `-dark.png`. **Open and look at the PNGs**, close up and at full size, in both themes, and fix what looks wrong before you stop. Coordinates are scene pixels:
- The scene is 448 wide.
- Guadalajara's sky runs from row 0, and its rail is on row 88.
- Los Altos runs from row 100 to its rail on row 140.
- Tequila runs from row 152 to its rail on row 192; the volcano's summit is near column 133, row 154.

`.scratch/` is ignored by git and is not part of your change.
