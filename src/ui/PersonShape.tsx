import {FEMALE, FEMALE_HAIR, STANDARD, type Figure} from './personPaths.ts';

/** profile-sex (user, 2026-11-12: "male/female in the profile"): the person drawn next to the wave (Home hero, the spot page's Wave scale card and drawn wave,
 *  the Wave scale diagram, the level cards), in a 30 × 100 unit box standing on y = 100, so every figure is scaled from the SAME height (heightIn) by the same
 *  factor: only the outline differs. 'female' when the profile says female; the standard figure for male, prefer not to say, or no answer.
 *  The sex answer changes this outline and nothing else (never a rating, the Call or Board Match). */
export type {Figure} from './personPaths.ts';
export {figureOf} from './personPaths.ts';
/** The figure's shapes in its 30 × 100 box (the caller positions and scales the group, and sets the fill). */
export function PersonShape({figure}: {figure: Figure}) {
  return figure === 'female' ? <><path d={FEMALE_HAIR} /><circle cx={15} cy={7.2} r={6} /><path d={FEMALE} /></> : <><circle cx={15} cy={7} r={6.4} /><path d={STANDARD} /></>;
}
