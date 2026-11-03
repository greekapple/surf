import test from 'node:test';
import assert from 'node:assert/strict';
import {dayRange} from '../services/spotHour.ts';
import {weekCell, dayText} from '../services/weekCell.ts';
import {bestNearbyAt} from '../services/homeDash.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {pacificDate} from '../ocean/time.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';

// T-107. Ocean Beach (spot-2) fixture: hourly swell that swings from 0.4 m to 4 m through the day, retrieved 10 minutes after the first hour.
const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const t = 1792454400, now = t * 1000 + 600000;
const times = Array.from({length: 30}, (_, i) => t - 3600 + i * 3600);
const base = (swell: (i: number) => number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'},
  hourly: {time: times, wave_height: times.map((_, i) => swell(i) * 1.1), swell_wave_height: times.map((_, i) => swell(i)), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 270), secondary_swell_wave_period: times.map(() => 10)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 8)}};
const recs = (swell: (i: number) => number) => normalizeOpenMeteo(evidenceSpot('spot-2'), base(swell) as any, weather as any, new Date(now).toISOString()).map(toLegacy);
const spot = allSpots.find((s) => s.id === 'spot-2')!, key = pacificDate(new Date(t * 1000).toISOString());


test('T-112: one spot-day, one range text: the week grid cell and the spot page day card read the same value, in the person\'s unit and scale', () => {
  const records = recs((i) => 0.4 + (i % 9) * 0.45);
  for (const [name, p] of [['ft', profile], ['m', {...profile, heightUnit: 'm' as const}], ['Hawaiian', {...profile, scale: 'Hawaiian' as const}]] as const) {
    const dr = dayRange(spot, records, key, now, p), ty = dr.typical!, wc = weekCell(dr, p.heightUnit), dt = dayText(ty)!;
    assert.equal(dt.full, ty.hour.surf.value, `${name}: the day text IS the midday hour's headline value`);
    assert.equal(wc.label, dt.numbers, `${name}: the week cell shows those numbers`);
    assert.ok(!/ft|m$/.test(dt.numbers), `${name}: numbers only`);
    if (name === 'm') assert.match(dt.full, / m$/); if (name === 'Hawaiian') assert.match(dt.full, /Hawaiian/);
    assert.ok(wc.spread === null || !/\d ft over daylight/.test(wc.spread) || name !== 'm', `${name}: the spread is in the same unit`);
  }
  // metric really converts (it used to print raw feet next to "m")
  const rft = dayRange(spot, records, key, now, profile).typical!.hour.surf.value, rm = dayRange(spot, records, key, now, {...profile, heightUnit: 'm' as const}).typical!.hour.surf.value;
  assert.notEqual(rft.replace(/ ft$/, ''), rm.replace(/ m$/, ''));
});
