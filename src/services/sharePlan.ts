import type {Forecast, SurfSpot, UserProfile} from '../models/index.ts';
import type {OceanBundle} from '../ocean/types.ts';
import {fmtIn} from '../ocean/time.ts';
import {timeZoneOf} from '../ocean/spotZone.ts';
import {spotHourOf} from './spotHour.ts';
import {windowLabel} from './homeDash.ts';
import {zoneOf, stateOfZone} from '../data/zones.ts';
import {windowHour} from './call.ts';
import type {Call} from './call.ts';

/** Share a plan (quiver-small): the text carries ONLY the app's own labelled numbers and tags for the window's first shared hour: spot, weekday and window in the spot's clock with its zone name, "from <that hour>", the
 *  rating word as provisional, and the surf height with the app's own tags (its estimate tag: model / stale / saved estimate; the buoy-correction tag; "tuned to your reports"; "models differ"; its confidence word; on Hawaii spots
 *  "surf height, not Hawaiian scale" as the spot page says it). A size is left out when the app has none (never an offshore height, never a made-up number). Nothing is shared in demonstration mode (no evidence, no plan).
 *  A window that is already running is shared from the current hour (the numbers and `t` are the hour the person would open), never from a start that has passed. */
export interface SharePlan {title: string; text: string; url: string}
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const HOUR = 3600000;
/** The spot page's own rule (SpotPage.tsx scaleNote): on Hawaii spots the numbers are surf height, and the Hawaiian scale is named as not used unless the profile chose it. */
export const hawaiianScaleNote = (spot: SurfSpot, profile: UserProfile): string => (stateOfZone(zoneOf(spot.region)) === 'Hawaii' && profile.scale !== 'Hawaiian' ? ', not Hawaiian scale' : '');
export function sharePlanFor(spot: SurfSpot, call: Pick<Call, 'verdict' | 'window' | 'nextWindow'>, records: Forecast[], profile: UserProfile, nowMs: number, slug: string, origin = '', bundle?: Pick<OceanBundle, 'nearshore' | 'mop'> | null): SharePlan | null {
  const w = call.verdict !== 'Dark' && call.window ? call.window : call.nextWindow; if (!w) return null;
  const tz = timeZoneOf(spot), end = Date.parse(w.end), startMs = Math.max(Date.parse(w.start), Math.floor(nowMs / HOUR) * HOUR); if (!(startMs < end)) return null;
  const rec = windowHour(records, spot.id, {start: new Date(startMs).toISOString()}); if (!rec || !rec.evidence) return null;
  const hr = spotHourOf(spot, rec, nowMs, profile, {bundle}); if (hr.demo) return null;
  const zone = fmtIn(tz, {timeZoneName: 'short'}).formatToParts(new Date(startMs)).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const day = fmtIn(tz, {weekday: 'short'}).format(new Date(startMs)), label = windowLabel(startMs, end, tz), from = label.split('–')[0];
  const rated = hr.rating.score !== null && String(hr.rating.category) !== 'UNRATED' ? `${titleCase(String(hr.rating.category))} (provisional rating)` : null;
  const h = hr.surf.headline;
  let size: string | null = null;
  if (h.kind === 'estimate' && !h.nearshoreOnly?.flat && hr.surf.value && hr.surf.value !== '—') {
    const tags = [hr.surf.tag, h.transfer?.tag, h.calibration ? 'tuned to your reports' : null, h.interval?.disagree ? 'models differ' : null, hr.surf.confidenceText].filter((x): x is string => !!x);
    size = `${hr.surf.value} surf height${hawaiianScaleNote(spot, profile)}${tags.length ? ` (${tags.join('; ')})` : ''}`;
  }
  const when = `${day} ${label}${zone ? ` ${zone}` : ''}`, text = [spot.name, when, [`from ${from}:`, rated].filter(Boolean).join(' ') || null, size].filter(Boolean).join(' · ') + ' — SWELLO';
  const hour = new Date(Math.floor(startMs / HOUR) * HOUR).toISOString().replace('.000Z', 'Z');
  return {title: `${spot.name} · SWELLO`, text, url: `${origin}/forecast?spot=${encodeURIComponent(slug)}&t=${hour}`};
}
/** `?t=` of a deep link: a valid time, normalised to the hour record's own ISO form; anything else is ignored. */
export const hourFromParam = (t: string | null): string | null => { if (!t) return null; const ms = Date.parse(t); return Number.isFinite(ms) ? new Date(Math.floor(ms / 3600000) * 3600000).toISOString() : null; };
