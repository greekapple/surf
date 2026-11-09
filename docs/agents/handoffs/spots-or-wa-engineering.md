# Handoff: Oregon and Washington spots, Engineering (2026-11-09)
Branch `spots-or-wa` (from forecast-trust 867155d; `spots-phase-b` was already in it). Nothing merged or pushed. 88 → 102 spots.

## Per-spot table (add-spots on phase-c-spots.json)
```
spot                          MOP      slope  tide station                         NWS zone        shore wind
Seaside (The Point)           none     no     Point Adams, Oreg. 24.9 km           ORZ101 (inland) none
Short Sands                   none     no     Nehalem 8.2 km (town name)           ORZ102 (inland) none
Cannon Beach                  none     no     Nehalem 20.6 km (town name)          ORZ101 (inland) none
Pacific City (Cape Kiwanda)   none     no     Nestucca Bay entrance 5.5 km         ORZ102 (inland) none
Otter Rock                    none     no     YAQUINA USCG STA, NEWPORT 13.1 km    ORZ103 (inland) none
Agate Beach                   none     no     YAQUINA USCG STA, NEWPORT 3.9 km     ORZ103 (inland) none
Florence South Jetty          none     no     Siuslaw River Entrance 1 km          none (marine)   none
Bastendorff Beach             none     no     CHARLESTON 2 km (town name)          ORZ021 (inland) none
Gold Beach                    none     no     Port Orford 36.2 km                  ORZ022 (inland) 4S1 (Gold Beach airport) 0.6 km
Brookings                     none     no     Brookings, Chetco Cove 1.4 km        ORZ022 (inland) none
Westport (The Cove)           none     no     Westport, Point Chehalis 1.4 km      WAZ331 (inland) none
Long Beach (Washington)       none     no     Cape Disappointment 8.1 km           WAZ201 (inland) none
La Push (First Beach)         none     no     James Island 1.3 km                  WAZ330 (inland) none
Neah Bay (Hobuck)             none     no     Makah Bay 4.4 km                     WAZ330 (inland) none
```
No MOP (CDIP MOP is California only; Brookings has no point within 2.5 km). "(inland)" = the beach point fell in a marine zone (PZZ…), the zone was resolved 0.8 km inland (opposite the beach's seaward direction); no spot needed to borrow a neighbour's zone. Florence's inland point is also in marine zone PZZ350, so it has no zone and no alerts.

## Rules added
- **Open-coast tide rule** (`tideStationExposure`, `pickTideStation`, `tideStationForSpot` in src/ocean/tideStations.ts; CO-OPS mdapi has no open-coast flag, so it reads the station name): closed = "inside", river, slough, creek, landing, bridge, lagoon, canal, channel, basin, marsh, docks, or an estuary Bay (not Monterey, Santa Monica, Carmel, Makah Bay); open = entrance, jetty, bar, spit, pier, wharf, ocean, outer coast, or cape, point, island, head, beach, rock, light, reef; else unknown (allowed). A spot uses the nearest not-closed station within 40 km. The enclosed-water mask is not used (0.01° resolution calls Moss Landing and Monterey piers enclosed; it stops at 43.6 N).
- Skipped for OR/WA: Cathcart Landing/Youngs River (19.8 km, Seaside), Skipanon River, North Fork Nehalem River (7.7 km Short Sands, 18.4 Cannon Beach), La Push Quillayute River, Tarlatt Slough and Ilwaco/Baker Bay (Long Beach WA), Depoe Bay, Gold Beach/Wedderburn Rogue River (all printed by add-spots with the reason).
- **NWS**: any state's land zone (`isLandZoneId`: CAZ/ORZ/WAZ…, never PZZ/ANZ/…); a point in a marine zone is looked up again 0.8 km inland before borrowing. 
- add-spots bounds 32–49.1 N; shore-wind build reads the OR_ASOS and WA_ASOS networks and NDBC to 49.1 N.

## California spots whose tide station changes under the rule (applied; 9 of 88)
Bolinas and Stinson Beach: Bolinas Lagoon → Ocean Beach (outer coast), 21 / 18 km. Manresa: Elkhorn Slough railroad bridge → Santa Cruz, Monterey Bay, 14 km. Bolsa Chica 11.5 → Newport Bay Entrance 18.8 km, Huntington Pier 5 → 12.5 km and Blackies 3.6 → 4.4 km: "Santa Ana River entrance (inside)" out. Pacific Beach 4.1 → La Jolla (Scripps Wharf) 7.8 km, Ocean Beach SD 2.7 → 13.1 km, Sunset Cliffs 5.3 → 15.9 km: "Quivira Basin, Mission Bay" out. (Home's "Next tide" and the registry test use `tideStationForSpot`; the four closed stations stay ingested but unused.)

## Checks
tsc clean; 646 tests / 645 pass / 0 fail (PRODUCT.md counts, zone-table test, profile coverage 86 of 102, review sheet regenerated, new tests for the rule and land zone ids); build ok. 75 of 102 spots have a MOP point.
Journeys: 8/8 on a warm dev server, 0/8 (338 × 502) right after the 14 spots were added, when most provider keys were cold. This branch has the batching but not the "3 keys of a batch at once" bound, which is on spot-timezone (6a4949c, now in forecast-trust): it reproduces the burst I suspected there.

## Weakest points
1. The tide rule is name-based. "unknown" picks are town names I cannot verify as open coast (Nehalem, Charleston, Port Orford 36 km for Gold Beach); the rule never picks a closed one, but it can still pick a sheltered harbour. A reviewed per-station table would be better than words.
2. Port Orford at 36 km is a long way for Gold Beach; Florence has no alerts zone. Neither is wrong, both are thin.
