# Rating audit on split swell (2026-11-09)

Generated 2026-11-10T04:35Z by `docs/forecast/data/rating-audit-split.ts` (spec `docs/specs/2026-11-09-round-3.md`, 3D). Reproduce: `ACC_CACHE=<dir> node --experimental-strip-types docs/forecast/data/rating-audit-split.ts` (NDBC's realtime `.spec` files keep 45 days, so the recent windows reproduce only from a cache made before 2026-11-21). **A report: no rating code was changed. The proposals at the end are not applied; any engine change is a separate spec.**

**The question.** Both rating audits (`RATING-AUDIT.md`, California; `RATING-AUDIT-HI-EAST.md`, Hawaii + US East) asked how often the rating says fair or better (score 40+) when observed conditions were poor, and compared the app's forecast-fed rating with an observed-fed one. The observed-fed one fed the engine the buoy's TOTAL wave height as the only swell, with no surf-range estimate, so it mostly measured that construction (HI/East control: forecast inputs built the same way 53.4%, observed-fed 53.0%, the app 8.1%). This report rebuilds the observed-fed inputs with the swell split from the wind-sea and asks the question again.

**What changed in the observed-fed inputs.**
| engine input | old observed-fed | new observed-fed (split) | the app's forecast-fed |
|---|---|---|---|
| combined Hs (`offshore`) | buoy total Hs | buoy total Hs (WVHT: swell + wind-sea) | Open-Meteo `wave_height` (total) |
| primary swell height / period / direction | buoy total Hs / dominant period / mean direction | **NDBC's swell partition SwH / SwP / SwD** | Open-Meteo swell partition |
| wind-sea | inside the "swell" | **only in the combined Hs** (NDBC WWH; the engine has no separate wind-sea input, nor does the app's record) | only in the combined Hs |
| secondary swell | none | none (NDBC publishes one swell partition) | Open-Meteo secondary swell |
| surf-range estimate (wide-range ceiling) | none | `faceEstimate()` on these inputs, as the app builds it | `faceEstimate()` |
| wind | shore station | shore station (unchanged) | Open-Meteo |

Engine: `rateForecast` (for an evidence record, the provisional rating both audits call directly), lead-dependent parts judged 24 h ahead, onshore cap on, daylight hours only.

**Where the split comes from.**
- **Published (recent windows):** NDBC realtime2 `<id>.spec` (SwH, SwP, SwD, WWH, WWP, WWD), the record within 10 minutes of the hour. SwD and WWD are published as 16-point compass names (22.5° steps); used at the sector centre. NDBC keeps 45 days, which covers the California recent window (2026-10-07 to 2026-11-06) and the HI/East recent window (2026-10-09 to 2026-11-08).
- **Historical windows: no published split.** NDBC's historical archive (historical_data.shtml) has stdmet and the spectra (swden, swdir alpha1/alpha2, r1/r2) but **no derived swell/wind-sea file**. The spectra exist only for NDBC-owned buoys: every CDIP-owned buoy the audits use (all of California's anchors, and in HI/East everything but 44065 and 41025) returns 404 for 2025 swden and 2026 monthly swden. So:
  - **California archive window (2025-11-01 to 2026-05-01): excluded entirely** (no published split and no NDBC spectra for its CDIP anchors). CDIP publishes those buoys' spectra in its own archive, but computing a split from them is outside this brief (not NDBC swden); see proposal 3.
  - **HI/East winter (2025-12-01 to 2026-02-28): COMPUTED split, labelled,** for the spots on 44065 and 41025 only: Gilhousen & Hervey (2001) steepness method as implemented in ScientiMate 2.0 seaswell1d("gilhousen"): fs = max(0.75 × the frequency where 8π·m2(f*)/(g·√m0(f*)) peaks, 0.9 × 1.25/U), U = the buoy's measured wind (m/s); no 0.2 Hz cap; SwD = alpha1 at the swell peak bin. Checked against NDBC's own published Sep_Freq and SwH on the realtime window below before use.
- Stations and spots are the audits' own picks (read from their JSON), not re-chosen; observed "poor" is each audit's own criterion, unchanged (California: surf under 1 ft from the buoy carried to the MOP point, or measured onshore over 12 mph; HI/East: OFFSHORE buoy Hs under 1 ft, an offshore proxy, or measured onshore over 12 mph where a facing is stated).
- Every comparison below is on the SAME hours: hours where both the old and the new observed-fed rating exist (needs the anchor buoy's bulk reading, its split record, and the shore wind). No download failed.

## 1. California, recent window (2026-10-07 to 2026-11-06), published split

| region (spots with split hours) | hours with both observed-fed ratings | observed poor (size / onshore) | **fair+ while poor:** forecast-fed (app) | old observed-fed (bulk Hs as swell) | **new observed-fed (split)** | **poor while rated fair+:** forecast-fed | old observed-fed | **new observed-fed** | mean score fc / old / new | median swell share of energy (SwH²/Hs²) |
|---|---|---|---|---|---|---|---|---|---|---|
| San Mateo (2) | 658 | 12 (0 / 12) | 83.3% | 91.7% | **91.7%** | 1.9% (10/537) | 1.7% (11/657) | **1.7%** (11/648) | 51.1 / 68.6 / 62.2 | 0.58 |
| Los Angeles (1) | 330 | 86 (0 / 86) | 33.7% | 87.2% | **45.3%** | 13.9% (29/209) | 23.7% (75/317) | **14.6%** (39/267) | 43.2 / 60.8 / 51.4 | 0.6 |
| San Diego (4) | 786 | 61 (0 / 61) | 55.7% | 62.3% | **42.6%** | 6.2% (34/548) | 5.9% (38/648) | **5.3%** (26/489) | 46.7 / 55.4 / 45.3 | 0.33 |
| Northern + Central California (north of Pt Conception) (2) | 658 | 12 (0 / 12) | 83.3% | 91.7% | **91.7%** | 1.9% (10/537) | 1.7% (11/657) | **1.7%** (11/648) | 51.1 / 68.6 / 62.2 | 0.58 |
| **California, all** (7) | 1774 | 159 (0 / 159) | 45.9% | 78.0% | **47.8%** | 5.6% (73/1294) | 7.6% (124/1622) | **5.4%** (76/1404) | 47.7 / 61.3 / 52.7 | 0.51 |

Published audit for reference (its own hour set, all spots incl. hours without an observed-fed rating): recent window forecast-fed fair+ while poor 50.0%, observed-fed 78.7%; archive window 36.9% / 72.0% (archive: no split, not redone).

## 2. Hawaii + US East, recent window (2026-10-09 to 2026-11-08), published split

| region (spots with split hours) | hours with both observed-fed ratings | observed poor (size / onshore) | **fair+ while poor:** forecast-fed (app) | old observed-fed (bulk Hs as swell) | **new observed-fed (split)** | **poor while rated fair+:** forecast-fed | old observed-fed | **new observed-fed** | mean score fc / old / new | median swell share of energy (SwH²/Hs²) |
|---|---|---|---|---|---|---|---|---|---|---|
| Oahu South (1) | 371 | 5 (0 / 5) | 80.0% | 100.0% | **60.0%** | 1.9% (4/206) | 1.6% (5/308) | **1.3%** (3/236) | 39.3 / 54.4 / 43.9 | 0.39 |
| Virginia (3) | 1089 | 88 (0 / 88) | 0.0% | 43.2% | **2.3%** | 0.0% (0/174) | 5.0% (38/754) | **1.9%** (2/106) | 24.2 / 46.6 / 23.9 | 0.06 |
| North Carolina (12) | 4342 | 6 (6 / 0) | 0.0% | 0.0% | **0.0%** | 0.0% (0/491) | 0.0% (0/2808) | **0.0%** (0/720) | 24.1 / 45.5 / 25.3 | 0.09 |
| Florida (8) | 2724 | 199 (7 / 192) | 10.1% | 57.8% | **0.5%** | 3.6% (20/551) | 5.6% (115/2042) | **0.2%** (1/442) | 28.8 / 49.2 / 27.6 | 0.06 |
| **US East, all** (23) | 8155 | 293 (13 / 280) | 6.8% | 52.2% | **1.0%** | 1.6% (20/1216) | 2.7% (153/5604) | **0.2%** (3/1268) | 25.7 / 46.9 / 25.9 | 0.08 |
| **Hawaii + East, all** (24) | 8526 | 298 (13 / 285) | 8.1% | 53.0% | **2.0%** | 1.7% (24/1422) | 2.7% (158/5912) | **0.4%** (6/1504) | 26.3 / 47.2 / 26.6 | 0.09 |

## 3. Hawaii + US East, winter (2025-12-01 to 2026-02-28), COMPUTED split (44065, 41025 only)

| region (spots with split hours) | hours with both observed-fed ratings | observed poor (size / onshore) | **fair+ while poor:** forecast-fed (app) | old observed-fed (bulk Hs as swell) | **new observed-fed (split)** | **poor while rated fair+:** forecast-fed | old observed-fed | **new observed-fed** | mean score fc / old / new | median swell share of energy (SwH²/Hs²) |
|---|---|---|---|---|---|---|---|---|---|---|
| **Hawaii + East, all** (0) | 0 | 0 (0 / 0) | – | – | **–** | – (0/0) | – (0/0) | **–** (0/0) | null / null / null | – |

**No comparable hours.** The computed split exists for 5 spots (on 44065 and 41025), but none of them has a shore wind station by the audit's rule, so neither the old nor the new observed-fed rating exists there. **The winter window cannot be redone on split inputs.**

Published HI/East audit for reference (all hours with an observed-fed rating; its own hour sets): recent forecast-fed 8.1%, observed-fed 53.0%, control 53.4%; winter 5.2% / 49.1% / 18.4%.

## 3b. By cause (fair+ while poor): forecast-fed / old observed-fed / new observed-fed

| window, region | size-poor hours | … fc / old / new | onshore-poor hours | … fc / old / new |
|---|---|---|---|---|
| California recent, San Mateo | 0 | – / – / – | 12 | 83.3% / 91.7% / 91.7% |
| California recent, Los Angeles | 0 | – / – / – | 86 | 33.7% / 87.2% / 45.3% |
| California recent, San Diego | 0 | – / – / – | 61 | 55.7% / 62.3% / 42.6% |
| California recent, Northern + Central California (north of Pt Conception) | 0 | – / – / – | 12 | 83.3% / 91.7% / 91.7% |
| California recent, California, all | 0 | – / – / – | 159 | 45.9% / 78.0% / 47.8% |
| HI/East recent, Oahu South | 0 | – / – / – | 5 | 80.0% / 100.0% / 60.0% |
| HI/East recent, Virginia | 0 | – / – / – | 88 | 0.0% / 43.2% / 2.3% |
| HI/East recent, North Carolina | 6 | 0.0% / 0.0% / 0.0% | 0 | – / – / – |
| HI/East recent, Florida | 7 | 0.0% / 57.1% / 14.3% | 192 | 10.4% / 57.8% / 0.0% |
| HI/East recent, US East, all | 13 | 0.0% / 30.8% / 7.7% | 280 | 7.1% / 53.2% / 0.7% |
| HI/East recent, Hawaii + East, all | 13 | 0.0% / 30.8% / 7.7% | 285 | 8.4% / 54.0% / 1.8% |

("size-poor" counts hours poor by size, whether or not also onshore; an hour can be in both columns.)

## 4. Construction check: is the remaining gap the inputs or the construction?

The split record still differs from the app's in one way: no secondary swell (NDBC publishes one swell partition; the engine's crossing-swell penalty needs one). The middle column drops the forecast's secondary swell, the same construction as the split record. If it is close to the app's column, the construction gap is closed and what is left between forecast-fed and observed-fed is the inputs.

### California recent
| region | poor hours | forecast-fed (app: primary + secondary swell) | forecast-fed, secondary swell dropped (built like the split record) | new observed-fed (split) |
|---|---|---|---|---|
| San Mateo | 12 | 83.3% | 83.3% | 91.7% |
| Los Angeles | 86 | 33.7% | 37.2% | 45.3% |
| San Diego | 61 | 55.7% | 62.3% | 42.6% |
| Northern + Central California (north of Pt Conception) | 12 | 83.3% | 83.3% | 91.7% |
| California, all | 159 | 45.9% | 50.3% | 47.8% |

### HI/East recent
| region | poor hours | forecast-fed (app: primary + secondary swell) | forecast-fed, secondary swell dropped (built like the split record) | new observed-fed (split) |
|---|---|---|---|---|
| Oahu South | 5 | 80.0% | 100.0% | 60.0% |
| Virginia | 88 | 0.0% | 0.0% | 2.3% |
| North Carolina | 6 | 0.0% | 0.0% | 0.0% |
| Florida | 199 | 10.1% | 11.1% | 0.5% |
| US East, all | 293 | 6.8% | 7.5% | 1.0% |
| Hawaii + East, all | 298 | 8.1% | 9.1% | 2.0% |

### HI/East winter (computed split)
| region | poor hours | forecast-fed (app: primary + secondary swell) | forecast-fed, secondary swell dropped (built like the split record) | new observed-fed (split) |
|---|---|---|---|---|
| Hawaii + East, all | 0 | – | – | – |

## 5. Computed-split check (GH_RULE vs NDBC's published values, realtime window)

For each NDBC-owned buoy used for the winter window, the realtime `.data_spec` (spectrum + NDBC's own Sep_Freq), the realtime stdmet wind (WSPD) and `.spec` SwH, each the record within 20 minutes of the spectrum's time. "Integration check" = SwH from the spectrum cut at NDBC's own Sep_Freq vs NDBC's SwH (tests the band integration alone).

| buoy | records | Sep_Freq bias (Hz) | Sep_Freq MAE (Hz) | within one 0.01 Hz band | SwH MAE (m) | SwH bias (m) | SwH within 0.2 m | integration check SwH MAE (m) |
|---|---|---|---|---|---|---|---|---|
| 44065 | 2078 | 0.0454 | 0.0464 | 61% | 0.056 | 0.011 | 95% | 0.05 |
| 41025 | 884 | 0.0112 | 0.012 | 71% | 0.109 | 0.049 | 88% | 0.101 |

## 6. Spots left out of the split comparison

**No split for the window:**
- Montara (archive): anchor CDIP 142 (NDBC 46237): no published split for 2025-11-01–2026-05-01 (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)
- Mavericks (archive): anchor CDIP 142 (NDBC 46237): no published split for 2025-11-01–2026-05-01 (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)
- Manresa (archive): anchor CDIP 156 (NDBC 46236): no published split for 2025-11-01–2026-05-01 (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)
- El Porto (archive): anchor CDIP 028 (NDBC 46221): no published split for 2025-11-01–2026-05-01 (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)
- Oceanside Pier (archive): anchor CDIP 264 (NDBC 46275): no published split for 2025-11-01–2026-05-01 (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)
- Black’s Beach (archive): anchor CDIP 201 (NDBC 46254): no published split for 2025-11-01–2026-05-01 (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)
- Windansea (archive): anchor CDIP 201 (NDBC 46254): no published split for 2025-11-01–2026-05-01 (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)
- Imperial Beach (archive): anchor CDIP 155 (NDBC 46235): no published split for 2025-11-01–2026-05-01 (NDBC's historical archive has no derived swell file; no NDBC swden for this CDIP-owned buoy)
- Dewees Island (recent): buoy 41065: NDBC's .spec carries no swell values for it (SwH/SwP/SwD published as MM on every record)
- Wild Dunes (recent): buoy 41065: NDBC's .spec carries no swell values for it (SwH/SwP/SwD published as MM on every record)
- Isle of Palms Pier (recent): buoy 41065: NDBC's .spec carries no swell values for it (SwH/SwP/SwD published as MM on every record)
- Folly Beach Pier (recent): buoy 41065: NDBC's .spec carries no swell values for it (SwH/SwP/SwD published as MM on every record)
- Mantoloking (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Lavallette (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Lavallette (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Ortley Beach (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Seaside Heights/ Casino Pier (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Meters (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Seaside Park (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Island Beach State Park (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Island Beach State Park (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Barnegat Light (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Harvey Cedars (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Surf City (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Ship Bottom (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- 711 (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- 30th Street (Ship Bottom) (winter): buoy 44091 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- South End (winter): buoy 44099 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Croatan to Pendleton (winter): buoy 44099 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Camp Pendleton (winter): buoy 44099 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Little Island Fishing Pier (winter): buoy 44099 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Duck Pier (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Southern Duck (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Kitty Hawk Pier (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Eckner Street (winter): buoy 44100 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Laundromats (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Avalon Pier (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Avalon Pier (winter): buoy 44086 (UNC Coastal Studies Institute): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Third Street (winter): buoy 44086 (UNC Coastal Studies Institute): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- 1st Street (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Bath House (winter): buoy 44086 (UNC Coastal Studies Institute): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Martin St. (winter): buoy 44086 (UNC Coastal Studies Institute): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Eighth Street (winter): buoy 44086 (UNC Coastal Studies Institute): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Abalone St. (winter): buoy 44086 (UNC Coastal Studies Institute): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Nags Head Pier (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Loggerhead St. (winter): buoy 44086 (UNC Coastal Studies Institute): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Jennette's Pier (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Outer Banks Pier (winter): buoy 44056 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Askins Creek (winter): buoy 41120 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- North Buxton (winter): buoy 41120 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Cape Hatteras Lighthouse (winter): buoy 41120 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Figure Eight and Shell Islands (winter): buoy 41110 (CORMP): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- North End Wrightsville Beach (winter): buoy 41110 (CORMP): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- C Street, Wrightsville Beach (winter): buoy 41110 (CORMP): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Crystal Pier (winter): buoy 41110 (CORMP): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Pelican Watch (winter): buoy 41108 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Fort Fisher (winter): buoy 41108 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Holden Beach (winter): buoy 41108 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Longbeach (winter): buoy 41108 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Oak Island (winter): buoy 41108 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Fripp Island (winter): buoy 41067 (CORMP): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Ft. Clinch State Park (winter): buoy 41112 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Amelia Pier (winter): buoy 41112 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Peters Point (winter): buoy 41112 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- American Beach (winter): buoy 41112 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Gate Station (winter): buoy 41117 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- St. Augustine Pier (winter): buoy 41117 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- A St. (winter): buoy 41117 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Crescent Beach (winter): buoy 41117 (U.S. Army Corps of Engineers): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Jetty Park (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Cocoa Beach (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Shepard Park (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Lori Wilson Park (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Minuteman (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- 16th St. South (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Bicentennial Beach Park (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Canova Beach (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- The Boardwalk (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Melbourne Beach (winter): buoy 41113 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Vero Beach Pier (winter): buoy 41114 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- P.V. Martin's (winter): buoy 41114 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Fort Pierce North Jetty (winter): buoy 41114 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Blue Heron Beach (winter): buoy 41114 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Walton Rocks (winter): buoy 41114 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- South Beach (Florida) (winter): buoy 41122 (SCRIPPS): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Velzyland (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Backyards (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Sunset (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Rocky Point (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Chambers (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Ehukai (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Pipeline & Backdoor (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Off-The-Wall (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Rockpile (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Log Cabins (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Waimea Bay (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Marijuana's (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Chun's (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Jocko's (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Hultin's (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Himalayas (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Laniakea (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Haleiwa (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Mokuleia (winter): buoy 51201 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from
- Ewa Beach Park (winter): buoy 51211 (Pacific Islands Ocean Observing System): no published split for this window (NDBC's historical archive has no derived swell file) and no NDBC swden spectra to compute one from

**No observed-fed rating at all (no shore wind station, so neither method rates them; the audits' swell-only spots):** California recent 22, HI/East recent 72, HI/East winter 72 spots (listed per spot in the JSON).

<!-- notes -->
## Notes (written 2026-11-09; the tables above are regenerated by the script, these notes are not)

### What changed and why
- **The old observed-fed number was mostly its construction.** On the same hours, feeding the swell partition instead of the bulk Hs (plus the app's own surf-range estimate) moves "fair+ while poor" from **78.0% to 47.8%** in California (recent, 159 poor hours) and from **53.0% to 2.0%** in Hawaii + East (recent, 298 poor hours). The mean observed-fed score falls 61.3 → 52.7 (California) and 47.2 → 26.6 (HI/East), landing next to the app's forecast-fed means (47.7 and 26.3). Two parts of the old construction did it: bulk Hs as the swell made the organization proxy read 100% (swell share 1.0 instead of the measured median 0.51 in California and 0.08–0.09 on the East), and the swell factor counted wind-sea as swell.
- **The construction gap is now closed** (section 4): the forecast built exactly like the split record (secondary swell dropped) gives 50.3% (California) and 9.1% (HI/East) against the app's 45.9% and 8.1%. What remains between forecast-fed and observed-fed is the inputs.
- **California: the rules oversell, not the inputs, and only for onshore wind.** Every poor hour in the comparable set was poor because of measured onshore wind over 12 mph (no hour with a measured wind and a split had surf under 1 ft). Fed the measured inputs, the engine still rates 47.8% of those hours fair or better, about the same as the forecast-fed 45.9%. So the California audit's conclusion "the rules oversell" survives a fair measurement, but its supporting figure "fed the measured inputs the engine says fair or better even MORE often (68–73%)" was the construction and should not be quoted.
- **HI/East: the inputs, and small.** Fed the measured inputs the engine almost never rates a poor hour fair (2.0%; Florida 1 of 199, Virginia 2 of 88). The app's 8.1% comes from the forecast inputs (forecast wind lighter or less onshore than the airport/pier reading, and the forecast swell). The HI/East report's caveat is resolved: its observed-fed 53.0% was construction.
- **"Poor while rated fair+"** (the Surfline complaint): California 5.6% forecast-fed vs 5.4% split-fed (old 7.6%); HI/East 1.7% vs 0.4% (old 2.7%).
- **Coverage is the limit.** California: 7 spots, all south of Point Conception except Montara and Mavericks (San Mateo); 1,774 hours. HI/East: 24 spots (Oahu South 1, Virginia 3, North Carolina 12, Florida 8); Oahu North, New York, New Jersey, South Carolina have no shore wind station by the audit's rule, so no observed-fed rating by either method. The archive/winter windows could not be redone (below).

### Gaps (reported, not filled)
- **No historical split is published.** NDBC's historical archive has no derived swell/wind-sea file; NDBC's swden spectra exist only for NDBC-owned buoys (of the audits' buoys: 44065, 41025). California's archive window (every anchor is CDIP-owned) is excluded. HI/East winter: the split was computed (Gilhousen & Hervey 2001, ScientiMate implementation) for the 5 spots on 44065/41025, but none has a shore wind station, so there is nothing to compare.
- **The computed split is not NDBC's split.** Against NDBC's own Sep_Freq on the realtime window, our separation frequency runs high at 44065 (+0.045 Hz bias, 61% within one 0.01 Hz band) and close at 41025 (+0.011 Hz, 71%); SwH still agrees within 0.2 m on 95% / 88% of records. NDBC's operational refinements are not public in enough detail to reproduce.
- 41065 (Charleston; 4 South Carolina spots) publishes `.spec` with every swell field missing (MM): excluded.
- SwD is a 16-point compass name (22.5° steps) in `.spec`; used at the sector centre.
- NDBC keeps `.spec` for 45 days: this run is reproducible only from the cache (ACC_CACHE) it wrote.
- No download failed after retries.

### Proposals (evidence only; NOT applied; any engine change is a separate spec)
1. **Onshore wind over 12 mph should cap the rating below fair (39), matching the Call's Skip line (`ONSHORE_BAD_MPH`).** Evidence: with measured inputs and a fair construction, California hours with measured onshore wind over 12 mph are still rated fair+ 47.8% of the time (76 of 159), the same as forecast-fed (45.9%), so it is the rule. The wind factor is 100 − 4 × mph onshore (52 at 12 mph, 28 at 18 mph) and the severe-wind cap only starts under 25 (about 19 mph), so 12–19 mph onshore with a decent swell rates SURFABLE or NOT BAD. The California audit's candidate "forecast onshore over 12 mph caps at 39" removed 10/7 (archive) and 10/1 (recent) held-out hours and narrowly failed its fixed rule; retest it with split-fed observed ratings as the reference and more shore-station hours.
2. **Make the split construction the standard observed-fed method in both audits** (audit scripts only): swell partition as the primary swell, total Hs as combined Hs, `faceEstimate` as the app builds it. Withdraw the bulk-Hs observed-fed figures and the California "rules vs inputs" decomposition built on them (RATING-AUDIT.md notes, point 3) and regenerate that decomposition on split inputs.
3. **Start a daily archive of NDBC realtime2 `.spec` (and `.data_spec`) for the audits' buoys** so future winter/archive windows have a published split instead of none or a computed one. Cost: about 40 small files a day at 1 request/s. Alternative if a past winter is needed sooner: compute from CDIP's own archived spectra by the same documented method, calibrated first against NDBC's published `.spec` for the same CDIP buoys on an overlapping window (the check in section 5 shows the method needs that calibration).
