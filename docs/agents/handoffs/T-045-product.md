# T-045 Spot page v3 — Product handoff (2026-11-02)

Branch `worktree-product`, after merging `rebuild/swello-v0.16` (6e41bbf, Inter only). Owned files: `src/features/forecast/*`. I also made one follow-up density fix in `src/features/explore/explore.css` (see "Density").

## The page now (each fact once)
1. **Compact header.** Name (28 px; 22 px on phones), region · break · data mode, favourite star, the selected hour, Now, and Map (hidden on phones, where the tab bar has Map).
2. **Conditions grid** (`SpotPage.tsx › ConditionsGrid`). Order: SURF, RATING, WIND, TIDE, SWELL, WATER. That is 3 × 2 at 1440, and 2 × 3 at 390 so the first screen holds SURF, RATING, WIND and TIDE.
   - **SURF.**
     - Headline value with a tag: model estimate, offshore, demonstration, or no value.
     - Body words + "at the break" when estimated.
     - "Offshore X ft · not surf size" underneath, plus the method line.
     - "Wave scale →" (the 3D/illustrated scale stays one tap away).
     - Offshore-only hours show the offshore Hs with one decimal, like the chart and table.
   - **RATING.**
     - Word, 5-segment bar, "provisional".
     - One-line "why": the rating's own factors as ✓ / ~ / ✗ with short names (Swell size, Wind, Swell quality…); full name and reason in the tooltip.
     - Reliability.
   - **WIND.** Speed, direction, the shore relation as a coloured pill (offshore green, cross amber, onshore red, unknown grey), gusts.
   - **TIDE.** Height, ▲/▼ trend, a mini curve for the day with highs and lows labelled, "NOAA station prediction, not at the beach".
   - **SWELL.** Up to 3 partitions: height, period, arrow, compass (+ degrees at 1440).
   - **WATER.** °F + a wetsuit from a common surf-shop table, labelled as a guide.
3. **Board Match line.**
   - The best eligible board from the quiver for the hour's estimate ("Ride your … for an estimated 3–4 ft · Board Match 72/100 · provisional").
   - Offshore-only hours: "No board pick: only offshore height…". No boards: "Add a board".
4. **7-day strip** (Surfline).
   - Typical daylight range: the median of the hourly estimate bounds from 6 AM to 7 PM, marked est. / offshore / demo.
   - AM/midday/PM rating segments and wind arrows at 7 AM, noon and 5 PM, coloured by shore relation.
   - Best-day star. A click selects the day's best daylight hour.
5. **Graph / Table toggle** (`?view=table`).
   - Graph: the existing timeline with Surf/Swell/Wind/Tide tabs and a 7-day / day range.
   - Table: Magicseaweed-style 3-hour rows for the selected day: surf (labelled), rating, primary, secondary, wind cell coloured by shore relation (speed, then "gust · relation"), tide. A row click selects the hour.
6. **Nearshore model** (the existing `NearshoreCard`, unchanged) and **Buoy now vs forecast**. NDBC 46026 observed values sit beside this spot's forecast at the nearest hour, marked as a saved snapshot when old and as "context, not a validation".
7. **Sources & reliability**, collapsed. The buoy moved out into item 6.

**Removed:**
- the dark hero band and giant height;
- the "Today at" dial;
- the duplicate readout row;
- the Next-hours list;
- the in-page jump bar;
- the wave card (replaced by the SURF link);
- the summary paragraph and spot photo;
- the nearby-spots row;
- the camera placeholder;
- the dead `Nearshore` function.

`Cinematic.tsx` keeps `headline()` (Explore's callout uses it). Its other exports, and the old `.fc-*`/`.cine-*` CSS, are now unused and can be deleted in a cleanup pass.

## headlineSurf (T-046)
`src/features/forecast/surfHeadline.ts` is a stub with engineering's exact exported shape: `headlineSurf(spotId, hour, {bundle, nowMs})` and `headlineText(h, p)`. It has the v1, demonstration, offshore and none paths. It has no MOP v2 path, because that needs engineering's modules.

**Swap:** change the import in `SpotPage.tsx` to `'../../services/headlineSurf'` and delete the stub. No other change is needed. Its provisional body-word table goes away with it, since engineering's table is the sourced one.

## Measured (real output, 5184)
| | before | after |
|---|---|---|
| 1440 page height | 3,690 px | **1,699 px** (≤ 2,200) |
| 390 page height | 5,756 px | 2,638 px |
| 390 first screen | hero + readout | header + SURF + RATING + WIND + TIDE (tide card bottom 590 of 780) |

## Checks
- **`t045-spot.mjs` (new): 53/0, ALL PASS.** Covers:
  - height; six cards in the first screen at 1440, four at 390;
  - **no duplicate fact above the fold** (each card's value appears nowhere else visible);
  - honest labels; 7-day strip with AM/mid/PM; day click;
  - table 3-hour rows with wind cells by relation; Graph; nearshore + buoy; sources;
  - 0 overflow; clean console.
- `t031-firstview` forecast part: 36/0. The Forecast checks are rewritten for v3: no hero, cards in the first screen, labels, light cards, nothing over 28 px. The Home part waits for T-047 (`.dc`).
- `t034-density` (run correctly as `node t034-density.mjs <tag> <base>`): ALL PASS on 5184, all screens.
- `journeys`: 6/8.
  - Passing: 2, 3 (rewritten: conditions grid + table row instead of readout + Next hours), 4, 5, 7, 8.
  - Failing: 1 and 6, which now expect T-047's Home dashboard (`.hd h1` "Your spots", `.dc`), not yet on this branch.
- `t041-tides`, `t041-flag`, `t041-nearshore`: ALL PASS. Tides and flag now read `[data-card=tide]` and the SURF/RATING cards.
- `wave-spot` 14/0 (entry is the SURF card's "Wave scale →").
- `t038-no-ai` forecast + map 10/0 (forecast now asserts no hero; Home waits for T-047).
- `t043-map` 55/0 · `t013` 22/0 · `t022-nav` 62/0 · tsc OK · npm test 266/0 · build OK.
- **Shots:** `playwright-toolkit/swello/artifacts/t045/`.
  - `side-1440.png`: before | grid | Surfline 04 | Surfline 06 | table | MSW 02 | full page | Surfline 07.
  - `side-390.png`: before | first screen | table | Surfline 04.
  - Plus `1440/390-first|full|table.png`.
- Backups of edited toolkit scripts are in the scratchpad (`*.pre-t045`).

## Density: a correction about T-043
`t034-density` takes `<tag> <base>`. In T-043 I passed the URL first, so those "ALL PASS" runs measured the default port 5185, not my branch. Measured correctly on 5184, the map had three phone spacing violations under the newer gap rule:
- sheet handle → search;
- layers → locate;
- play → hour pill.

They are fixed here, in the same commit as T-045, with 12 px gaps and separate layer and locate buttons. Map density now passes on 5184.

## Open
- **Duplicate spot name:** the app shell's spot switcher shows the name above the page h1 (Surfline has the same pattern, but it reads as a duplicate on phones). This is an app-shell decision.
- **Wide v1 ranges** (e.g. 5–11 ft at Ocean Beach) are honest but wide. Engineering's MOP v2 should tighten Ocean Beach once swapped in.
- **Only one buoy:** buoy 46026 is the only one we fetch. "Nearby buoys" (plural) needs more NDBC stations, which is an engineering fetch.
