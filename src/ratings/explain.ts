import type {SurfRating} from './types.ts';
import {ONSHORE_LIGHT_MPH, ONSHORE_SOURCE} from './windRules.ts';
import {spotProfile} from '../ocean/spotProfiles.ts';
import {PROFILE_FIELDS, FIELD_LABEL, type ProfileField} from '../ocean/spotProfile.ts';
import {angleDiffDeg} from './geometry.ts';

/** A rating that explains itself (T-049): every factor's effect and reason as data the UI can show.
 *  `inScore` says whether the factor is part of the number; context items (nearshore swell, tide) are labelled as such and never change it.
 *  A fact the spot has no reviewed value for is "?" (unknown), and the list of unreviewed facts is returned so reliability can say so. No spot fact is invented. */
export type Effect = '+' | '~' | '-' | '?';
export interface FactorExplanation {factor: string; effect: Effect; reason: string; score: number | null; weight: number; inScore: boolean}
export interface RatingExplanation {items: FactorExplanation[]; unknownFacts: string[]; /** Facts that came from published guides (T-071): used, but not reviewed by anyone. */ guideFacts: string[]; reliability: {category: SurfRating['reliability']['category']; reasons: string[]}}
export interface ExplainContext {
  spotId: string;
  wind?: {mph: number | null; relation: string | null} | null;
  mop?: {id: string; hsFt: number | null; tpS: number | null; dpDeg: number | null; shoreNormalDeg: number | null; product: 'nowcast' | 'forecast'} | null;
  tide?: {trend: 'rising' | 'falling' | 'unknown'; heightLabel: string | null} | null;
}
export const effectOf = (score: number | null | undefined): Effect => (typeof score !== 'number' || !Number.isFinite(score) ? '?' : score >= 70 ? '+' : score >= 40 ? '~' : '-');
const r1 = (n: number) => (Math.round(n * 10) / 10).toString();

export function explainRating(rating: SurfRating, ctx: ExplainContext): RatingExplanation {
  const items: FactorExplanation[] = [], prof = spotProfile(ctx.spotId);
  for (const f of rating.factors) {
    if (f.weight <= 0) continue;
    const base: FactorExplanation = {factor: f.name, effect: effectOf(f.score), reason: f.reason, score: f.score, weight: f.weight, inScore: f.score !== null};
    if (/wind/i.test(f.name)) {
      const rel = (ctx.wind?.relation ?? 'unknown').toLowerCase(), mph = ctx.wind?.mph ?? null;
      if (mph === null || rel === 'unknown') { items.push({...base, effect: '?', reason: 'Wind speed or the shore relation is unknown here, so wind is not scored.', inScore: false}); continue; }
      const why = rel === 'onshore' ? (mph > ONSHORE_LIGHT_MPH ? `Onshore ${r1(mph)} mph: held below "good" because onshore above ${ONSHORE_LIGHT_MPH} mph roughens the face (${ONSHORE_SOURCE}).` : `Light onshore ${r1(mph)} mph (up to ${ONSHORE_LIGHT_MPH} mph): small penalty only.`)
        : rel === 'offshore' ? `Offshore ${r1(mph)} mph: grooms the face; strong offshore is penalised.` : `Cross-shore ${r1(mph)} mph: a moderate penalty.`;
      items.push({...base, reason: why + (prof?.orientation.provenance === 'published guide' ? ' Shore direction comes from a published guide (approximate, not surveyed).' : '')}); continue;
    }
    items.push(base);
  }
  // T-055: ceilings that actually held this score down, each with its reason (unknown wind relation, fresh cross-shore, wide size range).
  for (const c of rating.ceilings ?? []) items.push({factor: 'Rating ceiling', effect: '-', reason: c.reason, score: c.limit, weight: 0, inScore: true});
  // Nearshore swell from the reviewed MOP point: shown with its numbers and the direction geometry, never part of the score (no validated nearshore → surf conversion yet).
  const m = ctx.mop;
  if (m && m.hsFt !== null && m.tpS !== null && m.dpDeg !== null && m.shoreNormalDeg !== null) {
    const a = angleDiffDeg(m.dpDeg, m.shoreNormalDeg);
    items.push({factor: 'Nearshore swell (CDIP MOP, context)', effect: a <= 30 ? '+' : a <= 60 ? '~' : '-', score: null, weight: 0, inScore: false,
      reason: `${m.id} at 10–15 m (${m.product}): ${r1(m.hsFt)} ft at ${r1(m.tpS)} s from ${Math.round(m.dpDeg)}°, ${Math.round(a)}° off the shore normal. Shown, not scored: the nearshore-to-surf conversion is unvalidated.`});
  }
  // Tide: a minor labelled factor. No spot has a reviewed tide window, so it informs and does not score.
  const tideReviewed = !!prof?.tideWindow.value;
  items.push({factor: 'Tide (minor)', effect: '?', score: null, weight: 0, inScore: false,
    reason: ctx.tide ? `Tide ${ctx.tide.trend}${ctx.tide.heightLabel ? ` at ${ctx.tide.heightLabel}` : ''}: ${tideReviewed ? 'a reviewed tide window exists but is not yet scored' : 'not scored, because this spot has no reviewed tide window'}.` : 'No tide reading, and no reviewed tide window for this spot.'});
  const field = (f: ProfileField) => prof?.[f] as {value: unknown; provenance?: string} | undefined;
  const unknownFacts = prof ? (PROFILE_FIELDS.filter((f: ProfileField) => prof[f].value === null).map((f) => FIELD_LABEL[f])) : PROFILE_FIELDS.map((f) => FIELD_LABEL[f]);
  const guideFacts = prof ? PROFILE_FIELDS.filter((f: ProfileField) => prof[f].value !== null && /^published guide/.test(field(f)?.provenance ?? '')).map((f) => FIELD_LABEL[f]) : [];
  const notReviewed = unknownFacts.length + guideFacts.length;
  const reasons = [...rating.reliability.reasons, ...(notReviewed ? [`${notReviewed} of ${PROFILE_FIELDS.length} spot facts are not reviewed: ${guideFacts.length ? `${guideFacts.length} come from published guides (${guideFacts.slice(0, 3).join(', ')}${guideFacts.length > 3 ? ', …' : ''}), used as stated` : ''}${guideFacts.length && unknownFacts.length ? '; ' : ''}${unknownFacts.length ? `${unknownFacts.length} are unknown (${unknownFacts.slice(0, 4).join(', ')}${unknownFacts.length > 4 ? ', …' : ''}) and the rating cannot use them` : ''}.`] : [])];
  return {items, unknownFacts, guideFacts, reliability: {category: rating.reliability.category, reasons}};
}
