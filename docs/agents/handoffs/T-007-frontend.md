# T-007 frontend handoff
## Files changed
- src/features/forecast/ForecastView.tsx: new `Nearshore` panel (Forecast overview and Swell section, before the swell card); D3 buoy values each show "observed <own time>".
- src/utils/waveHeight.ts: `canPresentBreakingEstimate` guard and `nearestNearshore` (30 min tolerance, now ±24 h, never extrapolates). `WaveMeasurementKind` reused, no parallel type.
- src/ocean/bridge.ts: `confidence:'Unrated'`, `updatedAt:'Not supplied'` (D2). src/models/index.ts: `confidence:'Demo'|'Unrated'`.
- src/tests/t007.test.ts (3 tests). docs/agents/CONTRACTS.md (data honesty).
## confidence / updatedAt consumers
Grep of src: no UI or test reads `Forecast.confidence` or `Forecast.updatedAt`. Only definitions/producers: models/index.ts:11, data/demo.ts:22 (stays 'Demo', static dataset), bridge.ts, services/provider.ts (`RawMarineInput.updatedAt`, unrelated type). tests/ratings.test.ts matches are `SourceInfo.updatedAt`. No existing test changed.
## Results
tsc 0 errors; npm test 133/133 (130 + 3); build OK; swello-qa 72/72 exit 0. Console errors: only known NDBC CORS.
## Finding for lead (not fixed, file not owned)
`formatWaveHeight` still renders a `breaking-estimate` with no range/method as a point (src/tests/quiver-v9.test.ts:16 asserts that `representation==='point'`). I added the guard and tests but did not enforce it inside the formatter; enforcing needs that one assertion changed to 'unavailable'. Caller features/forecast/model.ts:25 passes a raw face value as breaking-estimate (only when availability.face; never in retrieved Open-Meteo data).
## Screenshots (playwright-toolkit/swello/artifacts/T-007/)
ob-/bolinas- {1440,390} x {light,dark}.png (full page), ob-*-far.png (hour beyond +24 h), panel-in-*/panel-out-* crops. Viewed: 390 dark panel (in-window), 1440 light panel (out-of-window). No horizontal overflow in any of 8 shots.
## Behaviour / not verified
- CDIP returned data live (HTTP 200, hourly, last record about now-1h). The nowcast ends near "now", so the default selected hour (next hour) shows the empty state "No CDIP nowcast record for the selected hour..." with a "Go to latest nowcast hour" button; after clicking: Hs 5.0 ft, Tp 14.3 s, 262 deg W, valid Wed 9:00 PM PT. Future hours are never filled.
- Bolinas shows "No nearshore model for this spot." Linda Mar not screenshotted (same branch).
- Demo mode (live=false) of the panel not screenshotted. Sources card layout at 1440 dark and Bolinas full-page shots saved but only skimmed. Keyboard/contrast not formally audited (uses existing tokens/classes).

## Correction cycle 1
- Guard enforced in `formatWaveHeight`: `breaking-estimate` without a method and a valid range (finite, >=0, low<=high) gives 'Unavailable'. Single shared `validRange`. Callers checked: only `features/forecast/model.ts:25` (breaking-estimate only when `availability.face`; absent in live data; demo uses 'demonstration'); it falls back to "—" if ever hit. `headlineHeight` has no non-test callers. `src/tests/quiver-v9.test.ts:16` edited: the method-less breaking estimate assertion 'point' -> 'unavailable' (it encoded the old rule).
- `nearestNearshore` rejects NaN `nowMs`. New `nearshoreView` (exact / latest / before-first / gap / outside-window / no-data).
- Panel default state: latest in-window record shown with "Latest nowcast · Valid <date time PT> (2 h before the selected hour). Not the selected hour's value." Button selects the nearest series hour within 30 min of that record (hidden if none, or already selected). Before first record or in a gap: message, no numbers. Demo mode: "The nearshore model needs retrieved data; none is loaded in demonstration mode." (code-reviewed only; not seen in a browser).
- SF023 id, model name and depth now derived from `coastalCoverage`; chip explanation moved into visible text; grid is auto-fit.
- Buoy: values show weekday, day and time; "Saved snapshot, 9 days old. Not current conditions." appears when the youngest value is over 6 h old (verified live: "Mon 19 9:50 PM", "9 days old").
- Results: tsc 0; npm test 135/135; build OK; swello-qa 72/72 exit 0. Screenshots: swello/artifacts/T-007/c1-{default,after}-{1440-light,390-dark}.png, viewed; layout clean, no overflow.
