// Rebuild the profile artwork and its six individual pieces as part of npm run docs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { JALISCO_TRAINS } from '../src/trains/jalisco.js';
import { buildTrain } from '../src/trains/render.js';
import { Grid } from '../src/graphics/pixel.js';
import { paintGuadalajara } from '../src/landscape/jalisco-city.js';
import { paintLosAltos, paintTequila } from '../src/landscape/jalisco-country.js';
import { parseSkyline } from '../src/landscape/skyline-parse.js';
import { scenePalette } from '../src/scene/themes.js';
import { BALLAST, GY0, PITCH, SCENE_W } from '../src/scene/layout.js';
import { paintSky, celestialGrid, cloudsGrid, starsGrids } from '../src/scene/sky.js';
import { buildSpec } from '../src/scene/spec.js';
import { renderScene } from '../src/scene/render.js';
import { rasterScene, renderFrame } from '../tools/export/raster.js';
import { pngOf } from '../tools/export/png.js';

const skyline = parseSkyline('jalisco');
const directory = 'examples/jalisco';

function piece(title, width, height, layers) {
  const used = new Set();
  const paths = layers.map((g) => g.paths(used)).join('');
  const styles = (theme) => {
    const palette = scenePalette(theme, skyline);
    return [...used].map((name) => `.c-${name}{fill:${palette[name]}}`).join('');
  };
  const css = used.size ? `<style>${styles('light')}@media (prefers-color-scheme:dark){${styles('dark')}}</style>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${2*width}" height="${2*height}" shape-rendering="crispEdges" role="img" aria-label="${title}"><title>${title}</title>${css}${paths}</svg>`;
}

function background(name, title, height, painter) {
  const g = new Grid(SCENE_W, height);
  painter(g, height, height);
  const layers = [];
  if (name === 'guadalajara') {
    const sky = new Grid(SCENE_W, height);
    paintSky(sky);
    const stars = starsGrids(SCENE_W);
    layers.push(sky, celestialGrid(SCENE_W), stars.a, stars.b, cloudsGrid(SCENE_W));
  }
  layers.push(g);
  writeFileSync(`${directory}/${name}.svg`, piece(title, SCENE_W, height, layers));
}

export function writeJaliscoExamples() {
  mkdirSync(directory, { recursive: true });
  // The three visible language shares and streak are from the supplied README snapshot.
  const stats = {
    user: 'Cracksmity', cars: 2, streak: 2, state: 'normal',
    languages: [
      { name: 'Python', bytes: 56, share: 0.56, color: '#3572a5' },
      { name: 'JavaScript', bytes: 25, share: 0.25, color: '#f1e05a' },
      { name: 'C++', bytes: 6, share: 0.06, color: '#f34b7d' },
    ],
  };
  const spec = buildSpec(stats, { train: 'jalisco', skyline, mode: 'multi', theme: 'auto', language: 'es' });
  spec.title = 'Jalisco sobre rieles · Guadalajara, Los Altos y los campos de agave de Tequila';
  for (const [i, model] of JALISCO_TRAINS.entries()) {
    const track = spec.tracks[i];
    track.cars = 2; // show the articulation, a pair of hoppers and a pair of saloons
    const { layers, width, height } = buildTrain(model, track);
    writeFileSync(`${directory}/${model.id}.svg`, piece(model.name, width, height,
      [layers.body, layers.lit, layers.wa, layers.led]));
  }
  writeFileSync(`${directory}/jalisco-sobre-rieles.svg`, renderScene(spec));
  const scene = rasterScene(spec, 'dark');
  writeFileSync(`${directory}/jalisco-sobre-rieles.png`, pngOf(renderFrame(scene, 0), 2));
  // The weather, one state per place: frame 0 catches the lightning behind the Cathedral.
  const weather = buildSpec(stats, { train: 'jalisco', skyline, mode: 'multi', theme: 'auto', language: 'es', weather: ['storm', 'rain', 'cloudy'] });
  weather.tracks.forEach((track) => { track.cars = 2; });
  weather.title = 'Jalisco con clima · tormenta en Guadalajara, lluvia en Los Altos, nubes en el volcán de Tequila';
  writeFileSync(`${directory}/jalisco-clima.svg`, renderScene(weather));
  background('guadalajara', 'Guadalajara desde las vías', GY0, paintGuadalajara);
  background('los-altos', 'Ranchos y lomas de Los Altos de Jalisco', PITCH - BALLAST, paintLosAltos);
  background('campos-de-agave', 'Hileras de agave al pie del volcán de Tequila', PITCH - BALLAST, paintTequila);
}
