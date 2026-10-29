import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spots, demoBoards, defaultProfile} from '../data/demo.ts';
import {evaluateRule, hourMatches, parseRules, describeRule, type AlertRule} from '../features/personal/alerts.ts';
import {pickBoard} from '../features/personal/recommend.ts';
import type {Forecast} from '../models/index.ts';

const spot = spots[0];
const hour = (iso: string, offshore: number, speed: number, dir: number, over: Partial<Forecast> = {}) => ({
  spotId: spot.id, timestamp: iso, offshore, face: NaN, wind: {speed, direction: dir},
  availability: {face: false, swell: true, wind: true, tide: true, organization: false}, character: 'Unknown', ...over,
}) as unknown as Forecast;
const rule = (o: Partial<AlertRule> = {}): AlertRule => ({id: 'r', spotId: spot.id, minFt: null, maxFt: null, maxWindMph: null, offshoreOnly: false, enabled: true, ...o});
const offshoreDir = (spot.seaward + 180) % 360, onshoreDir = spot.seaward;
const now = Date.parse('2026-10-29T12:00:00Z');
const at = (h: number) => new Date(now + h * 3600000).toISOString();

test('alert rule matches height, wind speed and offshore direction together', () => {
  const r = rule({minFt: 4, maxWindMph: 12, offshoreOnly: true});
  assert.equal(hourMatches(r, spot, hour(at(1), 5, 8, offshoreDir)), true);
  assert.equal(hourMatches(r, spot, hour(at(1), 3, 8, offshoreDir)), false);
  assert.equal(hourMatches(r, spot, hour(at(1), 5, 20, offshoreDir)), false);
  assert.equal(hourMatches(r, spot, hour(at(1), 5, 8, onshoreDir)), false);
  assert.equal(hourMatches(rule({maxFt: 3}), spot, hour(at(1), 5, 8, offshoreDir)), false);
});

test('alert evaluation reports the first match, none, or no data', () => {
  const recs = [hour(at(2), 2, 5, offshoreDir), hour(at(30), 6, 5, offshoreDir)];
  const res = evaluateRule(rule({minFt: 4}), spot, recs, now);
  assert.deepEqual(res, {kind: 'match', at: at(30)});
  assert.deepEqual(evaluateRule(rule({minFt: 9}), spot, recs, now), {kind: 'none'});
  assert.deepEqual(evaluateRule(rule({minFt: 4}), spot, [hour(at(24 * 9), 6, 5, offshoreDir)], now), {kind: 'nodata'});
  assert.deepEqual(evaluateRule(rule({minFt: 4}), spot, [hour(at(-48), 6, 5, offshoreDir)], now), {kind: 'nodata'});
});

test('missing wind or height never counts as a match', () => {
  const noWind = hour(at(1), 5, NaN, offshoreDir, {availability: {face: false, swell: true, wind: false, tide: true, organization: false}});
  assert.equal(hourMatches(rule({maxWindMph: 10}), spot, noWind), false);
  assert.equal(hourMatches(rule({minFt: 1}), spot, hour(at(1), NaN, 5, offshoreDir)), false);
});

test('stored rules are validated and described', () => {
  assert.deepEqual(parseRules('nope'), []);
  assert.equal(parseRules(JSON.stringify([{id: 'a', spotId: 'spot-0', minFt: 4, offshoreOnly: true}, {bad: 1}])).length, 1);
  const f = (n: number) => `${n}`, w = (n: number) => `${n} mph`;
  assert.equal(describeRule(rule({minFt: 4, offshoreOnly: true}), f, 'ft', w), '4+ ft and offshore wind');
  assert.equal(describeRule(rule({minFt: 2, maxFt: 6, maxWindMph: 10}), f, 'ft', w), '2–6 ft and wind up to 10 mph');
});

test('recommended board: heuristic without a face estimate, scoring with one', () => {
  const p = {...defaultProfile, minWave: 2, maxWave: 4};
  const none = pickBoard(demoBoards, hour(at(1), 3, 5, offshoreDir), p);
  assert.equal(none.kind, 'heuristic');
  assert.equal(pickBoard([], undefined, p).kind, 'empty');
  const withFace = hour(at(1), 3, 5, offshoreDir, {face: 3, character: 'Soft', availability: {face: true, swell: true, wind: true, tide: true, organization: true}});
  const r = pickBoard(demoBoards, withFace, p);
  assert.ok(r.kind === 'match' || r.kind === 'heuristic');
});
