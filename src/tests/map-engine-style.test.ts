import test from 'node:test';
import assert from 'node:assert/strict';
import {brandedStyle, palette, paintFor, FIELD_SLOT_ID, type StyleSpec} from '../map/engine/style.ts';
import {engineKind} from '../map/engine/flag.ts';

// map-maplibre: the branded style's contract with the field shader (land vs sea colours must be far enough apart to read the sea mask), the layer order, the engine flag.
const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const base: StyleSpec = {version: 8, sources: {openmaptiles: {type: 'vector', url: 'x'}, ne2_shaded: {type: 'raster'}}, layers: [
  {id: 'background', type: 'background', paint: {}}, {id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park'}, {id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', filter: ['==', 1, 1]},
  {id: 'landcover_wood', type: 'fill', source: 'openmaptiles'}, {id: 'highway_minor', type: 'line', source: 'openmaptiles'}, {id: 'label_city', type: 'symbol', source: 'openmaptiles'}, {id: 'water_name_point_label', type: 'symbol', source: 'openmaptiles'}]};
test('land and sea colours are far enough apart in every theme/heat state for the shader to read the sea mask (>= 20/255 apart)', () => {
  for (const theme of ['light', 'dark'] as const) for (const heat of [false, true]) { const p = palette(theme, heat), a = hexRgb(p.land), b = hexRgb(p.sea); assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= 20, `${theme} heat=${heat}`); }
});
test('with the field on, lakes and rivers never read as sea to the shader (its sea weight for the lake colour is ~0)', () => {
  for (const theme of ['light', 'dark'] as const) { const p = palette(theme, true), L = hexRgb(p.land), S = hexRgb(p.sea), K = hexRgb(p.lake), sl = S.map((x, i) => x - L[i]), kl = K.map((x, i) => x - L[i]), w = (kl[0] * sl[0] + kl[1] * sl[1] + kl[2] * sl[2]) / (sl[0] ** 2 + sl[1] ** 2 + sl[2] ** 2); assert.ok(w < 0.02, `${theme}: lake sea-weight ${w.toFixed(2)}`); }
});
test('layer order: background, ocean water, the field slot, inland water, then land detail and labels; one slot id in light and dark', () => {
  for (const theme of ['light', 'dark'] as const) {
    const s = brandedStyle(base, theme, true), ids = s.layers.map((l) => l.id);
    assert.deepEqual(ids.slice(0, 4), ['background', 'park', 'water', FIELD_SLOT_ID]); assert.equal(ids[4], 'water_inland'); assert.ok(ids.indexOf('landcover_wood') > ids.indexOf('water_inland') && ids.indexOf('label_city') > ids.indexOf(FIELD_SLOT_ID));
    assert.equal(FIELD_SLOT_ID, 'swello-field-slot'); assert.ok(!('ne2_shaded' in s.sources), 'the natural-earth raster is dropped'); assert.ok(FIELD_SLOT_ID in s.sources);
  }
});
test('the ocean is the only water the field slot sits over; lakes and rivers draw after it', () => {
  const s = brandedStyle(base, 'light', true), w = s.layers.find((l) => l.id === 'water')!, wi = s.layers.find((l) => l.id === 'water_inland')!;
  assert.match(JSON.stringify(w.filter), /"=="[^]*"ocean"/); assert.match(JSON.stringify(wi.filter), /"!="[^]*"ocean"/);
  assert.equal((w.paint as Record<string, unknown>)['fill-color'], palette('light', true).sea); assert.equal((s.layers[0].paint as Record<string, unknown>)['background-color'], palette('light', true).land);
});
test('paintFor recolours by category and leaves unknown layers alone; heat swaps pale land for the mid grey', () => {
  const p = palette('light', true), q = palette('light', false);
  assert.deepEqual(paintFor({id: 'label_city', type: 'symbol'}, p), {'text-color': p.label, 'text-halo-color': p.labelHalo}); assert.equal(paintFor({id: 'something', type: 'circle'}, p), null);
  assert.notEqual(p.land, q.land); assert.ok(hexRgb(p.land)[0] < hexRgb(q.land)[0] - 60, 'heat on: darker land so the ramp reads true');
});
test('engine flag defaults to leaflet; ?engine=maplibre switches it', () => {
  const g = globalThis as unknown as {location?: {search: string}};
  g.location = {search: ''}; assert.equal(engineKind(), 'leaflet'); g.location = {search: '?engine=maplibre'}; assert.equal(engineKind(), 'maplibre'); g.location = {search: '?engine=leaflet'}; assert.equal(engineKind(), 'leaflet'); g.location = {search: '?engine=nope'}; assert.equal(engineKind(), 'leaflet'); delete g.location;
});

test('map-maplibre: sea and river names are upright (regular font), smaller and quieter, never italic', () => {
  const base = {version: 8, sources: {}, layers: [{id: 'water', type: 'fill', source: 'openmaptiles'}, {id: 'water_name_point_label', type: 'symbol', source: 'openmaptiles', layout: {'text-font': ['Noto Sans Italic'], 'text-size': 14}}, {id: 'label_city', type: 'symbol', source: 'openmaptiles', layout: {'text-font': ['Noto Sans Regular']}}]};
  for (const theme of ['light', 'dark'] as const) for (const heat of [false, true]) {
    const s = brandedStyle(base, theme, heat), w = s.layers.find((l) => l.id === 'water_name_point_label')!;
    assert.deepEqual((w.layout as Record<string, unknown>)['text-font'], ['Noto Sans Regular']);
    assert.equal((w.paint as Record<string, unknown>)['text-opacity'], 0.8);
    assert.deepEqual((s.layers.find((l) => l.id === 'label_city')!.layout as Record<string, unknown>)['text-font'], ['Noto Sans Regular']);
  }
});
