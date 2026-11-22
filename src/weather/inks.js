// Overcast skies use four bands from the top down and three cloud inks.
// At night the sky glows faintly warm near the ground, as clouds do over a lit city.
const sky = (light, dark) => ({ light, dark });

const SKIES = {
  Cloudy: sky(
    ['#a9b4ba', '#b9c3c6', '#cad1d0', '#dadfda', '#e9ece8', '#c3cacc', '#f4f5f1'],
    ['#161a2b', '#1f2335', '#2b2d3e', '#3d3646', '#363b52', '#272b40', '#474c66'],
  ),
  Rain: sky(
    ['#8f9ca5', '#a0abb1', '#b1babc', '#c3c9c6', '#c9cfcf', '#a3adb2', '#dde1df'],
    ['#121627', '#1a1e2f', '#242637', '#33303e', '#2b2f43', '#1d2133', '#3b4058'],
  ),
  Storm: sky(
    ['#4e5766', '#5e6875', '#727b86', '#878d93', '#7b838e', '#5a6270', '#99a0a8'],
    ['#0c0e1b', '#121424', '#1a1b2b', '#262434', '#20233a', '#15172a', '#33365a'],
  ),
};
// Per state: the four sky bands, then the cloud body, its shaded underside and its lit top.
const SKY_NAMES = ['0', '1', '2', '3', 'Cloud', 'CloudShade', 'CloudLit'];
const HEAT_DAY = 'rgba(255,226,180,0.5)';
const HEAT_DAY_LOW = 'rgba(255,206,146,0.58)';

const SHARED = {
  // Guadalajara's suspended dust looks tawny by day and catches amber streetlight at night.
  wHazeThin: ['rgba(185,149,115,0.28)', 'rgba(174,109,76,0.25)'],
  wHaze: ['rgba(185,149,115,0.50)', 'rgba(174,109,76,0.42)'],
  wHazeLow: ['rgba(185,149,115,0.70)', 'rgba(174,109,76,0.58)'],
  // Loose red earth above the plowed parcels of Los Altos.
  wDust: ['rgba(193,112,78,0.85)', 'rgba(153,89,81,0.8)'],
  // Transparent warmth preserves the dither of the sky beneath it.
  // The haze thickens toward the horizon, where hot air bleaches the sky most.
  wHeatHaze: [HEAT_DAY, 'rgba(158,98,107,0.28)'],
  wHeatHazeLow: [HEAT_DAY_LOW, 'rgba(176,104,92,0.36)'],
  wHeatDayHaze: [HEAT_DAY, 'rgba(0,0,0,0)'],
  wHeatDayHazeLow: [HEAT_DAY_LOW, 'rgba(0,0,0,0)'],
  // A ring of glare around the sun; at night the moon keeps its plain edge.
  wHeatGlow: ['#ffb43c', 'rgba(0,0,0,0)'],
  // Scattered banks pick up the usual clouds' ivory by day and slate blue at night.
  wPartlyCloud: ['#dce6e0', '#35435f'],
  wPartlyCloudShade: ['#c5d4d2', '#2b3852'],
  wPartlyCloudLit: ['#f0f2e9', '#4a5874'],
  // Fog: cool pale mist by day and dim slate-blue mist at night, layered with dithering.
  wFog: ['#dfe6e4', '#515a72'],
  wFogLight: ['#eef2ef', '#626b85'],
  // Rain streaks are translucent so they read over the sky and the buildings alike.
  wDrop: ['rgba(74,104,134,0.6)', 'rgba(176,196,240,0.55)'],
  wDropFar: ['rgba(74,104,134,0.35)', 'rgba(176,196,240,0.3)'],
  // Packed hail shades to blue beneath the loose white grains.
  wHail: ['#f6fbfc', '#d4e1f2'],
  wHailShade: ['#b5cbd5', '#869bb8'],
  // Lightning: the sky behind the silhouettes, and the bolt itself.
  wFlash: ['#a8b2bf', '#56597f'],
  wBolt: ['#ffffff', '#f3f0ff'],
  // The veil that dims a place under rain or a storm.
  wDimRain: ['rgba(46,60,76,0.16)', 'rgba(4,6,18,0.2)'],
  wDimStorm: ['rgba(30,38,54,0.3)', 'rgba(2,3,12,0.32)'],
  // Wet ground: water standing in furrows and plazas, shining tile roofs.
  wPuddle: ['#d3dfe5', '#7584bb'],
  wTileWet: ['#c27a5c', '#9a5f62'],
  // Morning frost: pale blue-white rime on ridges, roofs and leaves, crisper on the stone wall.
  wFrost: ['#cfe2ee', '#94b1ca'],
  wFrostLine: ['#eef5f8', '#c2d4e6'],
  // Rare snowfall: crisp white snow, soft cool shadow and icy far flakes that read over bright clouds.
  wSnow: ['#f8fcff', '#dce9f8'],
  wSnowShade: ['#c8dce8', '#92aecb'],
  wSnowIce: ['#7fa6c2', '#8fb4d8'],
};

function theme(index) {
  const inks = {};
  for (const [state, { light, dark }] of Object.entries(SKIES)) {
    SKY_NAMES.forEach((name, i) => { inks[`w${state}${name}`] = (index ? dark : light)[i]; });
  }
  for (const [name, colors] of Object.entries(SHARED)) inks[name] = colors[index];
  return inks;
}

/** Weather inks by theme; renderScene emits only the ones a scene uses. */
export const WEATHER_THEMES = { light: theme(0), dark: theme(1) };

/** The cloud and sky palette shared by states with the same cloud cover. */
export const skyState = (state) => ({ drizzle: 'cloudy', fog: 'cloudy', snow: 'cloudy', hail: 'storm' })[state] ?? state;

/**
 * The ink of a state's sky band (0-3) or cloud part: '@wRain2', '@wStormCloudShade'...
 * @param {string} state partly (cloud parts only), cloudy, rain or storm
 * @param {string | number} part
 */
export const skyInk = (state, part) => `@w${state[0].toUpperCase()}${state.slice(1)}${part}`;
