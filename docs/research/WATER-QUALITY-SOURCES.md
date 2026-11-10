# Beach water-quality sources (spec 2026-11-10 item 4)

Research only, done 2026-11-10. Every endpoint below was fetched that day: keyless, public, UA `SWELLO surf forecast prototype`, about 1 request per second. No logins, no terms accepted. Per-spot nearest stations are in `docs/forecast/data/water-quality-sources.json`.

Spot set: 489 rows in `src/data/coast.ts` (482 `COAST_ROWS` + 7 `UPGRADED_ROWS`). The brief said 492, so 3 spots must live outside that file; they are not covered here.

## Verdict summary

| Source | Verdict | What it gives | Latest data seen | Our spots ≤1 km / ≤3 km |
|---|---|---|---|---|
| Hawaii DOH Clean Water Branch (eha-cloud) | **Usable** (display with link; endpoint undocumented) | Open advisories (beach, brown water, sewage) with polygons; enterococcus and C. perfringens results | Advisory posted 2026-11-07; sample analysed 2026-11-06 | 126 / 132 of 152 |
| North Carolina DEQ Recreational Water Quality (ArcGIS) | **Usable** | Per-station advisory status, enterococcus results | Sample 2026-11-09 | 41 / 52 of 54 |
| New Jersey DEP CCMP (njbeaches.org API) | **Usable** (seasonal) | Status counts, results CSV, incidents (advisory/closure) CSV with lat/lon | Results 2026-09-28; all beaches "closed for season" now | 25 / 27 of 28 |
| South Carolina DES Beach Monitoring (ArcGIS) | **Usable** (seasonal) | Station list with long-term advisory flag, temporary advisories layer, last sampling date | Sampling 2026-09-29; temporary advisories layer empty now | 11 / 13 of 15 |
| Georgia DNR Healthy Beaches (GeoJSON) | **Usable** | Per-beach status colour, sample date, enterococcus, permanent-advisory flag, polygon | File regenerated 2026-11-10 17:00 GMT; samples to 2026-10-21 | 7 / 7 of 8 |
| California BeachWatch via data.ca.gov "Surface Water FIB Results" | **Usable for results only** (not current postings) | Bacteria results per station with lat/lon and 30-day/6-week geomeans | Samples to 2026-10-28; resource updated 2026-11-09 | 69 / 78 of 85 |
| Washington Ecology BEACH (ArcGIS) | **Usable, thin** | Only beaches with an ongoing action (advisory, closure, permanent advisory); no results | 9 ongoing actions today | 3 / 3 of 4 |
| Florida DOH Healthy Beaches | **Partial: link-out only** | Station locations (keyless ArcGIS) plus a per-station results page link; results are not exposed as data | Layer edited 2026-10-14 | 77 / 99 of 107 (stations, not data) |
| California BeachWatch advisories (data.ca.gov, ODC-BY) | Not usable for current status | Postings and closures | Last advisory 2026-03-06 (stale) | n/a |
| CA county sites (SD sdbeachinfo, OC ocbeachinfo, LA County DPH) | Not usable | Live status only in JS apps behind bot protection (OutSystems, Incapsula, 202 challenge) | n/a | n/a |
| Oregon OHA Beach Monitoring | Not usable (HTML only; season ended) | SharePoint pages per coast region | "The 2026 monitoring season has ended." | 0 of 10 |
| Virginia VDH | Not usable (Tableau Public dashboard) | n/a | n/a | 0 of 9 |
| New York (Suffolk/Nassau/State Parks) | Not usable (HTML, hotline; state beach map URL returns 404) | NYC Open Data has samples but only for NYC beaches, none near our 13 Long Island spots | n/a | 0 of 13 |
| Massachusetts DPH, Rhode Island RIDOH | Not usable (dashboard, annual files, HTML tables) | n/a | n/a | 0 of 4 |
| EPA BEACON 2.0 / Water Quality Portal | Not usable for status | BEACON holds state-reported annual data; WQP had only 39 Florida enterococcus results since 2026-09-01, none from the DOH beach program | n/a | n/a |
| Swim Guide, Heal the Bay Beach Report Card | Not usable | NGO aggregators. Swim Guide: no reuse terms found, trademarks owned by Swim Drink Fish Canada. Heal the Bay reports are "All Rights Reserved" | n/a | n/a |

**Coverage:** 282 of 489 spots have a station from a data source (HI, NC, NJ, SC, GA, CA, WA) within 1 km, and 312 within 3 km. Counting Florida's link-only stations as well raises this to 359 and 411. With no source at all: Oregon (10), New York (13), Virginia (9), Massachusetts (2), Rhode Island (2), and parts of California (7 spots beyond 3 km).

Nearest-station caveat: a station within 1 km can still be the wrong water. For example, Mavericks' nearest station is inside Pillar Point Harbor (0.69 km). Eng should build a hand-checked `spot → station` mapping from the JSON instead of joining by distance alone.

## Per source

### Hawaii: DOH Clean Water Branch (eha-cloud.doh.hawaii.gov/cwb)
- **Endpoints** (JSON, keyless; these are the public site's own REST calls, undocumented):
  - `GET https://eha-cloud.doh.hawaii.gov/cwb/api/events`: events, 500 per page, newest first. Fields: `id, type` (Beach Advisory, Brown Water Advisory, Permit Exceedance, sewage…), `status` (Open/Closed), `postedDate`, `postedDateHst`, `title`, `locationName`, `cause`; Beach Advisories also carry `station`, `sampleDate`, `sampleValue`, `signPostedDate`. Today: 18 Open (15 brown water, 2 beach advisory, 1 permit exceedance).
  - `GET …/cwb/api/events/{id}`: adds `locations[].geometry`, a WKT polygon for area advisories (brown water covers coast stretches such as "Hilo bay and along the Hamakua coast"). Use point-in-polygon against the spot.
  - `GET …/cwb/api/stations?take=1000`: 547 active marine stations, WKT point in `locations[0].geometry`.
  - `GET …/cwb/api/beaches?take=1000`: 419 beaches with start/end lat/lon and EPA id.
  - `GET …/cwb/api/sample-test-results?stationId={id}&take=N`: results (enterococcus, C. perfringens) with analysis dates.
- **Latency:** advisories are posted within about 1 day of the lab result. Example: Kalapaki was sampled 2026-11-05, analysed 2026-11-06, and its advisory posted 2026-11-07. Brown-water advisories are posted the same day.
- **Records hold staff email addresses** (`createdBy`/`updatedBy`). Never store or show them.
- **Terms:** none on the app. health.hawaii.gov footer: "Copyright © 2026, State of Hawaii. All rights reserved." The state's CWB data mirror on PacIOOS ERDDAP (`cwb_water_quality`, which stopped at 2024-06-13) states: "The data may be used and redistributed for free but is not intended for legal use, since it may contain inaccuracies. Neither the data Contributor, University of Hawaii, PacIOOS, NOAA, State of Hawaii nor the United States Government … makes any warranty". Show only facts (advisory type, status, posted date, sample date/value) with a link back. Ask CWB (cleanwaterbranch@doh.hawaii.gov) before any public launch, because the endpoint is undocumented and can change.
- **Attribution:** "Hawaiʻi Department of Health, Clean Water Branch", linking to https://eha-cloud.doh.hawaii.gov/cwb/.

### North Carolina: DEQ Division of Marine Fisheries, Recreational Water Quality
- **Service:** `https://services2.arcgis.com/kCu40SDxsCGcuUWO/arcgis/rest/services/PUBLICVIEWRecreationWaterQualityDatabase/FeatureServer`, behind the public "Recreational Water Advisory Status Map" dashboard.
  - Layer 0 `Monitoring_Stations` (229, 226 active): `ASN`, `DESCRIPTIO`, `LATITUDE/LONGITUDE`, `Status` (today 219 "No Advisory", 10 "Precautionary"), `LOCATION` (OCEAN/ESTUARY), `EPA_ID`.
  - Table 1 `Monitoring`: enterococcus results (`TextDate`, `MPN`, `ASN`). Newest is 2026-11-09, edited 2026-11-10.
  - Table 3 `Notifications`: EPA beach notification records.
- **Query:** `…/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=json`. Keyless.
- **Terms:** none on the ArcGIS item (licence field empty). It is a state agency public view. Show status and date with a link and attribution; confirm with DEQ before launch.
- **Attribution:** "NC DEQ Division of Marine Fisheries, Recreational Water Quality Program", linking to https://www.deq.nc.gov/about/divisions/marine-fisheries/shellfish-sanitation-and-recreational-water-quality/recreational-water-quality.

### New Jersey: DEP Cooperative Coastal Monitoring Program (njbeaches.org)
- **API host** `https://beachapi.njdep.rutgers.edu/api/` (CORS `*`, keyless for the `public/` paths):
  - `public/beaches/statuses/legend`: counts by status. Today: all 499 beaches "not yet open / closed for season".
  - `public/data/download/waterQuality?program=4&startDate=YYYY-MM-DD&endDate=…`: CSV with `Station_Name, Beach_Name, Lat_DD, Lon_DD, Result_Date, Result_Measure, Units_Name` (enterococcus). The 2026 season had 4,200 results at 343 stations; the last was 2026-09-28.
  - `public/data/download/incident/?program=4&…`: CSV of advisories and closures (`Incident_Start_Date, Incident_End_Date, Beach_Act_Type_Name` e.g. CONTAM_ADV, `Beach_Reason_Type_Desc`) with lat/lon.
  - The per-beach current list (`beach/list/`) needs a login. Current per-beach status must come from open incidents (no end date) in the incident CSV.
- **Season:** Memorial Day to Labor Day. Off-season, show "Not monitored until the 2027 season", never "clean".
- **Terms:** nj.gov's disclaimer page is a client-side redirect, so no licence text was read. Treat as state public information: facts plus a link, and confirm with NJDEP before launch.
- **Attribution:** "NJDEP Cooperative Coastal Monitoring Program", linking to https://njbeaches.org/.

### South Carolina: Department of Environmental Services, Beach Monitoring
- **Service:** `https://gis.des.sc.gov/gisserver/rest/services/OCRM/BeachMonitoring/MapServer`, used by the S.C. Beach Access Guide.
  - Layer 1 `beachmon` (122 stations): `STATION, LOCATION, BEACH_NAME, LATITUDE, LONGITUDE, EPA_ID, Advisory` ("Long-Term" ×21, "No Advisory" ×101).
  - Layer 8 `Temporary_Advisories`: `StationName, beachName, adv`. Empty today because the season is over.
  - Table 9 `Beach_Sampling`: `samplingDate` (latest 2026/9/29) and `PercentEx`.
  - Layers 5/6: advisory extent lines.
- **Season:** routine monitoring runs May to October. Long-term advisories are year-round.
- **Terms:** no licence text found on the service or des.sc.gov. Show facts with a link and confirm before launch.
- **Attribution:** "SC Department of Environmental Services, Beach Monitoring", linking to https://des.sc.gov/programs/bureau-water/aquatic-science/beach-monitoring.

### Georgia: DNR Coastal Resources Division, Healthy Beaches
- **File:** `https://webapp.gadnr.org/beach/working/beach.geojson`. It is the source of both layers of the public Experience map. It was regenerated today (Last-Modified 2026-11-10 17:00 GMT).
- **Contents:** 37 polygons. Properties: `beachName, beachId (EPA), stationCode, status` (Green 26 / Yellow 4 / Gray 7), `dateCollected` (to 10/21/2026), `entero`, `permanentAdvisory`.
- **Status colours:** use the DNR's own meaning from the map legend; do not invent new ones. Per the DNR, the program "never closes beaches"; it issues advisories only.
- **Terms:** none on the ArcGIS item. Show facts with a link and confirm before launch.
- **Attribution:** "Georgia DNR Coastal Resources Division and Coastal Health District", linking to https://coastalgadnr.org/HealthyBeaches.

### California: State Water Board BeachWatch, results via data.ca.gov
- **Dataset:** "Surface Water – Fecal Indicator Bacteria Results", resource `15a63495-8d9f-4a49-b43a-3092ef3106b9` (2020 to present). CKAN API, keyless:
  - `https://data.ca.gov/api/3/action/datastore_search?resource_id=…&filters={"Program":"BeachWatch"}`, or `datastore_search_sql`.
  - Fields: `StationCode, StationName, SampleDate, Analyte, Result, Unit, TargetLatitude, TargetLongitude, GeoMean_30Day, GeoMean_6Week, ParentProject` (the county).
  - The Water Quality Monitoring Council's Safe to Swim map reads this same dataset.
- **Latency:** the resource was updated 2026-11-09. Latest sample by county: LA 10-28, Santa Cruz 10-28, SD 10-27, Marin 10-27, Ventura 10-27, SB 10-26, Humboldt 10-26, OC 10-21, Monterey/San Mateo/SLO/Sonoma 10-19, SF 09-29. That is roughly a 1–3 week lag.
- **It gives results, not postings.** Show "Last sample <date>: Enterococcus <n> MPN/100 mL (county program)". Never call the beach open or safe from it.
- **Current postings and closures** are not machine-readable statewide. The postings dataset `d5cd6a23-…` (Open Data Commons Attribution, "ODC-BY") stops at 2026-03-06. The live statewide view is a Tableau dashboard, and county sites block scripted access. Link to the county page for the current status.
- **Terms:** Water Boards conditions of use: "In general, information presented on this web site, unless otherwise indicated, is considered in the public domain." (https://waterboards.ca.gov/conditions_of_use.html). The FIB dataset's package shows no licence; the sibling BeachWatch package is ODC-BY. Attribute either way.
- **Attribution:** "California State Water Resources Control Board, BeachWatch (data.ca.gov)", plus the county agency name from `ParentProject`.

### Washington: Ecology and DOH BEACH program
- **Service:** `https://gis.ecology.wa.gov/serverext/rest/services/GIS/ECY_Identify/MapServer/10` ("Beach Status 1"). It returns only beaches with an ongoing action: `dbo.View_OngoingActions.BeachActionTypeCode` (ADVISORY, CLOSURE, PERM_ADVISORY) and `ActionDescription`. Today there are 9.
- **Monitored-beach locations:** layer 41 rows where `MONITORED_YEAR` is set (146). That field looks like the year monitoring began, and whether each beach is sampled in 2026 is unknown. Hobuck, First Beach and Westhaven are within 0.2 km of our spots.
- **No results** in the service. Season: Memorial Day to Labor Day.
- **Terms:** not checked beyond the service. It is a public state map service; attribute "Washington State Department of Ecology, BEACH Program" and link to https://ecology.wa.gov/beach.

### Florida: DOH Healthy Beaches (partial)
- **Stations:** `https://services1.arcgis.com/CY1LXxl9zlJeBuRZ/arcgis/rest/services/FloridaBeachSamplingPoints/FeatureServer/0` (419 points, 352 active). Fields: `County, EPAbeachID, STORET_Sta, SPLocation, SPLat, SPLong, Link`. Keyless; last edited 2026-10-14.
- **Results and advisories** appear only on `Link` (floridahealth.gov beach-detail page), which renders them client-side through a nonce-protected WordPress AJAX call. No public data endpoint was found. WQP has no current DOH beach results.
- **Item terms (verbatim):** "This product is for reference purposes only and is not to be construed as a legal document. Sample locations are subject to change without notice. Any reliance on the information contained herein is at the user's own risk. The Florida Department of Health and its agents assume no responsibility for any use of the information contained herein or any loss resulting therefrom."
- **Use:** a "Florida DOH sampling results for <site>" link only, with no status shown.

### Not usable (why)
- **CA counties.** sdbeachinfo.com redirects to an OutSystems app (internal API). ocbeachinfo.com answers HTTP 202 with a bot challenge. LA County DPH sits behind Incapsula. San Diego's CivicData postings dataset stopped in 2018.
- **Oregon OHA.** SharePoint HTML only. "The 2026 monitoring season has ended." Advisories go out by GovDelivery email.
- **Virginia VDH.** The map is a Tableau Public dashboard.
- **New York.** Suffolk publishes press releases and a hotline (631-852-5822). apps.health.ny.gov/pubdoh/health_inspections/ny_beaches/ returns 404. NYC Open Data `2xir-kwzz` (DOHMH, keyless, samples to 2026-09-29) has beach names but no coordinates and covers NYC only, none near our spots.
- **Massachusetts and Rhode Island.** Interactive dashboard and annual files (MA), HTML closure tables (RI).
- **EPA BEACON 2.0.** State-reported annual data, not current. The Water Quality Portal is a federal public-domain source of results, but state beach programs reach it late or not at all (tested for Florida).
- **Swim Guide, Heal the Bay.** Private aggregators with no open licence, so we reproduce nothing from them.

## How to show it (for eng)
1. Show the agency's own words and date: "Brown Water Advisory, posted 7 Nov 2026 (Hawaiʻi DOH)", "Precautionary advisory (NC DEQ)", "Last sample 28 Oct: Enterococcus 20 MPN/100 mL (Santa Cruz County via State Water Board)". Always link to the source.
2. No source, or no station mapped to the spot: show nothing.
3. Out of season, or a stale sample: say so with the date. Never treat "no advisory" as "clean water".
4. Re-fetch daily (HI, NC, GA) or weekly (CA). NJ and SC only in season. Cache the raw responses with fetch time.
5. Next step: build a hand-checked spot → station mapping (harbour and lagoon stations excluded) from `water-quality-sources.json`, then email HI CWB, NC DEQ, NJDEP, SC DES and GA DNR to confirm the display terms before any public launch.
