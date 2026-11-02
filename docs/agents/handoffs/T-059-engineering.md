# T-059 handoff (engineering): calibrate the breaking estimate from your own observations

## API (`src/services/calibration.ts`; agreed with product)
- `logObservation({spotId, observedAt, word, quality?, note?}, env?)` → `{ok, obs} | {ok:false, error}`. `env = {records: view.mapRecords, bundle: view.ocean.bundle, nowMs?}`; without env the observation is stored but unpaired and does not count.
- `observationsFor(spotId?)` (newest first), `latestObservation(spotId, nowMs)` (same Pacific day), `deleteObservation(id)`, `calibrationFor(spotId, method?)` → `{state:'collecting', count, needed:8} | {state:'active', count, needed, ratio, iqr}`, `subscribeObservations(cb)` (+ `getObservationsSnapshot()` for useSyncExternalStore; re-reads on cross-tab storage events).
- Words map to face feet via `WORD_FACE_FT` (anchors from BODY_TICKS; overhead 8 ft and double overhead 14 ft are our mid-band values; approximate).

## Model
- Stored in the existing session log (`swello-session-log`): `SessionObservation` gained optional `word`, `faceFt`, `pair` and `quality` is now optional (quick log). Old entries still load; export (JSON/CSV) unchanged.
- Pairing at log time (past forecasts are not kept): the UNCALIBRATED headline (v2 where a reviewed MOP point has data, else v1) for the same spot and the same hour, `centralFt` = midpoint of the uncalibrated range, plus offshore Hs and primary Tp. A different hour or no record pairs nothing.
- Fit (`calibrationMath.ts`): per spot and per method, ratio = observed / model central; median, IQR (type-7 quartiles), n. Minimum **8** paired observations: below that the quartiles rest on one or two points per tail, and eight is roughly two good weeks of sessions. A product choice, not a statistical guarantee.
- At n ≥ 8 `headlineSurf` returns the calibrated range: central = ratio × model central, bounds from the IQR, floored at ±15% of the calibrated central, rounded outward. It carries `calibration {n, ratio, label:"calibrated with your N observations", uncalibratedFt}` and the method label says so. Below 8 the output is byte-identical (tested). Every surface that goes through headlineSurf (Surf card, Home, strip, callout, day cards, scale) picks it up automatically from the shared store.

## Verified
- tsc, build clean; 327 tests (9 new in `calibration.test.ts`: pairing, median/IQR, threshold 7 vs 8, per spot/method, ±15% floor, uncalibrated identical, API incl. errors, subscribe). one-source tests still pass.
- Browser: journeys 8/8, t045, t055 ALL PASS; `t059-calibration.mjs` ALL PASS: with 7 seeded observations the Ocean Beach Surf card is identical to none; with 8 it reads 3–5 ft (from 5–11) and "calibrated with your 8 observations".

## Honest limits
- Observations are the user's own, not measurements; one surfer's eye (and word mapping) is the calibration, and tide/bar/hour of day are not modelled. The ratio is a single per-spot scalar, not a per-condition model.
- A calibrated range can be narrower than the unvalidated 0.7–1.4 band; it is still not validated, and the label says "your observations".
- Observations at hours the app has no record for stay unpaired; product's UI should say so (`obs.paired`).
