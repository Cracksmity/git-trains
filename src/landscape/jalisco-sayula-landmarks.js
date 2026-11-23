import { line } from '../graphics/pixel-shapes.js';
import { arch } from './jalisco-centro.js';

/**
 * El Santuario de Guadalupe on its cerrito at the foot of the sierra, west of the plaza.
 * Cream-yellow facade with orange trim, a shorter left belfry under a plain orange dome,
 * a curved cream gable with a cross, a taller right belfry under a white-ribbed orange
 * dome and lantern, and a tabachín on the slope. Farther than the parroquia, so smaller.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} cx axis of the cerrito
 * @param {number} base rail row
 */
export function santuarioSayula(g, cx, base) {
  // A rounded cerrito with a flat crown for the church, a lit crest on its eastern side.
  const crown = 22;
  for (let x = cx - 26; x <= cx + 26; x++) {
    const t = (x - cx) / 26;
    const h = Math.min(crown, Math.round(12 + 11.5 * Math.cos((t * Math.PI) / 2) ** 0.8));
    g.vline(x, base - h, h, '@grassland');
    if (x < cx - 6) g.set(x, base - h, '@pasture');
  }
  const b = base - crown;
  const left = cx - 7;

  // Red-flowering tabachín on the eastern shoulder.
  const tree = cx - 15;
  const foot = base - Math.round(12 + 11.5 * Math.cos((((tree - cx) / 26) * Math.PI) / 2) ** 0.8);
  g.vline(tree, foot - 2, 3, '@recess');
  g.hline(tree - 2, foot - 3, 5, '@foliage');
  g.hline(tree - 3, foot - 4, 7, '@tabachin');
  g.hline(tree - 2, foot - 5, 5, '@tabachin');
  g.set(tree - 1, foot - 6, '@tabachin');
  g.set(tree + 1, foot - 6, '@tabachin');

  // Facade (15 px) with an orange foot band and cornice.
  g.rect(left, b - 4, 15, 4, '@santuarioWall');
  g.hline(left, b - 1, 15, '@santuarioTrim');
  g.hline(left, b - 4, 15, '@santuarioTrim');

  // Central portal: dark door in an orange frame under a curved cream gable and its cross.
  g.rect(left + 6, b - 3, 3, 3, '@santuarioTrim');
  g.vline(left + 7, b - 3, 3, '@recess');
  g.hline(left + 5, b - 5, 5, '@santuarioWall');
  g.hline(left + 6, b - 6, 3, '@santuarioWall');
  for (const [dx, dy] of [[5, 5], [9, 5], [6, 6], [8, 6], [7, 7]]) g.set(left + dx, b - dy, '@santuarioTrim');
  g.vline(left + 7, b - 10, 3, '@recess');
  g.hline(left + 6, b - 9, 3, '@recess');

  // Left tower (shorter): white belfry with one arch and its bell, plain orange dome.
  g.rect(left, b - 8, 5, 4, '@santuarioWhite');
  g.rect(left + 1, b - 7, 3, 2, '@recess');
  g.set(left + 2, b - 6, '@ochreLit');
  g.hline(left, b - 9, 5, '@domeOrange');
  g.hline(left + 1, b - 10, 3, '@domeOrange');
  g.set(left + 2, b - 11, '@domeOrange');
  g.set(left + 2, b - 12, '@recess');

  // Right tower (taller): white belfry between pilasters, ribbed orange dome and lantern.
  const r = left + 10;
  g.rect(r, b - 10, 5, 6, '@santuarioWhite');
  g.rect(r + 1, b - 9, 3, 3, '@recess');
  g.set(r + 2, b - 8, '@ochreLit');
  for (const [dy, from, w] of [[11, 0, 5], [12, 0, 5], [13, 1, 3]]) {
    g.hline(r + from, b - dy, w, '@domeOrange');
    for (let dx = from + 1; dx < from + w; dx += 2) g.set(r + dx, b - dy, '@domeRib');
  }
  g.set(r + 2, b - 14, '@santuarioWhite');
  g.set(r + 2, b - 15, '@domeOrange');
  g.set(r + 2, b - 16, '@recess');
}

/**
 * La Parroquia de la Inmaculada Concepción in cantera rosa: an old stone nave behind,
 * a single tall tower on the left crowned by a golden tiled dome, and a projecting baroque
 * portal with paired columns, a curved scalloped gable, niche and finials on the right.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} tx center column of the bell tower
 * @param {number} b ground row
 */
export function parroquiaSayula(g, tx, b) {
  // The old stone nave runs back behind the portal: low, darker and weathered, with buttresses.
  const naveX = tx + 18;
  g.rect(naveX, b - 11, 16, 11, '@stoneShade');
  g.hline(naveX, b - 11, 16, '@stone');
  for (const dx of [5, 11]) g.vline(naveX + dx, b - 10, 10, '@recess');
  for (const dx of [2, 8, 13]) {
    g.rect(naveX + dx, b - 8, 2, 3, '@recess');
    g.vline(naveX + dx, b - 7, 2, '@glassWarm');
  }

  // Projecting baroque frontispiece to the right of the tower.
  const px = tx + 15;
  g.rect(px - 8, b - 16, 17, 16, '@cantera');
  g.rect(px + 6, b - 16, 3, 16, '@canteraShade');
  // Lower tier: dark arched door framed by paired columns.
  arch(g, px - 2, b - 7, 5, 7, '@recess');
  g.vline(px, b - 5, 4, '@glassWarm');
  for (const dx of [-6, -4, 4, 6]) {
    g.vline(px + dx, b - 8, 8, '@canteraLit');
    g.vline(px + dx + 1, b - 8, 8, '@canteraShade');
  }
  // Mid entablature and upper tier: choir window between paired columns.
  g.hline(px - 8, b - 9, 17, '@canteraLit');
  g.hline(px - 8, b - 8, 17, '@canteraShade');
  g.rect(px - 1, b - 14, 3, 4, '@recess');
  g.vline(px, b - 13, 2, '@glassWarm');
  for (const dx of [-5, -3, 3, 5]) {
    g.vline(px + dx, b - 15, 6, '@canteraLit');
    g.vline(px + dx + 1, b - 15, 6, '@canteraShade');
  }
  g.hline(px - 8, b - 16, 17, '@canteraLit');
  // Curved scalloped gable crowned by a niche and finials resting on the steps.
  for (const [dy, half] of [[17, 7], [18, 5], [19, 4], [20, 2], [21, 1]]) {
    g.hline(px - half, b - dy, 2 * half + 1, '@cantera');
    g.set(px - half, b - dy, '@canteraLit');
    g.set(px + half, b - dy, '@canteraShade');
  }
  g.hline(px - 1, b - 21, 3, '@canteraLit');
  g.vline(px, b - 19, 2, '@recess');
  g.set(px, b - 18, '@canteraLit');
  for (const [dx, dy] of [[-7, 18], [7, 18], [-4, 20], [4, 20]]) g.vline(px + dx, b - dy - 1, 2, '@canteraLit');
  g.vline(px, b - 23, 2, '@canteraLit');

  // Single tall tower on the left: plain ashlar lower shaft, two stepped belfries, drum and golden dome.
  g.rect(tx - 6, b - 10, 13, 10, '@cantera');
  g.rect(tx + 4, b - 10, 3, 10, '@canteraShade');
  g.vline(tx - 6, b - 10, 10, '@canteraLit');
  g.hline(tx - 7, b - 11, 15, '@canteraLit');

  // First belfry stage: two arched openings with bells between pilasters and corner finials.
  g.rect(tx - 5, b - 17, 11, 6, '@cantera');
  g.rect(tx + 3, b - 17, 3, 6, '@canteraShade');
  for (const dx of [-5, 0]) g.vline(tx + dx, b - 17, 6, '@canteraLit');
  for (const ax of [tx - 4, tx + 1]) {
    arch(g, ax, b - 16, 3, 5, '@recess');
    g.set(ax + 1, b - 14, '@domeGold');
  }
  for (const dx of [-6, 6]) g.vline(tx + dx, b - 13, 2, '@canteraLit');
  g.hline(tx - 6, b - 18, 13, '@canteraLit');

  // Second belfry stage (narrower): central arched opening and side bays, corner finials.
  g.rect(tx - 4, b - 23, 9, 5, '@cantera');
  g.rect(tx + 2, b - 23, 3, 5, '@canteraShade');
  for (const dx of [-4, -2, 2]) g.vline(tx + dx, b - 23, 5, '@canteraLit');
  arch(g, tx - 1, b - 22, 3, 4, '@recess');
  g.set(tx, b - 20, '@domeGold');
  for (const dx of [-3, 3]) g.vline(tx + dx, b - 21, 3, '@recess');
  for (const dx of [-5, 5]) g.vline(tx + dx, b - 20, 2, '@canteraLit');
  g.hline(tx - 5, b - 24, 11, '@canteraLit');

  // Octagonal drum with corner finials on the parapet below.
  g.rect(tx - 3, b - 26, 7, 2, '@cantera');
  g.vline(tx - 3, b - 26, 2, '@canteraLit');
  g.rect(tx + 2, b - 26, 2, 2, '@canteraShade');
  for (const dx of [-1, 1]) g.set(tx + dx, b - 25, '@recess');
  for (const dx of [-4, 4]) g.vline(tx + dx, b - 26, 2, '@canteraLit');

  // Golden tiled dome with darker ribs, lantern and cross (reaches base - 39).
  for (const { dy, half, ribs } of [
    { dy: 27, half: 3, ribs: [-1, 2] },
    { dy: 28, half: 3, ribs: [-1, 2] },
    { dy: 29, half: 2, ribs: [-1, 1] },
    { dy: 30, half: 1, ribs: [1] },
  ]) {
    g.hline(tx - half, b - dy, 2 * half + 1, '@domeGold');
    for (const r of ribs) g.set(tx + r, b - dy, '@domeGoldShade');
  }
  g.hline(tx - 1, b - 31, 3, '@canteraLit');
  g.set(tx, b - 31, '@recess');
  g.hline(tx - 1, b - 32, 3, '@domeGold');
  g.set(tx + 1, b - 32, '@domeGoldShade');
  g.vline(tx, b - 35, 3, '@recess');
  g.hline(tx - 1, b - 34, 3, '@recess');
}

/**
 * Sayula's octagonal plaza kiosk: vermilion base with white rectangles, corner blocks
 * and a side stair; dark iron railing with light lyre motifs; six slender iron columns
 * with a hanging fringe; red corrugated metal roof, louvered lantern and weathervane.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} cx kiosk axis
 * @param {number} b ground row
 */
export function kioskSayula(g, cx, b) {
  // Raised vermilion-orange octagonal base: a white cornice, white quoins at the corners
  // and facet edges, and a dark door framed in white on the front facet.
  g.rect(cx - 12, b - 5, 25, 5, '@kioskBase');
  g.hline(cx - 12, b - 5, 25, '@kioskTrim');
  for (const dx of [-12, -6, 6, 12]) {
    for (const dy of [4, 2]) g.set(cx + dx, b - dy, '@kioskTrim');
  }
  g.rect(cx - 1, b - 4, 3, 4, '@recess');
  for (const dx of [-2, 2]) g.vline(cx + dx, b - 4, 4, '@kioskTrim');

  // Short stair on the left with white treads and a dark iron handrail.
  for (let s = 0; s < 4; s++) {
    const sx = cx - 16 + s;
    g.vline(sx, b - 1 - s, s + 1, '@kioskBase');
    g.set(sx, b - 1 - s, '@kioskTrim');
  }
  line(g, cx - 16, b - 3, cx - 12, b - 7, '@ironwork');
  g.vline(cx - 16, b - 3, 2, '@ironwork');

  // Dark iron railing with light lyre motifs, and six slender columns rising to the eaves.
  g.hline(cx - 12, b - 8, 25, '@ironwork');
  g.hline(cx - 12, b - 6, 25, '@ironwork');
  for (let dx = -12; dx <= 12; dx++) {
    if (dx % 2 === 0) g.set(cx + dx, b - 7, '@ironwork');
  }
  for (const dx of [-9, -3, 0, 3, 9]) g.set(cx + dx, b - 7, '@kioskTrim');
  for (const dx of [-12, -8, -3, 3, 8, 12]) g.vline(cx + dx, b - 14, 9, '@ironwork');

  // Eaves bar and ornate scalloped iron fringe hanging under the roof edge.
  g.hline(cx - 13, b - 14, 27, '@ironwork');
  for (let dx = -13; dx <= 13; dx += 2) g.set(cx + dx, b - 13, '@ironwork');
  for (const dx of [-11, -7, -4, 4, 7, 11]) g.set(cx + dx, b - 12, '@ironwork');

  // Octagonal roof of red corrugated metal with fine vertical ribs.
  for (const [dy, half] of [[15, 14], [16, 12], [17, 10], [18, 7], [19, 4]]) {
    g.hline(cx - half, b - dy, 2 * half + 1, '@kioskRoof');
    for (let dx = -half + 1; dx <= half; dx += 2) {
      g.set(cx + dx, b - dy, '@kioskRoofShade');
    }
  }

  // Small octagonal lantern with louvers, its own little corrugated roof and a weathervane.
  g.rect(cx - 3, b - 21, 7, 2, '@kioskTrim');
  for (const dx of [-2, 0, 2]) g.vline(cx + dx, b - 21, 2, '@ironwork');
  g.hline(cx - 4, b - 22, 9, '@kioskRoof');
  for (const dx of [-3, -1, 1, 3]) g.set(cx + dx, b - 22, '@kioskRoofShade');
  g.hline(cx - 2, b - 23, 5, '@kioskRoof');
  g.set(cx - 1, b - 23, '@kioskRoofShade');
  g.set(cx + 1, b - 23, '@kioskRoofShade');
  g.set(cx, b - 24, '@kioskRoof');
  // Slender weathervane: vertical mast, horizontal arrow and swallowtail fin.
  g.vline(cx, b - 27, 3, '@ironwork');
  g.hline(cx - 2, b - 26, 5, '@ironwork');
  g.set(cx - 2, b - 27, '@ironwork');
}
