import type {DayRange} from './spotHour.ts';

/** T-107: what one week-grid cell shows. The cell is the day's TYPICAL range (the midday hour's estimate, `dayRange(...).typical`), never the min/max envelope over every daylight hour
 *  (that gave absurd "4–22 ft" cells); the full daylight spread goes to the tooltip and the aria text. `centralFt` is the field a wave glyph is drawn from (T-106). */
export interface WeekCell {kind: 'estimate' | 'offshore' | 'none'; label: string; loFt: number | null; hiFt: number | null; centralFt: number | null; spreadLoFt: number | null; spreadHiFt: number | null; spread: string | null; midday: string | null}
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(0));
export function weekCell(dr: DayRange, unit: string): WeekCell {
  const ty = dr.typical, spreadOk = dr.loFt !== null && dr.hiFt !== null;
  const spread = spreadOk && (dr.kind === 'estimate' || dr.kind === 'offshore') ? `ranges ${n(dr.loFt!)}–${n(dr.hiFt!)} ${unit}${dr.kind === 'offshore' ? ' offshore' : ''} over daylight` : null;
  if (dr.kind === 'estimate' && ty) return {kind: 'estimate', label: `${n(ty.loFt)}–${n(ty.hiFt)}`, loFt: ty.loFt, hiFt: ty.hiFt, centralFt: ty.centralFt, spreadLoFt: dr.loFt, spreadHiFt: dr.hiFt, spread, midday: ty.short};
  if (dr.kind === 'offshore' && ty) return {kind: 'offshore', label: n(ty.hiFt), loFt: ty.loFt, hiFt: ty.hiFt, centralFt: ty.centralFt, spreadLoFt: dr.loFt, spreadHiFt: dr.hiFt, spread, midday: ty.short};
  return {kind: 'none', label: '—', loFt: null, hiFt: null, centralFt: null, spreadLoFt: null, spreadHiFt: null, spread: null, midday: null};
}
