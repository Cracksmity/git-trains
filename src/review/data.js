// review/data.js: focused data operations.

import { carsFor, summarize } from '../activity/stats.js';

export const FIRST_YEAR = 2008;

// GitHub's first year: the oldest year it can have activity for

// The year to review when `review-year` is not set: the current year so far, except in
// January, when the new year has barely begun and the year that just ended is the one
// worth looking back on. UTC, like the rest of the Action.
export function defaultReviewYear(now = new Date()) {
  return now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

// The `review-year` input: empty means the default; otherwise a year from FIRST_YEAR to the
// current one (a future year has nothing to show).
export function parseReviewYear(value, now = new Date()) {
  const text = String(value ?? '').trim();
  if (!text) return defaultReviewYear(now);
  const year = Number(text);
  const current = now.getUTCFullYear();
  if (!/^\d{4}$/.test(text) || year < FIRST_YEAR || year > current) {
    throw new Error(`"review-year" must be a year from ${FIRST_YEAR} to ${current}, or empty for ${defaultReviewYear(now)}`);
  }
  return year;
}

const DAY = 86400000;

const dayNumber = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);

// days: [{ date, count }] ascending. Only the days of `year` count. Returns
//   total, activeDays, daysCovered (days of the year that have passed: 365, 366, or fewer so far),
//   longest: { length, start, end } | null (the longest run of days in a row with contributions;
//     the earliest wins a tie), busiest: { date, count } | null (the earliest wins a tie),
//   months: 12 totals, busiestMonth: { index, count } | null.
export function yearNumbers(days, year) {
  const mine = days.filter((d) => d.date.startsWith(`${year}-`));
  const months = new Array(12).fill(0);
  let total = 0;
  let activeDays = 0;
  let busiest = null;
  let longest = null;
  let run = null;
  for (const d of mine) {
    total += d.count;
    months[Number(d.date.slice(5, 7)) - 1] += d.count;
    if (d.count <= 0) {
      run = null;
      continue;
    }
    activeDays++;
    if (!busiest || d.count > busiest.count) busiest = { date: d.date, count: d.count };
    if (run && dayNumber(d.date) === dayNumber(run.end) + 1) {
      run.length++;
      run.end = d.date;
    } else {
      run = { length: 1, start: d.date, end: d.date };
    }
    if (!longest || run.length > longest.length) longest = run;
  }
  const best = Math.max(...months);
  const index = months.indexOf(best);
  return {
    total,
    activeDays,
    daysCovered: mine.length,
    longest: longest && { ...longest },
    busiest,
    months,
    busiestMonth: best > 0 ? { index, count: best } : null,
  };
}

// activity: { user, days, languages } for the year (see fetchYear). The train is the one of
// a year of this size: its cars come from the year's total and the streak that lights its
// windows is the year's longest. `unlock` (a car id from unlocks.js) is for the caller to
// set: it needs the profile numbers.
/** @param {any} activity @param {{ year?: number, exclude?: string[] }} options */
export function buildReview(activity, { year, exclude = [] } = {}) {
  const n = yearNumbers(activity.days, year);
  const { languages } = summarize({ ...activity, days: [] }, { exclude });
  return {
    user: activity.user,
    year,
    ...n,
    languages,
    cars: carsFor(n.total),
    streak: n.longest?.length ?? 0,
    state: 'normal',
    unlock: null,
  };
}
