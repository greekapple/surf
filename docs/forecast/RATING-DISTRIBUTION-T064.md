# Rating distribution, daylight hours, before and after T-064

45 evidence spots x the next 72 hours, **daylight hours only** (first light to last light), from one cached live Open-Meteo snapshot (retrieved 2026-11-02 18:38 UTC; free tier, non-commercial). Script: `docs/forecast/data/rating-distribution.ts <snapshot> <label> daylight`. This shows how ratings spread; it says nothing about accuracy.

| Category | Before | After |
|---|---|---|
| EPIC | 0.0%  | 0.0%  |
| FIRING | 0.0%  | 0.0%  |
| GOOD | 0.0%  | 0.0%  |
| SOLID | 19.4%  | 9.1%  |
| NOT BAD | 62.1%  | 40.0%  |
| SURFABLE | 17.9%  | 29.0%  |
| WEAK | 0.6%  | 18.6%  |
| POOR | 0.0%  | 3.3%  |

- Spot-hours: 1,566 (daylight). Largest single category: **NOT BAD 62.1% → 40.0%** (target: no category above 50%).
- SOLID or better: 19.4% → 9.1%. Nothing reaches GOOD, FIRING or EPIC (the provisional model's own ceilings).
- Ocean Beach (the only surveyed spot), after: SOLID 12, NOT BAD 9, SURFABLE 15 of 36 daylight hours.

## What changed

The raw provisional score is bunched (mostly 55–80, median about 66), so with the T-055 ceilings nearly every daylight hour landed in NOT BAD. T-064 re-centres and stretches it before any ceiling or cap: `score = 50 + 1.5 x (raw − 64)`, clamped to 0–100 (`provisionalRules.recenter`). It is our own normalisation, not fitted to observations. The T-055 ceilings (unknown wind relation, fresh cross-shore wind, wide estimate range) and all other caps are unchanged and still apply after it. Dark hours are no longer rated at all (`rateForecast` returns UNRATED with `dark: true`), so they are not in this table.
