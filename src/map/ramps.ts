import {mapConfig, type ScaleKey} from './mapConfig.ts';
import {lchToRgb, hexToRgb, rgbToHex, type RGB} from './colorMath.ts';

/** The map's colour ramps (Stage 3), built from `mapConfig.scales`: one fixed absolute scale per layer. The painter, the legend and the tests all read these functions, so the legend IS the painted ramp. Pure. */
export type Theme = 'light' | 'dark';
export type ScaleDef = (typeof mapConfig.scales)[ScaleKey];
export const SCALE_KEYS = Object.keys(mapConfig.scales) as ScaleKey[];
export const scaleOf = (k: ScaleKey): ScaleDef => mapConfig.scales[k];

const hueAt = (hues: readonly (readonly [number, number])[], t: number) => { for (let i = 0; i < hues.length - 1; i++) if (t <= hues[i + 1][0]) { const [a, ha] = hues[i], [b, hb] = hues[i + 1]; return ha + ((hb - ha) * (t - a)) / (b - a || 1); } return hues[hues.length - 1][1]; };
/** Colour at position t (0 = the calm end, 1 = the top of the scale). Lightness is linear in t, so it never reverses. */
export function rampColorAt(key: ScaleKey, t: number, theme: Theme = 'light'): RGB {
  const sc = scaleOf(key), x = Math.max(0, Math.min(1, t)), stops = (sc as {stops?: readonly string[]}).stops;
  if (stops) { // explicit colour stops (Windy's wave-height colours): linear in RGB between neighbours, one stop per breakpoint, theme-independent
    const n = stops.length - 1, f = x * n, i = Math.min(n - 1, Math.floor(f)), k = f - i, a = hexToRgb(stops[i]), b = hexToRgb(stops[i + 1]);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  const [l0, l1] = sc.light[theme];
  return lchToRgb(l0 + (l1 - l0) * x, sc.chroma * (0.62 + 0.38 * Math.sin(Math.PI * x ** 0.9)), hueAt(sc.hues, x));
}
/** The breakpoints in the data's native unit (metres, seconds, metres per second). */
export const breakpointsNative = (key: ScaleKey) => scaleOf(key).breakpoints.map((b) => b * scaleOf(key).perDisplayUnit);
/** Position along the ramp for a native value: piecewise linear through the breakpoints, which are evenly spaced, clamped at both ends. */
export function valueToPos(key: ScaleKey, native: number): number {
  const bp = breakpointsNative(key), n = bp.length - 1; if (!Number.isFinite(native)) return 0; if (native <= bp[0]) return 0; if (native >= bp[n]) return 1;
  let i = 0; while (i < n - 1 && native > bp[i + 1]) i++;
  return (i + (native - bp[i]) / (bp[i + 1] - bp[i])) / n;
}
/** The colour of a native value on a layer's fixed scale. */
export const layerColor = (key: ScaleKey, native: number, theme: Theme = 'light'): RGB => rampColorAt(key, valueToPos(key, native), theme);
/** 512-step table over the scale's whole native domain, for the painter; `lutIndex` maps a native value to its slot. */
export const LUT_STEPS = 512;
export const nativeMax = (key: ScaleKey) => breakpointsNative(key).at(-1)!;
export function colorLut(key: ScaleKey, theme: Theme = 'light'): Uint8Array {
  const lo = breakpointsNative(key)[0], hi = nativeMax(key), lut = new Uint8Array(LUT_STEPS * 3);
  for (let q = 0; q < LUT_STEPS; q++) { const c = layerColor(key, lo + ((hi - lo) * q) / (LUT_STEPS - 1), theme); lut[q * 3] = Math.round(c[0]); lut[q * 3 + 1] = Math.round(c[1]); lut[q * 3 + 2] = Math.round(c[2]); }
  return lut;
}
export const lutIndex = (key: ScaleKey, native: number) => { const lo = breakpointsNative(key)[0], hi = nativeMax(key); return Math.max(0, Math.min(LUT_STEPS - 1, Math.round(((native - lo) / (hi - lo)) * (LUT_STEPS - 1)))) * 3; };

/** The scale a field layer uses. */
export const scaleKeyOf = (layer: string): ScaleKey | null => (layer === 'WAVES' || layer === 'SWELL' || layer === 'PERIOD' || layer === 'WIND' ? layer : null);

export interface Units {heightUnit: 'ft' | 'm'; windUnit: 'mph' | 'kn' | 'km/h'}
export interface LegendModel {key: ScaleKey; label: string; unitLabel: string; /** hex colours, evenly spaced along the ramp */ gradient: string[]; ticks: {pos: number; label: string; value: number}[]; lo: string; hi: string}
const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
/** Wind ticks are clean whole numbers in every unit (the breakpoints are clean in knots; mph and km/h ticks are rounded, not shown as 25.3 or 57.5). */
const fmtWind = (v: number) => String(Math.round(v));
/** Legend for a layer in the person's units: tick labels at the breakpoints (evenly spaced, like the ramp), the unit, and the gradient sampled from the same ramp the painter uses. */
export function legendModel(key: ScaleKey, u: Units, theme: Theme = 'light', samples = 48): LegendModel {
  const sc = scaleOf(key), n = sc.breakpoints.length - 1;
  const toUser = (displayValue: number): {v: number; unit: string} => {
    if (key === 'WIND') { const ms = displayValue * sc.perDisplayUnit; return u.windUnit === 'mph' ? {v: ms * 2.236936, unit: 'mph'} : u.windUnit === 'km/h' ? {v: ms * 3.6, unit: 'km/h'} : {v: displayValue, unit: 'kt'}; }
    if (key === 'PERIOD') return {v: displayValue, unit: 's'};
    return u.heightUnit === 'm' ? {v: displayValue * sc.perDisplayUnit, unit: 'm'} : {v: displayValue, unit: 'ft'};
  };
  const ticks = sc.breakpoints.map((b, i) => { const x = toUser(b); return {pos: i / n, label: (key === 'WIND' ? fmtWind : fmt)(x.v) + (i === n ? '+' : ''), value: b * sc.perDisplayUnit}; });
  const unitLabel = toUser(sc.breakpoints[0]).unit;
  return {key, label: sc.label, unitLabel, gradient: Array.from({length: samples}, (_, i) => rgbToHex(rampColorAt(key, i / (samples - 1), theme))), ticks, lo: ticks[0].label, hi: ticks[n].label};
}
