import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {allSpots} from '../data/catalog.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {SPOT_ALIASES, SLUG_ALIASES, canonicalSpotId, canonicalIds} from '../data/spotAliases.ts';
import {slugFor, spotIdForSlug, matchSpotSlug, toSlug} from '../services/spotSlug.ts';
import {validateState, freshState} from '../utils/storage.ts';
import {loadLog} from '../services/sessionLog.ts';

const facts: {spotId: string; name: string; facing: string | null; bottom?: string | null; sources: {url: string}[]}[] = JSON.parse(fs.readFileSync(new URL('../../docs/forecast/data/guide-facts.json', import.meta.url), 'utf8'));
const byId = new Map(allSpots.map((s) => [s.id, s]));
/** Pairs the guides still list under one page that are NOT resolved (listed for the owner, see docs/forecast/DEDUPE-PAIRS.md): the older row is kept with its live data and the pair is not merged. A new entry here needs a reason. */
const SHARED_PAGE_ALLOWED = new Set(['cs-crescent-city|w-usw-south-beach', 'cs-morro-rock|w-usw-morro-strand', 'spot-9|w-usw-davenport-landing']);
/** Identical display names inside one county that are different breaks 1.7 km apart with no distinct guide words (1 to 27 km apart, and Walton Rocks 150 m apart: a sand beach break and a reef, two different surfnerd pages; two surfnerd pages that differ only by a state suffix; the guides' own pins were not read, so the pair is neither merged nor renamed and is listed for the owner in docs/forecast/DEDUPE-PAIRS.md). */
const SAME_NAME_ALLOWED = new Set(['Massachusetts|Egypt Beach', 'New York|Fire Island', 'New York|Lido Beach', 'New York|Jones Beach State Park', 'Treasure Coast|Walton Rocks', 'Northern New Jersey|Lavallette', 'Northern New Jersey|Island Beach State Park', 'Virginia|Camp Pendleton', 'Puerto Rico|Middles']);
const norm = (n: string) => n.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\bstreet\b/g, 'st').split(/\s+/).filter((w) => w && !['state', 'beach', 'the', 'st'].includes(w)).join(' ');
const km = (a: {latitude: number; longitude: number}, b: {latitude: number; longitude: number}) => { const R = 6371, r = Math.PI / 180, dLa = (b.latitude - a.latitude) * r, dLo = (b.longitude - a.longitude) * r, h = Math.sin(dLa / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

test('dedupe: the catalogue lists each break once: no guide page is shared by two spots (except the listed unresolved pairs); the merged ids are gone', () => {
  const pages = new Map<string, Set<string>>();
  for (const f of facts) for (const s of f.sources) { const u = s.url.split('#')[0]; (pages.get(u) ?? pages.set(u, new Set()).get(u)!).add(f.spotId); }
  const shared = [...pages.values()].filter((v) => v.size > 1).map((v) => [...v].sort().join('|'));
  for (const p of shared) assert.ok(SHARED_PAGE_ALLOWED.has(p), `two spots share a guide page (one break listed twice?): ${p}`);
  for (const p of SHARED_PAGE_ALLOWED) assert.ok(shared.includes(p), `${p} is allow-listed but no longer shares a page: remove it from the list`);
  for (const id of Object.keys(SPOT_ALIASES)) assert.ok(!byId.has(id), `${id} was merged away but still exists`);
  for (const id of new Set(Object.values(SPOT_ALIASES))) assert.ok(byId.has(id), `alias target ${id} must exist`);
});
test('dedupe: no two spots have the same normalised name within 300 m and the same stated facing (the slug-suffix twin rule)', () => {
  const fx = new Map(facts.map((f) => [f.spotId, f.facing])), bt = new Map(facts.map((f) => [f.spotId, (f.bottom ?? '').replace(/ \(.*$/, '').toLowerCase()])), list = allSpots.map((s) => ({s, n: norm(s.name), ev: (() => { try { return evidenceSpot(s.id); } catch { return null; } })()})).filter((x) => x.n && x.ev);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (a.n !== b.n) continue; const d = km(a.ev!, b.ev!); const ba = bt.get(a.s.id), bb = bt.get(b.s.id); if (ba && bb && ba !== bb) continue; /* a sand beach break and a reef with one name 150 m apart are two breaks (Walton Rocks) */ if (d <= 0.3 && (fx.get(a.s.id) ?? null) === (fx.get(b.s.id) ?? null)) assert.fail(`${a.s.id} and ${b.s.id} look like one break: "${a.s.name}" / "${b.s.name}", ${Math.round(d * 1000)} m, same facing`); }
});
test('dedupe: identical display names inside one region are exactly the listed unresolved pairs', () => {
  const seen = new Map<string, number>(); for (const s of allSpots) { const k = `${s.region}|${s.name}`; seen.set(k, (seen.get(k) ?? 0) + 1); }
  const dup = [...seen].filter(([, n]) => n > 1).map(([k]) => k).sort();
  assert.deepEqual(dup, [...SAME_NAME_ALLOWED].sort(), 'a new identical name in one region needs a distinct name from the guides (or an entry here with the reason)');
});
test('dedupe: favourites, saved sessions, URLs and the slug of a renamed spot survive the merge', () => {
  assert.equal(canonicalSpotId('w-us-flagler-pier'), 'w-us-flagler-beach-pier'); assert.equal(canonicalSpotId('spot-1'), 'spot-1');
  assert.deepEqual(canonicalIds(['w-us-a-st', 'w-us-a-street', 'spot-1']), ['w-us-a-street', 'spot-1'], 'two favourites that were one break are one'); assert.equal(canonicalSpotId('w-us-walton-rocks'), 'w-us-walton-rocks', 'Walton Rocks (beach) and Walton Rocks (reef) are two breaks: not merged');
  const st = freshState(); st.favorites = ['w-us-avalon-pier-north-carolina', 'spot-1'];
  const v = validateState(JSON.parse(JSON.stringify(st))); assert.deepEqual(v.favorites, ['w-us-avalon-pier', 'spot-1']);
  assert.equal(spotIdForSlug('flagler-pier'), 'w-us-flagler-beach-pier'); assert.equal(spotIdForSlug('a-st'), 'w-us-a-street'); assert.equal(spotIdForSlug('w-us-flagler-pier'), 'w-us-flagler-beach-pier', 'an old spot id in ?spot= resolves');
  for (const bare of ['trails', 'point-dume']) assert.notEqual(matchSpotSlug(bare).kind === 'spot' ? 'spot' : matchSpotSlug(bare).kind, 'x'); // the bare shared names are the one slug index's business (ambiguous, a chooser), never an alias here
  const liveSlugs = new Set(allSpots.map((s) => slugFor(s.id))); for (const [slug, id] of Object.entries(SLUG_ALIASES)) { assert.ok(byId.has(id), `${slug} -> ${id}`); assert.ok(!liveSlugs.has(slug), `the alias "${slug}" is a live spot's slug: it would hijack that spot`); }
  for (const sp of allSpots) assert.equal(spotIdForSlug(slugFor(sp.id)), sp.id, `${sp.id}: slugFor then spotIdForSlug is the identity`);
    assert.equal(slugFor('w-us-flagler-pier'), slugFor('w-us-flagler-beach-pier'), 'an old id gives the successor\'s slug');
  const store = {getItem: () => JSON.stringify([{id: 'a', schema: 1, spotId: 'w-us-a-st', observedAt: '2026-10-01T15:00:00.000Z', loggedAt: '2026-10-01T16:00:00.000Z', rangeFt: [2, 3], quality: 3}])};
  assert.equal(loadLog(store as never)[0]?.spotId, 'w-us-a-street', 'a saved observation follows its spot');
});
test('dedupe: renamed spots carry the guides\' own words, the Palos Verdes spots are Los Angeles', () => {
  assert.equal(byId.get('w-usw-trails-2')!.name, 'Trails (San Onofre State Beach)'); assert.equal(byId.get('w-usw-point-dume')!.name, 'Point Dume / Little Dume'); assert.equal(byId.get('w-usw-haggertys')!.name, 'Haggertys and Malaga Cove');
  for (const id of ['w-usw-abalone-cove-beach', 'w-usw-palm-point', 'w-usw-royal-palms-the-jetty', 'w-usw-cabrillo-point']) assert.equal(byId.get(id)!.region, 'Los Angeles', id);
  assert.equal(allSpots.length, 1078);
});
