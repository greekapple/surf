import {useMemo, useState, type CSSProperties} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {rateForecast} from '../../ratings/adapters';
import {ZONES, zoneOf} from '../../data/zones';
import {DirArrow, Icon} from '../../ui/Icon';
import {BAND_COLOR, bandOf, hourLabel, titleCase, type HourSample} from '../forecast/model';
import {bestDaylight, compass, ht, windVal} from '../forecast/helpers';
import {weekdayPT, dayNumPT} from '../forecast/format';

type Sort = 'rating' | 'height' | 'period' | 'wind' | 'north';
const SORTS: [Sort, string][] = [['rating', 'Best rated'], ['height', 'Biggest'], ['period', 'Longest period'], ['wind', 'Lightest wind'], ['north', 'North → south']];

/** Spots side by side at one shared hour: filter by zone, sort, step through time, open any spot. */
export function CompareSpots({go}: {go: ViewProps['go']}) {
  const {view, data, spotOptions, setSpot, now} = useSwello();
  const p = data.state.profile, t = view.selectedTime, times = view.timeline;
  const [zone, setZone] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('rating');
  const rows = useMemo(() => spotOptions.filter((s) => zone === 'All' || zoneOf(s.region) === zone).map((s, order) => {
    const recs = view.mapRecords.filter((r) => r.spotId === s.id);
    const f = recs.find((r) => r.timestamp === t) ?? null;
    const rating = f ? rateForecast(s, f, now) : null;
    const series = recs.map((r) => ({forecast: r, timestamp: r.timestamp, date: '', hour: 0, heightFt: r.offshore, rating: rateForecast(s, r, now)})) as HourSample[];
    const start = Math.floor(now / 3600000) * 3600000, best = bestDaylight(series, s, start, start + 86400000);
    return {s, f, rating, best, order};
  }), [spotOptions, zone, view.mapRecords, t, now]);
  const key = (r: (typeof rows)[number]) => sort === 'rating' ? -(r.rating?.score ?? -1) : sort === 'height' ? -(r.f?.offshore ?? -1) : sort === 'period' ? -(r.f?.primary?.period ?? -1) : sort === 'wind' ? (r.f?.wind.speed ?? 99) : r.order;
  const sorted = [...rows].sort((a, b) => key(a) - key(b));
  const i = times.indexOf(t ?? ''), step = (d: number) => { const n = times[Math.max(0, Math.min(times.length - 1, i + d))]; if (n) view.selectTime(n); };
  const open = (id: string, where: 'forecast' | 'explore') => { setSpot(id); go(where); };
  return (
    <div className="cmpx">
      <header className="cmpx-h">
        <div><h1>Compare spots</h1><p>{sorted.length} spots · provisional ratings · offshore model height, not surf height</p></div>
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
      <ol className="cmpx-list">{sorted.map(({s, f, rating, best}, k) => (
        <li key={s.id} className={k === 0 && sort !== 'north' ? 'top' : ''}>
          <span className="cx-rank">{k + 1}</span>
          <span className="cx-name"><b>{s.name}</b><small>{s.region}</small></span>
          <span className="cx-rate">{rating ? <em style={{'--c': BAND_COLOR[bandOf(rating.category)]} as CSSProperties}>{titleCase(rating.category)}</em> : <small>no record</small>}</span>
          <span className="cx-hs">{f ? <>{ht(f.offshore, p)}<small> {p.heightUnit}</small></> : '—'}</span>
          <span className="cx-sw">{f?.primary ? <><DirArrow from={f.primary.direction} size={13} /> {Math.round(f.primary.period)} s {compass(f.primary.direction)}</> : '—'}</span>
          <span className="cx-wd">{f && Number.isFinite(f.wind.direction) ? <><DirArrow from={f.wind.direction} size={13} /> {windVal(f.wind.speed, p)} {p.windUnit}</> : '—'}</span>
          <span className="cx-best">{best ? `Best ${weekdayPT(best.timestamp)} ${hourLabel(best.timestamp)}` : ''}</span>
          <span className="cx-act"><button className="btn" onClick={() => open(s.id, 'forecast')}>Forecast</button><button className="btn" aria-label={`${s.name} on the map`} onClick={() => open(s.id, 'explore')}><Icon name="explore" size={16} /></button></span>
        </li>
      ))}</ol>
    </div>
  );
}
