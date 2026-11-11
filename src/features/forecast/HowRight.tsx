// ZONE: the scorecard's dates are Pacific days (services/howRight.ts); they stay America/Los_Angeles for every spot.
import {useEffect, useId, useState} from 'react';
import type {UserProfile} from '../../models/index';
import {diffText, howRightLine, leanText, type HowRightCard, type HowRightSpot, type HowRightWindow} from '../../services/howRight';
import {offshoreLine, ratingLine, ratingBasis, compassWord, collectingText, comparedText, leanOf, TYPICAL_DIFF, TYPICAL_DIFF_NOTE, type HowRightAllCard, type HowRightAllSpot, type OffshoreWindow, type ErrStat} from '../../services/howRightAll';
import {assignmentFor} from '../../ocean/mop';
import {timeLabelPT, weekdayPT} from './format';
import {useSwello} from '../../app/store';
import './howright.css';

/* Beyond-Surfline step 2: "How right we've been", on the spot page's Surf card. One line; one tap opens 7 and 30 days, a small chart and what each
 * number is. The numbers come from the daily server computation (/api/how-right, services/how-right.mjs); a page view never fetches a buoy. */

type Load = {state: 'loading'} | {state: 'ok'; card: HowRightCard} | {state: 'pending' | 'error'};
let shared: Promise<Load> | null = null;
/** One request per page load, shared by every spot page; a failure is retried on the next spot change. */
function loadCard(): Promise<Load> {
  if (!shared) shared = fetch('/api/how-right').then(async (r) => {
    const v = r.ok ? await r.json() : null;
    return v?.schema === 1 && v.spots ? {state: 'ok', card: v as HowRightCard} as Load : {state: v?.pending ? 'pending' : 'error'} as Load;
  }).catch(() => ({state: 'error'} as Load)).then((x) => { if (x.state === 'error') shared = null; return x; });
  return shared;
}
function useHowRight(spotId: string): Load {
  const [s, set] = useState<Load>({state: 'loading'});
  useEffect(() => { let live = true; loadCard().then((x) => { if (live) set(x); }); return () => { live = false; }; }, [spotId]);
  return s;
}
/** Skeleton only after ~200 ms (RULES.md): a fast load never flashes. */
function useLate(ms = 200) { const [late, set] = useState(false); useEffect(() => { const t = setTimeout(() => set(true), ms); return () => clearTimeout(t); }, [ms]); return late; }

const md = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric'});
/** A Pacific date (YYYY-MM-DD) or an instant, as "Nov 7". */
const day = (d: string) => md.format(new Date(d.length === 10 ? `${d}T20:00:00Z` : d));
const stamp = (iso: string) => `${weekdayPT(iso)} ${day(iso)}, ${timeLabelPT(iso)} PT`;

/** The spot page's line: the California MOP check where the spot has a MOP point, and for every spot the offshore check against a buoy (round 4C). */
export function HowRightLine({spotId, p}: {spotId: string; p: UserProfile}) {
  const {live} = useSwello();
  if (!live) return null; // the demonstration week is not checked against anything
  return <>{assignmentFor(spotId) ? <HowRightMop spotId={spotId} p={p} /> : null}<HowRightOffshore spotId={spotId} p={p} /></>;
}
function HowRightMop({spotId, p}: {spotId: string; p: UserProfile}) {
  const load = useHowRight(spotId), late = useLate(), [open, setOpen] = useState(false), id = useId(), unit = p.heightUnit === 'm' ? 'm' : 'ft';
  useEffect(() => setOpen(false), [spotId]);
  if (load.state === 'loading') return late ? <p className="hr hr-skel" role="status" aria-label="Loading how right we have been"><i /></p> : <p className="hr hr-skel" aria-hidden="true" />;
  if (load.state !== 'ok') return <p className="hr hr-quiet">How right we've been: {load.state === 'pending' ? 'not computed yet (it runs once a day).' : 'not available right now.'}</p>;
  const s = load.card.spots[spotId];
  if (!s) return <p className="hr hr-quiet">How right we've been: this spot is not in today's check.</p>;
  const line = howRightLine(s, load.card.shownSince, unit);
  return (
    <div className="hr">
      <p className="hr-line">
        <span>{line.text}</span>{' '}
        {s.status !== 'no-buoy' && <button type="button" className="hr-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{open ? 'Less' : s.status === 'ok' && s.d30 ? '30 days' : 'Which buoy'}</button>}
      </p>
      {line.source && <p className="hr-src">{line.source}</p>}
      {open && s.status === 'ok' && <HowRightDetail id={id} s={s} card={load.card} unit={unit} />}
      {open && s.status === 'collecting' && <div id={id} className="hr-d"><dl className="hr-what"><BuoyRows s={s} card={load.card} unit={unit} /></dl><p className="hr-src">Until then we show no accuracy number for this spot. Checked once a day · last {stamp(load.card.computedAt)}</p></div>}
    </div>
  );
}

/** Which buoy, where it is, and why it qualifies: shared by the scored and the waiting views. */
function BuoyRows({s, card, unit}: {s: Extract<HowRightSpot, {status: 'ok' | 'collecting'}>; card: HowRightCard; unit: 'ft' | 'm'}) {
  return <>
    <div><dt>Buoy (model-carried)</dt><dd>{s.buoy.name} (CDIP {s.buoy.id}, {Math.round(s.buoy.depthM)} m deep, {Math.round(s.buoy.km)} km away), on the hour, carried to our point {s.mopId} by CDIP's model. Not a measurement at the break.</dd></div>
    <div><dt>Why this buoy</dt><dd>Within {card.rule.anchorKm} km, and CDIP's model matched it this month within our limits (bias ≤ {diffText(card.rule.mopOk.bias, unit)}, average miss ≤ {diffText(card.rule.mopOk.mae, unit)}): off by {diffText(s.buoy.mop.maeFt, unit)} on average over {s.buoy.mop.n} hours. Hours used for this check are not scored.</dd></div>
  </>;
}

function WindowRow({w, unit}: {w: HowRightWindow | null; unit: 'ft' | 'm'}) {
  if (!w) return <span className="hr-w-none">too few hours to say</span>;
  return <><b>typical difference {diffText(w.typicalFt, unit)}</b>, {leanText(w.biasFt, unit)}<span className="hr-w-n"> · average miss {diffText(w.maeFt, unit)} · {w.n} hours, {day(w.from)} to {day(w.to)}</span></>;
}

function HowRightDetail({id, s, card, unit}: {id: string; s: Extract<HowRightSpot, {status: 'ok'}>; card: HowRightCard; unit: 'ft' | 'm'}) {
  return (
    <div id={id} className="hr-d">
      <dl className="hr-ws">
        <div><dt>Last 7 days</dt><dd><WindowRow w={s.d7} unit={unit} /></dd></div>
        <div><dt>{s.scoredFrom ? `Since ${day(s.scoredFrom)}` : 'Last 30 days'}</dt><dd><WindowRow w={s.d30} unit={unit} /></dd></div>
      </dl>
      <p className="hr-src">Typical difference = the median absolute difference: half the hours were closer than this. Lean = our forecast minus the buoy.</p>
      <DayChart s={s} unit={unit} />
      <dl className="hr-what">
        <div><dt>Our forecast</dt><dd>The surf height behind our band in the forecast we showed{s.leadH !== null ? ` about ${s.leadH} h ahead` : ' the day before'} (CDIP's nearshore forecast at {s.mopId}, before your own tuning).</dd></div>
        <BuoyRows s={s} card={card} unit={unit} />
      </dl>
      <p className="hr-src">Checked once a day · last {stamp(card.computedAt)}</p>
    </div>
  );
}

/** Daily means: the buoy height (carried to the point by CDIP's model) and our forecast. A two-item key above; no colour-only meaning (solid vs dashed). */
function DayChart({s, unit}: {s: Extract<HowRightSpot, {status: 'ok'}>; unit: 'ft' | 'm'}) {
  const d = s.days; if (d.length < 2) return null;
  const k = unit === 'm' ? 0.3048 : 1, vals = d.flatMap((x) => [x.measuredFt * k, x.oursFt * k]), lo = Math.max(0, Math.floor(Math.min(...vals))), hi = Math.ceil(Math.max(...vals)) || 1;
  const W = 320, H = 96, L = 34, R = 8, T = 8, B = 18, X = (i: number) => L + (i / (d.length - 1)) * (W - L - R), Y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const path = (f: (x: typeof d[number]) => number) => d.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(f(x) * k).toFixed(1)}`).join(' ');
  const last = d[d.length - 1], mean = (f: (x: typeof d[number]) => number) => d.reduce((a, x) => a + f(x), 0) / d.length;
  return (
    <figure className="hr-fig">
      <figcaption className="hr-key" aria-hidden="true"><span><i className="hr-k-m" />buoy (model-carried)</span><span><i className="hr-k-o" />our forecast</span></figcaption>
      <svg className="hr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Daily average over ${d.length} days, ${day(d[0].date)} to ${day(last.date)}: buoy (model-carried) ${diffText(mean((x) => x.measuredFt), unit)}, our forecast ${diffText(mean((x) => x.oursFt), unit)}`}>
        {[lo, hi].map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="hr-grid" /><text x={L - 4} y={Y(v) + 3} textAnchor="end" className="hr-ax">{v}{v === hi ? ` ${unit}` : ''}</text></g>)}
        <path d={path((x) => x.measuredFt)} className="hr-meas" />
        <path d={path((x) => x.oursFt)} className="hr-ours" />
        <text x={L} y={H - 4} className="hr-ax">{day(d[0].date)}</text>
        <text x={W - R} y={H - 4} textAnchor="end" className="hr-ax">{day(last.date)}</text>
      </svg>
    </figure>
  );
}


/* ---------- every spot: the offshore forecast and the rating against a buoy (round 4C; /api/how-right-all, services/how-right-all.mjs) ---------- */
type LoadAll = {state: 'loading'} | {state: 'ok'; card: HowRightAllCard} | {state: 'pending' | 'error'};
let sharedAll: Promise<LoadAll> | null = null;
function loadAll(): Promise<LoadAll> {
  if (!sharedAll) sharedAll = fetch('/api/how-right-all').then(async (r) => {
    const v = r.ok ? await r.json() : null;
    return v?.schema === 2 && v.spots ? {state: 'ok', card: v as HowRightAllCard} as LoadAll : {state: v?.pending ? 'pending' : 'error'} as LoadAll;
  }).catch(() => ({state: 'error'} as LoadAll)).then((x) => { if (x.state === 'error') sharedAll = null; return x; });
  return sharedAll;
}
function useHowRightAll(spotId: string): LoadAll {
  const [s, set] = useState<LoadAll>({state: 'loading'});
  useEffect(() => { let live = true; loadAll().then((x) => { if (live) set(x); }); return () => { live = false; }; }, [spotId]);
  return s;
}
function HowRightOffshore({spotId, p}: {spotId: string; p: UserProfile}) {
  const load = useHowRightAll(spotId), late = useLate(), [open, setOpen] = useState(false), id = useId(), unit = p.heightUnit === 'm' ? 'm' : 'ft', hasMop = !!assignmentFor(spotId);
  useEffect(() => setOpen(false), [spotId]);
  if (load.state === 'loading') return hasMop ? null : late ? <p className="hr hr-skel" role="status" aria-label="Loading how right we have been"><i /></p> : <p className="hr hr-skel" aria-hidden="true" />;
  if (load.state !== 'ok') return hasMop ? null : <p className="hr hr-quiet">How right we've been: {load.state === 'pending' ? 'not computed yet (it runs once a day).' : 'not available right now.'}</p>;
  const s = load.card.spots[spotId];
  if (!s) return hasMop ? null : <p className="hr hr-quiet">How right we've been: this spot is not in today's check.</p>;
  const off = offshoreLine(s, unit), rat = ratingLine(s), detail = s.status === 'ok' || s.status === 'collecting' ? s : null;
  return (
    <div className="hr hr-all">
      <p className="hr-line">
        <span>{off.text}</span>{' '}
        {detail && <button type="button" className="hr-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{open ? 'Less' : 'Details'}</button>}
      </p>
      {rat && <p className="hr-line hr-line-2"><span>{rat.text}</span></p>}
      {open && detail && <HowRightAllDetail id={id} s={detail} card={load.card} unit={unit} />}
    </div>
  );
}
/** UTC, always said: the captures and the card are UTC days ("Nov 10" in Pacific time is a different day from the capture's). */
const utcDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', {timeZone: 'UTC', month: 'short', day: 'numeric'});
const utcStamp = (iso: string) => `${new Date(iso).toISOString().slice(0, 10)} ${new Date(iso).toISOString().slice(11, 16)} UTC`;
const win = (w: OffshoreWindow | null, need: number, have: number, unit: 'ft' | 'm') => {
  if (!w?.hs) return <span className="hr-w-none">{collectingText(have, need)}</span>;
  return <><b>{TYPICAL_DIFF} {diffText(w.hs.typical / 0.3048, unit)}</b>, {leanOf(w.hs.bias, unit)}<span className="hr-w-n"> · {w.n} hours over {w.daysWithData} days, {utcDay(w.from)} to {utcDay(w.to)} UTC</span></>;
};
const TOO_FEW = <span className="hr-w-none">too few hours</span>;
const stat = (e: ErrStat | null, f: (e: ErrStat) => string) => (e ? f(e) : null);
function HowRightAllDetail({id, s, card, unit}: {id: string; s: Extract<HowRightAllSpot, {status: 'ok' | 'collecting'}>; card: HowRightAllCard; unit: 'ft' | 'm'}) {
  const b = s.buoy, ok = s.status === 'ok' ? s : null, sw = ok?.d7?.swell ?? ok?.d30?.swell ?? null, swDays = ok?.d7?.swell ? 7 : 30;
  return (
    <div id={id} className="hr-d">
      <dl className="hr-ws">
        <div><dt>Last 7 days</dt><dd>{ok ? win(ok.d7, card.rule.minDays7, s.haveDays, unit) : <span className="hr-w-none">{collectingText(s.haveDays, card.rule.minDays7)}</span>}</dd></div>
        <div><dt>Last 30 days</dt><dd>{ok ? win(ok.d30, card.rule.minDays30, s.haveDays, unit) : <span className="hr-w-none">{collectingText(s.haveDays, card.rule.minDays30)}</span>}</dd></div>
        {ok && sw && <div><dt>Buoy's swell</dt><dd>
          height: {stat(sw.height, (e) => `${TYPICAL_DIFF} ${diffText(e.typical / 0.3048, unit)}, ${leanOf(e.bias, unit)}`) ?? TOO_FEW}
          <span className="hr-w-n"> · last {swDays} days</span><br />
          period: {stat(sw.periodS, (e) => `${TYPICAL_DIFF} ${e.typical.toFixed(1)} s`) ?? TOO_FEW}; direction: {stat(sw.directionDeg, (e) => `${TYPICAL_DIFF} ${Math.round(e.typical)}° (the buoy reports 16 compass points)`) ?? TOO_FEW}
          <span className="hr-w-n"> · period and direction only for hours with swell above 0.5 m</span></dd></div>}
      </dl>
      <p className="hr-src">{TYPICAL_DIFF_NOTE}</p>
      <dl className="hr-what">
        <div><dt>What was compared</dt><dd>{comparedText(b, s.spotId)}. The forecast is Open-Meteo's marine model as our forecast stood at least {card.rule.shownMinLeadH} h ahead{b.gridKm !== null && b.gridKm !== undefined ? `, from its nearest model cell (${b.gridKm} km from the buoy)` : ''}; the buoy's side is its measured wave height{b.split ? " and NDBC's published swell split" : ' (this buoy publishes no swell split)'}.</dd></div>
        <div><dt>Why this buoy</dt><dd>The nearest buoy within {card.rule.maxKm} km that is not sheltered (not inside a bay, sound or harbour) and whose direction from the spot ({compassWord(b.bearing)}, {b.bearing}°) is inside this spot's swell window ({Math.round(b.window[0])}°–{Math.round(b.window[1])}°).{b.note ? ` ${b.note[0].toUpperCase()}${b.note.slice(1)}.` : ''} Not a measurement at the break.</dd></div>
        {ok && <div><dt>Rating</dt><dd>{ratingBasis(ok)}{ok.rating.d7 ? '' : ` ${ok.rating.daysScored7} of the last 7 days scored so far.`}</dd></div>}
      </dl>
      <p className="hr-src">Checked once a day · last {utcStamp(card.computedAt)} · {card.captureDays} {card.captureDays === 1 ? 'day' : 'days'} of captures kept{card.firstCapture ? `, since ${utcDay(card.firstCapture)} UTC` : ''}</p>
    </div>
  );
}
