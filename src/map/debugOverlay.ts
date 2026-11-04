// Debug overlay (map-seamless, brief commit 1): dev only, behind ?debug=1. Plain DOM, no React, nothing when off. Shows what the map is doing:
// fps and frame time, long tasks (> 50 ms), frame-cache hits/misses, the prefetch queue, and which model, run and valid time the painted frame is.
import {globeCacheStats, spatialCacheStats, prefetchState} from './spatial.ts';

export interface DebugInfo {model: string; source: string; run: string; validAt: string; retrievedAt: string; layer: string; held: boolean}
export const debugEnabled = (): boolean => { try { return !!(import.meta as unknown as {env?: {DEV?: boolean}}).env?.DEV && new URLSearchParams(location.search).get('debug') === '1'; } catch { return false; } };

/** Mounts the overlay; `info()` is called twice a second. Returns a disposer. */
export function attachDebugOverlay(info: () => DebugInfo | null): () => void {
  const el = document.createElement('div'); el.setAttribute('data-map-debug', ''); el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:8px;bottom:96px;z-index:9999;background:rgb(0 0 0/.78);color:#fff;font:11px/1.45 ui-monospace,Menlo,monospace;padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre;max-width:92vw';
  document.body.appendChild(el);
  const dts: number[] = []; let last = performance.now(), raf = 0, longTasks = 0, longMs = 0;
  const tick = (t: number) => { dts.push(t - last); last = t; if (dts.length > 90) dts.shift(); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick);
  let po: PerformanceObserver | null = null; try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) { longTasks++; longMs += e.duration; } }); po.observe({entryTypes: ['longtask']}); } catch { /* unsupported */ }
  const paint = () => {
    const avg = dts.length ? dts.reduce((a, b) => a + b, 0) / dts.length : 0, worst = dts.length ? Math.max(...dts) : 0, r = spatialCacheStats(), g = globeCacheStats(), i = info(), p = prefetchState;
    el.textContent = [
      `fps ${avg ? (1000 / avg).toFixed(0) : '-'}   frame ${avg.toFixed(1)} ms (worst ${worst.toFixed(0)})   long tasks ${longTasks} (${longMs.toFixed(0)} ms)`,
      `regional cache ${r.frames} frames, ${r.hits} hit / ${r.misses} miss   global cache ${g.frames} frames, ${g.hits} hit / ${g.misses} miss`,
      `prefetch ${p.running ? 'running' : 'idle'}, queue ${Math.max(0, p.queued)}, done ${p.done}, failed ${p.failed}`,
      i ? `model ${i.model}   layer ${i.layer}${i.held ? '   (HOLDING the previous frame)' : ''}\nsource ${i.source}\nrun ${i.run}   valid ${i.validAt}   fetched ${i.retrievedAt}` : 'no frame painted yet',
    ].join('\n');
  };
  const id = setInterval(paint, 500); paint();
  return () => { clearInterval(id); cancelAnimationFrame(raf); po?.disconnect(); el.remove(); };
}
