# SURF v0.9 — Quiver Showroom 2.0

## Baseline and preservation

Built on the existing v0.8 commit `4c921a9988597f4bb281915ac1856e9a1d66c707` in the same repository/Site, owner-private audience unchanged. Before edits all98 tests and TypeScript/Vite/Worker build passed. Existing Home/Personal layouts, public ratings, map engine, forecast providers, Worker/R2 paths, raw forecast history and linked schedule retained. No user data reset. The uploaded references inform light, depth and inspection interactions; no reference artwork, manufacturer logo, exact manufacturer shape or third-party branding was copied.

## Shared domain and responsive showroom

`useQuiver` owns saved board references, selected ID, sort, modes, comparison, editing and recommendations. `services/quiver.ts` provides exact saved measurements, finite navigation, deliberate swipe handling and a bounded five-board gallery window. Desktop and mobile presentations share this owner state and BoardVisual; crossing breakpoints preserves selected board/mode. Tablet shows a gallery above its inspection panel. Compact mode remains practical and edits the same records.

Desktop: a lit marine-toned room, several category silhouettes/photos, foreground selected board, muted neighbors, subtle perspective and floor shadows. Click, arrows and jump selector navigate the actual saved collection. Inspector modes expose saved specifications, intended conditions/notes and current heuristic limitations. No heavy3D dependency.

Mobile: one large board, horizontal pointer/swipe gestures (vertical scroll retained), previous/next and dot/jump alternatives, live position, dimensions mode, expandable specs/actions sheet and compact advice. One shared board state survives resizing. Global measurement/return-to-forecast controls are tucked away only on the active mobile Quiver to free the viewing area; full preferences remain in Personal/other pages. No physical-device testing claim.

BoardVisual retains distinct category paths. Saved dimensional proportions inform illustrative aspect/relative display scale, with perspective emphasis; these are not exact board geometry. Measurement guides use saved length/width and volume. Thickness is shown numerically; no side outline is fabricated. Inch data remain canonical, cm labels follow the existing metric preference, surf-height Hawaiian convention never changes board dimensions. Photo framing uses contain without stretching.

Optional `backPhotoDataURL` is validated and optimized by the existing raster pipeline like the front photo. It is absent in older backups, no version/key migration is needed. Front/back control appears only when a user supplies the second view. There is no synthesized reverse view. Both optional photos round-trip in v1 backups; quota errors remain visible. No photos/profile data enter server forecast caches.

## Recommendation review

Retained weights and dimensional model. Corrected Medium rocker being treated like Low; Medium/unrecognized/absent rocker now uses the neutral baseline. Renamed the existing volume/bounding-box-volume term to volumeFraction: liters / (length_in × width_in × thickness_in ×0.016387 L/in³) is dimensionless; it is not an estimated paddle speed. Missing/nonfinite dimensions and invalid intended ranges now withhold advice instead of propagating NaN. Favorite contributes only to optional personal preferences, never general quality. No selection/photo bonus. Existing Saved-board specs remain the source of recommendations; local breaking height and character are still required. Scores remain experimental heuristics, not scientific match percentages.

## Wave-height presentation

`utils/waveHeight.ts` separates offshore Hs, swell, nearshore modeled Hs, estimated/observed breaking face, simulation and demo semantics. Rounded headlines use an explicitapproximation mark, with `<1 ft` for sub-foot positive values. A single offshore measurement never becomes an invented interval. Whole-number breaking ranges are supported only when an actual explicit range with a documented method is supplied; current providers do not supply a supported breaking range, so none is manufactured. Technical measurements retain appropriate precision and raw records are unchanged. Source details preserve timestamps/units. Home/Forecast/Explore/map previews/comparison/advice use shared headline rules; tide/wind values keep their existing formatting. CDIP10m-depth Hs never becomes beach surf height.

## Hosted verification and scheduling

Manual hosted check during v0.9 transition: GET health reported service0.8 and persistent:true. POST refresh and independent GET health matched attemptedAt2026-10-20T06:48:20.591Z. Service contract stays0.8 because server implementation is unchanged; app isv0.9. Marine for all three spots, NOAA tides/extrema/water level/buoy and CDIP SF023 succeeded. Weather returned429, all eight regional fields timed out. Original stale/fallback labels retained. `hosted-verification-v9.json` contains the public report. Browser weather fallback is separate from this service failure. Never advertise all providers as live.

Existing linked automation `Automation_edc85798af9881918aeacf136efe10dd` is configured/enabled at00:05,06:05,12:05,18:05 America/Los_Angeles. No new/duplicate task was created. Its inspected last_run_time wasnull: scheduled execution is unverified, despite a working manual writer and persistent readback. No token is saved in source, prompts, client variables, logs or exports. Existing saved instructions are `scheduled-refresh.md`.

## Nearshore research

Preserved verified CDIP SF023 Ocean Beach (37.74811,−122.51886; modeled depth10m, normal263.49°). Official numeric NCSS nowcast remains connected and QC-filtered. SM406 (37.63560,−122.50990; depth15m) is a Pacifica reference north of Linda Mar, not assigned to that beach. No verified Bolinas transect/depth, sheltering or breaking conversion has been added.

Rechecked NOAA official NWPS description https://polar.ncep.noaa.gov/nwps/ : SWAN regional nearshore guidance, grids described generally at1.8km–500m. This does not prove local numeric coverage or breaking height. CDIP county/product directory https://cdip.ucsd.edu/mops/ remains a research entry point. Search did not establish another spot-specific validated product for Bolinas/Linda Mar, and detail-page retrieval through search was unavailable. This is a verification limit, not proof that no such product exists. Future integration must verify exact transect/depth, license, QC, model issue/valid time and representativeness before scoring. No extra adapter was invented in v0.9.

## Map and next work

No Leaflet/grid/heatmap/arrows/flow/playback rewrite. Shared preview height formatting is the targeted readability change. Independent controls and dated native-grid fallback remain. No high-resolution fields were synthesized.

Wave Scale is specified separately in `wave-scale-future.md`; no unfinished control was added. Suggested v0.10: verify first scheduled executions and reliable weather/grid access; calibrate one nearshore-to-local approach against reviewed observations; improve permitted photo cutout/framing and measured board geometry; then inspect map labels/controls on physical touch devices. Do not add a fake camera or claim calibrated forecast accuracy.

## Verification

See `usability-verification-v9.md` for the actual browser flow results, responsive widths and screenshots. New tests cover selection/deletion references, bounded gallery, swipe versus vertical gestures, exact dimensions/units, old+new photos, rocker/missing guards and semantic height formatting. All existing tests retained. This verifies software behavior, not ocean forecast accuracy.

## Changed source files

- `README.md`
- `docs/hosted-verification-v9.json`
- `docs/usability-verification-v9.md`
- `docs/v09-handoff.md`
- `docs/wave-scale-future.md`
- `src/App.tsx`
- `src/components/BoardForm.tsx`
- `src/components/BoardVisual.tsx`
- `src/components/ForecastMap.tsx`
- `src/components/SpotComparison.tsx`
- `src/components/quiver/BoardComparison.tsx`
- `src/components/quiver/BoardInspection.tsx`
- `src/components/quiver/QuiverShowroom.tsx`
- `src/components/quiver/quiver.css`
- `src/hooks/useQuiver.ts`
- `src/models/index.ts`
- `src/pages/ForecastPage.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/OceanForecastPage.tsx`
- `src/pages/OceanRegionalPage.tsx`
- `src/pages/QuiverPage.tsx`
- `src/pages/RegionalPage.tsx`
- `src/recommendation/board.ts`
- `src/services/quiver.ts`
- `src/tests/quiver-v9.test.ts`
- `src/utils/storage.ts`
- `src/utils/waveHeight.ts`
- `scripts/verify-worker.mjs` (temporary QA page must not be published)
