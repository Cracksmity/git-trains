// Fog over the three Jalisco places: crisp pixels with the 25/50/75% dithered
// edges of src/scene/sky.js and citySky, rather than translucency.
import { skyInk } from '../weather/inks.js';

// Track furniture sits in front of the scenery: keep signals, masts, wires and signs readable.
const isForeground = (ink) => ink === '@mast' || ink === '@wire' || (typeof ink === 'string' && ink[0] === '#');

/**
 * 25/50/75% ordered dither matching sky.js and citySky.
 * @param {number} x column
 * @param {number} dist rows outside the solid edge: 1 = 75%, 2 = 50%, 3 = 25%
 */
export function dither(x, dist) {
  const m = ((x % 4) + 4) % 4;
  if (dist <= 0) return true;
  if (dist === 1) return m !== 3;
  if (dist === 2) return (m & 1) === 1;
  if (dist === 3) return m === 0;
  return false;
}

// The exact pixel citySky('cloudy') paints at (x, y), so the distant ridge vanishes cleanly.
function cloudyCitySkyAt(x, y, base) {
  const bh = base / 4;
  const band = Math.min(3, Math.floor(y / bh));
  if (band < 3) {
    const dist = (band + 1) * bh - y;
    if (dist <= 3 && dither(x, dist)) return skyInk('cloudy', band + 1);
  }
  return skyInk('cloudy', band);
}

// Choose @wFogLight or @wFog inside a two-tone bank, with a 25/50/75% dither across `mid`.
export function fogTone(x, y, mid) {
  if (y >= mid) return '@wFog';
  const dist = mid - y;
  return dist <= 3 && dither(x, dist) ? '@wFog' : '@wFogLight';
}

/**
 * Guadalajara: erase the distant ridge into the cloudy sky and lay a pale fog
 * band across the lower city to about row 70, leaving the Cathedral spires,
 * west-side towers and La Minerva rising above it.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {{ top: number, base: number, bottom: number }} band
 * @param {import('../graphics/pixel.js').Grid} backdrop
 * @param {boolean} [haze] keep the dust-tinted ridge visible above the fog bank
 */
export function paintGuadalajaraFog(g, band, backdrop, haze = false) {
  for (let x = 0; x < g.w; x++) {
    // Dip slightly at Estadio Jalisco (x ~ 54) so its white roof ring anchors the trusses.
    const estadioDip = 1.4 * Math.exp(-(((x - 54) / 34) ** 2));
    const top = Math.round(70.5 + Math.sin(x / 38 + 0.3) + 0.6 * Math.sin(x / 19 + 1.5) + estadioDip);
    const mid = top + 6;
    for (let y = band.top; y < band.base; y++) {
      const under = backdrop.get(x, y);
      if (isForeground(under)) continue;
      if (y >= top) {
        g.set(x, y, fogTone(x, y, mid));
      } else if (y >= top - 3 && dither(x, top - y)) {
        g.set(x, y, '@wFogLight');
      } else if (under === '@ridge' && !haze) {
        g.set(x, y, cloudyCitySkyAt(x, y, band.base));
      }
    }
  }
}

/**
 * Los Altos: fog pools in the valley trough behind the hills and fills the low
 * ground behind the dry-stone wall; the parish church tower and mesquite crowns
 * rise out of it, while the ranch roofs stay half visible.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {{ top: number, base: number, bottom: number }} band
 * @param {import('../graphics/pixel.js').Grid} backdrop
 */
export function paintAltosFog(g, band, backdrop) {
  for (let x = 0; x < g.w; x++) {
    const wallTop = band.base - 6 - Math.round(1.4 * Math.sin(x / 44));
    const farTop = Math.round(band.base - 19 + Math.sin(x / 52 + 0.7));
    const mainTop = Math.round(band.base - 15 + 0.8 * Math.sin(x / 50 + 0.9));
    const mid = mainTop + 4;
    for (let y = band.top; y < wallTop; y++) {
      const under = backdrop.get(x, y);
      if (isForeground(under)) continue;
      // Distant mist settled in the hollow between the far ridge and the middle hills.
      if (under === '@ridge' && y < mainTop) {
        if (y >= farTop || (y >= farTop - 3 && dither(x, farTop - y))) g.set(x, y, '@wFogLight');
        continue;
      }
      // Keep the upper mesquite crowns rising cleanly above the fog line; trunks stay submerged.
      if ((under === '@foliage' || under === '@foliageLit') && y <= mainTop) continue;
      if (y < mainTop - 3) continue;
      if (y < mainTop) {
        if (dither(x, mainTop - y)) g.set(x, y, '@wFogLight');
      } else {
        g.set(x, y, fogTone(x, y, mid));
      }
    }
  }
}

// Nearer agave rosettes (rows 2 and 3) use @agave and @agaveLit; far rows use @agaveFar.
function isNearAgave(backdrop, x, y, horizon) {
  const ink = backdrop.get(x, y);
  if (y < horizon + 5) return false;
  return ink === '@agave' || ink === '@agaveLit' || (ink === '@agaveShade' && y >= horizon + 7);
}

/**
 * Tequila: a thick fog bank blankets the far agave rows and the lower slopes
 * of the Volcán de Tequila, leaving only its summit above the mist and the
 * nearer agave rows clear.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {{ top: number, base: number, bottom: number }} band
 * @param {import('../graphics/pixel.js').Grid} backdrop
 */
export function paintTequilaFog(g, band, backdrop) {
  const horizon = band.base - 22;
  for (let x = 0; x < g.w; x++) {
    // Bank higher against the volcano so only its summit rises above the mist,
    // while keeping the valley sky clouds clear to either side.
    const bulge = 6 * Math.exp(-(((x - 133) / 68) ** 2));
    const top = Math.round(horizon - 4 - bulge + 0.9 * Math.sin(x / 58 + 0.4));
    const bottom = Math.round(horizon + 4 + 0.9 * Math.sin(x / 47 + 2.3));
    const mid = Math.min(bottom - 1, top + 5);
    for (let y = Math.max(band.top, top - 3); y <= Math.min(band.base - 1, bottom + 3); y++) {
      const under = backdrop.get(x, y);
      if (isForeground(under) || isNearAgave(backdrop, x, y, horizon)) continue;
      if (y < top) {
        if (dither(x, top - y)) g.set(x, y, '@wFogLight');
      } else if (y <= bottom) {
        g.set(x, y, fogTone(x, y, mid));
      } else if (dither(x, y - bottom)) {
        g.set(x, y, '@wFog');
      }
    }
  }
}
