# Surf Forecast Lab v0.5 — usability verification

Implemented as an incremental update to v0.4; the existing five sections, hosting identity, storage key and forecast providers remain intact.

## Interface changes
- Forecast starts with usable offshore significant height when a calibrated breaking estimate is unavailable. Local-calibration limitations remain visible, with expandable SQI factors and measurement provenance.
- Shared discrete timeline supports touch, range input, keyboard arrows and automatic horizontal selected-hour visibility. Wind and tide charts select the same exact forecast instant. No synthetic records or local ocean physics were introduced.
- Bearing compasses show where swell/wind comes from, with north 0°, east 90°. Shore relationships remain unknown where local orientation is unverified.
- Day cards summarize supplied offshore-height and wind ranges only. The regional station tide remains explicitly San Francisco 9414290, MLLW.
- Navigation retains visited page state, comparison selections, filters and scroll positions. An explicitly selected hour is never silently replaced by another spot/hour when missing.
- Today prioritizes favorites. Explore adds search, region and verified/unknown break-type filters. Comparisons use original records at one exact timestamp; available-value sorts keep unknowns last.
- Quiver has grouped editing, visible manufacturer/model, and two-board specification comparisons with differing stored values highlighted. Profile uses five accessible settings tabs and explicit backup feedback.
- Compact measurement preferences, collapsed connection diagnostics, persistent simulation banner, loading/empty messages, keyboard focus and reduced-motion styles preserve the existing visual footprint.

## Automated checks
Baseline: all 39 existing tests passed before changes.
After changes: 50 tests pass (all 39 retained plus 11 interaction-state tests), covering navigation scroll restoration, exact record/hour/day/spot selection, loading and unavailable states, unit preferences, comparison limits/empty selections, unknown-value sorting, experiment isolation and compass bearings. Existing adapter, recommendation, import validation and persistence tests remain unchanged.
TypeScript checking and Vite production build pass.

## Browser checks
Managed Chrome preview at terminal.local:4173:
- Live retrieved mode returned eight direct available connections and one explicitly partial NOAA NDBC saved-observation fallback.
- Selected a Pacific day and hour, switched from Ocean Beach to Linda Mar, and verified hero, timeline, wind and tide shared the exact selected instant.
- Selected a wind chart point and verified the shared hero/tide/time state updated.
- Navigated Forecast → Explore → Forecast → Explore; confirmed forecast time/spot, scroll position, search text and two comparison selections survived.
- Created a fictional verification board using fractional dimensions (5'10", 19 1/2", 2 3/8", 30 L). Actual normalized dimensions appeared correctly. Browser reloads retained this test board and measurement preferences.
- Compared two saved boards: differing specifications highlighted; selecting a third board disabled further comparison until one is removed.
- Changed to meters in Profile and verified offshore and tide displays and chart axes converted immediately.
- Adjusted hypothetical wave height and wind: the persistent simulation label remained visible; regional comparisons retained unaltered records. Exiting restored forecast mode.
- Confirmed Demonstration mode retained its label, seven-day sample, SQI, discrete five-hour timeline, swell components and chart controls.
- Exported a JSON backup, parsed the downloaded file (five boards), and verified feedback. Imported malformed JSON and a wrong-type profile field; both rejected the file without replacing saved data. Full valid-import validation and persistence also remain covered by the existing automated tests. No user production storage was touched.
- Responsive browser checks used same-origin frames at nominal widths 390, 768 and 1280 (content widths 375, 753 and 1265 after scrollbars). No horizontal document overflow. Mobile bottom navigation, day/time selection, selected-hour horizontal scroll, secondary swell, spot comparison and two-board comparison were exercised. Overflow stayed inside horizontal strips/tables/charts. Temporary QA page removed before publication.

## Limits
This is a usability pass, not a forecasting-model upgrade. Local breaking heights, real SQI, Your Match and real session/board recommendations remain unavailable when their verified inputs are absent. No local orientation, bathymetry, exposure or hazard assessment was fabricated. NOAA NDBC remains a browser CORS limitation with a dated saved observation, not a live feed. Responsive checks are browser frames, not tests on physical devices. Full valid backup replacement and reset were not executed in browser QA; their validation and storage paths remain covered by automated tests, and existing confirmation controls remain present.
