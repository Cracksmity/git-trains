Translate the benchmark page `benchmarks/medellin/index.html` from Spanish to English.

It reports a test in which ten AI runs (Claude Code, Codex and Antigravity) designed the same Medellín Metro train and skyline for this project. Translate all visible text, the `<title>`, the meta description, `aria-label`/`alt` texts and the CSS comments. Set `<html lang="en">`.

Keep exactly: the structure, the CSS, every number, time, token count and score, model and tool names, and the proper names of places and buildings (Catedral Metropolitana, Coltejer, Palacio de la Cultura, valle de Aburrá...). Write natural, plain English, as a short technical report; don't add or drop claims. Use English number formatting (41,495; 7 min 24 s).

The page moved and its files were renamed, so fix its links while you are at it:

- The page now lives at `benchmarks/medellin/` (it was `comparativa/medellin/`).
- In every run folder: `tren-medellin.json` -> `train.json`, `fondo-medellin.json` -> `skyline.json`, `escena-light.svg` -> `scene-light.svg`, `escena-dark.svg` -> `scene-dark.svg`, `tren.png` -> `train.png`.
- The AI guides: `docs/ia/tren.md` -> `docs/ai/train.md`, `docs/ia/fondo.md` -> `docs/ai/skyline.md`.
- The project is called git-trains (not git-trenes). The playground is still at `../../preview/`.

The eyebrow line at the top becomes: git-trains · playground · model test · Nov 3, 2026.

Edit only `benchmarks/medellin/index.html`.
