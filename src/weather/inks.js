// The inks of the weather layers in each theme. Every state has its own sky
// (four bands from the top down) and cloud inks, so two places can wear
// different weather side by side. The dark theme keeps the night: overcast
// skies glow faintly warm near the ground, as clouds do over a lit city.
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

const SHARED = {
  // Rain streaks are translucent so they read over the sky and the buildings alike.
  wDrop: ['rgba(74,104,134,0.6)', 'rgba(176,196,240,0.55)'],
  wDropFar: ['rgba(74,104,134,0.35)', 'rgba(176,196,240,0.3)'],
  // Lightning: the sky behind the silhouettes, and the bolt itself.
  wFlash: ['#a8b2bf', '#56597f'],
  wBolt: ['#ffffff', '#f3f0ff'],
  // The veil that dims a place under rain or a storm.
  wDimRain: ['rgba(46,60,76,0.16)', 'rgba(4,6,18,0.2)'],
  wDimStorm: ['rgba(30,38,54,0.3)', 'rgba(2,3,12,0.32)'],
  // Wet ground: water standing in furrows and plazas, shining tile roofs.
  wPuddle: ['#d3dfe5', '#7584bb'],
  wTileWet: ['#c27a5c', '#9a5f62'],
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

/**
 * The ink of a state's sky band (0-3) or cloud part: '@wRain2', '@wStormCloudShade'...
 * @param {string} state cloudy, rain or storm
 * @param {string | number} part
 */
export const skyInk = (state, part) => `@w${state[0].toUpperCase()}${state.slice(1)}${part}`;
