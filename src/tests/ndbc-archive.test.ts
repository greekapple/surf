import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARCHIVE_BUOYS, ARCHIVE_KEYS, ARCHIVE_BUDGET, BACKFILL_DAYS, sliceByDay, dayText, gzip, gunzip, wantedDays, createNdbcArchive, utcDay, ndbcFileURL} from '../../services/ndbc-archive.mjs';
import {contextBuoys} from '../ocean/buoys.ts';
import cron, {ARCHIVE_CRON, BACKFILL_CRON, CRON} from '../../worker/cloudflare.mjs';

const REAL = readFileSync(new URL('../../docs/forecast/data/ndbc-46026.spec.txt', import.meta.url), 'utf8');   // a real saved 46026 .spec (newest first)
const DAY = 86400000, NOW = Date.UTC(2026, 10, 10, 6, 17);
const HDR = '#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD\n#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT';
const DHDR = '#YY  MM DD hh mm Sep_Freq  < spec_1 (freq_1) spec_2 (freq_2) ... >';
const pad = (n: number) => String(n).padStart(2, '0');
/** A synthetic 45-day file, newest first, one row an hour (spec) or every 3 h (data_spec): enough rows to see day slicing without a megabyte. */
function synth(kind: 'spec' | 'data_spec', nowMs: number, hdr = kind === 'spec' ? HDR : DHDR, swell = '1.2 11.0 0.5 5.0 SW W SWELL 6.0 230') {
  const rows: string[] = []; const step = kind === 'spec' ? 3600000 : 3 * 3600000;
  for (let t = nowMs - nowMs % step; t > nowMs - 45 * DAY; t -= step) { const d = new Date(t); rows.push(`${d.getUTCFullYear()} ${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())} ${pad(d.getUTCMinutes())} ` + (kind === 'spec' ? '1.5  ' + swell : '9.999 0.000 (0.025) 0.100 (0.030)')); }
  return hdr + '\n' + rows.join('\n') + '\n';
}
function fakeR2(store = new Map<string, Uint8Array | string>(), opts: {failPut?: (k: string) => boolean; failGet?: (k: string) => boolean} = {}) {
  const ops = {gets: 0, puts: 0, meta: new Map<string, unknown>()};
  const bucket = {
    get: async (k: string) => { ops.gets++; if (opts.failGet?.(k)) throw new Error('R2 read down'); const v = store.get(k); return v === undefined ? null : {json: async () => JSON.parse(v as string)}; },
    head: async (k: string) => { ops.gets++; return store.has(k) ? {customMetadata: (ops.meta.get(k) as any)?.customMetadata} : null; },
    put: async (k: string, v: Uint8Array | string, o?: unknown) => { ops.puts++; if (opts.failPut?.(k)) throw new Error('R2 down'); store.set(k, v); ops.meta.set(k, o); },
  };
  return {store, bucket, ops};
}
function fakeNdbc(files: (id: string, kind: 'spec' | 'data_spec') => string | number | null, log: string[] = []) {
  return {log, fetcher: (async (url: string) => {
    log.push(url); const m = /realtime2\/(\w+)\.(spec|data_spec)$/.exec(url)!; const f = files(m[1], m[2] as 'spec' | 'data_spec');
    if (typeof f === 'number') return new Response('', {status: f});
    if (f === null) throw new Error('network down');
    return new Response(f, {status: 200});
  }) as unknown as typeof fetch};
}
const make = (n: {fetcher: typeof fetch}, now: () => number, extra: object = {}) => createNdbcArchive({fetcher: n.fetcher, now, sleep: async () => {}, ...extra});
const gzKeys = (store: Map<string, unknown>) => [...store.keys()].filter((k) => k.endsWith('.gz')).sort();

test('the 73 archived buoys: unique 5-character NDBC ids, every NDBC context buoy of the app is in the list, CDIP-only ids are not', () => {
  assert.equal(ARCHIVE_BUOYS.length, 73); assert.equal(new Set(ARCHIVE_BUOYS).size, 73);
  for (const id of ARCHIVE_BUOYS) assert.match(id, /^((41|44|46|51)\d{3}|LJPC1)$/);
  const missing = contextBuoys.filter((b) => b.provider === 'NDBC' && !ARCHIVE_BUOYS.includes(b.id)).map((b) => b.id);
  assert.deepEqual(missing, [], 'an NDBC context buoy of the app is not archived');
  for (const b of contextBuoys.filter((b) => b.provider === 'CDIP')) assert.ok(!ARCHIVE_BUOYS.includes(b.id));
  assert.ok(!ARCHIVE_BUOYS.includes('46656'));
});
test('key layout: archive/ndbc/<kind>/<buoy>/<year>/<day>.<kind>.gz, one manifest per day, one cursor', () => {
  assert.equal(ARCHIVE_KEYS.file('spec', '46026', '2026-11-09'), 'archive/ndbc/spec/46026/2026/2026-11-09.spec.gz');
  assert.equal(ARCHIVE_KEYS.file('data_spec', '51201', '2027-01-02'), 'archive/ndbc/data_spec/51201/2027/2027-01-02.data_spec.gz');
  assert.equal(ARCHIVE_KEYS.manifest('2026-11-10'), 'archive/ndbc/_manifest/2026-11-10.json');
  assert.equal(ARCHIVE_KEYS.cursor, 'archive/ndbc/_cursor.json');
  assert.equal(ndbcFileURL('46026', 'data_spec'), 'https://www.ndbc.noaa.gov/data/realtime2/46026.data_spec');
  for (const k of [ARCHIVE_KEYS.file('spec', '1', '2026-01-01'), ARCHIVE_KEYS.cursor]) assert.ok(!k.startsWith('forecast/'));
});
test('slicing a real 46026 .spec by UTC day: lines are kept byte for byte, every row lands in exactly one day, the header is kept', () => {
  const {header, days} = sliceByDay(REAL), all = REAL.split('\n').filter((l) => l && !l.startsWith('#'));
  assert.equal(header.length, 2); assert.equal([...days.values()].reduce((a, r) => a + r.length, 0), all.length);
  for (const [d, rows] of days) for (const r of rows) { assert.ok(all.includes(r)); const [y, mo, dd] = r.trim().split(/\s+/); assert.equal(`${y}-${mo}-${dd}`, d); }
  const oct30 = days.get('2026-10-30')!; assert.ok(oct30.length > 10 && oct30.length <= 144);
  assert.ok(oct30.includes('2026 10 30 16 40  1.3  1.2 14.8  0.4  3.7  SW   W      SWELL  6.1 234'));
  const txt = dayText(header, oct30); assert.ok(txt.startsWith(header[0] + '\n')); assert.ok(txt.endsWith('\n')); assert.equal(txt.split('\n').filter((l) => l && !l.startsWith('#')).length, oct30.length);
});
test('gzip round trip returns the same text', async () => {
  const txt = dayText(sliceByDay(REAL).header, sliceByDay(REAL).days.get('2026-10-30')!), z = await gzip(txt);
  assert.ok(z.length < txt.length / 2); assert.equal(z[0], 0x1f); assert.equal(await gunzip(z), txt);
});
test('wantedDays: daily keeps the 3 complete days before today, backfill every day NDBC holds; never today', () => {
  const all = Array.from({length: 48}, (_, i) => utcDay(NOW - i * DAY));
  assert.deepEqual(wantedDays(all, NOW, 'daily'), ['2026-11-07', '2026-11-08', '2026-11-09']);
  const b = wantedDays(all, NOW, 'backfill'); assert.equal(b.length, BACKFILL_DAYS + 1, '45 days held = up to 46 calendar days, the oldest partial'); assert.ok(!b.includes('2026-11-10')); assert.equal(b.at(-1), '2026-11-09');
});
test('one buoy, daily mode: the previous 3 days of both files are written as gzip objects with the right headers and the day text is exactly the slice', async () => {
  const r2 = fakeR2(), n = fakeNdbc((id, k) => synth(k, NOW));
  const a = make(n, () => NOW, {buoys: ['46026']});
  await r2.bucket.put(ARCHIVE_KEYS.cursor, JSON.stringify({schema: 1, backfill: {done: true, next: 1}, headers: {}}));
  const rep = await a.run({BUCKET: r2.bucket});
  assert.equal(rep.mode, 'daily'); assert.equal(rep.failures, 0);
  assert.deepEqual(gzKeys(r2.store), ['spec', 'data_spec'].flatMap((k) => ['2026-11-07', '2026-11-08', '2026-11-09'].map((d) => ARCHIVE_KEYS.file(k, '46026', d))).sort());
  const meta = r2.ops.meta.get(ARCHIVE_KEYS.file('spec', '46026', '2026-11-09')) as {httpMetadata: {contentEncoding: string; contentType: string}};
  assert.equal(meta.httpMetadata.contentEncoding, 'gzip'); assert.equal(meta.httpMetadata.contentType, 'text/plain');
  const txt = await gunzip(r2.store.get(ARCHIVE_KEYS.file('spec', '46026', '2026-11-09')) as Uint8Array), lines = txt.split('\n');
  assert.equal(lines[0], HDR.split('\n')[0]); assert.equal(lines.filter((l) => /^2026 11 09 /.test(l)).length, 24); assert.ok(!lines.some((l) => /^2026 11 08 /.test(l)));
  const man = JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string);
  assert.equal(man.runs.length, 1); assert.equal(man.runs[0].entries.length, 2); assert.deepEqual(man.runs[0].entries.map((e: any) => [e.kind, e.status, e.days, e.first, e.last]), [['spec', 'ok', 3, '2026-11-07', '2026-11-09'], ['data_spec', 'ok', 3, '2026-11-07', '2026-11-09']]);
});
test('writes are idempotent: a rerun writes the same keys with the same bytes; the manifest gains a run, the objects do not multiply', async () => {
  const r2 = fakeR2(), n = fakeNdbc((id, k) => synth(k, NOW)), a = make(n, () => NOW, {buoys: ['46026', '51201']});
  await r2.bucket.put(ARCHIVE_KEYS.cursor, JSON.stringify({schema: 1, backfill: {done: true}, headers: {}}));
  await a.run({BUCKET: r2.bucket});
  const first = new Map(gzKeys(r2.store).map((k) => [k, Buffer.from(r2.store.get(k) as Uint8Array).toString('base64')]));
  await a.run({BUCKET: r2.bucket});
  const second = new Map(gzKeys(r2.store).map((k) => [k, Buffer.from(r2.store.get(k) as Uint8Array).toString('base64')]));
  assert.equal(first.size, 12); assert.deepEqual([...second], [...first]);
  assert.equal(JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs.length, 2);
});
test('a 404 and an empty file are recorded, not retried; a network error retries twice and is recorded; the other buoys are archived', async () => {
  const r2 = fakeR2(), n = fakeNdbc((id, k) => id === '41065' && k === 'data_spec' ? 404 : id === '44013' ? null : id === '44022' ? '' : synth(k, NOW));
  const a = make(n, () => NOW, {buoys: ['41065', '44013', '44022', '46026']});
  await r2.bucket.put(ARCHIVE_KEYS.cursor, JSON.stringify({schema: 1, backfill: {done: true}, headers: {}}));
  const rep = await a.run({BUCKET: r2.bucket});
  const e = JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs[0].entries as {buoy: string; kind: string; status: string}[];
  const st = (b: string, k: string) => e.find((x) => x.buoy === b && x.kind === k)!.status;
  assert.equal(st('41065', 'data_spec'), '404'); assert.equal(st('41065', 'spec'), 'ok'); assert.match(st('44013', 'spec'), /^error/); assert.equal(st('44022', 'spec'), 'empty'); assert.equal(st('46026', 'spec'), 'ok');
  assert.equal(n.log.filter((u) => u.includes('41065.data_spec')).length, 1, '404 is not retried'); assert.equal(n.log.filter((u) => u.includes('44013.spec')).length, 3, 'two retries');
  assert.equal(rep.failures, 5); assert.ok(gzKeys(r2.store).some((k) => k.includes('/46026/')));
});
test('a changed header is archived, not lost, and the manifest flags it; a buoy whose swell fields are all MM is kept and noted', async () => {
  const r2 = fakeR2(); let hdr = HDR;
  const n = fakeNdbc((id, k) => id === '41065' ? synth(k, NOW, undefined, 'MM MM MM MM MM MM MM 6.0 230') : synth(k, NOW, k === 'spec' ? hdr : undefined));
  const a = make(n, () => NOW, {buoys: ['46026']}); await r2.bucket.put(ARCHIVE_KEYS.cursor, JSON.stringify({schema: 1, backfill: {done: true}, headers: {}}));
  await a.run({BUCKET: r2.bucket}); hdr = HDR.replace('SwH', 'SWH2');
  await a.run({BUCKET: r2.bucket});
  const runs = JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs;
  assert.ok(!runs[0].entries[0].headerChanged); assert.equal(runs[1].entries[0].headerChanged, true); assert.equal(runs[1].entries[1].headerChanged, undefined);
  assert.ok((await gunzip(r2.store.get(ARCHIVE_KEYS.file('spec', '46026', '2026-11-09')) as Uint8Array)).includes('SWH2'));
  const b = make(n, () => NOW, {buoys: ['41065']}); await b.run({BUCKET: r2.bucket});
  const e = JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs[2].entries[0]; assert.equal(e.status, 'ok'); assert.match(e.note, /no swell values/);
});
test('a failed R2 write is recorded and the cursor still moves', async () => {
  const r2 = fakeR2(new Map(), {failPut: (k) => k.includes('/2026-11-08.')}), n = fakeNdbc((id, k) => synth(k, NOW)), a = make(n, () => NOW, {buoys: ['46026']});
  await r2.bucket.put(ARCHIVE_KEYS.cursor, JSON.stringify({schema: 1, backfill: {done: true}, headers: {}}));
  const rep = await a.run({BUCKET: r2.bucket});
  assert.equal(rep.failures, 2); assert.ok(!gzKeys(r2.store).some((k) => k.includes('2026-11-08'))); assert.ok(gzKeys(r2.store).some((k) => k.includes('2026-11-09')));
  assert.equal(JSON.parse(r2.store.get(ARCHIVE_KEYS.cursor) as string).lastDay, '2026-11-09');
});
test('the cursor: a 73-buoy 45-day backfill resumes across invocations, every invocation stays under the 800-subrequest budget, then it switches to the daily mode', async () => {
  const r2 = fakeR2(), n = fakeNdbc((id, k) => synth(k, NOW)); let clock = NOW; const a = make(n, () => clock);
  const runs: any[] = [], used: number[] = [];
  for (let i = 0; i < 12 && !runs.at(-1)?.backfill?.startsWith?.('done'); i++) {
    r2.ops.gets = 0; r2.ops.puts = 0; n.log.length = 0; const rep = await a.run({BUCKET: r2.bucket, }, {backfillOnly: i > 0}); runs.push(rep);
    used.push(n.log.length + r2.ops.gets + r2.ops.puts); assert.ok(rep.used <= ARCHIVE_BUDGET); assert.ok(used.at(-1)! <= ARCHIVE_BUDGET, `invocation ${i}: ${used.at(-1)} real operations`); clock += 600000;
  }
  assert.equal(runs.at(-1).backfill, 'done'); assert.ok(runs.length >= 9 && runs.length <= 11, `${runs.length} invocations`);
  assert.deepEqual(runs.map((r) => r.mode), runs.map(() => 'backfill'));
  const cur = JSON.parse(r2.store.get(ARCHIVE_KEYS.cursor) as string); assert.equal(cur.backfill.done, true); assert.equal(cur.backfill.next, 73); assert.equal(cur.lastDay, '2026-11-09');
  // every buoy has every one of the 45 complete days, for both files
  const keys = gzKeys(r2.store); assert.equal(keys.length, 73 * 2 * BACKFILL_DAYS);
  for (const id of ARCHIVE_BUOYS) assert.equal(keys.filter((k) => k.includes('/spec/' + id + '/')).length, BACKFILL_DAYS);
  // the cursor never skips or repeats a buoy: the fetch log of the runs covers each buoy once
  const seen = new Map<string, number>(); for (const m of Object.values(JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs) as any[]) for (const e of m.entries) if (e.kind === 'spec') seen.set(e.buoy, (seen.get(e.buoy) ?? 0) + 1);
  assert.equal(seen.size, 73); assert.ok([...seen.values()].every((c) => c === 1));
  // finished: an extra tick is a one-read no-op; the next day's tick is the daily mode over all 73 buoys with its own budget
  r2.ops.gets = 0; r2.ops.puts = 0; n.log.length = 0; const noop = await a.run({BUCKET: r2.bucket}, {backfillOnly: true}); assert.equal(noop.mode, 'noop'); assert.equal(r2.ops.gets + r2.ops.puts + n.log.length, 1);
  clock = NOW + DAY; r2.ops.gets = 0; r2.ops.puts = 0; n.log.length = 0;
  const d = await a.run({BUCKET: r2.bucket}); assert.equal(d.mode, 'daily'); assert.equal(d.buoys, 73);
  const ops = n.log.length + r2.ops.gets + r2.ops.puts; assert.ok(ops <= ARCHIVE_BUDGET, `${ops} daily operations`); assert.equal(n.log.length, 146);
  if (process.env.SHOW) console.log(`backfill: ${runs.length} invocations, per-invocation operations ${used.join(', ')}; daily run ${ops} operations (${n.log.length} GETs)`);
});
test('the daily run on the second day takes the new day and rewrites the others unchanged (partial days are completed by the next run)', async () => {
  const r2 = fakeR2(), clock = {t: NOW}; const n = fakeNdbc((id, k) => synth(k, clock.t)), a = make(n, () => clock.t, {buoys: ['46026']});
  await r2.bucket.put(ARCHIVE_KEYS.cursor, JSON.stringify({schema: 1, backfill: {done: true}, headers: {}}));
  await a.run({BUCKET: r2.bucket}); const before = Buffer.from(r2.store.get(ARCHIVE_KEYS.file('spec', '46026', '2026-11-08')) as Uint8Array).toString('base64');
  clock.t = NOW + DAY; await a.run({BUCKET: r2.bucket});
  assert.equal(Buffer.from(r2.store.get(ARCHIVE_KEYS.file('spec', '46026', '2026-11-08')) as Uint8Array).toString('base64'), before);
  assert.ok(r2.store.has(ARCHIVE_KEYS.file('spec', '46026', '2026-11-10'))); assert.ok(r2.store.has(ARCHIVE_KEYS.manifest('2026-11-11')));
});
test('no bucket: nothing runs', async () => { assert.equal((await make(fakeNdbc(() => ''), () => NOW).run({})).ok, false); });
test('the Worker: its own cron expressions run the archive (the 5-minute cron still refreshes), and wrangler.jsonc lists all three triggers', async () => {
  const w = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  for (const c of ['*/5 * * * *', ARCHIVE_CRON, BACKFILL_CRON]) assert.ok(w.includes(`"${c}"`), c);
  assert.equal(ARCHIVE_CRON, '17 6 * * *'); assert.ok(CRON.everyMs === 300000);
  assert.equal(typeof (cron as any).scheduled, 'function'); assert.notEqual(ARCHIVE_CRON, BACKFILL_CRON);
});

// ---- review round: retry list, read errors, partial days, deadline, missing days, gzip failure ----
const done = (r2: ReturnType<typeof fakeR2>) => r2.bucket.put(ARCHIVE_KEYS.cursor, JSON.stringify({schema: 1, backfill: {done: true}, headers: {}}));
test('backfill retry list: a buoy that fails (http 503, network error) is not lost when the cursor moves on; the backfill is not done until it succeeded; 404 and empty are terminal', async () => {
  const r2 = fakeR2(); let broken = true; const log: string[] = [];
  const n = fakeNdbc((id, k) => id === '44013' && broken ? 503 : id === '44022' ? 404 : id === '44025' ? '' : synth(k, NOW), log); let clock = NOW; const a = make(n, () => clock, {buoys: ['46026', '44013', '44022', '44025']});
  const r1 = await a.run({BUCKET: r2.bucket}); assert.equal(r1.mode, 'backfill');
  let cur = JSON.parse(r2.store.get(ARCHIVE_KEYS.cursor) as string);
  assert.equal(cur.backfill.next, 4); assert.equal(cur.backfill.done, false, 'not done with a failed buoy'); assert.deepEqual(cur.backfill.retry.map((r: any) => r.buoy), ['44013']); assert.match(cur.backfill.retry[0].last, /http 503/);
  assert.equal(log.filter((u) => /\/44022\./.test(u)).length, 2, '404: one try per file, terminal'); assert.equal(log.filter((u) => /\/44013\./.test(u)).length, 6, 'failed buoy: tried (3 tries per file) once in this run, not again right away');
  broken = true; clock += 3600000; const r2nd = await a.run({BUCKET: r2.bucket}, {backfillOnly: true}); assert.equal(r2nd.mode, 'backfill'); assert.match(String(r2nd.backfill), /retrying 44013/);
  cur = JSON.parse(r2.store.get(ARCHIVE_KEYS.cursor) as string); assert.equal(cur.backfill.done, false); assert.equal(cur.backfill.retry[0].attempts, 2);
  broken = false; clock += 3600000; const r3 = await a.run({BUCKET: r2.bucket}, {backfillOnly: true}); assert.equal(r3.backfill, 'done');
  cur = JSON.parse(r2.store.get(ARCHIVE_KEYS.cursor) as string); assert.deepEqual(cur.backfill.retry, []); assert.equal(cur.backfill.done, true);
  assert.equal(gzKeys(r2.store).filter((k) => k.includes('/44013/')).length, 2 * BACKFILL_DAYS, 'the retried buoy has its whole history');
  assert.equal((await make(n, () => clock + 3600000, {buoys: ['46026']}).run({BUCKET: r2.bucket}, {backfillOnly: true})).mode, 'noop');
});
test('backfill retry list: a buoy that keeps failing is abandoned after the attempt limit, visibly, and the backfill then completes', async () => {
  const r2 = fakeR2(), n = fakeNdbc((id, k) => id === '44013' ? 503 : synth(k, NOW)); let clock = NOW; const a = make(n, () => clock, {buoys: ['46026', '44013']});
  let last: any; for (let i = 0; i < 20 && !/done/.test(String(last?.backfill)); i++) { last = await a.run({BUCKET: r2.bucket}, {backfillOnly: i > 0}); clock += 3600000; }
  const cur = JSON.parse(r2.store.get(ARCHIVE_KEYS.cursor) as string); assert.equal(cur.backfill.done, true); assert.deepEqual(cur.backfill.abandoned.map((r: any) => r.buoy), ['44013']); assert.ok(cur.backfill.abandoned[0].attempts > 12);
  assert.deepEqual(JSON.parse(r2.store.get(ARCHIVE_KEYS.status) as string).backfill.abandoned.map((r: any) => r.buoy), ['44013']);
});
test('an R2 read that throws is not "no cursor": the run aborts with no fetch and no write; a missing cursor is a fresh start', async () => {
  const r2 = fakeR2(new Map(), {failGet: (k) => k === ARCHIVE_KEYS.cursor}), log: string[] = [], n = fakeNdbc((id, k) => synth(k, NOW), log);
  const rep = await make(n, () => NOW, {buoys: ['46026']}).run({BUCKET: r2.bucket});
  assert.equal(rep.ok, false); assert.match(String(rep.reason), /R2 read/); assert.equal(r2.ops.puts, 0); assert.equal(log.length, 0); assert.equal(r2.store.size, 0);
  const fresh = fakeR2(), rep2 = await make(fakeNdbc((id, k) => synth(k, NOW)), () => NOW, {buoys: ['46026']}).run({BUCKET: fresh.bucket}); assert.equal(rep2.ok, true); assert.equal(rep2.mode, 'backfill');
});
test('a manifest read that throws does not erase the earlier runs of the day: this run goes to its own manifest object', async () => {
  const r2 = fakeR2(), n = fakeNdbc((id, k) => synth(k, NOW)), a = make(n, () => NOW, {buoys: ['46026']}); await done(r2); await a.run({BUCKET: r2.bucket});
  const before = r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10'));
  const bad = fakeR2(r2.store, {failGet: (k) => k.includes('_manifest/')}); await make(n, () => NOW, {buoys: ['46026']}).run({BUCKET: bad.bucket});
  assert.equal(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')), before); assert.ok([...r2.store.keys()].some((k) => /_manifest\/2026-11-10\.run-\d+\.json$/.test(k)));
});
test('a partial copy never replaces a more complete one: the first (partial) day of a file keeps the larger archived copy, and the manifest marks it partial', async () => {
  const r2 = fakeR2(); await done(r2); const T1 = Date.UTC(2026, 10, 10, 6, 17), HOURS_ROWS = 24;
  // a file that begins mid-day on 2026-11-07 (the oldest day of a 45-day window, or a reset file)
  const trimmed = (kind: 'spec' | 'data_spec', from: number) => { const f = synth(kind, T1).split('\n'), keep = f.filter((l) => l.startsWith('#') || (l && Date.UTC(+l.slice(0, 4), +l.slice(5, 7) - 1, +l.slice(8, 10), +l.slice(11, 13), +l.slice(14, 16)) >= from)); return keep.join('\n') + '\n'; };
  await make(fakeNdbc((id, k) => synth(k, T1)), () => T1, {buoys: ['46026']}).run({BUCKET: r2.bucket});   // complete 11-07..11-09
  const key = ARCHIVE_KEYS.file('spec', '46026', '2026-11-07'), full = r2.store.get(key) as Uint8Array;
  assert.equal(((r2.ops.meta.get(key) as any).customMetadata.rows), String(HOURS_ROWS)); assert.equal((r2.ops.meta.get(key) as any).customMetadata.partial, 'false');
  await make(fakeNdbc((id, k) => trimmed(k, Date.UTC(2026, 10, 7, 15))), () => T1 + 600000, {buoys: ['46026']}).run({BUCKET: r2.bucket});
  assert.equal(r2.store.get(key), full, 'the fuller copy is kept'); assert.equal(((r2.ops.meta.get(key) as any).customMetadata.rows), String(HOURS_ROWS));
  const e = JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs.at(-1).entries[0]; assert.deepEqual(e.partialDays, ['2026-11-07']); assert.deepEqual(e.keptLarger, ['2026-11-07']);
  // a first day that is partial and the only copy is written (and flagged partial); a later complete copy replaces it
  const r3 = fakeR2(); await done(r3);
  await make(fakeNdbc((id, k) => trimmed(k, Date.UTC(2026, 10, 7, 15))), () => T1, {buoys: ['46026']}).run({BUCKET: r3.bucket});
  assert.equal((r3.ops.meta.get(key) as any).customMetadata.partial, 'true'); assert.ok(Number((r3.ops.meta.get(key) as any).customMetadata.rows) < HOURS_ROWS);
  await make(fakeNdbc((id, k) => synth(k, T1)), () => T1 + 600000, {buoys: ['46026']}).run({BUCKET: r3.bucket});
  assert.equal((r3.ops.meta.get(key) as any).customMetadata.rows, String(HOURS_ROWS)); assert.equal((r3.ops.meta.get(key) as any).customMetadata.partial, 'false');
});
test('the run deadline: a slow run stops starting buoys, still writes manifest, cursor and status, and the cursor stays at the first buoy not done', async () => {
  const r2 = fakeR2(); let clock = NOW; const slow = fakeNdbc((id, k) => { clock += 200000; return synth(k, NOW); });
  const a = make(slow, () => clock, {buoys: ['46026', '51201', '44013', '44022'], deadlineMs: 600000});
  const rep = await a.run({BUCKET: r2.bucket}); assert.equal(rep.stoppedBy, 'deadline'); assert.ok(rep.buoys < 4 && rep.buoys >= 1);
  const cur = JSON.parse(r2.store.get(ARCHIVE_KEYS.cursor) as string); assert.equal(cur.backfill.next, rep.buoys); assert.equal(cur.backfill.done, false);
  assert.ok(r2.store.has(ARCHIVE_KEYS.manifest('2026-11-10')) && r2.store.has(ARCHIVE_KEYS.status));
  assert.equal(JSON.parse(r2.store.get(ARCHIVE_KEYS.status) as string).stoppedBy, 'deadline');
});
test('missingDays: an ok file that lacks a day it should have (an NDBC outage) is recorded in the manifest', async () => {
  const r2 = fakeR2(); await done(r2);
  const gap = (k: 'spec' | 'data_spec') => synth(k, NOW).split('\n').filter((l) => !/^2026 11 08 /.test(l)).join('\n');
  await make(fakeNdbc((id, k) => gap(k)), () => NOW, {buoys: ['46026']}).run({BUCKET: r2.bucket});
  const e = JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs[0].entries; assert.deepEqual(e[0].missingDays, ['2026-11-08']); assert.equal(e[0].status, 'ok'); assert.ok(!gzKeys(r2.store).some((k) => k.includes('2026-11-08')));
  const r3 = fakeR2(); await done(r3); await make(fakeNdbc((id, k) => synth(k, NOW)), () => NOW, {buoys: ['46026']}).run({BUCKET: r3.bucket});
  assert.equal(JSON.parse(r3.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs[0].entries[0].missingDays, undefined);
});
test('a gzip failure is a recorded put failure, not a crashed run: manifest, cursor and status are still written', async () => {
  const r2 = fakeR2(); await done(r2); const Orig = globalThis.CompressionStream;
  (globalThis as any).CompressionStream = class { constructor() { throw new Error('gzip down'); } };
  try { const rep = await make(fakeNdbc((id, k) => synth(k, NOW)), () => NOW, {buoys: ['46026']}).run({BUCKET: r2.bucket}); assert.equal(rep.ok, true); assert.equal(rep.failures, 2); }
  finally { (globalThis as any).CompressionStream = Orig; }
  assert.ok(r2.store.has(ARCHIVE_KEYS.manifest('2026-11-10'))); assert.equal(JSON.parse(r2.store.get(ARCHIVE_KEYS.manifest('2026-11-10')) as string).runs[0].entries[0].status, 'put failed');
});
