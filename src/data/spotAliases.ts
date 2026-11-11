/** Spot aliases (dedupe-pairs): a spot that was merged into another keeps its OLD id here, so what a person saved (favourites, journal and observation entries, felt-right taps, the forecast archive, recent searches, bookmarked
 *  URLs) still resolves to the spot that now carries its data. `SPOT_ALIASES[oldId] = keptId`. Saved ids are read through `canonicalSpotId`. A merged spot is one break listed twice by the guides (same break: the same guide pages, or the
 *  same name, a pin within 300 m and the same stated facing); see scripts/dedupe-pairs.py and docs/forecast/DEDUPE-PAIRS.md. */
export const SPOT_ALIASES: Readonly<Record<string, string>> = {
  'w-us-avalon-pier-north-carolina': 'w-us-avalon-pier',
  'w-us-flagler-pier': 'w-us-flagler-beach-pier',
  'w-us-a-st': 'w-us-a-street',
};
/** The slug of a MERGED-AWAY spot's old name still opens its successor. Never the slug of a live spot (a test): 'trails' and 'point-dume' are bare shared names and stay ambiguous in the one slug index (app/slugs.ts). */
export const SLUG_ALIASES: Readonly<Record<string, string>> = {
  'flagler-pier': 'w-us-flagler-beach-pier',
  'a-st': 'w-us-a-street',
  'avalon-pier-north-carolina': 'w-us-avalon-pier',
};
export const canonicalSpotId = (id: string): string => SPOT_ALIASES[id] ?? id;
/** Every id read from storage, mapped and de-duplicated (two favourites that were one break are one favourite). */
export const canonicalIds = (ids: readonly string[]): string[] => [...new Set(ids.map(canonicalSpotId))];
