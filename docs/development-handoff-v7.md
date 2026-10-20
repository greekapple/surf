# SURF v0.7 development handoff

This is an incremental update to v0.6, not a rebuild. Same Site identity, repository history, Leaflet, React/TypeScript/Vite, Today/Explore/Forecast/Quiver/Profile, localStorage schema, backup format, demo/experiment modes, personal matching and board engines. No new runtime dependency. No final visual redesign.

## Delivered

- Real primary swell/offshore/wind inputs produce deterministic **Provisional offshore potential**, with categories, factor math, positive/negative factors, timestamp, explicit unscored local limitations and separate LIMITED/INSUFFICIENT reliability. The three real spots are operational when essentials exist. No breaking-wave conversion or fabricated local metadata. No calibrated claims.
- Regional native WW3/GFS colored fields, arrows, optional wind animation, opacity and spot markers operate independently. Persistent `surf-map-v2` display preferences. Large map, compact floating controls, forecast preview, color legend, recenter/reset zoom, accessible navigation, shared timeline and playback.
- Browser direct spatial connection fails in this environment. **Genuine dated model snapshots** are prominently labeled and cover three days, with all original valid/retrieval times. All eight variables fetched server-side and validated. The refresh script and source metadata ship in the repo. Snapshot expiry is not hidden.
- WW3 aggregate swell is distinguished from Open-Meteo primary/secondary components. Secondary/gust/nearshore/tide spatial fields are unavailable rather than invented.
- Precise NOAA high/low station predictions alongside hourly tides. Recent genuine NDBC saved observations. Optional portable fixed-station proxy source, not deployed with this static Site.

## Setup and portability

Node 24 recommended. `npm ci`, `npm test`, `npm run dev`; production `npm run build` outputs `dist/`. Source is portable to ordinary static hosting; Sites manifest preserves existing project identity. No credentials in the export. `.env.example` documents optional public basemap/proxy configuration. Quiver/profile/favorites remain browser-local, not embedded in source exports. Use the existing JSON backup to transfer personal data.

Regional refresh: `python3 scripts/refresh-spatial.py --hours 72`, inspect successful field reports and `public/spatial/manifest.json`, rebuild/deploy. This is manual, not scheduled. Optional buoy service: see map-data-sources-v7.md; deployment and `VITE_NOAA_PROXY_URL` configuration are separate from the static frontend.

## Verification

Baseline: all 69 existing tests passed before edits; no test removed. New tests cover provisional eligibility/missing essentials/zero offshore energy, deterministic explanations, calibration labeling, exact grid timestamps/units/coordinates, wind bearing, variable selection, 3-hour frame timing, independent preference combinations, opacity/unit scales, caching/dedup/cancellation, saved snapshots, fixed-station service failure/caching and precise tide event times. Existing storage, JSON, board engines and forecast navigation tests remain.

Manual browser checks: genuine saved native raster, colors off/arrows remain, arrows off/colors remain, all overlays off then arrows re-enabled, marker toggle, actual canvas opacity via keyboard range, separate wind animation canvas and stop, mobile/desktop spot selection, time synchronization, 3-hour wind valid-time disclosure, playback, map-to-forecast retaining spot/time, saved preferences after reload, quiver two-board comparison/editor, simulation wind penalty with unchanged original map values. Responsive iframe checks at 390/768/1280 CSS widths had no page horizontal overflow (content widths 375/753/1265). These are CSS viewport checks, not physical device tests.

Real provider testing: Open-Meteo spot forecasts, NOAA hourly/high-low predictions and level observations displayed in browser. Regional eight-variable server retrieval succeeded; direct browser regional requests failed and are not claimed live. NDBC server fetch/normalization succeeded; browser still uses labeled saved snapshot. Optional proxy handler tested with mocked upstream, not deployed. Snapshot validation: 8 files, 488 actual frames, 39,528 cells. Final test count/build results are recorded in the user handoff.

## Remaining limitations and next work

- Replace manual snapshot fallback with a deployed cached regional data service/refresh job; verify production browser CORS and source availability. Never hide saved-data status or shift expired snapshots.
- Native 0.5° grids (~50 km) are regional context and visibly coarse. No higher-resolution nearshore transformation, local sheltering or sandbar model. Current coastline/exposure/tide response remain unknown; no new safety assumptions added.
- No calibrated spot rating or forecast accuracy claim. Provisional coefficients/caps are documented heuristics awaiting observed surf validation. Current unverified local inputs cap potential at SOLID; board/session suitability still needs supported nearshore information.
- Unsupported secondary-swell/gust/nearshore/tide raster layers remain explicitly unavailable. Wind 3-hour fields use their own displayed time.
- No physical mobile-device, GPU/performance benchmark or deployed optional proxy verification. Browser QA uses managed preview; native deployment success verifies publication.

Read rating-engine-v7.md and map-data-sources-v7.md for exact formulas, endpoints, provenance and licensing notes. Exact user brief retained in build-specification-v7.md; prior version documentation and tests preserved.
