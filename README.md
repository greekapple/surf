# SURF v0.10 — forecast reliability and Map 2.0

This is the recovered React + TypeScript + Vite application, stabilized incrementally on v0.9. It retains the desktop/mobile Quiver showroom, boards/photos, recommendations, personal settings, provider adapters, official rating categories, Leaflet layers and v1 backups.

**Local release candidate; not deployed.** The recovery ZIP and original source checkpoint are preserved. No Git commits, pushes, migration or hosted forecast writes were performed for this stabilization pass. See [final v0.10 handoff](docs/v10-final-handoff.md) for the latest verification results and remaining limits. The earlier [stabilization handoff](docs/v10-handoff.md) is retained as historical evidence.

## Viewing v0.10 versus the hosted website

The working tree is v0.10 and uses the existing SURF Site identity. The managed development preview is `http://terminal.local:4173/`, accessible only inside the QA environment. It is not a public or user-accessible share link. The regular hosted Site remains at its last published version because deployment was explicitly withheld. No second Site or deployment was created to work around that boundary.

To inspect this exported source, use a Node 24-enabled development environment and follow the commands below; open the local URL printed by Vite. A school-managed computer that cannot run Node/Terminal will need a supported development environment or an explicitly authorized update of the existing private Site. Do not claim the deployed version contains local v0.10 changes until the exact source is approved, published and checked.

The latest inspection confirmed Home favorites, profile persistence, forecast/source/CDIP semantics and desktop Quiver creation/photos/dimensions/comparison before browser transport became unresponsive. New mobile and photo-reload checks were not completed; earlier v0.10 narrow-layout evidence is retained separately. See the final handoff for scope and the disposable internal-preview QA record.

## Reproduce locally

Use Node 24+ (tested with 24.19.0) and npm. A lockfile is included.

```sh
npm ci
npm run dev
npm test
npm run build
node scripts/verify-worker.mjs
```

Development serves the React UI and an optional same-origin API. Development normally uses browser point retrieval because upstream access from the managed preview process can fail. Its optional API cache is temporary memory and reports `persistent:false`. Public-data calls can be rate-limited or blocked; they are never replaced with unlabeled demo values.

`npm run build` checks TypeScript, builds Vite, then bundles a portable ESM Worker with embedded assets at `dist/server/index.js`. After bundling, `dist` contains `server/` and `.openai/`; that is intentional, not missing frontend output. `node scripts/verify-worker.mjs` checks this final Worker without making upstream calls.

## Configuration and portability

Copy the nonsecret `.env.example` to a local environment file if needed. `VITE_` values are public build-time settings; never put tokens in them. Production uses the same-origin service unless explicitly disabled. A different Worker host needs its own R2-compatible `BUCKET` binding, server-side refresh authorization and HTTP scheduler. Preserve `.openai/hosting.json` only when continuing this exact Site. Source export does not migrate hosting or transfer credentials.

- [v0.10 architecture and setup](docs/v10-architecture.md)
- [Forecast verification schema, matching and limits](docs/forecast-verification.md)
- [Scheduled refresh procedure and verification boundary](docs/scheduled-refresh.md)
- [Final v0.10 handoff](docs/v10-handoff.md)
- [Future Wave Scale specification](docs/wave-scale-future.md) — documentation only

## What changed

Durable provider cooldowns, Retry-After handling, bounded retries/concurrency, conditional validation and explicit stale fallback; read-only data-health diagnostics; a less cluttered map with separate heatmap/arrows/flow/markers and opacity; exact-time playback; bounded regional-frame caching; contiguous offshore-potential windows; and an initial local forecast-verification workbench.

Ratings remain experimental offshore assessments. CDIP SF023 is nearshore modeled significant wave height at approximately 10 m depth, not observed breaking-face height. No new breaking-wave conversion or invented confidence percentage was added. Regional fallback snapshots retain their real October 20–23 UTC valid times; unavailable frames are not moved into the present.

## User data and backups

The `surf-prototype-v1` localStorage key and version 1 JSON format are unchanged. Board photos and preferences stay in the browser. Map preferences use `surf-map-v2` separately. Use Personal → Data management → Export JSON to transfer user data. A source ZIP does not include the user's browser records, hosted R2 cache/history or platform secrets.

Earlier release notes below are historical and may describe prior hosting/test results.

---

# SURF v0.9 — Quiver Showroom 2.0

Continue from [the v0.9 handoff](docs/v09-handoff.md) and [browser verification](docs/usability-verification-v9.md). Existing v0.8 server, cache, history, map and local records are preserved. Desktop gallery and mobile swipe inspector share selection/editing/recommendations; optional back photos use the existing safe local raster pipeline. Wave-height headlines keep offshore, nearshore and breaking semantics distinct.

`npm ci` · `npm run dev` · `npm test` · `npm run build`

106 tests pass. Production emits the same portable Worker ESM with the existing R2 binding. Hosted manual refresh/readback succeeded; weather429 and regional timeouts remain explicit. The existing scheduled task is enabled, with execution still unverified at the recorded inspection. No calibrated breaking-height range is invented. [Future Wave Scale specification](docs/wave-scale-future.md) is documentation only.

Earlier release notes below are historical.

---

# SURF v0.8 — forecasts and equipment

Start with [v0.8 architecture and connection limits](docs/v08-architecture.md) and [scheduled refresh instructions](docs/scheduled-refresh.md). React/TypeScript/Vite, existing ratings/map, saved boards and v1 JSON storage are preserved. New Home, Quiver showroom/photos and Personal hub use the same underlying data.

`npm ci` · `npm test` · `npm run dev` · `npm run build`

The production build now emits a portable Worker ESM with a BUCKET R2 binding, public forecast ingestion, persistent caches and raw verification history. The hosted schedule must be verified separately. Open-Meteo, NOAA station and CDIP numeric source handlers were tested; NOAA ERDDAP returned HTTP 503 during the latest source-handler check. Regional dated fallback grids remain clearly labeled. No breaking-wave conversion or calibrated accuracy claim is made. Earlier notes below describe prior versions and are historical.

---

# SURF v0.7 — provisional ratings and regional forecast fields

Incremental update; prior implementation notes follow below. Start with [v0.7 handoff](docs/development-handoff-v7.md), [rating rules](docs/rating-engine-v7.md) and [map sources/connection limits](docs/map-data-sources-v7.md).

`npm ci` · `npm test` · `npm run dev` · `npm run build`

Regional maps attempt NOAA ERDDAP retrieval, then use **explicitly labeled genuine dated model snapshots** when direct access fails. Included snapshots cover 2026-10-20 through 2026-10-23 UTC; they are not a live browser connection and are never shifted into future times. Refresh using `python3 scripts/refresh-spatial.py --hours 72`, then rebuild/deploy. Real spot forecasts remain independent.

No current spot rating is calibrated. No offshore-to-breaking height conversion. Optional server buoy adapter is provided but not deployed with the static Site. Existing quiver/profile JSON and storage compatibility preserved.

---

# Surf Forecast Lab v0.6

The current app is a portable React + TypeScript + Vite project. This increment adds public surf-rating categories, independent reliability, and a lazy interactive geographic map while preserving the original forecast providers, quiver, profile, demo, simulation and browser storage.

## Run locally

Use Node.js 22.18+ (Node 24 recommended and tested).

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite serves the development app; deploy `dist/` after building. No Astra-only runtime, account or API key is required for the default preview. Existing `.openai/hosting.json` identifies the current private Site: preserve it when continuing that Site. Give a separate copy its own deployment identity before publishing elsewhere.

Public forecasts and OpenStreetMap tiles require internet access. NOAA NDBC browser CORS limitations retain the explicitly historical observation fallback. Missing nearshore calibration withholds real surf ratings and breaking-wave estimates. Source and unit labels remain inspectable. Browser boards/preferences are separate from source exports; use Profile → Data management → Export JSON to move them.

- [v0.6 development handoff](docs/development-handoff-v6.md)
- [Provisional rating rules and reliability](docs/rating-engine-v6.md)
- [Map data, point-layer limitations, dependencies and licenses](docs/map-data-sources-v6.md)
- [Original data integration verification](docs/data-integration-verification.md)

The optional `.env.example` documents public basemap settings. Never place secret tokens in client-side VITE variables. No setup is required to use the default basemap.

---

## Earlier project notes

# Surf Forecast Lab v0.3

React + TypeScript + Vite. Original minimal forecasting prototype with no runtime APIs, AI services, app authentication, or external assets. The hosted Site retains its existing private audience.

## Run

- `npm ci`
- `npm run dev`
- `npm test` (Node 22+ with TypeScript stripping)
- `npm run build`

## Forecast first

10 illustrative California breaks, 7 fixed sample days, 5 timestamps per day. Forecast opens without onboarding. Spot tabs, seven-day outlook, hour slider, selectable swell components, shore-relative wind, gusts, interactive tide sample markers, temperature, and full source/issue/valid/update metadata. No missing hours or tide extrema are invented.

Today and Explore provide regional sorting, search, filters, favorites, and compact three-spot comparison. Dates intentionally remain the fixed October 16–22, 2026 demonstration week.

## Separate scores

- `recommendation/sqi.ts`: independent Surf Quality Index (SQI), break-specific weights 25/25/15/15/20. Missing essential availability flags or input values withhold SQI; no hidden renormalization.
- `recommendation/personal.ts`: optional Personal Match, with experience/comfort/hazard/access exclusions first. It never mutates SQI.
- `recommendation/board.ts`: saved-board fit with documented 30/25/20/15/10 factors.
- `recommendation/combined.ts`: Personal Match 65% + board fit 35%, with spot/time-only fallback when there is no suitable board or the quiver is empty.

Heuristics are deterministic and unvalidated, not accuracy or safety guarantees. Offshore wind is penalized at high speeds. Tail/fins are stored but not scored without reliable model-specific rules.

## Persistence and simulation

The v1 localStorage key and existing boards/preferences are preserved. New personalization defaults to off. Import validates profile enums, dimension bounds, IDs, wave ranges and favorites, then asks for explicit replacement confirmation. Recovery blocks overwriting unreadable existing data. Export and reset remain available.

Simulation copies nested forecast data and resets on a change of spot/day/hour. It never writes provider records or browser-persisted forecasts. Original day/hour timelines and the tide sample curve retain original values and their labels. Edited overview/rating and optional recommendations are marked “Simulation — Not Actual Forecast”.

## Future structure

`services/provider.ts` retains the forecast adapter. Forecast metadata and availability, optional tertiary swell, supplied tide extrema, and AccuracyRecord types support future sources and archived predictions-versus-observations. No live connections or verified spot characteristics are present.

## Verification

24 automated tests: weighted SQI calculations and missing data, score/profile independence, seven-day record uniqueness, summary and comparison time consistency, display conversion invariance, personal filtering, empty/no-fit quivers, board logic, isolated simulation, backup validation/migration, persistence and storage errors.

Desktop browser checks: five-page navigation; face/Hawaiian invariance; timestamp synchronization with wind/tide/rating; score-factor expansion; simulation recalculation/reset; fractional board creation/edit/refresh persistence/delete confirmation; three-spot comparison; optional beginner matching excluding expert breaks. Production TypeScript/Vite build passes. Responsive CSS is implemented; a separate mobile viewport check was not available.

Specifications: `docs/build-specification.md` (original) and `docs/build-specification-v3.md` (current).

## v0.4 — Retrieved ocean data preview

Default Retrieved mode adds `src/ocean/` provider adapters, nullable measurements, independent provenance, exact UTC joins and source/freshness UI for Ocean Beach, Bolinas and Linda Mar. Open-Meteo provides marine/weather model forecasts; NOAA CO-OPS supplies a clearly regional San Francisco station tide reference and separate latest water-level observation. NDBC's browser CORS limitation is reported with an explicitly saved observation fallback. The public API providers may impose rate limits or availability restrictions; no keys or private user data are sent.

No uncalibrated local breaking height, swell exposure, orientation, tide preference or wave-shape input is invented. SQI and Your Match remain insufficient where required inputs are missing. Original demonstration examples remain separate. Smart Quiver CRUD/comparison/persistence remain intact; real board recommendations are withheld without essential local wave inputs. Experiment board fit uses explicitly hypothetical inputs only.

Manual endpoint verification: `node --experimental-strip-types scripts/check-ocean-providers.mjs`. See `docs/data-integration-verification.md` for successful connections, browser limits and QA scope. `public/observations/ndbc-46026.json` is a dated NOAA observation snapshot, never a live feed. The v0.3 verification and behavior above describe Demonstration mode.
