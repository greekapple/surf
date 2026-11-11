# US East, Gulf and Puerto Rico: batch 3 (2026-11-10)

Branch `us-east-gulf-pr`, built on `west-ca` (b094013) because the West Coast pipeline fixes (facing parse, land check) live there; no Open-Meteo calls were made. **306 spots added** (217 US Atlantic, 46 Gulf of Mexico, 43 Puerto Rico): the app goes from 726 to 1,032 spots. The US Virgin Islands rows (11) are not imported: none had a live buoy within 100 km (they failed the buoy rule). Browser gates wait for the 16:00 PST reset and the merge order (west-ca, west-orwa-ak, this branch).

## 1. Which rows (`scripts/mark-app-candidates.py`)
Same rule as the West Coast: a guide-stated facing, a CO-OPS tide station (gauge or prediction) within 30 km, a live NDBC wave buoy (wave height in latest_obs) within 100 km. Each row carries `appCandidate`, `appCandidateBasis` (the numbers) and, when false, `appCandidateFailed` (which rule). Rows already in the app are untouched.

| File | Rows not in the app | Candidates | Failed |
|---|---|---|---|
| us-east.json | 268 | 229 | 39 (buoy) |
| us-gulf.json | 118 | 48 | 70 (buoy) |
| caribbean.json (Puerto Rico + USVI) | 61 | 45 | 16 (buoy) |

Every failure is the buoy rule; the facing and the tide rules failed nowhere.

## 2. Drops and merges (`east-batch.ts`, decisions per row)
The duplicate rule now has four parts: (1) within 1.5 km of an app spot; (2) the same name within 0.5 km of another candidate; (3) **name variants and shared sources** (review round): names equal once spaces, plurals, "point/beach/island/park/jetty" and one letter are ignored (within 3 km), or the same source page cited (within 2.5 km), flagged against every other candidate and every app spot, each with a decision (MERGE: one row per break, the dropped row's source pages are added to the kept row; KEEP: a different break, with the reason); an undecided pair stops the script; (4) no open-water marine point along the facing.

- **2nd Street** (`w-us-2nd-street`): 1.11 km from the app spot "Sugar Shack" (rule: within 1.5 km)
- **Canadian Hole** (`w-us-canadian-hole`): 1.13 km from the app spot "North Buxton" (rule: within 1.5 km)
- **Goulds Inlet** (`w-us-goulds-inlet`): 1.49 km from the app spot "Coastguard/St Simons" (rule: within 1.5 km)
- **Playalinda** (`w-us-playalinda`): 1.5 km from the app spot "Playalinda" (rule: within 1.5 km)
- **Reef Road** (`w-us-reef-road`): the same break as "Reef Road" (0.3 km apart, same name): one row kept, the one with more guide facts
- **The Pier** (`w-us-the-pier-south-carolina`): the same break as "The Pier" (0.09 km apart, same name): one row kept, the one with more guide facts
- **Fishermans Island** (`w-us-fishermans-island-virginia`) merged into `w-us-fishermans-island`: Fisherman Island, Virginia, 1.3 km apart, both a point (surfnerd S and SW); the kept row has the surf-forecast page; its sources are added to the kept row
- **Fox Hill** (`w-us-fox-hill`) merged into `w-us-foxhill-point`: Fox Hill and Foxhill Point, 0.16 km apart, both "Faces ESE" (the kept row has the surf-forecast page); its sources are added to the kept row
- **Kite Point** (`w-us-kite-point`): faces west (270 degrees) into Pamlico Sound (a sound-side kiteboarding spot, ETOPO -1.9 m): no open-ocean marine point exists along its facing and a sound is not an ocean break
- **Matanuck** (`w-us-matanuck`) merged into `w-us-matunuck`: a misspelling of Matunuck, 0.2 km apart (surfnerd faces S and SSE); its sources are added to the kept row
- **Meudon Beach** (`w-us-meudon-beach`): faces north-north-west (338 degrees) into Long Island Sound (enclosed water, ETOPO -9 m): no open-ocean marine point exists along its facing
- **Rockaway** (`w-us-rockaway`) merged into `w-us-rockaways`: the same surf-forecast page (Rockaway_1), 0.4 km apart; surfnerd lists it as "Rockaways" (faces S) and "Rockaway" (faces SSE); its sources are added to the kept row
- **Pickens Point** (`w-us-pickens-point`): faces west (270 degrees) into Pensacola Pass at the west end of Santa Rosa Island (the point reads +5 m, land): no open-water marine point exists along its facing
- **San Jose Island** (`w-us-san-jose-island`) merged into `w-us-st-joes-island`: St. Joseph (San Jose) Island, 0.7 km apart, both "Faces ESE"; the kept row has three sources; its sources are added to the kept row
- **Indicators** (`w-carib-indicators`): the same break as "Indicators" (0.22 km apart, same name): one row kept, the one with more guide facts
- **Wilderness (Puerto Rico)** (`w-carib-wilderness-puerto-rico`) merged into `w-carib-wilderness-aguadilla`: Wilderness in Aguadilla written twice, 0.55 km apart (surfnerd NW and WNW; the kept row has the surf-forecast page); its sources are added to the kept row

**Flagged pairs kept as different breaks:** Lido Beach / Lido Beach (New York) (two surf-forecast pages, Lido Beach and Lido West, 1.1 km apart; the guide gives both the same name), Middles / Middles (Isabela) (two surfnerd pages 1.7 km apart, facing NNE and N), Moody Beach / Moody Point and Wells Beach / Wells Jetties (a beach and a point or jetties with their own pages), and the New Jersey street names (5th, 7th, 8th Street Jetty). Merged rows keep the kept row's facing and window; where the guides disagreed (Matunuck S against Matanuck SSE; Rockaways S against Rockaway SSE; Wilderness NW against WNW; Fishermans Island S against SW) the kept row's guide is the one shown.

**Same rule over the earlier rows (reported, nothing changed):** West-ca: Davenport (spot-9) / Davenport Landing (2.2 km, two shared source pages), Crescent City / South Beach (1.0 km, two shared pages), Morro Rock / Morro Strand (2.1 km, one shared page), Point Dume / Point Dume (-2) (1.3 km), Haggertys / Haggerty's (-2) (1.1 km), Trails / Trails (-2) (2.0 km). US East batch 1 (already merged): Robert Moses / Robert Moses State Park (2.0 km), Jenkinsons / Jenkinson's (0.7 km), Lavallette / Lavallette (1.7 km), Avalon Pier / Avalon Pier (North Carolina) (0.14 km), Flagler Beach Pier / Flagler Pier (0.1 km), Vero Pier / Vero Beach Pier (1.7 km), Walton Rocks / Walton Rocks (-2) (0.15 km), Deerfield Beach Pier / Deerfield Park Pier (0.15 km). Hawaii: Ma'ili / Maili Point (1.1 km), Ewa Beach Park / Ewa Beach (2.4 km).

## 3. Importer changes
- **Depth guard** (from west-orwa-ak, same code): the marine point must be deeper than 10 m in ETOPO 2022. 25 points failed it (the default point 0.08 degrees out read 8-10 m on the Georgia and Pinellas shelves, -2 m at Key West and Port O'Connor, +5 m at Pickens Point). `seaward-points.ts` stepped each further out along its facing until deeper than 10 m and off the land polygons. With the six merges and the three left-out rows, **22 explicit sea points** remain (21 stepped plus Pine Point), each with its reason in `marinePoints.ts`. Pine Point (Maine) faces west-south-west over land, so its point is explicit too (43.52, -70.25; ETOPO -37 m). **Port O'Connor Jetties**: stepping straight out along its facing ended 27 km down Matagorda Island, so the point is 28.36, -96.27 (ETOPO 2022 -16 m, about 8.5 km south-east of the jetty mouth). **Key West** faces north-west in the guide (surfnerd "Faces NW"), so it is treated as a Gulf-side break and its point is on that side (the reason says so).
- **Query note:** the note on every spot now states the real distance to its marine point ("~9 km seaward", or "~8 km away, an explicit sea point") instead of a fixed "~9 km".
- **Regions:** the East latitude split put the Gulf coast of Florida in "Space Coast", "Treasure Coast" and "Southeast Florida". Florida west of -81.7 is now "Florida Gulf Coast" or "Florida Keys"; Central-time Florida is "Florida Panhandle". New browsing zones: Florida Gulf Coast, Florida Panhandle, Alabama, Louisiana, Texas, Puerto Rico.
- **Coverage boxes** (`coverage.ts`): Gulf (Texas to the panhandle 26.0-31.1 N, -97.5 to -85; Florida Gulf coast), Puerto Rico and the US Virgin Islands. A box only says "US point for the national services"; the wind build still reads California, Oregon and Washington airports only.
- **Context buoys:** 500 km cap (the Bay Area buoys keep 1,500 km), same-water rule for sheltered buoys, `shelterWhy`. `nearSfBuoy` keeps the 1,500 km rule (west-orwa-ak reads the 500 km constant there and would drop "Buoy now vs forecast" for Seaside and San Diego; fixed there at its rebase). Existing sheltered buoys now say why (Cape Cod Bay, Buzzards Bay, the Chesapeake mouth).
- **Break type:** Pine Grove (Puerto Rico) is left with no break type: its guide text says "sandbar", but the app's type map has only Beach, Point and Reef and the guide's wave-type field says "not stated"; nothing is inferred.

## 4. Marine data, wind, zones
- **Shore wind: none assigned.** The East and Gulf enclosed-water mask does not exist, so the wind step was not run and `shoreWind.json` is unchanged. A later wind build would pair East spots with NDBC stations inside the new boxes: it needs the mask first.
- NWS zones resolved for every spot (10 borrow a neighbour's within 15 km). MOP: none (California only).
- Time zones: Atlantic `America/New_York`, Gulf `America/Chicago` for Alabama, Louisiana, Texas and the panhandle, Puerto Rico `America/Puerto_Rico` (no daylight saving).

## 5. Tide stations (7-day NOAA predicted high/low timing; `tide-review-batch3.ts`, `scripts/tide-classes-batch3.py`)
The East rule stays: every East and Gulf station not on a reviewed list is closed. For every station that is one of the three nearest to a batch spot (263 stations) the 7-day timing was computed against the nearest reviewed-open gauge (or, where none exists, an ocean-side gauge identified by name: pier, "(ocean)", light). Result: 23 open, 53 closed-if-alternative (inlet, pass, entrance, harbour or river-mouth gauges that agree with the open coast within 30-45 min; used only when no open gauge is within 40 km), the rest closed. Puerto Rico: 5 open, 5 closed-if-alternative, 1 closed (micro-tidal; gauges agree within about 45 min). Gulf tides are mixed or diurnal, so highs and lows pair unreliably: every Gulf station's reason carries that caveat and its class rests on name and position.
**Review fix:** Ponquogue Point (8512451) is inside Shinnecock Bay (+33 min, sd 25 from the Shinnecock Inlet ocean gauge) and is now closed. The two ocean-side gauges of the Long Island south shore, Shinnecock Inlet (ocean) 8512354 and Moriches Inlet 8513398, were re-timed against each other (-1 min and +1 min, sd 7, range ratio 1.08 and 0.92) and are open; the spots near them were re-picked.
Fallback stations (closed-if-alternative, used only when nothing open is within 40 km) say their own timing on the card (for example Blackbeard Island, Egg Islands, Old Tower and Gerrish Island agree with the open coast within 8-18 min, Jupiter Inlet runs 37 min behind) and "may differ", not "differ"; the Puerto Rico port gauges read "Harbour gauge".

| Station | Name | Class | Spots | km |
|---|---|---|---|---|
| 9759412 | Aguadilla | open | 25 | 0.1-22.3 |
| 8419399 | Cape Neddick | open | 24 | 1.5-35.7 |
| 8531680 | Sandy Hook, Fort Hancock | open | 13 | 1.4-35.6 |
| 8534770 | Ventnor City, ocean pier | open | 13 | 0-21.9 |
| 8722670 | Lake Worth Pier (ocean) | open | 13 | 0.2-31.2 |
| 8454658 | Narragansett Pier | open | 12 | 0.1-20.7 |
| 8459681 | Southwest Point, Block Island | open | 12 | 22.3-37.7 |
| 8726601 | Indian Rocks Beach (Coastal) | open | 12 | 1-21 |
| 9754986 | Boca de Cangrejos | open | 11 | 2.6-37.1 |
| 8731269 | Gulf State Park Pier | open | 10 | 2.7-39.7 |
| 8534720 | Atlantic City (Ocean) | open | 9 | 0.2-19.3 |
| 8722366 | Seminole Shores | open | 8 | 10.9-32.5 |
| 8512354 | Shinnecock Inlet (ocean) | open | 7 | 0.7-32.1 |
| 8662006 | Pawleys Island Pier (ocean) | open | 7 | 0-16.6 |
| 8670892 | Tybee Light | open | 7 | 4.1-36 |
| 8418557 | Old Orchard Beach | open | 6 | 0.5-21.1 |
| 8532337 | Belmar, Atlantic Ocean | open | 6 | 0.1-5.8 |
| 9757809 | Arecibo | open | 6 | 1.8-32.3 |
| 8661070 | Springmaid Pier, Myrtle beach | open | 5 | 1.2-17.5 |
| 8677344 | St. Simons Light | open | 5 | 10.2-35.4 |
| 8725899 | Nokomis, Venice Inlet | closed-if-alternative (fallback) | 5 | 1-29.9 |
| 8726034 | Siesta Key, Big Sarasota Pass | closed-if-alternative (fallback) | 5 | 2.3-8.6 |
| 8775870 | Corpus Christi, Bob Hall Pier | open | 5 | 0.2-11.8 |
| 8448875 | Martha's Vineyard GPS Buoy | open | 4 | 4.3-37.4 |
| 8451351 | Sachuest, Flint Point | open | 4 | 1.6-7.1 |
| 8726282 | Anna Maria Key, city pier | closed-if-alternative (fallback) | 4 | 1.2-12.8 |
| 8429489 | Hampton Harbor | closed-if-alternative (fallback) | 3 | 5.9-23.6 |
| 8448942 | Squibnocket Point | open | 3 | 0.5-6.1 |
| 8449062 | Eel Point | closed-if-alternative (fallback) | 3 | 9.3-14.7 |
| 8450768 | Sakonnet | open | 3 | 0.6-13.2 |
| 8513398 | Moriches Inlet | open | 3 | 1.1-9.9 |
| 8531991 | Long Branch (fishing pier) | open | 3 | 0.2-3 |
| 8656937 | Cape Lookout (ocean) | open | 3 | 10-29.1 |
| 8639168 | Virginia Beach | open | 2 | 7-26.3 |
| 8660266 | Hog Inlet Pier | open | 2 | 2.1-10.4 |
| 8661437 | Garden City Pier (ocean) | open | 2 | 0.1-3.9 |
| 8775270 | Port Aransas (H. Caldwell Pier) | open | 2 | 0.2-2.2 |
| 8418031 | Portland Head Light | open | 1 | 7.1-7.1 |
| 8448683 | Wasque Point, Chappaquiddick Island | closed-if-alternative (fallback) | 1 | 33-33 |
| 8453999 | Beavertail Point | open | 1 | 2.6-2.6 |
| 8458694 | Watch Hill Point | closed-if-alternative (fallback) | 1 | 38.1-38.1 |
| 8515186 | Fire Island Coast Guard Station | closed-if-alternative (fallback) | 1 | 39.4-39.4 |
| 8654400 | CAPE HATTERAS FISHING PIER | open | 1 | 26.7-26.7 |
| 8663101 | Cape Romain | open | 1 | 21.1-21.1 |
| 8674301 | South Newport River (Daymark 135) | closed-if-alternative (fallback) | 1 | 7.7-7.7 |
| 8735180 | DAUPHIN ISLAND | closed-if-alternative (fallback) | 1 | 4.7-4.7 |
| 8760172 | Chandeleur Light | open | 1 | 17.8-17.8 |
| 8773767 | Matagorda Bay Entrance Channel | closed-if-alternative (fallback) | 1 | 1.2-1.2 |
| 9754487 | Puerto Maunabo | closed-if-alternative (fallback) | 1 | 8.1-8.1 |
| TEC2837 | Bogue Inlet | closed-if-alternative (fallback) | 1 | 6-6 |
| TEC3463 | Blackbeard Island | closed-if-alternative (fallback) | 1 | 7.4-7.4 |

**25 spots of this batch (28 in the app, the other 3 from earlier rounds) have no open-coast tide station within 40 km** and each of them does have a CO-OPS gauge within 40 km: all are closed harbour, bay, sound, creek or river gauges (Plymouth 8446493, Duxbury, Chatham, the Key West channels, Chincoteague and others). The spot page, the Home card and the tide chart now say "No open-coast tide station within 40 km (harbour and bay gauges are not used)" for them (the list is `CLOSED_GAUGES_ONLY`, checked by a test); nothing is borrowed and no reference gauge was added (decision). Spots: Prestons (Massachusetts), Lynne Beach (Massachusetts), Revere Beach (Massachusetts), Winthrop Jetty (Massachusetts), Nantasket Beach (Massachusetts), Egypt Beach (Massachusetts), Egypt Beach (Massachusetts), Scituate Harbor (Massachusetts), Rexhame (Massachusetts), Fieldstone (Massachusetts), Brant Rock (Massachusetts), Marshfield Jetty (Massachusetts), Green Harbor (Duxberry) (Massachusetts), Head of the Meadow Beach (Massachusetts), Longnook to Ballston Beach (Massachusetts), Plymouth Beach (Massachusetts), Newcombs Hollow to Lecounts Hollow (Massachusetts), Maguire Landing Beach (Massachusetts), Marconis (Massachusetts), Nauset Light Beach (Massachusetts), Coastguard Beach (Massachusetts), Cape Cod (Massachusetts), Nauset Beach (Massachusetts), Chincoteague (Virginia), Key West (Florida Keys).

## 6. Context buoys
Nine live buoys were added (every spot's nearest live buoy was already shown except these): 44058 Stingray Point (sheltered, Chesapeake), 42095 Satan Shoal, 42098 Egmont Channel Entrance, 42357 Dauphin Island Sea Lab, 42033 and 42034 UTMSI (Port Aransas; co-located Spotters, so 42034 is a twin of 42033 and one is shown), 42354 Chandeleur Island SE, 41115 Rincon and 41121 Arecibo (Puerto Rico). They are in `ARCHIVE_BUOYS` (82 buoys, the test rule "every NDBC context buoy is archived"; the id pattern now allows 42xxx) and in the service's context list. They are **not** in the "how right we've been" scoring universe (`scoringBuoys.ts`): that needs the realtime2 archive to have run for them first, so the Gulf and Puerto Rico spots read "no buoy" there for now. A sheltered buoy with no observation says why once (the shelter note is not repeated from its owner text).

## 7. Gates and the quota
`tsc` clean, build passes, `npm test` all pass (1 skipped). The Open-Meteo budget test (capture plus hot refresh under 9,000 of the 10,000 daily calls at every hot-set size up to the cap) failed at the old cap of 180 hot spots (9,258 with 1,038 spots). Decision (lead): the hot cap is **150** (`HOT_MAX`): with 1,032 spots, 6,240 refresh + 1,824 capture = 8,064, leaving 1,936 for on-demand cold spots. The test bound is unchanged; the budget tables in `HOW-RIGHT-ALL.md` and `SPOT-SUBSET.md` are updated.
Test numbers that follow the catalogue: spots 1,032; breaking profiles 643; "outside facing" notes 145 (55 East and Gulf, 8 Puerto Rico); archived buoys 82; ingestion providers +9; the how-right-all re-score loop no longer assumes 6 stages; the scope test's remote spot is Key West; the time-zone tests allow Central and Puerto Rico.
