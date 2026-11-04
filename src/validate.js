// Ayudas para validar los JSON que llegan de fuera (trenes y fondos personalizados).

export class CustomError extends Error {
  constructor(what, errors) {
    super(`${what} tiene ${errors.length} problema(s):\n- ${errors.join('\n- ')}`);
    this.name = 'CustomError';
    this.errors = errors;
  }
}

export const isInt = (v) => Number.isInteger(v);
export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Acepta #rgb, #rrggbb o rrggbb; devuelve #rrggbb en minúsculas o null.
export function normColor(v) {
  if (typeof v !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

// Las claves que empiezan con "_" o "$" se ignoran (notas, $schema...).
export function unknownKeys(obj, known, where, errors) {
  for (const k of Object.keys(obj)) {
    if (known.includes(k) || k.startsWith('_') || k.startsWith('$')) continue;
    errors.push(`${where}: clave desconocida "${k}" (válidas: ${known.join(', ')})`);
  }
}
