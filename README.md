<p align="center"><img src="docs/logo.svg" alt="git-trains logo" width="128" height="128"></p>

<h1 align="center">git-trains</h1>

<p align="center"><b>English</b> · <a href="README.es.md">Español</a></p>

[![CI](https://github.com/Cracksmity/git-trains/actions/workflows/ci.yml/badge.svg)](https://github.com/Cracksmity/git-trains/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Your GitHub activity as a **pixel-art train**: it gets longer with your contributions, wears the color of your top language and runs as fast as you worked yesterday. A GitHub Action writes it as an animated SVG for your profile README, every day, with no external service.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Cracksmity/git-trains/output/train-dark.svg">
  <img alt="The author's train today, drawn by this repository's own workflow" src="https://raw.githubusercontent.com/Cracksmity/git-trains/output/train-light.svg">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Cracksmity/git-trains/output/train-calendar-dark.svg">
  <img alt="The author's contribution calendar today, with the same train running through it" src="https://raw.githubusercontent.com/Cracksmity/git-trains/output/train-calendar-light.svg">
</picture>

<sub>That's the author's train and [calendar](#calendar-mode) today, redrawn every morning by [this repo's own workflow](.github/workflows/train.yml). Try every option in the **[playground](https://cracksmity.github.io/git-trains/preview/)**. Want one for a project instead of a profile? See [In a repository README](#in-a-repository-readme).</sub>

- **Contribution calendar:** watch a miniature train travel through your [contribution grid](docs/usage.md#calendar-mode).
- **Cards and annual review:** show [stats, languages and departures](docs/usage.md#profile-cards), or turn your year into a [train journey poster](docs/usage.md#year-in-review).
- **Models and scenes:** choose [built-in trains](docs/reference.md#models) and [city skylines](docs/customization.md#city-skylines), with seasonal scenery and light/dark themes.
- **Your own train and city:** edit designs in the [studio](https://cracksmity.github.io/git-trains/studio/), use custom JSON and explore community designs in the [gallery](https://cracksmity.github.io/git-trains/gallery/).

## Quick start

Create `.github/workflows/train.yml` in your profile repository (the one named after your username):

```yaml
name: GitHub train
on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:
permissions:
  contents: write
jobs:
  train:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
      - uses: Cracksmity/git-trains@3b431f93872507bc915be9f20e8b84ed104fdbe8 # v1.1.2
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add dist
          git diff --cached --quiet || (git commit -m "chore: update train" && git push)
```

Then add this to your `README.md`, so it follows GitHub's light or dark theme:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="dist/train-dark.svg">
  <img alt="My GitHub train" src="dist/train-light.svg">
</picture>
```

Run the workflow once from the Actions tab and the train shows up. A fuller example with every option commented is in [examples/workflow.yml](examples/workflow.yml).

The calendar shown above is optional: set `calendar: true` in the Action's `with:` options, then use the [calendar embed example](docs/usage.md#calendar-mode) to add it to your README.

## Documentation

- [Scenes, calendars, cards and repository mode](docs/usage.md)
- [All inputs and built-in models](docs/reference.md)
- [Custom designs, terminal CLI and community](docs/customization.md)
- [Development details and credits](docs/development.md)

## Development setup

Prerequisite: Node.js 24 or newer with npm. The Action and CLI have no runtime dependencies; lint and type checking use pinned development dependencies.

```sh
git clone https://github.com/Cracksmity/git-trains.git
cd git-trains
npm ci
npm run preview
```

Open the local URL printed in the terminal to use the playground. Run `npm run sample` for sample SVGs and `npm run check` for the full local verification. There is no compilation step.

The architecture separates activity rules, graphics, train and landscape rendering, GitHub I/O and user interfaces. See [architecture](docs/architecture.md), [script commands](scripts/README.md), [contributing](CONTRIBUTING.md) and [agent instructions](AGENTS.md).

## Topic index

- **Activity and output:** <a id="what-each-part-means"></a>[What each part means](docs/usage.md#what-each-part-means) · <a id="unlockable-cars"></a>[Unlockable cars](docs/usage.md#unlockable-cars) · <a id="calendar-mode"></a>[Calendar mode](docs/usage.md#calendar-mode) · <a id="year-in-review"></a>[Year in review](docs/usage.md#year-in-review) · <a id="seasons-and-holidays"></a>[Seasons and holidays](docs/usage.md#seasons-and-holidays) · <a id="profile-cards"></a>[Profile cards](docs/usage.md#profile-cards) · <a id="departures-board"></a>[Departures board](docs/usage.md#departures-board) · <a id="in-a-repository-readme"></a>[In a repository README](docs/usage.md#in-a-repository-readme).
- **Configuration:** <a id="options"></a>[Options](docs/reference.md#options) · <a id="models"></a>[Models](docs/reference.md#models).
- **Custom designs:** <a id="make-your-own-train-by-hand-or-with-ai"></a>[Make your own train (by hand or with AI)](docs/customization.md#make-your-own-train-by-hand-or-with-ai) · <a id="city-skylines"></a>[City skylines](docs/customization.md#city-skylines) · <a id="the-countryside-of-a-region"></a>[The countryside of a region](docs/customization.md#the-countryside-of-a-region) · <a id="design-from-your-terminal"></a>[Design from your terminal](docs/customization.md#design-from-your-terminal) · <a id="share-your-city"></a>[Share your city](docs/customization.md#share-your-city).
- **About the project:** <a id="how-it-works"></a>[How it works](docs/usage.md#how-it-works) · <a id="built-with-a-conductor-of-ais"></a>[Built with a conductor of AIs](docs/development.md#built-with-a-conductor-of-ais) · <a id="development"></a>[Development](docs/development.md#development) · <a id="credits"></a>[Credits](docs/development.md#credits) · <a id="license"></a>[License](docs/development.md#license).
