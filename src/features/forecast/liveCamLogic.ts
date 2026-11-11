import {fmtIn, dateInMs, addDaysKey} from '../../ocean/time.ts';
import {daylightFor} from '../../services/daylight.ts';

/** The "Live cam" panel's rules (bayarea-cams-wire), pure so they can be tested. DISPLAY ONLY: nothing here analyses or stores a frame. */
export const STILL_REFRESH_MS = 30 * 60000;      // a still is asked for again every 30 minutes while the page is open
export const STILL_OFFLINE_MS = 2 * 3600000;     // a still older than 2 h is "Offline": the frame is hidden, its age is said
/** USGS puts no capture time in the file (no EXIF, no JPEG comment; the stamp "Tue 11/10/2026 17:30 PST" and the epoch file name are only in the picture's pixels). Its `Last-Modified` is a REWRITE time, not a capture time: the same 17:30 frame
 *  was re-posted at 19:13 and again at 23:13 (2026-11-10), and by day a frame was posted 13-31 min after its stamp (stamped 9:00, posted 9:13; stamped 9:30, posted 10:01). So the capture time is bounded, not guessed:
 *  taken <= min(posted, first sighting of this content (its ETag)), and USGS collects in daylight only, so taken <= the most recent LAST LIGHT before that bound when the bound falls after last light or before first light
 *  (then it is the previous day's last light). The estimate is an upper bound: the picture may be older, never newer. */
export const STREAM_LOAD_TIMEOUT_MS = 12000;     // a YouTube player that has not reported ready after this long: "could not load"

/** "9 min", "1 h 20 min", "14 h", "2 d": how old a frame is. */
export function ageWords(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 3) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}
/** "9:43 AM PST" in the spot's own zone, with the weekday and date when the frame is not from the spot's today. */
export function postedLabel(ms: number, zone: string, nowMs: number): string {
  const clock = fmtIn(zone, {hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}).format(new Date(ms));
  return dateInMs(zone, ms) === dateInMs(zone, nowMs) ? clock : `${fmtIn(zone, {weekday: 'short', month: 'short', day: 'numeric'}).format(new Date(ms))}, ${clock}`;
}
export type StillBasis = 'posted' | 'first-seen' | 'last-light';
export type StillState =
  | {state: 'live'; postedMs: number; takenMs: number; ageMs: number; postedAgeMs: number; basis: StillBasis}
  | {state: 'offline'; postedMs: number; takenMs: number; ageMs: number; postedAgeMs: number; basis: StillBasis}
  | {state: 'unknown'};
/** The latest moment the picture can have been taken: min(posted, first sighting of this content), moved back to the most recent last light when that falls outside daylight. Without a spot, no daylight cap. */
export function takenEstimate(postedMs: number, o: {spotId?: string; zone?: string; firstSeenMs?: number | null} = {}): {takenMs: number; basis: StillBasis} {
  let bound = postedMs, basis: StillBasis = 'posted';
  if (Number.isFinite(o.firstSeenMs) && (o.firstSeenMs as number) < bound) { bound = o.firstSeenMs as number; basis = 'first-seen'; }
  if (!o.spotId || !o.zone) return {takenMs: bound, basis};
  const day = daylightFor(o.spotId, dateInMs(o.zone, bound)), first = Date.parse(day.firstLight), last = Date.parse(day.lastLight);
  if (Number.isFinite(last) && bound > last) return {takenMs: last, basis: 'last-light'};
  if (Number.isFinite(first) && bound < first) { const prev = daylightFor(o.spotId, addDaysKey(dateInMs(o.zone, bound), -1)), pl = Date.parse(prev.lastLight); if (Number.isFinite(pl)) return {takenMs: pl, basis: 'last-light'}; }
  return {takenMs: bound, basis};
}
/** The still's state from the owner's own Last-Modified (via /api/cam-meta) and the best-known capture bound: live while the picture is at most 2 h old by that bound, offline after; with no time at all the frame is NOT shown. */
export function stillState(lastModified: string | null | undefined, nowMs: number, opts: {spotId?: string; zone?: string; firstSeenAt?: string | null} = {}): StillState {
  const t = Date.parse(lastModified ?? ''); if (!Number.isFinite(t) || t > nowMs + 5 * 60000) return {state: 'unknown'};
  const {takenMs, basis} = takenEstimate(t, {spotId: opts.spotId, zone: opts.zone, firstSeenMs: Date.parse(opts.firstSeenAt ?? '')}), age = Math.max(0, nowMs - takenMs);
  return {state: age > STILL_OFFLINE_MS ? 'offline' : 'live', postedMs: t, takenMs, ageMs: age, postedAgeMs: Math.max(0, nowMs - t), basis};
}
/** What a stream can honestly say. Before the click SWELLO knows only the date it last saw it live (the camera list); the player itself reports the rest once loaded. */
export type StreamState = 'idle' | 'loading' | 'playing' | 'offline' | 'unavailable' | 'failed';
/** YouTube player error codes: 100 not found or private, 101 and 150 embedding disabled by the owner, 153 the player could not verify the embedding site (our setup); 2 invalid id, 5 HTML5 error. */
export function streamErrorWords(code: number): string {
  if (code === 100) return 'YouTube cannot find this stream (removed or private).';
  if (code === 101 || code === 150) return 'The owner no longer allows this stream to be embedded.';
  if (code === 153) return 'The YouTube player could not verify this site (a SWELLO setup problem, not the camera).';
  return `The YouTube player reported an error (${code}).`;
}
/** From the player's own video data: `isLive` false = a recording or an ended stream, true = live, anything else = not said (never guessed). */
export const streamLiveness = (data: {isLive?: unknown} | null | undefined): 'live' | 'not-live' | 'unknown' => (data?.isLive === true ? 'live' : data?.isLive === false ? 'not-live' : 'unknown');
export const kmWords = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`);
/** How far the camera is from the spot, as the row says it: exact, "about" when the position is approximate, or where it is when the distance is not known. */
export const distanceWords = (c: {km: number; kmApprox?: boolean; kmUnknown?: boolean; position?: string; neighbour?: string}): string => (c.kmUnknown ? c.position ?? 'position unknown' : c.neighbour ? `${c.kmApprox ? 'about ' : ''}${kmWords(c.km)} ${c.neighbour} (a neighboring beach, not this spot)` : `${c.kmApprox ? 'about ' : ''}${kmWords(c.km)} from this spot`);
/** "Nov 10, 2026": a check date from the camera list (YYYY-MM-DD) in the app's date words, whatever the viewer's zone. */
export const checkedWords = (ymd: string): string => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd); return m ? new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}).format(Date.UTC(+m[1], +m[2] - 1, +m[3])) : ymd; };
/** The Offline words for a still. A frame posted after dusk is the last daylight frame ("No frame since dusk; USGS collects in daylight only"), not a fault. The age is of the ESTIMATED capture time and says so. */
export function offlineWords(o: {postedMs: number; takenMs?: number; ageMs: number; zone: string; spotId: string; nowMs: number; offlineNote?: string}): string {
  const taken = o.takenMs ?? o.postedMs, takenLabel = postedLabel(taken, o.zone, o.nowMs), posted = postedLabel(o.postedMs, o.zone, o.nowMs), age = ageWords(o.ageMs), day = daylightFor(o.spotId, dateInMs(o.zone, o.postedMs)), sunset = Date.parse(day.sunset);
  const dusk = Number.isFinite(sunset) && o.postedMs >= sunset - 60 * 60000, tail = `The newest picture was taken ${o.takenMs && o.takenMs < o.postedMs ? 'about ' : ''}${takenLabel}${o.takenMs && o.takenMs < o.postedMs ? ' or earlier' : ''}, about ${age} ago (the file carries no capture time; it was posted ${posted}), so it is not shown.`;
  return dusk ? `No frame since dusk; USGS collects in daylight only. ${tail}` : `${tail} ${o.offlineNote ?? ''}`.trim();
}
