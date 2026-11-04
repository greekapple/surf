# T-119 (product): undulating lines (Surfline-style) on Home and the spot graph
Branch `t119-lines` from forecast-trust a7b25f2, with engineering's `t118-surf-band` (wip) merged in so the curves are checked on the new Surfline-width band. Spec: docs/specs/2026-11-03-next-ranges-graph-quiver-cams.md §2. Shots: `artifacts/t119/` (graph-surf / graph-swell × 1440/390 × light/dark; home-* full pages; side-by-sides vs Surfline: sbs-graph-surf-1440, sbs-graph-swell-1440).

## What changed
- **Spot graph, Surf tab:**
  - The band's top and bottom are monotone cubic curves (no overshoot) through every third hour plus each run's ends, so whole-foot hourly steps read as one smooth undulation.
  - Soft fill between the curves. The top has a thin line; the bottom edge is coloured by the hour's rating (a gradient with one stop per hour).
  - The dashed "middle of the range" line is kept.
  - Gaps without an estimate are never bridged.
  - The curves read the headline lo/hi, which on T-118 *is* the new band, so they switch automatically. `interval` isn't drawn, and no confidence words were added (engineering's).
- **Spot graph, Swell tab (Surfline-style):**
  - One smooth line per swell component (primary, secondary, a third when present), in distinct colours: `--sw1`, `--sw2`, plus a new `--sw3` (amber, light and dark).
  - Direction arrows on each line every 6 h, or 12 h when the hours are tight (phones).
  - The primary's period every 6, 12 or 24 h, whichever fits.
  - The Swell tab now scales to the swells only (the surf band's top had squashed them into the bottom third).
  - The legend lists the third swell only when there is one, and explains the arrows.
  - Day separators, the now line and night shading are unchanged.
- **Home week grid:**
  - Each row again has a clearly visible smooth line through the days' midday sizes (`wc.centralFt`, the cell's own number) in a strip under the rating bars.
  - Each row has its own scale (lowest to highest day, padded), so the week's shape reads; the numbers carry the values.
  - Estimate days only (offshore-only rows have no line), and a day without an estimate breaks the line.
  - Legend in the section note: "— the shape of the midday size through the week".
  - T-106's tiny wave-to-person drawings in the cells are removed.
- **Home spot cards:**
  - A small 7-day surf-height sparkline (`SurfSpark`): the middle of the hour's estimate every 3 h, gaps where there's no estimate.
  - A soft fill, a dot at now, and "now / +7 days" under it. Its aria-label gives the range.
  - It replaces the wave-to-person drawing. The hero's big drawn wave stays as the cam fallback.
- **Density fixes (t034) on my T-117 map chrome,** which I hadn't run t034 against: a 16 px side gutter on the phone strip, and 12 px between the search box and locate and between the round buttons.

## Checks
- tsc OK; 498/498 tests (with T-118 merged); build OK; journeys 8/8 (once).
- t067 ALL PASS, updated (backup `.pre-t119`): a line in every row with estimates, none in offshore-only rows, no drawings in cells.
- t074 ALL PASS.
- t034: everything passes except wave-scale "tap ≥ 44: label h 19 '6 ft pole'". That one is also on :5180 (forecast-trust), so it comes from the 3D work, not this branch.
- Graph at 1440 and 390, light and dark: the band, top, rating-coloured bottom, swell lines and arrows all present; no overflow; no page errors.

## Surfline comparison (what I matched)
- **Surf:** Surfline uses bars of surf height; per the user's words I drew undulating lines instead, keeping Surfline's day columns, now line, night shading and rating colour along the base.
- **Swell:** Surfline's swell chart is one thin line per component with direction arrows along it; matched, with period labels on the primary.
