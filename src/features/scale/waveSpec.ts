/** What the live 3D viewer draws for one forecast hour (no three.js here: ScaleStage builds it from spotHour / headlineSurf /
 *  breakerType / windOf without loading the viewer). Everything is the selected spot-hour's forecast; nothing is invented. */
import type {Skill} from '../../models/index';
export interface WaveSpec {
  /** The breaking-wave estimate's central face height in metres; null when this hour has no estimate (then nothing is drawn as surf). */
  faceM: number | null;
  /** Estimated breaker type where the spot has a defensible slope; null falls back to the size bucket's own family. */
  breaker: 'spilling' | 'plunging' | null;
  /** Primary swell period (s): wavelength, break cycle and lip energy. */
  periodS: number | null;
  /** The hour's wind and its shore relation: offshore feathers the lip and leaves a clean face, onshore chops it up. */
  wind: {relation: string; mph: number} | null;
  /** Offshore significant wave height in metres, drawn as unbroken swell lines when there is no estimate. Never surf size. */
  offshoreM: number | null;
  /** Peel direction (a left breaks to the surfer's left as they ride). */
  direction: 'left' | 'right';
  /** The primary swell's direction against the beach's facing (deg, 0 = straight in; null unknown): the set lines out the back are slanted by it (S3). */
  swellOffDeg?: number | null;
  /** The rider's inputs (spec 2026-11-04): the profile's skill level, the forecast hour's seed (the same ride every time for the same
   *  hour), the stance (null: a seeded default, the profile has no stance). Riding style is illustration, never a forecast. */
  skill: Skill;
  seed: number;
  stance: 'regular' | 'goofy' | null;
}
export const LIVE_CAPTION = '3D illustration of this forecast hour · approximate';
/** Wind -> chop factor on the water texture (1 = the default light-wind texture) and back-spray strength (0..1). Our own illustration mapping. */
export function windLook(w: WaveSpec['wind']): {chop: number; back: number} {
  if (!w || !(w.mph > 0)) return {chop: 0.8, back: 0};
  // bounded 0.5..1.6: the chop scales the water-texture slopes, and past ~1.6 the face turns into sky reflection (a white sheet)
  if (w.relation === 'offshore') return {chop: Math.max(0.5, 0.85 - 0.025 * w.mph), back: Math.min(1, w.mph / 12)};
  if (w.relation === 'onshore') return {chop: Math.min(1.6, 0.9 + 0.045 * w.mph), back: 0};
  return {chop: Math.min(1.4, 0.85 + 0.03 * w.mph), back: 0};
}
export const sameSpec = (a: WaveSpec, b: WaveSpec) => a.faceM === b.faceM && a.breaker === b.breaker && a.periodS === b.periodS && a.offshoreM === b.offshoreM && a.wind?.relation === b.wind?.relation && a.wind?.mph === b.wind?.mph && a.skill === b.skill && a.seed === b.seed && a.stance === b.stance && a.swellOffDeg === b.swellOffDeg;
