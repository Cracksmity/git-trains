// What the scene wears on a given day: a season (snow, petals, leaves) or a
// holiday. Only the calendar logic lives here; src/scene/decor.js draws it.
//
// One decoration per day. A holiday wins over the season, and when two holidays
// overlap the more specific one wins: New Year, then Día de Muertos, then
// Christmas, then Hacktoberfest. Summer has no decoration.

export const HEMISPHERES = ['north', 'south'];

// Every decoration decor.js knows how to draw, with the name the playground shows.
export const DECORATIONS = {
  winter: 'Winter',
  spring: 'Spring',
  autumn: 'Autumn',
  muertos: 'Día de Muertos',
  christmas: 'Christmas',
  hacktoberfest: 'Hacktoberfest',
  newyear: 'New Year',
};

// Meteorological seasons by month (1 = January), as seen from the northern hemisphere.
const SEASON_BY_MONTH = [
  null,
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
];
const FLIP = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };

// A Date, a "YYYY-MM-DD" string or a full ISO timestamp, read in UTC.
export function parseDay(date) {
  let y;
  let m;
  let d;
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
    [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  } else if (typeof date === 'string') {
    const found = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(date.trim());
    if (!found) throw new Error(`Unknown date: "${date}". Use YYYY-MM-DD`);
    [y, m, d] = found.slice(1).map(Number);
    // Dates like 2026-02-31 would silently roll over: refuse them.
    const real = new Date(Date.UTC(y, m - 1, d));
    if (real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) throw new Error(`Unknown date: "${date}"`);
  } else {
    throw new Error('The date must be a Date or a YYYY-MM-DD string');
  }
  return { year: y, month: m, day: d };
}

function checkHemisphere(hemisphere) {
  if (!HEMISPHERES.includes(hemisphere)) {
    throw new Error(`Unknown hemisphere: "${hemisphere}". Options: ${HEMISPHERES.join(', ')}`);
  }
  return hemisphere;
}

// winter, spring, summer or autumn. The south has the opposite season.
export function seasonOf(date, hemisphere = 'north') {
  const { month } = parseDay(date);
  const season = SEASON_BY_MONTH[month];
  return checkHemisphere(hemisphere) === 'south' ? FLIP[season] : season;
}

// The holiday on that day, or null. Holidays fall on the same dates in both hemispheres.
export function holidayOf(date) {
  const { month, day } = parseDay(date);
  if ((month === 12 && day === 31) || (month === 1 && day === 1)) return 'newyear';
  if ((month === 10 && day === 31) || (month === 11 && day <= 2)) return 'muertos';
  if ((month === 12 && day >= 15) || (month === 1 && day <= 6)) return 'christmas';
  if (month === 10) return 'hacktoberfest';
  return null;
}

// The decoration for that day: a key of DECORATIONS, or null for a plain scene.
export function decorationFor(date, hemisphere = 'north') {
  const holiday = holidayOf(date);
  const season = seasonOf(date, hemisphere);
  return holiday ?? (season === 'summer' ? null : season);
}
