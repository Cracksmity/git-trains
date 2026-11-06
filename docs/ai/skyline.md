# Design a skyline for git-trains

> **If you are a person:** copy this entire file into your AI chat (Claude, ChatGPT, Gemini...) and at the end say which city you want or attach a photo of the skyline. The AI will return JSON: paste it into the playground to see it (see the [README](../../README.md)) and save it in your profile repository as `.github/skyline.json`.

## Your task

You are a pixel art designer. Describe a **city skyline** as JSON for git-trains, a GitHub Action that draws a pixel art train (SVG) passing in front of a city.

The person may write in any language; answer in theirs, but keep the JSON keys and symbols exactly as documented.

The skyline is **silhouette pixel art, with little detail**: single-color blocks for each layer, recognizable by their shape (a spire, a dome, steps), not by their windows. You do not choose the colors: the program paints the buildings with the theme color (light by day, dark with lit windows at night).

Reply with **one `json` block** containing the complete skyline and at most two lines of explanation. If the person pastes validator errors, fix all of them and return the complete JSON again.

## Rules

1. **Few, recognizable buildings.** Choose 4 to 8 iconic buildings or monuments and exaggerate their shapes a little. With `"fill": true` the program fills gaps with generic low buildings.
2. **No logos or signs.** Silhouettes only.
3. If given a photo, respect the left-to-right order and relative proportions (which is tallest, which is wide), not the real measurements.

## The scene

```
x = 0 ............................................. x = 447
y = 0   sky
        [station sign: x 10-90, y 10-24]             [sun or moon: x 382-402, y 10-30]
        ...
y = 63  the train starts here: it almost always covers the full width from y = 63 to 88
y = 88  ground (the base of all buildings)
```

- Each building rests on the ground (y = 88). Its maximum height is 84.
- **The train covers the lower part** (about 25 pixels) across almost the entire width: anything you want visible must be **more than 30 high**. Low objects (bridges, small monuments) are visible only when the train is short.
- Avoid very tall towers at `x < 90`, where the sign with the person's name goes.
- Everything is in pixels: a typical skyscraper is 8 to 20 wide.

## Format

```
{
  "name": "City name",
  "fill": true,
  "buildings": [ ...buildings... ]
}
```

| field | meaning |
| --- | --- |
| `name` | display name |
| `fill` | `true` (default): fill gaps with generic low buildings. `false`: draw only what you specify |
| `buildings` | list of 1 to 120 buildings |
| `region` | optional: the countryside around the city (its houses, trees, plants, landmark and terrain); see [region.md](region.md) |

### A shaped building (`w`, `h`, `top`)

```json
{ "name": "Empire State", "x": 164, "w": 20, "h": 34, "top": [{ "type": "stepped", "steps": 3, "h": 4 }, { "type": "spire", "h": 5 }, { "type": "antenna", "h": 8 }] }
```

| field | meaning |
| --- | --- |
| `x` | left column (-40 to 447) |
| `w` | width (2 to 200; mountains can be wide) |
| `h` | body height, **excluding** the top (2 to 84) |
| `layer` | `"near"` (default): in front, darker and with windows. `"far"`: behind, lighter, without windows (mountains, distant buildings) |
| `windows` | `true`/`false` to force windows (by default, only on `near`) |
| `top` | top: one type or a list of up to 4 stacked on each other |
| `name` | note for you; not drawn |

Top types (`top`), each as a string (`"spire"`) or object (`{ "type": "spire", "h": 10 }`):

| type | shape | options |
| --- | --- | --- |
| `flat` | flat roof | |
| `stepped` | stepped (each floor narrower) | `steps` 1-4, `h` height of each floor |
| `pyramid` | tapers to a point | `h` height, `tip` width of the tip (a large `tip` makes a truncated pyramid, like a volcano) |
| `dome` | dome | `h` height |
| `spire` | spire | `h` height |
| `antenna` | 1-pixel antenna | `h` height |

Stacking tops works for almost anything: `["stepped", "antenna"]`, `[{ "type": "pyramid", "tip": 4 }, "spire"]`...

### A drawn building (`rows`)

For monuments with their own shape (a bridge, a statue, a cathedral), draw them row by row, top to bottom. The last row touches the ground.

| symbol | meaning |
| --- | --- |
| `#` | building |
| `w` | window (lit at night) |
| `.` | empty |

```json
{ "name": "Ángel de la Independencia", "x": 130, "rows": [
  "#.#.#",
  ".###.",
  "..#..",
  ".###.",
  "..#..",
  "..#..",
  "..#..",
  ".###.",
  "#####"
] }
```

With `rows`, do not use `w`, `h` or `top`. Maximum 84 rows and 200 columns.

## Complete example

Mexico City: Popocat?petl in the background, Bellas Artes, the Angel, Torre Latinoamericana and the Reforma towers, with fill.

```json
{
  "name": "Ciudad de México",
  "fill": true,
  "buildings": [
    { "name": "Popocatépetl", "x": 300, "w": 120, "h": 2, "layer": "far", "windows": false, "top": [{ "type": "pyramid", "h": 30, "tip": 16 }] },
    {
      "name": "Palacio de Bellas Artes",
      "x": 96,
      "rows": [
        "............#............",
        "..........#####..........",
        ".........#######.........",
        "........#########........",
        "........#########........",
        ".......###########.......",
        "....#################....",
        "...###################...",
        "..#####################..",
        "..#w#w#w#w#w#w#w#w#w#w#..",
        "..#####################..",
        "..#w#w#w#w#w#w#w#w#w#w#..",
        "#########################",
        "#########################"
      ]
    },
    { "name": "Torre Latinoamericana", "x": 150, "w": 12, "h": 40, "top": [{ "type": "stepped", "steps": 2, "h": 3 }, { "type": "antenna", "h": 10 }] },
    { "name": "Torre Reforma", "x": 228, "w": 12, "h": 60 },
    { "name": "Torre BBVA", "x": 244, "w": 14, "h": 52 },
    { "name": "Torre Mayor", "x": 262, "w": 14, "h": 50, "top": [{ "type": "pyramid", "h": 3, "tip": 8 }] }
  ]
}
```

## The countryside (optional)

Between the tracks, git-trains also draws countryside. A skyline can bring its region's own (Japanese farmhouses and cherry trees for Osaka, adobe houses and agave for Guadalajara) in an optional `region` block. Do not draw it here: if the person asks for it, tell them to paste [region.md](region.md) into their AI along with this skyline.

---

Now, the city I want:
