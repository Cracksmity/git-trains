// Punto de entrada de la GitHub Action (y de `npm run muestra` para probar sin red).
// Lee las entradas, consulta la actividad, escribe los SVG y expone salidas.

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchActivity, fetchProfile } from './github.js';
import { summarize } from './stats.js';
import { sampleStats, sampleProfile } from './sample.js';
import { buildSpec } from './compose.js';
import { renderScene } from './scene.js';
import { renderStatsCard, renderLangsCard } from './cards.js';

// Las entradas de una Action llegan como INPUT_<NOMBRE> (con guiones intactos).
const input = (name, fallback = '') =>
  (process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? '').trim() || fallback;

const THEMES = ['light', 'dark', 'auto', 'both'];
const IDIOMAS = ['es', 'en'];
const TARJETAS = ['none', 'stats', 'langs', 'both'];
const RANGOS = ['letra', 'github'];

async function main() {
  const sample = process.argv.includes('--sample');

  const theme = input('tema', 'both');
  if (!THEMES.includes(theme)) throw new Error(`Tema desconocido: "${theme}". Opciones: ${THEMES.join(', ')}`);
  const scale = Number(input('escala', '2'));
  if (!Number.isFinite(scale) || scale < 1 || scale > 6) throw new Error('"escala" debe estar entre 1 y 6');
  const idioma = input('idioma', 'es');
  if (!IDIOMAS.includes(idioma)) throw new Error(`Idioma desconocido: "${idioma}". Opciones: ${IDIOMAS.join(', ')}`);
  const tarjetas = input('tarjetas', 'none');
  if (!TARJETAS.includes(tarjetas)) throw new Error(`"tarjetas" desconocido: "${tarjetas}". Opciones: ${TARJETAS.join(', ')}`);
  const rango = input('rango', 'letra');
  if (!RANGOS.includes(rango)) throw new Error(`"rango" desconocido: "${rango}". Opciones: ${RANGOS.join(', ')}`);
  const outDir = input('salida', sample ? 'muestra' : 'dist');
  const options = {
    tren: input('tren', 'auto'),
    modo: input('modo', 'single'),
    label: input('etiqueta', idioma === 'en' ? 'STREAK' : 'RACHA'),
    scale,
  };
  const cardStyle = {
    idioma,
    rango,
    borde: input('borde', 'true') !== 'false',
    max: Number(input('lenguajes-max', '6')),
    fondo: input('color-fondo'),
    titulo: input('color-titulo'),
    icono: input('color-icono'),
    texto: input('color-texto'),
    anillo: input('color-anillo'),
  };

  let stats;
  let loadProfile;
  if (sample) {
    stats = sampleStats();
    loadProfile = async () => sampleProfile();
  } else {
    const token = input('github-token') || process.env.GITHUB_TOKEN;
    const user = input('usuario') || process.env.GITHUB_REPOSITORY_OWNER;
    if (!token) throw new Error('Falta "github-token" (usa ${{ github.token }} o un PAT)');
    if (!user) throw new Error('Falta "usuario" (o GITHUB_REPOSITORY_OWNER)');
    stats = summarize(await fetchActivity({ token, user }));
    loadProfile = () => fetchProfile({ token, user });
  }

  mkdirSync(outDir, { recursive: true });
  const variants =
    theme === 'both'
      ? [['light', 'tren-light.svg'], ['dark', 'tren-dark.svg'], ['auto', 'tren.svg']]
      : [[theme, 'tren.svg']];
  const files = [];
  for (const [t, name] of variants) {
    const svg = renderScene(buildSpec(stats, { ...options, theme: t }));
    const path = join(outDir, name);
    writeFileSync(path, svg);
    files.push(path);
    console.log(`${path} (${(svg.length / 1024).toFixed(1)} KB)`);
  }

  // Tarjetas de perfil. Si fallan no se tumba la escena: se avisa y se sigue.
  if (tarjetas !== 'none') {
    try {
      if (tarjetas === 'stats' || tarjetas === 'both') {
        const svg = renderStatsCard(await loadProfile(), cardStyle);
        const path = join(outDir, 'tarjeta-stats.svg');
        writeFileSync(path, svg);
        files.push(path);
        console.log(`${path} (${(svg.length / 1024).toFixed(1)} KB)`);
      }
      if (tarjetas === 'langs' || tarjetas === 'both') {
        const svg = renderLangsCard(stats.languages, cardStyle);
        const path = join(outDir, 'tarjeta-lenguajes.svg');
        writeFileSync(path, svg);
        files.push(path);
        console.log(`${path} (${(svg.length / 1024).toFixed(1)} KB)`);
      }
    } catch (err) {
      console.log(`::warning::No se pudieron generar las tarjetas: ${err.message}`);
    }
  }

  const main = buildSpec(stats, options).tracks[0];
  console.log(
    `${stats.user}: ${stats.total} contribuciones, racha ${stats.streak}, ayer ${stats.yesterday} -> ` +
      `${main.cars} vagón(es) ${main.model}, estado ${stats.state}`,
  );

  if (process.env.GITHUB_OUTPUT) {
    const out = { archivos: files.join(','), vagones: main.cars, racha: stats.streak, estado: stats.state, modelo: main.model };
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}\n`).join(''));
  }
}

main().catch((err) => {
  console.log(`::error::${err.message}`);
  process.exitCode = 1;
});
