# v0.6 surf rating — provisional rules

The original `calculateSQI` and `evidenceQuality` algorithms, their weights, tests and Personal Match/board logic are retained unchanged. `src/ratings/` is a separate public classification and reliability layer. It accepts no user profile or board inputs. It does not estimate breaking height from offshore values.

## Pipeline
1. Normalize provider data using existing adapters.
2. Assess all five original factor inputs, extra essential marine measurements, and verified local context. Missing required inputs produce UNRATED with no numerical score or reweighting.
3. Evaluate supported wave potential from the existing swell-alignment and break-size factors. Environmental inputs use the existing supported wind, tide and organization factors; no unsupported swell-interference factor is synthesized.
4. Keep the original weighted SQI as the transparent provisional baseline.
5. Apply documented interaction caps to prevent favorable independent factors compensating for severe limitations.
6. Classify the resulting numerical score using the requested vocabulary.
7. Generate explanations from actual factors/caps and assess reliability separately.

Bands: POOR 0–24, WEAK 25–39, SURFABLE 40–54, NOT BAD 55–64, SOLID 65–74, GOOD 75–84, FIRING 85–94, EPIC 95–100. These product thresholds do not establish accuracy.

## Interaction caps (unvalidated product hypotheses)
- The lesser of swell-alignment and break-size factor below 25 caps at 39; below 40 caps at 54.
- Wind factor below 25 caps at 39; below 40 caps at 64.
- Organization factor below 40 caps at 54.
- Tide factor below 25 caps at 64.
- EPIC also requires retrieved inputs, HIGH evidence-based reliability, swell and size factors >=95, wind >=90, tide >=85, organization >=90. Otherwise a baseline >=95 is capped at 94, with the reason visible.

These caps are conservative product rules, not fitted coefficients or an ocean model. There is no current evidence validating their predictive performance. The baseline and caps are both visible in explanations. Existing internal Personal Match retains the original SQI baseline until the replacement has observational validation; its calculations are not silently replaced.

## FLAT and UNRATED
FLAT is separate from numerical quality. It requires an explicit reliable non-rideability evidence record at exactly the selected valid timestamp: a local observation within two hours (no more than five minutes in the future), or a documented validated nearshore model. Zero offshore height and missing data never establish FLAT. No current adapter supplies such breaking-wave evidence. The evidence contract enables future integration without claiming it exists. Simulations cannot claim observed FLAT.

UNRATED means insufficient reliable information. All three current real spot profiles remain UNRATED: no calibrated local breaking height, organization, exposure/orientation/tide suitability has been supplied. Demonstration profiles remain illustrative and receive separately labeled provisional ratings; demonstration and simulated ratings cannot be EPIC.

## Reliability (evidence rubric, not accuracy percentages)
- INSUFFICIENT: required factors/context missing or local inputs unverified.
- LIMITED: demonstration/simulation, or incomplete freshness/issue-time/calibration/performance evidence. Saved sources, retrievals over two hours old (or invalid/future), unknown issue timestamps, forecasts over 72 hours, or missing positive-sample performance records prevent higher labels.
- MODERATE: complete verified local inputs, fresh retrievals, known lead time within 72 hours and the supplied validation horizon, validated local model/performance record; stronger short-horizon observation support is absent.
- HIGH: all MODERATE requirements plus lead time <=24 hours and a matched local observation no older than two hours. No current real spot meets these requirements.

Two-hour freshness and 24/72-hour windows are configurable provisional rubric choices, not demonstrated error estimates. Retrieval freshness is never described as model issue time. A connected API does not imply reliable nearshore forecasts. Tests use explicitly fabricated fixtures for HIGH/EPIC/FLAT contract behavior, not real-world calibration claims.

`src/ocean/calibration.ts` stores the extensible calibration contract: status, local-input coverage, nearshore method, validation source/horizon, swell windows, wind/tide sensitivity, limitations and source links. Unknown fields remain null. Future observation, report, historical-verification and model interfaces are contracts only.

An explicitly zero breaking-height input without a trustworthy rideability evidence record also withholds a numerical rating, rather than allowing good wind/tide to produce favorable quality. It does not alone establish observed FLAT. Invalid out-of-range/non-finite baseline scores are rejected as insufficient data.
