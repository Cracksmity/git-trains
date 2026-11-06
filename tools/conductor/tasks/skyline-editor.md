Build the skyline editor of the git-trains studio: `src/studio/skyline/controller.js`.

The studio (`studio/index.html`) already has a working train editor (`src/studio/train/controller.js`). Read it first, together with `src/studio/pixel-grid.js`, `src/sharing/codec.js`, `src/landscape/skyline-parse.js` and `docs/ai/skyline.md`: the skyline editor must look and work like the train editor, with the same components and CSS classes, so the two tabs feel like one tool. Serve the repo with `npm run preview` and open `http://localhost:4173/studio/` if you can check it in a browser.

The page already does this, so match it exactly:

```js
const { mountSkylineEditor } = await import('../src/studio/skyline/controller.js');
mountSkylineEditor(document.getElementById('panel-skyline'), { initialText }); // initialText: JSON text from a share link, or undefined
```

`mountSkylineEditor(root, { initialText })` builds the editor inside `root` and returns `{ load(text) }`. Also export a pure helper `formatSkyline(skyline)` that returns the JSON text as in `examples/skylines/` (one drawing row per line, short number lists on one line), like `formatTrain` in the train editor.

What it must do:

1. **Layout like the train editor:** a `.te` grid with the form on the left (`.te-form`, sections as `.panel` with an `h3`) and a sticky preview on the right (`.te-preview`).
2. **Start from:** the built-in skylines (`SKYLINES` in `src/landscape/skyline-parse.js`: new-york, osaka), the examples (`../examples/skylines/mexico-city.json`, `medellin.json`) and "Blank".
3. **Name:** name, description, author, and `fill` (fill the gaps with the procedural city).
4. **Buildings:** a list of the buildings, each selectable, with add block / add drawing / duplicate / delete. A block building has `x`, `w`, `h`, `layer` (near/far), `windows`, and up to 4 stacked tops (`flat`, `stepped` with `steps` and `h`, `spire`, `antenna`, `dome`, `pyramid` with `tip` and `h`). A drawn building (`rows`) is edited with `createPixelGrid` from `./pixel-grid.js`, symbols `#` (building) and `w` (window), plus its `x` and `layer`. Validation messages are the validator's (`parseSkyline`), shown exactly like the train editor's status.
5. **The scene, as a canvas you can work on:** a 448 × 88 canvas (zoomed to fit, `image-rendering: pixelated`) showing the skyline the way the program paints it (the theme colors `@city`, `@city2`, `@cityWin` of `THEMES` in `src/scene/backdrop.js`, light or dark), with guides you can toggle: the band the train covers (y 63 to 88), the station sign (x 10-90, y 10-24) and the sun or moon (x 382-402, y 10-30). Click a building to select it; drag it to move its `x`; the selected one is outlined.
6. **Preview:** the real scene SVG with `renderScene(buildSpec(sampleStats(), { skyline: parsed, theme }))`, light/dark toggle, like the train editor.
7. **Output:** the JSON textarea (two-way, as in the train editor), and buttons: Copy share link (`encodeShare('skyline', ...)` from `./share.js`, which also sets `location.hash`), Copy JSON, Download skyline.json, Open in the playground (store the JSON in `localStorage['git-trains:skyline']`, open `../preview/#yours`). Autosave the draft in `localStorage['git-trains:studio-skyline']` and start from it when there is no share link.

Rules: plain ES modules, no dependencies, English UI text. Edit only `src/studio/skyline/controller.js` and create `tests/studio/skyline-editor.test.js` with tests for `formatSkyline` (round trip of the examples and presets through `parseSkyline`). If you need a few styles of your own, have the module add one `<style id="skyline-editor-style">` with them, using the page's CSS variables (`--surface`, `--line`, `--green`...). The module must not touch the DOM at import time (Node imports it in the tests).
