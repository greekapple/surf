import type {Forecast, UserProfile} from '../../models/index';
import {canPresentBreakingEstimate, formatWaveHeight} from '../../utils/waveHeight';

/** STUB for T-046 (engineering's `src/services/headlineSurf.ts`, same exported shape). Swap the import in SpotPage.tsx to
 *  '../../services/headlineSurf' once it is merged, then delete this file. The stub has no MOP v2 path (needs engineering's modules):
 *  v1 estimate where presentable → demonstration face → offshore (labelled) → none. Body words are a provisional face-height table. */
export type HeadlineSurf =
  | {kind: 'estimate'; loFt: number; hiFt: number; words: string | null; wordsNote: string; method: 'mop-v2' | 'v1'; methodLabel: string; label: string; mop?: {id: string; product: 'nowcast' | 'forecast'; validAt: string}}
  | {kind: 'demonstration'; ft: number; label: string}
  | {kind: 'offshore'; ft: number; label: 'offshore · not surf size'}
  | {kind: 'none'; label: string};
export interface HeadlineContext {bundle?: unknown; nowMs?: number}

const WORDS: [number, string][] = [[1, 'ankle'], [2, 'knee'], [3, 'thigh'], [3.5, 'waist'], [4.5, 'chest'], [5, 'shoulder'], [6.5, 'head'], [10, 'overhead'], [14, 'double overhead'], [Infinity, 'triple overhead']];
const word = (ft: number) => WORDS.find(([max]) => ft < max)![1];
const bodyWords = (lo: number, hi: number) => { const a = word(lo), b = word(hi); return a === b ? a : `${a} to ${b}`; };
const NOTE = 'Body words are approximate, for an average adult standing on the beach.';

export function headlineSurf(_spotId: string, hour: Forecast, _ctx: HeadlineContext = {}): HeadlineSurf {
  const v1 = hour?.evidence?.faceEstimate?.input;
  if (v1 && canPresentBreakingEstimate(v1)) {
    const [lo, hi] = v1.rangeFt!;
    return {kind: 'estimate', loFt: lo, hiFt: hi, words: bodyWords(lo, hi), wordsNote: NOTE, method: 'v1', methodLabel: 'Model estimate from offshore swell (v1, unvalidated)', label: 'Est. at the break · model estimate'};
  }
  if (!hour?.evidence && hour?.availability?.face && Number.isFinite(hour.face)) return {kind: 'demonstration', ft: hour.face, label: 'demonstration face · not a forecast'};
  if (Number.isFinite(hour?.offshore) && hour.offshore >= 0) return {kind: 'offshore', ft: hour.offshore, label: 'offshore · not surf size'};
  return {kind: 'none', label: 'No wave height for this hour'};
}

export function headlineText(h: HeadlineSurf, p: UserProfile) {
  if (h.kind === 'estimate') {
    const f = formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: [h.loFt, h.hiFt], rangeMethod: h.method}, p);
    return {value: f.text, label: `Est. ${f.text} at the break`, words: h.words, tag: 'model estimate', detail: h.methodLabel};
  }
  if (h.kind === 'demonstration') { const f = formatWaveHeight({kind: 'demonstration', valueFt: h.ft}, p); return {value: f.text, label: `${f.text} · ${h.label}`, words: null, tag: 'demonstration', detail: h.label}; }
  if (h.kind === 'offshore') { const f = formatWaveHeight({kind: 'offshore', valueFt: h.ft}, p); return {value: f.text.replace(/^≈ /, ''), label: `${f.text} ${h.label}`, words: null, tag: 'offshore', detail: h.label}; }
  return {value: '—', label: h.label, words: null, tag: 'none', detail: h.label};
}
