# Rating audit: does the rating oversell? (2026-11-06)

Generated 2026-11-07T07:32Z by `docs/forecast/data/rating-audit.ts`. Reproduce: `ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit.ts --archive 2025-11-01T00:00:00Z/2026-05-01T00:00:00Z --recent 2026-10-07T00:00:00Z/2026-11-06T00:00:00Z` (the cache is optional; the same public downloads as `ACCURACY-VS-BUOYS.md`). Findings and decisions: the notes at the end.

**The question.** Surfline's most common complaint is driving to a "fair" or "good" rating and finding it flat or blown out. How often does OUR rating say fair or better when the observed conditions were poor? Asked two ways, to separate "the rating rules oversell" from "the forecast inputs were wrong".

**What each number is.**
- **Observed surf** = **buoy carried to the point (model-assisted)**: a wave buoy's measured Hs × MOP's own hourly ratio (spot point ÷ buoy site), only from a buoy within 40 km where MOP is right at the buoy (the T-131 rule, judged on each window's first 2/3). Not a measurement at the spot. "Under 1 ft" is in the app's surf-height convention (about the nearshore Hs).
- **Observed wind** = **measured at a coastal station**, not at the break: nearest NDBC/NOS met station within 40 km, not in enclosed water (src/map/enclosed.ts), with wind on 200+ hours of the window. The reading on the hour (NDBC stdmet via NOAA ERDDAP `cwwcNDBCMet`); ids, names and positions from NDBC's `activestations.xml`. No anemometer-height correction (stations stand 4–20 m up; the forecast is 10 m).
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
| Bolinas | 135° | 142 San Francisco Bar, 14.1 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 22.3 km | 2127 |
| Stinson Beach | 225° | 142 San Francisco Bar, 12.5 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 23.8 km | 2126 |
| Ocean Beach | 263.49° | 142 San Francisco Bar, 11.2 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 28.9 km | 2128 |
| Linda Mar | 315° | 142 San Francisco Bar, 23.9 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 34.1 km | 2128 |
| Montara | 270° | 142 San Francisco Bar, 28.9 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 36.4 km | 2129 |
| Mavericks | 202.5° | 142 San Francisco Bar, 34.6 km | 46012 (HALF MOON BAY - 24NM SSW of San Francisco, CA; usv, NDBC), 37 km | 2129 |
| Steamer Lane | 135° | 156 Monterey Canyon Outer, 22.4 km | 46042 (MONTEREY - 27NM WNW of Monterey, CA; buoy, NDBC), 38.6 km | 2126 |
| Cowell’s | 112.5° | 156 Monterey Canyon Outer, 23.5 km | 46042 (MONTEREY - 27NM WNW of Monterey, CA; buoy, NDBC), 39.4 km | 2126 |
| Pleasure Point | 157.5° | 156 Monterey Canyon Outer, 21.9 km | – | 2126 |
| Davenport | 225° | 156 Monterey Canyon Outer, 35.5 km | 46042 (MONTEREY - 27NM WNW of Monterey, CA; buoy, NDBC), 31.2 km | 2127 |
| Crescent City | 202.5° | – | CECC1 (9419750 - Crescent City, CA; fixed, NOS), 0.3 km | 2074 |
| Humboldt North Jetty | 292.5° | – | 46022 (EEL RIVER - 17NM WSW of Eureka, CA; buoy, NDBC), 26.3 km | 2111 |
| Point Arena | 225° | – | ANVC1 (9416841 - Arena Cove, CA; fixed, NOS), 0.1 km | 1675 |
| Salmon Creek | 270° | – | 46013 (BODEGA BAY - 48NM NW of San Francisco, CA; buoy, NDBC), 25.4 km | 1900 |
| Dillon Beach | 270° | – | 46013 (BODEGA BAY - 48NM NW of San Francisco, CA; buoy, NDBC), 30.4 km | 1901 |
| Waddell Creek | 225° | – | 46042 (MONTEREY - 27NM WNW of Monterey, CA; buoy, NDBC), 36.2 km | 226 |
| Manresa | 247.5° | 156 Monterey Canyon Outer, 20.5 km | – | 2127 |
| Moss Landing | 270° | 156 Monterey Canyon Outer, 15.1 km | – | 2127 |
| Asilomar | 292.5° | 156 Monterey Canyon Outer, 15.6 km | – | 2129 |
| Carmel Beach | 247.5° | 156 Monterey Canyon Outer, 23 km | – | 2129 |
| Morro Rock | 270° | – | PSLC1 (9412110 - Port San Luis, CA; fixed, NOS), 24.8 km | 1798 |
| Pismo Beach Pier | 245° | – | CPXC1 (Cal Poly Pier, CA; fixed, California Polytechnic State University), 9.5 km | 1753 |
| Jalama | 247.5° | – | PTGC1 (Point Arguello, CA; fixed, NDBC), 15.2 km | 757 |
| Rincon | 202.5° | – | NTBC1 (9411340 - Santa Barbara, CA ; fixed, NOS), 20 km | 2056 |
| C Street | 180° | – | NTBC1 (9411340 - Santa Barbara, CA ; fixed, NOS), 38.8 km | 2057 |
| County Line | 202.5° | 028 Santa Monica Bay, 36.6 km | 46025 (Santa Monica Basin - 33NM WSW of Santa Monica, CA; buoy, NDBC), 33.5 km | 2148 |
| Zuma | 225° | 028 Santa Monica Bay, 24 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 29.7 km | 2149 |
| Malibu (Surfrider) | 157.5° | 028 Santa Monica Bay, 19.9 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 16.7 km | 2150 |
| Topanga | 180° | 028 Santa Monica Bay, 20.5 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 8.3 km | 2150 |
| El Porto | 247.5° | 028 Santa Monica Bay, 20.8 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 14 km | 2153 |
| Hermosa Pier | 247.5° | 028 Santa Monica Bay, 22.1 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 18.6 km | 2154 |
| Huntington Pier | 225° | 215 Long Beach Channel, 19 km | AGXC1 (9410647 - Angels Gate, CA; fixed, NOAA NOS PORTS), 23.5 km | 2164 |
| The Wedge | 202.5° | 215 Long Beach Channel, 31.8 km | AGXC1 (9410647 - Angels Gate, CA; fixed, NOAA NOS PORTS), 36.4 km | 2167 |
| Salt Creek | 247.5° | 264 Red Beach Nearshore, 29.7 km | – | 2176 |
| Trestles | 202.5° | 264 Red Beach Nearshore, 13.2 km | – | 2174 |
| Oceanside Pier | 225° | 264 Red Beach Nearshore, 15.2 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 38.2 km | 2178 |
| Swami’s | 247.5° | 201 Scripps Nearshore, 18.7 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 19 km | 2177 |
| Cardiff Reef | 247.5° | 201 Scripps Nearshore, 16.3 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 16.5 km | 2177 |
| Black’s Beach | 270° | 201 Scripps Nearshore, 2.7 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 2.5 km | 2177 |
| Windansea | 270° | 201 Scripps Nearshore, 4.4 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 4.7 km | 2177 |
| Ocean Beach (San Diego) | 292.5° | 201 Scripps Nearshore, 13.3 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 13.1 km | 2177 |
| Imperial Beach | 270° | 155 Imperial Beach Nearshore, 3.4 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 34 km | 2176 |

### Recent window
| spot | facing | anchor buoy (observed surf) | wind station | daylight hours |
|---|---|---|---|---|
| Bolinas | 135° | 142 San Francisco Bar, 14.1 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 22.3 km | 361 |
| Stinson Beach | 225° | 142 San Francisco Bar, 12.5 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 23.8 km | 361 |
| Ocean Beach | 263.49° | 142 San Francisco Bar, 11.2 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 28.9 km | 361 |
| Linda Mar | 315° | 142 San Francisco Bar, 23.9 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 34.1 km | 361 |
| Montara | 270° | 142 San Francisco Bar, 28.9 km | 46026 (SAN FRANCISCO - 18NM West of San Francisco, CA; buoy, NDBC), 36.4 km | 361 |
| Mavericks | 202.5° | 142 San Francisco Bar, 34.6 km | 46012 (HALF MOON BAY - 24NM SSW of San Francisco, CA; usv, NDBC), 37 km | 361 |
| Steamer Lane | 135° | – | 46042 (MONTEREY - 27NM WNW of Monterey, CA; buoy, NDBC), 38.6 km | 332 |
| Cowell’s | 112.5° | – | 46042 (MONTEREY - 27NM WNW of Monterey, CA; buoy, NDBC), 39.4 km | 332 |
| Davenport | 225° | – | 46042 (MONTEREY - 27NM WNW of Monterey, CA; buoy, NDBC), 31.2 km | 332 |
| Crescent City | 202.5° | – | CECC1 (9419750 - Crescent City, CA; fixed, NOS), 0.3 km | 318 |
| Humboldt North Jetty | 292.5° | – | 46022 (EEL RIVER - 17NM WSW of Eureka, CA; buoy, NDBC), 26.3 km | 324 |
| Point Arena | 225° | – | ANVC1 (9416841 - Arena Cove, CA; fixed, NOS), 0.1 km | 330 |
| Salmon Creek | 270° | – | 46013 (BODEGA BAY - 48NM NW of San Francisco, CA; buoy, NDBC), 25.4 km | 325 |
| Dillon Beach | 270° | – | 46013 (BODEGA BAY - 48NM NW of San Francisco, CA; buoy, NDBC), 30.4 km | 325 |
| Waddell Creek | 225° | – | 46042 (MONTEREY - 27NM WNW of Monterey, CA; buoy, NDBC), 36.2 km | 332 |
| Morro Rock | 270° | 285 Avila Beach Nearshore, 25.9 km | CPXC1 (Cal Poly Pier, CA; fixed, California Polytechnic State University), 25.2 km | 361 |
| Pismo Beach Pier | 245° | 285 Avila Beach Nearshore, 9 km | CPXC1 (Cal Poly Pier, CA; fixed, California Polytechnic State University), 9.5 km | 361 |
| Jalama | 247.5° | – | PTGC1 (Point Arguello, CA; fixed, NDBC), 15.2 km | 328 |
| Rincon | 202.5° | – | NTBC1 (9411340 - Santa Barbara, CA ; fixed, NOS), 20 km | 311 |
| C Street | 180° | – | NTBC1 (9411340 - Santa Barbara, CA ; fixed, NOS), 38.8 km | 310 |
| County Line | 202.5° | 103 Topanga Nearshore, 35.7 km | 46025 (Santa Monica Basin - 33NM WSW of Santa Monica, CA; buoy, NDBC), 33.5 km | 357 |
| Zuma | 225° | 103 Topanga Nearshore, 22.5 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 29.7 km | 357 |
| Malibu (Surfrider) | 157.5° | 103 Topanga Nearshore, 9.3 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 16.7 km | 357 |
| Topanga | 180° | 103 Topanga Nearshore, 1.8 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 8.3 km | 356 |
| El Porto | 247.5° | 103 Topanga Nearshore, 19.8 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 14 km | 357 |
| Hermosa Pier | 247.5° | 028 Santa Monica Bay, 22.1 km | ICAC1 (9410840 - Santa Monica Pier; fixed, NOS), 18.6 km | 358 |
| Huntington Pier | 225° | 284 Capistrano Beach Nearshore, 37.9 km | AGXC1 (9410647 - Angels Gate, CA; fixed, NOAA NOS PORTS), 23.5 km | 359 |
| The Wedge | 202.5° | 284 Capistrano Beach Nearshore, 24.9 km | AGXC1 (9410647 - Angels Gate, CA; fixed, NOAA NOS PORTS), 36.4 km | 359 |
| Salt Creek | 247.5° | 284 Capistrano Beach Nearshore, 5.9 km | – | 357 |
| Trestles | 202.5° | 284 Capistrano Beach Nearshore, 10.9 km | – | 358 |
| Oceanside Pier | 225° | 262 Leucadia Nearshore, 16.1 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 38.2 km | 356 |
| Swami’s | 247.5° | 262 Leucadia Nearshore, 3.6 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 19 km | 357 |
| Cardiff Reef | 247.5° | 262 Leucadia Nearshore, 6.1 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 16.5 km | 357 |
| Black’s Beach | 270° | 201 Scripps Nearshore, 2.7 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 2.5 km | 342 |
| Windansea | 270° | 201 Scripps Nearshore, 4.4 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 4.7 km | 342 |
| Ocean Beach (San Diego) | 292.5° | 201 Scripps Nearshore, 13.3 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 13.1 km | 342 |
| Imperial Beach | 270° | 201 Scripps Nearshore, 34.4 km | LJAC1 (9410230 - La Jolla, CA; fixed, NOS), 34 km | 343 |

## 2. How often a poor hour was rated fair or better

### Archive window (2025-11-01 to 2026-05-01)
| observed poor condition | daylight hours | forecast-fed rating fair or better | … NOT BAD or better | … good (SOLID+) | hours with observed inputs too | observed-fed rating fair or better | both fair+ ("the rules oversell") | forecast-fed only ("the inputs were wrong") | the Call (Intermediate) says Go or Worth a look |
|---|---|---|---|---|---|---|---|---|---|
| surf under 1 ft (observed, buoy carried to the point) | 1202 | 45.2% (543) | 9.0% | 1.1% | 584 | 87.8% (513) | 24.1% (141) | 3.3% (19) | 13.2% (159) |
| onshore wind over 12 mph (observed, station) | 3912 | 37.6% (1469) | 14.7% | 4.6% | 2560 | 68.4% (1750) | 27.3% (698) | 8.6% (221) | 17.7% (694) |
| either | 5110 | 39.4% (2012) | 13.4% | 3.8% | 3140 | 72.0% (2260) | 26.7% (839) | 7.6% (240) | 16.7% (853) |

### Recent window (2026-10-07 to 2026-11-06)
| observed poor condition | daylight hours | forecast-fed rating fair or better | … NOT BAD or better | … good (SOLID+) | hours with observed inputs too | observed-fed rating fair or better | both fair+ ("the rules oversell") | forecast-fed only ("the inputs were wrong") | the Call (Intermediate) says Go or Worth a look |
|---|---|---|---|---|---|---|---|---|---|
| surf under 1 ft (observed, buoy carried to the point) | 0 | – (0) | – | – | 0 | – (0) | – (0) | – (0) | – (0) |
| onshore wind over 12 mph (observed, station) | 757 | 51.0% (386) | 14.8% | 2.1% | 541 | 73.2% (396) | 40.9% (221) | 10.4% (56) | 20.7% (157) |
| either | 757 | 51.0% (386) | 14.8% | 2.1% | 541 | 73.2% (396) | 40.9% (221) | 10.4% (56) | 20.7% (157) |

## 3. The complaint: of the hours rated fair or better, how many were observed poor

Hours where both the observed surf and the observed wind exist.

### Archive window (2025-11-01 to 2026-05-01)
| engine fed | hours with both observations | rated fair or better | of those, observed poor | rated NOT BAD or better | of those, observed poor |
|---|---|---|---|---|---|
| (base rate: every hour, whatever the rating) | 43858 | 43858 | 7.2% (3140) | – | – |
| forecast inputs | 43858 | 23242 | 4.6% (1079: 160 under 1 ft, 919 onshore over 12 mph) | 8895 | 3.8% (339) |
| observed inputs | 43858 | 40605 | 5.6% (2260: 513 under 1 ft, 1750 onshore over 12 mph) | 32448 | 3.9% (1275) |
| (base rate: Northern and Central California, every hour, whatever the rating) | 12528 | 12528 | 10.8% (1353) | – | – |
| forecast inputs, Northern and Central California only | 12528 | 8650 | 8.0% (693: 54 under 1 ft, 639 onshore over 12 mph) | 4662 | 6.0% (280) |

### Recent window (2026-10-07 to 2026-11-06)
| engine fed | hours with both observations | rated fair or better | of those, observed poor | rated NOT BAD or better | of those, observed poor |
|---|---|---|---|---|---|
| (base rate: every hour, whatever the rating) | 6586 | 6586 | 8.2% (541) | – | – |
| forecast inputs | 6586 | 4748 | 5.8% (277: 0 under 1 ft, 277 onshore over 12 mph) | 1914 | 3.8% (72) |
| observed inputs | 6586 | 6220 | 6.4% (396: 0 under 1 ft, 396 onshore over 12 mph) | 5477 | 4.4% (241) |
| (base rate: Northern and Central California, every hour, whatever the rating) | 2491 | 2491 | 10.8% (270) | – | – |
| forecast inputs, Northern and Central California only | 2491 | 1833 | 9.2% (169: 0 under 1 ft, 169 onshore over 12 mph) | 761 | 9.1% (69) |

## 4. Too big for the skill

The rating has no skill input, so this is the Call's job (Skip when the estimated typical wave is above the skill's range, `SKILL_RANGE_FT`). Observed surf (buoy carried to the point) above the range's top.

### Archive window (2025-11-01 to 2026-05-01)
| skill | daylight hours the observed surf was above the skill's range | rating fair or better (the rating has no skill input) | the Call says Go or Worth a look | the Call says Go |
|---|---|---|---|---|
| Beginner (up to 4 ft) | 12997 | 79.5% (10339) | 22.7% (2949) | 0.2% (31) |
| Intermediate (up to 8 ft) | 1311 | 76.4% (1001) | 23.1% (303) | 2.3% (30) |

### Recent window (2026-10-07 to 2026-11-06)
| skill | daylight hours the observed surf was above the skill's range | rating fair or better (the rating has no skill input) | the Call says Go or Worth a look | the Call says Go |
|---|---|---|---|---|
| Beginner (up to 4 ft) | 1998 | 79.9% (1596) | 34.3% (686) | 0.2% (4) |
| Intermediate (up to 8 ft) | 43 | 93.0% (40) | 23.3% (10) | 0.0% (0) |

## 5. Per spot (forecast-fed)

### Archive window (2025-11-01 to 2026-05-01)
| spot | daylight hours | observed under 1 ft | … rated fair+ | observed onshore > 12 mph | … rated fair+ | of hours rated fair+, observed poor |
|---|---|---|---|---|---|---|
| Bolinas | 2127 | 0 | – | 237 | 36.3% | 5.7% of 1513 |
| Stinson Beach | 2126 | 4 | 0.0% | 77 | 48.1% | 2.7% of 1391 |
| Ocean Beach | 2128 | 0 | – | 134 | 35.8% | 3.7% of 1310 |
| Linda Mar | 2128 | 0 | – | 516 | 58.5% | 19.9% of 1515 |
| Montara | 2129 | 0 | – | 217 | 53.0% | 7.4% of 1564 |
| Mavericks | 2129 | 0 | – | 57 | 59.6% | 3.8% of 890 |
| Steamer Lane | 2126 | 189 | 68.8% | 12 | 41.7% | 19.5% of 154 |
| Cowell’s | 2126 | 189 | 70.4% | 10 | 30.0% | 19.6% of 163 |
| Pleasure Point | 2126 | 91 | 68.1% | 0 | – | – |
| Davenport | 2127 | 4 | 75.0% | 9 | 100.0% | 6.0% of 150 |
| Crescent City | 2074 | 0 | – | 172 | 39.0% | – |
| Humboldt North Jetty | 2111 | 0 | – | 71 | 76.1% | – |
| Point Arena | 1675 | 0 | – | 13 | 7.7% | – |
| Salmon Creek | 1900 | 0 | – | 325 | 36.3% | – |
| Dillon Beach | 1901 | 0 | – | 325 | 37.5% | – |
| Waddell Creek | 226 | 0 | – | 9 | 88.9% | – |
| Manresa | 2127 | 57 | 43.9% | 0 | – | – |
| Moss Landing | 2127 | 95 | 53.7% | 0 | – | – |
| Asilomar | 2129 | 0 | – | 0 | – | – |
| Carmel Beach | 2129 | 22 | 86.4% | 0 | – | – |
| Morro Rock | 1798 | 0 | – | 111 | 58.6% | – |
| Pismo Beach Pier | 1753 | 0 | – | 151 | 38.4% | – |
| Jalama | 757 | 0 | – | 0 | – | – |
| Rincon | 2056 | 0 | – | 106 | 28.3% | – |
| C Street | 2057 | 0 | – | 69 | 39.1% | – |
| County Line | 2148 | 0 | – | 28 | 21.4% | 0.7% of 891 |
| Zuma | 2149 | 0 | – | 49 | 10.2% | 0.6% of 880 |
| Malibu (Surfrider) | 2150 | 206 | 19.9% | 24 | 33.3% | 4.8% of 1013 |
| Topanga | 2150 | 84 | 20.2% | 25 | 32.0% | 2.6% of 972 |
| El Porto | 2153 | 9 | 0.0% | 159 | 8.8% | 1.5% of 943 |
| Hermosa Pier | 2154 | 37 | 2.7% | 159 | 10.7% | 2.0% of 882 |
| Huntington Pier | 2164 | 12 | 8.3% | 319 | 22.9% | 7.9% of 937 |
| The Wedge | 2167 | 37 | 35.1% | 206 | 30.1% | 8.0% of 926 |
| Salt Creek | 2176 | 27 | 25.9% | 0 | – | – |
| Trestles | 2174 | 21 | 28.6% | 0 | – | – |
| Oceanside Pier | 2178 | 23 | 43.5% | 50 | 16.0% | 1.8% of 1004 |
| Swami’s | 2177 | 22 | 40.9% | 42 | 16.7% | 1.8% of 886 |
| Cardiff Reef | 2177 | 22 | 40.9% | 42 | 14.3% | 1.7% of 864 |
| Black’s Beach | 2177 | 19 | 31.6% | 50 | 18.0% | 1.7% of 867 |
| Windansea | 2177 | 10 | 0.0% | 50 | 40.0% | 1.8% of 1090 |
| Ocean Beach (San Diego) | 2177 | 9 | 0.0% | 38 | 44.7% | 1.4% of 1217 |
| Imperial Beach | 2176 | 13 | 0.0% | 50 | 40.0% | 1.6% of 1220 |

### Recent window (2026-10-07 to 2026-11-06)
| spot | daylight hours | observed under 1 ft | … rated fair+ | observed onshore > 12 mph | … rated fair+ | of hours rated fair+, observed poor |
|---|---|---|---|---|---|---|
| Bolinas | 361 | 0 | – | 2 | 100.0% | 0.7% of 275 |
| Stinson Beach | 361 | 0 | – | 1 | 100.0% | 0.5% of 218 |
| Ocean Beach | 361 | 0 | – | 8 | 87.5% | 3.3% of 210 |
| Linda Mar | 361 | 0 | – | 123 | 67.5% | 34.6% of 237 |
| Montara | 361 | 0 | – | 31 | 90.3% | 10.9% of 256 |
| Mavericks | 361 | 0 | – | 10 | 100.0% | 3.4% of 297 |
| Steamer Lane | 332 | 0 | – | 1 | 100.0% | – |
| Cowell’s | 332 | 0 | – | 0 | – | – |
| Davenport | 332 | 0 | – | 3 | 100.0% | – |
| Crescent City | 318 | 0 | – | 1 | 100.0% | – |
| Humboldt North Jetty | 324 | 0 | – | 6 | 83.3% | – |
| Point Arena | 330 | 0 | – | 0 | – | – |
| Salmon Creek | 325 | 0 | – | 73 | 47.9% | – |
| Dillon Beach | 325 | 0 | – | 73 | 47.9% | – |
| Waddell Creek | 332 | 0 | – | 3 | 100.0% | – |
| Morro Rock | 361 | 0 | – | 54 | 44.4% | 14.0% of 172 |
| Pismo Beach Pier | 361 | 0 | – | 42 | 35.7% | 8.9% of 168 |
| Jalama | 328 | 0 | – | 1 | 100.0% | – |
| Rincon | 311 | 0 | – | 23 | 34.8% | – |
| C Street | 310 | 0 | – | 16 | 31.3% | – |
| County Line | 357 | 0 | – | 11 | 54.5% | 2.6% of 231 |
| Zuma | 357 | 0 | – | 12 | 41.7% | 2.3% of 221 |
| Malibu (Surfrider) | 357 | 0 | – | 0 | – | 0.0% of 251 |
| Topanga | 356 | 0 | – | 1 | 0.0% | 0.0% of 240 |
| El Porto | 357 | 0 | – | 58 | 34.5% | 10.2% of 197 |
| Hermosa Pier | 358 | 0 | – | 58 | 24.1% | 7.6% of 185 |
| Huntington Pier | 359 | 0 | – | 52 | 23.1% | 5.5% of 220 |
| The Wedge | 359 | 0 | – | 18 | 72.2% | 4.7% of 277 |
| Salt Creek | 357 | 0 | – | 0 | – | – |
| Trestles | 358 | 0 | – | 0 | – | – |
| Oceanside Pier | 356 | 0 | – | 11 | 90.9% | 4.0% of 249 |
| Swami’s | 357 | 0 | – | 14 | 64.3% | 3.9% of 231 |
| Cardiff Reef | 357 | 0 | – | 14 | 78.6% | 4.6% of 239 |
| Black’s Beach | 342 | 0 | – | 10 | 60.0% | 3.0% of 101 |
| Windansea | 342 | 0 | – | 10 | 60.0% | 2.0% of 102 |
| Ocean Beach (San Diego) | 342 | 0 | – | 7 | 14.3% | 1.1% of 94 |
| Imperial Beach | 343 | 0 | – | 10 | 60.0% | 2.6% of 77 |

## 6. Candidate fixes, chosen on the first 2/3 and reported on the last 1/3

Each candidate caps the forecast-fed score using only what the app has at that hour. "removed / lost" = observed-poor hours the cap takes from fair+ to below fair / observed-fine hours it takes below fair (a cost: those were fine). The share = of hours rated fair+, the share observed poor. Fit = the first 2/3 of both windows pooled; held-out = the last 1/3 of each window. **Rule (our own, fixed before the held-out numbers were read):** on the held-out hours of BOTH windows, at least 10 removed, removed more than twice lost, and the share down by at least 2 points. The chosen candidate per family is the best net (removed − 2 × lost) among those passing on the fit hours.

| candidate | fit: removed / lost | fit: share before → after | archive held-out: removed / lost | share | recent held-out: removed / lost | share | passes on both held-out sets |
|---|---|---|---|---|---|---|---|
| forecast onshore wind over 8 mph caps at 39 | 288 / 662 | 4.2% → 2.8% | 158 / 346 | 7.0% → 5.2% | 33 / 115 | 3.2% → 1.2% | no |
| forecast onshore wind over 10 mph caps at 39 | 193 / 231 | 4.2% → 3.2% | 92 / 81 | 7.0% → 5.9% | 21 / 32 | 3.2% → 1.9% | no |
| forecast onshore wind over 12 mph caps at 39 | 87 / 65 | 4.2% → 3.7% | 28 / 16 | 7.0% → 6.7% | 12 / 9 | 3.2% → 2.5% | no |
| forecast onshore wind over 15 mph caps at 39 | 20 / 8 | 4.2% → 4.1% | 3 / 3 | 7.0% → 7.0% | 4 / 1 | 3.2% → 3.0% | no |
| v1 surf height under 1 ft caps at 39 | 0 / 2 | 4.2% → 4.2% | 0 / 0 | 7.0% → 7.0% | 0 / 0 | 3.2% → 3.2% | no |
| v1 surf height under 1.5 ft caps at 39 | 24 / 226 | 4.2% → 4.1% | 5 / 74 | 7.0% → 7.0% | 0 / 0 | 3.2% → 3.2% | no |
| v1 surf height under 2 ft caps at 39 | 26 / 995 | 4.2% → 4.3% | 6 / 467 | 7.0% → 7.4% | 0 / 10 | 3.2% → 3.2% | no |
| offshore Hs under 1.5 ft caps at 39 | 38 / 97 | 4.2% → 4.0% | 2 / 2 | 7.0% → 7.0% | 0 / 0 | 3.2% → 3.2% | no |
| offshore Hs under 2 ft caps at 39 | 82 / 1159 | 4.2% → 4.0% | 10 / 372 | 7.0% → 7.3% | 0 / 0 | 3.2% → 3.2% | no |
| offshore Hs under 3 ft caps at 39 | 133 / 5449 | 4.2% → 4.9% | 65 / 2544 | 7.0% → 9.6% | 4 / 207 | 3.2% → 3.4% | no |

**The Call for a beginner** (too big for the skill): Skip when the typical estimate is above 4 ft. removed / lost = hours the change turns to Skip that were observed above / within the range; share = of the hours observed above 4 ft, the share the Call let through (Go or Worth a look).

| candidate | fit: removed / lost | fit: share before → after | archive held-out: removed / lost | share | recent held-out: removed / lost | share | passes on both held-out sets |
|---|---|---|---|---|---|---|---|
| beginner Call: Skip when the typical estimate is above 4 ft | 2164 / 1000 | 24.8% → 6.3% | 426 / 359 | 21.1% → 5.4% | 125 / 63 | 26.8% → 6.8% | no |

Chosen on the fit hours: wind: none passes on the fit hours; size: none passes on the fit hours.


<!-- notes -->
## Notes (written 2026-11-06; the tables above are regenerated by the script, these notes are not)

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
- Observed wind is from coastal stations up to 40 km away, uncorrected for anemometer height (stations stand 4–20 m up; the forecast is 10 m). Several spots use an offshore buoy.
- The forecast-fed rating uses Open-Meteo's archived short-range runs (close to a nowcast), not the days-ahead forecast; the Call uses MOP's nowcast in place of its forecast. Both are best cases.
- "Poor" covers only small surf and strong onshore wind. Cross-shore wind, closeouts and tide are not judged.
- The archive is winter–spring; the recent window is one autumn month.

### What would move this
A wind observation that stands for the beach (a beach station, or the user's own session reports of wind) to test the onshore cap again; and a rule for the wind factor that caps rather than only lowers. Both are inputs this audit does not have.
