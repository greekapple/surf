// Basemap tile warm-up (T-128b). MapLibre's parent/child fallback only helps for tiles it already holds, so a multi-level zoom-out shows missing tiles while the coarser level is fetched. Windy avoids this by having the coarse levels ready: we fetch (into the browser's HTTP cache, where MapLibre's own request is then near-instant) (1) the world at zoom 1-3 once at start and (2) the tiles one and two levels above the view after each move. Plain GETs of the same public tile URLs MapLibre uses; nothing is stored by us.
const done = new Set<string>(), queue: string[] = []; let inflight = 0;
const MAX_PAR = 2; // low parallelism: these requests must never queue ahead of the view's own tiles on a cold start
const pump = () => { while (inflight < MAX_PAR && queue.length) { const u = queue.shift()!; inflight++; fetch(u, {priority: 'low'} as RequestInit).then((r) => r.arrayBuffer()).catch(() => { done.delete(u); }).finally(() => { inflight--; pump(); }); } };
const enqueue = (tpl: string, z: number, x: number, y: number) => { const u = tpl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)); if (done.has(u)) return; done.add(u); queue.push(u); };
const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat: number, z: number) => { const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z); };

/** The world at zoom 1..3 (85 small tiles), once, 3.5 s after the view's first idle and then at browser idle time (T-128: a cold-start run had them compete with the view tiles). */
export function warmWorld(tpl: string) { const go = () => { for (let z = 1; z <= 3; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) enqueue(tpl, z, x, y); pump(); }; const later = () => { if ('requestIdleCallback' in window) (window as unknown as {requestIdleCallback: (f: () => void, o?: object) => void}).requestIdleCallback(go, {timeout: 6000}); else go(); }; setTimeout(later, 3500); }
/** The tiles covering the view one and two levels above its current tile zoom (the ones a zoom-out needs next). */
export function warmParents(tpl: string, b: {west: number; east: number; south: number; north: number}, tileZoom: number) {
  for (const dz of [1, 2]) { const z = Math.floor(tileZoom) - dz; if (z < 0) break; const x0 = tileX(b.west, z), x1 = tileX(Math.min(b.east, 179.999), z), y0 = tileY(b.north, z), y1 = tileY(b.south, z); if ((x1 - x0 + 1) * (y1 - y0 + 1) > 24) continue; for (let x = Math.max(0, x0); x <= x1; x++) for (let y = Math.max(0, y0); y <= y1; y++) enqueue(tpl, z, x, y); }
  pump();
}
