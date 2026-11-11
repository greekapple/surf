import test from 'node:test';
import assert from 'node:assert/strict';
import {completion, fold, searchSpots, withinOne, type SearchSpot} from '../services/spotSearch.ts';
import {evidenceSpots} from '../ocean/spots.ts';

// Spec 2026-11-10-map-zoom-groups.md §6 (search autofill).
const S: SearchSpot[] = [
  {id: 'pipe', name: 'Pipeline & Backdoor', region: 'Oahu North Shore'}, {id: 'hoo', name: "Ho'okipa", region: 'Maui'}, {id: 'fp', name: 'Malibu - First Point', region: 'Los Angeles'},
  {id: 'mz', name: 'Malibu - Zuma', region: 'Los Angeles'}, {id: 'pp', name: 'Pleasure Point', region: 'Santa Cruz'}, {id: 'pip2', name: 'Pipes', region: 'San Diego'},
  {id: 'sun', name: 'Sunset', region: 'Oahu North Shore'}, {id: 'cafe', name: 'Café Reef', region: 'Big Island'},
];
const ids = (q: string, o = {}) => searchSpots(S, q, o).map((h) => h.id);
test('fold: case, accents and apostrophes (okina too) are ignored', () => {
  assert.equal(fold("Ho'okipa"), 'hookipa'); assert.equal(fold('Hoʻokipa'), 'hookipa'); assert.equal(fold('Café  Reef'), 'cafe reef'); assert.equal(fold('Malibu - First Point'), 'malibu first point');
});
test('"pip" completes to Pipeline; prefix ranks before word starts, then regions, then typos', () => {
  const h = searchSpots(S, 'pip'); assert.deepEqual(h.map((x) => x.id), ['pipe', 'pip2']); assert.equal(completion('Pip', h[0]), 'eline & Backdoor');
  assert.deepEqual(ids('first point'), ['fp']); assert.equal(searchSpots(S, 'first point')[0].kind, 'word'); assert.equal(completion('first point', searchSpots(S, 'first point')[0]), '', 'no inline completion for a word-start match');
  assert.deepEqual(ids('point'), ['fp', 'pp']);
});
test('"hookipa" finds Ho\'okipa and completes over the apostrophe; "cafe" finds Café', () => {
  assert.deepEqual(ids('hookipa'), ['hoo']); assert.equal(completion('hoo', searchSpots(S, 'hoo')[0]), 'kipa'); assert.deepEqual(ids('cafe'), ['cafe']);
});
test('"malibu" lists the Malibu spots; a region name lists its spots ("oahu")', () => {
  assert.deepEqual(ids('malibu'), ['fp', 'mz']); assert.deepEqual(ids('oahu'), ['pipe', 'sun']); assert.equal(searchSpots(S, 'oahu')[0].kind, 'region');
});
test('one typo is forgiven for 5 letters or more ("pipelin" with a typo still finds Pipeline); not for short queries', () => {
  assert.ok(ids('pipelune').includes('pipe')); assert.ok(ids('piepline').includes('pipe'), 'swapped letters'); assert.ok(ids('sunsett').includes('sun'));
  assert.deepEqual(ids('pjp'), [], 'three letters: no typo matching');
  assert.ok(withinOne('abcde', 'abde')); assert.ok(withinOne('abcde', 'abdce')); assert.ok(!withinOne('abcde', 'abxye'));
});
test('favourites, then recent picks, lift a spot among equal matches; the order is deterministic', () => {
  assert.deepEqual(ids('malibu', {favorites: ['mz']}), ['mz', 'fp']); assert.deepEqual(ids('malibu', {recents: ['mz']}), ['mz', 'fp']);
  assert.deepEqual(ids('pip', {favorites: ['pip2']}), ['pip2', 'pipe']);
  assert.deepEqual(ids('malibu'), ids('malibu'));
});
test('fast enough: 1,032 spots, under 16 ms per keystroke at 4x CPU (here: under 4 ms per keystroke on this machine, the index built once)', () => {
  const many: SearchSpot[] = Array.from({length: 1032}, (_, i) => ({...evidenceSpots[i % evidenceSpots.length], id: `s${i}`}));
  searchSpots(many, 'warm');
  const keys = ['p', 'pi', 'pip', 'pipe', 'pipel', 'pipeli', 'pipelin', 'pipeline', 'm', 'ma', 'mal', 'mali', 'malib', 'malibu', 'oahu', 'hookipa'];
  const t0 = performance.now(); for (let r = 0; r < 5; r++) for (const k of keys) searchSpots(many, k); const per = (performance.now() - t0) / (5 * keys.length);
  assert.ok(per < 4, `${per.toFixed(2)} ms per keystroke`);
});
test('the completion never doubles a space or punctuation the person already typed', () => {
  const h = searchSpots(S, 'pipeline ')[0]; assert.equal(h.id, 'pipe'); assert.equal(completion('pipeline ', h), '& Backdoor'); assert.equal(completion('pipeline', h), ' & Backdoor');
});
