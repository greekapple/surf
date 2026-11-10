# Bay Area surf cameras: what SWELLO can show now

**Research only.** Nothing is wired. This pass goes deeper than the Phase A inventory (`CAMERAS-INVENTORY.md`) for the user's home spots from Bolinas to Capitola. It was checked on **2026-11-10, 09:00–09:35 PST, in daylight**. The rows are in `docs/forecast/data/camera-sources.json` with `region: "Bay Area"`. They use the same `CameraSource` schema and classes, plus two optional fields: `embedUrl`, and `bayAreaChecked` at the top level. The rules are in vault `10-Projects/SWELLO/09-AI-Surf-Cameras.md`.

## How "usable now" was decided

A camera counts only if at least one of these holds:
- **(a) US federal public domain**, confirmed on the source's own page.
- **(b) Explicit embed permission** in the owner's terms. None was found in this area.
- **(c) An official YouTube live stream by the camera owner** with embedding left on. This was checked two ways: `playableInEmbed=true` on the watch page, and a headless iframe embed on a local page that actually played.

Display permission and analysis permission are recorded separately. YouTube forbids automated access, so every YouTube row is **display-only**.

**Excluded whatever their terms say:** Surfline, Swell Magnet, Surf-Forecast/Magicseaweed, and WebCOOS cams that list Surfline as a partner.

**Method:**
- Public pages only.
- Never logged in or accepted terms.
- No video was downloaded. Only single thumbnails, single JPEGs and an in-browser embed screenshot were used.
- About 1 request/s per host, with the User-Agent "SWELLO surf forecast prototype".

## Spot → cameras

| Spot (SWELLO id) | Camera (row id) | Usable now? Basis | Embed URL / type | Attribution text | Live? (2026-11-10) | View |
|---|---|---|---|---|---|---|
| **Cowell's** (`spot-7`) | USGS CoastCam Dream Inn, camera 2 "Cowells Beach, looking southward" (`usgs-coastcam-santa-cruz-dream-inn`) | **Yes: display + analysis.** (a) USGS page captions each image "Media Sources/Usage: Public Domain."; metadata: "public domain … freely redistributable with proper metadata and source attribution … CC0 1.0" | `https://cmgp-coastcam.s3-us-west-2.amazonaws.com/cameras/dreaminn/latest/c2_snap.jpg` (JPEG every 30 min in daylight; also `c2_timex`, `c2_var`) | "U.S. Geological Survey, Pacific Coastal and Marine Science Center (public domain)" | **Yes.** Last-Modified 17:13 GMT; frame stamped "Tue 11/10/2026 9:00 PST" | **Shows the break**: the Cowell's cove with swell lines wrapping in |
| Cowell's / Main Beach | Same station, camera 1 "Main Beach, looking eastward" | Yes: display + analysis (a) | `…/dreaminn/latest/c1_snap.jpg` | as above | Yes, 9:00 PST frame | Beach: Main Beach shorebreak, the wharf and the Boardwalk |
| **Steamer Lane** (`spot-6`) | USGS Dream Inn c2 (1.3 km) | Yes (a), but **partial view** | c2_snap.jpg | as above | Yes | The West Cliff point is in frame. The Lane itself is around the point and mostly out of view |
| Steamer Lane | WebCOOS Santa Cruz Wharf (`webcoos-santacruzwharf`) | **No.** Excluded: Surfline is a listed partner | HLS | — | live (Phase A) | Partial |
| **Pacifica Pier / Sharp Park** (`cs-sharp-park`) | Chamberlin Nature "Sharp Park Beach, view west" (`chamberlin-sharp-park-west`) | **Yes: display only.** (c) The owner's own YouTube live stream ("my cameras"), playableInEmbed=true, embed played | `https://www.youtube.com/embed/lmec_rcEIL4` | "Live cam: Chamberlin Nature (pacificaview.net) via YouTube" | **Yes.** isLiveNow; embed clock 09:31:13 | **Shows the break** straight on: the clearest wave view in the area |
| Pacifica Pier / Sharp Park | Chamberlin "Pacifica Pier, view north" (`chamberlin-pacifica-pier-north`) | Yes, display only (c) | `https://www.youtube.com/embed/3vqiXAw1Km4` | as above | Yes, clock 09:30:36 | Shows the break and the pier |
| Pacifica Pier / Sharp Park | Chamberlin "Pacifica Pier close-up" (`chamberlin-pacifica-pier-closeup`) | Yes, display only (c) | `https://www.youtube.com/embed/BrUaOjjXgZM` | as above | Yes (isLiveNow; frame not screenshotted) | The pier, zoomed in |
| Pacifica Pier / Sharp Park | Chamberlin "Mori Point, view south" (`chamberlin-mori-point-south`) | Yes, display only (c) | `https://www.youtube.com/embed/iQ7XJDXYSMo` | as above | Yes, clock 09:30:57 | Beach: Sharp Park shorebreak toward Mori Point |
| **Linda Mar** (`spot-3`) | "Linda Mar Beach Cam" YouTube channel (`linda-mar-beach-cam-youtube`) | **Yes: display only, lower confidence.** (c) The channel says "This camera streams continuously" and stamps its own overlay; playableInEmbed=true; embed played. The operator is anonymous (channel joined 2026-08-25) | `https://www.youtube.com/embed/TDcKozRHlKs` | "Live cam: Linda Mar Beach Cam via YouTube" | **Yes.** Clock 09:31:34 | Beach: the whole crescent from a hillside. Lines and whitewater are visible but small |
| **Rockaway** (`cs-rockaway`) | — | No camera sees it | — | — | — | The Mori Point cam looks this way, but Rockaway is behind the headland |
| **Ocean Beach / Kelly's / Sloat** (`spot-2`, `cs-kellys-cove`, `cs-sloat`) | Fly Funston "Fort Funston 4k" (`flyfunston-fort-funston`), 2.4 km from Sloat | Embed yes (c), owner's own channel; **but no surf in view** | `https://www.youtube.com/embed/eLt-QEwVnxc` | "Live cam: Fly Funston (Fellow Feathers) via YouTube" | Yes, thumbnail 09:22:15 | **Ocean horizon only.** Good for fog and wind (wind overlay); the beach is below the bluff. The club's still is stamped "Use By Permission Only" |
| Ocean Beach area | Mussel Rock Park cam (`mussel-rock-park-daly-city`) | Display only (c) | `https://www.youtube.com/embed/vZEINdmawdc` | "Live cam: Mussel Rock Park cam via YouTube" | Yes, 09:27 | Distant shorebreak along the Daly City bluffs. Not a SWELLO break (Sharp Park 4.2 km) |
| Ocean Beach | oceanbeach.org webcam (linked from sigward.com) | No: dead (DNS does not resolve) | — | — | Down | — |
| **Fort Point** (no SWELLO spot) | GGNP Conservancy East Beach / Crissy Beach PTZ (`ggnpc-crissy-east-beach`) | No: unknown terms ("All rights reserved") | PTZ page | — | Unverified | Bay and bridge, not the Fort Point wave |
| **Stinson** (`spot-1`) | WebCOOS Stinson (`webcoos-stinson`) | **No.** Excluded: Surfline is a listed partner | HLS | — | live (Phase A) | Shows the beach |
| **Bolinas** (`spot-0`) | WebCOOS Stinson (3.9 km); NDBC BuoyCAM 46026 (`ndbc-buoycam-46026`, 22 km offshore) | Stinson excluded. 46026 is public domain but has **no surf view** | 46026: NDBC JPEG panorama | "NOAA National Data Buoy Center" | 46026 live (Phase A) | Open ocean from the buoy |
| **Rodeo** (`cs-rodeo-beach`), **Muir Beach** (no spot) | — | None found. NPS lists a "Muir Beach webcam" (sigward.com), but that page holds only a Windy link | — | — | — | — |
| **Montara** (`spot-4`) | — | None found | — | — | — | — |
| **Princeton Jetty / Pillar Point / Mavericks / Half Moon Bay** (`cs-princeton-jetty`, `spot-5`, `cs-half-moon-bay`) | San Mateo County Harbor District, Surfers Beach (`smchd-surfers-beach`) | **No: unknown terms.** Page still has no terms (re-checked) | Verkada iframe | — | Unverified (player present, not played) | Beach: Surfers Beach. No Mavericks cam exists outside Surfline |
| **Pleasure Point / 38th Ave / The Hook** (`spot-8`; 38th and The Hook are inside it) | Santa Cruz Port District harbor cam (`santa-cruz-harbor-port-district`, 2.6 km) | No: unknown terms; signed HDRelay player | iframe | — | live (Phase A) | Harbour only: entrance channel, PTZ tour |
| Pleasure Point | WebCOOS Walton Lighthouse (`webcoos-walton-lighthouse`) | No: guidelines-permit-confirm | HLS | — | live (Phase A) | Beach: Seabright and Twin Lakes |
| **Capitola** (`cs-capitola`) | WebCOOS Capitola Wharf (`webcoos-capitola-wharf`) | No: guidelines-permit-confirm | HLS | — | live (Phase A) | Partial: the beach from the lifeguard HQ, looking south |
| Capitola | City of Capitola "Beach Web Cam" (`capitola-city-surfline`) | **No.** Excluded: Surfline cameras under a City agreement | — | — | — | Beach and wharf |
| Capitola | Rio Sands Beachcam, Aptos (`rio-sands-aptos-youtube`, 4.1 km) | **No.** The owner has disabled embedding (playableInEmbed=false; the embed shows "Video unavailable") | — | — | Live on YouTube | Unknown |
| **Natural Bridges** (`cs-natural-bridges`) | — | None. The Dream Inn camera is 3.2 km away and does not see it | — | — | — | — |

**Also checked and not useful:**
- **City of Santa Cruz surf cam page** (`santa-cruz-city-surfcam-surfline`): it only links to Surfline.
- **Visit Santa Cruz County cams:** the harbour (signed HDRelay) and Palm State Beach. Its YouTube channel has no live streams.
- **Monterey Bay Aquarium:** bay deck cam in Monterey, out of area and not surf.
- **HDOnTap Golden Gate Bridge:** HDOnTap publishes no terms.
- **EarthCam:** not allowed.
- **Windy / OpenWebcamDB / SkylineWebcams / surf-forecast pages:** aggregators, not owners.
- **USGS:** has no other CoastCam in the area. Sunset State Beach is in Watsonville; one page of the USGS webcam list timed out partway.

## Usable now, in one list

| Camera | Spots | Class | Shows |
|---|---|---|---|
| USGS Dream Inn c2 (+ c1) | Cowell's (+ Steamer Lane partial, Main Beach) | **display+analysis** (public domain) | The break |
| Chamberlin Nature × 4 (Sharp Park west, pier north, pier close-up, Mori Point) | Pacifica Pier / Sharp Park | display-only (YouTube) | The break |
| Linda Mar Beach Cam | Linda Mar | display-only (YouTube); operator anonymous | Beach, distant |
| Fly Funston, Mussel Rock | near Sloat / Ocean Beach | display-only (YouTube) | No surf / distant: a fog and wind check only |

**Best 3 to wire first:**
1. **USGS Dream Inn c2 → Cowell's.**
   - It is the only camera here that SWELLO may also analyse. It is calibrated and live.
   - Show it as a still with its own time ("USGS · 9:00 AM"), and hide it when the frame is older than about 45 min. The USGS page warns that old images mean the system is offline.
2. **Chamberlin "Sharp Park west" → Pacifica Pier / Sharp Park.**
   - It is the best live wave view in the area, from a stable four-camera owner who has run since 2020.
   - Use the YouTube embed and label it "Live cam · Chamberlin Nature".
3. **Linda Mar Beach Cam → Linda Mar (`spot-3`).**
   - It covers a core spot. It is live and embeddable.
   - Re-check that the channel is still the operator before wiring.
   - If in doubt, fall back to Chamberlin "pier north" and say it is 3.5 km north of Linda Mar.

YouTube embeds must stay attributed iframes. SWELLO must never grab frames from them. The thumbnails on the Chamberlin streams are a 2020 storm photo, so never show the thumbnail as the current view.

## Owners worth asking (do not contact without the user's go-ahead)

| Owner | Ask | Contact |
|---|---|---|
| Chamberlin Nature (Pacifica, 4 cams) | Permission to analyse frames, and a direct still URL so SWELLO need not go through YouTube | https://pacificaview.net/livecam/ (behind a bot captcha; not read) · https://chamberlinnature.com/ |
| San Mateo County Harbor District | Display + analysis of the Surfers Beach cam (Princeton / Half Moon Bay / Mavericks area) | https://www.smharbor.com/harbor-district-contacts |
| WebCOOS / SECOORA | Capitola Wharf and Walton Lighthouse confirmation, and whether the Surfline partner restricts the Stinson and Santa Cruz Wharf cams (same ask as Phase A) | webcoos@secoora.org · https://webcoos.org/about |
| Santa Cruz Port District | Harbor cam embed and analysis (Pleasure Point side) | https://www.santacruzharbor.org/contact-us |
| Fellow Feathers / Fly Funston | Use of the still panorama ("Use By Permission Only"): a fog and wind reference for Ocean Beach | https://flyfunston.org/ |
| Rio Sands Hotel (Aptos) | Turn on YouTube embedding | https://www.youtube.com/watch?v=hXtYKDio1rQ (no contact on the stream) |
| USGS PCMSC | Courtesy note and polling guidance for the Dream Inn images (permission not needed) | https://www.usgs.gov/centers/pcmsc/connect |

**Gaps:**
- Marin (Bolinas, Rodeo, Muir), Ocean Beach, Montara, Mavericks, Natural Bridges and Pleasure Point have no camera SWELLO may show now.
- Every Mavericks and Steamer Lane cam found is Surfline.
- The Chamberlin and Linda Mar coordinates are approximate.
