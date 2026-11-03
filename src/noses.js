// Plantillas de trompa. Cada una describe la parte delantera del coche cabeza como
// una cuadrícula de 20 filas (techo .. faldón) y `w` columnas, mirando a la derecha.
//
//   edge[y]  última columna ocupada en la fila y (la silueta base)
//   ops      pinturas sobre esa silueta, en orden:
//     ['r', x0, y0, x1, y1, c]   rectángulo (puede salirse de la silueta: defensas)
//     ['p', x, y, c]             un píxel
//     ['f', x0, y0, x1, y1, c]   marco de rectángulo
//     ['e', y0, y1, a, b, c]     por fila, columnas edge-a .. edge-b (sigue la inclinación)
//     ['ep', y, dx, c]           un píxel en edge[y] + dx
//
// Símbolos de color (los resuelve train.js):
//   s franja del modelo en esa fila   n pintura de trompa   f panel frontal
//   g cristal  G reflejo   o contorno  k defensa oscura   m cuerpo oscuro
//   l faro  y luz ámbar  r luz roja   q piloto rojo apagado   i letrero de destino
//   a franja del lenguaje   t franja fija   d oscuro   h cuerpo claro
// En la trompa de cola (la plantilla espejada) l, y y q se encienden en rojo.

export function buildNose(w, edge, ops) {
  if (edge.length !== 20) throw new Error(`buildNose: se esperaban 20 filas y llegaron ${edge.length}`);
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
