# Give a skyline its region's countryside

> **If you are a person:** copy this entire file into your AI chat (Claude, ChatGPT, Gemini...) and at the end say which city or region you want. If you already have a skyline (see [skyline.md](skyline.md)), paste its JSON too. The AI will return JSON: paste it into the playground to see it (see the [README](../../README.md)) and save it in your profile repository as `.github/skyline.json`. The countryside only shows between the tracks of the `multi` mode, and as plants on the slope in front of the city in every mode.

## Your task

You are a researcher and a pixel art designer. git-trains is a GitHub Action that draws a pixel art train (SVG) passing in front of a city. Between the tracks of its `multi` mode it also draws **countryside**: a village strip (small houses, trees) and a forest strip (trees). Today that countryside is the same everywhere. Your job is to write the **`region`** block of a skyline: the countryside that surrounds the person's city, so Osaka shows farmhouses and cherry trees and Guadalajara shows adobe houses and blue agave.

The person may write in any language; answer in theirs, but keep the JSON keys and symbols exactly as documented.

Reply with **one `json` block** and at most three lines of explanation: which region you chose, what you based it on, and anything you had not verified or simplified.

- If the person pasted a skyline, return **that skyline complete and unchanged, with your `region` added** as one more key next to `buildings`.
- If not, return only `{ "region": { ... } }` for them to paste inside their skyline JSON.

If the person pastes validator errors, fix all of them and return the complete JSON again.

## Rules

1. **Research before you draw.** The countryside is not the city: it is the land around it, within about an hour's travel (Kansai for Osaka, the Jalisco valleys for Guadalajara, the Hudson Valley for New York). Look up, from sources you trust (regional heritage registers, agriculture and forestry agencies, botanical gardens, universities, museums):
   - the **traditional rural house**: wall material, roof shape and material, the colors, and one distinctive detail (a veranda, deep eaves, a chimney, a recessed door);
   - **three or four native or emblematic plants** of that countryside: silhouette (trunk, crown), colors, and the season when it looks different (blossom, autumn);
   - **one landmark of the countryside** (a torii, a windmill, a barn, a volcano on the horizon), not a city monument;
   - the **terrain** behind it: `mountains`, `hills`, `plains` or `sea`.
2. **Be true to the place.** Do not mix settings that do not meet (wetland and dryland, coast and highland). Native and introduced plants may both be right, but not a plant that does not grow there. If you cannot verify something, say so in your explanation and draw something simple and generic instead of inventing it.
3. **No logos, signs or letters.** Silhouettes only.
4. **Few colors, clear shapes.** Each drawing is a handful of patches of color, readable when it is 10 pixels wide.

## Where each part goes

The scene is 448 pixels wide. In `multi` mode each strip between two tracks is 40 pixels tall and the train on the track below covers its lower 25: **what people see is the top half of each drawing**, so put what identifies it (the roof, the crown, the sails) up there.

| part | where it is drawn |
| --- | --- |
| `houses` | the village strips (the first, third... strip between tracks), a few per strip, chosen at random from your list |
| `trees` | all strips, between the houses (the forest strip is only trees) |
| `plants` | on the slope in front of the city (every mode) and as low crops between the houses |
| `landmark` | once in each village strip |
| `terrain` | the ridge behind the strips: `hills` (the usual rolling hills), `mountains` (a jagged blue ridge with snow on the highest peaks), `plains` (almost flat: open sky) or `sea` (a strip of water at the horizon) |

Every drawing stands on the ground: its **last row touches the ground** and it is centered on its spot. Drawings of houses, trees and plants are mirrored at random, so do not depend on which side a detail is on, and never draw letters.

## Format

```
{
  "terrain": "mountains",
  "accents": [ { "name": "thatch", "light": "#89734e", "dark": "#3a3326" } ],
  "houses":  [ { "name": "Minka farmhouse", "rows": [ ... ] } ],
  "trees":   [ { "name": "Mountain cherry", "rows": [ ... ] } ],
  "plants":  [ { "name": "Rice seedlings", "rows": [ ... ] } ],
  "landmark": { "name": "Torii", "place": "village", "rows": [ ... ] }
}
```

| field | meaning |
| --- | --- |
| `terrain` | `hills` (default), `mountains`, `plains` or `sea` |
| `accents` | 0 to 4 extra colors with a `light` and a `dark` value each (`#rrggbb`). Drawings use them as the symbols `1` to `4` |
| `houses` | 1 to 4 drawings, up to 24 columns by 16 rows each |
| `trees` | 1 to 6 drawings, up to 20 by 22 |
| `plants` | 1 to 4 low drawings, up to 16 by 12 |
| `landmark` | one drawing, up to 32 by 28, with `"place": "village"` (default: it stands among the houses) or `"far"` (it stands on the horizon, behind the nearest hill: a volcano, a mountain) |
| `name` | a note for you on the region, a drawing or an accent; it is not drawn. `description` and `source` are notes too: put your references in `source` |

Leave out any part you cannot do well: a missing part keeps the usual houses, pines and round trees.

### Drawings (`rows`)

Row by row, top to bottom, all about the same width. The last row touches the ground.

| symbol | meaning | color |
| --- | --- | --- |
| `.` | empty | |
| `#` | wall | the theme's house wall |
| `w` | window | pale blue by day, lit at night |
| `r` | roof | the theme's roof tile |
| `t` | trunk, timber or door | brown |
| `l` | leaves | the theme's green |
| `d` | dark leaves, the shaded side | a darker green |
| `1` `2` `3` `4` | your accents | `accents[0]` to `accents[3]` |

The symbols `# w r t l d` take the theme colors, so they are right by day and at night. For anything with a color of its own (thatch, adobe, blossom, agave, a volcano, a vermilion gate), add an **accent**: give its color by day in `light` and the same color darkened and a little desaturated for night in `dark` (about 40-55% as bright). Using an accent you did not define is an error.

Typical sizes: a farmhouse 12-16 wide by 8-12 tall, a tree 8-13 by 10-16, a plant 6-10 by 4-9, a landmark 10-16 by 8-16.

## The checks

Use `node` to validate: the program rejects, and lists together, an unknown terrain, a color that is not `#rrggbb`, unknown symbols, a drawing that is too big or empty, a last row without pixels, an accent that is not defined and more drawings than allowed. If the person pastes those messages, fix every one.

## Complete example

Córdoba, with the countryside of the Guadalquivir valley in Andalusia: whitewashed cortijos with a clay-tile roof, olives and stone pines, an olive-press tower, rolling hills. (The city itself is only three buildings here; see [skyline.md](skyline.md) to design it.)

```json
{
  "name": "Córdoba",
  "description": "Worked example of the region block: the whitewashed cortijos, olives and stone pines of the Guadalquivir countryside, with an olive-press tower.",
  "source": "Junta de Andalucía rural architecture inventory; Andalusian environmental portal (oak pasture and stone pine formations).",
  "fill": true,
  "buildings": [
    { "name": "Mezquita-Catedral", "x": 150, "w": 56, "h": 18, "windows": false, "top": [{ "type": "dome", "h": 5 }] },
    { "name": "Torre campanario", "x": 206, "w": 12, "h": 52, "top": [{ "type": "stepped", "steps": 2, "h": 3 }, { "type": "spire", "h": 5 }] },
    { "name": "Puente romano", "x": 240, "rows": [
      "####################################",
      "#..##...##..#..##...##..#..##...##..",
      "####################################"
    ] }
  ],
  "region": {
    "name": "Guadalquivir countryside, Andalusia",
    "terrain": "hills",
    "accents": [
      { "name": "olive crown", "light": "#8b9568", "dark": "#3f4733" },
      { "name": "olive highlight", "light": "#b0b394", "dark": "#5f6350" },
      { "name": "limewashed tower", "light": "#ded3b8", "dark": "#6a6455" }
    ],
    "houses": [
      { "name": "Cortijo wing", "rows": [
        ".........##....",
        "...rrrrrrrrr...",
        ".rrrrrrrrrrrrr.",
        "rrrrrrrrrrrrrrr",
        ".#############.",
        ".##w###t###w##.",
        ".##w###t###w##.",
        ".#############."
      ] }
    ],
    "trees": [
      { "name": "Olive", "rows": [
        "...1111...",
        ".11121111.",
        "1112111211",
        "11111211l1",
        ".11111111.",
        "....tt....",
        "...tt.t...",
        "..tt..t...",
        "..t...tt.."
      ] },
      { "name": "Stone pine", "rows": [
        "...dddddddd...",
        ".dddlddddlddd.",
        "dddddldddddddd",
        "..dddddddddd..",
        ".......t......",
        ".......t......",
        ".......t......",
        ".......t......",
        ".......t......",
        "......tt......"
      ] }
    ],
    "plants": [
      { "name": "Broom", "rows": [
        "..l.l..",
        ".lldlll",
        "lldllld",
        "...t..."
      ] }
    ],
    "landmark": { "name": "Olive-press counterweight tower", "place": "village", "rows": [
      "..rr..",
      ".rrrr.",
      "333333",
      "33w333",
      "333333",
      "333333",
      "33w333",
      "333333",
      "333333",
      "33w333",
      "333333",
      "333333"
    ] }
  }
}
```

---

Now, the city or region I want:
