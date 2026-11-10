import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {listKeys, archiveMetadata, signV4, s3Transport, runUpload, contentTypeOf, BUCKET} from '../../scripts/r2-upload-local.mjs';

const HDR = '#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD\n#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT\n';
const row = (h: number, m: number) => `2026 11 09 ${String(h).padStart(2, '0')} ${String(m).padStart(2, '0')}  1.5  1.2 11.0  0.5  5.0  SW   W    SWELL  6.0 230`;
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'r2fix-')), put = (k: string, v: string | Buffer) => { mkdirSync(dirname(join(dir, k)), {recursive: true}); writeFileSync(join(dir, k), v); };
  put('archive/ndbc/spec/46026/2026/2026-11-09.spec.gz', gzipSync(HDR + [row(23, 56), row(0, 26)].join('\n') + '\n'));          // newest first, complete day
  put('archive/ndbc/spec/46026/2026/2026-09-26.spec.gz', gzipSync(HDR + [row(23, 56), row(14, 26)].join('\n') + '\n'));         // starts at 14:26: partial
  put('archive/ndbc/data_spec/46026/2026/2026-11-09.data_spec.gz', gzipSync(HDR + row(0, 0) + '\n'));
  put('archive/ndbc/_manifest/2026-11-10.json', '{"runs":[]}'); put('archive/ndbc/_cursor.json', '{"backfill":{"done":true}}'); put('archive/ndbc/_status.json', '{}');
  put('howright/v2/shown/2026-11-10.json', '{"schema":2}'); put('howright/v2/scorecard.json', '{"schema":2}'); put('howright/v2/_status.json', '{}'); put('howright/v2/_score-partial.json', '{}');
  put('forecast/v10/hot/spot-1', '1'); put('notes.txt', 'x'); put('howright/v1/scorecard.json', '{}');
  return dir;
};

test('only archive/ndbc/ and howright/v2/ are ever listed (never forecast/, howright/v1, stray files, the transient partial); day objects first, status then cursor last', () => {
  const keys = listKeys(fixture());
  assert.deepEqual(keys, ['archive/ndbc/data_spec/46026/2026/2026-11-09.data_spec.gz', 'archive/ndbc/spec/46026/2026/2026-09-26.spec.gz', 'archive/ndbc/spec/46026/2026/2026-11-09.spec.gz', 'howright/v2/shown/2026-11-10.json',
    'archive/ndbc/_manifest/2026-11-10.json', 'howright/v2/scorecard.json', 'archive/ndbc/_status.json', 'howright/v2/_status.json', 'archive/ndbc/_cursor.json']);
  assert.deepEqual(listKeys('/nonexistent/dir'), []);
  assert.equal(BUCKET, 'swello-forecast-cache'); assert.equal(contentTypeOf('a.spec.gz'), 'text/plain'); assert.equal(contentTypeOf('x.json'), 'application/json');
});
test('the customMetadata the Worker writes (rows, first, last, partial) is rebuilt from the gzip contents', () => {
  const body = gzipSync(HDR + [row(23, 56), row(14, 26)].join('\n') + '\n');
  assert.deepEqual(archiveMetadata('archive/ndbc/spec/46026/2026/2026-09-26.spec.gz', body), {rows: '2', first: '2026 11 09 14 26', last: '2026 11 09 23 56', partial: 'true'});
  assert.equal(archiveMetadata('archive/ndbc/spec/46026/2026/2026-11-09.spec.gz', gzipSync(HDR + [row(23, 56), row(0, 26)].join('\n')))!.partial, 'false');
  assert.equal(archiveMetadata('archive/ndbc/_manifest/2026-11-10.json', Buffer.from('{}')), null); assert.equal(archiveMetadata('archive/ndbc/spec/x/2026/d.spec.gz', gzipSync(HDR)), null);
});
test('SigV4 matches the AWS documentation example (GET Object with a Range header)', () => {
  const s = signV4({method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', headers: {Range: 'bytes=0-9'}, body: '', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', service: 's3', date: new Date('2013-05-24T00:00:00Z')});
  assert.equal(s._signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  assert.match(s.authorization, /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/us-east-1\/s3\/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb8/);
});
const fakeBucket = (have: Set<string> = new Set()) => { const calls: {m: string; k: string; h: Record<string, string>}[] = [];
  const fetcher = (async (url: string, o: {method: string; headers: Record<string, string>}) => { const k = decodeURIComponent(new URL(url).pathname.slice(`/${BUCKET}/`.length)); calls.push({m: o.method, k, h: o.headers}); if (o.method === 'HEAD') return new Response(null, {status: have.has(k) ? 200 : 404}); have.add(k); return new Response('', {status: 200}); }) as unknown as typeof fetch;
  return {calls, have, transport: s3Transport({accountId: 'acct', accessKeyId: 'AK', secretAccessKey: 'SK', fetcher, now: () => new Date('2026-11-10T08:00:00Z')})}; };
test('dry run writes nothing and lists what would upload; keys already in the bucket are skipped (head first)', async () => {
  const dir = fixture(), fb = fakeBucket(new Set(['howright/v2/scorecard.json', 'archive/ndbc/_cursor.json']));
  const r = await runUpload({dir, transport: fb.transport, upload: false});
  assert.equal(r.total, 9); assert.equal(r.exists, 2); assert.equal(r.toUpload, 7); assert.equal(r.uploaded, 0); assert.ok(fb.calls.every((c) => c.m === 'HEAD'), 'no PUT in a dry run');
  const plan = await runUpload({dir, transport: null, upload: false}); assert.equal(plan.toUpload, 9, 'no transport: the local plan only');
});
test('upload: skips what exists, puts the rest with content type, gzip encoding and the archive customMetadata as x-amz-meta-*; status and cursor go last; credentials are never in a header value', async () => {
  const dir = fixture(), fb = fakeBucket(new Set(['howright/v2/scorecard.json']));
  const r = await runUpload({dir, transport: fb.transport, upload: true, concurrency: 3});
  assert.equal(r.uploaded, 8); assert.equal(r.exists, 1); assert.deepEqual(r.failed, []);
  const puts = fb.calls.filter((c) => c.m === 'PUT'); assert.ok(!puts.some((c) => c.k === 'howright/v2/scorecard.json'));
  const order = puts.map((c) => c.k); assert.equal(order.at(-1), 'archive/ndbc/_cursor.json'); assert.ok(order.indexOf('archive/ndbc/_status.json') > order.indexOf('archive/ndbc/_manifest/2026-11-10.json'));
  const partial = puts.find((c) => c.k.endsWith('2026-09-26.spec.gz'))!; assert.equal(partial.h['content-encoding'], 'gzip'); assert.equal(partial.h['content-type'], 'text/plain'); assert.equal(partial.h['x-amz-meta-rows'], '2'); assert.equal(partial.h['x-amz-meta-partial'], 'true'); assert.equal(partial.h['x-amz-meta-first'], '2026 11 09 14 26');
  assert.equal(puts.find((c) => c.k === 'archive/ndbc/_cursor.json')!.h['content-type'], 'application/json'); assert.equal(puts.find((c) => c.k === 'archive/ndbc/_cursor.json')!.h['x-amz-meta-rows'], undefined);
  for (const c of fb.calls) { assert.match(c.h.authorization, /^AWS4-HMAC-SHA256 Credential=AK\/20261110\/auto\/s3\/aws4_request, SignedHeaders=/); assert.ok(!Object.values(c.h).some((v) => /SK/.test(v) && !/^[0-9a-f]{64}$/.test(v) && !/Signature=/.test(v))); }
  const again = await runUpload({dir, transport: fb.transport, upload: true}); assert.equal(again.uploaded, 0); assert.equal(again.exists, 9, 'a second run uploads nothing');
});
test('a failed upload stops before the status and cursor, so the bucket never has a cursor ahead of its files', async () => {
  const dir = fixture(), calls: string[] = [];
  const transport = {head: async () => false, put: async (k: string) => { calls.push(k); if (k.includes('2026-09-26')) throw new Error('boom'); }};
  const r = await runUpload({dir, transport, upload: true, concurrency: 1}); assert.equal(r.failed.length, 1); assert.ok(!calls.includes('archive/ndbc/_cursor.json')); assert.ok(!calls.includes('archive/ndbc/_status.json'));
});
