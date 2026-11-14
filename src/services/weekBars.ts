// forecast-visuals B (user, 2026-11-13: "Surfline condenses its forecast into bars; keep our design but make it more flawless"): the day strip's bars.
// Each day card shows four bars (dawn, morning, noon, afternoon), each the surf at that hour on ONE scale for the whole week. Pure, so it is tested
// (src/tests/week-bars.test.ts). Honesty: a bar is drawn only from the hour's own headline (the same engine as the Surf card); an offshore height is a grey
// marker labelled offshore, never a surf bar; the NWS range is theirs (dashed); a demonstration hour is striped; an hour with nothing is an empty slot.
import type {HeadlineSurf} from './headlineSurf';

export const BAR_BLOCKS = [{label: 'dawn', hour: 6}, {label: 'morning', hour: 9}, {label: 'noon', hour: 12}, {label: 'afternoon', hour: 15}] as const;
export type BarKind = 'est' | 'flat' | 'nws' | 'off' | 'demo' | 'none';
export interface Bar {kind: BarKind; lo: number | null; hi: number | null}

/** The bar for one hour, from that hour's headline (ft). */
export function barOf(h: HeadlineSurf | null | undefined): Bar {
  if (!h) return {kind: 'none', lo: null, hi: null};
  switch (h.kind) {
    case 'estimate': return h.hiFt <= 0 ? {kind: 'flat', lo: 0, hi: 0} : {kind: 'est', lo: h.loFt, hi: h.hiFt};
    case 'official': return {kind: 'nws', lo: h.loFt, hi: h.hiFt};
    case 'offshore': return Number.isFinite(h.ft) ? {kind: 'off', lo: h.ft, hi: h.ft} : {kind: 'none', lo: null, hi: null};
    case 'demonstration': return Number.isFinite(h.ft) ? {kind: 'demo', lo: h.ft, hi: h.ft} : {kind: 'none', lo: null, hi: null};
    default: return {kind: 'none', lo: null, hi: null};
  }
}
/** a "nice" gridline step for a top value (ft) */
export function gridStep(top: number): number { const raw = top / 3, mag = 10 ** Math.floor(Math.log10(Math.max(raw, 0.1))); return ([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag); }
/** The week's ONE scale: the highest bar top, rounded up to whole gridline steps (at least 3 ft, so a flat week does not look stormy). */
export function weekScale(bars: readonly Bar[]): {max: number; step: number} {
  const top = Math.max(3, ...bars.map((b) => b.hi ?? 0).filter(Number.isFinite));
  const step = gridStep(top); return {max: Math.ceil(top / step) * step, step};
}
/** where a value sits on the scale, in percent of the bar track (0 at the bottom) */
export const pct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));
/** The words for a bar (its accessible name and tooltip): "noon 2–3 ft model estimate", "dawn offshore 6 ft, not surf size", "morning NWS surf forecast for the day 3–5 ft".
 *  `fmt` formats a height the way the day card does for that kind (an estimate on the person's scale; offshore and NWS as published); `tag` adds the headline's own words. */
export function barWords(label: string, b: Bar, fmt: (ft: number, kind: BarKind) => string, unit: (kind: BarKind) => string, tag = ''): string {
  const r = b.lo !== null && b.hi !== null ? (fmt(b.lo, b.kind) === fmt(b.hi, b.kind) ? fmt(b.hi, b.kind) : `${fmt(b.lo, b.kind)}–${fmt(b.hi, b.kind)}`) : '';
  const t = tag ? `, ${tag}` : '';
  switch (b.kind) {
    case 'est': return `${label} ${r} ${unit(b.kind)} model estimate${t}`;
    case 'flat': return `${label} flat (model estimate)${t}`;
    case 'nws': return `${label} NWS surf forecast for the day ${r} ${unit(b.kind)}${t}`;
    case 'off': return `${label} offshore ${r} ${unit(b.kind)}, not surf size${t}`;
    case 'demo': return `${label} demonstration ${r} ${unit(b.kind)}, not live`;
    default: return `${label} no height`;
  }
}
/** a scale step in words: whole numbers stay whole, 2.5 stays 2.5 (never rounded to 3) */
export const stepText = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
