// Pixel grid and conversion to SVG rectangles.
// A color starting with "@" is emitted as a CSS class (c-name) so it can
// change with the theme; any other is emitted as a hexadecimal fill.

export class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h).fill(null);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x, y) {
    return this.inside(x, y) ? this.cells[y * this.w + x] : null;
  }

  set(x, y, c) {
    if (this.inside(x, y)) this.cells[y * this.w + x] = c;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  hline(x, y, w, c) {
    this.rect(x, y, w, 1, c);
  }

  vline(x, y, h, c) {
    this.rect(x, y, 1, h, c);
  }

  // Draw only the outline of a rectangle.
  frame(x, y, w, h, c) {
    this.hline(x, y, w, c);
    this.hline(x, y + h - 1, w, c);
    this.vline(x, y, h, c);
    this.vline(x + w - 1, y, h, c);
  }

  mirror() {
    const g = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        g.cells[y * this.w + (this.w - 1 - x)] = this.cells[y * this.w + x];
      }
    }
    return g;
  }

  isEmpty() {
    return this.cells.every((c) => c === null);
  }

  // Group by color and merge adjacent pixels into large rectangles.
  paths(used = new Set()) {
    const colors = new Set(this.cells.filter(Boolean));
    let out = '';
    for (const color of colors) {
      const d = rectsFor(this, color)
        .map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`)
        .join('');
      out += `<path ${colorAttr(color, used)} d="${d}"/>`;
    }
    return out;
  }
}

function rectsFor(grid, color) {
  const { w, h, cells } = grid;
  const out = [];
  let open = new Map();
  for (let y = 0; y < h; y++) {
    const next = new Map();
    let x = 0;
    while (x < w) {
      if (cells[y * w + x] !== color) {
        x++;
        continue;
      }
      const start = x;
      while (x < w && cells[y * w + x] === color) x++;
      const key = `${start}:${x - start}`;
      const prev = open.get(key);
      if (prev) {
        prev.h++;
        next.set(key, prev);
      } else {
        const r = { x: start, y, w: x - start, h: 1 };
        out.push(r);
        next.set(key, r);
      }
    }
    open = next;
  }
  return out;
}

function colorAttr(color, used) {
  if (color[0] === '@') {
    const name = color.slice(1);
    used.add(name);
    return `class="c-${name}"`;
  }
  return `fill="${color}"`;
}

// Seeded pseudorandom generator (mulberry32): the scenery always looks the same.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
