# Surf-height sources: observed and official surf height at or near the break

Spec: `docs/specs/2026-11-11-overnight-surf-height.md`, stream S2. Researched 2026-11-10/11 using public pages and keyless APIs only. Requests were limited to 1 per second per host, with the User-Agent `SWELLO surf forecast prototype`. No logins, no accepted terms, no Open-Meteo. Every value below was fetched; nothing is estimated.

Per-spot coverage: `docs/forecast/data/surf-height-sources.json`. It covers the 1,078 spots parsed from `src/data/coast.ts` (`COAST_ROWS` + `UPGRADED_ROWS`).

## Verdicts at a glance

| Source | What it is | Spots covered | Licence | Verdict |
|---|---|---|---|---|
| NWS Surf Zone Forecast (SRF) | Official forecast of surf height (face, ft) per coastal zone, 1–3 issues a day | 1,040 spots in or ≤10 km from an SRF zone (787 in offices issuing now, 253 in seasonal offices) | Public domain | **Usable now** (as an official benchmark, not as observations) |
| CDIP / NDBC nearshore buoys (11–41 m) | Measured Hs, Tp and direction every 30 min | 14 spots ≤2 km, 46 spots ≤5 km, 98 spots ≤10 km of any gauge | CDIP: "may be redistributed and used without restriction"; NDBC: public domain | **Usable now** |
| Scripps Pier LJPC1 (CDIP 073) | Pier pressure sensor at 6.6 m depth, hourly Hs | 1 spot ≤2 km (Scripps), 5 spots ≤5 km | as above | **Usable now** |
| USACE FRF Duck NC (8 m array, surf-zone lidar gauges, 17 m buoy) | Research-grade surf-zone and nearshore waves, hourly | 1 spot ≤2 km (Duck Pier), 2 spots ≤5 km | Free redistribution, but "commercial purposes … prohibited without prior written permission" | **Usable now for private, non-commercial calibration**; **ask first** before commercial or public use |
| Lifeguard surf reports (LA County, San Diego, Newport, Volusia, Palm Beach, OCNJ, Hawaii) | Phone recordings, flag colours, or no published height | 0 | Copyrighted / silent | **Not usable** (no machine-readable observed height; nothing to scrape) |
| SafeBeachDay.com (ex-HawaiiBeachSafety.com) | Computed hazard levels, not lifeguard heights | 0 | ToS forbids copying and mirroring | **Not usable** |
| NWS Local Storm Reports (HIGH SURF) | Impact reports, almost never a height | ~0 | Public domain | **Not usable** for calibration |
| NWS Honolulu Collaborative Surf Discussion (SRDHFO) | Surf-zone H1/3 and H1/10 forecasts for Oahu | Oahu | Public domain | **Not usable now**: last issued 2020-12-30 (archive only) |
| IEM AFOS archive of SRF | Years of past SRF text | as SRF | Public domain (NWS text) | **Usable now** for backfill |

---

## 1. NWS Surf Zone Forecast (product SRF)

**What it is.** A text forecast per coastal zone with a `Surf Height` line per period: today or tonight, then the next day, plus extended lines at some offices. Heights are in feet and are **face heights of the breaking waves**. The HFO legend says: "Surf: Height of the surf from trough to crest (face value) in feet". It also says: "Surf larger than the upper end of the range provided in the forecast will occur periodically". This is an official forecast, not an observation.

**Access.**
- `https://api.weather.gov/products/types/SRF/locations` lists the offices issuing now.
- `https://api.weather.gov/products/types/SRF/locations/<WFO>` lists that office's products from the last ~7 days.
- `https://api.weather.gov/products/<id>` returns the product; the text is in `productText`.

The API keeps about 7 days. The full history is in the IEM AFOS archive, for example `https://mesonet.agron.iastate.edu/cgi-bin/afos/retrieve.py?pil=SRFSGX&limit=1&fmt=text`, which also accepts `sdate`, `edate` and `order=asc`.

**Licence.** https://www.weather.gov/disclaimer says: "The information on National Weather Service (NWS) Web pages are in the public domain, unless specifically noted otherwise, and may be used without charge for any lawful purpose so long as you do not: claim it is your own …, use it in a manner that implies an endorsement or affiliation with NOAA/NWS, or modify its content and then present it as official government material." Display rule for SWELLO: label it "NWS Surf Zone Forecast" and never restyle it as our own number.

**Offices and schedule** (checked 2026-11-11; the issue count is products in the last 7 days from the API):

| Office | Issues/7 d | Zones in latest product | Year-round? |
|---|---|---|---|
| SGX San Diego | 14 | CAZ552 Orange County, CAZ043 San Diego County | yes (issued Jan 2026) |
| LOX Los Angeles | 17 | CAZ362/364 Malibu + LA County Beaches, CAZ354 Ventura, CAZ349/350 SB SW/SE, CAZ340/346 SLO + SB Central | yes |
| MTR Bay Area | 73 | CAZ505 Sonoma/Marin, CAZ509 SF/San Mateo, CAZ529 Santa Cruz, CAZ530 Monterey Bay/Big Sur | yes |
| EKA Eureka | 30 | CAZ101 Del Norte, CAZ103 N Humboldt, CAZ109 Mendocino | issuing now; none 2026-01-10..20 |
| MFR Medford | 18 | ORZ021, ORZ022 (Reedsport–Brookings) | yes |
| PQR Portland | 7 | WAZ201 Long Beach WA, ORZ101–103 (Seaside to Lincoln City) | yes |
| HFO Honolulu | 22 | Kauai, Oahu, Maui (+Kahoolawe), Big Island windward/leeward (25 zones) | yes |
| SJU San Juan | 18 | PRZ001–013 (10 PR zones), VIZ001–002 | yes |
| BOX Boston | 13 | MA and RI coastal zones (11) | yes |
| CAR Caribou | 14 | MEZ029–030 | issuing now; none 2026-01-10..20 |
| JAX, MLB, MFL, TBW, TAE, MOB, CRP, BRO | 7–29 | NE/E/SE/W FL, Panhandle, AL, S Texas | yes |
| OKX, PHI, AKQ, MHX, ILM, CHS, GYX | 0 now | NY/NJ/DE/MD/VA/NC/SC/GA/ME/NH (from the last product in the IEM archive) | **seasonal**. 2026 runs: OKX May 21–Sep 27, PHI May 15–Sep 30, AKQ May 15–Oct 11, MHX Apr 3–Oct 31, ILM Apr 1–Oct 31, CHS Mar 24–Oct 31, GYX Apr 15–Oct 12. The MHX final product says "discontinued until April, 2027". |
| SEW, AJK, HGX, LCH, LIX, KEY | none | none | No SRF in the API or IEM (SEW's last was 2012) |

**Format.** Parsed from real products issued 2026-11-10/11:
- SGX CAZ043: `Surf Height...................4 to 7 feet.`, next `3 to 5 feet.` CAZ552: `3 to 5 feet. Sets to 6 feet.`
- LOX CAZ340/346: `Surf Height...................Northwest Facing Beaches - 7 to 10 feet.` / `Southwest Facing Beaches - 3 to 6 feet.`
- MTR CAZ505 and EKA CAZ101: also split by beach facing (`Northwest Facing Beaches - 7 to 11 feet.`, `West Facing Beaches - 11 to 15 feet.`)
- MFR ORZ021: `Surf Height...................14 FT.` (a single number). PQR WAZ201: `14 to 18 ft.`
- MLB/JAX/MFL/SJU: `Surf Height.................Around 3 feet.`, `1 foot or less.`
- BOX: the line is split by coast (`Surf Height...` then `East Coast...............Around 4 feet.`). Extended periods are prose (`.FRIDAY...Surf height 8 to 9 feet.`).
- CAR: `Surf........................Around 2 feet.`
- HFO: a table per island by shore facing and half-day:
  ```
  Shores                  Surf                       Surf
                       PM     AM                  AM     PM
  North Facing         6-8   8-12               14-18  15-20
  West Facing          4-6    5-7                9-12  10-15
  South Facing         1-3    1-3                 2-4    2-4
  East Facing          3-5    3-5                 4-6    5-7
  ```

A parser needs four shapes: a single line, lines split by beach facing, lines split by coast name, and the HFO table. To pick the line for a spot, use its `seaward` bearing from `coast.ts`.

**Spot mapping** (method: UGC codes expanded from the products; each zone polygon from `api.weather.gov/zones/forecast/<id>`; distance from the spot to the polygon, 0 = inside):
- 1,040 of 1,078 spots map to an SRF zone: 160 are inside a polygon, 872 are within 2 km (beach points sit just seaward of land-zone polygons), 7 are within 5 km and 1 is within 10 km.
- By office: AKQ 13, BOX 64, CHS 29, CRP 8, EKA 43, GYX 31, HFO 142, ILM 34, JAX 40, LOX 123, MFL 39, MFR 10, MHX 41, MLB 57, MOB 11, MTR 72, OKX 43, PHI 62, PQR 28, SGX 81, SJU 43, TBW 26.
- 253 of those spots are in seasonal offices (Northeast and Mid/South Atlantic), so there is no SRF until spring 2027.
- `CAZ364` (LA County Beaches) returns 404 from api.weather.gov. Its 24+ LA spots are assigned by county (`km: null`). It shares one SRF segment with CAZ362.
- No SRF (38 spots): Sitka 10, WA Clallam/Grays Harbor/Jefferson/Island 15, Molokai 5, Lanai 4, Niihau 1, Florida Keys 1, Louisiana 1 (Chandeleur), plus 1 NY Long Island Sound spot.
- Catalogue issue seen while mapping (not fixed, no `src/` edits): `w-usw-abalone-cove-beach`, `w-usw-palm-point`, `w-usw-royal-palms-the-jetty` and `w-usw-cabrillo-point` sit on the Palos Verdes / San Pedro coast (LA County) but have region `Orange County`.

**Latency and cadence.** Typically issued around 3–4 AM and 1–4 PM local, with updates as needed (MTR issued 73 products in 7 days). The API had each product within minutes of issue.

**Verdict: usable now** as the official forecast benchmark. It is a forecast, so it is not ground truth. Comparing against it measures SWELLO against the government's surf-height call, and it is the only surf-height (not Hs) product covering nearly every spot.

---

## 2. Surf-zone and nearshore gauges

All wave stations reporting WVHT on 2026-11-11 (NDBC `latest_obs.txt`, 237 stations) were checked against every spot. Depth comes from CDIP THREDDS `metaWaterDepth` or the NDBC station page. Stations deeper than 45 m are excluded as offshore.

**Access**
- NDBC realtime: `https://www.ndbc.noaa.gov/data/realtime2/<STN>.txt` (and `.spec` for swell/wind-sea split). Keyless, about 45 days of history, updated every 30–60 min.
- CDIP realtime netCDF (OPeNDAP): `https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/realtime/<NNN>p1_rt.nc`. Archive: `.../cdip/archive/<NNN>p1/`.
- CDIP licence (netCDF global attribute, e.g. `…/201p1_rt.nc.das`): **"These data may be redistributed and used without restriction."**
- NDBC: covered by the NWS public-domain disclaimer (`ndbc.noaa.gov/disclaimer.shtml` redirects there).
- Latency test: the 46254 last record was 05:56Z, seen at 06:25Z (≈30 min). The LJPC1 latest was 05:20Z.

**Gauges within 5 km of a spot** (≤2 km / ≤5 km counts are the number of spots whose nearest gauge in that class it is):

| Station | Where | Depth | Measures | Spots ≤2 km / ≤5 km | Latest test value (2026-11-11) |
|---|---|---|---|---|---|
| LJPC1 / CDIP 073 | Scripps Pier, La Jolla | 6.6 m | pressure, Hs + Tp, hourly | 1 / 5 (`cs-scripps`, 0.09 km) | WVHT 1.0 m, DPD 12 s, 05:20Z |
| 46254 / CDIP 201 | Scripps Nearshore | 41 m | Datawell buoy, directional spectra | 2 / 5 | 1.0 m |
| 46266 / CDIP 153 | Del Mar Nearshore (USACE) | 17 m | directional buoy | 3 / 6 | 1.1 m |
| 46274 / CDIP 262 | Leucadia Nearshore | 17 m | directional buoy | 3 / 10 | 1.0 m |
| 46285 / CDIP 284 | Capistrano Beach Nearshore | 11.1 m | directional buoy | 1 / 3 (Doheny 1.7 km) | 0.8 m |
| 46268 / CDIP 103 | Topanga Nearshore | 20 m | directional buoy | 1 / 3 | 0.7 m |
| 46286 / CDIP 285 | Avila Beach Nearshore | 15 m | directional buoy | 1 / 3 | 0.7 m |
| 41115 / CDIP 181 | Rincon PR (CariCOOS) | 32.9 m | directional buoy | 2 / 9 | 0.8 m |
| 41121 / CDIP 249 | Arecibo PR | 32 m | directional buoy | 0 / 2 | 1.1 m |
| 51211 / CDIP 233 | Pearl Harbor entrance HI | 35 m | directional buoy | 0 / 2 | 0.8 m |
| 44056 / CDIP 433 | Duck FRF 17 m | 18 m | directional buoy | 0 / 1 (Duck Pier 3.8 km) | 0.5 m |
| 42034 | UTMSI Port Aransas TX (Spotter) | 12 m | Spotter buoy | 0 / 1 | 0.9 m |

The following are 5–10 km from the nearest spot and still useful as nearshore inputs: 41113/CDIP 143 Cape Canaveral (9.8 m, 5.5 km), 41122/CDIP 265 Hollywood FL (15.6 m, 5.5 km), 46275 Red Beach (16.8 m), 46256 Long Beach Channel (23 m), 46278 Tillamook (29 m), 46243 Clatsop Spit (25 m), CORMP 41065/41067/41110 SC/NC (11–17 m), 46237 SF Bar (16.5 m).

**All of these measure Hs (spectral significant height) seaward of the break, not breaker height.** LJPC1 at 6.6 m is the only one in water shallow enough to be close to the outer surf zone on big days.

**USACE Field Research Facility, Duck NC**
- THREDDS: `https://chldata.erdc.dren.mil/thredds/catalog/frf/oceanography/waves/catalog.xml` (the old `chlthredds` host redirects here).
- Gauges with a 2026-11 file: `8m-array`, `awac-11m`, `waverider-17m`, `lidarWaveGauge080/090/100/110/140` and `lidarWaveRunup`.
  - The lidar gauges are virtual gauges at 80–140 m cross-shore, inside the surf zone, from a tower-mounted scanner.
  - Inactive gauges: `awac-4.5m` and `awac-6m` (ended 2023–24) and the xp pier gauges (ended 2017–2020).
- Variables: `waveHs`, `waveTp`, `waveTm` and spectra (lidar also gives `waveHsIG` and `waveHsTotal`).
- Test 2026-11-11:
  - 8m-array: `waveHs` 0.48, 0.44, 0.43 m at 03:00–05:00Z (hourly, about 1 h latency).
  - lidarWaveGauge080: the last 4 hours were `-999.99` (fill value).
  - lidarWaveGauge110 and 140 had valid values over the last 44 hours.
- Licence (global attribute): **"These data may be redistributed and used without restriction. Data are intended for scholarly use by the research community, with the express agreement that users will properly acknowledge the USACE Field Research Facility … Use or reproduction of these data for commercial purposes is prohibited without prior written permission."**
- Spot coverage: `w-us-duck-pier` (≤2 km of the 8 m array and the lidar gauges). Within 5 km: 2 spots.
- Verdict: the best surf-zone truth in the US, but at one site. Fine for SWELLO's current private, non-commercial use with acknowledgement. **Ask FRF** (frfwebmaster@usace.army.mil, which is the publisher's address, not ours) before any commercial launch.

**Not found or not usable:**
- **NOS CO-OPS** pier stations publish water level and met data, but no wave height.
- **USGS** coastal wave sensors are storm-deployment pressure sensors with no realtime feed.
- **Sofar Spotter** public data needs an API token.
- **CDIP MOP** nearshore nowcasts are model output, so not observations. They could be a baseline later (same CDIP licence).

---

## 3. Lifeguard surf reports (observed heights)

| Agency | What is published | Machine-readable height? | Terms | Verdict |
|---|---|---|---|---|
| San Diego Lifeguards (sandiego.gov/lifeguards) | "For recorded beach weather, surf, and dive conditions, call 619-221-8824." | No (phone recording) | none | Not usable |
| Newport Beach Lifeguards (newportbeachca.gov/lifeguards) | Phone report 949-644-3171, "updated daily at 7:30 a.m. and 2:00 p.m."; links to Surfline and SafeBeachDay | No | footer "All Rights Reserved" | Not usable |
| Imperial Beach (imperialbeachca.gov/320) | Links only (Surfline pier report, NWS) | No | none | Not usable |
| LA County Fire Lifeguards (fire.lacounty.gov) | No conditions page found; advice is to ask the tower; social posts | No | none | Not usable |
| Volusia County FL (volusia.org daily beach report) | Date, flag status, rescues, shark bites. No surf height. | No | "All Rights Reserved, © 2026 Volusia County" | Not usable |
| Palm Beach County FL (discover.pbc.gov Daily Beach Conditions) | Template with a "surf conditions" field per day; page 404 on 2026-11-11, so unverified | Unverified | not checked | Not usable (could not verify) |
| Ocean City NJ Beach Patrol (ocnj.us/OCBP) | Daily advisory + links to forecasts and a wave cam; no height | No | none | Not usable |
| Hawaii Ocean Safety → HawaiiBeachSafety.com → SafeBeachDay.com | Now run by Watchtower. Shows **computed** hazard levels ("we calculate hazard levels"), "informational only and not always real-time" | No lifeguard heights | ToS (yourwatchtower.com/safe-beach-day/terms-of-service): may not "modify, copy, prepare derivative works of …" or "mirror" the materials; only "one copy … for personal, non-commercial transitory use" | Not usable |

No lifeguard service checked publishes an observed surf height in a reusable form, so **nothing is planned for scraping**. Two routes could still work, and both need the user:
- ask an agency directly (Newport and San Diego record heights twice a day by phone);
- use SWELLO users' own session reports.

---

## 4. Other public observed or official datasets

- **IEM AFOS archive** (`mesonet.agron.iastate.edu/cgi-bin/afos/retrieve.py?pil=SRF<WFO>`): years of past SRF text. It allows backfilling an "official forecast" record for any date at once, with no waiting. Usable now (NWS text is public domain; IEM is a public mirror).
- **NWS Honolulu SRDHFO** (Collaborative Nearshore Swell and Wind Forecast, Pat Caldwell): it gave surf-zone `H1/3` and `H1/10` for Oahu shores. The last issue was 2020-12-30 ("updated Monday through Friday … when Pat Caldwell is available"). Historical only.
- **NWS Local Storm Reports** (IEM `geojson/lsr.geojson`): HIGH SURF reports are impact descriptions (road closures, inundation) with no magnitude. Not usable for calibration.
- **CDIP archive** (`thredds.cdip.ucsd.edu/thredds/catalog/cdip/archive/`): decades of nearshore Hs for the stations above. Same unrestricted licence. Usable for back-testing.

---

## Ranked plan: the best "truth" for calibrating SWELLO's surf estimate

1. **Measured nearshore Hs at the gauges within 2 km (CDIP/NDBC + LJPC1), recorded every 30–60 min.** This is the most reliable truth because it is a measurement, licence-clean and low-latency. The SoCal cluster gives the most usable pairs: Scripps/LJPC1, Del Mar, Leucadia, Capistrano/Doheny, Topanga, Avila. Rincon PR and Pearl Harbor add other climates.
   - Compare like with like: SWELLO's **modelled Hs at the gauge point** against the measured Hs (bias, RMSE, by period band), timed to the hour.
   - Then transform both to breaker height with the same formula, e.g. Komar & Gaughan Hb = 0.39·g^0.2·(T·H0²)^0.4 using the measured Tp, and check SWELLO's face-height range against it.
   - Score the surf transform separately from the offshore model error.
2. **NWS SRF surf height, recorded at each issue (about twice a day) and backfilled from IEM.** It is official and covers 787 spots now, 1,040 in season.
   - It is a forecast range of face height for the day's larger breaking waves, by zone and beach facing.
   - Compare SWELLO's daytime maximum (local 7 AM–5 PM) face-height range for the same period: overlap of the ranges, midpoint difference, and the share of SWELLO midpoints inside the NWS range.
   - Pick the facing line using the spot's `seaward` bearing. Treat "Sets to N" as above the range.
   - This measures agreement with the official forecast, not accuracy. Where SRF and the gauges disagree, the gauges win.
3. **USACE FRF Duck surf-zone gauges, hourly.** This is the only true surf-zone measurement: the lidar virtual gauges at 80–140 m cross-shore and the 8 m array. It gives the empirical ratio of breaker height to offshore Hs to calibrate the transform used in step 1 (East Coast, beach break).
   - Licence: non-commercial only. Fine now; ask before launch.

**Timing rules**
- Gauges are spectral averages over about 30 min. Match each to the forecast hour and use a 3 h mean on both sides to remove noise. The travel time from a 17 m gauge to the break is minutes, so no lag is needed.
- SRF periods are daytime blocks (".THIS AFTERNOON THROUGH WEDNESDAY", ".THURSDAY"). Match them to the SWELLO forecast made at, or just before, the SRF issue time so lead times are comparable.
- Never present NWS or gauge numbers as SWELLO's own. Label the source on any surface that shows them.

## Start recording tonight (S3)

Each loop is keyless and public. Write to `~/Development/swello-data/`.

1. **Gauges, hourly**
   - `https://www.ndbc.noaa.gov/data/realtime2/{LJPC1,46254,46266,46274,46285,46268,46286,41115,41121,51211,44056,41113,41122}.txt`, plus `.spec` for the same stations.
2. **NWS SRF, every 6 h**
   - For each WFO in BOX BRO CAR CRP EKA HFO JAX LOX MFL MFR MLB MOB MTR PQR SGX SJU TAE TBW: fetch `https://api.weather.gov/products/types/SRF/locations/<WFO>`, then `https://api.weather.gov/products/<id>` for each id not seen yet.
   - Keep the raw `productText`. Parse later.
3. **FRF Duck, hourly**
   - OPeNDAP `https://chldata.erdc.dren.mil/thredds/dodsC/frf/oceanography/waves/8m-array/2026/FRF-ocean_waves_8m-array_202611.nc.ascii?time,waveHs,waveTp`
   - The same for `lidarWaveGauge110` with `time,waveHs,waveHsTotal,waveTm`.
   - Roll the file name monthly.
