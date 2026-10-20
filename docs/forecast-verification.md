# Forecast verification workbench — v0.10

This is a local development foundation. **No compatible live pairs or real-world accuracy result have been established.** Import reviewed public records through Personal → Data management → Developer diagnostics & forecast verification. Files stay in browser memory and are not uploaded or persisted by this workbench. Maximum file size 5 MB; maximum 10,000 records in each array.

## JSON contract

Top-level object: `{"forecasts":[...],"observations":[...]}`. Every record needs all fields below. IDs/provider/reference are strings. ISO UTC times must be explicit. Values are already normalized; no unit guessing occurs.

| Field | Meaning |
| --- | --- |
| `id`, `provider` | Record/source identities. |
| `kind` | `forecast` in forecasts; `observation` in observations. |
| `measurement` | `offshore-hs`, `nearshore-modeled-hs`, `breaking-face`, `wind-speed` or `water-level`. |
| `unit` | `m/s` for wind-speed; `m` for heights/levels. |
| `value` | Numeric value, or null for missing. |
| `validAt`, `retrievedAt` | Forecast/observation valid instant and actual retrieval instant. |
| `issuedAt` | Actual model issue time or null; never substitute response generation/retrieval as issue. |
| `latitude`, `longitude` | Measurement/model coordinates in degrees. |
| `depthM` | Reviewed water-depth context in meters, or null when unknown. |
| `reference` | Shared reviewed measurement/datum/context identity; nonempty for matching. For water level it must include the vertical datum; for wind review height/exposure. |
| `quality` | `accepted`, `unreviewed`, or `rejected`; only accepted records are paired. |

## Conservative matching and errors

A match requires accepted finite values, same measurement/unit/reference, coordinates within 5 km, known depths within 1 m, and valid times within 10 minutes. The nearest compatible observation is selected; data between records are not interpolated. A forecast must have been retrieved no later than valid time; model issuance, when supplied, must not be after its retrieval. Backfilled/late forecasts are excluded even when a nominal issue time is old. Unknown issue time produces unknown lead time.

Forecast identity deduplication uses provider/vintage, quantity/unit/reference, location/depth and valid time. The first duplicate is retained. Distinct vintages may legitimately evaluate against the same observation; sample independence is not assumed. Review duplicate/conflicting observations and vintage semantics before import. No automatic observation-independence or representativeness claim is made.

Error = forecast − observation. MAE = mean absolute error; bias = mean signed error. Groups are split by source, measurement, unit, reference and supplied lead-time bucket (0–24 h, 24–48 h, 48+ h, or unknown issue). Reports include count and valid-time period. Coverage = matched pairs / unique submitted forecast records. Missing-data rate = invalid/missing forecast records / unique submitted forecast records; unmatched compatible-data gaps and late forecasts are counted separately. The denominator is the imported set, not all expected regional hours.

The application labels n<10 too few for a conclusion; n>=10 still remains exploratory and does not establish statistical validity. Confidence intervals, representativeness, stratification by model run, independence, one-to-one observation policy and sample completeness require further research. The current coarse offshore beach queries and buoy do not have reviewed depth/context pairing, so they are not automatically matched.

Do not compare offshore buoy Hs with reported breaking-face height, treat a CDIP nowcast as a breaking observation, or advertise an accuracy percentage from this tool. No calibration coefficients are fitted or applied.

## History pathway

Public provider ingestion archives immutable payload snapshots with location/source/valid-time metadata inside provider payloads and original retrieval/issue metadata in envelopes. Schema-2 manifests reference them. A future reviewed normalizer can convert compatible archive records into this contract. There is no live archive browser, automatic backtest, calibration job or new cloud write from the workbench in v0.10.
