# California MOP coverage (ca-mop, 2026-11-12)

Goal: no California spot shows only the labelled offshore height when a CDIP MOP point can serve it. MOP already includes the sheltering, the window and the islands, so it needs no guide window or shelter.

**What changed**
1. `scripts/mop-scan.mjs` was run for the 130 California spots (of the 143 offshore-only ones) that had no MOP candidates; the earlier scan held empty lists for them. `docs/forecast/data/mop-candidates-all.json` now holds the points, `src/ocean/mopCandidatesSourced.ts` is regenerated (all earlier entries unchanged).
2. The existing facing-match rule (`pickMop`, 25°) now runs for those spots and places **66** of the 143.
3. New nearest-point rule (`pickNearestMop`, `src/ocean/spotFactsRules.ts`, applied in `src/ocean/mop.ts` after every reviewed, facing-matched and T-130 assignment) for spots the facing-match rule could not place: the nearest CDIP point **within 1.0 km, 10 to 20 m deep**, whose shore normal is within **30°** of the spot's facing (guide or coastline geometry) or of the median normal of its neighbouring points. Status `sourced`, provenance "chosen by us: nearest CDIP point, not owner-reviewed", the distance in the note. It placed **62** more (61 by facing, 1 by the neighbour check; median 0.47 km, max 0.95 km).
4. `mopServiceIds` in `services/forecast-service.mjs` = `assignedMopIds()` (76 → 198 points).

**Result (California, 322 spots): offshore-only 143 → 14.** By reason: no-profile 69 → 7, outside-window 58 → 6, no-shelter 12 → 1, wind-sea-dominant 4 → 0.

**Not assigned (14), with the reason**

| Spot | Region | Was | Why the rule did not place it |
|---|---|---|---|
| Pelican State Beach | Del Norte | no-profile | none within 1 km |
| Fort Point | San Francisco | no-profile | normal disagrees with the coast (points into a harbour or bay) (SF069) |
| Princeton Jetty | San Mateo | outside-window | none within 1 km |
| Shell Beach | San Luis Obispo | no-profile | none within 1 km |
| Santa Claus (Padaro Beach) | Santa Barbara | no-profile | none within 1 km |
| Mondos | Ventura | no-profile | none within 1 km |
| Seal Beach Jetty | Orange County | outside-window | none within 1 km |
| 7th Street | Orange County | outside-window | none within 1 km |
| Seal Beach Pier | Orange County | no-shelter | none within 1 km |
| 13th Street | Orange County | outside-window | none within 1 km |
| Dolphin Avenue | Orange County | outside-window | none within 1 km |
| Bolsa Chica | Orange County | no-profile | none within 1 km |
| Doheny | Orange County | no-profile | none within 1 km |
| Coronado City Beach/Corondo Shores Beach | San Diego | outside-window | none within 1 km |

No point was ever assigned for being nearest alone, and no point shallower than 8 m or behind a breakwater was assigned. The one refusal for the normal is Fort Point (SF069: under the Golden Gate, the normal does not agree with the coast).

**Worker budget.** 198 points × (nowcast + forecast) = 396 MOP targets (was 152). The cold fill with an empty bucket takes 13 runs instead of 9 (about 65 min at 5-min ticks, once); each run uses at most 710 of the 1,000 subrequests; a warm run costs 30. The How-right job reads 265 of its 400 objects (was about 143). Nothing was dropped.

**Not done / caveats.** Not checked in a browser (data only; the headline for these spots now shows the MOP number with the "chosen by us" label). MOP heights at these points are not yet compared with buoys or the NWS SRF. The Princeton Jetty vault note still says "no CDIP point within the facing tolerance" (true for the 25° rule; the 1 km rule found none either).
