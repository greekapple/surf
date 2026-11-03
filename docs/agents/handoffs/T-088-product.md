# T-088 (product): design-critic pass, remaining photos, breaker copy

Branch `worktree-product` (merged forecast-trust d5303ca first). Local commits only; no Codex.

## Part 1: design critic (8 screens × 1440/390 × light/dark = 32 shots)
The `design-critic` subagent judged the shots against RULES.md, taste-skill app-screens §13–14 and the Porsche reference. Its verdict: "Partly meets the direction": Home and Spot follow the system; Quiver, Showroom, Compare, Personal and Map drift.

**Fixed (top 5 visible, no data logic):**
1. **Showroom 390:** the fixed Board Match bar covered the size-fit line. `.br` now reserves the bar plus tab-bar height. The hotspots are smaller and quieter: 14 px dots that grow on hover; the tap target stays 44 px.
2. **Quiver dark:** the wall stays a light gallery, but its labels used dark-theme inks (~1.5–2:1). The wall now re-declares the light palette, so the fit labels and ruler ticks are readable in dark mode.
3. **Personal:** boxed settings cards and tracked-uppercase section headers ("FAVORITE SPOTS") became hairline lists with sentence-case 15 px titles.
4. **Home week grid:** the soft size curve ran through the range digits. It now sits in its own strip under the AM/mid/PM bars.
5. **Consistency:**
   - One page-title style (32 px Instrument Sans; 26 px on phones) on Quiver, Wave scale, the Map discover/compare/find pages and Personal (was 28–52 px).
   - Sentence case: "My boards", "Board match", "Compare boards", "Add board".
   - The map's sea-colour layer is now named "Offshore wave height · not surf size", in the layer menu, the legend popover and (1440) next to the legend scale.

**Not done (logic or assets, for the lead or engineering):**
- Clip the map's wave raster to an ocean mask outside the Golden Gate (it paints SF Bay), and use a one-hue ramp: map rendering.
- One board render and colour across Quiver, Showroom and Compare: needs a shared board-look source.
- Model-level rail/tail fidelity in the Showroom.
- A neutral rather than navy dark ground (a brand decision).
- The Wave scale render shows daytime light for an 11 PM hour: Fable's area.
- Unifying page left edges.

## Checks (5184)
tsc OK; unit tests 433/433; build OK; t045 54/0; t047 55/0; t074 28/0; t043 35/0; t035 29/0; t025 27/0; density ALL PASS; journeys 8/8. Shots: `playwright-toolkit/swello/artifacts/t088/{before,after}/` (32 each).

## Part 2: remaining photos (commit cceac0f)
**44 of 45** spots now have a credited photo, from Commons place categories (same rules: CC0/PD/CC BY/CC BY-SA, ≥1200 px, no Unsplash licence):
- **Moss Landing:** "Moss Landing State Beach, CA", Melissa McMasters, CC BY 2.0.
- **Malibu:** "Beach Scene at Malibu Lagoon" (the lagoon mouth at Surfrider), Adam Jones, CC BY-SA 2.0.
- **Trestles:** "Metrolink Trestles Beach" (the beach and its namesake trestle), Andrewaronoshn, CC BY-SA 4.0.
- **Cardiff:** "Cardiff Beach looking north" (over the reef), Bovlb, public domain.

**County Line has none:** the Leo Carrillo and Neptune's Net categories had 33 files, none free-licensed at ≥1200 px. Flickr's search API needs a key we don't have, so Flickr was searched only through Commons' Flickr imports. County Line keeps the drawn coast.

## Part 3: breaker-type copy (T-087 notes)
Checked on Spot (1440/390) at a daylight hour for 10 spots. The notes show in the Call's tap-open list (e.g. "Spilling breaker (est. from a mean seabed slope, not the slope at the break): likely soft, but check the shorebreak."). The SURF card says "est. breaker type: Spilling (soft, slow-breaking)" where known. They read fine, but long.

**Fixed (UI, mine):**
- **Restatement rule regressed:** the T-069 rule had stopped catching "It is dark. The next window is today 6–11 AM.", because the headline drops "today". "today" is now filler (unit test added).
- **Duplicated reasons:** the tap-open list repeated reasons (the first one combines the next two). `uniqueReasons` drops reasons already contained in an earlier one (unit test added).
- **Clipping at 390:** the Call's reason was clipped to one line on phones; it now gets two.

**For engineering (copy in `src/services/call.ts` and the rating engine; not edited):**
- "Offshore offshore wind: clean face." has a doubled word: the relation word and the label are both "offshore".
- Raw engine text becomes the plain-English first reason at offshore-only spots: "Offshore wave potential: Primary 3.0 ft at 4.8 s; combined Hs 4.3 ft. Heuristic rewards moderate swell energy and period, penalizes Hs above 10 ft. This is not breaking-wave height." It needs a plain sentence, e.g. "Offshore swell 3 ft at 5 s: short period, weak."
- The breaker notes could be shorter for a surfer, e.g. "Likely soft (est. breaker type), but check the shorebreak", keeping the "est. from a mean seabed slope" detail in the basis.

Checks: tsc OK; unit tests 435/435; build OK; t045 54/0; t065 50/0; t047 55/0; t074 28/0; density ALL PASS; journeys 8/8.

## T-088b: week grid after midnight
- **Cause:** after midnight the 8th column (Tue 10) lay beyond the forecast horizon. Every row showed "—", styled as offshore (`.wk-off`).
- **Fix:**
  - `weekDays()` (`src/features/home/weekDays.ts`, pure) leaves out a trailing day that no row has any record for, so the grid shows 7 days then.
  - A genuine no-data cell now has its own class `.wk-none` and the aria "no forecast height for this day", never `.wk-off`.
- **Tests:** `src/tests/week-days.test.ts` (a clock at 00:05 PST → 7 columns ending Mon 9; 8 when the records reach day 8; rows not in the grid don't count). t067 allows 7–8 columns and checks that a "—" cell is never offshore-styled (backup kept).
- **Checks:** t067 36/0; t047 55/0; journeys 8/8; unit tests and build below.
