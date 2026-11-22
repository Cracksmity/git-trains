Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task.

Add the state `fog` (English name "fog", Spanish "neblina").

Trigger: WMO codes 45 and 48, which map to `cloudy` today. Code 3 stays `cloudy`.

Art:
- **Guadalajara:**
  - A pale fog band covers the lower city to about row 70.
  - The tops of the Cathedral spires, the west-side towers and La Minerva come out of it.
  - The distant ridge disappears.
- **Los Altos:**
  - Fog lies in the low ground between the hills.
  - The parish church tower and the mesquite crowns rise out of it.
  - The ranch roofs stay half visible.
- **Tequila:**
  - A fog bank lies over the far agave rows, with only the volcano's summit showing above it.
  - The nearer rows stay clear.
- **Technique:**
  - Use dithered edges (the 25/50/75% pattern of `src/scene/sky.js` and `citySky`) rather than translucency.
  - Under the fog, use the `cloudy` sky.
  - Fog is static or drifts with the existing cloud loop.
