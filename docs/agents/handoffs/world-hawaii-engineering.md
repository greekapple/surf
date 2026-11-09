# Handoff: world C4, Hawaii (Oahu North and South Shore), Engineering (2026-11-09)
Branch `world-hawaii-app` (from forecast-trust 773aaa2…). 102 → 146 spots. Nothing merged, pushed or deployed. Source: docs/forecast/data/world-spots/hawaii.json (152 spots; 44 taken: Oahu North Shore 22 + Oahu South Shore 22).

## What was built
- **add-spots world mode**: `node --experimental-strip-types --no-warnings docs/forecast/data/add-spots.ts docs/forecast/data/world-spots/hawaii.json "--region=Oahu North Shore,Oahu South Shore"`. Each spot becomes a COAST_ROWS row WITH its time zone (Pacific/Honolulu) and country (US); its `facts` are merged into guide-facts.json (replace by spotId); MOP scan only for California (no MOP elsewhere, said honestly); tides by the open-coast rule over CO-OPS mdapi; NWS land zones (HIZ…, 0.8 then 2 km inland retry); shore wind (HI_ASOS network, NDBC in the US boxes, existing exposure rule); service lists regenerated. Bounds are the US boxes (`pointInUs`), non-US rows are accepted structurally but every US source stays gated by country.
- **Hawaii zones** in browsing (Hawaii · Oahu, Maui, Big Island, Kauai, Molokai/Lanai/Niihau) and a Hawaii crumb.
- **Tide**: reviewed overrides for Haleiwa (Waialua Bay) 1612668 and Laie Bay TPT2779 as OPEN (the "bay" word rule is for estuary bays; Hawaii's are open coast): North Shore spots get Haleiwa 0.3-16 km or Laie Bay, not Waianae 20-35 km. The Spot page Tide card, which said "No tide station near this spot" for every spot without the San Francisco hourly series, now lists the next four highs and lows of the spot's own station (the same one Home names), in the spot's zone, labelled a station prediction.
- **Buoys**: CDIP 098p1 (Mokapu Point) and 106p1 (Waimea Bay) wired live (registry with positions, two more service targets, routing, normaliser reused). Context buoys now show only within 1,500 km of the spot (the Bay Area ones keep appearing along the whole West Coast; Hawaii is 3,800 km away and gets its two Oahu buoys), and "Buoy now vs forecast" (NDBC 46026) only where the SF buoy is in the same basin; otherwise "No wave buoy near this spot is registered yet".
- **Map badge** "Model data · 12:30 AM PST": always carries the map zone abbreviation, since a Hawaii spot's own clocks are HST.

## Per-spot table
| spot | region | MOP | breaking profile | tide station | NWS zone | shore wind | nearest buoy |
|---|---|---|---|---|---|---|---|
| Turtle Bay West | Oahu North Shore | none | no | Laie Bay 9.4 km | HIZ007 | none | CDIP 106 |
| Velzyland | Oahu North Shore | none | yes | Laie Bay 11.1 km | HIZ007 | none | CDIP 106 |
| Backyards | Oahu North Shore | none | yes | Laie Bay 11.6 km | HIZ007 | none | CDIP 106 |
| Sunset | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 11.3 km | HIZ007 | none | CDIP 106 |
| Rocky Point | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 10.2 km | HIZ007 | none | CDIP 106 |
| Chambers | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 9.8 km | HIZ007 | none | CDIP 106 |
| Ehukai | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 9.6 km | HIZ007 | none | CDIP 106 |
| Pipeline & Backdoor | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 9.3 km | HIZ007 | none | CDIP 106 |
| Off-The-Wall | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 9.1 km | HIZ007 | none | CDIP 106 |
| Rockpile | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 8.9 km | HIZ007 | none | CDIP 106 |
| Log Cabins | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 8.6 km | HIZ007 | none | CDIP 106 |
| Waimea Bay | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 6.6 km | HIZ007 | none | CDIP 106 |
| Marijuana's | Oahu North Shore | none | no | Haleiwa, Waialua Bay 5.9 km | HIZ007 | none | CDIP 106 |
| Chun's | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 3.9 km | HIZ007 | none | CDIP 106 |
| Jocko's | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 3.6 km | HIZ007 | none | CDIP 106 |
| Hultin's | Oahu North Shore | none | no | Haleiwa, Waialua Bay 3.4 km | HIZ007 | none | CDIP 106 |
| Himalayas | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 3 km | HIZ007 | none | CDIP 106 |
| Laniakea | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 3.2 km | HIZ007 | none | CDIP 106 |
| Puaena Point | Oahu North Shore | none | no | Haleiwa, Waialua Bay 0.4 km | HIZ007 | none | CDIP 106 |
| Avalanche | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 0.5 km | HIZ007 | none | CDIP 106 |
| Haleiwa | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 0.3 km | HIZ007 | none | CDIP 106 |
| Mokuleia | Oahu North Shore | none | yes | Haleiwa, Waialua Bay 8.7 km | HIZ007 | none | CDIP 106 |
| Ewa Beach Park | Oahu South Shore | none | yes | Pearl Harbor Entrance, Bishop Point 2.4 km | HIZ034 | none | CDIP 098 |
| Coves | Oahu South Shore | none | no | Pearl Harbor Entrance, Bishop Point 7.7 km | HIZ034 | none | CDIP 098 |
| Ewa Beach | Oahu South Shore | none | no | Pearl Harbor Entrance, Bishop Point 4.8 km | HIZ034 | none | CDIP 098 |
| White Plains Beach | Oahu South Shore | none | yes | Pearl Harbor Entrance, Bishop Point 8.7 km | HIZ034 | none | CDIP 098 |
| Sand Island | Oahu South Shore | none | no | HONOLULU 1.2 km | HIZ033 | none | CDIP 098 |
| Barbers Point | Oahu South Shore | none | no | Pearl Harbor Entrance, Bishop Point 15 km | HIZ034 | none | CDIP 106 |
| Kewalo's | Oahu South Shore | none | yes | HONOLULU 1.7 km | HIZ033 | none | CDIP 098 |
| South Shore - Ala Moana Park | Oahu South Shore | none | no | HONOLULU 2.4 km | HIZ033 | none | CDIP 098 |
| Tennis Courts | Oahu South Shore | none | yes | HONOLULU 2.3 km | HIZ033 | none | CDIP 098 |
| Ala Moana Bowls | Oahu South Shore | none | no | HONOLULU 3.4 km | HIZ033 | none | CDIP 098 |
| Kaisers | Oahu South Shore | none | yes | HONOLULU 3.8 km | HIZ033 | none | CDIP 098 |
| Waikiki Beach | Oahu South Shore | none | yes | HONOLULU 5 km | HIZ033 | none | CDIP 098 |
| Three's and Four's | Oahu South Shore | none | yes | HONOLULU 4.3 km | HIZ033 | none | CDIP 098 |
| Queen's | Oahu South Shore | none | yes | HONOLULU 5.2 km | HIZ033 | none | CDIP 098 |
| Secrets/Toes | Oahu South Shore | none | no | Waimanalo 8.7 km | HIZ032 | none | CDIP 098 |
| Queens/Canoes | Oahu South Shore | none | yes | HONOLULU 5.1 km | HIZ033 | none | CDIP 098 |
| Populars | Oahu South Shore | none | yes | HONOLULU 4.7 km | HIZ033 | none | CDIP 098 |
| Publics | Oahu South Shore | none | yes | HONOLULU 5.8 km | HIZ033 | none | CDIP 098 |
| Tonggs | Oahu South Shore | none | no | HONOLULU 6.8 km | HIZ033 | none | CDIP 098 |
| Black Point | Oahu South Shore | none | no | HONOLULU 9.1 km | HIZ032 | none | CDIP 098 |
| Cliffs | Oahu South Shore | none | yes | HONOLULU 8.4 km | HIZ032 | none | CDIP 098 |
| Diamond Head | Oahu South Shore | none | no | HONOLULU 8.4 km | HIZ032 | none | CDIP 098 |
profiles: 30 of 44


MOP none for all (CDIP MOP is California only): the surf height is the labelled offshore height or the v1 breaking-rule estimate where a profile exists (30 of 44 have a breaking profile from the guide facts). Shore wind: no station within 4 km passes the rules for any of the 44. Slope: none (no MOP point).

## Measured
- **Fetch budget** (weighted, 41.6 calls per spot per day): 102 spots 4,243; **146 spots 6,074**; 198 spots 8,237; all 152 Hawaii spots (254 total) 10,566, over the 10,000 free calls. The flat ceiling is ~240 spots.
- **Cron slice** (9 h of 5-minute ticks, the real service, steady state): 146 spots peak 648 subrequests in one run (budget 800), oldest values weather 60, spread 175, marine 185 min: fine. 180/200/220 spots: peak 652-663, ages inside TTL. **254 spots: marine and spread are never refreshed in 9 h (starved by the weather burst), so 254 is beyond what the cron can serve; ~220 is the cron ceiling, ~240 the quota ceiling.** The test sizes are 64, 95, 146 and 200.
- **Plan for the other 108 Hawaii spots**: another ~50 (Oahu East/West, Kauai, Maui) fits up to ~200 spots (8.2k/day). Beyond ~200 needs the hot/cold tiers (docs/forecast/OPEN-METEO-BUDGET.md: needs the client to load a subset of spots) or a paid plan; do not add all 152 with the flat cadence.
- **Map at Hawaii zoom** (t150-hawaii-map.mjs, MapLibre jumpTo, drawn pins = not xhide/xthin): Oahu overview 1440: 11 drawn pins, 3 labelled, 0 overlapping dots, 2 dots under a label; 390: 7 / 2 / 0 / 0. Waikiki zoom 11: 12 / 4 / 0 / 0 (390: 5 / 3 / 0 / 0). Pipeline zoom 11.5: 10 / 5 / 0 / 0 (390: 6 / 3 / 0 / 0). The spots-map declutter holds at 44 pins within a few km (212 raw dot overlaps in the DOM collapse to none drawn).
- **Map timeline zone**: the strip, stamps and the badge are in the map zone (America/Los_Angeles, labelled PST/PDT on the badge); a Honolulu spot's own cards are HST: Pipeline reads "Sun 8, 10:00 PM · now", first light 6:17 AM, last light 6:16 PM; the map strip reads "Mon 9 · 12 AM" at the same instant (LA). Consistent by rule, but only the badge says the zone; the strip and the stamp do not: a product call whether to show a zone tag there or switch MAP_TIME_ZONE to the viewer's zone.
- Screenshots (artifacts under ~/Development/ai-system-setup/playwright-toolkit/swello/artifacts): t149/{1440,390}-pipeline-backdoor.png, t149/{1440,390}-waikiki-beach.png, t150/*.png (map), t151/{1440,390}-home.png (Home with two Hawaii favourites: HST window "6:20–8 AM", sunrise 6:40 AM, next tide at Haleiwa 6.6 km, the week grid).

## Checks
tsc clean; 671 tests / 670 pass / 0 fail; build ok; journeys 8/8 warm on :5185.

## Weakest points
1. The Waikiki and South Shore spots show "offshore · not surf size" (no breaking profile for 14 of 44): honest, but the map and rating there rest on the global model only; Hawaii's wave heights are Hawaiian-scale ("face" vs "surf height" convention) and nobody has validated the Hawaiian height convention against these model numbers.
2. Tide for Hawaii is a CO-OPS station 0.3-30 km away chosen by name rules and two reviewed overrides; Hawaii's tidal range is small and varies little around Oahu, but I did not check each pick against the harbour it sits in.
