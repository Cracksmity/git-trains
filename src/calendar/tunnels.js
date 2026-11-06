// Tunnels at the ends of the calendar rows. The train runs along a row, goes
// into a hill at the end and comes out of the same hill one row down, going the
// other way; so a hill on the side covers two rows, except the first entrance
// (top left) and the last exit (bottom right), which cover one.
//
// The train is clipped to the space between the tunnel mouths (see calendar.js),
// so it never shows while it turns around, whatever the page behind looks like.
// The hills only need a mouth where each row meets them, at the grid's edge.
//
// Everything is drawn with theme colors, so the tunnels follow light and dark
// like the rest of the calendar.

// Heights across eight steps, from the outer slope towards the grid. The toes
// rise on the outside too, leaving a little daylight between neighboring hills.
const RIDGES = [
  [4, 0, -3, -5, -6, -5, -3, -4],
  [3, -1, -4, -6, -5, -4, -3, -4],
  [5, 1, -2, -4, -5, -6, -4, -4],
];
const TOES = [7, 5, 4, 4, 4, 4, 2, 0];

// Local x runs towards the grid; mirroring keeps both portals facing the rails.
function paintHill(g, { side, x0, x1, mouthRows, cellH, up, variant }) {
  const w = x1 - x0;
  const rect = (x, y, width, height, color) => {
    const start = Math.max(0, x);
    const end = Math.min(w, x + width);
    g.rect(side === 'left' ? x0 + start : x1 - end, y, end - start, height, color);
  };
  const first = mouthRows[0];
  const bottom = mouthRows[mouthRows.length - 1] + cellH - 1;
  const ridge = RIDGES[variant % RIDGES.length];

  for (let x = 2; x < w; x++) {
    const step = Math.min(7, Math.floor(x * 8 / w));
    const top = first + ridge[step];
    const foot = bottom - TOES[step];
    if (top > foot) continue;
    rect(x, top, 1, foot - top + 1, '@hill');
    rect(x, top, 1, 1, '@grass');
    rect(x, Math.max(top + 1, foot - 2), 1, Math.min(3, foot - top), '@hill2');
  }

  // A broad grassy ledge and one small plant, rather than scattered pixels.
  rect(w - 20, first + 2, 7, 1, '@grass');
  if (mouthRows.length > 1 && variant % 2 === 0) {
    const tree = w - 25;
    rect(tree, first, 2, 5, '@stone2');
    rect(tree - 1, first - 5, 4, 2, '@hill2');
    rect(tree - 3, first - 3, 8, 4, '@hill2');
    rect(tree - 2, first - 3, 4, 2, '@grass');
    rect(tree - 1, first + 5, 5, 1, '@hill2');
  } else {
    const bush = w - 25 + variant % 3;
    rect(bush + 1, first - 1, 4, 1, '@grass');
    rect(bush, first, 6, 3, '@hill2');
    rect(bush + 1, first, 3, 1, '@hill');
  }

  for (const rowY of mouthRows) {
    // A side-on masonry arch: stepped crown, shaded jamb, and a dark opening
    // reaching the grid edge. The opening includes the locomotive's chimney.
    const roof = rowY - up;
    rect(w - 7, roof - 1, 7, 1, '@stone');
    rect(w - 9, roof, 9, 1, '@stone');
    rect(w - 10, roof + 1, 10, 1, '@stone');
    rect(w - 11, roof + 2, 11, cellH + up - 2, '@stone2');
    rect(w - 11, roof + 2, 1, cellH + up - 2, '@stone');
    rect(w - 6, roof, 6, 1, '@mouth');
    rect(w - 8, roof + 1, 8, 1, '@mouth');
    rect(w - 9, roof + 2, 9, cellH + up - 2, '@mouth');
    // Two large blocks suggest masonry without a noisy brick pattern.
    rect(w - 11, rowY + 3, 2, 1, '@hill2');
    rect(w - 11, rowY + 7, 2, 1, '@hill2');
    rect(w - 11, rowY + cellH, 11, 1, '@stone2');
  }
}

// Paints every tunnel of the calendar on `g`.
// layout: { width, left, right, rowTops: [y of each row], cellH, up }
export function paintTunnels(g, { width, left, right, rowTops, cellH, up }) {
  const last = rowTops.length - 1;
  const hill = (side, r0, r1) =>
    paintHill(g, {
      side,
      x0: side === 'left' ? 0 : right,
      x1: side === 'left' ? left : width,
      mouthRows: r0 === r1 ? [rowTops[r0]] : [rowTops[r0], rowTops[r1]],
      cellH,
      up,
      variant: Math.floor(r0 / 2) + (side === 'left' ? 0 : 2),
    });
  hill('left', 0, 0);
  for (let r = 1; r < last; r += 2) hill('left', r, r + 1);
  for (let r = 0; r < last; r += 2) hill('right', r, r + 1);
  hill('right', last, last);
}
