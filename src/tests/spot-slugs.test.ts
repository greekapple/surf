import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allSpots} from '../data/catalog.ts';
import {buildSlugIndex, resolveSlug, suggestSpots, toSlug} from '../app/slugs.ts';
import {parseRoute} from '../app/routes.ts';

const index = buildSlugIndex(allSpots);

test('audit B3: every spot has its own slug, and every slug opens that spot', () => {
  const slugs = allSpots.map((s) => index.slugOf.get(s.id)!);
  assert.equal(new Set(slugs).size, allSpots.length, 'slugs are unique');
  for (const s of allSpots) assert.deepEqual(resolveSlug(index, index.slugOf.get(s.id)!), {kind: 'spot', id: s.id}, s.id);
});

test('audit B3: spots with a unique name keep their old slug', () => {
  for (const s of allSpots) if (allSpots.filter((x) => toSlug(x.name) === toSlug(s.name)).length === 1) assert.equal(index.slugOf.get(s.id), toSlug(s.name));
  assert.equal(index.slugOf.get('spot-2') ?? '', toSlug(allSpots.find((s) => s.id === 'spot-2')!.name));
});

test('audit B3: S Turns (Outer Banks) and S-Turns (Maui) are both reachable; the shared old slug never silently picks one', () => {
  const nc = index.slugOf.get('w-us-s-turns-north-carolina'), hi = index.slugOf.get('w-hawaii-s-turns');
  assert.equal(nc, 's-turns-outer-banks'); assert.equal(hi, 's-turns-maui');
  assert.deepEqual(resolveSlug(index, 's-turns'), {kind: 'ambiguous', ids: ['w-us-s-turns-north-carolina', 'w-hawaii-s-turns']});
  // the old slug stays an alias where only one of the spots with that name can be shown
  assert.deepEqual(resolveSlug(index, 's-turns', (id) => id === 'w-hawaii-s-turns'), {kind: 'spot', id: 'w-hawaii-s-turns'});
});

test('audit B3: same name and region get a numbered slug; unknown slugs are unknown', () => {
  const ix = buildSlugIndex([{id: 'a', name: 'Trails', region: 'San Diego'}, {id: 'b', name: 'Trails', region: 'San Diego'}, {id: 'c', name: 'Trails San Diego', region: 'X'}]);
  assert.equal(ix.slugOf.get('c'), 'trails-san-diego', 'a unique bare name is never taken by a qualified slug');
  assert.equal(ix.slugOf.get('a'), 'trails-san-diego-2'); assert.equal(ix.slugOf.get('b'), 'trails-san-diego-3');
  assert.deepEqual(resolveSlug(index, 'not-a-real-spot'), {kind: 'unknown'});
});

test('audit B2: an unknown slug suggests spots that share its words', () => {
  const spots = [{id: '1', name: 'Malibu (Surfrider)', region: 'Los Angeles'}, {id: '2', name: 'Ocean Beach', region: 'San Francisco'}, {id: '3', name: 'Malibu Point', region: 'Los Angeles'}];
  assert.deepEqual(suggestSpots('malibu', spots).map((s) => s.id), ['3', '1']);
  assert.equal(suggestSpots('malibu-surfrider-beach', spots)[0].id, '1');
  assert.deepEqual(suggestSpots('xyz', spots), []);
});

test('audit B2: unknown pages are not found, never silently Home or the first section', () => {
  assert.deepEqual(parseRoute('/this-does-not-exist'), {area: 'home', section: '', notFound: true});
  assert.equal(parseRoute('/forecast/not-a-spot-slug-xyz').notFound, true);
  assert.equal(parseRoute('/quiver/bogus').notFound, true);
  assert.equal(parseRoute('/personal/spots/extra').notFound, true);
  for (const ok of ['/', '/home', '/forecast', '/forecast/wave-scale', '/scale', '/map', '/map/compare', '/forecast/compare', '/quiver/match', '/personal/terms']) assert.ok(!parseRoute(ok).notFound, ok);
  assert.deepEqual(parseRoute('/forecast/compare'), {area: 'explore', section: 'compare'});
});

// Review fix: today's slugs are pinned, so a catalogue change that would silently move a shared link fails here first.
test('B3 pin: the slugs of the 13 audited shared names and a sample of unique names do not move', () => {
  const pinned: Record<string, string> = {
    'w-usw-crescent-beach': 'crescent-beach-clallam', 'w-us-crescent-beach': 'crescent-beach-northeast-florida',
    'w-usw-rockaway-beach': 'rockaway-beach-tillamook', 'cs-rockaway': 'rockaway-beach-san-mateo',
    'w-us-jones-beach-state-park': 'jones-beach-state-park-new-york', 'w-us-jones-beach-state-park-2': 'jones-beach-state-park-new-york-2',
    'w-us-lavallette-new-jersey': 'lavallette-northern-new-jersey', 'w-us-lavallette': 'lavallette-northern-new-jersey-2',
    'w-us-island-beach-state-park': 'island-beach-state-park-northern-new-jersey', 'w-us-island-beach-state-park-new-jersey': 'island-beach-state-park-northern-new-jersey-2',
    'w-us-camp-pendleton-virginia': 'camp-pendleton-virginia', 'w-us-camp-pendleton': 'camp-pendleton-virginia-2',
    'w-us-avalon-pier': 'avalon-pier', /* dedupe-pairs: the two Avalon Piers were one break */
    'w-us-s-turns-north-carolina': 's-turns-outer-banks', 'w-hawaii-s-turns': 's-turns-maui',
    /* dedupe-pairs: renamed from the guides' own words, so each is now unique */ 'w-usw-point-dume': 'point-dume-little-dume', 'w-usw-point-dume-2': 'point-dume',
    'w-usw-haggertys-2': 'haggertys', 'w-usw-haggertys': 'haggertys-and-malaga-cove',
    'w-usw-trails-2': 'trails-san-onofre-state-beach', 'w-usw-trails': 'trails',
    'w-usw-rockpile': 'rockpile-san-diego', 'w-hawaii-rockpile': 'rockpile-oahu-north-shore',
    'w-us-walton-rocks-2': 'walton-rocks-treasure-coast', 'w-us-walton-rocks': 'walton-rocks-treasure-coast-2',
    'spot-2': 'ocean-beach', 'spot-3': 'linda-mar', 'cs-malibu': 'malibu-surfrider', 'w-hawaii-pipeline-backdoor': 'pipeline-backdoor', 'w-us-cocoa-beach': 'cocoa-beach',
  };
  for (const [id, slug] of Object.entries(pinned)) assert.equal(index.slugOf.get(id), slug, id);
});

test('B3: a spot id is accepted as a slug (older links wrote ?spot=spot-2)', () => {
  assert.deepEqual(resolveSlug(index, 'spot-2'), {kind: 'spot', id: 'spot-2'});
  assert.deepEqual(resolveSlug(index, 'w-hawaii-s-turns'), {kind: 'spot', id: 'w-hawaii-s-turns'});
});
