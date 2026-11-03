# Surf estimates for the offshore-only spots: coverage before and after (T-073)

User request (2026-11-02): "why the hell is there so much gray area on the forecasting … get that data using public sources … I want to see actual working forecasts." T-071 left 14 of 45 spots showing only a labelled offshore height (`ESTIMATE-COVERAGE-T071.md`). T-073 researched those 14 again with more public sources, added three rules, and assigned CDIP nearshore model points to every spot whose facing matches one. The honesty rules are unchanged. Every estimate is labelled "model estimate", is unvalidated and carries its source line. Nothing is invented, and a spot that lacks the facts still refuses.

## Coverage

| | T-071 | T-073 |
|---|---|---|
| Spots with a breaking-estimate profile | 31 of 45 | **41 of 45** |
| Spots on v2 (an assigned CDIP MOP point) | 2 (Ocean Beach SF023, Linda Mar SM375) | **40** (every profiled spot except Bolinas) |
| Spots with a facing (stated, or derived from coastline geometry) | 39 | **44** (43 stated; Pismo's is derived) |
| Live browser check: spots with an estimate | 26 of 45 (counted over the next 72 h) | **38 of 45** (counted over the 7-day Forecast grid; 37 use v2 for the current hour; 0 page errors) |

**Still refused (4):** Cowell's, Shelter Cove, Mavericks and Rincon (reasons below).

**Live check on 2026-11-03, dev server.** Seven spots showed no estimate:
- The four refused spots.
- Bolinas, Steamer Lane and Crescent City. These three have profiles, but their published windows face south (SSE–SW, S–SSW and S–SW) and this week's swell comes from the WNW. They correctly show an offshore height.

**Home "This week" grid at 1440:**
- With the default spots, 6 of 8 rows show estimates. Bolinas and Mavericks show offshore only.
- With eight newly researched spots saved, 6 of 8 rows show estimates. Mavericks and Rincon show offshore only.

## What each of the 14 now has

| Spot | Now | Facing | Window used (after ±60°) | What made it work, or why it still refuses | MOP |
|---|---|---|---|---|---|
| Stinson Beach | estimate, **v2 only** | SW (Surfnerd) | SSE to SW, WSW to W → 165–270° | Surfnerd calls it a sheltered crescent; Surf-Forecast calls it a fairly exposed beach break. The cautious word is kept. Under the sheltered rule the CDIP point estimates inside the sector Surfnerd lists it as open to; the offshore-swell v1 refuses | MA121 |
| Cowell's | **refused** | ESE (Surfnerd) | none | Both guides say sheltered (Surfnerd: "land in every direction"; Surf-Forecast: sheltered point break). Swell reaches it only by wrapping round Lighthouse Point, and no source lists an open sector | none |
| Huntington Pier | estimate, **v2 only** | SW (Surfnerd) | SE to SW, WSW to WNW → 165–285° | Surf-Forecast calls it sheltered. Same sheltered rule: CDIP models the sheltering, v1 refuses | OC517 |
| Mavericks | **refused** | SSW (Surfnerd) | none | Surf-Forecast now supplies the missing exposure statement ("an exposed reef break"). It still refuses under the wrap rule: its working swell (W–NW; Surfnerd and Wannasurf) lies entirely outside 60° of the SSW facing, and the nearest CDIP point (SM304, by Pillar Point) is not on the outer reef | none |
| Pleasure Point | estimate | SSE (Surfnerd) | S to W → 180–217.5° | Surf-Forecast's First Peak and Insides pages call it "a fairly exposed reef break" | SC117 |
| Davenport | estimate | SW (Surfnerd, re-read) | SSE to WNW → 165–285° | Surfnerd's page states "Faces SW", which T-071 missed. Surf-Forecast says exposed | SC255 |
| Pismo Beach Pier | estimate | 245°, **derived from coastline geometry** | S to W → 185–270° | Surfnerd gives two facings (WSW and SW). The facing is therefore derived from the CDIP MOP shore normals near the pier (circular mean 245°, spread ±1°) | SL091 |
| Point Arena | estimate | SW (Surfnerd, re-read) | S to W → 180–270° | The re-read page shows a single facing. Surf-Forecast says "fairly exposed" | M0151 |
| Shelter Cove | **refused** | none | none | Surfnerd gives "Faces S" and also "southwest-facing", so it has no single facing. No source calls the cove exposed: Surf-Forecast's "exposed reef break" is Deadman's, a separate break in the cove, so it does not apply | none |
| Humboldt North Jetty | estimate | WNW (Surfnerd, re-read) | WNW to N → 292.5–352.5° | The facing was found on re-read. Surf-Forecast: "exposed beach/jetty break" | HU541 |
| Crescent City | estimate, **v2 only** | SSW (Surfnerd) | S to SW → 180–225° | Surfnerd and Surf-Forecast cover it as South Beach, by the harbour at 41.74 N 124.17 W. Surf-Forecast and Mondo say sheltered or protected, so the sheltered rule applies (v1 refuses) | DN194 |
| Windansea | estimate | W (Surfnerd) | S to NNW → 210–330° | Surfnerd's windansea-beach page (T-071 tried a different slug). Surf-Forecast: "exposed reef break" | D0457 |
| Ocean Beach (San Diego) | estimate | WNW (Surfnerd) | SSW to NNW → 232.5–337.5° | Surfnerd's ocean-beach-pier page, which names San Diego. Surf-Forecast says exposed | D0352 |
| Rincon | **refused** | SSW (Surfnerd) | none | See "Rincon" below | none |

Every page is cited per fact, with its retrieval date, in `docs/forecast/SPOT-FACTS-REVIEW.md` (regenerated). The raw research is in `docs/forecast/data/guide-facts.json`; each changed spot has a "T-073:" note.

### Rincon: which reading of the guide is right

Surfnerd gives three facts:
- **Facing:** SSW.
- **Swell exposure:** "SE–SSE, S, SW–W".
- **Workable swell:** "W–N, best NW".

Wannasurf gives NW and W. The Surf Atlas says winter NW and W swell reaches the point through the gap between the Channel Islands and Point Conception, and that summer swell is mostly blocked.

Both readings are right. The point faces SSW, and its surf comes from W–NW swell that wraps around it. That swell lies entirely outside 60° of the facing, and the straight-shore estimate cannot represent wrap.

The exposure list has a gap at SSW, so it does not form one range. An earlier T-073 draft kept only the "SW to W" piece. The data-honesty review rejected this as an editorial edit shown as a guide quote. It is right: no guide states that window, and the islands block SW summer swell too.

Rincon therefore refuses under the wrap rule and keeps the guide text verbatim. It could estimate later in one of two ways:
- the owner reviews a wrap window;
- a reviewed CDIP point on the point is used with its own refracted direction (B0001, 10 m, normal 190°, is the nearest).

## The rules (`src/ocean/spotFactsRules.ts`, tested)

1. **Sheltered with a published open sector.** A spot that a source calls sheltered can still estimate when a guide lists the swell directions it is open to (its "swell exposure"). The window is that sector, clamped to ±60° of the facing. The profile's shelter factor is **0**, so the offshore-swell estimate (v1) refuses with "no-shelter". Only the CDIP nearshore estimate (v2) can estimate, because CDIP models the real headlands, bathymetry and islands; v2 does not use a manual shelter factor. A generic "workable" range does not count as an open sector, and neither does "land in every direction" (Cowell's). Spots: Stinson, Huntington, Crescent City, all three with an assigned CDIP point.
2. **Facing derived from coastline geometry.** When no guide states a single facing, the facing can be the circular mean of the nearest CDIP MOP shore normals (agency data, read from each point's own metadata). It needs at least 3 and at most 5 valid points within 1.5 km, all within 30° of the mean; otherwise nothing is derived. Its provenance is `derived from coastline geometry`, cited to the CDIP metadata and never to a guide. Spot: Pismo.
3. **Wrap.** A spot refuses when the guides' workable swell range lies entirely outside ±60° of the stated facing, because its surf comes from swell that wraps around a point or reef. Spots: Mavericks and Rincon. Cowell's also meets this rule, besides being sheltered.

**Parser fix, applied to every spot** (`docs/forecast/data/build-guide-facts.ts`):
- A guide's exposure list ("SSE to SW, WSW to W") becomes one range when its pieces are contiguous. A gap of more than one compass point gives no range.
- Bracketed attributions ("S to W (surfnerd)") are ignored.

T-071 meant to prefer the exposure range, but at about 18 spots it fell back to the workable range because of those brackets and lists. With the fix, windows changed at spots that were already covered:

| Already-covered spot | T-071 window | T-073 window |
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
| Black's Beach | 210–315 | 210–330 |

Ocean Beach's profile swell window also changed (S–N to S–WNW). Its reviewed breaking window, 203–323°, is unchanged.

## MOP points (`scripts/mop-scan.mjs`, `src/ocean/mopCandidatesSourced.ts`)

The scan read every California MOP prefix in the CDIP catalogue: B, D, DN, HU, L, M, MA, MO, OC, SC, SF, SL, SM, SN and VE. For each spot it kept the 5 nearest points that have a valid shore normal and lie within 2.5 km. CDIP's −999.99 fill values are dropped.

The T-071 facing-match rule (shore normal within 25° of the facing; the closest wins) then assigned **38 more points**. Bolinas still has no point within 25°. Spots that refuse get no point.

- `mopServiceIds` in `services/forecast-service.mjs`, which is shared with the Worker, now holds all 40 ids.
- The browser proxy route now accepts one-letter prefixes (D0457, B1084).
- Assignments are rule-based, labelled "assigned by the facing-match rule", and not owner-reviewed.

## Rating distribution (45 spots × 72 h, all hours, snapshot 2026-11-03 05:33 UTC)

| Category | Share of spot-hours |
|---|---|
| SOLID | 31.9% |
| NOT BAD | 30.6% |
| SURFABLE | 25.1% |
| WEAK | 11.3% |
| POOR | 1.1% |
| GOOD or above | 0% |

The largest category is 31.9%, below the 50% limit. The distribution depends on facings, which did not change in the later fixes. It cannot be compared one-to-one with T-071's 20.7% SOLID, which used a different snapshot and counted daylight hours only. With a known facing at 44 spots, the wind factor can tell offshore from onshore wind at five more spots.

## Honest limits

- **Sources.** They are commercial guide pages read through fetch summaries, not surveys. Where they disagree, the note says so.
- **Pismo.** Its facing and its MOP point come from the same CDIP shore normals, so the facing match there is not an independent check. The Nearshore card now says so.
- **Method label.** It comes from `src/services/headlineSurf.ts`, which engineering owns and this task did not edit. It still reads "facing and swell window from published guides (…)". For Pismo the site list ends with "facing derived from CDIP coastline geometry", but the leading words should say the facing is derived. Follow-up for engineering. The same label would also say "point … assigned by the facing-match rule" without noting that this match is circular.
- **v1 fallback.** When v2 refuses an hour as outside the window, the headline falls back to v1 (North Jetty: CDIP direction 286° at HU541 against a window of 292.5–352.5°). That order is headline logic and is unchanged here. At the three sheltered spots v1 refuses (shelter 0), so those spots show an offshore height instead.
- **Accuracy.** Nothing here validates it. Observations (T-059/T-060) are what will calibrate each spot.
