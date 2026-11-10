# Embeddable alternatives to the HDOnTap cameras (2026-11-10)

Research only: nothing is wired. The goal was to find, for each of the 24 HDOnTap link-only cameras in `LIVE-CAM-PANEL.md`, a live view of the same beach whose owner allows embedding, so the spot page could show it instead of a link.

Allowed bases (from the brief and `09-AI-Surf-Cameras`):
- **(a)** US public domain, confirmed on the source page.
- **(b)** The owner's terms explicitly allow embedding.
- **(c)** The camera owner's own YouTube live stream with embedding on. oEmbed must return 200, and the channel must be the owner's.
- **(d)** An owner-provided player whose host does not block framing (no restrictive `frame-ancestors` or `X-Frame-Options`).

Not allowed: Surfline or Swell Magnet feeds, raw HLS, proxies, scraping, re-streams by third parties, and anything behind a login. All checks ran on 2026-11-10 at about 14:00 PST (daylight) with the UA `SWELLO surf forecast prototype`, about 1 request per second per host. YouTube "live" means the watch page reported `isLive` and `isLiveNow` true, and the live thumbnail was looked at. New rows in `data/camera-sources.json` carry `altFor` (the HDOnTap row they would replace), and the file has `altFeedsChecked`.

## Result

The 24 HDOnTap cameras sit at **13 locations**:

| Result | Locations |
|---|---|
| Clean embeddable alternative of the same beach | **1**: Huntington |
| Clean, but a neighbouring beach | **2**: Hermosa → Redondo, 2.5 km; Venice → Santa Monica, 3 km |
| Found but not clean (user decision) | **1**: El Porto / North Manhattan (The Surfers View) |
| None found | **9** |

| Location (HDOnTap rows) | Spot | Alternative found? | Basis | Embed / page URL | Live 2026-11-10 | View | km to spot |
|---|---|---|---|---|---|---|---|
| **Huntington** (`hdontap-huntington-pier`) | cs-huntington | **Yes**: City of Huntington Beach "View from Huntington Beach Pier" (`hb-city-pier-youtube`) | (c) owner's channel. Its About page names the City and links huntingtonbeachca.gov. oEmbed 200 | `https://www.youtube-nocookie.com/embed/mhQjsLBfOoY` | live | the break: down the pier with surf on both sides | 0.1 |
| ↳ second | cs-huntington | Yes: City of Huntington Beach "Lifeguard HQ" (`hb-city-lifeguard-hq-youtube`) | (c) as above | `https://www.youtube-nocookie.com/embed/RGYlFjV-dtc` | live | the beach south of the pier; the surf is small in frame | 0.2 |
| ↳ also | cs-huntington | Visit Huntington Beach's pier cam via the Pixelcaster player (existing row `hb-pier-visit-hb`) | (d) technically: `pixelcaster.com/live/surfcityusa/iframe/` answers 200 with no CSP or XFO. Owner terms not found | `https://pixelcaster.com/live/surfcityusa/iframe/` | not played | pier, from the Kite Connection store | 0.3 |
| **Hermosa ×4** (Swell Magnet pier N, pier S, south PTZ, north) | cs-hermosa | **Neighbour only**: City of Redondo Beach "Pier" (`redondo-city-pier-south-youtube`) | (c) The city's web-cams page links the stream: "Watch a LIVE view of the beach south of the Redondo Beach Pier. LIVE view is available through YouTube." | `https://www.youtube-nocookie.com/embed/TuVOKRP7IBA` | live | Redondo beach and shore break south of the pier, not Hermosa | 2.5 (1.4 to cs-redondo-breakwater) |
| **El Porto ×3 + North Manhattan** (Rosecrans, overlook, Santa Monica Bay, Hammerland) | cs-el-porto | **Found, not clean**: The Surfers View "Manhattan Beach Cam" (`surfersview-el-porto-youtube`) | (c) is technically met: the owner's channel is linked from thesurfersview.com and oEmbed is 200. But Coastal Camera Network's terms say "You may not ... publicly display ... any Content" and it is a commercial surf-cam network. Marked excluded; user decision | `https://www.youtube-nocookie.com/embed/tBEIYdw1HeM` | live | El Porto beach, surf and north jetty | 0.1 |
| **Venice ×2** (Swell Magnet roaming, wide) | cs-venice-breakwater | **Neighbour only**: explore.org "Santa Monica Beach & Pier" (`explore-santa-monica-beach-pier`) | (b) explore.org terms: "you may 'embed' or use analogous technology to include our content in your content", plus (c), oEmbed 200 | `https://www.youtube-nocookie.com/embed/v97JpT3ZA0w` | live | Santa Monica beach and pier, not the breakwater | 3.0 |
| ↳ rejected | cs-venice-breakwater | Venice V Hotel cam streamed by Teleport.camera (`venice-v-hotel-teleport-youtube`) | Fails. The description says "Use of the images and videos from our live stream is not allowed without written permission." Marked not-allowed | `EO_1LWqsCNE` | live | boardwalk and beach | 0.5 |
| ↳ also | cs-venice-breakwater | Pacific Park Santa Monica Pier cam (existing row `pacific-park-santa-monica-pier`) | (d) technically: the owner page embeds Ozolio `relay.ozolio.com/pub.api?cmd=embed&oid=EMB_DDLQ00000228`, which answers 200 with no CSP or XFO. The owner publishes no terms. Ozolio's terms URL is 404 | Ozolio embed above | not played | the pier and amusement park; low surf value | 3.2 |
| **Malibu Point & Pier** (Swell Magnet ×2) | cs-malibu | None | | | | | |
| **Topanga** (`topanga-surf-cam`) | cs-topanga | None | | | | | |
| **Carlsbad** (`seashore-carlsbad-surf`) | cs-tamarack | None | | | | | |
| **La Jolla Shores ×2** (HDOnTap's own, Hotel La Jolla) | cs-scripps | None | | | | | |
| **Del Mar ×4** (City of Del Mar: North Beach, 4K overlook, 17th St south, 17th St PTZ) | cs-seaside-reef, cs-torrey-pines | None | | | | | |
| **Dana Point Harbor** (Laguna Cliffs) | cs-doheny | None | | | | | |
| **Seascape / Manresa** | cs-manresa | None new. The existing USGS Sunset State Beach CoastCam (public domain, 5.8 km) remains the only clean option | | | | | |
| **Hanalei** (Hanalei Bay Resort) | w-hawaii-hideaways | None | | | | | |

## What was checked where none was found

- **Malibu:**
  - YouTube live searches for "Malibu live cam" and "Malibu pier live".
  - "LA Times Live Feeds: Malibu Beach 24/7" (LA Times Studios, `E0TZTmTK-Ws`, oEmbed 200). Its thumbnail is a fixed roadside "Malibu 21 miles of scenic beauty" sign under an overcast sky, while every other LA cam was sunny. It looks like a looped or poster feed, its location is not stated, and it does not show the break. Rejected.
  - The Surfers View's Malibu page (Coastal Camera Network player, terms forbid).
  - Skyline has no Malibu cam.
- **Topanga:**
  - YouTube search found nothing live.
  - The Surfers View's Topanga page embeds an old explore.org highlight video ("Malibu Cam at Creative Visions", `TRmdlboRegA`, not live).
  - explore.org's beach channel streams: Santa Monica, Catalina West End, Pipeline, Nazaré.
- **Carlsbad:**
  - "Carlsbad Beach - Live Cam" by Earth Watch Live (`dyX57HKeckg`) is a **third-party re-stream** of Seashore on the Sand's camera (its description is just "seashoreonthesand.com", and the channel has no About text or links). Not allowed.
  - Seashore on the Sand's own site embeds HDOnTap (`...-CUST` id) and a Vimeo clip.
  - The Windy webcam id found in search (1746057190) is a hotel in Karlovy Vary, not Carlsbad CA.
  - Surfline's Tamarack cam is excluded.
- **La Jolla:**
  - Earth Watch Live "La Jolla Beach" (`Hs1bzxJe-oc`) is a re-stream with an anonymous operator. Not allowed.
  - Scripps Pier cam: "sponsored and powered by Surfline" per the UCSD 2011 release, so excluded. The site was also down on 2026-11-09.
  - Hotel La Jolla's own site has no stream.
  - San Diego Web Cam's channel has no La Jolla cam (Oceanside, Shelter Island, Harbor Island only).
- **Del Mar:**
  - Every City of Del Mar and L'Auberge camera is on HDOnTap.
  - YouTube searches for "Del Mar beach live" returned only Café del Mar (Ibiza) music streams.
  - The Windy id found for Torrey Pines (1596829508) is the Caltrans I-5 Genesee traffic cam.
  - Torrey Pines Gliderport: no live stream found.
- **Dana Point:**
  - The Ocean Institute/Laguna Cliffs and Monarch Bay Beach Club cams are both HDOnTap.
  - Doheny State Beach's park page links Surfline (excluded).
  - YouTube search found nothing live.
  - Laguna Cliffs' own site has no stream.
- **Seascape / Manresa:**
  - Seascape Resort's site has no stream.
  - YouTube "Aptos beach live cam" found Rio Sands (embedding disabled by owner, already recorded) and Monterey Bay Aquarium cams (wrong place).
- **Hanalei:**
  - Hanalei Colony Resort (Ozolio LKOU000004E4): owner terms forbid, already recorded as not-allowed.
  - Hanalei Bay Resort's own site has no stream.
  - AlohaLiveCam "Ultimate Kauai Webcam Tour" is a third-party compilation re-stream. Not allowed.
  - Other Kauai streams (Sheraton Kauai, Lawai Beach Resort, Poipu Bay) are on the south shore, 40+ km away.
  - The Sheraton/St. Regis Princeville cam appears only in an old article; no live stream found.
- **Hermosa and Venice:**
  - **SkylineWebcams** terms do allow embedding ("embed a webcam on their own website using the code provided by the 'Embed' function, without modifying it"). But its Venice, Manhattan, Redondo and Santa Monica pages only wrap other people's YouTube streams ("From the Web": `98jOtUeM3m8`, `tBEIYdw1HeM`, `TuVOKRP7IBA`, and a mismatched Maui stream). That adds nothing beyond the owners' streams themselves.
  - **Venice Vive** (`GBcHDAT_8H4`, a "breakwater surf cam") and **Ready When You're Ready** (`98jOtUeM3m8`, `D33ZD6sRvnA`, boardwalk) have embedding on, but the operators are anonymous. Neither channel names a camera owner or a site (Google Drive, Buy Me a Coffee and Instagram links only), so (c) cannot be confirmed and they could be re-streams. Not recorded as usable.
  - Westland.net Venice beachcam: Brownrice player, and the page source says "INTERNATIONAL COPYRIGHT ENFORCED". Boardwalk view. Not usable.
  - Hermosa: no City of Hermosa Beach stream found. The Hennessey's rooftop cam has left, per Patch.
- **EarthCam:** its terms forbid embedding without a licence (`hostTerms.earthcam`).
- **Windy:** none of the Windy ids found matched these beaches.

## Best 5

1. `hb-city-pier-youtube`: City of Huntington Beach pier cam, 0.1 km, shows the break, owner's channel. The best replacement on this list.
2. `hb-city-lifeguard-hq-youtube`: City of Huntington Beach beach view, 0.2 km.
3. `redondo-city-pier-south-youtube`: City of Redondo Beach. A clean basis, and also a direct camera for cs-redondo-breakwater (1.4 km); only a neighbour view for Hermosa.
4. `explore-santa-monica-beach-pier`: explore.org's terms explicitly permit embedding; a neighbour view for Venice (3 km).
5. `surfersview-el-porto-youtube`: the right beach (0.1 km) and embedding is on, but it conflicts with the owner's site terms and is a commercial surf-cam network. **The user decides**; it is not counted as clean.

All the YouTube rows are display-only. Frame analysis is "no" under YouTube's terms.
