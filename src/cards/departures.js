// The departures board card: your most recently pushed repositories on a
// split-flap station board. This file turns the repositories into what the
// board says (time, destination, platform, status); board.js draws the board.

import { resolveColors } from './profile.js';
import { renderBoard } from './board.js';

export const DEPARTURE_ROWS = 6;

// Default colors, hexadecimal without "#". Same five inputs as the other cards:
//   background  the board panel
//   title       the title bar, the column headings and the BOARDING status
//   text        the flap characters (time, destination, platform)
//   icon        the ON TIME status and the little train in the title bar
//   ring        the DELAYED status
export const DEPARTURES_COLORS = {
  background: '0b0d12',
  title: 'ffb02e',
  icon: '59d98e',
  text: 'f2efe6',
  ring: 'ff8a3d',
};

// Width of each column, in flap characters. The longest status is ABORDANDO / RETRASADO.
export const COLUMNS = { time: 6, destination: 16, platform: 10, status: 9 };

const MONTHS = {
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  es: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
};

export const LABELS = {
  en: {
    title: 'DEPARTURES',
    aria: (login) => `${login}'s departures board: the repositories pushed most recently`,
    ariaRepo: (repo) => `Departures board of ${repo}: its latest releases and tags`,
    time: 'TIME',
    destination: 'DESTINATION',
    platform: 'PLATFORM',
    status: 'STATUS',
    boarding: 'BOARDING',
    'on-time': 'ON TIME',
    delayed: 'DELAYED',
    departed: 'DEPARTED',
    none: 'NO DEPARTURES',
    release: 'RELEASE',
    prerelease: 'PRERELEASE',
    tag: 'TAG',
  },
  es: {
    title: 'SALIDAS',
    aria: (login) => `Panel de salidas de ${login}: los repositorios con más actividad reciente`,
    ariaRepo: (repo) => `Panel de salidas de ${repo}: sus últimas versiones y etiquetas`,
    time: 'HORA',
    destination: 'DESTINO',
    platform: 'ANDÉN',
    status: 'ESTADO',
    boarding: 'ABORDANDO',
    'on-time': 'A TIEMPO',
    delayed: 'RETRASADO',
    departed: 'SALIÓ',
    none: 'SIN SALIDAS',
    release: 'VERSIÓN',
    prerelease: 'PREVERSIÓN',
    tag: 'ETIQUETA',
  },
};

const DAY = 86400000;
const utcDay = (d) => d.toISOString().slice(0, 10);

// How a push looks on the board. Dates are UTC, like the timestamps GitHub sends.
//   boarding  pushed today          on-time  within the last 7 days
//   delayed   within the last 30    departed older
export function departureStatus(pushedAt, now = new Date()) {
  const pushed = new Date(pushedAt);
  if (utcDay(pushed) === utcDay(now) || pushed > now) return 'boarding';
  const age = now.getTime() - pushed.getTime();
  if (age <= 7 * DAY) return 'on-time';
  if (age <= 30 * DAY) return 'delayed';
  return 'departed';
}

// HH:MM when it was pushed today, otherwise the date, like "04 NOV" (Spanish months in Spanish).
export function departureTime(pushedAt, now = new Date(), language = 'en') {
  const pushed = new Date(pushedAt);
  if (utcDay(pushed) === utcDay(now)) return pushed.toISOString().slice(11, 16);
  const months = MONTHS[language] ?? MONTHS.en;
  return `${pushed.toISOString().slice(8, 10)} ${months[pushed.getUTCMonth()]}`;
}

const fit = (text, cells) => {
  const t = String(text ?? '').trim().toUpperCase();
  return t.length > cells ? `${t.slice(0, cells - 1)}…` : t;
};

// departures: [{ name, pushedAt, language }] newest first (see fetchDepartures). A repository's board
// (see fetchRepoReleases) lists releases and tags instead: [{ name, pushedAt, kind }], and the platform
// column says whether each is a release, a prerelease or a plain tag.
// Returns the rows of the board, text already in capitals and clipped to its column,
// with the `tone` that colors the status.
export function departureRows(departures, { language = 'en', now = new Date() } = {}) {
  const L = LABELS[language] ?? LABELS.en;
  return departures.slice(0, DEPARTURE_ROWS).map((d) => {
    const tone = departureStatus(d.pushedAt, now);
    return {
      time: fit(departureTime(d.pushedAt, now, language), COLUMNS.time),
      destination: fit(d.name, COLUMNS.destination),
      platform: fit(d.kind ? L[d.kind] : d.language || '-', COLUMNS.platform),
      status: fit(L[tone], COLUMNS.status),
      tone,
    };
  });
}

// departures: [{ name, pushedAt, language }]. login: whose board it is (the owner/name of the
// repository when o.repo is true, which lists releases and tags).
// o: { language, border, now, repo, background, title, icon, text, ring }
export function renderDeparturesCard(departures, login, o = {}) {
  const L = LABELS[o.language] ?? LABELS.en;
  const columns = ['time', 'destination', 'platform', 'status'].map((key) => ({
    key,
    label: L[key],
    cells: COLUMNS[key],
  }));
  return renderBoard(
    {
      title: L.title,
      aria: o.repo ? L.ariaRepo(login) : L.aria(login),
      columns,
      rows: departureRows(departures, { language: o.language, now: o.now }),
      empty: L.none,
    },
    { colors: resolveColors(o, DEPARTURES_COLORS), border: o.border !== false },
  );
}
