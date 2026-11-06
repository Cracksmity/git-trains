// Special cars the train earns from the profile numbers (streak, stars, pull
// requests). At most one is shown: the rarest one earned.

// Rarest first. A 500-PR career is rarer than a 100-day streak, which is rarer
// than 100 stars, so that is the order of preference when several are earned.
export const UNLOCKS = [
  { id: 'mail', prs: 500 },
  { id: 'dining', streak: 100 },
  { id: 'observation', stars: 100 },
];

export const UNLOCK_IDS = UNLOCKS.map((u) => u.id);

// numbers: { streak, stars, prs } (missing or invalid numbers count as 0).
// Returns the ids of the unlocks earned, rarest first.
export function earnedUnlocks({ streak = 0, stars = 0, prs = 0 } = {}) {
  const have = { streak, stars, prs };
  return UNLOCKS.filter(({ id, ...need }) =>
    Object.entries(need).every(([key, min]) => Number(have[key]) >= min),
  ).map((u) => u.id);
}

// The car to show: the rarest earned, or null.
export function unlockFor(numbers) {
  return earnedUnlocks(numbers)[0] ?? null;
}

// The number an unlock asks for: 500 for the mail car, 100 for the others.
export function unlockThreshold(id) {
  const { id: _id, ...need } = UNLOCKS.find((u) => u.id === id) ?? {};
  return Object.values(need)[0];
}
