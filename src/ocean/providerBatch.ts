/** Batches the browser's `/api/provider?key=K` requests into `/api/providers?keys=a,b,c` (services/forecast-service.mjs). The app asks for 3 provider values per spot (marine, weather, model spread)
 *  plus a few shared ones, so 59 spots meant ~215 requests on every screen; now it is a handful. Same values, sources and freshness marks: each key's entry is exactly the body `/api/provider` returns,
 *  made into a Response so request.ts handles it unchanged. A batch that fails (an older Worker without the endpoint, a network error) falls back to the single-key request per key, as before. */
/** BATCH_MAX = 12 (equal to the server's): a cold key costs up to 3 subrequests (R2 get + upstream fetch + R2 put), 12 x 3 = 36 < the 50 a Free-plan invocation allows. */
export const BATCH_MAX = 12, BATCH_WINDOW_MS = 6;
const SINGLE = /^\/api\/provider\?key=([A-Za-z0-9_.-]+)$/;
export const isBatchable = (route: string) => SINGLE.test(route);
export function createProviderBatcher(fetcher: typeof fetch, windowMs = BATCH_WINDOW_MS) {
  type Waiter = {resolve: (r: Response) => void; reject: (e: unknown) => void; route: string};
  let queue = new Map<string, Waiter[]>(), timer: ReturnType<typeof setTimeout> | null = null;
  const single = (route: string) => fetcher(route);
  async function flush() {
    timer = null; const batch = queue; queue = new Map();
    const keys = [...batch.keys()];
    for (let i = 0; i < keys.length; i += BATCH_MAX) {
      const chunk = keys.slice(i, i + BATCH_MAX);
      void (async () => {
        let results: Record<string, {status: number; body?: unknown; error?: string}> | null = null;
        try { const r = await fetcher('/api/providers?keys=' + chunk.join(',')); if (r.ok) results = (await r.json())?.results ?? null; } catch { results = null; }
        for (const key of chunk) {
          const waiters = batch.get(key)!, entry = results?.[key];
          if (entry && entry.status === 200 && entry.body !== undefined) for (const w of waiters) w.resolve(new Response(JSON.stringify(entry.body), {status: 200}));
          else for (const w of waiters) single(w.route).then(w.resolve, w.reject);   // not answered, or answered with an error: ask the single endpoint exactly as before (same error handling)
        }
      })();
    }
  }
  return (route: string): Promise<Response> => {
    const key = SINGLE.exec(route)?.[1]; if (!key) return single(route);
    return new Promise<Response>((resolve, reject) => { const l = queue.get(key) ?? []; l.push({resolve, reject, route}); queue.set(key, l); if (!timer) timer = setTimeout(flush, windowMs); });
  };
}
