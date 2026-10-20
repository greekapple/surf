# SURF v0.10 Recovery Report

Snapshot date: 2026-10-20T17:23:07.541489+00:00. This is a recovery backup of unfinished v0.10 work, not a completed release.

## Preservation and source state

The source was recovered at `/workspace/sites/surf-assistant` after workspace access returned. Base commit: `d045226d50ab1bd75cf7899a5cc41f16c843c7d1` (the v0.9 source). The ZIP contains the current working tree, including all 22 modified or new v0.10 files; it is not a checkout of the older commit. No reset, revert, regeneration, source overwrite, feature implementation, push, or deployment was performed for this backup.

All available source, public data assets, configuration, package lockfile, documentation, and tests are included. `.env.example` and `.openai/hosting.json` are included. Git internals, dependency folders, generated build output, private environment files, credentials and temporary caches are excluded. Browser-saved boards/photos/preferences and hosted R2 cache/history are separate from the source and are not contained in this ZIP. Preserve those in place; browser data can be exported using Personal → Data management → Export JSON.

## v0.10 improvements present in the working tree

- Provider policy: durable HTTP 429 cooldowns including Retry-After, provider-origin backoff, request deduplication, serialized point-provider refreshes, bounded regional concurrency, conditional requests, bounded transient retries and stale-data retention.
- Regional request clipping against dataset time coverage, original valid/retrieval timestamps and missing-field behavior.
- Read-only provider diagnostics endpoint and Personal development tools panel; forecast evidence/freshness explanation.
- Map 2.0 control placement, collapsible legend/display controls, responsive selected-spot panel, exact-time controls, playback speed and waiting states. Independent heatmap/arrows/flow/markers and opacity remain.
- Bounded normalized spatial-frame cache and delayed loading during rapid time selection.
- Contiguous forecast-window grouping, reasons, wind/swell changes and explicit daylight/local-calibration limitations.
- Local-only verification JSON import and compatible-measurement matching with MAE, signed bias, sample count, period, lead-time groups, coverage and missing-data rate.
- Calibration framework with no active invented coefficients; CDIP Ocean Beach remains modeled Hs at approximately 10 m depth, not breaking-face height.
- Compact immutable forecast snapshot references added to refresh history; legacy history retained.

These are source-level changes, not claims of completed browser or hosted acceptance testing. Quiver showroom source, board model and localStorage format were not changed by the v0.10 edits.

## Test and build evidence

The last completed automated test run in this conversation passed **119 tests, 0 failed**. That run used this v0.10 working tree. TypeScript checking and the Vite production frontend build then completed successfully (115 modules transformed); the final Worker-bundling command did not return a confirmed terminal result before the session became unavailable. The old process session is no longer addressable. A complete final production build is therefore **unverified**, not reported as passed. No new feature tests or build tasks were started for this preservation request.

Browser attempts timed out or were interrupted. No v0.10 desktop/mobile screenshots or responsive interaction results were obtained. Earlier v0.9 QA evidence is historical and must not be presented as v0.10 verification.

## Incomplete tasks and known issues

1. Finish and review v0.10 migration architecture/setup/verification documentation, including updating `.env.example`. Existing README still describes v0.9 and earlier releases.
2. Re-run the complete production build and validate the generated Worker once development is explicitly resumed.
3. Perform desktop/mobile map checks: control overlap, pan/zoom, independent toggles, exact timestamps, missing frames, playback pause/resume, and return to Forecast. Physical-device checks remain pending.
4. Recheck deployed refresh, persistent cache readback and provider diagnostics after a future authorized deployment. No v0.10 deployment has been completed.
5. Weather has previously returned HTTP 429 from the hosted Worker. Regional wave requests previously timed out or returned 404; metadata access alone does not prove numerical-field integration. Reliability protections reduce retries but do not establish that provider outages are solved.
6. The existing six-hour automation is configured/enabled. A prior conversation recorded a run and newer cache, but the latest attempted run-details lookup did not return. End-to-end scheduled success is not freshly verified here. No duplicate schedule was created or schedule changed.
7. Breaking-wave calibration remains unavailable. No Ocean Beach coefficient may be transferred to Bolinas or Linda Mar. Pacifica SM406 must not be relabeled Linda Mar.
8. Verification has no established compatible live observation pairs; the workbench is a foundation. No real-world MAE or forecast-accuracy claim is supported by the available project evidence. Review representativeness, matching independence, sample sizes, history retention and import validation before scientific use.
9. Surf windows are experimental offshore opportunities; daylight and local tide response remain unknown, and they are not personalized safety or board recommendations.
10. Review the partial implementation before migration; no migration or GitHub synchronization was performed.

## Stalled runs and cancellation

Several earlier tool calls were explicitly returned as aborted by the user. The previously recorded build session cannot be found by the execution tool. Current process enumeration failed, so no specific live process was safely identified for termination. This assistant has no control here to cancel other ChatGPT development runs or clear their UI counters. **No run was claimed cancelled and no unknown or genuinely active process was killed.** No earlier development task was restarted. Feature development remains paused.

## Recovery and use

Keep this ZIP unchanged as the recovery snapshot. Unzip into a new directory, inspect the report and hash manifest, then use Node 24+ with `npm ci`, `npm test`, and `npm run build` when ready to resume. Do not overlay it onto the original project or clear browser storage. Retain the existing Site identity only when continuing that exact private Site; do not publish a duplicate or migrate as part of recovery.

## Working-tree inventory at snapshot

```text
 M scripts/build-worker.mjs
 M services/forecast-service.mjs
 M src/components/ForecastMap.tsx
 M src/components/MapTimeControls.tsx
 M src/hooks/usePlayback.ts
 M src/hooks/useSpatial.ts
 M src/map/spatial.ts
 M src/ocean/openMeteo.ts
 M src/ocean/pipeline.ts
 M src/ocean/server.ts
 M src/pages/HomePage.tsx
 M src/pages/OceanForecastPage.tsx
 M src/pages/ProfilePage.tsx
 M src/style.css
 M src/tests/service.test.ts
?? services/provider-policy.mjs
?? src/components/DataDiagnostics.tsx
?? src/components/ForecastEvidence.tsx
?? src/ocean/localCalibration.ts
?? src/services/verification.ts
?? src/services/windowModel.ts
?? src/tests/v10.test.ts
```

## Backup verification

`BACKUP-MANIFEST.json` contains the SHA-256 and byte size of every captured source file plus this report and base commit metadata. Every archived entry was read back, checked against its expected bytes, and the ZIP CRC check completed before handoff. A source stability check verified that the captured project files were unchanged while packaging. This verifies the backup bytes, not application behavior or an external cloud cache.
