import test from 'node:test';
import assert from 'node:assert/strict';
import {SURFACE_RULE, surfaceWord} from '../services/surfaceWord.ts';

// forecast-visuals B: the day card's surface word, our own rule from the wind (speed + shore relation), one pure function.
test('light wind of any direction reads Glassy; strong wind of any direction reads Choppy', () => {
  for (const rel of ['Offshore', 'Cross-shore', 'Onshore']) { assert.equal(surfaceWord(2, rel), 'Glassy', rel); assert.equal(surfaceWord(SURFACE_RULE.STRONG_MPH, rel), 'Choppy', rel); assert.equal(surfaceWord(30, rel), 'Choppy', rel); }
});
test('offshore: Clean while light, Textured when moderate; cross-shore Textured; onshore Choppy', () => {
  assert.equal(surfaceWord(8, 'Offshore'), 'Clean'); assert.equal(surfaceWord(11.9, 'Offshore'), 'Clean'); assert.equal(surfaceWord(12, 'Offshore'), 'Textured'); assert.equal(surfaceWord(19.9, 'Offshore'), 'Textured');
  assert.equal(surfaceWord(8, 'Cross-shore'), 'Textured'); assert.equal(surfaceWord(15, 'Cross-shore'), 'Textured');
  assert.equal(surfaceWord(5, 'Onshore'), 'Textured'); assert.equal(surfaceWord(8, 'Onshore'), 'Choppy'); assert.equal(surfaceWord(12, 'Onshore'), 'Choppy'); assert.equal(surfaceWord(3.9, 'Onshore'), 'Glassy');
});
test('no word when the shore relation is unknown or the wind is missing', () => {
  assert.equal(surfaceWord(8, 'Unknown'), null); assert.equal(surfaceWord(8, null), null); assert.equal(surfaceWord(null, 'Offshore'), null); assert.equal(surfaceWord(Number.NaN, 'Offshore'), null);
});
test('gusts well above the mean wind take a glassy or clean surface to textured', () => {
  assert.equal(surfaceWord(10, 'Offshore', 30), 'Textured'); assert.equal(surfaceWord(10, 'Offshore', 18), 'Clean'); assert.equal(surfaceWord(3, 'Offshore', 15), 'Textured'); assert.equal(surfaceWord(3, 'Offshore', 8), 'Glassy');
});
