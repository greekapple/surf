// Picker values per layer (Windy P1): the field gives the layer's own value; the point forecast (Open-Meteo, the same hour) adds what the grid does not carry: the wind GUST, and the SWELL period and direction.
// Pure: reads the point forecast arrays at the hour nearest the selected time (within 90 minutes), never invents a value.
export interface PointDataLike {time: number[]; windGust?: (number | null)[]; swellPeriod?: (number | null)[]; swellDirection?: (number | null)[]; wavePeriod?: (number | null)[]}
export interface PointExtras {gustMs: number | null; swellPeriodS: number | null; swellDirDeg: number | null}
export function pointExtras(d: PointDataLike | null | undefined, timeISO: string | null): PointExtras {
  const none: PointExtras = {gustMs: null, swellPeriodS: null, swellDirDeg: null}; if (!d || !d.time?.length || !timeISO) return none;
  const t = Date.parse(timeISO) / 1000; if (!Number.isFinite(t)) return none;
  let k = 0; for (let i = 1; i < d.time.length; i++) if (Math.abs(d.time[i] - t) < Math.abs(d.time[k] - t)) k = i;
  if (Math.abs(d.time[k] - t) > 5400) return none;
  const at = (a?: (number | null)[]) => { const v = a?.[k]; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
  return {gustMs: at(d.windGust), swellPeriodS: at(d.swellPeriod), swellDirDeg: at(d.swellDirection)};
}
