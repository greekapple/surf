# US East batch 1: what each spot has (2026-11-09, after review cycle 1)

Source `docs/forecast/data/world-spots/us-east.json` (506 catalogued); batch list `us-east-batch1-ids.json` (**238 ids**). **Criteria:** a LIVE NDBC wave buoy within 50 km that is not a sheltered bay buoy (Cape Cod Bay 44090, Buzzards Bay 44085 and Thimble Shoal 44087 do not count) AND a CO-OPS water-level or prediction station within 25 km; open Atlantic coast only (no Great Lakes, no Gulf); Kite Point and Canadian Hole (Pamlico Sound side) excluded by hand. Maine, New Hampshire, Delaware and Maryland have no spot (no live buoy within 50 km).

**Counts:** 238 spots, all America/New_York (283 before the review; 45 dropped, listed at the end). Tide station: 234 have one, 4 none; 13 use an inlet-mouth station (Fire Island Coast Guard 8515186, Bogue Inlet) with the visible note "inlet/bay-side station: times and range differ from the open beach". NWS zone: 212 own, 26 borrow a neighbour's (≤15 km). Shore wind: 7 spots (Duck Pier, Trident Pier, Sebastian Inlet north jetty, plus the West Coast ones already there). Break type: spots whose guide states no wave type have type null and show none.

**Ditch Plains (Montauk, NY) is not in the batch, by the filter:** its nearest wave buoy, NDBC 44017 (40.1 km), reported no wave height in NDBC latest_obs on 2026-11-09 (not live); the nearest LIVE buoy, NDBC 44097 Block Island, is 66.8 km (>50). Its tide gauge is fine (CO-OPS 8510560 Montauk, 4.0 km). "Montauk Point - Turtles" was dropped from the source file (no facing).

## Tide stations in use: predicted high/low range, 2026-11-09/10 (CO-OPS datagetter hilo, MLLW, ft)
An open-coast station should show roughly 3-8 ft on the Atlantic coast (Florida about 3-4); a bay or inlet station shows far less (West Fire Island 0.73 ft and Hatteras (ocean) 0.8 ft were both removed for that).

| Station | Range ft | Spots |
|---|---|---|
| Fire Island Coast Guard Station (8515186) (inlet fallback) | 2.25 | 12 |
| Hollywood Beach (8722979) | 2.56 | 3 |
| Bogue Inlet (TEC2837) (inlet fallback) | 2.73 | 1 |
| GOVERNMENT CUT, MIAMI HARBOR ENTRANCE (8723178) | 2.86 | 1 |
| Haulover Pier, N. Miami Beach (8723080) | 3.02 | 2 |
| Miami Harbor Entrance (8723170) | 3.1 | 3 |
| Hillsboro Inlet (ocean) (8722862) | 3.19 | 10 |
| Fort Pierce Inlet, south jetty (8722212) | 3.2 | 6 |
| Southwest Point, Block Island (8459681) | 3.22 | 2 |
| Lauderdale-by-the-Sea, Anglin Fishing Pier (8722899) | 3.4 | 2 |
| Seminole Shores (8722366) | 3.69 | 4 |
| Cape Hatteras (TEC2789) | 3.75 | 7 |
| CAPE HATTERAS FISHING PIER (8654400) | 3.76 | 3 |
| Kitty Hawk (ocean) (8651605) | 3.8 | 9 |
| DUCK PIER (8651370) | 3.88 | 3 |
| Jennettes Pier, Nags Head (ocean) (8652226) | 3.93 | 9 |
| Sandbridge (8639428) | 4.04 | 2 |
| Virginia Beach (8639168) | 4.16 | 7 |
| Vero Beach (ocean) (8722105) | 4.16 | 9 |
| Port Canaveral (Trident Pier) (8721604) | 4.18 | 1 |
| Cocoa Beach (8721649) | 4.23 | 4 |
| Canova Beach (8721804) | 4.26 | 11 |
| Cape Canaveral (TEC3693) | 4.3 | 1 |
| Patrick Air Force Base (8721727) | 4.3 | 6 |
| Daytona Beach Shores, Sunglow Pier (8721120) | 4.39 | 12 |
| Atlantic City (Ocean) (8534720) | 4.83 | 4 |
| Wrightsville Beach (8658163) | 5.04 | 7 |
| Seaside Heights, ocean (8533071) | 5.15 | 15 |
| Ocean City Beach (fishing pier) (8657419) | 5.28 | 7 |
| Wilmington Beach (8658559) | 5.29 | 4 |
| Belmar, Atlantic Ocean (8532337) | 5.32 | 9 |
| Cape Romain (8663101) | 5.38 | 1 |
| St. Augustine Beach (8720587) | 5.46 | 10 |
| Oak Island, Yaupon Beach (8659182) | 5.53 | 2 |
| Sandy Hook, Fort Hancock (8531680) | 5.6 | 1 |
| Sunset Beach Pier (8659897) | 5.76 | 2 |
| Isle of Palms Pier (8665494) | 5.77 | 4 |
| Jacksonville Beach (8720291) | 5.79 | 5 |
| Atlantic Beach (8720259) | 5.91 | 4 |
| Folly Island (outer coast) (TEC3127) | 5.92 | 4 |
| Sullivans Island (outer coast) (TEC3047) | 5.99 | 1 |
| Little Talbot Island, ocean (8720194) | 6.21 | 4 |
| Edisto Beach, Edisto Island (8667630) | 6.54 | 3 |
| St. Marys Entrance, North Jetty (8679997) | 6.59 | 8 |
| St. Simons Light (8677344) | 7.65 | 5 |
| Braddock Point, Hilton Head Island (8669625) | 7.67 | 2 |
| Tybee Light (8670892) | 7.76 | 2 |

| Area | Spots |
|---|---|
| Space Coast | 46 |
| Northeast Florida | 32 |
| Outer Banks | 31 |
| Northern New Jersey | 24 |
| Southern North Carolina | 23 |
| Southeast Florida | 21 |
| South Carolina | 15 |
| New York | 13 |
| Virginia | 9 |
| Georgia | 8 |
| Treasure Coast | 8 |
| Southern New Jersey | 4 |
| Massachusetts | 2 |
| Rhode Island | 2 |

| Spot | Area | Tide station (km) | NWS zone | Shore wind |
|---|---|---|---|---|
| 5th Street/7th Street | Georgia | St. Simons Light (8677344) 1.1 km | GAZ154 | none |
| Coastguard/St Simons | Georgia | St. Simons Light (8677344) 3.1 km | GAZ154 | none |
| Comfort Inn/Jeckyll Island | Georgia | St. Simons Light (8677344) 7.1 km | GAZ154 | none |
| Cumberland Island | Georgia | St. Marys Entrance, North Jetty (8679997) 14.7 km | GAZ166 | none |
| Jekyll Island | Georgia | St. Simons Light (8677344) 2.9 km | GAZ154 | none |
| North Jetty | Georgia | Tybee Light (8670892) 1.4 km | GAZ219 | none |
| St. Simons Island | Georgia | St. Simons Light (8677344) 1.2 km | GAZ154 | none |
| Sugar Shack | Georgia | Tybee Light (8670892) 1.5 km | GAZ219 | none |
| Good Harbour Beach | Massachusetts | none | MAZ007 | none |
| Long Beach | Massachusetts | none | MAZ007 | none |
| Atlantique Beach | New York | Fire Island Coast Guard Station (8515186) 7.7 km | NYZ080 | none |
| Davis Park | New York | Fire Island Coast Guard Station (8515186) 22.8 km | NYZ080 (approx) | none |
| Fair Harbor | New York | Fire Island Coast Guard Station (8515186) 6.6 km | NYZ080 (approx) | none |
| Fire Island | New York | Fire Island Coast Guard Station (8515186) 8.9 km | NYZ080 | none |
| Gilgo Beach | New York | Fire Island Coast Guard Station (8515186) 11.4 km | NYZ080 | none |
| Jones Beach State Park | New York | Fire Island Coast Guard Station (8515186) 7.4 km | NYZ080 | none |
| Jones Beach State Park | New York | Fire Island Coast Guard Station (8515186) 21.2 km | NYZ179 | none |
| Ocean Bay Park | New York | Fire Island Coast Guard Station (8515186) 10.6 km | NYZ080 | none |
| Point O’ Woods | New York | Fire Island Coast Guard Station (8515186) 11.4 km | NYZ080 (approx) | none |
| Robert Moses | New York | Fire Island Coast Guard Station (8515186) 1.9 km | NYZ080 (approx) | none |
| Robert Moses State Park | New York | Fire Island Coast Guard Station (8515186) 0.6 km | NYZ080 | none |
| Tobay Beach | New York | Fire Island Coast Guard Station (8515186) 14 km | NYZ080 | none |
| West End, Jones Beach | New York | Sandy Hook, Fort Hancock (8531680) 39.2 km | NYZ179 (approx) | none |
| 18th Street | Northeast Florida | Atlantic Beach (8720259) 1.3 km | FLZ125 | none |
| 8th Ave. South | Northeast Florida | Jacksonville Beach (8720291) 0.4 km | FLZ125 | none |
| A St. | Northeast Florida | St. Augustine Beach (8720587) 1.3 km | FLZ333 | none |
| A Street | Northeast Florida | St. Augustine Beach (8720587) 1.4 km | FLZ333 | none |
| Amelia Pier | Northeast Florida | St. Marys Entrance, North Jetty (8679997) 11 km | FLZ124 | none |
| American Beach | Northeast Florida | St. Marys Entrance, North Jetty (8679997) 15.9 km | FLZ124 | none |
| Atlantic Beach | Northeast Florida | Atlantic Beach (8720259) 0.4 km | FLZ125 | none |
| Blowhole | Northeast Florida | St. Augustine Beach (8720587) 1.6 km | FLZ333 | none |
| Crescent Beach | Northeast Florida | St. Augustine Beach (8720587) 9.8 km | FLZ333 | none |
| F.A's | Northeast Florida | St. Augustine Beach (8720587) 0.3 km | FLZ333 | none |
| Fernandina Beach Pier | Northeast Florida | St. Marys Entrance, North Jetty (8679997) 6.1 km | FLZ124 | none |
| Flagler Beach Pier | Northeast Florida | none | FLZ138 | none |
| Flagler Pier | Northeast Florida | none | FLZ138 | none |
| Ft. Clinch State Park | Northeast Florida | St. Marys Entrance, North Jetty (8679997) 2.9 km | FLZ124 | none |
| Gate Station | Northeast Florida | St. Augustine Beach (8720587) 19.3 km | FLZ233 | none |
| Hannah Park/ Mayport Poles | Northeast Florida | Little Talbot Island, ocean (8720194) 5.1 km | FLZ125 | none |
| Hooks | Northeast Florida | St. Marys Entrance, North Jetty (8679997) 3.9 km | FLZ124 | none |
| Jacksonville Beach Pier | Northeast Florida | Jacksonville Beach (8720291) 1.1 km | FLZ125 | none |
| Jax Beach Pier | Northeast Florida | Jacksonville Beach (8720291) 1.1 km | FLZ125 | none |
| Little Talbot Island | Northeast Florida | Little Talbot Island, ocean (8720194) 3.2 km | FLZ125 | none |
| Main Beach (Florida) | Northeast Florida | St. Marys Entrance, North Jetty (8679997) 5.8 km | FLZ124 | none |
| Matanzas Inlet | Northeast Florida | St. Augustine Beach (8720587) 16.9 km | FLZ333 | none |
| Mayport Poles | Northeast Florida | Atlantic Beach (8720259) 5.2 km | FLZ125 | none |
| Middles (Florida) | Northeast Florida | St. Augustine Beach (8720587) 3.5 km | FLZ333 | none |
| Neptune Beach | Northeast Florida | Atlantic Beach (8720259) 1.1 km | FLZ125 | none |
| North Jetty (Florida) | Northeast Florida | Little Talbot Island, ocean (8720194) 3 km | FLZ125 | none |
| Peters Point | Northeast Florida | St. Marys Entrance, North Jetty (8679997) 13.5 km | FLZ124 | none |
| Ponte Vedra | Northeast Florida | Jacksonville Beach (8720291) 13.7 km | FLZ233 | none |
| Sawgrass | Northeast Florida | Jacksonville Beach (8720291) 10.3 km | FLZ233 | none |
| St. Augustine Pier | Northeast Florida | St. Augustine Beach (8720587) 0.1 km | FLZ333 | none |
| Talbot Island | Northeast Florida | Little Talbot Island, ocean (8720194) 5.4 km | FLZ125 | none |
| Vilano Jetty | Northeast Florida | St. Augustine Beach (8720587) 7.1 km | FLZ333 | none |
| 16th Ave., Belmar | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 1.6 km | NJZ014 | none |
| 30th Street (Ship Bottom) | Northern New Jersey | Seaside Heights, ocean (8533071) 36.4 km | NJZ026 | none |
| 711 | Northern New Jersey | Seaside Heights, ocean (8533071) 34.8 km | NJZ026 | none |
| Barnegat Light | Northern New Jersey | Seaside Heights, ocean (8533071) 22.1 km | NJZ026 | none |
| Bay Head | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 13.2 km | NJZ026 | none |
| Belmar to Sea Girt | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 3 km | NJZ014 | none |
| Harvey Cedars | Northern New Jersey | Seaside Heights, ocean (8533071) 28.6 km | NJZ026 (approx) | none |
| Island Beach State Park | Northern New Jersey | Seaside Heights, ocean (8533071) 12.5 km | NJZ026 (approx) | none |
| Island Beach State Park | Northern New Jersey | Seaside Heights, ocean (8533071) 17.1 km | NJZ026 | none |
| Jenkinson's | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 10.4 km | NJZ026 | none |
| Jenkinsons (Point Pleasant) | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 9.7 km | NJZ026 | none |
| Lavallette | Northern New Jersey | Seaside Heights, ocean (8533071) 5 km | NJZ026 | none |
| Lavallette | Northern New Jersey | Seaside Heights, ocean (8533071) 3.8 km | NJZ026 | none |
| Manasquan | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 9.3 km | NJZ026 (approx) | none |
| Manasquan Inlet | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 8.2 km | NJZ014 | none |
| Mantoloking | Northern New Jersey | Seaside Heights, ocean (8533071) 9.5 km | NJZ026 | none |
| Meters | Northern New Jersey | Seaside Heights, ocean (8533071) 3 km | NJZ026 | none |
| Ortley Beach | Northern New Jersey | Seaside Heights, ocean (8533071) 3.1 km | NJZ026 | none |
| Sea Girt | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 6.1 km | NJZ014 | none |
| Seaside Heights/ Casino Pier | Northern New Jersey | Seaside Heights, ocean (8533071) 2.8 km | NJZ026 | none |
| Seaside Park | Northern New Jersey | Seaside Heights, ocean (8533071) 4.4 km | NJZ026 (approx) | none |
| Ship Bottom | Northern New Jersey | Seaside Heights, ocean (8533071) 34.5 km | NJZ026 | none |
| Spring Lake | Northern New Jersey | Belmar, Atlantic Ocean (8532337) 3.7 km | NJZ014 | none |
| Surf City | Northern New Jersey | Seaside Heights, ocean (8533071) 33.1 km | NJZ026 | none |
| 1st Street | Outer Banks | Kitty Hawk (ocean) (8651605) 8.9 km | NCZ203 | none |
| Abalone St. | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 9.6 km | NCZ203 | none |
| Askins Creek | Outer Banks | Cape Hatteras (TEC2789) 9.9 km | NCZ205 | none |
| Avalon Pier | Outer Banks | Kitty Hawk (ocean) (8651605) 7.2 km | NCZ203 | none |
| Avalon Pier | Outer Banks | Kitty Hawk (ocean) (8651605) 7.2 km | NCZ203 | none |
| Avon Pier | Outer Banks | Cape Hatteras (TEC2789) 12.7 km | NCZ205 | none |
| Bath House | Outer Banks | Kitty Hawk (ocean) (8651605) 10.8 km | NCZ203 | none |
| Boilers/Ranger Station | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 23.3 km | NCZ205 | none |
| Cape Hatteras Lighthouse | Outer Banks | Cape Hatteras (TEC2789) 2.4 km | NCZ205 | none |
| Corolla Lighthouse | Outer Banks | DUCK PIER (8651370) 22.7 km | NCZ102 | none |
| Duck Pier | Outer Banks | DUCK PIER (8651370) 0.3 km | NCZ203 (approx) |  8651370 - Duck Pier, NC  0.4 km |
| Eckner Street | Outer Banks | Kitty Hawk (ocean) (8651605) 1.7 km | NCZ203 | none |
| Eighth Street | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 10.6 km | NCZ203 | none |
| Frisco | Outer Banks | CAPE HATTERAS FISHING PIER (8654400) 0.3 km | NCZ205 | none |
| Frisco Pier | Outer Banks | CAPE HATTERAS FISHING PIER (8654400) 0.1 km | NCZ205 (approx) | none |
| Hatteras Ferry Docks | Outer Banks | CAPE HATTERAS FISHING PIER (8654400) 6.6 km | NCZ205 | none |
| Jennette's Pier | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 0.3 km | NCZ203 (approx) | none |
| K.O.A | Outer Banks | Cape Hatteras (TEC2789) 38.2 km | NCZ205 | none |
| Kitty Hawk Pier | Outer Banks | Kitty Hawk (ocean) (8651605) 0 km | NCZ203 | none |
| Laundromats | Outer Banks | Kitty Hawk (ocean) (8651605) 3.7 km | NCZ203 | none |
| Loggerhead St. | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 4.1 km | NCZ203 | none |
| Martin St. | Outer Banks | Kitty Hawk (ocean) (8651605) 11.8 km | NCZ203 | none |
| Nags Head Pier | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 7.9 km | NCZ203 | none |
| North Buxton | Outer Banks | Cape Hatteras (TEC2789) 3.7 km | NCZ205 | none |
| Outer Banks Pier | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 2.8 km | NCZ203 | none |
| Rodanthe Pier | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 38 km | NCZ205 | none |
| S Turns | Outer Banks | Jennettes Pier, Nags Head (ocean) (8652226) 35.5 km | NCZ205 (approx) | none |
| Southern Duck | Outer Banks | DUCK PIER (8651370) 2.9 km | NCZ203 |  8651370 - Duck Pier, NC  2.9 km |
| The Lighthouse | Outer Banks | Cape Hatteras (TEC2789) 2.3 km | NCZ205 | none |
| Third Street | Outer Banks | Kitty Hawk (ocean) (8651605) 8.4 km | NCZ203 | none |
| Waves and Salvo | Outer Banks | Cape Hatteras (TEC2789) 35.1 km | NCZ205 | none |
| Black Rock Point | Rhode Island | Southwest Point, Block Island (8459681) 2.4 km | RIZ008 | none |
| Mansion Beach | Rhode Island | Southwest Point, Block Island (8459681) 5.9 km | RIZ008 | none |
| 10th Street | South Carolina | Folly Island (outer coast) (TEC3127) 1.8 km | SCZ150 | none |
| Bert's Bar | South Carolina | Sullivans Island (outer coast) (TEC3047) 1.1 km | SCZ150 | none |
| Bull Island | South Carolina | Isle of Palms Pier (8665494) 23.9 km | SCZ150 | none |
| Burkes Beach | South Carolina | Braddock Point, Hilton Head Island (8669625) 15.4 km | SCZ148 | none |
| Cape Romain | South Carolina | Cape Romain (8663101) 1.1 km | SCZ150 | none |
| Dewees Island | South Carolina | Isle of Palms Pier (8665494) 8.8 km | SCZ150 | none |
| Edisto Beach | South Carolina | Edisto Beach, Edisto Island (8667630) 1.9 km | SCZ149 | none |
| Folly Beach Pier | South Carolina | Folly Island (outer coast) (TEC3127) 0.5 km | SCZ150 | none |
| Fripp Island | South Carolina | Edisto Beach, Edisto Island (8667630) 27.7 km | SCZ148 | none |
| Hilton Head Island | South Carolina | Braddock Point, Hilton Head Island (8669625) 8.8 km | SCZ148 | none |
| Hunting Island | South Carolina | Edisto Beach, Edisto Island (8667630) 19.2 km | SCZ148 | none |
| Isle of Palms Pier | South Carolina | Isle of Palms Pier (8665494) 0.1 km | SCZ150 | none |
| Kiawah Island/Seabrook Island | South Carolina | Folly Island (outer coast) (TEC3127) 15.7 km | SCZ150 | none |
| The Washout | South Carolina | Folly Island (outer coast) (TEC3127) 3.1 km | SCZ150 | none |
| Wild Dunes | South Carolina | Isle of Palms Pier (8665494) 5.4 km | SCZ150 | none |
| 21st Street | Southeast Florida | Miami Harbor Entrance (8723170) 3.1 km | FLZ173 | none |
| 40th Street | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 20.7 km | FLZ168 | none |
| 5th Street (Florida) | Southeast Florida | Miami Harbor Entrance (8723170) 0.9 km | FLZ173 | none |
| Boca Raton Inlet | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 8.8 km | FLZ168 | none |
| Commercial Pier | Southeast Florida | Lauderdale-by-the-Sea, Anglin Fishing Pier (8722899) 0.2 km | FLZ172 | none |
| Dania Pier | Southeast Florida | Hollywood Beach (8722979) 2.1 km | FLZ172 | none |
| Deerfield Beach Pier | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 6.7 km | FLZ172 | none |
| Deerfield Park Pier | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 6.6 km | FLZ172 | none |
| Dunes Hotel | Southeast Florida | Miami Harbor Entrance (8723170) 5.2 km | FLZ173 | none |
| Franklin Street | Southeast Florida | Hollywood Beach (8722979) 0.9 km | FLZ172 | none |
| Haulover | Southeast Florida | Haulover Pier, N. Miami Beach (8723080) 1.2 km | FLZ173 | none |
| Hillsboro Beach | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 4.5 km | FLZ172 | none |
| Hillsboro Inlet | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 0.2 km | FLZ172 | none |
| Japanese Rock | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 15.1 km | FLZ168 | none |
| NE 14th Ct. | Southeast Florida | Lauderdale-by-the-Sea, Anglin Fishing Pier (8722899) 4.8 km | FLZ172 | none |
| Pompano Pier | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 2.5 km | FLZ172 | none |
| Red Reef Park | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 12.2 km | FLZ168 | none |
| South Beach (Florida) | Southeast Florida | GOVERNMENT CUT, MIAMI HARBOR ENTRANCE (8723178) 0.2 km | FLZ173 | none |
| South Beach Pavillion | Southeast Florida | Hillsboro Inlet (ocean) (8722862) 11.2 km | FLZ168 | none |
| Spoils | Southeast Florida | Hollywood Beach (8722979) 6.5 km | FLZ172 | none |
| Surfside | Southeast Florida | Haulover Pier, N. Miami Beach (8723080) 2.4 km | FLZ173 | none |
| Beach Haven | Southern New Jersey | Atlantic City (Ocean) (8534720) 27.7 km | NJZ026 | none |
| Hollyoake | Southern New Jersey | Atlantic City (Ocean) (8534720) 23.6 km | NJZ026 (approx) | none |
| Holyoke | Southern New Jersey | Atlantic City (Ocean) (8534720) 26.4 km | NJZ026 | none |
| Long Beach Township | Southern New Jersey | Atlantic City (Ocean) (8534720) 29.6 km | NJZ026 | none |
| Alabama Ave., Kure Beach | Southern North Carolina | Wilmington Beach (8658559) 2.1 km | NCZ108 | none |
| C Street, Wrightsville Beach | Southern North Carolina | Wrightsville Beach (8658163) 0.8 km | NCZ108 | none |
| Camp Lejeune | Southern North Carolina | Ocean City Beach (fishing pier) (8657419) 27.9 km | NCZ199 | none |
| Carolina Beach Pier | Southern North Carolina | Wilmington Beach (8658559) 3 km | NCZ108 | none |
| Columbia Street | Southern North Carolina | Wrightsville Beach (8658163) 0.8 km | NCZ108 | none |
| Crystal Pier | Southern North Carolina | Wrightsville Beach (8658163) 2.8 km | NCZ108 | none |
| Figure Eight and Shell Islands | Southern North Carolina | Wrightsville Beach (8658163) 7.8 km | NCZ108 | none |
| Fort Fisher | Southern North Carolina | Wilmington Beach (8658559) 7.4 km | NCZ108 | none |
| Holden Beach | Southern North Carolina | Sunset Beach Pier (8659897) 19.8 km | NCZ110 | none |
| Jolly Roger Pier | Southern North Carolina | Ocean City Beach (fishing pier) (8657419) 15.5 km | NCZ106 | none |
| Longbeach | Southern North Carolina | Oak Island, Yaupon Beach (8659182) 1.2 km | NCZ110 | none |
| Masonboro Inlet | Southern North Carolina | Wrightsville Beach (8658163) 4.4 km | NCZ108 | none |
| North End Wrightsville Beach | Southern North Carolina | Wrightsville Beach (8658163) 2.6 km | NCZ108 | none |
| Oak Island | Southern North Carolina | Oak Island, Yaupon Beach (8659182) 0.3 km | NCZ110 | none |
| Ocean Isle Beach Pier | Southern North Carolina | Sunset Beach Pier (8659897) 7 km | NCZ110 | none |
| Oceanic Pier | Southern North Carolina | Wrightsville Beach (8658163) 2.7 km | NCZ108 | none |
| Onslow Beach | Southern North Carolina | Ocean City Beach (fishing pier) (8657419) 24.5 km | NCZ199 | none |
| Pelican Watch | Southern North Carolina | Wilmington Beach (8658559) 1.7 km | NCZ108 | none |
| Seaview Pier | Southern North Carolina | Ocean City Beach (fishing pier) (8657419) 10.7 km | NCZ199 | none |
| Surf City Pier | Southern North Carolina | Ocean City Beach (fishing pier) (8657419) 5.5 km | NCZ106 | none |
| The Point | Southern North Carolina | Bogue Inlet (TEC2837) 0.9 km | NCZ195 | none |
| Topsail Beach | Southern North Carolina | Ocean City Beach (fishing pier) (8657419) 2.9 km | NCZ199 | none |
| Topsail Island | Southern North Carolina | Ocean City Beach (fishing pier) (8657419) 2.5 km | NCZ199 | none |
| 16th St. South | Space Coast | Patrick Air Force Base (8721727) 5 km | FLZ747 (approx) | none |
| 2nd Light | Space Coast | Patrick Air Force Base (8721727) 0.9 km | FLZ747 | none |
| Apollo Beach | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 26.9 km | FLZ141 | none |
| Bethune | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 24.9 km | FLZ141 | none |
| Bicentennial Beach Park | Space Coast | Canova Beach (8721804) 1.8 km | FLZ747 | none |
| Bicentennial Park | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 23.5 km | FLZ141 | none |
| Bonsteel Park | Space Coast | Vero Beach (ocean) (8722105) 28 km | FLZ747 | none |
| Canova Beach | Space Coast | Canova Beach (8721804) 0.1 km | FLZ747 | none |
| Chernobyl | Space Coast | Vero Beach (ocean) (8722105) 24 km | FLZ747 | Sebastian Inlet State Park North Jetty, FL 1.1 km |
| Cocoa Beach | Space Coast | Cocoa Beach (8721649) 0.1 km | FLZ747 | none |
| Coconut Point Park | Space Coast | Canova Beach (8721804) 13.5 km | FLZ747 (approx) | none |
| Daytona Beach | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 8.9 km | FLZ141 | none |
| Flager Avenue | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 13.9 km | FLZ141 | none |
| Fort Pierce North Jetty | Space Coast | Fort Pierce Inlet, south jetty (8722212) 0.6 km | FLZ159 (approx) | none |
| Hightower Beach | Space Coast | Patrick Air Force Base (8721727) 5.7 km | FLZ747 | none |
| Jetty Park | Space Coast | Port Canaveral (Trident Pier) (8721604) 1.1 km | FLZ447 | 8721604 - Trident Pier, FL 1.1 km |
| Lori Wilson Park | Space Coast | Cocoa Beach (8721649) 3.5 km | FLZ747 | none |
| Main Street Pier | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 9.8 km | FLZ141 | none |
| Melbourne Beach | Space Coast | Canova Beach (8721804) 8 km | FLZ747 | none |
| Minuteman | Space Coast | Cocoa Beach (8721649) 5.6 km | FLZ747 | none |
| Monster Hole | Space Coast | Vero Beach (ocean) (8722105) 22.6 km | FLZ154 | Sebastian Inlet State Park North Jetty, FL 0.5 km |
| New Smyrna Beach | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 10.2 km | FLZ141 | none |
| Ormond Beach Pier | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 17.8 km | FLZ141 | none |
| P.V. Martin's | Space Coast | Fort Pierce Inlet, south jetty (8722212) 6.2 km | FLZ159 | none |
| Paradise Beach | Space Coast | Canova Beach (8721804) 1.7 km | FLZ747 | none |
| Patrick Air Force Base | Space Coast | Patrick Air Force Base (8721727) 0.3 km | FLZ747 | none |
| Pelican Beach Park | Space Coast | Canova Beach (8721804) 3.4 km | FLZ747 | none |
| Perkins | Space Coast | Patrick Air Force Base (8721727) 4.9 km | FLZ747 | none |
| Picnic Tables | Space Coast | Patrick Air Force Base (8721727) 2.5 km | FLZ747 (approx) | none |
| Playalinda | Space Coast | Cape Canaveral (TEC3693) 24.1 km | FLZ447 | none |
| Ponce De Leon Park | Space Coast | Canova Beach (8721804) 15 km | FLZ747 (approx) | none |
| Ponce Inlet | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 8.7 km | FLZ141 (approx) | none |
| Riomar Reef | Space Coast | Vero Beach (ocean) (8722105) 3.1 km | FLZ154 | none |
| Satellite Beach/ RCs | Space Coast | Canova Beach (8721804) 4.8 km | FLZ747 | none |
| Sebastian Inlet | Space Coast | Vero Beach (ocean) (8722105) 23 km | FLZ747 | Sebastian Inlet State Park North Jetty, FL 0.1 km |
| Shepard Park | Space Coast | Cocoa Beach (8721649) 1.2 km | FLZ747 | none |
| Spanish House | Space Coast | Vero Beach (ocean) (8722105) 24.8 km | FLZ747 | Sebastian Inlet State Park North Jetty, FL 1.9 km |
| Spessard Holland | Space Coast | Canova Beach (8721804) 10.5 km | FLZ747 (approx) | none |
| Sunglow Pier | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 0.1 km | FLZ141 (approx) | none |
| The Boardwalk | Space Coast | Canova Beach (8721804) 5.3 km | FLZ747 | none |
| The Inlet (New Smyrna) | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 10 km | FLZ141 | none |
| The Radisson | Space Coast | Canova Beach (8721804) 0.4 km | FLZ747 | none |
| Vero Beach Pier | Space Coast | Vero Beach (ocean) (8722105) 1.7 km | FLZ154 | none |
| Vero Pier | Space Coast | Vero Beach (ocean) (8722105) 0 km | FLZ154 | none |
| Wabasso | Space Coast | Vero Beach (ocean) (8722105) 11 km | FLZ154 | none |
| Wilbur By The Sea | Space Coast | Daytona Beach Shores, Sunglow Pier (8721120) 1.6 km | FLZ141 (approx) | none |
| Blind Creek Park | Treasure Coast | Fort Pierce Inlet, south jetty (8722212) 12.3 km | FLZ159 | none |
| Blue Heron Beach | Treasure Coast | Fort Pierce Inlet, south jetty (8722212) 4.2 km | FLZ159 | none |
| Fletcher's | Treasure Coast | Seminole Shores (8722366) 2.7 km | FLZ164 | none |
| Jensen Beach | Treasure Coast | Seminole Shores (8722366) 8.7 km | FLZ164 | none |
| Stuart Public Beach | Treasure Coast | Seminole Shores (8722366) 3.8 km | FLZ164 | none |
| Stuart Rocks | Treasure Coast | Seminole Shores (8722366) 0.9 km | FLZ164 (approx) | none |
| Walton Rocks | Treasure Coast | Fort Pierce Inlet, south jetty (8722212) 15.5 km | FLZ159 (approx) | none |
| Walton Rocks | Treasure Coast | Fort Pierce Inlet, south jetty (8722212) 15.6 km | FLZ159 (approx) | none |
| 1st Street Jetty | Virginia | Virginia Beach (8639168) 1.4 km | VAZ098 | none |
| Camp Pendleton | Virginia | Virginia Beach (8639168) 3 km | VAZ098 | none |
| Camp Pendleton | Virginia | Virginia Beach (8639168) 6.2 km | VAZ098 | none |
| Croatan | Virginia | Virginia Beach (8639168) 1.6 km | VAZ098 | none |
| Croatan to Pendleton | Virginia | Virginia Beach (8639168) 2.8 km | VAZ098 | none |
| Little Island Fishing Pier | Virginia | Sandbridge (8639428) 0.4 km | VAZ098 | none |
| Sandbridge Beach | Virginia | Sandbridge (8639428) 5.3 km | VAZ098 | none |
| South End | Virginia | Virginia Beach (8639168) 0 km | VAZ098 | none |
| Virginia Beach | Virginia | Virginia Beach (8639168) 0.3 km | VAZ098 | none |

## Dropped from the first list (45)

| Spot | State | Reason |
|---|---|---|
| 1st Beach (Eastons Beach) | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| 2nd Beach (Sachuest Beach) | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Abels Hill | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Bailey's Beach | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Bonnet Point | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Brant Rock | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Canadian Hole | North Carolina | sound-side (Kite Point, Canadian Hole face the Pamlico Sound) |
| Cape Cod | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Chandy's | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Coastguard Beach | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Fieldstone | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Fishermans Island | Virginia | its only live buoy within 50 km is a sheltered bay buoy |
| Fishermans Island | Virginia | its only live buoy within 50 km is a sheltered bay buoy |
| Goosewing Beach | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Green Harbor (Duxberry) | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Greenhill | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Head of the Meadow Beach | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| K38/39 | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Keyes Memorial Beach | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Kite Point | North Carolina | sound-side (Kite Point, Canadian Hole face the Pamlico Sound) |
| Lighthouse | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Lighthouse Southside | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Long Point | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Longnook to Ballston Beach | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Lucy Vincent | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Maguire Landing Beach | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Marconis | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Marshfield Jetty | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Matanuck | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Matunuck | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Monahan's Dock | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Narragansett Beach | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Nauset Beach | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Nauset Light Beach | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Newcombs Hollow to Lecounts Hollow | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| North End | Virginia | its only live buoy within 50 km is a sheltered bay buoy |
| Pilgrim Avenue | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Plymouth Beach | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Point Judith | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Rexhame | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Ruggles | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Sakonnet | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| Scarborough | Rhode Island | its only live buoy within 50 km is a sheltered bay buoy |
| South Beach State Park | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
| Squibnocket | Massachusetts | its only live buoy within 50 km is a sheltered bay buoy |
