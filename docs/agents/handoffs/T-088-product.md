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
