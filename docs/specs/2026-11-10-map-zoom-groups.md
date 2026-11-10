# Map grouping by zoom, Surfline-style (2026-11-10)

The user, after seeing the coast pills live (a49b27fc):

> "in that map view I would prefer it if it showed you that reading once you actually zoomed closer in to that area. Also you should be able to view each spot individually only once you've zoomed in pretty close, like Surfline. The grouping could be as small as like 10 or 20 spots, still with the average. Obviously when you're still zoomed out with more spots in view the larger average is ok, but it should also have the same function if you're zoomed closer in. Make spec and deploy that please."

Deploy is approved for this change once it passes review and the gates.

## Today
- Below z7, each browsing region, zone, coast or seaboard is one pill. Above z7, pins.
- A pill shows the **best** rating and its spot, the spread bar and the count. There is no average (lead choice, 2026-11-10).
- Fully zoomed out, the big pills show a reading. For example, "West Coast · Best: Solid" covers 102 spots.

## What changes
1. **Levels by zoom.** Exact breakpoints are tuned by the no-overlap layout and checked at 1440 and 390.

   | Zoom | Shows |
   |---|---|
   | z ≤ about 4 (a seaboard or Hawaii as one pill) | Name and spot count only, no reading ("West Coast · 102 spots · zoom in for ratings"). Tapping zooms to that area. |
   | about z5–z9 | Group pills with a reading, getting smaller as you zoom: coast, then region, then **clusters of about 10–20 nearby spots**. |
   | z ≥ about 10 | Individual spot pins only, as now above z7. The focused spot and favourites keep their pins at every zoom. |

2. **Clusters of 10–20.** A new level below the browsing region:
   - **Splitting:** a region with more than about 20 spots is split along the coast into contiguous runs of 10–20 spots each, ordered along the coastline (e.g. Southern California, 36 spots, becomes 2–3 clusters). The split is deterministic.
   - **Names:** each cluster is named from its first and last spot ("Malibu to Venice") or from a published locality the spots share. Never invent a name.
   - **Small regions:** a region with 20 spots or fewer is one cluster.
   - **Rebuilds:** clusters are recomputed when the catalogue changes. The 1,032-spot batches are about to land.

3. **The reading is an average, as the user asked, labelled as one.**
   - **Main line:** "Avg: Fair". It is the band of the mean score over the cluster's rated, daylit spots at the selected hour.
   - **Also kept:** the best spot ("best Good · Steamer Lane") and the spread bar, so a firing spot isn't hidden by the average.
   - **Counting:** unrated and dark spots are excluded from the mean and counted. When every rated spot is dark, the pill says "After dark".
   - **Snapshot spots** (from the daily forecast) count in the mean like live ones. The age is shown when any spot comes from the snapshot ("forecast 9 h old"), and stripes as now.
   - **Coverage:** "Avg of 8/15" when not every spot is rated or loaded.

4. **Unchanged:**
   - no pill overlap;
   - no spot hidden unless a drawn pill or pin covers it;
   - pills built once and updated in place;
   - tapping a pill frames its spots;
   - the clock follows the focused spot (or the viewer's zone);
   - focus and deselect behave as now.

## Acceptance
- **Levels at 1440 and 390:**
  - at z3–4, pills with no reading;
  - at z5–9, pills with readings, smallest groups of 10–20 by z8–9;
  - at z10 and above, pins only, except that the focused spot and favourites always show.
- **Average:**
  - a unit test proves the average equals the mean of the cluster's rated daylit scores, mapped to a band;
  - best and spread are still correct;
  - "Avg of n/m" whenever coverage is partial.
- **Cluster sizes:** for every region, all cluster sizes are between 10 and 20, or the whole region is 20 or fewer.
- **Cluster names:** they come only from spot names or a shared published locality.
- **No regressions:** coast-pills.mjs and coast-pills-snapshot.mjs, updated for the new levels, pass. So do t043, clock-deselect and landscape-tap, and the screenshots get looked at.
- **Reviews:** a code review plus a data-honesty review (the average must be labelled as one).
- **Ship:** after the 16:00 PST spot merges, so the clusters are built on 1,032 spots. Then deploy (approved) and verify on production.

## Owner
product-term (it built the coast pills). Level 2–3: map UI, summary wording.

## 5. Search on the map flies to the spot (user, 2026-11-10)
"If you're on the map and want to search up a spot, click or enter that spot: it zooms into that part of the map. The search feature is great and correctly opens the spot, but it should also zoom in to that spot automatically."

- On the Explore map, picking a spot from the search (by click or Enter) focuses it as now **and flies the map to it**. The zoom lands at the pins level (z ≥ the pin threshold), so the spot's own pin shows, centred in the clear area: above the phone sheet and time bar, and not under the search box.
- **Keep:** the callout or peek opens as today; the URL updates (lat/lon/z/spot); the time and hour stay as selected.
- **Reduced motion:** a jump instead of a fly.
- **Also on the map:** the same applies when a spot is picked from the "N spots in view" list.
- **Acceptance (1440 and 390):**
  - search "Pipeline" from a California view: the map ends centred on Pipeline at the pin level, with its pin visible and not covered;
  - Enter works the same as a click;
  - keyboard focus is sensible;
  - t043 and the coast-pills scripts still pass.
