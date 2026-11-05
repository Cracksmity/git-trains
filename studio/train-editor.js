// The studio's train editor: every field of the custom train format as a form,
// the nose or the locomotive as a pixel grid, and a live preview that uses the
// same code (and the same validator) as the Action. See docs/ai/train.md for
// what each field means.

import { MODELS, MODEL_ORDER } from '../src/models.js';
import { parseCustomModel, BAND_SYMBOLS, NOSE_SYMBOLS } from '../src/custom.js';
import { buildTrain, partColor, symbolColor, LOCO_ROWS, LOCO_MIN_W, LOCO_MAX_W, LOCO_WHEELS } from '../src/train.js';
import { renderScene } from '../src/scene.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats } from '../src/sample.js';
import { LANGUAGE_COLORS } from '../src/languages.js';
import { miniTrain } from '../src/mini.js';
import { createPixelGrid } from './pixel-grid.js';

const STORE = 'git-trains:studio-train';
const EXAMPLES = { 'new-york': 'New York City Subway', osaka: 'Osaka Metro 400', medellin: 'Medellín Metro', steam: 'Steam tank engine' };
const PAL_LABELS = {
  body: 'Body', upper: 'Upper body', bodyHi: 'Body, light', bodyLo: 'Body, dark', roof: 'Roof', roofHi: 'Roof, light',
  roofVent: 'Roof vents', trim: 'Trim stripe', dark: 'Very dark', glass: 'Glass', glassHi: 'Glass, light', door: 'Doors',
  doorHi: 'Doors, light', outline: 'Outline', gangway: 'Gangway', wheel: 'Wheels', skirt: 'Skirt',
};
const BAND_LABELS = { b: 'body', h: 'body light', l: 'body dark', t: 'trim', d: 'very dark', u: 'upper', a: 'language' };
const NOSE_LABELS = {
  s: 'side (follows the body rows)', n: 'nose paint', f: 'face panel', g: 'glass', G: 'glass highlight', o: 'outline',
  k: 'black', m: 'shade', h: 'highlight', l: 'headlight (red at the tail)', y: 'amber light (red at the tail)',
  r: 'red light', q: 'dark red', i: 'LED sign', a: 'language stripe', t: 'trim', d: 'very dark',
};
const NOSE_BANDS = [
  { from: 0, to: 2, label: 'roof' },
  { from: 3, to: 10, label: 'windows' },
  { from: 11, to: 17, label: 'stripes' },
  { from: 18, to: 19, label: 'skirt' },
];
const LOCO_BANDS = [
  { from: 0, to: 4, label: 'above the cars (chimney, dome)' },
  { from: 5, to: 24, label: 'body, level with the cars' },
  { from: 25, to: 29, label: 'wheels (drawn by the program)' },
];
const CARS_TOTAL = [10, 60, 250, 600, 1200, 2400];

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) if (k != null) n.append(k);
  return n;
};
const field = (label, input, hint) => el('label', { className: 'field' }, el('span', { textContent: label }), input, hint ? el('small', { textContent: hint }) : null);
const clone = (v) => JSON.parse(JSON.stringify(v));
const store = {
  get: () => { try { return localStorage.getItem(STORE); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(STORE, v); } catch {} },
};

// JSON as in the examples: one drawing row per line, short number lists on one line.
export function formatTrain(draft) {
  return JSON.stringify(draft, null, 2).replace(/\[\s+((?:-?\d+,?\s*)+)\]/g, (_, nums) => `[${nums.trim().split(/,\s*/).join(', ')}]`);
}

function blankMetro() {
  const m = clone(MODELS['metro-white']);
  return { id: 'my-train', name: 'My train', description: '', pal: { body: m.pal.body, upper: m.pal.upper, roof: m.pal.roof }, bands: m.bands.join(''), row3: m.row3, win: m.win, doors: m.doors, nose: { rows: m.nose.rows, color: m.nose.color, face: m.nose.face }, pant: m.pant, roofBoxes: true };
}

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
      const { encodeShare } = await import('./share.js');
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

  // --- Form
  function section(title, ...kids) {
    return el('section', { className: 'panel' }, el('h3', { textContent: title }), ...kids);
  }

  function startSection() {
    const pick = el('select');
    pick.innerHTML =
      `<optgroup label="Catalog">${MODEL_ORDER.map((id) => `<option value="m:${id}">${MODELS[id].name}</option>`).join('')}</optgroup>` +
      `<optgroup label="Examples">${Object.entries(EXAMPLES).map(([f, n]) => `<option value="e:${f}">${n}</option>`).join('')}</optgroup>`;
    const load = btn('Start from this', '', async () => {
      const [kind, id] = pick.value.split(':');
      let next;
      if (kind === 'm') {
        next = clone(MODELS[id]);
        next.id = `my-${id}`;
        next.name = `My ${MODELS[id].name.toLowerCase()}`;
        if (Array.isArray(next.bands)) next.bands = next.bands.join('');
      } else {
        next = await (await fetch(`../examples/trains/${id}.json`)).json();
      }
      draft = next;
      renderForm();
    });
    return section('Start from', el('div', { className: 'inline' }, pick, load), el('p', { className: 'hint', textContent: 'Loads a train to change. Your current one is replaced (the share link and the JSON keep copies).' }));
  }

  function text(key, label, hint, max) {
    const input = el('input', { type: 'text', value: draft[key] ?? '', maxLength: max ?? 200 });
    input.addEventListener('input', () => {
      if (input.value) draft[key] = input.value;
      else delete draft[key];
      update();
    });
    return field(label, input, hint);
  }

  function identitySection() {
    return section(
      'Name',
      text('id', 'Id', 'lowercase letters, digits and hyphens', 32),
      text('name', 'Name', null, 40),
      text('description', 'Inspired by', 'which real train, in a sentence; it is not drawn'),
      text('author', 'Author', 'your GitHub username'),
    );
  }

  function colorInput(value, onInput) {
    const input = el('input', { type: 'color', value });
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }

  function paletteSection() {
    draft.pal ??= { body: '#1a7f37' };
    const list = el('div', { className: 'pal' });
    for (const key of Object.keys(PAL_LABELS)) {
      const set = draft.pal[key] !== undefined;
      const derived = model?.pal?.[key] ?? '#888888';
      const input = colorInput(set ? normalize(draft.pal[key]) : derived, (v) => {
        draft.pal[key] = v;
        auto.checked = false;
        update();
      });
      const auto = el('input', { type: 'checkbox', checked: !set, disabled: key === 'body', title: 'Derive it from the body color' });
      auto.addEventListener('change', () => {
        if (auto.checked) delete draft.pal[key];
        else draft.pal[key] = input.value;
        update();
      });
      list.append(el('div', { className: 'pal-row' }, input, el('span', { textContent: PAL_LABELS[key] }), key === 'body' ? el('small', { textContent: 'required' }) : el('label', { className: 'check small' }, auto, el('span', { textContent: 'auto' }))));
    }
    return section('Colors', list, el('p', { className: 'hint', textContent: 'Only the body is required: "auto" colors are derived from it.' }));
  }

  function symbolPicker(value, onPick) {
    const seg = el('div', { className: 'seg syms' });
    for (const s of BAND_SYMBOLS) {
      const b = el('button', { type: 'button', title: BAND_LABELS[s] });
      const sw = el('i');
      sw.style.background = model ? symbolColor(model, s, stripe()) : '#888';
      b.append(sw, el('code', { textContent: s }));
      b.setAttribute('aria-pressed', String(s === value));
      b.addEventListener('click', () => {
        for (const x of seg.children) x.setAttribute('aria-pressed', String(x === b));
        onPick(s);
      });
      seg.append(b);
    }
    return seg;
  }

  function bodySection() {
    const bands = [...(Array.isArray(draft.bands) ? draft.bands.join('') : draft.bands ?? 'bbaabll')];
    const rows = el('div', { className: 'bands' });
    rows.append(el('div', { className: 'band' }, el('span', { textContent: 'roof edge (row 3)' }), symbolPicker(draft.row3 ?? 'u', (s) => { draft.row3 = s; update(); })));
    bands.forEach((s, i) => {
      rows.append(el('div', { className: 'band' }, el('span', { textContent: `row ${11 + i}` }), symbolPicker(s, (v) => {
        bands[i] = v;
        draft.bands = bands.join('');
        update();
      })));
    });

    const num = (value, min, max, step, onInput) => {
      const i = el('input', { type: 'number', value, min, max, step: step ?? 1 });
      i.addEventListener('input', () => onInput(Number(i.value)));
      return i;
    };
    draft.win ??= { y0: 4, y1: 10 };
    const winBand = el('input', { type: 'checkbox', checked: !!draft.winBand });
    const winColor = colorInput(normalize(draft.winBand ?? '#2f3340'), (v) => { draft.winBand = v; winBand.checked = true; update(); });
    winBand.addEventListener('change', () => {
      if (winBand.checked) draft.winBand = winColor.value;
      else delete draft.winBand;
      update();
    });
    const doors = el('select');
    doors.innerHTML = '<option value="2">2 per side</option><option value="3">3 per side (metro)</option>';
    doors.value = String(draft.doors ?? 2);
    doors.addEventListener('change', () => { draft.doors = Number(doors.value); update(); });
    const cab = el('select');
    cab.innerHTML = ['0', ...Array.from({ length: 14 }, (_, i) => String(4 + 2 * i))].map((v) => `<option>${v}</option>`).join('');
    cab.value = String(draft.cabWindows ?? 0);
    cab.addEventListener('change', () => {
      if (cab.value === '0') delete draft.cabWindows;
      else draft.cabWindows = Number(cab.value);
      update();
    });
    const pant = el('select');
    pant.innerHTML = '<option value="">third rail (no pantograph)</option><option value="lead">on the cab</option><option value="alt">every other car</option>';
    pant.value = draft.pant ?? '';
    pant.addEventListener('change', () => {
      if (pant.value) draft.pant = pant.value;
      else delete draft.pant;
      update();
    });
    const check = (key, label, dflt = false) => {
      const c = el('input', { type: 'checkbox', checked: draft[key] ?? dflt });
      c.addEventListener('change', () => { draft[key] = c.checked; update(); });
      return el('label', { className: 'check' }, c, el('span', { textContent: label }));
    };
    return section(
      'Body',
      el('p', { className: 'hint', textContent: 'The side stripes, row by row: "a" takes the color of your top language.' }),
      rows,
      el('div', { className: 'grid2' },
        field('Window frame top (3-6)', num(draft.win.y0, 3, 6, 1, (v) => { draft.win = { ...draft.win, y0: v }; update(); })),
        field('Window frame bottom (8-12)', num(draft.win.y1, 8, 12, 1, (v) => { draft.win = { ...draft.win, y1: v }; update(); })),
        field('Doors', doors),
        field('Extra cab windows', cab),
        field('Power', pant),
      ),
      el('label', { className: 'check' }, winBand, el('span', { textContent: 'Dark band behind the windows' }), winColor),
      check('roofBoxes', 'Boxes on the roof', true),
      check('articulated', 'Articulated (cars in pairs on a shared bogie)'),
      check('tyres', 'Rubber tyres'),
    );
  }

  function frontSection() {
    const isLoco = !!draft.loco;
    const mode = el('div', { className: 'seg' });
    for (const [id, label] of [['nose', 'A cab with a nose'], ['loco', 'A locomotive (steam)']]) {
      const b = el('button', { type: 'button', textContent: label });
      b.setAttribute('aria-pressed', String((id === 'loco') === isLoco));
      b.addEventListener('click', async () => {
        if ((id === 'loco') === !!draft.loco) return;
        if (id === 'loco') {
          draft._nose = draft.nose;
          delete draft.nose;
          for (const k of ['cabWindows', 'cabBogieOff', 'pantX', 'articulated']) delete draft[k];
          delete draft.pant;
          draft.loco = draft._loco ?? (await stockLoco());
        } else {
          draft._loco = draft.loco;
          delete draft.loco;
          draft.nose = draft._nose ?? clone(blankMetro().nose);
        }
        delete draft._nose;
        delete draft._loco;
        renderForm();
      });
      mode.append(b);
    }
    const body = isLoco ? locoEditor() : noseEditor();
    return section('Front', mode, body);
  }

  function noseEditor() {
    // A catalog nose ("bullet" or { base }) becomes drawn rows so it can be edited.
    if (typeof draft.nose === 'string' || draft.nose?.base) {
      const base = MODELS[typeof draft.nose === 'string' ? draft.nose : draft.nose.base] ?? MODELS['metro-white'];
      draft.nose = { ...(typeof draft.nose === 'object' ? draft.nose : {}), rows: [...base.nose.rows], color: draft.nose.color ?? base.nose.color, face: draft.nose.face ?? base.nose.face };
      delete draft.nose.base;
      delete draft.nose.w;
    }
    if (draft.nose?.edge) draft.nose = { rows: model?.nose?.rows ?? blankMetro().nose.rows };
    draft.nose ??= clone(blankMetro().nose);
    const n = draft.nose;
    const w = Math.max(4, ...n.rows.map((r) => r.length));
    const width = el('input', { type: 'range', min: 4, max: 40, value: w });
    const wOut = el('output', { textContent: w });
    width.addEventListener('input', () => { wOut.textContent = width.value; noseGrid.setWidth(+width.value); });
    const paint = colorInput(normalize(n.color ?? model?.pal?.body ?? '#cccccc'), (v) => { n.color = v; update(); refreshGrids(); });
    const face = colorInput(normalize(n.face ?? model?.pal?.dark ?? '#2f3340'), (v) => { n.face = v; update(); refreshGrids(); });
    const host = el('div');
    const out = el(
      'div',
      {},
      el('p', { className: 'hint', textContent: 'The front of the lead car seen from the side, 20 rows from the roof to the skirt, from where it joins the car (left) to the tip (right). The tail uses the same drawing mirrored, with red lights.' }),
      el('div', { className: 'grid2' }, field('Nose paint (n)', paint), field('Face panel (f)', face)),
      field('Width', el('div', { className: 'inline' }, width, wOut)),
      host,
    );
    noseGrid = createPixelGrid(host, {
      rows: n.rows.map((r) => r.padEnd(w, '.')),
      symbols: [...NOSE_SYMBOLS].map((s) => ({ sym: s, label: NOSE_LABELS[s] })),
      colorOf: (s, y) => (model?.nose ? partColor(model, model.nose, s, y, stripe()) : '#888'),
      bands: NOSE_BANDS,
      onChange: (rows) => { n.rows = rows.map((r) => r.replace(/\.+$/, '') || '.'); delete n.w; update(); },
    });
    return out;
  }

  function locoEditor() {
    const L = draft.loco;
    const w = Math.max(LOCO_MIN_W, ...L.rows.map((r) => r.length));
    const width = el('input', { type: 'range', min: LOCO_MIN_W, max: LOCO_MAX_W, value: w });
    const wOut = el('output', { textContent: w });
    width.addEventListener('input', () => { wOut.textContent = width.value; locoGrid.setWidth(+width.value); });
    L.wheels ??= { drive: [10, 20], d: 9 };
    const list = (value, onSet) => {
      const i = el('input', { type: 'text', value: (value ?? []).join(', ') });
      i.addEventListener('input', () => { onSet(i.value.split(/[,\s]+/).filter(Boolean).map(Number)); update(); locoGrid.refresh(); });
      return i;
    };
    const d = el('select');
    d.innerHTML = LOCO_WHEELS.map((v) => `<option>${v}</option>`).join('');
    d.value = String(L.wheels.d ?? 9);
    d.addEventListener('change', () => { L.wheels.d = Number(d.value); update(); locoGrid.refresh(); });
    const rod = el('input', { type: 'checkbox', checked: L.wheels.rod ?? true });
    rod.addEventListener('change', () => { L.wheels.rod = rod.checked; update(); });
    const smoke = el('input', { type: 'number', min: 0, max: LOCO_MAX_W - 1, value: L.smoke ?? '' });
    smoke.addEventListener('input', () => {
      if (smoke.value === '') delete L.smoke;
      else L.smoke = Number(smoke.value);
      update();
      locoGrid.refresh();
    });
    const paint = colorInput(normalize(L.color ?? model?.pal?.body ?? '#2d6a3e'), (v) => { L.color = v; update(); refreshGrids(); });
    const face = colorInput(normalize(L.face ?? '#1f2328'), (v) => { L.face = v; update(); refreshGrids(); });
    const host = el('div');
    const out = el(
      'div',
      {},
      el('p', { className: 'hint', textContent: 'The whole locomotive, facing right: 30 rows (5 above the cars\' roof for the chimney and dome, 20 level with the cars, 5 for the wheels). The program draws the wheels and the rod on top; the circles show where.' }),
      el('div', { className: 'grid2' }, field('Paint (n)', paint), field('Face (f)', face)),
      field('Width', el('div', { className: 'inline' }, width, wOut)),
      el('div', { className: 'grid2' },
        field('Driving wheels (centers)', list(L.wheels.drive, (v) => { L.wheels.drive = v; })),
        field('Driving wheel size', d),
        field('Small wheels (centers)', list(L.wheels.small, (v) => { if (v.length) L.wheels.small = v; else delete L.wheels.small; })),
        field('Chimney column (smoke)', smoke),
      ),
      el('label', { className: 'check' }, rod, el('span', { textContent: 'Coupling rod between the driving wheels' })),
      host,
    );
    locoGrid = createPixelGrid(host, {
      rows: L.rows.length === LOCO_ROWS ? L.rows.map((r) => r.padEnd(w, '.')) : Array.from({ length: LOCO_ROWS }, () => '.'.repeat(w)),
      symbols: [...NOSE_SYMBOLS].map((s) => ({ sym: s, label: NOSE_LABELS[s] })),
      colorOf: (s, y) => (model?.loco ? partColor(model, model.loco, s, Math.max(0, Math.min(19, y - 5)), stripe()) : '#888'),
      bands: LOCO_BANDS,
      overlay: (ctx, cell, ox) => {
        ctx.strokeStyle = 'rgba(200,40,40,0.8)';
        ctx.lineWidth = 2;
        const circle = (x, dia) => {
          const r = ((dia - 1) / 2 + 0.5) * cell;
          ctx.beginPath();
          ctx.arc(ox + (x + 0.5) * cell, (LOCO_ROWS - 0.5 - (dia - 1) / 2) * cell, r, 0, Math.PI * 2);
          ctx.stroke();
        };
        for (const x of L.wheels?.drive ?? []) circle(x, L.wheels.d ?? 9);
        for (const x of L.wheels?.small ?? []) circle(x, 5);
        if (Number.isInteger(L.smoke)) {
          ctx.fillStyle = 'rgba(160,160,170,0.35)';
          ctx.fillRect(ox + L.smoke * cell, 0, cell, 5 * cell);
        }
      },
      onChange: (rows) => { L.rows = rows; update(); },
    });
    return out;
  }

  function renderForm({ keepJson = false } = {}) {
    noseGrid = null;
    locoGrid = null;
    update({ keepJson, quiet: true });
    form.replaceChildren(startSection(), identitySection(), paletteSection(), bodySection(), frontSection());
    update({ keepJson });
  }

  function refreshGrids() {
    noseGrid?.refresh();
    locoGrid?.refresh();
  }

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

// The steam example's locomotive, as a starting point for drawing one.
async function stockLoco() {
  try {
    return (await (await fetch('../examples/trains/steam.json')).json()).loco;
  } catch {
    return { rows: Array.from({ length: LOCO_ROWS }, (_, y) => (y >= 5 && y <= 24 ? 'n'.repeat(24) : '')), wheels: { drive: [6, 17], d: 9 } };
  }
}

function normalize(c) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c ?? '').trim());
  if (!m) return '#888888';
  return `#${m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1]}`.toLowerCase();
}
