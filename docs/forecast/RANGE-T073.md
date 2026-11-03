# Honest ranges (T-073): how the surf range is built now, and what it did to the widths

Before: the breaking estimate was the central height times a fixed, lead-set band of 0.7 to 1.4 (Ocean Beach 6–13 ft). Now the range is built from components that each have a stated basis (`src/services/uncertainty.ts`, constants cited in the file), combined in quadrature in log space around the central height, rounded outward to whole feet (at least 1 ft). It is a **likely range, not a validated confidence interval**: no component has been checked against observed face heights. Calibration from the surfer's own observations (T-059) still replaces it once active.

## Components

| Component | Half-width | Basis | Applies to |
|---|---|---|---|
| Surf-height convention | ±13% (ln 1.27 / 2) | ASSUMED convention range (no source found for it): a surf height is quoted between the significant height H1/3 and the larger H1/10. Only the ratio is cited: for Rayleigh-distributed waves H1/10 ≈ 1.27 H1/3 (Longuet-Higgins 1952, J. Marine Res. 11, 245–266). May overlap the variability inside the other terms, so it can make the range wider than needed | every estimate |
| Breaker index (width only, centred on v2's γ = 0.78 not the paper's 0.73) | ±18% (ln(0.83/0.60) / 2) | Battjes & Stive (1985, J. Geophys. Res. 90, 9159–9167): breaker index γ between 0.60 and 0.83 over plane, bar-trough and bar profiles, mean 0.73 (as reported in Coastal Wiki "Breaker index" and the 2022 NHESS Wadden Sea paper); v2 uses γ = 0.78 | v2 (MOP) |
| Offshore-to-nearshore step | ±22% (ln(0.97/0.65) / 2) | Our own comparison of the v1 formula with CDIP MOP SF023 over 1,068 hours: MOP Hs ÷ Hb p10 to p90 = 0.65 to 0.97 (`T-008-validation.md`). A WIDTH only: that band sits below 1 (Hb runs high against MOP Hs at 10 m, partly the intended depth step) and the range here is centred on Hb, so it does not cover that known high bias; Ocean Beach only; against a model, not observed breakers | v1 |
| Model spread | ln(max/min) / 2 | Open-Meteo Marine returns several wave models for the same point in one request; the v1 estimate is run on each model's primary swell. Models with no data at the spot are left out; fewer than two models means no term | where ≥ 2 models |
| Method difference | \|ln(v2/v1)\| / 2 | v2 (nearshore model) and v1 (offshore formula) are two different methods on the same swell and differ systematically; this widens the range but is NOT reported as "sources disagree" | v2 spots |

"Wave models disagree" is stated only when the model spread exceeds a factor of 1.35 between wave models (an arbitrary, documented threshold); the method difference never triggers it. **Breaker type (spilling vs plunging) does not narrow the range:** the literature found gives one pooled breaker-index range, not separate ones per type, so no split ratios were invented. The legacy fixed band is used only when a record has no central height (cached before this change).

## Widths before and after (45 spots x next 72 h, daylight, live free-tier data, 2026-11-03)

Spot-hours with an estimate (daylight, next 72 h): 528 across 27 spots (v2 61, v1 467).

| | before (fixed 0.7–1.4) | after, no model spread | after, with model spread |
|---|---|---|---|
| median width, ft | 7.0 | 5.0 | 6.0 |
| mean width, ft | 6.5 | 4.8 | 5.7 |
| v2 spot-hours: median width, ft | 6.0 | 4.0 | 5.0 |
| v1 spot-hours: median width, ft | 7.0 | 5.0 | 6.0 |
| width ÷ midpoint (median) | n/a | 59% | 67% |

With the spread: 94% of spot-hours had at least 2 usable models; 38% are flagged "wave models disagree"; narrower than before in 68%, equal in 14%, wider in 18%.
Extra requests: 45 (one per spot), mean 181 ms each, mean 15.6 KB.


(The "before" column is the legacy band around the same central height, in whole feet with the old 2 ft minimum. 27 of 45 spots had an estimate in the window: Ocean Beach and Linda Mar on v2, 25 on v1.)

Reading: the range is narrower than the fixed band in two thirds of spot-hours and about 14% narrower at the median once the spread is included (7 to 6 ft; 7 to 5 ft without it; narrower in 68% of spot-hours, wider in 18%). It is not "usually narrow": wave models disagree by more than a factor of 1.35 about breaking height in about 4 in 10 spot-hours, and when they do the range widens on purpose.

## Ocean Beach week (context only, not truth)

Day cards (median daylight hour), after, with the model spread (retrieved 2026-11-03): Mon Nov 2 6–11, Tue 8–15, Wed 8–17, Thu 6–14, Fri 9–19, Sat 9–17, Sun 7–15, Mon Nov 9 11–25. Surfline's Central Ocean Beach week (read by the lead on 2026-11-02): 8–10, 8–12, 8–10, 4–6, 8–12, 8–12, 6–8, 15–18. The Ocean Beach ranges stay wide because the nearshore model and the offshore swell disagree there (MOP Hs about 1.5 times the offshore partition), which the range now reports instead of hiding; our centre is also higher than Surfline's (see THURSDAY-DIP-T066.md). No claim of accuracy is made.

## Cost

One extra request per viewed or saved spot (at most 12), about 16 KB and about 0.2 to 1 s each, made after the main forecast has loaded, cached 10 minutes, silent on failure. The main forecast load is unchanged. In the browser check a single request was made for the Ocean Beach page and the console stayed clean.

## Limits

- No component is validated against observed face heights. The 18% and 22% terms come from a literature range and from our own model-to-model comparison; the 13% term is a convention spread. Observations (T-059) are what can narrow or confirm them.
- The v1 step term was measured at Ocean Beach and is applied to every v1 spot.
- The model-spread measure is the half range (ln(max/min)/2), which grows with the number of models.
- The legacy `faceEstimate.input.rangeFt` is still stored on each record and read by a few older consumers (Board Match scoring through `ocean/match.ts`); `headlineSurf` is the source of truth for what is shown.

## Data-honesty review (subagent, on the diff) and what was done

No P0. P1s fixed: (1, 2) the v1 and breaker-index terms are documented as widths, not centred on their cited bands, and the v1 band does not cover the known Hb-vs-MOP high bias; (3) "disagree" now comes only from the wave-model spread, the v2-vs-v1 term is labelled "method difference"; (4) the convention is marked as an assumed range, only the Rayleigh ratio is cited; (5) calibration pairs carry `basis: 'central'` and a fit counts only those (pairs saved on the old fixed-band midpoint are excluded, not mixed); (6) the range memos in Home and the scale stage depend on `spreadV` so every surface updates when the spread arrives; (7) a record without a central height shows a labelled fixed band. P2s: note shows −x%/+y%, truthiness check replaced, dead code removed, widths re-measured from the script.
