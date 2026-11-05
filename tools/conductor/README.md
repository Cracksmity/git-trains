# Conductor

One AI directing others. The conductor hands a task to another coding agent's CLI (Codex or Antigravity), checks what it did with **gates**, feeds the failures back, and climbs to a stronger model when a rung keeps failing.

```bash
node tools/conductor/conductor.js routes                     # who gets what, and why
node tools/conductor/conductor.js run tools/conductor/tasks/guides-en.json
node tools/conductor/conductor.js run <task.json> --apply    # apply the patch when it passes
node tools/conductor/conductor.js run <task.json> --dry-run  # print the command, run nothing
node tools/conductor/conductor.js log                        # the last runs: model, time, tokens, pass/fail
```

You need the CLIs installed and signed in: `codex` (`codex exec`) and/or `agy` (Antigravity, `agy -p`). They run on your own subscriptions.

## How a run works

1. **Snapshot.** The current working tree, uncommitted changes included, is written as a throwaway commit (with a temporary index, so your HEAD, index and files stay untouched).
2. **Worktree.** A detached git worktree is cut from that snapshot in the system temp folder. The agent works there and never sees your checkout.
3. **Agent.** The route's first rung runs with the task prompt plus house rules (allowed paths, the gates it must pass, no commits).
4. **Gates.** Changed files must match `allow`, and every command in `gates` must exit 0. On failure the output goes back to the agent, in the same worktree, for another attempt.
5. **Ladder.** After `attempts` failures the next rung (a stronger or different model) continues in the same worktree.
6. **Patch.** When everything passes, the diff is saved to `.conductor/<task>.patch`. **Read it**, then `git apply` it (or run with `--apply`).

Every attempt is logged to `.conductor/runs.jsonl` (model, effort, seconds, input/output/reasoning tokens, pass/fail): that log is how the routes should be tuned over time.

## Routes

[routes.json](routes.json) maps each kind of task to a ladder. The starting order comes from the [Medellín benchmark](../../benchmarks/medellin/), one run per model, so it is a prior, not a law:

| Route | First rung | Then | For |
| --- | --- | --- | --- |
| `mechanical` | GPT-6.1-Terra | GPT-6.1-Sol | renames, translations, comment passes, tests, docs |
| `design` | GPT-6-Astra | GPT-6.1-Sol | pixel art from a photo or a description |
| `research` | Gemini 4 Argon | GPT-6.1-Sol | real-world knowledge: landmarks, houses, plants |
| `bulk` | Gemini 3.8 Flash | GPT-6.1-Terra | long files and faithful long-form text |

A task can override the ladder with its own `"ladder": [...]`.

## Tasks

A task is a JSON file:

```json
{
  "name": "guides-en",
  "route": "mechanical",
  "promptFile": "guides-en.md",
  "allow": ["docs/ai/**", "docs/ia/**"],
  "gates": ["node --test test/custom.test.js", "node tools/conductor/gates/links.js docs/ai"],
  "attempts": 2,
  "timeoutMin": 25
}
```

The ones in [tasks/](tasks) are real: they did the 1.0 migration to English.

## Gates

| Gate | Checks |
| --- | --- |
| [comments-only.js](gates/comments-only.js) | in changed `.js` files only comments and string text changed, code line by line the same |
| [links.js](gates/links.js) | relative links in HTML and Markdown point to files that exist |
| [guide-json.js](gates/guide-json.js) | the complete JSON examples in the AI guides pass the validator |
| [no-spanish.js](gates/no-spanish.js) | no Spanish left in comments (`.js`) or visible text (`.md`, `.html`) |

Plus anything with an exit code: `npm test`, `node --test some.test.js`, a one-line `node -e` check.

## First runs (the 1.0 migration)

| Task | Route | What happened |
| --- | --- | --- |
| comments-en | mechanical | GPT-6.1-Terra passed on the first attempt: 140 s, 5.8k output tokens, 12 files |
| guides-en | mechanical | GPT-6.1-Terra passed on the first attempt: 153 s, 6.1k output tokens |
| benchmark-en | bulk | Gemini 3.8 Flash changed nothing twice (headless Antigravity denied its shell commands); the ladder moved to GPT-6.1-Terra, which passed in 125 s. Reviewing the patch caught a CSS class renamed in the stylesheet but not in the HTML, which no gate checked. |

Lessons, now in the code: Antigravity gets a narrow `permissions.allow` list (read files, run node and the tests), and a run that was denied actions says so in its failure message.
