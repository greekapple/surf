import test from 'node:test';
import assert from 'node:assert/strict';
import {buildField, sampleAll, sampleField} from '../map/fieldData.ts';
import {colorLut, lutIndex, layerColor, scaleKeyOf} from '../map/ramps.ts';
import type {SpatialFrame} from '../map/spatial.ts';

// T-117: the point value behind a tap label comes from the SAME sampler as the painted colour, so the label equals the colour under the pin.
const cells = (f: (lat: number, lon: number) => {value: number | null; direction: number | null}) => { const out = []; for (let lat = 36; lat <= 39; lat += 0.5) for (let lon = -125.5; lon <= -121; lon += 0.5) { const c = f(lat, lon); out.push({lat, lon, value: c.value, direction: c.direction, speed: null}); } return out; };
const frame = (over: Partial<SpatialFrame> = {}, f = (lat: number, lon: number) => ({value: 1 + (-121.5 - lon) * 0.6 + (lat - 36) * 0.1, direction: 280})): SpatialFrame => ({cells: cells(f) as any, validAt: '2026-11-04T03:00:00Z', retrievedAt: '2026-11-04T02:00:00Z', provider: 'NOAA WaveWatch III', url: 'x', unit: 'm', resolution: 0.5, variable: 'Offshore Hs', ...over});

test('sampleField reads the same value the painter samples, with direction, layer, time and source', () => {
  const field = buildField(frame(), false)!;
  for (const [lat, lon] of [[37.2, -123.4], [36.6, -124.1], [38.4, -122.9]]) {
    const pv = sampleField([field], lat, lon)!; assert.ok(pv);
    assert.equal(pv.value, sampleAll([field], 'val', lat, lon), 'identical to the painter\'s sample');
    assert.equal(pv.unit, 'm'); assert.equal(pv.layer, 'WAVES'); assert.equal(pv.validAt, '2026-11-04T03:00:00Z'); assert.equal(pv.source, 'NOAA WaveWatch III');
    assert.ok(Math.abs(pv.dirFrom! - 280) < 0.5, `direction from ${pv.dirFrom}`);
  }
});
test('the label equals the colour under the pin: the painted pixel (lookup table) matches the colour of the label value', () => {
  const field = buildField(frame(), false)!, key = scaleKeyOf(field.layer)!, lut = colorLut(key);
  for (const [lat, lon] of [[37.2, -123.4], [36.6, -124.1], [38.4, -122.9], [37.7, -125]]) {
    const pv = sampleField([field], lat, lon)!, q = lutIndex(key, pv.value!), painted = [lut[q], lut[q + 1], lut[q + 2]], exact = layerColor(key, pv.value!);
    assert.ok(Math.hypot(painted[0] - exact[0], painted[1] - exact[1], painted[2] - exact[2]) < 6, `${lat},${lon}: painted ${painted} vs label colour ${exact}`);
  }
});
test('null on enclosed water ("Not covered"), outside the grid, and where the caller says land', () => {
  const field = buildField(frame(), false)!;
  assert.equal(sampleField([field], 37.82, -122.423), null, 'Central Bay is not covered');
  assert.equal(sampleField([field], 10, -123), null, 'outside the grid');
  assert.equal(sampleField([field], 37.2, -123.4, () => true), null, 'land');
  assert.equal(sampleField([], 37.2, -123.4), null);
});
test('layers: waves, swell height, period and wind are told apart by the real WW3/GFS scalar names; the regional grid wins over the global one', () => {
  assert.equal(buildField(frame({variable: 'Thgt'}), false)!.layer, 'WAVES', 'the offshore wave height frame (WW3 Thgt)');
  assert.equal(buildField(frame({variable: 'shgt'}), false)!.layer, 'SWELL', 'the swell height frame (WW3 shgt)');
  assert.equal(buildField(frame({variable: 'Offshore Hs'}), false)!.layer, 'WAVES');
  assert.equal(sampleField([buildField(frame({variable: 'Thgt'}), false)!], 37.2, -123.4)!.layer, 'WAVES', 'and in the point value');
  assert.equal(buildField(frame({unit: 's', variable: 'Tper'}), false)!.layer, 'PERIOD'); assert.equal(buildField(frame({unit: 's', variable: 'sper'}), false)!.layer, 'PERIOD');
  const per = buildField(frame({unit: 's', variable: 'Period'}, () => ({value: 11, direction: 290})), false)!; assert.equal(per.layer, 'PERIOD'); assert.equal(sampleField([per], 37.2, -123.4)!.value, 11);
  const wind = buildField(frame({unit: 'm/s', variable: 'Speed'}, () => ({value: 8, direction: 0})), true)!; assert.equal(wind.layer, 'WIND'); assert.equal(sampleField([wind], 37.2, -123.4)!.unit, 'm/s');
  const regional = buildField(frame(undefined, () => ({value: 2, direction: 270})), false)!, global = buildField(frame({resolution: 2}, () => ({value: 5, direction: 270})), false)!;
  assert.equal(sampleField([regional, global], 37.2, -123.4)!.value, 2);
});
