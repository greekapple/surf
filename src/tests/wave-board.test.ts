import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBoard, boardCurves, boardParamsFor, REFERENCE_BOARD, signedVolume, monotone, type BoardParams} from '../features/scale/boardMesh.ts';

const IN = 0.0254;
const hullVolume = (g: ReturnType<typeof buildBoard>) => g.groups.filter((x) => x.part === 'resin' || x.part === 'wax').reduce((a, gr) => a + signedVolume(g.positions, g.indices, gr.start, gr.count), 0);

test('R16 buildBoard: the reference board is 5\'10" x 19 1/4" x 2 3/8" with the spec sheet widths, a squash tail and three fins, 3-6k tris', () => {
  const g = buildBoard(REFERENCE_BOARD), c = g.curves;
  assert.ok(Math.abs(g.bounds.max[0] - g.bounds.min[0] - 70 * IN) < 1e-4, 'length');
  assert.ok(Math.abs(g.bounds.max[2] - g.bounds.min[2] - 19.25 * IN) < 0.004, `width ${g.bounds.max[2] - g.bounds.min[2]}`);
  const xPeak = (0.5 - (1 - REFERENCE_BOARD.foil.value.peakFromNose)) * c.L;
  assert.ok(Math.abs(c.deckAt(xPeak, 0) - c.bottomAt(xPeak, 0) + c.concave(0.5, 0) - 2.375 * IN) < 0.002, `thickness ${c.deckAt(xPeak, 0) - c.bottomAt(xPeak, 0)}`);
  // the outline at 12" from each tip and the tail block, as the spec sheets measure them (FINDINGS section 18)
  assert.ok(Math.abs(2 * c.half(1 - 12 * IN / c.L) / IN - 11.5) < 0.3, 'nose 12"'); assert.ok(Math.abs(2 * c.half(12 * IN / c.L) / IN - 14.6) < 0.3, 'tail 12"'); assert.ok(Math.abs(2 * c.half(0) / IN - 6.9) < 0.3, 'tail block');
  assert.ok(Math.abs(c.rocker(1) - 4.9 * IN) < 1e-6 && Math.abs(c.rocker(0) - 2.3 * IN) < 1e-6, 'rocker');
  assert.ok(g.tris >= 3000 && g.tris <= 6000, `tris ${g.tris}`);
  assert.equal(g.fins.length, 3); assert.deepEqual(g.fins.map((f) => f.side), [1, -1, 0]);
  assert.ok(g.groups.some((x) => x.part === 'stringer') && g.groups.some((x) => x.part === 'pad') && g.groups.some((x) => x.part === 'wax'), 'parts');
  for (const f of Object.values(REFERENCE_BOARD)) if (f && typeof f === 'object' && 'source' in f) assert.equal(f.source, 'default');
});

test('R16 buildBoard: the hull and every fin are closed and wound outward (T-139); the hull is 20-30 L', () => {
  const g = buildBoard(REFERENCE_BOARD), v = hullVolume(g);
  assert.ok(v > 0.02 && v < 0.03, `hull ${v} m3`);
  const fg = g.groups.find((x) => x.part === 'fin')!, per = fg.count / g.fins.length;
  for (let i = 0; i < g.fins.length; i++) { const fv = signedVolume(g.positions, g.indices, fg.start + i * per, per); assert.ok(fv > 1e-5 && fv < 1e-4, `fin ${i} ${fv}`); }
});

test('R16 buildBoard: deckAt is the mesh\'s own deck (the feet are planted on it); the pad sits on the deck; the normal tilts across the dome', () => {
  const g = buildBoard(REFERENCE_BOARD), c = g.curves, p = g.positions, ring = 26;
  const deck = g.groups.filter((x) => x.part === 'resin' || x.part === 'wax');
  let checked = 0, worst = 0;
  for (const gr of deck) for (let i = gr.start; i < gr.start + gr.count; i++) { const vi = g.indices[i]; if (vi >= 65 * ring) continue; const j = vi % ring; if (j <= 0 || j >= ring / 2) continue;   // the deck half of each ring (j in 1..12), not the rails
    const x = p[vi * 3], y = p[vi * 3 + 1], z = p[vi * 3 + 2]; worst = Math.max(worst, Math.abs(c.deckAt(x, z) - y)); checked++; }
  assert.ok(checked > 1000 && worst < 1e-4, `deck vertices off deckAt by ${worst} (${checked})`);
  const pad = g.groups.find((x) => x.part === 'pad')!; let below = 0;
  for (let i = pad.start; i < pad.start + pad.count; i++) { const vi = g.indices[i]; if (p[vi * 3 + 1] < c.deckAt(p[vi * 3], p[vi * 3 + 2]) - 1e-6) below++; }
  assert.equal(below, 0, 'pad under the deck');
  const n = new Float32Array(3); c.deckNormalAt(0, 0, n); assert.ok(n[1] > 0.999, 'flat on the stringer'); c.deckNormalAt(0, 0.2, n); assert.ok(n[2] > 0.05 && n[1] < 0.999, 'the dome tilts the rail outward');
  assert.ok(c.rocker(0.1) > 0.01 && c.rocker(0.9) > 0.03 && c.rocker(0.42) === 0 && c.deckAt(-0.8, 0) > c.deckAt(0, 0), 'the rocker lifts both ends off the flat');
});

test('R16 buildBoard: the tails, the fin setups and a traced outline', () => {
  const with_ = (over: Partial<BoardParams>) => ({...REFERENCE_BOARD, ...over});
  const squash = boardCurves(REFERENCE_BOARD), pin = boardCurves(with_({tail: {value: 'pin', source: 'default'}})), round = boardCurves(with_({tail: {value: 'round', source: 'default'}}));
  assert.ok(pin.halfCut(0) < squash.halfCut(0) * 0.4 && round.halfCut(0.004) < squash.halfCut(0.004), 'narrower tails');
  const sw = buildBoard(with_({tail: {value: 'swallow', source: 'default'}})); assert.ok(sw.curves.notchM > 0.05, 'swallow notch');
  assert.equal(buildBoard(with_({fins: {value: 'quad', source: 'default'}})).fins.length, 4); assert.equal(buildBoard(with_({fins: {value: 'twin', source: 'default'}})).fins.length, 2); assert.equal(buildBoard(with_({fins: {value: 'none', source: 'default'}})).fins.length, 0);
  const tr = boardCurves(with_({traced: Array.from({length: 40}, (_, i) => 0.12 * Math.sin(Math.PI * (i + 0.5) / 40))}));
  assert.ok(Math.abs(tr.half(0.5) - 0.5 * REFERENCE_BOARD.widthM.value) < 0.001, 'traced outline rescaled to the entered width');
  const noFins = buildBoard(REFERENCE_BOARD, {fins: false, pad: false, stringer: false}); assert.ok(noFins.groups.every((x) => x.part === 'resin' || x.part === 'wax'), 'hull only');
});

test('R16 boardParamsFor: a Quiver board keeps its dimensions (source quiver), the rest are category defaults; old records fall back', () => {
  const p = boardParamsFor({length: 72, width: 19.5, thickness: 2.44, type: 'Performance shortboard'});
  assert.equal(p.lengthM.source, 'quiver'); assert.ok(Math.abs(p.lengthM.value - 72 * IN) < 1e-9); assert.equal(p.outline.source, 'default'); assert.equal(p.tail.value, 'squash'); assert.equal(p.fins.value, 'thruster');
  const fish = boardParamsFor({length: 64, width: 21, thickness: 2.6, type: 'Fish'}); assert.equal(fish.tail.value, 'swallow'); assert.equal(fish.fins.value, 'twin'); assert.equal(fish.rail.value, 'soft');
  const lb = boardParamsFor({length: 110, width: 22.75, thickness: 3, type: 'Longboard', tail: 'Pin', fins: '2+1'}); assert.equal(lb.tail.value, 'pin'); assert.equal(lb.tail.source, 'quiver'); assert.equal(lb.fins.value, 'thruster');
  const old = boardParamsFor({length: 70, width: 0, thickness: 0, type: 'Performance shortboard'} as never); assert.ok(old.widthM.value > 0.4 && old.thicknessM.value > 0.05, 'fallback dims');
  for (const b of [p, fish, lb]) { const g = buildBoard(b); assert.ok(Math.abs(g.bounds.max[0] - g.bounds.min[0] - b.lengthM.value) < 1e-4 && Math.abs(g.bounds.max[2] - g.bounds.min[2] - b.widthM.value) < 0.004, 'dims kept'); assert.ok(hullVolume(g) > 0, 'outward'); }
});

test('R16 monotone cubic: through the points, no overshoot', () => {
  const f = monotone([0, 1, 2, 3], [0, 1, 1, 2]);
  assert.ok(Math.abs(f(1) - 1) < 1e-12 && Math.abs(f(2) - 1) < 1e-12 && f(1.5) >= 1 - 1e-12 && f(1.5) <= 1 + 1e-12 && f(0.5) > 0 && f(0.5) < 1 && f(2.5) > 1 && f(2.5) < 2);
});
