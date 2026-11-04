# T-116 (product): map chrome, Windy-like
Branch `t116-map-chrome` from forecast-trust a8bcdf0. Spec: docs/specs/2026-11-04-map.md §4. Files: src/features/explore/* and explore.css only; nothing in src/map/* (engineering's T-115). Shots: `artifacts/t116/` (map-{1440,390}-{light,dark}; side by side with Windy: sbs-{1440,390}-{light,dark}; phone-{iphone,android}-{peek,after}; before/).

## Changes
- **Top bar** (replaces the floating "Spots 45" toggle): one compact bar with "Find a spot" and the region chips (All, North Coast, Bay Area, Santa Cruz & Monterey, Central Coast, Southern California).
  - Typing filters the list, with region and name or county both matching. Enter opens the first match.
  - Desktop shows a dropdown list (the chevron shows all spots); phones open the sheet's list at half height.
  - A region chip frames that coast and filters the list.
- **Layers:** a plain list on the right edge, Offshore waves · Swell · Wind · Period, with text and an icon. The active row is filled; pressing it again turns the sea colour off.
  - "More" opens the overlays (sea colour, flow, swell arrows), the model point and the source note.
  - No floating card. Phones show icons only, each 44 px, with the label kept as the accessible name.
- **Spot labels:** only the selected spot and the top-rated few (budget per zoom: 2/3/5 desktop, 1/2/3 phone). The rest are rating-coloured dots.
  - A label reads name · height (est. range, or "X ft offshore") · rating word. A dot shows the same on hover, keyboard focus or tap.
  - No "Unrated" anywhere: an unrated or dark hour says nothing per spot (also in the callout), and the bottom strip says it once: "Dark at this hour · not rated".
- **Bottom strip:** the time scrubber and the legend in one docked strip at 1440 and 390.
  - Desktop: the dark mark, the scrubber, then the legend at the right end. Phone: the scrubber row, then the dark mark plus a full-width legend.
  - The legend's colours are untouched (T-115), and its honest text is kept.
- **Phone sheet:** peek ≤ 25% of the map, measured: iPhone 390×844 DPR 3, 179/716 = 25%; Android 412×915, 180/787 = 23%.
  - The peek shows name, time, height with its label, wind and Open forecast; the photo and body words wait for the expanded sheet. Tap or drag the handle to expand.
  - **Bug fixed:** a tap on the handle changed the detent on pointer-up, so the browser's click then landed on a list row under the finger. That picked the spot and snapped the sheet back to the peek. Now the detent steps on the click, and a drag ignores its trailing click.
- **Controls:** flatter (hairline, faint lift, no heavy shadow). Zoom and locate sit under the layer list; phones keep locate (pinch to zoom). "Not covered" is kept.

## Checks
- tsc OK; 478/478 tests; build OK.
- Phone emulation, iPhone and Android, one load each for the quota:
  - peek ≤ 25%; the handle goes half (45 rows), full, then peek;
  - a dot shows "Stinson Beach 3–6 ft" on hover;
  - Swell and Bay Area work;
  - nothing under 44 px; no overflow; no console errors.
- **t043-map ALL PASS**, updated (backup `t043-map.mjs.pre-t116`):
  - the light-chrome check now covers the top bar and the bottom strip;
  - "no unlabelled numbers" becomes "a height always carries its unit";
  - the layer popover steps become the right-edge list plus More;
  - "no second search box" becomes "one map search, in the top bar".
- Journeys not run (Open-Meteo quota, per the spec).
