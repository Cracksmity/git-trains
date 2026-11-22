import { Grid } from '../graphics/pixel.js';

// Wind shears a repeating tile one pixel to the right per row. Wrapping the row
// before shearing also joins drops and hail rebounds that straddle the seam.
export function fallTile(width, h, wind) {
  const grid = new Grid(width, wind ? h : 2 * h);
  function pixel(x, y, ink) {
    const row = (y + h) % h;
    if (wind) {
      grid.set((x + row) % width, row, ink);
    } else {
      grid.set(x, row, ink);
      grid.set(x, row + h, ink);
    }
  }
  return { grid, pixel };
}

// The first tile is at (0, 0). These copies cover both horizontal edges during
// the slide and put the second period exactly (dx, h) away from the first.
export function windTileCopies(width, h, dx) {
  return [[width, 0], [dx - width, h], [dx, h]];
}
