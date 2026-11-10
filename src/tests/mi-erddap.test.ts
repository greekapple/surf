import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MI_ATTRIBUTION, MI_BUOY_ACKNOWLEDGEMENT, MI_LICENCE_URL, MI_TIDE_STATIONS, MI_TIDE_DATUM, MI_USER_AGENT, IRELAND_ZONE, miBuoyURL, miTideURL, parseMiBuoyCsv, normalizeMiBuoys, parseMiTideStations, normalizeMiTides, fetchMiBuoys, fetchMiTides} from '../ocean/marineInstitute.ts';

const fx = (n: string) => readFileSync(new URL(`./fixtures/ireland/${n}`, import.meta.url), 'utf8');
const IWB = fx('iwbnetwork-recorded.csv'), STATIONS = fx('imi-stations-recorded.csv'), LAHINCH = fx('imi-hilo-lahinch-recorded.csv');
const RETRIEVED = '2026-11-10T09:18:00Z';   // 1.3 h after the newest recorded row (08:00Z), as in the study
const HEAD = 'station_id,longitude,latitude,time,WaveHeight,WavePeriod,MeanWaveDirection,Hmax,Tp,ThTp,SprTp,QC_Flag\n,degrees_east,degrees_north,UTC,meters,seconds,degrees_true,meters,seconds,degrees_true,degrees,\n';

test('attribution texts are verbatim: the short credit with the licence link, and the buoy network acknowledgement', () => {
  assert.equal(MI_ATTRIBUTION, 'Marine Institute, Ireland: data under CC BY 4.0'); assert.equal(MI_LICENCE_URL, 'https://creativecommons.org/licenses/by/4.0/'); assert.equal(IRELAND_ZONE, 'Europe/Dublin');
  assert.ok(MI_BUOY_ACKNOWLEDGEMENT.startsWith('The Irish Buoy Network was established in 2000') && MI_BUOY_ACKNOWLEDGEMENT.endsWith('Department of Agriculture and the Marine (DAFM).'));
});
test('buoy request: keyless ERDDAP IWBNetwork CSV with the 24 h window and the fields we read; one request covers every station', () => {
  const u = new URL(miBuoyURL(Date.parse('2026-11-10T09:30:00Z')));
  assert.equal(u.origin + u.pathname, 'https://erddap.marine.ie/erddap/tabledap/IWBNetwork.csv'); assert.equal(u.searchParams.get('time>'), '2026-11-09T09:00:00Z');
  assert.equal(u.search.split('&')[0], '?station_id,longitude,latitude,time,WaveHeight,WavePeriod,MeanWaveDirection,Hmax,Tp,ThTp,SprTp,QC_Flag'); assert.ok(!/key|token/i.test(u.search));
});
test('the units line is skipped, "NaN" is null (never 0), and every recorded row parses', () => {
  const rows = parseMiBuoyCsv(IWB); assert.ok(rows.length > 25 && rows.every((r) => r.station && Number.isFinite(r.time)));
  assert.ok(!rows.some((r) => r.station === '' || r.iso === 'Invalid Date')); const m3 = rows.filter((r) => r.station === 'M3').at(-1)!; assert.ok(m3.hsM! > 0 && m3.tpS! > 0 && m3.dpDeg! >= 0); assert.equal(rows.find((r) => r.station === 'M2')!.qc, 0);
  assert.equal(parseMiBuoyCsv(HEAD + 'M2,-5.43,53.48,2026-11-10T08:00:00Z,1.0,4,100,1.5,NaN,NaN,NaN,0')[0].tpS, null);
});
test('recorded response: M2, M3, M5, M6 are live with the newest row; M4 (last row 2026-03-29) is dropped as silent', () => {
  const r = normalizeMiBuoys(IWB, RETRIEVED); assert.deepEqual(r.buoys.map((b) => b.id), ['M2', 'M3', 'M5', 'M6']); assert.deepEqual(r.silent, [{id: 'M4', lastSeen: '2026-03-29T04:00:00.000Z'}]);
  for (const b of r.buoys) { assert.equal(b.validAt, '2026-11-10T08:00:00.000Z'); assert.equal(b.ageMinutes, 78); assert.equal(b.obs.delivery, 'direct'); assert.match(b.obs.station, /^MI M\d$/); }
});
test('the values are the context-buoy ones: height in ft (from m), Tp in s, peak direction ThTp in degrees; each source carries the attribution, the licence and the unit it came in', () => {
  const m3 = normalizeMiBuoys(IWB, RETRIEVED).buoys.find((b) => b.id === 'M3')!, v = m3.obs.values, row = parseMiBuoyCsv(IWB).filter((r) => r.station === 'M3').at(-1)!;
  assert.deepEqual(Object.keys(v), ['Offshore significant height', 'Dominant wave period', 'Peak wave direction']);
  assert.ok(Math.abs(v['Offshore significant height'].value! - row.hsM! / 0.3048) < 1e-9); assert.equal(v['Offshore significant height'].unit, 'ft'); assert.equal(v['Offshore significant height'].source.nativeUnit, 'm');
  assert.equal(v['Dominant wave period'].value, row.tpS); assert.equal(v['Dominant wave period'].unit, 's'); assert.equal(v['Peak wave direction'].value, row.dpDeg); assert.equal(v['Peak wave direction'].unit, 'deg');
  for (const m of Object.values(v)) { assert.equal(m.source.kind, 'observation'); assert.ok(m.source.notes!.includes(MI_ATTRIBUTION) && m.source.notes!.includes(MI_LICENCE_URL), m.source.notes); assert.match(m.source.notes!, /quality flag 0 \(unknown/); assert.match(m.source.notes!, /no swell split/); assert.match(m.source.url, /erddap\.marine\.ie.*IWBNetwork/); assert.equal(m.source.retrievedAt, RETRIEVED); }
  assert.match(m3.obs.location, /M3 weather buoy \(51\.22° N, 10\.55° W\)/); assert.ok(Math.abs(m3.lat - 51.216) < 0.01);
});
test('quality and age rules: flag 9 is dropped, flag 1 is "good", a row in the future or older than 24 h is not shown, a missing period leaves no period (never 0), each variable takes its own newest valid row', () => {
  const now = '2026-11-10T09:00:00Z', csv = HEAD + [
    'M3,-10.5,51.2,2026-11-10T09:30:00Z,9.9,20,10,12,20,10,1,1',     // in the future: dropped
    'M3,-10.5,51.2,2026-11-10T08:00:00Z,3.0,6,200,5,NaN,NaN,NaN,9', // flag 9 (missing): dropped
    'M3,-10.5,51.2,2026-11-10T07:00:00Z,2.5,6,200,4,10.5,190,NaN,1', // good
    'M3,-10.5,51.2,2026-11-08T07:00:00Z,8.0,9,200,4,10.5,190,NaN,1', // older than 24 h
    'M5,-6.7,51.7,2026-11-10T08:00:00Z,1.5,5,100,2,NaN,170,NaN,0',   // no Tp
  ].join('\n'), r = normalizeMiBuoys(csv, now), m3 = r.buoys.find((b) => b.id === 'M3')!, m5 = r.buoys.find((b) => b.id === 'M5')!;
  assert.equal(m3.validAt, '2026-11-10T07:00:00.000Z'); assert.ok(Math.abs(m3.obs.values['Offshore significant height'].value! - 2.5 / 0.3048) < 1e-9); assert.match(m3.obs.values['Dominant wave period'].source.notes!, /quality flag 1 \(good\)/);
  assert.ok(!('Dominant wave period' in m5.obs.values), 'NaN Tp is no period'); assert.ok('Peak wave direction' in m5.obs.values);
  assert.deepEqual(normalizeMiBuoys(csv, 'not a time').buoys, []); assert.deepEqual(normalizeMiBuoys('garbage', now), {buoys: [], silent: []});
  const old = normalizeMiBuoys(HEAD + 'M6,-15.8,53.0,2026-11-08T08:00:00Z,4,7,128,7,11,160,130,0', now); assert.deepEqual(old.buoys, []); assert.equal(old.silent[0].id, 'M6');
});

test('tide stations: the dataset\'s list of 38 parses, and the constant used by the app equals it', () => {
  const list = parseMiTideStations(STATIONS); assert.equal(list.length, 38); assert.equal(MI_TIDE_STATIONS.length, 38);
  assert.deepEqual(MI_TIDE_STATIONS.map((s) => ({id: s.id, lat: s.lat, lon: s.lon})), list); assert.ok(MI_TIDE_STATIONS.some((s) => s.id === 'Lahinch' && Math.abs(s.lat - 52.93) < 0.2) && MI_TIDE_STATIONS.some((s) => s.id === 'Malin_Head') && MI_TIDE_STATIONS.some((s) => s.id === 'Port_Oriel'));
});
test('tide request: one station, quoted, a UTC window, the high/low dataset', () => {
  const u = new URL(miTideURL('Lahinch', Date.parse('2026-11-10T00:00:00Z'), Date.parse('2026-11-12T00:00:00Z')));
  assert.equal(u.pathname, '/erddap/tabledap/IMI_TidePrediction_HighLow.csv'); assert.equal(u.searchParams.get('stationID'), '"Lahinch"'); assert.equal(u.searchParams.get('time>'), '2026-11-10T00:00:00Z'); assert.equal(u.searchParams.get('time<'), '2026-11-12T00:00:00Z');
  assert.equal(u.search.split('&')[0], '?stationID,time,tide_time_category,Water_Level_ODMalin');
});
test('recorded Lahinch predictions: High/Low times in UTC with the heights in ft, the native metres and the datum named, zone Europe/Dublin explicit, the attribution in every value', () => {
  const t = normalizeMiTides(LAHINCH, 'Lahinch', RETRIEVED, 'https://x/y');
  assert.equal(t.stationName, 'Lahinch'); assert.equal(t.zone, 'Europe/Dublin'); assert.equal(t.datum, 'OD Malin'); assert.equal(t.attribution, MI_ATTRIBUTION); assert.equal(t.extrema.length, 7);
  assert.deepEqual(t.extrema.slice(0, 4).map((e) => [e.timestamp, e.type, Math.round((e.height.value! * 0.3048) * 1000) / 1000]), [['2026-11-10T05:15:00.000Z', 'High', 1.91], ['2026-11-10T11:25:00.000Z', 'Low', -1.85], ['2026-11-10T17:35:00.000Z', 'High', 1.67], ['2026-11-10T23:35:00.000Z', 'Low', -1.696]]);
  assert.ok(t.extrema.every((e, i, a) => i === 0 || a[i - 1].timestamp < e.timestamp), 'sorted by time');
  for (const e of t.extrema) { assert.equal(e.height.unit, 'ft'); assert.equal(e.height.source.nativeUnit, 'm OD Malin'); assert.equal(e.height.source.location, 'Irish Marine Institute prediction at Lahinch'); assert.ok(e.height.source.notes!.includes(MI_ATTRIBUTION)); assert.match(e.height.source.notes!, /Europe\/Dublin/); assert.match(e.height.source.notes!, /OD Malin/); assert.match(e.height.source.notes!, /Lowest Astronomical Tide.*unconfirmed/); }
  assert.match(t.datumNote, /unconfirmed/); assert.ok(MI_TIDE_DATUM === t.datum);
});
test('the times are UTC instants and the zone is explicit: the same 05:15Z high water is 05:15 in Dublin in November (GMT) and 06:15 in July (IST)', () => {
  const dublin = (iso: string) => new Intl.DateTimeFormat('en-GB', {timeZone: IRELAND_ZONE, hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date(iso));
  assert.equal(dublin('2026-11-10T05:15:00Z'), '05:15'); assert.equal(dublin('2026-07-10T05:15:00Z'), '06:15');
});
test('tide rows that are not this station, not High/Low, or unreadable are dropped; a missing column gives no extrema', () => {
  const csv = 'stationID,time,tide_time_category,Water_Level_ODMalin\n,UTC,,metres\nLahinch,2026-11-10T05:15:00Z,HIGH,1.91\nDublin_Port,2026-11-10T06:00:00Z,HIGH,2.0\nLahinch,2026-11-10T07:00:00Z,MID,0.1\nLahinch,not-a-time,LOW,-1\nLahinch,2026-11-10T11:25:00Z,LOW,NaN\nLahinch,2026-11-10T12:25:00Z,low,-1.8';
  assert.deepEqual(normalizeMiTides(csv, 'Lahinch', RETRIEVED, 'u').extrema.map((e) => e.type), ['High', 'Low']); assert.deepEqual(normalizeMiTides('a,b\n,x\n1,2', 'Lahinch', RETRIEVED, 'u').extrema, []);
});
test('fetchers send the project User-Agent, ask for the documented URLs, and fail loudly on an HTTP error', async () => {
  const calls: {url: string; ua: string}[] = []; const ok = (body: string) => (async (u: string, o: {headers: Record<string, string>}) => { calls.push({url: String(u), ua: o.headers['User-Agent']}); return new Response(body); }) as unknown as typeof fetch;
  const b = await fetchMiBuoys(ok(IWB), () => Date.parse(RETRIEVED)); assert.equal(b.buoys.length, 4); assert.equal(calls[0].ua, MI_USER_AGENT); assert.equal(MI_USER_AGENT, 'SWELLO surf forecast prototype'); assert.match(calls[0].url, /IWBNetwork\.csv/);
  const t = await fetchMiTides('Lahinch', ok(LAHINCH), () => Date.parse(RETRIEVED), 2); assert.equal(t.extrema.length, 7); assert.match(calls[1].url, /stationID=%22Lahinch%22/);
  await assert.rejects(fetchMiBuoys((async () => new Response('', {status: 503})) as unknown as typeof fetch), /HTTP 503/); await assert.rejects(fetchMiTides('Lahinch', (async () => new Response('', {status: 404})) as unknown as typeof fetch), /HTTP 404/);
});

// One live fetch each against the real server (keyless, one request a second, the project's User-Agent). Opt in: LIVE_IE=1 node --test src/tests/mi-erddap.test.ts
const live = process.env.LIVE_IE ? test : test.skip;
live('LIVE: the buoy network answers with M2, M3, M5 and M6 inside their lag, M4 silent; and Lahinch has upcoming high and low water', async () => {
  const b = await fetchMiBuoys(); const ids = b.buoys.map((x) => x.id);
  for (const id of ['M2', 'M3', 'M5', 'M6']) assert.ok(ids.includes(id), `${id} live: ${ids}`); assert.ok(!ids.includes('M4'), 'M4 has been dead since 2026-03-29'); assert.ok(b.buoys.every((x) => x.ageMinutes <= 360 && Object.keys(x.obs.values).length >= 2), JSON.stringify(b.buoys.map((x) => [x.id, x.ageMinutes])));
  await new Promise((r) => setTimeout(r, 1100));
  const t = await fetchMiTides('Lahinch'); assert.ok(t.extrema.length >= 6 && t.extrema.every((e) => e.type === 'High' || e.type === 'Low') && t.extrema.some((e) => Date.parse(e.timestamp) > Date.now()), JSON.stringify(t.extrema.slice(0, 2)));
  console.log(`live: ${b.buoys.map((x) => `${x.id} ${(x.obs.values['Offshore significant height'].value! * 0.3048).toFixed(2)} m ${x.ageMinutes} min old`).join(', ')}; Lahinch next ${t.extrema.find((e) => Date.parse(e.timestamp) > Date.now())?.timestamp} ${t.extrema.find((e) => Date.parse(e.timestamp) > Date.now())?.type}`);
});
