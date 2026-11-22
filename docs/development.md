# Development and credits

[git-trains](../README.md)

## Built with a conductor of AIs

This project is built by one AI directing others. [tools/conductor](../tools/conductor) hands each task to Codex or Antigravity (Gemini) depending on its kind, runs it in an isolated git worktree, checks the result with gates (tests, the validator, link and translation checks), feeds failures back and climbs to a stronger model when one keeps failing. The routing comes from the [Medellín benchmark](https://cracksmity.github.io/git-trains/benchmarks/medellin/), where ten AI runs designed the same train and skyline. Independent chains of tasks can run at the same time, in lanes, one branch per lane. Every attempt is logged, and the [AI leaderboard](https://cracksmity.github.io/git-trains/leaderboard/) shows which model did which task: how often it passed on the first try, how long it took and how many tokens it used.
## Development

```bash
npm run preview    # playground at http://localhost:4173 (live controls)
npm run sample     # writes SVGs from sample data to ./sample
npm test           # tests
npm run docs       # regenerates the SVGs in docs/
npm run community  # checks community/ and rebuilds community/index.json for the gallery
npm run leaderboard # merges the conductor's run logs into docs/leaderboard.json for the leaderboard
node scripts/sheet.js sheet.png 5 3 0                                # zoomed PNG sheet of every model
node scripts/sheet.js mine.png 5 2 0 examples/trains/new-york.json   # ...or of a JSON train
npm run zoom -- 0 0 224 100 --no-trains   # enlarged crop of the scene in both themes, in sample/
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) to add a model, a skyline or anything else.
## Painting scenery by hand

Hand-painted presets such as `jalisco` draw every landmark pixel by pixel in `src/landscape/`, with the inks of their palette file. These notes come from drawing Guadalajara, Los Altos and Tequila. The full case, from the first sketch to the profile README, is in the [Jalisco design and publishing notes](jalisco-notes.md).

- **Draw from photos.** A landmark is recognised by one or two signature features, not by detail. For the Cathedral it is the curved gable and the blue-ribbed yellow spires; for Estadio Jalisco, the flat white roof with small trusses. Drawn from memory, a landmark tends to come out as a generic building.
- **Every part rests on the one below.** A dome needs its drum, the drum its base, and a finial its balustrade. Paint what stands behind first and let the front piece cover the joint: the Sagrario goes before the Cathedral's tower, and light-rail bogies before the car body.
- **Night-only details are inks.** An ink whose light value equals the background shows only in the dark theme. The countryside stars, the lit tower windows and the hotel sign work this way, with no extra layers.
- **Match running gear and outlines to the vehicle.** A near-black outline vanishes on a dark car but looks inked on a light one. Freight cars ride on trucks, not on passenger bogies.
- **Check both themes, close up and at README size.** `npm run zoom -- x0 y0 x1 y1` writes `<out>-light.png` and `<out>-dark.png`. Coordinates are scene pixels: 448 wide, with the first rail on row 88 and each further track 52 rows lower. Add `--no-trains` to see the whole backdrop, `--scale` to change the enlargement (6 by default), `--time` to move the animation and `--weather` (`rain`, or `storm,rain,cloudy`) to draw the Jalisco weather. Also check frame 0, which the static PNG shows: there a train can hide the lower part of the backdrop.
## Credits

The idea of turning activity into a living picture comes from [git-koi](https://github.com/yalongwastaken/git-koi). The trains are drawn from photos of the real ones only for color and shape; no logos or lettering are reproduced.
## License

[MIT](../LICENSE).
