// The split-flap departures board, drawn as a self-contained animated SVG.
//
// renderBoard(board, style) -> SVG string
//   board.title    title bar text, already localized ("DEPARTURES")
//   board.aria     accessible description of the whole card
//   board.columns  [{ key, label, cells }] in display order: time, destination, platform, status;
//                  label is the heading, cells the column width in flap characters
//   board.rows     [{ time, destination, platform, status, tone }]: text already in capitals and
//                  clipped to the column; tone is boarding | on-time | delayed | departed
//   board.empty    text for the board with no rows ("NO DEPARTURES")
//   style.colors   { background, title, icon, text, ring } as CSS colors (see departures.js)
//   style.border   draw the thin card border
//
// Tiles are 11 x 22 with a 12px character pitch and 26px row pitch. Shared patterns
// keep the SVG small; whole-column titles preserve readable text and tooltips.
// The CSS-only entrance starts and ends fully open, including without animation.

import { esc, FONT } from './cards.js';

export function renderBoard(board, { colors: c, border }) {
  const pitch = 12;
  const gap = 12;
  const W = 40 + board.columns.reduce((sum, col) => sum + col.cells * pitch - 1, 0) + (board.columns.length - 1) * gap;
  const H = 92 + Math.max(1, board.rows.length) * 26;
  const color = Object.fromEntries(Object.entries(c).map(([key, value]) => [key, esc(value)]));
  const toneColor = { boarding: color.title, 'on-time': color.icon, delayed: color.ring, departed: color.text };
  let x = 20;
  let cellOffset = 0;
  const columns = board.columns.map((col) => {
    const column = { ...col, x, offset: cellOffset, width: col.cells * pitch - 1 };
    x += column.width + gap;
    cellOffset += col.cells;
    return column;
  });
  const heads = columns.map((col) => `<text class="head" x="${col.x}" y="65">${esc(col.label)}</text>`).join('');

  const flaps = (value, cells, offset, row) =>
    Array.from(String(value)).slice(0, cells).map((char, i) =>
      char === ' ' ? '' : `<text class="flap" x="${i * pitch + 5.5}" y="15.5" ` +
        (/[MW@…]/u.test(char) ? 'textLength="9" lengthAdjust="spacingAndGlyphs" ' : '') +
        `style="animation-delay:${row * 110 + (offset + i) * 10}ms">${esc(char)}</text>`,
    ).join('');

  const rows = board.rows.map((row, i) =>
    `<g transform="translate(0 ${78 + i * 26})">` + columns.map((col) => {
      const status = col.key === 'status';
      return `<g transform="translate(${col.x} 0)"><title>${esc(row[col.key])}</title>` +
        `<rect width="${col.width}" height="22" fill="url(#tile)"/>` +
        `<g fill="${status ? toneColor[row.tone] : color.text}"${status && row.tone === 'departed' ? ' opacity=".45"' : ''}>` +
        flaps(row[col.key], col.cells, col.offset, i) + `</g>` +
        `<rect width="${col.width}" height="22" fill="url(#seam)"/></g>`;
    }).join('') + `</g>`,
  ).join('');

  // A quiet, full-width line of blank flaps also frames the localized empty state.
  const emptyCells = Math.floor((W - 40) / pitch);
  const emptyWidth = emptyCells * pitch - 1;
  const empty = `<g transform="translate(${(W - emptyWidth) / 2} 78)"><title>${esc(board.empty)}</title>` +
    `<rect width="${emptyWidth}" height="22" fill="url(#tile)"/>` +
    `<g fill="${color.text}" transform="translate(${Math.floor((emptyCells - Array.from(board.empty).length) / 2) * pitch} 0)">` +
    flaps(board.empty, emptyCells, 0, 0) + `</g>` +
    `<rect width="${emptyWidth}" height="22" fill="url(#seam)"/></g>`;
  const description = board.rows.length
    ? board.rows.map((row) => columns.map((col) => `${col.label}: ${row[col.key]}`).join(', ')).join('; ')
    : board.empty;

  return (
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg" ` +
    `role="img" aria-labelledby="t" aria-describedby="d"><title id="t">${esc(board.aria)}</title>` +
    `<desc id="d">${esc(description)}</desc><style>` +
    `.title{font:700 16px ${esc(FONT)};letter-spacing:2px;fill:${color.title}}` +
    `.head{font:700 10px ${esc(FONT)};letter-spacing:1px;fill:${color.title}}` +
    `.flap{font:700 12px ${esc(FONT)};text-anchor:middle;transform-box:fill-box;transform-origin:50% 50%;animation:flip .36s ease-in-out both}` +
    `@keyframes flip{0%,100%{transform:scaleY(1)}35%{transform:scaleY(.12)}70%{transform:scaleY(1.04)}}` +
    `@media (prefers-reduced-motion:reduce){.flap{animation:none}}</style>` +
    `<defs><pattern id="tile" width="12" height="22" patternUnits="userSpaceOnUse">` +
    `<path d="M1 0h9l1 1v10H0V1z" fill="${color.text}" opacity=".10"/>` +
    `<path d="M0 11h11v10l-1 1H1l-1-1z" fill="${color.text}" opacity=".045"/>` +
    `<path d="M.5 10V1l.5-.5h9l.5.5" stroke="#fff" stroke-opacity=".07"/>` +
    `<path d="M.5 21.5h10" stroke="#000" stroke-opacity=".2"/></pattern>` +
    `<pattern id="seam" width="12" height="22" patternUnits="userSpaceOnUse">` +
    `<path d="M0 11h11" stroke="#000" stroke-opacity=".3"/>` +
    `<path d="M1 12h9" stroke="#fff" stroke-opacity=".04"/></pattern></defs>` +
    `<rect x=".5" y=".5" rx="7" width="${W - 1}" height="${H - 1}" fill="${color.background}" ` +
    `stroke="${color.text}" stroke-opacity="${border ? 0.25 : 0}"/>` +
    `<path d="M20 46.5H${W - 20}" stroke="${color.text}" stroke-opacity=".14"/>` +
    `<path d="M20 46.5h24" stroke="${color.title}" stroke-opacity=".7"/>` +
    `<g transform="translate(21 16)" stroke="${color.icon}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="1" y="1" width="14" height="16" rx="3"/>` +
    `<path d="M4 5h8v5H4zM5 17l-2 3m8-3 2 3M4 20h8"/>` +
    `<path d="M4 13.5h1m6 0h1" stroke-width="2"/></g>` +
    `<text class="title" x="50" y="32">${esc(board.title)}</text>` +
    `${heads}${rows || empty}</svg>`
  );
}
