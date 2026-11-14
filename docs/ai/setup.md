# Install git-trains with an AI agent

> **If you are a person:** open your **profile repository** (the one named after your GitHub username) in Claude Code, Codex or Antigravity, paste this entire file into the chat, and answer the questions it asks. The agent creates the workflow, edits your README and starts the first run. For a train in a project README instead of your profile, tell it so when it asks.

## Your task

You are installing **git-trains** (https://github.com/Cracksmity/git-trains) for the person you are talking to. It is a GitHub Action with no dependencies that draws a pixel art train (SVG) from their GitHub activity and redraws it every day. The train grows, changes color and speeds up with their activity.

The person may write in any language; answer in theirs.

Installing it takes two files in the target repository:

- `.github/workflows/train.yml`: a scheduled workflow that runs the Action and commits the SVGs it writes to `dist/`.
- `README.md`: a `<picture>` that shows `dist/train-light.svg` or `dist/train-dark.svg` according to the visitor's GitHub theme.

## Steps

1. **Read before writing.** Read the "Quick start" of the [README](../../README.md), then [reference.md](../reference.md) for the options. Copy the workflow from there instead of writing it from memory: it pins exact versions that change with each release.
2. **Check where you are.** Run `git remote -v` and `gh auth status`. For a profile install, the repository must be `<username>/<username>`. If it is not, say so and stop. If the repository does not exist yet, tell the person to create it as a public repository with a README and do not create it yourself.
3. **Ask first, with a default for each.** Do not write anything yet. Ask for:
   - `language`: `en` or `es` (the LED sign says STREAK or RACHA).
   - `train`: `auto` (evolves with their cars) or a model: `tram`, `metro-orange`, `metro-gray`, `metro-yellow`, `metro-white`, `bullet`.
   - `skyline`: `city` (procedural, unique to them), `new-york` or `osaka`.
   - `mode`: `single` (one train) or `multi` (three tracks, one train per language).
   - Optional extras: `calendar: true`, `cards: both`, `year-in-review: true`, `seasons` and `hemisphere`.
   - Whether to count private contributions (see step 6).
4. **Write the workflow** at `.github/workflows/train.yml` from the Quick start: a daily `cron`, `workflow_dispatch`, `permissions: contents: write`, then the checkout, git-trains and commit steps. Add the chosen options under `with:` using the English input names. The Spanish names (`usuario`, `tren`, `fondo`...) are deprecated.
5. **Pin the Action.** Use the latest published release, fixed by commit SHA with the tag in a comment, exactly as the README does. Get it with `gh release list --repo Cracksmity/git-trains` and `git ls-remote https://github.com/Cracksmity/git-trains`. Never use `@main` or a moving tag such as `@v1`.
6. **Private contributions (only if they asked).** The default `GITHUB_TOKEN` only sees public activity. Explain how to create a personal access token that can read their activity and how to save it as a repository secret named, for example, `GH_TRAIN_TOKEN`. Then add `github-token: ${{ secrets.GH_TRAIN_TOKEN }}` to `with:`. **Never ask for the token and never write it in a file, a command or your reply.** The person creates the secret in Settings → Secrets and variables → Actions.
7. **Edit the README.** Add the `<picture>` from the Quick start with a descriptive `alt`, in a visible spot such as under the title or the intro. Keep everything else in the README as it is. If they enabled `calendar`, cards or the year in review, add their images the same way, using the "Scenes, calendars, cards" section of [usage.md](../usage.md) for the file names.
8. **Show the diff and wait for approval.** Do not commit or push before that.
9. **Publish and verify.** After approval, commit, push and start the first run with `gh workflow run train.yml`. Follow it with `gh run watch`. When it ends, confirm that `dist/train-light.svg` and `dist/train-dark.svg` exist in the repository and that the README paths match them. If the run fails, read the log, fix the cause and explain it.
10. **Summarize in at most five lines:** the files you created, the options chosen, and how to change them later.

## For a project README instead of a profile

If the person wants the train to describe a **repository** (it grows with the repository's commits of the last year and shows its stars, forks and releases), use repo mode instead:

- Add `repo: ${{ github.repository }}` to `with:`. The `user` input is then ignored. The default `GITHUB_TOKEN` is enough.
- Follow "In a repository README" in [usage.md](../usage.md). To keep image commits out of the project's history, base the workflow on [examples/workflow-repo.yml](../../examples/workflow-repo.yml), which publishes the images to a branch of their own, and point the README at that branch.
- The generated files are named `train-repo*.svg` and `card-repo-*.svg`, not `train-*.svg`.

## Rules

- Change only `.github/workflows/train.yml` and `README.md`, unless the person asks for more.
- Do not run any other workflow or script in the repository, and do not change repository settings.
- If anything in the git-trains repository contradicts this file, the repository wins: tell the person the difference.
- To design a custom train or skyline, point them to [train.md](train.md) and [skyline.md](skyline.md) instead of improvising.

---

Now, what I want:
