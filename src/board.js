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

import { esc, FONT } from './cards.js';

// Placeholder look: the real board replaces this.
export function renderBoard(board, { colors: c, border }) {
  const cell = 11;
  const W = 40 + board.columns.reduce((a, col) => a + col.cells * cell + 16, 0);
  const H = 90 + Math.max(1, board.rows.length) * 28;
  const toneColor = { boarding: c.title, 'on-time': c.icon, delayed: c.ring, departed: c.text };
  let x = 20;
  const heads = [];
  const offsets = {};
  for (const col of board.columns) {
    offsets[col.key] = x;
    heads.push(`<text class="head" x="${x}" y="56">${esc(col.label)}</text>`);
    x += col.cells * cell + 16;
  }
  const rows = board.rows.length
    ? board.rows
        .map(
          (r, i) =>
            `<g class="flip" style="animation-delay:${i * 120}ms">` +
            board.columns
              .map(
                (col) =>
                  `<text class="flap" x="${offsets[col.key]}" y="${88 + i * 28}"` +
                  (col.key === 'status' ? ` fill="${toneColor[r.tone]}"` : '') +
                  `>${esc(r[col.key])}</text>`,
              )
              .join('') +
            `</g>`,
        )
        .join('')
    : `<text class="flap" x="20" y="88">${esc(board.empty)}</text>`;
  return (
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg" ` +
    `role="img" aria-labelledby="t"><title id="t">${esc(board.aria)}</title><style>` +
    `.head{font:600 11px ${FONT};fill:${c.title}}.flap{font:700 14px ${FONT};fill:${c.text}}` +
    `.flip{animation:flip .4s ease-out both}@keyframes flip{from{opacity:0}to{opacity:1}}` +
    `@media (prefers-reduced-motion:reduce){.flip{animation:none}}</style>` +
    `<rect x=".5" y=".5" rx="6" width="${W - 1}" height="${H - 1}" fill="${c.background}" ` +
    `stroke="${c.text}" stroke-opacity="${border ? 0.25 : 0}"/>` +
    `<text class="head" x="20" y="30">${esc(board.title)}</text>${heads.join('')}${rows}</svg>`
  );
}
