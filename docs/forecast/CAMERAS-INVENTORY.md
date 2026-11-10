# Surf cameras inventory (AI Surf Cameras, Phase A)

**Research only.** Nothing is wired, embedded or analysed. This is a list of public cameras near SWELLO's 492 spots and what each owner's own terms allow. Checked 2026-11-09 (US evening, so many beach views were dark). Data: `docs/forecast/data/camera-sources.json` (161 `CameraSource` rows plus the host terms quoted verbatim). Plan and rules: vault `10-Projects/SWELLO/09-AI-Surf-Cameras.md`.

**Bay Area update (2026-11-10):** see `BAYAREA-CAMERAS.md`.
- The JSON now has 172 rows: 11 new rows, and 8 earlier rows re-tagged `region: "Bay Area"`. The counts below are still the Phase A counts.
- The USGS Dream Inn CoastCam is now **confirmed live**: public domain, with a 9:00 PST frame of Cowell's.
- Five owner-run YouTube streams in Pacifica (Sharp Park and Linda Mar) can be embedded (display-only).

**Rules applied.**
- Only a camera whose owner permits display, and separately frame analysis, counts.
- Surfline, Surf-Forecast/Magicseaweed, Swell Magnet, SurfChex and other commercial surf-cam networks are **excluded** whatever their terms say. That includes WebCOOS cameras that list Surfline as a partner, until WebCOOS confirms in writing that Surfline places no restriction on them.
- No scraping, logins or video downloads. Only public pages, single thumbnail headers and ~1 request/s per host were used.
- Where the terms are silent, the row says **unknown**. Permission is never assumed.
- People must never be identified or tracked.

**Classes.**

| Class | Meaning |
|---|---|
| display+analysis | Explicit terms, or US public-domain status confirmed on the source's own page (USGS, NOAA), allow showing frames and analysing them automatically. |
| guidelines-permit-confirm | **Guidelines permit use; confirm with the owner before use.** The owner's general usage guidelines allow use of the imagery, but they do not explicitly permit embedding in an app or automated frame analysis. Applies to WebCOOS and the PacIOOS archives. |
| display+analysis (no surf view) | Same permission, but the view is offshore: the NDBC BuoyCAM panoramas from the buoy itself. |
| display-only | An attributed embed is allowed, but automated analysis is not. For YouTube streams the reason is that YouTube's terms forbid access "using any automated means". |
| unknown | Terms are silent or could not be found. |
| not-allowed | Terms forbid reuse or embedding without written permission. |
| excluded | Excluded by the SWELLO rule (Surfline or another commercial surf-cam network). |

## Counts by region and permission class

| Region | display+analysis | display+analysis (no surf view) | guidelines-permit-confirm | display-only | unknown | not-allowed | excluded | Total |
|---|---|---|---|---|---|---|---|---|
| WA/OR | 0 | 5 | 0 | 1 | 5 | 1 | 8 | 20 |
| NorCal | 0 | 5 | 1 | 0 | 4 | 0 | 2 | 12 |
| Central CA | 2 | 3 | 2 | 7 | 6 | 0 | 2 | 22 |
| SoCal | 0 | 4 | 1 | 1 | 17 | 0 | 12 | 35 |
| Hawaii | 0 | 0 | 3 | 2 | 11 | 2 | 1 | 19 |
| US East | 0 | 7 | 13 | 7 | 17 | 4 | 5 | 53 |
| **All** | **2** | **24** | **20** | **18** | **60** | **7** | **30** | **161** |

**Uptime on 2026-11-09:**
- **Live:** 92 cameras. A current timestamp, fresh thumbnail or newest-media time was seen.
- **Unverified:** 40.
- **Down or archived:** 24.
- **Stale:** 5.

**Only 2 surf-area cameras have explicit permission (display+analysis).** Both are USGS CoastCams (CC0), and neither could be confirmed live.

Of the 20 guidelines-permit-confirm cameras, 15 are live with a beach or surf view (all WebCOOS). 7 of those show the surf directly; the other 8 are partial views (inlets, swashes, wharves). **None of them may be embedded or analysed until the owner confirms in writing.**

## What the permission rests on (verbatim, see the JSON for every row)

- **WebCOOS** is the NOAA IOOS webcam network, run by SECOORA on Axiom Data Science: https://webcoos.org/usage-guidelines.
  - The terms say: "By accessing webcoos.org or its API, or viewing or using its imagery, you are agreeing to abide by these terms: Access to and use of WebCOOS and its API and imagery … is for lawful, ethical, respectful, and responsible purposes only."
  - API: "Download only a reasonable amount of data."
  - Credit is asked for research use and for social posts.
  - The terms do not mention embedding the live HLS player or commercial use, and the API needs a registered token (not requested). So every WebCOOS row is **guidelines-permit-confirm**, not display+analysis. Written confirmation from webcoos@secoora.org is needed before any embed or analysis.
  - WebCOOS itself runs rip-current and people detection; SWELLO must still never identify or track people.
- **USGS CoastCam:** https://cmgds.marine.usgs.gov/data-services/rscc/coastcam/coastcam_metadata.txt. It says: "USGS-authored or produced data and information are in the public domain from the U.S. Government and are freely redistributable with proper metadata and source attribution. These data are marked with a Creative Commons CC0 1.0 Universal License."
- **NOAA NDBC BuoyCAM:** NWS policy at https://www.weather.gov/disclaimer says: "The information on National Weather Service Web servers and Web sites is in the public domain, unless specifically annotated otherwise, and may be used freely by the public." NDBC's own disclaimer URL returned 403/404, so the NWS policy page is cited.
- **YouTube:** https://www.youtube.com/t/terms. Display: "You may also show YouTube videos through the embeddable YouTube player." Analysis is forbidden: you may not "access the Service using any automated means (such as robots, botnets or scrapers) except … with YouTube's prior written permission".
- **explore.org** (Pipeline): its terms allow embedding, and analysis needs explore's written consent. See the row `hi-explore-pipeline`.
- **EarthCam** is not allowed: https://www.earthcam.com/faq.php says "You may not rebroadcast our live feeds without permission."
- **WeatherSTEM** is not allowed: https://www.weatherstem.com/media says "Automated recording of live streams is forbidden."
- **Coastal Camera Network** is not allowed.
- **HDOnTap, HDRelay, 805 Webcams, Ozolio and IPCamLive** publish no viewer terms. Their rows are **unknown**: the camera owner controls embedding.
- **Windy Webcams API** allows display with attribution. Its terms call "continuous scanning of a significant number of available Webcams" misuse, so analysis is unknown. Windy is an aggregator in any case.

## Best candidates per region

These are pointed at surf or beach and live unless noted. **Most are guidelines-permit-confirm (WebCOOS) and need the owner's written confirmation before use.**

- **WA/OR:** none permitted.
  - The WebCOOS/NANOOS cams at Westport, Ocean Shores, Newport (Shilo Inn), Siuslaw and Bastendorff are live and pointed at the beach, but all list Surfline as a partner, so they are excluded until WebCOOS clarifies.
  - The only display-only cam is OSU Hatfield's Yaquina Bay view (bay, not surf).
- **NorCal:** none pointed at surf is permitted.
  - The WebCOOS Stinson and Crescent City cams list Surfline as a partner.
  - The San Mateo County Harbor District's Surfers Beach cam is 1.1 km from Half Moon Bay; its terms are unknown, so it is a cam worth asking about.
  - The NDBC BuoyCAMs 46026, 46013, 46014, 46022 and 46027 give public-domain offshore sea-state views.
- **Central CA:**
  - `usgs-coastcam-santa-cruz-dream-inn`: a calibrated CC0 camera facing south over Cowell's (0.1 km). It is the best calibration source anywhere, but its live image page could not be opened because usgs.gov timed out.
  - `webcoos-capitola-wharf` (Capitola, 0.1 km; City of Capitola) and `webcoos-walton-lighthouse` (UCSC; Seabright and Twin Lakes, 1.9 km from Cowell's) are both live, with partial surf views.
  - Display-only: 805 Webcams on YouTube at Cayucos Pier and Pismo (Vespera, Shore Cliff).
- **SoCal:**
  - `webcoos-san-elijo` (California State Parks lifeguard tower, "looking West"; Cardiff Reef 0.3 km) is live and the best SoCal candidate.
  - Display-only: City of San Clemente pier cam (YouTube).
  - The City of Del Mar's four HDOnTap beach and surf cams are live; their status is unknown.
- **Hawaii:**
  - Display-only: explore.org Pipeline (0 km) and the Waikiki Aquarium "South Shore Surf Cam" (University of Hawaii, NOAA-sponsored; Publics 0.4 km).
  - The PacIOOS Waimea and Waikiki archives (2009–2013, re-use with credit) are not live, but could serve as training and calibration data.
- **US East:** the WebCOOS beach cams.
  - `webcoos-jennette-south` (Jennette's Pier, ECU; used for rip-current models).
  - `webcoos-currituck-hampton-inn` and `webcoos-currituck-sailfish` (Currituck County; Corolla).
  - `webcoos-vabeach-hamptonos` (MARACOOS; Virginia Beach South End 0.4 km).
  - `webcoos-robert-moses-ocean` (NY State Parks water tower; 0.2 km).
  - `webcoos-oakisland-west` and `webcoos-oakisland-east`.
  - Display-only: Volusia County Beach Safety (New Smyrna, Ponce Inlet, Ormond, Dunlawton) and City of Deerfield Beach, all on YouTube.

### Top 10 overall (surf in view, closest to a spot; each annotated with its class)

1. `webcoos-san-elijo` (guidelines-permit-confirm): Cardiff Reef, 0.3 km. Live.
2. `webcoos-jennette-south` (guidelines-permit-confirm): Jennette's Pier, 0.5 km. Live.
3. `webcoos-currituck-hampton-inn` (guidelines-permit-confirm): Corolla Lighthouse, 0.3 km. Live.
4. `webcoos-vabeach-hamptonos` (guidelines-permit-confirm): South End, VA, 0.4 km. Live.
5. `webcoos-robert-moses-ocean` (guidelines-permit-confirm): Robert Moses State Park, 0.2 km. Live.
6. `webcoos-capitola-wharf` (guidelines-permit-confirm): Capitola, 0.1 km. Live; partial view.
7. `usgs-coastcam-santa-cruz-dream-inn` (display+analysis): Cowell's, 0.1 km. Explicit CC0 / public domain; not confirmed live.
8. `webcoos-currituck-sailfish` (guidelines-permit-confirm): Corolla, 4.4 km. Live.
9. `webcoos-walton-lighthouse` (guidelines-permit-confirm): Seabright, 1.9 km from Cowell's. Live; partial view.
10. `webcoos-oakisland-west` (guidelines-permit-confirm): with `webcoos-oakisland-east`: Holden Beach, 6.9 km (there is also an Oak Island spot). Live.

Display-only runners-up, which would need the owner's written permission for analysis: `hi-explore-pipeline`, `hi-waikiki-aquarium-south-shore`, `sanclemente-city-beach-cam`, `805-cayucos-pier`, `volusia-ponce-inlet-beach-cam`.

## Owners worth asking (do not contact without the user's go-ahead)

| Owner | Why | Contact |
|---|---|---|
| WebCOOS / SECOORA | **Required before any WebCOOS use:** written confirmation that the guidelines cover an in-app embed and automated frame analysis. Confirm that SWELLO's use is in scope: an attributed embed plus server-side still analysis, without storing or identifying people. Ask whether the Surfline-partnered cams (13 near SWELLO spots) carry any Surfline restriction. One answer would unlock most of WA/OR, NorCal and the US East coast. | webcoos@secoora.org · https://webcoos.org/about |
| USGS Pacific Coastal and Marine Science Center | The live image URL for the Dream Inn CoastCam (the data is already CC0). | https://www.usgs.gov/centers/pcmsc/connect |
| explore.org | Pipeline: written consent for analysis. | https://explore.org/contact-us |
| Waikiki Aquarium (University of Hawaii) | South Shore surf cam: analysis permission and a direct feed instead of YouTube. | https://www.waikikiaquarium.org/about/contact/ |
| San Mateo County Harbor District | Surfers Beach cam (Half Moon Bay). | https://www.smharbor.com/harbor-district-contacts |
| City of Del Mar | Four live beach and surf cams on HDOnTap. | https://www.delmar.ca.us/directory.aspx |
| City of San Clemente | Pier cam: analysis permission. | https://www.sanclemente.gov/Directory.aspx |
| Volusia County Beach Safety · City of Deerfield Beach · Sebastian Inlet District · Palm Beach County ERM | Public Florida beach and inlet cams. | see the rows |
| 805 Webcams | Central Coast YouTube cams and a Grover Beach still that updates every few minutes. | info@805webcams.com |
| Oregon State University (Hatfield) · UC Davis Bodega Marine Lab · UC San Diego Scripps (pier cam, down) | University cams, likely research partners. | see the rows |

## Gaps and caveats

- **Nothing was verified for these regions:**
  - Molokai and Lanai: no cameras found.
  - MA, RI, Georgia and South Carolina surf breaks: only Surfline or WebCOOS cams that list Surfline as a partner.
  - Washington and Oregon: no owner-run cam that is not excluded.
- **Night-time check.** Many beach frames were dark, so "live" means a current timestamp or newest-media time, not a confirmed daytime picture of the surf.
- **Partial WebCOOS data.**
  - WebCOOS camera pages are client-rendered.
  - Partner lists for Carova and the archived cams were not read. Those rows stay "unknown" because they might involve Surfline.
  - The WebCOOS Jupiter Inlet camera is probably the same camera as the Jupiter Inlet District's own.
- **usgs.gov** timed out (504 / no response) all evening, so the Santa Cruz CoastCam is unverified.
- **Distance.** `nearestSpots` is the straight-line distance from the camera's published (or approximate) position to SWELLO's spot coordinate. It says nothing about whether the camera can see that break: check `viewsSurf` and its evidence.
- The `docs/forecast/CAMS.md` live links (T-063/T-080) are a separate, link-only list. Nothing here changes them.

## All cameras

The table omits only NDBC buoys more than 60 km from any spot.

| Region | id | Owner | Nearest spot | Surf view | Stream | Live? | Class |
|---|---|---|---|---|---|---|---|
| WA/OR | `ossies-otter-rock-surfline` | Ossies Surf Shop (stream: Surfline embed) | Otter Rock (0.0 km) | yes | iframe | unverified | excluded (SWELLO rule) |
| WA/OR | `ossies-agate-beach-surfline` | Ossies Surf Shop (stream: Surfline embed) | Agate Beach (0.0 km) | yes | iframe | unverified | excluded (SWELLO rule) |
| WA/OR | `webcoos-bastendorff` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NANOOS,  | Bastendorff Beach (0.3 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| WA/OR | `friends-of-haystack-rock-cam` | Friends of Haystack Rock | Cannon Beach (0.3 km) | partial | iframe | unverified | unknown |
| WA/OR | `webcoos-siuslaw` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NANOOS,  | Florence South Jetty (0.5 km) | partial | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| WA/OR | `pacific-city-inn-cape-kiwanda` | Inn at Cape Kiwanda (page: PacificCity.org) | Pacific City (Cape Kiwanda) (0.6 km) | yes | iframe | down | not-allowed |
| WA/OR | `kezi-florence-harbor-vista` | KEZI 9 (TV station) | Florence South Jetty (1.1 km) | partial | snapshot JPEG | down | unknown |
| WA/OR | `earthcam-brookings-chetco-point` | EarthCam in partnership with City of Brookings | Brookings (1.3 km) | partial | iframe | unverified | unknown |
| WA/OR | `webcoos-westport-south` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NANOOS,  | Westport (The Cove) (2.2 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| WA/OR | `webcoos-westport-north` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NANOOS,  | Westport (The Cove) (2.2 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| WA/OR | `koin-seaside-aquarium` | KOIN 6 (Nexstar) in partnership with City of Seaside / Seasi | Seaside (The Point) (3.0 km) | partial | snapshot JPEG | live | unknown |
| WA/OR | `webcoos-newport-shilo` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NANOOS,  | Agate Beach (3.4 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| WA/OR | `osu-hmsc-yaquina-bay` | Oregon State University, Hatfield Marine Science Center | Agate Beach (4.4 km) | no | YouTube live | live | display-only |
| WA/OR | `webcoos-oceanshores-west` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NANOOS,  | Westport (The Cove) (4.8 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| WA/OR | `rockaway-beach-chamber-caboose` | Rockaway Beach Chamber of Commerce | Short Sands (16.6 km) | yes | YouTube live | unverified | unknown |
| WA/OR | `ndbc-buoycam-46087` | NOAA National Data Buoy Center (NWS) | Neah Bay (Hobuck) (18.1 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| WA/OR | `ndbc-buoycam-46050` | NOAA National Data Buoy Center (NWS) | Agate Beach (37.6 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| WA/OR | `ndbc-buoycam-46029` | NOAA National Data Buoy Center (NWS) | Long Beach (Washington) (40.8 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| WA/OR | `ndbc-buoycam-46015` | NOAA National Data Buoy Center (NWS) | Gold Beach (50.1 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| NorCal | `crescent-city-harbor-sunset-cam` | Crescent City Harbor District | Crescent City (0.2 km) | unknown | iframe | live | unknown |
| NorCal | `webcoos-stinson` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: CeNCOOS, | Stinson Beach (0.6 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| NorCal | `webcoos-crescent-city` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Schmidt' | Crescent City (0.7 km) | yes | HLS (live) + one-minute stil | stale | excluded (SWELLO rule) |
| NorCal | `smchd-surfers-beach` | San Mateo County Harbor District | Half Moon Bay (Dunes Beach) (1.1 km) | yes | iframe | unverified | unknown |
| NorCal | `ucdavis-bml-horseshoe-cove` | UC Davis Bodega Marine Laboratory & Reserve | Salmon Creek (4.2 km) | partial | YouTube live | unverified | unknown |
| NorCal | `point-arena-lighthouse-cam` | Point Arena Lighthouse Keepers | Point Arena (5.1 km) | unknown | unknown | unverified | unknown |
| NorCal | `ndbc-buoycam-46027` | NOAA National Data Buoy Center (NWS) | Crescent City (19.2 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| NorCal | `ndbc-buoycam-46026` | NOAA National Data Buoy Center (NWS) | Bolinas (22.3 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| NorCal | `ndbc-buoycam-46013` | NOAA National Data Buoy Center (NWS) | Salmon Creek (25.4 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| NorCal | `ndbc-buoycam-46022` | NOAA National Data Buoy Center (NWS) | Humboldt North Jetty (26.3 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| NorCal | `webcoos-tmmc-prls` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: The Mari | Bolinas (27.3 km) | unknown | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| NorCal | `ndbc-buoycam-46014` | NOAA National Data Buoy Center (NWS) | Point Arena (41.6 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| Central CA | `webcoos-capitola-wharf` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: CeNCOOS, | Capitola (0.1 km) | partial | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| Central CA | `usgs-coastcam-santa-cruz-dream-inn` | U.S. Geological Survey, Pacific Coastal and Marine Science C | Cowell’s (0.1 km) | yes | snapshot JPEG (snap/timex/va | unverified | display+analysis |
| Central CA | `805-cayucos-pier` | 805 Webcams (sponsor: On The Beach Bed and Breakfast) | Cayucos (0.1 km) | yes | YouTube live | live | display-only |
| Central CA | `805-pismo-vespera` | 805 Webcams | Pismo Beach Pier (0.2 km) | yes | YouTube live | live | display-only |
| Central CA | `sanctuary-beach-resort-surfline` | The Sanctuary Beach Resort (stream: Surfline embed) | Marina State Beach (0.2 km) | yes | iframe | unverified | excluded (SWELLO rule) |
| Central CA | `webcoos-santacruzwharf` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: CeNCOOS, | Cowell’s (0.4 km) | partial | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| Central CA | `805-morro-bay-jetty` | 805 Webcams | Morro Rock (0.4 km) | partial | YouTube live | live | display-only |
| Central CA | `805-morro-bay-rock-mbnep` | Morro Bay National Estuary Program (camera by 805 Webcams) | Morro Rock (0.9 km) | no | YouTube live | live | display-only |
| Central CA | `805-pismo-shore-cliff` | 805 Webcams | Pismo Beach Pier (1.0 km) | yes | YouTube live | live | display-only |
| Central CA | `805-shell-beach-bluffs` | 805 Webcams | Shell Beach (1.8 km) | yes | snapshot JPEG | stale | unknown |
| Central CA | `webcoos-walton-lighthouse` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Universi | Cowell’s (1.9 km) | partial | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| Central CA | `santa-cruz-harbor-port-district` | Santa Cruz Port District | Cowell’s (2.1 km) | partial | iframe | live | unknown |
| Central CA | `805-grover-beach` | 805 Webcams | Pismo Beach Pier (2.3 km) | unknown | snapshot JPEG | live | unknown |
| Central CA | `hdontap-seascape-beach-resort` | Seascape Beach Resort (streamed by HDOnTap) | Manresa (2.6 km) | partial | iframe | live | unknown |
| Central CA | `805-avila-beach` | 805 Webcams | Shell Beach (4.3 km) | partial | YouTube live | live | display-only |
| Central CA | `usgs-coastcam-sunset-state-beach` | U.S. Geological Survey, Pacific Coastal and Marine Science C | Manresa (5.8 km) | partial | snapshot JPEG (snap/timex/va | unverified | display+analysis |
| Central CA | `visit-santa-cruz-palm-state-beach` | Visit Santa Cruz County | Moss Landing (5.8 km) | partial | iframe | unverified | unknown |
| Central CA | `hdontap-carmel-tickle-pink` | Tickle Pink Inn (streamed by HDOnTap) | Carmel Beach (5.9 km) | partial | iframe | live | unknown |
| Central CA | `805-cambria-moonstone` | 805 Webcams (sponsor: Cambria Shores Inn) | Cayucos (23.3 km) | partial | YouTube live | live | display-only |
| Central CA | `ndbc-buoycam-46042` | NOAA National Data Buoy Center (NWS) | Davenport (31.2 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| Central CA | `ndbc-buoycam-46011` | NOAA National Data Buoy Center (NWS) | Shell Beach (37.6 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| Central CA | `ndbc-buoycam-46028` | NOAA National Data Buoy Center (NWS) | Sand Dollar (42.8 km) | no | snapshot JPEG (2880x300 pano | down | display+analysis (no surf view) |
| SoCal | `swellmagnet-hermosa-pier-north` | Swell Magnet (Swellmagnet Inc.) | Hermosa Pier (0.0 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `swellmagnet-hermosa-pier-south` | Swell Magnet (Swellmagnet Inc.) | Hermosa Pier (0.0 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `swellmagnet-hermosa-south-ptz` | Swell Magnet (Swellmagnet Inc.) | Hermosa Pier (0.0 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `hdontap-huntington-pier` | unknown (HDOnTap) | Huntington Pier (0.0 km) | yes | HLS (HDOnTap iframe player) | down | unknown |
| SoCal | `sanclemente-city-beach-cam` | City of San Clemente | San Clemente Pier (0.1 km) | unknown | YouTube live (video 2c7NV66Y | live | display-only |
| SoCal | `scripps-pier-surf-cam` | UC San Diego, Scripps Institution of Oceanography | Scripps (0.1 km) | yes | unknown | down | unknown |
| SoCal | `topanga-surf-cam` | unknown (HDOnTap page names no partner) | Topanga (0.1 km) | yes | HLS (HDOnTap iframe player) | unverified | unknown |
| SoCal | `swellmagnet-malibu-point` | Swell Magnet (Swellmagnet Inc.) | Malibu (Surfrider) (0.2 km) | yes | HLS (HDOnTap iframe player) | unverified | excluded (SWELLO rule) |
| SoCal | `swellmagnet-el-porto-rosecrans` | Swell Magnet (Swellmagnet Inc.) | El Porto (0.2 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `webcoos-san-elijo` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: SCCOOS,  | Cardiff Reef (0.3 km) | yes | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| SoCal | `hb-pier-visit-hb` | Visit Huntington Beach (camera at the Kite Connection store  | Huntington Pier (0.3 km) | yes | unknown (player loaded by sc | unverified | unknown |
| SoCal | `swellmagnet-malibu-pier` | Swell Magnet (Swellmagnet Inc.) | Malibu (Surfrider) (0.3 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `swellmagnet-santa-monica-bay` | Swell Magnet (Swellmagnet Inc.) | El Porto (0.3 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `swellmagnet-el-porto-overlook` | Swell Magnet (Swellmagnet Inc.) | El Porto (0.3 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `swellmagnet-hermosa-north` | Swell Magnet (Swellmagnet Inc.) | Hermosa Pier (0.4 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `swellmagnet-venice-roaming` | Swell Magnet (Swellmagnet Inc.) | Venice Breakwater (0.5 km) | yes | HLS (HDOnTap iframe player) | live | excluded (SWELLO rule) |
| SoCal | `swellmagnet-venice-wide` | Swell Magnet (Swellmagnet Inc.) | Venice Breakwater (0.5 km) | yes | HLS (HDOnTap iframe player) | unverified | excluded (SWELLO rule) |
| SoCal | `westland-venice-beachcam` | Westland Network (Don Westland, private site) | Venice Breakwater (0.6 km) | unknown | unknown | unverified | unknown |
| SoCal | `hammerland-north-manhattan` | Hammerland Surf (business) | El Porto (0.8 km) | yes | HLS (HDOnTap iframe player) | down | unknown |
| SoCal | `santabarbara-harborcam` | City of Santa Barbara Waterfront Department | Leadbetter (0.9 km) | no | iframe (Verkada embed) | unverified | unknown |
| SoCal | `seashore-carlsbad-surf` | Seashore on the Sand (hotel, Carlsbad State Beach) | Tamarack (1.0 km) | yes | HLS (HDOnTap iframe player) | live | unknown |
| SoCal | `hdontap-la-jolla-shores-surf` | HDOnTap (no partner named) | Scripps (1.5 km) | yes | HLS (HDOnTap iframe player) | live | unknown |
| SoCal | `hotel-la-jolla-overlook` | Hotel La Jolla (Curio Collection by Hilton) | Scripps (1.7 km) | yes | HLS (HDOnTap iframe player) | live | unknown |
| SoCal | `laguna-cliffs-dana-point-harbor` | Laguna Cliffs Resort & Spa | Doheny (2.0 km) | partial | HLS (HDOnTap iframe player) | unverified | unknown |
| SoCal | `delmar-north-beach` | City of Del Mar | Seaside Reef (3.2 km) | yes | HLS (HDOnTap iframe player)  | live | unknown |
| SoCal | `delmar-overlook-4k` | City of Del Mar | Torrey Pines (3.3 km) | yes | HLS (HDOnTap iframe player)  | live | unknown |
| SoCal | `pacific-park-santa-monica-pier` | Pacific Park (amusement park on the Santa Monica Pier) | Venice Breakwater (3.3 km) | partial | unknown | unverified | unknown |
| SoCal | `delmar-17th-south-4k` | City of Del Mar | Torrey Pines (3.5 km) | yes | HLS (HDOnTap iframe player)  | live | unknown |
| SoCal | `delmar-17th-ptz` | City of Del Mar | Torrey Pines (3.6 km) | yes | HLS (HDOnTap iframe player)  | live | unknown |
| SoCal | `webcoos-carpinteria` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: SCCOOS,  | Rincon (4.1 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| SoCal | `ventura-harbor-entrance` | Ventura Port District Harbor Patrol | C Street (4.6 km) | unknown | iframe (IPCamLive player; sn | unverified | unknown |
| SoCal | `ndbc-buoycam-46053` | NOAA National Data Buoy Center (NWS) | Campus Point (17.7 km) | no | snapshot JPEG (2880x300 pano | down | display+analysis (no surf view) |
| SoCal | `ndbc-buoycam-46054` | NOAA National Data Buoy Center (NWS) | Jalama (26.5 km) | no | snapshot JPEG (2880x300 pano | down | display+analysis (no surf view) |
| SoCal | `ndbc-buoycam-46025` | NOAA National Data Buoy Center (NWS) | County Line (33.5 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| Hawaii | `hi-explore-pipeline` | explore.org (Explore Annenberg LLC) | Pipeline & Backdoor (0.0 km) | yes | YouTube live (video Fp7l8XAS | live | display-only |
| Hawaii | `hi-earthcam-waikiki-beach-kuhio` | EarthCam with Hilton Waikiki Beach (Kuhio Ave) | Queen's (0.1 km) | partial | HLS (EarthCam player) | unverified | unknown |
| Hawaii | `hi-waikiki-marriott-ozolio` | Waikiki Beach Marriott Resort & Spa | Queen's (0.3 km) | unknown | iframe (Ozolio player) | unverified | unknown |
| Hawaii | `hi-pacioos-waimea-archive` | PacIOOS (University of Hawaii SOEST, NOAA IOOS regional asso | Waimea Bay (0.3 km) | yes | snapshot JPEG (archive, hour | down | guidelines-permit-confirm |
| Hawaii | `hi-maui-eldorado-ozolio` | Maui Eldorado (Kaanapali) | Ka'anapali Point (0.3 km) | unknown | iframe (Ozolio player) | unverified | unknown |
| Hawaii | `hi-poipu-earthcam-parrish` | The Parrish Collection Kauai (with EarthCam) | Brenneckes (0.3 km) | yes | HLS (EarthCam share embed Pa | unverified | unknown |
| Hawaii | `webcoos-waikiki-sheraton` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: none lis | Waikiki Beach (0.4 km) | partial | HLS (live) + one-minute stil | stale | guidelines-permit-confirm |
| Hawaii | `hi-waikiki-aquarium-south-shore` | Waikiki Aquarium (University of Hawaii at Manoa); sponsored  | Publics (0.4 km) | yes | YouTube live (video WIUg8wzh | live | display-only |
| Hawaii | `hi-pacioos-waikiki-archive` | PacIOOS (University of Hawaii SOEST) | Waikiki Beach (0.4 km) | partial | snapshot JPEG (archive, hour | down | guidelines-permit-confirm |
| Hawaii | `hi-ward-village-south-shore` | Ward Village (Howard Hughes Communities) | Kewalo's (0.6 km) | yes | iframe (Ozolio relay EMB_PGF | live | not-allowed |
| Hawaii | `hi-earthcam-hilton-hawaiian-village` | EarthCam with Hilton Hawaiian Village Waikiki Beach Resort | Ala Moana Bowls (0.7 km) | unknown | HLS (EarthCam player) | unverified | unknown |
| Hawaii | `hi-hanalei-bay-resort-hdontap` | Hanalei Bay Resort (Princeville) | Hideaways (0.7 km) | yes | HLS (HDOnTap player) | stale | unknown |
| Hawaii | `hi-hanalei-colony-resort` | Hanalei Colony Resort (Haena) | Tunnels (1.1 km) | partial | iframe (Ozolio relay EMB_PJR | unverified | not-allowed |
| Hawaii | `hi-maui-kai-ozolio` | Maui Kai (Kaanapali condominium resort) | Rainbows (1.3 km) | unknown | iframe (Ozolio player) | unverified | unknown |
| Hawaii | `hi-royal-sonesta-kauai-ozolio` | Royal Sonesta Kaua'i Resort | Kalapaki (1.5 km) | unknown | iframe (Ozolio player) | unverified | unknown |
| Hawaii | `webcoos-kahului-harbor` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Universi | Kahului Harbor (1.8 km) | no | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| Hawaii | `hi-outrigger-kona-ozolio` | Outrigger Hospitality (Outrigger Kona Resort & Spa, Keauhou) | Kahalu'u Bay (2.0 km) | unknown | iframe (Ozolio player) | unverified | unknown |
| Hawaii | `hi-kahala-resort-ozolio` | The Kahala Hotel & Resort | Black Point (2.8 km) | unknown | iframe (Ozolio player) | unverified | unknown |
| Hawaii | `hi-grand-wailea-ozolio` | Grand Wailea, A Waldorf Astoria Resort | The Cove (4.8 km) | partial | iframe (Ozolio relay EMB_NBD | unverified | unknown |
| US East | `webcoos-staugustinecam` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not read | St. Augustine Pier (0.0 km) | unknown | HLS (live) + one-minute stil | down | unknown |
| US East | `deerfield-beach-beach-camera` | City of Deerfield Beach | Deerfield Beach Pier (0.0 km) | unknown | YouTube live | live | display-only |
| US East | `deerfield-beach-fishing-pier-camera` | City of Deerfield Beach | Deerfield Beach Pier (0.0 km) | partial | YouTube live | live | display-only |
| US East | `deerfield-beach-surf-camera` | City of Deerfield Beach | Deerfield Beach Pier (0.0 km) | yes | YouTube live | down | display-only |
| US East | `webcoos-masonboro-inlet` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NWS Wilm | Masonboro Inlet (0.1 km) | partial | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `volusia-ormond-by-the-sea-beach-cam` | Volusia County Beach Safety (County of Volusia) | Bicentennial Park (0.1 km) | unknown | YouTube live | live | display-only |
| US East | `sebastian-inlet-district-webcam` | Sebastian Inlet District (special taxing district) | Sebastian Inlet (0.1 km) | yes | snapshot JPEG | live | unknown |
| US East | `pompano-beach-city-webcams` | City of Pompano Beach | Pompano Pier (0.1 km) | unknown | iframe (CamStreamer) / YouTu | down | unknown |
| US East | `nc-aquariums-jennettes-pier` | N.C. Aquariums (Jennette's Pier) - cameras by Surfline | Jennette's Pier (0.1 km) | yes | unknown | unverified | excluded (SWELLO rule) |
| US East | `webcoos-robert-moses-ocean` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: MARACOOS | Robert Moses State Park (0.2 km) | yes | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `webcoos-robert-moses-inlet` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: MARACOOS | Robert Moses State Park (0.2 km) | partial | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `webcoos-miami40thcam` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not read | Dunes Hotel (0.2 km) | unknown | HLS (live) + one-minute stil | down | unknown |
| US East | `pbc-erm-boca-raton-inlet` | Palm Beach County Department of Environmental Resources Mana | Boca Raton Inlet (0.2 km) | partial | snapshot JPEG | live | unknown |
| US East | `webcoos-jennette-north` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Jennette | Jennette's Pier (0.3 km) | yes | HLS (live) + one-minute stil | down | guidelines-permit-confirm |
| US East | `webcoos-currituck-hampton-inn` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Currituc | Corolla Lighthouse (0.3 km) | yes | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `webcoos-folly6thavenue` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not read | Folly Beach Pier (0.3 km) | unknown | HLS (live) + one-minute stil | down | unknown |
| US East | `webcoos-follypiersouthcam` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not read | Folly Beach Pier (0.3 km) | unknown | HLS (live) + one-minute stil | down | unknown |
| US East | `earthcam-seaside-heights` | Borough of Seaside Heights via EarthCam | Seaside Heights/ Casino Pier (0.3 km) | unknown | HLS (EarthCam player) | unverified | not-allowed |
| US East | `webcoos-vabeach-hamptonos` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: MARACOOS | South End (0.4 km) | yes | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `town-of-oyster-bay-tobay-beach` | Town of Oyster Bay | Tobay Beach (0.4 km) | unknown | unknown | down | unknown |
| US East | `webcoos-jennette-south` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Jennette | Jennette's Pier (0.5 km) | yes | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `webcoos-cocoabeach` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not read | Minuteman (0.5 km) | unknown | HLS (live) + one-minute stil | down | unknown |
| US East | `webcoos-buxtoncoastalcam` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not read | Cape Hatteras Lighthouse (0.6 km) | unknown | HLS (live) + one-minute stil | down | unknown |
| US East | `weatherstem-jax-beach-pier` | WeatherSTEM station (Florida Public Safety Weather Network,  | 8th Ave. South (0.6 km) | unknown | snapshot JPEG | live | not-allowed |
| US East | `surfchex-johnnie-mercers-pier` | SurfChex (camera hosted by Silver Gull Motel) | C Street, Wrightsville Beach (0.7 km) | yes | unknown | unverified | excluded (SWELLO rule) |
| US East | `seaside-park-boardwalk-ccn` | Borough of Seaside Park (hosted by Coastal Camera Network LL | Seaside Park (0.9 km) | unknown | iframe | unverified | not-allowed |
| US East | `volusia-dunlawton-beach-cam` | Volusia County Beach Safety (County of Volusia) | Sunglow Pier (1.0 km) | unknown | YouTube live | live | display-only |
| US East | `boca-raton-south-beach-park` | City of Boca Raton Parks Department | Boca Raton Inlet (1.0 km) | unknown | snapshot JPEG | unverified | unknown |
| US East | `weatherstem-jensen-beach` | WeatherSTEM station (Florida Public Safety Weather Network,  | Jensen Beach (1.2 km) | unknown | snapshot JPEG | live | not-allowed |
| US East | `nags-head-fishing-pier` | Nags Head Fishing Pier - camera by Surfline | Loggerhead St. (1.3 km) | yes | unknown | unverified | excluded (SWELLO rule) |
| US East | `volusia-ponce-inlet-beach-cam` | Volusia County Beach Safety (County of Volusia) | Ponce Inlet (1.7 km) | unknown | YouTube live | live | display-only |
| US East | `stonybrook-lishore-point-lookout` | Stony Brook University School of Marine and Atmospheric Scie | West End, Jones Beach (1.8 km) | unknown | snapshot JPEG | stale | unknown |
| US East | `volusia-new-smyrna-beach-cam` | Volusia County Beach Safety (County of Volusia) | Flager Avenue (2.8 km) | unknown | YouTube live | live | display-only |
| US East | `webcoos-currituck-sailfish` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Currituc | Corolla Lighthouse (4.4 km) | yes | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `webcoos-oakisland-west` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not list | Holden Beach (6.9 km) | yes | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `webcoos-oakisland-east` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not list | Holden Beach (6.9 km) | yes | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `pbc-erm-south-lake-worth-boynton-inlet` | Palm Beach County Department of Environmental Resources Mana | 40th Street (11.6 km) | yes | snapshot JPEG + MP4 clips | unverified | unknown |
| US East | `webcoos-carovabeach` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not capt | Corolla Lighthouse (14.0 km) | unknown | HLS (live) + one-minute stil | live | unknown |
| US East | `webcoos-cherrypiernorthcam` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: not read | Ocean Isle Beach Pier (19.0 km) | unknown | HLS (live) + one-minute stil | down | unknown |
| US East | `webcoos-southkingstown` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NERACOOS | Mansion Beach (19.4 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| US East | `webcoos-westerly` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: NERACOOS | Mansion Beach (23.7 km) | yes | HLS (live) + one-minute stil | live | excluded (SWELLO rule) |
| US East | `ndbc-buoycam-44065` | NOAA National Data Buoy Center (NWS) | West End, Jones Beach (25.7 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| US East | `ndbc-buoycam-41025` | NOAA National Data Buoy Center (NWS) | The Lighthouse (28.3 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| US East | `jupiter-inlet-district-webcam` | Jupiter Inlet District | Stuart Rocks (28.8 km) | partial | snapshot JPEG | live | unknown |
| US East | `webcoos-jupiterinlet` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Erdman V | Stuart Rocks (29.3 km) | partial | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `webcoos-whitepoint-swash` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Horry Co | Ocean Isle Beach Pier (29.8 km) | partial | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `ndbc-buoycam-44013` | NOAA National Data Buoy Center (NWS) | Good Harbour Beach (30.4 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| US East | `webcoos-singleton-swash` | WebCOOS (US IOOS / SECOORA, NOAA-funded); partners: Horry Co | Ocean Isle Beach Pier (35.9 km) | partial | HLS (live) + one-minute stil | live | guidelines-permit-confirm |
| US East | `pbc-erm-lake-worth-inlet` | Palm Beach County Department of Environmental Resources Mana | 40th Street (36.8 km) | unknown | snapshot JPEG | unverified | unknown |
| US East | `ndbc-buoycam-44025` | NOAA National Data Buoy Center (NWS) | Robert Moses State Park (41.0 km) | no | snapshot JPEG (2880x300 pano | down | display+analysis (no surf view) |
| US East | `ndbc-buoycam-41009` | NOAA National Data Buoy Center (NWS) | Jetty Park (41.1 km) | no | snapshot JPEG (2880x300 pano | live | display+analysis (no surf view) |
| US East | `ndbc-buoycam-41013` | NOAA National Data Buoy Center (NWS) | Oak Island (59.8 km) | no | snapshot JPEG (2880x300 pano | down | display+analysis (no surf view) |
