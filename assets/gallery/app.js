import { closest } from '../../src/browser/dom.js';
// Page controller. Relative fetch URLs intentionally resolve against the page.
import { renderScene } from '../../src/scene/render.js';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleStats } from '../../src/demo/sample.js';
import { carsFor, stateFor } from '../../src/activity/stats.js';
import { parseCustomModel } from '../../src/trains/parse.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { decodeShare as readShare } from '../../src/sharing/codec.js';

/** Dynamic page IDs address mixed form and image elements. @returns {any} */
const $ = (id) => document.getElementById(id);
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const stillQuery = matchMedia('(prefers-reduced-motion: reduce)');
const FOLDER = { train: 'trains', skyline: 'skylines' };
const LABEL = { train: 'Train', skyline: 'Skyline' };
const params = new URLSearchParams(location.search);
const state = {
  kind: FOLDER[params.get('kind')] ? params.get('kind') : 'all',
  q: params.get('q') ?? '',
  theme: darkQuery.matches ? 'dark' : 'light',
};

// Sample activity, with the numbers that matter set exactly. Trains get five
// cars; skylines a three-car catalog train, so more of the city shows.
function stats({ user, total, streak = 12, yesterday = 6 }) {
  const s = sampleStats({ total, streak, yesterday });
  return { ...s, user, total, streak, yesterday, cars: carsFor(total), state: stateFor(yesterday) };
}

// The share link carries the file itself: raw DEFLATE, base64url (see studio/).
async function decodeShare(share) {
  const decoded = await readShare(typeof share === 'string' ? share.slice(share.indexOf('#')) : '');
  if (!decoded) throw new Error('the share link is malformed');
  return JSON.parse(decoded.text);
}
// Without DecompressionStream (older browsers), read the file instead.
async function load(entry) {
  try {
    return await decodeShare(entry.share);
  } catch {
    const res = await fetch(fileOf(entry));
    if (!res.ok) throw new Error(`could not read ${fileOf(entry)}`);
    return res.json();
  }
}
const fileOf = (e) => `../community/${FOLDER[e.kind]}/${e.id}.json`;

// Scenes go in <img> (an inline SVG's <style> would leak into the page), as in a README.
const STILL = '.tr,.wa,.wb,.sp{animation:none!important}.wb,.sb{opacity:0}.sm,.led,.do,.cl,.tw{animation:none!important}.pb{opacity:0}';
const motion = (svg) => (stillQuery.matches ? svg.replace('</style>', `${STILL}</style>`) : svg);
const urls = new Map();
function show(img, svg) {
  if (urls.has(img)) URL.revokeObjectURL(urls.get(img));
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  urls.set(img, url);
  img.src = url;
}

const parsed = new Map(); // entry -> Promise of the validated model or skyline
function draw(card) {
  const { entry } = card;
  if (!parsed.has(entry)) {
    parsed.set(entry, load(entry).then((raw) => (entry.kind === 'train' ? parseCustomModel(raw) : parseSkyline(raw))));
  }
  parsed.get(entry).then(
    (value) => {
      const isTrain = entry.kind === 'train';
      // The author's name goes on the station sign, and a train runs through the
      // author's own procedural city.
      const s = stats({ user: entry.author, total: isTrain ? 1400 : 200 });
      const spec = buildSpec(s, { theme: state.theme, ...(isTrain ? { train: value } : { skyline: value }) });
      spec.tracks[0].caption = '';
      show(card.img, motion(renderScene(spec)));
      card.img.alt = isTrain
        ? `${entry.name}, five cars long, running through ${entry.author}'s city`
        : `${entry.name} skyline behind a train`;
      card.drawnTheme = state.theme;
    },
    (err) => {
      card.error.hidden = false;
      card.error.textContent = `Could not draw it: ${err.errors?.join('; ') ?? err.message}`;
    },
  );
}

// Scenes are drawn as they come into view.
const seen = new IntersectionObserver((items) => {
  for (const item of items) {
    if (!item.isIntersecting) continue;
    const card = cards.find((c) => c.el === item.target);
    card.visible = true;
    if (card.drawnTheme !== state.theme) draw(card);
  }
}, { rootMargin: '300px 0px' });

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

let cards = [];
function build(entries) {
  cards = entries.map((entry) => {
    const img = el('img', { class: 'scene', width: '896', height: '200', alt: '' });
    const error = el('p', { class: 'error' });
    error.hidden = true;
    const profile = `https://github.com/${encodeURIComponent(entry.author)}`;
    const node = el('article', { class: 'entry', id: `${entry.kind}-${entry.id}` },
      img,
      el('div', { class: 'entry-text' },
        el('div', { class: 'entry-top' }, el('h3', {}, entry.name), el('span', { class: 'kind' }, LABEL[entry.kind])),
        el('p', { class: 'desc' }, entry.description),
        error,
      ),
      el('div', { class: 'entry-foot' },
        el('a', { class: 'by', href: profile, title: `${entry.author} on GitHub` },
          el('img', { src: `${profile}.png?size=44`, alt: '', width: '22', height: '22', loading: 'lazy' }),
          entry.author,
        ),
        el('span', { class: 'links' },
          el('a', { class: 'btn small', href: fileOf(entry), download: `${entry.id}.json` }, 'JSON'),
          el('a', { class: 'btn small main', href: `../${entry.share}` }, 'Open in the studio'),
        ),
      ),
    );
    const card = { entry, el: node, img, error, visible: false, drawnTheme: null };
    seen.observe(node);
    return card;
  });
  $('entries').replaceChildren(...cards.map((c) => c.el));
}

const text = (e) => `${e.name} ${e.description} ${e.author} ${e.id}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function filter() {
  const words = state.q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const c of cards) {
    const ok = (state.kind === 'all' || c.entry.kind === state.kind) && words.every((w) => text(c.entry).includes(w));
    c.el.hidden = !ok;
    if (ok) shown++;
  }
  $('empty').hidden = shown > 0 || !cards.length;
  const all = cards.map((c) => c.entry);
  const n = (kind) => all.filter((e) => e.kind === kind).length;
  const authors = new Set(all.map((e) => e.author.toLowerCase())).size;
  const plural = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
  const total = `${plural(n('train'), 'train')} and ${plural(n('skyline'), 'skyline')} from ${plural(authors, 'contributor')}`;
  $('tally').textContent = shown === all.length ? total : `Showing ${shown} of ${all.length}: ${total}`;
  // The filters live in the address, so a filtered view can be shared.
  const p = new URLSearchParams();
  if (state.kind !== 'all') p.set('kind', state.kind);
  if (state.q) p.set('q', state.q);
  const query = p.toString();
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
}

function press(id, value) {
  for (const b of $(id).children) b.setAttribute('aria-pressed', String(b.dataset.v === value));
}
$('kind').addEventListener('click', (e) => {
  const b = closest(e, 'button');
  if (!b) return;
  state.kind = b.dataset.v;
  press('kind', state.kind);
  filter();
});
$('q').addEventListener('input', () => {
  state.q = $('q').value.trim();
  filter();
});
function redraw() {
  for (const c of cards) if (c.visible) draw(c);
}
$('theme').addEventListener('click', (e) => {
  const b = closest(e, 'button');
  if (!b) return;
  state.theme = b.dataset.v;
  press('theme', state.theme);
  redraw();
});
stillQuery.addEventListener('change', redraw);

// A link to one entry (gallery/#train-nyc-subway) scrolls to it and marks it.
function target() {
  for (const c of cards) c.el.classList.toggle('target', `#${c.el.id}` === location.hash);
  const hit = cards.find((c) => `#${c.el.id}` === location.hash);
  if (hit) {
    hit.el.hidden = false;
    hit.el.scrollIntoView({ block: 'center' });
  }
}
addEventListener('hashchange', target);

press('kind', state.kind);
press('theme', state.theme);
$('q').value = state.q;
try {
  const res = await fetch('../community/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  build(await res.json());
  filter();
  target();
} catch (err) {
  $('tally').textContent = `Could not load the depot (community/index.json): ${err.message}`;
}
