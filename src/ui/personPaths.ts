import type {UserProfile} from '../models/index.ts';

/** profile-sex: the drawn person's outlines in a 30 × 100 unit box standing on y = 100 (ui/PersonShape draws them). Both figures are the SAME height. */
export type Figure = 'standard' | 'female';
export const figureOf = (p: Pick<UserProfile, 'sex'> | null | undefined): Figure => (p?.sex === 'female' ? 'female' : 'standard');
export const STANDARD = 'M9 15 h12 q5 1 5.5 6 l1.8 27 q.2 2.4-1.8 2.4 h-.6 q-1.2 0-1.4-1.6 l-2.2-21 v31 l-.6 41 h-5.2 l-1.2-38 h-1 l-1.2 38 h-5.2 l-.6-41 v-31 l-2.2 21 q-.2 1.6-1.4 1.6 h-.6 q-2 0-1.8-2.4 l1.8-27 q.5-5 5.5-6z';
/** narrower shoulders, a neck, a waist and wider hips, hair falling to the shoulders beside the neck; the same 100-unit height and the same 15-unit centre line */
export const FEMALE_HAIR = 'M8.4 7.6 Q8.4 0.6 15 0.6 Q21.6 0.6 21.6 7.6 L21.8 16.4 Q21 17.4 19.6 16.8 L19.2 10.4 Q18 4 15 4 Q12 4 10.8 10.4 L10.4 16.8 Q9 17.4 8.2 16.4 Z';
export const FEMALE = 'M13.4 12 H16.6 V15.5 H13.4 Z M10.6 15 H19.4 Q23.8 16 24.4 21 L26 46 Q26.2 48.4 24.2 48.4 H23.6 Q22.4 48.4 22.2 46.8 L20.6 29 Q20.2 36 19.3 41 Q22.6 48 22.2 57 L21.2 99.8 H16 L15.4 61 H14.6 L14 99.8 H8.8 L7.8 57 Q7.4 48 10.7 41 Q9.8 36 9.4 29 L7.8 46.8 Q7.6 48.4 6.4 48.4 H5.8 Q3.8 48.4 4 46 L5.6 21 Q6.2 16 10.6 15 Z';
