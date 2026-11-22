# Weather backlog

The Jalisco scene draws six states (`clear`, `partly`, `cloudy`, `drizzle`, `rain` and `storm`). See [Weather](reference.md#weather). Until they get their own art, other kinds of weather borrow the closest state. This page lists the designs still to draw, with a prompt for each one. Paste a prompt into an AI coding agent working in this repository.

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
| [Fog](#fog) | WMO 45, 48 | `cloudy` | Los Altos valleys fill with fog; the church tower rises out of it |
| [Hail](#hail) | WMO 96, 99 | `storm` | A Guadalajara hailstorm: white pellets bounce and pile up on the plaza and roofs |
| [Frost](#frost) | WMO 0–2 and 2 °C or less | `clear` or `partly` | White frost on the pasture and roofs of Los Altos |
| [Heat](#heat) | WMO 0–2 and 32 °C or more | `clear` or `partly` | Heat shimmer over the Tequila agave field |
| [Snow](#snow) | WMO 71–77, 85, 86 | `rain` | Rare snow over Jalisco, as in December 1997 |
| [Wind](#wind) | Wind at 40 km/h or more | Nothing | Slanted rain, red dust in Los Altos, swaying trees |
| [Haze](#haze) | Poor air quality (PM2.5) | Nothing | A brownish layer over Guadalajara on environmental-alert days |
| [Temperature in captions](#temperature-in-captions) | Any live reading | Nothing | "Tequila 20° / Rust 15%" |

### Fog

```text
In git-trains, add a "fog" weather state to the Jalisco scene. Read the "Rules every new state follows" in docs/weather-backlog.md first and follow them.

Trigger: WMO codes 45 and 48, which map to "cloudy" today in src/weather/conditions.js.

Art:
- Guadalajara: a pale fog band covering the lower city to about row 70. The tops of the Cathedral spires, the west-side towers and La Minerva come out of it. The distant ridge disappears.
- Los Altos: fog lies in the low ground between the hills; the parish church tower and the mesquite crowns rise out of it. Keep the ranch roofs half visible.
- Tequila: a fog bank over the far agave rows. The nearer rows stay clear, and only the volcano's summit shows above it.
Use dithered edges (the 25/50/75% pattern of src/scene/sky.js) rather than translucency, so the pixel art stays crisp. Fog does not move, or drifts with the existing cloud loop.

Done when: `npm run zoom -- 0 0 448 204 --no-trains --scale 3 --weather fog` looks right in both themes, and `npm run check` passes.
```

### Hail

```text
In git-trains, add a "hail" weather state to the Jalisco scene. Read the "Rules every new state follows" in docs/weather-backlog.md first and follow them.

Trigger: WMO codes 96 and 99 (thunderstorm with hail), which map to "storm" today.

Art: the storm sky and lightning, with hail instead of rain:
- Falling white pellets of 1 to 2 pixels. They are fewer than raindrops and fall faster. Every few pellets, one bounces a pixel when it reaches the ground row of its place.
- Guadalajara, the signature: white accumulation along the plaza row, on the Cathedral and Sagrario roofs, on the stadium roof and at the foot of La Minerva. It reads like the hailstorm of 30 June 2019. Find roof rows from the backdrop grid, as the winter decoration does in src/scene/decor.js.
- Los Altos and Tequila: white specks gathered in the furrows and on the ballast.
Accumulation is static; only the pellets move. Pellets stop with prefers-reduced-motion.

Done when: hail is clearly different from rain at README size in both themes, and `npm run check` passes.
```

### Frost

```text
In git-trains, add a "frost" weather state to the Jalisco scene. Read the "Rules every new state follows" in docs/weather-backlog.md first and follow them.

Trigger: WMO code 0, 1 or 2 with temperature_2m at 2 °C or less. The request already asks for temperature_2m. Decide the state in src/weather/conditions.js from the code and the temperature together, and test the threshold.

Art, mostly in Los Altos (frost is common on its winter mornings):
- A pale blue-white tint on the tops of the pasture and grassland ridges and on the ranch roofs. Paint it on the top pixel of each surface by reading the backdrop grid; do not cover the whole surface.
- A thin white line along the dry-stone wall.
- Guadalajara: frost only on the plaza trees.
- Tequila: frosted agave tips.
The sky stays clear. Nothing moves.

Done when: frost is visible but subtle in both themes, the threshold has tests, and `npm run check` passes.
```

### Heat

```text
In git-trains, add a "heat" weather state to the Jalisco scene. Read the "Rules every new state follows" in docs/weather-backlog.md first and follow them.

Trigger: WMO code 0, 1 or 2 with temperature_2m at 32 °C or more.

Art, mostly in Tequila:
- Heat shimmer: a 2-row band just above the agave field horizon. A few horizon pixels shift one pixel left and right in a slow step-end loop (two alternating grids, as the stars twinkle in src/scene/sky.js). It stops with prefers-reduced-motion.
- Washed-out sky: the upper sky bands of the three places blend toward a pale warm tone in the light theme. In the dark theme, a warmer night haze.
- Guadalajara: the sun's rays grow one pixel.
Keep the effect subtle: the agave must stay recognisable.

Done when: the shimmer loops seamlessly and the scene still reads at README size, and `npm run check` passes.
```

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
