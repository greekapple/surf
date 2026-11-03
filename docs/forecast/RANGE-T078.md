# Narrower ranges from measured model skill (T-078)

User: "ranges still far too wide" (median 4 ft; Ocean Beach Thursday 4–12). Target: median ≤ 3 ft, ≤ 2 ft when the models agree, without hiding real disagreement.

## The new range (`src/services/uncertainty.ts`)
range = central × exp(−w) … central × exp(+w), whole feet **rounded outward** (so the displayed range contains the stated interval; the reviewer showed nearest rounding displays a tighter range than the measurements support), at least 1 ft wide; w = √(wForecast² + wStep²).
- **wForecast = max(skillW(lead), d).** `skillW` is the MEASURED forecast error of the wave models (meteofrance_wave, ecmwf_wam025, ncep_gfswave016, pooled; all three, not a subset picked after seeing which did best) against buoys by lead time: Open-Meteo Marine "previous day N" forecasts vs the total Hs of NDBC 46026 and 46214, 14 days to 2026-11-03, 660 hours per model and lead, ratio p10–p90 half-width after removing each model's median bias. `d` = ln(max/min)/2 over the bias-corrected, skill-pruned models for that hour (real disagreement). `max`, not a sum: both describe the same forecast error.
- **wStep** (v1 only) = 0.173: measured scatter of MOP Hs ÷ the v1 height (782 hours, Ocean Beach).
- **Lead** is hours from now to the hour (the model run time is not known).

| lead (days) | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| measured half-width (pooled, `docs/forecast/data/model-skill-lead.ts`) | 0.156 | 0.161 | 0.170 | 0.181 | 0.243 | 0.320 | 0.360 | 0.425 |

So the range is about ±17% now and widens to ±53% at a week. (An earlier draft used the two best models only, 0.142 to 0.43; a reviewer pointed out that picking them on the same data flatters the result, so the pooled table is used.)

## Models: bias-corrected and pruned by skill (`src/services/modelSpread.ts`, `docs/forecast/data/model-skill.ts`)
Over the 14 days at NDBC 46026 and 46214 (open ocean) the models' median ratio to the buoy was meteofrance_wave 1.02, ecmwf_wam025 1.05, ncep_gfswave016 0.84 (runs low), gwam 0.88. Each model is divided by its bias before models are compared, so a known bias no longer counts as disagreement. gwam is pruned (half-width 0.22 at 46026, above the 0.2 limit; its other figures are 0.15). NDBC 46012 is listed in the table but not used: every model is +30 to +40% there, which points at the grid cell. The bias and half-width were measured on TOTAL Hs and are applied to the swell partition the app uses (an assumption: the partition's own bias was not measured). The 0.2 pruning limit is a round figure above the retained models' open-ocean half-widths (at most 0.17) and below gwam's 0.223: not derived, and not tuned to a width target.

## Removed, with reasons
- the assumed H1/3–H1/10 "convention" term (no source; and the user chose an Hs-level quantity),
- the breaker-index term (about where waves break, no longer the centre),
- the v2-vs-v1 "method difference" (two partitions, not uncertainty about v2).

## Widths (45 spots x next 72 h, daylight, live data, 2026-11-03; 28 spots with a v2 estimate, 488 spot-hours)
| | before T-073 (fixed ×0.7–1.4) | T-073/T-077 | now |
|---|---|---|---|
| median width, ft | 7 (v1) / 6 (v2) | 4 | **3** |
| mean width, ft | 6.5 | 4.1 | 2.7 |
| width ÷ midpoint (median) | – | 77% | 50% |

"Wave models disagree" (more than a factor of 1.35 apart after bias correction) is flagged in 6% of spot-hours (40% when raw model differences, including known bias, counted). Where models genuinely disagree, or at long lead, the range is wide on purpose.

**When the models agree** (spread 1.03, three models), the range by central height and lead:

Restored session: Mon Nov  2 22:27:20 PST 2026
| central | now | 2 days | 4 days | 7 days |
|---|---|---|---|---|
| 2 ft | 1–3 | 1–3 | 1–3 | 1–4 |
| 3 ft | 2–4 | 2–4 | 2–4 | 1–5 |
| 4 ft | 3–5 | 3–5 | 3–6 | 2–7 |
| 5 ft | 4–6 | 4–6 | 3–7 | 3–8 |
| 6 ft | 5–8 | 5–8 | 4–8 | 3–10 |
| 8 ft | 6–10 | 6–10 | 6–11 | 5–13 |
| 10 ft | 8–12 | 8–12 | 7–13 | 6–16 |
| 12 ft | 10–15 | 10–15 | 9–16 | 7–19 |

So the "≤ 2 ft when the models agree" target holds up to about a 5 ft surf height and not above: at 6 to 12 ft the measured error (±17%) is 3 to 5 ft wide once rounded outward. Rounding to the nearest foot would give 2 ft more often but would display a range tighter than the buoy measurements support; that trade-off is a product decision and was not taken.

## Ocean Beach week (context only, not truth; Mon Nov 2 to Mon Nov 9)
| | Mon 2 | Tue 3 | Wed 4 | Thu 5 | Fri 6 | Sat 7 | Sun 8 | Mon 9 |
|---|---|---|---|---|---|---|---|---|
| Surfline (read by the lead 2026-11-02) | 8–10 | 8–12 | 8–10 | 4–6 | 8–12 | 8–12 | 6–8 | 15–18 |
| T-077 | 5–9 | 6–14 | 7–15 | 4–12 | 7–17 | 7–15 | 5–13 | 9–25 |
| now | 5–8 | 7–11 | 8–12 | 6–10 | 8–14 | 7–14 | 5–12 | 10–23 |

Our centre (MOP Hs) is still above Surfline's on some days; the widths now follow the measured error and are still about twice Surfline's quoted 2–4 ft. The last day is wide because its lead is seven days.

## Cost
No new requests: the same single multi-model request per spot (T-073). The skill tables are static, dated constants.

## Limits (honest)
- The skill figures are deep-water buoys over one fortnight, not the surf zone and not the MOP point; they describe the wave MODELS' Hs error, which we use as the forecast error of the surf height. A floor, not a guarantee, and not a validated confidence interval.
- The label users see (the method line) now says the range is the wave-model forecast error against deep-water buoys over 14 days, not a guarantee, and that bigger waves in a set run higher.
- Lead is hours from now, not from the model run, so it understates the true lead by the model's age (optimistic by several hours). `max(skill, disagreement)` was chosen over a sum because both describe the same error; a quadrature sum was not tested.
- The range is the forecast uncertainty of the model height: it does not include the wave-to-wave variation inside a set (the biggest waves are higher; for Rayleigh seas H1/10 ≈ 1.27 H1/3), nor any surf-height-convention difference. Observations (T-059 calibration) are what can say how this compares with what surfers see.
- Lead is measured from now, not from the model run; the table is static and must be regenerated (scripts above) as seasons change.
- The v1 width is measured at Ocean Beach only and does not cover v1's about 14% low bias.
