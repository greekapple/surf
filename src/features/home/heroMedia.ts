import {OWN_CAMS, type OwnCam} from '../../data/cams.ts';

/** T-106 the Home hero's media, in order: (1) a SWELLO live cam for the spot when one is configured, (2) otherwise the large drawn wave.
 *  No photo on Home (the credited photo stays on the spot page). Pure, so the order is tested. */
export type HeroMedia = {kind: 'cam'; cam: OwnCam} | {kind: 'drawn'};
export function heroMediaFor(spotId: string, cams: readonly OwnCam[] = OWN_CAMS): HeroMedia {
  const cam = cams.find((c) => c.spotId === spotId && /^https:\/\//.test(c.src));
  return cam ? {kind: 'cam', cam} : {kind: 'drawn'};
}

/** T-111 the spot-page hero's media, in order: (1) a SWELLO live cam, (2) the spot's credited photo, (3) the selected hour's wave drawn to scale,
 *  (4) the drawn coast plan when there is nothing to draw (no estimate and no offshore height). Other owners' cams are not played in the Home hero (the Camera panel on the spot page shows qualifying ones, under the camera rule in src/data/cams.ts); here they are links. */
export type SpotMedia = {kind: 'cam'; cam: OwnCam} | {kind: 'photo'} | {kind: 'drawn'} | {kind: 'plan'};
export function spotMediaFor(spotId: string, has: {photo: boolean; drawn: boolean}, cams: readonly OwnCam[] = OWN_CAMS): SpotMedia {
  const h = heroMediaFor(spotId, cams);
  return h.kind === 'cam' ? h : has.photo ? {kind: 'photo'} : has.drawn ? {kind: 'drawn'} : {kind: 'plan'};
}
