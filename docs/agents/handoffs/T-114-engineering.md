# T-114 handoff (engineering): no direct browser call to Open-Meteo

Branch `t114-direct-calls` (forecast-trust merged). tsc clean, 478 tests (2 new in `src/tests/t114-spread-proxy.test.ts`; two hard-coded provider counts in `service.test.ts` and `v10.test.ts` went from `serviceSpots.length*2` to `*3`), build OK.

**The direct call:** the multi-model wave-spread request (`modelSpreadURL`, T-078 ranges) was the only Open-Meteo request `serverProviderPath` did not map, so the browser sent it straight to `marine-api.open-meteo.com` with no saved copy: a 429 there reached the console. (The ordinary marine and weather feeds were already proxied.)

**Fix:**
- `src/ocean/openMeteo.ts`: `SPREAD_MODELS` and `modelSpreadURL` now live here (re-exported from `src/services/modelSpread.ts`, no behaviour change).
- `src/ocean/server.ts`: `serverProviderPath` maps each spot's spread URL to `/api/provider?key=spread-<spotId>`.
- `services/forecast-service.mjs`: a `spread-<id>` ingestion target per service spot (same request, 30 min TTL). On a provider 429 the proxy already answers with the retained payload as `cache: 'stale'` and the original retrieval time, which the T-084 rule labels "saved" (`staleSource` / `validatedAt` path), so a rate limit never reaches the user's console.
- Cost to know about: +1 upstream Open-Meteo request per spot per ingestion cycle (45 more per cycle, on top of 90). If quota is a concern, raise that TTL; it is one number.

**Tests:** every spot's spread URL routes to the `spread-<id>` key and the Worker has a matching target (same `models`/`hourly`); with a mocked Open-Meteo 429 after a first success, the proxy serves the saved copy labelled stale with the original `retrievedAt` and a 429 warning.

**Browser (one light load, no crawl):** Ocean Beach spot page makes zero requests to any Open-Meteo host; the spread feed came through the proxy (200). Left: the page also calls `api.weather.gov` (NWS alerts) directly from the browser; that is a separate provider, not touched.
