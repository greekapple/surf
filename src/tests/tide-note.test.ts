import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noTideCurveText} from '../features/forecast/tideNote.ts';

test('audit A3: the tide chart never says "no tide station" for a spot with a station in range, and claims nothing about loaded highs and lows', () => {
  for (const id of ['w-hawaii-pipeline-backdoor', 'w-us-cocoa-beach']) {
    const t = noTideCurveText(id);
    assert.doesNotMatch(t, /No tide station near/);
    assert.match(t, /Nearest tide station: .+, \d+(\.\d+)? km away\.$/); assert.doesNotMatch(t, /Tide card lists/);
  }
  assert.match(noTideCurveText('w-hawaii-pipeline-backdoor'), /Haleiwa/i);
});
