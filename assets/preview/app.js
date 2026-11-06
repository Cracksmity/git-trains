import { closest, elements } from '../../src/browser/dom.js';
// Page controller. Relative fetch URLs intentionally resolve against the page.
import { buildTrain } from '../../src/trains/render.js';
import { renderScene } from '../../src/scene/render.js';
import { MODELS, MODEL_ORDER } from '../../src/trains/models.js';
import { LANGUAGE_COLORS } from '../../src/activity/languages.js';
import { summarize, stateFor, carsFor } from '../../src/activity/stats.js';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleDays, SAMPLE_LANGUAGES } from '../../src/demo/sample.js';
import { parseCustomModel } from '../../src/trains/parse.js';
import { parseSkyline, SKYLINES } from '../../src/landscape/skyline-parse.js';
import { renderCalendar } from '../../src/calendar/render.js';
import { buildReview } from '../../src/review/data.js';
import { renderReview } from '../../src/review/render.js';
import { sampleYear } from '../../src/demo/sample.js';
import { DECORATIONS, decorationFor } from '../../src/activity/seasons.js';

/** Dynamic page IDs address mixed form and image elements. @returns {any} */
const $ = (id) => document.getElementById(id);
const state = { mode: 'single', theme: 'light', language: 'en', doors: 'closed', hemisphere: 'north' };
const SIGN = { en: 'STREAK', es: 'RACHA' };

// --- selects
$('train').innerHTML = '<option value="auto">Auto (evolves with the cars)</option>' +
  MODEL_ORDER.map((id) => `<option value="${id}">${MODELS[id].name}</option>`).join('') +
  '<option value="custom">Your train (JSON, below)</option>';
$('skyline').innerHTML = '<option value="city">City (procedural, unique per user)</option>' +
  Object.entries(SKYLINES).map(([id, s]) => `<option value="${id}">${s.name}</option>`).join('') +
  '<option value="custom">Your skyline (JSON, below)</option>';
const langNames = Object.keys(LANGUAGE_COLORS);
$('lang').innerHTML = langNames.map((n) => `<option>${n}</option>`).join('');
$('lang').value = 'TypeScript';

function seg(id, key, cb) {
  $(id).addEventListener('click', (e) => {
    const b = closest(e, 'button'); if (!b) return;
    state[key] = b.dataset.v;
    for (const x of $(id).children) x.setAttribute('aria-pressed', String(x === b));
    cb();
  });
}

// --- seasons and holidays
// It starts on the day the Action would run today (UTC), so the playground dresses like the Action.
const todayUtc = () => new Date().toISOString().slice(0, 10);
$('day').value = todayUtc();
// The middle day of the year that wears `kind` in the picked hemisphere.
function sampleDay(kind) {
  const year = Number(($('day').value || todayUtc()).slice(0, 4));
  const days = [];
  for (let ms = Date.UTC(year, 0, 1); ms < Date.UTC(year + 1, 0, 1); ms += 864e5) {
    const iso = new Date(ms).toISOString().slice(0, 10);
    if (decorationFor(iso, state.hemisphere) === kind) days.push(iso);
  }
  return days[days.length >> 1];
}
function fillJump() {
  const year = Number(($('day').value || todayUtc()).slice(0, 4));
  $('jump').innerHTML = '<option value="">Choose a season or a holiday…</option>' +
    Object.entries(DECORATIONS).map(([kind, name]) => `<option value="${sampleDay(kind)}">${name} · ${sampleDay(kind)}</option>`).join('') +
    `<option value="${year}-${state.hemisphere === 'north' ? '07' : '01'}-15">Summer · plain scene</option>`;
}

function statsFromControls() {
  const total = +$('total').value, streak = +$('streak').value, yesterday = +$('yesterday').value;
  const days = sampleDays({ total: Math.max(total, 1), streak, yesterday });
  const lang = $('lang').value;
  const langs = [{ name: lang, color: LANGUAGE_COLORS[lang], bytes: 640000 },
    ...SAMPLE_LANGUAGES.filter((l) => l.name !== lang).slice(0, 3)];
  const user = $('user').value.trim() || 'octocat';
  const s = summarize({ user, days, languages: langs });
  s.total = total; s.yesterday = yesterday; s.streak = streak;
  s.cars = carsFor(total); s.state = stateFor(yesterday);
  return s;
}

// --- your own train and skyline (JSON)
// Each editor keeps its last valid result and its last error, so something
// is still shown while you type.
const SOURCES = {
  train: { file: '../docs/ai/train.md', example: '../examples/trains/new-york.json', parse: parseCustomModel, what: 'The train' },
  skyline: { file: '../docs/ai/skyline.md', example: '../examples/skylines/mexico-city.json', parse: parseSkyline, what: 'The skyline' },
  region: { file: '../docs/ai/region.md' }, // only copied: its JSON goes inside the skyline's
};
const custom = { train: { value: null, error: '' }, skyline: { value: null, error: '' } };
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
// What people pasted before the rename is still there.
const OLD_KEYS = { train: 'git-trenes:tren', skyline: 'git-trenes:fondo' };

function readEditor(kind) {
  const text = $(`json-${kind}`).value.trim();
  const st = $(`st-${kind}`);
  const c = custom[kind];
  store.set(`git-trains:${kind}`, $(`json-${kind}`).value);
  if (!text) {
    c.value = null; c.error = '';
    st.className = 'status'; st.textContent = '';
    return;
  }
  try {
    let raw;
    try { raw = JSON.parse(text); } catch (err) { throw new Error(`${SOURCES[kind].what} is not valid JSON: ${err.message}`); }
    c.value = SOURCES[kind].parse(raw);
    c.error = '';
    st.className = 'status ok';
    st.textContent = `✓ ${c.value.name}: ready.`;
  } catch (err) {
    c.error = err.message;
    const items = err.errors ?? [err.message];
    st.className = 'status bad';
    st.innerHTML = `${items.length} problem(s)${c.value ? ' (showing the last valid version)' : ''}:<ul>${items.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
  }
}

async function copyText(text, button) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied!';
  } catch {
    // No clipboard (outside https, for example): open the text to copy it by hand.
    const w = window.open('', '_blank');
    if (w) { w.document.title = 'git-trains'; const pre = w.document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = text; w.document.body.append(pre); }
    button.textContent = 'Opened: copy it there';
  }
  setTimeout(() => { button.textContent = label; }, 1800);
}

document.addEventListener('click', async (e) => {
  const b = closest(e, 'button'); if (!b) return;
  const kind = b.dataset.copy ?? b.dataset.example ?? b.dataset.errors ?? b.dataset.download;
  if (!kind) return;
  const src = SOURCES[kind];
  if (b.dataset.copy) {
    const text = await (await fetch(src.file)).text();
    copyText(text, b);
  } else if (b.dataset.example) {
    $(`json-${kind}`).value = await (await fetch(b.dataset.file ?? src.example)).text();
    onEdit(kind);
  } else if (b.dataset.errors) {
    copyText(custom[kind].error ? `Fix these problems and give me the complete JSON again:\n${custom[kind].error}` : 'No problems.', b);
  } else if (b.dataset.download) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$(`json-${kind}`).value], { type: 'application/json' }));
    a.download = `${kind}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
});

function onEdit(kind) {
  readEditor(kind);
  if (custom[kind].value) $(kind).value = 'custom';
  render();
}
for (const kind of ['train', 'skyline']) {
  $(`json-${kind}`).value = store.get(`git-trains:${kind}`) ?? store.get(OLD_KEYS[kind]) ?? '';
  readEditor(kind);
  $(`json-${kind}`).addEventListener('input', () => onEdit(kind));
}

function pickedTrain() {
  const v = $('train').value;
  return v === 'custom' ? custom.train.value ?? 'auto' : v;
}
function pickedSkyline() {
  const v = $('skyline').value;
  return v === 'custom' ? custom.skyline.value : parseSkyline(v);
}

let url;
let calUrl;
let reviewUrl;
function render() {
  $('o-total').textContent = $('total').value;
  $('o-streak').textContent = $('streak').value;
  $('o-yesterday').textContent = $('yesterday').value;
  const s = statsFromControls();
  const spec = buildSpec(s, { train: pickedTrain(), mode: state.mode, theme: state.theme, language: state.language, scale: 2, skyline: pickedSkyline(), date: $('day').value || undefined, hemisphere: state.hemisphere });
  const svg = renderScene(spec);
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  $('scene').src = url;
  $('scene').alt = spec.title;
  const t = spec.tracks[0];
  const dressed = spec.date && decorationFor(spec.date, spec.hemisphere);
  const cal = renderCalendar(s, { model: t.model, stripe: t.stripe, label: t.label, language: state.language, theme: state.theme });
  if (calUrl) URL.revokeObjectURL(calUrl);
  calUrl = URL.createObjectURL(new Blob([cal], { type: 'image/svg+xml' }));
  $('calendar').src = calUrl;
  // The year in review: the sample year, scaled to the total of the slider, with the same train and top language.
  const year = sampleYear(2025);
  const sum = year.days.reduce((a, d) => a + d.count, 0) || 1;
  year.days = year.days.map((d) => ({ ...d, count: Math.round((d.count * s.total) / sum) }));
  year.user = s.user;
  year.languages = s.languages;
  const poster = renderReview(buildReview(year, { year: 2025 }), { language: state.language, theme: state.theme, model: t.model, stripe: t.stripe });
  if (reviewUrl) URL.revokeObjectURL(reviewUrl);
  reviewUrl = URL.createObjectURL(new Blob([poster], { type: 'image/svg+xml' }));
  $('review').src = reviewUrl;
  $('meta').innerHTML = `<span>${s.cars} car(s)</span><span>state: <b>${s.state}</b></span><span>streak ${s.streak}</span><span>day: <b>${dressed ? DECORATIONS[dressed] : spec.date ? 'plain (summer)' : 'seasons off'}</b></span><span>SVG ${(svg.length / 1024).toFixed(1)} KB</span><span>calendar ${(cal.length / 1024).toFixed(1)} KB</span><span>year in review ${(poster.length / 1024).toFixed(1)} KB</span>`;
  zoom(t);
  elements('.card').forEach((c) => c.classList.toggle('pick', c.dataset.id === t.model));
}

// --- canvas
function paint(canvas, train, scale, openDoors) {
  canvas.width = train.width * scale; canvas.height = train.height * scale;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const order = ['body', 'lit', 'wa'].concat(openDoors ? ['open'] : [], ['led', 'pa']);
  for (const name of order) {
    const g = train.layers[name];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const c = g.cells[y * g.w + x];
      if (!c || c[0] === '@') continue;
      ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function zoom(t) {
  const model = typeof t.model === 'string' ? MODELS[t.model] : t.model;
  const train = buildTrain(model, { cars: t.cars, stripe: t.stripe, streak: t.streak, label: SIGN[state.language], dir: t.dir });
  paint($('zoom'), train, 5, state.doors === 'open');
}

function gallery() {
  const s = statsFromControls();
  $('gallery').innerHTML = '';
  for (const id of MODEL_ORDER) {
    const card = document.createElement('div'); card.className = 'card'; card.dataset.id = id;
    card.innerHTML = `<h3>${MODELS[id].name} <code>${id}</code></h3>`;
    const c = document.createElement('canvas'); card.append(c); $('gallery').append(card);
    paint(c, buildTrain(MODELS[id], { cars: 3, stripe: s.languages[0].color, streak: s.streak, label: SIGN[state.language] }), 3, false);
  }
}

for (const id of ['total', 'streak', 'yesterday', 'user']) $(id).addEventListener('input', () => { render(); });
$('train').addEventListener('change', render);
$('skyline').addEventListener('change', render);
$('lang').addEventListener('change', () => { render(); gallery(); });
seg('mode', 'mode', render);
seg('theme', 'theme', render);
seg('language', 'language', () => { render(); gallery(); });
seg('doors', 'doors', render);
seg('hemisphere', 'hemisphere', () => { fillJump(); render(); });
$('day').addEventListener('input', () => { fillJump(); render(); });
$('today').addEventListener('click', () => { $('day').value = todayUtc(); fillJump(); render(); });
$('jump').addEventListener('change', () => { if (!$('jump').value) return; $('day').value = $('jump').value; fillJump(); render(); });
fillJump();
gallery(); render();
