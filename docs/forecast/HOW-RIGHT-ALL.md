# "How right we've been" for every spot (round 4C)

Before: only the 45 California spots with a CDIP MOP point were scored ([HOW-RIGHT.md](HOW-RIGHT.md)); the other 447 said "not in today's check", and nothing recorded what we had forecast or rated for them. Now every one of the 492 spots is captured every day, and every spot with an eligible buoy is scored. California keeps its MOP check and gains the offshore lines.

Code: `src/services/howRightAll.ts` (rules, scoring, words), `src/ocean/scoringBuoys.ts` (the buoys, eligibility), `services/how-right-all.mjs` (the Worker job), `src/features/forecast/HowRight.tsx` (the page). Tests: `src/tests/how-right-all.test.ts`.

## What is captured (every day, all 492 spots)
`howright/v2/shown/<UTC date>.json` (about 2.2 MB a day, kept 35 days):
- per spot: the Open-Meteo **marine** hours (Hs, swell and secondary swell height, period, direction, sea temperature) and **wind** hours at the app's own points, for the next 48 whole hours, with the providers' units; and **the app's rating of each of those hours** (`rateForecast` on `normalizeOpenMeteo`, the page's engine, no dark mark);
- per buoy a spot is scored against (34 today): the marine forecast at the **buoy's position**.
A spot with a fresh cached copy (the hot ones: marine at most 6 h old, wind at most 4 h) costs two R2 reads and no Open-Meteo call (`source: "cache"`); every other spot gets one marine and one wind fetch (`source: "fetched"`), ten locations per request. The object is its own cursor: a tick fills the spots still missing, so a tick that runs out of budget loses nothing.

## Which buoy
The nearest **open-ocean** buoy within **100 km** whose bearing from the spot is **inside the spot's sourced swell window** (spot profile). No sheltered buoy (Kaneohe Bay, Long Island Sound, Massachusetts Bay, Chesapeake, Great South Bay, Cape Cod and Buzzards Bay), no borrowing. Universe: the 54 NDBC buoys the realtime2 archive keeps (positions: the app's context buoys, NDBC activestations.xml 2026-11-10 for the rest); CDIP twins of an NDBC buoy are scored through the NDBC feed because it carries the swell split. A spot with no window, no buoy in reach, or none that sees the same sea says so with the reason. Today **194 of 492** spots have a buoy; 298 say why they do not: 116 have no wave buoy within 100 km, 120 have buoys in reach but all lie outside the spot's swell window, 62 have a buoy in reach but no sourced swell window to test it against. Three buoys (41029, 41033, 46235) have no realtime `.spec` file (404, 2026-11-10) and are not offered to any spot (`NO_SPEC_FILE`).

## What is compared (7 and 30 days, hours whose shown copy is at least 12 h old)
1. **Offshore forecast vs buoy**: the forecast at the buoy's position against the buoy's measured total Hs (NDBC `.spec`), and, where NDBC publishes a swell partition, swell height, period and direction (hours above 0.5 m). Typical error = median |forecast − measured|; lean = mean(forecast − measured).
2. **Rating vs the rating from the buoy's readings** (not "measured": it is our engine fed the water at the buoy, not at the break): the rating we showed against the **observed-fed** rating, the same engine fed the buoy's Hs and published swell (primary swell, no secondary) and the wind of the spot's shore station where one reports (IEM ASOS or NDBC, within 4 km, the existing assignments), the shown forecast wind otherwise. The observed-fed rating is judged at the same `now` as the shown one (`ratedAt` of its capture tick), so both share the lead-dependent ceiling. Daylight hours, median per local day, compared in bands: "6 of 7 scored days within one band". A buoy with no swell split is not used for the rating. The page names the wind: "(+ HAF wind)", "(+ HAF wind for 6 of 40 hours, our forecast wind for the rest)" or "(+ our forecast wind)", with the reason when a station's data could not be fetched.

**Never a number from a thin sample:** fewer than 3 days of paired data (a day = at least 12 paired hours) shows "collecting: N days so far"; the 30-day figure needs 14 days.

## Words (one function per line: `offshoreLine`, `ratingLine`)
- "Offshore wave height at the buoy (not surf at the spot): Hs forecast at buoy 51201's position (Waimea Bay) vs the buoy, 18 km from this spot: typical difference 0.4 m, ran 0.3 m low (last 7 days); last 30 days: …"
- "Rating vs the rating from buoy 51201's readings (+ HAF wind), offshore, not at the break: 6 of 7 scored days within one band (last 7 days, daylight hours); 1 day we showed a better band."
- "…: collecting: 1 day so far (we need 3 before showing a number)." (the rating line prints its own scored-day count)
- "No offshore check: <reason>." and, when the buoy's data could not be fetched today, "Offshore check skipped today: buoy X's data could not be fetched. Last check (2026-11-09 UTC): …" (the history is kept).
- "Typical difference" is the median absolute difference on both this line and the California MOP line; lean rounds in the person's unit ("ran 0.0 m" reads "no lean").
- Dates on the details view are UTC (captures and the card are UTC days). The swell split needs the same minimum days as the height ("too few hours" otherwise); the 0.5 m floor applies to period and direction only. The model cell Open-Meteo returned for the buoy's position is stored and its distance from the buoy is stated.

## Schedule
`20 0-6 * * *` (hourly 00:20–06:20 UTC, own invocations): while today's capture is incomplete a tick captures; once complete, **staged scoring**: a stage takes 70 of the 195 spots that have a buoy, keeps a partial in `howright/v2/_score-partial.json`, and the stage that finishes the list writes `howright/v2/scorecard.json` (about 200 KB, served by `/api/how-right-all`); then ticks are a one-read no-op (`howright/v2/_status.json`). A stage reads the last 31 captures ONE AT A TIME, newest first, keeping only the compact pairs of its spots (an hour is claimed by the newest old-enough capture, so streaming gives exactly the same pairs as holding them all).
- **Batch isolation:** when a batch of 10 locations fails, its members are retried singly. A spot or buoy that fails 3 ticks in a day is set aside: listed in `_status.json` (`excluded`, `fails`) and left out of the "complete" test, so one bad point cannot block scoring.
- Every R2 read that throws (status, capture, card, partial) aborts the tick before any write; the status is never rebuilt from nothing.

**Measured on 31 synthetic days of full captures (492 spots, the real engine), `node --expose-gc scripts/how-right-all-measure.mjs`:** one score in a single invocation was 14 s of CPU (the cron limit is 30 s) and held up to 32 parsed captures (+101 MB when all are held); staged, a stage is 7.6 / 5.8 / 5.8 s of CPU (3 stages, 47–57 subrequests each) with at most one parsed capture at a time (19 MB peak above baseline). The staged total is 19 s because each stage re-reads the captures.

## Open-Meteo budget (weighted calls a day, free tier 10,000)
Open-Meteo counts variables × models / 10, at least 1, **per location**; batching 10 locations saves HTTP requests, not quota (`docs/forecast/data/how-right-all-budget.ts`).

| hot spots | hot/cold refresh | capture (cold marine + cold wind + 34 buoy points) | total | left for visitors' on-demand cold spots |
|---|---|---|---|---|
| 0 | 0 | 492 + 492 + 34 = 1,018 | 1,018 | 8,982 |
| 100 | 4,160 | 392 + 392 + 34 = 818 | 4,978 | 5,022 |
| **150** | 6,240 | 342 + 342 + 34 = 718 | **6,958** | 3,042 |
| 180 (cap) | 7,488 | 312 + 312 + 34 = 658 | 8,146 | 1,854 |

The capture adds 1,018 calls at most (nothing hot) and falls as more spots are hot, because a hot spot's cached copy is reused. Subrequests per tick: 385 in the simulation (74 Open-Meteo requests, 150 + 150 cache reads, the writes), under the 800 stop.

## Local run on live data (2026-11-10, no deploy)
`node scripts/how-right-all-local.mjs <dir> --spots 12`: 15 spots (12 with a buoy, 3 without), 5 buoys: capture 12 subrequests (3 marine + 2 wind Open-Meteo requests), all 15 rated (0 null ratings), score 42 (5 real `.spec` files); every buoy spot says "collecting: 0 days so far", the three others give their reason. The first numbers appear 3 days after the first capture; the 30-day figure after 14.

## Known limits
- Only NDBC-hosted buoys (they carry the swell split); a CDIP-only buoy is not in the universe yet.
- 62 spots with a buoy in reach have no sourced swell window, and 119 have a window that excludes every buoy in reach (a spot facing into a bay, say). Never borrowed; the page names the reason.
- Observed wind comes from a shore station only where one is assigned (US spots, 4 km); elsewhere the shown forecast wind stands in, and the page says so.
- The rating needs the first captures to age 12 h before it can be compared; the first scored hours appear on day 2.
