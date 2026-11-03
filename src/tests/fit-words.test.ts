import test from 'node:test';
import assert from 'node:assert/strict';
import {sizeFit} from '../features/quiver/fit.ts';

// T-095: the fit label says the SURF is above/below the board's range, never that the board is bigger or smaller.
const b = {id: 'x', name: 'x', type: 'Fish', length: 70, width: 21, minWave: 1, maxWave: 5} as any;
test('fit labels name the surf, not the board', () => {
  assert.equal(sizeFit(b, [7, 10]).label, 'Surf above its range');
  assert.equal(sizeFit(b, [0.2, 0.6]).label, 'Surf below its range');
  assert.equal(sizeFit(b, [2, 4]).label, 'In its range');
  assert.equal(sizeFit(b, [4, 7]).label, 'Edge of its range');
  for (const e of [[7, 10], [0.2, 0.6], [2, 4], [4, 7]] as [number, number][]) assert.doesNotMatch(sizeFit(b, e).label, /bigger|smaller/i);
});
