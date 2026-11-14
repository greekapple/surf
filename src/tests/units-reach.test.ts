import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fromUnit, heightRange, toUnit, windWhole} from '../utils/units.ts';

// Audit B12 (R7): the height and wind unit settings reach Quiver, the preference form, Home's board pick and the chart legend.
const ft = {heightUnit: 'ft'} as const, m = {heightUnit: 'm'} as const;

test('ranges follow the height unit; metres keep one decimal so 2–6 ft is not 1–2 m', () => {
  assert.equal(heightRange(1, 5, ft), '1–5 ft');
  assert.equal(heightRange(0.5, 4, ft), '0.5–4 ft');
  assert.equal(heightRange(10.4, 12.6, ft, true), '10–13 ft');
  assert.equal(heightRange(2, 6, m), '0.6–1.8 m');
  assert.equal(heightRange(1, 5, m), '0.3–1.5 m');
});

test('the preference range is stored in feet and edited in the user unit', () => {
  assert.equal(toUnit(6, 'm'), 1.8);
  assert.equal(toUnit(6, 'ft'), 6);
  assert.equal(fromUnit(1.8, 'm'), 5.9);
  assert.equal(fromUnit(5, 'ft'), 5);
});

test('wind legend top end follows the wind unit', () => {
  assert.equal(windWhole(24, {windUnit: 'mph'}), '24 mph');
  assert.equal(windWhole(24, {windUnit: 'kn'}), '21 kn');
  assert.equal(windWhole(24, {windUnit: 'km/h'}), '39 km/h');
});

test('no hard-coded ft/mph left in the board ranges, Home pick or chart legend', () => {
  const files = ['src/features/quiver/QuiverView.tsx', 'src/features/quiver/Rack.tsx', 'src/features/quiver/BoardRoom.tsx', 'src/features/home/Welcome.tsx'];
  for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), /board\[1\]\} ft|board\[1\]\}–?\s?ft|Math\.round\(est\[1\]\)\} ft/, f);
  assert.doesNotMatch(readFileSync('src/features/forecast/ForecastCharts.tsx', 'utf8'), /24\+ mph/);
  const pv = readFileSync('src/features/personal/PersonalView.tsx', 'utf8');
  assert.match(pv, /<UnitNumber ft=\{p\.minWave\} unit=\{p\.heightUnit\}/);
  assert.match(readFileSync('src/features/personal/ProfileFields.tsx', 'utf8'), /if \(!text\.trim\(\) \|\| !Number\.isFinite\(v\)\) return;/, 'empty or NaN drafts are dropped, not saved as 0 (UnitNumber, shared with the profile setup)');
  // forecast-visuals: the wind arrows are coloured by shore relation now (the speed is the line), so the chart key names no speed at all
  assert.doesNotMatch(readFileSync('src/features/forecast/ForecastCharts.tsx', 'utf8'), /Arrows 0 to/);
  assert.equal(windWhole(24, {windUnit: 'kn'}).replace(' ', '+ '), '21+ kn');
});
