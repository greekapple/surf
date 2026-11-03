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
