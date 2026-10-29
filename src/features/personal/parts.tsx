import type {ReactNode} from 'react';
import {GENERIC_PHOTOS, PHOTOS, SPOT_PHOTOS} from '../../ui/photos';
import type {JournalExtra} from './journal';

export function Choice<T extends string>({label, value, options, onChange}: {label: string; value: T; options: readonly T[]; onChange: (v: T) => void}) {
  return (
    <div className="field pz-choice"><span>{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => <button key={o} role="radio" aria-checked={o === value} onClick={() => onChange(o)}>{o}</button>)}
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

/** Credited spot photo: spot-specific when one exists, otherwise a generic image labelled as such. */
export function SpotCover({spotId, index = 0, className = '', children}: {spotId: string; index?: number; className?: string; children?: ReactNode}) {
  const id = photoIdFor(spotId, index);
  const ph = PHOTOS[id];
  return (
    <div className={`pz-cover ${className}`} style={{backgroundImage: `url(${photoUrl(id)})`}}>
      <div className="pz-cover-body">{children}</div>
      <small className="pz-credit">{ph?.generic ? 'Generic photo · ' : ''}{ph?.photographer ?? 'Wikimedia Commons'} · {ph?.license}</small>
    </div>
  );
}

/** Image for a journal entry: the user's own photo, otherwise the spot photo. */
export function entryImage(x: JournalExtra | undefined, spotId: string, index = 0): {src: string; own: boolean; id?: string} {
  if (x?.photo) return {src: x.photo, own: true};
  const id = photoIdFor(spotId, index);
  return {src: photoUrl(id), own: false, id};
}

export const creditText = (id: string) => {
  const ph = PHOTOS[id];
  return ph ? `${ph.generic ? 'Generic photo, ' : ''}${ph.photographer}, ${ph.license}` : 'Wikimedia Commons';
};

const dFmt = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric'});
export const entryDate = (iso: string) => dFmt.format(new Date(iso));
export const hourText = (iso: string) => new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric'}).format(new Date(iso));
export const weekdayShort = (iso: string) => new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short'}).format(new Date(iso));
