# Open-Meteo call budget (2026-11-09, C3)
Free tier: 10,000 calls a day (non-commercial). **A call is weighted**, per Open-Meteo's own calculator (https://open-meteo.com/en/pricing, read 2026-11-09): `max(1, variables x models / 10)` per location, scaled by `days / 14` beyond two weeks, times the number of locations.
- **Multi-location requests do not save quota** (each location counts), only HTTP requests. The batching in `/api/providers` saves requests to our Worker, not Open-Meteo calls.
- **Spread was 1.6 calls a request** (4 variables x 4 models), not 1. The spread never uses `gwam` (pruned), so it is no longer requested: 4 x 3 = 1.2.

## Per spot per day (script: `node docs/forecast/data/open-meteo-budget.ts 59 150 250 500`)
| target | cadence | calls/request | per day |
|---|---|---|---|
| marine (8 vars) | 3 h | 1.0 | 8 |
| weather (3 vars) | 1 h | 1.0 | 24 |
| spread (4 vars x 3 models) | 3 h (was 90 min, 4 models) | 1.2 (was 1.6) | 9.6 (was 25.6) |
| **total** | | | **41.6** (was 57.6) |

| spots | before (weighted) | now |
|---|---|---|
| 59 | 3,398 | 2,454 |
| 95 | 5,472 | 3,952 |
| 150 | 8,640 | 6,240 |
| ~240 | 13,800 | ~10,000 (the flat ceiling) |

## Beyond ~150 spots
Flat cadence stops at ~240 spots. Not implemented (it needs the client to ask for fewer spots, since every screen currently loads every spot, so "recently opened" is not observable at the Worker):
1. **Hot/cold tiers**: hot spots (favourites, selected, nearby, recently opened) keep 41.6/day; cold spots refresh marine 6 h and weather 3 h, no spread (12/day); unopened 0, fetched on demand. N=250 with 100 hot: 5,960; N=500 with 100 hot: 8,960; with 150 hot: 10,440 (over).
2. **Cell sharing**: spots whose marine points fall in the same model cell get identical payloads; the 59 spots use 50 distinct 1/12 degree cells (15% fewer marine requests), less where spots are sparse. Small and fiddly; not worth it before tiers.
3. A **paid Open-Meteo plan** (commercial licence; costs money, so it needs a decision).
Cold-tier data needs its own freshness limits (marine 7 h, weather 3.5 h) in `staleness()`.
