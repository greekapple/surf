/** offshore-surf step 3: the NWS Surf Zone Forecast (SRF) as a labelled "official" surf height for a spot that has no estimate of ours.
 *  The NWS's number, as the NWS wrote it, for its zone and period: never ours, never mixed into our rating maths, never converted except to the person's unit when shown. Pure: callers hand in the product.
 *  The product comes from /api/srf?office= (services/srf-serve.mjs, parsed by services/srf-parse.mjs). The pick of the facing entry mirrors pickEntry in srf-parse.mjs (a test keeps them identical). */
import {SRF_ZONE_OF} from '../data/srfZones.ts';
import {COAST_ROWS, UPGRADED_ROWS} from '../data/coast.ts';
import {timeZoneOf} from '../ocean/spotZone.ts';

export interface SrfEntry {label: string; facing: string | null; lo: number | null; hi: number | null; kind: 'range' | 'around' | 'or_less' | 'single' | 'text'; raw: string; then: string | null; sets: string | null}
export interface SrfPeriod {label: string; date: string | null; part: string | null; surf: SrfEntry[]}
export interface SrfZone {ugc: string[]; name: string; expires: string | null; issued: {date: string; time: string; tz: string; weekday: string} | null; periods: SrfPeriod[]}
export interface SrfProduct {schema: 1; office: string; id: string; issuedAt: string; zones: SrfZone[]}

export const MAX_FACING_DIFF = 45;
/** Honolulu's product does not say whether its heights are face or Hawaiian scale: said visibly beside the number, never converted */
export const officialScaleNote = (office: string): string | null => (office === 'HFO' ? 'scale as the NWS publishes it, not converted to face or Hawaiian' : null);
export const officialProductUrl = (id: string) => `https://api.weather.gov/products/${id}`;
/** a product older than its zone's own next scheduled issue (the UGC expiry) plus this is shown as stale */
export const STALE_AFTER_EXPIRY_H = 6;
const COMPASS_DEG: Record<string, number> = {north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315};
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export const srfZoneOf = (spotId: string): {office: string; zone: string} | null => { const v = SRF_ZONE_OF[spotId]; if (!v) return null; const [office, zone] = v.split('|'); return {office, zone}; };
let seaward: Map<string, number> | null = null;
const seawardOf = (spotId: string) => (seaward ??= new Map([...UPGRADED_ROWS, ...COAST_ROWS].map((r) => [r[0], r[6]] as [string, number]))).get(spotId) ?? null;
/** the SRF offices the given spots need (to fetch) */
export const srfOfficesFor = (spotIds: Iterable<string>): string[] => [...new Set([...spotIds].flatMap((id) => { const z = srfZoneOf(id); return z ? [z.office] : []; }))].sort();

export type EntryPick = {entry: SrfEntry} | {reason: string};
/** Which entry of a period describes a spot facing `bearing`? One unlabelled entry is zone-wide; several are matched by the nearest named facing within MAX_FACING_DIFF degrees; a tie, a mismatch, no bearing, an unreadable range: a reason, never a guess. */
export function pickFacingEntry(entries: SrfEntry[], bearing: number | null): EntryPick {
  if (!entries.length || entries.every((e) => e.kind === 'text')) return {reason: 'the NWS period has no readable surf height'};
  let used: SrfEntry;
  if (entries.length === 1 && !entries[0].facing) used = entries[0];
  else {
    if (!finite(bearing)) return {reason: 'no seaward bearing for the spot'};
    // match the facing against EVERY entry (an unreadable one included): if the nearest facing is unreadable, nothing is shown, never the next-nearest facing's number
    const faced = entries.filter((e) => e.facing && e.facing in COMPASS_DEG).map((e) => ({e, d: angDiff(bearing, COMPASS_DEG[e.facing!])})).sort((a, b) => a.d - b.d);
    if (!faced.length) return {reason: 'the NWS entries name no facing'};
    if (faced.length > 1 && Math.abs(faced[0].d - faced[1].d) < 1) return {reason: 'two NWS facings equally near the spot'};
    if (faced[0].d > MAX_FACING_DIFF) return {reason: `the spot faces more than ${MAX_FACING_DIFF} degrees from every facing the NWS lists`};
    used = faced[0].e;
  }
  if (used.kind === 'text') return {reason: 'the NWS text for the nearest facing is not a number'};
  if (used.kind !== 'or_less' && (!finite(used.lo) || !finite(used.hi))) return {reason: 'the NWS range has no numbers'};
  if (used.kind === 'or_less' && !finite(used.hi)) return {reason: 'the NWS range has no number'};
  return {entry: used};
}

export interface OfficialSurf {
  kind: 'official'; loFt: number; hiFt: number; /** Honolulu publishes AM and PM halves: which half this number is, else null (a whole-day period) */ half: 'AM' | 'PM' | null; /** "around N feet": shown "about N ft" */ about: boolean; /** "N feet or less": shown "up to N ft", there is no lower bound */ upTo: boolean;
  label: string; office: string; zone: string; zoneName: string; facing: string | null; entryLabel: string; raw: string; sets: string | null; then: string | null;
  periodLabel: string; periodDate: string; issuedAt: string; /** "Wed 4:35 AM PST", as the NWS wrote it */ issuedText: string | null; productId: string;
  /** set when the product is older than its zone's next scheduled issue plus STALE_AFTER_EXPIRY_H */ stale: {expiredAt: string} | null;
}
/** AM/PM half of a half-day period (Honolulu's table), or null for a whole-day period */
export const halfOf = (part: string | null | undefined): 'AM' | 'PM' | null => (/-am$/i.test(part ?? '') ? 'AM' : /-pm$/i.test(part ?? '') ? 'PM' : null);
export type OfficialResult = {ok: true; official: OfficialSurf} | {ok: false; reason: string};

/** the instant an SRF zone block expires: its UGC header carries DDHHMM (UTC), in the month of issue or the next */
export function expiryOf(issuedAt: string, ddhhmm: string | null): number | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(ddhhmm ?? ''), t = Date.parse(issuedAt); if (!m || !Number.isFinite(t)) return null;
  const i = new Date(t); let e = Date.UTC(i.getUTCFullYear(), i.getUTCMonth(), +m[1], +m[2], +m[3]);
  if (e < t - 86400000) e = Date.UTC(i.getUTCFullYear(), i.getUTCMonth() + 1, +m[1], +m[2], +m[3]);
  return Number.isFinite(e) ? e : null;
}
const dateIn = (tz: string, ms: number) => { try { return new Intl.DateTimeFormat('en-CA', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms)); } catch { return new Date(ms).toISOString().slice(0, 10); } };
const hourIn = (tz: string, ms: number) => { try { return Number(new Intl.DateTimeFormat('en-US', {timeZone: tz, hour: 'numeric', hourCycle: 'h23'}).format(new Date(ms))); } catch { return new Date(ms).getUTCHours(); } };
const issuedText = (z: SrfZone) => (z.issued ? `${z.issued.weekday} ${z.issued.time.replace(/^(\d{1,2})(\d{2})\s/, '$1:$2 ')} ${z.issued.tz}` : null);
const FT_TO_M = 0.3048;
/** the number text in the person's unit: "6–8 ft", "up to 3 ft", "1.8–2.4 m". The NWS publishes feet; metres are a plain conversion, never a scale change. */
export function officialRange(h: Pick<OfficialSurf, 'loFt' | 'hiFt' | 'upTo'> & {about?: boolean}, unit: 'ft' | 'm'): string {
  const c = (ft: number) => (unit === 'm' ? String(Math.round(ft * FT_TO_M * 10) / 10) : String(ft)), u = unit === 'm' ? 'm' : 'ft';
  return h.upTo ? `up to ${c(h.hiFt)} ${u}` : h.about ? `about ${c(h.loFt)} ${u}` : h.loFt === h.hiFt ? `${c(h.loFt)} ${u}` : `${c(h.loFt)}–${c(h.hiFt)} ${u}`;
}
/** "NWS surf forecast: 6–8 ft (North Facing, Kauai), issued Tue 3:43 PM HST": labelled as the NWS's, with its issue time */
export function officialLabel(h: Pick<OfficialSurf, 'loFt' | 'hiFt' | 'upTo' | 'about' | 'half' | 'zoneName' | 'facing' | 'entryLabel' | 'issuedText'>, unit: 'ft' | 'm'): string {
  const who = h.facing ? `${h.entryLabel}, ${h.zoneName}` : h.zoneName;
  return `NWS surf forecast: ${officialRange(h, unit)}${h.half ? ` ${h.half}` : ''} (${who})${h.issuedText ? `, issued ${h.issuedText}` : ''}`;
}

/** The NWS surf forecast for a spot's local day at `hourMs`. Reasons, never a fallback: no zone, no product, zone not in the product, no period for that day, no readable height, no matching facing. */
export function officialFor(spotId: string, hourMs: number, product: SrfProduct | null | undefined, nowMs: number): OfficialResult {
  const z = srfZoneOf(spotId); if (!z) return {ok: false, reason: 'no NWS surf zone maps to this spot'};
  if (!product || product.office !== z.office || !Array.isArray(product.zones)) return {ok: false, reason: 'no NWS surf forecast loaded for this zone'};
  const zone = product.zones.find((x) => x.ugc.includes(z.zone)); if (!zone) return {ok: false, reason: 'the zone is not in the latest NWS product'};
  const tz = timeZoneOf(spotId), date = dateIn(tz, hourMs), hr = hourIn(tz, hourMs);
  let periods = zone.periods.filter((p) => p.date === date && !/^night/.test(p.part ?? '') && p.surf?.length);
  if (!periods.length) return {ok: false, reason: 'the NWS product has no surf period for this day'};
  // Honolulu publishes AM and PM halves: the hour takes ITS half, and a day whose halves do not include this hour's shows nothing (an AM range is never passed off as the whole day)
  const halved = periods.some((p) => /-(am|pm)$/i.test(p.part ?? ''));
  if (halved) { periods = periods.filter((p) => (hr < 12 ? /-am$/i : /-pm$/i).test(p.part ?? '')); if (!periods.length) return {ok: false, reason: 'the NWS product has no half-day period for this hour'}; }
  const per = periods[0], pick = pickFacingEntry(per.surf, seawardOf(spotId)); if ('reason' in pick) return {ok: false, reason: pick.reason};
  const e = pick.entry, upTo = e.kind === 'or_less', hi = e.hi as number, lo = upTo ? 0 : (e.lo as number);
  const exp = expiryOf(product.issuedAt, zone.expires) ?? (Date.parse(product.issuedAt) + 30 * 3600000), stale = Number.isFinite(exp) && nowMs > exp + STALE_AFTER_EXPIRY_H * 3600000 ? {expiredAt: new Date(exp).toISOString()} : null;
  const base = {loFt: lo, hiFt: hi, half: halfOf(per.part), upTo, about: e.kind === 'around', zoneName: zone.name, facing: e.facing, entryLabel: e.label, issuedText: issuedText(zone)};
  const label = officialLabel(base, 'ft');
  return {ok: true, official: {kind: 'official', ...base, label, office: z.office, zone: z.zone, raw: e.raw, sets: e.sets, then: e.then, periodLabel: per.label, periodDate: date, issuedAt: product.issuedAt, productId: product.id, stale}};
}
