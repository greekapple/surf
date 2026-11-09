# Rating check: Hawaii and the US East Coast (2026-11-09)

Generated 2026-11-09T22:34Z by `docs/forecast/data/rating-audit-hi-east.ts` (spec `docs/specs/2026-11-09-clock-perf-deselect.md`, 2B). Reproduce: `ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit-hi-east.ts --recent 2026-10-09T00:00:00Z/2026-11-09T00:00:00Z --winter 2025-12-01T00:00:00Z/2026-03-01T00:00:00Z`. **A report: no rating code was changed.** The California audit it mirrors: `RATING-AUDIT.md`.

**The question.** How often does the app's rating say fair or better (score 40+) when the observed conditions were poor, at the 282 Hawaii and US East spots?

**What each number is. Read this first.**
- **Observed swell = OFFSHORE SWELL at a wave buoy, not surf.** The buoy's measured significant wave height (Hs), dominant period and mean direction (NDBC stdmet via NOAA ERDDAP `cwwcNDBCMet`, the reading within 10 minutes of the hour). It is not the breaking wave height at the spot and this report never calls it surf height. Buoy rule: nearest NDBC-listed buoy (activestations.xml, type "buoy") within 40 km whose bearing from the spot lies inside the spot's swell window: the published guide window (src/ocean/spotFactsSourced.ts) limited to ±60° of the stated facing (clampWindow, as the app does); with a window but no stated facing, the guide window as published; with neither, the catalogue's seaward bearing ±60° (a map-placement value, labelled "seaward ±60°"); not one the app labels sheltered (src/ocean/buoys.ts); with Hs on 200+ hours of the window.
- **"Poor" for size = buoy Hs under 1 ft, an OFFSHORE PROXY.** The California audit's "surf under 1 ft" is a nearshore height carried to the spot's point by CDIP MOP (California only). Offshore Hs under 1 ft (0.3 m) is a much rarer, flatter sea state than nearshore under 1 ft, so this size criterion catches only dead-flat hours and the size-poor counts here are NOT comparable with California's. A looser 2 ft line is shown as a sensitivity check only.
- **Observed wind = measured at a shore station, not at the break.** Rule: nearest shore station within 7 km with wind on 200+ hours of the window: an airport ASOS (Iowa Environmental Mesonet), or a fixed NDBC/NOS met station the app shows as beach wind (NDBC_EXPOSURE pier or cove, src/ocean/shoreWind.ts); where the repo's enclosed-water mask covers the station it must also be outside enclosed water. The mask does not cover Hawaii or the East, so there the airports carry no enclosed-water check. No offshore buoys. A spot with no station, or with no stated facing (onshore cannot be judged), uses the swell-only poor criterion; the per-spot tables say which.
- **Forecast-fed rating** = `rateForecast` on the archived Open-Meteo Marine + Weather hours for the window (close to a nowcast, not the days-ahead forecast; lead-dependent parts judged 24 h ahead), exactly as the California audit.
- **Observed-fed rating** = the same engine (`provisionalRating`, as the California audit) on the buoy's Hs / period / direction as the swell (bulk values, no partition) plus the station's measured wind. Only hours with both, and with the buoy's period and direction present.
- **Poor** = buoy Hs under 1 ft OR measured onshore wind (within 45° of the facing) over 12 mph (`ONSHORE_BAD_MPH`). **Fair or better** = score 40+. Daylight hours only, in each spot's own time zone.
- Windows: **last 30 days** 2026-10-09 to 2026-11-08; **last winter** 2025-12-01 to 2026-02-28. Every threshold is OUR OWN CHOICE; this is a check against observations at a distance, not a validated accuracy figure. Missing readings are left out, never filled.

Spots with an eligible buoy: 96 of 282 (last 30 days), 98 of 282 (last winter).

## 1. Per region: how often a poor hour was rated fair or better

### Last 30 days (2026-10-09 to 2026-11-08)
| region | daylight hours | observed poor (buoy Hs under 1 ft offshore / measured onshore over 12 mph) | forecast-fed fair+ while poor | observed-fed fair+ while poor | of forecast-fed fair+ hours, observed poor |
|---|---|---|---|---|---|
| Oahu North (19 spots) | 7203 | 0 (0 Hs<1 ft, 0 onshore) | – (0) | – (0 of 0) | 0.0% (0 of 3831) |
| Oahu South (1 spots) | 375 | 5 (0 Hs<1 ft, 5 onshore) | 80.0% (4) | 100.0% (5 of 5) | 1.9% (4 of 208) |
| New York (3 spots) | 975 | 45 (45 Hs<1 ft, 0 onshore) | 0.0% (0) | – (0 of 0) | 0.0% (0 of 187) |
| New Jersey (16 spots) | 5614 | 45 (45 Hs<1 ft, 0 onshore) | 0.0% (0) | – (0 of 0) | 0.0% (0 of 967) |
| Virginia (4 spots) | 1476 | 88 (0 Hs<1 ft, 88 onshore) | 0.0% (0) | 43.2% (38 of 88) | 0.0% (0 of 201) |
| North Carolina (25 spots) | 9145 | 9 (9 Hs<1 ft, 0 onshore) | 0.0% (0) | 0.0% (0 of 6) | 0.0% (0 of 1296) |
| South Carolina (4 spots) | 1220 | 0 (0 Hs<1 ft, 0 onshore) | – (0) | – (0 of 0) | 0.0% (0 of 135) |
| Florida (24 spots) | 8888 | 243 (51 Hs<1 ft, 192 onshore) | 8.2% (20) | 57.8% (115 of 199) | 1.4% (20 of 1419) |
| **US East, all** | 27318 | 430 (150 Hs<1 ft, 280 onshore) | 4.7% (20) | 52.2% (153 of 293) | 0.5% (20 of 4205) |
| **Hawaii + East, all** | 34896 | 435 (150 Hs<1 ft, 285 onshore) | 5.5% (24) | 53.0% (158 of 298) | 0.3% (24 of 8244) |

### Last winter (2025-12-01 to 2026-02-28)
| region | daylight hours | observed poor (buoy Hs under 1 ft offshore / measured onshore over 12 mph) | forecast-fed fair+ while poor | observed-fed fair+ while poor | of forecast-fed fair+ hours, observed poor |
|---|---|---|---|---|---|
| Oahu North (19 spots) | 18887 | 0 (0 Hs<1 ft, 0 onshore) | – (0) | – (0 of 0) | 0.0% (0 of 15367) |
| Oahu South (1 spots) | 1033 | 39 (0 Hs<1 ft, 39 onshore) | 23.1% (9) | 23.1% (9 of 39) | 2.4% (9 of 373) |
| New York (3 spots) | 2758 | 36 (36 Hs<1 ft, 0 onshore) | 0.0% (0) | – (0 of 0) | 0.0% (0 of 284) |
| New Jersey (16 spots) | 14739 | 12 (12 Hs<1 ft, 0 onshore) | 0.0% (0) | – (0 of 0) | 0.0% (0 of 1696) |
| Virginia (4 spots) | 3884 | 46 (20 Hs<1 ft, 26 onshore) | 4.3% (2) | 61.0% (25 of 41) | 0.4% (2 of 480) |
| North Carolina (30 spots) | 28301 | 113 (113 Hs<1 ft, 0 onshore) | 0.0% (0) | 66.7% (48 of 72) | 0.0% (0 of 2827) |
| South Carolina (1 spots) | 1009 | 58 (58 Hs<1 ft, 0 onshore) | 0.0% (0) | – (0 of 0) | 0.0% (0 of 29) |
| Florida (24 spots) | 21594 | 570 (426 Hs<1 ft, 144 onshore) | 5.1% (29) | 45.9% (107 of 233) | 1.4% (29 of 2087) |
| **US East, all** | 72285 | 835 (665 Hs<1 ft, 170 onshore) | 3.7% (31) | 52.0% (180 of 346) | 0.4% (31 of 7403) |
| **Hawaii + East, all** | 92205 | 874 (665 Hs<1 ft, 209 onshore) | 4.6% (40) | 49.1% (189 of 385) | 0.2% (40 of 23143) |

**California, for comparison** (`RATING-AUDIT.md`, different windows and a nearshore size criterion; "either" row and section 3): archive 2025-11-01 to 2026-05-01: forecast-fed fair+ while poor 36.9%, observed-fed 72.0%, of forecast-fed fair+ hours observed poor 2.7%; recent 2026-10-07 to 2026-11-06: 50.0%, 78.7%, 5.7%. California's onshore-wind row alone: 28.3% / 71.1% (archive), 50.0% / 78.7% (recent).

## 2. Size only: offshore buoy Hs under 1 ft, and the 2 ft sensitivity line

### Last 30 days
| region | daylight hours | buoy Hs under 1 ft | … forecast-fed fair+ | buoy Hs under 2 ft (sensitivity) | … forecast-fed fair+ | … observed-fed fair+ (hours with wind) |
|---|---|---|---|---|---|---|
| Oahu North | 7203 | 0 | – | 0 | – | – |
| Oahu South | 375 | 0 | – | 20 | 100.0% | 100.0% |
| New York | 975 | 45 | 0.0% | 252 | 2.0% | – |
| New Jersey | 5614 | 45 | 0.0% | 1029 | 1.7% | – |
| Virginia | 1476 | 0 | – | 164 | 1.2% | 35.1% |
| North Carolina | 9145 | 9 | 0.0% | 712 | 0.0% | 3.8% |
| South Carolina | 1220 | 0 | – | 164 | 9.8% | – |
| Florida | 8888 | 51 | 0.0% | 1375 | 1.1% | 31.7% |

### Last winter
| region | daylight hours | buoy Hs under 1 ft | … forecast-fed fair+ | buoy Hs under 2 ft (sensitivity) | … forecast-fed fair+ | … observed-fed fair+ (hours with wind) |
|---|---|---|---|---|---|---|
| Oahu North | 18887 | 0 | – | 0 | – | – |
| Oahu South | 1033 | 0 | – | 253 | 65.2% | 60.0% |
| New York | 2758 | 36 | 0.0% | 429 | 3.0% | – |
| New Jersey | 14739 | 12 | 0.0% | 833 | 8.3% | – |
| Virginia | 3884 | 20 | 0.0% | 624 | 9.0% | 46.9% |
| North Carolina | 28301 | 113 | 0.0% | 4113 | 2.4% | 28.9% |
| South Carolina | 1009 | 58 | 0.0% | 482 | 1.9% | – |
| Florida | 21594 | 426 | 5.4% | 7718 | 4.4% | 65.9% |

## 2b. Is the observed-fed rating a fair comparison? (control)

The observed-fed rating feeds the engine the buoy's BULK Hs as the primary swell with no secondary swell and no surf-range estimate. The engine scores "organization" higher the larger the primary swell's share of Hs (100% with bulk input) and applies a wide-range ceiling only when a surf estimate exists, so that construction alone can raise a score. The control column rebuilds the FORECAST inputs the same way (Open-Meteo's combined Hs as the only swell, its period and direction, forecast wind) on the same poor hours. If the control is close to the observed-fed column, the gap to the app's rating is the construction, not the buoy.

### Last 30 days
| region | poor hours with both ratings | forecast-fed fair+ (the app's rating) | CONTROL: forecast inputs rebuilt like the observed-fed ones (bulk Hs as the only swell, no secondary swell, no surf-range ceiling) fair+ | observed-fed fair+ |
|---|---|---|---|---|
| Oahu North | 0 | – | – | – |
| Oahu South | 5 | 80.0% | 100.0% | 100.0% |
| New York | 0 | – | – | – |
| New Jersey | 0 | – | – | – |
| Virginia | 88 | 0.0% | 52.3% | 43.2% |
| North Carolina | 6 | 0.0% | 0.0% | 0.0% |
| South Carolina | 0 | – | – | – |
| Florida | 199 | 10.1% | 54.3% | 57.8% |
| **all** | 298 | 8.1% | 53.4% | 53.0% |

### Last winter
| region | poor hours with both ratings | forecast-fed fair+ (the app's rating) | CONTROL: forecast inputs rebuilt like the observed-fed ones (bulk Hs as the only swell, no secondary swell, no surf-range ceiling) fair+ | observed-fed fair+ |
|---|---|---|---|---|
| Oahu North | 0 | – | – | – |
| Oahu South | 39 | 23.1% | 71.8% | 23.1% |
| New York | 0 | – | – | – |
| New Jersey | 0 | – | – | – |
| Virginia | 41 | 4.9% | 9.8% | 61.0% |
| North Carolina | 72 | 0.0% | 0.0% | 66.7% |
| South Carolina | 0 | – | – | – |
| Florida | 233 | 3.9% | 16.7% | 45.9% |
| **all** | 385 | 5.2% | 18.4% | 49.1% |

## 3. Per spot

### Last 30 days

**Oahu North**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Velzyland | 51201 Waimea Bay, HI (106), 8.8 km at 260° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Backyards | 51201 Waimea Bay, HI (106), 8.2 km at 261° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Sunset | 51201 Waimea Bay, HI (106), 7.9 km at 264° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Rocky Point | 51201 Waimea Bay, HI (106), 7.2 km at 270° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Chambers | 51201 Waimea Bay, HI (106), 7 km at 273° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Ehukai | 51201 Waimea Bay, HI (106), 6.9 km at 275° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Pipeline & Backdoor | 51201 Waimea Bay, HI (106), 6.8 km at 276° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Off-The-Wall | 51201 Waimea Bay, HI (106), 6.6 km at 277° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Rockpile | 51201 Waimea Bay, HI (106), 6.4 km at 278° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Log Cabins | 51201 Waimea Bay, HI (106), 6.1 km at 279° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Waimea Bay | 51201 Waimea Bay, HI (106), 6.2 km at 300° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Marijuana's | 51201 Waimea Bay, HI (106), 6.3 km at 307° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Chun's | 51201 Waimea Bay, HI (106), 6.3 km at 325° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Jocko's | 51201 Waimea Bay, HI (106), 6.3 km at 328° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Hultin's | 51201 Waimea Bay, HI (106), 6.3 km at 330° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Himalayas | 51201 Waimea Bay, HI (106), 5.9 km at 336° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Laniakea | 51201 Waimea Bay, HI (106), 6.5 km at 331° | none: swell-only | 379 | 0 (0 / 0) | – | – | 0.0% |
| Haleiwa | 51201 Waimea Bay, HI (106), 8.4 km at 354° | none: swell-only | 380 | 0 (0 / 0) | – | – | 0.0% |
| Mokuleia | 51201 Waimea Bay, HI (106), 12.1 km at 39° | none: swell-only | 380 | 0 (0 / 0) | – | – | 0.0% |

**Oahu South**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Ewa Beach Park | 51211 Pearl Harbor Entrance, HI (233), 3.2 km at 129° | PHNL (Honolulu; airfield, no enclosed-water check), 6.3 km | 375 | 5 (0 / 5) | 80.0% | 100.0% | 1.9% |

**New York**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Gilgo Beach | 44065 New York Harbor Entrance - 15 NM SE of Breezy Point , NY, 38 km at 223° | none: swell-only | 325 | 15 (15 / 0) | 0.0% | – | 0.0% |
| Jones Beach State Park | 44065 New York Harbor Entrance - 15 NM SE of Breezy Point , NY, 29.8 km at 213° | none: swell-only | 325 | 15 (15 / 0) | 0.0% | – | 0.0% |
| West End, Jones Beach | 44065 New York Harbor Entrance - 15 NM SE of Breezy Point , NY, 25.7 km at 206° | none: swell-only | 325 | 15 (15 / 0) | 0.0% | – | 0.0% |

**New Jersey**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Belmar to Sea Girt | 44065 New York Harbor Entrance - 15 NM SE of Breezy Point , NY, 35.5 km at 49° | none: swell-only | 327 | 15 (15 / 0) | 0.0% | – | 0.0% |
| Mantoloking | 44091 Barnegat, NJ (209), 37.1 km at 140° | none: swell-only | 352 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Lavallette | 44091 Barnegat, NJ (209), 34.3 km at 133° | none: swell-only | 352 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Lavallette | 44091 Barnegat, NJ (209), 33.4 km at 131° | none: swell-only | 352 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Ortley Beach | 44091 Barnegat, NJ (209), 32.7 km at 129° | none: swell-only | 352 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Seaside Heights/ Casino Pier | 44091 Barnegat, NJ (209), 31.8 km at 126° | none: swell-only | 352 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Meters | 44091 Barnegat, NJ (209), 31.6 km at 126° | none: swell-only | 352 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Seaside Park | 44091 Barnegat, NJ (209), 30.8 km at 122° | none: swell-only | 352 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Island Beach State Park | 44091 Barnegat, NJ (209), 27.8 km at 105° | none: swell-only | 352 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Island Beach State Park | 44091 Barnegat, NJ (209), 27.7 km at 95° | none: swell-only | 353 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Barnegat Light | 44091 Barnegat, NJ (209), 28.4 km at 85° | none: swell-only | 353 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Harvey Cedars | 44091 Barnegat, NJ (209), 32.4 km at 75° | none: swell-only | 353 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Surf City | 44091 Barnegat, NJ (209), 35.8 km at 70° | none: swell-only | 353 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Ship Bottom | 44091 Barnegat, NJ (209), 36.9 km at 69° | none: swell-only | 353 | 2 (2 / 0) | 0.0% | – | 0.0% |
| 711 | 44091 Barnegat, NJ (209), 37.1 km at 68° | none: swell-only | 353 | 2 (2 / 0) | 0.0% | – | 0.0% |
| 30th Street (Ship Bottom) | 44091 Barnegat, NJ (209), 38.5 km at 67° | none: swell-only | 353 | 2 (2 / 0) | 0.0% | – | 0.0% |

**Virginia**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| South End | 44099 Cape Henry, VA (147), 23.6 km at 70° | NTU (OCEANA NAS/SOUCEK; airfield, no enclosed-water check), 6 km (no stated facing: not judged onshore) | 369 | 0 (0 / 0) | – | – | 0.0% |
| Croatan to Pendleton | 44099 Cape Henry, VA (147), 24.3 km at 64° | NTU (OCEANA NAS/SOUCEK; airfield, no enclosed-water check), 5.9 km | 369 | 44 (0 / 44) | 0.0% | 43.2% | 0.0% |
| Camp Pendleton | 44099 Cape Henry, VA (147), 24.3 km at 63° | NTU (OCEANA NAS/SOUCEK; airfield, no enclosed-water check), 6 km | 369 | 44 (0 / 44) | 0.0% | 43.2% | 0.0% |
| Little Island Fishing Pier | 44099 Cape Henry, VA (147), 30.4 km at 36° | none: swell-only | 369 | 0 (0 / 0) | – | – | 0.0% |

**North Carolina**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Duck Pier | 44056 Duck FRF, NC, 3.8 km at 58° | DUKN7 ( 8651370 - Duck Pier, NC ; pier (NDBC_EXPOSURE)), 0.4 km (no stated facing: not judged onshore) | 366 | 1 (1 / 0) | 0.0% | 0.0% | 0.0% |
| Southern Duck | 44056 Duck FRF, NC, 5.2 km at 27° | DUKN7 ( 8651370 - Duck Pier, NC ; pier (NDBC_EXPOSURE)), 2.9 km (no stated facing: not judged onshore) | 366 | 1 (1 / 0) | 0.0% | 0.0% | 0.0% |
| Kitty Hawk Pier | 44056 Duck FRF, NC, 10.9 km at 358° | none: swell-only | 366 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Eckner Street | 44100 Duck FRF 26m, NC (430), 21.2 km at 27° | none: swell-only | 365 | 0 (0 / 0) | – | – | 0.0% |
| Laundromats | 44056 Duck FRF, NC, 14.4 km at 352° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 6.1 km (no stated facing: not judged onshore) | 366 | 1 (1 / 0) | 0.0% | 0.0% | 0.0% |
| Avalon Pier | 44056 Duck FRF, NC, 17.6 km at 348° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 2.8 km (no stated facing: not judged onshore) | 366 | 1 (1 / 0) | 0.0% | 0.0% | 0.0% |
| Avalon Pier | 44086 Nags Head, NC (243), 23.2 km at 102° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 2.7 km (no stated facing: not judged onshore) | 366 | 0 (0 / 0) | – | – | 0.0% |
| Third Street | 44086 Nags Head, NC (243), 22.5 km at 99° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 1.6 km (no stated facing: not judged onshore) | 366 | 0 (0 / 0) | – | – | 0.0% |
| 1st Street | 44056 Duck FRF, NC, 19.3 km at 346° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 1.4 km (no stated facing: not judged onshore) | 366 | 1 (1 / 0) | 0.0% | 0.0% | 0.0% |
| Bath House | 44086 Nags Head, NC (243), 20.9 km at 95° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 1.6 km (no stated facing: not judged onshore) | 366 | 0 (0 / 0) | – | – | 0.0% |
| Martin St. | 44086 Nags Head, NC (243), 20.6 km at 92° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 2.3 km (no stated facing: not judged onshore) | 366 | 0 (0 / 0) | – | – | 0.0% |
| Eighth Street | 44086 Nags Head, NC (243), 20.1 km at 88° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 3.6 km (no stated facing: not judged onshore) | 366 | 0 (0 / 0) | – | – | 0.0% |
| Abalone St. | 44086 Nags Head, NC (243), 19.7 km at 85° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 4.6 km (no stated facing: not judged onshore) | 366 | 0 (0 / 0) | – | – | 0.0% |
| Nags Head Pier | 44056 Duck FRF, NC, 26.3 km at 343° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 6.3 km (no stated facing: not judged onshore) | 366 | 1 (1 / 0) | 0.0% | 0.0% | 0.0% |
| Loggerhead St. | 44086 Nags Head, NC (243), 18.6 km at 69° | none: swell-only | 366 | 0 (0 / 0) | – | – | 0.0% |
| Jennette's Pier | 44056 Duck FRF, NC, 34 km at 342° | none: swell-only | 366 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Outer Banks Pier | 44056 Duck FRF, NC, 36.9 km at 341° | none: swell-only | 366 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Askins Creek | 41120 Cape Hatteras East, NC (250), 21.3 km at 109° | none: swell-only | 371 | 0 (0 / 0) | – | – | 0.0% |
| North Buxton | 41120 Cape Hatteras East, NC (250), 21.2 km at 93° | none: swell-only | 371 | 0 (0 / 0) | – | – | 0.0% |
| Cape Hatteras Lighthouse | 41120 Cape Hatteras East, NC (250), 21.4 km at 89° | none: swell-only | 371 | 0 (0 / 0) | – | – | 0.0% |
| Hatteras Ferry Docks | 41025 Diamond Shoals, NC, 35.5 km at 124° | none: swell-only | 339 | 0 (0 / 0) | – | – | 0.0% |
| Figure Eight and Shell Islands | 41110 Masonboro Inlet, ILM2, NC (150), 14.4 km at 171° | none: swell-only | 368 | 0 (0 / 0) | – | – | 0.0% |
| North End Wrightsville Beach | 41110 Masonboro Inlet, ILM2, NC (150), 11.4 km at 152° | none: swell-only | 368 | 0 (0 / 0) | – | – | 0.0% |
| C Street, Wrightsville Beach | 41110 Masonboro Inlet, ILM2, NC (150), 10.2 km at 135° | none: swell-only | 368 | 0 (0 / 0) | – | – | 0.0% |
| Crystal Pier | 41110 Masonboro Inlet, ILM2, NC (150), 9.9 km at 123° | none: swell-only | 368 | 0 (0 / 0) | – | – | 0.0% |

**South Carolina**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Dewees Island | 41065 Capers Nearshore Waves (CAP2WAVE), 9.1 km at 111° | none: swell-only | 305 | 0 (0 / 0) | – | – | 0.0% |
| Wild Dunes | 41065 Capers Nearshore Waves (CAP2WAVE), 10.6 km at 91° | none: swell-only | 305 | 0 (0 / 0) | – | – | 0.0% |
| Isle of Palms Pier | 41065 Capers Nearshore Waves (CAP2WAVE), 15.6 km at 83° | none: swell-only | 305 | 0 (0 / 0) | – | – | 0.0% |
| Folly Beach Pier | 41065 Capers Nearshore Waves (CAP2WAVE), 34.2 km at 61° | none: swell-only | 305 | 0 (0 / 0) | – | – | 0.0% |

**Florida**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Ft. Clinch State Park | 41112 Offshore Fernandina Beach, FL (132), 12.8 km at 85° | none: swell-only | 372 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Amelia Pier | 41112 Offshore Fernandina Beach, FL (132), 17 km at 55° | FHB (Fernandina Beach; airfield, no enclosed-water check), 2.5 km | 372 | 37 (1 / 36) | 13.5% | 48.6% | 5.6% |
| Peters Point | 41112 Offshore Fernandina Beach, FL (132), 18.9 km at 50° | FHB (Fernandina Beach; airfield, no enclosed-water check), 2.2 km | 372 | 37 (1 / 36) | 13.5% | 48.6% | 5.6% |
| American Beach | 41112 Offshore Fernandina Beach, FL (132), 20.7 km at 45° | FHB (Fernandina Beach; airfield, no enclosed-water check), 4.2 km | 372 | 37 (1 / 36) | 18.9% | 48.6% | 7.3% |
| Gate Station | 41117 St. Augustine, FL (194), 23.5 km at 96° | none: swell-only | 371 | 0 (0 / 0) | – | – | 0.0% |
| St. Augustine Pier | 41117 St. Augustine, FL (194), 23.8 km at 48° | none: swell-only | 371 | 0 (0 / 0) | – | – | 0.0% |
| A St. | 41117 St. Augustine, FL (194), 24.5 km at 46° | none: swell-only | 371 | 0 (0 / 0) | – | – | 0.0% |
| Crescent Beach | 41117 St. Augustine, FL (194), 30.5 km at 33° | none: swell-only | 371 | 0 (0 / 0) | – | – | 0.0% |
| Jetty Park | 41113 Cape Canaveral Nearshore, FL (143), 5.5 km at 98° | TRDF1 (8721604 - Trident Pier, FL; pier (NDBC_EXPOSURE)), 1.1 km | 369 | 3 (1 / 2) | 0.0% | 33.3% | 0.0% |
| Cocoa Beach | 41113 Cape Canaveral Nearshore, FL (143), 7.5 km at 62° | TRDF1 (8721604 - Trident Pier, FL; pier (NDBC_EXPOSURE)), 5.4 km | 369 | 37 (1 / 36) | 2.7% | 78.4% | 2.4% |
| Shepard Park | 41113 Cape Canaveral Nearshore, FL (143), 8.3 km at 56° | TRDF1 (8721604 - Trident Pier, FL; pier (NDBC_EXPOSURE)), 6.5 km | 369 | 37 (1 / 36) | 2.7% | 78.4% | 2.4% |
| Lori Wilson Park | 41113 Cape Canaveral Nearshore, FL (143), 10 km at 46° | none: swell-only | 369 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Minuteman | 41113 Cape Canaveral Nearshore, FL (143), 11.5 km at 38° | none: swell-only | 369 | 1 (1 / 0) | 0.0% | – | 0.0% |
| 16th St. South | 41113 Cape Canaveral Nearshore, FL (143), 14.2 km at 30° | COF (PATRICK AFB/COCOA B; airfield, no enclosed-water check), 6.1 km | 369 | 11 (1 / 10) | 9.1% | 18.2% | 1.4% |
| Bicentennial Beach Park | 41113 Cape Canaveral Nearshore, FL (143), 27.8 km at 10° | none: swell-only | 369 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Canova Beach | 41113 Cape Canaveral Nearshore, FL (143), 29.4 km at 9° | none: swell-only | 369 | 1 (1 / 0) | 0.0% | – | 0.0% |
| The Boardwalk | 41113 Cape Canaveral Nearshore, FL (143), 34.4 km at 5° | none: swell-only | 369 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Melbourne Beach | 41113 Cape Canaveral Nearshore, FL (143), 36.9 km at 3° | none: swell-only | 369 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Vero Beach Pier | 41114 Fort Pierce, FL (134), 17.1 km at 126° | VRB (Vero Beach; airfield, no enclosed-water check), 6.2 km (no stated facing: not judged onshore) | 372 | 0 (0 / 0) | – | – | 0.0% |
| P.V. Martin's | 41114 Fort Pierce, FL (134), 10.5 km at 63° | none: swell-only | 372 | 0 (0 / 0) | – | – | 0.0% |
| Fort Pierce North Jetty | 41114 Fort Pierce, FL (134), 12.3 km at 36° | none: swell-only | 372 | 0 (0 / 0) | – | – | 0.0% |
| Blue Heron Beach | 41114 Fort Pierce, FL (134), 15.8 km at 23° | none: swell-only | 372 | 0 (0 / 0) | – | – | 0.0% |
| Walton Rocks | 41114 Fort Pierce, FL (134), 25.1 km at 4° | none: swell-only | 372 | 0 (0 / 0) | – | – | 0.0% |
| South Beach (Florida) | 41122 Hollywood Beach, FL (265), 26.4 km at 7° | none: swell-only | 366 | 37 (37 / 0) | 0.0% | – | 0.0% |

### Last winter

**Oahu North**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Velzyland | 51201 Waimea Bay, HI (106), 8.8 km at 260° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Backyards | 51201 Waimea Bay, HI (106), 8.2 km at 261° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Sunset | 51201 Waimea Bay, HI (106), 7.9 km at 264° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Rocky Point | 51201 Waimea Bay, HI (106), 7.2 km at 270° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Chambers | 51201 Waimea Bay, HI (106), 7 km at 273° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Ehukai | 51201 Waimea Bay, HI (106), 6.9 km at 275° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Pipeline & Backdoor | 51201 Waimea Bay, HI (106), 6.8 km at 276° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Off-The-Wall | 51201 Waimea Bay, HI (106), 6.6 km at 277° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Rockpile | 51201 Waimea Bay, HI (106), 6.4 km at 278° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Log Cabins | 51201 Waimea Bay, HI (106), 6.1 km at 279° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Waimea Bay | 51201 Waimea Bay, HI (106), 6.2 km at 300° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Marijuana's | 51201 Waimea Bay, HI (106), 6.3 km at 307° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Chun's | 51201 Waimea Bay, HI (106), 6.3 km at 325° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Jocko's | 51201 Waimea Bay, HI (106), 6.3 km at 328° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Hultin's | 51201 Waimea Bay, HI (106), 6.3 km at 330° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Himalayas | 51201 Waimea Bay, HI (106), 5.9 km at 336° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Laniakea | 51201 Waimea Bay, HI (106), 6.5 km at 331° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Haleiwa | 51201 Waimea Bay, HI (106), 8.4 km at 354° | none: swell-only | 994 | 0 (0 / 0) | – | – | 0.0% |
| Mokuleia | 51201 Waimea Bay, HI (106), 12.1 km at 39° | none: swell-only | 995 | 0 (0 / 0) | – | – | 0.0% |

**Oahu South**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Ewa Beach Park | 51211 Pearl Harbor Entrance, HI (233), 3.2 km at 129° | PHNL (Honolulu; airfield, no enclosed-water check), 6.3 km | 1033 | 39 (0 / 39) | 23.1% | 23.1% | 2.4% |

**New York**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Gilgo Beach | 44065 New York Harbor Entrance - 15 NM SE of Breezy Point , NY, 38 km at 223° | none: swell-only | 919 | 12 (12 / 0) | 0.0% | – | 0.0% |
| Jones Beach State Park | 44065 New York Harbor Entrance - 15 NM SE of Breezy Point , NY, 29.8 km at 213° | none: swell-only | 919 | 12 (12 / 0) | 0.0% | – | 0.0% |
| West End, Jones Beach | 44065 New York Harbor Entrance - 15 NM SE of Breezy Point , NY, 25.7 km at 206° | none: swell-only | 920 | 12 (12 / 0) | 0.0% | – | 0.0% |

**New Jersey**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Belmar to Sea Girt | 44065 New York Harbor Entrance - 15 NM SE of Breezy Point , NY, 35.5 km at 49° | none: swell-only | 921 | 12 (12 / 0) | 0.0% | – | 0.0% |
| Mantoloking | 44091 Barnegat, NJ (209), 37.1 km at 140° | none: swell-only | 920 | 0 (0 / 0) | – | – | 0.0% |
| Lavallette | 44091 Barnegat, NJ (209), 34.3 km at 133° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Lavallette | 44091 Barnegat, NJ (209), 33.4 km at 131° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Ortley Beach | 44091 Barnegat, NJ (209), 32.7 km at 129° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Seaside Heights/ Casino Pier | 44091 Barnegat, NJ (209), 31.8 km at 126° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Meters | 44091 Barnegat, NJ (209), 31.6 km at 126° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Seaside Park | 44091 Barnegat, NJ (209), 30.8 km at 122° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Island Beach State Park | 44091 Barnegat, NJ (209), 27.8 km at 105° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Island Beach State Park | 44091 Barnegat, NJ (209), 27.7 km at 95° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Barnegat Light | 44091 Barnegat, NJ (209), 28.4 km at 85° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Harvey Cedars | 44091 Barnegat, NJ (209), 32.4 km at 75° | none: swell-only | 921 | 0 (0 / 0) | – | – | 0.0% |
| Surf City | 44091 Barnegat, NJ (209), 35.8 km at 70° | none: swell-only | 922 | 0 (0 / 0) | – | – | 0.0% |
| Ship Bottom | 44091 Barnegat, NJ (209), 36.9 km at 69° | none: swell-only | 922 | 0 (0 / 0) | – | – | 0.0% |
| 711 | 44091 Barnegat, NJ (209), 37.1 km at 68° | none: swell-only | 922 | 0 (0 / 0) | – | – | 0.0% |
| 30th Street (Ship Bottom) | 44091 Barnegat, NJ (209), 38.5 km at 67° | none: swell-only | 922 | 0 (0 / 0) | – | – | 0.0% |

**Virginia**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| South End | 44099 Cape Henry, VA (147), 23.6 km at 70° | NTU (OCEANA NAS/SOUCEK; airfield, no enclosed-water check), 6 km (no stated facing: not judged onshore) | 971 | 5 (5 / 0) | 0.0% | 100.0% | 0.0% |
| Croatan to Pendleton | 44099 Cape Henry, VA (147), 24.3 km at 64° | NTU (OCEANA NAS/SOUCEK; airfield, no enclosed-water check), 5.9 km | 971 | 18 (5 / 13) | 5.6% | 55.6% | 0.5% |
| Camp Pendleton | 44099 Cape Henry, VA (147), 24.3 km at 63° | NTU (OCEANA NAS/SOUCEK; airfield, no enclosed-water check), 6 km | 971 | 18 (5 / 13) | 5.6% | 55.6% | 0.5% |
| Little Island Fishing Pier | 44099 Cape Henry, VA (147), 30.4 km at 36° | none: swell-only | 971 | 5 (5 / 0) | 0.0% | – | 0.0% |

**North Carolina**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Duck Pier | 44056 Duck FRF, NC, 3.8 km at 58° | DUKN7 ( 8651370 - Duck Pier, NC ; pier (NDBC_EXPOSURE)), 0.4 km (no stated facing: not judged onshore) | 967 | 11 (11 / 0) | 0.0% | 63.6% | 0.0% |
| Southern Duck | 44056 Duck FRF, NC, 5.2 km at 27° | DUKN7 ( 8651370 - Duck Pier, NC ; pier (NDBC_EXPOSURE)), 2.9 km (no stated facing: not judged onshore) | 967 | 11 (11 / 0) | 0.0% | 63.6% | 0.0% |
| Kitty Hawk Pier | 44056 Duck FRF, NC, 10.9 km at 358° | none: swell-only | 967 | 11 (11 / 0) | 0.0% | – | 0.0% |
| Eckner Street | 44100 Duck FRF 26m, NC (430), 21.2 km at 27° | none: swell-only | 815 | 7 (7 / 0) | 0.0% | – | 0.0% |
| Laundromats | 44056 Duck FRF, NC, 14.4 km at 352° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 6.1 km (no stated facing: not judged onshore) | 967 | 11 (11 / 0) | 0.0% | 63.6% | 0.0% |
| Avalon Pier | 44056 Duck FRF, NC, 17.6 km at 348° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 2.8 km (no stated facing: not judged onshore) | 967 | 11 (11 / 0) | 0.0% | 63.6% | 0.0% |
| Avalon Pier | 44086 Nags Head, NC (243), 23.2 km at 102° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 2.7 km (no stated facing: not judged onshore) | 969 | 1 (1 / 0) | 0.0% | 100.0% | 0.0% |
| Third Street | 44086 Nags Head, NC (243), 22.5 km at 99° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 1.6 km (no stated facing: not judged onshore) | 969 | 1 (1 / 0) | 0.0% | 100.0% | 0.0% |
| 1st Street | 44056 Duck FRF, NC, 19.3 km at 346° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 1.4 km (no stated facing: not judged onshore) | 967 | 11 (11 / 0) | 0.0% | 63.6% | 0.0% |
| Bath House | 44086 Nags Head, NC (243), 20.9 km at 95° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 1.6 km (no stated facing: not judged onshore) | 970 | 1 (1 / 0) | 0.0% | 100.0% | 0.0% |
| Martin St. | 44086 Nags Head, NC (243), 20.6 km at 92° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 2.3 km (no stated facing: not judged onshore) | 970 | 1 (1 / 0) | 0.0% | 100.0% | 0.0% |
| Eighth Street | 44086 Nags Head, NC (243), 20.1 km at 88° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 3.6 km (no stated facing: not judged onshore) | 970 | 1 (1 / 0) | 0.0% | 100.0% | 0.0% |
| Abalone St. | 44086 Nags Head, NC (243), 19.7 km at 85° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 4.6 km (no stated facing: not judged onshore) | 970 | 1 (1 / 0) | 0.0% | 100.0% | 0.0% |
| Nags Head Pier | 44056 Duck FRF, NC, 26.3 km at 343° | FFA (KILL_DEVIL_HILLS; airfield, no enclosed-water check), 6.3 km (no stated facing: not judged onshore) | 968 | 11 (11 / 0) | 0.0% | 63.6% | 0.0% |
| Loggerhead St. | 44086 Nags Head, NC (243), 18.6 km at 69° | none: swell-only | 971 | 1 (1 / 0) | 0.0% | – | 0.0% |
| Jennette's Pier | 44056 Duck FRF, NC, 34 km at 342° | none: swell-only | 969 | 11 (11 / 0) | 0.0% | – | 0.0% |
| Outer Banks Pier | 44056 Duck FRF, NC, 36.9 km at 341° | none: swell-only | 969 | 11 (11 / 0) | 0.0% | – | 0.0% |
| Askins Creek | 41120 Cape Hatteras East, NC (250), 21.3 km at 109° | none: swell-only | 670 | 0 (0 / 0) | – | – | 0.0% |
| North Buxton | 41120 Cape Hatteras East, NC (250), 21.2 km at 93° | none: swell-only | 670 | 0 (0 / 0) | – | – | 0.0% |
| Cape Hatteras Lighthouse | 41120 Cape Hatteras East, NC (250), 21.4 km at 89° | none: swell-only | 670 | 0 (0 / 0) | – | – | 0.0% |
| Hatteras Ferry Docks | 41025 Diamond Shoals, NC, 35.5 km at 124° | none: swell-only | 979 | 0 (0 / 0) | – | – | 0.0% |
| Figure Eight and Shell Islands | 41110 Masonboro Inlet, ILM2, NC (150), 14.4 km at 171° | none: swell-only | 996 | 0 (0 / 0) | – | – | 0.0% |
| North End Wrightsville Beach | 41110 Masonboro Inlet, ILM2, NC (150), 11.4 km at 152° | none: swell-only | 999 | 0 (0 / 0) | – | – | 0.0% |
| C Street, Wrightsville Beach | 41110 Masonboro Inlet, ILM2, NC (150), 10.2 km at 135° | none: swell-only | 998 | 0 (0 / 0) | – | – | 0.0% |
| Crystal Pier | 41110 Masonboro Inlet, ILM2, NC (150), 9.9 km at 123° | none: swell-only | 998 | 0 (0 / 0) | – | – | 0.0% |
| Pelican Watch | 41108 Wilmington Harbor, NC - (200), 34.9 km at 198° | none: swell-only | 1001 | 0 (0 / 0) | – | – | 0.0% |
| Fort Fisher | 41108 Wilmington Harbor, NC - (200), 29.1 km at 198° | none: swell-only | 1002 | 0 (0 / 0) | – | – | 0.0% |
| Holden Beach | 41108 Wilmington Harbor, NC - (200), 33.7 km at 129° | none: swell-only | 1002 | 0 (0 / 0) | – | – | 0.0% |
| Longbeach | 41108 Wilmington Harbor, NC - (200), 21.9 km at 161° | SUT (SOUTHPORT/BRUNSWICK; airfield, no enclosed-water check), 3.2 km (no stated facing: not judged onshore) | 1002 | 0 (0 / 0) | – | – | 0.0% |
| Oak Island | 41108 Wilmington Harbor, NC - (200), 21.5 km at 163° | SUT (SOUTHPORT/BRUNSWICK; airfield, no enclosed-water check), 2.9 km (no stated facing: not judged onshore) | 1002 | 0 (0 / 0) | – | – | 0.0% |

**South Carolina**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Fripp Island | 41067 FRP2WAVE, 8.5 km at 117° | none: swell-only | 1009 | 58 (58 / 0) | 0.0% | – | 0.0% |

**Florida**

| spot | buoy (offshore swell) | wind station | daylight hours | poor (Hs<1 / onshore) | forecast-fed fair+ while poor | observed-fed fair+ while poor | fc fair+ hours observed poor |
|---|---|---|---|---|---|---|---|
| Ft. Clinch State Park | 41112 Offshore Fernandina Beach, FL (132), 12.8 km at 85° | none: swell-only | 588 | 2 (2 / 0) | 0.0% | – | 0.0% |
| Amelia Pier | 41112 Offshore Fernandina Beach, FL (132), 17 km at 55° | FHB (Fernandina Beach; airfield, no enclosed-water check), 2.5 km | 588 | 32 (2 / 30) | 6.3% | 31.3% | 2.6% |
| Peters Point | 41112 Offshore Fernandina Beach, FL (132), 18.9 km at 50° | FHB (Fernandina Beach; airfield, no enclosed-water check), 2.2 km | 588 | 32 (2 / 30) | 6.3% | 31.3% | 2.6% |
| American Beach | 41112 Offshore Fernandina Beach, FL (132), 20.7 km at 45° | FHB (Fernandina Beach; airfield, no enclosed-water check), 4.2 km | 588 | 32 (2 / 30) | 6.3% | 31.3% | 2.5% |
| Gate Station | 41117 St. Augustine, FL (194), 23.5 km at 96° | none: swell-only | 1014 | 15 (15 / 0) | 0.0% | – | 0.0% |
| St. Augustine Pier | 41117 St. Augustine, FL (194), 23.8 km at 48° | none: swell-only | 1014 | 15 (15 / 0) | 40.0% | – | 3.1% |
| A St. | 41117 St. Augustine, FL (194), 24.5 km at 46° | none: swell-only | 1014 | 15 (15 / 0) | 40.0% | – | 3.1% |
| Crescent Beach | 41117 St. Augustine, FL (194), 30.5 km at 33° | none: swell-only | 1014 | 15 (15 / 0) | 0.0% | – | 0.0% |
| Jetty Park | 41113 Cape Canaveral Nearshore, FL (143), 5.5 km at 98° | TRDF1 (8721604 - Trident Pier, FL; pier (NDBC_EXPOSURE)), 1.1 km | 976 | 42 (30 / 12) | 2.4% | 51.5% | 1.0% |
| Cocoa Beach | 41113 Cape Canaveral Nearshore, FL (143), 7.5 km at 62° | TRDF1 (8721604 - Trident Pier, FL; pier (NDBC_EXPOSURE)), 5.4 km | 977 | 35 (30 / 5) | 0.0% | 57.7% | 0.0% |
| Shepard Park | 41113 Cape Canaveral Nearshore, FL (143), 8.3 km at 56° | TRDF1 (8721604 - Trident Pier, FL; pier (NDBC_EXPOSURE)), 6.5 km | 977 | 35 (30 / 5) | 0.0% | 57.7% | 0.0% |
| Lori Wilson Park | 41113 Cape Canaveral Nearshore, FL (143), 10 km at 46° | none: swell-only | 977 | 30 (30 / 0) | 0.0% | – | 0.0% |
| Minuteman | 41113 Cape Canaveral Nearshore, FL (143), 11.5 km at 38° | none: swell-only | 977 | 30 (30 / 0) | 16.7% | – | 3.5% |
| 16th St. South | 41113 Cape Canaveral Nearshore, FL (143), 14.2 km at 30° | COF (PATRICK AFB/COCOA B; airfield, no enclosed-water check), 6.1 km | 977 | 62 (30 / 32) | 8.1% | 57.7% | 3.5% |
| Bicentennial Beach Park | 41113 Cape Canaveral Nearshore, FL (143), 27.8 km at 10° | none: swell-only | 978 | 30 (30 / 0) | 0.0% | – | 0.0% |
| Canova Beach | 41113 Cape Canaveral Nearshore, FL (143), 29.4 km at 9° | none: swell-only | 978 | 30 (30 / 0) | 0.0% | – | 0.0% |
| The Boardwalk | 41113 Cape Canaveral Nearshore, FL (143), 34.4 km at 5° | none: swell-only | 978 | 30 (30 / 0) | 0.0% | – | 0.0% |
| Melbourne Beach | 41113 Cape Canaveral Nearshore, FL (143), 36.9 km at 3° | none: swell-only | 978 | 30 (30 / 0) | 0.0% | – | 0.0% |
| Vero Beach Pier | 41114 Fort Pierce, FL (134), 17.1 km at 126° | VRB (Vero Beach; airfield, no enclosed-water check), 6.2 km (no stated facing: not judged onshore) | 1020 | 0 (0 / 0) | – | – | 0.0% |
| P.V. Martin's | 41114 Fort Pierce, FL (134), 10.5 km at 63° | none: swell-only | 1020 | 0 (0 / 0) | – | – | 0.0% |
| Fort Pierce North Jetty | 41114 Fort Pierce, FL (134), 12.3 km at 36° | none: swell-only | 1020 | 0 (0 / 0) | – | – | 0.0% |
| Blue Heron Beach | 41114 Fort Pierce, FL (134), 15.8 km at 23° | none: swell-only | 1020 | 0 (0 / 0) | – | – | 0.0% |
| Walton Rocks | 41114 Fort Pierce, FL (134), 25.1 km at 4° | none: swell-only | 1021 | 0 (0 / 0) | – | – | 0.0% |
| South Beach (Florida) | 41122 Hollywood Beach, FL (265), 26.4 km at 7° | none: swell-only | 312 | 58 (58 / 0) | 0.0% | – | 0.0% |

## 4. Spots with no eligible buoy (why)

**Oahu North** (3)

- Turtle Bay West: buoy(s) within 40 km but outside the swell window: 51201 12.5 km at 252°, 51210 35.9 km at 135°, 51207 36.3 km at 134° (window 278°–23°)
- Puaena Point: buoy(s) within 40 km but outside the swell window: 51201 7.9 km at 351°, 51212 31.2 km at 188°, 51211 37.1 km at 156°, 51210 38.6 km at 111°, 51207 39.1 km at 111° (window 270°–315°)
- Avalanche: buoy(s) within 40 km but outside the swell window: 51201 7.9 km at 356°, 51212 31.0 km at 187°, 51211 37.2 km at 155°, 51210 39.2 km at 110°, 51207 39.7 km at 110° (window 270°–330°)

**Oahu South** (21)

- Coves: buoy(s) within 40 km but outside the swell window: 51211 7.9 km at 95°, 51212 12.0 km at 281°, 51210 34.7 km at 56°, 51207 35.1 km at 57°, 51202 38.7 km at 71° (window 120°–240°)
- Ewa Beach: buoy(s) within 40 km but outside the swell window: 51211 4.5 km at 97°, 51212 15.4 km at 279°, 51210 32.0 km at 52°, 51207 32.4 km at 53°, 51202 35.5 km at 69° (window 113°–218°)
- White Plains Beach: buoy(s) within 40 km but outside the swell window: 51211 8.9 km at 92°, 51212 11.1 km at 283°, 51210 35.7 km at 57°, 51207 36.2 km at 57°, 51202 39.8 km at 71° (window 113°–218°)
- Sand Island: buoy(s) within 40 km but outside the swell window: 51211 8.7 km at 269°, 51210 23.3 km at 32°, 51207 23.5 km at 33°, 51202 23.8 km at 57°, 51212 28.5 km at 275° (window 135°–240°)
- Barbers Point: buoy(s) within 40 km but outside the swell window: 51212 5.4 km at 306°, 51211 15.3 km at 89° (window 143°–263°)
- Kewalo's: buoy(s) within 40 km but outside the swell window: 51211 10.3 km at 275°, 51202 23.2 km at 53°, 51210 23.5 km at 27°, 51207 23.7 km at 28°, 51212 30.2 km at 277° (window 143°–263°)
- South Shore - Ala Moana Park: buoy(s) within 40 km but outside the swell window: 51211 11.3 km at 276°, 51202 22.6 km at 51°, 51210 23.4 km at 25°, 51207 23.6 km at 26°, 51212 31.1 km at 278° (window 165°–270°)
- Tennis Courts: buoy(s) within 40 km but outside the swell window: 51211 11.0 km at 277°, 51202 23.0 km at 51°, 51210 23.6 km at 25°, 51207 23.8 km at 26°, 51212 30.9 km at 278° (window 143°–263°)
- Ala Moana Bowls: buoy(s) within 40 km but outside the swell window: 51211 12.1 km at 279°, 51202 22.5 km at 49°, 51210 23.7 km at 22°, 51207 23.9 km at 23°, 51212 32.0 km at 279° (window 135°–270°)
- Kaisers: buoy(s) within 40 km but outside the swell window: 51211 12.4 km at 280°, 51202 22.5 km at 47°, 51210 23.9 km at 21°, 51207 24.1 km at 22°, 51212 32.3 km at 279° (window 143°–263°)
- Waikiki Beach: buoy(s) within 40 km but outside the swell window: 51211 13.9 km at 280°, 51202 21.6 km at 44°, 51210 23.6 km at 18°, 51207 23.8 km at 19°, 51212 33.8 km at 279° (window 165°–270°)
- Three's and Four's: buoy(s) within 40 km but outside the swell window: 51211 12.9 km at 281°, 51202 22.4 km at 46°, 51210 24.0 km at 20°, 51207 24.2 km at 21°, 51212 32.8 km at 280° (window 143°–263°)
- Queen's: buoy(s) within 40 km but outside the swell window: 51211 14.0 km at 281°, 51202 21.6 km at 44°, 51210 23.7 km at 18°, 51207 23.8 km at 19°, 51212 33.9 km at 279° (window 165°–270°)
- Secrets/Toes: buoy(s) within 40 km but outside the swell window: 51202 17.0 km at 23°, 51211 22.2 km at 277°, 51207 22.6 km at 358°, 51210 22.6 km at 357° (window 113°–218°)
- Queens/Canoes: buoy(s) within 40 km but outside the swell window: 51211 13.8 km at 281°, 51202 21.9 km at 44°, 51210 23.8 km at 18°, 51207 24.0 km at 19°, 51212 33.7 km at 280° (window 165°–270°)
- Populars: buoy(s) within 40 km but outside the swell window: 51211 13.2 km at 282°, 51202 22.4 km at 45°, 51210 24.1 km at 19°, 51207 24.3 km at 20°, 51212 33.1 km at 280° (window 143°–263°)
- Publics: buoy(s) within 40 km but outside the swell window: 51211 14.2 km at 284°, 51202 22.3 km at 42°, 51210 24.5 km at 17°, 51207 24.7 km at 18°, 51212 34.1 km at 281° (window 188°–270°)
- Tonggs: buoy(s) within 40 km but outside the swell window: 51211 14.9 km at 287°, 51202 22.8 km at 40°, 51210 25.4 km at 15°, 51207 25.5 km at 16°, 51212 34.7 km at 282° (window 165°–270°)
- Black Point: buoy(s) within 40 km but outside the swell window: 51211 17.7 km at 285°, 51202 21.2 km at 33°, 51210 25.0 km at 9°, 51207 25.1 km at 10°, 51212 37.5 km at 282° (window 98°–218°)
- Cliffs: buoy(s) within 40 km but outside the swell window: 51211 16.8 km at 287°, 51202 22.0 km at 35°, 51210 25.4 km at 11°, 51207 25.5 km at 12°, 51212 36.6 km at 282° (window 120°–240°)
- Diamond Head: buoy(s) within 40 km but outside the swell window: 51211 16.7 km at 287°, 51202 22.1 km at 35°, 51210 25.5 km at 11°, 51207 25.6 km at 12°, 51212 36.5 km at 283° (window 120°–240°)

**Massachusetts** (2)

- Long Beach: buoy(s) within 40 km but outside the swell window: 44029 12.4 km at 160°, 44013 31.5 km at 185° (window 75°–135°)
- Good Harbour Beach: buoy(s) within 40 km but outside the swell window: 44029 11.9 km at 154°, 44013 30.4 km at 183° (window 75°–135°)

**Rhode Island** (2)

- Mansion Beach: no open-ocean buoy within 40 km
- Black Rock Point: no open-ocean buoy within 40 km

**New York** (10)

- Davis Park: buoy(s) within 40 km but outside the swell window: 44069 7.4 km at 283° (window 98°–218°)
- Point O’ Woods: buoy(s) within 40 km but outside the swell window: 44069 6.5 km at 32° (window 98°–218°)
- Ocean Bay Park: buoy(s) within 40 km but outside the swell window: 44069 7.1 km at 37° (window 120°–240°)
- Fire Island: buoy(s) within 40 km but outside the swell window: 44069 8.6 km at 43° (window 120°–225°)
- Atlantique Beach: buoy(s) within 40 km but outside the swell window: 44069 9.7 km at 47° (window 98°–218°)
- Fair Harbor: buoy(s) within 40 km but outside the swell window: 44069 10.6 km at 50° (window 98°–218°)
- Jones Beach State Park: buoy(s) within 40 km but outside the swell window: 44069 23.5 km at 70° (window 90°–180°)
- Robert Moses: buoy(s) within 40 km but outside the swell window: 44069 15.2 km at 57° (window 120°–240°)
- Robert Moses State Park: buoy(s) within 40 km but outside the swell window: 44069 17.0 km at 59° (window 120°–180°)
- Tobay Beach: buoy(s) within 40 km but outside the swell window: 44069 30.1 km at 71°, 44065 35.7 km at 221°, 44022 39.7 km at 320° (window 98°–218°)

**New Jersey** (12)

- 16th Ave., Belmar: buoy(s) within 40 km but outside the swell window: 44065 34.4 km at 51° (window 68°–180°)
- Spring Lake: buoy(s) within 40 km but outside the swell window: 44065 36.2 km at 49° (window 68°–180°)
- Sea Girt: buoy(s) within 40 km but outside the swell window: 44065 38.2 km at 46° (window 68°–158°)
- Manasquan Inlet: buoy(s) within 40 km but outside the swell window: 44065 39.7 km at 44° (window 90°–150°)
- Manasquan: no open-ocean buoy within 40 km
- Jenkinsons (Point Pleasant): no open-ocean buoy within 40 km
- Jenkinson's: no open-ocean buoy within 40 km
- Bay Head: no open-ocean buoy within 40 km
- Long Beach Township: no open-ocean buoy within 40 km
- Beach Haven: no open-ocean buoy within 40 km
- Holyoke: no open-ocean buoy within 40 km
- Hollyoake: no open-ocean buoy within 40 km

**Virginia** (5)

- Virginia Beach: buoy(s) in the window with under 200 h of Hs in the window: 44064 (19.8 km, 0 h of Hs)
- 1st Street Jetty: no swell window to check the buoy bearing against
- Croatan: no swell window to check the buoy bearing against
- Camp Pendleton: buoy(s) in the window with under 200 h of Hs in the window: 44064 (25.9 km, 0 h of Hs)
- Sandbridge Beach: buoy(s) within 40 km but outside the swell window: 44099 27.7 km at 44°, 44064 31.9 km at 336° (window 45°–135°)

**North Carolina** (29)

- Corolla Lighthouse: buoy(s) within 40 km but outside the swell window: 44056 22.1 km at 154°, FRFN7 22.2 km at 160°, 44100 24.6 km at 123° (window 180°–0°)
- Boilers/Ranger Station: buoy(s) within 40 km but outside the swell window: 44095 15.1 km at 76°, 44086 32.2 km at 11° (window 180°–0°)
- S Turns: no swell window to check the buoy bearing against
- Rodanthe Pier: no swell window to check the buoy bearing against
- K.O.A: no swell window to check the buoy bearing against
- Waves and Salvo: buoy(s) within 40 km but outside the swell window: 44095 25.8 km at 28°, 41120 35.9 km at 153° (window 45°–150°)
- Avon Pier: buoy(s) within 40 km but outside the swell window: 41120 21.8 km at 117°, 41025 37.3 km at 163° (window 180°–0°)
- The Lighthouse: buoy(s) within 40 km but outside the swell window: 41120 21.3 km at 89°, 41025 28.3 km at 153° (window 180°–0°)
- Frisco: buoy(s) within 40 km but outside the swell window: 41120 32.1 km at 84°, 41025 32.2 km at 134° (window 135°–225°)
- Frisco Pier: buoy(s) within 40 km but outside the swell window: 41025 32.0 km at 133°, 41120 32.1 km at 83° (window 225°–45°)
- The Point: no open-ocean buoy within 40 km
- Camp Lejeune: no open-ocean buoy within 40 km
- Onslow Beach: no open-ocean buoy within 40 km
- Seaview Pier: no open-ocean buoy within 40 km
- Topsail Beach: no open-ocean buoy within 40 km
- Topsail Island: buoy(s) within 40 km but outside the swell window: 41110 37.4 km at 212°, 41038 37.7 km at 212° (window 75°–180°)
- Surf City Pier: buoy(s) within 40 km but outside the swell window: 41110 34.9 km at 207°, 41038 35.2 km at 206° (window 90°–180°)
- Jolly Roger Pier: buoy(s) within 40 km but outside the swell window: 41110 25.9 km at 198°, 41038 26.2 km at 198° (window 75°–195°)
- Columbia Street: buoy(s) within 40 km but outside the swell window: 41110 10.0 km at 135°, 41038 10.3 km at 136° (window 180°–195°)
- Oceanic Pier: buoy(s) within 40 km but outside the swell window: 41110 9.8 km at 124°, 41038 9.9 km at 126° (window 180°–0°)
- Masonboro Inlet: buoy(s) within 40 km but outside the swell window: 41110 9.6 km at 114°, 41038 9.7 km at 116° (window 180°–240°)
- Carolina Beach Pier: buoy(s) within 40 km but outside the swell window: 41038 17.9 km at 59°, 41110 18.1 km at 58°, 41108 39.6 km at 198° (window 68°–158°)
- Pelican Watch (last 30 days only): buoy(s) in the window with under 200 h of Hs in the window: 41108 (34.9 km, 0 h of Hs)
- Alabama Ave., Kure Beach: buoy(s) within 40 km but outside the swell window: 41038 22.1 km at 50°, 41110 22.3 km at 49°, 41108 34.4 km at 198° (window 68°–158°)
- Fort Fisher (last 30 days only): buoy(s) in the window with under 200 h of Hs in the window: 41108 (29.1 km, 0 h of Hs)
- Holden Beach (last 30 days only): buoy(s) in the window with under 200 h of Hs in the window: 41108 (33.7 km, 0 h of Hs)
- Longbeach (last 30 days only): buoy(s) in the window with under 200 h of Hs in the window: 41108 (21.9 km, 0 h of Hs)
- Oak Island (last 30 days only): buoy(s) in the window with under 200 h of Hs in the window: 41108 (21.5 km, 0 h of Hs)
- Ocean Isle Beach Pier: buoy(s) within 40 km but outside the swell window: 41024 6.6 km at 216°, SSBN7 6.9 km at 221° (window 90°–180°)

**South Carolina** (15)

- Cape Romain: buoy(s) within 40 km but outside the swell window: 41065 36.1 km at 224°, 41029 36.3 km at 225° (window 90°–158°)
- Bull Island: buoy(s) within 40 km but outside the swell window: 41065 12.5 km at 198°, 41029 12.5 km at 200° (window 90°–180°)
- Bert's Bar: buoy(s) in the window with under 200 h of Hs in the window: 41076 (29.5 km, 0 h of Hs), 41066 (29.6 km, 0 h of Hs)
- The Washout: buoy(s) in the window with under 200 h of Hs in the window: 41076 (27.6 km, 0 h of Hs), 41066 (27.8 km, 0 h of Hs)
- 10th Street: buoy(s) in the window with under 200 h of Hs in the window: 41076 (28.2 km, 0 h of Hs), 41066 (28.4 km, 0 h of Hs)
- Kiawah Island/Seabrook Island: no open-ocean buoy within 40 km
- Edisto Beach: buoy(s) within 40 km but outside the swell window: 41033 28.6 km at 204°, 41067 28.9 km at 204° (window 90°–180°)
- Hunting Island: buoy(s) within 40 km but outside the swell window: 41033 10.9 km at 166°, 41067 11.2 km at 166° (window 45°–135°)
- Fripp Island (last 30 days only): buoy(s) in the window with under 200 h of Hs in the window: 41033 (8.3 km, 0 h of Hs), 41067 (8.5 km, 173 h of Hs)
- Burkes Beach: buoy(s) within 40 km but outside the swell window: 41067 28.7 km at 71°, 41033 28.9 km at 70° (window 75°–195°)
- Hilton Head Island: buoy(s) within 40 km but outside the swell window: 41067 35.0 km at 65°, 41033 35.2 km at 65° (window 90°–158°)
- Dewees Island (last winter only): buoy(s) in the window with under 200 h of Hs in the window: 41029 (8.6 km, 0 h of Hs), 41065 (9.1 km, 183 h of Hs)
- Wild Dunes (last winter only): buoy(s) in the window with under 200 h of Hs in the window: 41065 (10.6 km, 183 h of Hs)
- Isle of Palms Pier (last winter only): buoy(s) in the window with under 200 h of Hs in the window: 41029 (15.2 km, 0 h of Hs), 41065 (15.6 km, 183 h of Hs), 41076 (30.0 km, 0 h of Hs), 41066 (30.1 km, 0 h of Hs)
- Folly Beach Pier (last winter only): buoy(s) in the window with under 200 h of Hs in the window: 41076 (29.1 km, 0 h of Hs), 41066 (29.4 km, 0 h of Hs), 41029 (33.8 km, 0 h of Hs), 41065 (34.2 km, 183 h of Hs)

**Georgia** (8)

- North Jetty: no open-ocean buoy within 40 km
- Sugar Shack: no open-ocean buoy within 40 km
- Coastguard/St Simons: no open-ocean buoy within 40 km
- St. Simons Island: no open-ocean buoy within 40 km
- 5th Street/7th Street: no open-ocean buoy within 40 km
- Jekyll Island: no open-ocean buoy within 40 km
- Comfort Inn/Jeckyll Island: no open-ocean buoy within 40 km
- Cumberland Island: buoy(s) within 40 km but outside the swell window: 41112 20.1 km at 142° (window 68°–135°)

**Florida** (83)

- Hooks: no swell window to check the buoy bearing against
- Main Beach (Florida): no swell window to check the buoy bearing against
- Fernandina Beach Pier: no swell window to check the buoy bearing against
- Talbot Island: buoy(s) within 40 km but outside the swell window: 41112 28.1 km at 24° (window 45°–135°)
- Little Talbot Island: no swell window to check the buoy bearing against
- North Jetty (Florida): buoy(s) within 40 km but outside the swell window: 41112 35.3 km at 16° (window 180°–0°)
- Hannah Park/ Mayport Poles: no swell window to check the buoy bearing against
- Mayport Poles: buoy(s) within 40 km but outside the swell window: 41112 37.7 km at 15° (window 45°–135°)
- 18th Street: no open-ocean buoy within 40 km
- Atlantic Beach: no open-ocean buoy within 40 km
- Neptune Beach: no open-ocean buoy within 40 km
- Jacksonville Beach Pier: no open-ocean buoy within 40 km
- Jax Beach Pier: no open-ocean buoy within 40 km
- 8th Ave. South: no open-ocean buoy within 40 km
- Sawgrass: buoy(s) within 40 km but outside the swell window: 41117 34.8 km at 128° (window 8°–128°)
- Ponte Vedra: buoy(s) within 40 km but outside the swell window: 41117 32.2 km at 124° (window 180°–0°)
- Vilano Jetty: buoy(s) within 40 km but outside the swell window: 41117 22.2 km at 66° (window 180°–0°)
- Middles (Florida): buoy(s) within 40 km but outside the swell window: 41117 22.4 km at 56° (window 180°–0°)
- Blowhole: buoy(s) within 40 km but outside the swell window: 41117 23.0 km at 52° (window 180°–0°)
- F.A's: no swell window to check the buoy bearing against
- A Street: no swell window to check the buoy bearing against
- Matanzas Inlet: no swell window to check the buoy bearing against
- Flagler Beach Pier: buoy(s) in the window with under 200 h of Hs in the window: 41069 (37.7 km, 0 h of Hs), 41070 (37.7 km, 164 h of Hs); buoy(s) in the window with under 200 h of Hs in the window: 41069 (37.7 km, 0 h of Hs), 41070 (37.7 km, 3 h of Hs)
- Flagler Pier: buoy(s) within 40 km but outside the swell window: 41069 37.7 km at 124°, 41070 37.7 km at 124° (window 180°–0°)
- Bicentennial Park: buoy(s) in the window with under 200 h of Hs in the window: 41069 (25.6 km, 0 h of Hs), 41070 (25.6 km, 164 h of Hs); buoy(s) in the window with under 200 h of Hs in the window: 41069 (25.6 km, 0 h of Hs), 41070 (25.6 km, 3 h of Hs)
- Ormond Beach Pier: buoy(s) within 40 km but outside the swell window: 41069 22.8 km at 91°, 41070 22.8 km at 91° (window 180°–0°)
- Main Street Pier: buoy(s) within 40 km but outside the swell window: 41069 20.7 km at 70°, 41070 20.7 km at 70° (window 180°–0°)
- Daytona Beach: buoy(s) in the window with under 200 h of Hs in the window: 41069 (20.8 km, 0 h of Hs), 41070 (20.8 km, 164 h of Hs); buoy(s) in the window with under 200 h of Hs in the window: 41069 (20.8 km, 0 h of Hs), 41070 (20.8 km, 3 h of Hs)
- Sunglow Pier: buoy(s) within 40 km but outside the swell window: 41069 22.2 km at 44°, 41070 22.2 km at 44° (window 180°–0°)
- Wilbur By The Sea: buoy(s) in the window with under 200 h of Hs in the window: 41069 (22.7 km, 0 h of Hs), 41070 (22.7 km, 164 h of Hs); buoy(s) in the window with under 200 h of Hs in the window: 41069 (22.7 km, 0 h of Hs), 41070 (22.7 km, 3 h of Hs)
- Ponce Inlet: buoy(s) within 40 km but outside the swell window: 41069 25.7 km at 25°, 41070 25.7 km at 25° (window 90°–105°)
- The Inlet (New Smyrna): buoy(s) within 40 km but outside the swell window: 41069 26.3 km at 23°, 41070 26.3 km at 23° (window 180°–0°)
- New Smyrna Beach: buoy(s) in the window with under 200 h of Hs in the window: 41069 (26.5 km, 0 h of Hs), 41070 (26.5 km, 164 h of Hs); buoy(s) in the window with under 200 h of Hs in the window: 41069 (26.5 km, 0 h of Hs), 41070 (26.5 km, 3 h of Hs)
- Flager Avenue: buoy(s) in the window with under 200 h of Hs in the window: 41069 (29.2 km, 0 h of Hs), 41070 (29.2 km, 164 h of Hs); buoy(s) in the window with under 200 h of Hs in the window: 41069 (29.2 km, 0 h of Hs), 41070 (29.2 km, 3 h of Hs)
- Bethune: buoy(s) in the window with under 200 h of Hs in the window: 41069 (37.7 km, 0 h of Hs), 41070 (37.7 km, 164 h of Hs); buoy(s) in the window with under 200 h of Hs in the window: 41069 (37.7 km, 0 h of Hs), 41070 (37.7 km, 3 h of Hs)
- Apollo Beach: buoy(s) within 40 km but outside the swell window: 41069 39.3 km at 4°, 41070 39.3 km at 4° (window 8°–128°)
- Playalinda: buoy(s) within 40 km but outside the swell window: 41113 28.5 km at 162° (window 23°–113°)
- Picnic Tables: buoy(s) within 40 km but outside the swell window: 41113 16.3 km at 25° (window 30°–113°)
- 2nd Light: buoy(s) within 40 km but outside the swell window: 41113 17.7 km at 23° (window 30°–150°)
- Patrick Air Force Base: buoy(s) within 40 km but outside the swell window: 41113 18.8 km at 21° (window 30°–135°)
- Perkins: buoy(s) within 40 km but outside the swell window: 41113 22.9 km at 15° (window 30°–90°)
- Hightower Beach: buoy(s) within 40 km but outside the swell window: 41113 23.6 km at 14° (window 30°–150°)
- Satellite Beach/ RCs: buoy(s) within 40 km but outside the swell window: 41113 25.1 km at 13° (window 30°–135°)
- Pelican Beach Park: buoy(s) within 40 km but outside the swell window: 41113 26.3 km at 11° (window 23°–90°)
- The Radisson: buoy(s) within 40 km but outside the swell window: 41113 29.8 km at 9° (window 23°–90°)
- Paradise Beach: buoy(s) within 40 km but outside the swell window: 41113 31.1 km at 8° (window 8°–128°)
- Spessard Holland: buoy(s) within 40 km but outside the swell window: 41113 39.2 km at 2° (window 23°–90°)
- Coconut Point Park: no open-ocean buoy within 40 km
- Ponce De Leon Park: no open-ocean buoy within 40 km
- Bonsteel Park: no open-ocean buoy within 40 km
- Spanish House: no open-ocean buoy within 40 km
- Chernobyl: no open-ocean buoy within 40 km
- Sebastian Inlet: buoy(s) within 40 km but outside the swell window: 41068 39.2 km at 140° (window 0°–135°)
- Monster Hole: buoy(s) within 40 km but outside the swell window: 41068 38.7 km at 140°, 41114 39.7 km at 146° (window 0°–135°)
- Wabasso: buoy(s) within 40 km but outside the swell window: 41068 27.9 km at 133°, 41114 28.5 km at 141° (window 0°–45°)
- Vero Pier: buoy(s) within 40 km but outside the swell window: 41114 18.5 km at 129°, 41068 18.9 km at 117° (window 23°–90°)
- Riomar Reef: buoy(s) within 40 km but outside the swell window: 41114 15.8 km at 124°, 41068 16.7 km at 110° (window 0°–45°)
- Blind Creek Park: buoy(s) within 40 km but outside the swell window: 41114 22.2 km at 8°, 41068 25.9 km at 13° (window 23°–68°)
- Walton Rocks: buoy(s) within 40 km but outside the swell window: 41114 25.0 km at 4°, 41068 28.5 km at 9° (window 23°–68°)
- Jensen Beach: buoy(s) within 40 km but outside the swell window: 41114 34.5 km at 357°, 41068 37.7 km at 1° (window 30°–68°)
- Stuart Public Beach: buoy(s) within 40 km but outside the swell window: 41114 39.0 km at 354° (window 0°–135°)
- Fletcher's: no open-ocean buoy within 40 km
- Stuart Rocks: no open-ocean buoy within 40 km
- 40th Street: no open-ocean buoy within 40 km
- Japanese Rock: no open-ocean buoy within 40 km
- Red Reef Park: no open-ocean buoy within 40 km
- South Beach Pavillion: buoy(s) within 40 km but outside the swell window: 41122 39.7 km at 184° (window 90°–135°)
- Boca Raton Inlet: buoy(s) within 40 km but outside the swell window: 41122 37.2 km at 184° (window 30°–45°)
- Deerfield Beach Pier: buoy(s) within 40 km but outside the swell window: 41122 35.2 km at 183° (window 30°–150°)
- Deerfield Park Pier: buoy(s) within 40 km but outside the swell window: 41122 35.1 km at 184° (window 30°–135°)
- Hillsboro Beach: buoy(s) within 40 km but outside the swell window: 41122 33.0 km at 183° (window 30°–150°)
- Hillsboro Inlet: buoy(s) within 40 km but outside the swell window: 41122 28.3 km at 183° (window 30°–150°)
- Pompano Pier: buoy(s) within 40 km but outside the swell window: 41122 26.0 km at 182° (window 30°–150°)
- Commercial Pier: buoy(s) within 40 km but outside the swell window: 41122 20.9 km at 181° (window 30°–150°)
- NE 14th Ct.: buoy(s) within 40 km but outside the swell window: 41122 16.1 km at 178° (window 30°–150°)
- Spoils: buoy(s) within 40 km but outside the swell window: 41122 10.7 km at 176° (window 53°–173°)
- Dania Pier: buoy(s) within 40 km but outside the swell window: 41122 6.5 km at 168° (window 30°–150°)
- Franklin Street: buoy(s) within 40 km but outside the swell window: 41122 5.5 km at 163° (window 30°–150°)
- Haulover: buoy(s) within 40 km but outside the swell window: 41122 10.0 km at 14° (window 30°–135°)
- Surfside: buoy(s) within 40 km but outside the swell window: 41122 13.4 km at 10° (window 30°–150°)
- Dunes Hotel: buoy(s) within 40 km but outside the swell window: 41122 20.9 km at 7° (window 30°–135°)
- 21st Street: buoy(s) within 40 km but outside the swell window: 41122 23.1 km at 7° (window 30°–135°)
- 5th Street (Florida): buoy(s) within 40 km but outside the swell window: 41122 25.2 km at 7° (window 30°–135°)

<!-- notes -->
## Notes (written 2026-11-09; the tables above are regenerated by the script, these notes are not)

### What the check says
1. **Coverage.** 96 of 282 spots (last 30 days) and 98 (last winter) have an eligible open-ocean buoy. 186 do not: 116 have buoys within 40 km but none on the swell window's bearing (most of Oahu's South Shore: 51211 Pearl Harbor and 51212 Barbers Point sit along the coast to the west, not seaward), 39 have no open-ocean buoy within 40 km (both Rhode Island spots, 7 of 8 in Georgia, 8 in New Jersey, 16 in Florida, 6 in the Carolinas; the two Massachusetts spots have only buoys off their window, the bay buoys being excluded as sheltered), 18 (winter 16) only have buoys short of 200 hours of Hs in the window, 13 have no swell window to check against. Oahu South is one spot (Ewa Beach Park, 51211 at 3.2 km).
2. **Wind is the bigger gap.** Of the 96 spots with a buoy, 24 have a shore wind station within 7 km, and only 10 of those have a stated facing, so onshore wind could be judged at 10 spots (Virginia Beach area, Amelia Island, Cocoa Beach, Jetty Park, Ewa Beach Park). No station stands within 7 km of any North Shore spot (nearest ASOS: Wheeler AFB inland, Kalaeloa, Honolulu), so **Oahu North is swell-only**, and its buoy (51201 Waimea) never read under 1 ft in either window: **no poor hour was observed at Oahu North; its oversell rate cannot be measured with public data.**
3. **Forecast-fed, poor hours rated fair or better: East 4.7% (30 days) / 3.7% (winter); Oahu South 80% (4 of 5) / 23% (9 of 39); Oahu North not measurable.** California: 50.0% / 36.9%. Of the hours the app rated fair or better, the share observed poor: East 0.5% / 0.4%, Hawaii + East 0.3% / 0.2%; California 5.7% / 2.7%. **Not like for like:** the East's poor hours are mostly "buoy Hs under 1 ft", an offshore proxy far stricter than California's nearshore 1 ft, and the wind half covers only 10 spots. With the looser 2 ft sensitivity line the forecast-fed rate stays low on the East (0–10% per state, 30 days; 2–8% winter) but Oahu South rises to 65% of 253 winter hours (one spot).
4. **The observed-fed column is mostly our construction, not the buoy (section 2b).** In the last 30 days, rebuilding the FORECAST inputs the way the observed-fed ones are built (bulk Hs as the only swell, no secondary, no surf-range ceiling) gives 53.4% fair+ on the same poor hours, against 53.0% observed-fed and 8.1% for the app's own rating. In winter the control explains less (18.4% against 49.1%); the rest is input difference on swell-only-wind spots (Outer Banks, airfield wind lighter than the forecast's, scored without a facing). So "observed-fed fair+" here should not be read as "the rules oversell". The same construction is in the California audit (its note 3 mentions it); its "the rules oversell" conclusion carries the same caveat.

### Proposals (evidence only; NOTHING applied, each would be a separate change)
1. **Fix the audit's observed-fed input before using it to judge the rules (Hawaii, East and California).** Feed the buoy's own swell partition (NDBC spectral summary: swell height, period, direction separate from wind-sea; public, keyless) instead of bulk Hs as the primary swell, then rerun both audits. Evidence: section 2b (control 53.4% vs observed-fed 53.0% vs app 8.1%, last 30 days). Until then no engine change should rest on an observed-fed number.
2. **Do not import California's onshore-cap candidates to the East yet; source East facings first.** 51 of the 96 buoy-covered spots have no stated facing, so the engine scores their wind as "unknown relation" (no onshore penalty, capped at 74) and this check cannot judge onshore wind there. Where it could (10 spots), measured onshore over 12 mph was rated fair or better on 20 of 192 hours in Florida (30 days) and 2 of 26 in Virginia (winter), well under California's 28–50%: no evidence for a stricter East wind rule. A facing per spot (published guide or coastline geometry, as T-073 did for California) is the prerequisite.
3. **Oahu South: re-test with a south-facing buoy and the onshore rule on more spots.** The one measured spot overcalled onshore hours in both windows (4 of 5; 9 of 39) and 65% of winter hours under 2 ft buoy Hs, but it is one spot behind a buoy 3 km along the coast and an airport 6 km away. Proposal: accept CDIP/NDBC buoys up to 40 km off the window when the spot's guide names that buoy's sector (Barbers Point, Pearl Harbor) as a labelled, weaker anchor, and report Oahu South separately; no engine change on this evidence.

### Limits
- Buoy Hs is offshore swell at the buoy, never surf at the break; the size criterion is a proxy.
- Wind stations stand on piers and airfields up to 7 km away; Hawaii and East airfields have no enclosed-water check (the repo mask covers the West Coast only).
- Forecast-fed = Open-Meteo's archived short-range runs (close to a nowcast): a best case.
- Duplicate catalogue names (two "Lavallette", two "Island Beach State Park" rows) are separate spots with separate pins; both are kept.
- NOAA ERDDAP returned "unknown datasetID" for about 10 minutes during the run; the script now treats that as a failure and retries (no window was reported from a failed download).
