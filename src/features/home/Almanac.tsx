import type {SurfSpot, UserProfile} from '../../models/index';
import type {TidePrediction} from '../../ocean/types';
import {bestDaylight, compass, ht, spotLatLon, sunTimes, windVal} from '../forecast/helpers';
import {hourLabel, titleCase, type HourSample} from '../forecast/model';
import {localHour} from '../forecast/format';
import {timeLabelPT, weekdayPT} from '../forecast/format';

/** Suggested wetsuit for Northern California water (a rule of thumb, labelled as such). */
export function wetsuit(f: number) {
  return f < 52 ? '5/4 + hood and booties' : f < 56 ? '5/4 or 4/3 + booties' : f < 60 ? '4/3' : f < 64 ? '4/3 or 3/2' : f < 70 ? '3/2' : 'spring suit';
}

export interface DayFacts {
  label: 'Today' | 'Tomorrow';
  best: HourSample | null;
  tides: TidePrediction[];
  rise: number; set: number;
  water: number | null;
  windAm: number | null; windPm: number | null; dirAm: number | null; dirPm: number | null;
}

/** Facts for the rest of today, or tomorrow once today's light is gone. Uses only data already loaded. */
export function dayFacts(series: HourSample[], spot: SurfSpot, extrema: TidePrediction[], now: number): DayFacts | null {
  if (!series.length) return null;
  const [lat, lon] = spotLatLon(spot);
  const today = sunTimes(new Date(now).toISOString(), lat, lon);
  const tomorrow = now > today.set - 3600000;
  const ref = tomorrow ? now + 86400000 : now;
  const {rise, set} = tomorrow ? sunTimes(new Date(ref).toISOString(), lat, lon) : today;
  const dayStart = tomorrow ? rise - 3 * 3600000 : now, dayEnd = set + 3600000;
  const hours = series.filter((h) => { const t = Date.parse(h.timestamp); return t >= dayStart - 3600000 && t <= dayEnd; });
  const avg = (hs: HourSample[], k: 'speed' | 'direction') => { const v = hs.map((h) => h.forecast.wind[k]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const am = hours.filter((h) => { const x = localHour(h.timestamp); return x >= 6 && x <= 10; });
  const pm = hours.filter((h) => { const x = localHour(h.timestamp); return x >= 13 && x <= 17; });
  const water = hours.find((h) => Number.isFinite(h.forecast.waterTempF ?? NaN))?.forecast.waterTempF ?? null;
  return {
    label: tomorrow ? 'Tomorrow' : 'Today',
    best: bestDaylight(series, spot, Math.max(now - 1800000, rise - 1800000), set + 1),
    tides: extrema.filter((e) => { const t = Date.parse(e.timestamp); return t >= Math.max(now, dayStart) && t <= dayEnd && e.height.value !== null; }).slice(0, 3),
    rise, set, water,
    windAm: avg(am, 'speed'), windPm: avg(pm, 'speed'), dirAm: avg(am, 'direction'), dirPm: avg(pm, 'direction'),
  };
}

/** One scannable line of what a dawn check needs: when, tide, light, wind shift, water. */
export function Almanac({facts, p, onBest}: {facts: DayFacts; p: UserProfile; onBest: (t: string) => void}) {
  const {best, tides, rise, set, water, windAm, windPm, dirAm, dirPm, label} = facts;
  const nowMs = Date.now();
  return (
    <dl className="almanac" aria-label={`${label} at a glance`}>
      <div className="best">
        <dt>Best window {label.toLowerCase()}</dt>
        <dd>{best ? <button onClick={() => onBest(best.timestamp)}>{hourLabel(best.timestamp)} · {titleCase(best.rating.category)}<small>{ht(best.heightFt, p)} {p.heightUnit} · provisional</small></button> : <span>No rated daylight hour</span>}</dd>
      </div>
      <div>
        <dt>Tide <span>regional</span></dt>
        <dd>{tides.length ? tides.map((t) => <span key={t.timestamp}>{t.type} {timeLabelPT(t.timestamp)}<small>{ht(t.height.value, p)} {p.heightUnit}</small></span>) : <span>No predictions loaded</span>}</dd>
      </div>
      <div>
        <dt>Light</dt>
        <dd><span>{rise > nowMs ? 'Sunrise' : 'Rose'} {timeLabelPT(new Date(rise).toISOString())}</span><span>Sunset {timeLabelPT(new Date(set).toISOString())}</span></dd>
      </div>
      <div>
        <dt>Wind</dt>
        <dd>{windAm !== null || windPm !== null ? <>
          {windAm !== null && <span>Morning {windVal(windAm, p)} {p.windUnit}{dirAm !== null ? ` ${compass(dirAm)}` : ''}</span>}
          {windPm !== null && <span>Afternoon {windVal(windPm, p)} {p.windUnit}{dirPm !== null ? ` ${compass(dirPm)}` : ''}</span>}
        </> : <span>Unavailable</span>}</dd>
      </div>
      <div>
        <dt>Water</dt>
        <dd>{water !== null ? <><span>{water.toFixed(0)}°F · {((water - 32) / 1.8).toFixed(0)}°C</span><span><small>{wetsuit(water)} suggested</small></span></> : <span>Unavailable</span>}</dd>
      </div>
      <p className="almanac-note">{label} · {weekdayPT(new Date(label === 'Today' ? nowMs : nowMs + 86400000).toISOString())} · sunrise and sunset approximate · wetsuit is a rule of thumb</p>
    </dl>
  );
}
