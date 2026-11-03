/** Nearshore seabed slope per spot (T-064 addendum). A slope is only listed where it can be DEFENDED from data; there is no guessing, and a spot not listed here has slope 'unknown'.
 *  Today's only source: the mean slope from a reviewed CDIP MOP point's measured depth to the shoreline (depth / distance to the nearest coastline), computed by
 *  docs/forecast/data/mop-slope.ts with the Natural Earth 10m coastline (public domain, 1:10m accuracy, a few hundred metres). It is a COARSE MEAN slope over the shoaling zone,
 *  not the steeper or flatter slope at the break, so it fits beaches (where the slope is fairly uniform) and says little about reefs and points.
 *  Spots with a slope: Ocean Beach (spot-2, via MOP SF023). Linda Mar and Bolinas have only unreviewed 15 m candidates, so no slope. */
export interface NearshoreSlope {spotId: string; tanBeta: number; mopId: string; depthM: number; distanceM: number; basis: string; computedOn: string}
export const nearshoreSlopes: NearshoreSlope[] = [
  {spotId: 'spot-2', tanBeta: 0.01903, mopId: 'SF023', depthM: 10, distanceM: 525, basis: 'Mean slope from the 10 m MOP SF023 point to the coastline (Natural Earth 10m land v5.1.2): 10 m / 525 m. Coarse.', computedOn: '2026-11-02'},
];
export const slopeFor = (spotId: string): NearshoreSlope | null => nearshoreSlopes.find((s) => s.spotId === spotId) ?? null;
