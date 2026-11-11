# Subset loading and hot/cold refresh (2026-11-09)

Removes the flat ~220–240-spot ceiling (see OPEN-METEO-BUDGET.md): the browser asks for the spots people look at, and the cron refreshes only those.

## Client
`src/ocean/spotScope.ts` computes the scope: selected spot + favourites (never dropped) + the 60 nearest spots within 100 km of the selected spot and of the first favourite + the pins drawn on the Explore map (only from zoom 7, debounced 500 ms, at most 60: a world-zoom pan reports nothing) + spots a screen asks for (Compare: every spot it lists; the spot picker: its list, ≤60; Find spots: the 60 nearest its anchor; Home: its cards, reference spot and the 60 nearest to it; requests are capped at the 250 newest). A screen never ranks a spot that has not loaded: Compare lists it last as "loading…", Find spots counts it as loading, Home shows its skeleton, and Home's copy says "The 60 nearest spots within 100 km" where there are more. `loadOcean(onStatus, scope)` fetches only those (a wider scope fetches only what was not fetched in the last 10 min: the per-URL request cache) and the bundle carries `loadedSpotIds`. A spot outside the bundle shows a loading state (Callout skeleton, Forecast skeleton), never a number. No scope = every spot (tests, tools).

## Worker
- Every `/api/provider(s)` request for a per-spot key (`marine-`, `spread-`, `weather-<spotId>`) of a KNOWN catalogue spot (junk ids write nothing) writes one tiny R2 object `forecast/v10/hot/<spotId>`; its `uploaded` time is the last request. At most one write per spot per isolate per hour, awaited via waitUntil, so a map load's later batches are recorded and there is no read-modify-write to race. R2 (already bound) rather than KV: no new binding.
- The cron (`hotHours: 24`) lists the hot prefix (1 R2 list per run) and refreshes the per-spot targets of the newest 150 spots requested (180 until batch 3) in the last 24 h (the cap keeps the quota safe whatever the traffic) at the unchanged cadence. Shared targets (tides, buoys, MOP nearshore, shore wind) stay on the cron. Before any hot record has ever been written (a fresh deploy: marker `forecast/v10/hot-started` absent) or if R2 fails, every target is refreshed as before; once started, a quiet day means nothing is hot. The run report gains `hot: {spots, hours, skippedCold}`.
- A cold spot is retrieved on demand by `retrieve()` (TTL-checked, stale-while-error), and the browser's freshness label (4 h marine, 2 h weather) comes from the retrieval time as before, so it stays honest. No cold-specific limits were needed.

## Measured (weighted Open-Meteo calls/day, free tier 10,000; cron peak = R2 ops + fetches in one run, 6 h simulation, limit 1,000)
| spots | hot | cron calls/day | flat cron (before) | peak subrequests/run |
|---|---|---|---|---|
| 254 | 100 | 4,160 | 10,566 | 653 |
| 254 | 150 | 6,240 | 10,566 | ~650 |
| 500 | 150 | 6,240 | 20,800 | 645 |
| 1,000 | 150 | 6,240 | 41,600 | 646 |
(`node docs/forecast/data/open-meteo-budget.ts 254 500 1000`; `SHOW=1 node --test src/tests/hot-cron.test.ts`.)

## Honest limit
The cron cost is `hot × 41.6` and no longer grows with the catalogue. But a spot is hot if ANYONE requests it, so the ceiling is the number of DISTINCT spots requested per 24 h: about 240 before the quota is exceeded (150 comfortably); the cron counts at most 180 of them. One person panning the whole world at low zoom reports at most 150 pins; many people over many regions can exceed it. If that happens: shorten `hotHours`, or give cold spots a longer cadence (weather 90 min, marine 3 h are the honest limits at 2 h / 4 h). Not needed yet.

## Shared targets follow the spots (hot-shared-targets, 2026-11-09)
The per-station/per-point keys (`tides-<station>`, `tide-extrema-<station>`, `nearshore-<mop>-forecast|das`, `shore-ndbc-/shore-asos-<id>`, extra `ndbc-<id>`, `cdip-<id>`) are recorded like spots when a visitor requests them (R2 object `forecast/v10/hot/~<group>`, known groups only) and the production cron refreshes one only while it was requested in the last 24 h. The fixed core (`tides`, `tide-extrema`, `buoy`, `level`, SF nearshore) stays always on. The browser asks only for the tide stations of the scoped spots (pipeline.ts `stationIds`), so an East or Hawaii station nobody needs is neither requested nor kept warm. Run report: `hot.skippedShared`. Cold shared keys are retrieved on demand with their TTL, so freshness labels stay honest.
