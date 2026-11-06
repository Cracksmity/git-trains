// Editor presentation methods. Session state is provided through the explicit editor context.
import { clone, object, clamp, el, field, section } from '../dom.js';
import { SKYLINES } from '../../landscape/skyline-parse.js';
import { THEMES } from '../../scene/themes.js';
import { createPixelGrid } from '../pixel-grid.js';
import { formatSkyline } from './format.js';
const EXAMPLES = { 'mexico-city': 'Mexico City', medellin: 'Medellín' };
const TOPS = ['flat', 'stepped', 'spire', 'antenna', 'dome', 'pyramid'];
/** @param {Record<string, any>} editor */
export function createSkylineFields(editor) {

  function startSection() {
    const pick = el('select', { ariaLabel: 'Starting skyline' });
    const catalog = el('optgroup', { label: 'Catalog' });
    for (const [id, sky] of Object.entries(SKYLINES)) catalog.append(el('option', { value: `m:${id}`, textContent: sky.name }));
    const examples = el('optgroup', { label: 'Examples' });
    for (const [id, label] of Object.entries(EXAMPLES)) examples.append(el('option', { value: `e:${id}`, textContent: label }));
    pick.append(catalog, examples, el('option', { value: 'blank', textContent: 'Blank' }));
    return section('Start from', el('div', { className: 'inline' }, pick, editor.button('Start from this', async (b) => {
      const requestRevision = editor.revision;
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
        if (editor.revision === requestRevision) editor.load(formatSkyline(next));
      } catch (err) { editor.showErrors([err.message]); }
      finally { b.disabled = false; }
    })), el('p', { className: 'hint', textContent: 'Loads a skyline to change. Your current one is replaced (the share link and the JSON keep copies).' }));
  }

  function renderForm() {
    const nameSection = object(editor.draft) ? section('Name',
      editor.text(editor.draft, 'name', 'Name', null, 40),
      editor.text(editor.draft, 'description', 'Description', 'which city or landmarks inspired it; it is not drawn'),
      editor.text(editor.draft, 'author', 'Author', 'your GitHub username'),
      editor.check('Fill the gaps with the procedural city', editor.draft.fill ?? true, (value) => { editor.draft.fill = value; editor.update(); }),
    ) : section('Name', el('p', { className: 'hint', textContent: 'Choose a starting skyline or enter a JSON object to edit its fields.' }));
    editor.form.replaceChildren(startSection(), nameSection, editor.workSection, editor.buildingsSection);
    renderList();
    renderBuilding();
  }

  function nextX() {
    const current = editor.buildings()[editor.selected];
    return clamp((Number.isInteger(current?.x) ? current.x + 24 : 100), -40, 447);
  }

  function addBuilding(building) {
    if (!object(editor.draft) || editor.buildings().length >= 120) return;
    if (!Array.isArray(editor.draft.buildings)) editor.draft.buildings = [];
    editor.draft.buildings.push(building);
    editor.selected = editor.draft.buildings.length - 1;
    editor.update();
    renderBuilding();
    editor.revealSelected();
  }

  function renderList() {
    const items = editor.buildings();
    editor.list.replaceChildren(...items.map((b, index) => {
      const label = typeof b?.name === 'string' && b.name ? b.name : `Building ${index + 1}`;
      const node = editor.button(`${index + 1}. ${label} · ${b?.rows !== undefined ? 'drawing' : 'block'} · ${b?.layer ?? 'near'} · x ${b?.x ?? '?'}`, () => {
        editor.selected = index;
        renderList();
        renderBuilding();
        editor.drawCanvas();
        editor.revealSelected();
      });
      node.setAttribute('aria-pressed', String(index === editor.selected));
      return node;
    }));
    editor.addBlock.disabled = editor.addDrawing.disabled = !object(editor.draft) || items.length >= 120;
    editor.duplicate.disabled = !object(items[editor.selected]) || items.length >= 120;
    editor.remove.disabled = editor.selected < 0 || editor.selected >= items.length;
  }

  function renderBuilding() {
    editor.grid = null;
    editor.xInput = null;
    editor.editor.replaceChildren();
    const b = editor.buildings()[editor.selected];
    if (!object(b)) {
      editor.editor.append(el('p', { className: 'hint', textContent: editor.buildings().length ? 'Select a building, or fix its JSON to edit it here.' : 'Add a block or drawing to start your skyline.' }));
      return;
    }
    editor.xInput = editor.number(b, 'x', -40, 447);
    const layer = editor.select([['near', 'Near'], ['far', 'Far']], b.layer ?? 'near', (value) => { b.layer = value; editor.update(); editor.grid?.refresh(); });
    editor.editor.append(editor.text(b, 'name', 'Building name', 'a note for you; not drawn'),
      el('div', { className: 'grid2' }, field('Left column (x)', editor.xInput), field('Layer', layer)),
    );
    if (b.rows !== undefined) renderDrawing(b);
    else {
      editor.editor.append(el('div', { className: 'grid2' },
        field('Width (w)', editor.number(b, 'w', 2, 200)),
        field('Body height (h)', editor.number(b, 'h', 2, 84), 'Excludes the stacked tops.'),
      ), field('Windows', editor.select([['auto', 'Auto (near layer only)'], ['true', 'On'], ['false', 'Off']], b.windows === undefined ? 'auto' : String(b.windows), (value) => {
        if (value === 'auto') delete b.windows;
        else b.windows = value === 'true';
        editor.update();
      })));
      renderTops(b);
    }
  }

  function renderTops(b) {
    const tops = b.top === undefined ? [] : Array.isArray(b.top) ? b.top : [b.top];
    const host = el('div');
    const commit = () => { b.top = tops; editor.update(); renderBuilding(); };
    host.append(el('p', { className: 'hint', textContent: 'Up to four tops, stacked from the body upward. Empty options use the renderer’s defaults.' }));
    tops.forEach((raw, index) => {
      const top = typeof raw === 'string' ? { type: raw } : object(raw) ? { ...raw } : {};
      const controls = el('div', { className: 'grid2' }, field(`Top ${index + 1}`, editor.select(TOPS.map((type) => [type, type]), top.type ?? '', (type) => {
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
          editor.update();
        });
        return field(label, input);
      };
      if (top.type !== 'flat') controls.append(option('h', top.type === 'stepped' ? 'Height per step' : 'Top height', 1, 40));
      if (top.type === 'stepped') controls.append(option('steps', 'Steps', 1, 4));
      if (top.type === 'pyramid') controls.append(option('tip', 'Tip width', 1, 20));
      const up = editor.button('Move down', () => { [tops[index - 1], tops[index]] = [tops[index], tops[index - 1]]; commit(); });
      const down = editor.button('Move up', () => { [tops[index + 1], tops[index]] = [tops[index], tops[index + 1]]; commit(); });
      up.disabled = index === 0;
      down.disabled = index === tops.length - 1;
      host.append(el('div', { className: 'se-top' }, controls, el('div', { className: 'btns' }, up, down,
        editor.button('Remove top', () => { tops.splice(index, 1); commit(); }),
      )));
    });
    const add = editor.button('Add top', () => { tops.push({ type: 'flat' }); commit(); });
    add.disabled = tops.length >= 4;
    host.append(el('div', { className: 'btns' }, add));
    editor.editor.append(host);
  }

  function renderDrawing(b) {
    // Malformed JSON must remain editable and report the validator's errors,
    // rather than crashing the pixel grid or silently repairing the draft.
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 84 || !b.rows.every((row) => typeof row === 'string' && row.length <= 200)) {
      editor.editor.append(el('p', { className: 'hint', textContent: 'Fix the drawing rows in JSON to open the pixel grid.' }));
      return;
    }
    const width = Math.max(1, ...b.rows.map((row) => row.length));
    const widthInput = el('input', { type: 'number', min: 1, max: 200, step: 1, value: width });
    const heightInput = el('input', { type: 'number', min: 1, max: 84, step: 1, value: b.rows.length });
    widthInput.addEventListener('change', () => {
      const w = Number(widthInput.value);
      if (Number.isInteger(w) && w >= 1 && w <= 200) editor.grid.setWidth(w);
      else widthInput.value = Math.max(1, ...editor.grid.getRows().map((row) => row.length));
    });
    heightInput.addEventListener('change', () => {
      const h = Number(heightInput.value);
      if (!Number.isInteger(h) || h < 1 || h > 84) { heightInput.value = b.rows.length; return; }
      const rows = editor.grid.getRows();
      const w = rows[0].length;
      // Keep the drawing grounded when adding or removing rows.
      b.rows = h > rows.length ? [...Array(h - rows.length).fill('.'.repeat(w)), ...rows] : rows.slice(-h);
      editor.grid.setRows(b.rows);
      editor.update();
    });
    const host = el('div');
    editor.editor.append(el('p', { className: 'hint', textContent: 'Draw # for the building and w for a window; erase to leave empty pixels. The last row touches the ground.' }),
      el('div', { className: 'grid2' }, field('Drawing width', widthInput), field('Drawing height', heightInput)), host,
    );
    editor.grid = createPixelGrid(host, {
      rows: b.rows.map((row) => row.padEnd(width, '.')),
      symbols: [{ sym: '#', label: 'building' }, { sym: 'w', label: 'window' }],
      colorOf: (symbol) => {
        const palette = THEMES[editor.view.theme];
        return symbol === 'w' ? palette.cityWin : b.layer === 'far' ? palette.city2 : palette.city;
      },
      onChange: (rows) => {
        b.rows = rows;
        widthInput.value = Math.max(1, ...rows.map((row) => row.length));
        heightInput.value = rows.length;
        editor.update();
      },
    });
  }
  return { startSection, renderForm, nextX, addBuilding, renderList, renderBuilding, renderTops, renderDrawing };
}
