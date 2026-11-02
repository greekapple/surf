import test from 'node:test';
import assert from 'node:assert/strict';
import {basemapFor, readBasemapPref, saveBasemapPref, BASEMAP_KEY} from '../map/basemapPref.ts';

test('basemap follows the theme unless satellite is chosen', () => {
  assert.equal(basemapFor('auto', 'light'), 'light'); assert.equal(basemapFor('auto', 'dark'), 'dark');
  assert.equal(basemapFor('satellite', 'light'), 'satellite'); assert.equal(basemapFor('satellite', 'dark'), 'satellite');
});
test('preference is storage-safe: default auto, only "satellite" is honoured, blocked storage means auto', () => {
  assert.equal(readBasemapPref(), 'auto'); // no localStorage in node
  const mem = new Map<string, string>();
  (globalThis as any).localStorage = {getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }};
  saveBasemapPref('satellite'); assert.equal(mem.get(BASEMAP_KEY), 'satellite'); assert.equal(readBasemapPref(), 'satellite');
  mem.set(BASEMAP_KEY, 'weird'); assert.equal(readBasemapPref(), 'auto');
  (globalThis as any).localStorage = {getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }};
  assert.equal(readBasemapPref(), 'auto'); saveBasemapPref('satellite');
  delete (globalThis as any).localStorage;
});
