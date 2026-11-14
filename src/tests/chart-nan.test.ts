import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// prod 2026-11-13: one hour's swell height or wind gust came through as NaN; the Swell and Wind charts drew "M44.0,NaN…" and y far off the chart.
test('the forecast charts never let a missing value set the scale or reach a path', () => {
  const src = readFileSync('src/features/forecast/charts.tsx', 'utf8');
  assert.match(src, /const fv = \(v: number \| null \| undefined\) => \(typeof v === 'number' && Number\.isFinite\(v\) \? v : 0\)/);
  assert.match(src, /hsMax = Math\.max\(1, \.\.\.series\.map\(\(h\) => tab === 'swell' \? Math\.max\(fv\(/, 'the swell/surf scale only reads finite values');
  assert.match(src, /const line = [^\n]*\.filter\(\(\[, y\]\) => Number\.isFinite\(y\)\)/, 'every main line drops hours with no value');
});
