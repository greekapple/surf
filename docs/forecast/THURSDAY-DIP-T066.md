# Ocean Beach week trace: is the Thursday swell drop in our data? (T-066)

Question (lead): Surfline's Central Ocean Beach week on 2026-11-02 read 8–10, 8–12, 8–10, **4–6 (Thu 5)**, 8–12, 8–12, 6–8, 15–18 ft. Our day cards showed no Thursday drop (7–15, 9–19, 7–15, 8–18, 8–18, 7–15, 12–25). Is the dip missing from our input, or flattened by our logic?

Method: `docs/forecast/data/trace-week.ts` fetches the live sources the app uses (Open-Meteo Marine offshore Hs and primary swell; CDIP MOP SF023 forecast) and pushes each day through the app's own `headlineSurf` and `dayRange`. Retrieved 2026-11-03 03:28 UTC (7:28 PM PST Nov 2). Daylight hours only, feet, medians per Pacific day. Surfline is a comparison, not ground truth.

| Day (PT) | offshore Hs (OM) | primary swell Hs / Tp / Dp | MOP SF023 Hs / Tp / Dp | v2 central (best hr) | headline range at 10 AM | day card (typical) | day envelope | median v2 central, daylight | MOP Hs median ÷ Wed |
|---|---|---|---|---|---|---|---|---|---|
| 2026-11-03 | 7.0 | 5.1 / 12.7 s / 289° | 9.3 / 15.4 s / 264° | 7–15 (best 7a) | 7–15 (mop-v2) | 7–15 | 7–17 | 11.5 | 1.0 |
| 2026-11-04 | 6.5 | 6.2 / 8.7 s / 274° | 10.8 / 13.3 s / 266° | 9–19 (best 8a) | 8–18 (mop-v2) | 9–19 | 7–19 | 13.0 | 1.0 |
| 2026-11-05 | 5.7 | 3.9 / 9.3 s / 292° | 7.6 / 15.4 s / 267° | 7–15 (best 3p) | 6–13 (mop-v2) | 7–15 | 6–15 | 10.0 | 0.7 |
| 2026-11-06 | 7.3 | 5.9 / 12.3 s / 293° | 11.0 / 15.4 s / 268° | 8–18 (best 7a) | 9–19 (mop-v2) | 8–18 | 8–19 | 13.0 | 1.0 |
| 2026-11-07 | 7.0 | 6.6 / 11.7 s / 295° | 10.6 / 14.3 s / 269° | 8–18 (best 7a) | 8–18 (mop-v2) | 8–18 | 8–18 | 13.0 | 1.0 |
| 2026-11-08 | 5.3 | 4.5 / 10.1 s / 292° | 8.4 / 12.5 s / 268° | 7–15 (best 7a) | 6–14 (mop-v2) | 7–15 | 6–16 | 11.0 | 0.8 |
| 2026-11-09 | 7.5 | 7.4 / 10.7 s / 289° | 15.1 / 15.4 s / 262° | 12–25 (best 7a) | 11–24 (mop-v2) | 12–25 | 6–25 | 17.5 | 1.4 |

## Findings

1. **The dip is present in every one of our inputs.** Thursday Nov 5 is the lowest day of the week in all of them: offshore Hs 5.7 ft (Wed 6.5, Fri 7.3), primary swell 3.9 ft (Wed 6.2, Fri 5.9) and the MOP SF023 forecast Hs 7.6 ft, which is 0.70 of Wednesday's 10.8 ft. The v2 estimate follows it: median daylight central 10.0 ft against 13.0 ft on Wednesday and Friday (-23%).
2. **It is smaller than Surfline's.** Surfline's Thursday is half of Wednesday (4–6 against 8–12, about -50%); ours is -23% in the estimate, -30% in MOP Hs, -12% in offshore Hs and -37% in the primary swell. The sources disagree with each other on the size of the drop, and with Surfline. The large difference is a source difference: Open-Meteo's wave model, CDIP MOP (a nearshore model initialised from buoys and the global WW3 forecast) and Surfline's own model and surf-height convention are different forecasts. Ours also reads about 1.3x Surfline on a normal day (Wed central 13 vs about 10) and about 2x on Thursday (10 vs about 5), so the absolute scale differs too: the v2 estimate and its 0.7–1.4 face factors are unvalidated (see T-041-v2-consistency.md).
3. **Our day-card logic flattens it slightly, by design, not by a bug.** The day card shows the estimate at the day's best-rated daylight hour (T-057). On Thursday that hour is 3 PM (a lighter-wind hour with a larger MOP value), giving 7–15 where the 10 AM headline is 6–13 and the daylight median is 10 central. The envelope (6–15) is also wide because of the 0.7–1.4 factors. Neither the choice of hour nor the range removes the dip; they hide about 1 ft of it.
4. **Period is not the cause.** MOP's long-period (13–15 s) energy is steady across the week, so v2 (which uses MOP Hs and period) stays high on Thursday while Open-Meteo's primary swell falls to 3.9 ft at 9 s. If Surfline's Thursday is right, MOP's 7.6 ft at 15 s is the input that is too high; the two models' disagreement is itself the honest uncertainty here.

## Conclusion

Not a bug in the day-card logic: the dip is in our data, only shallower than Surfline's, because our sources forecast a smaller drop. No code change was made. Two product options if the user wants the dip to show more: (a) base the day card on the median daylight hour instead of the best-rated hour (about 1 ft lower on Thursday); (b) show the spread between our sources (offshore model vs MOP) on days where they disagree by more than 30%. Neither makes the estimate more accurate; only observations (T-059) can say which model to trust at Ocean Beach.

## T-068: the user chose "Median daylight hour"

Each day card's main number is now the estimate at that day's median daylight hour by clock time (about midday; daylight from `daylight.ts`), through `spotHour`. The best window stays in the Call; the daylight envelope line is unchanged. Re-run of `trace-week.ts` (same retrieval method, 2026-11-03 03:49 UTC), Ocean Beach, day-card main number:

| Day | Tue Nov 3 | Wed Nov 4 | **Thu Nov 5** | Fri Nov 6 | Sat Nov 7 | Sun Nov 8 | Mon Nov 9 |
|---|---|---|---|---|---|---|---|
| Day card before (best-rated hour) | 7–15 | 9–19 | **7–15** | 8–18 | 8–18 | 7–15 | 12–25 |
| Day card now (median daylight hour) | 7–16 (12p) | 8–17 (12p) | **6–14 (12p)** | 8–18 (12p) | 8–18 (12p) | 7–15 (12p) | 11–24 (11a) |
| Envelope over daylight | 7–17 | 7–19 | 6–15 | 8–19 | 8–18 | 6–16 | 6–25 |

Thursday now shows as the lowest day of the work week at 6–14 (about 10 ft central) beside Wednesday's 8–17 and Friday's 8–18 (about 12.5–13 central): a drop of about 20–25% in the middle of the face range, where it was about 10% before. It is still shallower than Surfline's Thursday (about -50%), for the reason given above: our sources forecast a smaller drop, and the v2 range factors keep the ranges wide.
