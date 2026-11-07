# How right we've been (beyond-Surfline steps 2 and 3)

Written 2026-11-07. Code: `src/services/howRight.ts` (rules, scoring, words), `services/how-right.mjs` (the daily job and `/api/how-right`), `src/features/forecast/HowRight.tsx` and `Tuned.tsx` (the Surf card). Tests: `src/tests/how-right.test.ts`, `src/tests/calibration.test.ts`. Revised after the data-honesty review the same day.

## Step 2: the line on each spot page

Three states, one line each on the Surf card (`howRightLine`):
- **Scored** (`status: 'ok'`): "Our forecast from the day before vs the San Francisco Bar buoy: typically within 0.7 ft, ran 0.4 ft high.", with a fine second line "Buoy height carried to our point SF023 by CDIP's model." The "30 days" tap opens the last 7 days and the scored part of the last 30 days (labelled "Since {date}"), a daily-mean chart ("buoy (model-carried)" solid, "our forecast" dashed), what our forecast is, which buoy and why.
- **Waiting** (`'collecting'`): a buoy qualifies but we have not kept 3 days of our own forecasts here yet. **No number**: "How right we've been: starts once we've kept 3 days of our own forecasts (kept since Nov 6)." The "Which buoy" tap names the buoy that will be used and why.
- **No buoy** (`'no-buoy'`): "How right we've been: no buoy can check this spot this month.", with the reason (no buoy within 80 km; the nearest is beyond 40 km; CDIP's model missed the buoy in reach, with by how much; or a fetch failed today, said as such).

**What each number is.**
- **Buoy (model-carried)** = a wave buoy's significant wave height on the hour (CDIP QC flag 1, or NDBC realtime2), never averaged or filled, **carried to the spot's CDIP MOP point by MOP's own hourly ratio** (point ÷ the buoy's MOP_validation site). That is the T-131 harness's "observation-anchored" height (`docs/forecast/ACCURACY-VS-BUOYS.md`, (d)): model-assisted, not a measurement at the break. It is never called "measured" on its own.
- **Our forecast** = the surf height behind our band as our server held it **at least 12 hours before the hour**: the CDIP MOP forecast at the spot's point, which is the headline's central height wherever MOP has the hour (every spot since T-130). The Worker captures it once a day at 00:30 UTC (the evening before, Pacific). Personal tuning is not included.
- **Typically within** = the median absolute difference (half the hours were closer). **Ran high / low** = the mean of ours − buoy (under 0.1 ft: "no lean"). The detail also gives the average miss (mean absolute difference) and the hours.

**Which buoy (the harness rules, rolling 30 days).** Within 40 km of the spot; at least 200 measured hours in the window; CDIP's model right AT the buoy within our limits (bias ≤ 0.5 ft, average miss ≤ 1 ft, at least 200 hours), judged on the window's first 2/3 only; the nearest such buoy with model hours at the spot's point. **Only hours after that 2/3 cut are scored**, so the hours that picked the buoy never score it (the "Since {date}" row).

**The 3-day rule.** CDIP's MOP forecast is 3-hourly (checked 2026-11-07 at SF023, SM375, L0809, D0704, SC149: 00, 03, … UTC, 10 days ahead), so 3 days is 24 paired hours. A spot is scored once it has 24 pairs in the last 7 days; any window with fewer shows "too few hours to say".

**Method note: why no nowcast score.** The first version compared CDIP's MOP nowcast at the point until our own forecasts were kept. The data-honesty review (2026-11-07, P0) removed it: with the buoy carried by the same model, nowcast − carried buoy = p × (1 − obs/q), which is just CDIP's own error at the buoy, and the buoy is chosen because that error is small. The nowcast is still fetched, only as the carrying ratio.

On 2026-11-07, 21 of 45 spots have no qualifying buoy: the Santa Cruz and Monterey spots (the outer canyon buoy fails the check this month), the North Coast, Sonoma, Big Sur, Jalama, Rincon and C Street. The other 24 are waiting until 3 days of captures exist after deploy.

**Limits.** The buoy height is carried by a model; the break itself is not measured anywhere. v1 hours (the offshore-swell fallback when MOP lacks the hour) are not scored.

## Budget (T-129)

| path | when | upstream fetches | R2 operations | Open-Meteo |
|---|---|---|---|---|
| `/api/how-right` (a page view) | per view | 0 | at most 1 read per Worker isolate per 30 min (memo), `Cache-Control: public, max-age=900` | 0 |
| daily job (`services/how-right.mjs`) | one 5-minute cron tick a day, 00:30 UTC, **instead of** that tick's refresh | about 58 CDIP THREDDS + 1 NDBC (measured on the 2026-11-07 run: 58 total) | 44 reads of the cached MOP forecasts, up to 33 capture reads, 2 writes | 0 |

- The run's own budget is 400 subrequests (`HOW_RIGHT_BUDGET`); a full run uses about 140. The refresh run it replaces is one of 288 a day; the next tick resumes the refresh (T-129 refresh-ahead covers the gap).
- CDIP load: about +58 requests a day on top of the refresh's hourly MOP forecast and file-attribute fetches for 44 points (about 2,100 a day), so about 3% more.
- Storage: one capture a day (about 20 KB; keep 35 days with the lifecycle rule in `wrangler.jsonc`) and one scorecard (about 70 KB, overwritten daily).
- Without a persistent bucket (the Vite preview) `/api/how-right` computes on demand once (about 58 CDIP calls, about 30 s) and keeps it in memory for 6 hours; nothing is stored.

## Step 3: tuned to your reports

After 8 reports at a spot that match a forecast hour (body-word sessions; "felt right?" taps never activate it), the Surf card's big number is tuned to the person. The line under it keeps the model's tags first: "model estimate [· buoy-corrected ×f] · **tuned to your 10 reports at Linda Mar** · model alone 5–7 ft · Why" (the full method line is read to screen readers). Home cards, Compare and Find Spots add "tuned to your reports" beside a tuned number.
- **Why** gives the real figures: the median of the person's ratios, the shrinkage, the felt nudge, the cap, and that the two ranges differ in kind (the model's runs from the typical wave to the sets; theirs spans the middle half of their reports, never narrower than ±15% of their number).
- **Shrinkage toward 1** (`calibrationMath.ts`): the applied ratio is 1 + (median − 1) × n / (n + 8). At 8 reports it moves half way (a median of 1.5 becomes 1.25), at 24 three quarters. Felt taps then nudge it (3% per net tap, at most ±15%, unchanged). The result is held in 0.5–2× (`RATIO_LIMITS`). Our choices, tested in `calibration.test.ts`.
- **No compounding with the buoy correction**: v1 pairs are put on today's corrected scale before fitting (`v1CentralOnCurrentScale`), so a person who sees 1.3× the corrected height gets 1.3× (shrunk), never 1.3 × 1.48 (`buoy-transfer.test.ts`).
- The method line carries no unit-bound numbers; the model's band beside it is formatted in the person's units.
- Everything stays on the device (localStorage); nothing is uploaded.
