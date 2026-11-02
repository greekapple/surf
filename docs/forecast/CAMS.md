# Live cam links (T-063)

**Links only.** SWELLO links to the owner's own page in a new tab. It never embeds, frames or analyses a third-party camera; that would need the owner's permission. The label is "Live cam · <owner>", and SWELLO never presents a cam as its own.

**Rule:** a spot gets a link only when the owner's page was opened in a real browser (Chrome via Playwright) and showed a working live camera. Anything that could not be verified is skipped and listed below. Data: `src/data/cams.ts`.

## Linked
| Spot | Owner (operator) | URL | Shows | Verified | How |
|---|---|---|---|---|---|
| Morro Rock (`cs-morro-rock`) | Morro Bay National Estuary Program (805 Webcams) | https://mbnep.org/baycam | Morro Rock and the harbour from the bay side, **not** the surf side of the Rock (the link says so) | 2026-11-02 | HTTP 200; a live YouTube stream "Morro Bay Rock and Harbor Webcam - 805 Webcams" is playing; on-screen clock 2026-11-02 12:27 PM |

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

Spots not listed above were not searched in this pass.

**Re-check.** Cams move and die. Re-run the browser check before each release; a dead link is removed, never left in place.
