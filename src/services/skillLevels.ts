import type {Skill, UserProfile} from '../models/index.ts';

/** profile-setup (spec docs/specs/2026-11-12-profile-setup.md, "Skill: 7 levels"): the surfer's level, 1 to 7, each with what a surfer at that level can do.
 *  OUR OWN RULES, written fresh (no surf school's wording), not a safety standard:
 *  - `comfortFt`: the default comfortable size, which prefills Personal › Preferred conditions (editable);
 *  - `callFt`: the Call's floor and ceiling for the level (Skip above or below it). Levels 2, 4 and 7 keep the old Beginner, Intermediate and Expert values exactly
 *    (call.ts SKILL_RANGE_FT), so nobody's call changes until they pick a new level; levels 1, 3, 5 and 6 sit between their neighbours;
 *  - `litresPerKg`: Board Match's rule of thumb for board volume (volume ≈ weight × this), more float for newer surfers. Not fitted to any data.
 *  Plunging waves at size are for levels 6–7 (call.ts). */
export type SkillLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface LevelInfo {n: SkillLevel; name: string; summary: string; can: string[]; comfortFt: [number, number]; callFt: {min: number; max: number}; litresPerKg: number}
export const LEVELS: readonly LevelInfo[] = [
  {n: 1, name: 'First waves', summary: 'Starting out, mostly in the whitewater', can: ['ride whitewater to the beach', 'pop up most of the time', 'surf in a lesson or on a soft-top'], comfortFt: [1, 2], callFt: {min: 1, max: 3}, litresPerKg: 1},
  {n: 2, name: 'Beginner', summary: 'Catching green waves', can: ['catch unbroken (green) waves', 'ride straight or at a small angle', 'paddle out through small surf'], comfortFt: [1, 3], callFt: {min: 1, max: 4}, litresPerKg: 0.8},
  {n: 3, name: 'Improver', summary: 'Riding along the face on purpose', can: ['angle along the face on purpose', 'trim and keep your speed', 'turtle-roll or push up over small whitewater (not yet a duck-dive)', 'pick your own waves'], comfortFt: [1, 4], callFt: {min: 1, max: 6}, litresPerKg: 0.65},
  {n: 4, name: 'Intermediate', summary: 'Turning, and surfing most beach breaks', can: ['duck-dive', 'bottom turn and do a basic cutback', 'read sets and get back to the peak', 'surf most beach breaks'], comfortFt: [2, 6], callFt: {min: 1.5, max: 8}, litresPerKg: 0.5},
  {n: 5, name: 'Advanced intermediate', summary: 'Linking turns, overhead days', can: ['link turns down the line', 'stay calm in overhead waves', 'handle currents and crowds', 'surf points and reefs on mellow days'], comfortFt: [3, 8], callFt: {min: 1.5, max: 10}, litresPerKg: 0.45},
  {n: 6, name: 'Advanced', summary: 'Critical surfing in bigger, heavier waves', can: ['make critical turns and the odd barrel', 'surf double-overhead days', 'surf heavy reefs and points', 'handle long hold-downs'], comfortFt: [3, 12], callFt: {min: 2, max: 14}, litresPerKg: 0.4},
  {n: 7, name: 'Expert / big wave', summary: 'Barrels and big-wave days', can: ['ride barrels on purpose', 'surf big-wave days', 'know the risks and the spot'], comfortFt: [4, 20], callFt: {min: 2, max: 20}, litresPerKg: 0.37},
];
/** The three old skills as levels (migration): Beginner 2, Intermediate 4, Expert 7. */
export const LEGACY_LEVEL: Record<Skill, SkillLevel> = {Beginner: 2, Intermediate: 4, Expert: 7};
export const isLevel = (v: unknown): v is SkillLevel => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7;
/** The surfer's level: the one they picked, else their old skill's level. */
export const levelOf = (p: Pick<UserProfile, 'skill' | 'skillLevel'>): SkillLevel => (isLevel(p.skillLevel) ? p.skillLevel : LEGACY_LEVEL[p.skill] ?? 4);
export const levelInfo = (n: SkillLevel): LevelInfo => LEVELS[n - 1];
/** The old three-value skill for code that still reads it (spot difficulty, board scoring): levels 1–3 Beginner, 4–5 Intermediate, 6–7 Expert. */
export const coarseSkill = (n: SkillLevel): Skill => (n <= 3 ? 'Beginner' : n <= 5 ? 'Intermediate' : 'Expert');
/** What picking a level saves: the level, its coarse skill, and its default comfortable size (the Preferred conditions range, editable after). */
export const pickLevel = (n: SkillLevel): Pick<UserProfile, 'skillLevel' | 'skill' | 'minWave' | 'maxWave'> => ({skillLevel: n, skill: coarseSkill(n), minWave: levelInfo(n).comfortFt[0], maxWave: levelInfo(n).comfortFt[1]});
/** Plunging waves at size are for these levels only (call.ts). */
export const PLUNGING_OK_FROM: SkillLevel = 6;

/** "Not sure?": three yes/no questions suggest a level. No duck-dive: 2 (Beginner); duck-dive but not overhead: 4; overhead but no barrel: 5; barrels: 6. */
export function suggestLevel(a: {duckDive: boolean; overhead: boolean; barrel: boolean}): SkillLevel {
  if (a.barrel && a.overhead) return 6;
  if (a.overhead) return 5;
  if (a.duckDive) return 4;
  return 2;
}

/** Board Match's suggested volume (litres) for a weight and level: weight × the level's litres per kg, rounded to a whole litre. Our rule of thumb; null without a weight. */
export const MIN_KG = 20, MAX_KG = 250;
export const validKg = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= MIN_KG && v <= MAX_KG;
export function suggestedVolume(weightKg: number | null | undefined, n: SkillLevel): number | null {
  return validKg(weightKg) ? Math.round(weightKg * levelInfo(n).litresPerKg) : null;
}
