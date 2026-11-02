import {Media, useMediaEntry} from './Media';
import {SPOT_PHOTOS} from './photos';
import {creditLine} from './mediaModel';

/** The first licence-cleared photo that genuinely shows a spot, with its credit in plain text, or nothing when the spot has none (no stand-in photos). */
export const spotPhotoId = (spotId: string): string | null => SPOT_PHOTOS[spotId]?.[0] ?? null;
export function SpotThumb({spotId, className = '', sizes = '(max-width: 860px) 100vw, 360px', credit = true}: {spotId: string; className?: string; sizes?: string; credit?: boolean}) {
  const id = spotPhotoId(spotId), entry = useMediaEntry(id ?? '');
  if (!id || !entry) return null;
  return (
    <figure className={'spot-thumb ' + className}>
      <Media id={id} className="spot-thumb-img" sizes={sizes} alt={entry.alt} hideCredit />
      {credit && <figcaption>Photo: {creditLine(entry)}</figcaption>}
    </figure>
  );
}
