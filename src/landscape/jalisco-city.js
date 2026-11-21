import { line, polygon } from '../graphics/pixel-shapes.js';
import { rng } from '../graphics/pixel.js';

function arch(g, x, y, w, h, color) {
  g.rect(x + 1, y, w - 2, h, color);
  g.rect(x, y + 2, w, h - 2, color);
}

// Guadalajara Cathedral: octagonal tiled needles, paired bell openings,
// a ribbed crossing dome and the three portals of the west façade.
function bellTower(g, cx, base) {
  const y = base - 69;
  g.rect(cx - 6, y + 28, 13, 41, '@stone');
  g.rect(cx + 3, y + 28, 4, 41, '@stoneShade');
  for (const off of [30, 42, 54]) {
    g.rect(cx - 7, y + off, 15, 2, '@stoneLit');
    g.hline(cx - 6, y + off + 2, 13, '@recess');
    for (const x of [cx - 4, cx + 1]) arch(g, x, y + off + 4, 3, 6, '@recess');
    g.vline(cx - 3, y + off + 6, 2, '@glassWarm');
  }
  polygon(g, [[cx,y+3],[cx+6,y+25],[cx+5,y+28],[cx-5,y+28],[cx-6,y+25]], '@ochre');
  polygon(g, [[cx,y+3],[cx+1,y+24],[cx-4,y+27],[cx-6,y+25]], '@ochreLit');
  line(g, cx, y + 6, cx + 2, y + 25, '@stoneLit');
  for (const h of [18, 22, 25]) g.hline(cx - 2, y + h, 4, '@ochre');
  g.rect(cx - 7, y + 28, 15, 2, '@stoneLit');
  g.vline(cx, y, 5, '@stoneLit');
  g.hline(cx - 1, y + 1, 3, '@stoneLit');
}

function cathedral(g, x, base) {
  const domeX = x + 28;
  g.rect(domeX - 11, base - 36, 23, 21, '@stoneShade');
  polygon(g, [[domeX-14,base-35],[domeX-12,base-42],[domeX-7,base-47],
    [domeX,base-49],[domeX+7,base-47],[domeX+12,base-42],[domeX+14,base-35]], '@tower');
  for (const dx of [-10, -5, 5, 10]) line(g, domeX, base-48, domeX+dx, base-36, '@towerEdge');
  g.rect(domeX - 2, base - 52, 5, 5, '@stoneLit');
  g.vline(domeX, base - 55, 3, '@stoneLit');
  g.rect(x, base - 22, 50, 22, '@stone');
  polygon(g, [[x+4,base-22],[x+25,base-33],[x+46,base-22]], '@stoneLit');
  polygon(g, [[x+10,base-22],[x+25,base-29],[x+40,base-22]], '@stoneShade');
  g.rect(x + 2, base - 21, 46, 2, '@stoneLit');
  for (const dx of [11, 22, 33]) {
    arch(g, x + dx - 1, base - 15, 8, 15, '@stoneLit');
    arch(g, x + dx, base - 13, 6, 13, '@recess');
    g.vline(x + dx + 2, base - 10, 8, '@glassWarm');
  }
  bellTower(g, x + 1, base);
  bellTower(g, x + 49, base);
}

function stadium(g, x, base) {
  polygon(g, [[x,base-12],[x+7,base-16],[x+41,base-16],[x+50,base-12],
    [x+47,base-7],[x+40,base-6],[x+9,base-6],[x+2,base-9]], '@stoneShade');
  g.hline(x + 5, base - 12, 40, '@stoneLit');
  g.hline(x + 12, base - 14, 26, '@recess');
  for (let i = 4; i < 47; i += 7) line(g, x+i, base-8, x+i-2, base-1, '@stone');
}

function theatre(g, x, base) {
  g.rect(x + 1, base - 23, 48, 23, '@stoneShade');
  polygon(g, [[x-2,base-23],[x+24,base-34],[x+51,base-23]], '@stoneLit');
  polygon(g, [[x+6,base-24],[x+24,base-31],[x+42,base-24]], '@stoneShade');
  g.rect(x, base - 22, 50, 2, '@stoneLit');
  for (let dx = 2; dx < 48; dx += 6) {
    g.rect(x+dx, base-19, 3, 15, '@stone');
    g.vline(x+dx, base-19, 15, '@stoneLit');
  }
  g.hline(x - 1, base - 3, 53, '@stoneLit');
}

function skylineBlocks(g, base, random) {
  for (let x = -3; x < g.w; ) {
    const w = 7 + Math.floor(random() * 14);
    const h = 10 + Math.floor(random() * 11);
    g.rect(x, base-h, w, h, '@tower');
    g.hline(x, base-h, w, '@towerEdge');
    for (let wx=x+2; wx<x+w-1; wx+=4) {
      for (let wy=base-h+3; wy<base-3; wy+=4) if (random() > 0.55) g.hline(wx, wy, 2, '@stoneShade');
    }
    x += w + 1;
  }
}

function modernTowers(g, base) {
  for (const [x,w,h] of [[267,17,32],[291,13,39],[310,21,47],[340,18,35],[359,15,41]]) {
    g.rect(x, base-h, w, h, '@tower');
    g.rect(x+w-4, base-h+3, 4, h-3, '@ridgeShade');
    g.hline(x+1, base-h, w-3, '@towerEdge');
    for (let y=base-h+4; y<base; y+=4) g.hline(x+2,y,w-7,'@towerEdge');
  }
  g.vline(319, base-57, 10, '@towerEdge');
}

/** Draw the first track's city behind its station sign and catenary. */
export function paintGuadalajara(g, base) {
  const random = rng(907);
  for (let x=0; x<g.w; x++) {
    const h = Math.round(18 + 4*Math.sin(x/44) + 3*Math.sin(x/17));
    g.vline(x, base-h, h, '@ridge');
  }
  modernTowers(g, base);
  skylineBlocks(g, base, random);
  stadium(g, 34, base);
  cathedral(g, 97, base);
  theatre(g, 189, base);
  // A low row of arcades and a trimmed canopy around the plaza.
  for (const [x,w] of [[0,27],[155,31],[242,28],[381,43]]) {
    g.rect(x, base-12, w, 12, '@stoneShade');
    g.rect(x-1, base-14, w+2, 2, '@tile');
    for (let dx=2; dx<w-3; dx+=6) arch(g, x+dx, base-9, 4, 9, '@recess');
  }
  for (let x=4; x<g.w; x+=11+Math.floor(random()*12)) {
    g.rect(x,base-6,2,6,'@recess');
    g.rect(x-3,base-8,8,4,'@foliage');
    g.hline(x-2,base-9,6,'@foliageLit');
  }
  for (const x of [82, 157, 184, 243, 380]) {
    g.vline(x, base - 8, 7, '@recess');
    g.rect(x - 1, base - 10, 3, 3, '@stoneShade');
    g.vline(x, base - 10, 2, '@glassWarm');
  }
  g.hline(0, base-1, g.w, '@stoneShade');
}
