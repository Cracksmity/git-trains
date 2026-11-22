Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task.

Add the state `frost` (English name "frost", Spanish "helada").

Trigger: a clear code (0, 1 or 2) with `temperature_2m` at 2 °C or less.
- Decide it in `readCurrentWeather` from the code and the temperature together.
- Other codes keep their state whatever the temperature (rain at 1 °C is still rain).
- If code 1 or 2 already maps to `partly` when you start, frost still wins at 2 °C or less.
- Test the threshold on both sides.

Art, mostly in Los Altos (frost is common on its winter mornings):
- A pale blue-white tint on the top pixel of the pasture and grassland ridges and on the ranch roofs. Find those surfaces from the backdrop grid; do not cover the whole surface.
- A thin white line along the dry-stone wall.
- Guadalajara: frost only on the plaza trees.
- Tequila: frosted agave tips.
- The sky stays clear. Nothing moves.
- It must be visible but subtle in both themes.
