import type {UserProfile} from '../models/index.ts';
import {defaultProfile} from '../data/demo.ts';

/** profile-setup (spec docs/specs/2026-11-12-profile-setup.md): the profile questions, what each one changes ("Why we ask", shown under the field and on the
 *  privacy page), and the rules that keep them honest. Every answer stays on this device (local storage); there are no accounts yet.
 *  Asked only where the answer changes something the person sees (each effect is covered by src/tests/profile-setup.test.ts). Sex and stance are NOT asked yet:
 *  nothing in the app would change with them (no figure variants; no spot has left/right data), so asking would collect data for nothing. */
export const WHY: Record<'age' | 'height' | 'weight' | 'skill' | 'size' | 'region' | 'units', string> = {
  age: 'Required. Under 13, the app works with nothing personal saved on this device (COPPA). Never shown to anyone.',
  height: 'Sets the person drawn next to the wave and the "about N× your height" line on the Wave scale.',
  weight: 'Board Match suggests a board volume for you (weight × a factor for your level, our rule of thumb).',
  skill: 'The Call (Go / Skip), the wave sizes it treats as yours, and which boards Board Match suggests; plunging waves at size are for levels 6–7.',
  size: 'The Call names it: "above the range you prefer". Prefilled from your level.',
  region: 'The Map\'s Find spots ranks spots by distance from your home region (when your location isn\'t shared).',
  units: 'Wave heights and wind speeds on screen.',
};
/** The fields that are personal information: never saved when setup said under 13 (`personalData: false`). */
export const PERSONAL_KEYS = ['displayName', 'heightIn', 'weightKg', 'ageBand'] as const;
/** Applies a profile change. Under 13 (`personalData` false, now or in this change) no personal field is saved, and any already saved is removed. */
export function guardProfile(cur: UserProfile, patch: Partial<UserProfile>): UserProfile {
  const next = {...cur, ...patch};
  if (next.personalData !== false) return next;
  for (const k of PERSONAL_KEYS) delete (next as Partial<UserProfile>)[k];
  return next;
}
/** The age answer. Under 13: personal data off (and cleared), nothing about age stored; setup then ends on its own message (ProfileSetup's 'child' step). */
export const ageAnswer = (a: 'under-13' | '13-17' | '18+'): Partial<UserProfile> => (a === 'under-13' ? {personalData: false, ageBand: null} : {personalData: true, ageBand: a});
/** "Delete my profile": every profile answer back to the defaults (boards, favorites and the journal are kept; they have their own delete). Setup is not shown again. */
export const deletedProfile = (): Partial<UserProfile> => ({...defaultProfile, preferredBoards: [], onboarded: true, displayName: undefined, heightIn: undefined, weightKg: undefined, skillLevel: undefined, ageBand: undefined, personalData: undefined});
/** Where the shown level comes from: picked (no tag), an old three-value setting the person changed ("from your earlier setting"), or the default ("default"). */
export const levelSource = (p: Pick<UserProfile, 'skill' | 'skillLevel'>): string => (p.skillLevel ? '' : p.skill !== defaultProfile.skill ? ' (from your earlier setting)' : ' (default)');
/** The comfortable size is the untouched default (no level picked and the default range). */
export const sizeIsDefault = (p: Pick<UserProfile, 'skillLevel' | 'minWave' | 'maxWave'>): boolean => !p.skillLevel && p.minWave === defaultProfile.minWave && p.maxWave === defaultProfile.maxWave;
