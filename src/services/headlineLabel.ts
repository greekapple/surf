import type {UserProfile} from '../models/index';
import {headlineText, type HeadlineSurf} from './headlineSurf.ts';
import type {Confidence} from './surfBand.ts';
import {isFlat, FLAT_ESTIMATE_TEXT} from './flatSurf.ts';

/** T-110 (Codex P2s on c3b7e2f and df7d103): the short labels a compact surface puts beside a surf ESTIMATE, built from the same headlineText every card uses, so no surface shows a model range as a bare number:
 *  the value keeps its unit and the Hawaiian qualifier ("4–6 ft ≈ Hawaiian"), `suffix` says it is an estimate (and saved or stale when it is), and `detail` is the method line for a tooltip / screen readers. */
export function estimateLabel(h: HeadlineSurf, p: UserProfile): {value: string; suffix: string; tag: string; detail: string; fresh: boolean; confidence: Confidence | null; confidenceText: string; tuned?: string} | null {
  // offshore-surf step 3: the NWS's own range, short-labelled "NWS" (never "est.": it is not our estimate)
  if (h.kind === 'official') { const t = headlineText(h, p); return {value: t.value, confidence: null, confidenceText: '', suffix: h.stale ? 'NWS (older)' : 'NWS', tag: t.tag, detail: t.detail, fresh: !h.stale}; }
  if (h.kind !== 'estimate') return null;
  const t = headlineText(h, p), fresh = t.tag === 'model estimate';
  return {value: t.value, confidence: t.confidence ?? null, confidenceText: t.confidenceText ?? "", suffix: isFlat(h) ? `(${t.tag})` : t.tag === 'saved estimate' ? 'saved est.' : t.tag === 'stale estimate' ? 'stale est.' : 'est.', // T-130: Flat reads "Flat (model estimate)", never "Flat est."
    tag: t.tag, detail: t.detail, fresh, ...(t.tuned ? {tuned: t.tuned} : {})};
}
/** The hero caption's estimate text: "Est. 8–12 ft" plus its freshness when it is not current ("Est. 8–12 ft (stale estimate)"). */
export function heroEstimateText(h: HeadlineSurf, p: UserProfile): string | null {
  if (h.kind === 'official') { const e = estimateLabel(h, p)!; return `NWS surf forecast ${e.value}${e.fresh ? '' : ' (older than its next issue)'}`; }
  const e = estimateLabel(h, p); if (e && isFlat(h)) return e.fresh ? FLAT_ESTIMATE_TEXT : `Flat (${e.tag})`; // T-130: never "Est. Flat"
  return e ? `Est. ${e.value}${e.fresh ? '' : ` (${e.tag})`}${e.confidenceText ? ` · ${e.confidenceText}` : ''}` : null;
}
