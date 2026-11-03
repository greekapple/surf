import {OWN_CAMS, type OwnCam} from '../../data/cams.ts';

/** T-106 the Home hero's media, in order: (1) a SWELLO live cam for the spot when one is configured, (2) otherwise the large drawn wave.
 *  No photo on Home (the credited photo stays on the spot page). Pure, so the order is tested. */
export type HeroMedia = {kind: 'cam'; cam: OwnCam} | {kind: 'drawn'};
export function heroMediaFor(spotId: string, cams: readonly OwnCam[] = OWN_CAMS): HeroMedia {
  const cam = cams.find((c) => c.spotId === spotId && /^https:\/\//.test(c.src));
  return cam ? {kind: 'cam', cam} : {kind: 'drawn'};
}
