Translate the remaining Spanish comments in the code to English.

Files: `src/trains/render.js`, `src/trains/noses.js`, `src/graphics/pixel.js`, `src/graphics/font.js`, `src/activity/languages.js`, `src/demo/sample.js`, `src/cards/profile.js`, `src/scene/render.js`, `src/scene/backdrop.js`, `src/trains/models.js`, `src/landscape/skyline-parse.js`, `src/github/user.js`, `scripts/sheet.js`.

Rules:

- Translate comments (`//`, `/* */`) faithfully into plain, direct English. Keep their meaning, their place and their line structure; don't add or remove comments.
- Also translate the text of Spanish developer-facing strings, such as the two `throw new Error(...)` messages in `src/trains/noses.js`.
- Do NOT translate the Spanish UI locale: the `es` entry of `LABELS` in `src/cards/profile.js` stays in Spanish (it is what Spanish-speaking users see on their cards).
- Do NOT change any code: no renames, no refactors, no formatting changes, no "small fixes". Only comment text and string text may change. A gate compares the code line by line.
- Names used in the project now: git-trains (not git-trenes); models `tram`, `metro-orange`, `metro-gray`, `metro-yellow`, `metro-white`, `bullet`; skylines `city`, `new-york`, `osaka`.
- Some comments name real places and trains (SITEUR TEG-90, Shitennō-ji, Tsutenkaku...): keep those names as they are.
