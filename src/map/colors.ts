import type {SpatialFrame} from './spatial.ts';
import type {UserProfile} from '../models/index.ts';
export function colorScale(unit:SpatialFrame['unit']){return unit==='m'?[0,.5,1,2,3,5,8]:unit==='s'?[0,5,8,11,14,18,24]:unit==='m/s'?[0,2,5,8,12,18,25]:[0,60,120,180,240,300,360];}
const colors=['#223c8e','#317cb5','#46b6b2','#81be6b','#e9cf64','#d67556','#9b437e'];
export function forecastColor(value:number,unit:SpatialFrame['unit']){const stops=colorScale(unit),v=Math.max(stops[0],Math.min(stops.at(-1)!,value));let i=stops.findIndex((n,j)=>j>0&&v<=n)-1;i=Math.max(0,i);const t=(v-stops[i])/(stops[i+1]-stops[i]);const rgb=(hex:string)=>[1,3,5].map(j=>parseInt(hex.slice(j,j+2),16));const palette=unit==='deg'?['#223c8e','#317cb5','#46b6b2','#81be6b','#e9cf64','#9b437e','#223c8e']:colors;const a=rgb(palette[i]),b=rgb(palette[i+1]);return `rgb(${a.map((n,j)=>Math.round(n+(b[j]-n)*t)).join(',')})`;}
export function legendValue(value:number,unit:SpatialFrame['unit'],p:UserProfile){return unit==='m'?`${(p.heightUnit==='ft'?value/.3048:value).toFixed(1)} ${p.heightUnit}`:unit==='m/s'?`${(value*(p.windUnit==='mph'?2.2369362921:p.windUnit==='kn'?1.9438444924:3.6)).toFixed(0)} ${p.windUnit}`:`${value} ${unit==='deg'?'°':unit}`;}

/* T-115 (user decision 2026-11-04): the map uses WINDY's colour ramps. The stops were sampled from the legend strips of the reference captures
 * ~/Development/swello-design-references/18-teardown-2026-10-31/windy/1440-02-waves-layer.png (waves and swell share one ramp, legend "ft 1.6 3.3 5 6.6 20 30") and 1440-01-wind-map.png.
 * Third-party reference only: the colours are sampled values, nothing of Windy's code or imagery ships. */
/** Windy wave-height ramp: [feet, colour]. Teal for calm, through blue and indigo, to maroon, red and pale salmon for huge seas. */
export const WINDY_WAVES_FT: readonly (readonly [number, string])[] = [[0, '#329eba'], [1.6, '#2e93ad'], [3.3, '#2d5c88'], [5, '#3664b4'], [6.6, '#38397f'], [9.2, '#533666'], [10.9, '#6b3552'], [12.7, '#7f3139'],
  [14.4, '#903537'], [16.2, '#a03d43'], [19.7, '#b04551'], [24, '#c16162'], [27.5, '#c0776a'], [30, '#c0a39d']];
/** Windy wind ramp, equally spaced from calm to storm: violet-blue, blue, teal, green, olive, rust, magenta, purple. */
export const WINDY_WIND = ['#6271b8', '#4f70ad', '#4688a5', '#4a9296', '#45836a', '#4ca250', '#659132', '#a27f49', '#905d53', '#8f435c', '#8c447c', '#7a5898', '#5e70a0'] as const;
const FT_PER_M = 1 / 0.3048;
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const mix = (a: string, b: string, f: number): [number, number, number] => { const x = hexRgb(a), y = hexRgb(b); return [0, 1, 2].map((k) => Math.round(x[k] + (y[k] - x[k]) * f)) as [number, number, number]; };
/** Windy's colour for a wave height in metres (their legend is non-linear: equal spacing between the 1.6, 3.3, 5, 6.6, 20, 30 ft ticks, so we interpolate in feet between the sampled stops). */
export function windyWaveColor(metres: number): [number, number, number] {
  const ft = Math.max(0, Math.min(30, metres * FT_PER_M)), s = WINDY_WAVES_FT; let i = s.findIndex(([v]) => ft <= v) - 1; if (i < 0) i = ft <= 0 ? 0 : s.length - 2;
  return mix(s[i][1], s[i + 1][1], (ft - s[i][0]) / (s[i + 1][0] - s[i][0]));
}
function windyWindColor(t: number): [number, number, number] { const x = Math.max(0, Math.min(1, t)) * (WINDY_WIND.length - 1), i = Math.min(WINDY_WIND.length - 2, Math.floor(x)); return mix(WINDY_WIND[i], WINDY_WIND[i + 1], x - i); }
/** The map's colour for a value in a field's unit over the display range [lo, hi]: metres use Windy's wave ramp at the true wave height; period (s) walks the same ramp teal to red across its range; wind (m/s) uses Windy's wind ramp. */
export function mapColor(value: number, unit: string, lo: number, hi: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1)));
  if (unit === 'm') return windyWaveColor(value);
  if (unit === 'm/s') return windyWindColor(t);
  if (unit === 's') return windyWaveColor((t * 20) / FT_PER_M); // 0..20 ft of the wave ramp (teal to red)
  return windyWaveColor(t * 9);
}
/** `n` equally spaced colour stops over the display range, for the legend's gradient (the legend and the field use the same function, so they cannot disagree). */
export function legendRamp(unit: string, lo: number, hi: number, n = 13): string[] {
  return Array.from({length: n}, (_, i) => { const c = mapColor(lo + ((hi - lo) * i) / (n - 1), unit, lo, hi); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); });
}

/** Value range of the ramp per unit (metres, seconds, metres per second). Waves: Windy's own ticks run to 30 ft, the coastal view shows 0 to 4 m (13 ft) so a 2 to 3 m sea spans indigo to maroon, not one flat colour. */
export const RANGE: Record<string, [number, number]> = {m: [0, 4], s: [6, 18], 'm/s': [0, 15], deg: [0, 360]};
/** Wider ramps for the ocean-basin view, where storm seas would otherwise saturate the coastal scale. */
export const RANGE_WIDE: Record<string, [number, number]> = {m: [0, 9], s: [4, 20], 'm/s': [0, 25], deg: [0, 360]};
/** Legend gradient stops for a unit and view. */
export const rampFor = (unit: string, wide = false): string[] => { const [lo, hi] = (wide ? RANGE_WIDE : RANGE)[unit] ?? [0, 1]; return legendRamp(unit, lo, hi); };
/** Kept for importers: the coastal wave ramp. */
export const RAMP = rampFor('m');

