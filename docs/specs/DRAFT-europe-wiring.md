# DRAFT: Europe wiring (Ireland, UK, France, Portugal, Spain)

Status: draft for the lead, not approved. Source study: `docs/forecast/EUROPE-DATA.md` and `docs/forecast/data/europe-sources.json` (2026-11-10). Nothing here is wired yet.

## Goal
Let the 1,334 catalogued European spots (IE 119, UK 436, FR 219, PT 234, ES 326) into the app with honest data:
- the wave forecast from Open-Meteo Marine, after the land-cell check is rerun (it was blocked by a 429 on 2026-11-10);
- a measured buoy beside it, only where the licence allows display;
- tide predictions only where the licence allows display (Ireland only, today);
- shore wind from the nearest METAR airport, labelled with its distance;
- everything else says "not available in this region" through the existing C2 path.

## Order (which country is app-ready first)
1. **Ireland: ready now.**
   - Buoys and tide predictions both come from one keyless ERDDAP under CC BY 4.0.
   - Weakness: only 4 live buoys (M2, M3, M5, M6), so 60 of 119 spots have no buoy within 150 km. UK OGL buoys fill some of the gap across the border.
2. **UK: buoys ready, tides need a key.**
   - 57 OGL wave buoys (Cefas plus CCO), median 26.7 km.
   - Tides need a free CCO domain key. Until then, show "Tide predictions: not available in this region", and optionally show EA observed level as "measured now".
3. **France: buoys only.**
   - 22 live CANDHIS buoys, all spots within 133 km.
   - Needs a free CANDHIS API key (email request).
   - No tides (SHOM is paid).
4. **Portugal and Spain: blocked on user decisions.** Portugal's IH readings are CC BY-NC 4.0. Most Spanish buoys are Puertos del Estado, whose FAQ forbids transfer to third parties; the same data reaches Copernicus under a redistribution licence. Until the user decides, these spots get model plus wind only. Exception: the 3 Basque Euskalmet buoys via Copernicus are clean.

## Level and owners
- Level 3: new external sources, new labels, new attribution, about 1,330 new spots. Data-honesty review is required before merge.
- One implementation owner (eng-term). Review: data-honesty-reviewer, then the normal merge gate.
- Split into per-country PRs in the order above. Each country ships only when its own browser check passes.

## Scope

### 0. Before any code: rerun the model check
- For every spot in `europe-sources.json`, query `model.pointsToCheck` (beach, seaward2km, appMarine9km). Use the Australia method: 25 coordinates per call, 1 call per second, about 161 calls.
- Write `model.status` and `gridKm` back into the JSON. A spot whose app marine point is all-null needs a marine-point override before it is added; the Australia rule applies.

### 1. Spots (C4 add-spots path)
- Add the rows from `docs/forecast/data/world-spots/{ireland,uk,france,portugal,spain}.json` through the C4 world-spot path, with `country` and `timeZone` from the row.
- Marine point: `marinePoint(lat, lon, seaward)` in `src/data/coast.ts`, unless step 0 finds a land cell. Show the returned grid point, as for US spots.
- Fetch budget (C3): batch Open-Meteo calls or load lazily per viewed spot. Do not add 1,334 eager targets to `services/forecast-service.mjs`.

### 2. Buoy readers (one per source, none for Puertos del Estado direct)
Every reader:
- reads columns by name;
- takes the newest row within 24 h and **never a row stamped after the fetch time**;
- keeps each value's own time;
- labels which height it shows (Hm0 spectral, H1/3 zero-crossing, or WaveHeight);
- labels the period type (Tp peak, Th1/3, T02).

No source gives a swell/sea split, so the swell partitions stay from the model. Each buoy is shown as CONTEXT ("measured offshore at <place>, <distance> km away, <age>"), never as the spot's surf. Buoys flagged `sheltered` in the JSON (Morecambe Bay, inner Bristol Channel, Algeciras) are never used as open-coast context.

| Provider id | Endpoint | Parse | Cache |
|---|---|---|---|
| `MI-IWB` (Ireland) | `https://erddap.marine.ie/erddap/tabledap/IWBNetwork.csv?station_id,longitude,latitude,time,WaveHeight,WavePeriod,Tp,ThTp,Hmax,QC_Flag&time>=<now-24h>` | CSV; the second line is units; one request covers all stations | 30 min |
| `CEFAS-WN` (UK) | `https://wavenet-api.cefas.co.uk/api/Summary` | JSON array; `timestamp` has no zone and is UTC; keep `provider` in {Cefas, Channel Coastal Observatory}; drop every other provider; drop empty `Hm0` | 30 min, one request for all UK buoys |
| `CCO` (UK, once keyed) | `https://coastalmonitoring.org/observations/waves/latest?key=…` with `Referer: https://<prod domain>/` | per the CCO API docs; `date` is `YYYYMMDD#hhmmss` GMT | no more often than 30 min (CCO term) |
| `CANDHIS` (France, once keyed) | `https://candhis.cerema.fr/API/v1/getCampListeTR.php` with header `Authorization: <key>` | JSON `entete`/`results`; field set depends on buoy type (H1/3 vs Hm0) | 30 min; respect the daily quota (HTTP 429) |
| `IH-EDR` (Portugal, only if the NC licence is accepted) | `https://ogcapi.hidrografico.pt/collections/buoys_datawell/instances/nrt/locations/{id}?f=json&parameter-name=wave_hm0,wave_hm0_qc,wave_tp,wave_thtp,wave_hmax` | CoverageJSON `CoverageCollection.coverages[0]`; drop QC not equal to 1 | 30 min |
| `CMEMS-INSTAC` (Spain, Basque buoys; PdE only if the user accepts) | `https://s3.waw3-1.cloudferro.com/mdl-native-03/native/INSITU_IBI_PHYBGCWAV_DISCRETE_MYNRT_013_033/cmems_obs-ins_ibi_phybgcwav_mynrt_na_irr_202311/latest/<YYYYMMDD>/<DAC>_TS_MO_<platform>_<YYYYMMDD>.nc` | NetCDF: needs a server-side decoder (no NetCDF library in the app today). `VHM0`, `VTPK`, `VMDR` with `_QC`; (TIME, DEPTH) with one filled depth slot; TIME is days since 1950 | 60 min; at 00:00–01:00 UTC read yesterday's file too |

- Lag to expect: IE 1.3 h, UK 0.8–1.8 h, FR about 0.25 h, PT 1.1–1.5 h, Copernicus 1.4–3.5 h. Show the reading's age every time and drop it at 24 h.
- **CANDHIS future-stamped row:** SEM-REV returned a 09:00 TU row at 08:44Z. Confirm the timestamp convention (start or end of the 30-min record) with Cerema, and drop future rows until confirmed.
- Positions: copy them from `europe-sources.json` → `buoys[]` (taken from each source's own metadata), never from a map.

### 3. Attribution (verbatim; never paraphrase)
- Ireland buoys and tides: "Marine Institute, Ireland: data under CC BY 4.0", with a link to https://creativecommons.org/licenses/by/4.0/. The IWBNetwork `acknowledgement` attribute (in the study) goes on the source sheet.
- UK CCO buoys: "Real time data displayed on this page are from the National Network of Regional Coastal Monitoring Programmes, made freely available under the terms of the Open Government Licence. Please note that data are not quality-controlled in real-time."
- UK Cefas buoys: "Contains Cefas WaveNet data, Open Government Licence", with the citation "Hull et al (2023). WaveNet near real-time data feed - from the past 48 hours. Cefas, UK. V1. doi: https://doi.org/10.14466/CefasDataHub.142". Ship only after the per-platform category (Cefas "Advanced Information" tab) is confirmed as category 1 for each buoy shown.
- France: "Candhis - Données originales téléchargées sur https://candhis.cerema.fr/, mise à jour du <date>" (the Licence Ouverte asks for the source and the last-update date). The ideal form names the campaign partners, listed in `01_Utilisation.fr.pdf`.
- Copernicus copies: "E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00043", plus the platform owner.
- Portugal (if accepted): "Instituto Hidrográfico, CC BY-NC 4.0", with a link to the collection metadata.

### 4. Tides
- **Ireland (119 spots) and Northern Ireland (11 spots): wire.**
  - Source: `https://erddap.marine.ie/erddap/tabledap/IMI_TidePrediction_HighLow.csv?stationID,time,tide_time_category,Water_Level_ODMalin&stationID="<id>"&time>=<start>&time<=<end>`. 38 stations; the per-spot station and distance are in the JSON.
  - Times are UTC. Heights are labelled with the variable's own datum, "OD Malin". The dataset summary says LAT, so confirm with the Marine Institute before showing heights; times alone are safe.
  - Northern Ireland labels say "Irish Marine Institute prediction at <station>, <km> km".
- **UK (except Northern Ireland):** C2 note until a CCO key exists, then CCO `tidepredictions` (OGL, chart datum). Do not use NTSLF ("All rights reserved") or UKHO without a subscription.
- **France, Portugal, Spain:** C2 note "Tide predictions: not available in this region". SHOM is paid, the IH portal is keyed, and PdE forbids transfer.
- Observed level as optional context, never as a prediction:
  - EA tide gauges (England, OGL, keyless): label "measured now, mAOD".
  - Irish National Tide Gauge Network (CC BY).

### 5. Wind
- Nearest IEM station with a METAR in the last 6 h, using the existing shore-ASOS reader with network ids `IE__ASOS`, `GB__ASOS` (includes the Channel Islands and the Isle of Man), `FR__ASOS`, `PT__ASOS`, `ES__ASOS` and `GI__ASOS`.
- Cross-border nearest is allowed (Basque and Irish border spots).
- Over 40 km, the label says "airport wind, <n> km away; not the beach". Over 80 km, use model wind only and say so. This affects 44 Irish spots (Mayo, Sligo), 27 Portuguese (Alentejo), 13 Spanish and 3 UK.

### 6. What stays "not available in this region" (C2)
- CDIP MOP nearshore, NWS alerts and US tide stations everywhere.
- Tides outside Ireland and Northern Ireland, until a key or licence exists.
- Buoys for Portugal and for Spain except the Basque Country, until the user decides.

## Tests
- `mi-erddap.test.ts`: units line skipped; newest row within 24 h; `QC_Flag` handling; M4-style dead station dropped (row older than 24 h).
- `cefas-summary.test.ts`: provider filter (drops Oil and Gas UK, Shell UK, EMEC, Met Office); empty `Hm0` is missing, not 0; zone-less timestamp read as UTC. Use captured JSON from 2026-11-10 (Scilly 3.1 m at 07:30).
- `candhis.test.ts`: H1/3 vs Hm0 labelling; a future row is dropped (SEM-REV 09:00 at 08:44Z); an [MN] campaign is not live.
- `region-coverage.test.ts`: a European spot never borrows a US buoy or tide; an IE or Northern Ireland spot gets MI tides; FR, PT and ES spots get the tide note; a PdE buoy is never shown unless the licence flag is set.
- Attribution test: the footer contains the CCO sentence verbatim whenever a CCO value is on screen, and "CC BY 4.0" for Marine Institute values.
- Browser, at 1440 and 390 width:
  - Lahinch (IE): MI tide plus M3 at about 207 km labelled as far.
  - Fistral (UK): Perranporth 8.9 km.
  - La Gravière, Hossegor (FR): Anglet 20 km.
  - Mundaka (ES): Euskalmet Bilbao station 31.5 km.
  - Supertubos (PT): model only, with the buoy note.

## Open questions for the user
1. **Spain:** Puertos del Estado's FAQ says "under no circumstances is the transfer of the data to third parties permitted". The same buoys are published by Copernicus with a licence that permits redistribution with credit. Write to PdE, or accept the Copernicus licence as stated on the files?
2. **Portugal:** IH buoy and tide readings are CC BY-NC 4.0. That suits today's private use; is non-commercial acceptable until a public or commercial launch?
3. **Keys in SWELLO's name** (all free): a CCO API key (form, bound to the production domain), a CANDHIS API key (email), and optionally a UKHO Discovery subscription. Who requests them?
4. **Cefas Summary:** it is undocumented. Ask Cefas to confirm that reuse is fine and that each platform is category 1 (OGL)?
