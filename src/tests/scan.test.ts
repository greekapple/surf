import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimateVolume, loadOutline, saveOutline, straighten, traceBoard, widthFromTrace, OUTLINES_KEY, TEX_PREFIX} from '../features/quiver/outline.ts';

/** Coloured board (red, with a white stripe along the middle and a blue patch near the tail) at rotation `rot` on a grey-green floor. */
function photo(w: number, h: number, rot: number) {
  const d = new Uint8ClampedArray(w * h * 4), cx = w / 2, cy = h / 2, L = w * 0.8, c = Math.cos(rot), s = Math.sin(rot);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / L + 0.5, v = -dx * s + dy * c;
    const half = L * 0.12 * Math.sin(Math.PI * Math.min(1, Math.max(0, u) ** 0.7)) * (u > 0.5 ? 1 : 0.9);
    const inside = u > 0 && u < 1 && Math.abs(v) < half, i = (y * w + x) * 4;
    let rgb = [70, 90, 80];
    if (inside) rgb = Math.abs(v) < L * 0.012 ? [250, 250, 250] : u > 0.8 ? [30, 60, 200] : [200, 40, 40];
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
  }
  return d;
}

test('width and volume come from the traced shape', () => {
  const r = traceBoard(photo(600, 400, 0.3), 600, 400);
  assert.ok(r.ok); if (!r.ok) return;
  const w = widthFromTrace(72, r.aspect);
  assert.ok(w > 15 && w < 22, `width ${w}`);
  const v = estimateVolume(r.outline, 72, 2.5);
  assert.ok(v > 20 && v < 45, `volume ${v}`);
});

test('the board region is cropped and straightened: nose at the left, stripe along the middle row, blue at the narrow (nose) end', () => {
  for (const rot of [0, 0.3, Math.PI]) {
    const r = traceBoard(photo(600, 400, rot), 600, 400);
    assert.ok(r.ok, 'traced'); if (!r.ok) return;
    const t = straighten(photo(600, 400, rot), 600, 400, r.frame, 512);
    assert.ok(t.w === 512 && t.h > 40 && t.h < 200, `size ${t.w}x${t.h}`);
    const px = (x: number, y: number) => { const i = (y * t.w + x) * 4; return [t.data[i], t.data[i + 1], t.data[i + 2]]; };
    const mid = t.h >> 1, [sr, sg, sb] = px(t.w >> 1, mid);
    assert.ok(sr > 200 && sg > 200 && sb > 200, `stripe white at centre: ${[sr, sg, sb]}`);
    const [tr, , tb] = px(Math.round(t.w * 0.1), mid - 14);
    assert.ok(tb > 150 && tr < 90, `blue patch at the narrow end, left: ${[tr, tb]}`);
    const [nr, , nb] = px(Math.round(t.w * 0.6), Math.round(t.h * 0.3));
    assert.ok(nr > 150 && nb < 90, `red mid-board: ${[nr, nb]}`);
  }
});

test('outline storage keeps a small JPEG texture and drops anything else', () => {
  const mem = new Map<string, string>();
  (globalThis as any).localStorage = {getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }};
  const hw = Array.from({length: 40}, (_, i) => 0.1 * Math.sin(Math.PI * (i + 0.5) / 40));
  assert.equal(saveOutline('a', {v: 1, hw, tex: TEX_PREFIX + 'AAAA'}), true);
  assert.equal(loadOutline('a')?.tex, TEX_PREFIX + 'AAAA');
  saveOutline('b', {v: 1, hw, tex: 'data:text/html;base64,AAAA'});
  assert.equal(loadOutline('b')?.tex, undefined);
  saveOutline('c', {v: 1, hw, tex: TEX_PREFIX + 'A'.repeat(300_001)});
  assert.equal(loadOutline('c')?.tex, undefined);
  assert.ok(mem.has(OUTLINES_KEY));
  (globalThis as any).localStorage = {getItem: () => null, setItem: () => { throw new Error('quota'); }};
  assert.equal(saveOutline('d', {v: 1, hw}), false);
});
