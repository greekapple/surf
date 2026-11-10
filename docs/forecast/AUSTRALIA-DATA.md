# Australia data map (round 3, section 3E)

This is a study, so nothing is wired. Every number below comes from a live fetch made on 2026-11-10 between 04:10 and 04:35 UTC (2026-11-09 evening in California). The per-spot table is in `docs/forecast/data/australia-sources.json`, the wiring proposal is in `docs/specs/DRAFT-australia-wiring.md`, and the vault notes are `Data-Sources/Australia-Data.md` and `Src-AODN-Wave-Buoys.md`.

Rules followed: public pages and keyless APIs only, no logins, no terms accepted, about 1 request per second per host, User-Agent "SWELLO surf forecast prototype". No value here is estimated. Anything that could not be confirmed is marked as unconfirmed.

## Summary
| Need | Verdict |
|---|---|
| Waves (buoys) | **Usable.** AODN THREDDS lists 135 realtime buoy folders. 72 had a record within 24 h of the fetch, and 50 of those are on the open coast. Licence: CC BY 4.0 on every file. Lag median 1.75 h (0.76–4.65 h for every owner except WA DoT, whose four oldest buoys were 7.5–22.5 h behind). There is no swell/sea split in any realtime file. The realtime QC flag reads 2 = "not_evaluated" on every row we saw. |
| Tides (predictions) | **BoM: not permitted** for display by a third party under the default terms. **Queensland: permitted** (TMR predicted high/low, CC BY 4.0, keyless CKAN datastore API). There is no open-licensed prediction feed for NSW, VIC, SA, WA or TAS. |
| Model (Open-Meteo Marine) | **All 337 spots return data** at both the 2 km seaward point and the app's own ~9 km marine point. Zero land cells. Two beach pins alone return all-null: Asling Beach and Scotts Head. |
| Wind (METAR) | IEM network `AU__ASOS` is the real id. It lists 108 stations; 57 had a METAR within 6 h. The median nearest-airport distance is 41 km. 78 spots are over 80 km from an airport with live METARs. |

## 1. Waves: AODN/IMOS THREDDS realtime wave buoys

### How it is served
- THREDDS root: `https://thredds.aodn.org.au/thredds/catalog/catalog.xml`. The realtime wave folders are `<OWNER>/WAVE-BUOYS/REALTIME/WAVE-PARAMETERS/<SITE>/<YYYY>/<FILE>` for these owners:
  - `IMOS/COASTAL-WAVE-BUOYS`
  - `Bureau_of_Meteorology`
  - `Deakin_University`
  - `Department_for_Environment_and_Water-South_Australia`
  - `Department_of_Environment_and_Science-Queensland`
  - `Department_of_Planning_and_Environment-New_South_Wales` (NSW Nearshore Wave Data Program)
  - `Department_of_Planning_and_Environment-New_South_Wales/Manly_Hydraulics_Laboratory`
  - `Department_of_Transport-Western_Australia`
  - `Flinders_University`
  - `Gippsland-Ports-Victoria`
  - `Pilbara_Ports_Authority`
  - `UWA`

  SARDI, UNSW and NSW-OEH have no realtime wave folder.
- One NetCDF file per month. The file name prefix differs by owner: `IMOS_COASTAL-WAVE-BUOYS_`, `MHL_`, `BOM_`, `DES-QLD_`, `DOT-WA_`, `UWA_`, … The start day is not always 01 (Rottnest's current file is `DOT-WA_20261102_ROTTNEST-ISLAND_RT_WAVE-PARAMETERS_monthly.nc`), so the newest file has to be resolved from the year folder's `catalog.xml`.
- Endpoint pattern (the same NCSS point shape as CDIP):
  `https://thredds.aodn.org.au/thredds/ncss/point/<urlPath>?var=<VARS>&time_start=<ISO>&time_end=<ISO>&accept=csv`
- The CSV header is `time,latitude[unit="degrees_north"],longitude[unit="degrees_east"],<VAR>[unit=...],...`. There is no station-name column, so columns can be read by name.
- Also available: the cloud-optimised Parquet copy `s3://aodn-cloud-optimised/wave_buoy_realtime_nonqc.parquet` (AWS Open Data registry entry "Wave buoys observations - Real time").

### Variables
- **Datawell Waverider networks** (MHL, BoM, QLD DES, WA DoT, Gippsland Ports): `WHTH` (significant height, zero-crossing), `WMXH` (max height), `WPPE` (peak period), `WPDI` (peak direction, from), `WPDS` (directional spread at peak) and `WAVE_quality_control`. BoM also has `WPMH`. Pilbara has `WHTH, WPPE, WPDI, SSWMD`.
- **Sofar Spotter networks** (IMOS, NSW DPE, UWA, Deakin, Flinders, SA DEW): `WSSH` ("sea surface wave spectral significant height"), `WPPE`, `WPFM` (spectral mean period), `WPDI`, `WPDS`, `SSWMD` (spectral mean direction), `WMDS` (mean directional spread) and `WAVE_quality_control`.
- **Swell/sea split: none.** No realtime file carries swell or wind-sea partitions (no SWSH/WWSH-type variables). SWELLO's primary/secondary swell would still come from the model.
- **QC:** `WAVE_quality_control` flag_meanings are "good not_evaluated questionable bad missing" (1, 2, 3, 4, 9). Every row in the three test fetches was 2 (not_evaluated). Label it "realtime, not quality-controlled".
- **Fill trap (QLD DES):** Gold Coast rows at :30 carry `WPPE=0.0, WPDI=0.0, WPDS=0.0, WMXH=0.0` beside a real `WHTH`. Those zeros are not measurements and must be read as missing.

### Update rate and lag (measured)
Lag = fetch time minus the newest row's time, per buoy (the 3-day NCSS query made at that moment).
- MHL (NSW): hourly rows, lag 2.47 h on all 7.
- QLD DES: 30-min rows, lag 1.91–1.96 h.
- IMOS Spotters: lag 1.01–1.89 h, except North Kangaroo Island at 4.65 h.
- BoM (Cape du Couedic, Cape Sorell): 0.93 h. Gippsland Ports (Lakes Entrance): 0.76 h.
- **WA DoT: 3-hourly rows, and intermittent.** Rottnest 1.49 h and Albany 4.48 h, but Esperance 7.48 h, Cottesloe 10.48 h, Mandurah 13.48 h, Jurien 19.48 h and Cape Naturaliste 22.48 h. Cape Naturaliste returned 1 row in the last 26 h. This is the Margaret River reference buoy, so the reader must show its age.
- The AWS registry gives the publishing cadence: BoM's collated CSV (BoM, DES, DOT, MHL, some IMOS, Gippsland) "updated every hour, at 5 minutes past the hour"; IMOS (some), DPE, UWA, Deakin, Flinders and SARDI "every hour, at 40 minutes past the hour"; Pilbara "at 30 minutes past the hour".

### Licence and attribution
- Every file's `license` attribute is `http://creativecommons.org/licenses/by/4.0/`. The AWS registry entry also gives `License: http://creativecommons.org/licenses/by/4.0/`.
- Required acknowledgement (file attribute `acknowledgement`, IMOS files, verbatim): "Any users of IMOS data are required to clearly acknowledge the source of the material in the format: "Data was sourced from Australia's Integrated Marine Observing System (IMOS) - IMOS is enabled by the National Collaborative Research Infrastructure Strategy (NCRIS)"". BoM-owned files carry the same sentence, opening "Any users of data are required…".
- Citation (BoM file `citation`): "Australian Ocean Data Network (AODN). [year-of-datadownload], [Title], [Data access URL], accessed [dateof-access]". The AWS registry citation lists every contributor: "Department of Transport [W.A]; State of Queensland, Department of Environment and Science; Australian Bureau of Meteorology; Department of Planning and Environment (DPE), New South Wales Government; Gippsland Ports; Integrated Marine Observing System; University of Western Australia (UWA); Deakin University, Pilbara Ports Authority, Flinders University and South Australian Research and Development Institute (SARDI) [year-of-data-download], [Title], [data-access-URL], accessed [date-of-access]."
- Disclaimer (file attribute): "Data, products and services from IMOS are provided "as is" without any warranty as to fitness for a particular purpose."
- **MHL conflict to note:** the MHL website's copyright page (https://www.mhl.nsw.gov.au/Copyright) says "The Data is protected by Crown copyright and may be reproduced only with written permission." Data.NSW lists MHL's "Coastal Water Monitoring" as Creative Commons Attribution, and the AODN files for MHL buoys carry CC BY 4.0. SWELLO would read the AODN copy under its stated CC BY 4.0. One confirming email to MHL is advisable before a public launch.

### Test fetches (3 buoys plus Rottnest), 2026-11-10
Query: `var=WHTH,WPPE,WPDI,WPDS,WMXH,WAVE_quality_control`, last 26 h.
- **NSW, MHL SYDNEY** (-33.750, 151.400), fetched 04:32:06Z, 21 rows. Latest `2026-11-10T02:00:00Z, WHTH 2.23 m, WPPE 11.4 s, WPDI 148°, WPDS 18°, WMXH 4.17 m, QC 2`. Previous: 01:00Z 2.34 m / 11.4 s / 148°; 00:00Z 2.31 m / 12.1 s / 156°.
- **QLD, DES GOLD-COAST** (-27.970, 153.450), fetched 04:32:05Z, 32 rows. Latest `2026-11-10T02:30:00Z, WHTH 0.97 m, WPPE 0.0, WPDI 0.0, WPDS 0.0, WMXH 0.0, QC 2` (the zeros are fill). The last full row is `02:00:00Z, WHTH 1.02 m, WPPE 10.5 s, WPDI 132°, WPDS 16°, WMXH 1.97 m`.
- **WA, DoT CAPE-NATURALISTE** (-33.530, 114.770), fetched 04:32:08Z, **1 row in 26 h**: `2026-11-09T06:00:00Z, WHTH 2.9 m, WPPE 14.4 s, WPDI 244°, WPDS 13°, WMXH 5.2 m, QC 2` (22.5 h old).
- **WA, DoT ROTTNEST-ISLAND** (-32.100, 115.400), fetched 04:32:09Z, 4 rows, 3-hourly. Latest `2026-11-10T03:00:00Z, WHTH 1.8 m, WPPE 12.8 s, WPDI 252°, WPDS 17°, WMXH 3.09 m`.

### Every realtime buoy reporting within 24 h of its fetch (72)
"Water" is a judgement from the buoy's position: a buoy in a bay, gulf, sound or reef lagoon is not open-coast swell and is never used as a spot's open-coast context.

| Buoy (folder site) | Owner | Lat, lon | Height variable | Latest (UTC) | Lag at fetch (h) | Water |
|---|---|---|---|---|---|---|
| CAPE-DU-COUEDIC | Bureau of Meteorology | -36.07, 136.62 | WHTH (zero-crossing) | 2026-11-10T03:30:00Z | 0.93 | open coast |
| CAPE-SORELL | Bureau of Meteorology | -42.2, 145.05 | WHTH (zero-crossing) | 2026-11-10T03:30:00Z | 0.93 | open coast |
| DUTTON-WAY | Deakin University | -38.319, 141.657 | WSSH (spectral) | 2026-11-10T02:45:00Z | 1.62 | open coast |
| INDENTED-HEAD | Deakin University | -38.135, 144.752 | WSSH (spectral) | 2026-11-10T03:10:00Z | 1.2 | Port Phillip Bay |
| INVERLOCH | Deakin University | -38.761, 145.774 | WSSH (spectral) | 2026-11-10T03:05:00Z | 1.29 | open coast |
| MT-ELIZA | Deakin University | -38.163, 145.053 | WSSH (spectral) | 2026-11-10T03:00:00Z | 1.38 | Port Phillip Bay |
| PORT-FAIRY | Deakin University | -38.381, 142.286 | WSSH (spectral) | 2026-11-10T02:55:00Z | 1.47 | open coast |
| ROSEBUD | Deakin University | -38.301, 144.872 | WSSH (spectral) | 2026-11-10T02:55:00Z | 1.47 | Port Phillip Bay |
| SANDRINGHAM | Deakin University | -37.979, 144.998 | WSSH (spectral) | 2026-11-10T02:45:00Z | 1.64 | Port Phillip Bay |
| WEEROONA-BAY | Deakin University | -38.316, 144.712 | WSSH (spectral) | 2026-11-10T03:15:00Z | 1.15 | Port Phillip Bay |
| WERRIBEE | Deakin University | -37.981, 144.776 | WSSH (spectral) | 2026-11-10T03:05:00Z | 1.31 | Port Phillip Bay |
| VICTOR-HARBOR-OFFSHORE | Flinders University | -35.607, 138.636 | WSSH (spectral) | 2026-11-10T03:10:19Z | 1.35 | open coast |
| LAKES-ENTRANCE | Gippsland Ports | -37.9, 147.97 | WHTH (zero-crossing) | 2026-11-10T03:40:00Z | 0.76 | open coast |
| APOLLO-BAY | IMOS Coastal Wave Buoys | -38.754, 143.722 | WSSH (spectral) | 2026-11-10T02:55:00Z | 1.44 | open coast |
| BENGELLO | IMOS Coastal Wave Buoys | -35.879, 150.16 | WSSH (spectral) | 2026-11-10T03:20:00Z | 1.03 | open coast |
| BOB | IMOS Coastal Wave Buoys | -38.642, 142.309 | WSSH (spectral) | 2026-11-10T02:40:00Z | 1.69 | open coast |
| BRIGHTON | IMOS Coastal Wave Buoys | -35.027, 138.451 | WSSH (spectral) | 2026-11-10T02:50:00Z | 1.53 | Gulf St Vincent |
| BUNBURY | IMOS Coastal Wave Buoys | -33.334, 115.401 | WSSH (spectral) | 2026-11-10T03:05:00Z | 1.28 | open coast |
| CAPE-BRIDGEWATER | IMOS Coastal Wave Buoys | -38.36, 141.272 | WSSH (spectral) | 2026-11-10T02:35:00Z | 1.78 | open coast |
| CEDUNA | IMOS Coastal Wave Buoys | -32.349, 133.648 | WSSH (spectral) | 2026-11-10T03:00:00Z | 1.37 | open coast |
| CENTRAL | IMOS Coastal Wave Buoys | -38.063, 144.866 | WSSH (spectral) | 2026-11-10T03:20:00Z | 1.03 | Port Phillip Bay |
| COLLAROY-NARRABEEN | IMOS Coastal Wave Buoys | -33.726, 151.306 | WSSH (spectral) | 2026-11-10T02:40:00Z | 1.71 | open coast |
| CORAL-BAY-02 | IMOS Coastal Wave Buoys | -23.154, 113.737 | WSSH (spectral) | 2026-11-10T02:50:00Z | 1.55 | open coast |
| HILLARYS | IMOS Coastal Wave Buoys | -31.851, 115.646 | WSSH (spectral) | 2026-11-10T02:30:00Z | 1.89 | open coast |
| MANINGRIDA | IMOS Coastal Wave Buoys | -11.955, 134.308 | WSSH (spectral) | 2026-11-10T02:55:00Z | 1.48 | open coast |
| MISSION-BEACH | IMOS Coastal Wave Buoys | -17.972, 146.191 | WSSH (spectral) | 2026-11-10T02:35:00Z | 1.81 | Great Barrier Reef lagoon |
| NORTH-KANGAROO-ISLAND | IMOS Coastal Wave Buoys | -35.744, 136.636 | WSSH (spectral) | 2026-11-09T23:45:00Z | 4.65 | Investigator Strait |
| OCEAN-BEACH | IMOS Coastal Wave Buoys | -35.048, 117.363 | WSSH (spectral) | 2026-11-10T02:40:00Z | 1.73 | open coast |
| SHARK-BAY-02 | IMOS Coastal Wave Buoys | -25.494, 113.102 | WSSH (spectral) | 2026-11-10T02:30:00Z | 1.91 | open coast |
| TANTABIDDI | IMOS Coastal Wave Buoys | -21.893, 113.928 | WSSH (spectral) | 2026-11-10T02:40:00Z | 1.75 | open coast |
| TORBAY-WEST | IMOS Coastal Wave Buoys | -35.068, 117.768 | WSSH (spectral) | 2026-11-10T02:35:00Z | 1.84 | open coast |
| WILSONS-PROM | IMOS Coastal Wave Buoys | -39.544, 146.462 | WSSH (spectral) | 2026-11-10T02:50:00Z | 1.59 | open coast |
| WOOLI | IMOS Coastal Wave Buoys | -29.857, 153.313 | WSSH (spectral) | 2026-11-10T03:25:00Z | 1.01 | open coast |
| BATEMANS-BAY | Manly Hydraulics Laboratory (NSW DPE) | -35.75, 150.32 | WHTH (zero-crossing) | 2026-11-10T02:00:00Z | 2.47 | open coast |
| BYRON-BAY | Manly Hydraulics Laboratory (NSW DPE) | -28.87, 153.68 | WHTH (zero-crossing) | 2026-11-10T02:00:00Z | 2.47 | open coast |
| COFFS-HARBOUR | Manly Hydraulics Laboratory (NSW DPE) | -30.35, 153.28 | WHTH (zero-crossing) | 2026-11-10T02:00:00Z | 2.47 | open coast |
| CROWDY-HEAD | Manly Hydraulics Laboratory (NSW DPE) | -31.82, 152.85 | WHTH (zero-crossing) | 2026-11-10T02:00:00Z | 2.47 | open coast |
| EDEN | Manly Hydraulics Laboratory (NSW DPE) | -37.27, 150.2 | WHTH (zero-crossing) | 2026-11-10T02:00:00Z | 2.47 | open coast |
| PORT-KEMBLA | Manly Hydraulics Laboratory (NSW DPE) | -34.47, 151.03 | WHTH (zero-crossing) | 2026-11-10T02:00:00Z | 2.47 | open coast |
| SYDNEY | Manly Hydraulics Laboratory (NSW DPE) | -33.75, 151.4 | WHTH (zero-crossing) | 2026-11-10T02:00:00Z | 2.47 | open coast |
| TATHRA | NSW Department of Planning and Environment (NSW Nearshore Wave Data Program) | -36.708, 150.001 | WSSH (spectral) | 2026-11-10T02:45:00Z | 1.71 | open coast |
| ALBATROSS-BAY | Queensland Department of Environment and Science | -12.68, 141.68 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.91 | Gulf of Carpentaria |
| BUNDABERG | Queensland Department of Environment and Science | -24.67, 152.5 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.92 | open coast |
| CALOUNDRA | Queensland Department of Environment and Science | -26.85, 153.15 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.93 | open coast |
| EMU-PARK | Queensland Department of Environment and Science | -23.3, 151.07 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.93 | Keppel Bay |
| GLADSTONE | Queensland Department of Environment and Science | -23.9, 151.5 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.93 | Port Curtis approaches, inside the southern Great Barrier Reef |
| GOLD-COAST | Queensland Department of Environment and Science | -27.97, 153.45 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.93 | open coast |
| MOOLOOLABA | Queensland Department of Environment and Science | -26.57, 153.18 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.94 | open coast |
| NORTH-MORETON-BAY | Queensland Department of Environment and Science | -26.9, 153.28 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.94 | open coast |
| PALM-BEACH | Queensland Department of Environment and Science | -28.1, 153.48 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.94 | open coast |
| SKARDON-RIVER-OUTER | Queensland Department of Environment and Science | -11.75, 141.83 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.95 | Gulf of Carpentaria |
| TOWNSVILLE | Queensland Department of Environment and Science | -19.18, 147.08 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.95 | Great Barrier Reef lagoon |
| TWEED-HEADS | Queensland Department of Environment and Science | -28.18, 153.58 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.95 | open coast |
| TWEED-OFFSHORE | Queensland Department of Environment and Science | -28.22, 153.68 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.95 | open coast |
| WIDE-BAY | Queensland Department of Environment and Science | -25.77, 153.2 | WHTH (zero-crossing) | 2026-11-10T02:30:00Z | 1.96 | open coast |
| BLACK-POINT | SA Department for Environment and Water | -34.138, 138.093 | WSSH (spectral) | 2026-11-10T03:05:00Z | 1.32 | Gulf St Vincent |
| SPILSBY-SOUTH | SA Department for Environment and Water | -34.808, 136.43 | WSSH (spectral) | 2026-11-10T02:40:00Z | 1.75 | Spencer Gulf |
| COCKBURN-SOUND | University of Western Australia | -32.141, 115.689 | WSSH (spectral) | 2026-11-10T02:50:00Z | 1.53 | Cockburn Sound |
| CYGNET-BAY | University of Western Australia | -16.5, 123.034 | WSSH (spectral) | 2026-11-10T02:55:00Z | 1.45 | King Sound area |
| EXMOUTH-GULF-EAST | University of Western Australia | -21.688, 114.587 | WSSH (spectral) | 2026-11-10T02:45:00Z | 1.62 | Exmouth Gulf |
| EXMOUTH-GULF-NORTH | University of Western Australia | -21.804, 114.264 | WSSH (spectral) | 2026-11-10T03:20:00Z | 1.04 | Exmouth Gulf |
| EXMOUTH-GULF-SOUTH | University of Western Australia | -22.168, 114.337 | WSSH (spectral) | 2026-11-10T02:35:00Z | 1.79 | Exmouth Gulf |
| JURIEN-BAY-INSHORE | University of Western Australia | -30.314, 114.961 | WSSH (spectral) | 2026-11-10T02:45:00Z | 1.64 | open coast |
| JURIEN-BAY-OFFSHORE | University of Western Australia | -30.314, 114.922 | WSSH (spectral) | 2026-11-10T02:45:00Z | 1.64 | open coast |
| QUINNS-DOG-BEACH | University of Western Australia | -31.659, 115.664 | WSSH (spectral) | 2026-11-10T02:40:00Z | 1.73 | open coast |
| ALBANY | WA Department of Transport | -35.2, 117.72 | WHTH (zero-crossing) | 2026-11-10T00:00:00Z | 4.48 | open coast |
| CAPE-NATURALISTE | WA Department of Transport | -33.53, 114.77 | WHTH (zero-crossing) | 2026-11-09T06:00:00Z | 22.48 | open coast |
| COTTESLOE | WA Department of Transport | -31.98, 115.68 | WHTH (zero-crossing) | 2026-11-09T18:00:00Z | 10.48 | open coast |
| ESPERANCE | WA Department of Transport | -34.0, 121.9 | WHTH (zero-crossing) | 2026-11-09T21:00:00Z | 7.48 | open coast |
| JURIEN | WA Department of Transport | -30.3, 114.92 | WHTH (zero-crossing) | 2026-11-09T09:00:00Z | 19.48 | open coast |
| MANDURAH | WA Department of Transport | -32.45, 115.57 | WHTH (zero-crossing) | 2026-11-09T15:00:00Z | 13.48 | open coast |
| ROTTNEST-ISLAND | WA Department of Transport | -32.1, 115.4 | WHTH (zero-crossing) | 2026-11-10T03:00:00Z | 1.49 | open coast |

Not reporting within 24 h (latest file end):
APOLLO-BAY (Deakin University, 2024-12-14), CAPE-BRIDGEWATER (Deakin University, 2024-12-08), CENTRAL (Deakin University, 2025-08-14), INDENTEDHEAD (Deakin University, 2024-12-06), INVERLOCH-INSHORE (Deakin University, 2023-06-08), LAKES-ENTRANCE (Deakin University, 2022-09-17), ROSEBUD-02 (Deakin University, 2025-12-16), WARATAH-BAY (Deakin University, 2026-08-08), WILSONS-PROM (Deakin University, 2024-11-25), BRIGHTON (Flinders University, 2023-12-05), KANGAROO-ISLAND (Flinders University, 2024-02-22), ROBE-GUICHEN-BAY (Flinders University, 2026-07-03), ROBE-INSHORE (Flinders University, 2024-07-24), ROBE-OFFSHORE (Flinders University, 2024-07-31), SEMAPHORE (Flinders University, 2023-09-28), VICTOR-HARBOR-INSHORE (Flinders University, 2026-06-04), AUGUSTA-OFFSHORE (IMOS Coastal Wave Buoys, 2026-09-30), COLLAROY (IMOS Coastal Wave Buoys, 2025-07-29), CORAL-BAY (IMOS Coastal Wave Buoys, 2025-07-30), CORAL-BAY-0-2 (IMOS Coastal Wave Buoys, 2025-08-21), FENTON-PATCHES (IMOS Coastal Wave Buoys, 2026-07-31), GOODRICH-BANK (IMOS Coastal Wave Buoys, 2026-05-30), KARUMBA (IMOS Coastal Wave Buoys, 2026-05-11), ROBE (IMOS Coastal Wave Buoys, 2026-05-31), SHARK-BAY (IMOS Coastal Wave Buoys, 2025-05-15), SHARK-BAY-0-2 (IMOS Coastal Wave Buoys, 2025-08-21), STORM-BAY (IMOS Coastal Wave Buoys, 2026-11-06), TATHRA (IMOS Coastal Wave Buoys, 2026-07-09), BELONGIL (NSW Department of Planning and Environment, 2024-11-30), BENGELLO (NSW Department of Planning and Environment, 2026-08-27), BOAMBEE (NSW Department of Planning and Environment, 2025-03-06), BYRON (NSW Department of Planning and Environment, 2025-01-24), COLLAROY (NSW Department of Planning and Environment, 2024-10-16), CROWDY (NSW Department of Planning and Environment, 2026-10-10), CROWDY-HEAD (NSW Department of Planning and Environment, 2024-10-16), DEEBAN (NSW Department of Planning and Environment, 2024-11-07), STOCKTON (NSW Department of Planning and Environment, 2025-10-20), STOCKTON-WHALE-SAFE (NSW Department of Planning and Environment, 2025-11-28), WOOLI (NSW Department of Planning and Environment, 2025-04-23), ASHBURTON (Pilbara Ports Authority, 2023-11-23), DAMPIER (Pilbara Ports Authority, 2024-07-10), PORT-HEDLAND (Pilbara Ports Authority, 2024-07-10), BRISBANE (Queensland Department of Environment and Science, 2023-11-20), CAIRNS (Queensland Department of Environment and Science, 2024-05-06), HAY-POINT (Queensland Department of Environment and Science, 2023-07-30), MACKAY (Queensland Department of Environment and Science, 2023-12-10), SKARDON-RIVER-OFFSHORE (Queensland Department of Environment and Science, 2025-08-11), NORTH-HAVEN (SA Department for Environment and Water, 2026-09-20), SEMAPHORE (SA Department for Environment and Water, 2026-10-16), WEST-BEACH (SA Department for Environment and Water, 2026-10-22), AUGUSTA-OFFSHORE (University of Western Australia, 2026-09-30), CABLE-BEACH (University of Western Australia, 2026-10-30), COCOS-LAGOON (University of Western Australia, 2026-01-17), DONGARA-INSHORE (University of Western Australia, 2026-11-07), DONGARA-OFFSHORE (University of Western Australia, 2026-11-07), FLOREAT (University of Western Australia, 2025-12-10), HILLARYS (University of Western Australia, 2024-05-02), KING-GEORGE-SOUND (University of Western Australia, 2024-10-17), MIDDLETON-BEACH (University of Western Australia, 2026-06-22), OCEAN-BEACH (University of Western Australia, 2024-12-06), SALMON-HOLES (University of Western Australia, 2022-10-18), TANTABIDDI (University of Western Australia, 2025-01-08), TORBAY-WEST (University of Western Australia, 2022-10-18)

Every owner's files (all 12 checked) carry the IMOS sentence in `acknowledgement`. Two owners add their own wording:
- NSW DPE (Nearshore Wave Data Program): "NSW wave data sourced from IMOS were collected, processed and provided by the NSW Nearshore Wave Data Program operated by the NSW Department of Climate Change, Energy, the Environment and Water".
- UWA and Deakin: "This dataset is an output from the Catching Oz Waves project, which received investment (https://doi.org/10.47486/DP748) from the Australian Research Data Commons (ARDC)…".

The full per-owner text is in `australia-sources.json` → `buoys[].acknowledgement`.

### Coverage per region (nearest open-coast buoy reporting within 24 h)
| Region | Spots | Median km | Max km | Spots within 50 km |
|---|---|---|---|---|
| New South Wales | 184 | 28.1 | 569.0 (Lord Howe Island) | 134 |
| Queensland | 27 | 8.3 | 22.7 | 27 |
| Victoria | 36 | 61.8 | 97.3 | 11 |
| Western Australia | 52 | 41.7 | 269.8 | 30 |
| South Australia | 24 | 69.4 | 121.9 | 7 |
| Tasmania | 14 | 225.2 | 254.4 | 0 |

- No open-coast buoy within 150 km: 32 spots. These are the 10 Lord Howe Island spots, the 14 Tasmanian spots and 8 in WA (Blue Holes, Jakes, Bowes River, Coronation, Drummonds, Hells Gate, Sunset Beach, Tarcoola; nearest live open buoy Jurien or Shark Bay at 169–270 km).
  - Tasmania's Storm Bay buoy (IMOS) last reported 2026-11-06, so the Hobart-area spots fall back to Cape Sorell on the west coast, about 220 km away. That buoy is not representative of them.
- For 38 spots a sheltered buoy is nearer than the nearest open-coast one. Port Phillip Bay (Weeroona Bay 15, Rosebud 10), Gulf St Vincent (Brighton 4), Spencer Gulf (Spilsby 4), Exmouth Gulf (3) and Investigator Strait (2). The JSON records them in `shelteredBuoyNearer`, and they are not used as context.
- 36 distinct open-coast buoys sit within 150 km of at least one spot. That number is the fetch budget for wiring.

### State networks
- **Manly Hydraulics Laboratory (NSW):** the 7 MHL buoys are on AODN (above). MHL also has a JSON API (`https://api.manly.hydraulics.works/api/1.2/readings/latest/<station>?username=publicwww`), already used in the catalogue's `nearestSources`. I did not re-fetch it in this study. Licence: the MHL site says Crown copyright, written permission required; Data.NSW says CC BY. Use the AODN copy, not the MHL API.
- **Queensland DES waves:** `https://apps.des.qld.gov.au/data-sets/waves/wave-7dayopdata.csv` returned HTTP 200, 1.18 MB, "Wave Data provided @ 14:00hrs on 10-11-2026".
  - 27 sites, 30-min rows, columns `Site, SiteNumber, Seconds, DateTime, Latitude, Longitude, Hs, Hmax, Tp, Tz, SST, Direction, Current Speed, Current Direction`.
  - `DateTime` is AEST: Gold Coast Mk4's `2026-11-10T12:30:00` row has `Seconds` 1794277800 = 02:30Z.
  - Latest Gold Coast Mk4 row: Hs 0.970 m, Hmax 1.620 m, Tp 11.110 s, Tz 4.830 s, SST 22.63, Direction 133.71°. That is the same buoy as the AODN GOLD-COAST record (0.97 m at 02:30Z).
  - Licence CC BY 4.0 (CKAN). It duplicates the AODN QLD feed, with Tz and SST added and without the 0.0 fill. Either feed works for QLD.

## 2. Tides: public Australian tide predictions

### Bureau of Meteorology: display NOT permitted without permission
- The BoM tide page (https://www.bom.gov.au/australia/tides/, HTTP 200 on 2026-11-10) states no specific terms of use. Its footer reads "© Copyright Commonwealth of Australia 2026, Bureau of Meteorology".
- So the default clause on the copyright page applies (https://www.bom.gov.au/copyright, redirected from /other/copyright.shtml, read 2026-11-10):
  > "If there are no stated terms of use — Unless we state otherwise, you can download, copy and use our content for personal use, or use within your organisation. You must not supply it to any other person or use it for any commercial purpose. If you would like to use our content in a different way, contact us. You cannot use the content until you get our permission."
- The same page also says:
  > "We do not allow you to use automated or manual techniques to hack, scrape or otherwise extract material from our site."
- The data services page (https://www.bom.gov.au/resources/data-services) says: "Some forecast, warning and observation text products are free. These are not for commercial use. Extensive datasets are available through paid subscription services." It points to the "Bureau of Meteorology Data Licence Agreement" for paid data.
- **Verdict: SWELLO may not show BoM tide predictions.** Showing them to users is "supply it to any other person", and fetching them would be scraping. Nothing gets wired from BoM. A BoM licence is a user decision (contact or paid agreement).

### Queensland TMR: display permitted (CC BY 4.0)
- Transport and Main Roads publishes 77 "tide gauge predicted high/low data" datasets on data.qld.gov.au, each "Creative Commons Attribution 4.0" (CKAN `license_title`, licence URL https://creativecommons.org/licenses/by/4.0/). There are also "predicted interval data" sets (10-min) for many gauges.
- **Access:** the resource download URLs return HTTP 202 with an empty body and `x-amzn-waf-action: challenge` (an AWS WAF bot challenge), so they do not work headless. The CKAN datastore API works keyless:
  `https://www.data.qld.gov.au/api/3/action/datastore_search?resource_id=94a28942-b589-4c41-849c-619bae60f2ba&filters={"Date":["10/11/2026","11/11/2026"]}`
- Gold Coast Seaway 2026 returned these records: 10/11/2026 01:45 low 0.160, 08:35 high 1.660, 15:03 low 0.280, 20:36 high 1.130; 11/11/2026 02:15 low 0.200, 09:10 high 1.650, 15:44 low 0.310, 21:14 high 1.080. Fields are `Date, Time, Ind (1 = high, -1 = low), Reading`.
- **Unconfirmed, and must be confirmed before wiring:** the datum and the time zone. The CKAN record says only "Predicted high and low water level heights at Gold Coast Seaway." The TMR description file for Southport (gauge 100035) documents raw observed readings, not the prediction file's datum.
- Gauges usable for the 27 QLD spots:
  - Gold Coast Seaway: position -27.9386, 153.4326 from the DES storm-tide CSV site `goldcoast`.
  - Mooloolaba: -26.6843, 153.1334 (site `mooloolaba`).
  - Noosa Head also has a predicted high/low set, but no machine-readable position was found, so it is not assigned.
- Each spot's nearest positioned gauge and distance are in the JSON.
- **The DES storm-tide CSV** (`https://apps.des.qld.gov.au/data-sets/storm-tides/tide-7dayopdata.csv`, HTTP 200, 4.79 MB) has 58 sites with observed level, prediction and residual. Its prediction runs only up to the present (last row 2026-11-10T13:40 AEST), so it is not a forecast tide.

### Other states
- **NSW:** Data.NSW search "tide prediction" found only archived Sydney Harbour PDFs ("Licence Specified by Agency"). MHL operates tide gauges (observed water level, conflicting licence as above). There is no open-licensed prediction feed.
- **WA:** the DoT tide-predictions page (https://transport.wa.gov.au/imarine/tide-predictions.asp) offers annual PDFs only. It says "All data provided is subject to the Department of Transport and Major Infrastructure's disclaimer, conditions of use and copyright policy". No open licence is stated and there is no machine-readable feed. Not wireable.
- **VIC and SA:** their CKAN portals returned 0 datasets for "tide prediction". Port tables there are BoM-computed (BoM terms apply). **TAS:** none found.
- **IOC Sea Level Monitoring** (36 active Australian gauges, see Src-IOC-Sea-Level) is observed level only, not predictions.

## 3. Model: Open-Meteo Marine at every spot
- Request: `https://marine-api.open-meteo.com/v1/marine?latitude=..&longitude=..&hourly=wave_height&forecast_days=1`, batched 25 coordinates per call at 1 call per second. Retrieved 2026-11-10T04:15:06Z, 1,011 points, 0 fetch errors.
- The catalogue has no marine point, so three points were tested per spot:
  - `beach`: the catalogue pin;
  - `seaward2km`: 2 km along the spot's `seaward` bearing;
  - `appMarine9km`: the app's own `marinePoint()` rule, 0.08° seaward (`src/data/coast.ts`).
- **Results:**
  - seaward2km: 337 of 337 returned 24 of 24 non-null hours.
  - appMarine9km: 337 of 337 returned 24 of 24.
  - **Land cells: 0.**
- Beach pins with all-null (a land cell at the pin itself):
  - `w-australia-asling-beach`: the pin -37.062, 149.912 resolves to grid -37.0417, 149.8750. Seaward points are OK (grid 150.125).
  - `w-australia-scotts-head`: the pin -30.743, 152.998 resolves to grid -30.7083, 152.9584. Seaward points are OK (grid 153.2084).
- **Caveat: non-null does not mean nearby.** Open-Meteo returns the nearest sea cell. The returned grid point was a median 3.8 km (max 18.2 km) from the app's marine point, and a median 4.6 km (max 18.9 km) from the 2 km point. Grid longitudes such as 150.125 show a 0.25° model cell in places. Per-spot `gridKm` is in the JSON. The wiring should show the returned grid point, as the app already does for the US.

## 4. Wind: METAR airports (IEM)
- The real network id is `AU__ASOS`: `https://mesonet.agron.iastate.edu/geojson/network/AU__ASOS.geojson` returned HTTP 200 with 108 features, 58 flagged online.
- `https://mesonet.agron.iastate.edu/api/1/currents.json?network=AU__ASOS` returned 58 stations with a current observation, for example YMHB Hobart at 2026-11-10T04:00:00Z, 150° 10 kt. 57 were within 6 h at the check.
- The network also lists ANYN (Nauru) and NZQN (Queenstown NZ). Neither is ever the nearest station to an Australian spot.
- 50 listed stations stopped in November 2022, among them coastal Merimbula, Port Macquarie, Taree, Nowra, Mount Gambier, Ceduna and Albany.
  - Cross-check: aviationweather.gov returned HTTP 204 (no data) for YMER, YPMQ, YABA, YMTG, YSNW, YCDU and YTRE, while YSSY returned a current METAR (`METAR YSSY 100400Z AUTO 05017KT …`).
  - So the gap is real: those airports do not issue METARs, and it is not an IEM problem.
- **Nearest live airport distance:**

  | Region | Median km | Max km | Spots within 40 km |
  |---|---|---|---|
  | NSW | 40.8 | 219.2 | 91 of 184 |
  | QLD | 16.7 | 74.1 | 26 of 27 |
  | VIC | 65.2 | 126.2 | 11 of 36 |
  | WA | 40.1 | 377.8 | 26 of 52 |
  | SA | 80.2 | 377.4 | 5 of 24 |
  | TAS | 41.3 | 72.0 | 6 of 14 |

- 78 spots are over 80 km from one (NSW 46, SA 12, VIC 11, WA 9). Many NSW south-coast spots fall back to Canberra (YSCB), which is inland, and SA's west coast falls back to Woomera.
- Airports most often nearest:
  - Sydney: 73 spots
  - Avalon: 36
  - Newcastle: 32
  - Canberra: 27
  - Coffs Harbour: 19
  - Ballina: 18
  - Busselton: 18
  - Coolangatta: 16
  - Sunshine Coast: 15
  - Hobart: 14
- The per-spot airport and distance are in the JSON. Recommendation in the draft spec: model wind beyond 40 km, with the airport only as labelled context.

## Blockers and user decisions
1. **Tides outside Queensland:** BoM display needs BoM permission or a paid licence (user decision). Until then, 310 of 337 spots show "Tide predictions: not available in this region".
2. **QLD tide datum and time zone** are not stated in the open record. Engineering confirms them (TMR contact opendata@tmr.qld.gov.au, as listed on the CKAN record) before wiring.
3. **WA DoT buoys are 3-hourly and gappy.** Cape Naturaliste was 22.5 h old at the check, so Margaret River needs an honest "measured N h ago".
4. **Tasmania and Lord Howe Island have no buoy within 150 km.**
5. **MHL licence wording conflicts** (site: Crown copyright and written permission; AODN and Data.NSW: CC BY). Reading the AODN copy is covered by its stated licence; an email to MHL is advisable before a public launch.

## Reproduce
The crawl, check and build scripts were kept out of the repo (scratchpad). Their method is above, and every URL is listed. To re-run, crawl the 12 owner folders' `catalog.xml`, the newest monthly file's `.das`, and an NCSS 3-day CSV per buoy, at about 1 request per second.
