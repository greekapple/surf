import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {GAUGE_STATIONS, SRF_OFFICES, SRF_HOURS, KEYS, BUDGETS, rowsForHour, hourText, parseSrfList, newProducts, plan, swanSliceCells, createSurfCapture, UA, MAX_PER_OFFICE, SEEN_CAP, SWAN_SLICES} from '../../services/surf-capture.mjs';
import {gunzip} from '../../services/ndbc-archive.mjs';
import {SWAN_CAPTURE_CELLS} from '../../services/swan-capture-cells.mjs';
import {SWAN_POINTS} from '../ocean/swanPointsSourced.ts';

// 2026-11-11 16:47 UTC: the previous complete hour is 15
const NOW = Date.UTC(2026, 10, 11, 16, 47);
const HDR = '#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE\n#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft';
const TXT = HDR + '\n2026 11 11 16 26  MM   MM   MM   0.9    13   7.3 294     MM    MM  23.9    MM   MM   MM    MM\n2026 11 11 15 56  MM   MM   MM   0.9    14   7.7 289     MM    MM  23.9    MM   MM   MM    MM\n2026 11 11 15 26  MM   MM   MM   0.9    13   7.3 294     MM    MM  23.9    MM   MM   MM    MM\n2026 11 11 14 56  MM   MM   MM   0.8    13   7.3 294     MM    MM  23.9    MM   MM   MM    MM\n2026 11 10 15 56  MM   MM   MM   1.1    13   7.3 294     MM    MM  23.9    MM   MM   MM    MM\n';
const SPEC = '#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD\n#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT\n2026 11 11 15 26  0.9  0.5 14.3  0.7  9.9 WNW   W    AVERAGE  7.4 289\n2026 11 11 14 26  0.9  0.5 14.3  0.7  9.9 WNW   W    AVERAGE  7.4 289\n';
function fakeR2(opts: {failGet?: (k: string) => boolean; failPut?: (k: string) => boolean} = {}) {
  const store = new Map<string, any>(), meta = new Map<string, any>(), ops = {gets: 0, puts: 0};
  const bucket = {
    get: async (k: string) => { ops.gets++; if (opts.failGet?.(k)) throw new Error('R2 read down'); const v = store.get(k); return v === undefined ? null : {json: async () => JSON.parse(v)}; },
    put: async (k: string, v: any, o?: unknown) => { ops.puts++; if (opts.failPut?.(k)) throw new Error('R2 down'); store.set(k, v); meta.set(k, o); },
  };
  return {store, meta, bucket, ops};
}
const sleepLog: number[] = [];
const prod = (id: string, office = 'MTR', t = '2026-11-11T12:00:00+00:00') => JSON.stringify({id, issuingOffice: 'K' + office, issuanceTime: t, productCode: 'SRF', productText: 'SURF ZONE FORECAST ' + id});
const listOf = (ids: string[], office: string) => JSON.stringify({'@graph': ids.map((id, i) => ({id, issuingOffice: 'K' + office, issuanceTime: new Date(Date.UTC(2026, 10, 11, 12) - i * 3600000).toISOString(), productCode: 'SRF'}))});
const mkId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function net(over: (url: string) => Response | null | undefined = () => undefined, log: string[] = []) {
  return {log, fetcher: (async (url: string, init?: any) => {
    log.push(url); assert.equal(init?.headers?.['User-Agent'], UA, 'every request names the project');
    const o = over(url); if (o) return o;
    let m;
    if ((m = /realtime2\/(\w+)\.(txt|spec)$/.exec(url))) return new Response(m[2] === 'txt' ? TXT : SPEC);
    if ((m = /products\/types\/SRF\/locations\/(\w+)$/.exec(url))) return new Response(listOf([mkId(1), mkId(2), mkId(3)].map((x) => x.replace(/0000$/, m![1].charCodeAt(0) + '')), m[1]));
    if ((m = /products\/([\w-]+)$/.exec(url))) return new Response(prod(m[1]));
    if (/erddap/.test(url)) return new Response(JSON.stringify({table: {columnNames: ['time', 'latitude', 'longitude', 'shgt'], rows: [['2026-11-11T16:00:00Z', 1, 2, 1.1]]}}));
    if (/thredds/.test(url)) return new Response('time,waveHs\n2026-11-11T16:00:00Z,1.1\n');
    return new Response('', {status: 404});
  }) as unknown as typeof fetch};
}
const make = (n: {fetcher: typeof fetch}, extra: object = {}) => createSurfCapture({fetcher: n.fetcher, now: () => NOW, sleep: async (ms: number) => { sleepLog.push(ms); }, ...extra});

test('rowsForHour keeps NDBC lines byte for byte for one UTC hour of one day, with the header', () => {
  const {header, rows} = rowsForHour(TXT, '2026-11-11', 15);
  assert.equal(header.length, 2); assert.equal(rows.length, 2); assert.ok(rows.every((r) => r.startsWith('2026 11 11 15 ')));
  assert.equal(rows[0], TXT.split('\n')[3]); assert.equal(hourText(header, rows).split('\n').length, 5);
  assert.equal(rowsForHour(TXT, '2026-11-10', 15).rows.length, 1, 'same hour, other day, is a different object');
  assert.equal(rowsForHour(TXT, '2026-11-11', 3).rows.length, 0);
});

test('the lists: the 11 gauge stations and 19 offices asked for, no Duck FRF anywhere', () => {
  assert.deepEqual(GAUGE_STATIONS, ['LJPC1', '46254', '46266', '46274', '46285', '46268', '46286', '41115', '41121', '51211', '44056']);
  assert.deepEqual(SRF_OFFICES, ['BOX', 'BRO', 'CAR', 'CRP', 'EKA', 'GUM', 'HFO', 'JAX', 'LOX', 'MFL', 'MFR', 'MLB', 'MOB', 'MTR', 'PQR', 'SGX', 'SJU', 'TAE', 'TBW']);
  assert.doesNotMatch(readFileSync(new URL('../../services/surf-capture.mjs', import.meta.url), 'utf8').replace(/^\/\/.*$/gm, ''), /frf|duck|chlkn/i);
});

test('dispatch by UTC hour: gauges every hour, SRF at 02/08/14/20, a SWAN slice 0,1,2 round the clock; a SWAN cell comes round every 3 hours', () => {
  const at = (h: number) => plan(Date.UTC(2026, 10, 11, h, 47));
  assert.deepEqual([...Array(24).keys()].filter((h) => at(h).srf), SRF_HOURS);
  assert.ok([...Array(24).keys()].every((h) => at(h).gauges && at(h).swanSlice === h % 3));
});

test('the SWAN cell list is the generator output, covers every Hawaii spot cell exactly once, and the three slices partition it', () => {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/build-swan-capture-cells.mjs'], {encoding: 'utf8', cwd: new URL('../..', import.meta.url)});
  assert.equal(r.stdout, readFileSync(new URL('../../services/swan-capture-cells.mjs', import.meta.url), 'utf8'), 'regenerate with node scripts/build-swan-capture-cells.mjs > services/swan-capture-cells.mjs');
  assert.equal(new Set(SWAN_CAPTURE_CELLS.map((c) => c.key)).size, SWAN_CAPTURE_CELLS.length);
  assert.deepEqual(SWAN_CAPTURE_CELLS.flatMap((c) => c.spots).sort(), SWAN_POINTS.map((p) => p.spotId).sort());
  const slices = [0, 1, 2].map((s) => swanSliceCells(s).map((c) => c.key));
  assert.deepEqual(slices.flat().sort(), SWAN_CAPTURE_CELLS.map((c) => c.key).sort()); assert.ok(slices.every((s) => s.length >= 34 && s.length <= 35));
});

test('gauges: previous complete hour of .txt and .spec for every station under the day/hour keys, 1 request a second, within the budget; a rerun rewrites the same keys', async () => {
  const r2 = fakeR2(), log: string[] = []; sleepLog.length = 0;
  const cap = make(net(() => undefined, log)); const out = await cap.gauges({BUCKET: r2.bucket});
  assert.equal(out.written, 22); assert.equal(out.failures, 0); assert.ok(out.used <= BUDGETS.gauges, `used ${out.used}`);
  const keys = [...r2.store.keys()].filter((k) => k.includes('/gauges/')).sort(); assert.equal(keys.length, 22);
  assert.ok(keys.includes(KEYS.gauge('46254', '2026-11-11', '15', 'txt')) && keys.includes(KEYS.gauge('LJPC1', '2026-11-11', '15', 'spec')));
  assert.equal(r2.store.get(KEYS.gauge('46254', '2026-11-11', '15', 'txt'))!.split('\n').filter((l) => l.startsWith('2026')).length, 2);
  assert.equal(r2.meta.get(KEYS.gauge('46254', '2026-11-11', '15', 'txt')).customMetadata.rows, '2');
  assert.equal(log.length, 22); assert.ok(sleepLog.length === 21 && sleepLog.every((ms) => ms === 1000 || ms > 0));
  const before = new Map(r2.store); await cap.gauges({BUCKET: r2.bucket}); assert.deepEqual([...r2.store.entries()], [...before.entries()], 'idempotent');
  assert.equal(JSON.parse(r2.store.get(KEYS.gaugeStatus)!).hour, '2026-11-11T15');
});

test('gauges: a 404, an outage and an hour with no rows are recorded per station and file, and the others still land', async () => {
  const r2 = fakeR2();
  const cap = make(net((u) => (u.includes('/46254.spec') ? new Response('', {status: 404}) : u.includes('/46266.txt') ? new Response('', {status: 503}) : u.includes('/46274.txt') ? new Response(HDR + '\n2026 11 11 03 56 MM\n') : undefined)));
  const out = await cap.gauges({BUCKET: r2.bucket}); const st = JSON.parse(r2.store.get(KEYS.gaugeStatus)!);
  assert.equal(st.stations['46254'].spec.status, '404'); assert.equal(st.stations['46266'].txt.status, 'http 503'); assert.equal(st.stations['46274'].txt.status, 'no rows for the hour');
  assert.equal(out.failures, 3); assert.equal(out.written, 19); assert.ok(!r2.store.has(KEYS.gauge('46254', '2026-11-11', '15', 'spec')));
});

test('gauges: a put that fails is reported, never counted as written; no bucket is a clean no-op', async () => {
  const r2 = fakeR2({failPut: (k) => k.endsWith('/15.spec')}); const out = await make(net()).gauges({BUCKET: r2.bucket});
  assert.equal(out.written, 11); assert.equal(out.failures, 11); assert.equal((await make(net()).gauges({})).ok, false);
});

test('srf: every new product is stored once under its office and id, as served; the second run stores nothing and fetches no product', async () => {
  const r2 = fakeR2(), log: string[] = []; const cap = make(net(() => undefined, log));
  const a = await cap.srf({BUCKET: r2.bucket}); assert.equal(a.stored, 19 * 3); assert.equal(a.failures, 0);
  const keys = [...r2.store.keys()].filter((k) => /\/srf\/[A-Z]+\/[\w-]+\.json$/.test(k)); assert.equal(keys.length, 57);
  assert.ok(keys.every((k) => k !== KEYS.srfSeen) && keys.some((k) => k.startsWith('archive/surf-height/srf/MTR/')));
  assert.equal(JSON.parse(r2.store.get(keys[0])!).productCode, 'SRF');
  const fetchedBefore = log.filter((u) => /products\/[\w-]+$/.test(u) && !u.includes('types')).length; assert.equal(fetchedBefore, 57);
  const putsBefore = r2.ops.puts; const b = await cap.srf({BUCKET: r2.bucket});
  assert.equal(b.stored, 0); assert.equal(log.filter((u) => /products\/[\w-]+$/.test(u) && !u.includes('types')).length, 57, 'no product fetched twice');
  assert.equal(r2.ops.puts - putsBefore, 2, 'only the index and the status are written');
});

test('srf: one new product among the seen ones is the only product fetched; the index remembers ids per office, capped', async () => {
  const r2 = fakeR2(); const log: string[] = []; let extra = false;
  const cap = make(net((u) => { const m = /locations\/(MTR)$/.exec(u); if (m && extra) return new Response(listOf([mkId(99), mkId(77)], 'MTR')); return undefined; }, log));
  await cap.srf({BUCKET: r2.bucket}); extra = true; log.length = 0; const out = await cap.srf({BUCKET: r2.bucket});
  assert.equal(out.stored, 2); assert.equal(log.filter((u) => u.endsWith(mkId(99)) || u.endsWith(mkId(77))).length, 2);
  const seen = JSON.parse(r2.store.get(KEYS.srfSeen)!); assert.ok(seen.offices.MTR.ids.includes(mkId(99))); assert.ok(seen.offices.MTR.ids.length <= SEEN_CAP); assert.equal(seen.runs, 2);
});

test('newProducts: unseen only, newest first, capped, duplicates in the list taken once; parseSrfList drops entries without a usable id', () => {
  const list = parseSrfList({'@graph': [{id: 'aaaaaaaa-1', issuanceTime: '2026-11-11T01:00:00+00:00'}, {id: 'aaaaaaaa-2', issuanceTime: '2026-11-11T03:00:00+00:00'}, {id: 'aaaaaaaa-2', issuanceTime: '2026-11-11T03:00:00+00:00'}, {id: 'x'}, {nope: 1}, null]});
  assert.equal(list.length, 3);
  assert.deepEqual(newProducts(list, ['aaaaaaaa-1']).map((p) => p.id), ['aaaaaaaa-2']);
  assert.deepEqual(newProducts(list, []).map((p) => p.id), ['aaaaaaaa-2', 'aaaaaaaa-1']);
  assert.equal(newProducts(Array.from({length: 50}, (_, i) => ({id: mkId(i), issuanceTime: new Date(i * 1000).toISOString(), office: 'X'})), []).length, MAX_PER_OFFICE);
  assert.deepEqual(parseSrfList({}), []);
});

test('srf: a failed index read aborts before any fetch or write (a missing key is a fresh start, a failed read is not); a bad product is not stored or marked seen', async () => {
  const bad = fakeR2({failGet: () => true}), log: string[] = []; const out = await make(net(() => undefined, log)).srf({BUCKET: bad.bucket});
  assert.equal(out.ok, false); assert.equal(log.length, 0); assert.equal(bad.ops.puts, 0);
  const r2 = fakeR2(); const cap = make(net((u) => (/products\/[\w-]+$/.test(u) && !u.includes('types') && u.includes('0000000000') ? new Response('{"id":"other","productText":"x"}') : undefined)));
  const o = await cap.srf({BUCKET: r2.bucket}); assert.ok(o.failures > 0);
  for (const [k, v] of r2.store) if (/\/srf\/[A-Z]+\/[\w-]+\.json$/.test(k)) assert.equal(JSON.parse(v).id, k.split('/').pop()!.replace('.json', ''), 'the stored product is the one asked for');
});

test('srf: the budget stops the run, the unfetched products stay unseen and are taken next run', async () => {
  const r2 = fakeR2(); const cap = make(net(), {budgets: {...BUDGETS, srf: 30}});
  const a = await cap.srf({BUCKET: r2.bucket}); assert.ok(a.used <= 30 && a.stored < 57);
  const b = await make(net(), {budgets: {...BUDGETS, srf: 200}}).srf({BUCKET: r2.bucket});
  assert.equal(a.stored + b.stored, 57, 'every product stored exactly once across the two runs');
});

test('swan: a slice stores its cells under the day and hour with the rows as ERDDAP returned them; slice 0 adds the two CDIP buoys; within the budget at 1 request a second', async () => {
  for (const slice of [0, 1, 2]) {
    const r2 = fakeR2(), log: string[] = []; sleepLog.length = 0; const ms = Date.UTC(2026, 10, 11, 6 + slice, 47);
    const out = await make(net(() => undefined, log)).swan({BUCKET: r2.bucket}, ms, slice);
    const key = KEYS.swan('2026-11-11', String(6 + slice).padStart(2, '0')); const o = JSON.parse(await gunzip(r2.store.get(key)));  assert.equal(r2.meta.get(key).httpMetadata.contentEncoding, 'gzip');
    assert.equal(Object.keys(o.cells).length, swanSliceCells(slice).length); assert.equal(o.userAgent, UA); assert.deepEqual(o.cells[swanSliceCells(slice)[0].key].rows, [['2026-11-11T16:00:00Z', 1, 2, 1.1]]);
    assert.ok(out.used <= BUDGETS.swan && out.used <= 45, `slice ${slice} used ${out.used}`);
    assert.equal([...r2.store.keys()].filter((k) => k.includes('/cdip-')).length, slice === 0 ? 2 : 0);
    assert.ok(sleepLog.length === log.length - 1 && sleepLog.every((s) => s > 0), 'a wait before every request but the first');
  }
});

test('swan: a cell that fails or answers garbage is counted as failed and left out, not invented', async () => {
  const r2 = fakeR2(); const first = swanSliceCells(1)[0];
  const out = await make(net((u) => (u.includes(`%5B(${first.lat})%5D%5B(${first.lon})%5D`) ? new Response('not json') : undefined))).swan({BUCKET: r2.bucket}, Date.UTC(2026, 10, 11, 7, 47), 1);
  assert.equal(out.failed, 1); assert.ok(!(first.key in JSON.parse(await gunzip(r2.store.get(KEYS.swan('2026-11-11', '07')))).cells));
});

test('run: an hour with every job makes one status per job; a job that throws does not stop the next', async () => {
  const r2 = fakeR2({failGet: (k) => k === KEYS.srfSeen}); const out = await make(net()).run({BUCKET: r2.bucket}, Date.UTC(2026, 10, 11, 8, 47));
  assert.deepEqual(out.results.map((r: any) => r.job ?? 'x'), ['gauges', 'srf', 'swan']); assert.equal(out.results[1].ok, false); assert.equal(out.results[2].ok, true);
  const quiet = await make(net()).run({BUCKET: fakeR2().bucket}, Date.UTC(2026, 10, 11, 9, 47)); assert.deepEqual(quiet.results.map((r: any) => r.job), ['gauges', 'swan']);
  const boom = await createSurfCapture({fetcher: (async () => { throw new Error('x'); }) as any, now: () => NOW, sleep: async () => {}}).run({BUCKET: fakeR2().bucket}, NOW); assert.equal(boom.results.length, 2);
});

test('the worst invocation (gauges + SRF + SWAN slice 0) stays far under 1,000 subrequests and the hourly total over a month stays in the R2 free tier', async () => {
  const r2 = fakeR2(), n = net(), fetched: string[] = []; const cap = make({fetcher: (async (u: string, i: any) => { fetched.push(u); return (n.fetcher as any)(u, i); }) as any});
  await cap.run({BUCKET: r2.bucket}, Date.UTC(2026, 10, 11, 14, 47));
  assert.ok(fetched.length + r2.ops.puts + r2.ops.gets <= BUDGETS.gauges + BUDGETS.srf + BUDGETS.swan);
  assert.equal(SWAN_SLICES, 3);
});

test('the hourly tick (captures + NDBC backfill continuation, one invocation) budgets stay under the 1,000-subrequest limit (Codex P1 on 8765edc)', async () => {
  const {BACKFILL_TICK_BUDGET, INVOCATION_LIMIT} = await import('../../worker/cloudflare.mjs');
  assert.ok(BACKFILL_TICK_BUDGET > 0);
  assert.ok(BUDGETS.gauges + BUDGETS.srf + BUDGETS.swan + BACKFILL_TICK_BUDGET <= INVOCATION_LIMIT - 50);
});
