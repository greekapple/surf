import {officialRange} from './officialSurf.ts';
import type {DayRange} from './spotHour.ts';
import {isFlat} from './flatSurf.ts';

/** T-107: what one week-grid cell shows. The cell is the day's TYPICAL range (the midday hour's estimate, `dayRange(...).typical`), never the min/max envelope over every daylight hour
 *  (that gave absurd "4–22 ft" cells); the full daylight spread goes to the tooltip and the aria text. `centralFt` is the field a wave glyph is drawn from (T-106). */
export interface WeekCell {kind: 'estimate' | 'official' | 'offshore' | 'none'; label: string; /** T-130: the midday hour is Flat (nearshore model under 0.5 ft): the label says Flat and the week curve sits at 0. */ flat?: boolean; loFt: number | null; hiFt: number | null; centralFt: number | null; spreadLoFt: number | null; spreadHiFt: number | null; spread: string | null; midday: string | null; /** T-118: the midday hour's confidence word. */ confidence: string | null; /** Set when the midday hour came from a saved, old (> 2 h), future-dated or undated source (T-084 rule): the cell says so. */ stale: 'saved' | 'stale' | null}
/** T-112: the day's range TEXT, from the one formatter every surface uses (the midday hour's headlineText value: the person's unit and height scale, one rounding rule), as `numbers` ("8–12") and `full` ("8–12 ft",
 *  "4–6 ft ≈ Hawaiian"). The week grid's cell and the spot page's day card both read it, so the same spot-day shows the same range on both. */
export function dayText(ty: DayRange['typical']): {numbers: string; full: string} | null {
  const v = ty?.hour?.surf?.value; if (!v || v === '—') return null;
  return {full: v, numbers: v.replace(/\s*(ft|m)( ≈ Hawaiian)?$/, '')};
}
export function weekCell(dr: DayRange, _unit: string): WeekCell {
  const ty = dr.typical, spreadOk = dr.loFt !== null && dr.hiFt !== null;
  const spread = spreadOk && dr.label && (dr.kind === 'estimate' || dr.kind === 'offshore') ? (dr.kind === 'offshore' ? `offshore heights range ${dr.label.replace(/ offshore$/, '')} over daylight` : `ranges ${dr.label.replace(/^Est\. /, '')} over daylight`) : null;
  const dt = dayText(ty);
  const hl = ty?.hour?.surf?.headline, sv = hl && (hl.kind === 'estimate' || hl.kind === 'offshore') ? hl.saved : undefined;
  const stale = sv ? (sv.reason === 'saved' ? 'saved' as const : 'stale' as const) : null;
  if (dr.kind === 'estimate' && ty && isFlat(hl)) return {kind: 'estimate', flat: true, label: 'Flat', loFt: 0, hiFt: 0, centralFt: 0, spreadLoFt: dr.loFt, spreadHiFt: dr.hiFt, spread, midday: ty.short, stale, confidence: null};
  if (dr.kind === 'estimate' && ty) return {kind: 'estimate', label: dt?.numbers ?? `${Math.round(ty.loFt)}–${Math.round(ty.hiFt)}`, loFt: ty.loFt, hiFt: ty.hiFt, centralFt: ty.centralFt, spreadLoFt: dr.loFt, spreadHiFt: dr.hiFt, spread, midday: ty.short, stale, confidence: ty?.hour?.surf?.confidenceText ? (hl && (hl.kind === 'estimate') ? (hl.confidence ?? null) : null) : null};
  // offshore-surf: the NWS's range for the zone and day (the label reads "NWS 6–8 ft" elsewhere; the cell shows the numbers and the grid tags it NWS)
  // two different half-day ranges (Honolulu): both are shown, "4–6 / 6–8" (AM / PM), never one half as the day
  const halves = dr.kind === 'official' && (dr.officialHalves?.length ?? 0) > 1 ? dr.officialHalves!.map((x) => officialRange(x, _unit === 'm' ? 'm' : 'ft').replace(/\s*(ft|m)$/, '')).join(' / ') : null;
  if (dr.kind === 'official' && ty) return {kind: 'official', label: halves ?? dt?.numbers ?? `${ty.loFt}–${ty.hiFt}`, loFt: ty.loFt, hiFt: ty.hiFt, centralFt: ty.centralFt, spreadLoFt: null, spreadHiFt: null, spread: null, midday: null, stale: hl && hl.kind === 'official' && hl.stale ? 'stale' as const : null, confidence: null};
  if (dr.kind === 'offshore' && ty) return {kind: 'offshore', label: dt?.numbers ?? String(Math.round(ty.hiFt)), loFt: ty.loFt, hiFt: ty.hiFt, centralFt: ty.centralFt, spreadLoFt: dr.loFt, spreadHiFt: dr.hiFt, spread, midday: ty.short, stale, confidence: null};
  return {kind: 'none', label: '—', loFt: null, hiFt: null, centralFt: null, spreadLoFt: null, spreadHiFt: null, spread: null, midday: null, stale: null, confidence: null};
}
