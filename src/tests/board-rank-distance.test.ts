import test from 'node:test';
import assert from 'node:assert/strict';
import {rankBoards, recommended, rangeDistance, sizeFit} from '../features/quiver/fit.ts';
import type {Surfboard} from '../models/index.ts';

// Audit A5 (R2): out-of-range boards rank by how far the surf sits from their range, never by period alone.
const b = (id: string, type: Surfboard['type'], minWave: number, maxWave: number, length = 72): Surfboard =>
  ({id, name: id, manufacturer: '', model: '', type, length, width: 20, thickness: 2.5, volume: 30, favorite: false, minWave, maxWave} as Surfboard);
const quiver = [b('softtop', 'Soft-top', 0.5, 4, 96), b('fish', 'Fish', 1, 5, 71), b('short', 'Performance shortboard', 3, 8, 70), b('stepup', 'Step-up', 5, 12, 76)];

test('in 10–13 ft surf a 1–5 ft fish never ranks second; the closest range follows the board that suits it', () => {
  for (const period of [9.4, 12, 14, 17, null]) {
    const order = rankBoards(quiver, [10, 13], period).map((x) => x.board.id);
    assert.deepEqual(order, ['stepup', 'short', 'fish', 'softtop'], `period ${period}`);
  }
});

test('distance is 0 inside or at the edge, feet outside otherwise', () => {
  assert.equal(rangeDistance(sizeFit(quiver[1], [10, 13]), [10, 13]), 5);
  assert.equal(rangeDistance(sizeFit(quiver[1], [4, 7]), [4, 7]), 0);
  assert.equal(rangeDistance(sizeFit(quiver[3], [0.5, 1]), [0.5, 1]), 4);
  assert.equal(rangeDistance(sizeFit(quiver[1], null), null), Infinity);
});

test('in-range and edge boards still rank above every out-of-range board, and only they are recommended', () => {
  const r = rankBoards(quiver, [2, 4], 12);
  assert.ok(r.slice(0, 3).every((x) => x.size.state === 'in' || x.size.state === 'edge'));
  assert.equal(r[3].board.id, 'stepup');
  assert.deepEqual(recommended(rankBoards(quiver, [20, 25], 15)), []);
  assert.deepEqual(rankBoards(quiver, [20, 25], 15).map((x) => x.board.id), ['stepup', 'short', 'fish', 'softtop']);
});
