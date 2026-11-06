// trains/palette.js: focused palette operations.

import { mix } from '../graphics/colors.js';

export const LED_ON = '#ffb02e';

export function symbolColor(model, s, stripe) {
  const p = model.pal;
  switch (s) {
    case 'b': return p.body;
    case 'h': return p.bodyHi;
    case 'l': return p.bodyLo;
    case 't': return p.trim;
    case 'd': return p.dark;
    case 'u': return p.upper;
    case 'a': return stripe;
    default: return p.body;
  }
}

export const NOSE_DARK = '#26242b';

// Color of a nose or locomotive symbol (see noses.js). `part` is
// model.nose or model.loco: it supplies the paint (n), panel (f), and, for the
// locomotive, the light and dark shades of its paint (h, m).
export function partColor(model, part, sym, y, stripe) {
  const p = model.pal;
  switch (sym) {
    case 's': return rowColor(model, y, stripe);
    case 'n': return part.color ?? rowColor(model, y, stripe);
    case 'f': return part.face ?? p.dark;
    case 'o': return p.outline;
    case 'g': return p.glass;
    case 'G': return p.glassHi;
    case 'k': return NOSE_DARK;
    case 'a': return stripe;
    case 'l': return '#fff4b0';
    case 'y': return '#ffb02e';
    case 'i': return LED_ON;
    case 'r': return '#ff4a4a';
    case 'q': return '#7d2b30';
    case 'm': return part.lo ?? p.bodyLo;
    case 'h': return part.hi ?? p.bodyHi;
    case 't': return p.trim;
    case 'd': return p.dark;
    default: return rowColor(model, y, stripe);
  }
}

// Side color at body row y (0 roof .. 19 skirt). Above the
// roof the roof highlight continues, and below the skirt, the skirt continues.
export function rowColor(model, y, stripe) {
  const p = model.pal;
  if (y <= 1) return p.roofHi;
  if (y === 2) return p.roof;
  if (y === 3) return symbolColor(model, model.row3, stripe);
  if (y <= 10) return p.upper;
  if (y <= 17) return symbolColor(model, model.bands[y - 11], stripe);
  return p.skirt;
}

// Colors underneath the car (bogies and equipment boxes). They come from the
// model palette: skirt gray with a touch of body color, so the train
// and its wheels share a tone instead of all using the same gray.
export function underColors(P) {
  const frame = mix(P.skirt, P.body, 0.06);
  const disc = mix(mix(P.wheel, P.skirt, 0.5), P.body, 0.05);
  return {
    frame,
    frameHi: mix(frame, '#ffffff', 0.18),
    box: mix(frame, '#ffffff', 0.06),
    boxLo: mix(frame, P.outline, 0.4),
    axle: mix(frame, '#ffffff', 0.3),
    axleLo: mix(frame, '#ffffff', 0.1),
    disc,
    discHi: mix(disc, '#ffffff', 0.1),
    mark: mix(disc, '#ffffff', 0.3),
  };
}
