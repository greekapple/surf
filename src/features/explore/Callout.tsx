import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {SurfRating} from '../../ratings/types';
import {windRelationship} from '../../recommendation/sqi';
import {DirArrow, Icon} from '../../ui/Icon';
import {Condition} from '../../ui/Condition';
import {headline} from '../forecast/Cinematic';
import type {HourSample} from '../forecast/model';
import {compass, windVal} from '../forecast/helpers';
import {SpotThumb} from '../../ui/SpotThumb';

/** Wind at a spot with its relation to the beach, or an honest gap. */
export function windLine(spot: SurfSpot, f: Forecast, p: UserProfile) {
  if (!f.availability.wind || !Number.isFinite(f.wind.speed)) return null;
  const rel = windRelationship(spot, f), dir = Number.isFinite(f.wind.direction) ? compass(f.wind.direction) : null;
  return {speed: `${windVal(f.wind.speed, p)} ${p.windUnit}`, dir, rel: rel === 'Unknown' ? 'shore relation unknown' : rel.toLowerCase(), from: Number.isFinite(f.wind.direction) ? f.wind.direction : null};
}

/** T-043 spot callout (Apple Maps style): name, rating, the labelled height, wind with its shore relation, one action.
 *  Used as the map popup at the pin (wide screens) and as the bottom sheet's peek (phones). */
export function SpotCallout({spot, region, f, rating, when, p, onOpen, onClose}: {
  spot: SurfSpot; region: string; f: Forecast | undefined; rating: SurfRating | null; when: string; p: UserProfile; onOpen: () => void; onClose?: () => void;
}) {
  const hd = f ? headline({forecast: f} as HourSample, p) : null, w = f ? windLine(spot, f, p) : null;
  return (
    <div className="xco" role="group" aria-label={`${spot.name} at ${when}`}>
      <SpotThumb spotId={spot.id} className="xco-photo" sizes="(max-width: 860px) 100vw, 264px" />
      <div className="xco-h">
        <div><h3>{spot.name}</h3><p>{region} · {when}</p></div>
        {rating && <Condition category={rating.category} chip />}
        {onClose && <button className="xco-x" aria-label={`Close ${spot.name}`} onClick={onClose}><Icon name="close" size={16} /></button>}
      </div>
      {!f ? <p className="xco-none">No forecast record at this hour.</p> : <>
        <p className="xco-ht">{hd?.big !== null && hd?.big !== undefined ? <><b>{hd.big}</b> <span>{hd.unit}</span></> : <b>—</b>}<small>{hd?.label}</small></p>
        <p className="xco-wind"><Icon name="wind" size={16} />{w ? <span>{w.from !== null && <DirArrow from={w.from} size={12} />} {w.speed}{w.dir ? ` from ${w.dir}` : ''} · <b>{w.rel}</b></span> : <span>Wind not in this record</span>}</p>
      </>}
      <button className="xco-go" onClick={onOpen}>Open forecast</button>
    </div>
  );
}
