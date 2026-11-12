import {coastEvidence} from '../data/coast.ts';
/** The US Atlantic coast as docs/forecast/ATLANTIC-8S.md measured it: US spots east of 82° W and north of 24° N, Florida Keys excluded (the evidence covers these and nothing else). */
export const isUsAtlantic = (s: {latitude: number; longitude: number; region: string; country?: string}): boolean =>
  (s.country ?? 'US') === 'US' && s.longitude > -82 && s.longitude < -60 && s.latitude > 24 && s.region !== 'Florida Keys';
const ids = new Set(coastEvidence.filter(isUsAtlantic).map((s) => s.id));
export const isUsAtlanticSpot = (spotId: string): boolean => ids.has(spotId);
