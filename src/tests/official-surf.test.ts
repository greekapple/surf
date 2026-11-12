import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {officialFor, pickFacingEntry, officialRange, officialLabel, expiryOf, srfZoneOf, srfOfficesFor, STALE_AFTER_EXPIRY_H, type SrfProduct, type SrfEntry} from '../services/officialSurf.ts';
import {pickEntry} from '../../services/srf-parse.mjs';
import {headlineSurf, headlineText} from '../services/headlineSurf.ts';
import {dayRange} from '../services/spotHour.ts';
import {estimateLabel} from '../services/headlineLabel.ts';
import {SRF_ZONE_OF} from '../data/srfZones.ts';
import {allSpots} from '../data/catalog.ts';
import {assignmentFor} from '../ocean/mop.ts';
const DEFAULT_PROFILE = {heightUnit: 'ft', scale: 'Face height'} as any;

const E = (o: Partial<SrfEntry>): SrfEntry => ({label: 'Surf Height', facing: null, lo: 4, hi: 7, kind: 'range', raw: 'Surf Height - 4 to 7 feet', then: null, sets: null, ...o});
const spot = 'cs-agate-beach';   // Lincoln county OR, PQR ORZ103, faces 248 (WSW), no MOP point
const NOW = Date.parse('2026-11-11T20:00:00Z');
const product = (entries: SrfEntry[], over: Partial<SrfProduct> = {}, expires = '120200'): SrfProduct => ({schema: 1, office: 'PQR', id: 'p-1', issuedAt: '2026-11-11T12:35:00+00:00', zones: [{ugc: ['ORZ103'], name: 'Central Oregon Coast', expires, issued: {date: '2026-11-11', time: '435 AM', tz: 'PST', weekday: 'Wed'}, periods: [{label: 'TODAY', date: '2026-11-11', part: 'day', surf: entries}, {label: 'THURSDAY', date: '2026-11-12', part: 'day', surf: [E({lo: 10, hi: 14, raw: 'Surf Height - 10 to 14 feet'})]}]}], ...over});
const noon = Date.parse('2026-11-11T20:00:00Z');   // noon PST

test('the spot has a zone, no MOP point, and the data file maps every zoned spot to an office|zone', () => {
  assert.deepEqual(srfZoneOf(spot), {office: 'PQR', zone: 'ORZ103'}); assert.ok(!assignmentFor(spot));
  assert.ok(Object.values(SRF_ZONE_OF).every((v) => /^[A-Z]{3}\|[A-Z]{2}Z\d{3}$/.test(v)));
  assert.deepEqual(srfOfficesFor([spot, 'cs-agate-beach', 'no-such-spot']), ['PQR']);
});
test('committed srfZones.ts equals its generator output', () => {
  const out = execFileSync(process.execPath, ['scripts/build-srf-zones.mjs'], {encoding: 'utf8'});
  assert.equal(readFileSync(new URL('../data/srfZones.ts', import.meta.url), 'utf8').trim(), out.trim());
});
test('a zone-wide range is the NWS number, labelled as theirs with its issue time; it is for the spot\'s local day', () => {
  const r = officialFor(spot, noon, product([E({})]), NOW); assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.official.loFt, 4); assert.equal(r.official.hiFt, 7); assert.equal(r.official.upTo, false);
  assert.equal(r.official.label, 'NWS surf forecast: 4–7 ft (Central Oregon Coast), issued Wed 4:35 AM PST');
  assert.equal(r.official.productId, 'p-1'); assert.equal(r.official.stale, null);
  const next = officialFor(spot, noon + 86400000, product([E({})]), NOW); assert.ok(next.ok && next.official.loFt === 10 && next.official.periodDate === '2026-11-12');
});
test('nothing is shown past the product\'s periods, for another office\'s product, a missing zone, or no product', () => {
  assert.equal(officialFor(spot, noon + 3 * 86400000, product([E({})]), NOW).ok, false);
  assert.equal(officialFor(spot, noon, product([E({})], {office: 'MTR'}), NOW).ok, false);
  assert.equal(officialFor(spot, noon, {...product([E({})]), zones: []}, NOW).ok, false);
  assert.equal(officialFor(spot, noon, null, NOW).ok, false);
  assert.equal(officialFor('w-no-zone-spot', noon, product([E({})]), NOW).ok, false);
});
test('"N feet or less" reads "up to N ft" with no lower bound; "around" and unreadable text', () => {
  const r = officialFor(spot, noon, product([E({kind: 'or_less', lo: null, hi: 2, raw: 'Surf Height - 2 feet or less'})]), NOW); assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.official.upTo, true); assert.equal(officialRange(r.official, 'ft'), 'up to 2 ft'); assert.match(r.official.label, /^NWS surf forecast: up to 2 ft/);
  const a = officialFor(spot, noon, product([E({kind: 'around', lo: 3, hi: 3})]), NOW); assert.ok(a.ok && officialRange(a.official, 'ft') === 'about 3 ft');
  const x = officialFor(spot, noon, product([E({kind: 'text', lo: null, hi: null, raw: 'Surf Height - see discussion'})]), NOW); assert.equal(x.ok, false);
});
test('metres are a plain conversion of the NWS feet', () => { assert.equal(officialRange({loFt: 6, hiFt: 8, upTo: false}, 'm'), '1.8–2.4 m'); assert.equal(officialRange({loFt: 0, hiFt: 3, upTo: true}, 'm'), 'up to 0.9 m'); });
test('facing: the entry nearest the spot\'s seaward bearing within 45 degrees; a tie, a mismatch or an unlabelled mix gives a reason, never a guess', () => {
  const ent = [E({facing: 'northwest', label: 'Northwest Facing Beaches', lo: 7, hi: 11}), E({facing: 'southwest', label: 'Southwest Facing Beaches', lo: 3, hi: 6})];
  const r = officialFor(spot, noon, product(ent), NOW); assert.ok(r.ok); if (r.ok) { assert.equal(r.official.loFt, 3); assert.equal(r.official.facing, 'southwest'); assert.match(r.official.label, /\(Southwest Facing Beaches, Central Oregon Coast\)/); }
  assert.ok('reason' in pickFacingEntry([E({facing: 'north', label: 'N'}), E({facing: 'east', label: 'E'})], 248));
  assert.ok('reason' in pickFacingEntry(ent, null)); assert.ok('reason' in pickFacingEntry([E({facing: 'north'}), E({facing: 'south'})], 100));
});
test('pickFacingEntry agrees with srf-parse pickEntry on the same inputs (the two copies must not drift)', () => {
  const sets: SrfEntry[][] = [[E({})], [E({facing: 'north'}), E({facing: 'south', lo: 1, hi: 2})], [E({facing: 'west', kind: 'or_less', lo: null, hi: 3})], [E({kind: 'text', lo: null, hi: null})], [E({facing: 'east'}), E({facing: 'west'})]];
  // srf-parse's pickEntry refuses "or less" (the comparison scripts need a lower bound); this copy keeps it to show "up to N ft". Everything else must agree.
  for (const s of sets.filter((x) => !x.some((e) => e.kind === 'or_less'))) for (const b of [null, 0, 90, 180, 248, 270, 315]) { const a = pickFacingEntry(s, b), c = pickEntry(s as any, b as any); assert.equal('entry' in a, !('reason' in c), `${JSON.stringify(s)} @ ${b}`); if ('entry' in a && !('reason' in c)) assert.equal(a.entry.raw, (c as any).entry?.raw ?? a.entry.raw); }
});
test('stale: older than the zone\'s own next scheduled issue plus 6 h is flagged; not before', () => {
  assert.equal(expiryOf('2026-11-11T12:35:00+00:00', '120200'), Date.parse('2026-11-12T02:00:00Z'));
  assert.equal(expiryOf('2026-11-30T20:00:00+00:00', '010200'), Date.parse('2026-12-01T02:00:00Z'));
  const exp = Date.parse('2026-11-12T02:00:00Z');
  assert.equal(officialFor(spot, noon, product([E({})]), exp + (STALE_AFTER_EXPIRY_H - 1) * 3600000).ok && (officialFor(spot, noon, product([E({})]), exp + 5 * 3600000) as any).official.stale, null);
  const late = officialFor(spot, noon, product([E({})]), exp + 7 * 3600000); assert.ok(late.ok && late.official.stale?.expiredAt === '2026-11-12T02:00:00.000Z');
});
test('headline: where we have no estimate the NWS range shows, labelled; without a product the labelled offshore height stays; our estimate is never replaced', () => {
  const hour: any = {spotId: spot, timestamp: '2026-11-11T20:00:00.000Z', offshore: 3.2, availability: {}};
  const withSrf = headlineSurf(spot, hour, {nowMs: NOW, bundle: {srf: {PQR: product([E({})])}} as any, observations: [], felt: []});
  assert.equal(withSrf.kind, 'official');
  const t = headlineText(withSrf, DEFAULT_PROFILE); assert.equal(t.value, '4–7 ft'); assert.equal(t.tag, 'NWS forecast'); assert.match(t.label, /^NWS surf forecast: 4–7 ft/); assert.match(t.detail, /not our forecast or part of our rating/);
  const without = headlineSurf(spot, hour, {nowMs: NOW, bundle: {} as any, observations: [], felt: []}); assert.equal(without.kind, 'offshore');
  assert.equal(estimateLabel(withSrf, DEFAULT_PROFILE)?.suffix, 'NWS');
  const sp = allSpots.find((s) => s.id === spot)!; const dr = dayRange(sp, [hour, {...hour, timestamp: '2026-11-11T19:00:00.000Z'}], '2026-11-11', NOW, DEFAULT_PROFILE, {bundle: {srf: {PQR: product([E({})])}} as any});
  assert.equal(dr.kind, 'official'); assert.equal(dr.label, 'NWS 4–7 ft'); assert.match(dr.basis, /NWS surf zone forecast for Central Oregon Coast/);
});
test('the NWS number fills only where we have nothing: a MOP spot whose nearshore data is missing falls to it, like it would to the offshore height; a v1 estimate is never replaced', () => {
  const mop = allSpots.find((s) => assignmentFor(s.id) && srfZoneOf(s.id)); assert.ok(mop);
  const z = srfZoneOf(mop!.id)!, srf = {[z.office]: {schema: 1, office: z.office, id: 'x', issuedAt: '2026-11-11T12:00:00+00:00', zones: [{ugc: [z.zone], name: 'Z', expires: '120200', issued: null, periods: [{label: 'TODAY', date: '2026-11-11', part: 'day', surf: [E({})]}]}]}};
  const hour: any = {spotId: mop!.id, timestamp: '2026-11-11T20:00:00.000Z', offshore: 3, availability: {}};
  assert.equal(headlineSurf(mop!.id, hour, {nowMs: NOW, bundle: {srf} as any, observations: [], felt: []}).kind, 'official');
  assert.equal(headlineSurf(mop!.id, hour, {nowMs: NOW, bundle: {} as any, observations: [], felt: []}).kind, 'offshore');
});
test('our v1 estimate wins: a spot with a breaking profile and a swell inside its window shows the estimate even with an NWS product loaded', async () => {
  const {evidenceSpots} = await import('../ocean/spots.ts'), {breakingProfile} = await import('../ocean/localCalibration.ts'), {normalizeOpenMeteo} = await import('../ocean/openMeteo.ts'), {toLegacy} = await import('../ocean/bridge.ts');
  const ev = evidenceSpots.find((s) => !assignmentFor(s.id) && srfZoneOf(s.id) && breakingProfile(s.id) && typeof s.orientation === 'number'); assert.ok(ev, 'a spot with a profile, a zone and no MOP point');
  const w = breakingProfile(ev!.id)!.window, mid = w[0] <= w[1] ? (w[0] + w[1]) / 2 : ((w[0] + w[1] + 360) / 2) % 360, z = srfZoneOf(ev!.id)!;
  const t0 = Math.floor(NOW / 3600000) * 3600; const time = [...Array(24).keys()].map((i) => t0 + i * 3600), col = (v: number) => time.map(() => v);
  const marine = {hourly: {time, wave_height: col(1.8), wave_period: col(12), wave_direction: col(mid), swell_wave_height: col(1.8), swell_wave_period: col(12), swell_wave_direction: col(mid), wind_wave_height: col(0.1), secondary_swell_wave_height: col(null as any), secondary_swell_wave_period: col(null as any), secondary_swell_wave_direction: col(null as any)}, hourly_units: {time: 'unixtime', wave_height: 'm', swell_wave_height: 'm', secondary_swell_wave_height: 'm', wind_wave_height: 'm', wave_period: 's', swell_wave_period: 's', secondary_swell_wave_period: 's', wave_direction: '°', swell_wave_direction: '°', secondary_swell_wave_direction: '°'}, latitude: ev!.marineLatitude ?? ev!.latitude, longitude: ev!.marineLongitude ?? ev!.longitude};
  const wind = {hourly: {time, wind_speed_10m: col(5), wind_direction_10m: col(0), wind_gusts_10m: col(8)}, hourly_units: {time: 'unixtime', wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}};
  const recs = normalizeOpenMeteo(ev as any, marine as any, wind as any, new Date(NOW).toISOString()), r = recs[12];
  const srf = {[z.office]: {schema: 1, office: z.office, id: 'x', issuedAt: '2026-11-11T12:00:00+00:00', zones: [{ugc: [z.zone], name: 'Z', expires: '120200', issued: null, periods: [{label: 'TODAY', date: new Date(r.timestamp).toISOString().slice(0, 10), part: 'day', surf: [E({})]}]}]}};
  const h = headlineSurf(ev!.id, toLegacy(r), {nowMs: NOW, bundle: {srf} as any, observations: [], felt: []});
  assert.equal(h.kind, 'estimate', `the estimate wins (got ${h.kind})`);
});
test('review round: an unreadable entry for the NEAREST facing refuses (never the next facing\'s number); "around" reads "about"; an unknown expiry still ages out', () => {
  const ent = [E({facing: 'west', label: 'West Facing', kind: 'text', lo: null, hi: null, raw: 'West Facing - flat'}), E({facing: 'northwest', label: 'Northwest Facing', lo: 6, hi: 8})];
  const p = pickFacingEntry(ent, 270); assert.ok('reason' in p, 'W is nearest and unreadable: nothing shown');
  assert.ok('entry' in pickFacingEntry(ent, 315));
  assert.equal(pickEntry(ent as any, 270).reason !== undefined, true);   // the comparison script's copy agrees
  const r = officialFor(spot, noon, product([E({kind: 'around', lo: 3, hi: 3})]), NOW); assert.ok(r.ok && officialRange(r.official, 'ft') === 'about 3 ft' && /: about 3 ft \(/.test(r.official.label));
  const old = officialFor(spot, noon, product([E({})], {issuedAt: '2026-11-08T12:00:00+00:00'}, 'garbage'), NOW); assert.ok(old.ok && old.official.stale !== null, 'no readable expiry: issue time + 30 h is used');
});
test('share card: an NWS-only hour shares as "NWS surf fcst 4–7 ft" (never as our estimate, never "no surf estimate")', async () => {
  const {shareCardFor} = await import('../services/shareCard.ts'), {evidenceSpots} = await import('../ocean/spots.ts'), {normalizeOpenMeteo} = await import('../ocean/openMeteo.ts'), {toLegacy} = await import('../ocean/bridge.ts');
  const ev = evidenceSpots.find((s) => s.id === spot)!, sp = allSpots.find((s) => s.id === spot)!;
  const t0 = Math.floor(NOW / 3600000) * 3600, time = [...Array(30).keys()].map((i) => t0 + i * 3600), col = (v: number) => time.map(() => v);
  const marine = {hourly: {time, wave_height: col(0.9), wave_period: col(6), wave_direction: col(250), swell_wave_height: col(0.9), swell_wave_period: col(6), swell_wave_direction: col(250), wind_wave_height: col(0.1)}, hourly_units: {time: 'unixtime', wave_height: 'm', swell_wave_height: 'm', wind_wave_height: 'm', wave_period: 's', swell_wave_period: 's', wave_direction: '°', swell_wave_direction: '°'}, latitude: ev.latitude, longitude: ev.longitude};
  const wind = {hourly: {time, wind_speed_10m: col(5), wind_direction_10m: col(90), wind_gusts_10m: col(8)}, hourly_units: {time: 'unixtime', wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}};
  const records = normalizeOpenMeteo(ev as any, marine as any, wind as any, new Date(NOW).toISOString()).map(toLegacy);
  const days = [...new Set(records.map((r) => r.timestamp.slice(0, 10)))], per = days.map((d) => ({label: 'D', date: d, part: 'day', surf: [E({})]}));
  const bundle = {srf: {PQR: {schema: 1, office: 'PQR', id: 'p-9', issuedAt: '2026-11-11T12:35:00+00:00', zones: [{ugc: ['ORZ103'], name: 'Central Oregon Coast', expires: '120200', issued: {date: '2026-11-11', time: '435 AM', tz: 'PST', weekday: 'Wed'}, periods: per}]}}} as any;
  const card = shareCardFor(sp, {verdict: 'Skip', window: null, nextWindow: null, why: []} as any, records as any, {...DEFAULT_PROFILE, skill: 'Intermediate'} as any, NOW, 'x', 'https://swello.example', bundle, {fallbackNow: true});
  assert.ok(card, 'a card is produced for the current (daylight) hour');
  assert.equal(card!.surf?.main, 'NWS surf fcst 4–7 ft'); assert.doesNotMatch(JSON.stringify(card), /no surf estimate here/);
});
