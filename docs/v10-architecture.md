# SURF v0.10 architecture and migration readiness

## Scope and verification boundary

React 19.2, TypeScript 5.9, Vite 7 and Leaflet 1.9.4 are retained; no new runtime dependency was added. Development continues in the recovered working tree based on commit `d045226d50ab1bd75cf7899a5cc41f16c843c7d1`. No migration, Git history mutation, publication or hosted data refresh is part of this release-candidate verification.

## Frontend and shared state

- `src/App.tsx`: retained navigation/pages and version label.
- `hooks/useAppData.ts`, `utils/storage.ts`: version 1 browser records, validated backups, no schema migration.
- `hooks/useForecast.ts`: shared spot/exact UTC time, selected forecast, independent map preferences, comparison and isolated simulation. Switching spots retains the selected timestamp.
- `ocean/types.ts`: nullable measurements and per-measurement provenance. `ocean/bridge.ts` provides a legacy projection with explicit missing flags, never a fabricated local face height.
- `ocean/openMeteo.ts`, `noaa.ts`, `nearshore.ts`: unit-aware provider normalization and exact joins.
- `ocean/request.ts`, `pipeline.ts`, `server.ts`: production same-origin first, explicit browser fallback, original server retrieval metadata and stale labels across JSON and text/station records. Point bundles use a ten-minute in-browser cache.
- `ratings/`: general surf categories/provisional offshore potential and independent reliability. `recommendation/`: optional personal/board heuristics. Saved selection/photos do not change general quality. Insufficient local wave evidence still limits real board advice.
- `components/quiver/` and `services/quiver.ts`: v0.9 showroom and single underlying saved board collection, unchanged during v0.10.

## Worker and endpoints

`scripts/build-worker.mjs` embeds Vite assets, provider-policy helpers, ingestion service and `worker/index.mjs` into `dist/server/index.js`; it emits a copy of `.openai/hosting.json` into `dist/.openai/`. No generic proxy accepts arbitrary upstream URLs. Runtime storage is the existing `BUCKET` binding.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Read last refresh status; service contract version 0.8, implementation revision 0.10. Binding persistence is distinct from scheduler evidence. |
| `GET /api/diagnostics` | Read-only provider/cache/error inventory; no upstream retrieval or R2 writes. Unknown model issue times remain null. |
| `GET /api/provider?key=...` | Retrieve one allowed marine/weather/station/CDIP key; may refresh public provider cache when stale. |
| `GET /api/grid?field=...&time=...` | One allowed regional field at an exact supplied valid time; 404 if no exact frame. |
| `POST /api/refresh` | Fixed-provider ingestion writer. Rejects GET and cross-origin browser writes. Not called during this stabilization request. |

On Sites, the private host enforces its access boundary. Optional `REFRESH_TOKEN` is checked server-side; a portable deployment must provision real authorization rather than rely only on the Origin header. Never copy platform bearer credentials into source, prompts, exports or client settings. An alternate public host should also rate-limit read-triggered ingestion.

## Provider/cache policy

19 targets: 3 marine, 3 weather, tide predictions, exact tide extrema, latest water level, buoy 46026, CDIP SF023, and 8 regional variables. Normal TTLs are 30 min for point forecasts/CDIP, 10 min for station observations, 6 h for tides/regional grids.

Single-flight deduplication is per Worker isolate/key. Manual full refresh groups requests by provider origin, serializes each point origin and allows up to 2 regional calls within a maximum of 4 concurrent groups. Independent requests across Worker isolates are not a distributed lock; cross-isolate deduplication is future work.

Provider fetch timeout is 18 s; regional metadata timeout is at most 10 s. Point transient upstream/network failures get at most one bounded retry. Jitter is used for retry/cooldown timing only, never forecast scoring. Retry-After numeric seconds or HTTP dates are honored. Long retry windows are persisted/deferred instead of keeping a Worker asleep. 429 is shared across the origin; 404 backs off for an hour. Other failure cooldowns grow with bounded jitter. Invalid payloads are not cached as successes or retried as transient network errors. Payload/row bounds protect memory.

Conditional requests reuse ETag/Last-Modified when supplied. 304 updates `validatedAt` while preserving original `retrievedAt`. Failed retrieval keeps original payload/timestamps and returns `cache:stale`; diagnostics record error category/retry time. TTL/validation freshness does not establish forecast accuracy or imply a model issue time.

Regional metadata clips a multi-day query to the provider's actual coverage, without shifting valid times. Metadata availability is not numerical-grid success. No successful fresh retrieval is claimed merely because a fallback exists.

## Persistent history

Existing `forecast/v8/latest/<key>.json`, `forecast/v8/status.json` and legacy history are preserved. New failure/origin/dataset state uses `forecast/v10/`. On refresh, immutable public payload snapshots are stored at `forecast/v10/snapshots/<key>/<retrievedAt>.json`; compact schema-2 history manifests reference them at the existing history prefix. Repeated reuse of the same retrieval does not duplicate payload snapshots. Source URL, original retrieval, issue time (nullable), valid range, payload and ingestion metadata remain available. Missing buoy valid ranges are shown unknown rather than guessed.

There is no automatic archive export, observation matching job or retention deletion policy in v0.10. Configure reviewed retention/lifecycle rules before scale; do not delete prior history during migration. A source ZIP does not contain hosted history. Read-only diagnostics cannot prove a successful fresh scheduled write.

## Map rendering and performance

Leaflet/OpenStreetMap retained. NOAA ERDDAP numerical grids cover 36–40°N / 234–238°E at native 0.5° spacing. WW3 scalar/direction fields and paired GFS u/v components are distinct from coastal spot queries. Wind uses actual three-hourly frames, displayed separately from the spot's hourly selection. Secondary swell/gusts remain points when no supported regional field exists; tide is one station.

Native cells are drawn as rectangles, not smoothed into invented beach resolution. Heatmap, arrows and flow use independent canvases; markers are a separate layer. Opacity applies to the heatmap canvas. Reduced-motion preference disables flow. Selected-marker pan padding keeps its label within a narrow map. Legend/loading/spot sheet/timeline have distinct placement. Mobile uses a below-map expandable spot sheet.

In-browser HTTP grids are deduplicated, cancellable and bounded to 96 cached URL responses/10 min. Normalized frames use a 32-entry LRU/10 min cache. A 160 ms input delay avoids requests for every rapid slider event. Stale fallback files retain their own original timestamps. Failed scalar retrieval removes the field; missing direction retains a valid scalar; wind requires both components. Playback waits during loading, supports speed/pause/resume, advances only to supplied timestamps and stops at the end, on navigation or hidden page.

This release contains no measured physical-device frame-rate or memory claim. See handoff for the actual browser/performance measurements and verification limits.

## Windows, verification and calibration

`services/windowModel.ts` groups >=2 eligible hourly records per spot with gaps <=1 h, score >=55, sufficient reliability and a maximum 48 h look-ahead. Stale/saved/invalid-age sources are excluded from real windows. It reports minimum/peak offshore potential, wind/period changes and unknown daylight/local tide response. It does not create personal board/safety recommendations or claim all records in a night-spanning window are surfable.

`services/verification.ts` and the lazy Personal development panel provide local reviewed JSON import and exploratory metrics, not a live accuracy service. See `forecast-verification.md`. `ocean/localCalibration.ts` registers Ocean Beach evidence but has no active coefficients, method version or paired breaking-face observations. SF023 remains modeled Hs at 10 m depth. No Ocean Beach transfer function is applied to Bolinas/Linda Mar; SM406 remains a Pacifica reference north of Linda Mar.

## Setup and migration checklist

1. Use Node 24+, `npm ci`, `npm test`, `npm run build`, then `node scripts/verify-worker.mjs`.
2. Copy `.env.example` only for public build configuration; configure runtime binding and secrets privately.
3. Read existing hosting identity; never create another Site or push/commit without the user's approval in this session.
4. For a different host, provision R2-compatible persistence and protected fixed-provider ingestion; restore/migrate cache/history separately after explicit authorization.
5. Recreate one scheduler only after inspecting the existing schedule and its recorded runs. Existing schedule: 00:05, 06:05, 12:05, 18:05 America/Los_Angeles. Manual endpoint success, task completion, persistence and fresh provider data are distinct evidence.
6. Transfer browser records via validated JSON; do not rewrite localStorage keys.
7. Complete hosted acceptance and real touch-device checks before calling migration or production reliability verified.

Dependencies/lockfile and existing deployment identity are retained. Temporary QA wrappers are removed before final build/export. No credentials, node_modules, generated dist or Git internals are included in the source ZIP. Recovery and final exports are separate immutable files.
