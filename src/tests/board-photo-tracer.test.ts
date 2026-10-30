import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findHorizon, traceBoard, traceBoardIn} from '../features/quiver/outline.ts';

/** Studio sweep: a pale board standing upright (tail at the top, nose crossing the wall/floor horizon), light grey wall, a floor with a
 *  darker band under the horizon and a lit centre, concave shading near the tail and a dark logo. Returns pixels and the true size. */
function studio(w: number, h: number) {
  const d = new Uint8ClampedArray(w * h * 4), cx = w / 2, top = h * 0.06, L = h * 0.88, hwMax = L * 0.13, hz = Math.round(h * 0.84);
  const hw = (u: number) => (u <= 0 || u >= 1 ? 0 : hwMax * Math.min(1, Math.sin(Math.PI * u) * 1.15) * (u > 0.8 ? Math.sqrt((1 - u) / 0.2) : 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, u = (y - top) / L, inside = Math.abs(x - cx) < hw(u);
    let rgb: number[];
    if (y < hz) rgb = [200 - y * 0.02, 205 - y * 0.02, 212 - y * 0.02];
    else { const band = Math.max(0, 1 - (y - hz) / (h * 0.05)), lit = Math.max(0, 1 - Math.abs(x - cx) / (w * 0.35)); rgb = [190 - 25 * band + 18 * lit, 194 - 25 * band + 18 * lit, 202 - 25 * band + 18 * lit]; }
    if (inside) {
      rgb = [236, 238, 246];
      if (u < 0.18 && Math.abs(x - cx) > hwMax * 0.25) rgb = [212, 214, 228]; // concave shading near the tail
      if (u > 0.55 && u < 0.65 && x < cx - hwMax * 0.3 && x > cx - hwMax * 0.75) rgb = [30, 30, 34]; // logo
      if (Math.abs(x - cx) < 1) rgb = [40, 40, 40]; // stringer
    }
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
  }
  return {d, aspect: L / (2 * hwMax), hz};
}

/** A rack: n pale boards side by side, touching, against a warm wall. */
function rack(w: number, h: number, n: number) {
  const d = new Uint8ClampedArray(w * h * 4), bw = w / n;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, k = Math.floor(x / bw), u = (x - k * bw) / bw, v = (y - h * 0.1) / (h * 0.85);
    const inside = v > 0 && v < 1 && Math.abs(u - 0.5) < 0.5 * Math.sin(Math.PI * v) ** 0.5;
    const rgb = inside ? [232 - (k % 3) * 6, 230, 222] : [214, 190, 160];
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
  }
  return d;
}

/** A dark top-down floor with one pale board lying across it. */
function floorBoard(w: number, h: number) {
  const d = new Uint8ClampedArray(w * h * 4), cx = w * 0.55, cy = h * 0.5, L = w * 0.6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, u = (x - cx) / L + 0.5, inside = u > 0 && u < 1 && Math.abs(y - cy) < L * 0.12 * Math.sin(Math.PI * u) ** 0.7;
    const g = inside ? 232 : 50 + ((x * 7 + y * 13) % 9);
    d[i] = g; d[i + 1] = g; d[i + 2] = g + (inside ? 0 : 4); d[i + 3] = 255;
  }
  return d;
}

test('the horizon of a studio sweep is found; a smooth floor gradient has none', () => {
  const w = 300, h = 420, s = studio(w, h), at = findHorizon(s.d, w, h);
  assert.ok(at !== null && Math.abs(at - s.hz) <= 3, `horizon ${at} vs ${s.hz}`);
  const g = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) { const y = Math.floor(p / w), v = 60 + y * 0.12; g.set([v, v, v + 4, 255], p * 4); }
  assert.equal(findHorizon(g, w, h), null);
});

test('a pale board standing on a studio sweep traces to its true proportions, and evenly', () => {
  const w = 300, h = 420, s = studio(w, h), r = traceBoard(s.d, w, h);
  assert.ok(r.ok, r.ok ? '' : r.reason); if (!r.ok) return;
  assert.ok(Math.abs(r.aspect - s.aspect) / s.aspect < 0.1, `aspect ${r.aspect.toFixed(2)} vs ${s.aspect.toFixed(2)}`);
  assert.ok(r.quality.asym < 0.05 && r.quality.rough < 0.05, JSON.stringify(r.quality));
});

test('a rack of touching boards is refused, never traced', () => {
  const w = 480, h = 300, r = traceBoard(rack(w, h, 8), w, h);
  assert.equal(r.ok, false);
});

test('a box traces only inside it and maps the result back to photo pixels', () => {
  const w = 600, h = 300, d = floorBoard(w, h), box = {x0: 120, y0: 40, x1: 560, y1: 260};
  const r = traceBoardIn(d, w, h, box, 520);
  assert.ok(r.ok, r.ok ? '' : r.reason); if (!r.ok) return;
  assert.ok(r.edge.every(([x, y]) => x >= box.x0 - 1 && x <= box.x1 + 1 && y >= box.y0 - 1 && y <= box.y1 + 1), 'edge stays inside the box');
  const whole = traceBoard(d, w, h);
  assert.ok(whole.ok); if (!whole.ok) return;
  assert.ok(Math.abs(r.frame.len - whole.frame.len) / whole.frame.len < 0.04, `boxed length ${r.frame.len} vs whole ${whole.frame.len}`);
  assert.ok(Math.abs(r.aspect - whole.aspect) / whole.aspect < 0.05, `boxed aspect ${r.aspect} vs ${whole.aspect}`);
});

test('a box that is too small, or around part of a board, is refused with a reason', () => {
  const w = 600, h = 300, d = floorBoard(w, h);
  const tiny = traceBoardIn(d, w, h, {x0: 10, y0: 10, x1: 40, y1: 40}, 520);
  assert.equal(tiny.ok, false); if (!tiny.ok) assert.match(tiny.reason, /too small/);
  const part = traceBoardIn(d, w, h, {x0: 330, y0: 100, x1: 420, y1: 200}, 520); // the middle of the board fills the box
  assert.equal(part.ok, false);
});
