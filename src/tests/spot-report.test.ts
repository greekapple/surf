import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spotReport} from '../services/spotReport.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';
import type {TidePrediction} from '../ocean/types.ts';
const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const spot = allSpots.find((s) => s.id === 'spot-2')!;
const H = 3600;
interface Opt {from: string; count: number; dir?: number; hs?: number; secondary?: boolean; tide?: boolean; skip?: (i: number) => boolean}
/** Hourly Open-Meteo style records for Ocean Beach, optionally with a synthetic 12-hour tide. */
function recs({from, count, dir = 270, hs = 1.5, secondary = true, tide = true, skip = () => false}: Opt) {
  const t0 = Date.parse(from) / 1000, idx = Array.from({length: count}, (_, i) => i).filter((i) => !skip(i)), col = <T,>(f: (i: number) => T) => idx.map(f);
  const marine = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
    hourly: {time: col((i) => t0 + i * H), wave_height: col(() => hs * 1.05), swell_wave_height: col(() => hs), swell_wave_direction: col(() => dir), swell_wave_period: col(() => 14),
      secondary_swell_wave_height: col(() => (secondary ? 0.6 : null)), secondary_swell_wave_direction: col(() => (secondary ? 200 : null)), secondary_swell_wave_period: col(() => (secondary ? 9 : null)), sea_surface_temperature: col(() => 15)}};
  const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: marine.hourly.time, wind_speed_10m: col(() => 8), wind_direction_10m: col(() => 90), wind_gusts_10m: col(() => 14)}};
  return normalizeOpenMeteo(evidenceSpot('spot-2'), marine, weather, from).map(toLegacy).map((f, k) => {
    const i = idx[k], h = 4 + 3 * Math.sin((2 * Math.PI * i) / 12);
    return tide ? {...f, tide: {height: h, stage: Math.cos((2 * Math.PI * i) / 12) >= 0 ? 'Rising' as const : 'Falling' as const, trend: Math.cos((2 * Math.PI * i) / 12) >= 0 ? 'Rising' as const : 'Falling' as const}} : f;
  });
}
const NOW = Date.parse('2026-10-29T20:00:00Z'); // 1 PM PDT, Oct 29
const FROM = '2026-10-29T00:00:00Z';

test('full data: every section is present and labelled', () => {
  const r = spotReport(spot, recs({from: FROM, count: 24 * 7}), NOW, profile);
  assert.equal(r.name, 'Ocean Beach'); assert.equal(r.validTime, '2026-10-29T20:00:00.000Z');
  assert.equal(r.headline.heightKind, 'estimate'); assert.match(r.headline.heightLabel, /^Est\. \d+–\d+ ft$/); assert.ok(r.headline.category.length > 0);
  assert.match(r.headline.wind!.label, /^8\.0 mph E$/); assert.match(r.headline.wind!.word, /^Gentle E$/); assert.equal(r.headline.wind!.relation, 'offshore'); assert.match(r.headline.wind!.gustLabel!, /^gusts 14\.0 mph$/);
  assert.ok(['rising', 'falling'].includes(r.headline.tide!.state)); assert.match(r.headline.tide!.note, /San Francisco/);
  assert.equal(r.days.length, 7); assert.deepEqual(r.days.map((d) => d.date), ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.equal(r.days[1].am.hours, 6); assert.equal(r.days[1].pm.hours, 6); assert.match(r.days[1].am.basis, /median of 6 hours/); assert.ok(r.days[1].am.category);
  assert.match(r.days[1].heightRange!, /^Est\. \d+–\d+ ft$/); assert.equal(r.days[1].primarySwell!.label, 'Primary');
  assert.equal(r.swells.length, 2); assert.deepEqual(r.swells.map((s) => s.label), ['Primary', 'Secondary']);
  assert.equal(r.swells[0].dirWord, 'W'); assert.equal(r.swells[0].periodS, 14); assert.match(r.swells[0].heightLabel, /ft$/); assert.match(r.waterTemp!, /°F sea surface \(model\)/);
  assert.ok(r.light.firstLight.iso < r.light.sunrise.iso && r.light.sunrise.iso < r.light.sunset.iso && r.light.sunset.iso < r.light.lastLight.iso);
  assert.match(r.light.sunrise.localTime, /^[5-8]:\d\d AM$/); assert.match(r.light.sunset.localTime, /^[4-7]:\d\d PM$/); assert.match(r.light.note, /Approximate/);
});

test('missing secondary swell: only the supplied components are listed, and never a wind sea', () => {
  const r = spotReport(spot, recs({from: FROM, count: 48, secondary: false}), NOW, profile);
  assert.deepEqual(r.swells.map((s) => s.label), ['Primary']);
  assert.ok(!r.swells.some((s) => s.label === 'Wind sea'));
});

test('a day with no hours is null, not filled in', () => {
  const r = spotReport(spot, recs({from: FROM, count: 72}), NOW, profile); // data ends 4 PM PDT on Oct 31
  const d = r.days[3];
  assert.equal(d.am.category, null); assert.equal(d.pm.category, null); assert.equal(d.am.hours, 0); assert.equal(d.am.basis, 'no forecast hours');
  assert.equal(d.heightRange, null); assert.equal(d.heightKind, 'none'); assert.equal(d.primarySwell, null);
  assert.equal(r.days[1].pm.hours, 6); assert.ok(r.days[2].am.category); assert.ok(r.days[2].pm.hours < 6); // the last day is partial and says how many hours it has
});

test('a half-day from one hour says so', () => {
  const r = spotReport(spot, recs({from: FROM, count: 24 * 3, skip: (i) => { const h = (i + 17) % 24; return !(Math.floor(i / 24) === 1 && (h === 8 || h >= 12 && h <= 17)) && Math.floor(i / 24) === 1; }}), NOW, profile);
  const d = r.days.find((x) => x.date === '2026-10-30')!;
  assert.equal(d.am.hours, 1); assert.match(d.am.basis, /single hour/); assert.match(d.am.basis, /not a half-day summary/);
});

test('DST fall-back: the 25-hour day is grouped by Pacific date and AM/PM keep six hours each', () => {
  const now = Date.parse('2026-10-31T20:00:00Z');
  const r = spotReport(spot, recs({from: '2026-10-31T07:00:00Z', count: 24 * 6 + 1}), now, profile);
  assert.equal(new Set(r.days.map((d) => d.date)).size, 7); assert.deepEqual(r.days.map((d) => d.date).slice(0, 3), ['2026-10-31', '2026-11-01', '2026-11-02']);
  const fall = r.days[1];
  assert.equal(fall.am.hours, 6); assert.equal(fall.pm.hours, 6); // 6 AM-11 AM and 12 PM-5 PM each have six distinct hours
  assert.equal(r.days[0].date, '2026-10-31'); assert.match(r.light.sunrise.localTime, /AM$/);
  // sunrise is a clock time in local time on either side of the change
  const after = spotReport(spot, recs({from: '2026-10-31T07:00:00Z', count: 24 * 6}), Date.parse('2026-11-02T20:00:00Z'), profile);
  assert.ok(Date.parse(after.light.sunrise.iso) > Date.parse(r.light.sunrise.iso));
  assert.equal(Number(after.light.sunrise.localTime.split(':')[0]) - Number(r.light.sunrise.localTime.split(':')[0]), -1); // the clock moved back an hour on Nov 1
});

test('estimate refused gives labelled offshore heights everywhere; present gives Est.', () => {
  const ok = spotReport(spot, recs({from: FROM, count: 48}), NOW, profile), no = spotReport(spot, recs({from: FROM, count: 48, dir: 180}), NOW, profile);
  assert.equal(ok.headline.heightKind, 'estimate'); assert.match(ok.days[1].heightRange!, /^Est\./);
  assert.equal(no.headline.heightKind, 'offshore'); assert.match(no.headline.heightLabel, /^\d+\.\d ft offshore$/); assert.equal(no.days[1].heightKind, 'offshore'); assert.match(no.days[1].heightRange!, /ft offshore$/); assert.doesNotMatch(no.days[1].heightRange!, /Est\./);
});

test('no records: everything is null or says so', () => {
  const r = spotReport(spot, [], NOW, profile);
  assert.equal(r.validTime, null); assert.equal(r.headline.heightKind, 'none'); assert.equal(r.headline.heightLabel, 'No forecast data'); assert.equal(r.headline.category, 'UNRATED');
  assert.equal(r.headline.wind, null); assert.equal(r.headline.tide, null); assert.deepEqual(r.swells, []); assert.equal(r.tides, null); assert.equal(r.waterTemp, null);
  assert.equal(r.days.length, 7); assert.ok(r.days.every((d) => d.am.category === null && d.heightRange === null));
  assert.ok(r.light.sunrise.localTime.length > 0); // light is computed from the date, not from forecast data, and is labelled approximate
});

test('tides: predictions when supplied, hourly values (labelled) otherwise, null with no tide data', () => {
  const ex: TidePrediction[] = [
    {timestamp: '2026-10-29T08:25:00Z', type: 'Low', height: {value: 0.4, unit: 'ft', source: {} as never}},
    {timestamp: '2026-10-29T14:35:00Z', type: 'High', height: {value: 5.2, unit: 'ft', source: {} as never}},
    {timestamp: '2026-10-30T09:10:00Z', type: 'Low', height: {value: 0.1, unit: 'ft', source: {} as never}}];
  const p = spotReport(spot, recs({from: FROM, count: 48}), NOW, profile, ex).tides!;
  assert.equal(p.source, 'predictions'); assert.equal(p.events.length, 2); assert.equal(p.events[0].type, 'Low'); assert.equal(p.events[0].localTime, '1:25 AM'); assert.equal(p.events[1].localTime, '7:35 AM'); assert.match(p.events[1].heightLabel, /^5\.2 ft$/);
  const h = spotReport(spot, recs({from: FROM, count: 48}), NOW, profile).tides!;
  assert.equal(h.source, 'hourly'); assert.match(h.note, /hourly/); assert.ok(h.events.length >= 2 && h.events.every((e) => /^\d+:00 [AP]M$/.test(e.localTime))); assert.ok(h.events.some((e) => e.type === 'High') && h.events.some((e) => e.type === 'Low'));
  assert.equal(spotReport(spot, recs({from: FROM, count: 48, tide: false}), NOW, profile).tides, null);
});
