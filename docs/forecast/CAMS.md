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

## HDOnTap live-updating snapshots (offer of 2026-11-12, Tim Sears, lead #10098)
- Free, no streaming licence, on these conditions: the line "Live Streaming Cams Provided by HDOnTap.com"; the HDOnTap logo (files attached to the email) linking to `https://hdontap.com/?utm_source=swello&utm_medium=referral&utm_campaign=logo+swello`; each snapshot links to its own HDOnTap.com camera page with the referral/UTM link HDOnTap supplies.
- Delivery: one snapshot URL per camera (`portal.hdontap.com/snapshot/<cam>-SWELLO-REFERRAL?...`, optional overlay and size such as 640x360), or ready HTML embed code. Cached about 60 s (updates about once a minute). No request limits for now. Use their URLs as given; never proxy, cache-copy or record them (recording and analysis need a separate licence, especially for customer-owned cameras).
- Status: waiting on us to send the HDOnTap.com page URL for each camera; HDOnTap then generates the snapshot URLs.

## Later: rewind / "was it right?" footage (user idea, 2026-11-12; not started)
- One timeline: the forecast hour scrubber also scrubs recorded camera footage; past hours show the clip next to our forecast and the buoy reading; jump to "Go" hours; session clips from a logged session time.
- Needs HDOnTap's separate recording/playback licence (snapshots may never be stored to fake a history), plus the owner's OK for customer-owned cameras.
- Option 1 (preferred): HDOnTap records and we play back from their platform. First question for Tim: do they already record and offer rewind or clip access, and at what price for a small set?
- Option 2: we record licensed streams ourselves. About 11 GB per camera per day (2 Mbps, 12 daylight hours); 30-day retention is about 330 GB, about $5 per month in R2. That is on top of the $100–125 per camera per month stream licence. A starter set of 4–5 cameras is roughly $500–700 a month, so it comes after launch revenue.

## Snapshot analysis (headcount, wave activity): permission asked 2026-11-12
The user asked Tim whether SWELLO may run automated aggregate analysis on the snapshots (surfer count, wave activity; nobody identified, no images stored), and what a licence would look like and which cameras are HDOnTap-owned vs customer-owned. **Do not analyse snapshots until HDOnTap says yes in writing.** If yes: one frame a minute → lineup count (person detection), set frequency and whitewater activity, rough size band (calibrated against fixed objects), surface texture; compared hourly with our rating, surf height, buoys and NWS in the How-right scorecard.
