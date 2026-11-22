// Rare snowfall over Jalisco, remembering 13 December 1997 in Guadalajara
// and the winters that whiten the upper slopes of the Volcán de Tequila.
import { capRoofs } from '../scene/snow.js';

const isForeground = (ink) => ink === '@mast' || ink === '@wire' || (typeof ink === 'string' && ink[0] === '#');

const DISTANT_CITY = new Set([null, '@tower', '@towerEdge', '@towerLit', '@ridge']);
const STADIUM_ROOF = new Set(['@roofWhite']);
const CATHEDRAL_ROOFS = new Set(['@tileBlue', '@ochre', '@ochreLit', '@stoneLit', '@stoneShade']);
const HISTORIC_ROOFS = new Set(['@tile', '@tileLit', '@slate', '@slateLit', '@stoneLit']);
const ARCADE_ROOFS = new Set(['@tile']);
const SPIRE_INKS = new Set(['@tileBlue', '@ochre', '@ochreLit']);

const SKY = ['@dusk', '@haze', '@afterglow', '@starlight'];
const HILL_ABOVE = new Set([...SKY, '@ridge', '@grassland', '@earth', '@earthLit', '@pasture']);
const TILE = new Set(['@tile', '@tileLit']);
const EARTH = new Set(['@earth', '@earthLit']);
const VOLCANO = new Set(['@ridgeShade', '@ridge', '@rimLit', '@rimShade']);
const AGAVE = new Set(['@agave', '@agaveLit', '@agaveFar', '@agaveShade']);
const AGAVE_BODY = new Set(['@agave', '@agaveLit', '@agaveFar']);

/**
 * Guadalajara: snow resting on the Cathedral's spires and roofs, the stadium's
 * roof, historic domes and pediments, plaza trees and the plaza row.
 */
export function citySnow(g, band, backdrop) {
  const base = band.base;
  const openCity = (ink) => DISTANT_CITY.has(ink);

  // Estadio Jalisco: a crisp snow blanket on top of the white roof ring, leaving the trusses clear.
  capRoofs(g, backdrop, { fromX: 25, toX: 85, fromY: 1, toY: base, roofs: STADIUM_ROOF, above: openCity, ink: '@wSnow', firstOnly: true });
  for (let x = 25; x <= 84; x++) {
    for (let y = 1; y < base; y++) {
      if (backdrop.get(x, y) !== '@roofWhite') continue;
      if (g.get(x, y - 1) === '@wSnow') {
        g.set(x, y, '@wSnowShade');
        if (openCity(backdrop.get(x, y - 2)) && x % 5 !== 0 && x > 26 && x < 83) {
          g.set(x, y - 2, '@wSnow');
        }
      }
      break;
    }
  }

  // Cathedral: snow on the twin spires, pinnacles, cornices, clock tower and curved gable.
  capRoofs(g, backdrop, { fromX: 91, toX: 154, fromY: 1, toY: base, roofs: CATHEDRAL_ROOFS, above: openCity, ink: '@wSnow', firstOnly: true });
  for (const cx of [98, 146]) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      for (let y = base - 74; y <= base - 45; y++) {
        if (!SPIRE_INKS.has(backdrop.get(x, y))) continue;
        // Trace the steep blue-tile ribs with snow while keeping the yellow spire faces visible.
        if (backdrop.get(x, y) === '@tileBlue') {
          if (openCity(backdrop.get(x, y - 1))) g.set(x, y - 1, '@wSnow');
          g.set(x, y, x <= cx ? '@wSnow' : '@wSnowShade');
          if (backdrop.get(x, y + 1) === '@tileBlue') g.set(x, y + 1, x < cx ? '@wSnow' : '@wSnowShade');
        }
        break;
      }
    }
    // Snow ledges along the tower cornices where open to the sky.
    for (const cy of [base - 45, base - 37, base - 26]) {
      for (let x = cx - 7; x <= cx + 7; x++) {
        if (backdrop.get(x, cy) === '@stoneLit' && openCity(backdrop.get(x, cy - 1))) {
          g.set(x, cy - 1, '@wSnow');
        }
      }
    }
  }

  // Sagrario, Teatro Degollado, Hospicio Cabañas and the plaza arcades.
  capRoofs(g, backdrop, { fromX: 154, toX: 190, fromY: 1, toY: base, roofs: HISTORIC_ROOFS, above: openCity, ink: '@wSnow', firstOnly: true });
  capRoofs(g, backdrop, { fromX: 198, toX: 256, fromY: 1, toY: base, roofs: HISTORIC_ROOFS, above: openCity, ink: '@wSnow', firstOnly: true });
  capRoofs(g, backdrop, { fromX: 261, toX: 322, fromY: 1, toY: base, roofs: HISTORIC_ROOFS, above: openCity, ink: '@wSnow', firstOnly: true });
  capRoofs(g, backdrop, { fromX: 0, toX: 20, fromY: base - 20, toY: base, roofs: ARCADE_ROOFS, above: openCity, ink: '@wSnow', firstOnly: true });
  capRoofs(g, backdrop, { fromX: 417, toX: g.w, fromY: base - 20, toY: base, roofs: ARCADE_ROOFS, above: openCity, ink: '@wSnow', firstOnly: true });

  // Soft snow on the upper crowns of the Sagrario and Cabañas domes.
  const domes = [
    { x0: 164, x1: 178, topY: base - 46, botY: base - 42, inks: TILE },
    { x0: 285, x1: 299, topY: base - 44, botY: base - 40, inks: new Set(['@slate', '@slateLit']) },
  ];
  for (const { x0, x1, topY, botY, inks } of domes) {
    for (let x = x0; x <= x1; x++) {
      for (let y = topY; y <= botY; y++) {
        if (!inks.has(backdrop.get(x, y))) continue;
        g.set(x, y, y <= topY + 2 ? '@wSnow' : '@wSnowShade');
      }
    }
  }

  // Plaza trees catch snow along their lit top edge.
  for (let y = base - 12; y < base; y++) {
    for (let x = 0; x < g.w; x++) {
      if (backdrop.get(x, y) === '@foliageLit') g.set(x, y, '@wSnow');
    }
  }

  // Crisp snow rim on Minerva's fountain basin ledge (leaving the blue water clear).
  for (let x = 384; x <= 412; x++) {
    if (backdrop.get(x, base - 5) === '@stoneLit' && backdrop.get(x, base - 4) === '@water') {
      g.set(x, base - 5, '@wSnow');
    }
  }

  // Even snow blanket along the plaza row, keeping masts and signals clear.
  const row = base - 1;
  for (let x = 0; x < g.w; x++) {
    if (backdrop.get(x, row) !== '@stoneShade') continue;
    const shaded = x % 13 === 0 || x % 13 === 1;
    g.set(x, row, shaded ? '@wSnowShade' : '@wSnow');
  }
}

// Smooth organic patch masks so the hills carry drifts and the red parcels show through in patches.
function hillDrift(x, y) {
  return Math.sin(x / 11 + y * 0.4) + 0.5 * Math.sin(x / 5.5 - y * 0.65 + 0.8) > 0.35;
}

function parcelSnow(x, y) {
  return Math.sin(x / 9 + y * 0.45 + 0.5) + 0.5 * Math.sin(x / 4.8 - y * 0.7 + 1.4) > 0.0;
}

/**
 * Los Altos: white snow on the ranch and parish church roofs, along the top of
 * the dry-stone wall, and in patches across the hills so the red parcels show through.
 */
export function altosSnow(g, band, backdrop) {
  const openHill = (ink) => HILL_ABOVE.has(ink);

  // Ranch and parish church tile roofs: cap above the ridge and blanket the upper roof slopes.
  capRoofs(g, backdrop, { fromY: band.top + 1, toY: band.base - 6, roofs: TILE, above: openHill, ink: '@wSnow' });
  for (let y = band.top + 1; y < band.base - 6; y++) {
    for (let x = 0; x < g.w; x++) {
      const ink = backdrop.get(x, y);
      if (!TILE.has(ink)) continue;
      // Leave the lowest eave row showing a hint of terracotta below the snow.
      const below = backdrop.get(x, y + 1);
      const below2 = backdrop.get(x, y + 2);
      if (TILE.has(below) && TILE.has(below2)) g.set(x, y, '@wSnow');
      else if (TILE.has(below)) g.set(x, y, '@wSnowShade');
    }
  }
  // Parish church nave flat roof ledge (east of the bell tower).
  for (let x = 282; x <= 307; x++) {
    const y = band.base - 20;
    if (backdrop.get(x, y) === '@stoneLit' && openHill(backdrop.get(x, y - 1))) {
      g.set(x, y - 1, '@wSnow');
    }
  }

  // Find the dry-stone wall top in each column from the painted earth strip below it.
  const wallTop = new Int16Array(g.w).fill(band.base - 6);
  for (let x = 0; x < g.w; x++) {
    let y = band.base - 1;
    if (!EARTH.has(backdrop.get(x, y))) continue;
    while (y >= band.top && EARTH.has(backdrop.get(x, y))) y--;
    const top = y - 3;
    if (top >= band.top && (backdrop.get(x, top) === '@stone' || backdrop.get(x, top) === '@recess')) {
      wallTop[x] = top;
      if (!isForeground(backdrop.get(x, top - 1))) g.set(x, top - 1, '@wSnow');
      if (backdrop.get(x, top) === '@stone') g.set(x, top, x % 4 === 0 ? '@wSnowShade' : '@wSnow');
    }
  }

  // Snow ridges and drifts across the hills so white roofs stand out and red parcels show in patches.
  for (let x = 0; x < g.w; x++) {
    let grassDepth = 0;
    let pastureDepth = 0;
    for (let y = band.top + 1; y < wallTop[x] - 1; y++) {
      const ink = backdrop.get(x, y);
      if (ink === '@grassland') {
        if (grassDepth === 0) g.set(x, y, '@wSnow');
        else if (hillDrift(x + 7, y)) g.set(x, y, grassDepth === 1 ? '@wSnow' : '@wSnowShade');
        grassDepth++;
      } else if (ink === '@pasture') {
        if (pastureDepth === 0) g.set(x, y, '@wSnow');
        else if (hillDrift(x - 5, y)) g.set(x, y, pastureDepth === 1 ? '@wSnow' : '@wSnowShade');
        pastureDepth++;
      } else if (EARTH.has(ink)) {
        if (parcelSnow(x, y)) {
          g.set(x, y, parcelSnow(x, y - 1) ? '@wSnowShade' : '@wSnow');
        }
      } else if (ink === '@foliageLit') {
        g.set(x, y, '@wSnow');
      }
    }
  }
}

/**
 * Tequila: snow whitens the upper slopes of the Volcán de Tequila down to an
 * irregular snowline, and the exposed agave tips catch a touch of white.
 */
export function tequilaSnow(g, band, backdrop) {
  const peak = band.base - 38;
  const horizon = band.base - 22;

  // Upper slopes of the volcano: sunlit white on the summit and east face, cool shade on the west.
  for (let x = 40; x <= 229; x++) {
    const limit = peak + 9 + Math.round(1.5 * Math.sin(x / 8.5 + 0.4) + 0.9 * Math.sin(x / 4.3 + 2.1));
    let depth = 0;
    for (let y = peak; y < horizon; y++) {
      const ink = backdrop.get(x, y);
      if (!VOLCANO.has(ink)) continue;
      if (y <= limit) {
        const summitCap = y === peak || (y <= peak + 2 && x >= 133);
        const crest = depth === 0 && (ink === '@rimLit' || x >= 112);
        const litSlope = ink === '@ridge' || x >= 133;
        const westHighlight = depth <= 1 && x >= 118 && x < 131;
        const color = summitCap || crest || westHighlight
          ? '@wSnow'
          : litSlope
            ? (y === limit ? '@wSnowShade' : '@wSnow')
            : '@wSnowShade';
        g.set(x, y, color);
      } else if (y === limit + 1 && Math.sin(x / 3.1) > 0.35) {
        g.set(x, y, '@wSnowShade');
      }
      depth++;
    }
  }

  // Exposed tips of the blue agave leaves catch a little snow.
  for (let y = horizon; y < band.base; y++) {
    for (let x = 0; x < g.w; x++) {
      if (backdrop.get(x, y) !== '@agaveLit') continue;
      if (AGAVE_BODY.has(backdrop.get(x, y - 1))) continue;
      if (AGAVE.has(backdrop.get(x - 1, y)) || AGAVE.has(backdrop.get(x + 1, y))) continue;
      g.set(x, y, '@wSnow');
    }
  }
}
