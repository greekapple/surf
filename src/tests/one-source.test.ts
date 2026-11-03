import test from 'node:test';
import assert from 'node:assert/strict';
import {spotHour, spotHourOf, recordAt, windOf, dayRange} from '../services/spotHour.ts';
import {spotStrip} from '../services/spotStrip.ts';
import {dashCard} from '../services/homeDash.ts';
import {spotReport} from '../services/spotReport.ts';
import {headlineSurf, headlineText} from '../services/headlineSurf.ts';
import {dataPhase} from '../services/dataPhase.ts';
import {explainRating} from '../ratings/explain.ts';
import {rateOcean} from '../ratings/adapters.ts';
import {windCeilings, rangeCeiling} from '../ratings/windRules.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {pacificDate} from '../ocean/time.ts';
import {isDark} from '../services/daylight.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';

const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const t = 1792454400, now = t * 1000 + 600000;
const times = Array.from({length: 30}, (_, i) => t - 3600 + i * 3600);
const marine = (dir: number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => 1.6), swell_wave_height: times.map(() => 1.5), swell_wave_direction: times.map(() => dir), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}});
const weather = (mph: number, dir: number) => ({hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => mph), wind_direction_10m: times.map(() => dir), wind_gusts_10m: times.map(() => mph)}});
const raw = (id: string, mph = 5, wdir = 90, sdir = 270) => normalizeOpenMeteo(evidenceSpot(id), marine(sdir), weather(mph, wdir), new Date(now).toISOString());
const recs = (id: string, mph = 5, wdir = 90, sdir = 270) => raw(id, mph, wdir, sdir).map(toLegacy);
const spot = (id: string) => allSpots.find((s) => s.id === id)!;

test('strip == card == Home == report headline: same spot and hour, same surf range, rating, wind and tide', () => {
  for (const id of ['spot-2', 'spot-3']) {
    const records = recs(id), s = spot(id);
    const [strip] = spotStrip(allSpots, records, [id], now, profile), card = dashCard(s, records, now, profile), hr = spotHour(s, records, now, profile)!, rep = spotReport(s, records, now, profile).headline;
    assert.equal(card.surf.value, hr.surf.value); assert.equal(card.surf.label, hr.surf.label); assert.equal(card.rating.category, String(hr.rating.category));
    assert.equal(strip.category, String(hr.rating.category)); assert.equal(rep.category, String(hr.rating.category));
    if (hr.surf.headline.kind === 'estimate') { assert.equal(strip.heightLabel, `Est. ${hr.surf.value}`); assert.equal(rep.heightLabel, strip.heightLabel); }
    assert.equal(card.wind?.label, hr.wind?.label); assert.equal(rep.wind?.label, hr.wind?.label); assert.equal(card.wind?.relation, hr.wind?.relation); assert.equal(rep.wind?.relation, hr.wind?.relation);
    assert.equal(card.tide?.state, hr.tide?.state); assert.equal(rep.tide?.state, hr.tide?.state);
    assert.equal(strip.validTime, hr.validTime); assert.equal(card.validTime, hr.validTime);
  }
});
test('with a MOP nearshore point (v2) the strip chip, Surf card, Home card and report all show the SAME range (was 4–9 vs 5–11)', () => {
  const FT = 1 / 0.3048, m = (value: number) => ({value, unit: 'ft', source: {}});
  const records = recs('spot-2'), iso = records.find((f) => Date.parse(f.timestamp) >= Math.floor(now / 3600000) * 3600000)!.timestamp;
  const mopRec = {timestamp: iso, height: m(1.4 * FT), period: {value: 14, unit: 's', source: {}}, direction: {value: 266, unit: 'deg', source: {}}, qualityFlag: 1, mopId: 'SF023', product: 'forecast'};
  const bundle = {nearshore: [], mop: {SF023: {mopId: 'SF023', records: [mopRec], issue: null, retrievedAt: iso, url: 'x'}}} as any, ctx = {bundle};
  const s = spot('spot-2'), hr = spotHour(s, records, now, profile, ctx)!;
  assert.ok(hr.surf.headline.kind === 'estimate' && hr.surf.headline.method === 'mop-v2');
  const [strip] = spotStrip(allSpots, records, ['spot-2'], now, profile, ctx), card = dashCard(s, records, now, profile, ctx), rep = spotReport(s, records, now, profile, undefined, ctx).headline;
  assert.equal(strip.heightLabel, `Est. ${hr.surf.value}`); assert.equal(card.surf.value, hr.surf.value); assert.equal(rep.heightLabel, strip.heightLabel);
  // without the bundle the strip would have read v1; passing it is what makes all surfaces agree
  const [v1strip] = spotStrip(allSpots, records, ['spot-2'], now, profile);
  assert.notEqual(v1strip.heightLabel, strip.heightLabel);
});
test('the hour rule: the first record at or after the top of the hour; an earlier record is never used', () => {
  const records = recs('spot-2');
  assert.equal(recordAt(records, 'spot-2', now)!.timestamp, new Date(t * 1000).toISOString());
  assert.equal(recordAt(records, 'spot-2', (t + 5 * 3600) * 1000 + 1)!.timestamp, new Date((t + 5 * 3600) * 1000).toISOString());
  assert.equal(recordAt(records.filter((r) => Date.parse(r.timestamp) < t * 1000), 'spot-2', now), undefined);
});
test('wind accessor: relation and label come from one place and match the rating input', () => {
  const f = recs('spot-2', 2.1, 90)[1], w = windOf(spot('spot-2'), f, profile)!;
  assert.equal(w.relation, 'offshore'); assert.match(w.label, /^2\.1 mph E$|^2 mph E$|E$/);
  const g = recs('spot-2', 1.8, 315)[1], x = windOf(spot('spot-2'), g, profile)!;
  assert.equal(x.relation, 'cross-shore');
});
test('day range: daylight hours only, from the same headline engine, labelled', () => {
  const records = recs('spot-2'), key = pacificDate(new Date(t * 1000).toISOString()), r = dayRange(spot('spot-2'), records, key, now, profile);
  assert.equal(r.kind, 'estimate'); assert.match(r.label!, /^Est\. \d+–\d+ ft$/); assert.match(r.basis, /daylight/);
  const hourly = records.filter((f) => pacificDate(f.timestamp) === key).map((f) => headlineSurf('spot-2', f, {nowMs: now})).filter((h) => h.kind === 'estimate') as any[];
  assert.ok(r.loFt! <= Math.min(...hourly.map((h) => h.loFt)) + 1e-9 && r.hiFt! >= Math.max(...hourly.map((h) => h.hiFt)) - 1e-9 || r.hours < hourly.length);
  assert.equal(dayRange(spot('spot-2'), [], key, now, profile).kind, 'none');
});
test('loading is not failure: skeletons until data arrives or the load fails', () => {
  assert.equal(dataPhase({loading: false, bundle: null, error: ''}), 'loading'); // the render before the effect runs
  assert.equal(dataPhase({loading: true, bundle: null, error: ''}), 'loading');
  assert.equal(dataPhase({loading: false, bundle: null, error: 'x'}), 'failed');
  assert.equal(dataPhase({loading: true, bundle: {}, error: ''}), 'ready'); assert.equal(dataPhase({loading: false, bundle: {}, error: 'refresh failed'}), 'ready');
  assert.equal(dataPhase({loading: false, bundle: null}, false), 'ready');
});
test('ceilings: unknown shore relation and fresh cross-shore wind stop at NOT BAD; calm unknown is not capped; the wide range stops at SOLID', () => {
  assert.equal(windCeilings('unknown', 9)[0].limit, 64); assert.equal(windCeilings('unknown', 4).length, 0);
  assert.equal(windCeilings('Cross-shore', 8.5)[0].limit, 64); assert.equal(windCeilings('cross-shore', 7.9).length, 0); assert.equal(windCeilings('offshore', 20).length, 0);
  assert.equal(rangeCeiling([4, 9])!.limit, 69); assert.equal(rangeCeiling([3, 6]), null); assert.equal(rangeCeiling(null), null);
});
test('rating: a windy unknown-orientation spot cannot reach SOLID, and explainRating says why', () => {
  const r = raw('spot-3', 12, 90)[1], q = rateOcean(evidenceSpot('spot-3'), r, now);
  assert.ok((q.score as number) <= 64, `score ${q.score}`);
  // the ceiling is reported whenever it actually held a score down; check the wording through explainRating with the ceiling the rule produces
  const held = {...q, ceilings: windCeilings('unknown', 12)}, e = explainRating(held, {spotId: 'spot-3', wind: {mph: 12, relation: 'Unknown'}}), c = e.items.find((i) => i.factor === 'Rating ceiling')!;
  assert.ok(c); assert.match(c.reason, /not surveyed/); assert.equal(c.effect, '-');
});
test('rating: Ocean Beach with fresh cross-shore wind is held to NOT BAD; a light offshore wind is not', () => {
  const cross = rateOcean(evidenceSpot('spot-2'), raw('spot-2', 12, 340)[1], now), glass = rateOcean(evidenceSpot('spot-2'), raw('spot-2', 3, 90)[1], now);
  assert.ok((cross.score as number) <= 64); assert.ok(cross.ceilings?.some((c) => c.id === 'cross-shore'));
  assert.ok(!(glass.ceilings ?? []).some((c) => c.id === 'cross-shore' || c.id === 'wind-unknown'));
});
test('spotHourOf is the single record-to-view conversion', () => {
  const f = recs('spot-2')[1], a = spotHourOf(spot('spot-2'), f, now, profile);
  assert.equal(a.validTime, f.timestamp); assert.equal(a.spotId, 'spot-2'); assert.equal(a.surf.headline.kind, 'estimate');
});

test('T-057 day card: the main number is spotHour at the chosen hour; the envelope is unchanged; the hour is named', () => {
  const records = recs('spot-2'), key = pacificDate(new Date(t * 1000).toISOString()), s = spot('spot-2'), r = dayRange(s, records, key, now, profile);
  assert.ok(r.typical); const ty = r.typical!;
  const hr = spotHour(s, records, Date.parse(ty.atIso), profile)!;
  assert.equal(hr.validTime, ty.atIso); assert.ok(hr.surf.headline.kind === 'estimate');
  assert.equal(ty.loFt, (hr.surf.headline as any).loFt); assert.equal(ty.hiFt, (hr.surf.headline as any).hiFt); assert.equal(ty.hour.surf.value, hr.surf.value);
  // the envelope still covers the typical hour and is the min of lows / max of highs over the same hours
  assert.ok(r.loFt! <= ty.loFt && r.hiFt! >= ty.hiFt); assert.equal(r.kind, 'estimate'); assert.match(r.label!, /^Est\. \d+–\d+ ft$/);
  assert.match(ty.short, /^midday \d{1,2}[ap]$/); assert.match(ty.aria, /^typical for the day, midday \d{1,2} [AP]M$/); assert.equal(ty.how, 'midday');
});
test('T-068 day card: the median daylight hour by clock time is chosen, whatever the ratings', () => {
  // whatever the ratings are (here: no wind at all, so unrated), the card stands for the middle daylight hour by clock time
  const unrated = recs('spot-2').map((f) => ({...f, availability: {...f.availability, wind: false}, evidence: f.evidence && {...f.evidence, windSpeed: {...f.evidence.windSpeed, value: null}}}));
  for (const records of [recs('spot-2'), unrated as any]) {
    const key = pacificDate(new Date(t * 1000).toISOString()), r = dayRange(spot('spot-2'), records, key, now, profile);
    const day = records.filter((f: any) => pacificDate(f.timestamp) === key && !isDark('spot-2', f.timestamp) && headlineSurf('spot-2', f, {nowMs: now}).kind === 'estimate').sort((a: any, b: any) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    if (!day.length) continue; assert.equal(r.typical!.atIso, day[(day.length - 1) >> 1].timestamp); assert.equal(r.typical!.how, 'midday');
  }
  // a full November day: the middle of ~6 AM–5 PM light is about 11 AM–noon, and the card names it
  const full = Array.from({length: 24}, (_, i) => { const base = recs('spot-2')[1]; const ts = new Date(Date.parse('2026-11-04T08:00:00Z') + i * 3600000).toISOString(); return {...base, timestamp: ts, evidence: base.evidence && {...base.evidence, timestamp: ts}}; });
  const fr = dayRange(spot('spot-2'), full as any, '2026-11-04', now, profile); assert.ok(fr.typical); assert.match(fr.typical!.short, /^midday 1[12][ap]$|^midday 12p$/);
  assert.equal(dayRange(spot('spot-2'), [], 'x', now, profile).typical, null);
});
