// Editor presentation methods. Session state is provided through the explicit editor context.
import { el, field, clone } from '../dom.js';
import { MODELS, MODEL_ORDER } from '../../trains/models.js';
import { BAND_SYMBOLS, NOSE_SYMBOLS } from '../../trains/parse.js';
import { partColor, symbolColor } from '../../trains/palette.js';
import { LOCO_ROWS, LOCO_MIN_W, LOCO_MAX_W, LOCO_WHEELS } from '../../trains/geometry.js';
import { createPixelGrid } from '../pixel-grid.js';
import { blankMetro, stockLoco, normalize } from './format.js';
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
/** @param {Record<string, any>} editor */
export function createTrainFields(editor) {
  // --- Form

  function section(title, ...kids) {
    return el('section', { className: 'panel' }, el('h3', { textContent: title }), ...kids);
  }

  function startSection() {
    const pick = el('select');
    pick.innerHTML =
      `<optgroup label="Catalog">${MODEL_ORDER.map((id) => `<option value="m:${id}">${MODELS[id].name}</option>`).join('')}</optgroup>` +
      `<optgroup label="Examples">${Object.entries(EXAMPLES).map(([f, n]) => `<option value="e:${f}">${n}</option>`).join('')}</optgroup>`;
    const load = editor.btn('Start from this', '', async () => {
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
      editor.draft = next;
      renderForm();
    });
    return section('Start from', el('div', { className: 'inline' }, pick, load), el('p', { className: 'hint', textContent: 'Loads a train to change. Your current one is replaced (the share link and the JSON keep copies).' }));
  }

  function text(key, label, hint, max) {
    const input = el('input', { type: 'text', value: editor.draft[key] ?? '', maxLength: max ?? 200 });
    input.addEventListener('input', () => {
      if (input.value) editor.draft[key] = input.value;
      else delete editor.draft[key];
      editor.update();
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
    editor.draft.pal ??= { body: '#1a7f37' };
    const list = el('div', { className: 'pal' });
    for (const key of Object.keys(PAL_LABELS)) {
      const set = editor.draft.pal[key] !== undefined;
      const derived = editor.model?.pal?.[key] ?? '#888888';
      const input = colorInput(set ? normalize(editor.draft.pal[key]) : derived, (v) => {
        editor.draft.pal[key] = v;
        auto.checked = false;
        editor.update();
      });
      const auto = el('input', { type: 'checkbox', checked: !set, disabled: key === 'body', title: 'Derive it from the body color' });
      auto.addEventListener('change', () => {
        if (auto.checked) delete editor.draft.pal[key];
        else editor.draft.pal[key] = input.value;
        editor.update();
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
      sw.style.background = editor.model ? symbolColor(editor.model, s, editor.stripe()) : '#888';
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
    const bands = [...(Array.isArray(editor.draft.bands) ? editor.draft.bands.join('') : editor.draft.bands ?? 'bbaabll')];
    const rows = el('div', { className: 'bands' });
    rows.append(el('div', { className: 'band' }, el('span', { textContent: 'roof edge (row 3)' }), symbolPicker(editor.draft.row3 ?? 'u', (s) => { editor.draft.row3 = s; editor.update(); })));
    bands.forEach((s, i) => {
      rows.append(el('div', { className: 'band' }, el('span', { textContent: `row ${11 + i}` }), symbolPicker(s, (v) => {
        bands[i] = v;
        editor.draft.bands = bands.join('');
        editor.update();
      })));
    });
    const num = (value, min, max, step, onInput) => {
      const i = el('input', { type: 'number', value, min, max, step: step ?? 1 });
      i.addEventListener('input', () => onInput(Number(i.value)));
      return i;
    };
    editor.draft.win ??= { y0: 4, y1: 10 };
    const winBand = el('input', { type: 'checkbox', checked: !!editor.draft.winBand });
    const winColor = colorInput(normalize(editor.draft.winBand ?? '#2f3340'), (v) => { editor.draft.winBand = v; winBand.checked = true; editor.update(); });
    winBand.addEventListener('change', () => {
      if (winBand.checked) editor.draft.winBand = winColor.value;
      else delete editor.draft.winBand;
      editor.update();
    });
    const doors = el('select');
    doors.innerHTML = '<option value="2">2 per side</option><option value="3">3 per side (metro)</option>';
    doors.value = String(editor.draft.doors ?? 2);
    doors.addEventListener('change', () => { editor.draft.doors = Number(doors.value); editor.update(); });
    const cab = el('select');
    cab.innerHTML = ['0', ...Array.from({ length: 14 }, (_, i) => String(4 + 2 * i))].map((v) => `<option>${v}</option>`).join('');
    cab.value = String(editor.draft.cabWindows ?? 0);
    cab.addEventListener('change', () => {
      if (cab.value === '0') delete editor.draft.cabWindows;
      else editor.draft.cabWindows = Number(cab.value);
      editor.update();
    });
    const pant = el('select');
    pant.innerHTML = '<option value="">third rail (no pantograph)</option><option value="lead">on the cab</option><option value="alt">every other car</option>';
    pant.value = editor.draft.pant ?? '';
    pant.addEventListener('change', () => {
      if (pant.value) editor.draft.pant = pant.value;
      else delete editor.draft.pant;
      editor.update();
    });
    const check = (key, label, dflt = false) => {
      const c = el('input', { type: 'checkbox', checked: editor.draft[key] ?? dflt });
      c.addEventListener('change', () => { editor.draft[key] = c.checked; editor.update(); });
      return el('label', { className: 'check' }, c, el('span', { textContent: label }));
    };
    return section(
      'Body',
      el('p', { className: 'hint', textContent: 'The side stripes, row by row: "a" takes the color of your top language.' }),
      rows,
      el('div', { className: 'grid2' },
        field('Window frame top (3-6)', num(editor.draft.win.y0, 3, 6, 1, (v) => { editor.draft.win = { ...editor.draft.win, y0: v }; editor.update(); })),
        field('Window frame bottom (8-12)', num(editor.draft.win.y1, 8, 12, 1, (v) => { editor.draft.win = { ...editor.draft.win, y1: v }; editor.update(); })),
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
    const isLoco = !!editor.draft.loco;
    const mode = el('div', { className: 'seg' });
    for (const [id, label] of [['nose', 'A cab with a nose'], ['loco', 'A locomotive (steam)']]) {
      const b = el('button', { type: 'button', textContent: label });
      b.setAttribute('aria-pressed', String((id === 'loco') === isLoco));
      b.addEventListener('click', async () => {
        if ((id === 'loco') === !!editor.draft.loco) return;
        if (id === 'loco') {
          editor.draft._nose = editor.draft.nose;
          delete editor.draft.nose;
          for (const k of ['cabWindows', 'cabBogieOff', 'pantX', 'articulated']) delete editor.draft[k];
          delete editor.draft.pant;
          editor.draft.loco = editor.draft._loco ?? (await stockLoco());
        } else {
          editor.draft._loco = editor.draft.loco;
          delete editor.draft.loco;
          editor.draft.nose = editor.draft._nose ?? clone(blankMetro().nose);
        }
        delete editor.draft._nose;
        delete editor.draft._loco;
        renderForm();
      });
      mode.append(b);
    }
    const body = isLoco ? locoEditor() : noseEditor();
    return section('Front', mode, body);
  }

  function noseEditor() {
    // A catalog nose ("bullet" or { base }) becomes drawn rows so it can be edited.
    if (typeof editor.draft.nose === 'string' || editor.draft.nose?.base) {
      const base = MODELS[typeof editor.draft.nose === 'string' ? editor.draft.nose : editor.draft.nose.base] ?? MODELS['metro-white'];
      editor.draft.nose = { ...(typeof editor.draft.nose === 'object' ? editor.draft.nose : {}), rows: [...base.nose.rows], color: editor.draft.nose.color ?? base.nose.color, face: editor.draft.nose.face ?? base.nose.face };
      delete editor.draft.nose.base;
      delete editor.draft.nose.w;
    }
    if (editor.draft.nose?.edge) editor.draft.nose = { rows: editor.model?.nose?.rows ?? blankMetro().nose.rows };
    editor.draft.nose ??= clone(blankMetro().nose);
    const n = editor.draft.nose;
    const w = Math.max(4, ...n.rows.map((r) => r.length));
    const width = el('input', { type: 'range', min: 4, max: 40, value: w });
    const wOut = el('output', { textContent: w });
    width.addEventListener('input', () => { wOut.textContent = width.value; editor.noseGrid.setWidth(+width.value); });
    const paint = colorInput(normalize(n.color ?? editor.model?.pal?.body ?? '#cccccc'), (v) => { n.color = v; editor.update(); refreshGrids(); });
    const face = colorInput(normalize(n.face ?? editor.model?.pal?.dark ?? '#2f3340'), (v) => { n.face = v; editor.update(); refreshGrids(); });
    const host = el('div');
    const out = el(
      'div',
      {},
      el('p', { className: 'hint', textContent: 'The front of the lead car seen from the side, 20 rows from the roof to the skirt, from where it joins the car (left) to the tip (right). The tail uses the same drawing mirrored, with red lights.' }),
      el('div', { className: 'grid2' }, field('Nose paint (n)', paint), field('Face panel (f)', face)),
      field('Width', el('div', { className: 'inline' }, width, wOut)),
      host,
    );
    editor.noseGrid = createPixelGrid(host, {
      rows: n.rows.map((r) => r.padEnd(w, '.')),
      symbols: [...NOSE_SYMBOLS].map((s) => ({ sym: s, label: NOSE_LABELS[s] })),
      colorOf: (s, y) => (editor.model?.nose ? partColor(editor.model, editor.model.nose, s, y, editor.stripe()) : '#888'),
      bands: NOSE_BANDS,
      onChange: (rows) => { n.rows = rows.map((r) => r.replace(/\.+$/, '') || '.'); delete n.w; editor.update(); },
    });
    return out;
  }

  function locoEditor() {
    const L = editor.draft.loco;
    const w = Math.max(LOCO_MIN_W, ...L.rows.map((r) => r.length));
    const width = el('input', { type: 'range', min: LOCO_MIN_W, max: LOCO_MAX_W, value: w });
    const wOut = el('output', { textContent: w });
    width.addEventListener('input', () => { wOut.textContent = width.value; editor.locoGrid.setWidth(+width.value); });
    L.wheels ??= { drive: [10, 20], d: 9 };
    const list = (value, onSet) => {
      const i = el('input', { type: 'text', value: (value ?? []).join(', ') });
      i.addEventListener('input', () => { onSet(i.value.split(/[,\s]+/).filter(Boolean).map(Number)); editor.update(); editor.locoGrid.refresh(); });
      return i;
    };
    const d = el('select');
    d.innerHTML = LOCO_WHEELS.map((v) => `<option>${v}</option>`).join('');
    d.value = String(L.wheels.d ?? 9);
    d.addEventListener('change', () => { L.wheels.d = Number(d.value); editor.update(); editor.locoGrid.refresh(); });
    const rod = el('input', { type: 'checkbox', checked: L.wheels.rod ?? true });
    rod.addEventListener('change', () => { L.wheels.rod = rod.checked; editor.update(); });
    const smoke = el('input', { type: 'number', min: 0, max: LOCO_MAX_W - 1, value: L.smoke ?? '' });
    smoke.addEventListener('input', () => {
      if (smoke.value === '') delete L.smoke;
      else L.smoke = Number(smoke.value);
      editor.update();
      editor.locoGrid.refresh();
    });
    const paint = colorInput(normalize(L.color ?? editor.model?.pal?.body ?? '#2d6a3e'), (v) => { L.color = v; editor.update(); refreshGrids(); });
    const face = colorInput(normalize(L.face ?? '#1f2328'), (v) => { L.face = v; editor.update(); refreshGrids(); });
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
    editor.locoGrid = createPixelGrid(host, {
      rows: L.rows.length === LOCO_ROWS ? L.rows.map((r) => r.padEnd(w, '.')) : Array.from({ length: LOCO_ROWS }, () => '.'.repeat(w)),
      symbols: [...NOSE_SYMBOLS].map((s) => ({ sym: s, label: NOSE_LABELS[s] })),
      colorOf: (s, y) => (editor.model?.loco ? partColor(editor.model, editor.model.loco, s, Math.max(0, Math.min(19, y - 5)), editor.stripe()) : '#888'),
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
      onChange: (rows) => { L.rows = rows; editor.update(); },
    });
    return out;
  }

  function renderForm({ keepJson = false } = {}) {
    editor.noseGrid = null;
    editor.locoGrid = null;
    editor.update({ keepJson, quiet: true });
    // Shared JSON is untrusted. Never build canvases from rejected dimensions.
    if (editor.errors.length) {
      editor.form.replaceChildren(startSection(), el('p', { textContent: 'Fix the JSON below or choose another starting train to edit its fields.' }));
      editor.update({ keepJson });
      return;
    }
    editor.form.replaceChildren(startSection(), identitySection(), paletteSection(), bodySection(), frontSection());
    editor.update({ keepJson });
  }

  function refreshGrids() {
    editor.noseGrid?.refresh();
    editor.locoGrid?.refresh();
  }
  return { renderForm, refreshGrids };
}
