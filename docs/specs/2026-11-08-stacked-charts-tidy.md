# Stacked forecast charts, tidied (2026-11-08)

User: "do all those improvements, write spec and make it". It follows "Surf, Swell, Wind and Tide stacked, scroll to see all" (live as 78d72737).

## Problem
The four stacked charts each repeat:
- the day labels;
- the "Rating" strip;
- the hour labels;
- their own heading and gap.

The page is long on a phone. Nothing ties one hour across the four charts.

## Change
1. **Shared axes:**
   - The day labels appear once, on the top chart (Surf).
   - The hour labels appear once, under the bottom chart (Tide).
   - The rating strip appears once, under Surf, with its legend there.
   - Day dividers and night shading stay on every chart, since they are the time grid.
2. **Heights by need.**

   | Chart | Desktop (px) | Phone (px) | Plus |
   |---|---|---|---|
   | Surf | about 210 | 170 | the day labels and strip |
   | Swell | 170 | 140 | |
   | Wind | 140 | 120 | room for the arrows |
   | Tide | 110 | 95 | the hour labels |
3. **One selection line:**
   - The selected hour is one vertical line through all four charts, unbroken.
   - The charts sit flush, each labelled inside its own left gutter: "Surf", "Swell", "Wind", "Tide".
   - Hover and tooltips stay per chart.
4. **Unchanged:**
   - the data, scales, units and legends of each series (the rating legend only under Surf);
   - keyboard and pointer selection, the 7-day / single-day range, and Graph / Table.
   - Each chart keeps its `role="slider"`.

## Acceptance
- 1440 and 390, light and dark:
  - the four charts in one block;
  - day labels only at the top and hour labels only at the bottom;
  - one rating strip;
  - an unbroken selection line.
- The block is at least 25% shorter than the version live as 78d72737, measured.
- Selecting an hour in any chart moves the line in all four.
- tsc, tests, build, journeys, t034, t043 and t062 pass.

## Level
Level 1 (UI only, no data or labels change). Checked in the browser; no data-honesty review needed.
