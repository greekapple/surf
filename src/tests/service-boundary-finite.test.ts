import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOpenMeteo, marineFields} from '../ocean/openMeteo.ts';
import {normalizeBuoy, normalizeTides, normalizeTideExtrema, normalizeWaterLevel} from '../ocean/noaa.ts';
import {normalizeNearshore} from '../ocean/nearshore.ts';
import {normalizeCdipBuoy} from '../ocean/buoys.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import type {OceanRecord} from '../ocean/types.ts';

// prod-nan: a non-finite number (NaN, Infinity) never leaves a normaliser: a missing or unreadable provider value is null (with a reason), so nothing downstream can draw or add up a NaN.
// (The legacy Forecast type that the charts read keeps NaN on purpose for "not available", set in ocean/bridge.ts only, next to the availability flags.)
const nonFinite = (v: unknown, path = '$', out: string[] = []): string[] => {
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(path); }
  else if (Array.isArray(v)) v.forEach((x, i) => nonFinite(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) nonFinite(x, `${path}.${k}`, out);
  return out;
};
const T0 = Date.UTC(2026, 10, 14, 2, 0) / 1000, hours = Array.from({length: 24}, (_, i) => T0 + i * 3600);
const ob = evidenceSpot('spot-2');
// hostile columns: nulls, strings, NaN-like strings, Infinity (1e999 parses to Infinity), negative, huge, arrays shorter than time
const hostile = (i: number) => [null, 'NaN', '', 'x', Infinity, -Infinity, NaN, -5, 1e308, undefined][i % 10];
const hourlyOf = (fields: string[], short = false) => ({time: hours, ...Object.fromEntries(fields.map((f, k) => [f, (short ? hours.slice(0, 7) : hours).map((_, i) => ((i + k) % 3 === 0 ? hostile(i + k) : 2.5 + i / 10))]))});

test('prod-nan: Open-Meteo marine and weather with null, string, Infinity, NaN and short columns give records with no non-finite number', () => {
  const marine = {latitude: 37.75, longitude: -122.6, hourly: hourlyOf([...marineFields]), hourly_units: Object.fromEntries(marineFields.map((f) => [f, f.includes('direction') ? '°' : f.includes('period') ? 's' : f === 'sea_surface_temperature' ? '°C' : 'm']))};
  const weather = {latitude: 37.76, longitude: -122.51, hourly: hourlyOf(['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m']), hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}};
  for (const [m, w] of [[marine, weather], [{...marine, hourly: hourlyOf([...marineFields], true)}, weather], [marine, {...weather, hourly: hourlyOf(['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'], true)}], [marine, null], [null, weather]] as const) {
    const recs = normalizeOpenMeteo(ob, m as any, w as any, '2026-11-14T02:30:00.000Z');
    assert.ok(recs.length > 0);
    assert.deepEqual(nonFinite(recs).slice(0, 5), [], 'no NaN or Infinity anywhere in the normalised records');
  }
});
test('prod-nan: an hour with a missing swell height or gust is null in the record and NaN only in the legacy bridge, flagged not available', () => {
  const marine = {latitude: 37.75, longitude: -122.6, hourly: {time: [T0], wave_height: [2], swell_wave_height: [null], swell_wave_direction: [270], swell_wave_period: [12], secondary_swell_wave_height: [null], secondary_swell_wave_direction: [null], secondary_swell_wave_period: [null], sea_surface_temperature: [14]}, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'}};
  const weather = {latitude: 37.76, longitude: -122.51, hourly: {time: [T0], wind_speed_10m: [8], wind_direction_10m: [300], wind_gusts_10m: [null]}, hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}};
  const [rec] = normalizeOpenMeteo(ob, marine as any, weather as any, '2026-11-14T02:30:00.000Z') as OceanRecord[];
  assert.equal(rec.primary.height.value, null); assert.ok(rec.primary.height.reason); assert.equal(rec.gusts.value, null);
  assert.deepEqual(nonFinite(rec), []);
  const legacy = toLegacy(rec); assert.ok(Number.isNaN(legacy.primary.height), 'the legacy bridge is the one place a missing value becomes NaN'); assert.equal(legacy.availability.swell === false || legacy.availability.swell === true, true);
});
test('prod-nan: NDBC buoy text with MM, NaN, Infinity and garbage columns gives no non-finite value', () => {
  const header = '#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE';
  const row = (mm: number, c: string[]) => `2026 11 14 02 ${String(mm).padStart(2, '0')} ${c.join(' ')}`;
  const text = [header, '#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft',
    row(50, ['MM', 'NaN', 'Infinity', '1e999', '-Infinity', 'x', '280', 'MM', 'MM', 'NaN', 'MM', 'MM', 'MM']), row(20, ['300', '5.1', '7.2', '1.8', '14', '8.1', '282', '1015', '14.2', '15.1', 'MM', 'MM', 'MM'])].join('\n');
  const set = normalizeBuoy(text, '2026-11-14T02:55:00.000Z'); assert.deepEqual(nonFinite(set), []);
});
test('prod-nan: NOAA tide and water-level payloads with blank, NaN and Infinity values are skipped, never carried', () => {
  const pred = {predictions: [{t: '2026-11-14 02:00', v: ''}, {t: '2026-11-14 03:00', v: 'NaN'}, {t: '2026-11-14 04:00', v: 'Infinity'}, {t: '2026-11-14 05:00', v: '1.25'}, {t: 'bad', v: '2'}]};
  const m = normalizeTides(pred, '2026-11-14T02:30:00.000Z', 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9414290'); assert.equal(m.size, 1); assert.deepEqual(nonFinite([...m.values()]), []);
  assert.deepEqual(nonFinite(normalizeTideExtrema({predictions: [{t: '2026-11-14 02:00', v: 'NaN', type: 'H'}, {t: '2026-11-14 08:00', v: '5.1', type: 'H'}]}, '2026-11-14T02:30:00.000Z', 'u')), []);
  assert.equal(normalizeWaterLevel({data: [{t: '2026-11-14 02:00', v: 'NaN', q: 'p'}, {t: '2026-11-14 02:06', v: '', q: 'p'}]}, '2026-11-14T02:30:00.000Z', 'u'), null);
});
test('prod-nan: CDIP MOP text with NaN, fill values and missing columns gives no non-finite number', () => {
  const csv = ['time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],waveHs[unit="meter"],waveTp[unit="second"],waveDp[unit="degreeT"],waveFlagPrimary',
    '2026-11-14T03:00:00Z,SF023,37.76,-122.52,NaN,14,270,1', '2026-11-14T04:00:00Z,SF023,37.76,-122.52,1.9,NaN,270,1', '2026-11-14T05:00:00Z,SF023,37.76,-122.52,2.1,13,NaN,1', '2026-11-14T06:00:00Z,SF023,37.76,-122.52,2.2,13,271,1'].join('\n');
  const recs = normalizeNearshore(csv, '2026-11-14T02:30:00.000Z', 'u', 'forecast'); assert.deepEqual(nonFinite(recs), []);
});
