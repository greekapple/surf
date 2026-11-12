import {officialScaleNote} from '../../services/officialSurf.ts';
import {fmtIn} from '../../ocean/time';
import {activeZone, timeZoneOf} from '../../ocean/spotZone';
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import {assignmentFor} from '../../ocean/mop';
import {isFlat, flatWhy, nowcastNearby, NOWCAST_NEARBY_TEXT} from '../../services/flatSurf';
import type {SurfRating} from '../../ratings/types';
import {windOf} from '../../services/spotHour';
import {dataPhase} from '../../services/dataPhase';
import {DirArrow, Icon} from '../../ui/Icon';
import {Condition} from '../../ui/Condition';
import {headlineSurf, headlineText, transferTag} from '../../services/headlineSurf';
import {useSwello} from '../../app/store';
import {compass, ht, windVal} from '../forecast/helpers';
import {SpotThumb} from '../../ui/SpotThumb';
import {camsFor} from '../../data/cams';

/** Wind at a spot with its relation to the beach, or an honest gap. */
export function windLine(spot: SurfSpot, f: Forecast, p: UserProfile, nowMs?: number) {
  // Same accessor as Home and the spot page (T-055), so the map, Home and Forecast give one wind for one hour.
  const w = windOf(spot, f, p, nowMs);
  if (!w) return null;
  return {speed: `${windVal(w.mph, p)} ${p.windUnit}`, dir: compass(w.dirDeg), rel: w.relation === 'unknown' ? 'shore relation unknown' : w.relation, from: w.dirDeg};
}

/** T-043 spot callout (Apple Maps style): name, rating, the labelled height, wind with its shore relation, one action.
 *  Used as the map popup at the pin (wide screens) and as the bottom sheet's peek (phones). */
/** One bar of the card's next-hours strip: the hour's surf estimate (lo–hi ft) or a gap (offshore-only or missing: never drawn as surf), coloured
 *  by that hour's rating (neutral when unrated or dark). */
export interface HourBar {t: number; lo: number | null; hi: number | null; /** T-130: the nearshore model is under the flat threshold: a flat mark, not an empty bar */ flat?: boolean; c: string; rated: boolean}
const hourLabel = (t: number, tz: string) => fmtIn(tz, {hour: 'numeric'}).format(new Date(t)).replace(':00', '').replace(' ', '').toLowerCase();

/** Track 2 (Surfline's next-hours bars): the surf estimate hour by hour from the shown hour, the same headline selector as the number above. */
export function NextHours({hours, p, tz = activeZone()}: {hours: HourBar[]; p: UserProfile; /** the spot's zone (the card's clock labels) */ tz?: string}) {
  const vals = hours.flatMap((h) => (h.hi !== null ? [h.hi] : []));
  if (vals.length < 2) return null;
  const top = Math.max(2, ...vals), est = hours.filter((h) => h.lo !== null && h.hi !== null);
  const lo = Math.min(...est.map((h) => h.lo!)), hi = Math.max(...est.map((h) => h.hi!));
  const nFlat = est.filter((h) => h.flat).length, span = `${hours.length > 1 ? Math.round((hours[hours.length - 1].t - hours[0].t) / 36e5) + 1 : 1} hours, from ${hourLabel(hours[0].t, tz)}`;
  const label = (nFlat === est.length ? `Surf estimate for the next ${span}: Flat (model estimate)` : `Surf estimate for the next ${span}: between ${ht(lo, p, 0)} and ${ht(hi, p, 0)} ${p.heightUnit}${nFlat ? `; ${nFlat} hours Flat` : ''}`)
    + (est.length < hours.length ? `; ${hours.length - est.length} hours have no surf estimate` : '');
  return (
    <div className="xco-hrs" role="img" aria-label={label}>
      <div className="xco-bars" aria-hidden="true">
        {hours.map((h) => <span key={h.t} className={h.hi === null ? 'gap' : [h.rated ? '' : 'nr', h.flat ? 'flat' : ''].filter(Boolean).join(' ') || undefined} style={{'--c': h.c} as React.CSSProperties} title={h.hi === null ? `${hourLabel(h.t, tz)}: no surf estimate` : h.flat ? `${hourLabel(h.t, tz)}: Flat (model estimate)` : `${hourLabel(h.t, tz)}: ${ht(h.lo!, p, 0)}–${ht(h.hi, p, 0)} ${p.heightUnit}`}>
          {h.hi !== null && !h.flat && h.hi > 0 && <i style={{height: `${(h.hi / top) * 100}%`}}><b style={{height: `${(h.lo! / h.hi) * 100}%`}} /></i>}
        </span>)}
      </div>
      <div className="xco-hx" aria-hidden="true"><span>{hourLabel(hours[0].t, tz)}</span><span>{nFlat === est.length ? 'Flat' : `${ht(top, p, 0)} ${p.heightUnit} max`}</span><span>{hourLabel(hours[hours.length - 1].t, tz)}</span></div>
    </div>
  );
}

export function SpotCallout({spot, region, f, rating, when, p, onOpen, onClose, closeLabel, hours}: {
  spot: SurfSpot; region: string; f: Forecast | undefined; rating: SurfRating | null; when: string; p: UserProfile; onOpen: () => void; onClose?: () => void; closeLabel?: string; hours?: HourBar[];
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
        {rating && rating.score !== null && <><Condition category={rating.category} />{rating.dark && <small className="xco-dark">after dark</small>}</>}{/* after dark the pill stays, marked (user, 2026-11-08) */}
        {onClose && <button className="xco-x" aria-label={closeLabel ?? `Close ${spot.name}`} title={closeLabel} onClick={onClose}><Icon name="close" size={16} /></button>}
      </div>
      {!f ? (dataPhase(view.ocean) === 'loading' || !view.ocean.isSpotLoaded(spot.id) ? <div className="xco-sk" aria-busy="true" aria-label="Loading forecast"><i /><i /><i /></div> : <p className="xco-none">No forecast record at this hour.</p>) : <>
        <p className="xco-ht">{isFlat(hs) ? <b>Flat</b> : big !== null ? <><b>{big}</b> <span>{p.heightUnit}</span></> : <b>—</b>}<small>{isFlat(hs) ? `model estimate · ${flatWhy(hs)}${nowcastNearby(hs) ? ` · ${NOWCAST_NEARBY_TEXT}` : ''}` : hs?.kind === 'estimate' ? <>{t!.words && <span className="xco-words">{`${t!.words[0].toUpperCase()}${t!.words.slice(1)} · `}</span>}{`surf height · ${hs.saved ? (hs.saved.reason === 'saved' ? 'saved copy, not live' : 'stale data, not current') : `model estimate${transferTag(hs) ? ` · ${transferTag(hs)}` : ''}${t!.confidenceText ? ` · ${t!.confidenceText}` : ''}${nowcastNearby(hs) ? ` · ${NOWCAST_NEARBY_TEXT}` : ''}`}`}</> : hs?.kind === 'offshore' ? hs.label : hs?.kind === 'official' ? <span title={t?.detail}>NWS surf forecast · {hs.zoneName}{hs.issuedText ? ` · issued ${hs.issuedText}` : ''}{hs.stale ? ' · older than its next issue' : ''}{officialScaleNote(hs.office) ? ` · ${officialScaleNote(hs.office)}` : ''}</span> : t?.detail}</small></p>
        {hs?.kind === 'estimate' && (hs.method === 'mop-v2' || hs.transfer) && assignmentFor(spot.id)?.caveat && <p className="xco-cav">Model point caveat: {assignmentFor(spot.id)!.caveat}.</p>}
        <p className="xco-wind"><Icon name="wind" size={16} />{w ? <span>{w.from !== null && <DirArrow from={w.from} size={12} />} {w.speed}{w.dir ? ` from ${w.dir}` : ''} · <b>{w.rel}</b></span> : <span>Wind not in this record</span>}</p>
      </>}
      {f && hours && <NextHours hours={hours} p={p} tz={timeZoneOf(spot)} />}
      {camsFor(spot.id).map((c) => <a key={c.url} className="xco-cam" href={c.url} target="_blank" rel="noopener noreferrer" title={`Shows ${c.view}`}
        aria-label={`Camera by ${c.owner}, opens their site in a new tab. Shows ${c.view}`}><Icon name="camera" size={15} /><span>Camera · {c.owner}</span><small>↗</small></a>)}
      <button className="xco-go" onClick={onOpen}>Open forecast</button>
    </div>
  );
}
