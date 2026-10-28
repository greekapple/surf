// Presentation model for the Forecast verdict board. It only reshapes what the
// existing data, rating and unit modules return; it never estimates new values.
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {Measurement} from '../../ocean/types';
import type {SurfRating} from '../../ratings/types';
import {rateForecast} from '../../ratings/adapters';
import {windRelationship} from '../../recommendation/sqi';
import {formatWaveHeight} from '../../utils/waveHeight';
import {compass, heightValue, wind} from '../../utils/units';
import {ageLabel, pacificDate, pacificHour} from '../../ocean/time';

export type DataMode = 'Retrieved' | 'Demonstration';

export interface HeroHeight {
  approx: boolean;
  number: string;
  unit: string;
  label: string;
  note: string | null;
}

export function heroHeight(f: Forecast, p: UserProfile, mode: DataMode): HeroHeight {
  const hasFace = f.availability.face && Number.isFinite(f.face);
  const formatted = hasFace
    ? formatWaveHeight({kind: mode === 'Demonstration' ? 'demonstration' : 'breaking-estimate', valueFt: f.face}, p)
    : formatWaveHeight({kind: 'offshore', valueFt: Number.isFinite(f.offshore) ? f.offshore : null}, p);
  const match = formatted.text.match(/^(≈ |<)?([\d.–]+)\s(.+)$/);
  return {
    approx: !!match?.[1],
    number: match ? match[2] : '—',
    unit: match ? match[3] : '',
    label: formatted.label,
    note: hasFace
      ? null
      : 'Surf-face estimate unavailable: no calibrated breaking-wave method for this break. Offshore height is not surf size.',
  };
}

export interface Provenance {
  text: string;
  kind: 'model' | 'observed' | 'demo';
}

export function provenance(m: Measurement | undefined, mode: DataMode, now: number): Provenance {
  if (mode === 'Demonstration' || !m) return {text: 'Demonstration data · not live', kind: 'demo'};
  const s = m.source;
  const kind = s.kind === 'observation' ? 'observed' : 'model';
  return {text: `${s.provider} · ${kind} · ${ageLabel(s.retrievedAt, now)}`, kind};
}

export interface Reason {
  id: 'swell' | 'wind' | 'tide';
  label: string;
  value: string;
  detail: string;
  direction: number | null;
  provenance: Provenance;
  available: boolean;
}

export function reasons(spot: SurfSpot, f: Forecast, p: UserProfile, mode: DataMode, now: number): Reason[] {
  const e = f.evidence;
  const heightText = (ft: number) => `${heightValue(ft, p, false).toFixed(1)} ${p.heightUnit}`;
  const swellOk = f.availability.swell && Number.isFinite(f.primary.height);
  const windOk = f.availability.wind && Number.isFinite(f.wind.speed);
  const tideOk = f.availability.tide && Number.isFinite(f.tide.height);
  const relation = windOk ? windRelationship(spot, f) : 'Unknown';
  return [
    {
      id: 'swell',
      label: 'Swell',
      available: swellOk,
      value: swellOk ? `${heightText(f.primary.height)} · ${Math.round(f.primary.period)} s` : 'Unavailable',
      detail: swellOk ? `from ${compass(f.primary.direction)} ${Math.round(f.primary.direction)}°` : 'No primary swell record',
      direction: swellOk ? f.primary.direction : null,
      provenance: provenance(e?.primary.height, mode, now),
    },
    {
      id: 'wind',
      label: 'Wind',
      available: windOk,
      value: windOk ? wind(f.wind.speed, p) : 'Unavailable',
      detail: windOk
        ? `from ${compass(f.wind.direction)}${relation !== 'Unknown' ? ` · ${relation.toLowerCase()}` : ''}`
        : 'No wind record',
      direction: windOk ? f.wind.direction : null,
      provenance: provenance(e?.windSpeed, mode, now),
    },
    {
      id: 'tide',
      label: 'Tide',
      available: tideOk,
      value: tideOk ? heightText(f.tide.height) : 'Unavailable',
      detail: tideOk
        ? `${(f.tide.trend ?? f.tide.stage ?? '').toString().toLowerCase() || 'trend unknown'}${mode === 'Retrieved' ? ' · MLLW, SF station' : ''}`
        : 'No tide record',
      direction: null,
      provenance: provenance(e?.tide, mode, now),
    },
  ];
}

export type SignalStrength = 'full' | 'reduced' | 'weak' | 'none';

export function signalStrength(r: SurfRating): SignalStrength {
  if (r.score === null || r.category === 'UNRATED') return 'none';
  if (r.reliability.category === 'HIGH') return 'full';
  if (r.reliability.category === 'MODERATE') return 'reduced';
  if (r.reliability.category === 'LIMITED') return 'weak';
  return 'none';
}

export interface HourSample {
  forecast: Forecast;
  timestamp: string;
  date: string;
  hour: number;
  heightFt: number | null;
  rating: SurfRating;
}

export function hourlySeries(spot: SurfSpot, records: Forecast[], now: number): HourSample[] {
  return records
    .filter(f => f.spotId === spot.id && Number.isFinite(Date.parse(f.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map(f => {
      const face = f.availability.face && Number.isFinite(f.face) ? f.face : null;
      const offshore = Number.isFinite(f.offshore) ? f.offshore : null;
      return {
        forecast: f,
        timestamp: f.timestamp,
        date: pacificDate(f.timestamp),
        hour: pacificHour(f.timestamp),
        heightFt: face ?? offshore,
        rating: rateForecast(spot, f, now),
      };
    });
}

/** Highest-scoring hour in the next 24 h, using the existing provisional rating. */
export function bestUpcoming(series: HourSample[], now: number): HourSample | null {
  const start = Math.floor(now / 3600000) * 3600000;
  const end = start + 24 * 3600000;
  let best: HourSample | null = null;
  for (const s of series) {
    const t = Date.parse(s.timestamp);
    if (t < start || t > end || s.rating.score === null) continue;
    if (!best || s.rating.score > (best.rating.score ?? -1)) best = s;
  }
  return best;
}

export function hourLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric'}).format(new Date(iso));
}

export function dayLabel(iso: string, now: number) {
  const date = pacificDate(iso);
  if (date === pacificDate(new Date(now).toISOString())) return 'Today';
  if (date === pacificDate(new Date(now + 86400000).toISOString())) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short', day: 'numeric'}).format(
    new Date(iso),
  );
}

export function fullTimeLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}
