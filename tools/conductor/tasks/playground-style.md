Restyle the playground, `preview/index.html` and `assets/preview/style.css`, so it looks like the rest of the site.

Right now it uses system fonts, a beige background and an orange accent, so it looks like a different project from the home page (`index.html`) and the benchmark (`benchmarks/medellin/index.html`). Read those two pages first and adopt their visual system:

- The same design tokens on `:root` (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--green`, `--yellow`, `--chip`, `--display`, `--body`, `--mono`), the same dark palette, and the same dark-mode pattern as the benchmark (`@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])`, plus `:root[data-theme="dark"]`). Define `color-scheme` and give `body` an explicit background.
- The same fonts, loaded the same way: Pixelify Sans for headings, IBM Plex Sans for text, IBM Plex Mono for small labels, values and code.
- The same header: the yellow/green `.stripe`, a small mono uppercase eyebrow line, and the `h1` in Pixelify Sans. Put two links in the eyebrow back to the home page (`../`) and the benchmark (`../benchmarks/medellin/`).
- Green as the accent everywhere the orange was: the pressed segmented buttons, the main buttons, links, the selected catalog card, focus rings. Status colors (ok/bad) stay readable in both themes.
- Panels, cards, the stage and the zoom box as surfaces like the home page cards: `var(--surface)`, `1px solid var(--line)`, 8px radius. Section titles (`h2`) like the benchmark's: mono, small, uppercase, muted.
- Form controls (select, text input, range, segmented buttons, textareas) restyled to match: the same radius and borders, mono for numbers and code, visible `:focus-visible` outlines in green, `accent-color` for the range inputs.
- Keep `image-rendering: pixelated` on the scene image and the canvases, and the checkerboard behind the zoomed train.
- Keep it working on phones: one column under about 820 px, 16 px side gutter, no horizontal page scroll (the zoom box may scroll inside itself).

Rules:

- Change only `preview/index.html` and `assets/preview/style.css`, and inside it only the `<head>` (styles, fonts) and the HTML markup. **Do not touch the `<script>` block at all**: not a character. The scripts find elements by `id` and by `data-*` attributes, so keep every `id` and every `data-*` attribute; you may add wrappers and classes.
- Keep all the visible text as it is, in English; you may add the eyebrow line.
- No new libraries or frameworks; plain CSS.
