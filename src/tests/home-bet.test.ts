import test from 'node:test';
import assert from 'node:assert/strict';
import {rankBets} from '../features/home/betRank.ts';

const b = (id: string, sized: boolean, verdict: 'Go' | 'Worth a look', start: string) => ({id, sized, verdict, window: {start}});

test('T-075: a top-rated spot without a surf estimate never beats a sized spot', () => {
  const top = rankBets([b('pleasure-point', false, 'Go', '2026-11-03T14:00:00Z'), b('linda-mar', true, 'Worth a look', '2026-11-03T16:00:00Z')])[0];
  assert.equal(top.id, 'linda-mar');
});
test('among sized spots, Go beats Worth a look, then the sooner window wins', () => {
  assert.equal(rankBets([b('a', true, 'Worth a look', '2026-11-03T14:00:00Z'), b('b', true, 'Go', '2026-11-04T14:00:00Z')])[0].id, 'b');
  assert.equal(rankBets([b('a', true, 'Go', '2026-11-04T14:00:00Z'), b('b', true, 'Go', '2026-11-03T14:00:00Z')])[0].id, 'b');
});
test('when nothing is sized, the best unsized spot is returned (the sentence then says "no sized forecast")', () => {
  assert.equal(rankBets([b('a', false, 'Worth a look', '2026-11-03T14:00:00Z'), b('b', false, 'Go', '2026-11-03T16:00:00Z')])[0].id, 'b');
});
