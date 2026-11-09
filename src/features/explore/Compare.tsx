import {conditionWord} from '../../ui/Condition';
import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {isDark} from '../forecast/trustApi';
import {nextMorningHour} from '../../services/homeDash';
import {hourFreshness} from '../../services/freshness';
import {StaleTag} from '../../ui/StaleTag';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {rateForecast} from '../../ratings/adapters';
import {ZONES, zoneOf} from '../../data/zones';
import {DirArrow, Icon} from '../../ui/Icon';
import {BAND_COLOR, bandOf, hourLabel, type HourSample} from '../forecast/model';
import {compass, ht, windVal} from '../forecast/helpers';
import {bestWindowFrom} from '../../services/call';
import {headlineSurf} from '../../services/headlineSurf';
import {estimateLabel} from '../../services/headlineLabel';
import {weekdayPT, dayNumPT} from '../forecast/format';

type Sort = 'rating' | 'height' | 'period' | 'wind' | 'north';
/** T-109: the desktop column header. "Height" because each row names its own kind (surf estimate, or offshore height; T-108). */
const HEAD = ['', 'Spot', 'Rating', 'Height', 'Swell', 'Wind', 'Best'];
const SORTS: [Sort, string][] = [['rating', 'Best rated'], ['height', 'Biggest'], ['period', 'Longest period'], ['wind', 'Lightest wind'], ['north', 'North → south']];

/** Spots side by side at one shared hour: filter by zone, sort, step through time, open any spot. */
export function CompareSpots({go}: {go: ViewProps['go']}) {
  const {view, data, spotOptions, setSpot, now} = useSwello();
  const p = data.state.profile, t = view.selectedTime, times = view.timeline;
  const [zone, setZone] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('rating');
  // T-099: at night Compare opens on the next morning's first daylight hour (dark hours are rated but are never a surf window) (the same next-morning rule as Home); the stepper stays free.
  // The data may arrive after this mounts (a direct or refreshed /explore/compare): decide once, as soon as there is an hour to judge, and never again, so a later pick is never overridden (T-100).
  const decided = useRef(false);
  useEffect(() => {
    if (decided.current || !t) return;
    decided.current = true;
    if (!isDark(view.selected, t)) return;
    const m = nextMorningHour(times, now, (iso) => isDark(view.selected, iso)); if (m) view.selectTime(m);
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps -- first available hour only
  const rows = useMemo(() => spotOptions.filter((s) => zone === 'All' || zoneOf(s.region) === zone).map((s, order) => {
    const recs = view.mapRecords.filter((r) => r.spotId === s.id);
    const f = recs.find((r) => r.timestamp === t) ?? null;
    const rating = f ? rateForecast(s, f, now) : null;
    // T-108: ONE best-window function (the call's), and the same surf estimate every other surface shows (headlineSurf); offshore only where no estimate exists, tagged as such.
    const bundle = view.ocean.bundle, best = bestWindowFrom(s, p, {records: recs, bundle, nowMs: now}, now);
    const head = f ? headlineSurf(s.id, f, {bundle, nowMs: now}) : null, est = head ? estimateLabel(head, p) : null;
    return {s, f, rating, best, order, head, est};
  }), [spotOptions, zone, view.mapRecords, view.ocean.bundle, p, t, now]);
  const key = (r: (typeof rows)[number]) => sort === 'rating' ? -(r.rating?.score ?? -1) : sort === 'height' ? -(r.head?.kind === 'estimate' ? (r.head.loFt + r.head.hiFt) / 2 : r.f?.offshore ?? -1) : sort === 'period' ? -(r.f?.primary?.period ?? -1) : sort === 'wind' ? (r.f?.wind.speed ?? 99) : r.order;
  const sorted = [...rows].sort((a, b) => key(a) - key(b));
  const i = times.indexOf(t ?? ''), step = (d: number) => { const n = times[Math.max(0, Math.min(times.length - 1, i + d))]; if (n) view.selectTime(n); };
  // T-109: the whole row opens the spot's forecast (the 45 Forecast and map buttons are gone); a modified click keeps the browser's own behaviour.
  const open = (id: string) => (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); setSpot(id); go('forecast'); };
  return (
    <div className="cmpx">
      <header className="cmpx-h">
        <div><h1>Compare spots</h1><p>{sorted.length} spots · provisional ratings · surf estimate where one exists, otherwise labelled offshore height (not surf size)</p></div>
        <div className="cmpx-time" role="group" aria-label="Shared hour">
          <button className="iconbtn" aria-label="3 hours earlier" onClick={() => step(-3)}><Icon name="chevron" size={18} style={{transform: 'rotate(90deg)'}} /></button>
          <b>{t ? `${weekdayPT(t)} ${dayNumPT(t)} · ${hourLabel(t)}` : '—'}</b>
          <button className="iconbtn" aria-label="3 hours later" onClick={() => step(3)}><Icon name="chevron" size={18} style={{transform: 'rotate(-90deg)'}} /></button>
        </div>
      </header>
      <div className="cmpx-bar">
        <div className="cmpx-chips" role="group" aria-label="Zone">{['All', ...ZONES.map(([z]) => z)].map((z) => <button key={z} aria-pressed={zone === z} onClick={() => setZone(z)}>{z}</button>)}</div>
        <label className="cmpx-sort">Sort<select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="cmpx-head" aria-hidden="true">{HEAD.map((h, i) => <span key={i}>{h}</span>)}</div>
      <ol className="cmpx-list">{sorted.map(({s, f, rating, best, est}, k) => (
        <li key={s.id} className={k === 0 && sort !== 'north' ? 'top' : ''}><a className="cx-a" href={`/forecast?spot=${s.id}`} onClick={open(s.id)}>
          <span className="cx-rank">{k + 1}</span>
          <span className="cx-name"><b>{s.name}</b><small>{s.region}</small></span>
          <span className="cx-rate">{rating ? <><em style={{'--c': BAND_COLOR[bandOf(rating.category)]} as CSSProperties}>{conditionWord(rating.category)}</em>{rating.dark && <small> after dark</small>}</> : <small>no record</small>}</span>
          <span className="cx-hs">{f && est ? <span title={`${est.tag} · ${est.detail}`}>{est.value}<small> {est.suffix}{est.tuned ? ` · ${est.tuned}` : ''}{est.confidenceText ? ` · ${est.confidenceText}` : ''}</small><span className="sr-only">: {est.tag}. {est.confidenceText}. {est.detail}</span></span> : f ? <>{ht(f.offshore, p)}<small> {p.heightUnit} offshore</small></> : '—'}</span>
          <span className="cx-sw">{f?.primary ? <><DirArrow from={f.primary.direction} size={13} /> {Math.round(f.primary.period)} s {compass(f.primary.direction)}</> : '—'}</span>
          <span className="cx-wd">{f && Number.isFinite(f.wind.direction) ? <><DirArrow from={f.wind.direction} size={13} /> {windVal(f.wind.speed, p)} {p.windUnit}<StaleTag s={hourFreshness(f, now).wind} /></> : '—'}</span>
          <span className="cx-best">{best ? `Best ${best.when} ${best.label}` : ''}</span>
        </a></li>
      ))}</ol>
    </div>
  );
}
