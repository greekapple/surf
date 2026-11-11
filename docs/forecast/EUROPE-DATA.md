# Europe data map: Portugal, Spain, France, UK, Ireland

This is a study, so nothing is wired. Every number below comes from a live fetch made on 2026-11-10 between 08:10 and 08:46 UTC. It mirrors the Australia study (`AUSTRALIA-DATA.md`). The per-spot table is in `docs/forecast/data/europe-sources.json` (1,334 spots: PT 234, ES 326, FR 219, UK 436, IE 119), the wiring proposal is in `docs/specs/DRAFT-europe-wiring.md`, and the vault notes are `Data-Sources/Europe-Data.md` plus updated `Src-*` notes.

Rules followed: public pages and keyless APIs only, no logins, no terms accepted, about 1 request per second per host, User-Agent "SWELLO surf forecast prototype". No value here is estimated. Anything that could not be confirmed is marked as unconfirmed.

**The model check (item 3) was not run.** The Open-Meteo marine API answered 429 "Daily API request limit exceeded" to this machine's IP on 2026-11-10 (the lead's instruction: do not retry). The sweep was stopped and no partial result was kept, so every one of the 1,334 spots carries `model.status = "model check not run: Open-Meteo daily limit (429) on 2026-11-10"`. Each spot also carries `model.pointsToCheck` (beach, 2 km seaward, and the app's own 9 km `marinePoint()`), so the check can be rerun after 00:00 UTC without recomputing anything.

## Summary
| Country | Waves (live buoys, lag, licence) | Tide predictions with display permission | Wind (IEM METAR) |
|---|---|---|---|
| **Ireland** | 4 Marine Institute weather buoys (M2, M3, M5, M6). Keyless ERDDAP, **CC BY 4.0**, lag 1.27 h. The Irish Wave Buoy Network (AMETS) has been silent since 2026-05-27, M4 since 2026-03-29, and the Met Eireann lighthouse buoys did not appear in today's Copernicus feed (EMODnet showed them 43 to 110 h old). Nearest live open-coast buoy: median **155 km** (60 of 119 spots over 150 km, all north-west and west coast). | **Yes.** Marine Institute high/low predictions, 38 stations, keyless ERDDAP, **CC BY 4.0**. Every Irish spot has a station within 42.6 km (median 13.3 km). | `IE__ASOS`: 10 stations, 5 with a METAR within 6 h. Median 62.5 km; 44 spots over 80 km (Mayo and Sligo). |
| **UK** | 57 wave buoys: 21 Cefas WaveNet and 36 CCO, read from one **keyless** Cefas endpoint (`wavenet-api.cefas.co.uk/api/Summary`, undocumented, used by the public site). Lag 0.84 to 1.81 h. **Open Government Licence** (Cefas NRT feed DOI; CCO needs its attribution sentence). Another 21 third-party feeds (oil and gas, EMEC, Met Office light vessels) have no stated licence and are not displayable. The Met Office K-buoys had no wave rows in their 45-day NDBC files. Nearest displayable buoy: median **26.7 km**; 3 spots over 150 km (Lewis). | **Not without a key.** CCO tide predictions are OGL but need a free domain-bound API key (form request). UKHO needs a subscription. NTSLF says "All rights reserved". EA gauges (88, OGL, keyless) are observations only. | `GB__ASOS`: 112 stations, 90 fresh, including Jersey, Guernsey and Alderney. Median 26.1 km; 3 spots over 80 km. |
| **France** | 22 CANDHIS buoys reporting within 24 h (19 with an 08:30 TU row), **Licence Ouverte Etalab 2.0**. Read from the public campaign pages for this study; the CANDHIS API v1 needs a **free key requested by email**. Lag 0.23 to 0.25 h for 19 buoys. Port La Nouvelle was 18.7 h old, and SEM-REV's newest row was stamped 0.26 h in the future (see notes). Nearest displayable buoy: median **31.2 km**, every spot within 133 km. | **No.** SHOM prediction APIs are "only available to authenticated users with a valid subscription key which can be purchased on the Shom store". | `FR__ASOS`: 127 stations, 104 fresh. Median 22.1 km; no spot over 80 km. |
| **Portugal** | 4 Instituto Hidrografico Datawell buoys (Sines, Faro, Madeira Canical, Azores Graciosa). Keyless OGC API EDR. The **time series are CC BY-NC 4.0**. Lag 1.10 to 1.47 h. Nazare (Fugro) is live only through Copernicus (lag 1.54 h). Leixoes has been silent since 2026-11-08 14:56Z. **0 strictly displayable buoys**; median 95 km if the non-commercial licence is accepted. | **No.** IH predictions sit behind a keyed portal API (HTTP 401 "Invalid API KEY"), and the tables are sold. IH tide gauge observations are CC BY-NC 4.0. | `PT__ASOS`: 19 stations, 16 fresh. Median 23.5 km; 27 spots over 80 km (Alentejo coast). |
| **Spain** | 23 live buoys through the **Copernicus Marine In Situ IBI latest files** (anonymous S3, keyless), lag 1.36 to 3.53 h. 20 are Puertos del Estado, whose FAQ forbids "transfer of the data to third parties". The Copernicus licence permits redistribution: a **licence conflict for the user**. 3 Euskalmet buoys (Basque Country) are clean under the Copernicus licence. Nearest displayable buoy within 150 km: only 62 of 326 spots, all Basque or Cantabrian. With PdE accepted: median **45.2 km**. | **No.** Puertos del Estado forbids transfer to third parties. No open-licensed Spanish prediction feed was found. | `ES__ASOS`: 67 stations, 58 fresh (Canaries included). Median 29.6 km; 13 spots over 80 km. |

**App-ready first: Ireland.** It is the only country where buoys and tide predictions are both keyless and licence-clean (CC BY 4.0, one ERDDAP server). Its buoys are far from the coast, though: median 155 km, and the north-west has no buoy within 150 km. **UK is the strongest for buoys** (57 OGL buoys, median 27 km), but tides need a free CCO key and the Cefas per-platform licence category needs one check. **France is buoy-rich but has no tides** (SHOM is paid). **Portugal and Spain are blocked on licence decisions** (CC BY-NC; PdE versus Copernicus).

## 1. Waves

### 1.0 One pan-European feed: Copernicus Marine In Situ "latest" (keyless)
- The Copernicus Marine STAC (`https://stac.marine.copernicus.eu/metadata/<PRODUCT>/product.stac.json`) points to a native "latest" folder on public object storage.
  - That folder can be listed anonymously and its files read without an account. Listing (S3 ListObjectsV2): `https://s3.waw3-1.cloudferro.com/mdl-native-03?list-type=2&prefix=native/INSITU_IBI_PHYBGCWAV_DISCRETE_MYNRT_013_033/cmems_obs-ins_ibi_phybgcwav_mynrt_na_irr_202311/latest/20261110/`
  - Files are named `<DAC>_TS_MO_<platform>_<YYYYMMDD>.nc`, one per platform per day. On 2026-11-10 the IBI listing had 628 files and the NWS (`INSITU_NWS_PHYBGCWAV_DISCRETE_MYNRT_013_036`) listing 602.
- Variables follow the in-situ conventions: `VHM0` (spectral Hm0), `VTPK` (peak period), `VMDR` (mean direction, from), `VTM02`, `VPED`, `VAVH` (H1/3), each with `_QC`. Each file also has a global `last_date_observation`.
  - Arrays are (TIME, DEPTH) with 3 depth slots, and only one slot is filled. `TIME` is days since 1950-01-01.
  - There is no swell/sea split in any file read.
- Measured lag: files modified at 07:50 to 07:52Z held data to 07:00Z for the PdE offshore buoys. Lag at fetch was 1.52 h offshore and 2.52 h for the PdE coastal buoys, which carry hourly rows ending at 06:00Z.
- Licence (file attribute `license` → https://marine.copernicus.eu/user-corner/service-commitments-and-licence, read 2026-11-10):
  > "The Licensee is hereby granted a worldwide, non exclusive, royalty free, perpetual licence ... to ... (c) redistribute, disseminate any Copernicus Marine Service Product in their original form via any media."
  >
  > "The Licensee will ensure that in case of redistribution of Copernicus Marine Service products or documents, including pictures – shall credit the Copernicus Marine Service by explicitly making mention of the originator (Copernicus Marine Environment Monitoring Service) and by citing the DOIs in the following manner: "E.U. Copernicus Marine Service Information; insert DOIs links here""

  Product DOI for IBI in situ: 10.48670/moi-00043.

  File `citation`: "These data were collated within the Copernicus Marine Service (In Situ) and EMODnet collaboration framework. Data is made freely available by the Copernicus Marine Service and the programs that contribute to it."
- **Caveat (unconfirmed):** the licence speaks of a "Licensee", and the portal asks users to register. Reading the open bucket anonymously works, but whether that makes SWELLO a licensee without registering is not stated.
- **EMODnet Physics is not a usable realtime path.**
  - It mirrors the same platforms (`https://platform-erddap.emodnet-physics.eu/erddap/tabledap/TS_70_<code>_MO_UND.csv`), but its newest rows were 16.7 to 19.3 h old for every platform in the five countries (metadata fetched 08:14:57Z).
  - Its dataset `license` attribute reads "Creative Commons Attribution Share-Alike", and its `citation` reads "Data are the property of the producer/owner distributed through EMODnet Physics."
  - The registry (`EP_PLATFORMS_METADATA_V2`) is still the best discovery list: 267 wave platforms in the box 26–62°N, 32°W–10°E.

### 1.1 Ireland: Marine Institute ERDDAP
- Endpoint: `https://erddap.marine.ie/erddap/tabledap/IWBNetwork.csv?station_id,longitude,latitude,time,WaveHeight,WavePeriod,MeanWaveDirection,Hmax,Tp,ThTp,SprTp,QC_Flag&time>=<ISO>` (keyless).
- Variables: `WaveHeight` (significant), `Hmax`, `WavePeriod`, `Tp`, `ThTp` (direction at peak), `SprTp`, `MeanWaveDirection` and `QC_Flag`. Hourly. No swell split.
- Licence (dataset attribute, verbatim): "Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/)" (https://erddap.marine.ie/erddap/info/IWBNetwork/index.csv).
- Acknowledgement attribute (verbatim): "The Irish Buoy Network was established in 2000 and maintains five buoys operating around the coast of Ireland. The project was set up through a highly successful collaboration between Met Eireann, the Marine Institute, the UK Met Office and the Department of Transport, Tourism and Sport (DTTAS). Since 2017 the project is run by the Marine Institute in collaboration with Met Eireann funded through the Department of Agriculture and the Marine (DAFM)."
- Latest time per station (orderByMax, fetched 08:16:45Z): M2, M3, M5 and M6 at 2026-11-10T07:00:00Z; **M4 2026-03-29T04:00Z (dead)**.
- `IWaveBNetwork` and `IWaveBNetwork_spectral`: the only stations listed are AMETS Berth A and B, last 2026-05-27 (dead).
- **Test fetch** (fetched 08:16:10Z, lag 1.27 h):
  - M3 (51.216, -10.548): 07:00Z WaveHeight 3.867 m, Tp 11.719 s, ThTp 196.875°, Hmax 6.25 m, QC_Flag 0.
  - M5 (51.690, -6.704): 07:00Z 2.93 m, Tp 10.547 s, ThTp 196.875°, Hmax 4.688 m.

### 1.2 UK: Cefas WaveNet (+ CCO) and the CCO API
- **Cefas WaveNet Summary, keyless:** `https://wavenet-api.cefas.co.uk/api/Summary`. The public map site reads its API base from `https://wavenet.cefas.co.uk/assets/config/config.wavenet.prod.json` (`"apiUrl": "https://wavenet-api.cefas.co.uk/api"`).
  - It returned 89 platforms, each with the latest `timestamp` (no zone; it matches the UTC times on the CCO page) and `Hm0`, `Tz`, `Tpeak`, `W_PDIR` (peak direction), `W_SPR` and `TEMP`, plus `provider` and `source` (INT = Cefas, EXT = third party).
  - The endpoint is undocumented. Treat it as fragile and ask Cefas before relying on it.
- Cefas licence:
  - The NRT feed DOI page (https://www.cefas.co.uk/data-and-publications/dois/wavenet-near-real-time-data-feed-from-the-past-48-hours) gives "Rights List Open Government Licence" and the citation "Hull et al (2023). WaveNet near real-time data feed - from the past 48 hours. Cefas, UK. V1. doi: https://doi.org/10.14466/CefasDataHub.142".
  - The data policy (https://www.cefas.co.uk/data-and-publications/wavenet/data-policy/) says: "As some of the data belongs to third parties there are different restrictions for the availability and use. The identity of the owner and any restrictions are stated on the "Advanced Information" tab for each specific location". It then lists three categories: "1. Data fully available for download. No restrictions – available under Open Government Licence. 2. Data downloadable for non-commercial uses only. ... 3. Data not for download. ... These data are only available for visualisation on the website and must not be downloaded by any means."
  - **The category of each Cefas platform was not readable keyless and is unconfirmed.** The JSON marks the 21 Cefas buoys "permitted (confirm category per platform)". The SEPA waveriders (Arbroath, Buckie, Orkney, Stonehaven) are the ones most likely to carry a different owner's terms.
- **CCO / NNRCMP:**
  - The API (`https://coastalmonitoring.org/observations/waves/latest?key=...`) returned HTTP 401 "Missing or unknown API key" without a key.
  - Keys are free, requested on a form, bound to a domain and checked against the Referer.
  - Terms (https://coastalmonitoring.org/ccoresources/api/, verbatim): "Data from the NNRCMP is made freely available under the terms of the Open Government Licence. Web pages and other outputs which use real-time NNRCMP data must include the following attribution: "Real time data displayed on this page are from the National Network of Regional Coastal Monitoring Programmes, made freely available under the terms of the Open Government Licence. Please note that data are not quality-controlled in real-time.""
  - It also says: "Please cache responses, and request data no more often than it is recorded ... every 30 minutes for waves".
  - Fields: `hs` (spectral significant height), `hmax`, `tp`, `tz`, `pdir`, `spread`, `te`, `power`, `sst`, `QCflag`. No swell split.
- **Met Office:** the K-buoys in NDBC `realtime2` (62029 K1, 62081 K2, 62105 K4, 64045 K5, 64046 K7, plus 62103 Channel LV and 62163 Brittany) had **zero rows with WVHT in the whole 45-day file** (checked 08:21Z). Sevenstones LV (62107) reported WVHT 2.0 m at 07:00Z. The Met Office publishes no open licence for these, so they are not displayable.
- **Test fetches:**
  - **Newbiggin**, CCO public page `https://coastalmonitoring.org/realtimedata/?chart=110&tab=waves&disp_option=1`, fetched 08:18:22Z: `10-11-2026 07:00` (GMT), lat 55.18570, lon -1.47788, Hs 0.34 m, Hmax 0.54 m, Tpeak 5 s, Tz 4.8 s, peak direction 56°, spread 30°, SST 11.1 °C. Lag 1.31 h.
  - **WaveNet Summary**, fetched 08:20:34Z:
    - SW Isles of Scilly WaveNet: 07:30Z Hm0 3.1 m, Tpeak 11.1 s, PDIR 217°.
    - Perranporth (CCO): 07:01Z Hm0 0.7 m, Tpeak 11.8 s, PDIR 276°.
    - Lag 0.84 h for Cefas and 1.33 h for CCO.

### 1.3 France: CANDHIS
- Public pages, keyless:
  - Campaign list `https://candhis.cerema.fr/_public_/campagne.php` ("[TR] : temps réel", "[MN] : maintenance").
  - Per-campaign page `campagne.php?<base64("camp=NNNNN")>`, whose realtime table lists the newest 30-min rows (Date, "Heure (TU)", H1/3 or Hm0, Hmax, Th1/3 or T02, peak direction, spread, SST).
  - Positions are embedded in `https://candhis.cerema.fr/_public_/cartes.php`.
- API v1 (`https://candhis.cerema.fr/API/v1/getCampTR.php?camp=...&dateDeb=...`, user guide `doc/04_Candhis_API_v1_Utilisateur.pdf`): "L'API Candhis est protégée par une clé d'accès. Pour en obtenir une, merci d'en faire la demande en envoyant un message à l'équipe Candhis". Requests carry an `Authorization` header token. There is a daily quota (HTTP 429) and IP bans (HTTP 423). **Not keyless.**
- Licence (`https://candhis.cerema.fr/doc/01_Utilisation.fr.pdf`, V1 27/05/2025, verbatim): "Les données CANDHIS sont diffusées sous licence ouverte Etalab". Reuse is allowed "de la communiquer, la diffuser, la redistribuer, la publier et la transmettre, de l'exploiter à titre commercial ... Sous réserve de: mentionner la paternité de l'« Information »: sa source (au moins le nom du « Concédant ») et la date de dernière mise à jour". It continues: "La source de l'information est: a minima: « Candhis »; ... dans l'idéal les organismes associés aux campagnes de mesures".
- 36 campaigns are flagged [TR], 6 of them also [MN]. 28 are metropolitan and were read; 25 had a row with a height value.
  - Reporting within 24 h of fetch: 22.
  - Latest row 08:30 TU at fetches 08:44:05 to 08:46Z (lag 0.23 to 0.25 h): 19 buoys. Cherbourg was at 08:00 (0.74 h).
  - **SEM-REV (Plateau du Four) showed a 09:00 TU row at 08:44:35Z**: the row is stamped 0.26 h after the fetch. Either the stamp is the end of the 30-min record, or the clock is ahead. Unconfirmed. The reader must drop future rows or confirm the convention with Cerema.
  - Port La Nouvelle: 2026-11-09 14:00 (18.7 h). Royan: 2026-11-08 00:00 (not live). Oléron Large, Gravelines, Banyuls, Port d'Antifer and Le Havre Nord are [MN] with old rows.
- The height variable depends on the instrument. Most directional buoys give **H1/3 (zero-crossing)**; Port La Nouvelle gives Hm0. Periods are Th1/3 or T02, not a peak period, except Ile d'Yeu Nord ("T. au pic" 11.1 s). Labels must say which.
- **Test fetches:**
  - Anglet 06402 (fetched 08:13:45Z in the first probe): 10/11/2026 08:00 TU H1/3 0.6 m, Hmax 1.1 m, Th1/3 3.6 s, peak direction 295°, spread 34°, SST 17.1 °C.
  - In the full crawl (08:44:43Z), Anglet 08:30 read H1/3 0.6 m, Hmax 1.1 m, Th1/3 3.5 s, direction 205°.
  - Les Pierres Noires 02911 (08:44:15Z): 08:30 H1/3 2.1 m, Hmax 3.1 m, Th1/3 10.8 s, direction 232°.
- Météo-France offshore buoys (Gascogne 6200001, Brittany 6200163) were 20 to 35 h old in EMODnet, with no wave rows in NDBC. Not used.

### 1.4 Portugal: Instituto Hidrografico OGC API
- The old host `api-features.hidrografico.pt` still does not resolve. The live service is **`https://ogcapi.hidrografico.pt`** (pygeoapi), linked from https://www.hidrografico.pt/paginas-genericas/dt/dcdt/acesso-a-dados/oapif/.
- Collections:
  - `buoys_datawell` (network as Features; time series via EDR `.../instances/nrt/locations/{id_est}?parameter-name=wave_hm0,wave_tp,wave_thtp,...`, CoverageJSON). Parameters `wave_hm0`, `wave_hmax`, `wave_tp`, `wave_tm02`, `wave_thtp`, `wave_sprtp`, `sea_water_temperature`, plus `_qc`. 30-min rows, "latência de 30 minutos", 15-day window.
  - `buoys_fugro` (metadata only; EDR answered "invalid provider type").
  - `tide_obs_nrt` (observed level, chart datum ZH).
- Authentication (FAQ https://faq.hidrografico.pt/books/hidrografico/page/ogc-api-edr-rede-de-boias-datawell-waverider-observacoes): "Na configuração atual, o acesso aos endpoints descritos não requer autenticação nem API key."
- Licence (same FAQ, verbatim): "Os dados são disponibilizados nos termos da licença CC BY 4.0 (rede de boias) e CC BY-NC 4.0 (séries temporais), conforme indicado nos respetivos metadados". **The readings are non-commercial.** The `tide_obs_nrt` collection's licence link is `https://creativecommons.org/licenses/by-nc/4.0/`.
- **Test fetches (EDR):**

  | Buoy | Fetched (UTC) | Latest (UTC) | Lag | Hm0 | Tp | Dir at peak | Hmax | QC |
  |---|---|---|---|---|---|---|---|---|
  | Sines (id 19) | 08:24:50 | 06:56:44 | 1.47 h | 4.82 m | 14.3 s | 293° | 7.8 m | 1 |
  | Faro (id 20) | 08:24:52 | 06:56:37 | 1.47 h | 3.04 m | 11.1 s | 246° | 4.55 m | 1 |

  - Madeira Caniçal (id 33, owner APRAM): 06:59:57Z, 0.96 m.
  - Azores Graciosa (id 86, owner University of the Azores): 07:19:06Z, 3.27 m.
  - Leixoes (id 4): HTTP 204, no data in the window; feature `last_sea` 2026-11-08T14:56:42Z.
- Nazare coastal (Fugro, WMO 6200199) has no EDR. It reports through Copernicus (07:00Z, Hm0 4.2627 m, Tp 13.4766 s, lag 1.54 h). The Copernicus copy of an IH series inherits the same conflict as PdE: the owner's licence is non-commercial, while Copernicus permits redistribution.
- The geomar portal backend (`supportserver1.hidrografico.pt/geodata/...`) answers "Invalid API KEY" (HTTP 401) on every path tried. It is not usable.

### 1.5 Spain: Puertos del Estado (restricted), Euskalmet, INTECMAR
- **Puertos del Estado** owns 20 of the 23 live Spanish buoys. FAQ (https://www.puertos.es/en/services/oceanography/faqs, read 08:30Z, verbatim): "Although it is an open service, users must bear in mind that Puertos del Estado only authorises the use of the data for the specific purpose of the download, and under no circumstances is the transfer of the data to third parties permitted. Furthermore, when data is used, the source, Puertos del Estado, must always be duly accredited." The Portus realtime API is undocumented. **Do not read PdE directly.**
- The same buoys reach Copernicus with Copernicus licence attributes (`institution = "Puertos del Estado"`, `license = https://marine.copernicus.eu/...`). Whether the Copernicus redistribution grant overrides PdE's FAQ for display is a **user decision**: write to PdE, or accept the Copernicus licence as stated on the files.
- **Euskalmet** (Basque Meteorological Agency): Donostia buoy, Pasaia station and Bilbao station reach Copernicus at 07:00 to 07:10Z (lag 1.36 to 1.52 h). The direct Euskalmet API needs a registered key (opendata.euskadi.eus "api-euskalmet"; not used).
- **INTECMAR** Ribeira buoy (6201062): its 2026-11-10 Copernicus file carried no wave variables. The other INTECMAR buoys in the catalogue (Roncadoira, Salvora, Langosteira) are not live.
- **Test fetches** (Copernicus IBI latest):
  - Estaca de Bares 6200082, fetched 08:26:01Z: 07:00Z VHM0 2.81 m, VTPK 12.5 s, VMDR 250°. In the crawl at 08:31:10Z: VMDR 252°, lag 1.52 h. The two VMDR values are from two separate dumps of the same 07:00 row; the 08:31 crawl is the one recorded.
  - Gran Canaria 1300130, fetched 08:26:04Z: 07:00Z VHM0 1.88 m, VTPK 12.7 s, VMDR 333°.

### 1.6 Every live buoy (reporting within 24 h of its own fetch)
"Display" is the verdict used in the JSON. A buoy marked sheltered is never used as open-coast context.

#### Ireland
| Buoy | Owner | Lat, lon | Latest (UTC) | Lag at fetch (h) | Latest values | Display |
|---|---|---|---|---|---|---|
| M2 weather buoy | Marine Institute (with Met Eireann) | 53.484, -5.430 | 2026-11-10T07:00:00Z | 1.27 | Hs 1.172 m, Tp 5.508 s, peak dir 68.906°, Tz 4.102 s, Hmax 1.875 m | permitted |
| M3 weather buoy | Marine Institute (with Met Eireann) | 51.216, -10.548 | 2026-11-10T07:00:00Z | 1.27 | Hs 3.867 m, Tp 11.719 s, peak dir 196.875°, Tz 7.148 s, Hmax 6.25 m | permitted |
| M5 weather buoy | Marine Institute (with Met Eireann) | 51.690, -6.704 | 2026-11-10T07:00:00Z | 1.27 | Hs 2.93 m, Tp 10.547 s, peak dir 196.875°, Tz 6.094 s, Hmax 4.688 m | permitted |
| M6 weather buoy | Marine Institute (with Met Eireann) | 53.075, -15.881 | 2026-11-10T07:00:00Z | 1.27 | Hs 4.57 m, Tp 11.133 s, peak dir 150.469°, Tz 7.734 s, Hmax 6.563 m | permitted |

#### UK, France, Portugal, Spain
The full per-buoy rows (59 UK including 2 non-displayable third parties, 25 France including 3 not live, 5 Portugal, 23 Spain) are in `europe-sources.json` → `buoys[]` (`latestUTC`, `fetchedAt`, `lagH`, `latest`, `licence`, `display`). Summary:

| Country | Owner group | Live | Lag range (h) | Display |
|---|---|---|---|---|
| UK | Cefas WaveNet (incl. SEPA and power-station waveriders) | 21 | 0.84 | permitted (OGL, per-platform category unconfirmed) |
| UK | CCO / NNRCMP (incl. NE and NW regional programmes) | 36 | 0.84–1.81 | permitted (OGL + attribution sentence) |
| UK | Oil and Gas UK, Shell UK (19), EMEC Billia Croo, Met Office Sevenstones LV | 21 | 0.84–1.34 | not permitted (no stated licence) |
| FR | CANDHIS | 22 | 0.23–18.74 (one row 0.26 h in the future) | permitted (Licence Ouverte) |
| PT | Instituto Hidrografico / APRAM / Univ. Azores (OGC EDR) | 4 | 1.10–1.47 | non-commercial only (CC BY-NC 4.0) |
| PT | IH Nazare via Copernicus | 1 | 1.54 | licence conflict (owner CC BY-NC) |
| ES | Puertos del Estado via Copernicus | 20 | 1.52–3.53 | licence conflict (PdE FAQ) |
| ES | Euskalmet via Copernicus | 3 | 1.36–1.52 | permitted (Copernicus licence) |

Sheltered (never open-coast context): Morecambe Bay, Weston Bay, Minehead and Hinkley Point 3 (inner Bristol Channel), and Algeciras (Bay of Algeciras).

### 1.7 Coverage per country (nearest live, open-coast buoy)
| Country | Spots | Nearest live buoy, any licence: median km | ≤50 km | >150 km | Nearest **displayable** buoy ≤150 km: spots covered | median km |
|---|---|---|---|---|---|---|
| Ireland | 119 | 155.4 | 3 | 60 | 59 | 107.9 |
| UK | 436 | 26.0 | 321 | 3 | 433 | 26.7 |
| France | 219 | 31.2 | 162 | 0 | 219 | 31.2 |
| Portugal | 234 | 71.7 | 66 | 20 | 0 | — |
| Spain | 326 | 45.2 | 176 | 61 | 62 | 32.4 |

- Ireland: 51 of 119 spots have a UK (Cefas or CCO) buoy as their nearest. Donegal, Sligo, Mayo and Clare have nothing within 150 km. Bundoran's nearest is Blackstones, Scotland, at 192 km.
- Portugal: 20 Azores spots (São Miguel and Santa Maria) are over 150 km, since only Graciosa is live. If CC BY-NC is accepted, 182 of 234 spots are within 150 km (median 95 km).
- Spain: 61 spots over 150 km (Lanzarote, Fuerteventura and El Hierro). If PdE-via-Copernicus is accepted, 265 of 326 are within 150 km (median 45 km).

## 2. Tides

| Country | Source | Permission (verbatim where available) | Verdict |
|---|---|---|---|
| Ireland | Marine Institute `IMI_TidePrediction_HighLow` and `imiTidePrediction` (ERDDAP, keyless) | `license`: "Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/)" | **Wire.** |
| UK | CCO `tidepredictions` (API) | "made freely available under the terms of the Open Government Licence" plus the attribution sentence; key required | Permitted, **key needed** (free, form) |
| UK | UKHO Tidal API Discovery | "Usage licence subscription required" (api.gov.uk catalogue) | Not without subscribing |
| UK | NTSLF predictions | "© 2026 The National Oceanography Centre (NOC) or its partners owns copyright of the material available at this site, unless otherwise stated. All rights reserved." | **Not permitted** |
| UK | Environment Agency tide gauges (88, keyless) | "These APIs are provided as open data under the Open Government Licence ... this uses Environment Agency flood and river level data from the real-time data API (Beta)" | Observations only, not a prediction |
| France | SHOM SUP Marée / SAPM | "They are only available to authenticated users with a valid subsciption key which can be purchased on the Shom store" (https://services.data.shom.fr/support/en/node/4) | **Paid: not wired** |
| Portugal | IH portal `geodata/tides/getBmPm` and `getTidesByLocation` | HTTP 401 "Invalid API KEY"; tables sold at loja.hidrografico.pt | **Not keyless: not wired** |
| Portugal | IH `tide_obs_nrt` (OGC) | licence link `https://creativecommons.org/licenses/by-nc/4.0/` | Observations, non-commercial |
| Spain | Puertos del Estado | "under no circumstances is the transfer of the data to third parties permitted" | **Not permitted** |
| All | IOC Sea Level Monitoring | raw, "has not undergone any quality control" (see `Src-IOC-Sea-Level`) | Observations only |

**Ireland test fetch:** `IMI_TidePrediction_HighLow`, station `Lahinch`, fetched 08:18:04Z:
- 2026-11-10 05:15Z HIGH 1.91 m
- 11:25Z LOW -1.85 m
- 17:35Z HIGH 1.67 m
- 23:35Z LOW -1.696 m

The variable is `Water_Level_ODMalin`, with attribute `sea_level_datum = "OD Malin"`. The dataset summary says heights are "above local Lowest Astronomical Tide", which contradicts the variable's own attribute. The reader must label the datum from the variable attribute, OD Malin, and engineering should confirm with the Marine Institute.
- Coverage: 38 stations, some marked `_MODELLED` in the earlier catalogue. Every Irish spot is within 42.6 km of one (median 13.3 km). 11 Northern Ireland spots get Malin Head or Port Oriel at 47.5 km median. The CC BY licence allows this cross-border use; the label must say "Irish prediction station".
- **EA observed level, test fetch:** Newlyn E72239, fetched 08:30:33Z: 2026-11-10T07:45:00Z, 0.999 mAOD (15-min mean).

## 3. Model (Open-Meteo Marine)
**Not run**: "model check not run: Open-Meteo daily limit (429) on 2026-11-10" for all **1,334** spots.
- The marine API began answering HTTP 429 "Daily API request limit exceeded" during the sweep. On the lead's instruction it was not retried.
- The points to query are stored per spot (`model.pointsToCheck`). After 00:00 UTC, rerun with 25 coordinates per call at 1 call per second (161 calls for 4,002 points) and fill `model.status` with ok, partial or all-null per point.

## 4. Wind (METAR via IEM)
- **Network ids verified** against `https://mesonet.agron.iastate.edu/api/1/networks.json`:
  - PT__ASOS (19 stations), ES__ASOS (67), FR__ASOS (127), GB__ASOS (112, including EGJJ Jersey, EGJB Guernsey, EGJA Alderney and EGNS Isle of Man), IE__ASOS (10), GI__ASOS (1).
  - There is no JE__, GG__ or IM__ network.
- `currents.json?network=<id>` (fetched 08:29:42Z) gave fresh observations (within 6 h) for PT 16, ES 58, FR 104, GB 90, IE 5 and GI 1.
- Nearest fresh station per spot (any of the six networks, so cross-border is allowed):

  | Country | Median km | Max km | ≤40 km | >80 km | Most often nearest |
  |---|---|---|---|---|---|
  | Ireland | 62.5 | 162.3 | 39 of 119 | 44 | EINN Shannon 44, EIDL Donegal 41, EICK Cork 21 |
  | UK | 26.1 | 96.4 | 305 of 436 | 3 | EGHQ Newquay 49, EGOP 36, EGPC Wick 31 |
  | France | 22.1 | 71.3 | 189 of 219 | 0 | LFBZ Biarritz 44, LFBH La Rochelle 18 |
  | Portugal | 23.5 | 92.1 | 151 of 234 | 27 | LPFR Faro 39, LPST Sintra 37 |
  | Spain | 29.6 | 96.2 | 238 of 326 | 13 | LEAS Asturias 38; GCRR, GCFV, GCLP 36 each |

- Ireland is the weak case: only 5 of 10 IE stations had a fresh METAR, and the Mayo and Sligo coast falls back to Donegal or Shannon at 90 to 160 km.
- National met observation data:
  - **Met Eireann**: "Most datasets are available under a standard Creative Commons Attribution 4.0 licence" (met.ie open-data page), with a five-part attribution starting "Copyright Met Éireann". The keyless observation endpoint `prodapi.metweb.ie` is undocumented, and which licence covers it is not stated.
  - **Met Office DataHub**, **Météo-France portal** and **AEMET OpenData** each need a registered key (not used).
  - **IPMA** is keyless but non-commercial ("desde que dessa utilização não decorram finalidades lucrativas").

## Blockers and user decisions
1. **Open-Meteo land-cell check: partly run (2026-11-11 ~10:20 UTC), the rest waits for the daily reset.** `scripts/openmeteo-land-check.mjs` (resumable, 25 coordinates per call, 1 call per second) checked **600 of 1,334 app-marine points** (the app's own 0.08° seaward point, first because it is the one that matters; countries so far {'PT': 234, 'ES': 326, 'FR': 40}): **600 of 600 returned 24 of 24 non-null hours, no land cell**. Open-Meteo returns the nearest sea cell, so non-null does not mean near: the answering grid point was a median 3.6 km and at most 21.6 km from the asked point (31 spots, all Spanish, are over 10 km). It then hit the daily limit (429; shared by every local bulk job on this IP). The 2 km seaward points and the beach pins (the ones most likely to be land cells) are **not yet checked**. Rerun `node scripts/openmeteo-land-check.mjs` after 00:00 UTC (16:00 PST); it skips what is in `docs/forecast/data/europe-model-check.json`.
2. **Spain, Puertos del Estado:** the FAQ forbids transfer to third parties, while the same readings reach Copernicus under a licence that permits redistribution. The user decides: email PdE, or accept the Copernicus licence. Until then only the 3 Basque Euskalmet buoys are displayable.
3. **Portugal, IH CC BY-NC 4.0** on every buoy time series and tide observation. This is fine for today's private use (see the private-use decisions); a commercial launch needs IH permission.
4. **Tides outside Ireland** need either a free key (UK CCO; form request, domain-bound) or money (SHOM; UKHO above Discovery). Portugal's IH tide portal is keyed. Spain: none.
5. **CANDHIS API key** (free, by email) and **CCO API key** (free, by form): both are requests in SWELLO's name, so the user decides. The Cefas Summary endpoint is undocumented, and the licence category per Cefas platform needs confirming.
6. **CANDHIS SEM-REV row stamped in the future** and **Irish tide datum wording** (summary says LAT, variable says OD Malin): confirm with the owners before labels ship.
7. **Ireland's buoys are sparse.** The north-west coast has no buoy within 150 km, since M4 has been dead since March 2026 and AMETS since May 2026.

## Reproduce
The scripts were kept out of the repo, in the scratchpad. The method is above and every URL is listed.

Sources: the IEM networks and currents; the Marine Institute ERDDAP; the Cefas WaveNet Summary; the CCO public page; NDBC realtime2; the CANDHIS campaign pages (with curl; Python's TLS handshake to candhis.cerema.fr hung); the IH OGC API; the Copernicus STAC and anonymous S3 listing plus 31 IBI daily files read with ncdump; the EA flood-monitoring API; the EMODnet ERDDAP. All at about 1 request per second per host.
