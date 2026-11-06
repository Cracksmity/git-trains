// skyline/format.js: focused format operations.



// Keep drawings one row per line and short numeric lists on a single line.
export function formatSkyline(skyline) {
  return JSON.stringify(skyline, null, 2).replace(
    /\[\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?(?:,\s+-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)*)\s+\]/gi,
    (match, numbers) => {
      const compact = `[${numbers.split(/,\s*/).join(', ')}]`;
      return compact.length <= 80 ? compact : match;
    },
  );
}
