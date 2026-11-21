import { line, polygon } from '../graphics/pixel-shapes.js';
import { TOP } from './geometry.js';
import { partColor } from './palette.js';
import { drawBogie } from './running-gear.js';

function windowPane(ctx, x, y, w, h, tint) {
  const g = ctx.layers.body;
  g.rect(x - 1, y - 1, w + 2, h + 2, '#232b32');
  g.rect(x, y, w, h, tint);
  g.hline(x, y, w - 1, ctx.model.pal.glassHi);
  ctx.panes.push({ x, y: y + 1, w, h: h - 1 });
}

function bellows(g, x) {
  g.rect(x - 2, TOP + 1, 5, 18, '#373337');
  for (const dx of [-1, 1]) g.vline(x + dx, TOP + 2, 16, '#726968');
}

function teg(ctx, car) {
  const { layers: { body: g, open }, model } = ctx;
  const { ox, w, isTail, isCab, artRear, artFront } = car;
  const p = model.pal;
  const end = ox + w;
  const left = ox + (isTail ? model.nose.w : 1);
  const right = end - (isCab ? model.nose.w : 1);
  g.rect(left, TOP, right - left, 20, p.outline);
  g.rect(left, TOP + 1, right - left, 17, p.body);
  g.hline(left, TOP + 1, right - left, p.roofHi);
  g.rect(left, TOP + 3, right - left, 8, p.upper);
  g.rect(left, TOP + 11, right - left, 2, p.trim);
  g.hline(left, TOP + 17, right - left, p.door);
  g.hline(left, TOP + 18, right - left, p.body);
  for (let row = 0; row < 4; row++) {
    const panelStart = left + Math.floor((right - left) * 0.42) + 4 - row;
    g.hline(panelStart, TOP + 13 + row, right - 5 - panelStart, p.door);
  }
  for (const [front, mirror] of [[isCab, false], [isTail, true]]) {
    if (!front) continue;
    model.nose.rows.forEach((row, y) => {
      const tip = row.indexOf('.') < 0 ? row.length - 1 : row.indexOf('.') - 1;
      for (let i = 0; i <= tip; i++) {
        const c = row[i];
        const x = mirror ? left - 1 - i : right + i;
        const tail = mirror && (c === 'l' || c === 'y');
        const color = partColor(model, model.nose, tail ? 'r' : c, y, ctx.stripe);
        g.set(x, TOP + y, y === 0 || i === tip ? p.outline : color);
      }
    });
  }
  const center = Math.floor((left + right) / 2);
  const vent = isCab ? right - 16 : left + 6;
  g.rect(vent, TOP - 2, 13, 2, p.bodyLo);
  g.hline(vent + 1, TOP - 3, 11, p.bodyHi);
  for (let x = vent + 2; x < vent + 12; x += 3) g.set(x, TOP - 2, '#474b55');
  g.rect(center - 6, TOP + 20, 13, 3, '#494750');
  g.hline(center - 5, TOP + 20, 11, '#716c72');
  // Each half has its own double door and a narrow cab-side window.
  for (const doorX of [left + 5, right - 13]) {
    g.rect(doorX, TOP + 3, 8, 15, p.outline);
    for (const dx of [1, 4]) {
      g.rect(doorX + dx, TOP + 4, 2, 13, p.door);
      g.rect(doorX + dx, TOP + 4, 2, 7, p.glass);
      g.rect(doorX + dx, TOP + 11, 2, 2, p.trim);
    }
    open.rect(doorX + 1, TOP + 4, 5, 13, '#d8b87c');
    open.hline(doorX + 1, TOP + 16, 5, '#94745d');
  }
  for (const [start, stop] of [[left + 14, center - 3], [center + 4, right - 14]]) {
    for (let x = start; x + 2 < stop; x += 8) {
      windowPane(ctx, x, TOP + 4, Math.min(6, stop - x), 6, p.glass);
    }
  }
  for (const dy of [14, 16]) g.hline(right - 21, TOP + dy, 6, '#737b7d');
  if (isTail && isCab) {
    bellows(g, center);
    drawBogie(ctx, center);
  } else if (!isTail) bellows(g, ox + 1);
  if (!artRear) drawBogie(ctx, ox + (isTail ? 17 : 13));
  else drawBogie(ctx, ox);
  if (!artFront) drawBogie(ctx, end - (isCab ? 17 : 14));
  g.hline(left + 2, TOP + 20, Math.min(9, right - left - 4), ctx.stripe);
  if (isCab) {
    const px = center - 5;
    line(g, px - 3, TOP - 1, px + 5, TOP - 4, '#8c8890');
    line(g, px + 5, TOP - 4, px - 1, TOP - 8, '#b2aaad');
    g.hline(px - 5, TOP - 8, 9, '#e0d8d0');
    g.rect(px - 6, TOP - 2, 14, 2, '#53545d');
    ctx.pantAnchor = { x: px, y: TOP - 8 };
  }
}

function hopper(ctx, { ox, w }) {
  const g = ctx.layers.body;
  const p = ctx.model.pal;
  const x = ox + 1;
  const y = TOP + 3;
  const end = ox + w - 3;
  g.rect(x + 2, y, w - 7, 11, p.body);
  g.hline(x + 4, y - 1, w - 11, p.outline);
  g.hline(x + 3, y, w - 9, p.bodyHi);
  for (const dx of [7, 24, 41]) {
    polygon(g, [[x+dx-4,y+10],[x+dx+15,y+10],[x+dx+9,y+18],[x+dx+4,y+18]], p.bodyLo);
    polygon(g, [[x+dx+10,y+11],[x+dx+15,y+10],[x+dx+9,y+18],[x+dx+7,y+18]], '#776c61');
    g.hline(x + dx + 4, y + 17, 7, p.outline);
    g.hline(x + dx + 5, y + 16, 6, p.bodyHi);
  }
  for (let rib = x + 4; rib < end; rib += 9) {
    g.vline(rib, y + 1, 10, p.bodyHi);
    g.vline(rib + 1, y + 2, 9, p.bodyLo);
    g.hline(rib, y - 2, 6, '#a39685');
  }
  g.hline(x + 2, y + 10, w - 7, '#8e7d6f');
  g.rect(x, TOP + 19, w - 2, 2, '#4e4b47');
  g.vline(end - 2, y + 1, 14, p.outline);
  g.vline(end + 1, y + 1, 14, p.outline);
  for (let r = 2; r < 14; r += 3) g.hline(end - 2, y + r, 4, '#8a8176');
  g.hline(x + 5, TOP + 19, 5, ctx.stripe);
}

function saloon(ctx, { ox, w, isTail }) {
  const g = ctx.layers.body;
  const p = ctx.model.pal;
  g.rect(ox + 1, TOP + 4, w - 3, 16, p.outline);
  g.rect(ox + 2, TOP + 4, w - 5, 15, p.body);
  g.rect(ox + 2, TOP + 3, w - 5, 3, p.roof);
  g.hline(ox + 3, TOP + 3, w - 7, p.roofHi);
  g.hline(ox + 2, TOP + 6, w - 5, p.trim);
  for (let x = ox + 5; x + 6 < ox + w - 6; x += 8) {
    windowPane(ctx, x, TOP + 8, 6, 6, p.glass);
    g.vline(x + 5, TOP + 9, 5, '#956948');
  }
  g.hline(ox + 3, TOP + 15, w - 7, p.bodyLo);
  g.hline(ox + 3, TOP + 18, w - 7, p.trim);
  g.rect(ox + w - 7, TOP + 7, 3, 11, p.door);
  g.rect(ox + w - 7, TOP + 8, 3, 5, '#b59868');
  if (isTail) {
    g.set(ox + 3, TOP + 14, '#ff8061');
    g.vline(ox + 1, TOP + 12, 6, p.trim);
    g.hline(ox, TOP + 18, 4, '#786950');
  }
  g.hline(ox + 6, TOP + 19, 5, ctx.stripe);
}

/** Paint a regular Jalisco car in the normal train layers, including its running gear. */
export function drawJaliscoCar(ctx, car) {
  if (ctx.model.coach === 'teg') return teg(ctx, car);
  if (ctx.model.coach === 'hopper') hopper(ctx, car);
  else saloon(ctx, car);
  drawBogie(ctx, car.ox + 13);
  drawBogie(ctx, car.ox + car.w - 14);
}
