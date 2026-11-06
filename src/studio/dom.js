// DOM construction shared by the two editors. Importing this module has no DOM effects.
/** @param {string} tag @param {Record<string, any>} props @param {...any} kids @returns {any} */
export const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
};
export const field = (label, input, hint) => el('label', { className: 'field' }, el('span', { textContent: label }), input, hint ? el('small', { textContent: hint }) : null);
export const section = (title, ...kids) => el('section', { className: 'panel' }, el('h3', { textContent: title }), ...kids);
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
