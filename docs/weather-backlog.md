# Weather backlog

The Jalisco scene draws eleven states (`clear`, `frost`, `heat`, `partly`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`, `storm` and `hail`). See [Weather](reference.md#weather). Wind and haze combine with them as modifiers. This page sets the rules every new design follows and lists the ones still to draw, with a prompt for each. Paste a prompt into an AI coding agent working in this repository.

[Versión en español](es/clima-pendiente.md)

## Rules every new state follows

A new state touches the same places as the first four:

1. **Data:** [src/weather/conditions.js](../src/weather/conditions.js) adds the state to `WEATHER_STATES` and `WEATHER_NAMES` (English and Spanish), and moves its WMO codes in `CODES`. A state chosen by temperature or wind also needs a field in the Open-Meteo request ([src/weather/open-meteo.js](../src/weather/open-meteo.js)). `readCurrentWeather` must validate that field like the others. What a reading adds beyond the state (the temperature, the wind) reaches the scene in its `PlaceSky` entry: see `placeSky` and `skyOfReading`, and `scene.sky` in `weatherArt`.
2. **Inks:** [src/weather/inks.js](../src/weather/inks.js) gives every new ink a light and a dark value.
3. **Shared layers:** [src/scene/weather.js](../src/scene/weather.js) handles the sky, falling particles and flashes. Reuse `rainLayers`, the `fall` and `blink` layers, `citySky` and `countrySky` before writing new machinery.
4. **Each place:** [src/landscape/jalisco-weather.js](../src/landscape/jalisco-weather.js) paints what is specific to Guadalajara, Los Altos or Tequila.
5. **Interfaces:** the `weather` description in [action.yml](../action.yml), the playground selector in [assets/preview/app.js](../assets/preview/app.js), and the Weather sections in [docs/reference.md](reference.md) and [docs/es/reference.md](es/reference.md).
6. **Tests:** [tests/weather/](../tests/weather/) covers code mapping, input parsing, inks in both themes, seamless loops and reduced motion.

Constraints from [AGENTS.md](../AGENTS.md):
- Output stays deterministic, with seeded randomness only.
- Keep JavaScript modules at or below 400 lines.
- Add no dependencies.
- Respect light and dark themes and `prefers-reduced-motion`.
- The SVG and the raster exporter must paint the same pixels.
- Lightning-like flashes stay under three per second.

Check every design with `npm run zoom -- 0 0 448 204 --no-trains --scale 3 --weather <state>`, in both PNGs. Then check frame 0 and the scene at README size. Every part must rest on the one below; nothing floats.

## Pending designs

None right now: snow, wind, haze and the caption temperatures were the last ones on this list. Add the next design here with a prompt. `tools/conductor/tasks/weather-brief.md` is the brief the conductor gives an agent for any new weather design.
