import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDodsGrid, packOceanGrid, createForecastService} from '../../services/forecast-service.mjs';

// Stage 2a: a native 0.5-degree global frame through ERDDAP's OPeNDAP binary (.dods).
const dods = (nlat: number, nlon: number, values: number[], lats: number[], lons: number[], depth = true, f64maps = false) => {
  const head = `Dataset {\n  GRID {\n    ARRAY:\n      Float32 Thgt[time = 1]${depth ? '[depth = 1]' : ''}[latitude = ${nlat}][longitude = ${nlon}];\n    MAPS:\n      Float64 time[time = 1];\n${depth ? '      Float32 depth[depth = 1];\n' : ''}      ${f64maps ? 'Float64' : 'Float32'} latitude[latitude = ${nlat}];\n      ${f64maps ? 'Float64' : 'Float32'} longitude[longitude = ${nlon}];\n  } Thgt;\n} ww3_global;\nData:\n`;
  const h = new TextEncoder().encode(head), body = new ArrayBuffer(64 + values.length * 4 + (lats.length + lons.length) * 8), v = new DataView(body); let o = 0;
  const u32 = (n: number) => { v.setUint32(o, n); o += 4; }, f32 = (n: number) => { v.setFloat32(o, n); o += 4; };
  u32(values.length); u32(values.length); values.forEach(f32); u32(1); u32(1); v.setFloat64(o, 1.79e9); o += 8; if (depth) { u32(1); u32(1); f32(0); } const fm = (n: number) => { if (f64maps) { v.setFloat64(o, n); o += 8; } else f32(n); }; u32(lats.length); u32(lats.length); lats.forEach(fm); u32(lons.length); u32(lons.length); lons.forEach(fm);
  const out = new Uint8Array(h.length + o); out.set(h); out.set(new Uint8Array(body, 0, o), h.length); return out.buffer;
};
const NaNv = Number.NaN;
test('parseDodsGrid reads the array and its latitude and longitude maps, NaN included', () => {
  const g = parseDodsGrid(dods(2, 3, [1, 2, NaNv, 4, 5, 6], [10, 10.5], [0, 0.5, 1]));
  assert.equal(g.nlat, 2); assert.equal(g.nlon, 3); assert.equal(Math.round(g.values[1] * 100) / 100, 2); assert.ok(Number.isNaN(g.values[2])); assert.deepEqual([...g.lats], [10, 10.5]); assert.deepEqual([...g.lons], [0, 0.5, 1]);
  assert.throws(() => parseDodsGrid(new TextEncoder().encode('no marker here').buffer));
});
test('parseDodsGrid also reads the wind dataset: no depth axis, Float64 coordinate maps', () => {
  const g = parseDodsGrid(dods(2, 3, [1, 2, 3, 4, 5, 6], [10, 10.5], [0, 0.5, 1], false, true)); assert.equal(g.nlat, 2); assert.deepEqual([...g.lats], [10, 10.5]); assert.deepEqual([...g.lons], [0, 0.5, 1]);
});
test('packOceanGrid: Int16 scaled values, NaN as -32768, latitude always ascending (a descending source is flipped)', () => {
  const asc = packOceanGrid(parseDodsGrid(dods(2, 3, [1, 2, NaNv, 4, 5, 6], [10, 10.5], [0, 0.5, 1])), 'Thgt'), q = new Int16Array(Uint8Array.from(atob(asc.q), (c) => c.charCodeAt(0)).buffer);
  assert.deepEqual([...q], [1000, 2000, -32768, 4000, 5000, 6000]); assert.equal(asc.lat0, 10); assert.equal(asc.dlat, 0.5); assert.equal(asc.dlon, 0.5); assert.equal(asc.scale, 1000);
  const desc = packOceanGrid(parseDodsGrid(dods(2, 3, [1, 2, 3, 4, 5, 6], [10.5, 10], [0, 0.5, 1])), 'Tper'), qd = new Int16Array(Uint8Array.from(atob(desc.q), (c) => c.charCodeAt(0)).buffer);
  assert.equal(desc.lat0, 10); assert.deepEqual([...qd], [400, 500, 600, 100, 200, 300], 'rows reversed so latitude ascends');
});
test('/api/ocean serves one packed native frame, bounded to 3-hourly times in range, cached; unknown fields refused', async () => {
  const instant = Date.parse('2026-11-04T03:00:00Z'); let calls = 0, lastUrl = '';
  const h = createForecastService({now: () => instant, fetcher: async (u: string) => { calls++; lastUrl = String(u); return new Response(dods(2, 3, [1, 2, 3, 4, 5, 6], [10, 10.5], [0, 0.5, 1]), {status: 200}); }});
  const r = await h(new Request('https://surf.test/api/ocean?field=Thgt&time=2026-11-04T06:00:00Z')); assert.equal(r.status, 200); const b = await r.json();
  assert.equal(b.nlat, 2); assert.equal(b.dataset, 'ww3_global'); assert.match(lastUrl, /^https:\/\/pae-paha\.pacioos\.hawaii\.edu\/erddap\/griddap\//); assert.match(lastUrl, /\.dods\?Thgt/); assert.match(lastUrl, /311|%5B0:1:310%5D/); assert.match(r.headers.get('cache-control') ?? '', /max-age/);
  await h(new Request('https://surf.test/api/ocean?field=Thgt&time=2026-11-04T06:00:00Z')); assert.equal(calls, 1, 'cached');
  assert.equal((await h(new Request('https://surf.test/api/ocean?field=evil&time=2026-11-04T06:00:00Z'))).status, 400); assert.equal((await h(new Request('https://surf.test/api/ocean?field=Thgt&time=2026-11-04T06:30:00Z'))).status, 400); assert.equal((await h(new Request('https://surf.test/api/ocean?field=Thgt&time=2030-01-01T00:00:00Z'))).status, 400);
  const w = await h(new Request('https://surf.test/api/ocean?field=ugrd10m&time=2026-11-04T06:00:00Z')); assert.equal(w.status, 200); assert.match(lastUrl, /pacioos\.hawaii\.edu\/erddap\/griddap\/ncep_global\.dods/);
});
