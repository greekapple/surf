import {evidenceSpots} from './spots.ts';
import {DEFAULT_TIME_ZONE, validZone, fmtIn} from './time.ts';

/** The IANA time zone of a spot, for every clock label, "today" and daylight computation (spec 2026-11-09 C1).
 *  Accepts a spot-like object (its own `timeZone` wins) or an id (looked up in the evidence registry); unknown ids and spots without a zone are America/Los_Angeles, the zone of every spot until the world catalogue. */
export function timeZoneOf(spot: string | {id: string; timeZone?: string} | null | undefined): string {
  if (!spot) return DEFAULT_TIME_ZONE;
  if (typeof spot !== 'string' && spot.timeZone) return validZone(spot.timeZone);
  const id = typeof spot === 'string' ? spot : spot.id;
  let z = ZONE_BY_ID.get(id); if (z === undefined) { const hit = evidenceSpots.find((s) => s.id === id); z = validZone(hit?.timeZone); if (hit) ZONE_BY_ID.set(id, z); }   // only known spots are cached (an id that is not in the catalogue yet may be later)
  return z;
}
/** B8 (audit M8): each spot's zone looked up once (a linear search over the catalogue ran for every spot on every hour of a scrub). */
const ZONE_BY_ID = new Map<string, string>();

/** The zone the single-spot screens (Forecast page, Wave Scale, the spot's own cards) format their clocks in. The page sets it from the spot it shows (`useSpotZone`) before its children render;
 *  every formatting helper takes an optional explicit zone first and uses this one when it is omitted. Lists of several spots (Home, Explore) pass each item's own zone explicitly. */
let active = DEFAULT_TIME_ZONE;
export const activeZone = (): string => active;
export const setActiveZone = (tz: string | null | undefined): string => (active = validZone(tz));

/** The viewer's own zone (the device clock), for surfaces that show several spots at once (Home, Compare, Find spots) and the map with no spot focused. */
// Read once: the device zone does not change while the page is open, and each map label asks for it (it built two Intl formatters per call).
const VIEWER_ZONE = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } })();
export const viewerZone = (): string => VIEWER_ZONE ?? DEFAULT_TIME_ZONE;

/** The label zone of the global surfaces (spec 2026-11-09 1A): the map's time strip and stamps, the "model data" badge, the point panel.
 *  They show one instant for many places in ONE explicit zone: the zone of the spot in view (its Forecast page, or the spot focused on the map),
 *  else the viewer's own zone (Home, the map with nothing focused). The store sets it from the route and the map focus before the screens render
 *  (`labelZoneFor`); time steps stay shared UTC instants, only their labels and day boundaries follow it. A spot's OWN row or card labels its own zone (timeZoneOf). */
let mapZoneNow: string | null = null;
export const mapZone = (): string => mapZoneNow ?? viewerZone();
export const setMapZone = (tz: string | null | undefined): string => { mapZoneNow = tz ? validZone(tz) : null; return mapZone(); };
/** Which zone the clocks of a view use: Forecast → the spot's; the map (its own sections) → the focused spot's, or the viewer's when nothing is focused; everything else (Home, Compare, Find spots, Quiver, Personal) → the viewer's. */
export function labelZoneFor(area: string, section: string, spotZone: string, mapFocused: boolean, viewer = viewerZone()): string {
  if (area === 'forecast') return spotZone;
  if (area === 'explore' && section !== 'compare' && section !== 'discover') return mapFocused ? spotZone : viewer;
  return viewer;
}
/** "PST", "HST", "GMT": the short name of a zone at an instant. */
export const zoneAbbr = (tz: string, at: string | number | Date): string => fmtIn(tz, {timeZoneName: 'short'}).formatToParts(new Date(at)).find((x) => x.type === 'timeZoneName')?.value ?? '';
/** True when a clock in `tz` reads differently from the viewer's own at that instant (then a label names its zone). */
export const differsFromViewer = (tz: string, at: string | number | Date, viewer = viewerZone()): boolean => tz !== viewer && zoneAbbr(tz, at) !== zoneAbbr(viewer, at);
/** " HST" when a time shown in `tz` reads differently from the viewer's clock at that instant, else "": the zone tag of a spot's own times on multi-spot or viewer-zone screens. */
export const viewerTag = (tz: string, at: string | number | Date): string => (differsFromViewer(tz, at) ? ` ${zoneAbbr(tz, at)}` : '');
