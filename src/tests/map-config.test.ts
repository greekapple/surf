import test from 'node:test';
import assert from 'node:assert/strict';
import {mapConfig, minZoomFor} from '../map/mapConfig.ts';

test('minZoom makes the world at least as wide as the viewport, on the half-zoom grid, never below the base', () => {
  assert.equal(minZoomFor(390), 2); assert.equal(minZoomFor(1024), 2); assert.equal(minZoomFor(1440), 2.5); assert.equal(minZoomFor(2560), 3.5);
  for (const w of [320, 390, 768, 1024, 1280, 1440, 1920, 2560, 3840]) { const z = minZoomFor(w); assert.ok(256 * 2 ** z >= w, `${w}: world ${256 * 2 ** z}px`); assert.ok(z * 2 === Math.round(z * 2)); assert.ok(z >= mapConfig.view.baseMinZoom); }
});
test('config sanity: caches hold a prefetch set, the pole clamp is hard, crossfade is a quarter second', () => {
  assert.equal(mapConfig.view.maxBoundsViscosity, 1); assert.ok(mapConfig.cache.regionalFrames >= 16 && mapConfig.cache.globeFrames >= 16); assert.equal(mapConfig.crossfadeMs, 250);
});
