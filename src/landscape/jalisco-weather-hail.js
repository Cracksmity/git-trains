import { rng } from '../graphics/pixel.js';

const STADIUM_ROOF = new Set(['@roofWhite']);
const CENTRO_ROOFS = new Set(['@tileBlue', '@ochre', '@ochreLit', '@stoneLit', '@tile', '@tileLit']);
const DISTANT_CITY = new Set([null, '@tower', '@towerEdge', '@towerLit', '@ridge']);

// Find the roof in each column. The stadium has hills and offices behind it.
// Trusses, crosses and overhead wires interrupt the cap where they cross it.
function roofHail(g, backdrop, base, left, right, roofs, rand) {
  for (let x = left; x <= right; x++) {
    for (let y = 1; y < base; y++) {
      const roof = backdrop.get(x, y);
      if (!roofs.has(roof)) continue;
      if (DISTANT_CITY.has(backdrop.get(x, y - 1)) && rand() < 0.86) {
        g.set(x, y - 1, rand() < 0.18 ? '@wHailShade' : '@wHail');
        // A second grain can lodge on a shelf; the steep spires keep a thin edge.
        if (roofs.has(backdrop.get(x - 1, y)) && DISTANT_CITY.has(backdrop.get(x, y - 2)) && rand() < 0.3) {
          g.set(x, y - 2, '@wHail');
        }
      }
      break;
    }
  }
}

/** The June 2019 granizada left banks of ice at street level. */
export function cityHail(g, band, backdrop) {
  const rand = rng(6309);
  const row = band.base - 1;
  roofHail(g, backdrop, band.base, 25, 84, STADIUM_ROOF, rand);
  roofHail(g, backdrop, band.base, 91, 189, CENTRO_ROOFS, rand);

  // Irregular banks with a blue underside and loose pellets along the crest.
  for (let left = -4; left < g.w; ) {
    const width = 8 + Math.floor(rand() * 22);
    const depth = 2 + Math.floor(rand() * 3);
    for (let dx = 0; dx < width; dx++) {
      const x = left + dx;
      if (backdrop.get(x, row) !== '@stoneShade') continue;
      const height = Math.min(depth, dx + 1, width - dx) - (rand() < 0.3 ? 1 : 0);
      for (let dy = 0; dy < height; dy++) {
        const belowCrest = dy < height - 1;
        g.set(x, row - dy, belowCrest && rand() < 0.65 ? '@wHailShade' : '@wHail');
      }
    }
    left += width + 1 + Math.floor(rand() * 5);
  }

  // Ice packs into the fountain basin on either side of Minerva's pedestal.
  for (let x = 384; x <= 412; x++) {
    for (let y = row; y > row - 10; y--) {
      if (backdrop.get(x, y) !== '@water' || backdrop.get(x, y - 1) !== '@stoneLit') continue;
      g.set(x, y, '@wHailShade');
      g.set(x, y - 1, rand() < 0.2 ? '@wHailShade' : '@wHail');
    }
  }
}

// Share of furrow pixels and ballast stones that hold a grain. Kept low so a
// field reads as hail lying in the furrows, not as snow over the whole field.
const FIELD_GRAINS = 0.12;
const BALLAST_GRAINS = 0.45;

/** Grains settle in exposed furrows and lodge against stones in the ballast. */
export function fieldHail(g, band, backdrop, furrow) {
  const rand = rng(6371 + band.k);
  for (let y = band.top; y < band.base; y++) {
    for (let x = 0; x < g.w; x++) {
      if (backdrop.get(x, y) === furrow && rand() < FIELD_GRAINS) {
        g.set(x, y, rand() < 0.65 ? '@wHail' : '@wHailShade');
      }
    }
  }
  for (let y = band.base + 6; y < band.bottom; y++) {
    for (let x = 0; x < g.w; x++) {
      if (backdrop.get(x, y) !== '@ballast2' || rand() >= BALLAST_GRAINS) continue;
      g.set(x, y, '@wHail');
      if (!backdrop.get(x + 1, y) && rand() < 0.5) g.set(x + 1, y, '@wHailShade');
    }
  }
}
