import { rng } from '../graphics/pixel.js';
import { arch, cathedral, sagrario, teatroDegollado } from './jalisco-centro.js';
import { estadioJalisco, hospicioCabanas, laMinerva } from './jalisco-landmarks.js';
import { glassOffices, redCrownTower, wedgeTower } from './jalisco-towers.js';

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

/** Draw the first track's city behind its station sign and catenary. */
export function paintGuadalajara(g, base) {
  const random = rng(907);
  for (let x=0; x<g.w; x++) {
    const h = Math.round(18 + 4*Math.sin(x/44) + 3*Math.sin(x/17));
    g.vline(x, base-h, h, '@ridge');
  }
  // The modern west side rises behind the historic centre.
  glassOffices(g, 300, base);
  wedgeTower(g, 334, base);
  redCrownTower(g, 369, base);
  skylineBlocks(g, base, random);
  estadioJalisco(g, 26, base);
  // West to east along the historic axis: Cathedral and Sagrario, Degollado, Cabañas.
  // The Sagrario goes first, so the Cathedral's right tower overlaps where they join.
  sagrario(g, 150, base);
  cathedral(g, 122, base);
  teatroDegollado(g, 202, base);
  hospicioCabanas(g, 262, base);
  // A low row of arcades and a trimmed canopy around the plaza.
  for (const [x,w] of [[0,19],[418,30]]) {
    g.rect(x, base-12, w, 12, '@stoneShade');
    g.rect(x-1, base-14, w+2, 2, '@tile');
    for (let dx=2; dx<w-3; dx+=6) arch(g, x+dx, base-9, 4, 9, '@recess');
  }
  for (let x=4; x<g.w; x+=11+Math.floor(random()*12)) {
    g.rect(x,base-6,2,6,'@recess');
    g.rect(x-3,base-8,8,4,'@foliage');
    g.hline(x-2,base-9,6,'@foliageLit');
  }
  for (const x of [88, 194, 258, 326, 380]) {
    g.vline(x, base - 8, 7, '@recess');
    g.rect(x - 1, base - 10, 3, 3, '@stoneShade');
    g.vline(x, base - 10, 2, '@glassWarm');
  }
  // The fountain stands in its roundabout, in front of the trees.
  laMinerva(g, 398, base);
  g.hline(0, base-1, g.w, '@stoneShade');
}
