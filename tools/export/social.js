// export/social.js: focused social operations.

import { Grid } from '../../src/graphics/pixel.js';
import { drawText, textWidth } from '../../src/graphics/font.js';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleStats } from '../../src/demo/sample.js';
import { rgba, Canvas, rasterScene, timeAt, renderFrame } from './raster.js';


// --- Social images -------------------------------------------------------------

// "git-trains" in a bold lowercase pixel face drawn for these images, in the spirit of
// the site's Pixelify Sans: 2-dot stems, x-height 7, ascenders from row 0, descenders to row 12.
export const TITLE_GLYPHS = {
  g: ['', '', '', '.#####', '##..##', '##..##', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '#####.'],
  i: ['', '##', '', '##', '##', '##', '##', '##', '##', '##'],
  t: ['', '.##', '.##', '#####', '.##', '.##', '.##', '.##', '.##', '..###'],
  '-': ['', '', '', '', '', '', '####'],
  r: ['', '', '', '##.##', '####.', '###', '##', '##', '##', '##'],
  a: ['', '', '', '.####.', '....##', '....##', '.#####', '##..##', '##..##', '.#####'],
  n: ['', '', '', '#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##'],
  s: ['', '', '', '.#####', '##', '##', '.####.', '....##', '....##', '#####.'],
};

function drawTitle(g, text, x, y, px, color) {
  for (const ch of text) {
    TITLE_GLYPHS[ch].forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') g.rect(x + c * px, y + r * px, px, px, color);
    });
    x += (glyphW(ch) + 1) * px;
  }
}

// The 3x5 sign font, `px` pixels per dot.
function drawSmall(g, text, x, y, px, color) {
  const tmp = new Grid(textWidth(text), 5);
  drawText(tmp, text, 0, 0, '#');
  for (let r = 0; r < 5; r++) for (let c = 0; c < tmp.w; c++) if (tmp.get(c, r)) g.rect(x + c * px, y + r * px, px, px, color);
}

const INK = {
  light: { title: '#18201b', shadow: '#ffffff', tag: '#2d3440', yellow: '#c98f00', green: '#1b8638' },
  dark: { title: '#f4f7f5', shadow: '#070b1e', tag: '#a7b4d0', yellow: '#f0c23a', green: '#47c06a' },
};

// width x height pixels at `scale` (pixels per scene pixel): the scene along the bottom,
// its sky reaching the top, and the name with the site's stripe over it. `title` and
// `small` are scene pixels per dot of the title and of the tagline.
export function socialImage({ width, height, scale, theme = 'dark', title = 3, small = 2 }) {
  const W = width / scale;
  const H = height / scale;
  // No station sign or caption: just the train, with a yellow (JavaScript) stripe.
  const stats = sampleStats({ total: 420, streak: 30, yesterday: 14 });
  stats.user = '';
  stats.languages[0] = { ...stats.languages[0], name: 'JavaScript', color: '#f1e05a' };
  const spec = buildSpec(stats, { train: 'bullet', theme });
  spec.tracks[0].caption = '';
  const scene = rasterScene(spec, theme);
  const { plan } = scene;
  const cropX = plan.W - W; // keep the right side: the sun and the signal
  const tr = scene.trains[0];
  const frame = renderFrame(scene, timeAt(scene, 0, cropX + Math.round(W * 0.56 - tr.train.width / 2)));

  const out = new Canvas(W, H);
  const top = H - plan.H;
  // Sky above the scene: its top color, and in the dark theme more of its stars.
  const sky = new Grid(W, top);
  sky.rect(0, 0, W, top, '@sky0');
  out.paint(sky, 0, 0, scene.color);
  for (let y = top - 50; y > -50; y -= 50) {
    out.paint(scene.stars.a, -cropX, y, scene.color);
    out.paint(scene.stars.b, -cropX, y, scene.color, 0.2);
  }
  for (let y = 0; y < plan.H; y++) {
    out.px.set(frame.px.subarray((y * plan.W + cropX) * 3, (y * plan.W + plan.W) * 3), ((top + y) * W) * 3);
  }

  // Stripe (about 128 x 8 px, like the site's 120 x 6), title and a two-line tagline.
  const ink = INK[theme];
  const text = new Grid(W, H);
  const shade = new Grid(W, H);
  const m = Math.round(64 / scale);
  const band = Math.max(1, Math.round(4 / scale));
  const titleY = m + 2 * band + 2 * title;
  const tagY = titleY + 13 * title + 3 * small;
  const tagline = ['YOUR GITHUB ACTIVITY', 'AS A PIXEL-ART TRAIN'];
  for (const [g, d, colors] of [[shade, 1, null], [text, 0, ink]]) {
    const c = (k) => (colors ? colors[k] : ink.shadow);
    g.rect(m + d, m + d, Math.round(128 / scale), band, c('yellow'));
    g.rect(m + d, m + d + band, Math.round(128 / scale), band, c('green'));
    drawTitle(g, 'git-trains', m + d, titleY + d, title, c('title'));
    tagline.forEach((line, i) => drawSmall(g, line, m + d, tagY + i * 8 * small + d, small, c('tag')));
  }
  const color = (c) => rgba(c);
  out.paint(shade, 0, 0, color, 0.6);
  out.paint(text, 0, 0, color);
  const right = m + Math.max(titleWidth('git-trains') * title, ...tagline.map((l) => textWidth(l) * small));
  return { canvas: out, fits: right < W && tagY + 13 * small < top + 44 };
}

export const glyphW = (ch) => Math.max(...TITLE_GLYPHS[ch].map((r) => r.length));

export const titleWidth = (text) => [...text].reduce((w, ch) => w + glyphW(ch) + 1, -1);
