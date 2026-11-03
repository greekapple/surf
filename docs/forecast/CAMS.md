# Live cam links (T-063)

**Links only.** SWELLO links to the owner's own page in a new tab. It never embeds, frames or analyses a third-party camera; that would need the owner's permission. The label is "Live cam · <owner>", and SWELLO never presents a cam as its own.

**Rule:** a spot gets a link only when the owner's page was opened in a real browser (Chrome via Playwright) and showed a working live camera. Anything that could not be verified is skipped and listed below. Data: `src/data/cams.ts`.

## Linked
| Spot | Owner (operator) | URL | Shows | Verified | How |
|---|---|---|---|---|---|
| Morro Rock (`cs-morro-rock`) | Morro Bay National Estuary Program (805 Webcams) | https://mbnep.org/baycam | Morro Rock and the harbour from the bay side, **not** the surf side of the Rock (the link says so) | 2026-11-02 | HTTP 200; a live YouTube stream "Morro Bay Rock and Harbor Webcam - 805 Webcams" is playing; on-screen clock 2026-11-02 12:27 PM |

| Malibu (`cs-malibu`) | Swell Magnet (on HDOnTap) | https://hdontap.com/stream/190972/malibu-point-live-surf-cam/about | Malibu Point / Surfrider lineup, PTZ | 2026-11-02 | HTTP 200; the video received a 1920 px stream; the page names Swell Magnet |
| El Porto (`cs-el-porto`) | Swell Magnet (on HDOnTap) | https://hdontap.com/stream/471422/el-porto-rosecrans-live-cam/about | Beachfront 38th–45th St from the Rosecrans overlook | 2026-11-02 | HTTP 200; 2560 px stream |
| Hermosa Pier (`cs-hermosa`) | Swell Magnet (on HDOnTap) | https://hdontap.com/stream/567567/hermosa-beach-pier-north-live-webcam/about | North of the pier | 2026-11-02 | HTTP 200; 2560 px stream |
| Black's Beach (`cs-blacks`) | Hotel La Jolla (on HDOnTap) | https://hdontap.com/stream/449923/la-jolla-shores-overlook-live-webcam/about | La Jolla Shores; a roaming PTZ that also shows Scripps Pier and Black's (the link says it is not a fixed view of Black's) | 2026-11-02 | HTTP 200; 2560 px stream; "Brought to you by Hotel La Jolla" |
| Pleasure Point (`spot-8`) | Santa Cruz Port District | https://www.santacruzharbor.org/webcams | The harbor entrance channel, ~3 km west; **not** the Pleasure Point break (the link says so) | 2026-11-02 | HTTP 200; the district's own page embeds a live HDRelay player |

## Checked and skipped (2026-11-02)
| Spot | Candidate | Why skipped |
|---|---|---|
| Huntington Pier | surfcityusa.com "Live surf cam" (Visit Huntington Beach; camera from the Kite Connection store) | Returns HTTP 403 "Access Denied" to an automated browser, so the stream could not be confirmed. Re-check by hand. |
| Huntington Pier | hdontap.com stream 255678 "Huntington Beach Pier Live Cam" | The page says the live stream is no longer available |
| Oceanside Pier | San Diego Web Cam (The Rooftop Bar, Mission Pacific Beach Resort) | sandiegowebcam.com only redirects; no verifiable cam page URL found |
| Morro Rock | morrobay.org/plan/webcams (Visit Morro Bay) | The page describes live cams, but no player rendered in the browser; the estuary program's page above was verifiable instead |
| Pismo Beach Pier | "805 Webcams" pier cam, from press and aggregator mentions | No owner page URL found |
| Ocean Beach (SF), Imperial Beach | Aggregator listings only (surf-forecast, windfinder) | Aggregators, not owners; no owner cam found |
| Black's Beach / Windansea | Scripps Pier cam (UC San Diego) | It is a different spot (Scripps Pier and La Jolla Shores), and the scripps.ucsd.edu page refused the connection when checked |

| Huntington Pier | Swell Magnet lists Huntington, but no Swell Magnet/HDOnTap Huntington stream was found; the city's own page could not be loaded | Re-check |
| The Wedge / Newport | The City of Newport Beach lifeguard page points to Surfline for cams | Surfline is a subscription aggregator, not the owner's page; skipped |
| Manresa | Visit Santa Cruz County's "Palm State Beach" cam (HDRelay) streams from Pajaro Dunes, ~8 km south | A different beach; skipped |
| Steamer Lane / Cowell's | No owner-run page found (local sites link Surfline or the harbor cam) | — |
| Pismo, Oceanside, Imperial Beach, SF Ocean Beach, Linda Mar | Only aggregator listings (surf-forecast, windy, openwebcamdb) | Skipped |

T-080 searched: the Santa Cruz harbor and Visit Santa Cruz County pages, Swell Magnet's HDOnTap streams (Malibu, El Porto, Hermosa), Hotel La Jolla's overlook, and the Huntington, Newport, Pismo, Oceanside, Imperial Beach, Linda Mar and Steamer Lane candidates. Other spots were not searched.

**Re-check.** Cams move and die. Re-run the browser check before each release; a dead link is removed, never left in place.
