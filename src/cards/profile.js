// SVG profile cards: statistics and most used languages.
// They follow the github-readme-stats card layout (title, rows with icon and
// rank ring; proportions bar with legend), with their own code and icons, so
// they are generated inside the workflow without depending on any external service.

export const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', Arial, sans-serif";

// Default colors (GitHub dark theme), in hexadecimal without "#".
export const CARD_COLORS = {
  background: '0d1117',
  title: '58a6ff',
  icon: '58a6ff',
  text: 'c9d1d9',
  ring: '58a6ff',
};

export const LABELS = {
  es: {
    stats: (n) => `Estadísticas de GitHub de ${n}`,
    stars: 'Estrellas recibidas',
    commits: 'Commits (último año)',
    prs: 'PRs totales',
    issues: 'Issues totales',
    contributed: 'Contribuciones a (último año)',
    langs: 'Lenguajes más usados',
    noLangs: 'Sin datos de lenguajes',
    // Repo mode: the stats card of a repository.
    repoStats: (n) => `Estadísticas de ${n}`,
    forks: 'Forks',
    repoStars: 'Estrellas',
    repoCommits: 'Commits (último año)',
    openIssues: 'Issues abiertos',
    contributors: 'Colaboradores',
  },
  en: {
    stats: (n) => `${n}'s GitHub Stats`,
    stars: 'Total Stars Earned',
    commits: 'Total Commits (last year)',
    prs: 'Total PRs',
    issues: 'Total Issues',
    contributed: 'Contributed to (last year)',
    langs: 'Most Used Languages',
    noLangs: 'No language data',
    repoStats: (n) => `${n} Stats`,
    forks: 'Forks',
    repoStars: 'Stars',
    repoCommits: 'Commits (last year)',
    openIssues: 'Open Issues',
    contributors: 'Contributors',
  },
};

// Hand-drawn 16x16 icons (stroke in the icon color; .fill is filled).
const star = (() => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3 : 7.2;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(8 + r * Math.cos(a)).toFixed(2)},${(8.6 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon class="fill" points="${pts.join(' ')}"/>`;
})();

const ICONS = {
  star,
  commit: '<circle cx="8" cy="8" r="3"/><path d="M.8 8H5M11 8h4.2"/>',
  pr:
    '<circle cx="4" cy="3.6" r="1.7"/><circle cx="4" cy="12.4" r="1.7"/><path d="M4 5.3v5.4"/>' +
    '<circle cx="12" cy="12.4" r="1.7"/><path d="M12 10.7V6.5a2 2 0 00-2-2H8M9.6 3.1L8 4.5l1.6 1.4"/>',
  issue: '<circle cx="8" cy="8" r="6.4"/><path d="M8 4.6v4"/><circle class="fill" cx="8" cy="11.2" r=".7"/>',
  repo: '<path d="M3.5 2.5h9v11h-9a1 1 0 01-1-1v-9a1 1 0 011-1z"/><path d="M6 2.5v11"/>',
  fork:
    '<circle cx="4" cy="3.6" r="1.7"/><circle cx="12" cy="3.6" r="1.7"/><circle cx="8" cy="12.4" r="1.7"/>' +
    '<path d="M4 5.3v1a2 2 0 002 2h4a2 2 0 002-2v-1M8 8.3v2.4"/>',
  people:
    '<circle cx="6" cy="5" r="2.4"/><path d="M1.4 13.5a4.6 4.6 0 019.2 0"/>' +
    '<path d="M10.6 2.9a2.2 2.2 0 010 4.2M12.2 9.3a4.2 4.2 0 012.4 4.2"/>',
};

// GitHub mark (octicon mark-github, 16x16) for the center of the ring.
const GITHUB_MARK =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

// Attributes use double quotes, so the apostrophe does not need escaping.
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Accepts "c9a04a", "#c9a04a", or "fff"; anything else falls back to the default.
export function hexColor(value, fallback) {
  const v = String(value ?? '').trim().replace(/^#/, '');
  return /^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? `#${v}` : `#${fallback}`;
}

// `defaults` lets a card with its own look (the departures board) keep the same
// five inputs but start from its own colors.
export function resolveColors(o, defaults = CARD_COLORS) {
  const c = {};
  for (const [k, def] of Object.entries(defaults)) c[k] = hexColor(o[k], def);
  return c;
}

// 1200 -> "1.2k", as in github-readme-stats.
export const kFormat = (n) => (n > 999 ? `${(n / 1000).toFixed(1)}k` : String(n));

const expCdf = (x) => 1 - 2 ** -x;
const logNormCdf = (x) => x / (1 + x);

// Approximate rank: weighted mix of commits, PRs, issues, reviews, stars, and followers.
// Returns the level (S, A+, ... C) and percentile (lower = better).
export function calculateRank({ commits, prs, issues, reviews = 0, stars, followers }) {
  const score =
    2 * expCdf(commits / 250) +
    3 * expCdf(prs / 50) +
    1 * expCdf(issues / 25) +
    1 * expCdf(reviews / 2) +
    4 * logNormCdf(stars / 50) +
    1 * logNormCdf(followers / 10);
  const percentile = (1 - score / 12) * 100;
  const thresholds = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  const levels = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'];
  const i = thresholds.findIndex((t) => percentile <= t);
  return { level: levels[i === -1 ? levels.length - 1 : i], percentile };
}

// Visible by default: the entrance animation (fade/ring) is only decoration, so a
// viewer that does not run animations still shows the complete card.
function shell({ width, height, title, body, c, border, css = '' }) {
  return (
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t"><title id="t">${esc(title)}</title>` +
    `<style>` +
    `.header{font:600 18px ${FONT};fill:${c.title};animation:fade .8s ease-in-out both}` +
    `.stat{font:600 14px ${FONT};fill:${c.text}}` +
    `.bold{font-weight:700}` +
    `.lang{font:400 11px ${FONT};fill:${c.text}}` +
    `.icon{fill:none;stroke:${c.icon};stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}` +
    `.icon .fill{fill:${c.icon}}` +
    `.row{animation:fade .3s ease-in-out both}` +
    `@keyframes fade{from{opacity:0}to{opacity:1}}` +
    css +
    `@media (prefers-reduced-motion:reduce){.header,.row,.ring{animation:none}}` +
    `</style>` +
    `<rect x=".5" y=".5" rx="4.5" width="${width - 1}" height="${height - 1}" fill="${c.background}" ` +
    `stroke="${c.text}" stroke-opacity="${border ? 0.25 : 0}"/>` +
    `<g transform="translate(25 35)"><text class="header" x="0" y="0">${esc(title)}</text></g>` +
    `${body}</svg>`
  );
}

// The card shared by the profile and the repository: a title, five rows (icon, label, number) and
// the rank ring. A number that is null (it could not be read) shows as a dash.
function statsCard({ title, rows, rank, o }) {
  const c = resolveColors(o);
  const W = 495;
  const H = 195;
  const RING = 251.33; // 2 * PI * 40

  const list = rows
    .map(
      ([icon, label, value], i) =>
        `<g transform="translate(0 ${i * 25})" class="row" style="animation-delay:${450 + i * 150}ms">` +
        `<svg class="icon" x="0" y="0" width="16" height="16" viewBox="0 0 16 16">${icon}</svg>` +
        `<text class="stat bold" x="25" y="12.5">${esc(label)}:</text>` +
        `<text class="stat bold" x="275" y="12.5" text-anchor="end">${esc(value == null ? '-' : kFormat(value))}</text></g>`,
    )
    .join('');

  const center =
    o.rank === 'github'
      ? `<g transform="translate(-20 -20) scale(2.5)"><path d="${GITHUB_MARK}" fill="${c.ring}"/></g>`
      : `<text class="rank-text" x="0" y="0" dominant-baseline="central" text-anchor="middle">${esc(rank.level)}</text>`;

  const body =
    `<g transform="translate(25 55)">${list}</g>` +
    `<g transform="translate(${W - 95} ${H / 2 + 2})" role="img" aria-label="${esc(rank.level)}">` +
    `<circle r="40" fill="none" stroke="${c.ring}" stroke-width="6" opacity=".2"/>` +
    `<circle class="ring" r="40" fill="none" stroke="${c.ring}" stroke-width="6" stroke-linecap="round" ` +
    `opacity=".85" transform="rotate(-90)" stroke-dasharray="${RING}" ` +
    `stroke-dashoffset="${((rank.percentile / 100) * RING).toFixed(2)}"/>${center}</g>`;

  const css =
    `.rank-text{font:800 24px ${FONT};fill:${c.text}}` +
    `.ring{animation:ring 1s ease-in-out both}` +
    `@keyframes ring{from{stroke-dashoffset:${RING}}}`;

  return shell({ width: W, height: H, title, body, c, border: o.border !== false, css });
}

// p: { name, login, followers, stars, commits, prs, issues, contributed, reviews }
// o: { language, border, rank ('letter' | 'github'), background, title, icon, text, ring }
export function renderStatsCard(p, o = {}) {
  const L = LABELS[o.language] ?? LABELS.en;
  const rows = [
    [ICONS.star, L.stars, p.stars],
    [ICONS.commit, L.commits, p.commits],
    [ICONS.pr, L.prs, p.prs],
    [ICONS.issue, L.issues, p.issues],
    [ICONS.repo, L.contributed, p.contributed],
  ];
  return statsCard({ title: L.stats(p.name || p.login), rows, rank: calculateRank(p), o });
}

// Repo mode: the stats card of a repository (see fetchRepoProfile; commits is the last year's total).
// p: { repo, name, stars, forks, commits, openIssues, issues, prs, contributors }
// o: the same as renderStatsCard. The rank is the same approximation, read for a project: its forks
// stand where a person's followers do, and nobody reviews here, so reviews count as 0.
export function renderRepoStatsCard(p, o = {}) {
  const L = LABELS[o.language] ?? LABELS.en;
  const rows = [
    [ICONS.star, L.repoStars, p.stars],
    [ICONS.fork, L.forks, p.forks],
    [ICONS.commit, L.repoCommits, p.commits],
    [ICONS.issue, L.openIssues, p.openIssues],
    [ICONS.people, L.contributors, p.contributors],
  ];
  const rank = calculateRank({
    commits: p.commits ?? 0,
    prs: p.prs ?? 0,
    issues: p.issues ?? 0,
    reviews: 0,
    stars: p.stars,
    followers: p.forks ?? 0,
  });
  return statsCard({ title: L.repoStats(clip(p.repo || p.name, 26)), rows, rank, o });
}

const DEFAULT_LANG_COLOR = '#8b949e';
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// langs: [{ name, color, bytes }] (largest first). o: { language, border, max, ...colors }
export function renderLangsCard(langs, o = {}) {
  const c = resolveColors(o);
  const L = LABELS[o.language] ?? LABELS.en;
  const max = Math.max(1, Math.min(10, Math.round(o.max ?? 6)));
  const top = langs.slice(0, max);
  const total = top.reduce((a, l) => a + l.bytes, 0);
  const W = 300;
  const barW = W - 50;

  if (!top.length || total <= 0) {
    const body = `<g transform="translate(25 62)" class="row"><text class="stat">${esc(L.noLangs)}</text></g>`;
    return shell({ width: W, height: 105, title: L.langs, body, c, border: o.border !== false });
  }

  const items = top.map((l) => ({
    name: l.name,
    color: /^#[0-9a-f]{6}$/i.test(l.color ?? '') ? l.color : DEFAULT_LANG_COLOR,
    pct: (l.bytes / total) * 100,
  }));

  let x = 0;
  const segments = items
    .map((it) => {
      const w = (barW * it.pct) / 100;
      const seg = `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="8" fill="${it.color}"/>`;
      x += w;
      return seg;
    })
    .join('');

  const rows = Math.ceil(items.length / 2);
  const H = 95 + rows * 22;
  const legend = items
    .map(
      (it, i) =>
        `<g transform="translate(${(i % 2) * (barW / 2)} ${Math.floor(i / 2) * 22})" class="row" ` +
        `style="animation-delay:${450 + i * 120}ms"><circle cx="5" cy="5.5" r="5" fill="${it.color}"/>` +
        `<text class="lang" x="15" y="10">${esc(clip(it.name, 14))} ${it.pct.toFixed(2)}%</text></g>`,
    )
    .join('');

  const body =
    `<mask id="bar"><rect width="${barW}" height="8" rx="4" fill="#fff"/></mask>` +
    `<g transform="translate(25 55)"><g mask="url(#bar)">${segments}</g></g>` +
    `<g transform="translate(25 82)">${legend}</g>`;

  return shell({ width: W, height: H, title: L.langs, body, c, border: o.border !== false });
}
