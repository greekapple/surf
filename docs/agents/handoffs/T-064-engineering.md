# T-064 handoff (engineering): forecast-trust logic

Branch worktree-engineering (merged forecast-trust 19a9de8 first). Interfaces were agreed with product (T-065) by message; their seam can re-export these.

| Deliverable | Module | Notes |
|---|---|---|
| The Call | `src/services/call.ts` `callFor(spot, hour, profile, {records, bundle, nowMs})` → `{verdict: 'Go'\|'Worth a look'\|'Skip'\|'Dark', window, nextWindow, why[], basis}` | Skill ranges (our own; only the beginner 4 ft ceiling has an outside anchor, Quiver's public example), wind and rating rules are constants at the top of the file with their reasons. `why[0]` is a plain sentence ("The estimated 6–13 ft is above the beginner range (up to 4 ft)."). `window` = best run of Go (else Worth a look) daylight hours on the hour's Pacific day; `nextWindow` when Dark or today's has passed. |
| Daylight + night | `src/services/daylight.ts` (`daylightFor`, `isDark`); `ratings/adapters.ts` `rateForecast` | First/last light = civil twilight. A dark hour gets `score null`, `category 'UNRATED'`, `dark true`, explanation "Dark: no rating at night" (existing "No rating" UI works). 6:46 PM in November → Dark, next window the following day (tested). |
| Graph series | `src/services/surfSeries.ts` `surfBandSeries` | per hour: `headlineSurf` band (lo/hi, kind) + `offshoreFt` + `dark`; test asserts == headlineSurf per hour. |
| Forecast archive | `src/services/forecastArchive.ts`, `src/hooks/useArchive.ts` (called in the app store) | localStorage ring `swello-forecast-archive`: viewed spot's hours (value, method, offshore Hs, Tp, run = OUR retrieval time because the provider gives no issue time, lead), latest per spot-hour and lead bucket, throttled 30 min, ~14 days, capped. Verified in the browser (76 entries after one visit). Observations now pair with the archived prediction seen before the session (`pair.source 'archived'`), else the current run. |
| Felt right | `src/services/feltRight.ts` `logFeltRight`, `feltRightFor`; calibration | Separate store `swello-felt-right`, direction only, one signal per spot-hour. A weaker nudge on an ACTIVE calibration only: 3% per net vote, max ±15% (`calibrationMath.FELT_STEP/FELT_CAP`, our choice); it never activates a calibration. `calibrationFor` now also returns `felt {low,right,high,factor}`. |
| NWS alerts | `src/services/nwsAlerts.ts`, `nwsZones.ts`, `docs/forecast/data/nws-zones.ts` | Zones resolved from `api.weather.gov/points` (23 of 45 spots resolve to land zones; marine-zone spots borrow the nearest zoned spot within 15 km, flagged `approxZone`; the rest have none). `alerts/active?zone=…`, surf-relevant events only, 15-minute cache, dated `fetchedAt`, silent failure, generic User-Agent "SWELLO surf app" (browsers ignore it), CORS verified. Tested on a recorded real feed (a Beach Hazards Statement for San Francisco, 2026-11-02). |
| Board Match period | `src/services/boardPeriod.ts` `periodFit` | Our own thresholds, labelled. |
| Rating distribution | `docs/forecast/RATING-DISTRIBUTION-T064.md` | Daylight, 45 × 72 h: largest category NOT BAD 62.1% → 40.0%; SOLID+ 19.4% → 9.1%. The re-centre (50 + 1.5 × (raw − 64)) is our own normalisation. |

## Verified
tsc, 348 tests (new: call, archive-felt, nws-alerts, daylight, boardPeriod), build; browser: journeys 8/8, t045, t047, t055, t059, t060, density all pass.

## Honest limits
- Skill ranges, verdict thresholds, the felt-right step and the period thresholds are our own choices, not validated or a safety standard.
- 22 of 45 spots are zoned by approximation or not at all, so alerts for them are approximate or absent.
- Distribution after: still no EPIC/FIRING/GOOD; the spread comes from a normalisation, not evidence of better accuracy.
- Rating tests with fixed night timestamps now see dark hours as unrated (one fixture updated).

## Addendum: estimated breaker type
- `src/services/breaker.ts`: `breakerType(spot, hour)` → `{type: 'spilling'|'plunging'|'surging'|'unknown', xi, tanBeta, h0M, periodS, label: 'est. breaker type', basis}`. ξ = tanβ / √(H₀/L₀), L₀ = gT²/2π; classes spilling ξ < 0.4, plunging 0.4–2.0, surging > 2.0 (SUPERSEDED by T-085: the deep-water ξ₀ classes are 0.5 / 3.3) (Battjes, J.A., 1974, "Surf similarity", Proc. 14th Coastal Engineering Conference, ASCE, 466–480). H₀ and T are the hour's primary swell height and period (the offshore partition).
- Slope: `src/ocean/nearshoreSlope.ts`, only where defensible from data: the mean slope from a reviewed MOP point's measured depth to the shoreline (`docs/forecast/data/mop-slope.ts`, Natural Earth 10m coast, coarse). **Only Ocean Beach (spot-2: tanβ 0.019 = 10 m over about 525 m) has one.** Every other spot returns `'unknown'` with the reason; nothing is guessed. Linda Mar and Bolinas have only unreviewed 15 m MOP candidates. More spots need either reviewed MOP points or a sourced reef/beach slope in the profile.
- Ocean Beach comes out spilling for typical swell (ξ about 0.1–0.3), which fits a flat beach break; a mean slope says little about reefs and points, so those stay unknown rather than being estimated.
- `callFor` returns `breaker` and uses it: a plunging break at 4+ ft is a Skip for non-expert skill with the first sentence "Plunging and 6–13 ft: experienced surfers only."; plunging for an expert adds "Plunging breaker: hollow and powerful."; spilling adds "Spilling breaker: soft and forgiving." (our own rules; the plunging = hollow, powerful, experienced and spilling = gentle, beginner-friendly description follows the Surfing Online "Types of Waves" reference).
- Board Match input: `characterFromBreaker(type)` → 'soft' (spilling) | 'steep' (plunging) | null (surging or unknown), our own mapping, to replace the "wave character unknown" note where known.
- Codex review of the first three commits: no P0/P1; two P2 in `callFor` fixed (a Dark call before first light now offers today's upcoming window; windows beyond tomorrow are named by weekday instead of "tomorrow"). The reviews are in `docs/reviews/`. (Codex could not read git metadata in its sandbox for the NWS commit and the last one: "usage limit" skip.)
- Tests: 358 pass (new `breaker.test.ts`: L₀, the three textbook cases, class boundaries, unknown without slope, Ocean Beach spilling, injected steep slope plunging; call tests for the breaker rule and the two P2 fixes).
