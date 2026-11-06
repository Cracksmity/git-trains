// The AI leaderboard's logic, shared by the page (leaderboard/index.html), the
// merge script (scripts/leaderboard.js) and the tests. Plain ES module with no
// imports and no Node APIs, so a browser loads it as is.
//
// A run is one attempt the conductor (tools/conductor) gave an AI. Records come
// from .conductor/runs.jsonl, which holds more than is safe to publish (the
// failure lines carry file paths, for one), so `cleanRun` keeps an allowlist of
// fields and checks each value's shape. Anything that does not fit is dropped.

// --- Cleaning -----------------------------------------------------------------

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/; // task ids, models: no slashes, spaces or drive letters
const WORD = /^[a-z0-9][a-z0-9-]{0,31}$/; // routes, backends, gate names
const EFFORT = /^[a-z]{2,10}$/;
const TAG = WORD;
const MAX_SECONDS = 7 * 24 * 3600;
const MAX_TOKENS = 1e12;

// Failure lines from the conductor boil down to the name of the check that failed.
// The line itself is dropped: it can hold paths, commands and output.
export function gateTag(line) {
  const s = String(line ?? '').split('\n')[0].trim();
  if (/^No files were changed/i.test(s)) return 'no-changes';
  if (/^Changed files outside/i.test(s)) return 'outside-allow';
  if (/^The agent exited/i.test(s)) return 'agent-exit';
  if (/^The agent was denied/i.test(s)) return 'denied';
  if (/^The agent changed the conductor's hook/i.test(s)) return 'hook-tampered';
  if (s.startsWith('$ ')) {
    const cmd = s.slice(2);
    const gate = cmd.match(/(?:^|[\s/\\])gates[\\/]([a-z0-9-]+)\.js(?=\s|$)/i);
    if (gate) return gate[1].toLowerCase();
    if (/^(?:npm (?:run )?test|node --test)(?=\s|$)/.test(cmd)) return 'tests';
    return 'check';
  }
  return 'other';
}

const count = (v) => (Number.isFinite(v) && v >= 0 && v <= MAX_TOKENS ? Math.round(v) : null);
const small = (v, max) => (Number.isInteger(v) && v >= 1 && v <= max ? v : null);

// A record as the conductor logs it ({ usage, failures }) or as this module stores
// it ({ tokens, failed }), cleaned to the stored shape. null if it does not fit.
export function cleanRun(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const at = typeof raw.at === 'string' && !Number.isNaN(Date.parse(raw.at)) ? new Date(raw.at).toISOString() : null;
  const rung = small(raw.rung, 20);
  const attempt = small(raw.attempt, 20);
  const seconds = Number.isFinite(raw.seconds) && raw.seconds >= 0 && raw.seconds <= MAX_SECONDS ? Math.round(raw.seconds) : null;
  const text = (v, re) => (typeof v === 'string' && re.test(v) ? v : null);
  const task = text(raw.task, SLUG);
  const route = text(raw.route, WORD);
  const backend = text(raw.backend, WORD);
  const model = text(raw.model, SLUG);
  const effort = raw.effort == null ? null : text(raw.effort, EFFORT);
  if (!at || !task || !route || !backend || !model || !rung || !attempt || seconds === null) return null;
  if (raw.effort != null && effort === null) return null;
  if (typeof raw.passed !== 'boolean') return null;

  let failed;
  if (Array.isArray(raw.failures)) failed = raw.failures.map(gateTag);
  else if (Array.isArray(raw.failed) && raw.failed.every((t) => typeof t === 'string' && TAG.test(t))) failed = raw.failed;
  else if (raw.failed === undefined && raw.passed) failed = [];
  else return null;
  failed = [...new Set(failed)].slice(0, 8);
  if (raw.passed) failed = [];
  else if (!failed.length) failed = ['other'];

  const u = raw.usage ?? raw.tokens ?? {};
  const tokens = { input: count(u.input), output: count(u.output), reasoning: count(u.reasoning) };

  return { at, task, route, rung, attempt, backend, model, effort, passed: raw.passed, failed, seconds, tokens };
}

// --- Reading and merging --------------------------------------------------------

// What makes two records the same run, whichever machine's log they came from.
export const runKey = (r) => `${r.at}|${r.task}|${r.model}|${r.rung}|${r.attempt}`;

const compare = (a, b) =>
  a.at < b.at ? -1 : a.at > b.at ? 1 :
  a.task < b.task ? -1 : a.task > b.task ? 1 :
  a.rung - b.rung || a.attempt - b.attempt || (a.model < b.model ? -1 : a.model > b.model ? 1 : 0);

// Runs from text: a leaderboard file (docs/leaderboard.json), or a conductor log with one
// JSON object per line. Both keep one run per line, so a file that is not valid JSON as a
// whole (a merge conflict left markers in it) is still read line by line: every line that
// is a run counts, braces, commas and markers are skipped. `npm run leaderboard` writes
// the result back clean. Records that do not fit the safe shape are counted, not fatal.
export function parseRuns(text) {
  text = String(text);
  try {
    const board = JSON.parse(text);
    if (board && Array.isArray(board.runs)) return clean(board.runs);
  } catch {}
  const runs = [];
  let dropped = 0;
  for (const line of text.split('\n')) {
    const s = line.trim().replace(/,$/, '');
    if (!s.startsWith('{"')) continue;
    let value;
    try { value = JSON.parse(s); } catch { dropped++; continue; }
    const run = cleanRun(value);
    if (run) runs.push(run);
    else dropped++;
  }
  return { runs, dropped };
}

function clean(list) {
  const runs = [];
  let dropped = 0;
  for (const raw of list) {
    const run = cleanRun(raw);
    if (run) runs.push(run);
    else dropped++;
  }
  return { runs, dropped };
}

// Lists of runs in, one sorted list without repeats out. The first copy of a run
// wins, so the order of the lists decides a (rare) disagreement: put the committed
// board first.
export function mergeRuns(...lists) {
  const byKey = new Map();
  for (const list of lists) for (const run of list) if (!byKey.has(runKey(run))) byKey.set(runKey(run), run);
  return [...byKey.values()].sort(compare);
}

// The committed file: a header, then one run per line.
export function serialize(runs) {
  const lines = runs.map((r) => `    ${JSON.stringify(r)}`);
  return `{\n  "version": 1,\n  "runs": [\n${lines.join(',\n')}${lines.length ? '\n' : ''}  ]\n}\n`;
}

// --- Reading the runs: outcomes, task runs, fallbacks -------------------------------

// pass: the gates passed. error: the agent died before it did anything (crashed,
// usage limit): not a verdict on the model, so it leaves every rate and median.
// fail: it worked and a gate said no.
export function outcome(run) {
  if (run.passed) return 'pass';
  if (run.failed.includes('agent-exit') && !(run.tokens.output > 0)) return 'error';
  return 'fail';
}

// Attempts grouped into the runs of a task. The log has no run id, so a run is read
// from the order: after a failed attempt the conductor tries again (same rung, next
// attempt) or climbs (next rung, first attempt). Anything else starts a new run.
export function taskRuns(runs) {
  const open = new Map(); // task -> the run still being extended
  const out = [];
  for (const r of [...runs].sort(compare)) {
    const cur = open.get(r.task);
    const last = cur?.attempts.at(-1);
    const continues = last && !last.passed && ((r.rung === last.rung && r.attempt === last.attempt + 1) || (r.rung === last.rung + 1 && r.attempt === 1));
    if (continues) cur.attempts.push(r);
    else {
      const fresh = { task: r.task, route: r.route, at: r.at, attempts: [r] };
      open.set(r.task, fresh);
      out.push(fresh);
    }
  }
  for (const t of out) {
    const last = t.attempts.at(-1);
    t.passed = last.passed;
    t.model = last.model;
    t.seconds = t.attempts.reduce((n, a) => n + a.seconds, 0);
    t.tokens = sumTokens(t.attempts);
  }
  return out;
}

// Each place a ladder moved on to the next model: which model gave up (and why) and
// which took over. A rung whose every attempt crashed gave up nothing (the account hit a
// usage limit, say), so it is not a fallback; `ran` says the next model got judged.
export function fallbacks(runs) {
  const events = [];
  for (const t of taskRuns(runs)) {
    t.attempts.forEach((a, i) => {
      const next = t.attempts[i + 1];
      if (!next || next.rung !== a.rung + 1) return;
      const tries = t.attempts.filter((x) => x.rung === a.rung);
      if (tries.every((x) => outcome(x) === 'error')) return;
      const ran = t.attempts.some((x) => x.rung === next.rung && outcome(x) !== 'error');
      events.push({ task: t.task, route: t.route, at: next.at, from: a.model, to: next.model, ran, because: [...new Set(tries.flatMap((x) => x.failed))] });
    });
  }
  return events;
}

// --- Aggregating -----------------------------------------------------------------

export function median(values) {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

// Totals of the tokens that were reported. `partial` says some run did not report
// its input, so the total is a floor.
export function sumTokens(runs) {
  const t = { input: 0, output: 0, reasoning: 0, total: 0, partial: false };
  for (const r of runs) {
    t.input += r.tokens.input ?? 0;
    t.output += r.tokens.output ?? 0;
    t.reasoning += r.tokens.reasoning ?? 0;
    if (r.tokens.input === null || r.tokens.output === null) t.partial = true;
  }
  t.total = t.input + t.output; // reasoning is reported on its own and not added
  return t;
}

const tally = (items, key) => {
  const m = new Map();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return m;
};

// One entry per model, in no particular order (the page sorts). Only judged attempts
// (pass or fail) count; crashes are kept apart as `errors`.
export function summarize(runs) {
  const events = fallbacks(runs);
  const byModel = new Map();
  for (const r of runs) {
    if (!byModel.has(r.model)) byModel.set(r.model, []);
    byModel.get(r.model).push(r);
  }
  const models = [];
  for (const [model, all] of byModel) {
    const judged = all.filter((r) => outcome(r) !== 'error');
    const first = judged.filter((r) => r.attempt === 1);
    const passedFirst = first.filter((r) => r.passed).length;
    const routes = [...tally(judged, (r) => r.route)].map(([route, attempts]) => {
      const here = judged.filter((r) => r.route === route);
      return { route, attempts, tasks: new Set(here.map((r) => r.task)).size, asFallback: here.every((r) => r.rung > 1) };
    });
    models.push({
      model,
      name: modelName(model),
      backends: [...new Set(all.map((r) => r.backend))].sort(),
      efforts: Object.fromEntries([...tally(judged.filter((r) => r.effort), (r) => r.effort)]),
      attempts: judged.length,
      errors: all.length - judged.length,
      tasks: new Set(judged.map((r) => r.task)).size,
      firstTry: { passed: passedFirst, total: first.length, rate: first.length ? passedFirst / first.length : null },
      // Time of the attempts that passed: a failure that ends in seconds is not a fast job.
      medianSeconds: median(judged.filter((r) => r.passed).map((r) => r.seconds)),
      medianAllSeconds: median(judged.map((r) => r.seconds)),
      tokens: sumTokens(judged),
      routes: routes.sort((a, b) => b.attempts - a.attempts || (a.route < b.route ? -1 : 1)),
      fellBackTo: events.filter((e) => e.from === model).map(({ task, to, because }) => ({ task, to, because })),
      tookOver: events.filter((e) => e.to === model && e.ran).map(({ task, from }) => ({ task, from })),
    });
  }
  return models;
}

export function totals(list) {
  const runs = [...list].sort(compare);
  const judged = runs.filter((r) => outcome(r) !== 'error');
  const first = judged.filter((r) => r.attempt === 1);
  const tasks = taskRuns(runs).filter((t) => t.attempts.some((a) => outcome(a) !== 'error'));
  return {
    runs: tasks.length,
    tasks: new Set(judged.map((r) => r.task)).size,
    attempts: judged.length,
    errors: runs.length - judged.length,
    models: new Set(judged.map((r) => r.model)).size,
    firstTry: { passed: first.filter((r) => r.passed).length, total: first.length },
    tokens: sumTokens(judged),
    since: runs.length ? runs[0].at : null,
    until: runs.length ? runs.at(-1).at : null,
  };
}

// Sorting the models table. Each returns a comparator; the first-try rate is the
// default, then the model that took on more tasks.
const nil = (v, dir) => (v === null ? Infinity * dir : v);
export const SORTS = {
  firstTry: (a, b) => nil(b.firstTry.rate, -1) - nil(a.firstTry.rate, -1) || b.firstTry.total - a.firstTry.total || b.tasks - a.tasks,
  tasks: (a, b) => b.tasks - a.tasks || b.attempts - a.attempts,
  speed: (a, b) => nil(a.medianSeconds, 1) - nil(b.medianSeconds, 1),
  tokens: (a, b) => a.tokens.total - b.tokens.total,
};

// --- Words and numbers ---------------------------------------------------------------

const NAMES = {
  'gpt-6.1-terra': 'GPT-6.1 Terra',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6-astra': 'GPT-6 Astra',
  'gpt-6-luna': 'GPT-6 Luna',
  'gemini-4-argon-high': 'Gemini 4 Argon (high)',
  'gemini-3.8-flash-high': 'Gemini 3.8 Flash (high)',
  'gemini-3.8-flash-low': 'Gemini 3.8 Flash (low)',
};
// Model names change often: one that is not listed shows as it was logged.
export const modelName = (slug) => NAMES[slug] ?? slug;

export const BACKENDS = { codex: 'Codex', gemini: 'Antigravity' };
export const backendName = (b) => BACKENDS[b] ?? b;

export const REASONS = {
  'no-changes': 'changed nothing',
  'outside-allow': 'touched files outside the task',
  'agent-exit': 'the agent stopped',
  denied: 'a command was denied',
  'hook-tampered': 'edited the conductor hook',
  tests: 'tests failed',
  check: 'a custom check failed',
  other: 'failed',
};
export const reason = (tag) => REASONS[tag] ?? `the ${tag} check failed`;

// Why an attempt failed, in words. When it changed nothing, the checks that look at
// its files fail too, only because there is nothing to look at: say it once.
export function reasons(tags) {
  const list = tags.includes('no-changes') ? tags.filter((t) => t === 'no-changes' || t === 'denied' || t === 'agent-exit') : tags;
  return [...new Set(list.map(reason))].join(', ');
}

export function fmtSeconds(s) {
  if (s === null || s === undefined) return '–';
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${String(r).padStart(2, '0')} s` : `${m} min`;
}

export function fmtTokens(n) {
  if (n === null || n === undefined) return '–';
  if (n < 1000) return String(n);
  if (n < 999500) return `${n < 1e4 ? (n / 1e3).toFixed(1) : Math.round(n / 1e3)}k`;
  return `${n < 1e7 ? (n / 1e6).toFixed(2) : (n / 1e6).toFixed(1)}M`;
}

export const fmtPercent = (rate) => (rate === null ? '–' : `${Math.round(rate * 100)}%`);
export const fmtDate = (at) => at.slice(0, 10);
