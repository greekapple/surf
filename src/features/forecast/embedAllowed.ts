import {useEffect, useState} from 'react';

/** hdontap-auto: may our site frame this HDOnTap player yet? Asked of our Worker (/api/embed-allowed), which reads HDOnTap's own frame-ancestors / X-Frame-Options. Only a confirmed `allowed: true` counts; while asking, on any error
 *  and on anything else the answer is "not allowed", so the camera's link is shown and nothing broken appears. Answers are kept 2 minutes in memory (allowed) or 30 seconds (not), and shared by every component. */
const held = new Map<string, {allowed: boolean; until: number}>(), jobs = new Map<string, Promise<boolean>>();
export const EMBED_ALLOWED_KEEP_MS = 120000, EMBED_MISS_KEEP_MS = 30000;
export function embedAllowed(id: string): Promise<boolean> {
  const h = held.get(id); if (h && Date.now() < h.until) return Promise.resolve(h.allowed);
  if (!jobs.has(id)) jobs.set(id, fetch(`/api/embed-allowed?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((j) => j?.allowed === true, () => false)
    .then((ok) => { held.set(id, {allowed: ok, until: Date.now() + (ok ? EMBED_ALLOWED_KEEP_MS : EMBED_MISS_KEEP_MS)}); return ok; }).finally(() => jobs.delete(id)));
  return jobs.get(id)!;
}
/** `true` only for the ids the Worker has confirmed; re-asked while mounted so a camera appears soon after HDOnTap adds our domain. */
export function useEmbedAllowed(ids: string[]): Record<string, boolean> {
  const [ok, setOk] = useState<Record<string, boolean>>({}), key = ids.join('|');
  useEffect(() => {
    let live = true; setOk({}); if (!ids.length) return;
    const ask = () => ids.forEach((id) => embedAllowed(id).then((a) => { if (live) setOk((o) => (o[id] === a ? o : {...o, [id]: a})); }));
    ask(); const t = window.setInterval(ask, 60000);
    return () => { live = false; window.clearInterval(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return ok;
}
