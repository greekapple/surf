# T-008 breaking-wave estimate: method and validation (2026-10-30)

Status of the estimate: **unvalidated for face height.** It is shown only as a labelled range ("Est. 4–6 ft at the break"), never as measured, and is not fed into ratings.

## Method (v1)
- Inputs: Open-Meteo primary swell Hs, period, direction (not the combined `wave_height`, which is used only to detect wind-sea dominance: wind sea = sqrt(combined² − primary² − secondary²), refuse if larger than the primary swell).
- Kd = sqrt(max(0, cos Δ)), Δ = angle between swell direction and the beach normal (`SpotEvidence.orientation`). No extra refraction term.
- Hb = 0.39 · g^0.2 · (T · (Hs · Kd · Ksh)²)^0.4 (Hs in m, Ksh = shelter factor).
- Range = Hb × [0.7, 1.4], rounded outward to whole feet, minimum width 2 ft. These factors are a fixed pre-validation band, not fitted.
- Refusals: no beach orientation, no reviewed profile, no shelter factor, null/zero swell inputs, period under the minimum, direction outside the window, wind sea larger than the primary swell.
- Ocean Beach (spot-2, normal 263.49°) is the only spot with a profile: window 203–323° (beach normal ±60°, lead decision; Kd already attenuates oblique swell), minimum period 8 s, Ksh = 1. **Minimum period and Ksh are lead-set, not measured.** Bolinas and Linda Mar refuse because orientation is null (X-02).

## Validation data
- Offshore side: NDBC 46026 realtime2 spectral summary (`46026.spec`, SwH, SwP, SwD, WVHT), 2026-09-15 to 2026-10-30, one reading per hour nearest the hour. SwD is a 16-point compass name (22.5° steps).
- Nearshore side: CDIP MOP SF023 nowcast via THREDDS NCSS (`waveHs`, QC primary = 1), 2026-09-16 to 2026-10-30.
- The MOP hindcast file returned "No features are in the requested subset" for this window; only the nowcast was used.
- Raw files and pairs: `docs/forecast/data/` (`ndbc-46026.spec.txt`, `cdip-mop-sf023-nowcast.csv`, `t008-pairs.csv`); reproduce with `node --experimental-strip-types docs/forecast/data/validate-t008.ts`.

**MOP SF023 is modelled nearshore significant wave height at 10 m depth, not observed breaking-wave face height.** This validates only the offshore-to-nearshore step. The comparison below is estimator central value (Hb) against MOP Hs, and "coverage" is whether MOP Hs falls inside the face range. It says nothing about whether the range matches the face a surfer sees, so the estimate stays "unvalidated" for face height.

## Results (1068 paired hours, 782 produced an estimate; window 203–323°)
Refused hours, in check order: 129 period under 8 s, 64 outside the window, 93 wind sea dominant. (First run with the 240–300° window: 499 estimates; 129 / 364 / 76.)

| Period band | n | Bias (Hb − MOP Hs, ft) | MAE (ft) | Range covers MOP Hs |
|---|---|---|---|---|
| all | 782 | +1.38 | 1.47 | 92% (717/782) |
| <10 s | 249 | +0.90 | 1.11 | 90% (225/249) |
| 10–13 s | 316 | +1.31 | 1.35 | 97% (306/316) |
| 13–16 s | 164 | +1.84 | 1.87 | 87% (143/164) |
| ≥16 s | 53 | +2.60 | 2.62 | 81% (43/53) |
| NW 315° only | 238 | +0.87 | 1.08 | 94% (224/238) |

MOP Hs / Hb ratio: p10 0.65, p50 0.77, p90 0.97.

NW 315° hours (Δ ≈ 52° from the normal, Kd < 1) are the 238 hours newly admitted by the wider window that still passed the period and wind-sea checks. They sit closer to MOP Hs than the rest (bias +0.87 ft, 94% coverage), because Kd shrinks Hb. The same caveat applies: coverage of MOP Hs is not coverage of face height.

## Findings
- Hb is consistently larger than MOP Hs (bias +1.4 ft, growing with period). That is expected, since breaker height exceeds Hs at 10 m, so the error here is mostly the intended depth step, not model error. The 0.7 low factor is what makes MOP coverage high; it says little about face coverage.
- Coverage is lowest at ≥16 s (81%), where Hb overshoots most. If the factors are ever fitted, a period-dependent low factor is indicated. This is 45 days of autumn, with 53 hours at ≥16 s.
- No empirical 80% interval is adopted: there are no face-height observations to fit it to.
