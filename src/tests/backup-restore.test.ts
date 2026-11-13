import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState, parseRestore, type AppState} from '../utils/storage.ts';
import {allSpots} from '../data/catalog.ts';

/** What useAppData.exportData writes: the state as indented JSON. */
const exportText = (s: AppState) => JSON.stringify(s, null, 2);

function populated(): AppState {
  const s = freshState();
  s.profile = {...s.profile, displayName: 'Sam', skill: 'Expert', heightUnit: 'm', windUnit: 'kn', minWave: 3, maxWave: 8, onboarded: true, setupState: 'done', personalization: true, preferredBoards: ['Fish'], heightIn: 70};
  s.boards = [...s.boards, {id: 'b-own', name: 'My twin', manufacturer: 'Local shaper', model: 'Twin', type: 'Fish', length: 68, width: 21, thickness: 2.5, volume: 33, favorite: true, demo: false, notes: 'Keel fins'}];
  s.boards[0] = {...s.boards[0], favorite: true};
  s.favorites = [allSpots[0].id, allSpots[1].id];
  s.sessions = [{id: 's1', spotId: allSpots[0].id, timestamp: '2026-11-01T15:00:00.000Z', boardId: 'b-own', actualConditions: 'Chest high, clean', accuracy: 7, performance: 6, satisfaction: 8, notes: 'Fun'}];
  return s;
}

test('restore: export → restore gives the identical state (fresh and populated)', () => {
  for (const s of [freshState(), populated()]) {
    const {state} = parseRestore(exportText(s));
    assert.deepEqual(state, s);
    assert.equal(exportText(state), exportText(s), 'a second export is byte-identical');
  }
});

test('restore: the preview counts boards, example boards, sessions, favorites and settings', () => {
  const s = populated(), {preview} = parseRestore(exportText(s));
  assert.deepEqual(preview, {boards: 5, exampleBoards: 4, sessions: 1, favorites: 2, settings: Object.keys(s.profile).length});
});

test('restore: malformed and foreign files are rejected with a clear message', () => {
  const good = populated();
  const cases: [string, RegExp][] = [
    ['', /not valid JSON/],
    ['{"version":1,', /not valid JSON/],
    ['[]', /not a SWELLO backup/],
    ['"text"', /not a SWELLO backup/],
    [JSON.stringify({name: 'some-package', version: '1.0.0', dependencies: {}}), /not a SWELLO backup/],
    [JSON.stringify({...good, extra: true}), /not a SWELLO backup/],
    [JSON.stringify({version: 1, profile: good.profile, boards: good.boards, favorites: good.favorites}), /not a SWELLO backup/],
    [JSON.stringify({...good, version: 2}), /version 2/],
    [JSON.stringify({...good, version: '1'}), /version "1"/],
    [JSON.stringify({...good, profile: null}), /profile is missing/],
    [JSON.stringify({...good, profile: {...good.profile, token: 'x'}}), /unknown profile field "token"/],
    [JSON.stringify({...good, profile: {...good.profile, heightIn: 900}}), /height/],
    [JSON.stringify({...good, profile: {...good.profile, skill: 'Pro'}}), /skill/],
    [JSON.stringify({...good, boards: [{...good.boards[0], length: -1}]}), /dimensions/],
    [JSON.stringify({...good, boards: [good.boards[0], good.boards[0]]}), /board/],
    [JSON.stringify({...good, favorites: ['no-such-spot']}), /favorite/],
    [JSON.stringify({...good, sessions: [{id: 's'}]}), /session/],
    ['x'.repeat(5_000_001), /5 MB/],
  ];
  for (const [text, msg] of cases) assert.throws(() => parseRestore(text), msg, text.slice(0, 80));
});
