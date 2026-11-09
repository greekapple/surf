import {evidenceSpots} from './spots.ts';
import {DEFAULT_TIME_ZONE, validZone} from './time.ts';

/** The IANA time zone of a spot, for every clock label, "today" and daylight computation (spec 2026-11-09 C1).
 *  Accepts a spot-like object (its own `timeZone` wins) or an id (looked up in the evidence registry); unknown ids and spots without a zone are America/Los_Angeles, the zone of every spot until the world catalogue. */
export function timeZoneOf(spot: string | {id: string; timeZone?: string} | null | undefined): string {
  if (!spot) return DEFAULT_TIME_ZONE;
  if (typeof spot !== 'string' && spot.timeZone) return validZone(spot.timeZone);
  const id = typeof spot === 'string' ? spot : spot.id;
  return validZone(evidenceSpots.find((s) => s.id === id)?.timeZone);
}

/** The zone the single-spot screens (Forecast page, Wave Scale, the spot's own cards) format their clocks in. The page sets it from the spot it shows (`useSpotZone`) before its children render;
 *  every formatting helper takes an optional explicit zone first and uses this one when it is omitted. Lists of several spots (Home, Explore) pass each item's own zone explicitly. */
let active = DEFAULT_TIME_ZONE;
export const activeZone = (): string => active;
export const setActiveZone = (tz: string | null | undefined): string => (active = validZone(tz));

/** The ONE zone of the global surfaces: the map's time strip and stamps, the "model data" badge, the point panel and the cross-spot lists (Find spots, Compare headers). They show a single instant for many places, so they use one explicit zone,
 *  never the zone of whichever spot was opened last. America/Los_Angeles today (the map covers the US West Coast); flip this one constant (or read the viewer's zone) when the map goes global. A spot's OWN row or card labels its own zone (timeZoneOf). */
export const MAP_TIME_ZONE = DEFAULT_TIME_ZONE;
