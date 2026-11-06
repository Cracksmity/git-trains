import { createSkylineCanvas } from './canvas.js';
import { createSkylineFields } from './fields.js';
// skyline/controller.js: focused controller operations.

import { clone, object, clamp, el, field, section } from '../dom.js';
import { SKYLINES, parseSkyline } from '../../landscape/skyline-parse.js';

import { Grid } from '../../graphics/pixel.js';

import { SCENE_W, GY0 } from '../../scene/layout.js';


import { renderScene } from '../../scene/render.js';
import { buildSpec } from '../../scene/spec.js';
import { sampleStats } from '../../demo/sample.js';

import { encodeShare } from '../../sharing/codec.js';
import { formatSkyline } from './format.js';
import { installStyles } from './styles.js';

const STORE = 'git-trains:studio-skyline';

/** @param {HTMLElement} root @param {{initialText?: string}} options */
export function mountSkylineEditor(root, { initialText } = {}) {
  installStyles();
  let draft = clone(SKYLINES['new-york']);
  let parsed;
  let errors = [];
  let selected = 0;
  let grid = null;
  let xInput = null;
  let sceneUrl;
  let revision = 0;
  let drag = null;
  /** @type {string | number} */
  let zoom = 'auto';
  let canvasSky = null;
  let canvasIndices = [];
  let hits = new Grid(SCENE_W, GY0);
  let bounds = [];
  const view = { theme: 'light', train: true, sign: true, sun: true };
  const stats = sampleStats();
  const buildings = () => object(draft) && Array.isArray(draft.buildings) ? draft.buildings : [];
  const save = (text) => { try { localStorage.setItem(STORE, text); } catch {} };
  const button = (label, action, className = '') => {
    const node = el('button', { type: 'button', textContent: label, className });
    node.addEventListener('click', () => action(node));
    return node;
  };
  const check = (label, checked, action) => {
    const input = el('input', { type: 'checkbox', checked });
    input.addEventListener('change', () => action(input.checked));
    return el('label', { className: 'check' }, input, el('span', { textContent: label }));
  };
  const select = (options, value, action) => {
    const input = el('select');
    for (const [key, label] of options) input.append(el('option', { value: key, textContent: label }));
    input.value = String(value);
    input.addEventListener('change', () => action(input.value));
    return input;
  };
  const number = (target, key, min, max, optional = false) => {
    const input = el('input', { type: 'number', min, max, step: 1, value: target[key] ?? '', placeholder: optional ? 'Auto' : '' });
    input.addEventListener('input', () => {
      if (optional && input.value === '') delete target[key];
      else target[key] = input.value === '' ? null : Number(input.value);
      update();
    });
    return input;
  };
  const text = (target, key, label, hint, max = 200) => {
    const input = el('input', { type: 'text', value: target[key] ?? '', maxLength: max });
    input.addEventListener('input', () => {
      if (input.value) target[key] = input.value;
      else delete target[key];
      update();
    });
    return field(label, input, hint);
  };

  const form = el('div', { className: 'te-form' });
  const scene = el('img', { className: 'te-scene', alt: 'Your skyline in the scene' });
  const status = el('div', { className: 'status', role: 'status' });
  const json = el('textarea', { className: 'te-json', spellcheck: false, ariaLabel: 'Skyline JSON' });
  const canvas = el('canvas', {
    className: 'se-canvas', width: SCENE_W, height: GY0, tabIndex: 0,
    ariaLabel: 'Skyline canvas. Click a building to select it, drag to move, or use the left and right arrow keys.',
  });
  const list = el('div', { className: 'seg se-building-list', role: 'group', ariaLabel: 'Buildings' });
  const editor = el('div', { className: 'se-editor' });
  const themeSeg = el('div', { className: 'seg' });
  for (const theme of ['light', 'dark']) {
    const b = button(theme === 'light' ? 'Light' : 'Dark', () => {
      view.theme = theme;
      for (const node of themeSeg.children) node.setAttribute('aria-pressed', String(node === b));
      preview();
      drawCanvas();
      grid?.refresh();
    });
    b.setAttribute('aria-pressed', String(theme === view.theme));
    themeSeg.append(b);
  }

  const flash = (b, message) => {
    const original = b.textContent;
    b.textContent = message;
    setTimeout(() => { b.textContent = original; }, 1600);
  };
  const copy = async (value, b, message = 'Copied!') => {
    try {
      await navigator.clipboard.writeText(value);
      flash(b, message);
    } catch {
      json.parentElement.open = true;
      json.focus();
      json.select();
      flash(b, 'Select and copy it');
    }
  };
  const outButtons = el('div', { className: 'btns' },
    button('Copy share link', async (b) => {
      try {
        const hash = await encodeShare('skyline', json.value);
        history.replaceState(null, '', hash);
        await copy(location.href, b, 'Link copied!');
      } catch (err) {
        showErrors([err.message]);
      }
    }, 'main'),
    button('Copy JSON', (b) => copy(json.value, b)),
    button('Download skyline.json', () => {
      const url = URL.createObjectURL(new Blob([json.value], { type: 'application/json' }));
      const link = el('a', { download: 'skyline.json', href: url });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }),
    button('Open in the playground', (b) => {
      try { localStorage.setItem('git-trains:skyline', json.value); }
      catch { flash(b, 'Browser storage is unavailable'); return; }
      window.open('../preview/#yours', '_blank', 'noopener');
    }),
  );
  const side = el('div', { className: 'te-preview' },
    el('div', { className: 'stage' }, scene),
    el('div', { className: 'te-controls' }, field('Theme', themeSeg)),
    status, outButtons,
    el('details', { className: 'te-jsonbox' }, el('summary', { textContent: 'JSON (edit it directly if you like)' }), json),
  );
  const guideControls = el('div', { className: 'inline' });
  for (const [key, label] of [['train', 'Train band'], ['sign', 'Station sign'], ['sun', 'Sun or moon']]) {
    guideControls.append(check(label, view[key], (value) => { view[key] = value; drawCanvas(); }));
  }
  // Zoom: "auto" fits the canvas to its column unless that makes scene pixels
  // smaller than 1.5 screen pixels (phones, narrow columns); then it shows 2×
  // and the canvas scrolls sideways. A button the user picks wins over auto.
  const wrap = el('div', { className: 'zoomwrap se-wrap' }, canvas);
  const zoomSeg = el('div', { className: 'seg', role: 'group', ariaLabel: 'Zoom' });
  const zoomOptions = [['fit', 'Fit'], [2, '2×'], [3, '3×'], [4, '4×']];
  for (const [value, label] of zoomOptions) {
    zoomSeg.append(button(label, () => { zoom = value; applyZoom(); revealSelected(); }));
  }
  const { applyZoom, revealSelected, refreshCanvas, drawCanvas, point, pick } = createSkylineCanvas({
    get wrap() { return wrap; },
    get zoom() { return zoom; },
    set zoom(value) { zoom = value; },
    get canvas() { return canvas; },
    get zoomOptions() { return zoomOptions; },
    get zoomSeg() { return zoomSeg; },
    get bounds() { return bounds; },
    set bounds(value) { bounds = value; },
    get selected() { return selected; },
    set selected(value) { selected = value; },
    get canvasIndices() { return canvasIndices; },
    set canvasIndices(value) { canvasIndices = value; },
    get errors() { return errors; },
    set errors(value) { errors = value; },
    get canvasSky() { return canvasSky; },
    set canvasSky(value) { canvasSky = value; },
    get parsed() { return parsed; },
    set parsed(value) { parsed = value; },
    get buildings() { return buildings; },
    get draft() { return draft; },
    set draft(value) { draft = value; },
    get hits() { return hits; },
    set hits(value) { hits = value; },
    get view() { return view; },
    get stats() { return stats; },
    get root() { return root; },
  });

  if (typeof ResizeObserver === 'function') new ResizeObserver(() => applyZoom()).observe(wrap);
  applyZoom();
  const workSection = section('The scene',
    el('p', { className: 'hint', textContent: '448 × 88 pixels. Click a building to select it; drag left or right to move it. Arrow keys move one pixel (Shift: ten). When zoomed in, drag the empty sky to scroll. The train covers rows 63–88.' }),
    wrap,
    el('div', { className: 'se-tools' }, field('Zoom', zoomSeg), guideControls),
  );
  const addBlock = button('Add block', () => addBuilding({ x: nextX(), w: 16, h: 40, layer: 'near' }));
  const addDrawing = button('Add drawing', () => addBuilding({ x: nextX(), layer: 'near', rows: Array(40).fill('#'.repeat(12)) }));
  const duplicate = button('Duplicate', () => {
    if (!object(buildings()[selected])) return;
    const next = clone(buildings()[selected]);
    next.x = clamp((Number.isInteger(next.x) ? next.x : 100) + 16, -40, 447);
    addBuilding(next);
  });
  const remove = button('Delete', () => {
    buildings().splice(selected, 1);
    selected = Math.min(selected, buildings().length - 1);
    update();
    renderBuilding();
  });
  const buildingsSection = section('Buildings', list, el('div', { className: 'btns' }, addBlock, addDrawing, duplicate, remove), editor);
  root.replaceChildren(el('div', { className: 'te' }, form, side));
  const { renderForm, nextX, addBuilding, renderList, renderBuilding } = createSkylineFields({
    get button() { return button; },
    get revision() { return revision; },
    set revision(value) { revision = value; },
    get load() { return load; },
    get showErrors() { return showErrors; },
    get draft() { return draft; },
    set draft(value) { draft = value; },
    get text() { return text; },
    get check() { return check; },
    get update() { return update; },
    get form() { return form; },
    get workSection() { return workSection; },
    get buildingsSection() { return buildingsSection; },
    get buildings() { return buildings; },
    get selected() { return selected; },
    set selected(value) { selected = value; },
    get revealSelected() { return revealSelected; },
    get list() { return list; },
    get drawCanvas() { return drawCanvas; },
    get addBlock() { return addBlock; },
    get addDrawing() { return addDrawing; },
    get duplicate() { return duplicate; },
    get remove() { return remove; },
    get grid() { return grid; },
    set grid(value) { grid = value; },
    get xInput() { return xInput; },
    set xInput(value) { xInput = value; },
    get editor() { return editor; },
    get number() { return number; },
    get select() { return select; },
    get view() { return view; },
  });


  function showErrors(messages) {
    status.className = 'status bad';
    status.replaceChildren(
      el('span', { textContent: `${messages.length} problem(s)${parsed !== undefined ? ' (the preview shows the last valid version)' : ''}:` }),
      el('ul', {}, ...messages.map((message) => el('li', { textContent: message }))),
    );
  }

  function update({ keepJson = false } = {}) {
    revision++;
    try { parsed = parseSkyline(draft); errors = []; }
    catch (err) { errors = err.errors ?? [err.message]; }
    if (!keepJson) json.value = formatSkyline(draft);
    save(json.value);
    if (errors.length) showErrors(errors);
    else {
      status.className = 'status ok';
      status.textContent = `✓ ${parsed?.name ?? 'Procedural city'}: valid, ready for your profile.`;
    }
    renderList();
    refreshCanvas();
    preview();
  }

  function preview() {
    if (parsed === undefined) return;
    const svg = renderScene(buildSpec(sampleStats(), { skyline: parsed, theme: view.theme }));
    if (sceneUrl) URL.revokeObjectURL(sceneUrl);
    sceneUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    scene.src = sceneUrl;
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag) return;
    const [x, y] = point(event);
    const hit = pick(x, y);
    if (!hit) {
      // Empty sky: pan the zoomed canvas instead.
      if (wrap.scrollWidth <= wrap.clientWidth) return;
      event.preventDefault();
      drag = { id: event.pointerId, pan: true, clientX: event.clientX, scroll: wrap.scrollLeft };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    event.preventDefault();
    selected = hit - 1;
    drag = { id: event.pointerId, x, start: buildings()[selected].x };
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
    renderList();
    renderBuilding();
    drawCanvas();
  });
  function moveBuilding(x) {
    const building = buildings()[selected];
    if (!object(building) || building.x === x) return;
    building.x = x;
    if (xInput) xInput.value = x;
    update();
  }
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    if (drag.pan) { wrap.scrollLeft = drag.scroll - (event.clientX - drag.clientX); return; }
    const [x] = point(event);
    moveBuilding(clamp(drag.start + x - drag.x, -40, 447));
  });
  const stopDrag = (event) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('lostpointercapture', stopDrag);
  canvas.addEventListener('keydown', (event) => {
    const building = buildings()[selected];
    if (!Number.isInteger(building?.x) || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    moveBuilding(clamp(building.x + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 10 : 1), -40, 447));
    revealSelected();
  });

  function load(text) {
    revision++;
    drag = null;
    json.value = text;
    save(text);
    try { draft = JSON.parse(text); }
    catch {
      status.className = 'status bad';
      status.textContent = 'The JSON has a syntax error; the form shows the last version that parsed.';
      return;
    }
    selected = Math.min(Math.max(0, selected), buildings().length - 1);
    update({ keepJson: true });
    renderForm();
  }
  json.addEventListener('input', () => load(json.value));
  let saved = initialText;
  if (saved === undefined) { try { saved = localStorage.getItem(STORE); } catch {} }
  if (saved != null) {
    // Build usable controls even when a saved draft has unfinished JSON.
    renderForm();
    load(saved);
  } else {
    update();
    renderForm();
  }
  return { load };
}
