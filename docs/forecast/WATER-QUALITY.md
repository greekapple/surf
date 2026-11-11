# Water quality line (spec item 4)

One "Water quality" line on the spot page, under the call bar: the agency's own status words, its date, a link to the agency, and a "Source:" credit. Nothing for a spot with no reviewed station. Never an estimate.

## Pieces
- `scripts/build-water-quality.mjs` → `src/data/waterQualitySourced.ts` (a test checks equality). Applies the review rules to the 411 research picks within 3 km (`docs/forecast/data/water-quality-sources.json`) and records each as `STATION_REVIEW` (`reviewed` or `rejected`, with a reason). The mapping is RULE-CHECKED (distance and name), 19 judgements by hand (`OVERRIDES`); 285 reviewed, 126 rejected. If unsure, rejected. Spot-check before launch. Township and road names in a station's name are not read as water.
- Rules: more than 1 km away; a name with harbour, marina, lagoon, creek, stream, river, gulch, pond, outfall, outflow, drain, canal, slough, wharf, landing, inlet, sewer, point zero, offshore (Hawaii also pier, ramp, boat; Florida also jetty); no station name (code only); Hawaii 0.6 to 1 km needs the spot's own place name in the station's name. `OVERRIDES` in the script hold the hand judgements (Mavericks to Pillar Point #8 inside the harbour: rejected; Morro Rock to San Leandro Bay: rejected; Blackie's to Newport Bay: rejected; Malibu-county stations not confirmed as Zuma or Leo Carrillo: rejected; Moss Landing and Marina State Beach: accepted despite the words).
- `services/water-quality.mjs`, route `/api/water-quality?spot=<id>`: on demand (so only spots someone opens), one agency list per 3 h shared by all its spots, upstream calls at most 1 a second, UA `SWELLO surf forecast prototype`, no cron, no Open-Meteo. A failed refresh keeps the older answer with its own date.
- `src/features/forecast/{WaterQuality.tsx,waterQualityLogic.ts}`: the line.

## What each agency shows
| Source | Line |
|---|---|
| Hawaii DOH CWB | EVERY open notice that belongs to the station (the notice's station number; the station inside or within 100 m of the notice's area polygon, `events/{id}.locations[].geometry`; or the notice's full location name equal to the station's), each as type and cause, dated *posted*. A shared word is not a match. No match: "No open DOH notice matched to <station>", dated *checked*. Staff e-mails are never kept. |
| NC DEQ | status word as posted, date of the latest sample; with no sample in 30 days: "no sample in 30 days", dated *checked* |
| GA DNR | Green / Yellow / Gray in words, sample date |
| SC DES | the Temporary_Advisories layer (8) wins over the station layer's Advisory field; dated *checked* with "routine sampling May to October" |
| California BeachWatch | "Latest test <date> (N days ago): <result> (above/below the AB 411 single-sample limit of N)"; total coliform and the ratio are not checked; a lab result, never open/closed; "No test in the last 45 days" when none |
| NJ | outside May to September "Not monitored until the 2027 season"; in season a link only (live status not wired) |
| Florida, Washington | link only ("Check FL Healthy Beaches ↗"); no data fetched |

## Licence notes (also in `WQ_AGENCIES`)
Facts with attribution and a link back. Hawaii: undocumented endpoint, ask the Clean Water Branch before any public launch. NC, NJ, SC, GA, WA: no terms stated, confirm before a public launch. California: public domain (Water Boards conditions of use), attributed. Florida: reference only, so link only.

## Known weak points
3 spots are missing from the research JSON (nothing shown); a Hawaii polygon with a hole is treated as solid (rare); the area match allows 100 m; in-season NJ is a link only; California shows results up to 45 days old with their age; the research's 1 km and name rules are heuristics, so `STATION_REVIEW` should be spot-checked by a person before launch.

Every "no advisory" wording carries "no advisory is not a clean-water result". A failed or empty agency answer is thrown and never cached; a failed call never affects the next call.
