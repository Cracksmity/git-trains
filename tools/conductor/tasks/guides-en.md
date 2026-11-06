Translate the two AI guides from Spanish to English and move them:

- `docs/ia/tren.md` -> `docs/ai/train.md`
- `docs/ia/fondo.md` -> `docs/ai/skyline.md`

Then delete the `docs/ia/` folder.

These guides are pasted into an AI chat (Claude, ChatGPT, Gemini...) so the AI can design a train or a city skyline as JSON for this project. The reader is an AI, so the translation must be faithful and precise: keep every rule, table, number, symbol, size and code block. Change only the language and the names listed below. Write plain, direct English.

What changed in the project, to apply while translating:

- The project is called **git-trains** now (not git-trenes).
- Catalog train ids: `tranvia` -> `tram`, `metro-naranja` -> `metro-orange`, `metro-gris` -> `metro-gray`, `metro-amarillo` -> `metro-yellow`, `metro-blanco` -> `metro-white`, `bala` -> `bullet`. Use the new ids everywhere, in prose and in JSON.
- Built-in skylines: `nueva-york` -> `new-york`; the procedural city is `city` (was `ciudad`).
- Action inputs: `tren` -> `train`, `fondo` -> `skyline`. People save their files as `.github/train.json` and `.github/skyline.json`, and use `train: .github/train.json` / `skyline: .github/skyline.json`.
- Example files moved: `examples/tren-nueva-york.json` -> `examples/trains/new-york.json`, `examples/tren-vapor.json` -> `examples/trains/steam.json`, `examples/tren-osaka.json` -> `examples/trains/osaka.json`, `examples/tren-medellin.json` -> `examples/trains/medellin.json`, `examples/fondo-cdmx.json` -> `examples/skylines/mexico-city.json`, `examples/fondo-medellin.json` -> `examples/skylines/medellin.json`.
- The validator's error messages are in English now (see `src/trains/parse.js` and `src/landscape/skyline-parse.js`). Where a guide quotes an error message, quote the new English wording.
- Notes keys: `description`, `author`, `source`, `inspiration` (the Spanish ones still work, but show the English ones).

Hard requirements (the tests check them):

1. In `docs/ai/train.md`, the first ```json block must be exactly the JSON of `examples/trains/new-york.json` (deep-equal), and the ```json block that has `"loco"` must be exactly the JSON of `examples/trains/steam.json`. Their `id`, `name` and `description` are already in English in those files: copy them from the files.
2. Every ```json block in both guides must still pass the validator (a block with `buildings` is a full skyline, a block with `pal` a full train; other blocks are fragments and must still be valid JSON).
3. Relative links must point to files that exist (for example `../../README.md`, `../../preview/`).

At the top of each guide keep the note for humans (copy this file into your AI chat...). Add one line in the task section: the person may write in any language; answer in theirs, but keep the JSON keys and symbols exactly as documented.
