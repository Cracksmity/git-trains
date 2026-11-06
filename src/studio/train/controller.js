import { createTrainFields } from './fields.js';
// train/controller.js: focused controller operations.

import { el, field } from '../dom.js';

import { parseCustomModel } from '../../trains/parse.js';
import { buildTrain } from '../../trains/render.js';


import { renderScene } from '../../scene/render.js';
import { buildSpec } from '../../scene/spec.js';
import { sampleStats } from '../../demo/sample.js';
import { LANGUAGE_COLORS } from '../../activity/languages.js';
import { miniTrain } from '../../trains/mini.js';

import { formatTrain, blankMetro } from './format.js';

const STORE = 'git-trains:studio-train';

const CARS_TOTAL = [10, 60, 250, 600, 1200, 2400];

const store = {
  get: () => { try { return localStorage.getItem(STORE); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(STORE, v); } catch {} },
};

/** @param {HTMLElement} root @param {{initialText?: string, onStatus?: (valid: boolean) => void}} options */
export function mountTrainEditor(root, { initialText, onStatus } = {}) {
  let draft = blankMetro();
  let model = null; // last valid parse
  let errors = [];
  const view = { theme: 'light', cars: 3, lang: 'TypeScript', doors: false };
  let noseGrid = null;
  let locoGrid = null;

  const form = el('div', { className: 'te-form' });
  const scene = el('img', { className: 'te-scene', alt: 'Your train in the scene' });
  const zoom = el('canvas', { className: 'te-zoom' });
  const mini = el('canvas', { className: 'te-mini' });
  const status = el('div', { className: 'status', role: 'status' });
  const json = el('textarea', { className: 'te-json', spellcheck: false, ariaLabel: 'Train JSON' });

  // --- Preview controls
  const themeSeg = el('div', { className: 'seg' });
  for (const t of ['light', 'dark']) {
    const b = el('button', { type: 'button', textContent: t === 'light' ? 'Light' : 'Dark' });
    b.setAttribute('aria-pressed', String(view.theme === t));
    b.addEventListener('click', () => {
      view.theme = t;
      for (const x of themeSeg.children) x.setAttribute('aria-pressed', String(x === b));
      preview();
    });
    themeSeg.append(b);
  }
  const carsIn = el('input', { type: 'range', min: 1, max: 6, value: view.cars });
  carsIn.addEventListener('input', () => { view.cars = +carsIn.value; preview(); });
  const langIn = el('select');
  langIn.innerHTML = Object.keys(LANGUAGE_COLORS).map((n) => `<option>${n}</option>`).join('');
  langIn.value = view.lang;
  langIn.addEventListener('change', () => { view.lang = langIn.value; preview(); refreshGrids(); });
  const doorsIn = el('input', { type: 'checkbox' });
  doorsIn.addEventListener('change', () => { view.doors = doorsIn.checked; preview(); });

  const stripe = () => LANGUAGE_COLORS[view.lang] ?? '#3178c6';

  // --- Output buttons
  const btn = (label, cls, fn) => {
    const b = el('button', { type: 'button', textContent: label, className: cls ?? '' });
    b.addEventListener('click', () => fn(b));
    return b;
  };
  const flash = (b, text) => {
    const was = b.textContent;
    b.textContent = text;
    setTimeout(() => { b.textContent = was; }, 1600);
  };
  const copy = async (text, b, done = 'Copied!') => {
    try {
      await navigator.clipboard.writeText(text);
      flash(b, done);
    } catch {
      json.focus();
      json.select();
      flash(b, 'Select and copy it');
    }
  };
  const outButtons = el(
    'div',
    { className: 'btns' },
    btn('Copy share link', 'main', async (b) => {
      const { encodeShare } = await import('../../sharing/codec.js');
      const hash = await encodeShare('train', draft);
      history.replaceState(null, '', hash);
      copy(location.href, b, 'Link copied!');
    }),
    btn('Copy JSON', '', (b) => copy(formatTrain(draft), b)),
    btn('Download train.json', '', () => {
      const a = el('a', { download: `${draft.id || 'train'}.json` });
      a.href = URL.createObjectURL(new Blob([formatTrain(draft)], { type: 'application/json' }));
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }),
    btn('Open in the playground', '', () => {
      try { localStorage.setItem('git-trains:train', formatTrain(draft)); } catch {}
      window.open('../preview/#yours', '_blank');
    }),
  );

  json.addEventListener('input', () => {
    try {
      const next = JSON.parse(json.value);
      if (next && typeof next === 'object' && !Array.isArray(next)) {
        draft = next;
        renderForm({ keepJson: true });
      }
    } catch {
      status.className = 'status bad';
      status.textContent = 'The JSON has a syntax error; the form shows the last version that parsed.';
    }
  });

  const side = el(
    'div',
    { className: 'te-preview' },
    el('div', { className: 'stage' }, scene),
    el('div', { className: 'te-controls' },
      field('Theme', themeSeg),
      field('Cars', carsIn),
      field('Stripe language', langIn),
      el('label', { className: 'check' }, doorsIn, el('span', { textContent: 'Doors open' })),
    ),
    el('h3', { textContent: 'Zoomed' }),
    el('div', { className: 'zoomwrap' }, zoom),
    el('h3', { textContent: 'Calendar mini' }),
    el('div', { className: 'zoomwrap' }, mini),
    status,
    outButtons,
    el('details', { className: 'te-jsonbox' }, el('summary', { textContent: 'JSON (edit it directly if you like)' }), json),
  );
  root.append(el('div', { className: 'te' }, form, side));
  const { renderForm, refreshGrids } = createTrainFields({
    get btn() { return btn; },
    get draft() { return draft; },
    set draft(value) { draft = value; },
    get update() { return update; },
    get model() { return model; },
    set model(value) { model = value; },
    get stripe() { return stripe; },
    get noseGrid() { return noseGrid; },
    set noseGrid(value) { noseGrid = value; },
    get locoGrid() { return locoGrid; },
    set locoGrid(value) { locoGrid = value; },
    get errors() { return errors; },
    set errors(value) { errors = value; },
    get form() { return form; },
  });


  // --- Validate, save and preview
  function update({ keepJson = false, quiet = false } = {}) {
    const clean = JSON.parse(JSON.stringify(draft, (k, v) => (k.startsWith('_') ? undefined : v)));
    try {
      model = parseCustomModel(clean);
      errors = [];
    } catch (err) {
      errors = err.errors ?? [err.message];
    }
    if (quiet) return;
    if (!keepJson && document.activeElement !== json) json.value = formatTrain(clean);
    store.set(formatTrain(clean));
    if (errors.length) {
      status.className = 'status bad';
      status.replaceChildren(
        el('span', { textContent: `${errors.length} problem(s)${model ? ' (the preview shows the last valid version)' : ''}:` }),
        el('ul', {}, ...errors.map((e) => el('li', { textContent: e }))),
      );
    } else {
      status.className = 'status ok';
      status.textContent = `✓ ${model.name}: valid, ready for your profile.`;
    }
    onStatus?.(errors.length === 0);
    preview();
  }

  let sceneUrl;
  function preview() {
    if (!model) return;
    const stats = sampleStats({ total: CARS_TOTAL[view.cars - 1], streak: 12, yesterday: 6 });
    stats.languages = [{ name: view.lang, color: stripe(), bytes: 1, share: 1 }];
    const svg = renderScene(buildSpec(stats, { train: model, theme: view.theme }));
    if (sceneUrl) URL.revokeObjectURL(sceneUrl);
    sceneUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    scene.src = sceneUrl;
    const t = buildTrain(model, { cars: Math.min(view.cars, 2), stripe: stripe(), streak: 12, label: 'STREAK' });
    paint(zoom, t.layers, t.width, t.height, 4, ['body', 'lit', 'wa', ...(view.doors ? ['open'] : []), 'led', 'pa']);
    const m = miniTrain(model, { stripe: stripe(), streak: 12 });
    const gap = 1;
    mini.width = (m.head.w + m.car.w * 2 + gap * 2) * 6;
    mini.height = m.head.grid.h * 6;
    const ctx = mini.getContext('2d');
    ctx.clearRect(0, 0, mini.width, mini.height);
    let x = 0;
    for (const u of [m.car, m.car, m.head]) {
      drawGrid(ctx, u.grid, x, 6);
      x += (u.w + gap) * 6;
    }
  }

  function paint(canvas, layers, w, h, scale, order) {
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const name of order) drawGrid(ctx, layers[name], 0, scale);
  }

  function drawGrid(ctx, g, ox, scale) {
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const c = g.cells[y * g.w + x];
        if (!c || c[0] === '@') continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * scale, y * scale, scale, scale);
      }
    }
  }

  // --- Start: a shared link, then the last session, then a fresh metro.
  const saved = initialText ?? store.get();
  if (saved) {
    try {
      draft = JSON.parse(saved);
    } catch {}
  }
  renderForm();
  return {
    load(text) {
      draft = JSON.parse(text);
      renderForm();
    },
  };
}
