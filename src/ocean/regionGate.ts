import {ZONES} from '../data/zones.ts';
import {evidenceSpots} from './spots.ts';
import {OWNER_TOOLS} from '../services/profileFields.ts';
import type {SpotEvidence} from './types.ts';

/** ca-only (user, 2026-11-13): the app shows California only; every other region is visible to the owner alone (profile.previewRegions, behind the VITE_OWNER_TOOLS build flag).
 *  Only the UI is gated. The capture, cron, how-right scoring, SWAN, the Europe data, the services and the /api endpoints keep every region.
 *
 *  How a spot is decided to be California (one rule, the existing `region` field, no new data):
 *   - its `region` is a county of one of the five California zones in src/data/zones.ts (North Coast, Bay Area, Santa Cruz & Monterey, Central Coast, Southern California);
 *   - and it is not outside the United States (`country` absent or US).
 *  The test (src/tests/region-gate.test.ts) checks that rule against an independent one, the coordinates (latitude 32.4 to 42.0, longitude west of -114.0, so the Oregon "Curry" and the
 *  Washington "Clallam" counties are out), and that the count is the number of California spots in the catalogue. */
export const CA_ZONES = ['North Coast', 'Bay Area', 'Santa Cruz & Monterey', 'Central Coast', 'Southern California'] as const;
export const CA_REGIONS: ReadonlySet<string> = new Set(ZONES.filter(([z]) => (CA_ZONES as readonly string[]).includes(z)).flatMap(([, counties]) => counties));

export interface GateSpot {region: string; country?: string}
export const isCaliforniaSpot = (spot: GateSpot): boolean => (spot.country ?? 'US').toUpperCase() === 'US' && CA_REGIONS.has(spot.region);

/** The owner-tools build flag: the one helper, OWNER_TOOLS in services/profileFields.ts (VITE_OWNER_TOOLS=true in the private deploy and dev; unset in the launch build, docs/specs/LAUNCH-GATE.md). */
export const ownerToolsEnabled = (): boolean => OWNER_TOOLS;
/** The owner's preview of the other regions: the profile field AND the build flag. With the flag off, a stored previewRegions is ignored. */
export const previewActive = (profile: {previewRegions?: boolean} | null | undefined, flag: boolean = ownerToolsEnabled()): boolean => flag && profile?.previewRegions === true;
/** The one gate every spot list goes through. */
export const visibleSpot = (spot: GateSpot, profile: {previewRegions?: boolean} | null | undefined, flag: boolean = ownerToolsEnabled()): boolean => previewActive(profile, flag) || isCaliforniaSpot(spot);

const CA_EVIDENCE = evidenceSpots.filter(isCaliforniaSpot);
/** The spots the screens may list: California, or everything when the owner's preview is on. Same array every call (callers memoise on identity). */
export const visibleEvidence = (profile: {previewRegions?: boolean} | null | undefined, flag: boolean = ownerToolsEnabled()): SpotEvidence[] => (previewActive(profile, flag) ? evidenceSpots : CA_EVIDENCE);
/** The id of a spot that exists but is hidden from this viewer (a shared link into another region); null for visible and unknown ids. */
export const hiddenSpotId = (id: string | null | undefined, profile: {previewRegions?: boolean} | null | undefined, flag: boolean = ownerToolsEnabled()): string | null => {
  if (!id) return null; const e = evidenceSpots.find((s) => s.id === id); return e && !visibleSpot(e, profile, flag) ? id : null;
};
/** The zone chips a screen may offer: only zones that contain at least one spot of the (gated) list it shows. Same rule as the Nav spot picker. */
export const zonesWithSpots = (spots: readonly {region: string}[]): string[] => ZONES.filter(([, counties]) => spots.some((s) => counties.includes(s.region))).map(([z]) => z);
/** A spot the gate hides, chosen from anywhere (a journal, alert or favourite link): the id to say "not open yet" about, and no change of the selected spot; null when the spot is shown. */
export const hiddenOnChoose = (id: string, profile: {previewRegions?: boolean} | null | undefined, flag: boolean = ownerToolsEnabled()): string | null => hiddenSpotId(id, profile, flag);
