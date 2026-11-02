# T-041: breaking estimate v2, consistency check (not validation)

Script: `node --experimental-strip-types docs/forecast/data/compare-v1-v2.ts`. v1 = NDBC 46026 swell (Komar–Gaughan, from `t008-pairs.csv`); v2 = CDIP MOP SF023 nowcast at 10 m (Hs, Tp, Dp) carried to the break by linear shoaling and refraction on straight contours, breaker index 0.78, same unvalidated 0.7–1.4 face factors. Ocean Beach, the 1,068 archived hours (2026-09-16 onward).

Result (run 2026-11-02):
- Both methods estimate 782 hours; v1 only 0; **v2 only 269**; neither 17 (all short-period).
- v2/v1 central ratio: **median 1.01**, 10th–90th percentile 0.88–1.21. Mean difference v2−v1 0.21 ft.
- v2 range overlaps v1's on 100% of shared hours; v1's central lies inside v2's range on 100%.

What it shows: two independent routes (an offshore buoy with a fixed shelter factor, and a refracted model point with physics) give the same size to within about ±20%. That is **consistency, not accuracy**: neither has been compared with observed breaking heights, so nothing here supports a new accuracy claim.

Why v2 estimates 269 more hours: v1 refuses when the *buoy swell partition* has a period under 8 s; the MOP point has a single peak period and no swell/wind-sea partition, so v2 sees the peak even when a long swell is hidden behind a short-period swell partition, and equally can read a wind-sea peak as swell. This is a known weakness of v2 and the reason it stays behind a flag.

Other limits: straight parallel contours (no sandbars, reef, or headland effects), significant height treated as the breaking height, and the swell window and minimum period are the lead-set assumptions from T-008 (not reviewed).
