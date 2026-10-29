# T-011 frontend handoff

## Files changed
- `.env.development` (new): `VITE_FORECAST_SERVICE=on` plus a one-line comment. Production builds do not read it.
- `.env.example`: comment on VITE_FORECAST_SERVICE updated (dev now defaults to on).
- `src/map/spatial.ts`: `NoFrameError`. When `/api/grid` answers 404 ("No exact regional model frame at this valid time"), `loadField` no longer falls back to the browser ERDDAP call (CORS error) or the saved snapshot ("expired snapshots are not shifted" jargon). The UI now says: "Continuous heatmap unavailable: The model has no frame for this hour (beyond its forecast range or between its time steps). Point forecasts remain available." Production path unchanged except this same 404 handling, which is also correct there.

## U-02 findings
The client never requests an off-step wind time: `spatialSpec` floors wind (GFS) times to the 3-hour UTC step; swell (WW3) uses the exact hour. The `/api/grid` U-02 failure came from asking for 05:00Z directly, which the client does not do. The map label shows the actual valid time of the frame. Observed (Chrome, 1440, PT): slider Wed 9 PM -> wind "valid Wed 8 PM"; Wed 10 PM -> "valid Wed 8 PM"; Thu 1 AM -> "valid Wed 11 PM"; Thu 6 AM -> "valid Thu 5 AM"; swell labels always equal the slider hour. The only real no-frame case is the last slider position (~7 days out, 2026-11-04T23Z): API 404, previously a CORS error plus jargon, now the plain message above. Remaining gap (not fixed, outside owned files): the slider readout and the map label can differ by 1-2 h for wind; a "(3-hourly frame)" hint in ExploreView would make this clearer.

## Results per criterion (Chrome, vite on :5183 with the new env file)
1. Wind: label "Wind speed · NOAA/NCEP GFS via NOAA ERDDAP · 0.5° grid · valid Wed 11 PM" after ~0.35 s of status polling at load (slider Thu 12 AM); Swell: "Offshore Hs · PacIOOS / University of Hawaiʻi WW3 via NOAA ERDDAP · 0.5° grid · valid Thu 12 AM". No "heatmap unavailable". Both at 1440 and 390.
2. Slider: idx 3, 4 (above), last index -> plain no-frame message. Layer repaints each change (not blank).
3. Forecast Sources: NDBC 46026 observation "observed Wed 28 11:20 PM" read at ~11:55 PM (under 1 h old); page text contains no "saved snapshot". Not separately captured: the literal word "connected" on the 46026 row (other rows read "connected"; the NDBC row text was "Observation · NOAA NDBC 46026 buoy observed ...").
4. Reload: wind and swell both return to a valid frame (about 0.33 s). 390: Explore -> Forecast -> Explore (nav link) -> Wind grid shows the frame again. At 1440 the nav-link click in my script did not land on Explore (script selector), so that path was verified at 390 only; journey 4 (Explore/Forecast persistence) passes.
5. Console errors: ERDDAP/NDBC CORS errors: 0. Remaining: 4 browser "404" resource lines for `/api/grid` at the final (7-day) slider position, which is the expected no-frame answer (cannot be suppressed from the client). 0 page errors.
6. `tsc --noEmit` 0 errors; `npm test` 135 pass, 0 fail; `npm run build` ok; `swello-qa.mjs` 72/72, ERRORS 0; `journeys.mjs` 8/8 (these two scripts filter ndbc/erddap noise).

## Screenshots
`/Users/milosin/Development/ai-system-setup/playwright-toolkit/swello/artifacts/T-011/` : wind-1440.png, wind-390.png, swell-1440.png, swell-390.png, forecast-1440.png, forecast-390.png (viewed wind-1440, swell-390, forecast both). Script: `swello/t011.mjs`. Layers are four coarse colour blocks (V-01, backlog, not touched). Overflow scrollWidth equals viewport at 1440 and 390.

## Not verified
Production build against the real worker (not run); 390 full-page Forecast Sources table; swell 390 slider behaviour; the dev server on :5183 was stopped.

## Correction cycle 1
- `services/forecast-service.mjs` (/api/grid no-frame body only): added `code:'no_frame'`; status 404 and text unchanged.
- `src/map/spatial.ts`: `NoFrameError` only when the 404 body has `code==='no_frame'` or the exact legacy text; any other 404 (e.g. "Unknown endpoint"), 500, or non-JSON 404 takes the previous fallback path. `loadField` is now exported with an optional 4th param `useServer` whose default is the old condition (production behaviour unchanged).
- `src/tests/t011.test.ts` (new, 5 tests, stubbed fetch): no-frame 404 final with no snapshot/browser fetch; legacy text final; unknown-endpoint 404 falls through; 500 falls through; abort gives AbortError.
- Results: tsc 0; npm test 140 pass / 0 fail; build OK. Chrome on :5180 (no restart needed; the middleware picked up the change): `/api/grid` 404 body contains `code:no_frame`, `/api/nope` 404; last slider position shows the plain no-frame message for wind and swell; reload shows frames. Console: only the 4 expected /api/grid 404 lines.
