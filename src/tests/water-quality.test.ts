import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {STATION_REVIEW, WQ_AGENCIES, wqStationFor} from '../data/waterQualitySourced.ts';
import {hiAnswer, ncAnswer, gaAnswer, scAnswer, caAnswer, njAnswer, njSeason, createWaterQuality} from '../../services/water-quality.mjs';
import {wqLine} from '../features/forecast/waterQualityLogic.ts';
import {evidenceSpots} from '../ocean/spots.ts';

const root = new URL('../../', import.meta.url).pathname;
test('the committed station file equals the generator output (rules and OVERRIDES live in the script)', () => {
  assert.equal(execFileSync('node', ['scripts/build-water-quality.mjs'], {cwd: root, stdio: ['ignore', 'pipe', 'ignore']}).toString(), fs.readFileSync(root + 'src/data/waterQualitySourced.ts', 'utf8'));
});
test('STATION_REVIEW: every pick within 3 km has a decision and a reason; rejected ones are never used', () => {
  assert.equal(STATION_REVIEW.length, 408);
  for (const r of STATION_REVIEW) { assert.ok(r.reason.length > 15, r.spotId); assert.ok(r.km <= 3, r.spotId); assert.ok(['reviewed', 'rejected'].includes(r.decision)); }
  const ids = new Set(evidenceSpots.map((s) => s.id)); for (const r of STATION_REVIEW) assert.ok(ids.has(r.spotId), `known spot ${r.spotId}`);
});
test('Mavericks maps to a station inside Pillar Point Harbor: rejected, so the spot shows nothing', () => {
  const m = STATION_REVIEW.find((r) => r.spotId === 'spot-5' && r.source === 'ca-beachwatch-fib')!; assert.equal(m.decision, 'rejected'); assert.match(m.reason, /Harbor/); assert.equal(wqStationFor('spot-5'), null);
});
test('no reviewed station is a harbour, marina, creek, stream, outfall, drain, inlet, lagoon or boat ramp, or more than 1 km from the spot', () => {
  const bad = /\b(harbou?r|marina|lagoon|creek|stream|outfall|outflow|drain|inlet|canal|slough|wharf|gulch|pond|embayment|point zero|sewers?|offshore|jetty)\b/i;
  for (const r of STATION_REVIEW.filter((x) => x.decision === 'reviewed')) {
    if (!/Moss Landing|Marina State Beach/.test(r.station) && !/LOCATION = OCEAN/.test(r.reason)) assert.doesNotMatch(r.station.replace(/\s*\([^)]*\)\s*$/, ''), bad, `${r.spotId}: ${r.station}`);
    assert.ok(r.km <= 1, `${r.spotId} ${r.km}`);
  }
});
test('every agency is credited with a licence note; Florida is link only', () => {
  for (const s of new Set(STATION_REVIEW.map((r) => r.source))) { assert.ok(WQ_AGENCIES[s].agency && WQ_AGENCIES[s].url.startsWith('https://') && WQ_AGENCIES[s].licence.length > 30, s); }
  const fl = wqLine({ok: true, kind: 'link', source: 'fl-doh-healthy-beaches', agency: 'Florida Department of Health', agencyUrl: 'https://x', link: 'https://x'})!; assert.equal(fl.linkText, 'Check FL Healthy Beaches ↗'); assert.equal(fl.text, '');
});
const st = (stationId: string, station = 'X', lon?: number, lat?: number) => ({stationId, station, lon, lat});
const sq = (c: number[][]) => `POLYGON ((${c.map((p) => p.join(' ')).join(', ')}))`;
test('Hawaii: matched by the notice\'s station number, by the station lying in the notice\'s area (or within 100 m), or by the full location name; a shared word is not a match; EVERY open notice is shown', () => {
  const ev = {list: [
    {status: 'Open', type: 'Beach Advisory', cause: 'High bacteria', title: 'Beach Advisory at Kalapaki', station: {number: '000809'}, locations: [], postedDate: '2026-11-08T00:00:00'},
    {status: 'Open', type: 'Brown Water Advisory', cause: 'Rain', title: 'Brown at Kalapaki', locationName: 'Kalapaki Beach Park', locations: [], postedDate: '2026-11-07T01:24:44'},
    {status: 'Open', type: 'Brown Water Advisory', cause: 'Runoff', locationName: 'Hilo bay and along the Hamakua coast', postedDate: '2026-11-05T00:00:00', locations: [{geometry: sq([[-155.1, 19.7], [-155.0, 19.7], [-155.0, 19.8], [-155.1, 19.8], [-155.1, 19.7]])}]},
    {status: 'Closed', type: 'Sewage Spill', locationName: 'Tunnels Beach', postedDate: '2026-10-01T00:00:00', locations: []}]};
  const a = hiAnswer(st('000809', 'Kalapaki Beach Park'), ev, '2026-11-10T19:00:00Z'); assert.match(a.status!, /Beach Advisory: High bacteria.*Brown Water Advisory: Rain/); assert.equal(a.date, '2026-11-08'); assert.equal(a.dateLabel, 'posted'); assert.equal(a.detail, '2 open notices');
  const inside = hiAnswer(st('1', 'Waipio', -155.05, 19.75), ev, '2026-11-10T19:00:00Z'); assert.match(inside.status!, /Hamakua coast/);
  const near = hiAnswer(st('1', 'Edge', -155.0005, 19.75), ev, '2026-11-10T19:00:00Z'); assert.match(near.status!, /Hamakua coast/, 'within 100 m of the polygon edge');
  const far = hiAnswer(st('2', 'Mahaiula Coast Beach', -155.9, 19.8), ev, '2026-11-10T19:00:00Z'); assert.equal(far.status, 'No open DOH notice matched to Mahaiula Coast Beach', '"coast" is a shared word, not a match');
  assert.equal(far.dateLabel, 'checked'); assert.equal(far.detail, 'no advisory is not a clean-water result');
  assert.doesNotMatch(JSON.stringify(a), /@/, 'no staff e-mail in the answer');
});
test('NC, GA, SC: the agency status word and date as given; NC with no sample in 30 days says so and is dated as checked; SC temporary advisories take precedence and are dated as checked', () => {
  const stn = {features: [{attributes: {ASN: 'C1', Status: 'No Advisory'}}]};
  const n1 = ncAnswer(st('C1'), stn, {features: [{attributes: {ASN: 'C1', Date: Date.UTC(2026, 10, 3)}}]}, '2026-11-10T19:00:00Z')!; assert.deepEqual([n1.status, n1.date, n1.dateLabel], ['No Advisory', '2026-11-03', 'last sample']);
  const n2 = ncAnswer(st('C1'), stn, {features: []}, '2026-11-10T19:00:00Z')!; assert.deepEqual([n2.detail, n2.date, n2.dateLabel], ['no sample in 30 days', '2026-11-10', 'checked']);
  assert.equal(ncAnswer(st('ZZ'), {features: []}, {features: []}, 'x'), null);
  const g = gaAnswer(st('GA1'), {features: [{properties: {beachId: 'GA1', status: 'Yellow', dateCollected: '10/21/2026'}}]})!; assert.match(g.status!, /^Yellow: swimming advisory/); assert.equal(g.date, '2026-10-21');
  const L1 = {features: [{attributes: {STATION: 'S1', LOCATION: 'Midway', Advisory: 'No Advisory'}}]}, none = {features: []}, T = '2026-11-10T19:00:00Z';
  const s1 = scAnswer(st('S1'), L1, none, T)!; assert.deepEqual([s1.status, s1.date, s1.dateLabel], ['No advisory posted', '2026-11-10', 'checked']); assert.match(s1.detail!, /routine sampling May to October/);
  assert.equal(scAnswer(st('S1'), {features: [{attributes: {STATION: 'S1', Advisory: 'Long-Term'}}]}, none, T)!.status, 'Advisory: Long-Term');
  assert.equal(scAnswer(st('S1'), L1, {features: [{attributes: {StationName: 'S1', adv: 'Swimming advisory'}}]}, T)!.status, 'Temporary advisory: Swimming advisory', 'layer 8 wins over layer 1');
});
test('California: "Latest test <date> (N days ago): <result vs the AB 411 single-sample limit>", a lab result, never open, closed, safe or "within the standard"; no test in 45 days is said', () => {
  const recs = [{StationCode: 'O240', SampleDate: '2026-10-28T00:00:00', Analyte: 'Enterococcus', Result: 41, Unit: 'MPN/100 mL'}, {StationCode: 'O240', SampleDate: '2026-10-26T00:00:00', Analyte: 'E. coli', Result: 213, Unit: 'MPN/100 mL'}, {StationCode: 'X', SampleDate: '2026-11-01T00:00:00', Analyte: 'E. coli', Result: 9, Unit: 'MPN/100 mL'}];
  const a = caAnswer(st('O240'), recs)!; assert.equal(a.date, '2026-10-28'); assert.match(a.status!, /Enterococcus 41 MPN\/100 mL \(below the AB 411 single-sample limit of 104\)/); assert.doesNotMatch(JSON.stringify(a), /within the|\b(open|closed|safe|clean)\b/i);
  const l = wqLine({ok: true, source: 'ca-beachwatch-fib', agency: 'A', agencyUrl: 'https://a', retrievedAt: '2026-11-10T19:00:00Z', ...a} as never)!; assert.match(l.text, /^Latest test Oct 28, 2026 \(13 days ago\): Enterococcus 41/); assert.match(l.note!, /total coliform and the coliform ratio are not checked/);
  const hi = caAnswer(st('O240'), [{StationCode: 'O240', SampleDate: '2026-10-28T00:00:00', Analyte: 'E. coli', Result: 1956, Unit: 'MPN/100 mL'}])!; assert.match(hi.status!, /above the AB 411 single-sample limit of 400/);
  const none = caAnswer(st('NONE'), recs)!; assert.equal(none.kind, 'link'); assert.equal(wqLine({ok: true, source: 'ca-beachwatch-fib', agency: 'A', agencyUrl: 'https://a', ...none} as never)!.note, 'No test in the last 45 days');
});
test('one rule for every "no advisory" line: the not-a-clean-water-result sentence is always there', () => {
  for (const status of ['No Advisory', 'No advisory posted', 'Green: no advisory', 'No open DOH notice matched to X']) assert.match(wqLine({ok: true, kind: 'status', status, agency: 'A', agencyUrl: 'https://a'})!.note!, /no advisory is not a clean-water result/, status);
  assert.equal(wqLine({ok: true, kind: 'status', status: 'Yellow: swimming advisory (high bacteria)', agency: 'A', agencyUrl: 'https://a'})!.note, null);
});
test('New Jersey is seasonal: outside May to September the agency\'s state is said ("Not monitored until the 2027 season")', () => {
  assert.equal(njSeason(Date.UTC(2026, 10, 10)), false); assert.equal(njAnswer(Date.UTC(2026, 10, 10)).status, 'Not monitored until the 2027 season'); assert.equal(njAnswer(Date.UTC(2027, 0, 10)).status, 'Not monitored until the 2027 season'); assert.equal(njAnswer(Date.UTC(2027, 6, 10)).kind, 'link');
});
test('nothing is shown without a reviewed station or when the agency does not answer', () => {
  assert.equal(wqLine(null), null); assert.equal(wqLine({ok: true, none: true}), null); assert.equal(wqLine({ok: false}), null);
  assert.equal(wqLine({ok: true, kind: 'status', status: null, agency: 'A', agencyUrl: 'https://a'}), null);
});
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), {status});
test('P0-1: a failed agency call never poisons the next one; an empty or invalid body is thrown and never cached (GA 503 then HI must not read "No open notice")', async () => {
  const calls: string[] = []; let gaDown = true; const gaId = wqStationFor('w-us-north-jetty-georgia')!.stationId;
  const fetcher = async (url: string) => { calls.push(url); if (url.includes('gadnr')) return gaDown ? new Response('', {status: 503}) : json({features: [{properties: {beachId: gaId, status: 'Green', dateCollected: '10/21/2026'}}]});
    if (url.includes('/events?')) return json({list: [{id: 1, status: 'Open', type: 'Beach Advisory', station: {number: '000809'}, postedDate: '2026-11-08T00:00:00'}]}); return json({}); };
  const wq = createWaterQuality({fetcher: fetcher as never, now: () => 1_000_000});
  const ga = 'w-us-north-jetty-georgia', hi = STATION_REVIEW.find((r) => r.source === 'hi-doh-cwb' && r.decision === 'reviewed' && r.stationId === '000809')?.spotId;
  await assert.rejects(wq.answer(ga)); const h = await wq.answer(hi ?? 'w-hawaii-kalapaki'); assert.ok(calls.some((u) => u.includes('/events?')), 'the Hawaii call was really made after the GA failure');
  if (hi) assert.match(h.status, /Beach Advisory/);
  await assert.rejects(wq.answer(ga), 'the failure was not cached'); gaDown = false; const n = calls.length; assert.equal((await wq.answer(ga)).status, 'Green: no advisory'); assert.ok(calls.length > n);
  const empty = createWaterQuality({fetcher: (async () => new Response('', {status: 200})) as never, now: () => 1_000_000}); await assert.rejects(empty.answer(ga)); await assert.rejects(empty.answer(ga), 'an empty body is not cached either');
  const bad = createWaterQuality({fetcher: (async () => json({error: {code: 400}})) as never, now: () => 1_000_000}); await assert.rejects(bad.answer(ga));
});
test('P0-4: the SC service asks the temporary-advisories layer (8) as well as the station layer', async () => {
  const urls: string[] = []; const fetcher = async (url: string) => { urls.push(url); return json({features: [{attributes: {STATION: 'x', Advisory: 'None', StationName: 'x', adv: 'a'}}]}); };
  const wq = createWaterQuality({fetcher: fetcher as never, now: () => 1_000_000}); const sc = STATION_REVIEW.find((r) => r.source === 'sc-des-beach' && r.decision === 'reviewed')!.spotId; await wq.answer(sc);
  assert.ok(urls.some((u) => /MapServer\/1\/query/.test(u)) && urls.some((u) => /MapServer\/8\/query/.test(u)));
});
test('the service: invalid spot = 400; unreviewed spot = no line and no call; Florida is link only; one agency list serves many spots; User-Agent set', async () => {
  const calls: {url: string; ua: string}[] = [];
  const fetcher = async (url: string, o: {headers: Record<string, string>}) => { calls.push({url, ua: o.headers['User-Agent']}); return json({type: 'FeatureCollection', features: [{properties: {beachId: 'x'}}]}); };
  const wq = createWaterQuality({fetcher: fetcher as never, now: () => 1_000_000});
  assert.deepEqual(await wq.answer('spot-5'), {ok: true, none: true}); assert.equal(calls.length, 0);
  assert.equal((await wq.respond(new URL('http://x/api/water-quality?spot=../etc'))).status, 400);
  assert.equal((await wq.answer('w-us-ft-clinch-state-park')).kind, 'link'); assert.equal(calls.length, 0);
  await wq.answer('w-us-north-jetty-georgia'); await wq.answer('w-us-north-jetty-georgia'); assert.equal(calls.length, 1); assert.equal(calls[0].ua, 'SWELLO surf forecast prototype');
});
test('re-reviewed rejections: township and road names are not water (Ortley, Seaview), Onslow C11 is OCEAN; each decision keeps a real reason', () => {
  const d = (spot: string, src: string) => STATION_REVIEW.find((r) => r.spotId === spot && r.source === src)!;
  assert.equal(d('w-us-ortley-beach', 'nj-dep-ccmp').decision, 'reviewed'); assert.equal(d('w-us-onslow-beach', 'nc-deq-rwq').decision, 'reviewed'); assert.match(d('w-us-onslow-beach', 'nc-deq-rwq').reason, /LOCATION = OCEAN/);
  assert.equal(d('w-us-seaview-pier', 'nc-deq-rwq').decision, 'reviewed'); for (const r of STATION_REVIEW.filter((x) => x.decision === 'rejected' && /says river/.test(x.reason))) assert.doesNotMatch(r.station, /Township/, r.spotId);
});
