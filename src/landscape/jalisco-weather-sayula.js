import { rng } from '../graphics/pixel.js';
import { shimmerLine } from './jalisco-weather-heat.js';
import { dither, fogTone } from './jalisco-weather-fog.js';

const salt = (ink) => ink === '@salt' || ink === '@saltSeam';
const water = (ink) => ink === '@laguna' || ink === '@lakeGlint';
const tile = (ink) => ink === '@tile' || ink === '@tileLit';
const kioskRoof = (ink) => ink === '@kioskRoof' || ink === '@kioskRoofShade';
const dome = (ink) => ink === '@domeGold' || ink === '@domeGoldShade' || ink === '@domeOrange' || ink === '@domeRib';
const DISTANT = new Set(['@afterglow', '@haze', '@nevado', '@nevadoShade', '@valleyHill', '@valleyFoot',
  '@salt', '@saltSeam', '@lakeGlint', '@laguna', '@plumage', '@bill', '@pinion']);

// A low bank lies on the lake and the foot of the hills and softens the far shore.
// The summit, the santuario on its cerrito, the plaza, the tower and the reeds rise clear of it.
function lakeFog(g, band, backdrop) {
  for (let x = 0; x < g.w; x++) {
    const top = band.base - 21 + Math.round(1.3 * Math.sin(x / 51));
    const bottom = band.base - 13 + Math.round(Math.sin(x / 36));
    for (let y = top - 3; y <= bottom + 3; y++) {
      if (!DISTANT.has(backdrop.get(x, y))) continue;
      if (dither(x, Math.max(top - y, y - bottom))) g.set(x, y, fogTone(x, y, top + 3));
    }
  }
}

// Follow the leading edge of the existing pool, including where its margin
// curves around the dry pan. Tile roofs, the corrugated kiosk roof and domes catch wet sheen.
function wetShore(g, band, backdrop, state) {
  const depth = { drizzle: 1, rain: 3, storm: 4 }[state];
  for (let x = 0; x < g.w; x++) {
    let spread = 0;
    for (let y = band.top; y < band.base; y++) {
      const ink = backdrop.get(x, y);
      if (ink === '@tileLit') g.set(x, y, '@wTileWet');
      else if (ink === '@kioskRoof' && (x + y) % 2 === 0) g.set(x, y, '@wTileWet');
      else if ((ink === '@domeGold' || ink === '@domeOrange') && !dome(backdrop.get(x - 1, y - 1)) && dome(backdrop.get(x + 1, y))) {
        g.set(x, y, '@wPuddle');
      }
      if (water(ink)) spread = depth;
      else if (spread > 0 && salt(ink)) {
        g.set(x, y, spread === 1 ? '@lakeGlint' : '@laguna');
        spread--;
      } else spread = 0;
    }
  }
}

function frozenShore(g, band, backdrop, state) {
  for (let y = band.top; y < band.base; y++) {
    for (let x = 0; x < g.w; x++) {
      const ink = backdrop.get(x, y);
      const above = backdrop.get(x, y - 1);
      const below = backdrop.get(x, y + 1);
      if (state === 'snow') {
        if (ink === '@nevadoShade') g.set(x, y, '@wSnowShade');
        if (ink === '@nevado' || ink === '@summitSnow') g.set(x, y, '@wSnow');
        if (tile(ink)) g.set(x, y, tile(below) ? '@wSnow' : '@wSnowShade');
        if (kioskRoof(ink)) g.set(x, y, kioskRoof(below) ? '@wSnow' : '@wSnowShade');
        if (dome(ink)) g.set(x, y, dome(below) ? '@wSnow' : '@wSnowShade');
        if (ink === '@stone' && above !== '@stone' && above !== '@stoneShade') g.set(x, y, '@wSnow');
      } else if (
        (tile(ink) && !tile(above)) ||
        (kioskRoof(ink) && !kioskRoof(above)) ||
        (ink === '@tule' && above !== '@tule')
      ) {
        g.set(x, y, '@wFrost');
      } else if (salt(ink) && water(above)) {
        g.set(x, y, '@wFrostLine');
      }
    }
  }
}

export function sayulaWeather(g, state, band, backdrop) {
  if (state === 'fog') return lakeFog(g, band, backdrop);
  if (state === 'snow' || state === 'frost') return frozenShore(g, band, backdrop, state);
  if (state === 'drizzle' || state === 'rain' || state === 'storm') return wetShore(g, band, backdrop, state);
  if (state === 'hail') {
    const random = rng(825);
    for (let y = band.top; y < band.base; y++) {
      for (let x = 0; x < g.w; x++) {
        if (salt(backdrop.get(x, y)) && random() < 0.046) {
          g.set(x, y, '@wHail');
          if (salt(backdrop.get(x + 1, y))) g.set(x + 1, y, '@wHailShade');
        }
      }
    }
  }
}

/** Reflected slivers of sky flicker across the wider exposed salt flat. */
export function sayulaShimmer(band, backdrop) {
  return [[11, 0], [9, 1], [8, 0], [6, 1]].map(([offset, pose], i) => {
    const y = band.base - offset;
    return shimmerLine(backdrop.w, y, pose, (x) => {
      const streak = (x + 5 * i + 4 * pose + Math.floor(x / 31) * 3) % 23;
      if (!salt(backdrop.get(x, y)) || streak >= 7) return null;
      return streak >= 2 && streak <= 4 ? '@laguna' : '@lakeGlint';
    });
  });
}
