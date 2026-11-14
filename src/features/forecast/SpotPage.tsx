import {officialScaleNote, officialProductUrl, officialRange} from '../../services/officialSurf.ts';
import {PersonShape, figureOf} from '../../ui/PersonShape';
import {zoneOf, stateOfZone} from '../../data/zones';
import {tideStationFor, SF_STATION, noTideNote, hourlyTideStationIds} from '../../ocean/tideStations';
import {tideCurveWords} from '../../ocean/stationTide';
import {regionNote} from '../../ocean/coverage';
import {useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode} from 'react';
import type {Forecast, Surfboard, SurfSpot, UserProfile} from '../../models/index';
import type {ObservationSet, TidePrediction} from '../../ocean/types';
import {windRelationship} from '../../recommendation/sqi';
import {DirArrow, Icon} from '../../ui/Icon';
import {CoastTile, CoastCredit} from './CoastTile';
import {periodStep} from '../../services/coastTile';
import {BAR_BLOCKS, barOf, barWords, pct, stepText, weekScale, type BarKind} from '../../services/weekBars';
import {boardPickFor, rankBoards, recommended} from '../quiver/fit';
import {windowOnDay} from '../../services/call';
import {surfaceWord} from '../../services/surfaceWord';
import {isDark} from './trustApi';
import {SCALE_BANDS, selectScaleBand} from '../../services/waveScale';
import {dayRange, tideOf} from '../../services/spotHour';
import {dayCertainty, certainLabel, certaintyOf} from '../../services/certainty';
import {heightValue, lengthLabel} from '../../utils/units';
import {dayText} from '../../services/weekCell';
import {dateIn} from '../../ocean/time';
import {timeZoneOf} from '../../ocean/spotZone';
import {explainRating, type FactorExplanation} from '../../ratings/explain';
import {surfRange, wind as windText} from '../../utils/units';
import {rangeSourceText} from '../quiver/fit';
import {evidenceSpots} from '../../ocean/spots';
import {BAND_COLOR, bandOf, hourLabel, type HourSample} from './model';
import {compass, ht, htSigned, monotonePath, windVal, spotLatLon, type Day} from './helpers';
import {partitionKind, partitionNotes, shownPartitions} from '../../services/swellParts';
import {conditionWord} from './Condition';
import {timeLabelPT, weekdayPT, dayNumPT} from './format';
import {hourFreshness, tideStaleOf, staleText, savedTurnText, savedExtremaText} from '../../services/freshness';
import {StaleTag} from '../../ui/StaleTag';
import {headlineSurf, headlineText, transferTag, type HeadlineSurf} from '../../services/headlineSurf';
import {formatHeight, userHeight} from '../../services/heightMath';
import {assignmentFor} from '../../ocean/mop';
import {isFlat, FLAT_ESTIMATE_TEXT, flatWhy, nowcastNearby, NOWCAST_NEARBY_TEXT} from '../../services/flatSurf';
import type {OceanBundle} from '../../ocean/types';
import {HowRightLine} from './HowRight';
import {TunedLine} from './Tuned';
import {WindNow} from './WindNow';

/* T-045 spot page v3: Surfline's anatomy, each fact once. Conditions grid → Board Match line → 7-day strip → graph/table → nearshore + buoy → sources. */

export const relClass = (rel: string) => (/^offshore/i.test(rel) ? 'off' : /cross/i.test(rel) ? 'cross' : /onshore/i.test(rel) ? 'on' : 'unk');
const relWord = (rel: string) => (rel === 'Unknown' ? 'shore relation unknown' : rel.toLowerCase());
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** The surf headline for one hour, with the display strings. */
export function surfOf(spot: SurfSpot, f: Forecast, p: UserProfile, bundle: OceanBundle | null | undefined, now: number) {
  const h = headlineSurf(spot.id, f, {bundle, nowMs: now});
  return {h, t: headlineText(h, p)};
}

export type CardKey = 'rating' | 'wind' | 'tide' | 'swell';
function Card({k, title, aside, children, className = '', open, onToggle}: {k: string; title: string; aside?: ReactNode; children: ReactNode; className?: string; open?: boolean; onToggle?: () => void}) {
  return (
    <section className={`sp-card ${className}${onToggle ? ' can-open' : ''}`} data-card={k} data-open={open || undefined} aria-label={title}>
      <header><h2>{title}</h2>{aside}
        {onToggle && <button className="sp-open" aria-expanded={!!open} aria-controls="sp-detail" aria-label={`${open ? 'Hide' : 'Show'} ${title.toLowerCase()} detail`} onClick={onToggle}><Icon name="chevron" size={14} /></button>}
      </header>
      {children}
    </section>
  );
}

/** The spot's surveyed shore normal (degrees the beach faces), or null when not surveyed. */
export const facingOf = (spotId: string) => evidenceSpots.find((e) => e.id === spotId)?.orientation ?? null;

/** Mini wind compass: the arrow points where the wind blows; the beach facing (when surveyed) is the dashed line, offshore side shaded. */
/** Mini swell rose: one arrow per partition, travelling toward the centre from where it comes; width and length by energy (H² × T). */
function SwellRose({swells, facing}: {swells: {height: number; period: number; direction: number}[]; facing: number | null}) {
  const e = swells.map((s) => s.height * s.height * s.period), max = Math.max(...e, 1e-6);
  return (
    <svg className="sp-mini" viewBox="-30 -30 60 60" aria-hidden="true">
      <circle r={26} fill="none" stroke="var(--line-2)" />
      {facing !== null && <line x1={0} y1={0} x2={0} y2={-26} transform={`rotate(${facing})`} stroke="var(--muted)" strokeDasharray="3 2" />}
      <text y={-17} fontSize={8} textAnchor="middle" fill="var(--dim)">N</text>
      {swells.map((s, i) => { const r = e[i] / max, len = 10 + 14 * Math.sqrt(r); return (
        <g key={i} transform={`rotate(${s.direction})`} stroke={i === 0 ? 'var(--sw1)' : 'var(--sw2)'} fill={i === 0 ? 'var(--sw1)' : 'var(--sw2)'}>
          <line x1={0} y1={-26} x2={0} y2={-26 + len} strokeWidth={1.5 + 3.5 * Math.sqrt(r)} strokeLinecap="round" />
          <path d={`M-${3 + 2 * r} ${-26 + len} L0 ${-26 + len + 6} L${3 + 2 * r} ${-26 + len}Z`} stroke="none" />
        </g>
      ); })}
    </svg>
  );
}

/** T-067: each reason is a condition dot plus a word (good, fair, poor, unknown), not a check mark. */
const MARK: Record<FactorExplanation['effect'], {m: string; c: string}> = {'+': {m: 'good', c: 'g'}, '~': {m: 'fair', c: 'm'}, '-': {m: 'poor', c: 'b'}, '?': {m: 'unknown', c: 'u'}};

/** 5-segment rating bar (Surfline): segments filled by score, coloured by the rating band. */
function RatingBar({score, category}: {score: number | null; category: string}) {
  const n = score === null ? 0 : Math.max(1, Math.min(5, Math.ceil(score / 20)));
  return <span className="sp-bar" aria-hidden="true">{Array.from({length: 5}, (_, i) => <i key={i} style={{background: i < n ? BAND_COLOR[bandOf(category)] : undefined}} />)}</span>;
}

/** Short names for the rating's factors (the full name and reason stay in the tooltip). */
const shortFactor = (n: string) => (/organi[sz]ation/i.test(n) ? 'Swell quality' : /wave potential|swell size|wave size|size/i.test(n) ? 'Swell size' : /wind/i.test(n) ? 'Wind' : /tide/i.test(n) ? 'Tide' : /period/i.test(n) ? 'Period' : /window|direction|exposure/i.test(n) ? 'Swell window' : n);

/** Wetsuit by water temperature (°F): a common surf-shop guide, labelled as such. */
const wetsuit = (f: number) => (f >= 72 ? 'Boardshorts or a top' : f >= 65 ? '2 mm spring suit' : f >= 62 ? '3/2 mm full suit' : f >= 58 ? '4/3 mm full suit' : f >= 52 ? '4/3 mm + booties' : f >= 48 ? '5/4 mm hooded + booties' : '6/5 mm hooded, booties, gloves');

export function ConditionsGrid({part, spot, h, p, dayHours, extrema, bundle, now, scale, observe, observeEntry, breaker, open, onToggle}: {part: 'now' | 'detail'; spot: SurfSpot; h: HourSample; p: UserProfile; dayHours: HourSample[]; extrema: TidePrediction[]; bundle: OceanBundle | null | undefined; now: number; scale?: ReactNode; observe?: ReactNode; observeEntry?: ReactNode; breaker?: string | null; open: CardKey | null; onToggle: (k: CardKey) => void}) {
  const f = h.forecast, r = h.rating, u = p.heightUnit, {h: hs, t} = surfOf(spot, f, p, bundle, now);
  const rel = f.availability.wind && fin(f.wind.speed) ? windRelationship(spot, f) : 'Unknown';
  // The rating explains itself (T-049 explainRating): scored factors as ticks on the card; context items (nearshore, tide) in the detail.
  const ex = ratingWhy(spot, h, p);
  const scored = ex.items.filter((x) => x.inScore).slice(0, 4);
  const facing = facingOf(spot.id);
  const swells = shownPartitions([f.primary, f.secondary, f.tertiary]); // audit A13: model noise hidden, wind chop labeled
  const partNotes = partitionNotes([f.primary, f.secondary, f.tertiary]);
  const tideOk = f.availability.tide !== false && fin(f.tide.height);
  // A2: the Tide card names its station and uses the spot's OWN picked station (the one Home names). The hourly curve in the record is the San Francisco regional series: it is drawn only where San Francisco IS the spot's station,
  // and then says so; where the spot's own station is another one, the card shows that station's next highs and lows (as for every spot with no hourly series) instead of the SF curve under a generic label.
  const [tlat, tlon] = spotLatLon(spot), ownTide = tideStationFor({id: spot.id, latitude: tlat, longitude: tlon}), ownIsSf = !!ownTide && ownTide.station.id === SF_STATION;
  // Hawaii spots: the numbers are face heights (trough to crest); a local reader may expect the Hawaiian scale (about half). Say which one this is unless the profile chose Hawaiian.
  const scaleNote = stateOfZone(zoneOf(spot.region)) === 'Hawaii' && p.scale !== 'Hawaiian' ? 'surf height, not Hawaiian scale' : null;
  const water = fin(f.waterTempF) ? f.waterTempF : null;
  // the Wind card's own line: the day's forecast range (daylight hours), so the card has content beyond the dial
  const dw = dayHours.filter((x) => x.hour >= 6 && x.hour <= 19 && Date.parse(x.timestamp) >= now - 3600000 && fin(x.forecast.wind.speed) && x.forecast.availability.wind !== false).map((x) => ({v: x.forecast.wind.speed, t: x.timestamp}));
  const windDay = dw.length > 1 ? {lo: dw.reduce((a, b) => (b.v < a.v ? b : a)), hi: dw.reduce((a, b) => (b.v > a.v ? b : a))} : null;
  // Now block: the surf number with its kind (model estimate · confidence / NWS / offshore) and body word, once; the detail cards below do not repeat it.
  const surfNum = <>
        <p className="v sp-v" aria-label={scaleNote && hs.kind === 'estimate' ? `${t.label}, ${scaleNote}` : t.label}>{hs.kind === 'offshore' ? <>{ht(hs.ft, p)}<small>{u}</small></> : t.value === '—' ? '—' : <>{t.value.replace(/ (ft|m)( ≈ Hawaiian)?$/, '')}<small>{t.value.match(/ (ft|m)( ≈ Hawaiian)?$/)?.[0]}</small></>}</p>
        <p className="sp-s">{isFlat(hs) ? <span title={hs.kind === 'estimate' ? hs.methodLabel : undefined}>{flatWhy(hs)}</span> : hs.kind === 'official' ? <span title={t.detail}><b className="sp-words">NWS surf forecast</b> · {hs.facing ? `${hs.entryLabel}, ${hs.zoneName}` : hs.zoneName}</span> : hs.kind === 'estimate' ? <>{t.words ? <b className="sp-words">{t.words[0].toUpperCase() + t.words.slice(1)}</b> : null} <span title={hs.wordsNote}>{scaleNote ?? 'surf height'}</span></> : t.detail}</p>
        {hs.kind === 'estimate' && hs.calibration && !hs.saved ? <TunedLine hs={hs as Parameters<typeof TunedLine>[0]['hs']} p={p} spotName={spot.name} /> : hs.kind === 'estimate' ? <p className="sp-f" title={`${hs.methodLabel}${t.confidenceDetail ? `; ${t.confidenceDetail}` : ''}`}>{hs.saved ? `${hs.saved.reason === 'saved' ? 'saved copy' : 'stale data'} · retrieved ${hs.saved.retrievedAt && Number.isFinite(Date.parse(hs.saved.retrievedAt)) ? timeLabelPT(hs.saved.retrievedAt) : 'at an unknown time'} · not current` : `model estimate${transferTag(hs) ? ` · ${transferTag(hs)}` : ''}${t.confidenceText ? ` · ${t.confidenceText}` : ''}${nowcastNearby(hs) ? ` · ${NOWCAST_NEARBY_TEXT}` : ''}`}<span className="sr-only"> {hs.methodLabel.replace(/^Model estimate /, '')}{t.confidenceDetail ? `. ${t.confidenceDetail}` : ''}</span></p> : hs.kind === 'official' ? <p className="sp-f" title={t.detail}>{`the National Weather Service's forecast for the zone, not ours${(hs as {span?: string | null}).span ? ` · one range for ${(hs as {span?: string | null}).span}` : ''}${hs.issuedText ? ` · issued ${hs.issuedText}` : ''}${hs.stale ? ' · older than its next scheduled issue' : ''}${officialScaleNote(hs.office) ? ` · ${officialScaleNote(hs.office)}` : ''} · `}<a href={officialProductUrl(hs.productId)} target="_blank" rel="noopener noreferrer">NWS product</a></p> : hs.kind === 'demonstration' ? <p className="sp-f">demonstration week, not live</p> : null}
  </>;
  if (part === 'now') {
    const sw0 = swells[0], tz = timeZoneOf(spot);
    // the next high or low after this hour at the spot's OWN station (the same extrema the Tide card and the chart read); no day word when it is the same day
    const nextTurn = extrema.filter((e) => e.height.value !== null && Date.parse(e.timestamp) > Date.parse(h.timestamp)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))[0];
    const hourTag = Date.parse(h.timestamp) === Math.floor(now / 3600000) * 3600000 ? '' : `, ${weekdayPT(h.timestamp, tz)} ${timeLabelPT(h.timestamp, tz)}`;
    const sameDay = (ts: string) => dateIn(tz, ts) === dateIn(tz, h.timestamp);
    return (<>
      <div className="sp-ng">
        <section className="sp-nc sp-nc-surf" aria-label={`Surf${hourTag}`} data-card="surf"><h2>Surf</h2>{surfNum}{hs.kind === 'estimate' && (hs.method === 'mop-v2' || hs.transfer) && assignmentFor(spot.id)?.caveat && <p className="sp-f sp-cav">model point caveat · full text under More detail</p>}<HowRightLine spotId={spot.id} p={p} short /></section>
        <section className="sp-nc" aria-label={`Rating${hourTag}`} data-card="rating"><h2>Rating</h2>
          <p className={`v sp-v sp-rate${r.score === null ? ' unr' : ''}`} style={{'--c': BAND_COLOR[bandOf(r.category)]} as CSSProperties}>{conditionWord(r.category)}{(r as {dark?: boolean}).dark && <small className="sp-dark"> · after dark</small>}</p>
          <RatingBar score={r.score} category={r.category} />
          <p className="sp-f">provisional · {r.reliability.category.toLowerCase()} reliability</p>
        </section>
        <section className={`sp-nc${f.availability.wind !== false && fin(f.wind.speed) && fin(f.wind.direction) ? ' has-tile' : ''}`} aria-label={`Wind${hourTag}`} data-card="wind"><h2>Wind</h2>
          {f.availability.wind !== false && fin(f.wind.speed) ? <>
            {fin(f.wind.direction) && <CoastTile spotId={spot.id} facing={facing} arrow={{from: f.wind.direction, tone: relClass(rel) as 'off' | 'cross' | 'on' | 'unk'}} label={`Wind ${windVal(f.wind.speed, p)} ${p.windUnit}, ${relWord(rel)}`} />}
            <p className="v sp-v">{windVal(f.wind.speed, p)}<small>{p.windUnit}</small><StaleTag s={hourFreshness(f, now).wind} />{fin(f.wind.direction) && <span className="sp-dir">from {compass(f.wind.direction)}</span>}</p>
            <p className="sp-s"><span className={`sp-rel ${relClass(rel)}`}>{relWord(rel)}</span>{fin(f.wind.gusts) && <> · gusts {windVal(f.wind.gusts, p)} {p.windUnit}</>}</p>
          </> : <p className="sp-s">Wind not in this record.</p>}
        </section>
        <section className="sp-nc" aria-label={`Tide${hourTag}`} data-card="tide"><h2>Tide</h2>
          {tideOk && ownTide ? <>
            <p className="v sp-v">{htSigned(f.tide.height, p)}<small>{u}</small><StaleTag s={hourFreshness(f, now).tide} /><span className="sp-trend">{f.tide.trend === 'Rising' ? '▲ rising' : f.tide.trend === 'Falling' ? '▼ falling' : ''}</span></p>
            {nextTurn && <p className="sp-s"><b>{nextTurn.type}</b> {sameDay(nextTurn.timestamp) ? '' : `${weekdayPT(nextTurn.timestamp, tz)} `}{timeLabelPT(nextTurn.timestamp, tz)} · {htSigned(nextTurn.height.value!, p)} {u}{savedTurnText(nextTurn.height.source)}</p>}
            <p className="sp-f">{ownIsSf ? `regional prediction · San Francisco · ${ownTide.distanceKm} km · not at the beach` : `NOAA prediction · ${ownTide.station.name} · ${ownTide.distanceKm} km${hourlyTideStationIds.includes(ownTide.station.id) ? '' : ' · interpolated'} · not at the beach`}</p>
            {ownTide.fallback && <p className="sp-f" role="note"><b>{ownTide.fallbackLabel ?? 'Inlet or bay-side station'}:</b> times and range differ from the open beach</p>}
          </> : <StationTideNext spot={spot} bundle={bundle} p={p} now={now} compact />}
        </section>
        <section className={`sp-nc${sw0 ? ' has-tile' : ''}`} aria-label={`Main swell${hourTag}`} data-card="swell"><h2>Main swell</h2>
          {sw0 ? <>
            <CoastTile spotId={spot.id} facing={facing} arrow={{from: sw0.direction, tone: periodStep(Math.round(sw0.period))}} label={`Main swell (offshore model, not surf size) ${ht(sw0.height, p)} ${u} at ${Math.round(sw0.period)} s${sw0.kind === 'chop' ? ' (wind chop)' : ''}`} />
            <p className="v sp-v">{ht(sw0.height, p)}<small>{u}</small> <span className="sp-per">{Math.round(sw0.period)}<small>s{sw0.kind === 'chop' ? ' wind chop' : ''}</small></span></p>
            <p className="sp-s"><span className="sp-dir">from {compass(sw0.direction)} {Math.round(sw0.direction)}°</span></p>
            <p className="sp-f">offshore model, not surf size</p>
          </> : <p className="sp-s">{partNotes.onlyNoise ? 'Only model noise (under 2 s) in this record.' : 'No swell partitions in this record.'}</p>}
        </section>
        <section className="sp-nc sp-nc-water" aria-label={`Water${hourTag}`} data-card="water"><h2>Water</h2>
          {water !== null ? <>
            <p className="v sp-v">{Math.round(water)}<small>°F</small></p>
            <p className="sp-s"><b>{wetsuit(water)}</b></p>
            <p className="sp-f">wetsuit: common surf-shop guide</p>
          </> : <p className="sp-s">Water temperature not in this record.</p>}
        </section>
      </div>
      <p className="sp-f sp-coastcredit"><CoastCredit spotId={spot.id} prefix="Maps: " /></p>
    </>);
  }
  return (
    <div className="sp-grid">
      <Card k="surf" title="Surf notes" aside={observeEntry}>
        {/* Offshore Hs keeps one decimal, like every other offshore value on the page (the chart, the table). */}
        {breaker && <p className="sp-brk">est. breaker type: <b>{breaker}</b></p>}
        {/* T-130: what the model point cannot say about THIS spot, beside the number (the full provenance stays in Sources & data) */}
        {hs.kind === 'estimate' && (hs.method === 'mop-v2' || hs.transfer) && assignmentFor(spot.id)?.caveat && <p className="sp-f sp-cav">Model point caveat: {assignmentFor(spot.id)!.caveat}.</p>}
        <HowRightLine spotId={spot.id} p={p} />
        {observe}
      </Card>
      {scale && <Card k="scale" title="Wave scale">{scale}</Card>}
      <Card k="rating" title="Rating" open={open === 'rating'} onToggle={() => onToggle('rating')}>
        {scored.length ? <ul className="sp-why" aria-label="Why">{/* T-108: with no surf estimate there is no "swell size" to rate: the engine's wave-potential factor is OFFSHORE swell energy, so it is named that, and the list says plainly that size has no estimate here. */}
          {hs.kind !== 'estimate' && <li className="sp-why-none" title="No surf-size estimate for this hour (offshore height only), so surf size is not part of the call"><i aria-hidden="true" />Swell size: no estimate</li>}
          {scored.map((x) => <li key={`${x.factor}|${x.reason}`} className={MARK[x.effect].c} title={`${x.factor}: ${x.reason}`}><i aria-hidden="true" />{hs.kind !== 'estimate' && shortFactor(x.factor) === 'Swell size' ? 'Offshore swell energy' : shortFactor(x.factor)} <span className="w">{MARK[x.effect].m}</span></li>)}</ul>
          : <p className="sp-s">{r.explanation}</p>}
        <p className="sp-f">provisional · {r.reliability.category.toLowerCase()} reliability</p>
      </Card>
      <Card k="wind" title="Wind" open={open === 'wind'} onToggle={() => onToggle('wind')}>
        {f.availability.wind !== false && fin(f.wind.speed) ? <>
          {fin(f.wind.direction) && <div className="sp-tilerow"><CoastTile spotId={spot.id} facing={facing} arrow={{from: f.wind.direction, tone: relClass(rel) as 'off' | 'cross' | 'on' | 'unk'}} label={`Wind ${windVal(f.wind.speed, p)} ${p.windUnit} from the ${compass(f.wind.direction)}, ${relWord(rel)}`} size={132} caption />
            <p className="sp-s"><b>{windVal(f.wind.speed, p)} {p.windUnit}</b> from {compass(f.wind.direction)} {Math.round(f.wind.direction)}° · <span className={`sp-rel ${relClass(rel)}`}>{relWord(rel)}</span>{fin(f.wind.gusts) && <> · gusts {windVal(f.wind.gusts, p)} {p.windUnit}</>}<br /><span className="sp-f">arrow: blows from the {compass(f.wind.direction)} toward the beach, coloured by how it meets this beach (offshore, cross-shore, onshore)</span></p></div>}
        </> : <p className="sp-s">Wind not in this record.</p>}
        {windDay && <p className="sp-s">Model forecast, 6 AM–7 PM (hours still ahead): {windVal(windDay.lo.v, p)}–{windVal(windDay.hi.v, p)} {p.windUnit}, strongest around {timeLabelPT(windDay.hi.t, timeZoneOf(spot))}</p>}
        <WindNow spot={spot} hours={dayHours} now={now} p={p} />
      </Card>
      <Card k="tide" title="Tide" open={open === 'tide'} onToggle={() => onToggle('tide')}>
        {tideOk && ownTide ? <>
          <TideMini turnsSaved={!!savedExtremaText(extrema)} hours={dayHours} at={h.timestamp} extrema={extrema.filter((e) => e.height.value !== null).map((e) => ({timestamp: e.timestamp, v: e.height.value!, type: e.type}))} p={p} />
          <p className="sp-f">{ownIsSf ? `NOAA CO-OPS prediction at San Francisco (${SF_STATION}), a regional reference, ${ownTide.distanceKm} km from this spot, not at the beach` : tideCurveWords({kind: hourlyTideStationIds.includes(ownTide.station.id) ? 'hourly' : 'interpolated', stationName: ownTide.station.name, stationId: ownTide.station.id, distanceKm: ownTide.distanceKm})}{(() => { const ts = tideStaleOf(dayHours, now); return ts ? ` · ${staleText(ts)}` : ''; })()}{savedExtremaText(extrema) && ` · high and low times${savedExtremaText(extrema)}`}</p>
          {ownTide.fallback && <p className="sp-f" role="note"><b>{ownTide.fallbackLabel ?? 'Inlet or bay-side station'}:</b> {ownTide.fallbackDetail ?? 'times and range differ from the open beach (no open-coast station is within 40 km).'}</p>}
        </> : <StationTideNext spot={spot} bundle={bundle} p={p} now={now} />}
      </Card>
      <Card k="swell" title="Other swells" open={open === 'swell'} onToggle={() => onToggle('swell')}>
        {swells.length > 1 ? <ul className="sp-swells">{swells.slice(1).map((s, i) => (
          <li key={i}><CoastTile spotId={spot.id} facing={facing} arrow={{from: s.direction, tone: i === 0 ? 'sw2' : 'sw3'}} label={`${i === 0 ? 'Second' : 'Third'} swell (offshore model) ${ht(s.height, p)} ${u} at ${Math.round(s.period)} s`} size={44} /><b>{ht(s.height, p)}<small>{u}</small></b><span>{Math.round(s.period)}<small>s{s.kind === 'chop' ? ' wind chop' : ''}</small></span><span className="sp-dir">from {compass(s.direction)}<span className="sp-deg"> {Math.round(s.direction)}°</span></span></li>
        ))}</ul> : <p className="sp-s">{swells.length ? 'No other swell partition in this record (the main swell is above).' : partNotes.onlyNoise ? 'Only model noise (under 2 s) in this record.' : 'No swell partitions in this record.'}</p>}
        {swells.length > 0 && <SwellRose swells={swells} facing={facing} />}
        <p className="sp-f">Offshore model partitions{partNotes.smallHidden ? ' · small partitions under 0.5 ft hidden' : ''}{swells.length > 1 && <CoastCredit spotId={spot.id} />}</p>
      </Card>
    </div>
  );
}

/** Today's tide as a small curve: the selected hour marked, highs and lows labelled with time. */
/** The Tide card for a spot with no hourly tide series: the next highs and lows of ITS nearest open-coast CO-OPS station (the same one Home names), in the spot's own zone, labelled a station prediction. Outside the US, or with no station in range: the honest message. */
function StationTideNext({spot, bundle, p, now, compact = false}: {spot: SurfSpot; bundle: OceanBundle | null | undefined; p: UserProfile; now: number; compact?: boolean}) {
  const [lat, lon] = spotLatLon(spot), st = tideStationFor({id: spot.id, latitude: lat, longitude: lon});
  const turns = !st ? [] : (st.station.id === SF_STATION ? bundle?.extrema ?? [] : bundle?.stationTides?.[st.station.id]?.extrema ?? []);
  const next = turns.filter((e) => e.height.value !== null && Date.parse(e.timestamp) > now).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).slice(0, compact ? 1 : 4);
  if (!st || st.distanceKm > 40) return <p className="sp-s">{regionNote(spot, 'tide') ?? noTideNote(spot.id)}</p>;
  if (!next.length) return <p className="sp-s">No prediction loaded for {st.station.name}, {st.distanceKm} km away.</p>;
  const tz = timeZoneOf(spot);
  return <>
    <ul className="sp-tn" aria-label={`Next tides at ${st.station.name}`}>{next.map((e) => <li key={e.timestamp}><b>{e.type}</b> {weekdayPT(e.timestamp, tz)} {timeLabelPT(e.timestamp, tz)} · {htSigned(e.height.value!, p)} {p.heightUnit}</li>)}</ul>
    <p className="sp-f">NOAA CO-OPS prediction at {st.station.name}, {st.distanceKm} km away, not at the beach{savedTurnText(next[0].height.source)}</p>
    {st.fallback && compact && <p className="sp-f" role="note"><b>{st.fallbackLabel ?? 'Inlet or bay-side station'}:</b> times and range differ from the open beach</p>}
    {st.fallback && !compact && <p className="sp-f" role="note"><b>{st.fallbackLabel ?? 'Inlet or bay-side station'}:</b> {st.fallbackDetail ?? 'times and range differ from the open beach (no open-coast station is within 40 km).'}</p>}
  </>;
}
function TideMini({hours, at, extrema, p, turnsSaved = false}: {hours: HourSample[]; at: string; extrema: {timestamp: string; v: number; type: string}[]; p: UserProfile; /** tide-label-2: the high/low feed is a saved copy (the hourly curve may be live) */ turnsSaved?: boolean}) {
  // phone pass 6: after layout (and on resize) a time label that would overlap the one before it is hidden, so none overprints at any width
  const labs = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => { const el = labs.current; if (!el) return;
    // audit A3 + phone pass 6: labels are kept in priority order (data-pri: the extreme nearest AFTER the selected hour first, then the rest by distance from
    // it); one that would overprint a kept label is hidden (all of them are in the chart's aria label)
    const fit = () => { const kept: DOMRect[] = []; const spans = (Array.from(el.children) as HTMLElement[]).sort((a, b) => Number(a.dataset.pri) - Number(b.dataset.pri));
      for (const sp of spans) { sp.style.visibility = ''; const r = sp.getBoundingClientRect(); if (kept.some((q) => r.left < q.right + 8 && q.left < r.right + 8)) sp.style.visibility = 'hidden'; else kept.push(r); } };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect(); });
  const pts = hours.filter((h) => fin(h.forecast.tide.height));
  if (pts.length < 4) return null;
  const W = 260, H = 64, t0 = Date.parse(pts[0].timestamp), span = Date.parse(pts[pts.length - 1].timestamp) - t0 || 1;
  const vs = pts.map((h) => h.forecast.tide.height), lo = Math.min(...vs) - 0.4, hi = Math.max(...vs) + 0.4;
  const X = (ms: number) => ((ms - t0) / span) * W, Y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 22);
  const line = monotonePath(pts.map((h) => [X(Date.parse(h.timestamp)), Y(h.forecast.tide.height)]));
  const k = pts.find((h) => h.timestamp === at), ex = extrema.filter((e) => { const m = Date.parse(e.timestamp); return m >= t0 && m <= t0 + span; });
  const selMs = k ? Date.parse(k.timestamp) : t0, pri = new Map([...ex].sort((a, b) => { const da = Date.parse(a.timestamp) - selMs, db = Date.parse(b.timestamp) - selMs; return (da >= 0 ? da : 1e12 - da) - (db >= 0 ? db : 1e12 - db); }).map((e, n) => [e.timestamp, n]));
  return (
    <div className="sp-tide-w">
    <svg className="sp-tide" viewBox={`0 0 ${W} ${H - 14}`} preserveAspectRatio="none" role="img" aria-label={`Tide today: ${ex.map((e) => `${e.type.toLowerCase()} ${ht(e.v, p)} ${p.heightUnit} at ${timeLabelPT(e.timestamp)}`).join(', ') || 'no highs or lows listed'}${turnsSaved ? ' (high and low times: saved copy)' : ''}`}>
      <path d={`${line} L${W},${H - 14} L0,${H - 14}Z`} fill="var(--tide)" fillOpacity={0.12} /><path d={line} fill="none" stroke="var(--tide)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />

    </svg>
    {k && <i className="sp-tide-now" aria-hidden="true" style={{left: `${((X(Date.parse(k.timestamp)) / W) * 100).toFixed(1)}%`, top: `calc(var(--tide-h) * ${(Y(k.forecast.tide.height) / (H - 14)).toFixed(3)})`}} />}
    {/* phone pass 6: the high/low times are page text at 12 px under the curve (the drawing scales with the card, the text does not); a label too close to
        the last one drawn (under 30% of the width) is left out so none overprints its neighbour; all of them are in the chart's aria label */}
    <p ref={labs} className="sp-tide-ls" aria-hidden="true">{(() => ex.map((e) => { const f = Math.min(1, Math.max(0, X(Date.parse(e.timestamp)) / W));
      // each label is anchored in proportion (start-aligned at the left edge, end-aligned at the right), so none leaves the box; overlaps are removed after layout (above)
      return <span key={e.timestamp} data-pri={pri.get(e.timestamp)} style={{left: `${(f * 100).toFixed(1)}%`, translate: `-${(f * 100).toFixed(1)}% 0`}}>{timeLabelPT(e.timestamp).replace(':00', '').replace(' ', '').replace(/M$/, '').toLowerCase()} {e.type === 'High' ? 'H' : 'L'}</span>; }))()}</p>
    </div>
  );
}

export const feetInches = (inches: number) => `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;

/** T-065: the board for these waves, from size + period (wave shape is unknown). No row at all when nothing can be recommended. */
export function BoardLine({boards, choice, f, p, hs, onOpen}: {boards: import('../../models/index').Surfboard[]; choice: import('../quiver/fit').BoardChoice; f: Forecast; p: UserProfile; hs: HeadlineSurf; onOpen: () => void; onQuiver?: () => void}) {
  const est: [number, number] | null = hs.kind === 'estimate' ? [hs.loFt, hs.hiFt] : null;
  const period = f.primary && Number.isFinite(f.primary.period) ? f.primary.period : null;
  const top = useMemo(() => (choice.pick ? choice.ranked.find((r) => r.board === choice.pick) ?? null : null), [choice]); // T-108: the one board pick, not a second ranking
  if (!top || top.size.state === 'none') return null;
  return (
    <section className="sp-board" aria-label="Board Match">
      <p>Ride your <b>{top.board.name}</b> ({feetInches(top.board.length)} {top.board.type.toLowerCase()}): it suits {surfRange(top.size.board[0], top.size.board[1], p)} ({rangeSourceText(top.size, top.board.type)}){top.board.demo ? ', an example board' : ''}{period !== null && top.period ? `; ${partitionKind(f.primary, true) === 'chop' ? top.period.note.replace(' swell ', ' wind chop ') : top.period.note}.` : '.'} {choice.mode === 'size' && <span className="fine">Wave shape unknown.</span>}</p>
      <button className="sp-link" onClick={onOpen}>Board Match</button>
    </section>
  );
}

const median = (v: number[]) => { const a = [...v].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
/** the board's type in a word that fits a phone day card: shortboard SB, longboard LB, else its last word ("fish", "midlength") */
const shortType = (t: string) => { const w = t.toLowerCase().split(' ').pop() ?? t; return w === 'shortboard' ? 'SB' : w === 'longboard' ? 'LB' : w; };
/** 7-day strip (Surfline): day, surf range, AM/midday/PM rating segments, three wind arrows, best day star. */
export function DayStrip({days, series, spot, p, bundle, now, cur, best, onPick, boards = [], keyOpen = true}: {days: Day[]; series: HourSample[]; spot: SurfSpot; p: UserProfile; bundle: OceanBundle | null | undefined; now: number; cur: number; best: number; onPick: (k: number) => void; boards?: Surfboard[]; /** space-tighten: the bar key and the selected day's confidence note start open (wide) or folded (phone) */ keyOpen?: boolean}) {
  const today = weekdayPT(new Date(now).toISOString());
  // Drag across the strip with a mouse to scrub days; every card follows the selected hour live.
  const scrub = useRef(false);
  let selNote: string | null = null;
  // phone pass 8: the kind and confidence words ("est. · high confidence") were repeated in every column; they are said once under the strip, as runs of
  // days ("est. · high confidence Today–Thu · medium confidence Fri"). Each day's button keeps its own words in its accessible name.
  const kw: {name: string; label: string | null}[] = [];
  // forecast-visuals B: the day cards ARE the week's bars: four hours per day (dawn, morning, noon, afternoon) on one scale for the whole week, each from that
  // hour's own headline (the Surf card's engine), filled with its rating colour; the wind and primary swell arrows under each; the day's tide as a thin line.
  // review: each bar's own certainty (an hour past the horizon is faded and says so), its saved-copy word, and the person's scale on estimates (as the day card)
  const cols = days.map((d) => { const hrs = series.slice(d.start, d.end + 1); return BAR_BLOCKS.map((b) => { const h = hrs.find((x) => x.hour === b.hour), hs = h ? surfOf(spot, h.forecast, p, bundle, now).h : null;
    const far = !!h && !!hs && certaintyOf(spot.id, hs, h.timestamp, now)?.level === 'too-far', saved = !!hs && 'saved' in hs && !!hs.saved;
    return {...b, h, bar: barOf(hs), far, dark: !!h && isDark(spot.id, h.timestamp), tag: [far ? 'too far out to call, the model says this' : '', saved ? 'saved copy' : ''].filter(Boolean).join(', ')}; }); });
  // the week's scale from the bars that are surf forecasts within the horizon (an offshore or too-far height never shrinks them; pct clamps the rest)
  const scale = weekScale(cols.flat().filter((c) => (c.bar.kind === 'est' || c.bar.kind === 'nws') && !c.far).map((c) => c.bar));
  const tides = series.map((x) => x.forecast.tide.height).filter(fin), tLo = tides.length ? Math.min(...tides) : 0, tHi = tides.length ? Math.max(...tides) : 1;
  const scaled = (k: BarKind) => k === 'est' || k === 'flat' || k === 'demo', hawaiian = p.scale === 'Hawaiian';
  const fmt = (ft: number, k: BarKind) => { const v = heightValue(ft, p, scaled(k)); return p.heightUnit === 'm' ? v.toFixed(1) : String(Math.round(v)); };
  const unitOf = (k: BarKind) => `${p.heightUnit}${hawaiian && scaled(k) ? ' ≈ Hawaiian' : ''}`;
  const [tla, tlo] = spotLatLon(spot), tst = tideStationFor({id: spot.id, latitude: tla, longitude: tlo});
  // lead (2026-11-14): each day's best window (the Call's own windowOnDay: Go, else Worth a look; none = Skip), the surface word at its middle hour (our rule from the
  // wind, services/surfaceWord.ts) and the Board Match pick for that hour when the person has boards
  const records = series.map((x) => x.forecast), wctx = {records, bundle, nowMs: now};
  const tz = timeZoneOf(spot), todayKey = dateIn(tz, new Date(now).toISOString());
  const plan = days.map((d) => { const dk = dateIn(tz, d.t), w = windowOnDay(spot, dk, p, wctx, now), isToday = dk === todayKey;
    if (!w) return {w: null, surface: null, board: null, far: false, todayPassed: isToday};
    // the window's own hours (an hour that overlaps it: end exclusive, a first-light start kept); none of it past the horizon (no verdict built on a number we do not show)
    const a = Date.parse(w.start), z = Date.parse(w.end), inWin = series.filter((x) => { const t = Date.parse(x.timestamp); return t + 3600000 > a && t < z; });
    const far = inWin.some((x) => certaintyOf(spot.id, surfOf(spot, x.forecast, p, bundle, now).h, x.timestamp, now)?.level === 'too-far');
    if (far) return {w: null, surface: null, board: null, far: true, todayPassed: false};
    const mid = inWin[Math.floor(inWin.length / 2)], f = mid?.forecast, surface = f && f.availability.wind !== false ? surfaceWord(f.wind.speed, windRelationship(spot, f), f.wind.gusts) : null;
    const pick = boards.length && f ? boardPickFor(boards, spot, f, now, p, {bundle}).pick : null;
    return {w, surface, far: false, todayPassed: false, board: pick ? {short: `${lengthLabel(pick.length).replace(' ', '')} ${shortType(pick.type)}`, name: pick.name} : null}; });
  const strip = (
    <nav className="sp-days days" aria-label="Forecast days" data-scrub={scrub.current || undefined}
      onPointerDown={(e) => { if (e.pointerType === 'mouse' && e.button === 0) scrub.current = true; }}
      onPointerMove={(e) => { if (!scrub.current || !(e.buttons & 1)) { scrub.current = false; return; } const k = Number((document.elementFromPoint(e.clientX, e.clientY)?.closest('.sp-day') as HTMLElement | null)?.dataset.k); if (Number.isFinite(k) && k !== cur) onPick(k); }}
      onPointerUp={() => { scrub.current = false; }} onPointerLeave={() => { scrub.current = false; }}>
      {days.map((d, k) => {
        if (d.end - d.start < 11) return null;
        const hrs = series.slice(d.start, d.end + 1), day = hrs.filter((x) => x.hour >= 6 && x.hour <= 19);
        // One engine for every surface (T-055): the day's range comes from dayRange over its daylight hours, the same headline estimate as the
        // SURF card. The demonstration week (no estimate, no offshore) keeps its typical face height, labelled demo.
        const dr = dayRange(spot, hrs.map((x) => x.forecast), dateIn(timeZoneOf(spot), d.t), now, p, {bundle});
        const demo = dr.kind === 'none' ? day.map((x) => surfOf(spot, x.forecast, p, bundle, now).h).filter((x): x is Extract<HeadlineSurf, {kind: 'demonstration'}> => x.kind === 'demonstration') : [];
        // T-057: the card's main number is the estimate at ONE hour (best daylight hour, else the median one), via spotHour; the full envelope is "range over daylight" below.
        const ty = dr.typical, env = dr.kind !== 'none' && dr.loFt !== null && dr.hiFt !== null ? [dr.loFt, dr.hiFt] : null;
        const range = ty ? [ty.loFt, ty.hiFt] : demo.length ? [median(demo.map((x) => x.ft)), median(demo.map((x) => x.ft))] : null;
        const tyFlat = isFlat(ty?.hour?.surf?.headline); // T-130: a Flat midday reads "Flat · model estimate", never "Flat est."
        const kind = dr.kind === 'estimate' ? (tyFlat ? 'model estimate' : 'est.') : dr.kind === 'offshore' ? 'offshore' : dr.kind === 'official' ? (ty?.hour?.surf?.headline.kind === 'official' && ty.hour.surf.headline.stale ? 'NWS (older)' : 'NWS') : demo.length ? 'demo' : '';
        // T-112: the main number is the SAME text the week grid shows (dayText: the midday hour's headline value, in the person's unit and scale); the demo week keeps its own median.
        const dt = dayText(ty), lo = range ? ht(range[0], p, 0) : null, hi = range ? ht(range[1], p, 0) : null, mainNum = dr.kind === 'official' && (dr.officialHalves?.length ?? 0) > 1 ? dr.officialHalves!.map((x) => officialRange(x, p.heightUnit === 'm' ? 'm' : 'ft').replace(/\s*(ft|m)$/, '')).join(' / ') : dt ? dt.numbers : lo === hi ? (lo ?? '—') : `${lo}–${hi}`, unitSuffix = dt ? dt.full.slice(dt.numbers.length).trim() : p.heightUnit;
        const envBase = env && dr.label ? dr.label.replace(/^Est\. /, '').replace(/ offshore$/, '') : null, envText = envBase ? `${envBase}${dr.kind === 'offshore' && !/\b(ft|m)$/.test(envBase) ? ` ${p.heightUnit}` : ''}` : null;   // the offshore label can already carry its unit ("9.2 to 9.8 ft ft")
        const blocks = cols[k];
        // certainty (2026-11-06): the midday hour's level. Past the horizon the card says "too far out" (the model's number moves to the note under the strip and the tooltips); where the models disagree the band stays the number, with "models differ" and what it could be in the detail.
        const cv = dr.kind === 'none' ? null : dayCertainty(spot.id, dr, now), far = cv?.level === 'too-far', shown = certainLabel(mainNum, unitSuffix, cv, p);
        if (k === cur && env) selNote = `${cv ? `${far ? 'Too far out to call' : `${cv.word.replace(/^\w/, (c) => c.toUpperCase())}${shown.note ? `, ${shown.note}` : ''}`}: ${cv.why}. ${far ? `The model says ${(shown.detail ?? '').replace(/^the model says /, '')} at ${ty?.short ?? 'midday'}. ` : shown.detail ? `${shown.detail.replace(/^\w/, (c) => c.toUpperCase())}. ` : ''}` : ''}${dr.kind === 'official' ? `NWS surf zone forecast, one range for the day (${dr.basis})` : `Range over daylight: ${envText} (${kind === 'est.' || tyFlat ? 'estimated' : kind}, ${dr.hours} daylight hours)`}`;
        const name = weekdayPT(d.t) === today && k === 0 ? 'Today' : `${weekdayPT(d.t)} ${dayNumPT(d.t)}`;
        const sumLabel = range && cv && !far ? `${kind} · ${shown.note ?? cv.word}` : null; kw.push({name, label: sumLabel});
        return (
          <button key={d.key} className={`sp-day day${cv ? ` is-${cv.level}` : ''}`} data-k={k} aria-pressed={k === cur} onClick={() => onPick(k)} data-certainty={cv?.level}
            aria-label={`${name}: ${range ? `${far ? `too far out to call, ${shown.detail}` : `typically ${tyFlat ? FLAT_ESTIMATE_TEXT : `${shown.text.replace('–', ' to ')} ${unitSuffix} ${kind === 'est.' ? 'estimated' : kind}`}`}${cv && !far ? `, ${cv.word}` : ''}${shown.note ? `, ${shown.note}${shown.detail ? ` (${shown.detail})` : ''}` : ''}${ty ? `, ${ty.aria}` : ''}${envText ? `; range over daylight ${envText.replace('–', ' to ')}` : ''}` : 'no height'}; ${blocks.map((b) => `${barWords(b.label, b.bar, fmt, unitOf, b.tag)}, ${b.h ? `${conditionWord(b.h.rating.category).toLowerCase()}${b.dark ? ' (after dark)' : ''}` : 'no rating'}`).join('; ')}${plan[k].w ? `; ${plan[k].w!.verdict ?? 'window'} window ${plan[k].w!.label}` : ''}${plan[k].surface ? `, surface ${plan[k].surface} (our rule from the wind)` : ''}${plan[k].board ? `, Board Match ${plan[k].board!.name}` : ''}${k === best ? '; best day' : ''}`}>
            <span className="sd-t">{name}{k === best && <span className="sd-star" role="img" aria-label="Best day of the week" title="Best day of the week for you: the highest average rating over its 6 AM–7 PM hours, among the next few days that have a Go or Worth-a-look window for your skill range. The call's window above is the best stretch within one day."><Icon name="star" size={12} /></span>}</span>
            <span className={`sd-h${dr.kind === 'offshore' ? ' sd-off' : ''}`} title={cv ? `${sumLabel && ty ? `${ty.aria}; ` : ''}${cv.word}: ${cv.why}${shown.detail ? `. ${shown.detail}` : ''}` : undefined}>{range ? (far ? <span className="sd-far">too far out</span> : <>{shown.text}<small>{unitSuffix}</small></>) : '—'}</span>
            {(() => { const pl = plan[k]; if (pl.far || far) return null; if (!pl.w && pl.todayPassed) return range ? <span className="sd-plan"><span className="sd-s sd-none">no window left today</span></span> : null;
              const v = pl.w?.verdict ?? (range ? 'Skip' : null); if (!v) return null; const band = v === 'Go' ? 'good' : v === 'Worth a look' ? 'fair' : 'poor';
              return <span className="sd-plan" title={`${pl.w ? `${v} window ${pl.w.label} (provisional)` : 'Skip: no window this day (provisional)'}${pl.surface ? ` · surface: ${pl.surface} (our rule from the wind)` : ''}${pl.board ? ` · Board Match: ${pl.board.name}` : ''}`}>
                <span className="sd-v"><i className="vm" style={{borderColor: BAND_COLOR[band]}} />{v}</span>{pl.surface && <span className="sd-s">{pl.surface}</span>}{pl.board && <span className="sd-b">{pl.board.short}</span>}</span>; })()}
            <span className="sd-k" title={ty ? `${ty.aria}${cv ? `; ${cv.word}: ${cv.why}${shown.detail ? `. ${shown.detail}` : ''}` : ''}` : undefined}>{sumLabel ? null : `${kind}${ty ? ` · ${ty.short}` : ''}`}</span>
            <span className="wb" aria-hidden="true">
              <span className="wb-bars" style={{'--gs': `${(scale.step / scale.max) * 100}%`} as CSSProperties}>{blocks.map((b) => {
                const bar = b.bar, dark = b.dark, w = b.h?.forecast.wind, sw = b.h?.forecast.primary;
                const lo = bar.lo !== null ? pct(bar.lo, scale.max) : 0, hi = bar.hi !== null ? pct(bar.hi, scale.max) : 0;
                // our rating colours OUR estimate only; the NWS range is theirs (neutral, dashed), offshore and demonstration are grey; those hours show the rating as a dot
                const rating = b.h ? BAND_COLOR[bandOf(b.h.rating.category)] : undefined, colour = bar.kind === 'est' || bar.kind === 'flat' ? rating ?? 'var(--none)' : bar.kind === 'nws' ? 'var(--muted)' : undefined;
                return <span key={b.label} className="wb-col" title={`${barWords(b.label, bar, fmt, unitOf, b.tag)}${b.h ? ` · ${conditionWord(b.h.rating.category).toLowerCase()}${dark ? ', after dark' : ''}` : ''}`}>
                  <span className="wb-track">{bar.kind !== 'none' && <i className={`wb-bar k-${bar.kind}${dark ? ' dark' : ''}${b.far ? ' far' : ''}`} style={(bar.kind === 'est' || bar.kind === 'nws' ? {bottom: 0, height: `${hi}%`, '--c': colour, '--split': `${hi > 0 ? ((hi - lo) / hi) * 100 : 100}%`} : {bottom: `${lo}%`, height: `${Math.max(0, hi - lo)}%`, '--c': colour}) as unknown as CSSProperties} />}</span>
                  {b.h && bar.kind !== 'est' && bar.kind !== 'flat' && bar.kind !== 'none' ? <i className="wb-r" style={{background: rating}} /> : <i className="wb-r none" />}
                  <svg className="wb-a" viewBox="-7 -7 14 14">{w && fin(w.direction) && b.h?.forecast.availability.wind !== false && <g className={`ca ca-${relClass(windRelationship(spot, b.h!.forecast))}`} transform={`rotate(${(w.direction + 180) % 360})`}><path d="M0 -6.5 L4.6 3.5 L0 1.4 L-4.6 3.5Z" /></g>}</svg>
                  <svg className="wb-a" viewBox="-7 -7 14 14">{sw && fin(sw.direction) && partitionKind(sw, true) !== 'noise' && <g className={`ca ca-${periodStep(Math.round(sw.period))}`} transform={`rotate(${(sw.direction + 180) % 360})`}><path d="M0 -6.5 L4.6 3.5 L0 1.4 L-4.6 3.5Z" /></g>}</svg>
                </span>; })}</span>
              {(() => { const pts = hrs.filter((x) => x.hour >= 5 && x.hour <= 16 && fin(x.forecast.tide.height)); if (pts.length < 6 || tHi - tLo < 0.1) return null;   // the tide under the bars' own hours (5 AM to 4 PM, 6a at the first bar's centre, 3p at the last's)
                const d = pts.map((x, i) => `${i ? 'L' : 'M'}${(12.5 + ((x.hour - 6) / 9) * 75).toFixed(1)},${(17 - ((x.forecast.tide.height - tLo) / (tHi - tLo)) * 14).toFixed(1)}`).join('');
                return <svg className="wb-tide" viewBox="0 0 100 20" preserveAspectRatio="none"><path d={d} /></svg>; })()}
            </span>
          </button>
        );
      })}
    </nav>
  );
  // runs of consecutive days with the same words: "est. · high confidence Today–Thu · medium confidence Fri"
  // grouped by label, first appearance first: "est. · high confidence Thu 12–Sat 14, Tue 17; medium confidence Sun 15" (a label that returns after a gap is not
  // repeated; ';' separates the groups so no word can be read as another group's)
  const groups = new Map<string, {from: string; to: string; i: number}[]>();
  kw.forEach((d, i) => { if (!d.label) return; const g = groups.get(d.label) ?? []; const last = g[g.length - 1]; if (last && last.i === i - 1) { last.to = d.name; last.i = i; } else g.push({from: d.name, to: d.name, i}); groups.set(d.label, g); });
  const kinds = new Set([...groups.keys()].map((l) => l.split(' · ')[0]));
  const keyLine = groups.size ? [...groups].map(([label, rs], k) => `${kinds.size > 1 || k === 0 ? label : label.split(' · ').slice(1).join(' · ')} ${rs.map((r) => (r.from === r.to ? r.from : `${r.from}–${r.to}`)).join(', ')}`).join('; ') : null;
  // forecast-visuals B: ONE short key line for the bars (the Stage A key's style): ratings, the scale step, the arrows, the tide; the offshore and NWS swatches only when a bar uses them
  const tideDrawn = tHi - tLo >= 0.1 && days.some((d) => series.slice(d.start, d.end + 1).filter((x) => x.hour >= 5 && x.hour <= 16 && fin(x.forecast.tide.height)).length >= 6);
  const all = cols.flat(), kinds2 = new Set(all.map((c) => c.bar.kind)), rated = kinds2.has('est') || kinds2.has('flat');
  const verdictKey = plan.some((x) => x.w) || plan.some((x) => !x.far && !x.todayPassed) ? <><span>best window:</span><span><i className="vm" style={{borderColor: BAND_COLOR.good}} />Go</span><span><i className="vm" style={{borderColor: BAND_COLOR.fair}} />Worth a look</span><span><i className="vm" style={{borderColor: BAND_COLOR.poor}} />Skip</span>
    {plan.some((x) => x.surface) && <span>surface: our rule from the wind</span>}{plan.some((x) => x.board) && <span>board: your Board Match pick</span>}<span>{rated ? 'verdicts and bar ratings provisional, our rules' : 'provisional, our rules'}</span></> : null;
  const barKey = <p className="sp-wbkey">{rated && <><span><i className="sw" style={{background: BAND_COLOR.good}} />good</span><span><i className="sw" style={{background: BAND_COLOR.fair}} />fair</span><span><i className="sw" style={{background: BAND_COLOR.poor}} />poor</span><span>ratings provisional</span></>}
    {kinds2.has('est') && <span>solid: typical wave to sets</span>}
    <span>6a 9a 12p 3p · grid {stepText(heightValue(scale.step, p, hawaiian))} {p.heightUnit}{hawaiian ? ' ≈ Hawaiian' : ''}</span><span>arrows: wind (shore relation), then swell (period)</span>
    {tst && tideDrawn && <span><i className="tl" />tide: NOAA {tst.station.name}{hourlyTideStationIds.includes(tst.station.id) ? '' : ', interpolated'}, above MLLW, not at the beach</span>}</p>;
  // data-honesty review: the marks only some bars carry (not our estimate: offshore, NWS, demonstration; after dark; too far out) stay in view beside the verdict key;
  // only the always-present key (rating colours, the solid part, the grid, the arrows, the tide line) folds
  const marks = [...kinds2].some((k) => k === 'off' || k === 'demo' || k === 'nws') || all.some((c) => (c.dark || c.far) && c.bar.kind !== 'none');
  const markKey = marks ? <>
    {[...kinds2].some((k) => k === 'off' || k === 'demo' || k === 'nws') && <span><i className="wb-r" style={{background: BAND_COLOR.fair}} />dot: rating where the bar is not our estimate</span>}
    {kinds2.has('off') && <span><i className="sw off" />offshore Hs, not surf size</span>}{kinds2.has('nws') && <span><i className="sw nws" />NWS forecast, for the day{hawaiian ? ' (in published feet; our estimates ≈ Hawaiian)' : ''}</span>}{kinds2.has('demo') && <span><i className="sw demo" />demonstration</span>}
    {all.some((c) => c.dark && c.bar.kind !== 'none') && <span><i className="sw dk" />after dark</span>}{all.some((c) => c.far && c.bar.kind !== 'none') && <span><i className="sw fr" />too far out</span>}
  </> : null;

  // space-tighten (user, 2026-11-14: "soooo much blank space"): the verdict key and the per-day confidence line stay in view; the bar key and the selected day's
  // confidence note (its reason and the daylight range) sit under one "Key and day detail" toggle, folded on a phone, open on a wide screen. Nothing is removed.
  return <>{strip}{verdictKey || markKey ? <p className="sp-wbkey sp-vkey">{verdictKey}{markKey}</p> : null}{keyLine && <p className="sp-days-k">{keyLine}</p>}
    <details className="sp-wbmore" open={keyOpen}><summary>Key and day detail<span className="sp-wbmore-s">bar colours, grid, arrows, tide{selNote ? ' · this day\'s confidence and range' : ''}</span></summary>{barKey}{selNote && <p className="sp-dayrange">{selNote}</p>}</details></>;
}

/** Magicseaweed-style 3-hour table for the selected day: wind cells coloured by shore relation. */
export function HourTable({hours, spot, p, bundle, now, selected, onSelect}: {hours: HourSample[]; spot: SurfSpot; p: UserProfile; bundle: OceanBundle | null | undefined; now: number; selected: string | null; onSelect: (t: string) => void}) {
  const rows = hours.filter((x) => x.hour % 3 === 0);
  const u = p.heightUnit;
  return (
    <div className="tscroll" role="region" tabIndex={0} aria-label="3-hour forecast table (scrolls sideways)">
      <table className="sp-table">
        <thead><tr><th>Time</th><th>Surf</th><th>Rating</th><th>Primary swell</th><th>Secondary</th><th>Wind</th><th>Tide</th></tr></thead>
        <tbody>{rows.map((x) => {
          const f = x.forecast, {h: hs, t} = surfOf(spot, f, p, bundle, now), rel = fin(f.wind.speed) ? windRelationship(spot, f) : 'Unknown';
          return (
            <tr key={x.timestamp} aria-current={x.timestamp === selected ? 'true' : undefined}>
              <th scope="row"><button onClick={() => onSelect(x.timestamp)}>{hourLabel(x.timestamp)}</button></th>
              <td className="st-surf"><b>{t.value}</b><small>{isFlat(hs) ? '(model estimate)' : hs.kind === 'estimate' ? 'est.' : hs.kind === 'offshore' ? 'offshore' : hs.kind === 'official' ? (hs.stale ? 'NWS (older)' : 'NWS') : hs.kind === 'demonstration' ? 'demo' : ''}</small></td>
              <td><span className="st-q" style={{background: BAND_COLOR[bandOf(x.rating.category)]}} />{conditionWord(x.rating.category)}{x.rating.dark && <small> · after dark</small>}</td>
              <td>{f.primary && partitionKind(f.primary, true) !== 'noise' ? <>{ht(f.primary.height, p)} {u} · {Math.round(f.primary.period)} s <DirArrow from={f.primary.direction} size={12} /> {compass(f.primary.direction)}</> : '—'}</td>
              <td>{f.secondary && partitionKind(f.secondary) !== 'noise' ? <>{ht(f.secondary.height, p)} {u} · {Math.round(f.secondary.period)} s <DirArrow from={f.secondary.direction} size={12} /> {compass(f.secondary.direction)}</> : '—'}</td>
              <td className={`st-wind ${relClass(rel)}`}>{fin(f.wind.speed) ? <>{fin(f.wind.direction) && <DirArrow from={f.wind.direction} size={12} />} {windVal(f.wind.speed, p)} {p.windUnit}<small>{fin(f.wind.gusts) ? `gust ${windVal(f.wind.gusts, p)} · ` : ''}{relWord(rel)}</small><StaleTag s={hourFreshness(f, now).wind} /></> : '—'}</td>
              <td>{fin(f.tide.height) ? <>{`${htSigned(f.tide.height, p)} ${u}`}<StaleTag s={hourFreshness(f, now).tide} /></> : '—'}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/** Nearest buoy, observed now vs the forecast for the same hour (different points, so this is context, not validation). */
export function BuoyNow({buoy, series, p, now}: {buoy: ObservationSet | null | undefined; series: HourSample[]; p: UserProfile; now: number}) {
  if (!buoy) return <p>No buoy observation was returned for this load.</p>;
  const v = buoy.values, hs = v['Offshore significant height'], tp = v['Dominant wave period'], dir = v['Mean wave direction'], wt = Object.entries(v).find(([k]) => /water temp/i.test(k))?.[1];
  const at = hs?.source.validAt, near = at ? series.reduce<HourSample | null>((b, x) => (Math.abs(Date.parse(x.timestamp) - Date.parse(at)) < (b ? Math.abs(Date.parse(b.timestamp) - Date.parse(at)) : Infinity) ? x : b), null) : null;
  const gap = near && at ? Math.abs(Date.parse(near.timestamp) - Date.parse(at)) : Infinity;
  const fc = gap <= 5400000 ? near : null, age = at ? now - Date.parse(at) : Infinity;
  const row = (label: string, obs: ReactNode, model: ReactNode) => <tr><th scope="row">{label}</th><td>{obs}</td><td>{model}</td></tr>;
  return (
    <>
      <p className="fine">NDBC {buoy.station} · {buoy.location}{at ? ` · observed ${weekdayPT(at)} ${timeLabelPT(at)}` : ''}{buoy.delivery === 'saved' || age > 6 * 3600000 ? <b> · saved snapshot, not current</b> : ''}</p>
      <table className="sp-buoy"><thead><tr><th /><th>Buoy (observed)</th><th>Forecast, this spot</th></tr></thead><tbody>
        {row('Wave height', hs?.value != null ? `${ht(hs.value, p)} ${p.heightUnit}` : '—', fc && fin(fc.forecast.offshore) ? `${ht(fc.forecast.offshore, p)} ${p.heightUnit} offshore` : 'no hour within 90 min')}
        {row('Period', tp?.value != null ? `${Math.round(tp.value)} s` : '—', fc?.forecast.primary && fin(fc.forecast.primary.period) ? `${Math.round(fc.forecast.primary.period)} s primary` : '—')}
        {row('Direction', dir?.value != null ? `${compass(dir.value)} ${Math.round(dir.value)}°` : '—', fc?.forecast.primary && fin(fc.forecast.primary.direction) ? `${compass(fc.forecast.primary.direction)} ${Math.round(fc.forecast.primary.direction)}°` : '—')}
        {wt && row('Water', wt.value != null ? `${Math.round(wt.value)}°F` : '—', fc && fin(fc.forecast.waterTempF) ? `${Math.round(fc.forecast.waterTempF)}°F` : '—')}
      </tbody></table>
      <p className="fine">The buoy is about 18 NM offshore and the forecast is at this spot's model point: context, not a validation.</p>
    </>
  );
}

/** Wave scale panel (T-048): the hour's face estimate, a surfer at the user's height and their best board, drawn to one scale.
 *  Drawn from data only (no imagery). Without a face estimate the wave is not drawn: offshore height is not surf size. */
export function ScalePanel({hs, p, board, outsideNote, onOpen}: {hs: HeadlineSurf; p: UserProfile; board: import('../../models/index').Surfboard | null; outsideNote?: string | null; onOpen: () => void}) {
  const me = userHeight(p), personFt = me.feet; // the surfer's own height (Personal › Surf preferences), else the labeled 5'10" default
  const flat = isFlat(hs), est = hs.kind === 'estimate' && !flat ? hs : null, boardFt = board ? board.length / 12 : 0; // T-130: a Flat hour draws no wave (still water), never a zero-height face
  const top = Math.max(est ? est.hiFt * 1.08 : 0, personFt * 1.15, boardFt * 1.1, 7);
  const m = p.heightUnit === 'm', step = m ? (top * 0.3048 > 5 ? 2 : 1) : top > 14 ? 4 : 2, base = 150, H = 138, y = (ft: number) => base - (ft / top) * H;
  const ticks: number[] = []; for (let v = step; (m ? v / 0.3048 : v) <= top; v += step) ticks.push(v);
  const yy = (u: number) => y(m ? u / 0.3048 : u);
  const ph = (personFt / top) * H, px = 118, pw = ph * 0.3;
  // space-tighten: the drawing ends a little past the board (or the person): no empty grid on its right (it was a fixed 220 wide)
  const R = Math.round(Math.max(170, (board ? px + pw + 18 + 11 : px + pw) + 16));
  const label = flat ? `${FLAT_ESTIMATE_TEXT}: still water beside a surfer ${formatHeight(me.inches, p.heightUnit)} tall` : est ? `Estimated surf height ${ht(est.loFt, p, 0)} to ${ht(est.hiFt, p, 0)} ${p.heightUnit} beside a surfer ${formatHeight(me.inches, p.heightUnit)} tall${board ? ` and a ${feetInches(board.length)} board` : ''}` : 'No surf estimate this hour; surfer and board only';
  // T-098 (Codex P2): the caption describes THIS card's drawing: the estimate's range (outer = high bound, inner = low bound) beside the
  // person's own height (userHeight), not the 3D view's single face and fixed 5'9" surfer. Offshore-only hours say there is no breaking-wave estimate.
  const scaleLine = flat ? `${FLAT_ESTIMATE_TEXT}: the nearshore model has under half a foot here` : est ? "The estimate's range, drawn to scale beside you"
    : hs.kind === 'offshore' ? `No breaking-wave estimate · ${ht(hs.ft, p)} ${p.heightUnit} offshore swell, not surf size${outsideNote ? ` · ${outsideNote}` : ''}` : hs.kind === 'official' ? `No breaking-wave estimate of ours · the NWS surf forecast for the zone is shown in the header, not drawn to scale` : 'No breaking-wave estimate for this hour';
  const chart = (
      <svg viewBox={`0 0 ${R} 168`} preserveAspectRatio="xMinYMax meet" role="img" aria-hidden="true">
        {ticks.map((t) => <g key={t}><line x1={22} x2={R - 4} y1={yy(t)} y2={yy(t)} stroke="var(--line)" strokeWidth={1} /><text x={18} y={yy(t) + 4} fontSize={10} textAnchor="end" fill="var(--dim)">{t}</text></g>)}
        <line x1={22} x2={R - 4} y1={base} y2={base} stroke="var(--line-2)" strokeWidth={1.2} />
        {est && <g>
          {/* A wave face drawn to scale: the outer shape reaches the high bound, the darker inner one the low bound. */}
          {[est.hiFt, est.loFt].map((ft, i) => { const t = y(ft), h = base - t, x0 = 24, x1 = 104; return (
            <path key={i} d={`M${x0} ${base} C ${x0 + 30} ${base - h * 0.08} ${x0 + 44} ${t + h * 0.18} ${x0 + 58} ${t + h * 0.02} C ${x0 + 66} ${t - h * 0.04} ${x1 - 2} ${t + h * 0.08} ${x1 - 6} ${t + h * 0.3} C ${x1 - 14} ${t + h * 0.18} ${x0 + 66} ${t + h * 0.2} ${x0 + 62} ${t + h * 0.45} C ${x0 + 60} ${t + h * 0.7} ${x1 - 6} ${base - 6} ${x1 + 8} ${base} Z`}
              fill={i === 0 ? 'color-mix(in srgb, var(--hs-hi) 26%, transparent)' : 'color-mix(in srgb, var(--hs-hi) 55%, transparent)'} stroke={i === 0 ? 'var(--hs-hi)' : 'none'} strokeWidth={1.3} />
          ); })}
        </g>}
        {/* surfer silhouette, to scale */}
        <g transform={`translate(${px} ${base - ph}) scale(${ph / 100})`} fill="var(--text)" opacity={0.85}>
          <PersonShape figure={figureOf(p)} />
        </g>
        {board && <rect x={px + pw + 18} y={y(boardFt)} width={11} height={(boardFt / top) * H} rx={5.5} fill="var(--s3, #e8ecef)" stroke="var(--muted)" strokeWidth={1} />}
        <text x={66} y={164} fontSize={10.5} textAnchor="middle" fill="var(--muted)">{est ? 'est. surf height' : 'no surf estimate'}</text>
        <text x={px + pw / 2} y={164} fontSize={10.5} textAnchor="middle" fill="var(--muted)">you</text>
        {board && <text x={px + pw + 23.5} y={164} fontSize={10.5} textAnchor="middle" fill="var(--muted)">board</text>}
        <text x={22} y={10} fontSize={10} fill="var(--dim)">{p.heightUnit}</text>
      </svg>);
  const mine = `${board ? `Your ${board.name}, ${feetInches(board.length)}` : 'No board in your quiver'} · you ${formatHeight(me.inches, p.heightUnit)}${me.isDefault ? ' (default)' : ''}`;
  return (
    <button className="sp-scalep" onClick={onOpen} aria-label={`Wave scale: ${label}. ${scaleLine}. Open the full wave scale`}>
      {chart}
      <span className="sp-scalep-c"><span className="sp-scale-at">{scaleLine}</span><span>{mine}</span><span className="sp-link-t">Full wave scale</span></span>
    </button>
  );
}

/** explainRating for one hour, with the wind relation and tide this page already shows. */
export function ratingWhy(spot: SurfSpot, h: HourSample, p: UserProfile, nowMs: number = Date.now()) {
  const f = h.forecast, windOk = f.availability.wind !== false && fin(f.wind.speed);
  const tideOk = f.availability.tide !== false && fin(f.tide.height);
  const tv = tideOf(f, p, nowMs);   // tide-label: the one tide accessor, so a saved or stale tide keeps its mark in the rating's words
  return explainRating(h.rating, {
    spotId: spot.id,
    wind: windOk ? {mph: f.wind.speed, relation: windRelationship(spot, f)} : null,
    tide: tideOk ? {trend: f.tide.trend === 'Rising' ? 'rising' : f.tide.trend === 'Falling' ? 'falling' : 'unknown', heightLabel: tv?.heightLabel ?? `${ht(f.tide.height, p)} ${p.heightUnit}`} : null,
    fmtWind: (mph) => windText(mph, p),
  });
}

/** 24-hour wind trace on a compass: each hour of the day at its direction (where the wind comes from) and speed, coloured by shore relation. */
function WindTrace({hours, spot, p, at, onSelect}: {hours: HourSample[]; spot: SurfSpot; p: UserProfile; at: string; onSelect: (t: string) => void}) {
  const pts = hours.filter((x) => fin(x.forecast.wind.speed) && fin(x.forecast.wind.direction));
  if (pts.length < 2) return <p className="sp-s">Not enough wind records for this day.</p>;
  const R = 110, max = Math.max(10, ...pts.map((x) => x.forecast.wind.speed)), ring = max > 20 ? 10 : 5, facing = facingOf(spot.id);
  const xy = (x: HourSample) => { const r = (x.forecast.wind.speed / max) * R, a = (x.forecast.wind.direction * Math.PI) / 180; return [Math.sin(a) * r, -Math.cos(a) * r] as const; };
  const line = pts.map((x, i) => `${i ? 'L' : 'M'}${xy(x)[0].toFixed(1)},${xy(x)[1].toFixed(1)}`).join('');
  return (
    <div className="sp-trace">
      <svg viewBox="-140 -140 280 280" role="img" aria-label={`Wind through ${weekdayPT(pts[0].timestamp)}: ${pts.filter((x) => x.hour % 6 === 0).map((x) => `${hourLabel(x.timestamp)} ${windVal(x.forecast.wind.speed, p)} ${p.windUnit} from ${compass(x.forecast.wind.direction)}`).join(', ')}`}>
        {Array.from({length: Math.floor(max / ring)}, (_, i) => (i + 1) * ring).map((v) => <g key={v}><circle r={(v / max) * R} fill="none" stroke="var(--line)" /><text x={3} y={-(v / max) * R - 2} fontSize={9} fill="var(--dim)">{String(windVal(v, p)).replace(/\.0$/, '')}</text></g>)}
        {['N', 'E', 'S', 'W'].map((d, i) => <text key={d} x={[0, 128, 0, -128][i]} y={[-124, 4, 132, 4][i]} fontSize={11} textAnchor="middle" fill="var(--muted)">{d}</text>)}
        {facing !== null && <line x1={0} y1={0} x2={0} y2={-R} transform={`rotate(${facing})`} stroke="var(--muted)" strokeDasharray="4 3" />}
        <path d={line} fill="none" stroke="var(--line-2)" strokeWidth={1.5} />
        {pts.map((x) => { const [cx, cy] = xy(x), sel = x.timestamp === at; return (
          <g key={x.timestamp} className={`sp-rel-ink ${relClass(windRelationship(spot, x.forecast))}`} onClick={() => onSelect(x.timestamp)} style={{cursor: 'pointer'}}>
            <circle cx={cx} cy={cy} r={sel ? 6 : 3.5} fill="currentColor" stroke={sel ? 'var(--text)' : 'none'} strokeWidth={2} />
            {x.hour % 6 === 0 && <text x={cx + 7} y={cy + 3} fontSize={9.5} fill="var(--muted)">{hourLabel(x.timestamp)}</text>}
          </g>
        ); })}
      </svg>
      <ul className="sp-trace-k"><li><i className="sp-rel-ink off" />offshore</li><li><i className="sp-rel-ink cross" />cross-shore</li><li><i className="sp-rel-ink on" />onshore</li><li><i className="sp-rel-ink unk" />unknown</li>{facing !== null && <li><i className="dash" />beach facing</li>}</ul>
      <p className="sp-f">Dots sit where the wind comes from, further out when stronger (rings in {p.windUnit}). Tap a dot to select that hour.</p>
    </div>
  );
}

/** The expanded detail under the grid for the card that was tapped. */
export function CardDetail({k, spot, h, p, dayHours, onSelect, onClose, Tide, Polar}: {
  k: CardKey; spot: SurfSpot; h: HourSample; p: UserProfile; dayHours: HourSample[]; onSelect: (t: string) => void; onClose: () => void;
  Tide: ReactNode; Polar: ReactNode;
}) {
  const ex = k === 'rating' ? ratingWhy(spot, h, p) : null;
  const title = {rating: 'Why this rating', wind: `Wind through ${weekdayPT(h.timestamp)}`, tide: `Tide through ${weekdayPT(h.timestamp)}`, swell: `Swell direction and period, ${weekdayPT(h.timestamp)}`}[k];
  return (
    <section className="card sp-detail" id="sp-detail" aria-label={title}>
      <div className="card-h"><h2>{title}</h2><button className="btn" onClick={onClose}>Close</button></div>
      {k === 'rating' && ex && <>
        <ul className="sp-explain">{ex.items.filter((x) => x.inScore).map((x) => <li key={`${x.factor}|${x.reason}`} className={MARK[x.effect].c}><i aria-hidden="true" /><span><strong>{x.factor} <span className="w">{MARK[x.effect].m}</span></strong>{x.reason}</span></li>)}</ul>
        {ex.items.some((x) => !x.inScore) && <><p className="sp-explain-h">Context, not part of the score</p>
          <ul className="sp-explain ctx">{ex.items.filter((x) => !x.inScore).map((x) => <li key={`${x.factor}|${x.reason}`} className={MARK[x.effect].c}><i aria-hidden="true" /><span><strong>{x.factor} <span className="w">{MARK[x.effect].m}</span></strong>{x.reason}</span></li>)}</ul></>}
        <p className="sp-explain-h">Reliability: {ex.reliability.category.toLowerCase()}</p>
        <ul className="sp-explain ctx">{ex.reliability.reasons.map((r) => <li key={r} className="u"><b aria-hidden="true">·</b><span>{r}</span></li>)}</ul>
      </>}
      {k === 'wind' && <WindTrace hours={dayHours} spot={spot} p={p} at={h.timestamp} onSelect={onSelect} />}
      {k === 'tide' && <>{Tide}<p className="sp-f">NOAA station prediction, not measured at the beach · sunrise/sunset approximate · tap the curve to select an hour</p></>}
      {k === 'swell' && <>{Polar}<p className="sp-f">Each dot is one hour's partition: direction around the ring, period by ring, size by height. Offshore model, not surf size.</p></>}
    </section>
  );
}
