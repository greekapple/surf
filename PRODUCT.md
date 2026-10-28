# SURF — Product

SURF (working future name: SWELLO, not adopted) is an independent surf forecast and ocean-data app for Northern and Central California.

## Job
Tell a surfer whether a specific break is worth paddling out, when conditions improve, and why, with every number traceable to its source and its uncertainty visible.

## Audience and scene
Surfers checking on a phone at dawn in a beach parking lot (flat fog light, cold hands, one thumb), and planning at a desk the evening before. Repeat daily use; speed of the first read matters more than discovery.

## Product truth (must never be faked)
- Retrieved mode uses real public data: Open-Meteo Marine and Weather (model forecasts), NOAA CO-OPS (tide predictions, water levels), NOAA NDBC (buoy observations), CDIP (modelled nearshore), NOAA ERDDAP (regional grids).
- Offshore significant wave height, swell, observations and estimated breaking-wave (face) height are distinct quantities. Retrieved mode has no calibrated face estimate and must say so; offshore height is never presented as surf size.
- Ratings and board recommendations are provisional, uncalibrated heuristics and are labelled as such.
- Demonstration mode is a fixed illustrative week (Oct 16–22, 2026), clearly labelled, never mixed with retrieved data.
- Quiver demo boards are fictional examples; board outlines are category approximations, not exact shapes.
- Spots with retrieved data: Ocean Beach, Bolinas, Linda Mar. Tide data comes from one regional station (San Francisco 9414290, MLLW).

## Destinations
Home · Forecast · Explore · Quiver · Wave Scale · Personal (each with sections; see `src/app/routes.ts`).

## Brand commitments
- Provisional brand SWELLO in the UI; repository, packages and hosting stay named SURF until renamed with approval.
- Visual direction: instrument-first dark UI where one selected spot and hour drive every module; credited location photography (Wikimedia Commons, licences in `src/ui/photos.ts`).
- Typography: system UI with tabular numerals; no condensed or editorial display faces.
- No teal-heavy palettes, glassmorphism, decorative gradients, or marketing slogans.

## Constraints
React 19, TypeScript, Vite 7, Leaflet; no new runtime dependencies without approval. Must work on an 8 GB Apple Silicon Mac and on phones; WCAG AA contrast, 44 px touch targets, reduced-motion support.
