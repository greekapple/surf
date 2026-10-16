# Surf functional prototype

React + TypeScript + Vite, browser-local persistence, no runtime APIs or AI services.

## Run

- `npm ci`
- `npm run dev`
- `npm test` (Node 22+ with TypeScript stripping)
- `npm run build`

## Implemented

Five main sections; onboarding and profile preferences; 10 illustrative California spots; 3 fixed sample days at five Pacific timestamps; board CRUD, details, sorting, favorites and comparison; forecast/time and spot comparison; deterministic gated spot/time/board ranking; rule-based explanations and visible score factors; physical display units and approximate Hawaiian scale; localStorage persistence, recovery warning, backup export and confirmed reset.

The optional session log is deferred. No live providers, verified spot characteristics, catalog, accounts, or cloud database are connected. `src/services/provider.ts` contains a future provider contract. Demo dates deliberately do not follow the clock. Tail/fins are retained but unscored pending reliable model-specific relationships. No validated forecast accuracy or safety claims are made.

## Scoring

See `src/recommendation/engine.ts` and the in-app Profile page. Hard constraints precede ranking. Spot conditions and board characteristics remain separate. Display conversion never mutates canonical feet/mph inputs. Empty quivers get explicitly labeled spot-only results.

## Verification

12 automated tests cover deterministic ranking, conversions and score invariance, skill exclusions, empty quiver, large-day rejection, comfort and unknown hazards, explanations, time selection, shore-relative wind, dimensions, CRUD state persistence, and storage errors. Production TypeScript/Vite build passes. Browser QA could not run because the managed cloud browser blocked the internal preview origin.

Original specification: `docs/build-specification.md`.
