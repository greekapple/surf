import type {EngineKind} from './flag.ts';
import type {EngineOptions, MapEngine} from './types.ts';
export type * from './types.ts';
import {engineKind} from './flag.ts';
export {engineKind};
/** Cold-load warm-up (MapLibre only): as soon as the Explore code is loaded, open the connection to the tile/style/glyph host and start the engine chunk and the style fetch in parallel, so they overlap instead of queueing (style fetch used to start only after the engine had loaded). */
let warmed = false;
function warm() {
  if (warmed || typeof document === 'undefined') return; warmed = true;
  try { for (const rel of ['preconnect', 'dns-prefetch']) { const l = document.createElement('link'); l.rel = rel; l.href = 'https://tiles.openfreemap.org'; if (rel === 'preconnect') l.crossOrigin = ''; document.head.appendChild(l); } } catch { /* no head */ }
  void import('./style.ts').then((m) => m.loadBaseStyle()).catch(() => { /* retried by the engine */ }); void import('./maplibreEngine.ts').catch(() => { /* surfaced by createEngine */ });
}
if (engineKind() === 'maplibre') warm();
/** Creates the engine. The MapLibre engine is a dynamic import, so its ~280 KB (gzip) is only fetched when that engine runs (and only on Explore). */
export async function createEngine(kind: EngineKind, el: HTMLElement, o: EngineOptions): Promise<MapEngine> {
  if (kind === 'maplibre') return (await import('./maplibreEngine.ts')).createMaplibreEngine(el, o);
  return (await import('./leafletEngine.ts')).createLeafletEngine(el, o);
}
