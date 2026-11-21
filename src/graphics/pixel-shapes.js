// Integer line and filled polygon for silhouettes on the same grid as the trains.
export function line(g, x0, y0, x1, y1, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (!steps) return g.set(x0, y0, color);
  for (let i = 0; i <= steps; i++) {
    g.set(x0 + Math.round((x1 - x0) * i / steps), y0 + Math.round((y1 - y0) * i / steps), color);
  }
}

export function polygon(g, points, color) {
  const ys = points.map((p) => p[1]);
  for (let y = Math.max(0, Math.min(...ys)); y <= Math.min(g.h - 1, Math.max(...ys)); y++) {
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) {
        intersections.push(x0 + (x1 - x0) * (y - y0) / (y1 - y0));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const x = Math.ceil(intersections[i]);
      g.hline(x, y, Math.floor(intersections[i + 1]) - x + 1, color);
    }
  }
}
