import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {orderSpots, pageWindow, SPOTS_PER_PAGE} from '../features/personal/spotList.ts';
import {allSpots} from '../data/catalog.ts';
import {evidenceSpots} from '../ocean/spots.ts';

const sel = 'spot-2';
test('saved spots come first, then the spots nearest the selected spot; nothing is dropped', () => {
  const fav = allSpots.find((s) => s.id === 'cs-cardiff-reef' || s.id.startsWith('cs-cardiff'))!.id, out = orderSpots(allSpots, evidenceSpots, sel, [fav], '', 'All');
  assert.equal(out.length, allSpots.length); assert.equal(out[0].id, fav, 'a saved spot is first, however far');
  assert.equal(out[1].id, sel, 'then the selected spot itself (distance 0)');
  assert.ok(out.slice(2, 6).every((s) => !s.id.startsWith('w-hawaii')), 'the next ones are near, not Hawaii');
});
test('search matches name, region or zone text; a region chip narrows to its zone; no match gives an empty list', () => {
  const a = orderSpots(allSpots, evidenceSpots, sel, [], 'ocean beach', 'All'); assert.ok(a.length >= 1 && a.every((s) => /ocean beach/i.test(`${s.name} ${s.region} `) || /ocean beach/i.test(s.region))); assert.ok(a.some((s) => s.id === sel));
  const z = orderSpots(allSpots, evidenceSpots, sel, [], '', 'Bay Area'); assert.ok(z.length > 5 && z.length < allSpots.length);
  assert.deepEqual(orderSpots(allSpots, evidenceSpots, sel, [], 'zzzz-no-such-spot', 'All'), []);
});
test('only one window of about 40 cards is ever drawn (never the whole catalogue): the page window clamps and covers every spot exactly once', () => {
  assert.equal(SPOTS_PER_PAGE, 40); assert.ok(SPOTS_PER_PAGE <= 60);
  const n = allSpots.length, first = pageWindow(n, 0); assert.deepEqual([first.from, first.to], [0, 40]); assert.equal(first.pages, Math.ceil(n / 40));
  const last = pageWindow(n, 9999); assert.equal(last.to, n); assert.equal(last.page, last.pages - 1); assert.equal(pageWindow(0, 3).pages, 1);
  let covered = 0; for (let p = 0; p < first.pages; p++) { const w = pageWindow(n, p); covered += w.to - w.from; assert.ok(w.to - w.from <= 40); } assert.equal(covered, n);
});
test('the Spots page uses the window, the search and the region chips, and keeps each card as it was', () => {
  const src = fs.readFileSync(new URL('../features/personal/PersonalView.tsx', import.meta.url), 'utf8');
  assert.match(src, /pageWindow\(orderedSpots\.length, spotPage\)/); assert.match(src, /shown\.map\(\(s, i\) => spotCard\(s, from \+ i\)\)/); assert.match(src, /aria-label="Search spots"/); assert.match(src, /aria-label="Region"/); assert.match(src, /Show next \{SPOTS_PER_PAGE\}/);
  assert.doesNotMatch(src, /spots\.map\(\(s, i\) => spotCard\(s, i\)\)/, 'no longer the whole catalogue');
});
