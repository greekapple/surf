# Surf height by the common convention (T-077)

**User decision (relayed by the lead, 2026-11-02): "Surfer convention."** The headline is the height surfers and surf reports quote, about the nearshore significant wave height (a CDIP MOP value at 10–15 m), not the larger breaking height (about 1.3 times that for Ocean Beach swells; `OB-BIAS-T076.md`). Calibration from "What did you see?" still adjusts it per spot.

## What changed
- **v2 (MOP spots):** `centralFt` = the MOP Hs at the point for the hour. The breaking height (the same MOP height carried to where the waves break) is kept as `breakingFt` and shown only in the detail text ("breaking height about X", in the user's unit).
- **v1 (offshore swell):** `centralFt` = the offshore swell partition carried to the 10 m reference depth by linear shoaling, Ks = √(Cg₀/Cg), times the direction and shelter factors (`nearshoreFt` in `ocean/breakingEstimate.ts`; an independent calculation in `surf-convention.test.ts` agrees to 1%). Same quantity as v2, so the two methods are comparable. `breakingFt` is the old K&G breaking height.
- **Labels:** "Est. X–Y ft surf height · model estimate"; method line "Surf height (common convention: about the CDIP nearshore wave height) from the nearshore point…". Callout, spot page, Home fine print, `waveScale.ts` and the Nearshore panel updated; CONTRACTS.md and PRODUCT.md state the convention. The legacy range stored on records is unchanged and still read by Board Match (see limits).
- **Ranges** stay as T-073 built them, around the new centre. The v1 step width was re-measured for the new centre (MOP Hs ÷ v1 height p10 to p90 0.99–1.40, ±17%); the breaker-index and convention widths are carried over unchanged and marked as such.
- **Calibration:** pairs carry `basis: 'surf-height'`; pairs from the old fixed-band midpoint or from T-073's breaking-height centre are not mixed into a fit. Archive entries use `cs` and felt-right entries carry `conv`; older ones are ignored by the fit and the felt nudge.
- **Fallback order (decision):** when the nearshore model HAS a record for the hour and refuses it (swell outside the window, below the minimum period, or no breaking), the spot shows the labelled offshore height, not a v1 estimate: the offshore-swell estimate must not contradict the nearshore model (the North Jetty case: CDIP 286°, window 292.5–352.5°). v1 is the fallback only when there is no usable nearshore record (no data, missing values) and for spots without an assigned MOP point.
- **Pismo etc.:** `guideBasis` says "facing derived from coastline geometry (CDIP); swell window from published guides (Surfnerd, Surf-Forecast)…" for derived facings and no longer lists a guide for the facing.
- **Cached records** from before this change (no `breakingFt`) fall to the labelled fixed band instead of being shown as a surf height.

## Ocean Beach week after the change (context only, not truth)
Day cards (median daylight hour, with the model spread, 2026-11-03 data), Mon Nov 2 to Mon Nov 9:

| | Mon 2 | Tue 3 | Wed 4 | Thu 5 | Fri 6 | Sat 7 | Sun 8 | Mon 9 |
|---|---|---|---|---|---|---|---|---|
| Surfline (read by the lead 2026-11-02) | 8–10 | 8–12 | 8–10 | 4–6 | 8–12 | 8–12 | 6–8 | 15–18 |
| Before T-077 (breaking height, T-073) | 6–11 | 8–15 | 8–17 | 6–14 | 9–19 | 9–17 | 7–15 | 11–25 |
| After (surf-height convention) | 5–9 | 6–14 | 7–15 | 4–12 | 7–17 | 7–15 | 5–13 | 9–25 |

The centre now sits about where Surfline's does on the early days, and the Thursday dip is visible again (4–12). The ranges stay wide because the model spread and the v2-vs-v1 method difference terms still apply (and the last day's swell is large and uncertain). Widths over the 28 spots with a v2 estimate in the next 72 h (488 daylight spot-hours): median 3 ft without the model spread, 4 ft with it.

## Limits
- Whether the surf-report convention is closer to Hs at 10 m than to the breaking height is the user's decision, not something we can verify without face-height observations.
- Board Match (through `faceEstimateView`) and the rating ceiling still read the legacy breaking range: boards care about face height, but a recommendation can exceed the shown headline with no note; moving Board Match to `centralFt` is a product decision.
- The Hawaiian scale conversion is now applied to a surf-convention height: unchanged here, needs a decision.
- v1's convention height runs about 14% below MOP Hs (it uses the swell partition, MOP reports total Hs); the range does not cover that bias.
- `t043-map.mjs` and `t041-flag.mjs` in the toolkit still look for "at the break".
- Older notes (RATING-V2-PLAN, ESTIMATE-COVERAGE-T070, TASK-BOARD) still describe "Est. X–Y ft at the break"; they are historical.
