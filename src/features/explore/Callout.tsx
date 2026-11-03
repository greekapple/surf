import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {SurfRating} from '../../ratings/types';
import {windOf} from '../../services/spotHour';
import {dataPhase} from '../../services/dataPhase';
import {DirArrow, Icon} from '../../ui/Icon';
import {Condition} from '../../ui/Condition';
import {headlineSurf, headlineText} from '../../services/headlineSurf';
import {useSwello} from '../../app/store';
import {compass, ht, windVal} from '../forecast/helpers';
import {SpotThumb} from '../../ui/SpotThumb';

/** Wind at a spot with its relation to the beach, or an honest gap. */
export function windLine(spot: SurfSpot, f: Forecast, p: UserProfile, nowMs?: number) {
  // Same accessor as Home and the spot page (T-055), so the map, Home and Forecast give one wind for one hour.
  const w = windOf(spot, f, p, nowMs);
  if (!w) return null;
  return {speed: `${windVal(w.mph, p)} ${p.windUnit}`, dir: compass(w.dirDeg), rel: w.relation === 'unknown' ? 'shore relation unknown' : w.relation, from: w.dirDeg};
}

/** T-043 spot callout (Apple Maps style): name, rating, the labelled height, wind with its shore relation, one action.
 *  Used as the map popup at the pin (wide screens) and as the bottom sheet's peek (phones). */
export function SpotCallout({spot, region, f, rating, when, p, onOpen, onClose}: {
  spot: SurfSpot; region: string; f: Forecast | undefined; rating: SurfRating | null; when: string; p: UserProfile; onOpen: () => void; onClose?: () => void;
}) {
  const {view, now} = useSwello();
  // The same headline selector as the spot page and Home (T-046), so the map, Home and the spot page agree on the range.
  const hs = f ? headlineSurf(spot.id, f, {bundle: view.ocean.bundle, nowMs: now}) : null, t = hs ? headlineText(hs, p) : null, w = f ? windLine(spot, f, p, now) : null;
  const big = hs?.kind === 'offshore' ? ht(hs.ft, p) : t && t.value !== '—' ? t.value.replace(/ (ft|m)( ≈ Hawaiian)?$/, '') : null;
  return (
    <div className="xco" role="group" aria-label={`${spot.name} at ${when}`}>
      <SpotThumb spotId={spot.id} className="xco-photo" sizes="(max-width: 860px) 100vw, 264px" />
      <div className="xco-h">
        <div><h3>{spot.name}</h3><p>{region} · {when}</p></div>
        {rating && <Condition category={rating.category} />}
        {onClose && <button className="xco-x" aria-label={`Close ${spot.name}`} onClick={onClose}><Icon name="close" size={16} /></button>}
      </div>
      {!f ? (dataPhase(view.ocean) === 'loading' ? <div className="xco-sk" aria-busy="true" aria-label="Loading forecast"><i /><i /><i /></div> : <p className="xco-none">No forecast record at this hour.</p>) : <>
        <p className="xco-ht">{big !== null ? <><b>{big}</b> <span>{p.heightUnit}</span></> : <b>—</b>}<small>{hs?.kind === 'estimate' ? `${t!.words ? `${t!.words[0].toUpperCase()}${t!.words.slice(1)} · ` : ''}surf height · ${hs.saved ? (hs.saved.reason === 'saved' ? 'saved copy, not live' : 'stale data, not current') : 'model estimate'}` : hs?.kind === 'offshore' ? hs.label : t?.detail}</small></p>
        <p className="xco-wind"><Icon name="wind" size={16} />{w ? <span>{w.from !== null && <DirArrow from={w.from} size={12} />} {w.speed}{w.dir ? ` from ${w.dir}` : ''} · <b>{w.rel}</b></span> : <span>Wind not in this record</span>}</p>
      </>}
      <button className="xco-go" onClick={onOpen}>Open forecast</button>
    </div>
  );
}
