# Rating audit: does the rating oversell? (2026-11-06)

Generated 2026-11-09T05:32Z by `docs/forecast/data/rating-audit.ts`. Reproduce: `ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit.ts --archive 2025-11-01T00:00:00Z/2026-05-01T00:00:00Z --recent 2026-10-07T00:00:00Z/2026-11-06T00:00:00Z` (the cache is optional; the same public downloads as `ACCURACY-VS-BUOYS.md`). Findings and decisions: the notes at the end.

**The question.** Surfline's most common complaint is driving to a "fair" or "good" rating and finding it flat or blown out. How often does OUR rating say fair or better when the observed conditions were poor? Asked two ways, to separate "the rating rules oversell" from "the forecast inputs were wrong".

**What each number is.**
- **Observed surf** = **buoy carried to the point (model-assisted)**: a wave buoy's measured Hs × MOP's own hourly ratio (spot point ÷ buoy site), only from a buoy within 40 km where MOP is right at the buoy (the T-131 rule, judged on each window's first 2/3). Not a measurement at the spot. "Under 1 ft" is in the app's surf-height convention (about the nearshore Hs).
- **Observed wind** = **measured at a coastal station**, not at the break: nearest shore station within 7 km (a fixed NDBC/NOS met station or an airport ASOS via the Iowa Environmental Mesonet, either kind not in enclosed water by src/map/enclosed.ts), with wind on 200+ hours of the window; no offshore buoys. NOAA stations: the reading on the hour (NDBC stdmet via NOAA ERDDAP `cwwcNDBCMet`), ids, names and positions from NDBC's `activestations.xml`. Airports: the routine hourly METAR within 10 minutes of the hour (IEM ASOS archive, `docs/forecast/data/shore-wind.ts`); an airfield reads land wind, often lighter than on the water. No anemometer-height correction (stations stand 4–20 m up; the forecast is 10 m).
- **Forecast-fed rating** = the app's engine (`rateForecast`, the provisional rating) on the **Open-Meteo Marine and Open-Meteo Weather hours for the window**: the archived short-range model runs Open-Meteo serves for past dates (historical-forecast API for the archive window, `past_days` for the recent one). That is close to a nowcast, NOT the days-ahead forecast a surfer plans with, so these are the best the inputs get. The lead-dependent ceiling is judged 24 h ahead. The rating never reads MOP (it judges the offshore swell; CONTRACTS T-130).
- **Observed-fed rating** = the same engine on the measured inputs: the anchor buoy's Hs, peak period and peak direction as the swell (bulk values: no swell partition, no secondary swell) and the station's wind and gust. Only hours with both.
- **The Call** (`hourCall`) uses the surf estimate, which in the app is MOP's forward forecast. That has no public archive, so the audit gives the Call **MOP's nowcast at the spot's point as a stand-in** (an upper bound on what the Call had) and the Open-Meteo hours above. Skill ranges only (no personal preferred range).
- **Poor** = observed surf under 1 ft, or observed onshore wind over 12 mph (the Call's own "Skip" line, `ONSHORE_BAD_MPH`; onshore = within 45° of the spot's facing, the engine's rule). **Fair or better** = score 40 and up (the fair and good colour bands: SURFABLE, NOT BAD, SOLID and up). Daylight hours only (the app does not rate dark hours).
- Every threshold here is OUR OWN CHOICE. This is an audit against observations at a distance, not a validated accuracy figure.

## 1. Stations per spot

Spots with an anchor buoy or a wind station in the window. Orientation = the spot's facing the engine uses.

### Archive window
| spot | facing | anchor buoy (observed surf) | wind station | daylight hours |
|---|---|---|---|---|
| Bolinas | 135° | 142 San Francisco Bar, 14.1 km | – | 2124 |
| Stinson Beach | 225° | 142 San Francisco Bar, 12.5 km | – | 2123 |
| Ocean Beach | 263.49° | 142 San Francisco Bar, 11.2 km | – | 2125 |
| Linda Mar | 315° | 142 San Francisco Bar, 23.9 km | – | 2125 |
| Montara | 270° | 142 San Francisco Bar, 28.9 km | HAF (Half Moon Bay; asos, airport ASOS via Iowa Environmental Mesonet), 3.7 km | 2129 |
| Mavericks | 202.5° | 142 San Francisco Bar, 34.6 km | HAF (Half Moon Bay; asos, airport ASOS via Iowa Environmental Mesonet), 2.1 km | 2129 |
| Steamer Lane | 135° | 156 Monterey Canyon Outer, 22.4 km | – | 2126 |
| Cowell’s | 112.5° | 156 Monterey Canyon Outer, 23.5 km | – | 2126 |
| Pleasure Point | 157.5° | 156 Monterey Canyon Outer, 21.9 km | – | 2126 |
| Davenport | 225° | 156 Monterey Canyon Outer, 35.5 km | – | 2127 |
| Crescent City | 202.5° | – | CECC1 (9419750 - Crescent City, CA; fixed, NOS), 0.3 km | 2074 |
| Moonstone Beach | 270° | – | ACV (ARCATA/EUREKA ARPT; asos, airport ASOS via Iowa Environmental Mesonet), 6.1 km | 2107 |
| Point Arena | 225° | – | ANVC1 (9416841 - Arena Cove, CA; fixed, NOS), 0.1 km | 1675 |
| Manresa | 247.5° | 156 Monterey Canyon Outer, 20.5 km | WVI (Watsonville; asos, airport ASOS via Iowa Environmental Mesonet), 6.7 km | 2131 |
| Moss Landing | 270° | 156 Monterey Canyon Outer, 15.1 km | – | 2127 |
| Asilomar | 292.5° | 156 Monterey Canyon Outer, 15.6 km | – | 2129 |
| Carmel Beach | 247.5° | 156 Monterey Canyon Outer, 23 km | – | 2129 |
| County Line | 202.5° | 028 Santa Monica Bay, 36.6 km | – | 2148 |
| Zuma | 225° | 028 Santa Monica Bay, 24 km | – | 2149 |
| Malibu (Surfrider) | 157.5° | 028 Santa Monica Bay, 19.9 km | – | 2150 |
| Topanga | 180° | 028 Santa Monica Bay, 20.5 km | – | 2150 |
| El Porto | 247.5° | 028 Santa Monica Bay, 20.8 km | LAX (LOS ANGELES INTL; asos, airport ASOS via Iowa Environmental Mesonet), 5.2 km | 2153 |
| Hermosa Pier | 247.5° | 028 Santa Monica Bay, 22.1 km | – | 2154 |
| Huntington Pier | 225° | 215 Long Beach Channel, 19 km | – | 2163 |
| The Wedge | 202.5° | 215 Long Beach Channel, 31.8 km | – | 2166 |
| Salt Creek | 247.5° | 264 Red Beach Nearshore, 29.7 km | – | 2176 |
| Trestles | 202.5° | 264 Red Beach Nearshore, 13.2 km | – | 2174 |
| Oceanside Pier | 225° | 264 Red Beach Nearshore, 15.2 km | OKB (OCEANSIDE MUNICIPAL (WAS L32); asos, airport ASOS via Iowa Environmental Mesonet), 4.6 km | 2178 |
| Swami’s | 247.5° | 201 Scripps Nearshore, 18.7 km | – | 2177 |
| Cardiff Reef | 247.5° | 201 Scripps Nearshore, 16.3 km | – | 2177 |
| Black’s Beach | 270° | 201 Scripps Nearshore, 2.7 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 2.5 km | 2177 |
| Windansea | 270° | 201 Scripps Nearshore, 4.4 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 4.7 km | 2177 |
| Ocean Beach (San Diego) | 292.5° | 201 Scripps Nearshore, 13.3 km | – | 2177 |
| Imperial Beach | 270° | 155 Imperial Beach Nearshore, 3.4 km | NRS (IMPERIAL BEACH/REAM; asos, airport ASOS via Iowa Environmental Mesonet), 2.9 km | 2176 |

### Recent window
| spot | facing | anchor buoy (observed surf) | wind station | daylight hours |
|---|---|---|---|---|
| Bolinas | 135° | 142 San Francisco Bar, 14.1 km | – | 357 |
| Stinson Beach | 225° | 142 San Francisco Bar, 12.5 km | – | 357 |
| Ocean Beach | 263.49° | 142 San Francisco Bar, 11.2 km | – | 357 |
| Linda Mar | 315° | 142 San Francisco Bar, 23.9 km | – | 357 |
| Montara | 270° | 142 San Francisco Bar, 28.9 km | HAF (Half Moon Bay; asos, airport ASOS via Iowa Environmental Mesonet), 3.7 km | 361 |
| Mavericks | 202.5° | 142 San Francisco Bar, 34.6 km | HAF (Half Moon Bay; asos, airport ASOS via Iowa Environmental Mesonet), 2.1 km | 361 |
| Crescent City | 202.5° | – | CECC1 (9419750 - Crescent City, CA; fixed, NOS), 0.3 km | 318 |
| Moonstone Beach | 270° | – | ACV (ARCATA/EUREKA ARPT; asos, airport ASOS via Iowa Environmental Mesonet), 6.1 km | 360 |
| Point Arena | 225° | – | ANVC1 (9416841 - Arena Cove, CA; fixed, NOS), 0.1 km | 330 |
| Manresa | 247.5° | – | WVI (Watsonville; asos, airport ASOS via Iowa Environmental Mesonet), 6.7 km | 355 |
| Morro Rock | 270° | 285 Avila Beach Nearshore, 25.9 km | – | 361 |
| Pismo Beach Pier | 245° | 285 Avila Beach Nearshore, 9 km | – | 361 |
| County Line | 202.5° | 103 Topanga Nearshore, 35.7 km | – | 347 |
| Zuma | 225° | 103 Topanga Nearshore, 22.5 km | – | 347 |
| Malibu (Surfrider) | 157.5° | 103 Topanga Nearshore, 9.3 km | – | 347 |
| Topanga | 180° | 103 Topanga Nearshore, 1.8 km | – | 346 |
| El Porto | 247.5° | 103 Topanga Nearshore, 19.8 km | LAX (LOS ANGELES INTL; asos, airport ASOS via Iowa Environmental Mesonet), 5.2 km | 357 |
| Hermosa Pier | 247.5° | 028 Santa Monica Bay, 22.1 km | – | 358 |
| Huntington Pier | 225° | 284 Capistrano Beach Nearshore, 37.9 km | – | 357 |
| The Wedge | 202.5° | 284 Capistrano Beach Nearshore, 24.9 km | – | 357 |
| Salt Creek | 247.5° | 284 Capistrano Beach Nearshore, 5.9 km | – | 357 |
| Trestles | 202.5° | 284 Capistrano Beach Nearshore, 10.9 km | – | 358 |
| Oceanside Pier | 225° | 262 Leucadia Nearshore, 16.1 km | OKB (OCEANSIDE MUNICIPAL (WAS L32); asos, airport ASOS via Iowa Environmental Mesonet), 4.6 km | 360 |
| Swami’s | 247.5° | 262 Leucadia Nearshore, 3.6 km | – | 334 |
| Cardiff Reef | 247.5° | 262 Leucadia Nearshore, 6.1 km | – | 334 |
| Black’s Beach | 270° | 201 Scripps Nearshore, 2.7 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 2.5 km | 342 |
| Windansea | 270° | 201 Scripps Nearshore, 4.4 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 4.7 km | 342 |
| Ocean Beach (San Diego) | 292.5° | 201 Scripps Nearshore, 13.3 km | – | 177 |
| Imperial Beach | 270° | 201 Scripps Nearshore, 34.4 km | NRS (IMPERIAL BEACH/REAM; asos, airport ASOS via Iowa Environmental Mesonet), 2.9 km | 348 |

## 2. How often a poor hour was rated fair or better

### Archive window (2025-11-01 to 2026-05-01)
| observed poor condition | daylight hours | forecast-fed rating fair or better | … NOT BAD or better | … good (SOLID+) | hours with observed inputs too | observed-fed rating fair or better | both fair+ ("the rules oversell") | forecast-fed only ("the inputs were wrong") | the Call (Intermediate) says Go or Worth a look |
|---|---|---|---|---|---|---|---|---|---|
| surf under 1 ft (observed, buoy carried to the point) | 1202 | 45.2% (543) | 9.0% | 1.1% | 106 | 80.2% (85) | 17.0% (18) | 4.7% (5) | 13.2% (159) |
| onshore wind over 12 mph (observed, station) | 1152 | 28.3% (326) | 6.2% | 1.0% | 940 | 71.1% (668) | 23.2% (218) | 2.0% (19) | 7.9% (91) |
| either | 2353 | 36.9% (869) | 7.6% | 1.0% | 1045 | 72.0% (752) | 22.6% (236) | 2.3% (24) | 10.6% (250) |

### Recent window (2026-10-07 to 2026-11-06)
| observed poor condition | daylight hours | forecast-fed rating fair or better | … NOT BAD or better | … good (SOLID+) | hours with observed inputs too | observed-fed rating fair or better | both fair+ ("the rules oversell") | forecast-fed only ("the inputs were wrong") | the Call (Intermediate) says Go or Worth a look |
|---|---|---|---|---|---|---|---|---|---|
| surf under 1 ft (observed, buoy carried to the point) | 0 | – (0) | – | – | 0 | – (0) | – (0) | – (0) | – (0) |
| onshore wind over 12 mph (observed, station) | 202 | 50.0% (101) | 4.0% | 0.0% | 164 | 78.7% (129) | 42.1% (69) | 4.3% (7) | 7.4% (15) |
| either | 202 | 50.0% (101) | 4.0% | 0.0% | 164 | 78.7% (129) | 42.1% (69) | 4.3% (7) | 7.4% (15) |

## 3. The complaint: of the hours rated fair or better, how many were observed poor

Hours where both the observed surf and the observed wind exist.

### Archive window (2025-11-01 to 2026-05-01)
| engine fed | hours with both observations | rated fair or better | of those, observed poor | rated NOT BAD or better | of those, observed poor |
|---|---|---|---|---|---|
| (base rate: every hour, whatever the rating) | 16386 | 16386 | 6.4% (1045) | – | – |
| forecast inputs | 16386 | 9693 | 2.7% (260: 23 under 1 ft, 237 onshore over 12 mph) | 4495 | 0.8% (37) |
| observed inputs | 16386 | 15237 | 4.9% (752: 85 under 1 ft, 668 onshore over 12 mph) | 11961 | 2.7% (327) |
| (base rate: Northern and Central California, every hour, whatever the rating) | 5912 | 5912 | 4.8% (281) | – | – |
| forecast inputs, Northern and Central California only | 5912 | 4544 | 1.7% (78: 7 under 1 ft, 71 onshore over 12 mph) | 2876 | 0.4% (12) |

### Recent window (2026-10-07 to 2026-11-06)
| engine fed | hours with both observations | rated fair or better | of those, observed poor | rated NOT BAD or better | of those, observed poor |
|---|---|---|---|---|---|
| (base rate: every hour, whatever the rating) | 1813 | 1813 | 9.0% (164) | – | – |
| forecast inputs | 1813 | 1326 | 5.7% (76: 0 under 1 ft, 76 onshore over 12 mph) | 611 | 1.1% (7) |
| observed inputs | 1813 | 1660 | 7.8% (129: 0 under 1 ft, 129 onshore over 12 mph) | 1346 | 5.1% (68) |
| (base rate: Northern and Central California, every hour, whatever the rating) | 664 | 664 | 1.8% (12) | – | – |
| forecast inputs, Northern and Central California only | 664 | 543 | 1.8% (10: 0 under 1 ft, 10 onshore over 12 mph) | 279 | 1.4% (4) |

## 4. Too big for the skill

The rating has no skill input, so this is the Call's job (Skip when the estimated typical wave is above the skill's range, `SKILL_RANGE_FT`). Observed surf (buoy carried to the point) above the range's top.

### Archive window (2025-11-01 to 2026-05-01)
| skill | daylight hours the observed surf was above the skill's range | rating fair or better (the rating has no skill input) | the Call says Go or Worth a look | the Call says Go |
|---|---|---|---|---|
| Beginner (up to 4 ft) | 13422 | 79.7% (10699) | 21.6% (2902) | 0.2% (31) |
| Intermediate (up to 8 ft) | 1419 | 76.6% (1087) | 22.9% (325) | 2.1% (30) |

### Recent window (2026-10-07 to 2026-11-06)
| skill | daylight hours the observed surf was above the skill's range | rating fair or better (the rating has no skill input) | the Call says Go or Worth a look | the Call says Go |
|---|---|---|---|---|
| Beginner (up to 4 ft) | 2090 | 80.0% (1671) | 31.8% (664) | 0.2% (4) |
| Intermediate (up to 8 ft) | 48 | 93.8% (45) | 31.3% (15) | 0.0% (0) |

## 5. Per spot (forecast-fed)

### Archive window (2025-11-01 to 2026-05-01)
| spot | daylight hours | observed under 1 ft | … rated fair+ | observed onshore > 12 mph | … rated fair+ | of hours rated fair+, observed poor |
|---|---|---|---|---|---|---|
| Bolinas | 2124 | 0 | – | 0 | – | – |
| Stinson Beach | 2123 | 4 | 0.0% | 0 | – | – |
| Ocean Beach | 2125 | 0 | – | 0 | – | – |
| Linda Mar | 2125 | 0 | – | 0 | – | – |
| Montara | 2129 | 0 | – | 36 | 47.2% | 1.1% of 1507 |
| Mavericks | 2129 | 0 | – | 163 | 24.5% | 2.5% of 1580 |
| Steamer Lane | 2126 | 189 | 68.8% | 0 | – | – |
| Cowell’s | 2126 | 189 | 70.4% | 0 | – | – |
| Pleasure Point | 2126 | 91 | 68.1% | 0 | – | – |
| Davenport | 2127 | 4 | 75.0% | 0 | – | – |
| Crescent City | 2074 | 0 | – | 172 | 39.0% | – |
| Moonstone Beach | 2107 | 0 | – | 27 | 77.8% | – |
| Point Arena | 1675 | 0 | – | 13 | 7.7% | – |
| Manresa | 2131 | 57 | 43.9% | 50 | 28.0% | 1.4% of 1457 |
| Moss Landing | 2127 | 95 | 53.7% | 0 | – | – |
| Asilomar | 2129 | 0 | – | 0 | – | – |
| Carmel Beach | 2129 | 22 | 86.4% | 0 | – | – |
| County Line | 2148 | 0 | – | 0 | – | – |
| Zuma | 2149 | 0 | – | 0 | – | – |
| Malibu (Surfrider) | 2150 | 206 | 19.9% | 0 | – | – |
| Topanga | 2150 | 84 | 20.2% | 0 | – | – |
| El Porto | 2153 | 9 | 0.0% | 331 | 16.3% | 5.7% of 946 |
| Hermosa Pier | 2154 | 37 | 2.7% | 0 | – | – |
| Huntington Pier | 2163 | 12 | 8.3% | 0 | – | – |
| The Wedge | 2166 | 37 | 35.1% | 0 | – | – |
| Salt Creek | 2176 | 27 | 25.9% | 0 | – | – |
| Trestles | 2174 | 21 | 28.6% | 0 | – | – |
| Oceanside Pier | 2178 | 23 | 43.5% | 80 | 28.8% | 3.2% of 1016 |
| Swami’s | 2177 | 22 | 40.9% | 0 | – | – |
| Cardiff Reef | 2177 | 22 | 40.9% | 0 | – | – |
| Black’s Beach | 2177 | 19 | 31.6% | 50 | 18.0% | 1.7% of 867 |
| Windansea | 2177 | 10 | 0.0% | 50 | 40.0% | 1.8% of 1090 |
| Ocean Beach (San Diego) | 2177 | 9 | 0.0% | 0 | – | – |
| Imperial Beach | 2176 | 13 | 0.0% | 180 | 33.3% | 4.9% of 1230 |

### Recent window (2026-10-07 to 2026-11-06)
| spot | daylight hours | observed under 1 ft | … rated fair+ | observed onshore > 12 mph | … rated fair+ | of hours rated fair+, observed poor |
|---|---|---|---|---|---|---|
| Bolinas | 357 | 0 | – | 0 | – | – |
| Stinson Beach | 357 | 0 | – | 0 | – | – |
| Ocean Beach | 357 | 0 | – | 0 | – | – |
| Linda Mar | 357 | 0 | – | 0 | – | – |
| Montara | 361 | 0 | – | 4 | 100.0% | 1.5% of 267 |
| Mavericks | 361 | 0 | – | 8 | 75.0% | 2.2% of 276 |
| Crescent City | 318 | 0 | – | 1 | 100.0% | – |
| Moonstone Beach | 360 | 0 | – | 2 | 50.0% | – |
| Point Arena | 330 | 0 | – | 0 | – | – |
| Manresa | 355 | 0 | – | 8 | 87.5% | – |
| Morro Rock | 361 | 0 | – | 0 | – | – |
| Pismo Beach Pier | 361 | 0 | – | 0 | – | – |
| County Line | 347 | 0 | – | 0 | – | – |
| Zuma | 347 | 0 | – | 0 | – | – |
| Malibu (Surfrider) | 347 | 0 | – | 0 | – | – |
| Topanga | 346 | 0 | – | 0 | – | – |
| El Porto | 357 | 0 | – | 87 | 33.3% | 13.7% of 212 |
| Hermosa Pier | 358 | 0 | – | 0 | – | – |
| Huntington Pier | 357 | 0 | – | 0 | – | – |
| The Wedge | 357 | 0 | – | 0 | – | – |
| Salt Creek | 357 | 0 | – | 0 | – | – |
| Trestles | 358 | 0 | – | 0 | – | – |
| Oceanside Pier | 360 | 0 | – | 31 | 77.4% | 8.7% of 277 |
| Swami’s | 334 | 0 | – | 0 | – | – |
| Cardiff Reef | 334 | 0 | – | 0 | – | – |
| Black’s Beach | 342 | 0 | – | 10 | 60.0% | 3.0% of 101 |
| Windansea | 342 | 0 | – | 10 | 60.0% | 2.0% of 102 |
| Ocean Beach (San Diego) | 177 | 0 | – | 0 | – | – |
| Imperial Beach | 348 | 0 | – | 41 | 41.5% | 8.8% of 91 |

## 6. Candidate fixes, chosen on the first 2/3 and reported on the last 1/3

Each candidate caps the forecast-fed score using only what the app has at that hour. "removed / lost" = observed-poor hours the cap takes from fair+ to below fair / observed-fine hours it takes below fair (a cost: those were fine). The share = of hours rated fair+, the share observed poor. Fit = the first 2/3 of both windows pooled; held-out = the last 1/3 of each window. **Rule (our own, fixed before the held-out numbers were read):** on the held-out hours of BOTH windows, at least 10 removed, removed more than twice lost, and the share down by at least 2 points. The chosen candidate per family is the best net (removed − 2 × lost) among those passing on the fit hours.

| candidate | fit: removed / lost | fit: share before → after | archive held-out: removed / lost | share | recent held-out: removed / lost | share | passes on both held-out sets |
|---|---|---|---|---|---|---|---|
| forecast onshore wind over 8 mph caps at 39 | 131 / 225 | 2.8% → 1.1% | 62 / 148 | 3.3% → 1.1% | 28 / 38 | 5.9% → 0.8% | no |
| forecast onshore wind over 10 mph caps at 39 | 94 / 73 | 2.8% → 1.6% | 29 / 40 | 3.3% → 2.3% | 21 / 8 | 5.9% → 2.2% | no |
| forecast onshore wind over 12 mph caps at 39 | 52 / 16 | 2.8% → 2.1% | 10 / 7 | 3.3% → 2.9% | 10 / 1 | 5.9% → 4.2% | no |
| forecast onshore wind over 15 mph caps at 39 | 12 / 3 | 2.8% → 2.6% | 1 / 1 | 3.3% → 3.2% | 4 / 0 | 5.9% → 5.2% | no |
| v1 surf height under 1 ft caps at 39 | 0 / 0 | 2.8% → 2.8% | 0 / 0 | 3.3% → 3.3% | 0 / 0 | 5.9% → 5.9% | no |
| v1 surf height under 1.5 ft caps at 39 | 5 / 63 | 2.8% → 2.7% | 0 / 2 | 3.3% → 3.3% | 0 / 0 | 5.9% → 5.9% | no |
| v1 surf height under 2 ft caps at 39 | 5 / 324 | 2.8% → 2.8% | 2 / 55 | 3.3% → 3.3% | 0 / 0 | 5.9% → 5.9% | no |
| offshore Hs under 1.5 ft caps at 39 | 11 / 17 | 2.8% → 2.6% | 0 / 0 | 3.3% → 3.3% | 0 / 0 | 5.9% → 5.9% | no |
| offshore Hs under 2 ft caps at 39 | 16 / 281 | 2.8% → 2.7% | 2 / 59 | 3.3% → 3.3% | 0 / 0 | 5.9% → 5.9% | no |
| offshore Hs under 3 ft caps at 39 | 39 / 1665 | 2.8% → 2.9% | 28 / 737 | 3.3% → 3.1% | 6 / 25 | 5.9% → 5.1% | no |

**The Call for a beginner** (too big for the skill): Skip when the typical estimate is above 4 ft. removed / lost = hours the change turns to Skip that were observed above / within the range; share = of the hours observed above 4 ft, the share the Call let through (Go or Worth a look).

| candidate | fit: removed / lost | fit: share before → after | archive held-out: removed / lost | share | recent held-out: removed / lost | share | passes on both held-out sets |
|---|---|---|---|---|---|---|---|
| beginner Call: Skip when the typical estimate is above 4 ft | 2111 / 924 | 23.6% → 6.0% | 441 / 357 | 20.4% → 4.9% | 119 / 58 | 24.0% → 5.8% | no |

Chosen on the fit hours: wind: none passes on the fit hours; size: none passes on the fit hours.


<!-- notes -->
## Notes (written 2026-11-06; the tables above are regenerated by the script, these notes are not)

### Rerun 2026-11-08: shore wind stations
Observed wind now comes from the nearest **shore** station within 7 km of each spot:
- a fixed NOAA station; or
- an airport ASOS (either kind outside enclosed water; an airport's variable direction is kept below 5 mph).

Before, it came from the nearest station within 40 km, which for most spots was an offshore buoy 22–40 km out. The rule and helper are in `docs/forecast/WIND-POINT.md` and `data/shore-wind.ts`.

**Every figure in the notes below this addendum ("What the audit says", "What changed") is from the 2026-11-06 run** (offshore-buoy wind; that version is in git history). The tables above are the new run.

**What moved:**
- The audit covers fewer hours. Spots with no shore station within 7 km have no observed wind. Archive hours with both observations: 43,858 → 16,386; in Northern and Central California, 12,528 → 5,912.
- Hours rated fair or better that were observed poor (section 3, forecast inputs):
  - archive: 4.6% → 2.7%;
  - recent: 5.8% → 5.7%;
  - Northern and Central California, archive: 8.0% → 1.7%.
- **Do not read this as the rating getting better.** It is a different, smaller set of spots, and airfields read land wind, often lighter than on the water. Fewer hours count as "onshore over 12 mph".
- "Forecast only" overcalls (the inputs were wrong), archive, onshore wind: 8.6% (221) → 2.0% (19) of the observed-poor hours. This is a different set of spots, so it says nothing about cause.
- **Decision unchanged:** no candidate fix passes on both held-out sets (section 6), so nothing in the app changes.
- **Closest call:** the 12 mph onshore cap now removes more overcalls than it costs on both held-out sets: 10 removed against 7 lost (archive) and 10 against 1 (recent). Before, it was 28 against 16 and 12 against 9. It still fails the fixed rule (at least 10 removed, more than twice as many removed as lost, and a share at least 2 points lower). On archive, 10 is not more than 2 × 7. On recent, the share falls 5.9% → 4.2%, which is 1.7 points. It is the candidate to retest when more shore-station hours exist.


### What the audit says
1. **How often a poor hour reads fair or better (forecast-fed, section 2).** Observed onshore wind over 12 mph: 37.6% of 3,912 daylight hours (archive) and 51.0% of 757 (recent) were rated fair or better; 14.7–14.8% NOT BAD or better; 2.1–4.6% good. Observed surf under 1 ft: 45.2% of 1,202 hours (archive; almost all of it in Monterey Bay and Malibu/Topanga, where the anchor carries a small buoy reading into a sheltered point); the recent window had no such hour. Almost none reached good (1.1%).
2. **The complaint itself (section 3).** Of the hours we rated fair or better, 4.6% (archive) and 5.8% (recent) were observed poor, against a base rate of 7.2% and 8.2% for every hour whatever the rating. In Northern and Central California: 8.0% and 9.2%, against 10.8%. So the rating does steer away from poor hours, but only by about a quarter. Nearly all of what remains is onshore wind (in the recent window all of it).
3. **Rules or inputs?** On the hours where both ratings exist, most forecast-fed overcalls happen with the observed inputs too: for onshore wind 698 "both fair+" against 221 "forecast only" (archive), 221 against 56 (recent); for small surf 141 against 19. Fed the measured inputs the engine says fair or better even MORE often (68–73% of blown-out hours, 88% of under-1-ft hours, 93% of all hours). **The rules oversell; the forecast inputs are not the main cause.** Why: the wind factor is 30% of the score and an onshore 12–18 mph wind only lowers it (to 52–28) without capping the rating; a severe-wind cap starts at a wind score under 25 (about 19 mph onshore). Small surf is weighed lightly: a 1 ft primary swell at 12 s still scores 33 on the swell factor, above the low-potential cap at 25. Part of the observed-fed leniency is our own input choice: a buoy's bulk Hs used as the primary swell makes the organization proxy read high.
4. **Too big for the skill (section 4).** The rating has no skill input (it is not meant to; the Call is). For a beginner, the Call let through (Go or Worth a look) 22.7% (archive) and 34.3% (recent) of hours whose observed surf was above 4 ft; it said **Go** on 0.2%. Almost all of those are "Worth a look" with the reason "may be above the beginner range": the Call only Skips when the LOW end of the band is above the range.

### What changed: nothing in the app
No candidate cleared the acceptance rule fixed before the held-out third was read (section 6).
- **A stricter onshore rule** (cap at WEAK above 8, 10, 12 or 15 mph of forecast onshore wind) removes overcalls but takes about as many observed-fine hours down with them: at 12 mph, 28 removed against 16 lost (archive held-out) and 12 against 9 (recent). The forecast's onshore call and the station's disagree too often for a hard cap to be clearly right. Part of that may be the stations themselves: for most open-coast spots the only open-water anemometer is an offshore buoy 20–40 km out (46026, 46012, 46042, 46013), whose wind is not the beach's.
- **A size floor** (v1 under 1–2 ft, or offshore Hs under 1.5–3 ft) does not pick out the small hours: v1 refuses most small-swell hours, and offshore Hs at the marine point barely separates them; the larger floors remove far more fine hours than poor ones.
- **The beginner Call** (Skip when the typical estimate, not only the band's low end, is above 4 ft) cuts the let-through share from about 25% to about 6% on every set, but costs 359 hours observed within the range against 426 removed (archive held-out), 63 against 125 (recent): under the rule's 2-to-1. Those lost hours were observed at or under 4 ft while our estimate said more, so whether that cost matters is a product (safety) choice, not something this evidence settles. **Decision for the user.**
- **A certainty cap** (`src/services/certainty.ts`) could not be tested: its levels rest on the wave-model spread, which has no archive, and on lead time, which is the same for every hour of a fixed-lead audit.

### Limits
- Observed surf is a buoy reading carried to the spot's MOP point by MOP (model-assisted), only at spots with a buoy MOP gets right within 40 km; no spot is measured at the break.
- Observed wind (since 2026-11-08) is from shore stations within 7 km: piers, headlands and airfields, not the break, uncorrected for anemometer height (stations stand 4–20 m up; the forecast is 10 m). Before that, it was from stations up to 40 km away, often offshore buoys.
- The forecast-fed rating uses Open-Meteo's archived short-range runs (close to a nowcast), not the days-ahead forecast; the Call uses MOP's nowcast in place of its forecast. Both are best cases.
- "Poor" covers only small surf and strong onshore wind. Cross-shore wind, closeouts and tide are not judged.
- The archive is winter–spring; the recent window is one autumn month.

### What would move this
A wind observation that stands for the beach (a beach station, or the user's own session reports of wind) to test the onshore cap again; and a rule for the wind factor that caps rather than only lowers. Both are inputs this audit does not have.
