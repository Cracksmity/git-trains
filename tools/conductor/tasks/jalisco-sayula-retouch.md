Second pass over the Sayula strip of `skyline: jalisco-sayula`. The first pass is already in the tree: read `tools/conductor/tasks/jalisco-sayula.md` (its brief), `src/landscape/jalisco-sayula.js`, `src/landscape/jalisco-weather-sayula.js` and `src/landscape/jalisco-palette.js`. Keep the contract of that brief and its gate (`tools/conductor/gates/jalisco-sayula.js`); `skyline: jalisco` still draws byte for byte as before (`weather-unchanged.js`). A new gate, `tools/conductor/gates/jalisco-sayula-retouch.js`, checks what follows; read it.

The descriptions below come from photos of the town. Follow them over anything you remember about Sayula: a landmark is recognized by its signature features, not by detail.

## Why the layout changes

The static PNG shows frame 0. There the freight train on this track covers x 22 to 287 and rises 26 rows above the rail (the sample profile; heavier profiles bring longer trains). The first pass put the town at x 0 to 160, so only the tip of the bell tower showed. Two rules fix it:
- **Tall silhouettes rise above the train**, as the Cathedral spires do over the TEG-90 in Guadalajara: the Nevado's summit, the parroquia's tower and golden dome, and the santuario's orange domes on their hill. They must read even when a long train covers everything below row `base - 27`.
- **Low things sit right of x 292**: the kiosk, the parroquia's facade, the houses, El Ánima and most of the pelicans.

## Back to front

The strip follows the map: the lake lies north of Sayula and the Nevado south of it, with the sierra to the west. So the viewer stands on the lake shore looking south. The lake is in front on the left, the town on its southern shore on the right, the volcano far behind the town, and the sierra rising on the right with the santuario at its foot.

1. **The Colima volcanoes, one massif.** From Sayula the Nevado and the Volcán de Fuego merge into a single far silhouette. Draw no separate Fuego cone and no plume: remove `@fuego`, `@fuegoRib` and `@plume`. The photos show a sharp summit toward the left of the massif and a long shoulder easing down to the right. It sits far and hazy in the gap between a nearer, darker hill on its east side (left) and the sierra on its west (right), which hide its foot. It is cooler and paler than they are, with snow only on the top few rows of the summit. Put the summit behind the town, between x 240 and 400, at least 34 rows above the rail. Its gullies may stay faint: haze flattens it.
2. **El Santuario de Guadalupe on its cerrito.** It stands closer to the sierra than to the lake: a rounded hill at the sierra's foot, west of the plaza (x about 396 to 448), with the santuario on top, facing us. It is smaller than the parroquia, because it is farther away. It has a cream-yellow facade (`@santuarioWall`) with an orange band at its foot and orange trim (`@santuarioTrim`). In the middle is a portal with a dark arched door, a small triangular pediment, and a curved top with a cross. Its two towers are **different**, which is what identifies it:
   - The left one is shorter: a white square belfry with one arch and its bell, crowned by a plain orange dome (`@domeOrange`).
   - The right one is taller: white with columns, crowned by an orange dome with white ribs (`@domeRib`) and a small lantern.

   A red-flowering tabachín may stand beside it (`@tabachin`, optional). Both domes must rise above row `base - 27`.
3. **The lake.** Water fills the far part of the basin. The dry salt pan in front is wider than in the first pass, at least 5 rows in most columns: the lake shrinks in the dry season, and the wind and heat designs need room on it. Reeds stay at the edges.
4. **Pelicans.** A flock of 5 to 7 smaller American white pelicans floats together on the water at x 292 to 335. Each bird has at most 8 pixels of white plumage in length, with black flight feathers and a long orange bill, and a pixel separates one bird from the next. Keep one in flight high in the sky, where it shows above the train; it follows the same size rule.
5. **The plaza, from x 292 to the right edge.** This is the postcard of the town: the kiosk in front, the parroquia's tower behind it to the right, and red tile roofs around.
   - **La Parroquia de la Inmaculada Concepción** is built of *cantera rosa*, a pinkish-beige sandstone: not whitewash and not ochre. Use `@cantera`, `@canteraLit` and `@canteraShade`. Drop the limewash nave and tile roof of the first pass.
     - **The tower** stands on the **left** of the facade, single and very tall. The lower half of the shaft is plain ashlar. Above a cornice come two belfry stages, each a little narrower than the one below, with dark arched openings and bells between pilasters, and small finials at the corners. On top is an octagonal drum with a **golden tiled dome** (`@domeGold`, darker ribs in `@domeGoldShade`), a small lantern and a cross. The top is at least 34 rows above the rail.
     - **The portal** stands to the right of the tower, a baroque frontispiece that projects from the wall. It has paired columns, a dark arched door, a window above it and a curved, scalloped gable crowned by a niche and finials.
     - **The nave** runs behind, long, low and grayer: old stone.
     - **At night** the tower and its dome may be floodlit, warmer than the houses, as Guadalajara's landmarks are.
   - **The kiosk** stands in front of the church, a little to its left, as in the plaza photos. It is an octagonal bandstand with these parts, bottom to top:
     - A raised base painted **vermilion orange** (`@kioskBase`), with white rectangles and white corner blocks (`@kioskTrim`), and a short stair on one side with an iron handrail.
     - A dark iron railing (`@ironwork`) with light lyre motifs.
     - Six to eight slender dark iron columns, with an ornate iron fringe hanging under the roof edge.
     - An octagonal roof of **red corrugated metal** (`@kioskRoof`), redder and flatter in tone than the clay tiles, with fine vertical ribs.
     - At the top, a small octagonal lantern with louvers and its own little roof, then a weathervane.
   - **Houses:** keep two or three with red tile roofs around the plaza.
   - **El Ánima** moves to the road at the edge of town, still right of x 292 and still hidden by day.
6. **In front:** the road and a few mesquites, as before.

Split the landmarks into `src/landscape/jalisco-sayula-landmarks.js` (parroquia, kiosk, santuario) so no file passes 400 lines. Give every new ink a light and a dark value in `jalisco-palette.js`, and delete the retired ones. Check that every part rests on the one below: domes on their drums, towers on the facade, the santuario on its hill, and the kiosk's lantern on its roof.

## Weather

- **Wind:** the tolvaneras must show. Make `@saltDust` darker and warmer than the salt, at least 40 RGB units away from `@salt` in both themes. Draw a few leaning plumes, 2 to 3 rows thick at the foot and thinning as they rise, at least 120 pixels in all, on the dry pan where frame 0 shows it.
- **Heat:** the mirage over the wider pan draws at least 200 pixels.
- **The new inks in every state:**
  - Rain: the kiosk roof and the domes shine as the tiles do.
  - Snow: it rests on the kiosk roof, the domes and the roofs.
  - Frost: it edges the kiosk roof.
  - Fog: the tower, the santuario's domes and the summit rise above the bank; update the `DISTANT` set.
- **The heat sky:** `src/scene/weather.js` must not name Sayula. Move the depth of Sayula's heat sky into its `JALISCO_WEATHER` entry and read it from there.

## Caption

`Sayula 24° / Python 30%`, the same format as Guadalajara and Tequila. Remove the `°C` special case from `formatTemperature` in `src/scene/spec.js` and update `tests/weather/weather-sayula.test.js`.

## Docs

Update the `jalisco-sayula` rows in `docs/customization.md` and `docs/es/customization.md`: the parroquia, kiosk and Santuario de Guadalupe of Sayula beside its salt lake with white pelicans, beneath the Nevado de Colima. Don't add or regenerate images.

## To look at it

```
node scripts/zoom.js 0 96 448 152 --scale 3 --skyline jalisco-sayula --out .scratch/sayula-train
node scripts/zoom.js 288 96 448 140 --no-trains --scale 7 --skyline jalisco-sayula --out .scratch/sayula-plaza
node scripts/zoom.js 100 96 300 140 --no-trains --scale 7 --skyline jalisco-sayula --out .scratch/sayula-hill
```

The first command keeps the trains: in frame 0 the tower, the domes and the summit must show above the freight train, and the plaza beside it. Then check `--weather clear,clear+wind,clear`, `clear,heat,clear`, `clear,fog,clear`, `clear,snow,clear` and `clear,rain,clear`, in both themes.
