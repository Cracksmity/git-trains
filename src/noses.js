// Nose templates. Each describes the front of the lead car as
// a grid of 20 rows (roof .. skirt) and `w` columns, facing right.
//
//   edge[y]  last occupied column in row y (the base silhouette)
//   ops      paint operations on that silhouette, in order:
//     ['r', x0, y0, x1, y1, c]   rectangle (can extend beyond the silhouette: bumpers)
//     ['p', x, y, c]             one pixel
//     ['f', x0, y0, x1, y1, c]   rectangle frame
//     ['e', y0, y1, a, b, c]     per row, columns edge-a .. edge-b (follows the slope)
//     ['ep', y, dx, c]           one pixel at edge[y] + dx
//
// Color symbols (resolved by train.js):
//   s model stripe at that row   n nose paint   f front panel
//   g glass  G reflection   o outline  k dark bumper   m dark body
//   l headlight  y amber light  r red light   q unlit red marker light   i destination sign
//   a language stripe   t fixed stripe   d dark   h light body
// On the tail nose (the mirrored template), l, y and q light up red.

export function buildNose(w, edge, ops) {
  if (edge.length !== 20) throw new Error(`buildNose: expected 20 rows but got ${edge.length}`);
  const rows = edge.map((e) => Array.from({ length: w }, (_, x) => (x <= e ? 's' : '.')));
  const put = (x, y, c) => {
    if (y >= 0 && y < 20 && x >= 0 && x < w) rows[y][x] = c;
  };
  for (const [op, ...a] of ops) {
    if (op === 'r') {
      const [x0, y0, x1, y1, c] = a;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c);
    } else if (op === 'p') {
      put(a[0], a[1], a[2]);
    } else if (op === 'f') {
      const [x0, y0, x1, y1, c] = a;
      for (let x = x0; x <= x1; x++) {
        put(x, y0, c);
        put(x, y1, c);
      }
      for (let y = y0; y <= y1; y++) {
        put(x0, y, c);
        put(x1, y, c);
      }
    } else if (op === 'e') {
      const [y0, y1, from, to, c] = a;
      for (let y = y0; y <= y1; y++) for (let x = edge[y] - from; x <= edge[y] - to; x++) put(x, y, c);
    } else if (op === 'ep') {
      put(edge[a[0]] + a[1], a[0], a[2]);
    } else {
      throw new Error(`buildNose: operación desconocida "${op}"`);
    }
  }
  return { w, rows: rows.map((r) => r.join('')) };
}
