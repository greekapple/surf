# Does Ocean Beach's estimate run high? The chain, with numbers (T-076)

**Conclusion: no bug found.** v2 does not double-count shoaling or refraction, no face or H1/10 multiplier is applied to the central height, and MOP itself is not high against the deep-water buoy. The apparent gap to Surfline is (a) a comparison of unlike quantities inside our own app and (b) a convention difference we cannot resolve without observations. Nothing was changed in `breakingEstimate.ts`; tests now pin the behaviour (`src/tests/ob-bias.test.ts`). Data from `docs/forecast/data/ob-bias.ts` (live, free public data, last 7 days to 2026-11-03; buoys are not at the break, so this is context only).

## 1. Does v2 double-count shoaling or refraction? No.
`estimateBreakingV2` starts from the CDIP MOP value at its own depth (10 m at SF023), computes the linear dispersion relation there, and carries the height inward by conservation of wave energy flux (shoaling coefficient Ks = √(Cg(h₀)/Cg(h))) and Snell's law (refraction), stopping where H = γ·h (γ = 0.78). It never applies a deep-water-to-break factor. Reference transform (linear wave theory; Dean & Dalrymple, *Water Wave Mechanics for Engineers and Scientists*, ch. 4; USACE *Shore Protection Manual*): ω² = g k tanh(kh), Cg = (ω/k)·½(1 + 2kh/sinh 2kh), H = Hs₁₀ₘ·Ks, break at H = γ h. An independent solver written in the test (bisection on the dispersion relation) agrees with v2 to within 2% on both the breaking height and the breaking depth for Hs 3 to 15 ft and T 10 to 15.4 s.

Typical transform: MOP Hs at 10 m x 1.3 (last week: 4.5 ft at 10 m becomes 6.1 ft at a breaking depth of about 2.4 m; ratio p10 to p90 1.3 to 1.4). For the big swells of this week's forecast the ratio is lower (1.1 to 1.25) because they break deeper.

The choice of γ hardly matters for long swells (Hs grows only as h^-1/4 near the break): γ = 0.60 gives 0.9x and γ = 0.83 gives 1.04x the γ = 0.78 height (tested). So the breaker index cannot explain a large bias either way. (Caveat noted in the review: Battjes & Stive's 0.73 is a maximum-wave criterion; on a significant-height criterion of about 0.6 h the central height changes by under 5%.)

## 2. Where are 1.27 (H1/10) and a face multiplier applied? Nowhere in the central height.
- The central height is Hs-level: MOP Hs (all components) carried to the break. The profile's old `faceFactors` [0.7, 1.4] only shape the legacy `faceEstimate.input.rangeFt` and are no longer used by `headlineSurf` (tested: changing them leaves the central height identical).
- The 1.27 appears once, as the convention half-width (±13%) of the range in `uncertainty.ts`, applied symmetrically in log space: it widens the range, it does not move the centre.
- The only asymmetry is rounding the range outward to whole feet (about +0.5 ft on the high side, -0.5 ft on the low side).

## 3. Is MOP itself high? No.
Hourly over the last 7 days (155 hours with all sources present):

| ratio | median | p10 | p90 |
|---|---|---|---|
| MOP SF023 Hs (10 m) ÷ NDBC 46026 WVHT (deep water off San Francisco, total Hs) | **0.95** | 0.73 | 1.13 |
| Open-Meteo `wave_height` (total) ÷ NDBC 46026 WVHT | 0.91 | 0.77 | 1.10 |
| Open-Meteo primary swell ÷ NDBC 46026 SwH (swell) | 0.76 | 0.57 | 1.24 |
| Open-Meteo primary swell ÷ Open-Meteo `wave_height` | 0.70 | 0.57 | 0.84 |
| MOP SF023 Hs ÷ CDIP 029 Hs (Point Reyes, a different, more exposed site; not comparable) | 0.61 | 0.52 | 0.76 |

MOP and Open-Meteo agree with the deep-water buoy on TOTAL Hs (0.95 and 0.91). So the "MOP Hs is about 1.5 times the offshore partition" in the T-073 report compared MOP's total Hs with Open-Meteo's primary-swell PARTITION (which is only about 0.70 of Open-Meteo's own total): a difference of definition, not a bias. It does explain why v1 (primary swell partition) sits below v2 (total Hs) and why the "method difference" term widens the v2 range.

## 4. What is left: the gap to Surfline is a convention, not a demonstrable error
Our central is Hs carried to the break: about 1.3 times MOP Hs at 10 m. For the week of 2026-11-03 to 11-09 MOP Hs at 10 m was 7.6 to 15 ft and our central 10 to 17 ft; Surfline's 8–12 ft on the comparable days is about 1.0 times MOP Hs. Whether surfers' reported face heights are nearer Hs at 10 m or Hs at the break (or H1/10 of it) cannot be decided from models or buoys: no observation of face height exists in the app yet, and the validation that exists (T-008) compares model to model. We make no claim that 1.3x is right or wrong. If the user wants numbers closer to Surfline's convention, the honest way is observation calibration (T-059: a per-spot ratio observed ÷ model central), which will absorb any constant convention difference after 8 observations at a spot. Applying a blind 0.77x now would be a guess with no source, so none was applied.

## Reproduce
`node --experimental-strip-types docs/forecast/data/ob-bias.ts`; tests `src/tests/ob-bias.test.ts`.
