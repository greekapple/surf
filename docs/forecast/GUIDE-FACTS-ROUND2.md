# Guide facts, round 2 (offshore-surf step 2)

Spec: docs/specs/2026-11-11-offshore-only-spots.md step 2. Inputs: the cited research in `docs/forecast/data/profile-research/` (410 spots, 54 files, its README holds the judgement calls, all kept) and two reader fixes in `docs/forecast/data/build-guide-facts.ts`. Output: `src/ocean/spotFactsSourced.ts` (regenerated, never hand-edited) and the per-spot log `docs/forecast/data/guide-facts-merge-log.json`.

## What changed in the builder
1. **Surfnerd's swell text is read whole.** Surfnerd prints a spot's swell exposure as `N - SSE. Faces ENE (surfnerd)` and its workable swell as `S - N. Best from N (surfnerd)`. The old reader could not parse the tail, dropped the exposure range for 824 spots and used the workable range instead. The tail (`. Faces X`, `. Best from X`) is now removed before the range is read.
2. **A land-side range is never a window (beaches and spots with no stated type).** Surfnerd's workable range on many East Coast beaches is drawn clockwise over the land (Corolla: `S - N` on an ENE-facing beach). On a beach: a range with no direction within 90 degrees of the facing is dropped; a workable range with nothing within 60 degrees of the facing, while the page's own exposure range contains the facing, is dropped as a disagreement. Each drop is written in that spot's `notes`. Points, reefs and jetties keep their workable range (swell does wrap onto them) and `wraps()` still decides.
3. **The research is merged as cited GuideFacts.** A field the old record lacks takes the new cited value; where both agree the newer cited one wins; a CONTRADICTION keeps the old, already accepted value and is logged. Contradiction: facings more than 22.5 degrees apart (then the old window is kept too: it is relative to the facing); windows overlapping by less than half of the narrower; exposures two levels apart; a beach vs a point/reef/jetty type. Sources are the union by URL. The README's calls are kept: no window from the facing alone, contradictions stay null, exposure only from swell sentences.
4. **Hold-back hook.** `docs/forecast/data/guide-facts-held.json` ({spotId: reason}) removes a spot's window (no estimate) and records the reason; it is empty (nothing was held, see below).

## Result (static offshore-only, the 410 spots with no breaking profile)
Offshore-only because a v1 input is missing: **410 before, 206 after** (171 still have no profile, 34 now have a profile with shelter 0: a sheltered spot with a published open sector, which only the CDIP v2 estimate can use, and 1 has no orientation). **204 spots newly get a v1 surf height.** Breaking profiles overall: 664 before, 902 after.

| Region | before | after | newly profiled |
|---|---|---|---|
| Outer Banks | 25 | 0 | 25 |
| Massachusetts | 23 | 7 | 16 |
| Southeast Florida | 22 | 13 | 9 |
| Santa Barbara | 21 | 18 | 3 |
| Northeast Florida | 21 | 2 | 19 |
| Puerto Rico | 21 | 15 | 6 |
| Los Angeles | 20 | 11 | 9 |
| Florida Gulf Coast | 18 | 1 | 17 |
| New York | 17 | 3 | 14 |
| Space Coast | 15 | 1 | 14 |
| Orange County | 14 | 12 | 2 |
| Rhode Island | 10 | 7 | 3 |
| San Diego | 10 | 9 | 1 |
| Oahu South Shore | 10 | 8 | 2 |
| Monterey | 9 | 5 | 4 |
| Maui | 9 | 6 | 3 |
| Sitka | 8 | 8 | 0 |
| Southern New Jersey | 8 | 4 | 4 |
| Southern North Carolina | 8 | 0 | 8 |
| Treasure Coast | 8 | 4 | 4 |
| Maine | 7 | 5 | 2 |
| Mendocino | 7 | 4 | 3 |
| Big Island | 7 | 4 | 3 |
| Clallam | 6 | 5 | 1 |
| Santa Cruz | 6 | 6 | 0 |
| Virginia | 6 | 2 | 4 |
| San Luis Obispo | 6 | 5 | 1 |
| Texas | 5 | 3 | 2 |
| Grays Harbor | 4 | 3 | 1 |
| Northern New Jersey | 4 | 0 | 4 |
| Ventura | 4 | 1 | 3 |
| South Carolina | 4 | 1 | 3 |
| Alabama | 4 | 0 | 4 |
| Kauai | 4 | 3 | 1 |
| Oahu North Shore | 4 | 2 | 2 |
| Lanai | 4 | 4 | 0 |
| New Hampshire | 3 | 3 | 0 |
| Del Norte | 3 | 3 | 0 |
| Oahu East Side | 3 | 2 | 1 |
| Tillamook | 2 | 1 | 1 |
| Lincoln | 2 | 1 | 1 |
| San Francisco | 2 | 2 | 0 |
| San Mateo | 2 | 2 | 0 |
| Georgia | 2 | 1 | 1 |
| Florida Panhandle | 2 | 0 | 2 |
| Island | 1 | 1 | 0 |
| Jefferson | 1 | 1 | 0 |
| Pacific | 1 | 1 | 0 |
| Curry | 1 | 1 | 0 |
| Humboldt | 1 | 1 | 0 |
| Sonoma | 1 | 1 | 0 |
| Marin | 1 | 1 | 0 |
| Louisiana | 1 | 0 | 1 |
| Florida Keys | 1 | 1 | 0 |
| Oahu West Side | 1 | 1 | 0 |

## Contradictions kept as the old value (64, all in the merge log)
By field: 1 exposure, 1 facing, 44 swellWindow, 18 waveType. They stay as they were; nothing was averaged. A facing the old guides already called contradictory stays null.

## Checks of the new estimates
- **NWS comparison** (`scripts/srf-compare.mjs`, uncalibrated v1 chain, R2 captures of 2026-11-10 to 12 and the stored SRF products): 45 of the 204 newly profiled spots have a readable NWS range for a captured day (92 spot-days). Per-spot median of ours over theirs: 0.60 to 1.31 (median 0.67; the spots sit below the NWS as the whole set does, see SRF-COMPARE.md). **No spot was above 2x or below 1/2 of the NWS on most of its zone-days, so none is held back.** The other 159 have no comparable NWS value yet (their zone gives no readable height, or the facing does not match, or the range is "or less", or the product is out of season): they are NOT checked, only filtered by the rules; the comparison reruns as captures accumulate.
- **Existing profiles moved.** Of the 664 spots that already had a profile, 305 got a different swell window from the reader fix (the exposure range now wins, as T-073 intended; it is usually wider): e.g. `w-us-10th-street` [112.5, 180] to [97.5, 217.5]. The estimate for an hour is unchanged where the window already admitted its swell; more hours are estimated.
- **Side effects, all intended and tested:** one more CDIP MOP point is assigned to a California spot and ingested (`MO418`, added to the Worker's `mopServiceIds`); the How-right scoring covers 763 spots instead of 549 (each daily scoring run needs about 30% more ticks, and the scored card is up to 710 KB uncompressed, served gzip: the test limits were raised to 16 ticks and 800 KB).

## Data-honesty review (one round, applied)
- An exposure compass printed in the "N - SSE. Faces ENE" form is a window only when the same surfnerd page has real break notes (a workable swell, ideal swell, tide, bottom or hazard): on a page without them it follows the facing, which is not a fact about the break (the research README's "No window"). 14 spots that would have got a facing-centred window now get none.
- Every window records the page it was read from (`swellWindow.source`: surfnerd, wannasurf or surf-forecast); the method label says "swell window from Surfnerd's swell exposure compass (N - SSE)" (or the workable range, or Wannasurf's), and Wannasurf is named as a site.
- A newer researched window may not widen the old one by more than 1.5x, and a workable range never replaces an exposure window; surfnerd's ". Best from X" tails are stripped from range texts; notes are capped at 1,600 (research 2,400) characters.
