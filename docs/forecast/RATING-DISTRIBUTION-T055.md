# Rating distribution, before and after T-055

All 45 evidence spots x the next 72 hours (3,240 spot-hours) from ONE cached live Open-Meteo snapshot (retrieved 2026-11-02 18:38 UTC; free tier, non-commercial), rated with the code before and after. Script: `docs/forecast/data/rating-distribution.ts`. This shows how ratings spread; it says nothing about accuracy (no rideability observation exists).

"Top two categories": the rating never produced EPIC, FIRING or GOOD at all (provisional cap 74), so the meaningful figure is the share rated SOLID or better, which is what made every spot read "Solid". Target: no more than ~25%.

| Category | Before | After |
|---|---|---|
| EPIC | 0.0%  | 0.0%  |
| FIRING | 0.0%  | 0.0%  |
| GOOD | 0.0%  | 0.0%  |
| SOLID | 76.9%  | 22.8%  |
| NOT BAD | 20.6%  | 59.0%  |
| SURFABLE | 2.3%  | 17.9%  |
| WEAK | 0.2%  | 0.3%  |
| POOR | 0.0%  | 0.0%  |

- SOLID or better: **76.9% → 22.8%** (target ≤ 25%). Ocean Beach (the only surveyed spot): 72 of 72 SOLID → 43 SOLID, 29 NOT BAD.
- GOOD or better, EPIC + FIRING: 0% before and after.

## What changed (product rules, not fitted; they only lower a score)

1. Wind relation unknown (no surveyed shore normal; 44 of 45 spots) and wind above 5 mph: ceiling NOT BAD (64). Calm unknown wind is not capped.
2. Cross-shore wind above 8 mph (Beaufort force 3, NWS): ceiling NOT BAD (64).
3. A breaking estimate range 4 ft or more wide: ceiling SOLID (69). The estimate still never raises or feeds a score.
4. Offshore-potential curve flatter: 16 points per foot of primary swell (was 25) and 8 per second of period over 4 s (was 10), so a 4 ft swell is no longer already 'maxed'.  (Median potential before: 82 of 100.)

Each ceiling that held a score down appears in `explainRating` as a 'Rating ceiling' item with its reason, and in the rating's constraints.
