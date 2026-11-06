import test from 'node:test';
import assert from 'node:assert/strict';
import {ampAt, bendZ, facePoint, halfToFloat, makeAtlas, sample, stageAt, stripX, surferX, type AtlasMeta} from '../features/scale/waveAtlas.ts';

const meta = (o: Partial<AtlasMeta> = {}): AtlasMeta => ({band: '4-6', face_m: 1.52, family: 'peeler', breaker: 'plunging', stages: 12, points: 96, stage_feather: 2, stage_pitch: 4, stage_land: 6,
  y0_m: -14, y1_m: 5, bed_along_per_m: 0.027, cycle_s: 6.5, break_len_m: 38, shoulder_len_m: 40, depth_break_m: 1.95, celerity_mps: 4.37, peel_speed_mps: 5.9, period_s: 13, Lb_m: 57, ...o});
// float -> half (round to nearest) for building a synthetic atlas
const toHalf = (v: number) => { const f = new Float32Array([v]), i = new Uint32Array(f.buffer)[0], s = (i >>> 16) & 0x8000, e = ((i >>> 23) & 0xff) - 127 + 15, m = i & 0x7fffff;
  if (v === 0) return 0; if (e <= 0) return s; return s | (e << 10) | Math.round(m / 8192); };
// a triangle wave of height 1.52 m at every stage: back from y=-6..0, face 0..+2
const synth = (m: AtlasMeta) => { const n = m.points * m.stages * 2 * 4, h = new Uint16Array(n);
  for (let s = 0; s < m.stages; s++) for (let i = 0; i < m.points; i++) { const u = i / (m.points - 1), y = -6 + 8 * u, z = y < 0 ? 1.52 * (1 + y / 6) : Math.max(0, 1.52 * (1 - y / 2)); const o = (s * m.points + i) * 4; h[o] = toHalf(y); h[o + 1] = toHalf(z); }
  return makeAtlas(m, h.buffer); };

test('half floats decode', () => {
  assert.equal(halfToFloat(0x3c00), 1); assert.equal(halfToFloat(0xc000), -2); assert.equal(halfToFloat(0x0000), 0); assert.equal(halfToFloat(0x7c00), Infinity);
  assert.ok(Math.abs(halfToFloat(toHalf(1.52)) - 1.52) < 1e-3);
});
test('stage: rises along the shoulder to the pitch at the break point, then runs the cycle to the last stage', () => {
  const m = meta();
  assert.equal(stageAt(m, -m.shoulder_len_m * 1.1, 0, false), 0);
  assert.equal(stageAt(m, 0, 0, false), m.stage_pitch);
  assert.equal(stageAt(m, m.break_len_m, 0, false), m.stages - 1);
  let prev = -1; for (let x = -50; x <= 50; x += 0.5) { const s = stageAt(m, x, 0, false); assert.ok(s >= prev - 1e-9); prev = s; }
  for (let t = 0; t < 10; t += 0.7) for (let x = -50; x <= 60; x += 3) { const s = stageAt(m, x, t); assert.ok(s >= 0 && s <= m.stages - 1); }
  // no section pulses where the surfer rides
  const xs = surferX(m); assert.equal(stageAt(m, xs, 1.7), stageAt(m, xs, 0, false));
});
test('height envelope: flat at both strip ends, a peak near the break, never uniform', () => {
  const m = meta(), [x0, x1] = stripX(m);
  assert.ok(ampAt(m, x0) < 1e-6 && ampAt(m, x1) < 1e-6);
  const vals = Array.from({length: 60}, (_, i) => ampAt(m, x0 + (x1 - x0) * (i + 0.5) / 60));
  assert.ok(Math.max(...vals) > 0.9 && Math.max(...vals) - Math.min(...vals) > 0.5);
  assert.ok(ampAt(m, -0.8 * m.shoulder_len_m) < ampAt(m, -2));
});
test('atlas sampling and the face point', () => {
  const a = synth(meta());
  const p = sample(a, 0.75, 5.5); assert.ok(Math.abs(p[0] - 0) < 0.02 && Math.abs(p[1] - 1.52) < 0.02);
  const xs = surferX(a.meta); assert.ok(xs < 0 && xs > -a.meta.shoulder_len_m);
  const [fy, fz, slope] = facePoint(a, xs, 0.1); assert.ok(fy > 0 && fy < 2 && fz > 0 && slope > 0.3);
});
test('atlas size is checked', () => { assert.throws(() => makeAtlas(meta(), new ArrayBuffer(10))); });

test('N5: the shoulder sweep ends with zero slope, so the crest runs straight into the end fade (no hook)', () => {
  const m = meta(), end = -1.2 * m.shoulder_len_m, h = 0.01;
  assert.equal(bendZ(m, 0), 0);
  assert.ok(Math.abs(bendZ(m, end) - 0.04 * m.shoulder_len_m) < 1e-9);
  assert.equal(bendZ(m, end * 1.4), bendZ(m, end));
  const slope = (x: number) => Math.abs(bendZ(m, x - h) - bendZ(m, x + h)) / (2 * h);
  assert.ok(slope(end + 0.05) < 0.002, 'about flat at the end of the sweep: ' + slope(end + 0.05));
  let prev = 0; for (let x = 0; x >= end; x -= 0.5) { const b = bendZ(m, x); assert.ok(b >= prev - 1e-9); prev = b; }   // monotone
  assert.ok(bendZ(m, 0.5 * end) < 0.0125 * m.shoulder_len_m * 1.5, 'near the rider no larger than before (x1.25)');
});
