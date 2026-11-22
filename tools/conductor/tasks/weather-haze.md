Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task. Wind is already done: read how it works as a modifier (`WEATHER_MODIFIERS`, `<state>+wind`, `scene.sky`) and follow the same pattern.

Add **haze** over Guadalajara on days of poor air quality, the brownish layer of the city's environmental alerts. It is a second modifier. A gate (`tools/conductor/gates/weather-haze.js`) checks the contract below; read it.

**Data:** a second request, to Open-Meteo's air-quality API, for Guadalajara only (the skyline's first place).
- Put it in a new module, `src/weather/air-quality.js`, with an injected fetch, like `open-meteo.js`. Export:
  - `AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'`;
  - `airQualityUrl(place)`, with `latitude` and `longitude` to four decimals and `current=pm2_5`;
  - `fetchAirQuality({ place, fetchImpl, timeoutMs, retryDelay })`, which returns `{ pm25, problems }`. `pm25` is µg/m³ from 0 to 1000; any other value gives null and one problem. It throws when the API can't be reached or read, after one retry like `fetchWeather`.
- Add `src/weather/air-quality.js` to the browser globals in `eslint.config.js`, next to `open-meteo.js`.
- `weatherFor` (`src/action/weather.js`) asks it once per live run and sets `haze: true` on Guadalajara's entry when PM2.5 is **above** 55 µg/m³.
  - The request is optional: if it fails, log one `::notice::` line (escaped like the others) and draw no haze; the weather itself stays.
  - Fixed weather and the sample run never ask any API.
  - Log the reading: `Air quality (Open-Meteo): Guadalajara PM2.5 61 µg/m³ -> haze`.
- Document `haze` in the `PlaceSky` typedef. Attribution is the same as the weather (Open-Meteo, CC BY 4.0).

**Input:** add `haze` to `WEATHER_MODIFIERS`: `clear+haze`, `cloudy+wind+haze` and `cloudy+haze+wind` all work.

**Title:** `Guadalajara clear with haze`, `clear with wind and haze`; in Spanish `despejado con calima`, `despejado con viento y calima`. Name haze only where it is drawn.

**Art:** a brownish dithered layer over the lower half of Guadalajara's sky.
- The distant ridge and the west-side towers fade toward the haze color; the Cathedral and the landmarks in front stay crisp.
- It shows with clear, partly, cloudy, heat and fog, and with wind. Rain, drizzle, storms and hail wash it away: those scenes draw exactly as without haze.
- Only Guadalajara: haze on Los Altos or Tequila changes nothing.
- It must read in both themes; at night it catches the city's glow. Keep it under 60 KB.

**Interfaces:** a "Clear with haze" option in the playground selector (`assets/preview/app.js`); in its live mode, read the air quality too. Describe `+haze` and the second request in `action.yml` and the Weather / Clima sections of `docs/reference.md` and `docs/es/reference.md`. Remove Haze from `docs/weather-backlog.md` and Calima from `docs/es/clima-pendiente.md`.

**Tests** (`tests/weather/`): the request with a fake fetch, the threshold on both sides, a failed request that is harmless, the input, the title and the scenes it changes and leaves.

To see it: `node scripts/zoom.js 0 0 448 204 --no-trains --scale 3 --weather clear+haze --out .scratch/haze`, and the same with `cloudy+haze` and `clear+wind+haze`.
