// Fondos de ciudad: un skyline descrito como lista de edificios, en pixel art y con
// poco detalle (se reconoce la silueta, no las ventanas una por una). Se pinta con
// las mismas variables de tema que la ciudad aleatoria (@city, @city2, @cityWin),
// así que cambia solo entre claro y oscuro y de noche se prenden las ventanas.
//
// Igual que los trenes, el JSON puede venir de fuera: aquí se valida todo y los
// problemas se reportan juntos. Ver docs/ia/fondo.md.

import { rng } from './pixel.js';
import { CustomError, isInt, isObj, unknownKeys } from './validate.js';

const MAX_H = 84; // la ciudad termina en la fila 88; deja 4 filas de cielo
const MAX_BUILDINGS = 120;
const TOPS = ['flat', 'stepped', 'spire', 'antenna', 'dome', 'pyramid'];
const ART = '#w.';

// Presets incluidos. Coordenadas sobre la escena de 448 px; el suelo es la fila 88.
// Arriba a la izquierda va el rótulo de la estación (hasta x≈90, y≈23) y arriba a la
// derecha el sol o la luna (x≈392, y≈20): conviene no tapar el rótulo con torres.
export const SKYLINES = {
  'nueva-york': {
    name: 'Nueva York',
    fill: false,
    buildings: [
      // Fondo: Midtown y el Lower Manhattan en un tono más claro.
      { x: -2, w: 16, h: 22, layer: 'far' },
      { x: 12, w: 12, h: 30, layer: 'far' },
      { x: 30, w: 14, h: 36, layer: 'far', top: 'flat' },
      { x: 92, w: 14, h: 30, layer: 'far' },
      { x: 104, w: 10, h: 40, layer: 'far', top: 'pyramid' },
      { x: 128, w: 16, h: 34, layer: 'far' },
      { x: 150, w: 12, h: 44, layer: 'far', top: [{ type: 'stepped', steps: 2, h: 3 }] },
      { x: 232, w: 10, h: 38, layer: 'far' },
      { x: 272, w: 14, h: 30, layer: 'far' },
      { x: 300, w: 8, h: 52, layer: 'far', top: 'antenna' },
      { x: 316, w: 16, h: 36, layer: 'far' },
      { x: 418, w: 32, h: 8, layer: 'far' },
      // Frente, con ventanas.
      { x: 0, w: 14, h: 16 },
      { x: 18, w: 10, h: 20 },
      // One World Trade Center: torre que se adelgaza hasta la antena.
      { x: 50, w: 14, h: 34, top: [{ type: 'pyramid', h: 20, tip: 4 }, { type: 'antenna', h: 12 }] },
      { x: 68, w: 12, h: 24 },
      { x: 84, w: 10, h: 18 },
      { x: 112, w: 14, h: 22 },
      { x: 130, w: 10, h: 28, top: 'dome' },
      // Empire State: escalonado, mástil y antena.
      { x: 164, w: 20, h: 34, top: [{ type: 'stepped', steps: 3, h: 4 }, { type: 'spire', h: 5 }, { type: 'antenna', h: 8 }] },
      { x: 188, w: 12, h: 20 },
      // Chrysler: corona escalonada y aguja.
      { x: 204, w: 12, h: 36, top: [{ type: 'pyramid', h: 9, tip: 4 }, { type: 'spire', h: 12 }] },
      { x: 220, w: 10, h: 24 },
      { x: 244, w: 14, h: 26, top: 'pyramid' },
      // 432 Park Avenue: muy alto y delgado.
      { x: 262, w: 6, h: 64 },
      { x: 270, w: 12, h: 20 },
      { x: 286, w: 12, h: 30, top: 'stepped' },
      { x: 312, w: 14, h: 22 },
      { x: 328, w: 10, h: 30, top: 'antenna' },
      // Puente de Brooklyn: torre de piedra con dos arcos y los cables hasta el tablero.
      {
        x: 340,
        rows: [
          '.........................#........#.........................',
          '.......................##############.......................',
          '.......................##############.......................',
          '.......................##############.......................',
          '...................####.############.####...................',
          '.................##...#.###.####.###.#...##.................',
          '..............###.#...#.##...##...##.#...#.###..............',
          '...........####...#...#.##...##...##.#...#...####...........',
          '.........##...#...#...#.##...##...##.#...#...#...##.........',
          '......###.#...#...#...#.##...##...##.#...#...#...#.###......',
          '....###...#...#...#...#.##...##...##.#...#...#...#...###....',
          '..##..#...#...#...#...#.##...##...##.#...#...#...#...#..##..',
          '###...#...#...#...#...#.##...##...##.#...#...#...#...#...###',
          '############################################################',
          '........................##...##...##........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
        ],
      },
      // Estatua de la Libertad: antorcha, corona, túnica y pedestal.
      {
        x: 404,
        rows: [
          '..#..........',
          '.###.........',
          '..#..........',
          '..#..........',
          '..#.#.#......',
          '..#..###.....',
          '..##.###.....',
          '...######....',
          '....####.....',
          '....#####....',
          '....#####....',
          '....####.....',
          '....####.....',
          '...#####.....',
          '...######....',
          '...######....',
          '..########...',
          '...######....',
          '...######....',
          '...######....',
          '...######....',
          '...######....',
          '..########...',
          '.##########..',
          '#############',
          '#############',
        ],
      },
    ],
  },
};

function parseTop(t, where, errors) {
  if (typeof t === 'string') t = { type: t };
  if (!isObj(t) || !TOPS.includes(t.type)) {
    errors.push(`${where}: remate desconocido ${JSON.stringify(t?.type ?? t)} (válidos: ${TOPS.join(', ')})`);
    return null;
  }
  unknownKeys(t, ['type', 'h', 'steps', 'tip'], where, errors);
  const out = { type: t.type };
  if (t.h !== undefined) {
    if (!isInt(t.h) || t.h < 1 || t.h > 40) errors.push(`${where}.h: un entero entre 1 y 40`);
    else out.h = t.h;
  }
  if (t.steps !== undefined) {
    if (t.type !== 'stepped' || !isInt(t.steps) || t.steps < 1 || t.steps > 4) errors.push(`${where}.steps: solo en "stepped", entre 1 y 4`);
    else out.steps = t.steps;
  }
  if (t.tip !== undefined) {
    if (t.type !== 'pyramid' || !isInt(t.tip) || t.tip < 1 || t.tip > 20) errors.push(`${where}.tip: solo en "pyramid", ancho de la punta entre 1 y 20`);
    else out.tip = t.tip;
  }
  return out;
}

function parseBuilding(b, i, errors) {
  const where = `buildings[${i}]`;
  if (!isObj(b)) {
    errors.push(`${where}: debe ser un objeto { "x": ..., "w": ..., "h": ... }`);
    return null;
  }
  unknownKeys(b, ['x', 'w', 'h', 'layer', 'top', 'windows', 'rows', 'name'], where, errors);
  const before = errors.length;
  const out = { x: b.x, layer: b.layer ?? 'near' };
  if (!isInt(b.x) || b.x < -40 || b.x > 447) errors.push(`${where}.x: un entero entre -40 y 447 (columna izquierda)`);
  if (out.layer !== 'near' && out.layer !== 'far') errors.push(`${where}.layer: "near" (delante, con ventanas) o "far" (atrás, más claro)`);
  out.windows = b.windows ?? out.layer === 'near';
  if (typeof out.windows !== 'boolean') errors.push(`${where}.windows: true o false`);

  if (b.rows !== undefined) {
    // Dibujo libre: "#" edificio, "w" ventana, "." vacío. La última fila toca el suelo.
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > MAX_H || !b.rows.every((r) => typeof r === 'string')) {
      errors.push(`${where}.rows: de 1 a ${MAX_H} textos, la última fila toca el suelo`);
    } else {
      const longest = Math.max(...b.rows.map((r) => r.length));
      if (longest > 200) errors.push(`${where}.rows: máximo 200 columnas (la más larga tiene ${longest})`);
      b.rows.forEach((r, y) => {
        const bad = [...r].filter((c) => !ART.includes(c));
        if (bad.length) errors.push(`${where}.rows[${y}]: símbolos desconocidos "${[...new Set(bad)].join('')}" (válidos: # w .)`);
      });
      out.rows = b.rows.map((r) => r.padEnd(longest, '.'));
    }
    if (b.w !== undefined || b.h !== undefined || b.top !== undefined) {
      errors.push(`${where}: con "rows" no se usan "w", "h" ni "top"`);
    }
  } else {
    if (!isInt(b.w) || b.w < 2 || b.w > 200) errors.push(`${where}.w: un entero entre 2 y 200 (ancho)`);
    if (!isInt(b.h) || b.h < 2 || b.h > MAX_H) errors.push(`${where}.h: un entero entre 2 y ${MAX_H} (alto del cuerpo, sin el remate)`);
    out.w = b.w;
    out.h = b.h;
    const tops = b.top === undefined ? [] : Array.isArray(b.top) ? b.top : [b.top];
    if (tops.length > 4) errors.push(`${where}.top: máximo 4 remates encimados`);
    out.top = tops.map((t, k) => parseTop(t, `${where}.top${Array.isArray(b.top) ? `[${k}]` : ''}`, errors)).filter(Boolean);
  }
  return errors.length > before ? null : out;
}

// Acepta el id de un preset ("nueva-york") o un objeto { name, fill, buildings }.
// Devuelve null para la ciudad aleatoria de siempre ("ciudad" o vacío).
export function parseSkyline(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'ciudad') return null;
  if (typeof raw === 'string') {
    const preset = SKYLINES[raw];
    if (!preset) throw new CustomError('El fondo', [`"${raw}" no existe (opciones: ciudad, ${Object.keys(SKYLINES).join(', ')} o la ruta a un .json)`]);
    raw = preset;
  }
  const errors = [];
  if (!isObj(raw)) throw new CustomError('El fondo', ['el archivo debe ser un objeto JSON { ... }']);
  unknownKeys(raw, ['name', 'fill', 'buildings', 'description', 'descripcion', 'author', 'autor', 'source', 'fuente'], 'fondo', errors);
  const fill = raw.fill ?? true;
  if (typeof fill !== 'boolean') errors.push('fill: true (rellena los huecos con la ciudad de siempre) o false');
  const list = raw.buildings;
  if (!Array.isArray(list) || !list.length || list.length > MAX_BUILDINGS) {
    errors.push(`buildings: una lista de 1 a ${MAX_BUILDINGS} edificios`);
  }
  const buildings = Array.isArray(list) ? list.map((b, i) => parseBuilding(b, i, errors)) : [];
  if (errors.length) throw new CustomError('El fondo', errors);
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Fondo personalizado',
    fill,
    buildings,
  };
}

const odd = (n) => Math.max(1, n % 2 ? n : n - 1);

// Pinta un remate sobre el bloque { x, w, top } (top = fila más alta ocupada) y
// devuelve el bloque nuevo, para encimar el siguiente remate.
function paintTop(g, blk, t, color) {
  const { x, w, top } = blk;
  const cx = x + (w - 1) / 2;
  if (t.type === 'flat') return blk;
  if (t.type === 'stepped') {
    const steps = t.steps ?? 2;
    const th = t.h ?? 3;
    let cur = blk;
    for (let s = 1; s <= steps; s++) {
      const inset = Math.max(1, Math.round((w * s) / (2 * (steps + 1))));
      const nw = Math.max(1, w - 2 * inset);
      cur = { x: x + Math.floor((w - nw) / 2), w: nw, top: cur.top - th };
      g.rect(cur.x, cur.top, cur.w, th, color);
    }
    return cur;
  }
  if (t.type === 'pyramid') {
    const tip = Math.min(t.tip ?? 1, w);
    const h = t.h ?? Math.max(1, Math.ceil((w - tip) / 2));
    let last = blk;
    for (let r = 1; r <= h; r++) {
      const rw = Math.max(tip, Math.round(w - ((w - tip) * r) / h));
      const rx = x + Math.floor((w - rw) / 2);
      g.rect(rx, top - r, rw, 1, color);
      last = { x: rx, w: rw, top: top - r };
    }
    return last;
  }
  if (t.type === 'dome') {
    const rad = w / 2;
    const h = t.h ?? Math.max(1, Math.ceil(rad * 0.8));
    let last = blk;
    for (let r = 1; r <= h; r++) {
      const dy = (r / h) * rad;
      const half = Math.sqrt(Math.max(0, rad * rad - dy * dy));
      const rw = Math.max(1, Math.round(half * 2));
      const rx = x + Math.floor((w - rw) / 2);
      g.rect(rx, top - r, rw, 1, color);
      last = { x: rx, w: rw, top: top - r };
    }
    return last;
  }
  if (t.type === 'spire') {
    const base = odd(Math.min(w, 3));
    const h = t.h ?? 6;
    for (let r = 1; r <= h; r++) {
      const rw = r <= Math.ceil(h / 3) ? base : 1;
      g.rect(Math.round(cx - (rw - 1) / 2), top - r, rw, 1, color);
    }
    return { x: Math.round(cx), w: 1, top: top - h };
  }
  // antenna
  const h = t.h ?? 5;
  g.rect(Math.round(cx), top - h, 1, h, color);
  return { x: Math.round(cx), w: 1, top: top - h };
}

// Ventanas como en la ciudad aleatoria: una rejilla cada 3 columnas y 4 filas, con
// algunas encendidas al azar (solo se ven de noche).
function paintWindows(g, x, top, w, ground, seed) {
  const rand = rng(seed);
  for (let wy = top + 3; wy < ground - 3; wy += 4) {
    for (let wx = x + 2; wx < x + w - 2; wx += 3) if (rand() < 0.35) g.set(wx, wy, '@cityWin');
  }
}

// Columnas que ocupan los edificios de un plano, con `margin` píxeles a cada lado.
// La ciudad de relleno no se dibuja ahí para que los edificios propios se lean.
export function skylineColumns(sky, layer, margin = 0) {
  const cols = new Set();
  for (const b of sky.buildings) {
    if (b.layer !== layer) continue;
    const w = b.rows ? b.rows[0].length : b.w;
    for (let x = b.x - margin; x < b.x + w + margin; x++) cols.add(x);
  }
  return cols;
}

// Pinta un plano del skyline ('far' o 'near') sobre la rejilla del decorado.
// `ground` es la fila del suelo. Se pinta por planos para que la ciudad de relleno
// quede entre los dos: detrás de los edificios cercanos y delante de los lejanos.
export function paintSkyline(g, sky, ground, layer) {
  sky.buildings.forEach((b, i) => {
    if (b.layer === layer) paintBuilding(g, b, i, ground);
  });
}

function paintBuilding(g, b, i, ground) {
  const color = b.layer === 'far' ? '@city2' : '@city';
  if (b.rows) {
    // Dibujo libre: la última fila toca el suelo.
    const h = b.rows.length;
    b.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '.') g.set(b.x + c, ground - h + r, row[c] === 'w' ? '@cityWin' : color);
      }
    });
    return;
  }
  const top = ground - b.h;
  g.rect(b.x, top, b.w, b.h, color);
  if (b.windows) paintWindows(g, b.x, top, b.w, ground, 7000 + i * 131 + b.x);
  let blk = { x: b.x, w: b.w, top };
  for (const t of b.top) blk = paintTop(g, blk, t, color);
}
