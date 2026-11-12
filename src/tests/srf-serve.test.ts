import test from 'node:test';
import assert from 'node:assert/strict';
import {slimProduct, createSrfServe, serveKey, OFFICES} from '../../services/srf-serve.mjs';
import {SRF_OFFICES} from '../../services/surf-capture.mjs';
import {createSurfCapture, KEYS} from '../../services/surf-capture.mjs';

const TEXT = `000
FZUS56 KMTR 110626
SRFMTR

NORTHERN AND CENTRAL CALIFORNIA SURF ZONE FORECAST
NATIONAL WEATHER SERVICE SAN FRANCISCO BAY AREA
1026 PM PST Tue Nov 10 2026

CAZ509-112000-
SAN FRANCISCO AND SAN MATEO COUNTY COASTAL AREAS-
1026 PM PST Tue Nov 10 2026


.WEDNESDAY...
Surf Height...................Northwest Facing Beaches - 7 to 11 feet.
                              South Facing Beaches - 3 to 5 feet.
Thunderstorm Potential........None expected.
Wind..........................N at 5 MPH becoming N at 3 MPH.

.THURSDAY...
Surf Height...................West Facing Beaches - 10 to 14 feet.
Weather.......................Mostly cloudy.

$$
`;
const prod = (id: string, at: string, text = TEXT) => ({id, issuingOffice: 'KMTR', issuanceTime: at, productText: text});

test('the served office list is the capture\'s office list', () => assert.deepEqual([...OFFICES], [...SRF_OFFICES]));
test('slimProduct keeps what a headline needs (zones, periods, surf entries as written) and drops weather, wind, tides', () => {
  const s = slimProduct(prod('00000000-aaaa-bbbb-cccc-000000000001', '2026-11-11T06:26:00+00:00'), 'MTR');
  assert.ok(s); assert.equal(s!.office, 'MTR'); assert.equal(s!.zones.length, 1); assert.deepEqual(s!.zones[0].ugc, ['CAZ509']); assert.equal(s!.zones[0].expires, '112000');
  assert.equal(s!.zones[0].periods[0].date, '2026-11-11'); assert.equal(s!.zones[0].periods[0].surf[0].lo, 7); assert.equal(s!.zones[0].periods[0].surf[0].facing, 'northwest');
  assert.ok(!JSON.stringify(s).match(/Thunderstorm|Mostly cloudy|MPH/));
});
test('a product with no readable surf is not served', () => assert.equal(slimProduct(prod('00000000-aaaa-bbbb-cccc-000000000002', '2026-11-11T06:26:00+00:00', 'garbage text with no zones'), 'MTR'), null));
const bucket = (store: Map<string, string>, failGet = false) => ({get: async (k: string) => { if (failGet) throw new Error('r2 down'); const v = store.get(k); return v === undefined ? null : {json: async () => JSON.parse(v), text: async () => v}; }, put: async (k: string, v: string) => { store.set(k, typeof v === 'string' ? v : String(v)); }});
test('/api/srf: a stored office is served, an unknown office is a 400, a missing one is product null, an R2 failure is a 503 (never "no product")', async () => {
  const store = new Map<string, string>(); const srv = createSrfServe({now: () => Date.parse('2026-11-11T12:00:00Z')});
  store.set(serveKey('MTR'), JSON.stringify({schema: 1, office: 'MTR', id: 'x', issuedAt: '2026-11-11T06:26:00+00:00', zones: []}));
  const ok = await srv.respond({BUCKET: bucket(store)}, new URL('https://x/api/srf?office=mtr')); assert.equal(ok.status, 200); const j: any = await ok.json(); assert.equal(j.office, 'MTR'); assert.equal(j.product.id, 'x');
  assert.equal((await srv.respond({BUCKET: bucket(store)}, new URL('https://x/api/srf?office=ZZZ'))).status, 400);
  assert.equal(((await (await srv.respond({BUCKET: bucket(store)}, new URL('https://x/api/srf?office=HFO'))).json()) as any).product, null);
  assert.equal((await srv.respond({BUCKET: bucket(store, true)}, new URL('https://x/api/srf?office=MTR'))).status, 503);
});
test('the capture writes the newest parsed product per office under serve/srf/<OFFICE>.json', async () => {
  const store = new Map<string, string>(); let n = 0;
  const id = (i: number) => `00000000-aaaa-bbbb-cccc-0000000000${String(i).padStart(2, '0')}`;
  const fetcher = async (url: string) => {
    if (/products\/types\/SRF\/locations\/MTR/.test(url)) return new Response(JSON.stringify({'@graph': [{id: id(2), issuanceTime: '2026-11-11T12:35:00+00:00', issuingOffice: 'KMTR'}, {id: id(1), issuanceTime: '2026-11-11T06:26:00+00:00', issuingOffice: 'KMTR'}]}), {status: 200});
    if (/locations\//.test(url)) return new Response(JSON.stringify({'@graph': []}), {status: 200});
    const m = /products\/([\w-]+)$/.exec(url); n++;
    return new Response(JSON.stringify(prod(m![1], m![1] === id(2) ? '2026-11-11T12:35:00+00:00' : '2026-11-11T06:26:00+00:00')), {status: 200});
  };
  const cap = createSurfCapture({fetcher: fetcher as any, now: () => Date.parse('2026-11-11T14:00:00Z'), sleep: async () => {}, politeMs: 0});
  const out = await cap.srf({BUCKET: bucket(store)} as any); assert.equal(out.ok, true);
  const served = JSON.parse(store.get(serveKey('MTR'))!); assert.equal(served.id, id(2)); assert.equal(served.issuedAt, '2026-11-11T12:35:00+00:00');
  assert.ok(store.has(KEYS.srf('MTR', id(1))) && store.has(KEYS.srf('MTR', id(2))));
  assert.ok(![...store.keys()].some((k) => k === serveKey('BOX')), 'no product, nothing served');
});
test('the served product never regresses: an older backlog drained after the newest was served does not overwrite it (Codex P1)', async () => {
  const {MAX_PER_OFFICE} = await import('../../services/surf-capture.mjs');
  const store = new Map<string, string>(), N = MAX_PER_OFFICE + 6, id = (i: number) => `00000000-aaaa-bbbb-cccc-${String(i).padStart(12, '0')}`, at = (i: number) => new Date(Date.parse('2026-11-01T00:00:00Z') + i * 3600000).toISOString().replace('.000Z', '+00:00');
  const fetcher = async (url: string) => {
    if (/products\/types\/SRF\/locations\/MTR/.test(url)) return new Response(JSON.stringify({'@graph': [...Array(N).keys()].reverse().map((i) => ({id: id(i), issuanceTime: at(i), issuingOffice: 'KMTR'}))}), {status: 200});
    if (/locations\//.test(url)) return new Response(JSON.stringify({'@graph': []}), {status: 200});
    const m = /products\/([\w-]+)$/.exec(url)!; const i = Number(m[1].slice(-12)); return new Response(JSON.stringify(prod(m[1], at(i))), {status: 200});
  };
  const cap = createSurfCapture({fetcher: fetcher as any, now: () => Date.parse('2026-11-11T14:00:00Z'), sleep: async () => {}, politeMs: 0, budgets: {gauges: 48, srf: 400, swan: 80}});
  const env = {BUCKET: bucket(store)} as any;
  await cap.srf(env); assert.equal(JSON.parse(store.get(serveKey('MTR'))!).id, id(N - 1), 'first run serves the newest');
  const archived1 = [...store.keys()].filter((k) => /archive\/surf-height\/srf\/MTR\//.test(k)).length; assert.equal(archived1, MAX_PER_OFFICE);
  await cap.srf(env); const after = [...store.keys()].filter((k) => /archive\/surf-height\/srf\/MTR\//.test(k)).length; assert.equal(after, N, 'the backlog drained');
  assert.equal(JSON.parse(store.get(serveKey('MTR'))!).id, id(N - 1), 'the served product is still the newest');
});
