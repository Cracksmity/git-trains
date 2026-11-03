// Regenera los SVG de ejemplo que usa el README (datos de muestra, sin red).
// node scripts/docs.js

import { mkdirSync, writeFileSync } from 'node:fs';
import { renderScene } from '../src/scene.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats, sampleProfile } from '../src/sample.js';
import { renderStatsCard, renderLangsCard } from '../src/cards.js';

mkdirSync('docs', { recursive: true });

const casos = [
  ['ejemplo-claro', sampleStats({ total: 2400, yesterday: 6 }), { tren: 'auto', modo: 'single', theme: 'light' }],
  ['ejemplo-oscuro', sampleStats({ total: 900, streak: 30, yesterday: 14 }), { tren: 'auto', modo: 'single', theme: 'dark' }],
  ['ejemplo-multi', sampleStats({ total: 1500, yesterday: 5 }), { tren: 'auto', modo: 'multi', theme: 'light' }],
  ['ejemplo-parado', sampleStats({ total: 300, streak: 0, yesterday: 0 }), { tren: 'tranvia', modo: 'single', theme: 'light' }],
];

for (const [nombre, stats, opts] of casos) {
  const svg = renderScene(buildSpec(stats, opts));
  writeFileSync(`docs/${nombre}.svg`, svg);
  console.log(`docs/${nombre}.svg ${(svg.length / 1024).toFixed(1)} KB`);
}

// Tarjetas de perfil de ejemplo (colores por defecto, tema oscuro de GitHub).
const demo = sampleStats();
const tarjetas = [
  ['tarjeta-stats', renderStatsCard(sampleProfile(), { idioma: 'es' })],
  ['tarjeta-lenguajes', renderLangsCard(demo.languages, { idioma: 'es', max: 6 })],
];
for (const [nombre, svg] of tarjetas) {
  writeFileSync(`docs/${nombre}.svg`, svg);
  console.log(`docs/${nombre}.svg ${(svg.length / 1024).toFixed(1)} KB`);
}
