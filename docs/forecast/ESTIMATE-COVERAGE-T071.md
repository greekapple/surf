# Surf estimates from published spot guides: coverage before and after (T-071)

User decision (2026-11-02): "literally just look at public sources and apply that". Facts were read from published spot guides (Surfnerd and Surf-Forecast.com; the pages are cited per fact in `docs/forecast/SPOT-FACTS-REVIEW.md`, raw research in `docs/forecast/data/guide-facts.json`, generated module `src/ocean/spotFactsSourced.ts`) and applied by fixed rules (`src/ocean/spotFactsRules.ts`). Nothing about the honesty rules changed: the label stays "model estimate", the range is the same unvalidated 0.7–1.4 band, and offshore-only spots stay labelled offshore.

## Coverage

| | Before | After |
|---|---|---|
| Spots with a breaking-estimate profile | **1 of 45** (Ocean Beach) | **30 of 45** |
| Spots on v2 (assigned MOP point) | 1 (Ocean Beach, SF023) | 2 (+ Linda Mar, SM375) |
| Spots with an estimate in the next 72 h (live check, 2026-11-03) | 1 | **26 of 45** (the other covered spots had no swell inside their published window in that window of time, so they correctly showed offshore) |
| Spots with a published beach orientation | 1 | 39 |

**Covered (30):** Ocean Beach, Linda Mar, Bolinas, Montara, Steamer Lane, Waddell Creek, Manresa, Moss Landing, Asilomar, Carmel Beach, Morro Rock, Salmon Creek, Dillon Beach, Moonstone Beach, Jalama, C Street, County Line, Zuma, Malibu, Topanga, El Porto, Hermosa Pier, The Wedge, Salt Creek, Trestles (Lowers), Oceanside, Swami's, Cardiff Reef, Black's Beach, Imperial Beach.

**Not covered (15), and why:** Stinson Beach, Cowell's, Sand Dollar, Huntington Pier (a source calls them sheltered; no shelter factor is sourced). Mavericks and Pleasure Point (reef breaks; no source says they are exposed). Davenport, Pismo, Point Arena, Shelter Cove, Humboldt North Jetty, Crescent City, Windansea, Ocean Beach (San Diego) (no source states which way the beach faces, or no swell range was found). Rincon (the published window "W to N" leaves nothing within 60° of its SSW facing).

## The rules (all in `spotFactsRules.ts`, tested)

- **Facing** = the compass word a guide states ("faces NW" = 315°, 22.5° resolution). Two different words for one spot means no facing recorded.
- **Swell window** = the guide's swell exposure (or workable range), narrowed to within ±60° of the facing (the Ocean Beach rule), so "S to N" cannot let a grazing swell make a height.
- **Minimum period** = 8 s, a generic published threshold (swell under about 8 s is choppy wind swell), labelled "published guide (generic)": no guide states a spot minimum.
- **Shelter** = 1 only for a beach no source calls sheltered; a point, reef or jetty needs a source that says it is exposed; a sheltered spot gets no estimate. Where sources disagree (Linda Mar: Surfnerd somewhat protected, Surf-Forecast exposed) the narrower window is used and the disagreement is in the note.
- **MOP:** a candidate whose CDIP shore normal is within 25° of the facing is assigned (closest wins). Linda Mar faces NW (315°): SM375 (320°) assigned, SM376 (339°) is 24° off. Bolinas faces SE (135°): MA140 (174°) is 39° off, so Bolinas uses v1.
- Values already held (Ocean Beach's CDIP orientation and reviewed window) are never overwritten.

## Rating distribution after (daylight hours, 45 spots x 72 h, fresh snapshot 2026-11-03 04:26 UTC)

SOLID 20.7%, NOT BAD 36.6%, SURFABLE 24.1%, WEAK 16.8%, POOR 1.8%; nothing at GOOD or above. Largest category 36.6% (limit 50%). Before (T-064 table, an earlier snapshot): NOT BAD 40.0%, SOLID 9.1%. The shift toward SOLID comes from known wind relations: a published facing lets the rating tell offshore from onshore wind at 39 spots instead of one (the unknown-wind ceilings no longer apply to them).

## Honest limits

- The facts come from two commercial guide sites, read through page summaries; they are published statements, not surveys, and the sites sometimes disagree (recorded in each row's note). Names were matched to our catalogue: Trestles uses the Lowers page, Salt Creek the "Point" page, Oceanside the Oceanside Beach page, Rincon the Rincon Point page, Malibu the First Point page, Topanga the Topanga State Beach page (identity checked by coordinates), Windansea and San Diego's Ocean Beach have only Surf-Forecast pages.
- The compass-word facing is coarse (22.5°), and v1 (offshore swell through a Komar-Gaughan breaker height) is unvalidated everywhere except as a consistency check at Ocean Beach. At points and reefs a straight-beach formula is less suited; those spots only qualify because a source calls them exposed.
- Steamer Lane's guide says it faces southeast, which leaves a narrow window (few estimates); this is a guide statement, not corrected by us.
- Nothing here validates accuracy. Observations (T-059/T-060) are what will calibrate each spot.
