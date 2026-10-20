# SURF v0.11 — Migration Handoff

Date: 2026-10-20. **Implemented local release candidate; automated checks pass; browser acceptance is partial. Not deployed or migrated.**

## Source, preservation and viewing

Checkout: `/workspace/sites/surf-assistant`. Work began on clean, deployed v0.10 commit `541a1d00d98eaa879992a148a4c432042419f763`. Baseline tests, full build and Worker smoke passed before changes. `surf-v10-pre-v11-checkpoint.tar.gz` preserves that clean source. The earlier v0.10 recovery ZIP, final ZIP and older checkpoint remain unchanged; hashes are recorded in the export manifest.

The existing owner-private Site and history were retained. Its approved v0.10 deployment succeeded before this task; current Site metadata reports hosting version 9 at https://surf-quiver-lab.miloasinclaire.chatgpt.site. That URL does **not** contain these local v0.11 edits. No new Site, Git commit/push/history rewrite, v0.11 deployment, migration or hosted forecast-data write was performed.

The actual updated app opened in the internal managed preview at `http://terminal.local:4173/`. This is internal QA only, not a user-accessible sharing URL. The preview was stopped after QA. To inspect v0.11, export into a supported Node environment and use `npm ci` then `npm run dev`; open Vite's printed local URL. Publishing the exact v0.11 source to the existing private Site requires separate authorization.

## Implemented changes

- Consistent focus-visible treatment and selected mobile touch targets/readability, without replacing the theme or Quiver architecture.
- Home chooses the current supplied hour or next available record for the favorite/selected spot, rather than a historical shared Forecast selection. Favorite cards use the same timestamp; the geographic heading matches actual coverage. Wind and regional tide appear with the main forecast. Equipment advice considers only saved non-demo boards through the existing guarded model; unavailable breaking-face/character inputs produce an honest unavailable state and no precise match percentage.
- Surf windows retain contiguous supplied-hour grouping and fresh-evidence requirements, now split at Pacific midnight. The expandable timeline selects actual hourly records and explains wind, primary swell, contextual tide, retrieval age, daylight and local-response limits. Personal suitability remains separate. A genuine inherited selector mismatch was fixed so disclosure-wrapped window actions fill the available width.
- Map 2.1 retains Leaflet, genuine 0.5-degree cells and independent heat/arrows/flow/markers/opacity. Mobile display and legend disclosures close one another; the selected-spot sheet remains below the map. Field metadata explicitly shows native resolution and unavailable issue time. Memoized display preferences avoid canvas rebuilds from unrelated parent rendering; local draw/canvas diagnostics are available as DOM data attributes.
- Wave Scale 1.0 is an expandable educational Forecast panel, also available without a forecast record. It has six requested ranges, endpoint outlines, an accessible 1–10 ft slider in 0.5 ft steps, feet/metres display and reduced-motion CSS. Fixed metric geometry keeps the 1.75 m prone body reference and 2.13 m board unchanged. Wave face means vertical trough-to-crest height. Offshore Hs, CDIP nearshore Hs and Hawaiian conventions never seed or transform this illustration.
- Forecast evidence exposes per-input provenance, valid/retrieval/issue times and contextual tide. Pure timestamp labeling rejects invalid/future retrieval clocks and says recently retrieved rather than implying observed/live surf. Quality and reliability remain independent.
- Updated setup, dependency, architecture, provider/cache/storage, refresh, migration and educational-feature documentation. No runtime dependency or browser-data schema change.

## Tests and build

130 tests passed, zero failed (123 preserved baseline tests plus 7 focused v0.11 tests). Coverage includes provider cooldowns/429 Retry-After/dedup/retry/stale fallback, exact frame/unit semantics, ratings, Quiver/storage/import validation, forecast verification, Wave Scale metric geometry/fixed references/invalid inputs/unit formatting, Home timestamp/board guards and Pacific-day window splitting. No test was deleted.

Complete production build passes TypeScript (`tsc --noEmit`), Vite (121 modules), and portable Worker bundling (20 embedded assets). Generated-Worker smoke passes HTML, hashed assets, API contract/revision, absent temporary QA paths and R2 hosting manifest. Final command evidence is in `docs/verification-v11.json` and `docs/v11-checks.txt`. Service contract remains 0.8, backend revision 0.10; frontend release is 0.11. Those different numbers are intentional.

Local Node map microbenchmark: 1,000 normalizations of 81 genuine native cells, median approximately 0.052 ms, p95 approximately 0.243 ms; bounded cache retained 32 frames and 32 measured hits. `docs/map-performance-v11.json` contains the actual run. JSON serialization size is not heap memory. Browser draw/frame-switch timings, full memory use, FPS and physical-device performance were not measured.

## Browser acceptance matrix

| Area | Evidence in this pass | Remaining acceptance |
| --- | --- | --- |
| Home | Actual v0.11 records, comparable favorite cards, current-hour labeling, wind/tide/reliability and guarded board empty state visible. Screenshot found the inherited window layout mismatch; CSS fixed. | Full post-fix visual matrix, favorite persistence and newly selectable window-hour interactions need a fresh pass. |
| Forecast | Actual offshore/swell/wind/tide, source labels, quality/reliability separation and unavailable local face visible. | Broader missing-provider/source detail and every nearshore/experiment interaction not freshly exercised. |
| Wave Scale desktop | Opened panel; 3–5 and 8–10 ft range states, metres conversion and keyboard Home/Right to 1.5 ft verified. Fixed-scale geometry tested across every slider step and preset endpoint. Clear actual screenshot saved. | Expert educational review, assistive technology and OS reduced-motion checks remain pending. |
| Wave Scale phone | In a 360 px CSS iframe viewport, panel and 8–10 ft selection verified. Document client/scroll widths were both 345 px (15 px browser scrollbar), so no document horizontal overflow at that state. | Screenshot capture timed out. Not physical-touch testing. Other phone sizes and tablet not completed. |
| Map desktop | Waves/wind fields, OpenStreetMap, actual saved-grid labels and native resolution visible. Heatmap off with arrows on; heatmap on with arrows off and wind flow on; opacity 1% then restored 62%; Bolinas selection and exact record controls verified. Playback advanced 1 PM to 6 PM and paused; wind valid time stayed explicit and distinct. Original layer/display/spot/time restored. | Flow appearance/canvas counts, pan/zoom, hidden/end stop, stale-frame edge cases and browser performance not fully measured in this pass. |
| Map phone/tablet | Responsive controls/source changes inspected in code; existing v0.10 evidence remains historical. | Fresh mobile disclosure exclusivity, touch targets/overlap, map playback and tablet visual acceptance not completed. |
| Quiver desktop | Four original example boards retained after reload. Next-board selection, dimension guides and comparison panel verified. Real board advice stayed limited without local face/character. No board modified/deleted. | New photo front/back reload/edit flow, two-board comparison, mobile swipe and full inspector acceptance not completed this pass. |
| Personal/data | Profile and data sections opened; Export JSON downloaded and parsed as version 1 with all four existing boards and unchanged zero favorites. | No destructive import/replacement/reset performed; import validation covered by tests. New settings-persistence and photo round-trip UI checks remain pending. |

One Playwright selector call timed out. Bounded native accessibility controls then worked and enabled the checks above; the failed selector operation was not looped. Later the mobile screenshot operation timed out, and browser QA stopped. No browser, screenshot or hosted success is inferred from a sent action. A temporary responsive QA wrapper was removed, and Worker smoke verifies it is not shipped. The desktop screenshot at `docs/v11-screenshots/wave-scale-desktop.jpg` shows this actual v0.11 implementation; existing `docs/v10-screenshots/` images are historical and are not v0.11 mobile proof. No mobile screenshot is fabricated.

## Forecast and provider findings

Local browser QA loaded Open-Meteo marine/weather and NOAA station products, with 10 connections available/1 partial. NDBC buoy data remained labeled saved historical. Regional waves/wind used genuine dated saved native grids after direct regional access was unavailable; a fallback is not proof of a fresh provider connection. Waves showed 61 nonmissing native cells and wind 81. Field valid/retrieval times were preserved, and wind's three-hour resolution stayed distinct from spot hours. Missing model issue timestamps remain unknown.

Existing provider protections passed deterministic tests: durable origin cooldown, HTTP 429 numeric/date Retry-After, bounded transient retries, request deduplication, regional timeouts/coverage clipping, conditional validation and original-time stale cache. No new hosted runtime/provider refresh, durable readback or scheduler execution was verified. Site metadata shows one original refresh job enabled at 00:05/06:05/12:05/18:05 America/Los_Angeles; it was not changed or duplicated. Enabled does not mean successful.

Nearshore CDIP SF023 remains QC-filtered modeled significant wave height around 10 m depth, not observed breaking-face height or the selected offshore forecast. Pacifica SM406 must not be relabeled Linda Mar. Ocean Beach, Bolinas and Linda Mar still lack validated breaking-height coefficients and sufficient compatible observations. The existing compatible-pair workbench remains available, but no live accuracy sample set, real-world MAE or confidence percentage was invented. Official categories remain Flat, Poor, Weak, Surfable, Not Bad, Solid, Good, Firing, Epic and Unrated, with provisional labeling where appropriate.

## Migration readiness and next steps

**Ready for local developer handoff; not fully browser-accepted or operationally production-verified.** Reproducible source/build/Worker, lockfile, public environment template, shared data model, provider policy and explanatory docs are ready. See `docs/v11-architecture.md` for the architecture map and configuration/deployment checklist.

Before a move: complete fresh phone/tablet/desktop and physical-touch acceptance, inspect real map memory/render timing, review Wave Scale with an appropriate expert, and close photo/import/persistence test gaps. Obtain approval for GitHub/publication/migration. Preserve existing history via the repository itself; the source ZIP intentionally omits `.git`. Configure private runtime secrets, protected forecast ingestion, BUCKET and one scheduler on the approved host. Back up and plan separate browser JSON and R2 history transfers with rollback. Define history retention; do not delete old cloud data. Verify exact hosted source, completed refresh, durable readback and provider freshness separately after authorization.

Wave Scale is educational only. General ratings and windows do not establish safety or personal suitability; daylight/local tide response remain unknown. Physical-device, calibration and hosted validation are acceptance gaps, not promises of existing functionality.

## Changed files

- `README.md`
- `SURF-v0.11-Migration-Handoff.md`
- `docs/map-performance-v11.json`
- `docs/scheduled-refresh.md`
- `docs/v11-architecture.md`
- `docs/v11-checks.txt`
- `docs/v11-screenshots/wave-scale-desktop.jpg`
- `docs/verification-v11.json`
- `docs/wave-scale-future.md`
- `scripts/benchmark-map.mjs`
- `scripts/verify-worker.mjs`
- `src/App.tsx`
- `src/components/ForecastEvidence.tsx`
- `src/components/ForecastMap.tsx`
- `src/components/SourceMeasurement.tsx`
- `src/components/SurfWindowTimeline.tsx`
- `src/components/WaveScale.css`
- `src/components/WaveScale.tsx`
- `src/education/waveScale.ts`
- `src/map/SpatialLayer.ts`
- `src/pages/ForecastPage.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/OceanForecastPage.tsx`
- `src/services/homeDecision.ts`
- `src/services/measurementStatus.ts`
- `src/services/windowModel.ts`
- `src/style.css`
- `src/tests/v11.test.ts`

## Export and preservation

`surf-source-v0.11.zip` contains all current source, tests, public assets, lockfile, configuration and documentation, including this report. It excludes dependencies, generated builds, Git internals, secrets/private environment files and internal browser backups. `V11-SOURCE-MANIFEST.json` records byte sizes and SHA-256 for every included file and preserved checkpoint hashes; ZIP CRC and file/hash matching are verified before delivery. A source ZIP does not transfer user browser records, hosted cache/history, credentials or Git history. Keep all earlier recovery/final ZIPs unchanged.
