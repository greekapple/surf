# SURF v0.10 — stabilization handoff

Status: **stabilized and verified locally; not deployed**. Date: October 20, 2026.

## 1. Preservation and release state

The recovered working tree was compared against every one of the recovery manifest's 156 project files before changes: all matched. The recovery ZIP remains unchanged (SHA-256 `40f2c8488e7e9e514eeadc93059f57473d9b5208a803a4fd6e656dd1a628ac19`). The existing source checkpoint remains present (SHA-256 `6d3935d168720278f807e5a52436c6bb07b52afbc43d71ca6b3c2b3f1fa4fa91`). Git HEAD is still `d045226d50ab1bd75cf7899a5cc41f16c843c7d1`. No reset, restore, regeneration, commit, push, migration or deployment occurred. Recovered v0.10 work was continued, not replaced with v0.9.

The full original recovery report is retained as `docs/SURF-v0.10-Recovery-Report.md`; its incomplete-build status is historical and superseded by the completed verification below. The final source ZIP is a separate artifact and does not replace the recovery ZIP.

## 2. Completed v0.10 work

- Provider request policies: single-flight requests, bounded refresh concurrency, durable failures/origin cooldowns, numeric/HTTP-date Retry-After, conditional validation, bounded payloads, explicit stale fallbacks and regional time-coverage clipping.
- Data-health and forecast-evidence panels: original retrieval/issue/valid metadata, cache age and availability separated from surf quality/reliability. Same-origin service-cache diagnostics are read-only and do not include separate direct browser retrievals.
- Map 2.0: Leaflet/native grids retained, reorganized controls, collapsible legend, independent heatmap/arrows/flow/markers, opacity, local valid times, exact-hour playback/speed/loading states, responsive expandable spot sheet and bounded frame caching.
- Contiguous offshore-potential windows with minimum/peak scores, record counts, full start/end dates, wind/swell changes and stated unknown daylight/local response. No precise personal/safe-surf claim is added.
- Local verification workbench with measurement-compatible matching, deduplication, MAE/bias/count/period/lead-time groups/coverage/missing-rate. No automatic live matching or calibrated accuracy claim.
- Compact immutable retrieval snapshots/history references and an uncalibrated Ocean Beach evidence registry. Existing history, provider semantics and local data formats retained.
- README, nonsecret `.env.example`, architecture/migration guide, verification schema and schedule verification boundary completed.

## 3. Stabilization fixes after recovery

1. A 503 with a long Retry-After now defers durably rather than retrying before the allowed time.
2. Malformed upstream JSON is classified invalid-payload and does not receive a transient-network retry.
3. The local preview explicitly reports temporary memory storage as `persistent:false`.
4. Verification excludes backfilled forecasts retrieved after their valid time, even with an earlier nominal issue time; future-issued metadata is rejected. Invalid JSON roots have plain error messages.
5. Forecast evidence no longer counts invalid/future retrieval times as fresh.
6. Surf-window end labels show their dates, and counts say hourly records rather than imply elapsed duration.
7. Selected markers have enough narrow-map pan padding for their labels; selected-panel summary contrast is explicitly light on dark.
8. App identifies this local implementation as v0.10. No Quiver redesign, saved-board model change or new dependency was introduced.

## 4. Test and build results — local only

| Check | Result |
| --- | --- |
| Recovery working-tree comparison | 156/156 project files matched before edits |
| Full automated suite | **123 passed, 0 failed** (119 recovered tests plus 4 stabilization regressions) |
| TypeScript | Passed |
| Vite production build | Passed; 115 modules |
| Worker bundling | Passed; 20 embedded assets |
| Generated Worker smoke | HTML, hashed JS, SPA/API, missing assets, R2 manifest and revision passed |
| Temporary QA page | Removed; generated Worker returns 404 for v0.9/v0.10 QA paths |
| Browser desktop/narrow layout | Functional checks passed with limitations below |
| Hosted deployment/readback | **Not performed** |
| Scheduled execution | **Not reverified** |

`docs/local-verification-v10.json` records exact scope and observed values. `npm run build` completes the Worker step, not merely Vite. The build intentionally leaves `dist/server/` and `dist/.openai/` because assets are embedded in the Worker. No rebuild or extra feature task is running at handoff.

## 5. Browser verification and screenshots

Desktop browser: viewport width 1363 px, page width 1348 px (no horizontal overflow). Verified heatmap off leaves arrows; arrows off leaves heatmap; keyboard opacity changes alter the actual canvas; playback advanced from noon to 4 PM and paused with matching field/spot timestamps. Bolinas selection preserved the exact shared time.

Narrow layout used a 390 px iframe, yielding a 375 px content viewport after its scrollbar. Page width was 375 px. Verified separate layers, next-hour selection, Linda Mar spot details at that time, expanding the below-map sheet, wind heatmap/arrows/animated flow, and missing-frame removal beyond the snapshot dates. Selected label bounds after the padding fix were x=228..344 within map x=17..358. This verifies CSS at a narrow viewport, **not physical mobile or touch gestures**. No sustained frame-rate/memory benchmark is claimed.

Full-page screenshot capture and some input dispatches timed out in the browser infrastructure. We used bounded keyboard/DOM checks and successful viewport captures; did not repeatedly restart verification. Screenshot review exposed the dark-summary contrast regression, which was corrected and rechecked (computed text color rgb(240,248,242)).

- `docs/v10-screenshots/map-desktop.jpg`: final desktop view after contrast correction.
- `docs/v10-screenshots/map-mobile-qa.jpg`: narrow mobile QA view; captured before the minor final marker-padding/contrast correction. Corrected marker bounds were subsequently verified in the narrow layout. It should not be described as physical-device proof.

## 6. Provider reliability findings

Earlier hosted v0.9 evidence reported weather HTTP 429s and regional failures/timeouts/404s. The exact origin of the hosted rate limit remains unresolved; shared infrastructure or quota is not asserted as a proven cause. Regional metadata access alone never proves numerical retrieval. Time-coverage clipping addresses an observed request mismatch but does not guarantee endpoint reliability.

In the current browser preview, point conditions loaded, connection UI reported 10 available and 1 partial, and buoy fallback remained labeled saved historical. Regional direct browser access was unavailable; genuine dated WW3/GFS snapshots rendered with provider/retrieval/valid time labels. Wave field had 61 valid native cells; GFS field had 81. Selecting October 26 removed the field with an explicit expired-snapshot explanation; no timestamps were shifted. Three-hourly wind field time is displayed separately from selected hourly spot time.

New protections are covered by deterministic failure/cache tests, including durable 429 origin cooldown, transient retry bounds, timeout stale fallback, ETag/304 timestamp preservation, long 503 Retry-After, malformed JSON, read-only diagnostics and local persistence labeling. These are software resilience tests, not proof that a fresh hosted provider run succeeds. Provider retries remain limited; no manual hosted refresh was attempted.

## 7. Live/hosted/scheduler boundary

**No publication, hosted POST refresh, cloud forecast-data overwrite, scheduler change, Git commit or push occurred in this pass.** The existing private Site is not claimed to serve v0.10. Earlier v0.9 deployment and cache evidence remains historical.

The six-hour schedule is retained as documented. Configured/enabled, executed, successfully completed, persisted and serving fresh data must be checked independently after a future authorized deployment. This session did not reverify those steps or create duplicate schedules. Local preview's temporary memory bucket is explicitly not durable R2. Read-only diagnostic access is not a refresh/persistence proof.

## 8. Nearshore and measurement findings

CDIP SF023 remains modeled nearshore significant wave height, representative point 37.74811, −122.51886, approximately 10 m depth, normal 263.49°, QC primary flag 1 accepted. It is not breaking-wave height or an independent surf observation. Existing unit normalization and QC tests pass. No nearshore conversion coefficient was invented.

Official references already reviewed in the v0.10 work: CDIP MOP SF023 information and CDIP data-access/THREDDS documentation; NOAA NWPS description and NWS San Francisco marine guidance. They support continued investigation, not a claim that a new NWPS numerical adapter or beach-specific bathymetry has been integrated. Product-specific cadence/issue/resolution/license/representativeness beyond verified SF023 metadata still needs review before adding a new source. SM406 remains a Pacifica reference north of Linda Mar; it is not silently assigned to Linda Mar. No new verified Bolinas transect or local tide-response profile was added.

## 9. Verification metrics and limits

The workbench calculates errors only for reviewed compatible imported records; **no real-world live MAE, bias or accuracy percentage is reported**. Tests confirm arithmetic using synthetic fixtures. Matching requires same quantity/unit/reference, <=5 km, known depth within 1 m, valid times within 10 min and accepted quality. Forecasts must have been retrieved in advance. Unknown issue time leaves forecast lead time unknown. Offshore buoy Hs is never compared with breaking face height as the same quantity.

Coverage/missing rates describe only the submitted dataset; observation independence, representativeness, duplicate/conflicting observations, sample size and horizon stratification need review. n<10 warns too few; n>=10 is still exploratory. No calibration fit or automatic archive pairing was added. See `docs/forecast-verification.md` for the full schema/policy.

## 10. Migration readiness and remaining debt

The source, dependency lockfile, conventional React/Vite frontend, portable Worker, public environment example and reproducible commands are ready for developer handoff. **Migration is prepared, not performed.** User board/photo/favorite JSON and hosted R2 history are separate data exports; source alone does not include them or platform secrets. Existing hosting identity must not be copied into a new deployment blindly.

Remaining work: authorized hosted v0.10 acceptance; repeated weather/grid reliability evidence; observed successful scheduled refresh plus independent readback; physical touch/device and pan/zoom/playback checks; sustained map performance measurements; distributed cross-isolate request coordination if needed; reviewed history retention and archive-to-verification normalizers; compatible independent observation pairs and scientific local calibration. Sophisticated personal/daylight/session planning remains deferred. Wave Scale stays documentation only. No cameras or wearable features were added.

Recommended v0.11 order: (1) hosted operational evidence and rate-limit diagnosis; (2) physical-device map checks/performance; (3) compatible verification datasets and history retention; (4) one reviewed Ocean Beach local calibration study; (5) personalization/daylight planning only after supported data exists.

## 11. Changed files

The inventory below includes the recovered v0.10 work and this stabilization/documentation pass. It is relative to the original base commit; no commit was created.

```text
.env.example
README.md
docs/SURF-v0.10-Recovery-Report.md
docs/forecast-verification.md
docs/local-verification-v10.json
docs/scheduled-refresh.md
docs/v10-architecture.md
docs/v10-handoff.md
docs/v10-screenshots/map-desktop.jpg
docs/v10-screenshots/map-mobile-qa.jpg
scripts/build-worker.mjs
scripts/verify-worker.mjs
services/forecast-service.mjs
services/provider-policy.mjs
src/App.tsx
src/components/DataDiagnostics.tsx
src/components/ForecastEvidence.tsx
src/components/ForecastMap.tsx
src/components/MapTimeControls.tsx
src/hooks/usePlayback.ts
src/hooks/useSpatial.ts
src/map/MapCanvas.tsx
src/map/spatial.ts
src/ocean/localCalibration.ts
src/ocean/openMeteo.ts
src/ocean/pipeline.ts
src/ocean/server.ts
src/pages/HomePage.tsx
src/pages/OceanForecastPage.tsx
src/pages/ProfilePage.tsx
src/services/verification.ts
src/services/windowModel.ts
src/style.css
src/tests/service.test.ts
src/tests/v10.test.ts
vite.config.ts
```

## 12. Reproduce and continue

```sh
npm ci
npm test
npm run build
node scripts/verify-worker.mjs
npm run dev
```

Use Node 24+. Read `docs/v10-architecture.md`, `.env.example` and `docs/scheduled-refresh.md` before configuring another host. Retain the recovery backup and source checkpoint. Review this local release candidate and obtain user approval before any deployment, cloud forecast-data write or Git-history mutation.
