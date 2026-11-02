import {useSwello} from '../../app/store';
import type {SurfSpot, UserProfile} from '../../models/index';
import {assignmentFor, mopCandidates, mopPoint, MOP_ACK} from '../../ocean/mop';
import {pickMop} from '../../services/nearshoreSelect';
import {breakingV2Enabled, mopBreaking} from '../../services/breakingV2';
import {BREAKING_V2_VERSION} from '../../ocean/breakingEstimate';
import {formatWaveHeight} from '../../utils/waveHeight';
import {DirArrow} from '../../ui/Icon';
import {compass} from './helpers';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import type {HourSample} from './model';

const when = (iso: string) => `${weekdayPT(iso)} ${dayNumPT(iso)} ${timeLabelPT(iso)} PT`;

/** Nearshore card (T-041): reads the CDIP MOP point reviewed for this spot, nowcast for past hours and forecast for future hours.
 *  Every value is labelled with the point, depth, product and times. Modelled wave height at depth is never surf height. */
export function NearshoreCard({spot, p, selectedTime, now}: {spot: SurfSpot; p: UserProfile; selectedTime: string; now: number; series?: HourSample[]}) {
  const {view, live} = useSwello();
  const a = assignmentFor(spot.id), pt = a ? mopPoint(a.mopId) : null;
  const head = (sub: string) => <div className="card-h"><h2>Nearshore model</h2><span>{sub}</span></div>;
  if (!a || !pt) {
    const cand = mopCandidates.find((c) => c.spotId === spot.id);
    return <>{head('Not assigned')}<p>No CDIP MOP point has been reviewed for this spot, so no nearshore model is shown.</p>{cand && <p className="fine">Candidate points ({cand.mopIds.join(', ')}) are waiting for review. {cand.note}</p>}</>;
  }
  const label = `CDIP MOP ${pt.id} · ${pt.depthM} m depth · modelled`;
  const where = `Transect ${pt.id} · ${pt.lat.toFixed(3)}, ${pt.lon.toFixed(3)} · ${pt.depthM} m depth · shore normal ${pt.shoreNormalDeg}°`;
  const foot = <p className="fine">{MOP_ACK}</p>;
  if (!live) return <>{head(label)}<p>The nearshore model needs retrieved data; none is loaded in demonstration mode.</p><p className="fine">{where}</p></>;
  const bundle = view.ocean.bundle, mop = bundle?.mop?.[pt.id];
  const pick = pickMop(Date.parse(selectedTime), now, bundle?.nearshore, mop?.records);
  if (pick.state !== 'ok') {
    const msg = pick.state === 'no-data' ? 'No CDIP MOP data was returned for this load.' : `The selected hour is outside the model data (${when(pick.first)} to ${when(pick.last)}); nothing is extrapolated.`;
    return <>{head(label)}<p>{msg}</p><p className="fine">{where}</p>{foot}</>;
  }
  const rec = pick.record, isForecast = pick.product === 'forecast';
  const hs = formatWaveHeight({kind: 'nearshore', valueFt: rec.height.value}, p, 'technical'), tp = rec.period.value, dp = rec.direction.value;
  const issued = isForecast ? mop?.issue?.issuedAt ?? null : null;
  const step = pick.offsetMin !== 0 ? ` (nearest model step, ${Math.abs(pick.offsetMin)} min ${pick.offsetMin < 0 ? 'before' : 'after'} the selected hour)` : '';
  const retrieved = rec.height.source.retrievedAt;
  const v2 = breakingV2Enabled() ? mopBreaking(spot.id, rec) : null;
  return (
    <>{head(label)}
      <p><span className={'chip ' + (isForecast ? 'demo' : 'off')}>{isForecast ? 'Forecast' : 'Nowcast'}</span> {isForecast ? 'WaveWatch III-driven model forecast' : 'Model hindcast of recent hours, initialised from buoys'}.</p>
      <div className="minis" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(110px, auto))', justifyContent: 'start'}} role="group" aria-label="Nearshore model values">
        <div><span className="k">Hs · {pt.depthM} m depth</span><span className="v">{rec.height.value === null ? '—' : <>{hs.text.replace(` ${p.heightUnit}`, '')}<small>{p.heightUnit}</small></>}</span></div>
        <div><span className="k">Tp (peak period)</span><span className="v">{tp === null ? '—' : <>{Math.round(tp * 10) / 10}<small>s</small></>}</span></div>
        <div><span className="k">Direction (from)</span><span className="v">{dp === null ? '—' : <><DirArrow from={dp} color="var(--sw1)" />{Math.round(dp)}<small>° {compass(dp)}</small></>}</span></div>
      </div>
      {v2 && (v2.ok ? <p className="fine"><b>Experimental, off by default ({BREAKING_V2_VERSION}):</b> Est. {formatWaveHeight(v2.input, p).text} at the break, from this MOP point by linear shoaling and refraction. Unvalidated; not used in the rating.</p> : <p className="fine"><b>Experimental ({BREAKING_V2_VERSION}):</b> no estimate. {v2.reason}</p>)}
      <p className="fine">Valid {when(rec.timestamp)}{step}. {issued ? `Forecast file issued ${when(issued)}; ` : ''}retrieved {when(retrieved)}. {where}. Modeled Hs at depth, not surf height.</p>
      {foot}
    </>
  );
}
