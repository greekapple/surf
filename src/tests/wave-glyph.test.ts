import {test} from 'node:test';
import assert from 'node:assert/strict';
import {glyphFor, glyphLayout, steepFromPeriod, swellLine} from '../services/waveGlyph.ts';
import {heroMediaFor, spotMediaFor} from '../features/home/heroMedia.ts';
import {camsFor, CAMS} from '../data/cams.ts';
import type {HeadlineSurf} from '../services/headlineSurf.ts';

const est = (loFt: number, hiFt: number): HeadlineSurf => ({kind: 'estimate', loFt, hiFt, words: null, wordsNote: '', method: 'mop-v2', methodLabel: '', label: 'model estimate'});
const person = 70 / 12; // 5'10"
/** Highest point (smallest y) any coordinate of an SVG path reaches. */
const topY = (d: string) => { const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number); return Math.min(...n.filter((_, i) => i % 2 === 1)); };

test('T-106: the drawn height-to-person ratio matches the number (both bounds) within 10% at three sizes (2–3, 4–6 and 10–15 ft), every box size, curl or not', () => {
  for (const [lo, hi] of [[2, 3], [4, 6], [10, 15]] as const) {
    const g = glyphFor(est(lo, hi), person, 12, 'spilling');
    assert.ok(g && g.kind === 'surf');
    for (const [W, H] of [[300, 150], [104, 56], [40, 20]]) for (const curl of [false, true]) {
      const L = glyphLayout({...g, curl}, W, H);
      // Both drawn bounds against the person: the outer outline reaches the high bound, the inner one the low bound (the number's own range).
      for (const [px, ft, d] of [[L.hiH, hi, L.hi], [L.loH, lo, L.lo]] as const) {
        assert.ok(Math.abs(px / L.personH / (ft / person) - 1) <= 0.1, `${lo}–${hi} ft, ${ft} ft bound in ${W}×${H}: drawn ${(px / L.personH).toFixed(2)} vs ${(ft / person).toFixed(2)}`);
        // The outline itself reaches that height (control points included; the curl's lip may rise 4% over the crest, as on the spot page).
        assert.ok(Math.abs((L.base - topY(d)) / L.personH / (ft / person) - 1) <= 0.1, `${ft} ft outline height (${W}×${H}, curl ${curl})`);
      }
      assert.ok(L.person.x + L.person.w <= W && L.crestX < L.person.x, 'wave and person both fit, wave left of the person');
    }
  }
});

test('T-106: the drawing uses the same headline range as the number; no estimate draws nothing; offshore-only is a flat swell line', () => {
  const g = glyphFor(est(4, 6), person, 12, null);
  assert.deepEqual(g && g.kind === 'surf' ? [g.midFt, g.loFt, g.hiFt] : null, [5, 4, 6]);
  assert.equal(glyphFor({kind: 'none', label: 'No estimate'}, person, 12, 'plunging'), null);
  assert.equal(glyphFor(null, person, 12, null), null);
  assert.equal(glyphFor({kind: 'demonstration', ft: 5, label: 'demo'}, person, 12, null), null);
  assert.deepEqual(glyphFor({kind: 'offshore', ft: 7.2, label: 'offshore · not surf size'}, person, 12, 'plunging'), {kind: 'offshore', ft: 7.2});
  assert.match(swellLine(104, 56), /^M2 /);
});

test('T-106: a curl only for an estimated plunging break; steepness follows the period', () => {
  for (const b of ['spilling', 'surging', 'unknown', null] as const) assert.equal((glyphFor(est(4, 6), person, 14, b) as {curl: boolean}).curl, false, String(b));
  assert.equal((glyphFor(est(4, 6), person, 14, 'plunging') as {curl: boolean}).curl, true);
  assert.equal(steepFromPeriod(6), 0); assert.equal(steepFromPeriod(16), 1); assert.equal(steepFromPeriod(11), 0.5); assert.equal(steepFromPeriod(null), 0.5); assert.equal(steepFromPeriod(30), 1);
});

test('T-106: the hero media order is cam, then the drawing; only https SWELLO cams for that spot count', () => {
  assert.deepEqual(heroMediaFor('spot-2'), {kind: 'drawn'}); // no SWELLO cams configured yet
  const cam = {spotId: 'spot-2', src: 'https://stream.example/ob.m3u8', label: 'Live cam · SWELLO' as const, since: '2026-11-03'};
  assert.deepEqual(heroMediaFor('spot-2', [cam]), {kind: 'cam', cam});
  assert.deepEqual(heroMediaFor('spot-3', [cam]), {kind: 'drawn'});
  assert.deepEqual(heroMediaFor('spot-2', [{...cam, src: 'http://insecure/ob.m3u8'}]), {kind: 'drawn'});
});

test('T-111: the spot hero order is own cam, then the credited photo, then the drawn wave, then the coast plan; public cams are links, never media', () => {
  const cam = {spotId: 'spot-2', src: 'https://stream.example/ob.m3u8', label: 'Live cam · SWELLO' as const, since: '2026-11-03'};
  assert.deepEqual(spotMediaFor('spot-2', {photo: true, drawn: true}, [cam]), {kind: 'cam', cam});
  assert.deepEqual(spotMediaFor('spot-2', {photo: true, drawn: true}), {kind: 'photo'});
  assert.deepEqual(spotMediaFor('cs-county-line', {photo: false, drawn: true}), {kind: 'drawn'});
  assert.deepEqual(spotMediaFor('cs-county-line', {photo: false, drawn: false}), {kind: 'plan'});
  // A spot with a verified PUBLIC cam (Morro Rock) still shows its photo: other owners' cams are listed as links, not played in the hero.
  assert.equal(camsFor('cs-morro-rock').length, 1); assert.deepEqual(spotMediaFor('cs-morro-rock', {photo: true, drawn: true}), {kind: 'photo'});
  assert.ok(CAMS.every((c) => /^https:\/\//.test(c.url) && c.owner && c.verified), 'every public cam names its owner and when it was checked');
});
