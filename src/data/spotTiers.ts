/** Spot tiers for the map's pin priority (spots-map): the spots added by the 2026-11-08 Phase A expansion (docs/forecast/data/phase-a-spots.json,
 *  wired in by add-spots.ts). Where pins crowd at a zoom, an original spot keeps its pin before a newly added one. A test keeps this list equal
 *  to the research file's rows. */
export const ADDED_2026_11_08: readonly string[] = ['cs-kellys-cove', 'cs-sloat', 'cs-sharp-park', 'cs-rockaway', 'cs-princeton-jetty', 'cs-half-moon-bay', 'cs-pescadero',
  'cs-pigeon-point', 'cs-scott-creek', 'cs-rodeo-beach', 'cs-natural-bridges', 'cs-capitola', 'cs-marina', 'cs-andrew-molera'];
const added = new Set(ADDED_2026_11_08);
/** 1 for the original spots, 0 for spots added in the expansion. */
export const spotTier = (id: string) => (added.has(id) ? 0 : 1);
