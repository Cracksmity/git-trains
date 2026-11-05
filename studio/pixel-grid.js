// A pixel-art grid editor for the studio: rows of one-character symbols ("."
// is empty), painted on a canvas. Pencil, eraser, fill and picker; undo/redo;
// and a photo to trace underneath, which stays in the browser.
//
//   const grid = createPixelGrid(container, { rows, symbols, colorOf, onChange })
//   grid.setRows(rows)   grid.setWidth(w)   grid.refresh()   grid.undo()   grid.redo()

const MAX_CELL = 18;
const MIN_CELL = 6;
const UNDO_LIMIT = 100;

const el = (tag, { dataset, ...props } = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  if (dataset) Object.assign(n.dataset, dataset);
  for (const k of kids) n.append(k);
  return n;
};

// opts.symbols: [{ sym, label }], the palette. opts.colorOf(sym, row): CSS color.
// opts.bands: [{ from, to, label }] row ranges marked in the gutter.
// opts.overlay(ctx, cell): extra drawing on top (wheels, chimney...).
// opts.onChange(rows): after every edit.
export function createPixelGrid(container, opts) {
  let rows = opts.rows.map(String);
  let symbol = opts.symbols[0].sym;
  let tool = 'pencil';
  let cell = MAX_CELL;
  const undo = [];
  const redo = [];
  const trace = { img: null, opacity: 0.45, scale: 1, x: 0, y: 0, flip: false };

  const width = () => Math.max(1, ...rows.map((r) => r.length));
  const height = () => rows.length;

  // --- DOM
  const palette = el('div', { className: 'pg-palette', role: 'radiogroup', ariaLabel: 'Symbols' });
  const tools = el('div', { className: 'pg-tools seg' });
  for (const [id, label, title] of [
    ['pencil', 'Draw', 'Draw with the selected symbol (right click erases)'],
    ['eraser', 'Erase', 'Erase pixels'],
    ['fill', 'Fill', 'Fill the touching area of the same symbol'],
    ['pick', 'Pick', 'Pick a symbol from the grid'],
  ]) {
    tools.append(el('button', { type: 'button', textContent: label, title, dataset: { tool: id } }));
  }
  const undoBtn = el('button', { type: 'button', textContent: 'Undo', title: 'Undo (Ctrl+Z)' });
  const redoBtn = el('button', { type: 'button', textContent: 'Redo', title: 'Redo (Ctrl+Y)' });
  tools.append(undoBtn, redoBtn);

  const canvas = el('canvas', { className: 'pg-canvas', tabIndex: 0 });
  const wrap = el('div', { className: 'pg-wrap' }, canvas);
  const legend = el('div', { className: 'pg-legend' });

  // Tracing controls.
  const file = el('input', { type: 'file', accept: 'image/*', className: 'pg-file' });
  const range = (label, min, max, step, value, key) => {
    const input = el('input', { type: 'range', min, max, step, value });
    input.addEventListener('input', () => {
      trace[key] = Number(input.value);
      draw();
    });
    return el('label', { className: 'pg-range' }, el('span', { textContent: label }), input);
  };
  const flip = el('input', { type: 'checkbox' });
  flip.addEventListener('change', () => {
    trace.flip = flip.checked;
    draw();
  });
  const clearTrace = el('button', { type: 'button', textContent: 'Remove photo' });
  const traceBox = el(
    'details',
    { className: 'pg-trace' },
    el('summary', { textContent: 'Trace a photo' }),
    el('p', { className: 'hint', textContent: 'The photo stays in your browser and is never saved: only the pixels you draw are.' }),
    file,
    range('Opacity', 0.05, 1, 0.05, trace.opacity, 'opacity'),
    range('Size', 0.1, 4, 0.05, trace.scale, 'scale'),
    range('Left/right', -60, 60, 1, trace.x, 'x'),
    range('Up/down', -40, 40, 1, trace.y, 'y'),
    el('label', { className: 'pg-check' }, flip, el('span', { textContent: 'Mirror the photo (for trains facing left)' })),
    clearTrace,
  );
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      trace.img = img;
      // Fit the photo's height to the grid at first.
      trace.scale = +(height() / img.height).toFixed(3);
      traceBox.querySelectorAll('input[type=range]')[1].value = Math.min(4, Math.max(0.1, trace.scale));
      draw();
    };
    img.src = URL.createObjectURL(f);
  });
  clearTrace.addEventListener('click', () => {
    trace.img = null;
    file.value = '';
    draw();
  });

  container.append(el('div', { className: 'pg' }, tools, palette, wrap, legend, traceBox));

  // --- Palette
  function renderPalette() {
    palette.replaceChildren();
    for (const { sym, label } of opts.symbols) {
      const b = el('button', { type: 'button', className: 'pg-sym', title: `${sym}: ${label}`, ariaLabel: `${sym}: ${label}` });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(sym === symbol));
      const swatch = el('span', { className: 'pg-swatch' });
      swatch.style.background = opts.colorOf(sym, Math.floor(height() / 2)) ?? 'transparent';
      b.append(swatch, el('code', { textContent: sym }));
      b.addEventListener('click', () => {
        symbol = sym;
        if (tool === 'eraser' || tool === 'pick') setTool('pencil');
        renderPalette();
      });
      palette.append(b);
    }
  }

  function setTool(t) {
    tool = t;
    for (const b of tools.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === t));
  }
  tools.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (b) setTool(b.dataset.tool);
  });
  setTool('pencil');

  // --- Drawing
  function fit() {
    const avail = Math.max(120, wrap.clientWidth - 28);
    cell = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(avail / width())));
    canvas.width = width() * cell + 24;
    canvas.height = height() * cell;
  }

  function draw() {
    fit();
    const ctx = canvas.getContext('2d');
    const W = width();
    const H = height();
    const ox = 24; // gutter for the row bands
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Checkerboard for empty pixels.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#d9ddd8' : '#eef0ed';
        ctx.fillRect(ox + x * cell, y * cell, cell, cell);
      }
    }
    if (trace.img) {
      ctx.save();
      ctx.globalAlpha = trace.opacity;
      ctx.beginPath();
      ctx.rect(ox, 0, W * cell, H * cell);
      ctx.clip();
      const w = trace.img.width * trace.scale * cell;
      const h = trace.img.height * trace.scale * cell;
      const x = ox + trace.x * cell;
      const y = trace.y * cell;
      if (trace.flip) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(trace.img, 0, 0, w, h);
      } else ctx.drawImage(trace.img, x, y, w, h);
      ctx.restore();
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const s = rows[y][x] ?? '.';
        if (s === '.') continue;
        ctx.fillStyle = opts.colorOf(s, y) ?? '#ff00ff';
        ctx.fillRect(ox + x * cell, y * cell, cell, cell);
      }
    }
    // Light grid lines, darker every 5.
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x++) {
      ctx.strokeStyle = x % 5 ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.moveTo(ox + x * cell + 0.5, 0);
      ctx.lineTo(ox + x * cell + 0.5, H * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y++) {
      ctx.strokeStyle = y % 5 ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.moveTo(ox, y * cell + 0.5);
      ctx.lineTo(ox + W * cell, y * cell + 0.5);
      ctx.stroke();
    }
    // Row bands in the gutter.
    (opts.bands ?? []).forEach((b, i) => {
      ctx.fillStyle = ['#1b8638', '#c98f00', '#3178c6', '#a33a2c', '#59645d'][i % 5];
      ctx.fillRect(4, b.from * cell + 1, 6, (b.to - b.from + 1) * cell - 2);
    });
    opts.overlay?.(ctx, cell, ox);
    legend.replaceChildren(
      ...(opts.bands ?? []).map((b, i) => {
        const dot = el('i');
        dot.style.background = ['#1b8638', '#c98f00', '#3178c6', '#a33a2c', '#59645d'][i % 5];
        return el('span', {}, dot, `rows ${b.from}-${b.to}: ${b.label}`);
      }),
    );
  }

  // --- Editing
  const snapshot = () => {
    undo.push(rows.slice());
    if (undo.length > UNDO_LIMIT) undo.shift();
    redo.length = 0;
  };
  const setCell = (x, y, s) => {
    if (y < 0 || y >= rows.length || x < 0 || x >= width()) return false;
    const r = rows[y].padEnd(width(), '.');
    if (r[x] === s) return false;
    rows[y] = r.slice(0, x) + s + r.slice(x + 1);
    return true;
  };
  const fill = (x, y, s) => {
    const target = (rows[y] ?? '')[x] ?? '.';
    if (target === s) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cy < 0 || cy >= rows.length || cx < 0 || cx >= width()) continue;
      if ((rows[cy][cx] ?? '.') !== target) continue;
      setCell(cx, cy, s);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  };
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    return [Math.floor(((e.clientX - r.left) * sx - 24) / cell), Math.floor(((e.clientY - r.top) * sx) / cell)];
  };

  let painting = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = at(e);
    if (x < 0 || y < 0 || x >= width() || y >= height()) return;
    canvas.setPointerCapture(e.pointerId);
    if (tool === 'pick') {
      const s = rows[y][x] ?? '.';
      if (s !== '.') symbol = s;
      setTool('pencil');
      renderPalette();
      return;
    }
    snapshot();
    if (tool === 'fill' && e.button !== 2) {
      fill(x, y, symbol);
      changed();
      return;
    }
    painting = e.button === 2 || tool === 'eraser' ? '.' : symbol;
    if (setCell(x, y, painting)) changed();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (painting === null) return;
    const [x, y] = at(e);
    if (setCell(x, y, painting)) changed();
  });
  const stop = () => {
    painting = null;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) api.undo();
    else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) api.redo();
    else return;
    e.preventDefault();
  });
  undoBtn.addEventListener('click', () => api.undo());
  redoBtn.addEventListener('click', () => api.redo());

  function changed() {
    draw();
    opts.onChange?.(rows.slice());
  }

  const api = {
    getRows: () => rows.slice(),
    setRows(next) {
      rows = next.map(String);
      draw();
      renderPalette();
    },
    setWidth(w) {
      snapshot();
      rows = rows.map((r) => r.padEnd(w, '.').slice(0, w));
      changed();
    },
    undo() {
      if (!undo.length) return;
      redo.push(rows.slice());
      rows = undo.pop();
      changed();
    },
    redo() {
      if (!redo.length) return;
      undo.push(rows.slice());
      rows = redo.pop();
      changed();
    },
    refresh() {
      draw();
      renderPalette();
    },
  };
  new ResizeObserver(() => draw()).observe(wrap);
  renderPalette();
  draw();
  return api;
}
