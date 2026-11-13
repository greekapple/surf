import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {callFor, SKILL_RANGE_FT} from '../services/call.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';
import {LEGACY_LEVEL, LEVELS, coarseSkill, levelOf, pickLevel, suggestLevel, suggestedVolume, PLUNGING_OK_FROM} from '../services/skillLevels.ts';
import {PERSONAL_KEYS, WHY, ageAnswer, deletedProfile, guardProfile, levelSource, sizeIsDefault} from '../services/profileFields.ts';
import {validateState, freshState} from '../utils/storage.ts';
import type {UserProfile} from '../models/index.ts';

const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const T0 = Date.parse('2026-11-02T00:00:00Z') / 1000, times = Array.from({length: 48}, (_, i) => T0 + i * 3600);
const marine = (m: number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'},
  hourly: {time: times, wave_height: times.map(() => m + .1), swell_wave_height: times.map(() => m), swell_wave_direction: times.map(() => 280), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => null), secondary_swell_wave_direction: times.map(() => null), secondary_swell_wave_period: times.map(() => null)}});
const weather = (mph: number) => ({hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => mph), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => mph * 1.3)}});
const spot = allSpots.find((s) => s.id === 'spot-2')!;
const prof = (o: Partial<UserProfile>): UserProfile => ({...defaultProfile, heightUnit: 'ft', scale: 'Face height', ...o});
/** The Call at daylight hours over a range of sizes, for a profile. */
const calls = (p: UserProfile) => [0.3, 0.8, 1.5, 2.5, 4, 6].flatMap((m) => { const recs = normalizeOpenMeteo(evidenceSpot('spot-2')!, marine(m), weather(4), '2026-11-02T00:00:00Z').map(toLegacy);
  return [16, 20, 23].map((k) =>   // 8 AM, noon and 3 PM PST on Nov 2 (daylight)
    callFor(spot, recs[k], p, {records: recs, nowMs: Date.parse('2026-11-02T18:00:00Z')})); });

test('skill migration: an old profile (no level picked) gets byte-identical calls; levels 2, 4 and 7 keep the old ranges', () => {
  for (const s of ['Beginner', 'Intermediate', 'Expert'] as const) {
    // the saved profile goes through the loader unchanged (no level is added), so the Call reads the old skill exactly as before
    const loaded = validateState({...freshState(), profile: prof({skill: s})}).profile;
    assert.equal(loaded.skillLevel, undefined, `${s}: loading adds no level`);
    assert.equal(JSON.stringify(calls(loaded)), JSON.stringify(calls(prof({skill: s}))), `${s}: byte-identical`);
    assert.equal(levelOf(loaded), LEGACY_LEVEL[s]);
    assert.deepEqual(LEVELS[LEGACY_LEVEL[s] - 1].callFt, SKILL_RANGE_FT[s], `${s} → level ${LEGACY_LEVEL[s]} keeps the old range`);
    // picking the mapped level changes the words that name it, never the verdict
    const picked = calls(prof({...pickLevel(LEGACY_LEVEL[s]), minWave: defaultProfile.minWave, maxWave: defaultProfile.maxWave}));
    assert.deepEqual(picked.map((c) => c.verdict), calls(loaded).map((c) => c.verdict), `${s}: same verdicts at level ${LEGACY_LEVEL[s]}`);
  }
  assert.deepEqual(LEGACY_LEVEL, {Beginner: 2, Intermediate: 4, Expert: 7});
});

test('skill: the Call names the level and its range; plunging at size is for levels 6–7', () => {
  const c = calls(prof({...pickLevel(1)})).find((x) => /level 1 \(first waves\) limits \(up to 3 ft\)/.test(x.why.join(' ')));
  assert.ok(c, 'a too-big hour names "level 1 (first waves) limits (up to 3 ft)"');
  assert.match(c!.basis, /your level \(level 1, first waves\)/, 'the basis line names the same level, never the coarse skill');
  assert.equal(PLUNGING_OK_FROM, 6);
  const src = read('../services/call.ts');
  assert.match(src, /lvl \? lvl\.n < PLUNGING_OK_FROM : profile\.skill !== 'Expert'/, 'the plunging Skip spares levels 6–7 (and the old Expert)');
  assert.match(src, /lvl \? 'levels 6–7 only' : 'experts only'/);
  for (const L of LEVELS) { assert.equal(coarseSkill(L.n), L.n <= 3 ? 'Beginner' : L.n <= 5 ? 'Intermediate' : 'Expert'); assert.ok(L.can.length >= 3 && L.can.length <= 4, `level ${L.n}: 3–4 "You can…"`); assert.ok(L.comfortFt[0] < L.comfortFt[1]); }
  assert.deepEqual(LEVELS.map((L) => L.comfortFt), [[1, 2], [1, 3], [1, 4], [2, 6], [3, 8], [3, 12], [4, 20]], 'the spec\'s default sizes');
  for (let i = 1; i < 7; i++) assert.ok(LEVELS[i].callFt.max >= LEVELS[i - 1].callFt.max, 'ceilings never fall with level');
});

test('skill: picking a level prefills the comfortable size (the Call names it); "Not sure?" suggests a level', () => {
  assert.deepEqual(pickLevel(5), {skillLevel: 5, skill: 'Intermediate', minWave: 3, maxWave: 8});
  const own = calls(prof({...pickLevel(4)})).map((c) => c.why.join(' ')).join(' ');
  assert.match(own, /range you prefer \(.*2.*6 ft\)|within the range you prefer \(2–6 ft\)/, 'the Call names the prefilled range');
  assert.equal(suggestLevel({duckDive: false, overhead: false, barrel: false}), 2);
  assert.equal(suggestLevel({duckDive: true, overhead: false, barrel: false}), 4);
  assert.equal(suggestLevel({duckDive: true, overhead: true, barrel: false}), 5);
  assert.equal(suggestLevel({duckDive: true, overhead: true, barrel: true}), 6);
});

test('weight: its only effect is Board Match\'s suggested volume (weight × the level\'s factor); no weight, no suggestion', () => {
  assert.equal(suggestedVolume(75, 4), 38); assert.equal(suggestedVolume(75, 1), 75); assert.equal(suggestedVolume(null, 4), null); assert.equal(suggestedVolume(5, 4), null, 'an impossible weight is not used');
  assert.match(read('../features/quiver/QuiverView.tsx'), /suggestedVolume\(p\.weightKg, lv\)/);
  assert.match(WHY.weight, /Board Match/);
  // weight never reaches the Call
  assert.equal(JSON.stringify(calls(prof({weightKg: 60}))), JSON.stringify(calls(prof({weightKg: 110}))));
});

test('height: changes the drawn person and the body words, never the Call; units and region do what their lines say', () => {
  assert.deepEqual(calls(prof({heightIn: 62})).map((c) => c.verdict), calls(prof({heightIn: 76})).map((c) => c.verdict), 'height never changes a verdict');
  assert.match(WHY.height, /person drawn next to the wave/);
  assert.match(read('../features/explore/FindSpots.tsx'), /p\.region/, 'the home region anchors Map › Find spots, as its line says');
  assert.match(WHY.region, /Find spots/);
  const ft = calls(prof({heightUnit: 'ft'})).map((c) => c.why.join(' ')).join(' '), m = calls(prof({heightUnit: 'm'})).map((c) => c.why.join(' ')).join(' ');
  assert.notEqual(ft, m, 'units change the numbers on screen');
});

test('age (COPPA): under 13 saves nothing personal, removes what was saved, and stores no age; 13+ is a band, never a birth date', () => {
  const full = prof({displayName: 'Kai', heightIn: 60, weightKg: 40, ageBand: '13-17'});
  const kid = guardProfile(full, ageAnswer('under-13'));
  for (const k of PERSONAL_KEYS) assert.equal(kid[k], undefined, `${k} removed`);
  assert.equal(kid.personalData, false);
  assert.match(read('../features/personal/ProfileSetup.tsx'), /onUnder13=\{\(\) => setStep\('child'\)\}/, 'setup ends on its under-13 message');
  const later = guardProfile(kid, {heightIn: 58, displayName: 'K', weightKg: 35});
  for (const k of PERSONAL_KEYS) assert.equal(later[k], undefined, `${k} is never saved after`);
  assert.equal(guardProfile(kid, {skillLevel: 2}).skillLevel, 2, 'the app still works: level, sizes and units are kept');
  assert.deepEqual(ageAnswer('18+'), {personalData: true, ageBand: '18+'});
  assert.equal(JSON.stringify(guardProfile(full, ageAnswer('under-13'))).includes('13-17'), false);
  assert.match(read('../hooks/useAppData.ts'), /guardProfile\(s\.profile,patch\)/, 'every profile save goes through the guard');
  assert.doesNotMatch(read('../features/personal/ProfileFields.tsx'), /type="date"|year of birth|birthYear|dateOfBirth/i, 'no birth date is asked');
});

test('the profile: never asks stance (nothing would change with it yet); every question has its "Why we ask"; delete clears every answer', () => {
  const fields = read('../features/personal/ProfileFields.tsx');
  assert.doesNotMatch(fields, /\b(stance|goofy|regular foot)\b/i);
  for (const k of ['age', 'sex', 'weight', 'skill', 'size', 'region', 'units'] as const) assert.match(fields, new RegExp(`<Why k="${k}"`), `${k} has its why line`);
  for (const f of ['../features/personal/ProfileSetup.tsx', '../features/personal/PersonalView.tsx']) assert.match(read(f), /<HeightField p=\{p\} set=\{set\} \/><Why k="height" \/>/, `${f}: height has its why line`);
  const del = deletedProfile();
  for (const k of [...PERSONAL_KEYS, 'skillLevel', 'personalData'] as const) assert.equal(del[k], undefined);
  assert.equal(del.onboarded, true);
  const saved = JSON.parse(JSON.stringify(guardProfile(prof({displayName: 'Kai', heightIn: 70, skillLevel: 5, weightKg: 80}), del)));
  for (const k of ['displayName', 'heightIn', 'weightKg', 'skillLevel'] as const) assert.equal(k in saved, false, `${k} gone after delete`);
  const legal = read('../ui/Legal.tsx');
  assert.match(legal, /Your surf profile/); assert.match(legal, /\{WHY\.age\}/); assert.match(legal, /does not ask your stance/);
});

test('storage: the new fields load and are validated; an impossible value is refused', () => {
  const ok = validateState({...freshState(), profile: prof({skillLevel: 6, weightKg: 72.5, ageBand: '18+', personalData: true})});
  assert.equal(ok.profile.skillLevel, 6);
  assert.throws(() => validateState({...freshState(), profile: prof({skillLevel: 9})}), /skill level/);
  assert.throws(() => validateState({...freshState(), profile: prof({weightKg: 900})}), /weight/);
  assert.throws(() => validateState({...freshState(), profile: prof({ageBand: '12' as never})}), /age/);
});

test('first run: setup is a full-screen flow before Home (never a modal), with Skip on every step', () => {
  const home = read('../features/home/HomeView.tsx'), setup = read('../features/personal/ProfileSetup.tsx');
  assert.doesNotMatch(home, /<ProfileSetup/, 'Home no longer carries the setup card (see first-run.test.ts)');
  assert.match(read('../app/App.tsx'), /showSetupFlow\(/, 'the flow is shown by the app shell before Home');
  assert.doesNotMatch(setup, /role="dialog"|aria-modal/);
  assert.equal((setup.match(/\{skip\}/g) ?? []).length, 3, 'Skip for now on Welcome, About you and How you surf');
  assert.match(setup, /disabled=\{!ageDone\}/, 'the age question is the one required answer');
});

test('profile (data-honesty review): each why line matches its effect; defaults say so; restore is guarded', () => {
  assert.match(WHY.height, /person drawn next to the wave and the "about N× your height" line/);
  assert.doesNotMatch(WHY.height, /overhead|body/, 'body words do not use your height');
  assert.match(WHY.skill, /Board Match/); assert.equal(WHY.units, 'Wave heights and wind speeds on screen.');
  assert.equal(levelSource(prof({})), ' (default)'); assert.equal(levelSource(prof({skill: 'Expert'})), ' (from your earlier setting)'); assert.equal(levelSource(prof({skillLevel: 3})), '');
  assert.equal(sizeIsDefault(prof({})), true); assert.equal(sizeIsDefault(prof({...pickLevel(5)})), false);
  assert.match(read('../hooks/useAppData.ts'), /profile:guardProfile\(value\.profile,\{\}\)/, 'a restored backup goes through the under-13 guard');
  assert.doesNotMatch(read('../features/personal/ProfileSetup.tsx'), /nothing personal is saved/, 'the under-13 message names exactly what is not saved');
  assert.match(read('../features/personal/ProfileFields.tsx'), /the Call skips above/, 'each card says where the Call skips, beside its comfortable size');
});
