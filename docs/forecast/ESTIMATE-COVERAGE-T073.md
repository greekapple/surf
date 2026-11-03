# Surf estimates for the offshore-only spots: coverage before and after (T-073)

User request (2026-11-02): "why the hell is there so much gray area on the forecasting … get that data using public sources … I want to see actual working forecasts." T-071 left 14 of 45 spots on labelled offshore height only (`ESTIMATE-COVERAGE-T071.md`). T-073 researched those 14 again with more public sources, added two rules, and assigned CDIP nearshore model points to every spot whose facing matches one. Honesty rules are unchanged: every estimate is labelled "model estimate", unvalidated, with its source line; nothing is invented, and a spot without the facts still refuses.

## Coverage

| | T-071 | T-073 |
|---|---|---|
| Spots with a breaking-estimate profile | 31 of 45 | **43 of 45** |
| Spots on v2 (an assigned CDIP MOP point) | 2 (Ocean Beach SF023, Linda Mar SM375) | **42** |
| Spots with a facing (stated, or derived from coastline geometry) | 39 | **44** (43 stated, Pismo derived) |
| Live check in the browser (Forecast page, 7-day grid; T-071 counted the next 72 h) | 26 of 45 | **40 of 45** spots show an estimate on at least one day (38 on v2 for the current hour); 0 page errors |

The 5 without an estimate in the live check: Cowell's and Shelter Cove (refused), and Bolinas, Steamer Lane and Crescent City, which have profiles but whose published windows face south (SSE–SW, S–SSW, S–SW) while this week's swell is from the WNW, so they correctly show offshore height. Home's "This week" grid at 1440 showed estimates in 7 of 8 rows with the default spots (Bolinas offshore only) and in 8 of 8 rows with eight of the newly covered spots saved (Rincon estimates on 5 of 8 days, offshore where its window is not met).

Still refused (2): **Cowell's** and **Shelter Cove** (reasons below).

## What each of the 14 now has

| Spot | Now | Facing | Window used (after ±60°) | What made it work, or why it still refuses | MOP |
|---|---|---|---|---|---|
| Stinson Beach | estimate | SW (Surfnerd) | SSE to SW, WSW to W → 165–270° | Surfnerd calls it a sheltered crescent; Surf-Forecast calls it a fairly exposed beach break. New rule: the cautious word is kept and the estimate runs only inside the directions Surfnerd lists it as open to | MA121 |
| Cowell's | **refused** | ESE (Surfnerd) | — | Both guides say sheltered (Surfnerd: "land in every direction"; Surf-Forecast: sheltered point break); surf reaches it only by wrapping round Lighthouse Point. No source lists an open sector, and its S–NW range has nothing within 60° of ESE | — |
| Huntington Pier | estimate | SW (Surfnerd) | SE to SW, WSW to WNW → 165–285° | Surf-Forecast calls it sheltered; Surfnerd lists the open sector (same new rule) | OC517 |
| Mavericks | estimate | SSW (Surfnerd) | SSE to WNW, WNW to NNW → 157.5–262.5° | Surf-Forecast: "an exposed reef break" (the missing exposure statement). The guides' best swell (W–NW) wraps onto the reef and lies outside 60° of the SSW facing; see limits | SM304 |
| Pleasure Point | estimate | SSE (Surfnerd) | S to W → 180–217.5° | Surf-Forecast First Peak and Insides pages: "a fairly exposed reef break" | SC117 |
| Davenport | estimate | SW (Surfnerd, re-read) | SSE to WNW → 165–285° | Surfnerd's page states "Faces SW" (missed in T-071); Surf-Forecast says exposed | SC255 |
| Pismo Beach Pier | estimate | 245° **derived from coastline geometry** | S to W → 185–270° | Surfnerd gives two facings (WSW and SW), so none is stated; new rule derives the facing from CDIP MOP shore normals near the pier (circular mean 245°, spread ±1°) | SL091 |
| Point Arena | estimate | SW (Surfnerd, re-read) | S to W → 180–270° | Re-read shows one facing; Surf-Forecast "fairly exposed" | M0151 |
| Shelter Cove | **refused** | — | — | Surfnerd gives "Faces S" and "southwest-facing"; no source calls the cove exposed (Surf-Forecast's "exposed reef break" is Deadman's, a separate break, so it is not applied). A reef needs an exposed statement | — |
| Humboldt North Jetty | estimate | WNW (Surfnerd, re-read) | WNW to N → 292.5–352.5° | Facing found; Surf-Forecast "exposed beach/jetty break" | HU541 |
| Crescent City | estimate | SSW (Surfnerd) | S to SW → 180–225° | Surfnerd and Surf-Forecast cover it as South Beach (41.74 N 124.17 W, by the harbour). Surf-Forecast and Mondo say sheltered/protected; Surfnerd lists the open sector (same new rule) | DN194 |
| Windansea | estimate | W (Surfnerd) | S to NNW → 210–330° | Surfnerd's windansea-beach page (T-071 tried another slug); Surf-Forecast "exposed reef break" | D0457 |
| Ocean Beach (San Diego) | estimate | WNW (Surfnerd) | SSW to NNW → 232.5–337.5° | Surfnerd's ocean-beach-pier page (San Diego stated on it); Surf-Forecast "exposed" | D0352 |
| Rincon | estimate | SSW (Surfnerd) | SW to W → 225–262.5° | See "Rincon" below | B0001 |

Every page is cited per fact in `docs/forecast/SPOT-FACTS-REVIEW.md` (regenerated) with its retrieval date; the raw research is `docs/forecast/data/guide-facts.json` (each changed spot has a "T-073:" note).

### Rincon: which reading of the guide is right

Surfnerd says Rincon faces SSW, lists its swell exposure as "SE–SSE, S, SW–W" and its workable swell as "W–N, best NW". Both are right: the point faces SSW and winter W–NW swell wraps around it. T-071 used the workable range, which lies entirely outside 60° of the facing, so nothing was left. T-073 uses the guide's exposure sector instead (the rule every other spot follows), and of its pieces only **SW to W**, the piece that adjoins the wrap range: The Surf Atlas says summer swell is mostly blocked by the Channel Islands, so the S pieces are dropped. Window 225–262.5°. The wrapping W–NW swell itself still cannot be represented by a straight-beach formula; v2 (CDIP point B0001, 10 m, normal 190°) carries CDIP's own refracted direction, which already includes the islands and Point Conception.

## The two new rules (`src/ocean/spotFactsRules.ts`, tested)

1. **Sheltered with a published open sector.** A spot a source calls sheltered estimates only when a guide lists the swell directions it is open to (its "swell exposure"); the window is that sector, clamped to ±60° of the facing, and shelter 1 applies only inside it. A generic "workable" range is not enough, nor is "land in every direction" (Cowell's). Spots: Stinson, Huntington, Crescent City.
2. **Facing derived from coastline geometry.** When no guide states a single facing, the facing may be the circular mean of the nearest CDIP MOP shore normals (agency data, each point's own metadata): at least 3 and at most 5 valid points within 1.5 km, all within 30° of the mean, otherwise nothing is derived. Provenance `derived from coastline geometry`, cited to the CDIP metadata, never to a guide. Spot: Pismo.

Parser fix applied to every spot (`docs/forecast/data/build-guide-facts.ts`): a guide's exposure list ("SSE to SW, WSW to W") becomes one range when its pieces are contiguous (a gap of more than one compass point gives no range), and bracketed attributions ("S to W (surfnerd)") are ignored. T-071 meant to prefer the exposure range but fell back to the workable range at about 20 spots because of those brackets and lists. With the fix, windows changed at already-covered spots, mostly narrower: Ocean Beach profile S–N → S–WNW (its reviewed breaking window 203–323° is unchanged), narrower at Manresa, Moss Landing, Asilomar, Carmel, Sand Dollar, Salmon Creek, Dillon Beach, Salt Creek; wider at Waddell, C Street, County Line, Zuma, The Wedge, Trestles, Oceanside, Black's (their exposure lists reach SE–SSE or NNW); shifted at Moonstone (270–330° → 210–315°).

| Already-covered spot | T-071 window (from) | T-073 window (from) |
|---|---|---|
| Montara | 225–330 (workable) | 210–330 (exposure SSW–NNW) |
| Waddell Creek | 180–285 | 165–285 |
| Manresa | 187.5–307.5 | 202.5–270 |
| Moss Landing | 210–330 | 225–292.5 |
| Asilomar | 232.5–352.5 | 247.5–337.5 |
| Carmel Beach | 187.5–307.5 | 202.5–292.5 |
| Sand Dollar | 210–330 | 247.5–315 |
| Salmon Creek | 210–330 | 210–315 |
| Dillon Beach | 210–315 | 270–315 |
| Moonstone Beach | 270–330 | 210–315 |
| C Street | 180–240 | 157.5–240 |
| County Line | 180–262.5 | 142.5–262.5 |
| Zuma | 180–270 | 165–285 |
| The Wedge | 180–225 | 157.5–262.5 |
| Salt Creek | 187.5–307.5 | 187.5–292.5 |
| Trestles | 180–262.5 | 142.5–262.5 |
| Oceanside | 180–285 | 165–285 |
| Black's Beach | 210–315 | 210–330 | This is a separate, revertible part of the first T-073 commit.

## MOP points (`scripts/mop-scan.mjs`, `src/ocean/mopCandidatesSourced.ts`)

The scan read every California MOP prefix in the CDIP catalogue (B, D, DN, HU, L, M, MA, MO, OC, SC, SF, SL, SM, SN, VE) and kept, for each spot, the 5 nearest points with a valid shore normal within 2.5 km (CDIP's −999.99 fill values are dropped). The T-071 facing-match rule (normal within 25° of the facing, closest wins) then assigned **40 more points**; Bolinas still has none within 25°. The service list `mopServiceIds` in `services/forecast-service.mjs` (shared with the Worker) now holds all 42 ids, and the browser proxy route accepts one-letter prefixes (D0457, B0001). Assignments are rule-based, labelled "assigned by the facing-match rule", not owner-reviewed.

## Rating distribution (45 spots x 72 h, all hours, snapshot 2026-11-03 05:33 UTC)

SOLID 31.9%, NOT BAD 30.6%, SURFABLE 25.1%, WEAK 11.3%, POOR 1.1%; nothing at GOOD or above. Largest category 31.9% (limit 50%). Not comparable one-to-one with T-071's 20.7% SOLID (a different snapshot and daylight-only there); a known facing at 44 spots lets the wind factor tell offshore from onshore at five more spots.

## Honest limits

- The sources are commercial guide pages read through fetch summaries, not surveys; where they disagree the note says so.
- **Mavericks and Rincon wrap**: their best swell arrives around a point or reef from outside ±60° of the stated facing. v1 refuses those hours; v2 uses CDIP's refracted direction at a 10–15 m point near the shore, which for Mavericks (SM304, near Pillar Point) is not the outer reef. The straight-contour v2 cannot represent reef focusing, so Mavericks heights are likely understated; its guide size band (12–30 ft) is shown alongside.
- **Sheltered spots** use shelter 1 inside the open sector. v2 includes the real sheltering (CDIP models islands and headlands); v1, the fallback, does not. Mondo says Crescent City is often about 40% of the swell; that is noted, not applied.
- **Pismo's facing and its MOP point come from the same CDIP shore normals**, so the facing match there is not an independent check.
- The method label in `src/services/headlineSurf.ts` (not edited here, owned by engineering) still reads "facing and swell window from published guides (…)"; for Pismo the site list includes "CDIP coastline geometry (facing)", but the wording should say the facing is derived. Follow-up for engineering.
- When v2 refuses an hour as outside the window (North Jetty: CDIP direction 286° at HU541, window 292.5–352.5°), the headline falls back to v1; that order is headline logic, unchanged here.
- Nothing here validates accuracy. Observations (T-059/T-060) are what will calibrate each spot.
