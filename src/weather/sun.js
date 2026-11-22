// Where the sun stands over a place at a given moment, from NOAA's solar position
// equations (good to about a minute at sunrise and sunset). It needs no network, so
// `theme: local` still works when the weather can't be read.
import { placesFor } from './places.js';

/** Elevation of the sun's centre at sunrise and sunset, counting atmospheric refraction. */
export const SUNRISE_ELEVATION = -0.833;

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/**
 * The sun's elevation above the horizon, in degrees (negative at night).
 * @param {Date} date
 * @param {number} latitude degrees north
 * @param {number} longitude degrees east (west is negative)
 */
export function solarElevation(date, latitude, longitude) {
  const julian = date.getTime() / 86400000 + 2440587.5;
  const t = (julian - 2451545) / 36525;
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    Math.sin(rad(meanAnomaly)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * meanAnomaly)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * meanAnomaly)) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = meanLongitude + centre - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(rad(omega));
  const declination = Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLongitude)));

  // The equation of time, in minutes: how far the sundial runs ahead of the clock.
  const y = Math.tan(rad(obliquity / 2)) ** 2;
  const L = rad(meanLongitude);
  const M = rad(meanAnomaly);
  const equationOfTime = 4 * deg(
    y * Math.sin(2 * L) - 2 * eccentricity * Math.sin(M) +
    4 * eccentricity * y * Math.sin(M) * Math.cos(2 * L) -
    0.5 * y * y * Math.sin(4 * L) - 1.25 * eccentricity * eccentricity * Math.sin(2 * M),
  );
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const solarTime = (((minutes + equationOfTime + 4 * longitude) % 1440) + 1440) % 1440;
  const hourAngle = rad(solarTime / 4 - 180);

  const lat = rad(latitude);
  const cosZenith = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  return 90 - deg(Math.acos(Math.min(1, Math.max(-1, cosZenith))));
}

/**
 * Day or night over a skyline's first place: light while the sun is up, dark after
 * sunset. Null for a skyline with no real places.
 * @param {{ preset?: string } | null} skyline
 * @param {Date} date
 * @returns {{ theme: 'light' | 'dark', place: string, elevation: number } | null}
 */
export function localTheme(skyline, date) {
  const place = placesFor(skyline)?.[0];
  if (!place) return null;
  const elevation = solarElevation(date, place.latitude, place.longitude);
  return { theme: elevation > SUNRISE_ELEVATION ? 'light' : 'dark', place: place.name, elevation };
}
