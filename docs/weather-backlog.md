# Weather backlog

The Jalisco scene draws eleven states (`clear`, `frost`, `heat`, `partly`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`, `storm` and `hail`). See [Weather](reference.md#weather). This page lists the designs still to draw, with a prompt for each one. Paste a prompt into an AI coding agent working in this repository.

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

| State | Trigger | Borrows today | Signature |
| --- | --- | --- | --- |
| [Wind](#wind) | Wind at 40 km/h or more | Nothing | Slanted rain, red dust in Los Altos, swaying trees |
| [Haze](#haze) | Poor air quality (PM2.5) | Nothing | A brownish layer over Guadalajara on environmental-alert days |

### Wind

```text
In git-trains, add wind to the Jalisco weather. Read the "Rules every new state follows" in docs/weather-backlog.md first and follow them.

Wind is a modifier, not a state: it combines with any state. Add wind_speed_10m to the Open-Meteo request, validate it in readCurrentWeather (0–200 km/h), and pass a per-place "windy" flag (40 km/h or more) through buildSpec next to the state.

Art:
- Rain and hail fall slanted. Draw the drops on a diagonal and move them diagonally in the fall keyframes, so the loop stays seamless.
- Los Altos: a few red dust streaks blow off the plowed parcels.
- The plaza trees and mesquites sway one pixel with a slow step-end animation that stops with reduced motion.

Done when: wind combines with every state in tests, the loops are seamless, and `npm run check` passes.
```

### Haze

```text
In git-trains, add haze for poor air quality over Guadalajara. Read the "Rules every new state follows" in docs/weather-backlog.md first and follow them.

Data: a second Open-Meteo request to the air-quality API (https://air-quality-api.open-meteo.com/v1/air-quality, current=pm2_5) for Guadalajara only. Put it in its own adapter function with an injected fetch, and keep it optional: if it fails, there is no haze. Use haze when PM2.5 is above 55 µg/m³.

Art: a brownish dithered layer over the lower half of Guadalajara's sky. The distant ridge and the west-side towers fade toward the sky color. The Cathedral and the landmarks in front stay crisp. Haze combines with clear and cloudy. Rain washes it away, so do not draw it in rain or storm.

Done when: the second request is tested with a fake fetch, its failure is harmless, and `npm run check` passes.
```
