# T-058 (product): longboard stringer, phone map peek, Home nearby list

Branch `worktree-product` (merged rebuild/swello-v0.16 at d9779ef first). Local commits only.

## 1. Longboard ("Easy cruiser") stringer
- **Change.** It's in the same cutout pipeline (`src/features/quiver/cutout.ts`, step 3c).
  - Each illustration's stringer width is measured over the middle half of the board: dark run at the axis versus the deck either side, median of rows.
  - Where it is more than 2.5× a true stringer (≈2% of the board's width, at least 3 px), it is resampled into a thin band of that width. The band keeps its own wood grain, compressed, and the deck colour is interpolated across the rest of the old stringer.
- **Results across the six illustrations:**
  - Only the longboard is changed: 13 px → 3 px at the 700 px size, and ~23 px → ~6 px at 1400.
  - Shortboard, fish, midlength, step-up and soft-top are untouched. The midlength (2× the target) is deliberately left as drawn.
  - The longboard's blue pinline and outline are intact.

## 2. Map on phones: the peek and pin labels
- **Pin labels.** On phones the map opens with the selected spot panned into the clear area above the attribution and time bar: x 40%, y 55% of that area. Its label no longer sits under the attribution or time bar. The panBy runs once on open (no animation) and doesn't fight later panning. The declutter still hides other labels that hit controls.
- **Peek card.** The rating is the quiet dot + word (Condition without `chip`), not a filled green pill. "Open forecast" is a calm dark button (text colour on background, radius 10) instead of the blue pill. The callout on wide screens gets the same button colour.

## 3. Home: "Best right now nearby"
- At ≥641 px the list is capped at 640 px, in four columns: rank 28 · name · height 132 · rating 104. The rating sits next to the height, like Surfline's list, not 900 px away. Phones are unchanged (rank · name · rating, height on the second row).

## Checks (5184)
tsc OK; unit tests 316/316; build OK; t053-wall 9/0; t025 27/0; t047 55/0; t043-map 54/0; density (t034, tag t058) ALL PASS; journeys 8/8.

Shots: before `playwright-toolkit/swello/artifacts/t058/before/`, after `artifacts/t058/` ({quiver,map,home}-{1440,390}.png).
