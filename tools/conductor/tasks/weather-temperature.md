Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task. This one adds no state: it shows each place's temperature in the Jalisco captions when the weather is live.

**The format:** `Tequila 20° / Rust 15%`, the place, the rounded temperature and a degree sign, then the caption as it is today.
- Round with `Math.round`, and never show `-0°`: -0.4 °C reads `0°`, -2.6 °C reads `-3°`.
- One track (`mode: single`) shows its place temperature the same way: `Guadalajara 20° / TypeScript - 1234`.
- Both languages use the same format.

**Where the temperature comes from:** a live reading already reaches `buildSpec` as `{ state, temperature }` entries in `opts.weather` (see `PlaceSky` in `src/weather/conditions.js` and `weatherFor` in `src/action/weather.js`); `buildSpec` keeps them in `spec.sky`. Fixed states are plain names with no temperature, so their captions stay exactly as they are, and so does a place whose temperature is null.

**The font:** `src/graphics/font.js` is a 3x5 pixel font, and `clean` drops every character it cannot draw, the degree sign included.
- Add a `°` glyph in the font's style: a small ring in the top rows, narrower than a digit if that reads better, with a test.
- Keep every other glyph and `clean`'s behavior for other characters exactly as they are: the LED signs and the cards use this font.

**The fit:** the caption box on the ballast grows with the text (`src/scene/backdrop.js`). Check that the longest caption still fits and clears the station signal and the trains, in both directions of travel, with the sample profile and with a long language name such as "Jupyter Notebook". Look at the PNGs.

**Docs:** say in the Weather section of `docs/reference.md` and the Clima section of `docs/es/reference.md` that live weather shows each place's temperature in its caption. Remove the "Temperature in captions" row and section from `docs/weather-backlog.md`, and "Temperatura en las leyendas" from `docs/es/clima-pendiente.md`.

To see it: `node scripts/zoom.js --scale 2 --weather <state> --out .scratch/temp` draws fixed weather only. To look at live temperatures, write a small script under `.scratch/` that renders `buildSpec` with `{ state, temperature }` entries, or run `node src/index.js --sample` with `INPUT_WEATHER=live`, `INPUT_TRAIN=jalisco`, `INPUT_SKYLINE=jalisco`, `INPUT_MODE=multi` and `INPUT_OUTPUT-DIR` set to a folder under `.scratch/`.
