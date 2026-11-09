# Handoff: spot expansion, Engineering (2026-11-09)
Branch `spots-eng`. Spec `docs/specs/2026-11-08-spot-expansion.md` (pipeline half). Nothing merged or pushed.

## Commits
`2ebd29e` fetch budget · `216d8b0` one freshness rule per source · `d4ba7cc`+`4bb6a23` `add-spots.ts` · `44e862b` the 14 Phase A spots (45 → 59; merged `spots-research` 49cb359 first).

## Fetch budget (docs/forecast/data/open-meteo-budget.ts; tests in src/tests/fetch-budget.test.ts)
Open-Meteo calls per day, from the real targets: marine 3 h, weather 1 h, spread 90 min = 48 per spot.
| spots | before (cron / TTL-only) | after |
|---|---|---|
| 45 | 3,157 / 5,040 | 2,160 |
| 59 (now) | — | 2,832 |
| 64 | 4,490 / 7,170 | 3,072 |
| 95 | 6,670 / 10,640 | 4,560 |
Cron at 64 and 95 spots (9 h of 5-min ticks, real service): peak 642 / 649 subrequests per run (budget 800), oldest values weather 60 min, spread 90, marine 180. CDIP THREDDS: 2,640 calls/day at 54 MOP points (one per hour per target, the politeness floor; the old fixed cap 2,500 is now `2 x 24 x points + 100`).
Freshness: marine (3 h) would have read STALE under the 2 h rule, so `staleness()` picks the limit per source (Open-Meteo marine 4 h, everything else 2 h). Tests: wind stale at 2 h 1 min while marine fresh at 3 h 50 min.

## add-spots.ts
`node --experimental-strip-types --no-warnings docs/forecast/data/add-spots.ts docs/forecast/data/phase-a-spots.json` (see its header). Idempotent (second run byte-identical, checked). Existing rows keep their dates (per-spot scan date, `mop-slope-all.ts --only` merge).

## Result per new spot (the script's final table)
```
spot                          MOP      slope  tide station                         NWS zone        shore wind
Kelly's Cove                  SF041    yes    Ocean Beach, outer coast 0.3 km      CAZ006 (approx via spot-2) none
Sloat (Ocean Beach south)     SF015    yes    Ocean Beach, outer coast 4.5 km      CAZ006          none
Sharp Park                    SM402    yes    Pillar Point Harbor 14 km            CAZ509          none
Rockaway Beach                SM387    yes    Pillar Point Harbor 12 km            CAZ509          none
Princeton Jetty               none     no     Pillar Point Harbor 1.1 km           CAZ509 (approx via spot-4) HAF 3 km
Half Moon Bay (Dunes Beach)   SM274    yes    Pillar Point Harbor 3.3 km           CAZ509          none
Pescadero State Beach         SM136    yes    Ano Nuevo Island 18.1 km             none            none
Pigeon Point                  none     no     Ano Nuevo Island 9.6 km              CAZ509          none
Scott Creek                   none     no     Ano Nuevo Island 12.6 km             CAZ509          none
Rodeo Beach                   MA048    yes    Ocean Beach, outer coast 6.5 km      CAZ505          none
Natural Bridges               none     no     Santa Cruz, Monterey Bay 3.7 km      CAZ529          none
Capitola                      SC112    yes    Santa Cruz, Monterey Bay 5.9 km      CAZ529 (approx via spot-7) none
Marina State Beach            MO836    yes    Moss Landing, Ocean Pier 11.5 km     CAZ530          none
Andrew Molera                 MO418    no     Carmel Cove, Carmel Bay 27.7 km      none            none
```
Honest "none"s: 4 spots have no matching MOP point, so they are rated from the offshore model only; Pescadero and Andrew Molera have no NWS zone (no alerts); a "yes" slope is the generator's rule, not a review. Shore wind: 6 spots now (Princeton Jetty joined via HAF).

## Counts updated (derived where possible)
tide test `>= 45` (it already checks every spot); slopes `<=` assigned beach breaks; shelter-0 list gains Rodeo Beach and Capitola (their guides call them sheltered with an open sector); profile coverage 52 of 59; `docs/forecast/SPOT-FACTS-REVIEW.md` regenerated.

## Checks
tsc clean. `npm test` 636 tests, 635 pass, 0 fail. `npm run build` ok.
Map, dev :5185: **t043 FAILS (a real finding)**: 23 checks pass (including "3 of 59 pins labelled", no overlaps in labels), then clicking the Ocean Beach pin times out because Sloat's chip covers it. `t149-pin-crowd.mjs` (1440x900, default Explore view): visible pins 16 → 29, pins whose dot is not what a click hits 2 → 12, overlapping dot pairs 2 → 13 (Ocean Beach x Kelly's Cove x Sloat; Linda Mar x Sharp Park x Rockaway; Mavericks x Princeton Jetty; Steamer Lane / Cowell's / Natural Bridges; Pleasure Point x Capitola; Davenport x Scott Creek; Half Moon Bay x Princeton). The spec's "map not more crowded" is NOT met at the default zoom. t013 cannot run (it calls `__xmap.setView`, the Leaflet API; it crashes the same way on the 45-spot base, :5180).
Perf (t091, 3 runs, throttled; base 45 → 59): dataReady +1.1 to 1.2 s on every screen (Home 7.4 → 8.6 s, Map 11.6 → 12.7 s), LCP Home 7.4 → 8.6 s, Map 4.1 → 4.1 s (1440) / 14.6 → 15.7 s (390), TBT +10 to 95 ms, transfer +84 KB, unique API calls 177 → 215. The app fetches every spot's data on load, so it grows linearly with spots.
New spot pages (`t149-new-spots.mjs`): Kelly's Cove, Rockaway Beach and Capitola load at 1440 and 390 with a title, a surf height, a rating ("Solid · provisional · limited reliability") and 0 console errors. Their heights: Kelly's Cove 9–12 ft, Rockaway 10–13 ft, Capitola 3–4 ft, against Ocean Beach 16–21 ft at the same hour (Ocean Beach uses the reviewed SF023 point; the new spots use the facing-match assignment).

## Weakest points
1. The map is more crowded and Ocean Beach (the user's most-checked spot) is partly covered at the default zoom. This needs a UI rule (pins by priority per zoom, or cluster at low zoom), which is product's, not data's. A `minZoom` tier per spot would be the data half; I did not add one.
2. Data on load scales with spots (+38 API calls, +1.2 s dataReady). Loading only the spots in view (or the selected + saved first) would fix it.
