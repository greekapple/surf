import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGEND_NAMES} from '../features/explore/legendNames.ts';

// A18 (audit M7): every legend names its layer; the height layers say offshore and not surf size; the phone names are spelled out.
test('every map legend names the layer it paints, wide and on the phone', () => {
  const want = {waves: /wave height/i, swell: /swell height/i, period: /period/i, wind: /wind/i} as const;
  for (const [id, n] of Object.entries(LEGEND_NAMES) as [keyof typeof want, {full: string; short: string}][]) {
    assert.match(n.full, want[id], `${id} full`); assert.ok(n.short.length > 0 && n.short.length <= 30, `${id} short "${n.short}"`);
    assert.doesNotMatch(n.full + n.short, /\bHs\b/, `${id}: no jargon`);
  }
  for (const id of ['waves', 'swell'] as const) { assert.match(LEGEND_NAMES[id].full, /^Offshore .*not surf size$/); assert.match(LEGEND_NAMES[id].short, /not surf/); }
  assert.match(LEGEND_NAMES.swell.short, /^Offshore swell/);
});
