/** Dev-only overrides for the 3D rider (spec 2026-11-04 stage 1): URL params force the drawn face (ft), the skill, the stance, the peel
 *  direction and the seed, and toggle the 6 ft scale pole. Never in production builds: the label says "dev: forced" whenever one is set,
 *  so a forced face is never mistaken for the forecast. `?face=6&skill=Expert&stance=goofy&dir=left&seed=3&pole=1` */
import type {Skill} from '../../models/index';
import type {Stance} from './rideSim';

export interface DevOverrides {faceFt: number | null; skill: Skill | null; stance: Stance | null; dir: 'left' | 'right' | null; seed: number | null; pole: boolean}
export const SKILL_VALUES: readonly Skill[] = ['Beginner', 'Intermediate', 'Expert'];
export const EMPTY_OVERRIDES: DevOverrides = {faceFt: null, skill: null, stance: null, dir: null, seed: null, pole: false};

export function readDevOverrides(search: string = typeof location !== 'undefined' ? location.search : ''): DevOverrides {
  const q = new URLSearchParams(search), num = (k: string) => { const v = q.get(k); if (v === null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  const skill = q.get('skill'), stance = q.get('stance'), dir = q.get('dir');
  return {
    faceFt: num('face'), seed: num('seed'),
    skill: SKILL_VALUES.includes(skill as Skill) ? (skill as Skill) : null,
    stance: stance === 'regular' || stance === 'goofy' ? stance : null,
    dir: dir === 'left' || dir === 'right' ? dir : null,
    pole: q.get('pole') === '1' || q.get('pole') === 'true',
  };
}
export const anyForced = (o: DevOverrides | null) => !!o && (o.faceFt !== null || o.skill !== null || o.stance !== null || o.dir !== null || o.seed !== null);
/** Write the overrides back to the URL (replaceState) so a capture script or a reload sees the same scene. */
export function writeDevOverrides(o: DevOverrides) {
  if (typeof history === 'undefined') return;
  const q = new URLSearchParams(location.search);
  const set = (k: string, v: string | null) => { if (v === null) q.delete(k); else q.set(k, v); };
  set('face', o.faceFt === null ? null : String(o.faceFt)); set('skill', o.skill); set('stance', o.stance); set('dir', o.dir); set('seed', o.seed === null ? null : String(o.seed)); set('pole', o.pole ? '1' : null);
  const qs = q.toString(); history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}
