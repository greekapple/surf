import type {Measurement, StationTides, TidePrediction} from './types.ts';

/** A2: ONE tide source per spot. The curve a spot shows (card, chart, timeline, table, the rating's tide factor) is its own station's: the hourly NOAA prediction where the station is harmonic, else a cosine curve between that station's own
 *  predicted highs and lows (a subordinate station publishes only highs and lows, as offsets from a reference station). The highs and lows are NOAA's; the curve between them is drawn here and says so. Pure, tested. */
export type TideCurveKind = 'hourly' | 'interpolated';
export interface SpotTideSeries {kind: TideCurveKind; stationId: string; stationName: string; distanceKm: number; heights: Map<string, Measurement>}
const HOUR = 3600000;
/** Whole-UTC-hour heights between the first and last predicted extreme: h(t) = h0 + (h1 - h0)(1 - cos(pi (t - t0)/(t1 - t0)))/2 between successive highs and lows. Needs two extremes that alternate sensibly; otherwise empty. */
export function interpolatedHeights(extrema: TidePrediction[], station: {id: string; name: string; distanceKm: number}): Map<string, Measurement> {
  const out = new Map<string, Measurement>(), pts = extrema.filter((e) => e.height.value !== null && Number.isFinite(Date.parse(e.timestamp))).map((e) => ({t: Date.parse(e.timestamp), v: e.height.value as number, e})).sort((a, b) => a.t - b.t);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1]; if (b.t <= a.t) continue;
    for (let t = Math.ceil(a.t / HOUR) * HOUR; t < b.t || (i + 2 === pts.length && t === b.t); t += HOUR) {
      const v = a.v + (b.v - a.v) * (1 - Math.cos(Math.PI * (t - a.t) / (b.t - a.t))) / 2, ts = new Date(t).toISOString();
      out.set(ts, {value: v, unit: 'ft', source: {...a.e.height.source, validAt: ts, notes: `Curve interpolated between NOAA's predicted highs and lows at ${station.name} (${station.id}), ${station.distanceKm} km from the spot; the highs and lows are NOAA's, the shape between them is drawn here (subordinate station: NOAA publishes no hourly curve). Relative to MLLW. Local beach tide uncalibrated.`, location: `${station.name} station ${station.id}, ${station.distanceKm} km; curve interpolated between NOAA's predicted highs and lows, not a beach tide`}});
    }
  }
  return out;
}
export function spotTideSeries(st: StationTides | undefined, station: {id: string; name: string; distanceKm: number}): SpotTideSeries | null {
  if (!st) return null;
  const hourly = new Map(st.hourly.filter((h) => h.height.value !== null).map((h) => [h.timestamp, h.height] as const));
  if (hourly.size >= 24) return {kind: 'hourly', stationId: station.id, stationName: station.name, distanceKm: station.distanceKm, heights: hourly};
  const heights = interpolatedHeights(st.extrema, station); return heights.size >= 24 ? {kind: 'interpolated', stationId: station.id, stationName: station.name, distanceKm: station.distanceKm, heights} : null;
}
/** The words under a tide card or chart for a curve of this kind. */
export const tideCurveWords = (s: Pick<SpotTideSeries, 'kind' | 'stationName' | 'stationId' | 'distanceKm'>): string =>
  s.kind === 'hourly' ? `NOAA CO-OPS hourly prediction at ${s.stationName} (${s.stationId}), ${s.distanceKm} km from this spot, not at the beach` : `Curve interpolated between NOAA's predicted highs and lows at ${s.stationName} (${s.stationId}), ${s.distanceKm} km from this spot, not at the beach`;
/** The predicted highs and lows of the spot's OWN station: San Francisco's where SF is that station (the bundle's `extrema`), else that station's from `stationTides`. [] when there is no station or nothing loaded. */
export function extremaForOwnStation(bundle: {extrema?: TidePrediction[]; stationTides?: Record<string, StationTides>} | null | undefined, stationId: string | null | undefined, sfId: string): TidePrediction[] {
  if (!bundle || !stationId) return [];
  return stationId === sfId ? bundle.extrema ?? [] : bundle.stationTides?.[stationId]?.extrema ?? [];
}
