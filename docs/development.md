# Development and credits

[git-trains](../README.md)

## Built with a conductor of AIs

This project is built by one AI directing others. [tools/conductor](../tools/conductor) hands each task to Codex or Antigravity (Gemini) depending on its kind, runs it in an isolated git worktree, checks the result with gates (tests, the validator, link and translation checks), feeds failures back and climbs to a stronger model when one keeps failing. The routing comes from the [Medellín benchmark](https://cracksmity.github.io/git-trains/benchmarks/medellin/), where ten AI runs designed the same train and skyline. Every attempt is logged, and the [AI leaderboard](https://cracksmity.github.io/git-trains/leaderboard/) shows which model did which task: how often it passed on the first try, how long it took and how many tokens it used.
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
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) to add a model, a skyline or anything else.
## Credits

The idea of turning activity into a living picture comes from [git-koi](https://github.com/yalongwastaken/git-koi). The trains are drawn from photos of the real ones only for color and shape; no logos or lettering are reproduced.
## License

[MIT](../LICENSE).
