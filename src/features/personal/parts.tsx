import {fmtIn} from '../../ocean/time';
import {activeZone, timeZoneOf, viewerTag} from '../../ocean/spotZone';
import type {ReactNode} from 'react';
import {GENERIC_PHOTOS, PHOTOS, SPOT_PHOTOS} from '../../ui/photos';
import type {JournalExtra} from './journal';

export function Choice<T extends string>({label, value, options, onChange, names}: {label: string; value: T; options: readonly T[]; onChange: (v: T) => void; /** Display text per option when it differs from the stored value. */ names?: Partial<Record<T, string>>}) {
  return (
    <div className="field pz-choice"><span>{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => <button key={o} role="radio" aria-checked={o === value} onClick={() => onChange(o)}>{names?.[o] ?? o}</button>)}
      </div>
    </div>
  );
}

/** iOS-style switch. */
export function Toggle({on, label, onChange}: {on: boolean; label: string; onChange: (v: boolean) => void}) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="pz-switch" onClick={() => onChange(!on)}><i /></button>;
}

export const photoIdFor = (spotId: string, index = 0) => SPOT_PHOTOS[spotId]?.[0] ?? GENERIC_PHOTOS[index % GENERIC_PHOTOS.length];
export const photoUrl = (id: string, w: 800 | 1600 = 800) => `/photos/${id}-${w}.jpg`;

/** The spot's own credited photo, if it has one (audit C: a stock barrel on an estuary read as that spot's conditions). */
export const ownPhotoFor = (spotId: string): string | null => SPOT_PHOTOS[spotId]?.[0] ?? null;

/** Spot card head: the spot's own credited photo when one exists; otherwise no photo at all (a plain card), never a generic stand-in. */
export function SpotCover({spotId, className = '', children}: {spotId: string; index?: number; className?: string; children?: ReactNode}) {
  const id = ownPhotoFor(spotId);
  if (!id) return <div className={`pz-cover pz-cover-none ${className}`}><div className="pz-cover-body">{children}</div></div>;
  const ph = PHOTOS[id];
  return (
    <div className={`pz-cover ${className}`} style={{backgroundImage: `url(${photoUrl(id)})`}}>
      <div className="pz-cover-body">{children}</div>
      <small className="pz-credit">{ph?.photographer ?? 'Wikimedia Commons'} · {ph?.license}</small>
    </div>
  );
}

/** Image for a journal entry: the user's own photo, otherwise the spot's own credited photo, otherwise none (review P2: never a generic surf photo). */
export function entryImage(x: JournalExtra | undefined, spotId: string, _index = 0): {src: string; own: boolean; id?: string} | null {
  if (x?.photo) return {src: x.photo, own: true};
  const id = ownPhotoFor(spotId);
  return id ? {src: photoUrl(id), own: false, id} : null;
}

export const creditText = (id: string) => {
  const ph = PHOTOS[id];
  return ph ? `${ph.generic ? 'Generic photo, ' : ''}${ph.photographer}, ${ph.license}` : 'Wikimedia Commons';
};

// Each entry is dated and timed in the zone of ITS spot (not the last spot opened); an hour says its zone where that clock is not the viewer's.
const zoneFor = (spotId?: string) => (spotId ? timeZoneOf(spotId) : activeZone());
export const entryDate = (iso: string, spotId?: string) => fmtIn(zoneFor(spotId), {weekday: 'short', month: 'short', day: 'numeric'}).format(new Date(iso));
export const hourText = (iso: string, spotId?: string) => fmtIn(zoneFor(spotId), {hour: 'numeric'}).format(new Date(iso)) + (spotId ? viewerTag(zoneFor(spotId), iso) : '');
export const weekdayShort = (iso: string, spotId?: string) => fmtIn(zoneFor(spotId), {weekday: 'short'}).format(new Date(iso));
