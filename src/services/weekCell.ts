import type {DayRange} from './spotHour.ts';

/** T-107: what one week-grid cell shows. The cell is the day's TYPICAL range (the midday hour's estimate, `dayRange(...).typical`), never the min/max envelope over every daylight hour
 *  (that gave absurd "4–22 ft" cells); the full daylight spread goes to the tooltip and the aria text. `centralFt` is the field a wave glyph is drawn from (T-106). */
export interface WeekCell {kind: 'estimate' | 'offshore' | 'none'; label: string; loFt: number | null; hiFt: number | null; centralFt: number | null; spreadLoFt: number | null; spreadHiFt: number | null; spread: string | null; midday: string | null; /** Set when the midday hour came from a saved, old (> 2 h), future-dated or undated source (T-084 rule): the cell says so. */ stale: 'saved' | 'stale' | null}
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(0));
export function weekCell(dr: DayRange, unit: string): WeekCell {
  const ty = dr.typical, spreadOk = dr.loFt !== null && dr.hiFt !== null;
  const spread = spreadOk && (dr.kind === 'estimate' || dr.kind === 'offshore') ? (dr.kind === 'offshore' ? `offshore heights range ${n(dr.loFt!)}–${n(dr.hiFt!)} ${unit} over daylight` : `ranges ${n(dr.loFt!)}–${n(dr.hiFt!)} ${unit} over daylight`) : null;
  const hl = ty?.hour?.surf?.headline, sv = hl && (hl.kind === 'estimate' || hl.kind === 'offshore') ? hl.saved : undefined;
  const stale = sv ? (sv.reason === 'saved' ? 'saved' as const : 'stale' as const) : null;
  if (dr.kind === 'estimate' && ty) return {kind: 'estimate', label: `${n(ty.loFt)}–${n(ty.hiFt)}`, loFt: ty.loFt, hiFt: ty.hiFt, centralFt: ty.centralFt, spreadLoFt: dr.loFt, spreadHiFt: dr.hiFt, spread, midday: ty.short, stale};
  if (dr.kind === 'offshore' && ty) return {kind: 'offshore', label: n(ty.hiFt), loFt: ty.loFt, hiFt: ty.hiFt, centralFt: ty.centralFt, spreadLoFt: dr.loFt, spreadHiFt: dr.hiFt, spread, midday: ty.short, stale};
  return {kind: 'none', label: '—', loFt: null, hiFt: null, centralFt: null, spreadLoFt: null, spreadHiFt: null, spread: null, midday: null, stale: null};
}
