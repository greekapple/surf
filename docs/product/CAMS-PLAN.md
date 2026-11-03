# SWELLO's own surf cams: plan (T-080)

Status: **plan, nothing bought or installed.** The user said "we can get cams going pretty soon" (2026-11-02). Every step that spends money, puts hardware on someone's property or publishes video needs the user's go-ahead (CLAUDE.md: ask before spending money). Prices below are **list prices seen on 2026-11-02 at the cited pages, not quotes**. They change, and taxes, mounts and labour are extra.

Today SWELLO only **links** to public cams run by their owners (`src/data/cams.ts`, `docs/forecast/CAMS.md`). It never embeds or analyses someone else's camera.

## Why our own cam
1. **Seeing it:** a live view of the break, which is the first thing a surfer checks.
2. **An observed label:** a cam is the honest path to "observed" surf, which today we never claim (CONTRACTS.md). That means a person's report, and later a measured height from video, next to the model estimate.
3. **Calibration:** observed heights per hour pair with the forecast archive (T-064) to calibrate the estimate (T-059) far faster than surfers' reports.

## Hardware (per site)
| Part | Option | Price seen | Notes |
|---|---|---|---|
| Camera | Reolink Duo 2V PoE (4K dual-lens, RTSP) | $159.99 ([smarthomecompared](https://smarthomecompared.com/cameras/reolink-duo-2v-poe-vs-ring-outdoor-cam-plus), July 2026 data) | A wide view of a beach break; RTSP for our own encoder |
| Camera (alternative) | Hikvision DS-2CD2386G2-IU 4K turret, IP67, PoE | about C$269 ([eBay listing](https://www.ebay.de/itm/187768588386)) | A fixed turret; check the RTSP spec on the maker's sheet |
| Camera (zoom, later) | A PTZ with optical zoom | not priced here | Needed to frame a point or reef break from far away |
| Power and network | PoE switch or injector, outdoor Ethernet; mains at the mount | estimate $50–150 | Without mains: solar + LTE adds roughly $500–1,500 (estimate, not researched) |
| Encoder / uplink | A small computer (e.g. a Raspberry Pi 5 class) pulling RTSP and pushing RTMPS or WebRTC to the host | estimate $100–150 | Or the camera's own RTMP push if it has one |
| Mount and housing | Pole or wall mount, salt-air rated | estimate $50–200 | Salt and wind are the main failure causes on the coast |

**A first cam with mains power and wired internet:** roughly $350–650 in parts (estimate).

## Streaming and hosting
- **Cloudflare Stream Live:** $1 per 1,000 minutes delivered and $5 per 1,000 minutes stored; encoding is included; billing is by minutes watched ([Cloudflare docs](https://developers.cloudflare.com/stream/pricing)). Recording is automatic, so set a short retention or delete recordings to keep storage cost (and privacy exposure) low.
- **A rough bound:** 100 viewers × 10 minutes a day ≈ 30,000 minutes a month ≈ $30 a month delivery (arithmetic on the cited rate).
- **Alternatives (not priced here):** a hosted cam network that carries other operators' cams (they host and monetise; we link), or our own HLS on a small VPS.

## Where (candidates)
| Spot | Why | Mount ideas (to ask) |
|---|---|---|
| **Ocean Beach (SF)** | Our best-modelled spot (v2 MOP, calibration); the most surfers | A beachfront business or residence on the Great Highway with a view north or south; the city's Ocean Beach structures need city/GGNRA approval |
| **Linda Mar (Pacifica)** | The second spot with a sized estimate and real photos; a beginner-friendly crowd | A business near the beach or a resident; the beach is a State Beach run by the City of Pacifica |

## Permissions
- **On private property** (a business or a home with a view of the beach): the owner's written permission. A [San Diego City Attorney memo (2004)](https://docs.sandiego.gov/memooflaw/ML-2004-1.pdf) found the city had no liability for a private camera filming a public beach from private property, and that the state privacy statutes it reviewed did not cover filming people on a public beach. That is one city's legal opinion, not general advice.
- **On public land or state tidelands:** a permit from the land manager (city, State Parks, GGNRA). The [Coastal Commission has reviewed beach webcam networks before (2003 staff report)](https://documents.coastal.ca.gov/reports/2003/10/T4j-10-2003.pdf), and a [La Jolla webcam drew objections over missing permits](https://patch.com/california/lajolla/seal-webcam-is-live-in-la-jolla-san-diego-children-s-pool). Expect a coastal development permit question for anything on public land.
- **Recommendation:** start on private property with the owner's consent; get a short legal read before any public-land mount.

## Privacy and honesty rules
- A wide view of the lineup only; no zoom on people; no audio.
- Don't keep raw footage (short or no recording retention); no face or person identification. This matches vault note 09 ("never identify, track or store individual surfers") and the surf-analysis plan.
- **Label:** "Live cam · SWELLO" on our own cams. It shows on the spot page next to the forecast, never as data.
- **The "observed" path, in honest steps:**
  1. A person watches the cam and reports a size in the existing two-tap "What did you see?"; it is labelled *your observation* (exists today).
  2. **Cam-observed (manual):** a reviewer reads the face height off the cam against a known marker (a pier piling, a surveyed rock), labelled "observed on the SWELLO cam by <reviewer>, <time>". Calibration counts it.
  3. **Cam-measured (computer vision, later):** an automatic breaking-height estimate from video. It is labelled "measured by video, experimental" until validated against a buoy or a survey for a full season, and its error is shown.

## Computer-vision surf height (later)
- **Method:** a known geometry (camera height, tilt, distance to the break from a survey or a marker) maps pixel height to metres; detect breaking crests and whitewater per frame; track wave faces; report the highest third (H1/3) per 10–20 minutes. Count sets and period from the time series.
- **Needs:**
  1. a fixed, surveyed camera (no PTZ moves during measurement);
  2. ground truth for validation (a nearby buoy or CDIP MOP, plus manual reads);
  3. compute: on-device for counting, or a server batch over clips.
- Research precedents exist (coastal video monitoring, ARGUS-style stations; [CeNCOOS lists coastal webcams for observations](https://www.cencoos.org/?p=3498)); it is a project, not a weekend job.

## Steps and what needs the user
1. **Decide:** own cam yes or no, and which first site (Ocean Beach or Linda Mar). **User**
2. **Find a host** (business or resident) and get written permission. **User** (or the user's OK to approach)
3. **Buy** about $350–650 of parts. **User approval (money)**
4. **Install** and test the RTSP → encoder → Cloudflare Stream path; a private test page first.
5. **Publish** "Live cam · SWELLO" on the spot page. **User approval (deploy)**
6. **Manual observed reads** feeding calibration (no new money).
7. **Computer vision** as a research task, after a season of manual reads.
