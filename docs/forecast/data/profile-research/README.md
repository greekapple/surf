# Profile research: cited spot facts for offshore-only spots

Research for the spots that show only the offshore wave height because they have no breaking profile (`profile:no-profile`, 405 spots, and `profile:no-orientation+no-profile`, 5 spots, in `docs/forecast/data/offshore-only.json`, commit 3e9ed16). The aim is the facts the v1 breaking estimate needs (a facing and a swell window), each from a cited page or from coastline geometry, so these spots can show a surf height. Nothing here is wired into the app: these files are input for `build-guide-facts.ts`-style merging, and a reviewer decides what goes in.

One file per region: `<region-slug>.json`, an array of objects in the `GuideFacts` shape of `src/ocean/spotFactsRules.ts` (without `surfnerdWorkableWind`). Every page was fetched on 2026-11-12 (UTC) and every value comes from a page listed in that record's `sources`, or from coastline geometry (`facing.basis: "coastline geometry"`).

## Why these spots had no profile

Most of the 410 already had guide facts in `src/ocean/spotFactsSourced.ts`; they failed the rules in `enablement()`. Before this research, the reasons were: no swell window (188), a point/reef/jetty with no source saying "exposed" (127), the workable swell lying wholly outside ±60° of the facing (66), sheltered with no open sector (47), no facing (5), a "no detailed break information" page (1). Two of those are parsing problems, not missing facts:

- Surfnerd's swell exposure is printed as `N - SSE` followed by `(Faces ENE)`; the old reader saw `N - SSE. Faces ENE` and could not parse it, so the exposure range was dropped and the workable range used instead.
- On much of the US East Coast, surfnerd's "Workable swell" is drawn clockwise over the land (Corolla: `S - N`, drawn S→W→N, for an ENE-facing beach). Used as the window it made the beach look like a wrapping point and the rules refused it.

## Method

1. **Which page.** The spot's surfnerd and surf-forecast URLs from the earlier research (`docs/forecast/data/guide-facts.json`); where there was no surf-forecast page, a name match against surf-forecast's USA and Puerto Rico break lists; wannasurf pages from the earlier research, plus a name match against wannasurf's zone indexes for the USA and Puerto Rico. Every candidate page was fetched with curl (User-Agent "SWELLO surf forecast prototype", at least 1.1 s between requests) and cached outside the repo.
2. **Same spot.** A page is used only when its own coordinates are within 3 km of our pin (surfnerd: the page's GeoCoordinates; surf-forecast: its "Lat Long", given to 0.01°, about 1 km; wannasurf: the map bounds of the spot). A page farther away is not used and the record says so. Names were matched first, so a used page matches by name and by location.
3. **Facing.** Surfnerd's "(Faces X)" under its swell-exposure compass, basis `guide`. Where no page gives one, coastline geometry (below) or null.
4. **Swell window.** In this order:
   - surfnerd's **swell exposure** (basis `exposure`), but only when the same page has break notes and a known workable swell. A surfnerd page that shows "Unknown" for workable swell, or says it "doesn't have detailed condition notes" / has no "specific guidance on its swell window", gets **no window**: on those pages the exposure compass simply follows the facing, and a window inferred from the facing alone is not a fact about the break. The facing is still recorded.
   - else surfnerd's **workable swell** (basis `workable`, at least 45° wide);
   - else wannasurf's **good swell directions** (an 8-point list such as "SouthWest, South, SouthEast", turned into one clockwise range when the list is contiguous; basis `workable`).
   Ranges are clockwise from→to exactly as the page writes them (surfnerd draws its sectors clockwise from the first word). A multi-piece range ("E - S, SSW - WSW") becomes one range when each piece starts at most 22.5° after the previous one ends, the rule of `build-guide-facts.ts`; a list with a bigger gap gives no range and the record says so.
5. **Disagreement.** Where a page's workable range lies wholly outside ±60° of its own facing while its own exposure range contains the facing, on a beach (or a spot with no stated type), the two disagree and **no workable range** is recorded (the reason is in `notes`). Where any window lies wholly on the landward side (no direction within 90° of the facing) of a beach, no window is recorded. Points, reefs and jetties keep their workable range as written, since swell can wrap onto them; the app's `wraps()` rule then decides.
6. **Exposure word.** From surf-forecast's guide sentence ("is a fairly exposed beach and reef break", "is a sheltered beach break") and surfnerd guide sentences that state swell exposure: the word must sit in a sentence about swell ("sheltered from north and northeast swells") or name a sheltered/protected cove or bay. "Exposed rocks/reef", wind shelter, trade winds and "protected marine preserve" are not swell exposure and are skipped (a first pass that took any sentence with the word wrongly read "exposed rocks at low tide" as an exposed break; it was tightened before these files were written). Where sources differ, the more cautious word is used (sheltered > somewhat protected > exposed) and the record says so. "fairly/quite/reasonably exposed" count as exposed.
7. **Type.** Surfnerd "Wave types", surf-forecast's guide sentence and wannasurf "Wave Type"; a point, river mouth, reef or jetty anywhere wins over beach (the more cautious reading), noted when they differ.
8. **Other facts.** Best swell (surfnerd "Best from", surf-forecast "best swell direction"; both kept when they differ), tide (surfnerd "Works at", surf-forecast's tide sentence), bottom (surfnerd "Swell breaks over", else wannasurf), size (surfnerd's swell size, rounded to 0.5 ft; a swell size, not a face height), hazards (surf-forecast "Beware/Watch out/Take care", wannasurf "Dangers"). No forecast numbers are copied.
9. **Notes** keep the distance of each page's pin from ours, any page that was rejected and why, disagreements, and short quotes of exposure sentences.

Surfnerd also often lists a "workable wind" that is onshore for its own facing (Southern Duck: offshore from ENE on an ENE-facing beach; its wind-exposure compass agrees with the facing). Those records say the page is low-confidence; no wind fact is recorded here.

### Facing from coastline geometry

Prepared as the fallback for spots whose pages state no facing. **It was not needed in this round: every one of the 410 spots has a surfnerd page within 3 km that states a facing ("Faces X"), so no record uses basis `coastline geometry`.** The method, for a later round: OpenStreetMap ocean polygons from OpenFreeMap vector tiles (`https://tiles.openfreemap.org/planet`, zoom 14, layer `water`, class `ocean`; ODbL). Around our pin, 72 points (every 5°) on circles of 0.5, 1 and 2 km are tested for ocean; at each radius the seaward direction is the circular mean of the bearings of the ocean points. The facing is accepted only when every circle is 20–80% ocean (a coastline, not open water or a lagoon) and the three directions agree within 22.5°; it is their mean rounded to the nearest 22.5° point. The source entry names the tile, the three directions and the ocean fractions. Barrier islands with a sound behind them usually fail the test (the sound is also "ocean" in OSM) and get no facing. Checked against guide facings on the Outer Banks: 4 of 4 accepted agreed (ENE), one was 22.5° off (Cape Hatteras Lighthouse, E vs ESE). It is approximate, not a survey of the break, and it never produces a window by itself.

### What the rules then do

No app code or script in the repo was changed. The counts below run the app's own `enablement()` and `breakingProfileFromGuide()` over these records: "profile" means a breaking profile would be built; "v1" means its shelter is 1 (a source-called-sheltered spot with an open sector gets shelter 0, which the offshore-swell estimate still refuses).

## Sources

- surf-forecast.com break guides (`/breaks/<name>`), surfnerd.com spot guides (`/surf-forecast/<slug>`), wannasurf.com spot guides; OpenFreeMap / OpenStreetMap coastline for geometry.
- Not used: Surfline in any form.

## Counts per region

Regions in research order (highest number of offshore-only spots first). "Partial" = researched, a page was found, but facing or window is null (the reason is in `notes`). "Profile by the rules" and "v1" are computed with the app's own `enablement()` / `breakingProfileFromGuide()`.

| Region | File | Spots | Facing + window | Partial | No source | No window: surfnerd page has no break notes | With wannasurf | Profile by the rules | v1 (shelter 1) |
|---|---|---|---|---|---|---|---|---|---|
| Outer Banks | `outer-banks.json` | 25 | 16 | 9 | 0 | 9 | 5 | 16 | 15 |
| Massachusetts | `massachusetts.json` | 23 | 7 | 16 | 0 | 18 | 4 | 6 | 3 |
| Southeast Florida | `southeast-florida.json` | 22 | 16 | 6 | 0 | 6 | 4 | 13 | 5 |
| Santa Barbara | `santa-barbara.json` | 21 | 17 | 4 | 0 | 4 | 6 | 3 | 3 |
| Northeast Florida | `northeast-florida.json` | 21 | 13 | 8 | 0 | 8 | 7 | 11 | 11 |
| Puerto Rico | `puerto-rico.json` | 21 | 18 | 3 | 0 | 10 | 13 | 5 | 3 |
| Los Angeles | `los-angeles.json` | 20 | 17 | 3 | 0 | 3 | 5 | 8 | 6 |
| Florida Gulf Coast | `florida-gulf-coast.json` | 18 | 5 | 13 | 0 | 14 | 4 | 4 | 4 |
| New York | `new-york.json` | 17 | 4 | 13 | 0 | 14 | 2 | 1 | 1 |
| Space Coast | `space-coast.json` | 15 | 5 | 10 | 0 | 11 | 2 | 5 | 5 |
| Orange County | `orange-county.json` | 14 | 10 | 4 | 0 | 4 | 5 | 4 | 1 |
| Rhode Island | `rhode-island.json` | 10 | 4 | 6 | 0 | 6 | 3 | 3 | 0 |
| Alabama | `alabama.json` | 4 | 1 | 3 | 0 | 4 | 2 | 1 | 1 |
| Big Island | `big-island.json` | 7 | 5 | 2 | 0 | 2 | 1 | 3 | 3 |
| Clallam | `clallam.json` | 6 | 1 | 5 | 0 | 6 | 1 | 1 | 1 |
| Curry | `curry.json` | 1 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| Del Norte | `del-norte.json` | 3 | 2 | 1 | 0 | 1 | 2 | 2 | 0 |
| Florida Keys | `florida-keys.json` | 1 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| Florida Panhandle | `florida-panhandle.json` | 2 | 0 | 2 | 0 | 2 | 0 | 0 | 0 |
| Georgia | `georgia.json` | 2 | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| Grays Harbor | `grays-harbor.json` | 4 | 3 | 1 | 0 | 3 | 3 | 1 | 1 |
| Humboldt | `humboldt.json` | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Island | `island.json` | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 0 |
| Jefferson | `jefferson.json` | 1 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| Kauai | `kauai.json` | 4 | 4 | 0 | 0 | 0 | 2 | 1 | 1 |
| Lanai | `lanai.json` | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| Lincoln | `lincoln.json` | 2 | 1 | 1 | 0 | 1 | 1 | 0 | 0 |
| Louisiana | `louisiana.json` | 1 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| Maine | `maine.json` | 7 | 4 | 3 | 0 | 3 | 1 | 2 | 1 |
| Marin | `marin.json` | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Maui | `maui.json` | 9 | 7 | 2 | 0 | 2 | 4 | 3 | 3 |
| Mendocino | `mendocino.json` | 7 | 2 | 5 | 0 | 6 | 3 | 2 | 1 |
| Monterey | `monterey.json` | 9 | 4 | 5 | 0 | 5 | 3 | 2 | 2 |
| New Hampshire | `new-hampshire.json` | 3 | 2 | 1 | 0 | 1 | 1 | 1 | 1 |
| Northern New Jersey | `northern-new-jersey.json` | 4 | 2 | 2 | 0 | 3 | 2 | 2 | 2 |
| Oahu East Side | `oahu-east-side.json` | 3 | 3 | 0 | 0 | 0 | 2 | 1 | 1 |
| Oahu North Shore | `oahu-north-shore.json` | 4 | 4 | 0 | 0 | 0 | 2 | 2 | 2 |
| Oahu South Shore | `oahu-south-shore.json` | 10 | 10 | 0 | 0 | 0 | 2 | 2 | 2 |
| Oahu West Side | `oahu-west-side.json` | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Pacific | `pacific.json` | 1 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| San Diego | `san-diego.json` | 10 | 9 | 1 | 0 | 1 | 3 | 1 | 1 |
| San Francisco | `san-francisco.json` | 2 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| San Luis Obispo | `san-luis-obispo.json` | 6 | 3 | 3 | 0 | 3 | 0 | 2 | 1 |
| San Mateo | `san-mateo.json` | 2 | 2 | 0 | 0 | 0 | 1 | 1 | 0 |
| Santa Cruz | `santa-cruz.json` | 6 | 5 | 1 | 0 | 1 | 2 | 2 | 0 |
| Sitka | `sitka.json` | 8 | 8 | 0 | 0 | 0 | 2 | 0 | 0 |
| Sonoma | `sonoma.json` | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| South Carolina | `south-carolina.json` | 4 | 1 | 3 | 0 | 3 | 0 | 0 | 0 |
| Southern New Jersey | `southern-new-jersey.json` | 8 | 6 | 2 | 0 | 3 | 1 | 2 | 2 |
| Southern North Carolina | `southern-north-carolina.json` | 8 | 5 | 3 | 0 | 5 | 3 | 5 | 5 |
| Texas | `texas.json` | 5 | 4 | 1 | 0 | 1 | 2 | 1 | 1 |
| Tillamook | `tillamook.json` | 2 | 0 | 2 | 0 | 2 | 0 | 0 | 0 |
| Treasure Coast | `treasure-coast.json` | 8 | 4 | 4 | 0 | 4 | 0 | 0 | 0 |
| Ventura | `ventura.json` | 4 | 4 | 0 | 0 | 0 | 1 | 3 | 3 |
| Virginia | `virginia.json` | 6 | 4 | 2 | 0 | 1 | 3 | 3 | 3 |
| **Total** | | **410** | **255** | **155** | **0** | **176** | **113** | **126** | **95** |
