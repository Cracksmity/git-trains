// The places whose weather a scene can wear, one per track, in track order.

/**
 * @typedef {object} WeatherPlace
 * @property {string} id
 * @property {string} name what the caption and the accessible title call it
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} [station] the town whose reading stands for a wider region
 */

/** @type {WeatherPlace[]} Guadalajara, Los Altos (read at Arandas) and Tequila. */
export const JALISCO_PLACES = [
  { id: 'guadalajara', name: 'Guadalajara', latitude: 20.6767, longitude: -103.3475 },
  { id: 'altos', name: 'Los Altos', station: 'Arandas', latitude: 20.7058, longitude: -102.3466 },
  { id: 'tequila', name: 'Tequila', latitude: 20.8826, longitude: -103.836 },
];

const SAYULA_PLACES = [
  JALISCO_PLACES[0],
  { id: 'sayula', name: 'Sayula', latitude: 19.883, longitude: -103.6 },
  JALISCO_PLACES[2],
];

/** Skyline presets with real places behind their tracks. */
export const WEATHER_PLACES = { jalisco: JALISCO_PLACES };

/**
 * The places of a validated skyline, or null when it has none.
 * @param {{ preset?: string, variant?: string } | null | undefined} skyline
 * @returns {WeatherPlace[] | null}
 */
export function placesFor(skyline) {
  if (skyline?.preset === 'jalisco' && skyline.variant === 'sayula') return SAYULA_PLACES;
  return (skyline?.preset && WEATHER_PLACES[skyline.preset]) || null;
}
