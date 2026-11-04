import type {HeadlineSurf} from './headlineSurf.ts';
import type {BreakerType} from './breaker.ts';
import {faceRange} from './scaleMath.ts';
import {isFlat} from './flatSurf.ts';

/** T-106 WaveGlyph: a simple line-drawn wave beside a person, from the forecast. Pure geometry; the SVG only places what this returns.
 *  Honesty: the heights are the same headline range as the number beside it (low and high bound, as the spot page's Wave scale card), drawn
 *  to the same scale as the person (one feet-to-pixels factor for both). Offshore-only gets a flat swell line, never a
 *  surf wave; no estimate gets nothing. Steepness follows the period; a curl only where the estimated breaker type is plunging. */
export type Glyph =
  | {kind: 'surf'; midFt: number; loFt: number; hiFt: number; personFt: number; steep: number; curl: boolean}
  | {kind: 'offshore'; ft: number}
  /** T-130: the nearshore model says Flat (under 0.5 ft): still water beside the person, never a tiny drawn wave. */
  | {kind: 'flat'; personFt: number};

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 0 for a 6 s wind swell (a long, gentle face) to 1 for a 16 s groundswell (a short, steep face). Unknown period: the middle. */
export const steepFromPeriod = (s: number | null | undefined) => (finite(s) && s > 0 ? clamp01((s - 6) / 10) : 0.5);

export function glyphFor(h: HeadlineSurf | null | undefined, personFt: number, periodS: number | null | undefined, breaker: BreakerType | null | undefined): Glyph | null {
  if (isFlat(h)) return personFt > 0 ? {kind: 'flat', personFt} : null; // T-130: the one place that decides a Flat glyph: still water beside the person (never a drawn wave)
  const r = faceRange(h);
  if (r && personFt > 0) return {kind: 'surf', midFt: (r[0] + r[1]) / 2, loFt: r[0], hiFt: r[1], personFt, steep: steepFromPeriod(periodS), curl: breaker === 'plunging'};
  if (h?.kind === 'offshore' && finite(h.ft) && h.ft >= 0) return {kind: 'offshore', ft: h.ft};
  return null;
}

/** A single drawn height (the week cell's midday central size, T-107 `centralFt`): one outline, not a range. Same rules: offshore gets the swell line. */
export function glyphAt(kind: 'estimate' | 'offshore' | 'none', ft: number | null, personFt: number, periodS: number | null | undefined, breaker: BreakerType | null | undefined, flat = false): Glyph | null {
  if (kind === 'estimate' && flat) return personFt > 0 ? {kind: 'flat', personFt} : null; // T-130: a Flat midday is still water, not the model's sub-half-foot height drawn as a wave
  if (!finite(ft) || ft < 0 || kind === 'none') return null;
  if (kind === 'offshore') return {kind: 'offshore', ft};
  return ft > 0 && personFt > 0 ? {kind: 'surf', midFt: ft, loFt: ft, hiFt: ft, personFt, steep: steepFromPeriod(periodS), curl: breaker === 'plunging'} : null;
}

export interface GlyphLayout {base: number; hiH: number; loH: number; personH: number; crestX: number; hi: string; lo: string; water: string; person: {x: number; w: number; h: number}}
/** One wave outline standing on `base`, its crest at `top`, spanning about `w` from `x0`. Plunging: the spot page's Wave scale outline (scaleMath
 *  wavePath, the lip curling over), stretched to `w`. Otherwise no curl: a crest leaning toward the shore (more with a longer period) and a concave face. */
function outline(x0: number, w: number, base: number, top: number, curl: boolean, steep: number): string {
  const h = base - top, f = (n: number) => n.toFixed(1);
  if (curl) { const q = w / 88, X = (u: number) => f(x0 + u * q); // wavePath's 80-unit body plus its 8-unit toe, scaled
    return `M${X(0)} ${f(base)} C${X(30)} ${f(base - h * 0.08)} ${X(44)} ${f(top + h * 0.18)} ${X(58)} ${f(top + h * 0.02)} C${X(66)} ${f(top - h * 0.04)} ${X(78)} ${f(top + h * 0.08)} ${X(74)} ${f(top + h * 0.3)}`
      + ` C${X(66)} ${f(top + h * 0.18)} ${X(66)} ${f(top + h * 0.2)} ${X(62)} ${f(top + h * 0.45)} C${X(60)} ${f(top + h * 0.7)} ${X(74)} ${f(base - Math.min(6, h * 0.1))} ${X(88)} ${f(base)} Z`; }
  const cx = x0 + w * 0.62, back = cx - x0, face = x0 + w - cx;
  return `M${f(x0)} ${f(base)} C${f(x0 + back * 0.55)} ${f(base)} ${f(cx - back * 0.22)} ${f(top + h * 0.04)} ${f(cx)} ${f(top)}`
    + ` C${f(cx + face * (0.12 + 0.12 * steep))} ${f(top)} ${f(cx + face * (0.2 + 0.12 * steep))} ${f(top + h * 0.12)} ${f(cx + face * (0.16 + 0.08 * steep))} ${f(top + h * 0.32)}`
    + ` C${f(cx + face * 0.12)} ${f(top + h * 0.7)} ${f(cx + face * 0.45)} ${f(base)} ${f(x0 + w)} ${f(base)} Z`;
}
/** Lays a surf glyph into a W×H box like the spot page's Wave scale card: the outer outline reaches the estimate's high bound, the darker inner one
 *  its low bound, beside the person, all on ONE feet-to-pixels scale (so each drawn height / person height === bound / person exactly). Only the
 *  WIDTH is squeezed to fit; heights never are. */
export function glyphLayout(g: Extract<Glyph, {kind: 'surf'}>, W: number, H: number, pad = 2): GlyphLayout {
  const base = H - pad, topFt = Math.max(g.hiFt, g.personFt) * 1.08, k = (H - 2 * pad) / topFt;
  const hiH = g.hiFt * k, loH = g.loFt * k, personH = g.personFt * k, pw = Math.max(2, personH * 0.3), gap = Math.max(3, W * 0.05);
  const room = W - 2 * pad - pw - gap, w = Math.min(room, hiH * (2.6 - 0.8 * g.steep)), x0 = pad;
  return {base, hiH, loH, personH, crestX: x0 + w * (g.curl ? 0.66 : 0.62), hi: outline(x0, w, base, base - hiH, g.curl, g.steep), lo: outline(x0, w, base, base - loH, g.curl, g.steep),
    water: `M${pad} ${base.toFixed(1)} H${(W - pad).toFixed(1)}`, person: {x: W - pad - pw, w: pw, h: personH}};
}

/** A flat swell line for an offshore-only hour: not to scale and never a breaking wave. */
export function swellLine(W: number, H: number, pad = 2): string {
  const y = H - pad - Math.max(2, H * 0.18), a = Math.max(1, H * 0.06), n = 3, step = (W - 2 * pad) / n;
  let d = `M${pad} ${y}`;
  for (let i = 0; i < n; i++) d += ` q${(step / 2).toFixed(1)} ${-a} ${step.toFixed(1)} 0`;
  return d;
}
