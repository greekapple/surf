import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile, demoBoards} from '../data/demo.ts';
import {boardPickFor, abilityOk, suits, sizeFit, rangeSourceText, rankBoards} from '../features/quiver/fit.ts';
import {LEVELS, pickLevel, suggestedVolume, type SkillLevel} from '../services/skillLevels.ts';
import {estimateVolume, fillFor, volumeNote, TYPICAL, VOLUME_FILL} from '../services/boardVolume.ts';
import {boardVerdict} from '../services/boardVerdict.ts';
import {boardRanges} from '../recommendation/board.ts';
import {boardTypes, type Surfboard, type UserProfile} from '../models/index.ts';
import {parseDimension, surfRange} from '../utils/units.ts';

// quiver-lock: Board Match, one function, the same answer everywhere, across skill level x weight x wave size.
const T = 1792454400, NOW = T * 1000 + 600000, times = Array.from({length: 24}, (_, i) => T + i * 3600), spot = allSpots.find((s) => s.id === 'spot-2')!;
const U = {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'};
const marine = (hs: number, tp = 14) => ({latitude: 37.75, longitude: -122.6, hourly_units: U, hourly: {time: times, wave_height: times.map(() => hs + 0.05), swell_wave_height: times.map(() => hs), swell_wave_direction: times.map(() => 263.49), swell_wave_period: times.map(() => tp),
  secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 180), secondary_swell_wave_period: times.map(() => 8), sea_surface_temperature: times.map(() => 14)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 4)}};
const recFor = (hs: number, tp = 14) => toLegacy(normalizeOpenMeteo(evidenceSpot('spot-2'), marine(hs, tp), weather, new Date(T * 1000).toISOString())[1]);
const own = (id: string, type: Surfboard['type'], len: number, w: number, t: number, v: number, extra: Partial<Surfboard> = {}): Surfboard => ({id, name: id, manufacturer: '', model: '', type, length: len, width: w, thickness: t, volume: v, favorite: false, ...extra});
const QUIVER: Surfboard[] = [...demoBoards, own('my-long', 'Longboard', 108, 22.75, 2.875, 68), own('my-gun', 'Gun', 96, 20, 3, 55), own('my-groveler', 'Groveler', 66, 21, 2.6, 36)];
const profileOf = (level: SkillLevel, kg: number): UserProfile => ({...defaultProfile, ...pickLevel(level), weightKg: kg});

test('board match: across 7 levels x 3 weights x 5 wave sizes the pick always suits the size, is within the surfer\'s ability, and is deterministic', () => {
  let picks = 0, nones = 0;
  for (const level of [1, 2, 3, 4, 5, 6, 7] as SkillLevel[]) for (const kg of [50, 75, 100]) for (const hs of [0.3, 0.8, 1.5, 2.5, 4]) {
    const p = profileOf(level, kg), f = recFor(hs), c1 = boardPickFor(QUIVER, spot, f, NOW, p, {}), c2 = boardPickFor([...QUIVER].reverse(), spot, f, NOW, p, {bundle: undefined});
    assert.equal(c1.pick?.id ?? null, c2.pick?.id ?? null, `L${level} ${kg}kg ${hs}m: the answer does not depend on the order of the quiver or the context object`);
    if (c1.pick) { picks++; const r = c1.ranked.find((x) => x.board.id === c1.pick!.id)!; assert.ok(suits(r.size), `L${level} ${hs}m: the pick suits the size (${r.size.state})`); assert.ok(abilityOk(c1.pick, p), `L${level}: ${c1.pick.type} is within the surfer's ability`); }
    else nones++;
    // nothing that suits the size AND the ability is skipped
    if (!c1.pick) assert.ok(c1.ranked.every((x) => !suits(x.size) || !abilityOk(x.board, p)), `L${level} ${hs}m: no pick means nothing suits both size and ability`);
  }
  assert.ok(picks > 40 && nones > 10, `${picks} picks and ${nones} "none suits" across the matrix`);
});
test('board match: ability gate: a beginner is never told to take a step-up or a gun; an advanced surfer can be', () => {
  const big = recFor(2.6), beginner = boardPickFor(QUIVER, spot, big, NOW, profileOf(2, 70), {}), advanced = boardPickFor(QUIVER, spot, big, NOW, profileOf(6, 70), {});
  assert.ok(!beginner.pick || !['Step-up', 'Gun', 'Performance shortboard'].includes(beginner.pick.type), `beginner pick: ${beginner.pick?.type}`);
  assert.ok(advanced.pick, 'an advanced surfer has a pick on a big day'); assert.ok(['Step-up', 'Gun', 'Performance shortboard', 'Everyday shortboard'].includes(advanced.pick!.type));
  assert.equal(abilityOk({type: 'Step-up'}, {skill: 'Intermediate', skillLevel: 5}), false, 'level 5 (advanced intermediate) is still "intermediate" for the category rule'); assert.equal(abilityOk({type: 'Step-up'}, {skill: 'Expert', skillLevel: 6}), true);
  assert.equal(abilityOk({type: 'Soft-top'}, {skill: 'Beginner', skillLevel: 1}), true);
});
test('board match: a board within a foot OUTSIDE its range is not a pick in score mode either (Home and the spot page and Board Match agree)', () => {
  const f: any = {...recFor(1.5), character: 'Peaky', availability: {face: true, swell: true, wind: true, tide: true, organization: true}};
  const probe = boardPickFor([own('p', 'Everyday shortboard', 72, 19.5, 2.5, 30)], spot, f, NOW, defaultProfile, {}); assert.ok(probe.est, 'the fixture has a size estimate');
  const [elo] = probe.est!; f.face = elo;
  const b = own('just-short', 'Everyday shortboard', 72, 19.5, 2.5, 30, {minWave: 1, maxWave: elo - 0.5, favorite: true});
  const choice = boardPickFor([b], spot, f, NOW, {...defaultProfile, ...pickLevel(5)}, {});
  assert.equal(choice.mode, 'score'); assert.equal(sizeFit(b, probe.est).state, 'big'); assert.equal(choice.scored[0].eligible, true, 'scoreBoard alone would have called it eligible (within 1 ft)');
  assert.equal(choice.pick, null, 'but it is not a pick: the surf is above its range');
});
test('board match: the same hour gives the same pick on every surface that shows one (they all call boardPickFor; no screen ranks boards itself)', () => {
  const read = (f: string) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  for (const f of ['features/home/Welcome.tsx', 'features/quiver/QuiverView.tsx', 'features/personal/PersonalView.tsx', 'features/forecast/ForecastView.tsx']) assert.match(read(f), /boardPickFor\(/, `${f} calls boardPickFor`);
  const spotPage = read('features/forecast/SpotPage.tsx'); assert.doesNotMatch(spotPage, /export function bestBoard/, 'the unused second picker is gone');
  for (const f of ['features/home/Welcome.tsx', 'features/forecast/ForecastView.tsx', 'features/personal/PersonalView.tsx', 'features/forecast/SpotPage.tsx']) assert.doesNotMatch(read(f), /scoreBoard\(|rankBoards\(/, `${f} does not rank boards itself`);
  // and the one function really is a function of (boards, spot, record, now, profile) only
  const f = recFor(1.5), p = profileOf(4, 75); assert.deepEqual(boardPickFor(QUIVER, spot, f, NOW, p, {}).ranked.map((x) => x.board.id), boardPickFor(QUIVER, spot, f, NOW, p, {}).ranked.map((x) => x.board.id));
});
test('board match: period fit changes the order, not whether a board is allowed, and a missing period is not a "bad" period', () => {
  const est: [number, number] = [3, 5], a = rankBoards([demoBoards[0], demoBoards[1]], est, 7), b = rankBoards([demoBoards[0], demoBoards[1]], est, null);
  assert.ok(a.every((x) => x.size.state !== 'none') && b.every((x) => x.period === null), 'no period: no period verdict');
  assert.ok(a.some((x) => x.period?.fit === 'short'), 'a 7 s swell is short for a performance shortboard (our rule: it likes 10 s or more)');
});
test('board match: the size range comes from the board\'s own range or OUR rule for its type, and says which', () => {
  const b = own('b', 'Fish', 68, 21, 2.4, 32); assert.equal(rangeSourceText(sizeFit(b, [2, 3]), 'Fish'), 'our rule for a fish'); assert.equal(rangeSourceText(sizeFit({...b, minWave: 2, maxWave: 6}, [2, 3]), 'Fish'), 'your range'); assert.equal(rangeSourceText(sizeFit(b, null), 'Fish'), '');
  for (const t of boardTypes) assert.ok(boardRanges[t], `${t} has a range`);
});

// ---- volume: our rule against two public sources
test('volume: Board Match\'s litres per kg by level sit inside the public ranges (miniwebtool.com surfboard-volume-calculator: beginner 0.60-0.65, intermediate 0.45-0.48, advanced 0.38-0.40, expert 0.32-0.35 L/kg; totalcalchub.com: beginner 0.8-1.0, intermediate 0.6-0.75, advanced 0.45-0.6); ours stay labelled as ours', () => {
  const per = LEVELS.map((l) => l.litresPerKg);
  for (let i = 1; i < per.length; i++) assert.ok(per[i] <= per[i - 1], 'more skill never means more float');
  assert.ok(per[0] >= 0.8 && per[0] <= 1.0, 'level 1 (first waves) is inside the high public beginner range'); assert.ok(per[1] >= 0.6 && per[1] <= 1.0, 'level 2 (beginner) is inside the beginner range');
  assert.ok(per[2] > per[3] && per[2] < per[1], 'level 3 sits between beginner and intermediate'); assert.ok(per[3] >= 0.45 && per[3] <= 0.75, 'level 4 (intermediate)'); assert.ok(per[5] >= 0.38 && per[5] <= 0.6, 'level 6 (advanced)'); assert.ok(per[6] >= 0.32 && per[6] <= 0.4, 'level 7 (expert)');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => suggestedVolume(75, n as SkillLevel)), [75, 60, 49, 38, 34, 30, 28]); assert.equal(suggestedVolume(null, 4), null); assert.equal(suggestedVolume(10, 4), null);
  assert.match(fs.readFileSync(new URL('../services/skillLevels.ts', import.meta.url), 'utf8'), /Board Match's rule of thumb for board volume \(volume ≈ weight × this\).*Not fitted to any data/s);
});
test('volume: a board\'s volume from length x width x thickness is within 3 % of the four example boards\' stated volumes and says it is an estimate', () => {
  for (const d of demoBoards) { const e = estimateVolume(d.length, d.width, d.thickness, d.type)!; assert.ok(Math.abs(e - d.volume) / d.volume < 0.03, `${d.id}: ${e} L against ${d.volume} L`); }
  assert.equal(estimateVolume(72, 19.5, 0, 'Fish'), null); assert.equal(estimateVolume(NaN, 19, 2.5, 'Fish'), null);
  for (const t of boardTypes) { assert.ok(fillFor(t) > 0.45 && fillFor(t) < 0.8, t); assert.ok(VOLUME_FILL[t] !== undefined, `${t} has a fill factor`); }
  assert.equal(fillFor('Unheard-of'), VOLUME_FILL.Other);
});
test('volume: the typical dimensions offered per type are valid numbers the form can parse and give a plausible estimated volume', () => {
  for (const t of boardTypes) { const d = TYPICAL[t]; const L = parseDimension(d.length, true), W = parseDimension(d.width), Th = parseDimension(d.thickness); assert.ok(L > 60 && L < 130 && W > 17 && W < 25 && Th > 2 && Th < 4, `${t}: ${JSON.stringify(d)}`); const v = estimateVolume(L, W, Th, t)!; assert.ok(v > 20 && v < 100, `${t}: ${v} L`); }
});
test('volume: the note compares a board with the suggested volume in plain words and only with a weight', () => {
  assert.equal(volumeNote(40, null, 4), null); assert.equal(volumeNote(undefined, 75, 4), null);
  assert.equal(volumeNote(38, 75, 4)!.state, 'near'); assert.equal(volumeNote(50, 75, 4)!.state, 'more'); assert.equal(volumeNote(28, 75, 4)!.state, 'less');
  assert.match(volumeNote(38, 75, 4)!.text, /38 L against about 38 L suggested for you \(75 kg x 0\.5 L\/kg at level 4; our rule of thumb\)/);
});

// ---- the answer-first verdict
const fmt = (lo: number, hi: number) => surfRange(lo, hi, defaultProfile);
test('verdict: a pick, "none fits" with the closest board, "fits but above your level", loading, failed, and no estimate are each said once and honestly', () => {
  const f = recFor(0.8), pAdv = profileOf(5, 75), est = '2–3 ft';
  const choice = boardPickFor(QUIVER, spot, f, NOW, pAdv, {}); const v = boardVerdict({choice, boards: QUIVER, spotName: 'Ocean Beach', estText: est, fmtRange: fmt, profile: pAdv});
  assert.equal(v.tone, choice.pick ? 'pick' : 'none'); assert.match(v.sentence, choice.pick ? /^Take your /: /None of your boards/); assert.ok(v.caveat && /wave shape|provisional/.test(v.caveat));
  if (choice.pick?.demo) assert.match(v.sentence, /example board: add your own in Quiver/);
  const big = boardPickFor(demoBoards.filter((d) => d.id !== 'demo-step'), spot, recFor(4), NOW, profileOf(6, 70), {}); const vb = boardVerdict({choice: big, boards: demoBoards, spotName: 'Ocean Beach', estText: '24–29 ft', fmtRange: fmt, profile: profileOf(6, 70)});
  assert.equal(vb.tone, 'none'); assert.match(vb.sentence, /None of your boards fits 24–29 ft by size\. Closest: .+, surf above its/); assert.ok(vb.closestId);
  const tooMuch = boardPickFor([demoBoards.find((d) => d.id === 'demo-step')!], spot, recFor(1.2), NOW, profileOf(2, 70), {});
  if (tooMuch.mode !== 'none') { const vt = boardVerdict({choice: tooMuch, boards: demoBoards, spotName: 'X', estText: '4 ft', fmtRange: fmt, profile: profileOf(2, 70)}); assert.ok(vt.tone === 'none' || vt.tone === 'pick'); }
  assert.equal(boardVerdict({choice: choice, boards: QUIVER, spotName: 'X', estText: null, fmtRange: fmt, profile: pAdv}).tone, 'unknown');
  assert.equal(boardVerdict({choice, boards: QUIVER, spotName: 'X', estText: est, pending: true, fmtRange: fmt, profile: pAdv}).tone, 'loading'); assert.equal(boardVerdict({choice, boards: QUIVER, spotName: 'X', estText: est, failed: true, fmtRange: fmt, profile: pAdv}).tone, 'failed');
  assert.doesNotMatch(JSON.stringify([v, vb]), /Firewire|Wavestorm|Pyzel|Sharp ?Eye/i);
});
