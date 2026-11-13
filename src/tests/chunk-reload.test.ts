import test from 'node:test';
import assert from 'node:assert/strict';
import {isChunkLoadError, reloadOnce, installChunkReload} from '../utils/chunkReload.ts';
const store = () => { const m = new Map<string, string>(); return {getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }}; };
test('chunk-load failures are recognised, other errors are not', () => {
  for (const m of ['Failed to fetch dynamically imported module: https://x/assets/Explore-abc.js', 'error loading dynamically imported module', 'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html"', 'Importing a module script failed.', 'Loading chunk 12 failed.']) assert.ok(isChunkLoadError(new TypeError(m)), m);
  assert.ok(!isChunkLoadError(new Error('x is not defined')) && !isChunkLoadError(null));
});
test('reloadOnce reloads the first time, not again within a minute, and again after it; unusable storage never reloads', () => {
  let n = 0, t = 1_000_000; const s = store(), env = () => ({storage: s, reload: () => { n++; }, now: () => t});
  assert.equal(reloadOnce(env()), true); assert.equal(n, 1);
  t += 5_000; assert.equal(reloadOnce(env()), false); assert.equal(n, 1, 'no loop');
  t += 61_000; assert.equal(reloadOnce(env()), true); assert.equal(n, 2);
  assert.equal(reloadOnce({storage: null, reload: () => { n++; }}), false);
  assert.equal(reloadOnce({storage: {getItem: () => { throw new Error('blocked'); }, setItem: () => {}}, reload: () => { n++; }}), false); assert.equal(n, 2);
});
test('a simulated missing chunk (vite:preloadError and a rejected dynamic import) reloads once', () => {
  const h: Record<string, (e: any) => void> = {}; let reloads = 0; const s = store();
  installChunkReload({addEventListener: (t, f) => { h[t] = f; }, location: {reload: () => { reloads++; }}, sessionStorage: s as unknown as Storage}, () => 5_000_000);
  let prevented = false; h['vite:preloadError']!({preventDefault: () => { prevented = true; }}); assert.equal(reloads, 1); assert.ok(prevented);
  h['unhandledrejection']!({reason: new TypeError('Failed to fetch dynamically imported module: /assets/a.js')}); assert.equal(reloads, 1, 'second failure inside the minute does not reload again');
  const s2 = store(); const h2: Record<string, (e: any) => void> = {}; let r2 = 0;
  installChunkReload({addEventListener: (t, f) => { h2[t] = f; }, location: {reload: () => { r2++; }}, sessionStorage: s2 as unknown as Storage}, () => 5_000_000);
  h2['unhandledrejection']!({reason: new Error('Network error in fetch')}); assert.equal(r2, 0, 'an unrelated rejection never reloads');
  h2['unhandledrejection']!({reason: new TypeError('error loading dynamically imported module')}); assert.equal(r2, 1);
});
