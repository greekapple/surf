import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {SCALE_BANDS, bandIndexFor, selectScaleBand, type ScaleInput} from '../services/waveScale.ts';
const none: ScaleInput = {estimateRangeFt: null, estimateText: null, demoFaceFt: null, demoText: null, offshoreFt: null, offshoreText: null};
const sel = (o: Partial<ScaleInput>) => selectScaleBand({...none, ...o});
const id = (i: number | null) => (i === null ? null : SCALE_BANDS[i].id);

test('height to band: lower edge inclusive, upper exclusive, at every edge', () => {
  const cases: [number, string][] = [[0, '1-2ft'], [0.4, '1-2ft'], [1.99, '1-2ft'], [2, '2-3ft'], [2.99, '2-3ft'], [3, '3-4ft'], [3.99, '3-4ft'], [4, '4-6ft'], [5.99, '4-6ft'], [6, '6-8ft'], [7.99, '6-8ft'], [8, '8-10ft'],
    [9.99, '8-10ft'], [10, '10-15ft'], [14.99, '10-15ft'], [15, '15-plusft'], [40, '15-plusft']];
  for (const [ft, want] of cases) assert.equal(id(bandIndexFor(ft)), want, `${ft} ft`);
});

test('no band for a missing, negative or non-finite height', () => {
  for (const v of [null, undefined, NaN, Infinity, -1]) assert.equal(bandIndexFor(v as number), null, String(v));
});

test('bands are contiguous and eight', () => {
  assert.equal(SCALE_BANDS.length, 8);
  SCALE_BANDS.forEach((b, i) => { if (i) assert.equal(b.lo, SCALE_BANDS[i - 1].hi); });
});

test('a presentable estimate wins and is labelled "Est. … surf height"', () => {
  const s = sel({estimateRangeFt: [4, 6], estimateText: '4–6 ft', offshoreFt: 9, offshoreText: '9 ft', demoFaceFt: 12, demoText: '12 ft'});
  assert.equal(s.source, 'estimate'); assert.equal(id(s.band), '4-6ft'); assert.equal(s.label, 'Est. 4–6 ft surf height'); assert.equal(s.note, null); // [4,6] ends on the 6 ft edge: one band, not two
});

test('a range spanning two bands uses the band of its midpoint and says so', () => {
  const s = sel({estimateRangeFt: [3, 5], estimateText: '3–5 ft'});
  assert.equal(id(s.band), '4-6ft'); assert.match(s.note!, /spans the 3–4 ft and 4–6 ft bands/); assert.match(s.note!, /midpoint \(4 ft\)/);
  assert.equal(id(sel({estimateRangeFt: [5, 7], estimateText: '5–7 ft'}).band), '6-8ft'); // midpoint 6 sits on the edge: upper band
  assert.equal(id(sel({estimateRangeFt: [2, 5], estimateText: '2–5 ft'}).band), '3-4ft'); // spans three, midpoint 3.5
  assert.equal(id(sel({estimateRangeFt: [8, 12], estimateText: '8–12 ft'}).band), '10-15ft');
});

test('offshore Hs is labelled as offshore, not surf size', () => {
  const s = sel({offshoreFt: 4.1, offshoreText: '4.1 ft'});
  assert.equal(s.source, 'offshore'); assert.equal(id(s.band), '4-6ft'); assert.equal(s.label, '4.1 ft offshore, not surf size'); assert.match(s.note!, /not the size of the breaking wave/);
  assert.equal(id(sel({offshoreFt: 2, offshoreText: '2 ft'}).band), '2-3ft'); assert.equal(id(sel({offshoreFt: 15, offshoreText: '15 ft'}).band), '15-plusft');
});

test('demonstration face is labelled as demonstration data', () => {
  const s = sel({demoFaceFt: 6, demoText: '6 ft', offshoreFt: 3, offshoreText: '3 ft'});
  assert.equal(s.source, 'demo'); assert.equal(id(s.band), '6-8ft'); assert.equal(s.label, '6 ft demonstration face, not live data');
});

test('estimate refused falls back to offshore; both missing gives no band and says so', () => {
  assert.equal(sel({offshoreFt: 3, offshoreText: '3 ft'}).source, 'offshore');
  const s = sel({});
  assert.equal(s.band, null); assert.equal(s.source, 'none'); assert.equal(s.label, 'No wave height for this hour'); assert.match(s.note!, /Not tied to the forecast/);
  assert.equal(sel({offshoreFt: NaN, estimateRangeFt: [NaN, 3]}).source, 'none'); assert.equal(sel({estimateRangeFt: [6, 4]}).source, 'none'); // inverted or non-finite ranges are not trusted
});

test('heights below 1 ft use the smallest band and say so', () => {
  const s = sel({offshoreFt: 0.6, offshoreText: '0.6 ft'});
  assert.equal(id(s.band), '1-2ft'); assert.match(s.note!, /Smaller than the smallest illustration/);
  assert.match(sel({estimateRangeFt: [0.3, 0.8], estimateText: '0.3–0.8 ft'}).note!, /Smaller than the smallest illustration/);
});

test('T-101: no AI wave photo anywhere (no manifest entries, no files, no band media id)', () => {
  const m = JSON.parse(readFileSync(new URL('../../public/media/manifest.json', import.meta.url), 'utf8')) as {entries: Record<string, unknown>};
  assert.deepEqual(Object.keys(m.entries).filter((k) => k.startsWith('ai-scale-')), []);
  assert.deepEqual(readdirSync(new URL('../../public/media/ai/', import.meta.url)).filter((f) => f.startsWith('ai-scale-')), []);
  for (const b of SCALE_BANDS) assert.equal('media' in b, false, b.id);
  assert.doesNotMatch(readFileSync(new URL('../features/scale/ScaleStage.tsx', import.meta.url), 'utf8'), /example photo|<Media\b/);
});
