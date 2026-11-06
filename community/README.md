# Community depot

Trains and skylines from people's own cities. Each one is a JSON file that someone added with a pull request, and they all show up in the [gallery](https://cracksmity.github.io/git-trains/gallery/), where anyone can open one in the studio and make it their own.

Your city's metro, the tram you take to work, the skyline outside your window: if it's real, it belongs here.

## Add yours

1. **Draw it.** Paste [docs/ai/train.md](../docs/ai/train.md) or [docs/ai/skyline.md](../docs/ai/skyline.md) into your AI (Claude, ChatGPT, Gemini...) with a photo or a description, and check the JSON it writes in the [playground](https://cracksmity.github.io/git-trains/preview/#yours). It's the same format the Action reads, so you can use it on your own profile too.
2. **Sign it.** Add three fields at the top:

   ```json
   {
     "id": "nyc-subway",
     "name": "New York City Subway",
     "description": "Inspired by the R160 cars: fluted stainless steel, a gray front with a black mask, a route sign and low headlights.",
     "author": "your-github-username",
     "pal": { "body": "#b4b9c1" }
   }
   ```

3. **Save it** as `community/trains/<id>.json` (the file name is the train's `id`) or `community/skylines/<city>.json` (the file name is the skyline's id), and run `npm run community` with Node 24. Commit the regenerated `community/index.json` along with your file and open a pull request.

A check runs on your pull request: it validates the file the way the Action does, draws a preview (the scene in light and dark, and for a train the mini version from calendar mode) and comments with the result. If something is off, the comment lists every problem at once, worded so you can paste it back to the AI. Once it's merged, the gallery picks it up.

No time to draw it? [Request a city or train](https://github.com/Cracksmity/git-trains/issues/new?template=city-request.yml) and someone else may.

## Rules

- **No logos or lettering.** Colors and shapes only: no operator logos, line names or signs drawn into the pixels (the program writes the LED sign itself).
- **A description of the real train or city.** `description` says which train it is (model, line, city) or which city, and what the drawing shows, left to right for a skyline. For a generic type, like the steam tank engine, say what it's based on.
- **One train or skyline per pull request**, so each one is reviewed and credited on its own.
- **Your own work.** `author` is your GitHub username (no `@`). If you started from someone else's file, say so in `description` or `source`.
- Files are MIT licensed, like the rest of the repository.

## What the check looks at

| | |
| --- | --- |
| `name` | Required, 40 characters at most. Shown in the gallery. |
| `description` | Required, 500 characters at most. |
| `author` | Required: a GitHub username. |
| `id` | Trains only: required, and the same as the file name. Lowercase letters, digits and hyphens, 32 at most. |
| File name | The id, plus `.json`. For a skyline, the same rule as a train's id. |
| Size | 64 KB at most. |
| Everything else | The Action's own validators: every color, row and size, with the messages you'd see in the Action's log. |

Other note fields (`source`, `inspiration`, and any key starting with `_`) are allowed and never drawn.

Check locally with Node 24, no install needed:

```bash
node scripts/community.js --check                                      # every file in community/
node scripts/community.js preview --out sample/community community/trains/nyc-subway.json   # PNG previews
```

Run `npm run community` after changing community files and commit the regenerated `community/index.json`. If it conflicts with another contribution, update your branch, run the command again, and commit the result.
