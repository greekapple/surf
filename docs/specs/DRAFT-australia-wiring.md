# DRAFT: Australia wiring (next round)

Status: draft for the lead, not approved. Source study: `docs/forecast/AUSTRALIA-DATA.md` and `docs/forecast/data/australia-sources.json` (round 3, section 3E). Nothing here is wired yet.

## Goal
Let the 337 catalogued Australian spots into the app with honest data:
- the wave forecast from Open-Meteo Marine (works today at every spot's marine point);
- a measured buoy beside it from AODN (CC BY 4.0);
- tide predictions only where the licence allows display (Queensland only, today);
- shore wind from the nearest METAR airport, labelled with its distance;
- everything else says "not available in this region" through the existing C2 path.

## Level and owners
- Level 3: new external source, new labels, new attribution, about 340 new spots. Data-honesty review is required before merge.
- One implementation owner (eng-term). Review: data-honesty-reviewer, then the normal merge gate.

## Scope

### 1. Spots (C4 add-spots path)
- Add the 337 rows from `docs/forecast/data/world-spots/australia.json` through the C4 world-spot path, with `country: 'AU'` and `timeZone` from the row.
- Marine point: the app's own rule, `marinePoint(lat, lon, seaward)` in `src/data/coast.ts` (0.08 deg, about 9 km seaward). The study asked Open-Meteo for wave_height at that point for all 337 spots: every one returned 24 of 24 non-null hours (see the study for the two spots whose beach pin is a land cell). No marine point override is needed. Open-Meteo snaps to the nearest sea cell, though, which was a median 3.8 km and a max 18.2 km from the requested point. Show the returned grid point, as the US spots already do.
- Fetch budget (C3): 337 more marine and weather requests. Batch Open-Meteo calls (comma-separated coordinates) or load lazily per viewed spot. Do not add 337 eager targets to `services/forecast-service.mjs`.

### 2. AODN wave buoy reader
- New context-buoy provider `'AODN'` in `src/ocean/buoys.ts`. Each row: `{id, provider: 'AODN', label, place, owner, fetchKey: 'aodn-<SITE>', lat, lon, folder}`. Copy positions from the study's `buoys[]` (the latest file's own latitude/longitude), never from a map.
- URL: THREDDS NCSS point CSV on the buoy's current monthly file:
  `https://thredds.aodn.org.au/thredds/ncss/point/<folder>/WAVE-BUOYS/REALTIME/WAVE-PARAMETERS/<SITE>/<YYYY>/<FILE>_monthly.nc?var=WSSH,WPPE,WPDI&time_start=<now-24h>&time_end=<now+1h>&accept=csv`
  - The file name changes each month (`..._<YYYYMM>01_<SITE>_RT_WAVE-PARAMETERS_monthly.nc`), and the prefix differs by owner (`IMOS_COASTAL-WAVE-BUOYS_`, `MHL_`, `BOM_`, `DOT-WA_`, etc.). Read the prefix from the study's `latestFile`, not from a guess. At a month boundary, ask for both files, or resolve the newest file through the folder's `catalog.xml`.
  - Variable names differ by owner. Spotter owners (IMOS, NSW DPE, UWA, Deakin, Flinders, SA DEW) carry `WSSH` (spectral Hs). Waverider owners (MHL, BoM, QLD DES, WA DoT, Gippsland, Pilbara) carry `WHTH` (zero-crossing Hs). No file checked carried both. The reader takes the variables listed for that buoy in the study and labels which one it shows ("significant wave height (spectral)" or "(zero-crossing)"). It never mixes the two silently.
- Parser `normalizeAodnBuoy(csv, retrievedAt, url, buoy)`, built the same way as `normalizeCdipBuoy`:
  - Read columns by header name. The AODN CSV header is `time,latitude[unit="degrees_north"],longitude[unit="degrees_east"],<VAR>[unit=...],...,WAVE_quality_control`, with no station-name column.
  - Take the newest row within 24 h, not in the future. No fill, and each value keeps its own time.
  - Request `WAVE_quality_control` too. Meanings: 1 good, 2 not_evaluated, 3 questionable, 4 bad, 9 missing. Drop 3, 4 and 9. Realtime rows are 2 today, so the label says "realtime, not quality-controlled".
  - **Treat 0.0 in WPPE, WPDI, WPDS and WMXH as missing.** QLD DES rows at :30 carry 0.0 there beside a real WHTH (Gold Coast, 2026-11-10 02:30Z).
  - WA DoT buoys report every 3 h, with gaps (Cape Naturaliste was 22.5 h old at the check). Show the reading's age every time, and drop it when it is over 24 h old.
  - There is no swell/sea split in any realtime file. The buoy gives total Hs, Tp and Dp only, and the swell partitions stay from the model.
- Service: one cached target per wired buoy in `services/forecast-service.mjs` (`aodn-<SITE>`, ttl 30 min, text/csv). Only buoys on the open coast within 150 km of at least one live spot qualify: 36 on 2026-11-10 (list in `australia-sources.json`). Buoys flagged `sheltered` (Port Phillip Bay, the gulfs, Exmouth Gulf, the reef lagoon) are never used as open-coast context.
- Spot card: show the nearest open-coast AODN buoy within 150 km as CONTEXT ("measured offshore at <place>, <distance> km away, <age>"), never as the spot's surf. 32 spots have none (Tasmania, Lord Howe Island and 8 WA spots); they show the C2 note for buoys.

### 3. Attribution (CC BY 4.0)
- Footer and source sheet: "Wave buoy data: <owner>, via the Australian Ocean Data Network (AODN), CC BY 4.0". Then the required sentence, which every owner's file carries:
  "Data was sourced from Australia's Integrated Marine Observing System (IMOS) - IMOS is enabled by the National Collaborative Research Infrastructure Strategy (NCRIS)."
- NSW DPE buoys (Tathra) also need the line "NSW wave data sourced from IMOS were collected, processed and provided by the NSW Nearshore Wave Data Program operated by the NSW Department of Climate Change, Energy, the Environment and Water".
- Copy the per-owner text from `australia-sources.json` → `buoys[].acknowledgement`; do not paraphrase it.
- The source sheet links `https://creativecommons.org/licenses/by/4.0/` and the THREDDS folder.

### 4. Tides
- **BoM: do not wire.** BoM tide predictions carry no stated licence, so the default copyright terms apply: personal or in-organisation use only, and "You must not supply it to any other person". Showing them would need BoM permission (a user decision, possibly paid).
- **Queensland (27 spots): wire.** Transport and Main Roads predicted high and low data on data.qld.gov.au (CC BY 4.0), read through the CKAN datastore API:
  `https://www.data.qld.gov.au/api/3/action/datastore_search?resource_id=<id>&filters={"Date":["DD/MM/YYYY",...]}`
  - The resource download URLs sit behind an AWS WAF challenge (HTTP 202, empty body). Only the datastore API answers.
  - Before wiring, engineering confirms two things the CKAN record does not state: the datum (TMR tables are usually LAT) and the time zone of `Date`/`Time` (TMR description files use AEST). Labels state both.
  - Gauges: Gold Coast Seaway (resource 94a28942-b589-4c41-849c-619bae60f2ba) and Mooloolaba (58920636-0eb3-419f-bc28-68e1d0b88c82). Noosa Head also exists, but no machine-readable position was found, so it is not assigned until one is sourced.
  - The resource id changes every year (a new resource per year). Store the id per year, and fail closed in January if next year's id is missing.
- Every other state: the C2 note "Tide predictions: not available in this region".

### 5. Wind
- Nearest IEM `AU__ASOS` station with a METAR in the last 6 h. Same reader as the existing shore-ASOS path, with the network id `AU__ASOS`.
- The label gives the airport name and distance. Over 40 km, the label says "airport wind, <n> km inland or along the coast; not the beach". Over 80 km, use the model wind only and say so.

### 6. What stays "not available in this region" (C2)
Nearshore model (CDIP MOP), NWS alerts, US tide stations. Tides too, outside Queensland.

## Tests
- `aodn-buoy.test.ts`: header-name parsing on real captured CSV lines from three owners (MHL Sydney, QLD Gold Coast, WA Rottnest/Cape Naturaliste; samples in the study). It covers newest-within-24 h, a future row skipped, a 0.0 period/direction read as missing, QC 3/4/9 dropped, and WSSH and WHTH labelled differently.
- `aodn-url.test.ts`: the monthly file name rolls over at a month boundary in UTC.
- `region-coverage.test.ts`: an AU spot gets the tide note unless Queensland; never a CO-OPS or NDBC source; an AU spot never borrows a US buoy.
- `qld-tide.test.ts`: datastore records turn into high/low events with the stated datum and zone; a missing year's resource gives "not available", not a stale year.
- Attribution test: the footer string contains "AODN" and "CC BY 4.0" whenever an AODN value is on screen.
- Browser: one NSW (Manly), one QLD (Snapper Rocks), one WA (Margaret River main break) and one VIC (Bells Beach) spot at 1440 and 390 width. Buoy context, tide state, wind label and attribution must be visible and true.

## Open questions for the user
1. BoM tide predictions for NSW, VIC, SA, WA and TAS need BoM permission or a paid data licence. Ask BoM, or ship without tides outside Queensland?
2. The MHL website says its data is Crown copyright, reproduced only with written permission. Data.NSW and AODN list MHL data as CC BY. The AODN copy is the one we would read, under its CC BY licence, but the conflict is worth one email to MHL before launch.
