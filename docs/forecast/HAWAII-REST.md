# Hawaii rest of the islands (2026-11-10, after the data-honesty review)
Branch `hawaii-rest`. 384 -> 492 spots: the 108 catalogued spots not yet in the app (Maui 32, Big Island 31, Kauai 20, Oahu East 9, Oahu West 6, Molokai 5, Lanai 4, Niihau 1), none dropped (each has a position and a sourced facing). Source: docs/forecast/data/world-spots/hawaii.json.

- Time zone Pacific/Honolulu, US data sources (CO-OPS, NWS HIZ zones). Every spot has a HIZ zone. No MOP outside California: heights are the labelled offshore height, or the v1 breaking-rule estimate where a guide profile exists (246 of 492 spots have one; Pohue Bay Beach does not: its only source says it has no detailed break information).
- **Shore wind:** no station within 4 km passes the rules for any of the 108. Hawaii ASOS is not used (the enclosed-water mask does not cover Hawaii).
- **Buoys:** none added. CDIP 098 (Mokapu Point) and 106 (Waimea Bay) are the only Hawaii buoys in the registry and are shown with their distance; Maui, Kauai and the Big Island see Oahu buoys 100-350 km away. NDBC 51001-51004 are not wired (offshore, context only; a later round).
- **Swell window:** where the workable range holds every direction the guides call ideal and the exposure does not, the workable range is used (Dumps: exposure W-NW, ideal S/SSW, workable S-WNW; its window is now 210-292.5 after the usual ±60° facing clamp, which still cuts the due-south end). Scoped to these 108 rows: the older rows' ratings are byte-identical. 8 new rows moved: Dumps, Honolua Bay, Horners, Kahuku Ranch, Kalapaki, Makapu'u, Waiehu, Windmills. Pakala already used its workable range; Halawa Bay has no workable range, so it is unchanged.

## Tide stations
CO-OPS metadata has no open-coast flag and every Hawaii station predicts about 2-3 ft, so range cannot separate them. The first pass treated island harbour gauges as sheltered and sent spots to a far "open" station: wrong by 1-2 h. TIMING separates them. NOAA predicted high/low times for 2026-11-10 (datagetter hilo, MLLW): Makena runs 69-81 min after Kahului (Kahului-Makena 75 min mean) and Haleiwa runs 82-143 min before Waianae (-112 min mean), while Waianae matches Pearl Harbor Entrance (-8) and Honolulu (-19), Nawiliwili matches Hanamaulu (7) and Waimea (12), Lahaina matches Makena (6), Kaumalapau matches Kolo (0). So the harbour gauges Kahului, Waianae, Nawiliwili, Kawaihae, Lahaina, Hilo and Kaumalapau are classed OPEN, each with its comparison in `HAWAII_REVIEWED` (src/ocean/tideStations.ts). Pukoo Harbor is the only east Molokai gauge (46-58 min from Kaunakakai and Kolo), so it is used locally. Still closed-if-alternative: Kaunakakai, Kamalo, Port Allen (no spot uses them now). Closed: Moku O Loe and Waikane (Kaneohe Bay lagoon).
The classification is from station name and position plus those timing comparisons for one 2-day window; Honolulu and Waimanalo have no override (the word rule says unknown), Haleiwa and Pearl Harbor Entrance are classed by name only. No fallback label is shown for any Hawaii spot now; if one were, the tide card says "Harbour gauge: times and range differ from the open beach".

### Picks for the 108 new spots (spots per station)
| Station | Spots |
|---|---|
| 1610367 Nonopapa, Niihau Island | 1 |
| 1611400 NAWILIWILI | 6 |
| 1611401 Waimea Bay | 5 |
| 1611443 Hanamaulu Bay | 4 |
| 1611683 Hanalei Bay | 5 |
| 1612376 Waimanalo | 6 |
| 1612482 Waianae | 6 |
| 1613155 Pukoo Harbor | 2 |
| 1613226 Kolo | 3 |
| 1614465 Kaumalapau, Lanai Island | 3 |
| 1615202 Makena | 4 |
| 1615395 Hana | 2 |
| 1615680 KAHULUI | 12 |
| 1617277 Mahukona | 1 |
| 1617433 Kawaihae | 6 |
| 1617760 HILO | 5 |
| 1617846 Kailua Kona | 12 |
| 1618578 Honuapo | 7 |
| TPT2779 Laie Bay | 3 |
| TPT2799 Lahaina | 15 |

### Changed picks vs the first pass (old -> new)
| Spot | Island | Old station | New station |
|---|---|---|---|
| Kaena Point | Oahu West Side | Haleiwa, Waialua Bay 18.2 km | Waianae 17.3 km |
| Yokohama | Oahu West Side | Haleiwa, Waialua Bay 15 km | Waianae 12.5 km |
| Makaha Point | Oahu West Side | Haleiwa, Waialua Bay 18.2 km | Waianae 5 km |
| Maili Point | Oahu West Side | Haleiwa, Waialua Bay 22.5 km | Waianae 4.3 km |
| Ma'ili | Oahu West Side | Haleiwa, Waialua Bay 21.7 km | Waianae 3.2 km |
| Tracks | Oahu West Side | Pearl Harbor Entrance, Bishop Point 17.5 km | Waianae 11.3 km |
| Peahi - Jaws | Maui | Hana 34.7 km | KAHULUI 22.4 km |
| Hookipa | Maui | Makena 32.3 km | KAHULUI 12.3 km |
| Pavilions | Maui | Makena 32.5 km | KAHULUI 12.6 km |
| Kuau | Maui | Makena 31.7 km | KAHULUI 11.3 km |
| Tavares Bay | Maui | Makena 30.4 km | KAHULUI 10.3 km |
| Sprecklesville | Maui | Makena 28.6 km | KAHULUI 5.3 km |
| Baldwin Beach Park | Maui | Makena 29.2 km | KAHULUI 8.1 km |
| Kanaha | Maui | Makena 27.2 km | KAHULUI 2.1 km |
| Kahului Harbor | Maui | Makena 27.6 km | KAHULUI 1.2 km |
| Waiehu | Maui | Makena 28.4 km | KAHULUI 2.2 km |
| Waihee | Maui | Makena 31.4 km | KAHULUI 5.3 km |
| Ma'alaea Bay | Maui | Makena 16.3 km | KAHULUI 12.5 km |
| Kalaupapa | Molokai | Kolo 25 km | Pukoo Harbor 23.7 km |
| Kaiolohia Bay/Shipwreck Beach | Lanai | Kolo 36.4 km | Kaumalapau, Lanai Island 17.3 km |
| Kalapaki | Kauai | Hanamaulu Bay 4.5 km | NAWILIWILI 0.6 km |
| PK's | Kauai | Hanamaulu Bay 19.7 km | NAWILIWILI 15.2 km |
| Acid Drop | Kauai | Hanamaulu Bay 19.7 km | NAWILIWILI 15.2 km |
| Brenneckes | Kauai | Hanamaulu Bay 18.2 km | NAWILIWILI 13.4 km |
| Poipu Outer Reef | Kauai | Hanamaulu Bay 18.9 km | NAWILIWILI 14.3 km |
| Shipwrecks | Kauai | Hanamaulu Bay 17.1 km | NAWILIWILI 12.2 km |
| Kiholo Bay | Big Island | Kailua Kona 24.7 km | Kawaihae 22.7 km |
| Keawaiki Bay | Big Island | Kailua Kona 28.7 km | Kawaihae 18.7 km |
| Anaehoomalu Bay | Big Island | Mahukona 29.5 km | Kawaihae 14.3 km |
| Hapuna Point | Big Island | Mahukona 22.8 km | Kawaihae 4.7 km |
| Kawaihae Breakwater | Big Island | Mahukona 18 km | Kawaihae 0.7 km |
| Waipio Valley | Big Island | Mahukona 33.3 km | Kawaihae 26.5 km |
| Ka'anapali Point | Maui | Makena 39.1 km | Lahaina 4.1 km |
| Lahaina Breakwall | Maui | Makena 33.9 km | Lahaina 1.7 km |
| Lahaina Harbour | Maui | Makena 34.3 km | Lahaina 1.3 km |
| Launiupoko | Maui | Makena 29.9 km | Lahaina 5.6 km |
| Mala Wharf | Maui | Makena 36 km | Lahaina 0.6 km |
| Olowalu | Maui | Makena 25.1 km | Lahaina 10.4 km |
| Shark Pit | Maui | Makena 33.4 km | Lahaina 2.2 km |
| Ukumehame | Maui | Makena 21 km | Lahaina 14.3 km |
| Pohakuloa | Lanai | Kolo 27.5 km | Kaumalapau, Lanai Island 15.7 km |

41 picks changed (the first-pass list includes Tracks, which moved from Pearl Harbor Entrance to Waianae). Lahaina-side spots (Mala Wharf, Lahaina Harbour, Breakwall, Shark Pit, Launiupoko, Ka'anapali Point) now use Lahaina 0.6-5.6 km away. Picks farther than 25 km: Waipio Valley 26.5 km, Kapoho Bay 36.2 km, Pohoiki 37.9 km, Keauhou Point 38.7 km, Pohue Bay Beach 27 km (east Hawaii has no nearer station).

Other notes: Acid Drop and PK's (Kauai) share one marine point and so one Open-Meteo request. Production refresh is hot/cold (capped at 180 hot spots), simulated at 492 spots in hot-cron.test.ts; the flat cadence is kept only as history in fetch-budget.test.ts.

## Round 3C (2026-11-10): 7-day timing review, Honolulu and Waimanalo, Dumps
Method: NOAA predicted high/low times for 2026-11-10 to 11-16 (datagetter hilo, MLLW) for all 28 Hawaii stations in use; for each pair the mean offset of the nearest same-type extremum within 3 h (sd and n alongside) and the mean daily-range ratio. Raw 7-day pairs are in each reason in `HAWAII_REVIEWED` (src/ocean/tideStations.ts).
- **Honolulu (open):** 7 min from Pearl Harbor Entrance, 19 min (sd 1) from Waianae, 38 min from Makena; Waimanalo and Haleiwa run 76 and 92 min from it, so those regions keep their own gauges. **Waimanalo (open):** the open windward coast, 76 min (sd 32) from Honolulu, 34 min (sd 2) from Laie Bay, 8 min from Moku O Loe. **Pearl Harbor Entrance (open):** 7 min from Honolulu, 12 from Waianae. No pick changed (all three were allowed before as unknown; being open only matters for harbour fallbacks).
- **Every earlier class re-checked over 7 days; none changed.** Kahului/Makena 75 min (2-day: 75), Kahului/Lahaina 70, Waianae/Haleiwa 111 (-112), Nawiliwili/Hanamaulu 7 and Waimea 12, Lahaina/Makena 5, Kaumalapau/Kolo 1, Hilo/Honuapo 36, Kawaihae/Mahukona -26. Only numbers in reasons moved, and one claim was wrong: Pukoo "about 80 min from Lahaina" is 13 min with sd 43 (no stable relation); the Pukoo class stands on the stable 59 min from Kolo and 52 from Kaunakakai.
- **Observation, no change (the rule is "change only if the 7-day mean contradicts"):** Kaunakakai (7 min from Kolo), Port Allen (22 from Waimea, 10 from Nawiliwili) and Kamalo (30 from Kolo) would qualify as open on the same test that opened Hilo (36) and Kawaihae (-26). They stay closed-if-alternative; no spot takes them now. Say if you want them opened for consistency.
- **Dumps:** the only published facing is Surfnerd's "Faces W" (exposure W-WNW, NW); Surf-Forecast gives the best swell (SSW) and Wannasurf lists directions that work (S, SSW) but no facing. No second facing exists, so the ±60° clamp stays (window 210-292.5, unchanged). The spot says: "published best swell is outside ±60° of the sourced facing: swells from SSW (Surf-Forecast's best) give no surf-height estimate (never widened by estimate)." (Review round: only Surfnerd and Surf-Forecast give a "best"; Wannasurf's lists are directions that work, so they are not used. The guide is named per direction, "the guides'" only when every source agrees, "partly" only when some best direction is inside the window, and the scale card shows it only on an hour refused for being outside the window on one of the listed directions.)
- **Where it shows:** the method line, the profile note and, on the scale card, only the qualifying hours. It appears on **58 guide-profile rows: 35 in Hawaii and 23 elsewhere (California, Oregon and Washington, including spot-0, spot-6 Steamer Lane and spot-8 Pleasure Point)**; 32 say "partly outside", 26 "outside". The first version missed the abbreviation forms ("NW", "S") and dropped the parenthesised "(surf-forecast: southwest)" lists. Text only: profile windows, shelters and periods are identical before and after for all 246 profiles.
