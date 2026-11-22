Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task.

Add the state `heat` (English name "heat", Spanish "calor").

Trigger: a clear code (0, 1 or 2) with `temperature_2m` at 32 °C or more.
- Decide it in `readCurrentWeather` from the code and the temperature together.
- Other codes keep their state whatever the temperature.
- If codes 1 and 2 already map to `partly`, or there is a cold threshold for `frost`, keep those working: heat wins only at 32 °C or more.
- Test the threshold on both sides.

Art, mostly in Tequila:
- **Heat shimmer:** a 2-row band just above the agave field's horizon.
  - A few horizon pixels shift one pixel left and right in a slow step-end loop, built from two alternating grids (`blink`-like layers with their own keyframes, or a new layer type that the raster exporter also understands).
  - It stops with reduced motion.
- **Washed-out sky:** the upper sky of the three places blends toward a pale warm tone in the light theme; the dark theme gets a warmer night haze. Paint it over the sky pixels only.
- **Guadalajara:** the sun's rays grow one pixel. Do this with a weather layer, not by editing `src/scene/sky.js`.
- Keep it subtle: the agave must stay recognisable.
