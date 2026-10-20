# SURF v0.11 — architecture and migration guide

## Release boundary

Incremental frontend update on deployed v0.10 commit `541a1d00d98eaa879992a148a4c432042419f763`. The existing Site, private audience, React/TypeScript/Vite architecture, Leaflet engine, backend, lockfile and browser data format are retained. No dependency, hosted migration, scheduler, data write or Git-history change is part of this work. v0.11 is local and not deployed. See the root `SURF-v0.11-Migration-Handoff.md` for actual acceptance evidence.

## Setup and dependencies

Use Node 24+ and npm (verified on Node 24.19.0). Run `npm ci`, `npm test`, `npm run build`, `node scripts/verify-worker.mjs`, then `npm run dev` and open Vite's printed URL. `npm run build` includes `tsc --noEmit`, Vite and Worker bundling; a separate Worker smoke check validates its final output. Optional reproducible local benchmark: `node --experimental-strip-types scripts/benchmark-map.mjs`.

Runtime dependencies remain React/React DOM 19.2.0 and Leaflet 1.9.4. Development uses TypeScript 5.9 and Vite 7 (the lockfile resolves Vite 7.3.7). No heavyweight graphics library or additional package is required. Node's built-in test runner executes `src/tests/*.test.ts` with type stripping. A network-enabled browser is needed for live providers and basemap tiles; missing data is explicit when they fail.

## Source map

| Area | Main sources and responsibility |
| --- | --- |
| Navigation and state | `src/App.tsx`, `hooks/usePageNavigation.ts`, `hooks/useAppData.ts`, `hooks/useForecast.ts`: retained five pages, exact shared UTC selection and separate simulation. |
| Home decisions | `services/homeDecision.ts`: favorite/selected spot with current-hour or next supplied record; no fallback to historical records. Comparable cards use the same exact timestamp. Board advice uses only saved non-demo boards and existing guarded heuristics. |
| Surf windows | `services/windowModel.ts`, `components/SurfWindowTimeline.tsx`: at least two contiguous favorable supplied hourly records per spot, split at Pacific midnight. Fresh retrieved evidence required; no inferred daylight, local tide preference or intermediate predictions. Each button represents an actual record. |
| Educational Wave Scale | `education/waveScale.ts`, `components/WaveScale.tsx`, `components/WaveScale.css`: isolated synthetic geometry and local component state. Both Forecast modes and the missing-record state expose the panel. It never writes profile/board data or takes offshore/CDIP Hs as input. |
| Evidence | `components/ForecastEvidence.tsx`, `services/measurementStatus.ts`, `components/SourceMeasurement.tsx`: quality and reliability stay separate; valid/retrieval/issue timestamps and optional station tide retain provenance. Invalid/future retrieval clocks cannot be labeled recently retrieved. |
| Map | Existing `map/`, `hooks/useSpatial.ts`, `components/ForecastMap.tsx`, `MapTimeControls.tsx`: Leaflet and true native model cells, independent controls and bounded caches. |
| Quiver | Existing `components/quiver/`, `services/quiver.ts`, `models/index.ts`: single board collection, showroom/inspector, supplied photos, editing, dimensions and comparison. No data model change. |
| Ratings and equipment | Existing `ratings/`, `recommendation/`: official categories, provisional quality, separate reliability and optional personalized heuristics. No calibration coefficient added. |
| Providers and Worker | Existing `ocean/`, `services/forecast-service.mjs`, `services/provider-policy.mjs`, `worker/index.mjs`: unchanged fixed-provider ingestion and service contract. See `v10-architecture.md`. |

## Wave Scale convention and extension boundary

Face height is vertical trough-to-crest distance in an illustrative breaking profile. Coordinates use 112 SVG units/metre, a fixed trough at y=390 and constant 960×485 framing. Crest elevation equals `faceFt × 0.3048 × 112`; wave geometry control points stay at or below that crest. The prone body spans 1.75 m and board length is 2.13 m. Resizing the entire SVG keeps all lengths in the same ratio. Range buttons show the midpoint as a solid profile and endpoints as dashed outlines; slider changes return to a single height. Display units change labels only. Presets remain explicitly labeled in feet.

The panel is educational, not a hydrodynamic simulation, camera or forecast conversion. Hawaiian settings do not modify it. Future standing references, adjustable body/board lengths or new wave shapes can extend the pure geometry module, but are not implemented. Expert review of the educational explanation is still pending. Any future forecast link requires compatible sourced breaking-face evidence and a valid timestamp; offshore or nearshore Hs cannot be substituted.

## Map rendering, performance and limits

Heatmap, direction arrows, wind flow and markers remain independent. Mobile display-controls/legend disclosures now close each other to reduce overlap; the selected-spot sheet stays below the map. Resolution and unknown issue time appear next to the actual field-valid/retrieval times. Source and missing fields remain honest. Cells are never smoothed into beach-level resolution. Saved October 20–23 snapshots expire by their actual coverage, never by shifting dates.

Display preferences are memoized to avoid recreating canvas layers on unrelated parent renders. The existing normalized cache remains 32 frames/10 minutes; HTTP grids remain bounded to 96 responses with cancellation/deduplication and a 160 ms selection delay. `SpatialLayer.ts` records last native-cell draw duration and estimated canvas RGBA bytes on the map host's `data-spatial-*` attributes for developer inspection. This excludes Leaflet tiles, JS objects and GPU/driver overhead. No user telemetry or durable measurements are collected.

`docs/map-performance-v11.json` records an actual Node normalization/cache microbenchmark. It does not establish browser FPS, frame-switch latency, heap usage or physical-device responsiveness. Those measurements remain pending. Reduced-motion CSS disables Wave Scale transitions; existing reduced-motion behavior disables map flow. OS-level preference testing was not completed in this pass.

## Environment and forecast configuration

`.env.example` is the nonsecret template. `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` set public basemap configuration. Empty/default `VITE_FORECAST_SERVICE` uses browser point retrieval in development and same-origin service in production; `on` opts development into the service, `off` bypasses it. `VITE_NOAA_PROXY_URL` is an optional fixed-station adapter. All `VITE_` values are public. Configure optional `REFRESH_TOKEN` only in server runtime secrets; `BUCKET` is an R2-compatible binding, not a browser variable. `LOCAL_PREVIEW` marks temporary development memory and must not be used to claim persistence.

`npm run build` emits the complete portable Worker at `dist/server/index.js` and hosting declaration at `dist/.openai/hosting.json`. Vite assets are embedded; their standalone removal is intentional. Preserve the existing project identity for this exact Site. For another environment, configure its own protected runtime and R2 binding after migration approval. Never copy platform bearer tokens into Git, Vite variables, source ZIPs or scheduler descriptions.

## Cache, storage and scheduled refresh

Browser key `surf-prototype-v1` and JSON version 1 are unchanged. Boards include photos/front-back images, dimensions and preferences; map settings remain separately in `surf-map-v2`. User data stays on that browser and has no implemented automatic cross-device synchronization. Export/import validated JSON separately from source. Do not reset storage during migration or QA.

The Worker keeps existing `forecast/v8` latest/status/history and `forecast/v10` immutable retrieval snapshots, cooldowns and compact history manifests. These are public forecast records, separate from user boards. A source export does not include R2 or browser records. Retention rules and an independently approved data-transfer/rollback plan are still required.

The existing single enabled refresh automation is retained: 00:05, 06:05, 12:05 and 18:05 America/Los_Angeles. Metadata is not execution evidence. Read `scheduled-refresh.md` before an authorized hosted refresh; do not create a second job, repeatedly POST during provider cooldown, or infer success from a saved schedule. GET health/diagnostics are read-only; provider/grid GETs can trigger cache writes. No refresh was invoked during v0.11 work.

## Migration checklist

1. Obtain GitHub/dedicated-host approval. Import the existing repository with its history; this ZIP intentionally omits Git internals. No reset/force-push.
2. Reproduce all local checks from the lockfile; complete browser acceptance at 360/414/768/desktop widths and on a real touch device.
3. Review the educational diagram with an appropriate expert. Test reduced motion, assistive technology and actual map render/memory performance.
4. Configure private runtime secrets, fixed-provider authorization, BUCKET binding, provider access terms/limits and basemap attribution on the chosen host.
5. Plan browser JSON transfer and R2 history transfer separately, with verified backups and rollback. Do not clear or bulk replace existing data without approval.
6. Inspect the existing scheduler and its recorded executions before changing its destination. Keep one job. Verify attempted/completed time, persistent status readback and fresh providers separately after authorization.
7. Complete hosted acceptance of the exact approved source. Keep experimental quality and missing-data labels until meaningful independent forecast/observation validation exists.

Readiness: source/build/docs ready for developer handoff; broader browser, physical-device and hosted operational acceptance remain incomplete. This is not approval to migrate, publish or overwrite cloud data.
