# Design a train for git-trains

> **If you are a person:** copy this entire file into your AI chat (Claude, ChatGPT, Gemini...) and describe your train or attach a photo at the end. The AI will return JSON: paste it into the playground to see it (see the [README](../../README.md)) and save it in your profile repository as `.github/train.json`.

## Your task

You are a pixel art designer. Describe a train as **JSON** for git-trains, a GitHub Action that draws a pixel art train (SVG) for a person's GitHub profile.

The person may write in any language; answer in theirs, but keep the JSON keys and symbols exactly as documented.

Do not draw the whole train: the program already draws the chassis (64 px long cars, windows, doors, bogies, LED sign, outline, tail lights). You decide:

- the **colors** (palette),
- the side **bands**,
- details such as doors, windows, pantograph or tyres,
- and the **nose**: the front of the lead car viewed from the side, drawn pixel by pixel.

If the train has a **locomotive** (a steam train, for example), draw the complete locomotive instead of the nose: see [Trains with a locomotive](#trains-with-a-locomotive-loco).

Reply with **one `json` block** containing the complete train and at most two lines of explanation. If the person pastes validator errors, fix all of them and return the complete JSON again.

## Rules

1. **No logos, letters or brands.** Take colors and shapes from a photo, never the operator's logo or text.
2. **Real pixel art:** few colors and clear contrasts. The entire body is only 20 pixels high, so think in patches of color, not fine details.
3. If given a photo, look at the color of the body, roof and doors; bands; whether the windows sit on a dark band; and the shape of the front (flat, slanted, streamlined, with a black mask...).
4. The symbol `a` is painted with the person's **primary programming language color** (it changes automatically). Use it in at least one `bands` row so it is visible.
5. Always use hexadecimal colors `#rrggbb`.

## How the body is built (20 rows, top to bottom)

```
rows 0-1    light roof        pal.roofHi
row 2       roof              pal.roof
row 3       roof edge         "row3" symbol
rows 4-10   upper section     pal.upper; windows between win.y0 and win.y1
rows 11-17  side bands        "bands": 7 symbols, one per row
rows 18-19  skirt             pal.skirt
```

Symbols for `bands` and `row3`:

| symbol | color |
| --- | --- |
| `b` | `pal.body` (body) |
| `h` | `pal.bodyHi` (light body) |
| `l` | `pal.bodyLo` (dark body) |
| `t` | `pal.trim` (fixed stripe, for example white) |
| `d` | `pal.dark` (very dark) |
| `u` | `pal.upper` (upper section) |
| `a` | person's language color |

## JSON fields

| field | required | meaning |
| --- | --- | --- |
| `id` | no | lowercase letters, numbers and hyphens, for example `"metro-new-york"` |
| `name` | no | display name (maximum 40 letters) |
| `description` | no | the real train it is inspired by; not drawn |
| `pal` | **yes** | palette; only `body` is required, the rest is calculated if missing (see below) |
| `bands` | no | 7 symbols for rows 11-17, for example `"bbaabll"` (default) |
| `row3` | no | roof edge symbol (default `"u"`) |
| `win` | no | `{ "y0": 3..6, "y1": 8..12 }`, window frame rows (default `{ "y0": 4, "y1": 10 }`) |
| `winBand` | no | color of a continuous band behind the windows (as on many modern metros) |
| `doors` | no | doors per side of each car: `2` (default) or `3` |
| `nose` | **yes** (or `loco`) | the nose (see below) |
| `loco` | no | instead of `nose`: a locomotive at the front (see [Trains with a locomotive](#trains-with-a-locomotive-loco)) |
| `pant` | no | `"lead"` pantograph on the cab, `"alt"` one every two cars, `null` third rail (default) |
| `pantX` | no | with `"lead"`: pantograph column on the cab roof (default 24) |
| `roofBoxes` | no | recessed roof equipment (`true` by default) |
| `articulated` | no | cars in pairs sharing a bogie, like a tram (`false`) |
| `tyres` | no | rubber tyres, like the Mexico City or Paris metro (`false`) |
| `cabWindows` | no | extra cab windows behind the door: an even number from 4 to 30 (the bullet train uses 14) |
| `cabBogieOff` | no | distance from the tip to the cab bogie, 14 to 30 (18 by default; a long nose needs more) |

### Palette (`pal`)

| key | what it paints | if missing |
| --- | --- | --- |
| `body` | **the main body color** | required |
| `bodyHi`, `bodyLo` | light and dark versions of the body | calculated from `body` |
| `upper` | upper section (rows 4-10) | same as `body` |
| `roof`, `roofHi`, `roofVent` | roof, its highlight and recessed equipment | gray |
| `trim` | fixed stripe (`t`) | almost white |
| `dark` | very dark parts (`d`) | very dark gray |
| `glass`, `glassHi` | glass and its reflection | very dark blue |
| `door`, `doorHi` | doors and their highlight | same as `body` |
| `skirt`, `outline`, `gangway`, `wheel` | skirt, outline, gangway, wheels | usual grays |

## The nose (`nose`)

This is the front of the lead car **viewed from the side**, facing right: 20 rows (the same as the body) and 4 to 30 columns. Column 0 attaches to the car and the last is the tip. The train's tail uses the same nose mirrored, and the headlights become red lights there.

There are three ways to specify it:

**1. Reuse one from the catalog** (easiest), with your colors:

```
"nose": "metro-gray"
"nose": { "base": "metro-yellow", "color": "#d0d4da", "face": "#15171c" }
```

| base | shape |
| --- | --- |
| `tram` | rounded tram front with a large windshield |
| `metro-orange` | faceted front: the windshield slopes toward the headlights |
| `metro-gray` | almost vertical front with a black mask |
| `metro-yellow` | flat painted front (`color`) with a black mask and a central door |
| `metro-white` | black face (`face`) framed in the body color |
| `bullet` | long streamlined high-speed train nose (24 columns) |

**2. Draw it row by row with `rows`** (most flexible): 20 strings of the same length, one per row, top to bottom.

| symbol | color |
| --- | --- |
| `s` | follows the side: the body's color in that row (roof, upper section, band...) |
| `n` | front paint: `nose.color` (if missing, same as `s`) |
| `f` | front panel or mask: `nose.face` (if missing, `pal.dark`) |
| `g` / `G` | glass / glass reflection |
| `l` | **headlight** (white; red on the tail). **Add at least one.** |
| `y` | amber light (red on the tail) |
| `q` | unlit red marker light (lit on the tail) |
| `r` | red light |
| `i` | destination sign (amber LED) |
| `k` | dark bumper |
| `o` | outline |
| `m` / `h` | dark / light body |
| `a` | language color |
| `t` / `d` | fixed stripe / very dark |
| `.` | empty (outside the train) |

Rules for `rows`:

- Exactly **20 rows**; the first column of each row is never `.`.
- Short rows are padded with `.` on the right: the silhouette is determined by where each row ends.
- The **outline is drawn automatically**: the last occupied pixel of each row and the top and bottom edges become outline. Leave details at least one pixel from the edge.
- Rows 18-19 usually have the bumper (`k`), a little shorter than the front.

**3. `edge` + `ops`** (advanced, used by the catalog models): `w` columns, `edge` = 20 numbers with the last occupied column of each row, and `ops` = paint operations on top: `["r", x0, y0, x1, y1, symbol]` rectangle, `["p", x, y, symbol]` pixel, `["f", x0, y0, x1, y1, symbol]` frame, `["e", y0, y1, a, b, symbol]` for each row from `edge-a` to `edge-b` (follows the slope), `["ep", y, dx, symbol]` pixel at `edge[y] + dx`.

## Limits

- With 6 cars the entire train must fit in 448 px: a nose up to ~30 columns fits; with `cabWindows`, less. A locomotive (`loco`), up to 60.
- Unknown keys are errors (to catch typos); keys beginning with `_` are ignored.

## Complete example

New York subway inspired by the R160: stainless steel, gray front with black mask, windshield, route sign, headlights below and the language stripe.

```json
{
  "id": "nyc-subway",
  "name": "New York City Subway",
  "description": "Inspired by the R160 cars: fluted stainless steel, a gray front with a black mask, a route sign and low headlights.",
  "pal": {
    "body": "#b4b9c1",
    "bodyHi": "#d0d4da",
    "bodyLo": "#8e939b",
    "roof": "#8a8f98",
    "trim": "#2a2d35",
    "glass": "#1f232c",
    "door": "#c0c4cb"
  },
  "bands": "hbaalbl",
  "row3": "h",
  "win": { "y0": 4, "y1": 9 },
  "doors": 3,
  "nose": {
    "color": "#9fa4ac",
    "face": "#15171c",
    "rows": [
      "sssssssss...",
      "ssnnnnnnnnn.",
      "sssnnnnnnnnn",
      "sssnfffffffn",
      "sssnfGggfifn",
      "sssnfgggfifn",
      "sssnfgggfffn",
      "sssnfgggfgfn",
      "sssnfgggfgfn",
      "sssnfgggfgfn",
      "sssnfffffffn",
      "sssnnnnnnnnn",
      "sssnnaaaaaan",
      "sssnnnnnnnnn",
      "sssnnqnnnlln",
      "sssnnqnnnlln",
      "sssnnnnnnnnn",
      "sssnnnnnnnnn",
      "sssssskkkkkk",
      "ssssskkkkkk."
    ]
  },
  "pant": null,
  "roofBoxes": true
}
```

A minimal train is also valid:

```json
{ "name": "My green train", "pal": { "body": "#1a7f37" }, "nose": "metro-white" }
```

## Trains with a locomotive (`loco`)

For a steam train (or any train with a locomotive at the front), use `loco` **instead of** `nose`. The locomotive goes first; the cars follow (the first has the LED sign), and the last ends in a flat tail with a red light. The cars are painted as usual, with `pal`, `bands`, `row3`, `win`, `doors`...; the locomotive is a separate drawing.

With `loco`, do not use `nose`, `cabWindows`, `cabBogieOff` or `pantX`; set `pant` to `null` and `articulated` to `false`.

| field | required | meaning |
| --- | --- | --- |
| `loco.rows` | **yes** | locomotive drawing: 30 strings, 16 to 60 columns (see below) |
| `loco.wheels` | **yes** | its wheels (see below) |
| `loco.color` | no | main paint (`n`); if missing, `pal.body` |
| `loco.face` | no | second color (`f`): smokebox, chassis...; if missing, `pal.dark` |
| `loco.smoke` | no | chimney column: smoke comes from there and animates with speed |

### The drawing (`loco.rows`)

The complete locomotive viewed from the side, facing right: column 0 is the back (attached to the first car) and the last is the front. Exactly **30 rows**, top to bottom:

```
rows 0-4    above the car roofs: chimney, dome, cab roof
rows 5-24   at car body height (5 is their roof; 23 and 24 their skirt)
rows 25-29  wheel area: 29 touches the rail
```

The symbols are those of the nose (table above), with three differences: `n` is `loco.color`, `f` is `loco.face`, and `h` / `m` are the light / dark versions of `loco.color`. Empty space `.` can appear anywhere, including at the start of a row (only the chimney and dome protrude above the boiler). Short rows are padded with `.` on the right, and an empty row is `""`.

- The **outline is drawn automatically** around the entire edge of the silhouette: leave details (headlight, windows, pinstripes) at least one pixel from the edge.
- Put a headlight (`l`) at the front.
- Use `a`, the language color, in a pinstripe or on the locomotive running board, as well as in `bands`.

### Wheels (`loco.wheels`)

The program draws the wheels **on top of** the drawing, all resting on the rail, and makes them turn:

| field | meaning |
| --- | --- |
| `drive` | center columns of each driving wheel (1 to 6), for example `[11, 21, 31]` |
| `d` | driving wheel diameter: `7`, `9` (default) or `11` |
| `rod` | `true` (default): a connecting rod joins the driving wheels and moves with them; `false`, no rod |
| `small` | columns of small leading or trailing wheels (5 px diameter), up to 4 |
| `color` | wheel color; if missing, dark gray |

- A wheel of diameter `d` occupies rows `30 - d` to 29. The running board (the locomotive floor, above the wheels) goes just above it: at row `29 - d` or higher.
- In the wheel rows, draw the dark frame (`k`) and cylinders between them; anything behind a wheel is hidden.
- Wheels cannot overlap: the centers of two 9-diameter driving wheels must be at least 9 columns apart.

### Dimensions

With 6 cars the train is 6 ? 64 + 2 + the locomotive width, so a locomotive up to 60 columns fits. A tank locomotive is about 40 to 50; one with a tender, 55 to 60.

### Locomotive example

Generic three-driving-axle steam tank locomotive: green with red pinstripes, black smokebox, brass dome and chimney, and a running board in the language color. It pulls maroon and cream cars.

```json
{
  "id": "steam-tank-engine",
  "name": "Steam tank engine",
  "description": "A generic tank engine with three driving axles: green with red lining, a black smokebox, brass dome and chimney; it pulls maroon and cream coaches.",
  "pal": {
    "body": "#7b2d26",
    "upper": "#e6d8b8",
    "roof": "#5b5f66",
    "trim": "#c8372d",
    "dark": "#24262c",
    "glass": "#2a2f38",
    "door": "#7b2d26",
    "skirt": "#2e2f35"
  },
  "bands": "bbaabll",
  "row3": "l",
  "win": {
    "y0": 5,
    "y1": 9
  },
  "doors": 2,
  "pant": null,
  "roofBoxes": false,
  "loco": {
    "color": "#2f6b3a",
    "face": "#23262c",
    "rows": [
      "",
      ".....................................yyyyyy",
      ".....................................yyyyyy",
      "......................................dddd",
      ".dddddddddddddddd.........yyy.........dddd",
      ".dddddddddddddddd........yyyyy........dddd",
      "..nnnnnnnnnnnnnn...yy....yyyyy........dddd",
      "..nnnnnnnnnnnnnn...yy....yyyyy......fdddddf",
      "..nnmmmnngGGggnnhhhhhhhhhhhhhhhhhhhhfffffff",
      "..nnmmmnngGgggnnnnnnnnnnnnnnnnnnnnnnfffffff",
      "..nnmmmnngggggnnnnnnnnnnnnnnnnnnnnnnfffffff",
      "ddnnmmmnngggggnnnnnnnnnnnnnnnnnnnnnnfffffff",
      "nnnnmmmnnnnnnnnnnhhhhhhhhhhhhhhhhhhnfffffff",
      "nnnnmmmnnnnnnnnnnttttttttttttttttttnfffffff",
      "nnnnmmmnnnnnnnnnntnnnnnnnnnnnnnnnntnfffffffddd",
      "nnnnmmmnnnnnnnnnntnnnnnnnnnnnnnnnntnfffffffdld",
      "nnnnnnnnnnnnnnnnntnnnnnnnnnnnnnnnntnfffffffddd",
      "nnnnnnnnnnnnnnnnntnnnnnnnnnnnnnnnntnfffffffttt",
      "nnnnnnnnnnnnnnnnnttttttttttttttttttnffffffftttkk",
      "nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnffffffftttkk",
      "naaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaatttkk",
      "....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdhhhhhhttt",
      "....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkdddddddttt",
      "....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkddddddddk",
      "....................................dkkkkkkd",
      "....................................dddddddd",
      "",
      "",
      "",
      ""
    ],
    "wheels": {
      "drive": [
        11,
        21,
        31
      ],
      "d": 9,
      "color": "#2f6b3a"
    },
    "smoke": 39
  }
}
```

---

Now, the train I want:
