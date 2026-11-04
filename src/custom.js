// Trenes personalizados: convierte un JSON (escrito a mano o por una IA) en un
// modelo como los de models.js. El archivo viene de fuera, así que aquí solo se
// leen datos: cada campo se valida y todos los problemas se reportan juntos, con
// mensajes pensados para pegárselos de vuelta a la IA y que los corrija.
//
// El formato usa las mismas claves que models.js, para que un tren personalizado
// pueda pasar al catálogo copiando y pegando. Ver docs/ia/tren.md.

import { MODELS } from './models.js';
import { buildNose } from './noses.js';
import {
  buildTrain, trainWidth, mix, MAX_CARS, LED_W, DOOR_W,
  LOCO_ROWS, LOCO_UP, LOCO_MIN_W, LOCO_MAX_W, LOCO_WHEELS, LOCO_SMALL,
} from './train.js';
import { SCENE_W } from './scenery.js';
import { CustomError, isInt, isObj, normColor, unknownKeys } from './validate.js';

export { CustomError };

const COMMON = { outline: '#16131a', gangway: '#2d2d35', wheel: '#25252b', skirt: '#3b3b43' };

// Paleta: solo `body` es obligatorio; lo demás se deriva si falta.
const PAL_DEFAULTS = [
  ['upper', (p) => p.body],
  ['bodyHi', (p) => mix(p.body, '#ffffff', 0.15)],
  ['bodyLo', (p) => mix(p.body, '#000000', 0.15)],
  ['roof', () => '#9aa0aa'],
  ['roofHi', (p) => mix(p.roof, '#ffffff', 0.25)],
  ['roofVent', (p) => mix(p.roof, '#000000', 0.18)],
  ['trim', () => '#f2f4f7'],
  ['dark', () => '#2f3340'],
  ['glass', () => '#262b36'],
  ['glassHi', (p) => mix(p.glass, '#ffffff', 0.2)],
  ['door', (p) => p.body],
  ['doorHi', (p) => mix(p.door, '#ffffff', 0.18)],
  ...Object.entries(COMMON).map(([k, v]) => [k, () => v]),
];
const PAL_KEYS = ['body', ...PAL_DEFAULTS.map(([k]) => k)];

export const BAND_SYMBOLS = 'bhltdua';
export const NOSE_SYMBOLS = 'snfgGokmlyrqiatdh';
const NOSE_OPS = { r: 5, p: 3, f: 5, e: 5, ep: 3 };

const KEYS = [
  'id', 'name', 'pal', 'bands', 'row3', 'win', 'winBand', 'doors', 'nose',
  'pant', 'pantX', 'roofBoxes', 'articulated', 'tyres', 'cabWindows', 'cabBogieOff', 'loco',
];
// Claves de la cabina que no aplican cuando el tren lleva locomotora.
const CAB_KEYS = ['nose', 'cabWindows', 'cabBogieOff', 'pantX'];
// Claves que se aceptan pero no se usan (notas de quien hizo el tren).
const NOTE_KEYS = ['description', 'descripcion', 'author', 'autor', 'source', 'fuente', 'inspiration', 'inspiracion'];

function parseNose(raw, errors) {
  // "bala" o { "base": "bala", "color": ..., "face": ... }: reutiliza una trompa del catálogo.
  if (typeof raw === 'string') raw = { base: raw };
  if (!isObj(raw)) {
    errors.push('nose: debe ser el nombre de una trompa del catálogo o un objeto');
    return null;
  }
  unknownKeys(raw, ['base', 'w', 'edge', 'ops', 'rows', 'color', 'face'], 'nose', errors);

  let nose = null;
  let bogieOff;
  if (raw.base !== undefined) {
    const base = MODELS[raw.base];
    if (!base) {
      errors.push(`nose.base: "${raw.base}" no existe (opciones: ${Object.keys(MODELS).join(', ')})`);
      return null;
    }
    nose = { w: base.nose.w, rows: [...base.nose.rows], color: base.nose.color, face: base.nose.face };
    bogieOff = base.cabBogieOff;
  } else if (raw.rows !== undefined) {
    nose = noseFromRows(raw, errors);
  } else if (raw.edge !== undefined || raw.ops !== undefined) {
    nose = noseFromOps(raw, errors);
  } else {
    errors.push('nose: falta "base", "rows" o "edge" + "ops"');
    return null;
  }
  if (!nose) return null;

  for (const k of ['color', 'face']) {
    if (raw[k] === undefined) continue;
    const c = normColor(raw[k]);
    if (c) nose[k] = c;
    else errors.push(`nose.${k}: "${raw[k]}" no es un color hexadecimal (#rrggbb)`);
  }
  if (!nose.rows.some((r) => /[ly]/.test(r))) {
    errors.push('nose: falta al menos un faro ("l" o "y"); en la cola esos mismos píxeles salen en rojo');
  }
  return { nose, bogieOff };
}

// Trompa dibujada directamente: 20 filas de símbolos, de izquierda (unión con la
// caja) a derecha (punta). Las filas cortas se rellenan con "." a la derecha.
function noseFromRows(raw, errors) {
  const { rows } = raw;
  if (!Array.isArray(rows) || rows.length !== 20 || !rows.every((r) => typeof r === 'string')) {
    errors.push(`nose.rows: deben ser 20 textos (uno por fila, del techo al faldón); llegaron ${Array.isArray(rows) ? rows.length : typeof rows}`);
    return null;
  }
  const longest = Math.max(...rows.map((r) => r.length));
  const w = raw.w ?? longest;
  if (!isInt(w) || w < 4 || w < longest) {
    errors.push(`nose.w: ${raw.w} no cuadra con la fila más larga (${longest} columnas)`);
    return null;
  }
  const out = [];
  rows.forEach((r, y) => {
    const bad = [...r].filter((c) => c !== '.' && !NOSE_SYMBOLS.includes(c));
    if (bad.length) errors.push(`nose.rows[${y}]: símbolos desconocidos "${[...new Set(bad)].join('')}" (válidos: ${NOSE_SYMBOLS} y ".")`);
    if (r[0] === undefined || r[0] === '.') errors.push(`nose.rows[${y}]: la primera columna no puede estar vacía (ahí se une con el coche)`);
    out.push(r.padEnd(w, '.'));
  });
  return { w, rows: out };
}

function noseFromOps(raw, errors) {
  const { w, edge, ops = [] } = raw;
  const before = errors.length;
  if (!isInt(w) || w < 4 || w > 40) errors.push(`nose.w: debe ser un entero entre 4 y 40 (llegó ${w})`);
  if (!Array.isArray(edge) || edge.length !== 20) {
    errors.push(`nose.edge: deben ser 20 números, uno por fila (llegaron ${Array.isArray(edge) ? edge.length : typeof edge})`);
  } else {
    edge.forEach((e, y) => {
      if (!isInt(e) || e < 0 || e >= w) errors.push(`nose.edge[${y}]: ${e} debe ser un entero entre 0 y ${w - 1}`);
    });
  }
  if (!Array.isArray(ops)) errors.push('nose.ops: debe ser una lista');
  else {
    ops.forEach((op, i) => {
      if (!Array.isArray(op) || !(op[0] in NOSE_OPS)) {
        errors.push(`nose.ops[${i}]: operación desconocida ${JSON.stringify(op?.[0] ?? op)} (válidas: ${Object.keys(NOSE_OPS).join(', ')})`);
        return;
      }
      const n = NOSE_OPS[op[0]];
      if (op.length !== n + 1) {
        errors.push(`nose.ops[${i}]: "${op[0]}" lleva ${n} valores después del nombre y llegaron ${op.length - 1}`);
        return;
      }
      const nums = op.slice(1, -1);
      const sym = op[op.length - 1];
      if (!nums.every(isInt)) errors.push(`nose.ops[${i}]: las coordenadas deben ser enteros`);
      if (typeof sym !== 'string' || sym.length !== 1 || !NOSE_SYMBOLS.includes(sym)) {
        errors.push(`nose.ops[${i}]: símbolo "${sym}" desconocido (válidos: ${NOSE_SYMBOLS})`);
      }
      if ((op[0] === 'e' || op[0] === 'ep') && isInt(op[1]) && (op[1] < 0 || op[1] > 19)) {
        errors.push(`nose.ops[${i}]: la fila ${op[1]} está fuera de 0..19`);
      }
    });
  }
  if (errors.length > before) return null;
  return buildNose(w, edge, ops);
}

// Locomotora: un dibujo de 30 filas (5 sobre el techo de los coches, 20 a la altura
// de la caja y 5 de ruedas; la última toca el riel) mirando a la derecha, más sus
// ruedas. Las ruedas las dibuja el programa encima del dibujo.
function parseLoco(raw, errors) {
  if (!isObj(raw)) {
    errors.push('loco: debe ser un objeto { "rows": [...], "wheels": { "drive": [...] } }');
    return null;
  }
  unknownKeys(raw, ['rows', 'color', 'face', 'wheels', 'smoke'], 'loco', errors);
  const before = errors.length;

  const { rows } = raw;
  if (!Array.isArray(rows) || rows.length !== LOCO_ROWS || !rows.every((r) => typeof r === 'string')) {
    errors.push(
      `loco.rows: deben ser ${LOCO_ROWS} textos (${LOCO_UP} sobre el techo de los coches, 20 de la caja y 5 de ruedas); ` +
      `llegaron ${Array.isArray(rows) ? rows.length : typeof rows}`,
    );
    return null;
  }
  const w = Math.max(...rows.map((r) => r.length));
  if (w < LOCO_MIN_W || w > LOCO_MAX_W) {
    errors.push(`loco.rows: la fila más larga mide ${w} columnas; la locomotora debe medir de ${LOCO_MIN_W} a ${LOCO_MAX_W}`);
  }
  rows.forEach((r, y) => {
    const bad = [...r].filter((c) => c !== '.' && !NOSE_SYMBOLS.includes(c));
    if (bad.length) errors.push(`loco.rows[${y}]: símbolos desconocidos "${[...new Set(bad)].join('')}" (válidos: ${NOSE_SYMBOLS} y ".")`);
  });
  const loco = { w, rows: rows.map((r) => r.padEnd(w, '.')) };
  if (!loco.rows.some((r) => /[^.]/.test(r))) errors.push('loco.rows: el dibujo está vacío');

  for (const k of ['color', 'face']) {
    if (raw[k] === undefined) continue;
    const c = normColor(raw[k]);
    if (c) loco[k] = c;
    else errors.push(`loco.${k}: "${raw[k]}" no es un color hexadecimal (#rrggbb)`);
  }
  if (loco.color) {
    loco.hi = mix(loco.color, '#ffffff', 0.18);
    loco.lo = mix(loco.color, '#000000', 0.2);
  }

  // Ruedas.
  const wh = raw.wheels;
  if (!isObj(wh)) {
    errors.push('loco.wheels: falta; por ejemplo { "drive": [10, 20, 30], "d": 9 } (centros de las ruedas motrices)');
  } else {
    unknownKeys(wh, ['drive', 'd', 'small', 'rod', 'color'], 'loco.wheels', errors);
    const wheels = { d: wh.d ?? 9, small: wh.small ?? [], rod: wh.rod ?? true, drive: wh.drive };
    if (!LOCO_WHEELS.includes(wheels.d)) errors.push(`loco.wheels.d: diámetro de las motrices ${LOCO_WHEELS.join(', ')} (llegó ${wh.d})`);
    if (typeof wheels.rod !== 'boolean') errors.push('loco.wheels.rod: debe ser true (biela entre las motrices) o false');
    const list = (v, key, lo, hi) => {
      if (!Array.isArray(v) || v.length < lo || v.length > hi || !v.every(isInt)) {
        errors.push(`loco.wheels.${key}: una lista de ${lo} a ${hi} columnas enteras (el centro de cada rueda)`);
        return false;
      }
      return true;
    };
    const okDrive = list(wheels.drive, 'drive', 1, 6);
    const okSmall = list(wheels.small, 'small', 0, 4);
    if (wh.color !== undefined) {
      const c = normColor(wh.color);
      if (c) wheels.color = c;
      else errors.push(`loco.wheels.color: "${wh.color}" no es un color hexadecimal (#rrggbb)`);
    }
    if (okDrive && okSmall && LOCO_WHEELS.includes(wheels.d) && w >= LOCO_MIN_W) {
      const all = [
        ...wheels.drive.map((x) => ({ x, r: (wheels.d - 1) / 2, key: 'drive' })),
        ...wheels.small.map((x) => ({ x, r: (LOCO_SMALL - 1) / 2, key: 'small' })),
      ];
      for (const { x, r, key } of all) {
        if (x < r || x > w - 1 - r) errors.push(`loco.wheels.${key}: la rueda en la columna ${x} se sale de la locomotora (va de ${r} a ${w - 1 - r})`);
      }
      all.sort((a, b) => a.x - b.x);
      for (let i = 1; i < all.length; i++) {
        const [a, b] = [all[i - 1], all[i]];
        if (b.x - a.x < a.r + b.r + 1) {
          errors.push(`loco.wheels: las ruedas de las columnas ${a.x} y ${b.x} se enciman; sepáralas al menos ${a.r + b.r + 1} columnas`);
        }
      }
    }
    loco.wheels = wheels;
  }

  // Chimenea: columna de donde sale el humo.
  if (raw.smoke !== undefined) {
    if (!isInt(raw.smoke) || raw.smoke < 0 || raw.smoke >= w) errors.push(`loco.smoke: la columna de la chimenea, un entero de 0 a ${w - 1}`);
    else if (!loco.rows.some((r) => r[raw.smoke] !== '.')) errors.push(`loco.smoke: la columna ${raw.smoke} está vacía; pon ahí la chimenea`);
    else loco.smoke = raw.smoke;
  }
  return errors.length > before ? null : loco;
}

// Devuelve un modelo listo para buildTrain, o lanza CustomError con la lista de problemas.
export function parseCustomModel(raw) {
  const errors = [];
  if (!isObj(raw)) throw new CustomError('El tren', ['el archivo debe ser un objeto JSON { ... }']);
  unknownKeys(raw, [...KEYS, ...NOTE_KEYS], 'tren', errors);

  const m = {};
  m.id = 'personalizado';
  if (raw.id !== undefined) {
    if (typeof raw.id === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(raw.id)) m.id = raw.id;
    else errors.push('id: usa minúsculas, números y guiones (máximo 32), por ejemplo "metro-nueva-york"');
  }
  m.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Tren personalizado';

  // Paleta.
  const pal = {};
  if (!isObj(raw.pal)) errors.push('pal: falta la paleta; como mínimo { "body": "#rrggbb" }');
  else {
    unknownKeys(raw.pal, PAL_KEYS, 'pal', errors);
    for (const k of PAL_KEYS) {
      if (raw.pal[k] === undefined) continue;
      const c = normColor(raw.pal[k]);
      if (c) pal[k] = c;
      else errors.push(`pal.${k}: "${raw.pal[k]}" no es un color hexadecimal (#rrggbb)`);
    }
    if (!raw.pal.body) errors.push('pal.body: es obligatorio (el color principal de la caja)');
  }
  if (pal.body) for (const [k, f] of PAL_DEFAULTS) pal[k] ??= f(pal);
  m.pal = pal;

  // Franjas de las filas 11..17 y borde del techo.
  const bands = raw.bands ?? 'bbaabll';
  const bandList = typeof bands === 'string' ? [...bands] : bands;
  if (!Array.isArray(bandList) || bandList.length !== 7 || !bandList.every((s) => typeof s === 'string' && s.length === 1 && BAND_SYMBOLS.includes(s))) {
    errors.push(`bands: deben ser 7 símbolos de "${BAND_SYMBOLS}" (filas 11 a 17), por ejemplo "bbaabll"`);
  } else m.bands = bandList;
  m.row3 = raw.row3 ?? 'u';
  if (typeof m.row3 !== 'string' || m.row3.length !== 1 || !BAND_SYMBOLS.includes(m.row3)) {
    errors.push(`row3: debe ser un símbolo de "${BAND_SYMBOLS}"`);
  }

  // Ventanas.
  const win = raw.win ?? { y0: 4, y1: 10 };
  if (!isObj(win) || !isInt(win.y0) || !isInt(win.y1) || win.y0 < 3 || win.y0 > 6 || win.y1 < 8 || win.y1 > 12 || win.y1 - win.y0 < 3) {
    errors.push('win: debe ser { "y0": 3..6, "y1": 8..12 } (filas de arriba y abajo del marco)');
  } else m.win = { y0: win.y0, y1: win.y1 };
  if (raw.winBand !== undefined && raw.winBand !== null) {
    const c = normColor(raw.winBand);
    if (c) m.winBand = c;
    else errors.push(`winBand: "${raw.winBand}" no es un color hexadecimal (o quítalo)`);
  }
  m.doors = raw.doors ?? 2;
  if (m.doors !== 2 && m.doors !== 3) errors.push('doors: 2 o 3 puertas por lado');

  for (const k of ['roofBoxes', 'articulated', 'tyres']) {
    const v = raw[k] ?? k === 'roofBoxes';
    if (typeof v !== 'boolean') errors.push(`${k}: debe ser true o false`);
    m[k] = !!v;
  }

  if (raw.cabWindows !== undefined && raw.cabWindows !== 0) {
    if (!isInt(raw.cabWindows) || raw.cabWindows < 4 || raw.cabWindows > 30 || raw.cabWindows % 2) {
      errors.push('cabWindows: un número par entre 4 y 30 (ventanas extra en la cabina), o 0');
    } else m.cabWindows = raw.cabWindows;
  }

  // Locomotora: reemplaza la cabina (y su trompa) en ambos extremos.
  const hasLoco = raw.loco !== undefined && raw.loco !== null;
  if (hasLoco) {
    const loco = parseLoco(raw.loco, errors);
    if (loco) m.loco = loco;
    for (const k of CAB_KEYS) {
      if (raw[k] !== undefined) errors.push(`${k}: con "loco" no hay cabina; quítalo (la locomotora va al frente y la cola es plana)`);
    }
    if (m.articulated) errors.push('articulated: con "loco" los vagones van sueltos; quítalo o ponlo en false');
  }

  // Trompa (y, si viene del catálogo, la distancia del bogie a la punta).
  const parsedNose = hasLoco
    ? null
    : raw.nose === undefined
      ? (errors.push('nose: falta la trompa (o usa "loco" para un tren con locomotora)'), null)
      : parseNose(raw.nose, errors);
  if (parsedNose) m.nose = parsedNose.nose;
  const bogieOff = hasLoco ? undefined : raw.cabBogieOff ?? parsedNose?.bogieOff;
  if (bogieOff !== undefined) {
    if (!isInt(bogieOff) || bogieOff < 14 || bogieOff > 30) errors.push('cabBogieOff: un entero entre 14 y 30');
    else m.cabBogieOff = bogieOff;
  }

  // Pantógrafo.
  m.pant = raw.pant ?? null;
  if (m.pant !== null && m.pant !== 'lead' && m.pant !== 'alt') errors.push('pant: "lead" (en la cabina), "alt" (cada dos coches) o null (tercer riel)');
  else if (hasLoco && m.pant !== null) errors.push('pant: con "loco" debe ser null (la locomotora no lleva pantógrafo)');
  if (m.pant === 'lead' && !hasLoco) {
    m.pantX = raw.pantX ?? 24;
    const doorW = m.doors === 3 ? 9 : DOOR_W;
    const room = 3 + LED_W + 2 + doorW + 2 + (m.cabWindows ? m.cabWindows + 2 : 0) - 9;
    if (!isInt(m.pantX) || m.pantX < 2 || m.pantX > room) errors.push(`pantX: un entero entre 2 y ${room} (posición del pantógrafo en el techo de la cabina)`);
  }

  if (errors.length) throw new CustomError('El tren', errors);

  const width = trainWidth(m, MAX_CARS);
  if (width > SCENE_W) {
    throw new CustomError('El tren', [
      m.loco
        ? `con ${MAX_CARS} vagones mide ${width} px y la escena mide ${SCENE_W}: angosta la locomotora (loco)`
        : `con ${MAX_CARS} vagones mide ${width} px y la escena mide ${SCENE_W}: angosta la trompa (nose) o quita cabWindows`,
    ]);
  }
  // Última red: si algo se nos escapó, que falle aquí con un mensaje y no en la Action.
  try {
    for (let cars = 1; cars <= MAX_CARS; cars++) for (const dir of [1, -1]) buildTrain(m, { cars, dir, streak: 12 });
  } catch (err) {
    throw new CustomError('El tren', [`no se pudo dibujar: ${err.message}`]);
  }
  m.custom = true;
  return m;
}
