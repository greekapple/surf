import test from 'node:test';
import assert from 'node:assert/strict';
import {lightingAt, lightingFor, sceneDir, spotGeo, sunPosition} from '../features/scale/solar.ts';
import {solarTimes} from '../ocean/sun.ts';

const OB = spotGeo('spot-2');
test('sun position agrees with the sunrise/sunset model (both a few minutes accurate) and local noon', () => {
  const {rise, set} = solarTimes('2026-11-02', OB.lat, OB.lon);
  for (const t of [rise, set]) assert.ok(Math.abs(sunPosition(t, OB.lat, OB.lon).elevation + 0.833) < 0.6, `elevation at rise/set ${sunPosition(t, OB.lat, OB.lon).elevation}`);
  const noon = sunPosition((rise + set) / 2, OB.lat, OB.lon);
  assert.ok(Math.abs(noon.elevation - (90 - OB.lat - 14.9)) < 1.2, `noon elevation ${noon.elevation}`);
  assert.ok(Math.abs(noon.azimuth - 180) < 2, `noon azimuth ${noon.azimuth}`);
  assert.ok(sunPosition(set, OB.lat, OB.lon).azimuth > 235 && sunPosition(set, OB.lat, OB.lon).azimuth < 260);
});
test('scene directions: seaward is +z, the beach -z', () => {
  const [x, z] = sceneDir(OB.seaward, OB.seaward); assert.ok(Math.abs(x) < 1e-9 && Math.abs(z - 1) < 1e-9);
  const [, zb] = sceneDir(OB.seaward + 180, OB.seaward); assert.ok(Math.abs(zb + 1) < 1e-9);
});
test('lighting: day has a sun and glint, twilight and night have none and are dimmer and cooler', () => {
  const day = lightingFor(35, 200, OB.seaward), tw = lightingFor(-3, 250, OB.seaward), night = lightingFor(-20, 280, OB.seaward);
  assert.equal(day.phase, 'day'); assert.equal(tw.phase, 'twilight'); assert.equal(night.phase, 'night');
  assert.ok(Math.max(...day.sunColor) > 0.8 && Math.max(...tw.sunColor) === 0 && Math.max(...night.sunColor) === 0);
  assert.ok(day.ambient > tw.ambient && tw.ambient > night.ambient && night.ambient > 0);
  assert.ok(tw.top[2] > tw.top[0], 'twilight sky is cool'); assert.ok(day.dirIntensity > 2 && tw.dirIntensity === 0);
  // 6 PM in November at Ocean Beach is after sunset
  const six = lightingAt('spot-2', '2026-11-03T02:00:00Z'); assert.ok(six && six.elevation < 0 && six.phase !== 'day');
  assert.equal(lightingAt('spot-2', 'nope'), null);
});
