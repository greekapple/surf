import test from 'node:test';
import assert from 'node:assert/strict';
import {isEnclosedWater, enclosedCellCount, ENCLOSED_NOTE} from '../map/enclosed.ts';

test('T-092: SF Bay and other enclosed waters are not covered; the open sea, coastal fringe and open bays are', () => {
  const enclosed: [string, number, number][] = [['Alcatraz / Central Bay', 37.826, -122.423], ['South Bay', 37.55, -122.15], ['San Pablo Bay', 38.05, -122.38], ['Richardson Bay', 37.87, -122.47], ['Humboldt Bay', 40.75, -124.2], ['Alameda estuary (an OpenStreetMap creek the 1:10m coastline lacks)', 37.7785, -122.275], ['Corte Madera creek mouth', 37.945, -122.5]];
  const open: [string, number, number][] = [['2 km west of Point Bonita (open ocean outside the Golden Gate)', 37.8157, -122.5515], ['Bonita Cove side of the Gate line, just west of Point Bonita', 37.82, -122.535], ['Golden Gate, ocean side', 37.80, -122.55], ['Ocean Beach 3 km off', 37.76, -122.55], ['Half Moon Bay offshore', 37.50, -122.55], ['Monterey Bay centre', 36.80, -121.95], ['Monterey Bay head', 36.85, -121.80], ['Drakes Bay', 38.0, -122.95], ['Santa Monica Bay', 33.9, -118.55], ['50 km offshore', 37.8, -123.3], ['San Diego offshore', 32.6, -117.4]];
  for (const [n, la, lo] of enclosed) assert.equal(isEnclosedWater(la, lo), true, `${n} should be enclosed`);
  for (const [n, la, lo] of open) assert.equal(isEnclosedWater(la, lo), false, `${n} should be open`);
  assert.ok(enclosedCellCount() > 800 && enclosedCellCount() < 8000, `${enclosedCellCount()} cells`);
  assert.equal(isEnclosedWater(0, 0), false); assert.equal(isEnclosedWater(NaN, NaN), false); assert.match(ENCLOSED_NOTE, /not resolve/);
});

test('T-100: a wrapped world copy of a longitude gives the same answer', async () => {
  const {isEnclosedWater} = await import('../map/enclosed.ts');
  for (const [lat, lon] of [[37.82, -122.423], [38.2, -122.95]]) { const a = isEnclosedWater(lat, lon); assert.equal(isEnclosedWater(lat, lon + 360), a); assert.equal(isEnclosedWater(lat, lon - 360), a); }
  assert.equal(isEnclosedWater(37.82, -122.423 + 360), true, 'Central Bay on the next world copy');
});

test('map-smooth: open beaches next to lagoons are open sea; Tomales Bay, Elkhorn Slough, Drakes Estero, Bolinas Lagoon and SF Bay stay enclosed', async () => {
  const {enclosedness} = await import('../map/enclosed.ts');
  // the 1:10m coast runs a kilometre or two off the true shore here; OSM ocean water corrects it, so the colour reaches these beaches (they were a stair of grey squares)
  const open: [string, number, number][] = [['Point Reyes Beach, nearshore', 38.10, -122.985], ['Point Reyes Beach, north', 38.15, -122.975], ['Drakes Bay off Drakes Beach', 38.02, -122.96], ['ocean side of the Point Reyes headland', 37.995, -123.035]];
  const enclosed: [string, number, number][] = [['Tomales Bay', 38.15, -122.89], ['Elkhorn Slough', 36.835, -121.745], ['Elkhorn Slough, upper', 36.845, -121.755], ['Drakes Estero', 38.06, -122.94], ['Bolinas Lagoon', 37.915, -122.685], ['SF Bay, Central Bay', 37.826, -122.423], ['SF Bay, South Bay', 37.55, -122.15]];
  for (const [n, la, lo] of open) assert.equal(isEnclosedWater(la, lo), false, `${n} should be open`);
  for (const [n, la, lo] of enclosed) assert.equal(isEnclosedWater(la, lo), true, `${n} should be enclosed`);
  // the edge is a smooth contour: enclosedness changes continuously (bilinear between cell centres), never by a whole cell at once
  let last = enclosedness(38.0, -122.96), maxStep = 0; for (let lat = 38.0; lat <= 38.08; lat += 0.0005) { const e = enclosedness(lat, -122.95); maxStep = Math.max(maxStep, Math.abs(e - last)); last = e; }
  assert.ok(maxStep < 0.06, `largest change per 55 m: ${maxStep.toFixed(3)}`);
});
