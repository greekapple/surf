import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanSpark, drawable, sparkPoints} from '../features/home/sparkData.ts';

const good = Array.from({length: 8}, (_, i) => ({t: i * 3 * 3600000, ft: 2 + i * 0.3}));
test('a healthy series is drawable and unchanged', () => { assert.equal(drawable(good), true); assert.deepEqual(cleanSpark(good), good); });
test('a failed or missing series is not drawable (the card shows no sparkline, never a NaN path)', () => {
  for (const pts of [[], null, undefined, [{t: 0, ft: null}, {t: 1, ft: null}], [{t: 0, ft: NaN}, {t: 1, ft: NaN}, {t: 2, ft: NaN}], [{t: 0, ft: 3}], [{t: 0, ft: Infinity}, {t: 1, ft: 2}]]) assert.equal(drawable(pts as never), false, JSON.stringify(pts));
});
test('non-finite points become gaps; the rest stay', () => {
  const bad = good.map((q, i) => (i === 3 ? {...q, ft: NaN} : i === 5 ? {...q, ft: Infinity} : q)), c = cleanSpark(bad);
  assert.equal(c.filter((q) => q.ft === null).length, 2); assert.ok(c.every((q) => q.ft === null || Number.isFinite(q.ft))); assert.equal(drawable(bad), true);
});
test('sparkPoints with no records is an empty series; the component draws only a drawable, cleaned series', () => {
  assert.deepEqual(sparkPoints('spot-2', [], Date.now(), null), []);
  const src = fs.readFileSync(new URL('../features/home/SurfSpark.tsx', import.meta.url), 'utf8');
  assert.match(src, /const points = cleanSpark\(raw\)/); assert.match(src, /if \(!drawable\(points\) \|\| vals\.length < 2\) return null/); assert.match(src, /export \{sparkPoints\}/);
});
