# SURF v0.6 — development handoff

## 1. Implemented
- Requested public rating vocabulary: EPIC 95–100, FIRING 85–94, GOOD 75–84, SOLID 65–74, NOT BAD 55–64, SURFABLE 40–54, WEAK 25–39, POOR 0–24. FLAT and UNRATED are separate classifications, not numeric bands.
- A separate deterministic public conditions layer with sufficiency checks, preserved SQI baseline contributions, conservative documented interaction caps, explainable outputs, strict evidence-based FLAT, and EPIC qualification gates. No random scores or user-profile inputs.
- Independent HIGH/MODERATE/LIMITED/INSUFFICIENT reliability rubric using input coverage, source retrieval/issue times, supported lead time, local calibration and supplied validation/observation evidence. No confidence percentages. Real current profiles remain UNRATED with INSUFFICIENT reliability.
- Extensible calibration metadata/evidence contracts; unknown local swell/wind/tide/nearshore parameters stay null. Contracts for future verification, breaking observations, reports and nearshore modeling are not integrations or validated capabilities.
- Interactive Leaflet/OpenStreetMap geographic map, lazy loaded from Forecast or Explore. Pan/zoom, keyboard spot markers, live point-value popups, selected spot previews, source inspection, shared units, map/list toggle and filters. Camera, layer, spot and time state are preserved appropriately across views; map and list share comparison selections, separately for retrieved and demo modes.
- SWELL, WIND, WAVES, TIDE selectors, available-variable/component selection, exact-record day/hour controls, previous/next and user-triggered cached-record playback. Playback pauses on close/navigation/spot change/tab hidden and ends at the final supplied record; no forecast requests per frame.
- Shared wave-height, swell-period, wind and tide graphs; all select the same timestamp. Missing measurements stay gaps. A source-unit correction for hypothetical inputs, and an explicit hypothetical swell-height slider, preserve original records.
- Rating/reliability explanations, neutral UNRATED map markers, explicit unsupported breaking-wave layer, no fake tide surface, mobile horizontal controls, selected-hour/day auto-scroll, view error boundaries and retry/empty states.

## 2. Preserved
The existing React/TypeScript/Vite application, five sections and recognizable visual footprint; Open-Meteo Marine/Weather; NOAA CO-OPS predictions and separate gauge observations; NOAA NDBC historical snapshot labeling; current hosting identity/audience; Git history; localStorage key `surf-prototype-v1`; compatible profile/board backup schemas; all saved board fields/editing/comparison; optional Personal Match; original recommendation math; favorites; original demo week and all ten demo spots; experiment isolation; measurement conventions and source details.

`src/recommendation/` and `src/utils/storage.ts` remain unchanged. Personal Match intentionally retains the original SQI baseline until the new public rating is validated. This is explained in Profile and the rating documentation; no personal factor changes general quality.

## 3–4. Actual spatial layers and fallback
No continuous gridded marine/weather overlay is integrated. The actual geographic basemap is interactive OpenStreetMap cartography, not a screenshot. Forecast layers consist of real Open-Meteo model-point readings at returned grid coordinates (or explicitly labeled request references) and one regional NOAA tide station. Directions are point vectors only. NOAA station coordinates are verified from its metadata API. No interpolation, invented nearshore heights, added swell-component heights or synthetic regional tide surface is used.

NOAA GFS Wave GRIB2 sources were investigated. A decoded, timestamp-verified, cached spatial grid/tile service still needs engineering and was not represented as complete. See `map-data-sources-v6.md` for sources and licensing.

The map covers Ocean Beach, Bolinas and Linda Mar. Other demo spots remain in the list/full forecast; unverified coordinates were not invented. Demonstration points say DEMO and cannot be mistaken for live forecasts. The demonstration tide map shows unavailable because it has no genuine station predictions. Experiment edits never enter map frames or regional comparisons.

## 5. Provisional calculations
The original five-factor SQI baseline is retained. Public interaction caps and reliability windows are product hypotheses, not observationally fitted coefficients. EPIC requires exceptional supported factors plus HIGH reliability. Neither connected APIs nor long period/offshore wind establish EPIC. No present real profile has the local evidence required to score. Zero breaking-height input without reliable rideability evidence does not manufacture a favorable rating or observed FLAT.

The full formulas, caps, gates, evidence contracts and rubric are documented in `rating-engine-v6.md`. Test-only HIGH/EPIC/FLAT fixtures are synthetic contracts, never evidence of real-world validation.

## 6. Verification
Baseline before editing: all 50 existing tests passed. Final suite: 69 tests (all 50 retained plus 19 focused rating/map cases) covering category boundaries; trustworthy FLAT and UNRATED; zero-height/out-of-range rejection; EPIC gating; reliability independence; caps/explanations; original SQI immutability; exact map frames; provider coordinates; point layers/components; missing wind/secondary/breaking data; one regional tide station; units; supplied-record playback bounds; isolated swell-height experiments; and all previous providers, storage, quiver and preferences checks. TypeScript and production Vite build passed.

Managed browser checks:
- Retrieved forecast connections loaded successfully; real markers remained neutral UNRATED and the NOAA NDBC fallback remained historical.
- Basemap tiles loaded, geographic markers were selectable by mouse/Enter, popups retained focus and source-aware summaries, zoom changed tile zoom, and keyboard panning moved the geographic view.
- Selecting Bolinas and a map time updated full forecast, map preview and charts to the exact same instant. Wind points showed actual directional readings; tide switched to exactly one station marker with its curve and source metadata.
- Unsupported breaking-wave selection showed zero data points and an explanation, retaining spot markers. No offshore substitution occurred.
- Playback advanced supplied hours, paused, and stopped at the last of 168 records. Full forecast opening retained selected spot/time and closed the map. Shared comparison selection survived map/list navigation.
- Explore search filtered geographic markers. Demo mode displayed FIRING sample ratings and explicitly labeled DEMO points, with no fabricated station tide layer.
- A 60-mph hypothetical demo wind changed the experimental public rating to WEAK, 39/100, while the original map rating remained FIRING. The persistent simulation banner and original-map notice remained visible.
- The five previously saved browser test boards and meter preferences remained after reload/navigation. Original automated storage/import/export tests remain intact. Valid backup replacement/reset was not re-executed in v0.6 browser QA; v0.5 browser export and invalid-import checks are documented separately.
- Responsive same-origin browser frames at nominal 390, 768 and 1280 pixels (content widths 375, 753, 1265 after scrollbars) showed working maps and no document-width overflow. Mobile layer, spot, day and hour selection updated the same forecast; selected day/hour auto-scroll was verified. These are browser-frame checks, not physical-device certification. Temporary responsive test page was removed before publication.

## 7. Known limits
No empirically validated nearshore model, complete local exposure/orientation/tide/organization calibration, local surf-report ingestion, historical verification archive or continuous forecast overlay exists. Consequently no real accuracy advantage, validated surf score or real board compatibility can be claimed from the current offshore-only inputs. NOAA NDBC direct browser access is still CORS limited. Public APIs and basemap tiles need internet and may be unavailable/rate limited. The default basemap is best-effort and not a production SLA. Default free Open-Meteo access is for non-commercial use. No browser data, account or secret credential is in the source export.

## 8. Dependencies and licenses
React 19, TypeScript, Vite and the retained dependency lockfile. The new runtime dependency is Leaflet 1.9.4 (BSD-2-Clause; license copied to `docs/licenses/leaflet.txt`); Leaflet/GeoJSON type declarations are development dependencies. Leaflet's JS/CSS are lazy chunks (~45 kB gzipped JS and ~6.5 kB gzipped CSS in the verified build). OpenStreetMap attribution is always visible; normal browser caching/referrer rules are respected, with no offline/bulk tile download. Optional public Vite tile URL/attribution configuration is in `.env.example`.

Open-Meteo CC BY 4.0 and free-service access conditions, NOAA source notices, basemap terms and official links are documented in `map-data-sources-v6.md`. Review access plans before commercial or large public use. No Astra-specific application runtime dependency, API secret, backend database or authentication system was added.

## 9. Run outside Astra
Use Node.js 22.18+ (Node 24 tested). Extract the source ZIP, open its `surf` directory and run:

```sh
npm ci
npm run dev
npm test
npm run build
```

Serve/deploy `dist/` for production. No API key is needed for the default personal preview. Browser CORS rules still apply; do not silently relay or relabel saved observations. Keep `.openai/hosting.json` when continuing the existing private Site; give an independent deployment its own hosting identity. Move personal browser boards/settings separately with Profile → Data management → Export JSON / Import JSON.

## 10. Recommended next development
1. Collect timestamped observed surf conditions and define a measured validation protocol before loosening UNRATED or EPIC gates.
2. Verify break-specific exposure, orientation, tide sensitivities, hazards and a defensible nearshore method with source provenance; populate calibration records only with evidence.
3. Compare archived forecasts with observations by spot/horizon and evaluate the old baseline versus provisional caps. Revisit thresholds from results rather than visual completeness.
4. Build a separate cached NOAA GRIB decoding/tiling adapter with run/time/units/grid verification before adding a continuous spatial overlay.
5. Select forecast and basemap access plans for the intended commercial load; add a supported NOAA observation relay if needed, preserving observation timestamps and source status.
6. Extend browser automation to full backup replacement/reset and run physical mobile/accessibility and slow-network checks. Undertake the dedicated visual redesign separately.
