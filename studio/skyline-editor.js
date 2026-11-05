// The studio's skyline editor shares the train editor's controls, validator
// status, pixel grid and scene renderer. Importing it needs no browser globals.
import { SKYLINES, parseSkyline, paintSkyline } from '../src/skyline.js';
import { Grid } from '../src/pixel.js';
import { THEMES, SCENE_W, GY0, paintSky, paintBackdrop, celestialGrid } from '../src/scenery.js';
import { renderScene } from '../src/scene.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats } from '../src/sample.js';
import { createPixelGrid } from './pixel-grid.js';
import { encodeShare } from './share.js';

const STORE = 'git-trains:studio-skyline';
const TOPS = ['flat', 'stepped', 'spire', 'antenna', 'dome', 'pyramid'];
const EXAMPLES = { 'mexico-city': 'Mexico City', medellin: 'Medellín' };
const clone = (value) => JSON.parse(JSON.stringify(value));
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
};
const field = (label, input, hint) => el('label', { className: 'field' }, el('span', { textContent: label }), input, hint ? el('small', { textContent: hint }) : null);
const section = (title, ...kids) => el('section', { className: 'panel' }, el('h3', { textContent: title }), ...kids);

// Keep drawings one row per line and short numeric lists on a single line.
export function formatSkyline(skyline) {
  return JSON.stringify(skyline, null, 2).replace(
    /\[\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?(?:,\s+-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)*)\s+\]/gi,
    (match, numbers) => {
      const compact = `[${numbers.split(/,\s*/).join(', ')}]`;
      return compact.length <= 80 ? compact : match;
    },
  );
}

function installStyles() {
  if (document.getElementById('skyline-editor-style')) return;
  document.head.append(el('style', {
    id: 'skyline-editor-style',
    textContent: `
      .se-canvas { display: block; width: 100%; height: auto; image-rendering: pixelated; touch-action: none; cursor: grab; }
      .se-canvas:active { cursor: grabbing; }
      .se-building-list.seg { display: grid; max-height: 220px; overflow-y: auto; }
      .se-building-list button { text-align: left; overflow-wrap: anywhere; }
      .se-top { border: 1px solid var(--line); border-radius: 8px; padding: 10px; margin: 8px 0; background: var(--surface); }
      .se-editor { border-top: 1px solid var(--line); padding-top: 12px; }
      .te button:disabled { opacity: .5; cursor: default; }
    `,
  }));
}

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
  const workSection = section('The scene',
    el('p', { className: 'hint', textContent: '448 × 88 pixels. Click a building to select it; drag left or right to move it. Arrow keys move one pixel (Shift: ten). The train covers rows 63–88.' }),
    el('div', { className: 'zoomwrap' }, canvas), guideControls,
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

  function startSection() {
    const pick = el('select', { ariaLabel: 'Starting skyline' });
    const catalog = el('optgroup', { label: 'Catalog' });
    for (const [id, sky] of Object.entries(SKYLINES)) catalog.append(el('option', { value: `m:${id}`, textContent: sky.name }));
    const examples = el('optgroup', { label: 'Examples' });
    for (const [id, label] of Object.entries(EXAMPLES)) examples.append(el('option', { value: `e:${id}`, textContent: label }));
    pick.append(catalog, examples, el('option', { value: 'blank', textContent: 'Blank' }));
    return section('Start from', el('div', { className: 'inline' }, pick, button('Start from this', async (b) => {
      const requestRevision = revision;
      b.disabled = true;
      try {
        let next;
        if (pick.value === 'blank') next = { name: 'My skyline', fill: false, buildings: [] };
        else {
          const [kind, id] = pick.value.split(':');
          if (kind === 'm') next = clone(SKYLINES[id]);
          else {
            const response = await fetch(`../examples/skylines/${id}.json`);
            if (!response.ok) throw new Error(`Could not load the example (${response.status}).`);
            next = await response.json();
          }
        }
        // Do not overwrite edits made while an example was downloading.
        if (revision === requestRevision) load(formatSkyline(next));
      } catch (err) { showErrors([err.message]); }
      finally { b.disabled = false; }
    })), el('p', { className: 'hint', textContent: 'Loads a skyline to change. Your current one is replaced (the share link and the JSON keep copies).' }));
  }

  function renderForm() {
    const nameSection = object(draft) ? section('Name',
      text(draft, 'name', 'Name', null, 40),
      text(draft, 'description', 'Description', 'which city or landmarks inspired it; it is not drawn'),
      text(draft, 'author', 'Author', 'your GitHub username'),
      check('Fill the gaps with the procedural city', draft.fill ?? true, (value) => { draft.fill = value; update(); }),
    ) : section('Name', el('p', { className: 'hint', textContent: 'Choose a starting skyline or enter a JSON object to edit its fields.' }));
    form.replaceChildren(startSection(), nameSection, workSection, buildingsSection);
    renderList();
    renderBuilding();
  }

  function nextX() {
    const current = buildings()[selected];
    return clamp((Number.isInteger(current?.x) ? current.x + 24 : 100), -40, 447);
  }

  function addBuilding(building) {
    if (!object(draft) || buildings().length >= 120) return;
    if (!Array.isArray(draft.buildings)) draft.buildings = [];
    draft.buildings.push(building);
    selected = draft.buildings.length - 1;
    update();
    renderBuilding();
  }

  function renderList() {
    const items = buildings();
    list.replaceChildren(...items.map((b, index) => {
      const label = typeof b?.name === 'string' && b.name ? b.name : `Building ${index + 1}`;
      const node = button(`${index + 1}. ${label} · ${b?.rows !== undefined ? 'drawing' : 'block'} · ${b?.layer ?? 'near'} · x ${b?.x ?? '?'}`, () => {
        selected = index;
        renderList();
        renderBuilding();
        drawCanvas();
      });
      node.setAttribute('aria-pressed', String(index === selected));
      return node;
    }));
    addBlock.disabled = addDrawing.disabled = !object(draft) || items.length >= 120;
    duplicate.disabled = !object(items[selected]) || items.length >= 120;
    remove.disabled = selected < 0 || selected >= items.length;
  }

  function renderBuilding() {
    grid = null;
    xInput = null;
    editor.replaceChildren();
    const b = buildings()[selected];
    if (!object(b)) {
      editor.append(el('p', { className: 'hint', textContent: buildings().length ? 'Select a building, or fix its JSON to edit it here.' : 'Add a block or drawing to start your skyline.' }));
      return;
    }
    xInput = number(b, 'x', -40, 447);
    const layer = select([['near', 'Near'], ['far', 'Far']], b.layer ?? 'near', (value) => { b.layer = value; update(); grid?.refresh(); });
    editor.append(text(b, 'name', 'Building name', 'a note for you; not drawn'),
      el('div', { className: 'grid2' }, field('Left column (x)', xInput), field('Layer', layer)),
    );
    if (b.rows !== undefined) renderDrawing(b);
    else {
      editor.append(el('div', { className: 'grid2' },
        field('Width (w)', number(b, 'w', 2, 200)),
        field('Body height (h)', number(b, 'h', 2, 84), 'Excludes the stacked tops.'),
      ), field('Windows', select([['auto', 'Auto (near layer only)'], ['true', 'On'], ['false', 'Off']], b.windows === undefined ? 'auto' : String(b.windows), (value) => {
        if (value === 'auto') delete b.windows;
        else b.windows = value === 'true';
        update();
      })));
      renderTops(b);
    }
  }

  function renderTops(b) {
    const tops = b.top === undefined ? [] : Array.isArray(b.top) ? b.top : [b.top];
    const host = el('div');
    const commit = () => { b.top = tops; update(); renderBuilding(); };
    host.append(el('p', { className: 'hint', textContent: 'Up to four tops, stacked from the body upward. Empty options use the renderer’s defaults.' }));
    tops.forEach((raw, index) => {
      const top = typeof raw === 'string' ? { type: raw } : object(raw) ? { ...raw } : {};
      const controls = el('div', { className: 'grid2' }, field(`Top ${index + 1}`, select(TOPS.map((type) => [type, type]), top.type ?? '', (type) => {
        tops[index] = { type };
        if (type !== 'flat' && top.h !== undefined) tops[index].h = top.h;
        commit();
      })));
      // Editing a shorthand top expands just that top, without changing others.
      const option = (key, label, min, max) => {
        const input = el('input', { type: 'number', min, max, step: 1, value: top[key] ?? '', placeholder: 'Auto' });
        input.addEventListener('input', () => {
          if (input.value === '') delete top[key];
          else top[key] = Number(input.value);
          tops[index] = top;
          b.top = tops;
          update();
        });
        return field(label, input);
      };
      if (top.type !== 'flat') controls.append(option('h', top.type === 'stepped' ? 'Height per step' : 'Top height', 1, 40));
      if (top.type === 'stepped') controls.append(option('steps', 'Steps', 1, 4));
      if (top.type === 'pyramid') controls.append(option('tip', 'Tip width', 1, 20));
      const up = button('Move down', () => { [tops[index - 1], tops[index]] = [tops[index], tops[index - 1]]; commit(); });
      const down = button('Move up', () => { [tops[index + 1], tops[index]] = [tops[index], tops[index + 1]]; commit(); });
      up.disabled = index === 0;
      down.disabled = index === tops.length - 1;
      host.append(el('div', { className: 'se-top' }, controls, el('div', { className: 'btns' }, up, down,
        button('Remove top', () => { tops.splice(index, 1); commit(); }),
      )));
    });
    const add = button('Add top', () => { tops.push({ type: 'flat' }); commit(); });
    add.disabled = tops.length >= 4;
    host.append(el('div', { className: 'btns' }, add));
    editor.append(host);
  }

  function renderDrawing(b) {
    // Malformed JSON must remain editable and report the validator's errors,
    // rather than crashing the pixel grid or silently repairing the draft.
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 84 || !b.rows.every((row) => typeof row === 'string' && row.length <= 200)) {
      editor.append(el('p', { className: 'hint', textContent: 'Fix the drawing rows in JSON to open the pixel grid.' }));
      return;
    }
    const width = Math.max(1, ...b.rows.map((row) => row.length));
    const widthInput = el('input', { type: 'number', min: 1, max: 200, step: 1, value: width });
    const heightInput = el('input', { type: 'number', min: 1, max: 84, step: 1, value: b.rows.length });
    widthInput.addEventListener('change', () => {
      const w = Number(widthInput.value);
      if (Number.isInteger(w) && w >= 1 && w <= 200) grid.setWidth(w);
      else widthInput.value = Math.max(1, ...grid.getRows().map((row) => row.length));
    });
    heightInput.addEventListener('change', () => {
      const h = Number(heightInput.value);
      if (!Number.isInteger(h) || h < 1 || h > 84) { heightInput.value = b.rows.length; return; }
      const rows = grid.getRows();
      const w = rows[0].length;
      // Keep the drawing grounded when adding or removing rows.
      b.rows = h > rows.length ? [...Array(h - rows.length).fill('.'.repeat(w)), ...rows] : rows.slice(-h);
      grid.setRows(b.rows);
      update();
    });
    const host = el('div');
    editor.append(el('p', { className: 'hint', textContent: 'Draw # for the building and w for a window; erase to leave empty pixels. The last row touches the ground.' }),
      el('div', { className: 'grid2' }, field('Drawing width', widthInput), field('Drawing height', heightInput)), host,
    );
    grid = createPixelGrid(host, {
      rows: b.rows.map((row) => row.padEnd(width, '.')),
      symbols: [{ sym: '#', label: 'building' }, { sym: 'w', label: 'window' }],
      colorOf: (symbol) => {
        const palette = THEMES[view.theme];
        return symbol === 'w' ? palette.cityWin : b.layer === 'far' ? palette.city2 : palette.city;
      },
      onChange: (rows) => {
        b.rows = rows;
        widthInput.value = Math.max(1, ...rows.map((row) => row.length));
        heightInput.value = rows.length;
        update();
      },
    });
  }

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

  function refreshCanvas() {
    canvasIndices = [];
    if (!errors.length) {
      canvasSky = parsed;
      canvasIndices = parsed?.buildings.map((_, index) => index) ?? [];
    } else {
      // Keep the working canvas useful while a building is incomplete, including
      // the empty Blank draft. Only the SVG keeps the last fully valid skyline.
      const valid = [];
      buildings().forEach((building, index) => {
        try {
          valid.push(parseSkyline({ buildings: [building] }).buildings[0]);
          canvasIndices.push(index);
        } catch {}
      });
      canvasSky = { fill: draft?.fill === true, buildings: valid };
    }
    hits = new Grid(SCENE_W, GY0);
    bounds = [];
    // Paint the same silhouettes into a picking buffer: near buildings win,
    // holes remain clickable, and every top uses the production geometry.
    for (const layer of ['far', 'near']) {
      canvasSky?.buildings.forEach((building, i) => {
        if (building.layer !== layer) return;
        const index = canvasIndices[i];
        const box = { left: SCENE_W, right: -1, top: GY0, bottom: -1 };
        const painter = {
          set(x, y) {
            if (!hits.inside(x, y)) return;
            hits.set(x, y, index + 1);
            box.left = Math.min(box.left, x); box.right = Math.max(box.right, x);
            box.top = Math.min(box.top, y); box.bottom = Math.max(box.bottom, y);
          },
          rect(x, y, w, h) {
            for (let row = Math.max(0, y); row < Math.min(GY0, y + h); row++) {
              for (let col = Math.max(0, x); col < Math.min(SCENE_W, x + w); col++) this.set(col, row);
            }
          },
        };
        paintSkyline(painter, { buildings: [building] }, GY0, layer);
        if (box.right >= box.left) bounds[index] = box;
      });
    }
    drawCanvas();
  }

  function drawCanvas() {
    const ctx = canvas.getContext('2d');
    const palette = THEMES[view.theme];
    ctx.clearRect(0, 0, SCENE_W, GY0);
    const paint = (pixels) => {
      for (let y = 0; y < pixels.h; y++) {
        for (let x = 0; x < pixels.w; x++) {
          const color = pixels.get(x, y);
          if (!color) continue;
          ctx.fillStyle = color.startsWith('@') ? palette[color.slice(1)] : color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    };
    const sky = new Grid(SCENE_W, GY0);
    paintSky(sky);
    paint(sky);
    paint(celestialGrid(SCENE_W));
    paint(paintBackdrop(SCENE_W, GY0, [], stats.user, canvasSky));
    const style = getComputedStyle(root);
    const guide = (x, y, w, h, color) => {
      ctx.save();
      ctx.fillStyle = ctx.strokeStyle = color;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 0.8;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.restore();
    };
    const guideColor = style.getPropertyValue('--muted').trim() || palette.text;
    if (view.train) guide(0, 63, SCENE_W, 25, guideColor);
    if (view.sign) guide(10, 10, 80, 14, guideColor);
    if (view.sun) guide(382, 10, 20, 20, guideColor);
    const box = bounds[selected];
    if (box) {
      ctx.strokeStyle = style.getPropertyValue('--green').trim() || palette.text;
      ctx.lineWidth = 1;
      ctx.strokeRect(box.left + 0.5, box.top + 0.5, Math.max(1, box.right - box.left), Math.max(1, box.bottom - box.top));
    }
  }

  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return [Math.floor((event.clientX - rect.left) * SCENE_W / rect.width), Math.floor((event.clientY - rect.top) * GY0 / rect.height)];
  };
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag) return;
    const [x, y] = point(event);
    const hit = hits.get(x, y);
    if (!hit || !object(buildings()[hit - 1])) return;
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
