import { closest } from '../../src/browser/dom.js';
// Page controller. Relative fetch URLs intentionally resolve against the page.
import {
  parseRuns, summarize, totals, taskRuns, outcome, SORTS,
  modelName, backendName, reasons, fmtSeconds, fmtTokens, fmtPercent, fmtDate,
} from '../../src/leaderboard/model.js';

/** Dynamic page IDs address mixed form and image elements. @returns {any} */
const $ = (id) => document.getElementById(id);
// Small element builder. Everything from the data goes in as text, never as HTML.
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : v);
  el.append(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
  return el;
}
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const dash = () => h('span', { class: 'dash' }, '–');

let runs = [];
let models = [];
let launches = [];
let sort = 'firstTry';
let result = 'all';
let model = '';
let shown = 25;

// --- Totals.
function renderTiles() {
  const t = totals(runs);
  const tile = (label, value, sub) => [h('div', { class: 'tile' }, h('dt', {}, label), h('dd', {}, value), sub ? h('span', { class: 'sub' }, sub) : null)];
  $('tiles').replaceChildren(
    ...tile('Tasks', String(t.tasks), `${plural(t.runs, 'run')} by ${plural(t.models, 'model')}`),
    ...tile('Attempts', String(t.attempts), t.errors ? `${t.errors} more crashed before they started` : 'judged by their checks'),
    ...tile('First-try pass', t.firstTry.total ? fmtPercent(t.firstTry.passed / t.firstTry.total) : '–', `${t.firstTry.passed} of ${t.firstTry.total} first attempts`),
    ...tile('Tokens', `${t.tokens.partial ? '≥' : ''}${fmtTokens(t.tokens.total)}`, t.since ? `${fmtDate(t.since)} to ${fmtDate(t.until)}` : ''),
  );
}

// --- Models.
function modelRow(m, rank) {
  const efforts = Object.entries(m.efforts).map(([e, n]) => `${e} ×${n}`).join(', ');
  const rate = m.firstTry.rate;
  const name = (slug) => modelName(slug);
  const out = m.fellBackTo.map((f) => h('p', {}, h('span', { class: 'dir' }, 'Handed on to '), name(f.to), ' on ', h('code', {}, f.task), h('span', { class: 'sub' }, reasons(f.because))));
  const inn = m.tookOver.map((f) => h('p', {}, h('span', { class: 'dir' }, 'Took over from '), name(f.from), ' on ', h('code', {}, f.task)));
  return h('tr', {},
    h('td', { class: 'model-cell', 'data-label': 'Model' }, h('div', { class: 'model' },
      h('span', { class: 'rank' }, String(rank)),
      h('b', {}, m.name),
      h('span', { class: 'sub' }, [m.backends.map(backendName).join(', '), efforts].filter(Boolean).join(' · ')))),
    h('td', { 'data-label': 'Tasks' }, h('b', {}, String(m.tasks)),
      h('span', { class: 'sub' }, plural(m.attempts, 'attempt') + (m.errors ? `, ${m.errors} crashed` : ''))),
    h('td', { class: 'pass', 'data-label': 'First-try pass' },
      h('b', {}, fmtPercent(rate)),
      h('span', { class: 'bar-track', 'aria-hidden': 'true' }, h('i', { style: `width:${rate === null ? 0 : Math.round(rate * 100)}%` })),
      h('span', { class: 'sub' }, `${m.firstTry.passed}/${m.firstTry.total}`)),
    h('td', { 'data-label': 'Median time', title: m.medianAllSeconds === null ? null : `All judged attempts: ${fmtSeconds(m.medianAllSeconds)}` },
      m.medianSeconds === null ? dash() : h('b', { class: 'num' }, fmtSeconds(m.medianSeconds)),
      h('span', { class: 'sub' }, m.medianSeconds === null ? 'no passing attempt' : 'of passing attempts')),
    h('td', { 'data-label': 'Tokens', title: `Input ${m.tokens.input.toLocaleString('en-US')}, output ${m.tokens.output.toLocaleString('en-US')}; reasoning ${m.tokens.reasoning.toLocaleString('en-US')} is reported separately and not added` },
      h('b', { class: 'num' }, `${m.tokens.partial ? '≥' : ''}${fmtTokens(m.tokens.total)}`),
      h('span', { class: 'sub' }, `in ${fmtTokens(m.tokens.input)} · out ${fmtTokens(m.tokens.output)}`)),
    h('td', { class: 'wide', 'data-label': 'Routes' }, m.routes.length
      ? h('div', { class: 'chips' }, m.routes.map((r) => h('span', { class: `chip${r.asFallback ? ' fb' : ''}`, title: `${plural(r.attempts, 'attempt')} on ${plural(r.tasks, 'task')}${r.asFallback ? ', only as a fallback' : ''}` }, `${r.route} ${r.attempts}`)))
      : dash()),
    h('td', { class: 'wide', 'data-label': 'Fallbacks' }, out.length || inn.length ? h('div', { class: 'falls' }, out, inn) : dash()),
  );
}
function renderModels() {
  const rows = [...models].filter((m) => m.attempts > 0).sort(SORTS[sort]);
  $('models-body').replaceChildren(...rows.map((m, i) => modelRow(m, i + 1)));
  $('models-box').hidden = rows.length === 0;
}
$('sort').addEventListener('click', (e) => {
  const b = closest(e, 'button');
  if (!b) return;
  sort = b.dataset.v;
  for (const x of $('sort').children) x.setAttribute('aria-pressed', String(x === b));
  renderModels();
});

// --- The log: one row per task run, newest first.
function resultOf(t) {
  const judged = t.attempts.filter((a) => outcome(a) !== 'error');
  if (!judged.length) return { text: 'Crashed', cls: 'err' };
  if (t.passed) return t.attempts.length === 1 ? { text: 'Passed first try', cls: 'ok' } : { text: `Passed after ${plural(t.attempts.length - 1, 'failed attempt')}`, cls: 'ok' };
  return { text: 'Not passed', cls: 'no' };
}
function logRow(t) {
  const r = resultOf(t);
  const lines = t.attempts.map((a) => {
    const o = outcome(a);
    const mark = o === 'pass' ? ['✓', 'pass-mark', 'passed'] : o === 'fail' ? ['✗', 'fail-mark', 'failed'] : ['–', 'error-mark', 'crashed'];
    return h('li', {},
      h('span', { class: `mark ${mark[1]}`, 'aria-hidden': 'true' }, mark[0]),
      h('span', {}, h('span', { class: 'sr-only' }, `${mark[2]}: `), modelName(a.model),
        h('span', { class: 'muted' }, ` · try ${a.attempt} · ${fmtSeconds(a.seconds)}${a.effort ? ` · ${a.effort}` : ''}`),
        o === 'fail' ? h('span', { class: 'sub' }, reasons(a.failed)) : null));
  });
  return h('tr', {},
    h('td', { class: 'when-task wide nolabel' }, h('b', {}, t.task), h('span', { class: 'sub' }, `${fmtDate(t.at)} · ${t.route}`)),
    h('td', { class: 'tries-cell wide', 'data-label': 'Attempts' }, h('ol', { class: 'tries' }, lines)),
    h('td', { class: 'span-half', 'data-label': 'Time' }, h('span', { class: 'num' }, fmtSeconds(t.seconds))),
    h('td', { class: 'span-half', 'data-label': 'Tokens' }, h('span', { class: 'num' }, t.tokens.total ? `${t.tokens.partial ? '≥' : ''}${fmtTokens(t.tokens.total)}` : '–')),
    h('td', { class: 'result-cell' }, h('span', { class: `result ${r.cls}` }, r.text)),
  );
}
function renderLog() {
  const rows = launches.filter((t) => {
    if (model && !t.attempts.some((a) => a.model === model)) return false;
    const passed = t.passed;
    return result === 'all' || (result === 'pass' ? passed : !passed);
  });
  $('log-body').replaceChildren(...rows.slice(0, shown).map(logRow));
  $('log-box').hidden = rows.length === 0;
  $('more').hidden = rows.length <= shown;
  $('more').textContent = `Show ${Math.min(25, rows.length - shown)} more`;
  $('tally').textContent = plural(rows.length, 'task run');
}
$('result').addEventListener('click', (e) => {
  const b = closest(e, 'button');
  if (!b) return;
  result = b.dataset.v;
  shown = 25;
  for (const x of $('result').children) x.setAttribute('aria-pressed', String(x === b));
  renderLog();
});
$('model-filter').addEventListener('change', (e) => { model = /** @type {HTMLSelectElement} */ (e.target).value; shown = 25; renderLog(); });
$('more').addEventListener('click', () => { shown += 25; renderLog(); });

// --- Load.
function fail(message) {
  $('models-state').textContent = message;
  $('models-state').className = 'empty';
  $('log').hidden = true;
}
try {
  const res = await fetch('../docs/leaderboard.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  runs = parseRuns(await res.text()).runs;
  if (!runs.length) throw new Error('empty');
  models = summarize(runs);
  launches = taskRuns(runs).reverse();
  for (const m of models.filter((x) => x.attempts > 0).sort(SORTS.tasks)) $('model-filter').append(h('option', { value: m.model }, m.name));
  renderTiles();
  renderModels();
  renderLog();
  $('models-state').hidden = true;
} catch (err) {
  fail(`Could not load docs/leaderboard.json (${err.message}). If you opened this file straight from disk, serve the repository instead: npm run preview, then open /leaderboard/.`);
}
