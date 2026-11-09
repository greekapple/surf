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
test('a clearly more certain spot wins when verdict and day are level (user, 2026-11-08); it never jumps a day or a verdict', () => {
  const c = (id: string, verdict: 'Go' | 'Worth a look', start: string, confidence: 'high' | 'low') => ({id, sized: true, verdict, window: {start}, confidence});
  assert.equal(rankBets([c('bolinas', 'Go', '2026-11-08T23:00:00Z', 'low'), c('stinson', 'Go', '2026-11-09T00:00:00Z', 'high')])[0].id, 'stinson', 'same day, same verdict: the surer one');
  assert.equal(rankBets([c('a', 'Go', '2026-11-08T20:00:00Z', 'low'), c('b', 'Worth a look', '2026-11-08T20:00:00Z', 'high')])[0].id, 'a', 'a better verdict still wins');
  assert.equal(rankBets([c('a', 'Go', '2026-11-08T20:00:00Z', 'low'), c('b', 'Go', '2026-11-09T18:00:00Z', 'high')])[0].id, 'a', 'today before a surer tomorrow');
});
