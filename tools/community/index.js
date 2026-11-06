// community/index.js: focused index operations.



export function indexJson(entries) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}
