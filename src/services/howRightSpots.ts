/** The spot list the daily "how right" job scores: each catalogued spot's position and its assigned CDIP MOP point (src/ocean/mop.ts). */
import {evidenceSpots} from '../ocean/spots.ts';
import {assignmentFor} from '../ocean/mop.ts';
import type {SpotInput} from './howRight.ts';
export const howRightSpots = (): SpotInput[] => evidenceSpots.map((s) => ({id: s.id, lat: s.latitude, lon: s.longitude, mopId: assignmentFor(s.id)?.mopId ?? null}));
