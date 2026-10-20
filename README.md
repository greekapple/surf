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
