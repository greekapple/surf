// Open-Meteo commercial plan (user, 2026-11-12): when the Worker secret OPEN_METEO_KEY is set, server-side calls go to the customer endpoints with &apikey=.
// The key is read from the Worker's env only, added inside the fetcher, and never stored, logged or returned: callers keep seeing the plain public URL.
// Without the key (local dev, tests, or before it is set) URLs are unchanged: the free API.
const HOSTS = {'https://api.open-meteo.com/': 'https://customer-api.open-meteo.com/', 'https://marine-api.open-meteo.com/': 'https://customer-marine-api.open-meteo.com/'};
export function withOpenMeteoKey(url, key) {
  if (!key || typeof url !== 'string') return url;
  for (const [free, paid] of Object.entries(HOSTS)) if (url.startsWith(free)) return paid + url.slice(free.length) + (url.includes('?') ? '&' : '?') + 'apikey=' + encodeURIComponent(key);
  return url;
}
/** A fetch that routes Open-Meteo calls to the paid endpoint when getKey() returns a key. On a 401/403 from the paid endpoint (bad or lapsed key) it retries the free URL once, so a key problem degrades to today's behaviour instead of breaking the forecast. */
export function openMeteoFetcher(getKey, base = fetch) {
  return async (input, init) => {
    const key = getKey(), url = typeof input === 'string' ? input : input?.url;
    const paid = withOpenMeteoKey(url, key);
    if (paid === url) return base(input, init);
    const r = await base(paid, init);
    return r.status === 401 || r.status === 403 ? base(url, init) : r;
  };
}
