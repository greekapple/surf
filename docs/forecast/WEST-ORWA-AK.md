# US West Coast, batch 2: Oregon, Washington and Sitka (2026-11-10)
Branch `west-orwa-ak`, from forecast-trust 0ca6ea2 (not stacked on `west-ca`). 492 -> 541 spots: 39 Oregon and Washington rows of `docs/forecast/data/world-spots/us-west.json` and 10 Sitka rows of `alaska.json`, all `appCandidate` (guide facing from surfnerd, a CO-OPS tide station within 30 km and a live wave buoy within 100 km). Same method as batch 1 ([WEST-CA.md](WEST-CA.md) on branch `west-ca`).

## Review round (2026-11-10)
- **Older spots whose marine query point moved** (the default point, 0.08 degrees out along the spot's seaward direction, fell on land; explicit sea points with reasons in `src/data/marinePoints.ts`): `cs-seaside-or` Seaside (The Point) (46.056, -123.947) -> (45.976, -124.050); `w-hawaii-hanalei-bay` Hanalei Bay (22.214, -159.587) -> (22.294, -159.501); `w-hawaii-maalaea-bay` Ma'alaea Bay (20.733, -156.450) -> (20.720, -156.560). Their Open-Meteo marine data changes with the point (they previously asked for a land cell).
- **Importer depth guard (grid: NOAA ETOPO 2022 v1, 15 arc-second, `ETOPO_2022_v1_15s` on the coastwatch ERDDAP, not the older ETOPO1):** north of 43.5 N the land polygons are the coarse Natural Earth 50 m, so for the rows of a run the importer also requires the marine point to be deeper than 10 m in NOAA ETOPO 2022 and fails otherwise (`etopo:` line in the output). All 49 pass (the shallowest is -14.7 m; 3 Oregon/Washington lookups did not resolve and are unchecked). The review's -1 m (Good Rats) and -2 m (Shoals Point) readings came from the coarser ETOPO1 grid (etopo180), which disagrees with the finer ETOPO 2022 used here; so they did not reproduce: ETOPO gives -43.7 m at (57.316, -135.872) and -112.5 m at (56.936, -135.579), so those two points are unchanged. Red Tree Reef's own beach pin is -3 m, its marine point -27 m.
- **Context buoys:** a buoy is context only within **500 km** (the three original Bay Area buoys keep 1,500 km): Sitka shows only Cape Edgecumbe 46084, not Washington buoys 1,100 km away; Ocean Beach is back to its three Bay Area buoys. A sheltered buoy sorts last except for a spot in the same water (within 35 km with no open-ocean buoy nearer): the Strait of Juan de Fuca spots (Crescent Beach, Twin Rivers) see Angeles Point 46267 first, Fort Ebey sees New Dungeness 46088 first. The card says why a buoy is sheltered (`shelterWhy`: "inside the Strait of Juan de Fuca"), for NDBC as for CDIP.
- **Tide:** Cape Disappointment 9440581 is reviewed open (+26 min, sd 6, range 0.96 against South Beach). The Strait and Admiralty Inlet fallbacks now read "Strait station: ... about 1 h behind the outer coast" and "Admiralty Inlet station: ... hours behind the outer coast" instead of "times and range differ from the open beach". `tide-timing.ts` documents how the range ratio is computed (a reviewer's variant gave Twin Rivers 0.66 and Charleston 1.08; no class depends on it).
- **Guide facts:** Surfnerd's "Detailed condition notes aren't available for it yet..." boilerplate was stored as a hazard (Fort Ebey), which hid "Hazard information unknown"; it is filtered (Fort Ebey was the only row with it) and the facts regenerated.
- PRODUCT.md: Alaska (Sitka) added; State Line matched California MOP point DN372, so 75 distinct points and every Oregon, Washington and Sitka spot but State Line has none.

## Which rows
- 40 Oregon and Washington + 10 Sitka candidates; **1 dropped**: Coos Bay-Bastendorff Beach is the same beach as the app spot `cs-bastendorff` (1.1 km apart, outside the catalogue's 1 km rule); no duplicates among the candidates (`docs/forecast/data/west-batch2.ts` regenerates `us-west-orwa-batch2-ids.json`, `alaska-batch2-ids.json` and `west-batch2-drops.json`). 39 + 10 = 49 imported.
- Regions are counties by coast latitude (`OR_COUNTIES`, `WA_COUNTIES`, inside `eastRegion` of add-spots.ts so that the batch needs no new importer branch): Curry 6, Douglas 1, Lincoln 12, Tillamook 5, Clatsop 1, Pacific 2, Grays Harbor 4, Jefferson 1, Clallam 6, Island 1 (Fort Ebey, Whidbey Island); Sitka 10. New browsing zones: "Alaska · Sitka"; the Washington Coast zone gains Jefferson and Island, the Oregon South Coast zone Douglas.
- Time zones: America/Los_Angeles (Oregon, Washington), **America/Anchorage (Sitka)**; US data sources (CO-OPS, NWS CAZ/ORZ/WAZ/AKZ zones: all 49 resolved their own land zone, none borrowed).
- Types: Beach 26, Reef 11, Point 1, 11 unstated (null: shown nowhere).

## What each spot got
- **Guide facts:** all 49 merged; **23 have a breaking profile** (the single-source facing parse of the west-ca review round is included: `facingOf` reads "Faces X" first). Profiles 246 -> 344 of 541 (the parse fix alone gave 75 US East spots a profile; the numbers here are from this branch, which carries the same fix).
- **MOP:** none except State Line (42.002 N, on the Oregon border: a California MOP point matched).
- **Shore wind:** 3 spots (The Box - Newport and South Beach - Newport: ONP; Rainbow Rocks: BOK), none in Alaska (the airport network is CA/OR/WA only).
- **Marine query points:** none on land (the importer now fails on a land point, `src/map/landCheck.ts`; the three older land points are in `src/data/marinePoints.ts`).
- **Buoys:** the 10 live wave buoys within 50 km of one of the spots join the context list (46050, 46243, 46087, 46278, 46015, 46229, 46267, 46211, 46088, 46084). **The two Strait of Juan de Fuca buoys, Angeles Point 46267 and New Dungeness 46088, are inside the strait and marked sheltered** (excluded from "the buoy" a spot is scored against, labelled on cards). The estuary stations the catalogue lists (SATURN 46116 Baker Bay, 46117 Youngs Bay) are not live and not added. They also join the how-right scoring universe and the NDBC archive list (each has a realtime `.spec`, checked): **229 of 541 spots have an eligible buoy** (194 of 492 before: 35 of the 49 new spots). The context cards change for the original spots: Seaside now shows its Oregon and Washington buoys; the Bay Area spots show Port Orford as the fourth buoy until southern California's own buoys land (west-ca).

## Tide stations (7-day timing, the same method)
`docs/forecast/data/tide-timing.ts` (NOAA predicted high/low 2026-11-10..16, mean offset against neighbours on the exposed coast, sd, range ratio). The tide progresses along this coast (Port Orford +10 min after Crescent City, South Beach +37), so stations are judged against their neighbours.
- **Charleston (Coos Bay): reversed.** The 2026-11-09 review closed it (closed-if-alternative) and picked the Coquille River entrance (9432436) as the open alternative. Timing says the opposite: Rink Creek Entrance runs **+148 min** (sd 19, only 14 of 28 extrema pair) from Port Orford, range ratio 0.73: river water; Charleston runs +17 min (sd 8), range 1.03, the coast's own progression. Rink Creek is now closed-if-alternative, Charleston open, so **`cs-bastendorff` moves from Rink Creek (24.9 km) to Charleston (2.0 km)**: the only older spot whose pick changed.
- **Closed (bay, sound or river water):** Dick Point and Miami Cove (Tillamook Bay), Nahcotta and Paradise Point (Willapa Bay), Coupeville and Sunset Beach (Whidbey Island) and every other station in the Puget Sound box (118 ids: sound water, offsets 141-162 min on the few extrema that pair, ratio 1.4).
- **Closed-if-alternative:** Garibaldi (Tillamook Bay, +25 min), Twin Rivers (Strait of Juan de Fuca, +64 min, ratio 0.76) and Point Partridge (Admiralty Inlet, +162 min). The two strait / sound spots have no open-coast gauge within 40 km, so they use these two as **labelled fallbacks** ("Inlet or bay-side station").
- **Reviewed open (7-day numbers in `ORWA_REVIEWED`):** the jetty, entrance and cape gauges (Umpqua, Siuslaw, Tillamook North Jetty, Nestucca, Columbia River entrance, Point Adams, Point Brown, Point Grenville, Destruction Island, James Island, Makah Bay, Port Orford, Brookings).
- **Sitka Sound:** the five stations around Sitka follow the Sitka reference within 15 min with range ratios 0.92-1.02, so they are one tide; Whitestone Narrows and Olga Point (inside Neva / Olga Strait) and Symonds Bay (Biorka Island) are open on timing. Sitka spots use Scraggy Point, Whitestone Narrows, Olga Point, Sitka and Symonds Bay (3.2-28 km).
- **Stations added:** 13 net (Charleston among them); all 49 spots have one.

### Picks for the 49 new spots (spots per station)
| Station | Spots | km | Class | Evidence |
|---|---|---|---|---|
| TWC0857 Nestucca Bay entrance | 6 | 19.0-24.5 | open | Nestucca Bay entrance (Pacific City): 7-day mean offset 26 min (sd 15) from South Beach and 25 min from the Tillamook jetty, range ratio 0.92 |
| 9435380 Southbeach | 6 | 2.2-11.1 | open | Southbeach, the active reference station at the Yaquina Bay entrance (Newport), replaces the 1982 USCG station |
| 9437585 North Jetty, Tillamook Bay | 4 | 5.2-18.5 | open | North Jetty, Tillamook Bay: 7-day mean offset 1 min (sd 6) from South Beach, range ratio 0.97 |
| 9451600 Sitka | 3 | 3.2-18.1 | open | Sitka (Japonski Island), the Sitka Sound reference station, which is wide open to the Pacific |
| 9451725 Olga Point, Olga Strait | 3 | 26.2-28.2 | open | Olga Point is inside Olga Strait by position, but its times and range match the open sound: 7-day mean offset 7 min (sd 7) from Sitka, range ratio 0.92 |
| 9442861 Makah Bay | 3 | 1.6-2.9 | open | Makah Bay on the open coast south of Cape Flattery: 7-day mean offset 15 min (sd 4) from South Beach, range ratio 1.06 |
| 9431647 Port Orford | 3 | 0.8-21.2 | open | Port Orford (the dock in the open cove): 7-day mean offset 10 min (sd 2) from Crescent City, range ratio 1.07 |
| 9430104 Brookings, Chetco Cove | 3 | 5.5-32.2 | open | Brookings (Chetco Cove) on the open south Oregon coast: 7-day mean offset 3 min (sd 2) from Crescent City and 10 min before Port Orford, range ratio 1.00 |
| 9451802 Scraggy Point | 2 | 4.8-7.6 | open | Scraggy Point on the open northwest coast of Baranof Island: 7-day mean offset -4 min (sd 5) from Sitka, range ratio 0.98 |
| 9443644 Twin Rivers | 2 | 1.1-17.8 | closed-if-alternative | Twin Rivers is on the Strait of Juan de Fuca: 7-day mean offset 64 min (sd 25) from Makah Bay at the strait mouth, range ratio 0.76: strait water that lags the outer coas |
| 9441627 Point Grenville | 2 | 0.8-13.0 | open | Point Grenville on the open Washington coast: 7-day mean offset 1 min (sd 4) from South Beach and -14 min from Makah Bay, range ratio 0.99 |
| 9441156 Point Brown | 2 | 1.2-3.7 | open | Point Brown (Ocean Shores) on the open coast: 7-day mean offset 25 min (sd 7) from South Beach, range ratio 1.14 |
| 9451741 Whitestone Narrows, Neva Strait | 1 | 14.6-14.6 | open | Whitestone Narrows is inside Neva Strait by position, but its times and range match the open sound: 7-day mean offset 6 min (sd 3) from Sitka, range ratio 1.02 |
| 9451468 Symonds Bay, Biorka Island | 1 | 18.8-18.8 | open | Symonds Bay at Biorka Island, the outer coast at the mouth of Sitka Sound: 7-day mean offset -15 min (sd 1) from Sitka, range ratio 0.99 |
| 9447934 Point Partridge, Whidbey Island | 1 | 1.6-1.6 | closed-if-alternative | Point Partridge is at the entrance of Admiralty Inlet (Puget Sound): 7-day mean offset 162 min (sd 19, 7 of 28 extrema pair) from Makah Bay: sound water, used only when n |
| 9442388 James Island | 1 | 1.8-1.8 | open | James Island (La Push) on the open coast: 7-day mean offset 6 min (sd 6) from South Beach and -9 min from Makah Bay, range ratio 0.99 |
| TWC0965 Destruction Island | 1 | 7.1-7.1 | open | Destruction Island on the open Washington coast: 7-day mean offset 2 min (sd 4) from South Beach, range ratio 1.05 |
| 9440581 Cape Disappointment | 1 | 18.1-18.1 | open | name says "cape" |
| 9440574 Columbia River entrance (N. Jetty) | 1 | 2.2-2.2 | open | Columbia River entrance (North Jetty): 7-day mean offset 14 min (sd 5) from South Beach, range ratio 0.91 |
| TWC0881 Point Adams, Oreg. | 1 | 30.3-30.3 | open | Point Adams at the Columbia River mouth (Oregon side): 7-day mean offset 34 min (sd 5) from South Beach, range ratio 1.02 |
| 9434132 Siuslaw River Entrance | 1 | 32.4-32.4 | open | Siuslaw River Entrance (Florence, at the jetties): 7-day mean offset -6 min (sd 3) from South Beach, range ratio 0.88 |
| 9433445 Umpqua River Entrance, Half Moon Bay | 1 | 2.2-2.2 | open | Umpqua River Entrance (Winchester Bay, at the jetties): 7-day mean offset 3 min (sd 3) from South Beach and 30 min from Port Orford, range ratio 0.88 |

## Open-Meteo budget at 541 spots (weighted calls a day, free tier 10,000)
| hot spots | refresh | capture (cold marine + cold wind + 40 buoy points) | total | left for visitors' on-demand cold spots |
|---|---|---|---|---|
| 0 | 0 | 541 + 541 + 40 = 1,122 | 1,122 | 8,878 |
| 100 | 4,160 | 441 + 441 + 40 = 922 | 5,082 | 4,918 |
| **150** | 6,240 | 391 + 391 + 40 = 822 | **7,062** | 2,938 |
| 180 (cap) | 7,488 | 361 + 361 + 40 = 762 | 8,250 | 1,750 |

The how-right-all spot list is the catalogue, so the 49 enter the next daily capture with no change. The NDBC archive grows to 64 buoys on this branch (a daily run is 517 operations, 128 GETs; with west-ca's 19 as well it is 83 buoys).
