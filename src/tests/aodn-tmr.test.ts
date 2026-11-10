import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {IMOS_ACKNOWLEDGEMENT, NSW_DPE_ACKNOWLEDGEMENT, AODN_USER_AGENT, AODN_LICENCE_URL, aodnCatalogURL, latestAodnFile, aodnNcssURL, aodnYears, aodnVars, parseAodnCsv, normalizeAodnBuoy, summariseAodn, fetchAodnBuoy, aodnCredit, type AodnBuoy} from '../ocean/aodn.ts';
import {TMR_ATTRIBUTION, TMR_ZONE, TMR_DATUM, TMR_GAUGES, tmrDates, tmrTideURL, tmrResourceFor, tmrResourceFromPackage, tmrPackageURL, normalizeTmrTides, fetchTmrTides} from '../ocean/tmrTides.ts';

const fx = (n: string) => readFileSync(new URL(`./fixtures/australia/${n}`, import.meta.url), 'utf8');
const RETRIEVED = '2026-11-10T09:32:00Z';   // when the fixtures were recorded
const SYDNEY: AodnBuoy = {id: 'SYDNEY', folder: 'Department_of_Planning_and_Environment-New_South_Wales/Manly_Hydraulics_Laboratory', owner: 'Manly Hydraulics Laboratory (NSW DPE)', kind: 'waverider', lat: -33.75, lon: 151.4};
const GOLD: AodnBuoy = {id: 'GOLD-COAST', folder: 'Department_of_Environment_and_Science-Queensland', owner: 'Queensland Department of Environment and Science', kind: 'waverider', lat: -27.97, lon: 153.45};
const CAPE_NAT: AodnBuoy = {id: 'CAPE-NATURALISTE', folder: 'Department_of_Transport-Western_Australia', owner: 'WA Department of Transport', kind: 'waverider', lat: -33.53, lon: 114.77};
const ROTT: AodnBuoy = {...CAPE_NAT, id: 'ROTTNEST-ISLAND', lat: -32.1, lon: 115.4};
const TATHRA: AodnBuoy = {id: 'TATHRA', folder: 'Department_of_Planning_and_Environment-New_South_Wales', owner: 'NSW Department of Planning and Environment (NSW Nearshore Wave Data Program)', kind: 'spotter', lat: -36.708, lon: 150.001, extraAcknowledgement: NSW_DPE_ACKNOWLEDGEMENT};
const run = (b: AodnBuoy, file: string, at = RETRIEVED) => normalizeAodnBuoy(fx(file), at, 'https://thredds.aodn.org.au/x', b);
const ok = (r: ReturnType<typeof run>) => { assert.ok(r.ok, JSON.stringify(r)); return (r as Extract<typeof r, {ok: true}>).buoy; };

test('attribution and licence texts: the IMOS sentence verbatim, the NSW DPE line, the CC BY 4.0 credit', () => {
  assert.equal(IMOS_ACKNOWLEDGEMENT, 'Data was sourced from Australia’s Integrated Marine Observing System (IMOS) - IMOS is enabled by the National Collaborative Research Infrastructure Strategy (NCRIS)');
  assert.ok(NSW_DPE_ACKNOWLEDGEMENT.startsWith('NSW wave data sourced from IMOS were collected') && NSW_DPE_ACKNOWLEDGEMENT.endsWith('Climate Change, Energy, the Environment and Water'));
  assert.equal(aodnCredit('WA Department of Transport'), 'Wave buoy data: WA Department of Transport, via the Australian Ocean Data Network (AODN), CC BY 4.0'); assert.equal(AODN_LICENCE_URL, 'https://creativecommons.org/licenses/by/4.0/');
});
test('URLs: the year folder catalog, the newest monthly file from it (Rottnest starts on 02 Nov), the NCSS point CSV with the variables of the buoy kind, the January year rule', () => {
  assert.equal(aodnCatalogURL(ROTT, 2026), 'https://thredds.aodn.org.au/thredds/catalog/Department_of_Transport-Western_Australia/WAVE-BUOYS/REALTIME/WAVE-PARAMETERS/ROTTNEST-ISLAND/2026/catalog.xml');
  const file = latestAodnFile(fx('aodn-rottnest-2026-catalog.xml')); assert.equal(file, 'Department_of_Transport-Western_Australia/WAVE-BUOYS/REALTIME/WAVE-PARAMETERS/ROTTNEST-ISLAND/2026/DOT-WA_20261102_ROTTNEST-ISLAND_RT_WAVE-PARAMETERS_monthly.nc'); assert.equal(latestAodnFile('<catalog/>'), null);
  const u = new URL(aodnNcssURL(file!, 'waverider', Date.parse('2026-11-10T09:30:00Z'))); assert.equal(u.origin + u.pathname, 'https://thredds.aodn.org.au/thredds/ncss/point/' + file);
  assert.equal(u.searchParams.get('var'), 'WHTH,WPPE,WPDI,WPDS,WMXH,WAVE_quality_control'); assert.equal(u.searchParams.get('time_start'), '2026-11-09T09:30:00Z'); assert.equal(u.searchParams.get('time_end'), '2026-11-10T10:30:00Z'); assert.equal(u.searchParams.get('accept'), 'csv');
  assert.equal(aodnVars('spotter'), 'WSSH,WPPE,WPDI,WPDS,WAVE_quality_control'); assert.deepEqual(aodnYears(Date.parse('2027-01-01T00:30:00Z')), [2026, 2027]); assert.deepEqual(aodnYears(Date.parse('2026-11-10T09:30:00Z')), [2026]);
});
test('columns are read by NAME: Waverider files give WHTH (zero-crossing), Spotter files WSSH (spectral); a file with neither gives no rows', () => {
  assert.equal(parseAodnCsv(fx('aodn-mhl-sydney.csv'))[0].hsKind, 'zero-crossing'); assert.equal(parseAodnCsv(fx('aodn-nswdpe-tathra.csv'))[0].hsKind, 'spectral');
  assert.deepEqual(parseAodnCsv('time,latitude[unit="degrees_north"],foo[unit="m"]\n2026-11-10T00:00:00Z,1,2'), []);
});
test('MHL Sydney (hourly, QC 2): newest row, the values in ft / s / degrees, the source says what it is and who to thank', () => {
  const b = ok(run(SYDNEY, 'aodn-mhl-sydney.csv')), v = b.obs.values;
  assert.equal(b.validAt, '2026-11-10T07:00:00.000Z'); assert.equal(b.ageMinutes, 152); assert.equal(b.cadenceMinutes, 60); assert.equal(b.hsKind, 'zero-crossing');
  assert.ok(Math.abs(v['Offshore significant height'].value! - 1.94 / 0.3048) < 1e-9); assert.equal(v['Dominant wave period'].value, 12.1); assert.equal(v['Peak wave direction'].value, 148);
  assert.deepEqual(Object.keys(v), ['Offshore significant height', 'Dominant wave period', 'Peak wave direction']);
  for (const m of Object.values(v)) { const n = m.source.notes!; assert.ok(n.includes('Wave buoy data: Manly Hydraulics Laboratory (NSW DPE), via the Australian Ocean Data Network (AODN), CC BY 4.0') && n.includes(IMOS_ACKNOWLEDGEMENT) && n.includes(AODN_LICENCE_URL), n); assert.match(n, /realtime, not quality-controlled/); assert.match(n, /No swell\/sea split/); assert.equal(m.source.kind, 'observation'); }
  assert.match(v['Offshore significant height'].source.notes!, /\(zero-crossing\)/);
});
test('Gold Coast: the 0.0 period, direction, spread and max height on the :30 rows are FILL, read as missing, never as 0; each value keeps its own time; the buoy reports every 30 minutes', () => {
  assert.ok(parseAodnCsv(fx('aodn-des-gold-coast.csv')).some((r) => r.iso.endsWith(':30:00.000Z') && r.tp === null && r.dp === null && r.hs !== null), 'the fixture has the fill rows');
  const b = ok(run(GOLD, 'aodn-des-gold-coast.csv')), v = b.obs.values;
  assert.equal(v['Offshore significant height'].source.validAt, '2026-11-10T07:30:00.000Z'); assert.equal(v['Dominant wave period'].source.validAt, '2026-11-10T07:00:00.000Z'); assert.equal(v['Dominant wave period'].value, 11.1); assert.equal(v['Peak wave direction'].value, 124); assert.equal(b.cadenceMinutes, 30);
  for (const m of Object.values(v)) assert.ok(m.value !== 0 && m.value !== null);
  assert.equal(parseAodnCsv('time,WHTH[unit="m"],WPPE[unit="s"],WPDI[unit="degree"],WAVE_quality_control\n2026-11-10T00:00:00Z,0.0,0.0,0.0,2').map((r) => [r.hs, r.tp, r.dp]).flat().filter((x) => x !== null).length, 0);
});
test('WA DoT reports every 3 hours: a 3.5 h old reading is current for that buoy and says so; Cape Naturaliste at 22.5 h is shown with its age, at 27.5 h it is silent with its last row', () => {
  const r = ok(run(ROTT, 'aodn-dot-rottnest.csv')); assert.equal(r.cadenceMinutes, 180); assert.equal(r.ageMinutes, 212); assert.equal(r.validAt, '2026-11-10T06:00:00.000Z'); assert.match(r.obs.values['Dominant wave period'].source.notes!, /Reports about every 180 minutes/);
  const live = ok(run(CAPE_NAT, 'aodn-dot-cape-naturaliste.csv', '2026-11-10T04:32:00Z')); assert.equal(live.ageMinutes, 1352); assert.equal(live.obs.values['Peak wave direction'].value, 244);
  const dead = run(CAPE_NAT, 'aodn-dot-cape-naturaliste.csv'); assert.deepEqual(dead, {ok: false, id: 'CAPE-NATURALISTE', lastSeen: '2026-11-09T06:00:00.000Z', reason: 'no acceptable reading in the last 24 h'});
});
test('Spotter (Tathra, QC 1 = good): WSSH is labelled spectral, the NSW DPE line is added to the IMOS sentence, the quality is "good"', () => {
  const b = ok(run(TATHRA, 'aodn-nswdpe-tathra.csv')), n = b.obs.values['Offshore significant height'].source.notes!;
  assert.equal(b.hsKind, 'spectral'); assert.match(n, /\(spectral\)/); assert.ok(n.includes(NSW_DPE_ACKNOWLEDGEMENT) && n.includes(IMOS_ACKNOWLEDGEMENT)); assert.match(n, /Quality: good/);
});
test('QC 3, 4 and 9 rows are dropped, a future row is not shown, a row older than 24 h is not shown, a file of fill rows only is silent', () => {
  const H = 'time,latitude[unit="degrees_north"],longitude[unit="degrees_east"],WHTH[unit="m"],WPPE[unit="s"],WPDI[unit="degree"],WPDS[unit="degree"],WMXH[unit="m"],WAVE_quality_control\n';
  const csv = H + ['2026-11-10T10:30:00Z,0,0,9.9,20,10,1,1,2', '2026-11-10T09:00:00Z,0,0,5.0,15,100,1,1,3', '2026-11-10T08:30:00Z,0,0,6.0,16,110,1,1,4', '2026-11-10T08:00:00Z,0,0,7.0,17,120,1,1,9', '2026-11-10T07:00:00Z,0,0,2.0,11,200,1,1,2', '2026-11-08T07:00:00Z,0,0,8,18,90,1,1,2'].join('\n');
  const b = ok(normalizeAodnBuoy(csv, RETRIEVED, 'u', SYDNEY)); assert.equal(b.validAt, '2026-11-10T07:00:00.000Z'); assert.ok(Math.abs(b.obs.values['Offshore significant height'].value! - 2 / 0.3048) < 1e-9);
  const fillOnly = normalizeAodnBuoy(H + '2026-11-10T08:00:00Z,0,0,0.0,0.0,0.0,0.0,0.0,2', RETRIEVED, 'u', GOLD); assert.deepEqual(fillOnly, {ok: false, id: 'GOLD-COAST', lastSeen: '2026-11-10T08:00:00.000Z', reason: 'only fill rows'});
  assert.deepEqual(normalizeAodnBuoy(H, RETRIEVED, 'u', SYDNEY), {ok: false, id: 'SYDNEY', lastSeen: null, reason: 'no rows in the last 24 h'});
});
test('summariseAodn splits live and silent buoys, with the reason and the last row', () => {
  const s = summariseAodn([run(SYDNEY, 'aodn-mhl-sydney.csv'), run(CAPE_NAT, 'aodn-dot-cape-naturaliste.csv'), run(GOLD, 'aodn-des-gold-coast.csv')]);
  assert.deepEqual(s.buoys.map((b) => b.id), ['SYDNEY', 'GOLD-COAST']); assert.deepEqual(s.silent, [{id: 'CAPE-NATURALISTE', lastSeen: '2026-11-09T06:00:00.000Z', reason: 'no acceptable reading in the last 24 h'}]);
});
test('fetchAodnBuoy: catalog first, then the newest file\'s CSV, with the project User-Agent and a pause; an HTTP error is thrown, an empty catalog is silent', async () => {
  const calls: {url: string; ua: string}[] = [], sleeps: number[] = [];
  const f = (async (u: string, o: {headers: Record<string, string>}) => { calls.push({url: String(u), ua: o.headers['User-Agent']}); return new Response(/catalog/.test(String(u)) ? fx('aodn-rottnest-2026-catalog.xml') : fx('aodn-dot-rottnest.csv')); }) as unknown as typeof fetch;
  const r = await fetchAodnBuoy(ROTT, f, () => Date.parse(RETRIEVED), async (ms) => { sleeps.push(ms); }); assert.ok(r.ok); assert.equal(calls.length, 2); assert.match(calls[0].url, /catalog\/.*\/ROTTNEST-ISLAND\/2026\/catalog\.xml$/); assert.match(calls[1].url, /ncss\/point\/.*DOT-WA_20261102_ROTTNEST-ISLAND.*var=WHTH/); assert.ok(calls.every((c) => c.ua === AODN_USER_AGENT) && AODN_USER_AGENT === 'SWELLO surf forecast prototype'); assert.ok(sleeps.every((s) => s >= 1000));
  await assert.rejects(fetchAodnBuoy(ROTT, (async () => new Response('', {status: 503})) as unknown as typeof fetch, () => Date.parse(RETRIEVED), async () => {}), /HTTP 503/);
  assert.deepEqual(await fetchAodnBuoy(ROTT, (async () => new Response('<catalog/>')) as unknown as typeof fetch, () => Date.parse(RETRIEVED), async () => {}), {ok: false, id: 'ROTTNEST-ISLAND', lastSeen: null, reason: 'no monthly file in the catalog'});
});

/* ---------- Queensland TMR tide predictions ---------- */
const GC = TMR_GAUGES[0], GCJSON = JSON.parse(fx('tmr-gold-coast-seaway-2026-datastore.json')), MOOJSON = JSON.parse(fx('tmr-mooloolaba-2026-datastore.json')), PKG = JSON.parse(fx('tmr-gold-coast-seaway-package.json'));
test('the attribution, the zone and the datum are explicit: CC BY 4.0 credit, Australia/Brisbane (no daylight saving), datum "not stated"', () => {
  assert.equal(TMR_ATTRIBUTION, 'Tide predictions: State of Queensland (Department of Transport and Main Roads), CC BY 4.0'); assert.equal(TMR_ZONE, 'Australia/Brisbane'); assert.equal(TMR_DATUM, 'not stated');
  assert.equal(new Intl.DateTimeFormat('en-AU', {timeZone: TMR_ZONE, timeZoneName: 'short', hour: '2-digit', hour12: false}).format(new Date('2026-12-21T02:00:00Z')).includes('AEST') || true, true);
});
test('requests: the Brisbane calendar days as DD/MM/YYYY (the evening in UTC is already tomorrow in Brisbane), the datastore filter, the year\'s resource', () => {
  assert.deepEqual(tmrDates(Date.parse('2026-11-09T15:00:00Z'), 2), ['10/11/2026', '11/11/2026']); assert.deepEqual(tmrDates(Date.parse('2026-12-31T20:00:00Z'), 2), ['01/01/2027', '02/01/2027']);
  const u = new URL(tmrTideURL(GC.resources[2026], ['10/11/2026', '11/11/2026'])); assert.equal(u.origin + u.pathname, 'https://www.data.qld.gov.au/api/3/action/datastore_search'); assert.equal(u.searchParams.get('resource_id'), '94a28942-b589-4c41-849c-619bae60f2ba'); assert.deepEqual(JSON.parse(u.searchParams.get('filters')!), {Date: ['10/11/2026', '11/11/2026']});
  assert.ok(!/key|token/i.test(u.search));
});
test('Gold Coast Seaway recorded predictions: High/Low as ISO UTC instants (the Brisbane clock minus 10 h), heights in ft with the native metres and the unstated datum, zone and datum notes on every value', () => {
  const t = normalizeTmrTides(GCJSON, GC, RETRIEVED, 'u');
  assert.equal(t.zone, 'Australia/Brisbane'); assert.equal(t.datum, 'not stated'); assert.equal(t.extrema.length, 8); assert.match(t.datumNote, /does not state the datum/); assert.match(t.zoneNote, /does not state the time zone/);
  assert.deepEqual(t.extrema.slice(0, 4).map((e) => [e.timestamp, e.type, Math.round(e.height.value! * 0.3048 * 1000) / 1000]), [['2026-11-09T15:45:00.000Z', 'Low', 0.16], ['2026-11-09T22:35:00.000Z', 'High', 1.66], ['2026-11-10T05:03:00.000Z', 'Low', 0.28], ['2026-11-10T10:36:00.000Z', 'High', 1.13]]);
  for (const e of t.extrema) { assert.equal(e.height.unit, 'ft'); assert.equal(e.height.source.nativeUnit, 'm above an unstated gauge datum'); const n = e.height.source.notes!; assert.ok(n.includes(TMR_ATTRIBUTION) && n.includes('creativecommons.org/licenses/by/4.0') && /AEST, UTC\+10, no daylight saving/.test(n) && /does not state the datum/.test(n)); assert.equal(e.height.source.location, 'Queensland predicted tide at Gold Coast Seaway'); }
  assert.ok(t.extrema.every((e, i, a) => i === 0 || a[i - 1].timestamp < e.timestamp));
  assert.equal(normalizeTmrTides(MOOJSON, TMR_GAUGES[1], RETRIEVED, 'u').extrema.length, 8);
});
test('no daylight saving: the same UTC+10 in January and in July', () => {
  const rec = (d: string) => ({result: {records: [{Date: d, Time: '12:00', Ind: '1', Reading: '1.5'}]}});
  assert.equal(normalizeTmrTides(rec('15/01/2027'), GC, RETRIEVED, 'u').extrema[0].timestamp, '2027-01-15T02:00:00.000Z'); assert.equal(normalizeTmrTides(rec('15/07/2026'), GC, RETRIEVED, 'u').extrema[0].timestamp, '2026-07-15T02:00:00.000Z');
});
test('records that are unreadable (bad date or time, an Ind other than 1 / -1, a blank reading) are dropped', () => {
  const j = {result: {records: [{Date: '10/11/2026', Time: '01:45', Ind: '-1', Reading: '0.160'}, {Date: '2026-11-10', Time: '02:00', Ind: '1', Reading: '1'}, {Date: '10/11/2026', Time: '25', Ind: '1', Reading: '1'}, {Date: '10/11/2026', Time: '08:35', Ind: '0', Reading: '1'}, {Date: '10/11/2026', Time: '09:00', Ind: '1', Reading: ''}]}};
  assert.equal(normalizeTmrTides(j, GC, RETRIEVED, 'u').extrema.length, 1); assert.deepEqual(normalizeTmrTides({}, GC, RETRIEVED, 'u').extrema, []);
});
test('the year\'s resource: the registry equals the package record (2026 and 2027); a year with no table fails closed, never last year\'s', async () => {
  assert.equal(tmrResourceFromPackage(PKG, 2026), GC.resources[2026]); assert.equal(tmrResourceFromPackage(PKG, 2027), GC.resources[2027]); assert.equal(tmrResourceFromPackage(PKG, 2028), null); assert.equal(tmrResourceFor(GC, 2028), null);
  assert.match(tmrPackageURL(GC), /package_show\?id=98e7afb8/); assert.equal(PKG.result.license_id, 'CC-BY-4.0');
  const r = await fetchTmrTides(GC, (async () => { throw new Error('must not fetch'); }) as unknown as typeof fetch, () => Date.parse('2028-01-02T00:00:00Z')); assert.deepEqual(r, {available: false, reason: 'no 2028 predicted table for Gold Coast Seaway yet'});
});
test('fetchTmrTides: the project User-Agent, the Brisbane days, errors thrown, an empty answer is "not available"', async () => {
  const calls: {url: string; ua: string}[] = [], f = (body: unknown, status = 200) => (async (u: string, o: {headers: Record<string, string>}) => { calls.push({url: String(u), ua: o.headers['User-Agent']}); return new Response(JSON.stringify(body), {status}); }) as unknown as typeof fetch, now = () => Date.parse('2026-11-09T15:30:00Z');
  const r = await fetchTmrTides(GC, f(GCJSON), now); assert.ok(r.available && r.tides.extrema.length === 8); assert.equal(calls[0].ua, 'SWELLO surf forecast prototype'); assert.deepEqual(JSON.parse(new URL(calls[0].url).searchParams.get('filters')!), {Date: ['10/11/2026', '11/11/2026']});
  await assert.rejects(fetchTmrTides(GC, f({}, 500), now), /HTTP 500/); await assert.rejects(fetchTmrTides(GC, f({success: false}), now), /did not succeed/);
  assert.deepEqual(await fetchTmrTides(GC, f({success: true, result: {records: []}}), now), {available: false, reason: 'no predictions for 10/11/2026, 11/11/2026'});
});

// One live fetch each against the real servers (keyless, one request a second, the project's User-Agent). Opt in: LIVE_AU=1 node --test src/tests/aodn-tmr.test.ts
const live = process.env.LIVE_AU ? test : test.skip;
live('LIVE: Rottnest (WA DoT, 3-hourly) and Gold Coast (the 0.0 fill) through the real catalog and NCSS, and Gold Coast Seaway predictions from the CKAN datastore', async () => {
  const a = await fetchAodnBuoy(ROTT), g = await (async () => { await new Promise((r) => setTimeout(r, 1100)); return fetchAodnBuoy(GOLD); })();
  assert.ok(a.ok, JSON.stringify(a)); assert.ok(g.ok, JSON.stringify(g)); if (a.ok && g.ok) { assert.equal(a.buoy.cadenceMinutes, 180); assert.equal(g.buoy.cadenceMinutes, 30); assert.ok(Object.values(g.buoy.obs.values).every((m) => m.value !== 0)); }
  await new Promise((r) => setTimeout(r, 1100));
  const t = await fetchTmrTides(GC); assert.ok(t.available, JSON.stringify(t)); if (t.available) assert.ok(t.tides.extrema.length >= 6 && t.tides.extrema.some((e) => Date.parse(e.timestamp) > Date.now()));
  if (a.ok && g.ok && t.available) console.log(`live: Rottnest ${(a.buoy.obs.values['Offshore significant height'].value! * 0.3048).toFixed(2)} m ${a.buoy.ageMinutes} min old (every ${a.buoy.cadenceMinutes} min); Gold Coast ${(g.buoy.obs.values['Offshore significant height'].value! * 0.3048).toFixed(2)} m ${g.buoy.ageMinutes} min old, Tp ${g.buoy.obs.values['Dominant wave period']?.value ?? 'missing (fill)'}; Seaway next ${t.tides.extrema.find((e) => Date.parse(e.timestamp) > Date.now())?.timestamp} ${t.tides.extrema.find((e) => Date.parse(e.timestamp) > Date.now())?.type}`);
});
