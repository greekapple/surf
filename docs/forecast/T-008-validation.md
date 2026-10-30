# T-008 breaking-wave estimate: method and validation (2026-10-30)

Status of the estimate: **unvalidated for face height.** It is shown only as a labelled range ("Est. 4–6 ft at the break"), never as measured, and is not fed into ratings.

## Method (v1)
- Inputs: Open-Meteo primary swell Hs, period, direction (not the combined `wave_height`, which is used only to detect wind-sea dominance: wind sea = sqrt(combined² − primary² − secondary²), refuse if larger than the primary swell).
- Kd = sqrt(max(0, cos Δ)), Δ = angle between swell direction and the beach normal (`SpotEvidence.orientation`). No extra refraction term.
- Hb = 0.39 · g^0.2 · (T · (Hs · Kd · Ksh)²)^0.4 (Hs in m, Ksh = shelter factor).
- Range = Hb × [0.7, 1.4], rounded outward to whole feet, minimum width 2 ft. These factors are a fixed pre-validation band, not fitted.
- Refusals: no beach orientation, no reviewed profile, no shelter factor, null/zero swell inputs, period under the minimum, direction outside the window, wind sea larger than the primary swell.
- Ocean Beach (spot-2, normal 263.49°) is the only spot with a profile: window 240–300°, minimum period 8 s, Ksh = 1. **Window, minimum period and Ksh are engineering assumptions awaiting owner review.** Bolinas and Linda Mar refuse because orientation is null (X-02).

## Validation data
- Offshore side: NDBC 46026 realtime2 spectral summary (`46026.spec`, SwH, SwP, SwD, WVHT), 2026-09-15 to 2026-10-30, one reading per hour nearest the hour. SwD is a 16-point compass name (22.5° steps).
- Nearshore side: CDIP MOP SF023 nowcast via THREDDS NCSS (`waveHs`, QC primary = 1), 2026-09-16 to 2026-10-30.
- The MOP hindcast file returned "No features are in the requested subset" for this window; only the nowcast was used.
- Raw files and pairs: `docs/forecast/data/` (`ndbc-46026.spec.txt`, `cdip-mop-sf023-nowcast.csv`, `t008-pairs.csv`); reproduce with `node --experimental-strip-types docs/forecast/data/validate-t008.ts`.

**MOP SF023 is modelled nearshore significant wave height at 10 m depth, not observed breaking-wave face height.** This validates only the offshore-to-nearshore step. The comparison below is estimator central value (Hb) against MOP Hs, and "coverage" is whether MOP Hs falls inside the face range. It says nothing about whether the range matches the face a surfer sees, so the estimate stays "unvalidated" for face height.

## Results (1068 paired hours, 499 produced an estimate)
Refused hours: 129 period under 8 s, 364 outside the 240–300° window, 76 wind sea dominant.

| Period band | n | Bias (Hb − MOP Hs, ft) | MAE (ft) | Range covers MOP Hs |
|---|---|---|---|---|
| all | 499 | +1.59 | 1.63 | 91% (455/499) |
| <10 s | 86 | +1.06 | 1.17 | 85% (73/86) |
| 10–13 s | 237 | +1.42 | 1.44 | 97% (230/237) |
| 13–16 s | 133 | +1.87 | 1.90 | 89% (118/133) |
| ≥16 s | 43 | +2.77 | 2.79 | 79% (34/43) |

MOP Hs / Hb ratio: p10 0.65, p50 0.76, p90 0.93.

## Findings
- Hb is consistently larger than MOP Hs (bias +1.6 ft, growing with period). That is expected, since breaker height exceeds Hs at 10 m, but it means the MAE here is mostly the intended depth step, not model error. The range is wide enough to contain MOP Hs 91% of the time; the lower factor 0.7 is what does that, so coverage of MOP Hs says little about face coverage.
- Coverage is lowest at ≥16 s (79%), where Hb overshoots most. If the factors are ever fitted, a period-dependent low factor is indicated. This sample is 45 days of autumn, with 43 hours at ≥16 s.
- 253 of the 364 outside-window refusals are buoy swell direction "NW" (315°). Ocean Beach does receive NW swell (Δ ≈ 52° from the normal), so the 240–300° window is likely too narrow for the buoy's 22.5° direction steps. This needs an owner decision before the estimate is shown; the window was not changed here.
- No empirical 80% interval is adopted: there are no face-height observations to fit it to.
