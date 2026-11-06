// Helpers for validating JSON that comes from outside (custom trains and skylines).

export class CustomError extends Error {
  constructor(what, errors) {
    super(`${what} has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
    this.name = 'CustomError';
    this.errors = errors;
  }
}

export const isInt = (v) => Number.isInteger(v);
export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Accepts #rgb, #rrggbb or rrggbb; returns lowercase #rrggbb, or null.
export function normColor(v) {
  if (typeof v !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

// Keys starting with "_" or "$" are ignored (notes, $schema...).
export function unknownKeys(obj, known, where, errors) {
  for (const k of Object.keys(obj)) {
    if (known.includes(k) || k.startsWith('_') || k.startsWith('$')) continue;
    errors.push(`${where}: unknown key "${k}" (valid: ${known.join(', ')})`);
  }
}

// Keys accepted anywhere but never drawn: notes from whoever made the file.
// The Spanish spellings stay accepted for files made with the earlier guides.
export const NOTE_KEYS = ['description', 'author', 'source', 'inspiration', 'descripcion', 'autor', 'fuente', 'inspiracion'];
