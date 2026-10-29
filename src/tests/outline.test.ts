import {test} from 'node:test';
import assert from 'node:assert/strict';
import {traceBoard, STATIONS} from '../features/quiver/outline.ts';

/** A synthetic board: pointed nose at left, rounded tail at right, rotated by `rot`, on a dark floor. */
function synth(w: number, h: number, rot: number, board = true) {
  const d = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2, cy = h / 2, L = w * 0.8, c = Math.cos(rot), s = Math.sin(rot);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / L + 0.5, v = -dx * s + dy * c;
    const half = L * 0.12 * Math.sin(Math.PI * Math.min(1, Math.max(0, u) ** 0.7)) * (u > 0.5 ? 1 : 0.9);
    const inside = board && u > 0 && u < 1 && Math.abs(v) < half;
    const i = (y * w + x) * 4, g = inside ? 235 : 40 + ((x * 7 + y * 13) % 9);
    d[i] = g; d[i + 1] = g; d[i + 2] = inside ? g : g + 5; d[i + 3] = 255;
  }
  return d;
}

test('traces a synthetic board, at an angle, nose first', () => {
  for (const rot of [0, 0.35]) {
    const r = traceBoard(synth(400, 300, rot), 400, 300);
    assert.ok(r.ok, 'traced');
    if (!r.ok) return;
    assert.equal(r.outline.hw.length, STATIONS);
    const mid = r.outline.hw[Math.floor(STATIONS * 0.45)], tip = r.outline.hw[1];
    assert.ok(mid > 0.08 && mid < 0.14, `mid half-width ${mid}`);
    assert.ok(tip < mid * 0.7, 'narrow near the nose end');
    assert.ok(r.edge.length > 40);
  }
});

test('says so when there is no board', () => {
  const r = traceBoard(synth(300, 300, 0, false), 300, 300);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /contrast|board shape/i);
});
