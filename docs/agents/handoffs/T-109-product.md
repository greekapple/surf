# T-109 (product): UI fixes from the site critique
Branch `t109-ui` (from the lead's WIP 5d03b41; forecast-trust with T-108 merged at e611061). Shots: `artifacts/t109/`.

## Changes
- **Compare**
  - Desktop header row: Spot · Rating · Height · Swell · Wind · Best. "Height" follows engineering, because T-108 makes each row say "ft surf" or "ft offshore".
  - The whole row is one link; the 45 Forecast and map buttons are gone.
  - Phone rows are two lines, about 64 px.
  - Zone chips sit in one horizontally scrolling row, 12 px apart.
  - T-108's height and best-window cells are kept (merge resolved toward them).
- **Tap targets ≥ 44 px at 390**
  - Map pins get an invisible 44 px hit area. Check: a tap 18 px above or below each visible pin hits that pin, or a neighbouring pin where they crowd, or a control drawn over it; never bare map.
  - Also fixed: the spot picker (36 → 44), the NWS links (16 px tall → each alert is one link at least 44 px), "Felt right?" (41 px wide → 44), the showroom ‹ › (32 → 44), and Reset view / Full screen (36 → 44).
  - Probe at 390: nothing under 44 on spot, showroom or wave scale.
- **Hazard banner**
  - No coloured left stripe.
  - A warning icon, the bold title, the times, and the NWS source with ↗.
  - Each alert is one link and wraps on phones, so the end time shows (it was clamped to one line before).
- **Showroom**
  - Hotspots render only once the model has loaded.
  - While loading, the board's own outline shows in grey, laid along the stage and pulsing (no pulse with reduced motion).
  - Checked by slowing the model download: 0 hotspots while loading, 4 after.
- **Spot page at 390:** the hero subtitle wraps to 2 lines instead of an ellipsis.
- **Dark mode**
  - The Quiver wall is a dark neutral; the T-053/T-088 forced-light wall and inks are removed. White boards read clearly.
  - The showroom stage is a dark neutral: the scene's floor pool (studio.ts) and the angle thumbnails follow the theme, live on toggle via a MutationObserver that dispose() disconnects.
- **Surf graph**
  - One continuous estimate band with its middle as a line, drawn per run of consecutive hours (a gap is never bridged). The offshore Hs line is unchanged.
  - Tide appears only on the Tide tab, both line and legend.
  - Phones get short day names ("Tue"); before they had none.
  - The legend reads "Surf estimate (range) · Middle of the range · Offshore Hs".
- **Map heat layer**
  - One-hue sequential ramp (pale to navy; RULES "no rainbow"), shared with the legend.
  - Default opacity 0.62 → 0.5. A saved user preference still wins.
  - The legend label is unchanged: "Offshore wave height · not surf size".
- **Consistency**
  - One rating vocabulary: "Not bad" via `conditionWord` on Compare, Find spots, the chart slider text and the scale.
  - Personal icons for Theme, Data source and Backup.
  - Delete moved from the wall into the board's Edit form, still confirmed, and closing the form drops a pending confirmation.
- **Home hero tints:** dawn, dusk and night captured light and dark (`hero-{dawn,dusk,night}-*`) with the browser clock set to those times. Fixed the night hero's wave, which used the light-theme blue and sank into the navy; it now uses the dark-theme blue.
- **Density (t034):** alert links 12 px apart, the phone legend label at 12 px, and long Personal values wrap.

## Checks
- tsc OK; 471/471 tests; build OK.
- Journeys 8/8.
- **t034 ALL PASS in light and dark** (run as `node t034-density.mjs <tag> <base> <out> <theme>`).
  - The first argument is a tag, not the URL, so earlier runs with the URL first, including my T-106 report, tested :5185, not the branch.
  - On :5180 today (forecast-trust) it fails 3 checks (forecast, map, personal); this branch fixes all three.
- t023 (old Quiver test) updated for the Delete-in-Edit flow; backup `t023-quiver.mjs.pre-t109`. Its 8 delete checks pass. It still has 12 old failures (for example "My Boards" casing), the same as on :5180.
- Browser: home, spot, map, compare, quiver, showroom and personal at 1440 and 390, light and dark. No overflow, no page errors. The only sub-44 elements are the map pins, which have the hit area above.

## Notes
- Not changed: spot photos and the other tabs of the graph.
