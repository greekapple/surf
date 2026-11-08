# Accuracy against real buoys (T-131 phase 2)

Generated 2026-11-08T00:04Z by `docs/forecast/data/accuracy-vs-buoys.ts`. Reproduce: `node --experimental-strip-types docs/forecast/data/accuracy-vs-buoys.ts --archive 2025-11-01T00:00:00Z/2026-05-01T00:00:00Z --recent 2026-10-07T00:00:00Z/2026-11-06T00:00:00Z`. Rules and thresholds: `src/services/accuracy.ts`. Findings and decisions: the notes at the end.

Windows: **archive** 2025-11-01 to 2026-05-01 (CDIP's quality-controlled `_historic` buoy files; 6 winter-spring months) and **recent** 2026-10-07 to 2026-11-06 (CDIP realtime files, NDBC realtime2 for Point Sur). A buoy needs at least 200 observed hours in a window to be used; each spot uses the nearest such buoy, preferring a nearshore one within 40 km.

**What each number is.**
- **Observed** = a wave buoy's measured significant height (Hs): CDIP file (primary QC flag 1) or NDBC realtime2, the sample ON the hour only (no averaging, no filling, nothing interpolated).
- **(a) v1** = **model estimate**: our offshore-swell estimate at the spot (Open-Meteo Marine hours for the window, i.e. each hour's own short-range model run, through the app's normaliser and `headlineSurf`; v1 refuses out-of-window or short-period hours, so it has fewer hours).
- **(b) MOP point** = **model**: CDIP MOP nowcast at the spot's assigned point (MOP driven by measured offshore buoy spectra; the app shows MOP's forward forecast, which has no public archive, so this is an upper bound on what the MOP headline achieved).
- **(c) MOP at the buoy** = **model**: CDIP's MOP_validation point for that buoy (`BP<id>`), the clean model-vs-observation check.
- **(d) observation-anchored** = **our correction of an observation, model-assisted**: the buoy's observed Hs × MOP's own hourly ratio (spot point ÷ buoy site). Used only where (c) shows MOP is right at that buoy in that window (|bias| ≤ 0.5 ft, MAE ≤ 1 ft, at least 200 hours: our threshold). Not a measurement at the spot.
- Bias = mean(model − observed) in ft: **positive means the model reads high**. MAE = mean absolute error, ft. Regimes = observed peak direction (S < 225°, W 225–292.5°, NW ≥ 292.5°) and period (short < 10 s, mid 10–14 s, long ≥ 14 s); regimes with at least 12 hours shown.
- Buoy relation (our judgement): **co-located** = nearshore buoy (≤ 45 m) within 5 km; **nearby** = nearshore within 25 km; **regional** = farther or deep water. A buoy-vs-spot gap at a nearby or regional buoy is partly a real difference between two places; the "MOP point ÷ buoy site" column says how large MOP thinks that difference is (1.00 = the same).

## 1. MOP against the buoys themselves (c)

### Archive window
| buoy | name | position | depth | MOP check point, distance from buoy | observed hours | n | MOP bias, ft | MOP MAE, ft | median obs ÷ MOP | regimes covered | MOP right here? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 142 (NDBC 46237) | San Francisco Bar | 37.7881, -122.6325 | 16.46 m | BP142, 2.1 km | 4342 | 4342 | +0.1 | 0.6 | 0.98 | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 | **yes** |
| 076 (NDBC 46215) | Diablo Canyon | 35.2038, -120.8593 | 27.43 m | BP076, 0.2 km | 1624 | 1624 | -0.9 | 0.9 | 1.21 | W mid 946, W long 373, W short 135, S short 68, NW short 50, NW mid 28, S long 22 | no |
| 215 (NDBC 46256) | Long Beach Channel | 33.7002, -118.2006 | 23.25 m | BP215, 0.0 km | 4344 | 4344 | -0.5 | 0.5 | 1.21 | S long 1498, W long 913, W mid 800, S mid 727, W short 177, S short 167, NW long 56 | **yes** |
| 264 (NDBC 46275) | Red Beach Nearshore | 33.2908, -117.5015 | 16.79 m | BP264, 0.2 km | 4341 | 4341 | -0.0 | 0.2 | 1.00 | S long 1706, W mid 790, S mid 779, W long 576, W short 353, S short 137 | **yes** |
| 201 (NDBC 46254) | Scripps Nearshore | 32.8678, -117.2667 | 41 m | BP201, 0.1 km | 4345 | 4345 | +0.1 | 0.2 | 0.98 | W mid 1634, W short 1471, W long 551, NW mid 321, NW long 291, NW short 77 | **yes** |
| 158 | Cabrillo Point Nearshore (Monterey Bay) | 36.6263, -121.9071 | 17 m | BP158, 0.0 km | 4343 | 4343 | -0.7 | 0.8 | 1.30 | NW mid 3218, NW short 543, NW long 323, S long 226, S mid 33 | no |
| 155 (NDBC 46235) | Imperial Beach Nearshore | 32.5697, -117.1689 | 21 m | BP155, 0.0 km | 4345 | 4345 | +0.0 | 0.3 | 1.00 | W long 1819, W mid 1806, W short 628, S short 50, S long 36 | **yes** |
| 156 (NDBC 46236) | Monterey Canyon Outer | 36.7592, -121.9503 | 133 m | BP156, 0.4 km | 4341 | 4341 | +0.5 | 0.7 | 0.92 | W mid 1971, W long 649, NW mid 647, W short 494, NW short 459, S short 63, S long 37, S mid 15 | **yes** |
| 168 (NDBC 46244) | Humboldt Bay North Spit | 40.8960, -124.3570 | 110 m | BP168, 0.9 km | 4345 | 4345 | -0.6 | 0.8 | 1.08 | W mid 1213, NW mid 1193, NW short 698, W long 488, W short 336, NW long 300, S short 100, S mid 17 | no |
| 071 (NDBC 46218) | Harvest | 34.4515, -120.7800 | 550 m | BP071, 1.1 km | 3856 | 0 | – | – | – | – | no QC-good MOP hours |
| 028 (NDBC 46221) | Santa Monica Bay | 33.8599, -118.6411 | 387 m | BP028, 1.0 km | 4345 | 4345 | -0.1 | 0.4 | 1.04 | W mid 1407, S long 1215, W short 619, W long 522, S mid 467, S short 110 | **yes** |
| 094 (NDBC 46213) | Cape Mendocino | 40.2915, -124.7475 | 346 m | BP094, 0.8 km | 4345 | 4337 | -0.7 | 1.0 | 1.07 | NW mid 1087, W mid 1071, NW short 650, W long 458, NW long 361, W short 242, S short 202, S long 165, S mid 101 | no |
| 157 (NDBC 46239) | Point Sur | 36.3420, -122.1100 | 366 m | BP157, 0.7 km | 4341 | 4341 | -0.6 | 0.8 | 1.08 | NW mid 1229, W mid 913, NW short 557, W long 520, NW long 511, S long 276, W short 144, S short 124, S mid 67 | no |

### Recent window
| buoy | name | position | depth | MOP check point, distance from buoy | observed hours | n | MOP bias, ft | MOP MAE, ft | median obs ÷ MOP | regimes covered | MOP right here? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 142 (NDBC 46237) | San Francisco Bar | 37.7881, -122.6325 | 16.46 m | BP142, 2.1 km | 717 | 717 | -0.1 | 0.4 | 1.03 | W long 471, W mid 190, W short 31, S long 18 | **yes** |
| 076 (NDBC 46215) | Diablo Canyon | 35.2038, -120.8593 | 27.43 m | BP076, 0.2 km | 721 | 721 | -0.8 | 0.9 | 1.21 | W mid 284, W long 169, S long 141, W short 51, NW short 46, NW mid 20 | no |
| 285 (NDBC 46286) | Avila Beach Nearshore | 35.1640, -120.7376 | 15 m | BP285, 0.0 km | 721 | 721 | +0.1 | 0.2 | 0.95 | S long 497, S mid 221 | **yes** |
| 103 (NDBC 46268) | Topanga Nearshore | 34.0222, -118.5783 | 20 m | BP103, 0.1 km | 706 | 706 | -0.2 | 0.3 | 1.07 | S long 522, S mid 153, W short 25 | **yes** |
| 215 (NDBC 46256) | Long Beach Channel | 33.7002, -118.2006 | 23.25 m | BP215, 0.0 km | 721 | 721 | -1.2 | 1.2 | 1.44 | S long 502, W long 112, S mid 78, W mid 18 | no |
| 284 (NDBC 46285) | Capistrano Beach Nearshore | 33.4452, -117.6801 | 11.13 m | BP284, 0.0 km | 719 | 719 | -0.2 | 0.4 | 1.06 | S long 604, S mid 105 | **yes** |
| 262 (NDBC 46274) | Leucadia Nearshore | 33.0621, -117.3141 | 17 m | BP262, 0.0 km | 679 | 679 | -0.1 | 0.2 | 1.04 | W long 503, W mid 110, W short 30, S long 22, S mid 13 | **yes** |
| 153 (NDBC 46266) | Del Mar Nearshore | 32.9565, -117.2796 | 17 m | BP153, 0.0 km | 719 | 719 | -0.1 | 0.3 | 1.03 | W long 550, W mid 132, W short 36 | **yes** |
| 201 (NDBC 46254) | Scripps Nearshore | 32.8678, -117.2667 | 41 m | BP201, 0.1 km | 366 | 366 | -0.1 | 0.2 | 1.04 | W short 164, W long 84, W mid 64, NW long 27, NW short 15, NW mid 12 | **yes** |
| 156 (NDBC 46236) | Monterey Canyon Outer | 36.7592, -121.9503 | 133 m | BP156, 0.4 km | 718 | 710 | +0.8 | 1.0 | 0.89 | W mid 291, W long 140, NW mid 128, NW short 71, W short 57, S long 19 | no |
| 168 (NDBC 46244) | Humboldt Bay North Spit | 40.8960, -124.3570 | 110 m | BP168, 0.9 km | 701 | 701 | -0.4 | 0.7 | 1.06 | NW short 248, NW mid 159, NW long 118, W mid 109, W long 63 | no |
| 071 (NDBC 46218) | Harvest | 34.4515, -120.7800 | 550 m | BP071, 1.1 km | 711 | 0 | – | – | – | – | no QC-good MOP hours |
| 028 (NDBC 46221) | Santa Monica Bay | 33.8599, -118.6411 | 387 m | BP028, 1.0 km | 721 | 721 | -0.0 | 0.3 | 1.02 | S long 533, S mid 108, W short 36, W mid 23, W long 18 | **yes** |
| 094 (NDBC 46213) | Cape Mendocino | 40.2915, -124.7475 | 346 m | BP094, 0.8 km | 718 | 694 | -1.1 | 1.2 | 1.17 | NW short 256, NW mid 124, W long 105, W mid 92, S long 70, NW long 47 | no |
| 222 (NDBC 46259) | Santa Lucia Escarpment | 34.7740, -121.4910 | 650 m | BP222, 16.5 km | 655 | 0 | – | – | – | – | no QC-good MOP hours |
| 029 (NDBC 46214) | Point Reyes | 37.9415, -123.4645 | 600 m | BP029, 0.7 km | 721 | 704 | -1.9 | 1.9 | 1.31 | NW short 183, NW mid 170, W mid 105, S long 96, W long 81, NW long 65 | no |
| 157 (NDBC 46239) | Point Sur | 36.3420, -122.1100 | 366 m | BP157, 0.7 km | 430 | 430 | -1.7 | 1.7 | 1.22 | NW mid 240, NW long 56, W mid 54, W long 40, NW short 22, S long 12 | no |

## 2. Per spot: our numbers against the nearest observing buoy

Columns: (a) v1 vs observed; (b) MOP at the spot's point vs observed; MOP's own median ratio spot point ÷ buoy site; (d) v1 vs the observation-anchored height at the spot's point, built from the nearest buoy within 40 km where MOP is right (which can differ from the nearest buoy); then the same for v1 as the app shows it now (with the T-131 buoy-transfer factor where one is applied: "same" = no factor at this spot; the archive figure includes the hours the factor was fitted on, section 3 has the held-out numbers); v1 − MOP over the same hours (model vs model, for comparison with SPOT-HEIGHTS-WEEK.md). (a), (d) and v1 − MOP use v1 BEFORE any factor.

### Archive window
| spot | MOP point | nearest buoy with data | km | relation | (a) n | (a) v1 bias | (a) v1 MAE | (b) n | (b) MOP bias | (b) MOP MAE | MOP point ÷ buoy site | (d) anchor buoy | (d) n | (d) v1 bias | (d) v1 MAE | (d) as the app shows v1 now: bias / MAE | v1 vs MOP n | v1 − MOP | regimes covered |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bolinas | MA137 | 142 San Francisco Bar (16.46 m) | 14.1 | nearby | 43 | -1.0 | 1.0 | 4342 | -2.2 | 2.2 | 0.57 | 142 (14 km) | 43 | +0.1 | 0.3 | same | 43 | +0.4 | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 |
| Stinson Beach | MA121 | 142 San Francisco Bar (16.46 m) | 12.5 | nearby | 0 | – | – | 4342 | -2.4 | 2.4 | 0.53 | – | 0 | – | – | – | 0 | – | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 |
| Ocean Beach | SF023 | 142 San Francisco Bar (16.46 m) | 11.2 | nearby | 2175 | -0.8 | 0.9 | 4342 | +1.5 | 1.7 | 1.25 | 142 (11 km) | 2175 | -2.5 | 2.5 | -0.1 / 0.8 | 2175 | -3.2 | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 |
| Linda Mar | SM382 | 142 San Francisco Bar (16.46 m) | 23.9 | nearby | 2065 | +0.0 | 0.5 | 4342 | -0.5 | 0.7 | 0.88 | 142 (24 km) | 2065 | +0.7 | 0.8 | same | 2065 | +0.3 | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 |
| Montara | SM340 | 142 San Francisco Bar (16.46 m) | 28.9 | regional | 2345 | +0.5 | 0.7 | 4342 | -0.5 | 0.7 | 0.88 | 142 (29 km) | 2345 | +1.3 | 1.3 | +0.1 / 0.6 | 2346 | +0.9 | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 |
| Mavericks | SM306 | 142 San Francisco Bar (16.46 m) | 34.6 | regional | 0 | – | – | 4342 | -0.5 | 0.6 | 0.89 | – | 0 | – | – | – | 0 | – | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 |
| Steamer Lane | SC149 | 158 Cabrillo Point Nearshore (Monterey Bay) (17 m) | 37.6 | regional | 46 | +1.2 | 1.2 | 4343 | -0.6 | 1.1 | 1.02 | 156 (22 km) | 46 | +0.8 | 0.8 | same | 46 | +0.7 | NW mid 3218, NW short 543, NW long 323, S long 226, S mid 33 |
| Cowell’s | SC149 | 158 Cabrillo Point Nearshore (Monterey Bay) (17 m) | 38.7 | regional | 0 | – | – | 4343 | -0.6 | 1.1 | 1.02 | – | 0 | – | – | – | 0 | – | NW mid 3218, NW short 543, NW long 323, S long 226, S mid 33 |
| Pleasure Point | SC117 | 158 Cabrillo Point Nearshore (Monterey Bay) (17 m) | 37.0 | regional | 65 | +1.6 | 1.6 | 4343 | -0.5 | 1.1 | 1.01 | 156 (22 km) | 65 | +1.2 | 1.2 | same | 65 | +1.1 | NW mid 3218, NW short 543, NW long 323, S long 226, S mid 33 |
| Davenport | SC255 | 156 Monterey Canyon Outer (133 m) | 35.5 | regional | 969 | -0.8 | 1.1 | 4341 | -1.1 | 1.2 | 0.72 | 156 (36 km) | 969 | +0.6 | 0.8 | same | 969 | +0.6 | W mid 1971, W long 649, NW mid 647, W short 494, NW short 459, S short 63, S long 37, S mid 15 |
| Crescent City | DN194 | none with data within 80 km | – | – | 0 | – | – | 0 | – | – | – | – | 0 | – | – | – | 0 | – | – |
| Moonstone Beach | HU708 | 168 Humboldt Bay North Spit (110 m) | 25.5 | regional | 2673 | -0.9 | 1.1 | 4345 | -1.2 | 1.3 | 0.90 | – | 0 | – | – | – | 2673 | +0.1 | W mid 1213, NW mid 1193, NW short 698, W long 488, W short 336, NW long 300, S short 100, S mid 17 |
| Humboldt North Jetty | HU541 | 168 Humboldt Bay North Spit (110 m) | 17.5 | regional | 1278 | -0.4 | 0.8 | 4345 | -0.5 | 1.0 | 1.00 | – | 0 | – | – | – | 1278 | -0.8 | W mid 1213, NW mid 1193, NW short 698, W long 488, W short 336, NW long 300, S short 100, S mid 17 |
| Shelter Cove | HU029 | 094 Cape Mendocino (346 m) | 64.8 | regional | 0 | – | – | 4345 | -2.7 | 2.7 | 0.75 | – | 0 | – | – | – | 0 | – | NW mid 1090, W mid 1073, NW short 651, W long 458, NW long 363, W short 242, S short 202, S long 165, S mid 101 |
| Point Arena | M0151 | none with data within 80 km | – | – | 0 | – | – | 0 | – | – | – | – | 0 | – | – | – | 153 | +1.9 | – |
| Salmon Creek | SN080 | 142 San Francisco Bar (16.46 m) | 73.6 | regional | 2494 | +0.9 | 1.0 | 4342 | -0.4 | 0.7 | 0.90 | – | 0 | – | – | – | 2494 | +1.3 | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 |
| Dillon Beach | MA563 | 142 San Francisco Bar (16.46 m) | 59.2 | regional | 2353 | +0.5 | 0.7 | 4342 | -1.5 | 1.5 | 0.73 | – | 0 | – | – | – | 2353 | +2.0 | W mid 2054, W long 1585, W short 437, S short 118, S long 81, NW mid 25, NW short 25, S mid 17 |
| Waddell Creek | SC319 | 156 Monterey Canyon Outer (133 m) | 47.4 | regional | 933 | -0.8 | 1.1 | 4341 | -1.3 | 1.4 | 0.68 | – | 0 | – | – | – | 933 | +0.6 | W mid 1971, W long 649, NW mid 647, W short 494, NW short 459, S short 63, S long 37, S mid 15 |
| Manresa | SC049 | 158 Cabrillo Point Nearshore (Monterey Bay) (17 m) | 34.0 | regional | 166 | +3.5 | 3.5 | 4343 | +0.5 | 1.1 | 1.52 | 156 (20 km) | 166 | +1.0 | 1.1 | same | 166 | +1.0 | NW mid 3218, NW short 543, NW long 323, S long 226, S mid 33 |
| Moss Landing | MO893 | 158 Cabrillo Point Nearshore (Monterey Bay) (17 m) | 22.3 | nearby | 2130 | +2.4 | 2.4 | 4343 | -0.3 | 0.6 | 1.17 | 156 (15 km) | 2126 | +3.0 | 3.0 | same | 2130 | +2.8 | NW mid 3218, NW short 543, NW long 323, S long 226, S mid 33 |
| Asilomar | MO716 | 158 Cabrillo Point Nearshore (Monterey Bay) (17 m) | 3.0 | co-located | 2668 | +3.4 | 3.4 | 4343 | +1.9 | 1.9 | 2.03 | 156 (16 km) | 2665 | +1.5 | 1.7 | same | 2668 | +1.2 | NW mid 3218, NW short 543, NW long 323, S long 226, S mid 33 |
| Carmel Beach | MO646 | 158 Cabrillo Point Nearshore (Monterey Bay) (17 m) | 8.4 | nearby | 1264 | +2.8 | 2.8 | 4343 | +0.3 | 0.7 | 1.42 | 156 (23 km) | 1263 | +2.7 | 2.7 | same | 1264 | +2.6 | NW mid 3218, NW short 543, NW long 323, S long 226, S mid 33 |
| Sand Dollar | MO111 | 157 Point Sur (366 m) | 74.0 | regional | 2595 | -1.2 | 1.3 | 4341 | -1.6 | 1.8 | 0.82 | – | 0 | – | – | – | 2598 | +0.1 | NW mid 1229, W mid 913, NW short 557, W long 520, NW long 511, S long 276, W short 144, S short 124, S mid 67 |
| Morro Rock | SL347 | 076 Diablo Canyon (27.43 m) | 18.7 | nearby | 1276 | +0.4 | 0.6 | 1624 | -1.0 | 1.0 | 0.97 | – | 0 | – | – | – | 2637 | +1.3 | W mid 946, W long 373, W short 135, S short 68, NW short 50, NW mid 28, S long 22 |
| Pismo Beach Pier | SL091 | 076 Diablo Canyon (27.43 m) | 20.9 | nearby | 25 | -0.4 | 0.6 | 1624 | -2.2 | 2.2 | 0.70 | – | 0 | – | – | – | 161 | +1.0 | W mid 946, W long 373, W short 135, S short 68, NW short 50, NW mid 28, S long 22 |
| Jalama | B1084 | 071 Harvest (550 m) | 26.3 | regional | 1007 | -1.3 | 1.3 | 3856 | -3.3 | 3.3 | – | – | 0 | – | – | – | 1087 | +1.2 | NW mid 1101, W mid 825, NW long 580, NW short 521, W long 457, S long 192, S short 67, W short 66, S mid 47 |
| Rincon | B0001 | none with data within 80 km | – | – | 0 | – | – | 0 | – | – | – | – | 0 | – | – | – | 0 | – | – |
| C Street | VE466 | 028 Santa Monica Bay (387 m) | 76.2 | regional | 127 | -0.7 | 0.7 | 4345 | -0.8 | 0.9 | 0.76 | – | 0 | – | – | – | 127 | -0.1 | W mid 1407, S long 1215, W short 619, W long 522, S mid 467, S short 110 |
| County Line | VE019 | 028 Santa Monica Bay (387 m) | 36.6 | regional | 1143 | -0.3 | 0.5 | 4345 | -0.6 | 0.6 | 0.85 | 028 (37 km) | 1143 | -0.0 | 0.4 | same | 1143 | +0.1 | W mid 1407, S long 1215, W short 619, W long 522, S mid 467, S short 110 |
| Zuma | L1059 | 028 Santa Monica Bay (387 m) | 24.0 | regional | 2011 | -0.6 | 0.6 | 4345 | -0.5 | 0.6 | 0.86 | 028 (24 km) | 2011 | -0.3 | 0.5 | same | 2011 | -0.2 | W mid 1407, S long 1215, W short 619, W long 522, S mid 467, S short 110 |
| Malibu (Surfrider) | L0904 | 028 Santa Monica Bay (387 m) | 19.9 | regional | 1058 | -0.4 | 0.4 | 4345 | -1.5 | 1.5 | 0.52 | 028 (20 km) | 1058 | +0.3 | 0.4 | same | 1058 | +0.4 | W mid 1407, S long 1215, W short 619, W long 522, S mid 467, S short 110 |
| Topanga | L0809 | 028 Santa Monica Bay (387 m) | 20.5 | regional | 1052 | -0.3 | 0.4 | 4345 | -1.3 | 1.3 | 0.59 | 028 (21 km) | 1052 | +0.5 | 0.5 | -0.0 / 0.2 | 1052 | +0.5 | W mid 1407, S long 1215, W short 619, W long 522, S mid 467, S short 110 |
| El Porto | L0577 | 215 Long Beach Channel (23.25 m) | 30.2 | regional | 1620 | +0.1 | 0.4 | 4344 | +0.1 | 0.8 | 1.29 | 028 (21 km) | 1621 | -0.6 | 0.7 | same | 1621 | -0.5 | S long 1498, W long 913, W mid 800, S mid 727, W short 177, S short 167, NW long 56 |
| Hermosa Pier | L0530 | 215 Long Beach Channel (23.25 m) | 25.9 | regional | 1617 | -0.0 | 0.5 | 4344 | -0.1 | 0.8 | 1.19 | 028 (22 km) | 1618 | -0.5 | 0.6 | same | 1618 | -0.3 | S long 1498, W long 913, W mid 800, S mid 727, W short 177, S short 167, NW long 56 |
| Huntington Pier | OC517 | 215 Long Beach Channel (23.25 m) | 19.0 | nearby | 0 | – | – | 4344 | -0.0 | 0.4 | 1.21 | – | 0 | – | – | – | 0 | – | S long 1498, W long 913, W mid 800, S mid 727, W short 177, S short 167, NW long 56 |
| The Wedge | OC379 | 215 Long Beach Channel (23.25 m) | 31.8 | regional | 1240 | -0.3 | 0.5 | 4344 | -0.7 | 0.7 | 0.93 | 215 (32 km) | 1240 | -0.2 | 0.4 | same | 1240 | +0.3 | S long 1498, W long 913, W mid 800, S mid 727, W short 177, S short 167, NW long 56 |
| Salt Creek | OC177 | 264 Red Beach Nearshore (16.79 m) | 29.7 | regional | 2094 | -0.2 | 0.4 | 4341 | +0.1 | 0.3 | 1.03 | 264 (30 km) | 2094 | -0.4 | 0.5 | same | 2098 | -0.3 | S long 1706, W mid 790, S mid 779, W long 576, W short 353, S short 137 |
| Trestles | D1206 | 264 Red Beach Nearshore (16.79 m) | 13.2 | nearby | 1634 | +0.3 | 0.4 | 4341 | +0.1 | 0.3 | 1.08 | 264 (13 km) | 1634 | +0.1 | 0.3 | same | 1636 | +0.2 | S long 1706, W mid 790, S mid 779, W long 576, W short 353, S short 137 |
| Oceanside Pier | D0905 | 264 Red Beach Nearshore (16.79 m) | 15.2 | nearby | 2439 | -0.0 | 0.3 | 4341 | +0.0 | 0.2 | 1.03 | 264 (15 km) | 2439 | -0.1 | 0.4 | same | 2443 | -0.0 | S long 1706, W mid 790, S mid 779, W long 576, W short 353, S short 137 |
| Swami’s | D0704 | 201 Scripps Nearshore (41 m) | 18.7 | nearby | 2581 | +0.4 | 0.5 | 4345 | +0.4 | 0.5 | 1.13 | 201 (19 km) | 2581 | -0.0 | 0.3 | same | 2581 | -0.1 | W mid 1634, W short 1471, W long 551, NW mid 321, NW long 291, NW short 77 |
| Cardiff Reef | D0681 | 201 Scripps Nearshore (41 m) | 16.3 | nearby | 2311 | +0.5 | 0.6 | 4345 | +0.3 | 0.4 | 1.12 | 201 (16 km) | 2311 | +0.1 | 0.4 | same | 2311 | -0.0 | W mid 1634, W short 1471, W long 551, NW mid 321, NW long 291, NW short 77 |
| Black’s Beach | D0541 | 201 Scripps Nearshore (41 m) | 2.7 | co-located | 1356 | +0.8 | 0.8 | 4345 | +0.5 | 0.5 | 1.16 | 201 (3 km) | 1356 | +0.2 | 0.4 | same | 1356 | -0.0 | W mid 1634, W short 1471, W long 551, NW mid 321, NW long 291, NW short 77 |
| Windansea | D0457 | 201 Scripps Nearshore (41 m) | 4.4 | co-located | 1443 | +1.1 | 1.1 | 4345 | +0.7 | 0.7 | 1.27 | 201 (4 km) | 1443 | +0.2 | 0.5 | same | 1443 | -0.0 | W mid 1634, W short 1471, W long 551, NW mid 321, NW long 291, NW short 77 |
| Ocean Beach (San Diego) | D0352 | 201 Scripps Nearshore (41 m) | 13.3 | nearby | 1601 | +1.4 | 1.4 | 4345 | +1.0 | 1.0 | 1.39 | 201 (13 km) | 1601 | +0.1 | 0.5 | same | 1601 | -0.1 | W mid 1634, W short 1471, W long 551, NW mid 321, NW long 291, NW short 77 |
| Imperial Beach | D0054 | 155 Imperial Beach Nearshore (21 m) | 3.4 | co-located | 1837 | +0.6 | 0.6 | 4345 | -0.5 | 0.5 | 0.85 | 155 (3 km) | 1837 | +1.3 | 1.3 | same | 1837 | +1.2 | W long 1819, W mid 1806, W short 628, S short 50, S long 36 |

### Recent window
| spot | MOP point | nearest buoy with data | km | relation | (a) n | (a) v1 bias | (a) v1 MAE | (b) n | (b) MOP bias | (b) MOP MAE | MOP point ÷ buoy site | (d) anchor buoy | (d) n | (d) v1 bias | (d) v1 MAE | (d) as the app shows v1 now: bias / MAE | v1 vs MOP n | v1 − MOP | regimes covered |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bolinas | MA137 | 142 San Francisco Bar (16.46 m) | 14.1 | nearby | 53 | -1.1 | 1.1 | 717 | -2.2 | 2.2 | 0.56 | 142 (14 km) | 53 | +0.8 | 0.8 | same | 53 | +0.9 | W long 471, W mid 190, W short 31, S long 18 |
| Stinson Beach | MA121 | 142 San Francisco Bar (16.46 m) | 12.5 | nearby | 0 | – | – | 717 | -2.2 | 2.2 | 0.55 | – | 0 | – | – | – | 0 | – | W long 471, W mid 190, W short 31, S long 18 |
| Ocean Beach | SF023 | 142 San Francisco Bar (16.46 m) | 11.2 | nearby | 212 | -0.6 | 0.6 | 717 | +0.9 | 1.0 | 1.21 | 142 (11 km) | 212 | -1.9 | 1.9 | +0.4 / 0.7 | 215 | -2.3 | W long 471, W mid 190, W short 31, S long 18 |
| Linda Mar | SM382 | 142 San Francisco Bar (16.46 m) | 23.9 | nearby | 224 | +0.2 | 0.5 | 717 | -0.4 | 0.5 | 0.92 | 142 (24 km) | 224 | +0.8 | 0.9 | same | 227 | +0.6 | W long 471, W mid 190, W short 31, S long 18 |
| Montara | SM340 | 142 San Francisco Bar (16.46 m) | 28.9 | regional | 277 | +0.5 | 0.6 | 717 | -0.4 | 0.5 | 0.92 | 142 (29 km) | 277 | +1.1 | 1.1 | -0.2 / 0.4 | 280 | +1.0 | W long 471, W mid 190, W short 31, S long 18 |
| Mavericks | SM306 | 142 San Francisco Bar (16.46 m) | 34.6 | regional | 0 | – | – | 717 | -0.4 | 0.5 | 0.95 | – | 0 | – | – | – | 0 | – | W long 471, W mid 190, W short 31, S long 18 |
| Steamer Lane | SC149 | 156 Monterey Canyon Outer (133 m) | 22.4 | regional | 0 | – | – | 718 | -2.2 | 2.2 | 0.47 | – | 0 | – | – | – | 0 | – | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Cowell’s | SC149 | 156 Monterey Canyon Outer (133 m) | 23.5 | regional | 0 | – | – | 718 | -2.2 | 2.2 | 0.47 | – | 0 | – | – | – | 0 | – | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Pleasure Point | SC117 | 156 Monterey Canyon Outer (133 m) | 21.9 | regional | 27 | +0.2 | 0.4 | 718 | -1.9 | 1.9 | 0.52 | – | 0 | – | – | – | 27 | +0.8 | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Davenport | SC255 | 156 Monterey Canyon Outer (133 m) | 35.5 | regional | 49 | +0.6 | 0.9 | 718 | -0.6 | 0.8 | 0.75 | – | 0 | – | – | – | 49 | +0.7 | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Crescent City | DN194 | none with data within 80 km | – | – | 0 | – | – | 0 | – | – | – | – | 0 | – | – | – | 0 | – | – |
| Moonstone Beach | HU708 | 168 Humboldt Bay North Spit (110 m) | 25.5 | regional | 311 | -0.8 | 1.0 | 701 | -1.5 | 1.6 | 0.83 | – | 0 | – | – | – | 311 | +0.1 | NW short 248, NW mid 159, NW long 118, W mid 109, W long 63 |
| Humboldt North Jetty | HU541 | 168 Humboldt Bay North Spit (110 m) | 17.5 | regional | 198 | -0.1 | 0.8 | 701 | -0.4 | 0.7 | 0.99 | – | 0 | – | – | – | 198 | -0.4 | NW short 248, NW mid 159, NW long 118, W mid 109, W long 63 |
| Shelter Cove | HU029 | 094 Cape Mendocino (346 m) | 64.8 | regional | 0 | – | – | 718 | -3.2 | 3.2 | 0.70 | – | 0 | – | – | – | 0 | – | NW short 276, NW mid 124, W long 105, W mid 96, S long 70, NW long 47 |
| Point Arena | M0151 | none with data within 80 km | – | – | 0 | – | – | 0 | – | – | – | – | 0 | – | – | – | 2 | +1.7 | – |
| Salmon Creek | SN080 | 029 Point Reyes (600 m) | 57.5 | regional | 305 | -1.6 | 1.7 | 721 | -3.3 | 3.3 | 0.76 | – | 0 | – | – | – | 305 | +1.2 | NW short 183, NW mid 170, W mid 105, S long 96, W long 83, NW long 80 |
| Dillon Beach | MA563 | 029 Point Reyes (600 m) | 55.3 | regional | 301 | -1.9 | 1.9 | 721 | -4.3 | 4.3 | 0.62 | – | 0 | – | – | – | 301 | +1.6 | NW short 183, NW mid 170, W mid 105, S long 96, W long 83, NW long 80 |
| Waddell Creek | SC319 | 156 Monterey Canyon Outer (133 m) | 47.4 | regional | 35 | +0.4 | 0.9 | 718 | -0.9 | 1.1 | 0.70 | – | 0 | – | – | – | 35 | +0.6 | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Manresa | SC049 | 156 Monterey Canyon Outer (133 m) | 20.5 | regional | 25 | +0.1 | 0.4 | 718 | -1.7 | 1.7 | 0.54 | – | 0 | – | – | – | 25 | +1.3 | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Moss Landing | MO893 | 156 Monterey Canyon Outer (133 m) | 15.1 | regional | 283 | -0.0 | 0.6 | 718 | -2.2 | 2.2 | 0.45 | – | 0 | – | – | – | 286 | +2.3 | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Asilomar | MO716 | 156 Monterey Canyon Outer (133 m) | 15.6 | regional | 322 | +1.7 | 1.7 | 718 | -0.2 | 0.7 | 0.80 | – | 0 | – | – | – | 325 | +1.9 | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Carmel Beach | MO646 | 156 Monterey Canyon Outer (133 m) | 23.0 | regional | 42 | +0.4 | 0.6 | 718 | -1.5 | 1.5 | 0.60 | – | 0 | – | – | – | 42 | +2.3 | W mid 291, W long 147, NW mid 128, NW short 71, W short 57, S long 19 |
| Sand Dollar | MO111 | 157 Point Sur (366 m) | 74.0 | regional | 219 | -2.7 | 2.7 | 430 | -3.4 | 3.4 | 0.77 | – | 0 | – | – | – | 305 | +0.7 | NW mid 240, NW long 56, W mid 54, W long 40, NW short 22, S long 12 |
| Morro Rock | SL347 | 076 Diablo Canyon (27.43 m) | 18.7 | nearby | 359 | +0.5 | 0.7 | 721 | -1.1 | 1.2 | 0.91 | 285 (26 km) | 359 | +1.7 | 1.7 | same | 359 | +1.5 | W mid 284, W long 169, S long 141, W short 51, NW short 46, NW mid 20 |
| Pismo Beach Pier | SL091 | 285 Avila Beach Nearshore (15 m) | 9.0 | nearby | 106 | +1.6 | 1.6 | 721 | +0.8 | 0.8 | 1.28 | 285 (9 km) | 106 | +1.3 | 1.3 | same | 106 | +1.2 | S long 497, S mid 221 |
| Jalama | B1084 | 071 Harvest (550 m) | 26.3 | regional | 97 | -0.9 | 0.9 | 711 | -3.2 | 3.2 | – | – | 0 | – | – | – | 97 | +1.3 | S long 140, NW mid 131, W long 118, W mid 113, NW short 103, NW long 69, S mid 33 |
| Rincon | B0001 | none with data within 80 km | – | – | 0 | – | – | 0 | – | – | – | – | 0 | – | – | – | 0 | – | – |
| C Street | VE466 | 103 Topanga Nearshore (20 m) | 72.1 | regional | 66 | -0.1 | 0.4 | 581 | -0.0 | 0.4 | 1.08 | – | 0 | – | – | – | 46 | +0.2 | S long 436, S mid 120, W short 23 |
| County Line | VE019 | 103 Topanga Nearshore (20 m) | 35.7 | regional | 552 | +0.9 | 0.9 | 706 | +0.6 | 0.6 | 1.34 | 103 (36 km) | 552 | +0.1 | 0.3 | same | 562 | +0.3 | S long 522, S mid 153, W short 25 |
| Zuma | L1059 | 103 Topanga Nearshore (20 m) | 22.5 | nearby | 572 | +0.6 | 0.7 | 706 | +0.7 | 0.8 | 1.40 | 103 (22 km) | 572 | -0.4 | 0.5 | same | 583 | -0.1 | S long 522, S mid 153, W short 25 |
| Malibu (Surfrider) | L0904 | 103 Topanga Nearshore (20 m) | 9.3 | nearby | 560 | +0.6 | 0.6 | 706 | -0.0 | 0.4 | 1.06 | 103 (9 km) | 560 | +0.3 | 0.4 | same | 570 | +0.5 | S long 522, S mid 153, W short 25 |
| Topanga | L0809 | 103 Topanga Nearshore (20 m) | 1.8 | co-located | 563 | +0.7 | 0.7 | 706 | -0.1 | 0.3 | 1.03 | 103 (2 km) | 563 | +0.5 | 0.6 | -0.1 / 0.3 | 572 | +0.7 | S long 522, S mid 153, W short 25 |
| El Porto | L0577 | 103 Topanga Nearshore (20 m) | 19.8 | nearby | 53 | +0.6 | 0.6 | 706 | +0.3 | 0.4 | 1.18 | 103 (20 km) | 53 | -0.2 | 0.3 | same | 55 | -0.1 | S long 522, S mid 153, W short 25 |
| Hermosa Pier | L0530 | 103 Topanga Nearshore (20 m) | 24.1 | nearby | 94 | +0.2 | 0.4 | 706 | -0.2 | 0.4 | 0.98 | 028 (22 km) | 96 | -0.0 | 0.5 | same | 96 | +0.2 | S long 522, S mid 153, W short 25 |
| Huntington Pier | OC517 | 215 Long Beach Channel (23.25 m) | 19.0 | nearby | 0 | – | – | 721 | -0.7 | 0.7 | 1.19 | – | 0 | – | – | – | 0 | – | S long 502, W long 112, S mid 78, W mid 18 |
| The Wedge | OC379 | 284 Capistrano Beach Nearshore (11.13 m) | 24.9 | nearby | 627 | -0.1 | 0.5 | 719 | -0.7 | 0.7 | 0.85 | 284 (25 km) | 627 | +0.4 | 0.6 | same | 628 | +0.6 | S long 604, S mid 105 |
| Salt Creek | OC177 | 284 Capistrano Beach Nearshore (11.13 m) | 5.9 | nearby | 522 | -0.9 | 0.9 | 719 | -0.6 | 0.7 | 0.89 | 284 (6 km) | 522 | -0.5 | 0.5 | same | 524 | -0.3 | S long 604, S mid 105 |
| Trestles | D1206 | 284 Capistrano Beach Nearshore (11.13 m) | 10.9 | nearby | 629 | +0.1 | 0.5 | 719 | -0.2 | 0.4 | 1.01 | 284 (11 km) | 629 | +0.1 | 0.5 | same | 631 | +0.3 | S long 604, S mid 105 |
| Oceanside Pier | D0905 | 262 Leucadia Nearshore (17 m) | 16.1 | nearby | 585 | +0.6 | 0.7 | 679 | +0.2 | 0.4 | 1.12 | 262 (16 km) | 585 | +0.1 | 0.4 | same | 625 | +0.3 | W long 503, W mid 110, W short 30, S long 22, S mid 13 |
| Swami’s | D0704 | 262 Leucadia Nearshore (17 m) | 3.6 | co-located | 540 | +0.1 | 0.3 | 679 | -0.1 | 0.3 | 1.01 | 262 (4 km) | 540 | +0.0 | 0.3 | same | 579 | +0.1 | W long 503, W mid 110, W short 30, S long 22, S mid 13 |
| Cardiff Reef | D0681 | 262 Leucadia Nearshore (17 m) | 6.1 | nearby | 514 | +0.1 | 0.4 | 679 | -0.2 | 0.3 | 0.98 | 262 (6 km) | 514 | +0.2 | 0.4 | same | 552 | +0.3 | W long 503, W mid 110, W short 30, S long 22, S mid 13 |
| Black’s Beach | D0541 | 201 Scripps Nearshore (41 m) | 2.7 | co-located | 33 | +0.3 | 0.4 | 366 | +0.2 | 0.4 | 1.21 | 201 (3 km) | 33 | +0.0 | 0.3 | same | 33 | +0.1 | W short 164, W long 84, W mid 64, NW long 27, NW short 15, NW mid 12 |
| Windansea | D0457 | 201 Scripps Nearshore (41 m) | 4.4 | co-located | 46 | +0.4 | 0.5 | 366 | +0.5 | 0.6 | 1.37 | 201 (4 km) | 46 | -0.2 | 0.4 | same | 47 | +0.0 | W short 164, W long 84, W mid 64, NW long 27, NW short 15, NW mid 12 |
| Ocean Beach (San Diego) | D0352 | 201 Scripps Nearshore (41 m) | 13.3 | nearby | 23 | +0.8 | 0.8 | 366 | +0.7 | 0.8 | 1.48 | 201 (13 km) | 23 | -0.2 | 0.3 | same | 23 | +0.1 | W short 164, W long 84, W mid 64, NW long 27, NW short 15, NW mid 12 |
| Imperial Beach | D0054 | 201 Scripps Nearshore (41 m) | 34.4 | regional | 44 | +1.2 | 1.2 | 366 | +0.1 | 0.3 | 1.14 | 201 (34 km) | 44 | +0.8 | 0.8 | same | 82 | +1.3 | W short 164, W long 84, W mid 64, NW long 27, NW short 15, NW mid 12 |

## 3. Held-out trials of a per-spot factor

Fit on the first 2/3 of the archive hours (median observed ÷ model), reported on the last 1/3 of the archive, then applied unchanged to the recent window (same anchor buoy when it has recent data, else the recent window's own anchor, named). Verdict: **supported** = clears the rule on the archive held-out hours AND does not worsen the recent window's MAE (at least 50 recent hours); **archive only** = clears the rule but the recent window has too few anchored hours to confirm; **contradicted** = clears the archive rule but makes the recent window worse; **not supported** = does not clear the rule. Rule (`CORRECTION_RULE`, our judgement): at least 200 fit and 100 held-out hours, at least 2 swell regimes in the fit window, a factor at least 10% from 1, and a held-out MAE that improves by at least 20% and 0.3 ft. "MOP point vs buoy" is tried only at a co-located buoy that MOP says sees the same waves (point ÷ buoy site 0.9–1.1). Clearing the rule is evidence; what the app does with it is in the notes.

| spot | what is corrected | fit n | held-out n | factor | archive held-out bias / MAE before, ft | after, ft | recent n: bias / MAE before | recent after | outcome |
|---|---|---|---|---|---|---|---|---|---|
| Bolinas | v1 vs (d), anchor 142 | 28 | 15 | – | -0.1 / 0.2 | – | 142, 53 h: +0.8 / 0.8 | – | not supported: too few hours (fit 28, held-out 15; need 200 and 100) |
| Ocean Beach | v1 vs (d), anchor 142 | 1450 | 725 | 1.48 | -2.6 / 2.6 | -0.1 / 0.8 | 142, 212 h: -1.9 / 1.9 | +0.4 / 0.7 | **supported**: held-out MAE 2.57 → 0.81 ft |
| Linda Mar | v1 vs (d), anchor 142 | 1376 | 689 | 0.86 | +0.7 / 0.7 | -0.1 / 0.5 | 142, 224 h: +0.8 / 0.9 | +0.0 / 0.4 | not supported: held-out MAE 0.75 → 0.46 ft does not clear the rule (20% and 0.3 ft) |
| Montara | v1 vs (d), anchor 142 | 1563 | 782 | 0.77 | +1.3 / 1.3 | -0.2 / 0.5 | 142, 277 h: +1.1 / 1.1 | -0.2 / 0.4 | **supported**: held-out MAE 1.29 → 0.53 ft |
| Steamer Lane | v1 vs (d), anchor 156 | 30 | 16 | – | +0.3 / 0.4 | – | – | – | not supported: too few hours (fit 30, held-out 16; need 200 and 100) |
| Pleasure Point | v1 vs (d), anchor 156 | 43 | 22 | – | +0.6 / 0.6 | – | – | – | not supported: too few hours (fit 43, held-out 22; need 200 and 100) |
| Davenport | v1 vs (d), anchor 156 | 646 | 323 | 0.87 | +0.8 / 0.9 | +0.1 / 0.5 | – | – | archive only: held-out MAE 0.95 → 0.53 ft |
| Manresa | v1 vs (d), anchor 156 | 110 | 56 | – | +1.0 / 1.0 | – | – | – | not supported: too few hours (fit 110, held-out 56; need 200 and 100) |
| Moss Landing | v1 vs (d), anchor 156 | 1417 | 709 | 0.48 | +2.9 / 2.9 | -0.4 / 0.6 | – | – | archive only: held-out MAE 2.92 → 0.60 ft |
| Asilomar | v1 vs (d), anchor 156 | 1776 | 889 | 0.77 | +1.6 / 1.8 | -0.1 / 1.0 | – | – | archive only: held-out MAE 1.77 → 1.04 ft |
| Carmel Beach | v1 vs (d), anchor 156 | 842 | 421 | 0.56 | +2.9 / 2.9 | -0.2 / 0.7 | – | – | archive only: held-out MAE 2.91 → 0.73 ft |
| County Line | v1 vs (d), anchor 028 | 762 | 381 | 1.01 | +0.1 / 0.4 | +0.1 / 0.4 | 028, 562 h: +0.3 / 0.5 | +0.4 / 0.5 | not supported: the fitted ratio 1.01 is within 10% of 1: no correction needed |
| Zuma | v1 vs (d), anchor 028 | 1340 | 671 | 1.14 | -0.3 / 0.5 | -0.0 / 0.4 | 028, 583 h: -0.1 / 0.4 | +0.3 / 0.5 | not supported: held-out MAE 0.47 → 0.38 ft does not clear the rule (20% and 0.3 ft) |
| Malibu (Surfrider) | v1 vs (d), anchor 028 | 705 | 353 | 0.85 | +0.4 / 0.4 | +0.1 / 0.3 | 028, 570 h: +0.5 / 0.5 | +0.0 / 0.3 | not supported: held-out MAE 0.42 → 0.26 ft does not clear the rule (20% and 0.3 ft) |
| Topanga | v1 vs (d), anchor 028 | 701 | 351 | 0.78 | +0.5 / 0.5 | +0.0 / 0.2 | 028, 572 h: +0.7 / 0.7 | +0.0 / 0.3 | **supported**: held-out MAE 0.50 → 0.19 ft |
| El Porto | v1 vs (d), anchor 028 | 1080 | 541 | 1.25 | -0.8 / 0.9 | +0.0 / 0.6 | 028, 55 h: -0.3 / 0.6 | +0.4 / 0.8 | not supported: held-out MAE 0.87 → 0.58 ft does not clear the rule (20% and 0.3 ft) |
| Hermosa Pier | v1 vs (d), anchor 028 | 1078 | 540 | 1.20 | -0.5 / 0.7 | +0.1 / 0.6 | 028, 96 h: -0.0 / 0.5 | +0.5 / 0.7 | not supported: held-out MAE 0.66 → 0.56 ft does not clear the rule (20% and 0.3 ft) |
| The Wedge | v1 vs (d), anchor 215 | 826 | 414 | 1.01 | -0.4 / 0.5 | -0.3 / 0.5 | 284, 627 h: +0.4 / 0.6 | +0.4 / 0.6 | not supported: the fitted ratio 1.01 is within 10% of 1: no correction needed |
| Salt Creek | v1 vs (d), anchor 264 | 1396 | 698 | 1.12 | -0.5 / 0.5 | -0.2 / 0.4 | 284, 522 h: -0.5 / 0.5 | -0.1 / 0.4 | not supported: held-out MAE 0.52 → 0.37 ft does not clear the rule (20% and 0.3 ft) |
| Trestles | v1 vs (d), anchor 264 | 1089 | 545 | 0.92 | +0.1 / 0.3 | -0.1 / 0.3 | 284, 629 h: +0.1 / 0.5 | -0.2 / 0.5 | not supported: the fitted ratio 0.92 is within 10% of 1: no correction needed |
| Oceanside Pier | v1 vs (d), anchor 264 | 1626 | 813 | 1.07 | +0.0 / 0.3 | +0.2 / 0.3 | 262, 585 h: +0.1 / 0.4 | +0.4 / 0.5 | not supported: the fitted ratio 1.07 is within 10% of 1: no correction needed |
| Swami’s | v1 vs (d), anchor 201 | 1720 | 861 | 1.06 | +0.2 / 0.3 | +0.4 / 0.4 | 201, 278 h: -0.0 / 0.3 | +0.2 / 0.4 | not supported: the fitted ratio 1.06 is within 10% of 1: no correction needed |
| Cardiff Reef | v1 vs (d), anchor 201 | 1540 | 771 | 1.02 | +0.3 / 0.4 | +0.4 / 0.4 | 201, 257 h: +0.2 / 0.3 | +0.2 / 0.4 | not supported: the fitted ratio 1.02 is within 10% of 1: no correction needed |
| Black’s Beach | v1 vs (d), anchor 201 | 904 | 452 | 1.00 | +0.5 / 0.6 | +0.5 / 0.6 | 201, 33 h: +0.0 / 0.3 | +0.0 / 0.3 | not supported: the fitted ratio 1.00 is within 10% of 1: no correction needed |
| Windansea | v1 vs (d), anchor 201 | 962 | 481 | 0.98 | +0.5 / 0.6 | +0.4 / 0.6 | 201, 46 h: -0.2 / 0.4 | -0.2 / 0.4 | not supported: the fitted ratio 0.98 is within 10% of 1: no correction needed |
| Ocean Beach (San Diego) | v1 vs (d), anchor 201 | 1067 | 534 | 1.00 | +0.4 / 0.6 | +0.3 / 0.6 | 201, 23 h: -0.2 / 0.3 | -0.2 / 0.3 | not supported: the fitted ratio 1.00 is within 10% of 1: no correction needed |
| Imperial Beach | v1 vs (d), anchor 155 | 1224 | 613 | 0.65 | +1.4 / 1.4 | -0.0 / 0.4 | 201, 44 h: +0.8 / 0.8 | -0.7 / 0.7 | archive only: held-out MAE 1.41 → 0.38 ft |

### 3b. Each supported factor by wave size

Held-out archive hours and the later window, binned by the OFFSHORE total Hs at the spot's marine point (Open-Meteo, the height v1 starts from, so the app can pick the bin at run time). Bias / MAE in ft, v1 before and after the factor, against the observation-anchored height. Rule (`BIN_RULE`): the factor is applied only in a bin with at least 30 held-out hours whose MAE gets smaller and whose later-window MAE (when it has 30 hours or more) does not get worse; in every other bin v1 is shown uncorrected.

| spot | factor | offshore Hs bin | held-out n | before | after | later n | before | after | outcome |
|---|---|---|---|---|---|---|---|---|---|
| Ocean Beach | ×1.48 | under 4 ft | 160 | -1.5 / 1.5 | -0.2 / 0.5 | 27 | -0.9 / 0.9 | +0.5 / 0.6 | **factor applies** |
| Ocean Beach | ×1.48 | 4–8 ft | 508 | -2.8 / 2.8 | -0.1 / 0.8 | 183 | -2.1 / 2.1 | +0.4 / 0.7 | **factor applies** |
| Ocean Beach | ×1.48 | 8–12 ft | 57 | -3.6 / 3.6 | +0.4 / 1.3 | 2 | -1.5 / 1.5 | +2.0 / 2.0 | **factor applies** |
| Ocean Beach | ×1.48 | 12 ft and up | 0 | – | – | 0 | – | – | no factor: only 0 held-out hours |
| Montara | ×0.77 | under 4 ft | 70 | +0.3 / 0.4 | -0.4 / 0.4 | 9 | +0.5 / 0.5 | -0.3 / 0.3 | no factor: held-out MAE not smaller |
| Montara | ×0.77 | 4–8 ft | 479 | +1.1 / 1.1 | -0.2 / 0.5 | 233 | +1.1 / 1.1 | -0.2 / 0.5 | **factor applies** |
| Montara | ×0.77 | 8–12 ft | 215 | +1.8 / 1.9 | -0.2 / 0.7 | 35 | +1.7 / 1.7 | -0.1 / 0.3 | **factor applies** |
| Montara | ×0.77 | 12 ft and up | 18 | +2.1 / 2.1 | -0.5 / 0.7 | 0 | – | – | no factor: only 18 held-out hours |
| Davenport | ×0.87 | under 4 ft | 44 | +0.6 / 0.7 | +0.3 / 0.5 | 0 | – | – | **factor applies** |
| Davenport | ×0.87 | 4–8 ft | 153 | +0.6 / 0.8 | -0.0 / 0.5 | 0 | – | – | **factor applies** |
| Davenport | ×0.87 | 8–12 ft | 118 | +1.1 / 1.3 | +0.1 / 0.7 | 0 | – | – | **factor applies** |
| Davenport | ×0.87 | 12 ft and up | 8 | +1.0 / 1.0 | -0.2 / 0.5 | 0 | – | – | no factor: only 8 held-out hours |
| Moss Landing | ×0.48 | under 4 ft | 137 | +1.4 / 1.4 | -0.2 / 0.3 | 0 | – | – | **factor applies** |
| Moss Landing | ×0.48 | 4–8 ft | 407 | +2.7 / 2.7 | -0.5 / 0.7 | 0 | – | – | **factor applies** |
| Moss Landing | ×0.48 | 8–12 ft | 165 | +4.7 / 4.7 | -0.2 / 0.6 | 0 | – | – | **factor applies** |
| Moss Landing | ×0.48 | 12 ft and up | 0 | – | – | 0 | – | – | no factor: only 0 held-out hours |
| Asilomar | ×0.77 | under 4 ft | 8 | +1.4 / 1.4 | +0.7 / 0.7 | 0 | – | – | no factor: only 8 held-out hours |
| Asilomar | ×0.77 | 4–8 ft | 528 | +1.4 / 1.5 | +0.0 / 0.9 | 0 | – | – | **factor applies** |
| Asilomar | ×0.77 | 8–12 ft | 314 | +1.9 / 2.1 | -0.3 / 1.4 | 0 | – | – | **factor applies** |
| Asilomar | ×0.77 | 12 ft and up | 39 | +2.7 / 2.8 | -0.1 / 0.8 | 0 | – | – | **factor applies** |
| Carmel Beach | ×0.56 | under 4 ft | 24 | +1.1 / 1.1 | -0.1 / 0.2 | 0 | – | – | no factor: only 24 held-out hours |
| Carmel Beach | ×0.56 | 4–8 ft | 205 | +2.2 / 2.2 | -0.4 / 0.7 | 0 | – | – | **factor applies** |
| Carmel Beach | ×0.56 | 8–12 ft | 171 | +4.0 / 4.0 | +0.2 / 0.8 | 0 | – | – | **factor applies** |
| Carmel Beach | ×0.56 | 12 ft and up | 21 | +3.3 / 3.3 | -1.5 / 1.5 | 0 | – | – | no factor: only 21 held-out hours |
| Topanga | ×0.78 | under 4 ft | 351 | +0.5 / 0.5 | +0.0 / 0.2 | 551 | +0.7 / 0.7 | +0.0 / 0.3 | **factor applies** |
| Topanga | ×0.78 | 4–8 ft | 0 | – | – | 21 | +1.2 / 1.3 | +0.3 / 0.6 | no factor: only 0 held-out hours |
| Topanga | ×0.78 | 8–12 ft | 0 | – | – | 0 | – | – | no factor: only 0 held-out hours |
| Topanga | ×0.78 | 12 ft and up | 0 | – | – | 0 | – | – | no factor: only 0 held-out hours |
| Imperial Beach | ×0.65 | under 4 ft | 312 | +0.8 / 0.8 | -0.2 / 0.3 | 5 | +0.5 / 0.5 | -0.4 / 0.4 | **factor applies** |
| Imperial Beach | ×0.65 | 4–8 ft | 289 | +1.9 / 1.9 | +0.1 / 0.4 | 39 | +0.9 / 0.9 | -0.7 / 0.7 | **factor applies** |
| Imperial Beach | ×0.65 | 8–12 ft | 12 | +4.6 / 4.6 | +1.6 / 1.6 | 0 | – | – | no factor: only 12 held-out hours |
| Imperial Beach | ×0.65 | 12 ft and up | 0 | – | – | 0 | – | – | no factor: only 0 held-out hours |

## 4. MOP at the buoy by wave height (archive window)

Median observed ÷ MOP at the buoy's own site, binned by the OBSERVED height at the buoy (a bin needs 12 hours). A ratio falling below 1 as the waves grow means the buoy measured less than the model in big surf: at a shallow site this is consistent with waves breaking before the buoy (MOP propagates swell linearly and has no surf-zone breaking), though other explanations are not ruled out.

| buoy | depth | under 4 ft | 4–8 ft | 8–12 ft | 12 ft and up |
|---|---|---|---|---|---|
| 142 San Francisco Bar | 16.46 m | 1.00 (1337 h) | 0.97 (2479 h) | 0.98 (491 h) | 0.98 (35 h) |
| 076 Diablo Canyon | 27.43 m | 1.20 (431 h) | 1.22 (1008 h) | 1.18 (182 h) | – (3 h) |
| 215 Long Beach Channel | 23.25 m | 1.21 (3924 h) | 1.30 (419 h) | – (1 h) | – (0 h) |
| 264 Red Beach Nearshore | 16.79 m | 1.00 (4084 h) | 1.04 (250 h) | – (7 h) | – (0 h) |
| 201 Scripps Nearshore | 41 m | 0.98 (4161 h) | 0.98 (183 h) | – (1 h) | – (0 h) |
| 158 Cabrillo Point Nearshore (Monterey Bay) | 17 m | 1.27 (3312 h) | 1.40 (1025 h) | – (6 h) | – (0 h) |
| 155 Imperial Beach Nearshore | 21 m | 1.01 (3706 h) | 0.98 (633 h) | – (6 h) | – (0 h) |
| 156 Monterey Canyon Outer | 133 m | 0.88 (1261 h) | 0.92 (2645 h) | 0.96 (395 h) | 1.02 (40 h) |
| 168 Humboldt Bay North Spit | 110 m | 1.02 (374 h) | 1.08 (2272 h) | 1.10 (1436 h) | 1.08 (263 h) |
| 028 Santa Monica Bay | 387 m | 1.03 (3618 h) | 1.08 (697 h) | 1.14 (30 h) | – (0 h) |
| 094 Cape Mendocino | 346 m | 1.01 (256 h) | 1.05 (2037 h) | 1.08 (1507 h) | 1.18 (537 h) |
| 157 Point Sur | 366 m | 1.09 (416 h) | 1.06 (2497 h) | 1.09 (1159 h) | 1.18 (269 h) |

<!-- notes -->
## T-131 phase 2 notes (written 2026-11-06, revised after the data-honesty review; the tables above are regenerated by the script, these notes are not)

### What the observations say
1. **MOP is right at most nearshore buoys that can check it.** The exceptions are Cabrillo Point and Diablo Canyon. At San Francisco Bar (142), Red Beach (264), Scripps (201), Imperial Beach (155), Avila (285), Topanga (103), Capistrano (284), Leucadia (262) and Del Mar (153), the model at the buoy's own site is within 0.2 ft bias and 0.2–0.6 ft MAE, over hundreds to thousands of hours. Long Beach Channel (215) reads −0.5 ft in the archive and −1.2 ft recently. MOP is **not** confirmed at:
   - Cabrillo Point in Monterey Bay: about 30% more was measured than the model;
   - Diablo Canyon: about 20% more;
   - the deep Point Reyes, Cape Mendocino and Point Sur buoys: the model reads low.
   
   "MOP right here" is now judged on each window's first 2/3 of hours only. With that rule, the outer Monterey Canyon buoy (156) passes in the archive but not recently.
2. **Ocean Beach.** The SF Bar buoy (16 m deep, 11 km out) agrees with MOP at its own site, not with v1. In the archive the bias is +0.1 ft and the MAE 0.6 ft over 4,342 h; recently −0.1 / 0.4 ft over 717 h. v1 reads 0.8 ft below the bar buoy itself, and 2.5 ft (archive) / 1.9 ft (recent) below the observation carried to SF023 by MOP. MOP puts SF023 at about 1.25 × the bar site.
   - **Big swell: no evidence that SF023 reads high.** The first draft binned the bar buoy by MOP's own height and showed the measured waves falling 9–16% below the model in big swell. Binned by the **observed** height (section 4), the ratio is 0.97–1.00 at every size. The earlier drop was a selection effect of binning by the model. The big-swell caveat was therefore withdrawn. SF023 itself (10 m) is still not measured by any buoy.
3. **Moss Landing, Carmel, Asilomar.** These spots have only archive evidence, anchored on the outer canyon buoy (156). It points the same way as the first look: v1 reads high, by 2.9 ft at Moss Landing, 2.9 ft at Carmel and 1.8 ft at Asilomar. The candidate factors are ×0.48, ×0.56 and ×0.77; section 3b gives them by size. **None is applied.** The later window cannot confirm them, because MOP fails the check at 156 there. MOP is also about 30% low at Cabrillo Point, the nearshore buoy in the bay. The MOP points carry a one-line caveat instead.
4. **Jalama.** The only buoy in reach is Harvest (550 m deep, 26 km), and CDIP flags its model check point bad. Nothing can check Jalama, so it gets a caveat and no change.
5. **Linda Mar.** Re-checked 2026-11-07 on the beach's own point. CDIP's MOP pages put the back-beach end of SM375 (and SM376) on the rocky north side of San Pedro Point, about 800 m west of the sand; the transects that land on Pacifica State Beach are SM380–SM385, which share one output point 15 m deep. Linda Mar now uses SM382 (facing-match rule; normal 312°). SM375 reads about 20% below SM382 in the archive window (3.87 vs 4.84 ft) and 17% below in the recent one (3.72 vs 4.49 ft), which accounts for the whole earlier gap. On SM382, v1 reads 0.7 ft high against the SF Bar-anchored height (archive MAE 0.79 ft; recent 0.85 ft), and MOP at SM382 against the bar buoy has an average error of 0.75 ft (was 1.48 ft at SM375). The candidate ×0.86 brings the held-out MAE from 0.75 to 0.46 ft: under the 0.3 ft part of the rule, so **no factor**. The ×0.67 held before was fitted to the wrong point and is withdrawn.
6. **Southern California.** v1 is already within about 0.5 ft of the anchored height at most spots. Topanga reads 0.5–0.7 ft high and is corrected, under 4 ft offshore only. In the later window it is also checked against the Topanga buoy 2 km away: MAE 0.6 → 0.3 ft. Imperial Beach clears the rule on the archive, against the buoy 3 km away: 1.4 → 0.4 ft. The later window has only 44 anchored hours there, so it is **not applied** (archive only).

### What changed (all v1 only; no MOP number changed)
`src/ocean/buoyTransfer.ts` holds the factors; they are applied in `faceEstimate`, `src/ocean/openMeteo.ts`.
- **Where:** only in the offshore-Hs bins where the factor held (section 3b). Elsewhere v1 is shown uncorrected.
- **What it scales:** the surf height × factor and the breaking height × factor^0.8. The uncorrected values are kept on the record.
- **On screen:**
  - a visible tag "· buoy-corrected ×1.48" beside "model estimate" on the spot page, the Explore callout and the Home cards;
  - "before our correction: X ft" in the detail line;
  - the method line names the buoy, the MOP point and its review status, the fitting dates and the held-out dates with the error against "that buoy height carried to MOP point <id>".
- **Personal calibration:** pairs now store the factor (`ModelPair.transfer`, archive `tf`). Old v1 pairs are put on today's scale (`v1CentralOnCurrentScale`), so the personal calibration never compounds with the factor.

| spot | factor | MOP point (status) | anchor buoy | fitted on | held-out v1 MAE before → after | later window (doc only), Oct 7–Nov 6 2026 | applied when offshore Hs is |
|---|---|---|---|---|---|---|---|
| Ocean Beach | ×1.48 | SF023 (the point CDIP documents for OB) | 142 SF Bar, 11 km | 1 Nov 2025–26 Jan 2026 | 2.57 → 0.81 ft (725 h, 26 Jan–28 Apr 2026) | 1.94 → 0.68 ft (212 h) | under 12 ft (no held-out hours above) |
| Montara | ×0.77 | SM340 (facing-match rule, not reviewed) | 142 SF Bar, 29 km | 1 Nov 2025–29 Jan 2026 | 1.29 → 0.53 ft (782 h, 29 Jan–28 Apr 2026) | 1.12 → 0.43 ft (277 h) | 4–12 ft (under 4 ft it did not help) |
| Topanga | ×0.78 | L0809 (facing-match rule, not reviewed) | 028 Santa Monica Bay, 21 km | 1 Nov 2025–26 Mar 2026 | 0.50 → 0.19 ft (351 h, 26 Mar–29 Apr 2026) | 0.75 → 0.32 ft (572 h) | under 4 ft (no held-out hours above) |

**On-screen caveats from the observations** (`BUOY_CAVEATS`, `src/ocean/mop.ts`): one sentence beside the number, with the figures in the Nearshore panel ("Measured-buoy check"). They cover Moss Landing, Asilomar and Carmel ("measured waves near Pacific Grove do not confirm CDIP's model…"), Morro Rock (the two nearest buoys disagree) and Jalama (no buoy can check).
- **Side effect:** the MOP-only hours at these five spots now read "low" confidence, under the T-130 rule that a caveated point is low. That is intended for points no buoy confirms.
- **No "big swell only" mechanism was added.** Its only use was the Ocean Beach caveat, which the observed-height binning withdrew.

### What did not change, and why
- **No MOP number was changed.** The evidence is at buoys, not at the points.
- **Linda Mar:** no factor. On its own beach point (SM382) the gain is 0.29 ft, under the rule; the earlier ×0.67 came from the San Pedro Point transect SM375.
- **Moss Landing, Carmel, Asilomar, Davenport, Imperial Beach:** archive only.
- **Salmon Creek and Dillon Beach:** anchor beyond 40 km.
- **El Porto, Hermosa, Zuma, Malibu, Salt Creek:** gains under the rule.
- Every factor within 10% of 1.
- **No v1-vs-MOP switch:** MOP is already the headline wherever it has the hour.
- **Limits:**
  - The v1 history is Open-Meteo's archived short-range runs, not the days-ahead forecast.
  - The MOP history is the nowcast; the forward MOP forecast has no archive.
  - The archive is winter–spring and the later window autumn.
  - The size bins assume the bins where a factor holds are contiguous.
