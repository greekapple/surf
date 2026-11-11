import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {orderScored, pickHeading, sizeFit} from '../features/quiver/fit.ts';
import {surfRange} from '../utils/units.ts';
import type {Surfboard} from '../models/index.ts';

// Review of audit-w2: score mode orders and labels like size mode; edge picks are "closest fit"; ranges follow the estimate's scale.
const b = (id: string, type: Surfboard['type'], minWave: number, maxWave: number): Surfboard =>
  ({id, name: id, manufacturer: '', model: '', type, length: 72, width: 20, thickness: 2.5, volume: 30, favorite: false, minWave, maxWave} as Surfboard);
const fish = b('fish', 'Fish', 1, 5), short = b('short', 'Performance shortboard', 3, 8), step = b('step', 'Step-up', 5, 12), soft = b('soft', 'Soft-top', 0.5, 4);

test('score mode: out-of-range boards go last by distance, whatever their score', () => {
  const scored = [{board: fish, score: 80}, {board: soft, score: 75}, {board: short, score: 40}, {board: step, score: 60}];
  assert.deepEqual(orderScored(scored, [10, 13]).map((x) => x.board.id), ['step', 'short', 'fish', 'soft']);
  assert.deepEqual(orderScored(scored, [2, 4]).map((x) => x.board.id), ['fish', 'soft', 'short', 'step']);
  assert.deepEqual(orderScored(scored, null).map((x) => x.board.id), ['fish', 'soft', 'step', 'short'], 'no estimate: by score');
});

test('an edge pick reads "Closest fit" and says which end of its range', () => {
  assert.equal(pickHeading(sizeFit(step, [10, 13]), [10, 13], 'Best for this size'), 'Closest fit · top of its range');
  assert.equal(pickHeading(sizeFit(step, [4, 6]), [4, 6], 'Best match'), 'Closest fit · bottom of its range');
  assert.equal(pickHeading(sizeFit(fish, [2, 4]), [2, 4], 'Best for this size'), 'Best for this size');
});

test('board ranges use the unit and the Hawaiian scale like the estimate', () => {
  assert.equal(surfRange(1, 5, {heightUnit: 'ft', scale: 'Face height'}), '1–5 ft');
  assert.equal(surfRange(1, 5, {heightUnit: 'ft', scale: 'Hawaiian'}), '0.5–2.5 ft ≈ Hawaiian');
  assert.equal(surfRange(2, 6, {heightUnit: 'm', scale: 'Face height'}), '0.6–1.8 m');
});

test('Board Match says when no board suits, the pick alone is drawn large, and the estimate is the spot page text', () => {
  const q = readFileSync('src/features/quiver/QuiverView.tsx', 'utf8');
  assert.equal(q.match(/None of your boards suit/g)?.length, 2);
  assert.doesNotMatch(q, /k === 0 \? 150/);
  assert.match(q, /est\. \$\{headlineText\(hs, p\)\.value\}/);
  assert.match(q, /'Not for your ability'/);
  assert.match(readFileSync('src/features/home/Welcome.tsx', 'utf8'), /pick\.size\.state === 'in' \|\| pick\.size\.state === 'edge'/);
});
