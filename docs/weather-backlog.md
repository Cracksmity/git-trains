# Weather backlog

The Jalisco scene draws ten states (`clear`, `frost`, `heat`, `partly`, `cloudy`, `fog`, `drizzle`, `rain`, `storm` and `hail`). See [Weather](reference.md#weather). Until they get their own art, other kinds of weather borrow the closest state. This page lists the designs still to draw, with a prompt for each one. Paste a prompt into an AI coding agent working in this repository.

[Versión en español](es/clima-pendiente.md)

## Rules every new state follows

A new state touches the same places as the first four:

1. **Data:** [src/weather/conditions.js](../src/weather/conditions.js) adds the state to `WEATHER_STATES` and `WEATHER_NAMES` (English and Spanish), and moves its WMO codes in `CODES`. A state chosen by temperature or wind also needs a field in the Open-Meteo request ([src/weather/open-meteo.js](../src/weather/open-meteo.js)). `readCurrentWeather` must validate that field like the others.
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
| [Snow](#snow) | WMO 71–77, 85, 86 | `rain` | Rare snow over Jalisco, as in December 1997 |
| [Wind](#wind) | Wind at 40 km/h or more | Nothing | Slanted rain, red dust in Los Altos, swaying trees |
| [Haze](#haze) | Poor air quality (PM2.5) | Nothing | A brownish layer over Guadalajara on environmental-alert days |
| [Temperature in captions](#temperature-in-captions) | Any live reading | Nothing | "Tequila 20° / Rust 15%" |

### Snow

```text
In git-trains, add a "snow" weather state to the Jalisco scene. Read the "Rules every new state follows" in docs/weather-backlog.md first and follow them.

Trigger: WMO codes 71, 73, 75, 77, 85 and 86, which map to "rain" today. Snow is rare in Jalisco; Guadalajara saw it in December 1997.

Art: reuse the winter decoration of src/scene/decor.js as much as possible: the falling flakes and the snow resting on roofs found from the backdrop grid. Clip the flakes to each place's strip with the fall layers of src/scene/weather.js. Use the "cloudy" sky. Add snow on the Cathedral spires, the stadium roof, the Los Altos roofs and the volcano's upper slopes. Do not duplicate decor.js; move a shared helper into a small module if both need it.

Done when: snow reads at README size in both themes and the winter decoration still passes its tests, and `npm run check` passes.
```

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

### Temperature in captions

```text
In git-trains, show each place's temperature in the Jalisco captions when the weather is live, for example "Tequila 20° / Rust 15%".

Steps:
- weatherFor in src/action/weather.js already reads temperature_2m. Pass the rounded temperatures to buildSpec next to the states.
- Check that src/graphics/font.js has a degree glyph. If it does not, add one in the font's style and test it.
- Fixed states have no temperature: their captions stay as they are.
- Check that the longest caption still fits beside the signal in both directions of travel.
Update both reference docs.

Done when: captions show temperatures only for live readings, the generated assets do not change (weather is off there), and `npm run check` passes.
```
