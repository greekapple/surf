# US West Coast, batch 1: California (2026-11-10)
Branch `west-ca`. 492 -> 726 spots: the 234 California rows of `docs/forecast/data/world-spots/us-west.json` that are `appCandidate` (guide facing from surfnerd, a CO-OPS tide station within 30 km and a live wave buoy within 100 km) and not the same break as another candidate or an app spot. Batch 2 (Oregon, Washington, Sitka) follows in its own branch.

## Review round (2026-11-10)
- **Single-source facings were read as conflicts** (`facingOf`, build-guide-facts.ts): `South-southwest (surfnerd: "Faces SSW")` was split into S, SW and SSW. The guide's own "Faces X" token is now read first and whole hyphenated words ("South-southwest") as one point. **147 spots gain a breaking profile** (72 West Coast, 75 US East): profiles 315 -> 462 of 726; 262 spots newly record a facing. Before/after dump of all 726 profiles: no profile lost, **0 changed windows, shelter, periods or outside-facing notes for the 315 that had one, and no already-recorded facing changed**. Two real conflicts remain.
- **Marine query points on land** (8: Shark Pit - Marin, Fort Point, Deadmans, Monterey Bay, Ghost Tree, and the older Seaside, Hanalei Bay, Ma'alaea Bay): each now has an explicit sea point with its reason in `src/data/marinePoints.ts` (the Golden Gate spots use Ocean Beach's). `add-spots.ts` checks every marine point against the Natural Earth land polygons (`src/map/landCheck.ts`: coast.json 10 m for California, land-globe.json 50 m elsewhere) and fails on a land point; a test checks all 726. **Older spots whose marine query point moved:** `cs-seaside-or` Seaside (The Point) (46.056, -123.947) -> (45.976, -124.050); `w-hawaii-hanalei-bay` Hanalei Bay (22.214, -159.587) -> (22.294, -159.501); `w-hawaii-maalaea-bay` Ma'alaea Bay (20.733, -156.450) -> (20.720, -156.560): they previously asked Open-Meteo for a land cell, so their marine data changes with the point.
- The guide field `windOffshore` is now `surfnerdWorkableWind` (surfnerd's "workable wind" quote, never an offshore direction); it is not rendered.
- Context buoys: a twin pair shows once; LJPC1 labelled as a pier gauge.

## Which rows
- 240 California `appCandidate` rows; **4 dropped as the same break as another candidate row** (same name once "state", "beach", "the" and street/st are ignored, within 0.5 km; the row with more guide facts is kept): Bay St. (kept Bay Street, 0.14 km), Fort Point (kept the other Fort Point, 0.14 km), Moonlight State Beach (kept Moonlight Beach, 0.15 km), Surf Beach (the second one, 0.45 km). **2 more dropped as the same beach as an app spot** (outside the catalogue's 1 km rule, lead's decision): Zuma Beach County Park (1.4 km from `cs-zuma`) and Hermosa Beach (1.2 km from `cs-hermosa`). 240 - 6 = 234. `docs/forecast/data/west-batch.ts` regenerates `us-west-ca-batch1-ids.json` and `...-drops.json`.
- The catalogue had already dropped the rows that duplicate an app spot (within 1 km, or the same name within 25 km): 292 rows.
- **Forster St. Oceanside and The Rock, Oceanside** share one surfnerd pin (33.182, -117.375, both facing SW). Neither is an `appCandidate`: the nearest CO-OPS tide station is 34.4 km away (limit 30 km). They are not imported; when a tide station is added there, keep only one of them (same pin, same break).
- None of the 234 was dropped for a missing position or facing.
- Region = the county of the spot's latitude on the coast (the first 86 California spots are grouped by county; the catalogue's census-place names would have made 150 regions): Del Norte 7, Humboldt 13, Mendocino 18, Sonoma 9, Marin 5, San Francisco 2, San Mateo 7, Santa Cruz 8, Monterey 11, Big Sur 1, San Luis Obispo 19, Santa Barbara 30, Ventura 15, Los Angeles 30, Orange County 31, San Diego 28 (`CA_COUNTIES` in add-spots.ts; a navigation grouping only).
- Time zone America/Los_Angeles for every row (US data sources: CO-OPS, NWS CAZ zones). Types: Beach 118, Reef 65, Point 28, 23 unstated by the guide (null: shown nowhere, as before).

## What each spot got
- **Guide facts:** all 234 merged (guide-facts.json -> spotFactsSourced.ts); **139 have a breaking profile** (facing, swell window, period; 69 before the facing-parse fix in the review round below). The other 95 show the labelled offshore height, never an invented surf size. Profiles 246 -> 460 of 726 (the fix also gave 75 US East spots a profile).
- **MOP:** the scan ran for all 234, none matched the assignment rule (no nearshore point is assigned; the existing rule says so honestly).
- **NWS zones:** 231 resolved a CAZ land zone of their own, 1 borrows its neighbour's (Coronado Beach -> Coronado Shores, flagged approximate), 2 have none (Doran Beach, Shark Pit - Marin: marine zone only, no neighbour within 15 km).
- **Shore wind (4 km, existing rules, enclosed-water mask):** 9 spots: Point St George and Garth's Reef (CEC), Little River and Mad River beaches (ACV), Del Monte Beach and Monterey Wall (MRY), La Jolla Cove and Horseshoe (LJAC1), Tijuana Slough (NRS). 3 stations added to ingestion.
- **Buoys:** the 25 live wave buoys within 50 km of one of the spots were added to the context-buoy list (`src/ocean/buoys.ts`, NDBC text feed; none is inside a bay, so none is marked sheltered; "Santa Monica Bay" 46221 is an open embayment buoy outside the breakwaters). The context card shows the four nearest, so San Diego now shows La Jolla, Scripps, Point Loma South and Del Mar instead of the Bay Area buoys 1,000 km away, and Ocean Beach shows the San Francisco Bar and 46026 first. **How right we've been:** the 19 not already known join the scoring universe (each has a realtime `.spec`, checked); **406 of the 726 spots now have an eligible buoy** (194 of 492 before). The 19 are not in the NDBC archive list (`ARCHIVE_BUOYS`): widening it is the lead's call.

## Tide stations (open-coast rule plus reviewed overrides)
The importer picks the nearest CO-OPS prediction station that is not closed. California gauges mostly say "pier", "cove" or a town, so the name rule cannot tell an open pier from a harbour or slough; as in 3C, **timing** decides: NOAA predicted high/low times for 2026-11-10..16 (`docs/forecast/data/tide-timing.ts`: the nearest same-type extremum within 3 h, mean offset, sd, range ratio), judged against NEIGHBOURS on the exposed coast because the tide progresses along this coast (Gaviota +29 min after Santa Monica, Monterey +56 after Gaviota, the north coast another 40-60 min after Ocean Beach). Pier, cove and harbour-mouth gauges follow their neighbours within ~25 min and a range ratio of 0.9-1.05 (open). Bay gauges do not: the five San Francisco Bay stations checked run 89-96 min after Ocean Beach (ratio 1.17-1.33); Humboldt Bay lags grow inward (North Spit 11, Samoa 21, Eureka 30, Arcata 62 min after Trinidad).
- **Closed, so no Pacific spot takes them:** every other CO-OPS station in the San Francisco Bay box (86 ids, position from the station list), Arcata Wharf, Elkhorn Yacht Club (closed-if-alternative: a slough marina whose predictions copy Monterey's, which hides the slough).
- **Closed-if-alternative (used only when nothing open is in range):** Tomales Bay entrance (+46 min, ratio 0.85), Samoa, Eureka and Bucksport (Humboldt Bay), Point Bonita (in the mouth of the Golden Gate, +28 min: the Bay Area spots keep the Ocean Beach and San Francisco references they had, with their hourly series).
- Reviewed **open** (reason with the numbers in `CA_REVIEWED`, `src/ocean/tideStations.ts`, 40 entries), e.g. Santa Monica, King Harbor, Balboa, Port Hueneme, Ventura, Port San Luis, San Simeon, Monterey, Santa Cruz, Noyo Harbor, Westport, Trinidad, Crescent City, Brookings.
- Stations the importer added to the registry and ingestion: 15 net (the ones no spot uses after the review were removed again). **Cape Mendocino has no tide station within 40 km** (the nearest open-coast gauge, Humboldt Bay North Spit, is 40.9 km away, just past the limit; Shelter Cove is 54 km): its tide card says so, like the East spots without one.
- **Old spots whose pick changed (8, all Phase C `cs-` spots, none of the original 45):** Dillon Beach Tomales Bay entrance -> Bodega Harbor entrance (2.5 -> 9.9 km: the entrance gauge is bay water); Cayucos Port San Luis -> San Simeon (34 -> 33.3 km); Silver Strand TWC0445 Mugu 12.5 -> Port Hueneme 1.7 km; Bolsa Chica Newport Bay Entrance 18.8 -> Long Beach Fire Boat Pier 16.2 km; Huntington Beach and Blackies Newport Bay Entrance -> Balboa Pier (12.5 -> 11.3 km, 4.4 -> 2.9 km); OB San Diego and Sunset Cliffs La Jolla -> San Diego Quarantine Station (13.1 -> 5.4 km, 15.9 -> 3.2 km; -2 min and ratio 1.00 against La Jolla over 7 days).

### Picks for the 234 new spots (spots per station)
| Station | Spots | km | Class | Evidence |
|---|---|---|---|---|
| 9411399 Gaviota State Park, Pacific Ocean | 22 | 4.4-22.2 | open | Gaviota pier on the open coast: 7-day mean offset 29 min (sd 12) from Santa Monica pier, range ratio 0.99 |
| 9410230 La Jolla (Scripps Institution Wharf) | 18 | 2.2-26.9 | open | name says open coast or an entrance ("wharf") |
| 9410738 King Harbor, Santa Monica Bay | 16 | 1.7-12.0 | open | King Harbor (Redondo Beach) breakwater gauge on Santa Monica Bay: 7-day mean offset 16 min (sd 5) from La Jolla against 11 min for Santa Monica pier, range ratio 0.97 |
| 9412553 San Simeon | 10 | 3.2-18.6 | open | San Simeon pier on the open coast: 7-day mean offset 30 min (sd 10) from Gaviota, range ratio 1.01 |
| 9417426 NOYO HARBOR | 9 | 3.1-26.5 | open | Noyo Harbor (Fort Bragg), the harbour mouth: 7-day mean offset 14 min (sd 13) from Ocean Beach, the same as Arena Cove (14 min) and between Point Arena (16) and Westport  |
| 9413450 Monterey, Monterey Bay | 9 | 0.2-6.1 | open | Monterey (Coast Guard pier), the reference station of the wide Monterey Bay: 7-day mean offset 56 min (sd 16) from Gaviota, 9 min from Santa Cruz, range ratio 1.03 |
| 9412110 Port San Luis | 9 | 2.1-26.8 | open | Port San Luis (Harford pier, San Luis Obispo Bay): 7-day mean offset 22 min (sd 10) from Gaviota and 8 min from San Simeon, range ratio 1.02 |
| 9411270 Rincon Island, Mussel Shoals | 9 | 0.8-11.8 | open | Rincon Island causeway on the open Santa Barbara channel coast: 7-day mean offset 21 min (sd 8) from Santa Monica pier, range ratio 1.01 |
| 9410580 Newport Bay Entrance, Corona del Mar | 9 | 7.6-16.0 | open | Newport Bay entrance (Corona del Mar jetty): 7-day mean offset -5 min (sd 5) from Santa Monica pier, range ratio 0.99 |
| 9410840 Santa Monica, Municipal Pier | 7 | 0.3-28.1 | open | name says open coast or an entrance ("pier") |
| 9410678 Long Beach Fire Boat Pier | 7 | 9.5-12.8 | open | Long Beach Fire Boat Pier is inside the Los Angeles / Long Beach harbour by position, but its times and range match the open coast: 7-day mean offset -2 min (sd 5) from S |
| 9410583 Balboa Pier, Newport Beach | 7 | 3.9-14.8 | open | Balboa pier on the open Orange County coast: 7-day mean offset -7 min (sd 8) from Santa Monica pier, range ratio 0.97 |
| 9419750 Crescent City | 6 | 0.8-23.7 | open | Crescent City, the north coast reference station: 7-day mean offset 43 min (sd 13) from Ocean Beach, within 5 min of Trinidad and Brookings, range ratio 1.15 |
| 9419059 Trinidad Harbor | 6 | 0.4-23.6 | open | Trinidad Harbor (the pier in Trinidad Bay, an open roadstead): 7-day mean offset 41 min (sd 13) from Ocean Beach, range ratio 1.12 |
| 9417624 Westport | 6 | 0.3-22.8 | open | Westport on the open Mendocino coast: 7-day mean offset 21 min (sd 15) from Ocean Beach, range ratio 0.97 |
| 9413745 Santa Cruz, Monterey Bay | 6 | 0.7-12.8 | open | Santa Cruz wharf on Monterey Bay: 7-day mean offset 47 min (sd 16) from Gaviota, range ratio 1.00 |
| 9411189 Ventura | 6 | 0.8-8.4 | open | Ventura pier on the open coast: 7-day mean offset 10 min (sd 7) from Santa Monica pier, range ratio 0.99 |
| TWC0419 San Clemente | 6 | 1.5-11.4 | open | San Clemente pier on the open coast: 7-day mean offset -25 min (sd 11) from Santa Monica pier, range ratio 0.95 (a subordinate station) |
| 9416024 Fort Ross | 5 | 0.3-13.3 | open | Fort Ross cove on the open Sonoma coast: 7-day mean offset 2 min (sd 3) from Ocean Beach, range ratio 0.94 |
| 9413878 Ano Nuevo Island | 5 | 2.3-22.0 | open | name says "island" |
| 9410777 El Segundo, Santa Monica Bay | 5 | 0.5-6.3 | open | El Segundo oil pier on Santa Monica Bay: 7-day mean offset 11 min (sd 5) from Santa Monica pier, range ratio 0.97 |
| 9410166 San Diego, Quarantine Station | 5 | 2.2-8.3 | open | San Diego Quarantine Station is inside San Diego Bay by position (Point Loma, bay side of the entrance), but its times and range match the open coast: 7-day mean offset - |
| 9418024 Shelter Cove | 4 | 0.2-11.8 | open | Shelter Cove on the open Lost Coast: 7-day mean offset 23 min (sd 15) from Ocean Beach, range ratio 1.03 |
| 9411340 Santa Barbara | 4 | 0.5-20.7 | open | Santa Barbara (Stearns Wharf): 7-day mean offset 23 min (sd 7) from Santa Monica pier, range ratio 1.00 |
| 9418767 Humboldt Bay (North Spit) | 3 | 5.8-24.1 | open | Humboldt Bay (North Spit), at the bay entrance on the ocean side: 7-day mean offset 51 min (sd 14) from Ocean Beach, within 10 min of Trinidad (41) and Crescent City (43) |
| 9416409 Green Cove | 3 | 2.4-12.7 | open | Green Cove on the open Sonoma/Mendocino coast: 7-day mean offset 7 min (sd 20) from Ocean Beach, range ratio 0.89 (a subordinate station) |
| 9415020 Point Reyes | 3 | 5.1-9.3 | open | Point Reyes (Drakes Bay) on the open coast: 7-day mean offset 2 min (sd 14) from Ocean Beach, range ratio 0.96 |
| 9414131 Pillar Point Harbor | 3 | 10.9-20.9 | open | name says "point" |
| 9411065 Port Hueneme | 3 | 0.8-7.2 | open | Port Hueneme (the harbour's outer pier): 7-day mean offset 9 min (sd 6) from Santa Monica pier, range ratio 0.99 |
| TWC0445 Mugu Lagoon (ocean pier) | 3 | 18.0-28.5 | open | Mugu Lagoon ocean pier (on the sea side of Point Mugu): 7-day mean offset 5 min (sd 7) from Santa Monica pier, range ratio 0.97 |
| 9415625 Bodega Harbor entrance | 2 | 1.0-9.6 | open | Bodega Harbor entrance: 7-day mean offset 15 min (sd 4) from Ocean Beach, range ratio 0.93 |
| 9414290 San Francisco | 2 | 1.0-22.3 | unknown | nothing in its name says open coast or enclosed (a town or harbour name) |
| 9413616 Moss Landing, Ocean Pier | 2 | 3.9-9.5 | open | Moss Landing ocean pier on Monterey Bay: 7-day mean offset -1 min (sd 0) from Monterey, range ratio 0.95 |
| 9410660 LOS ANGELES (Outer Harbor) | 2 | 4.7-4.9 | open | Los Angeles Outer Harbor, outside the breakwater: 7-day mean offset -2 min (sd 5) from Santa Monica pier, range ratio 1.01 |
| 9430104 Brookings, Chetco Cove | 1 | 8.3-8.3 | open | Brookings (Chetco Cove): 7-day mean offset 46 min (sd 13) from Ocean Beach, 3 min from Crescent City, range ratio 1.15 |
| TWC0771 Point Arena | 1 | 4.5-4.5 | open | Point Arena on the open coast: 7-day mean offset 16 min (sd 12) from Ocean Beach, range ratio 0.97 |
| 9416841 Arena Cove | 1 | 4.9-4.9 | open | Arena Cove pier on the open Mendocino coast: 7-day mean offset 14 min (sd 12) from Ocean Beach, range ratio 0.98 |
| 9414275 Ocean Beach, outer coast | 1 | 2.2-2.2 | open | Ocean Beach, outer coast: the open-coast reference for the San Francisco coast |
| 9413375 Carmel Cove, Carmel Bay | 1 | 4.6-4.6 | open | Carmel Cove on Carmel Bay (an open bay): 7-day mean offset 52 min (sd 16) from Gaviota, range ratio 1.00 |
| 9412802 Mansfield Cone | 1 | 6.4-6.4 | open | Mansfield Cone, an open-coast gauge on the Big Sur coast: 7-day mean offset 40 min (sd 11) from Gaviota, range ratio 1.01 |
| TWC0473 Point Arguello | 1 | 11.7-11.7 | open | name says "point" |
| 9410650 Cabrillo Beach | 1 | 1.1-1.1 | open | Cabrillo Beach at the mouth of the Los Angeles harbour: 7-day mean offset 8 min (sd 5) from La Jolla and -2 min from Santa Monica, range ratio 1.02 |
| TWC0405 Point Loma | 1 | 3.9-3.9 | open | Point Loma on the open coast: 7-day mean offset -6 min (sd 10) from La Jolla, range ratio 0.96 |
| 9410170 SAN DIEGO (Broadway) | 1 | 4.6-4.6 | open | San Diego Broadway is inside San Diego Bay by position, but its times and range match the open coast: 7-day mean offset -1 min (sd 7) from La Jolla, range ratio 1.04 |
| 9410120 Imperial Beach | 1 | 2.4-2.4 | open | Imperial Beach pier on the open coast: 7-day mean offset -2 min (sd 7) from La Jolla, range ratio 0.97 |

## Open-Meteo budget at 726 spots (weighted calls a day, free tier 10,000)
Per hot spot the refresh costs the same 41.6 calls; the capture grows with the cold spots (`node docs/forecast/data/how-right-all-budget.ts`):

| hot spots | refresh | capture (cold marine + cold wind + 50 buoy points) | total | left for visitors' on-demand cold spots |
|---|---|---|---|---|
| 0 | 0 | 726 + 726 + 50 = 1,502 | 1,502 | 8,498 |
| 100 | 4,160 | 626 + 626 + 50 = 1,302 | 5,462 | 4,538 |
| **150** | 6,240 | 576 + 576 + 50 = 1,202 | **7,442** | 2,558 |
| 180 (cap) | 7,488 | 546 + 546 + 50 = 1,142 | 8,630 | 1,370 |

At the hot cap the daily total is 86 percent of the free tier. The capture is 151 Open-Meteo requests at 0 hot spots (10 locations each) and 115 at the cap. The shared ingestion targets grew by 43 (tide 119 -> 134, shore wind 9 -> 12, NDBC buoys 26 -> 51), all hot-gated like the existing ones. The how-right-all spot list needs no change: it is the catalogue (`spotPicks()` over `evidenceSpots`), so the 234 enter the next daily capture.

## Known issues found on the way
- **/personal/spots** lists every catalogue spot as a card: 726 cards, 179,656 px at 390 px wide. The t034 density gate's full-page screenshot of that page now times out (it passed at 492). Not fixed here (a list of favourites that lazy-loads or searches is a product change).
- **/explore/compare** at 390 px: long catalogue names ("Santa Maria Rivermouth/Guadalupe-Nipomo Dunes") ran past the 16 px gutter with a one-line ellipsis; they now wrap and the region drops below (`.cx-name` in explore.css). t034 map-compare passes.
- The 19 new buoys are context and scoring only: no realtime archive for them (see above).
