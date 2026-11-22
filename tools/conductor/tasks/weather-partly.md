Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task.

Add the state `partly` (English name "partly cloudy", Spanish "medio nublado").

Trigger: WMO codes 1 and 2, which map to `clear` today. Code 0 stays `clear`.

Art: between clear and cloudy.
- Keep the scene's usual sky, sun and moon, and its usual clouds.
- Add a second layer of three or four larger, flatter cloud banks drifting with the existing cloud loop (a `drift` layer, two scene widths long, seamless). Use the scene's own cloud colors, or new inks close to them in both themes.
- One bank may pass partly in front of the sun at some point of the loop, but the sun must show in frame 0.
- The two country strips get one or two small banks each, painted only over their sky pixels so the ridges stay in front.
- No veil, no rain. It must look clearly calmer than `cloudy`.
