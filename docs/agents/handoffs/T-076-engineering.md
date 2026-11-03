# T-076 handoff (engineering): why Ocean Beach's centre runs high

Write-up with numbers: `docs/forecast/OB-BIAS-T076.md`. **No bug found; no code change to the estimator.**
- v2 does not double-count: it starts from the MOP value at 10 m and applies energy-flux shoaling and Snell refraction to the break (never a deep-water factor). An independent linear-theory solver in the new test (`src/tests/ob-bias.test.ts`) matches v2 within 2% on breaking height and depth for Hs 3–15 ft, T 10–15.4 s. Typical transform: MOP Hs x 1.3 (x 1.1–1.25 for big swells).
- No face or H1/10 multiplier sits in the central height (the profile's old faceFactors no longer affect it; tested). The 1.27 only widens the range symmetrically.
- MOP is not high: over the last 7 days MOP SF023 Hs ÷ NDBC 46026 WVHT = 0.95 median (p10 0.73, p90 1.13); Open-Meteo total wave_height ÷ buoy = 0.91. The "1.5x" in the T-073 report compared MOP's total Hs with Open-Meteo's primary swell PARTITION (about 0.70 of its own total): a definition difference, not a bias.
- The γ choice barely matters (0.60 → 0.9x, 0.83 → 1.04x the central height; tested).
- What remains vs Surfline (8–12 where MOP Hs is 9–11 ft; ours is about 1.3x MOP Hs) is a convention we can't settle without face-height observations; the honest lever is T-059 calibration, which absorbs a constant factor after 8 observations at a spot. I applied no blind 0.77x.
- Checks: tsc, 401 tests (+4), journeys 8/8, t045, t055, t073 pass. Codex not run.
