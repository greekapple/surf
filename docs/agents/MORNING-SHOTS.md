# Morning evidence set, 2026-11-03

Taken 01:56–02:05 PST against http://127.0.0.1:5180 (`forecast-trust` = 6317689, with T-097 and T-098a). Folder: `~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/morning-2026-11-03/` (34 images: 24 screen shots plus 10 full-page `-full` ones, and `shots.tsv` with the hour each one shows). Every screen is at 1440 and 390 in light mode; Home and Spot are also in dark. Home, Spot and Personal have full-page `-full` shots too (Home and Spot in both themes). No page errors and no horizontal overflow on any shot. Script: the product session's scratchpad `morning.mjs`.

**Hours.** The shots were taken at night, so where a screen lets you choose the hour, a daylight hour was chosen:
- **Spot:** the day strip's best hour, Tue 7:00 AM.
- **Map:** the timeline at Tue 9 AM.
- **Compare spots:** its 3-hour stepper at Tue 8 AM.
- **Wave scale:** its slider at 9:00 AM.

Home, the Quiver screens and Personal have no hour control, so they show the real 2 AM state.

| Shot | What it shows |
|---|---|
| `home-*` | Night state: the welcome photo is visible with readable text (T-095). "Dillon Beach is your best bet today, 6–10 AM, 3–6 ft and light offshore", sunrise and sunset, next tide (Tomales Bay entrance station), water 62°F, quiver pick "Everyday driver suits 3–8 ft". The week grid shows 7 days (the 8th is beyond the forecast, T-088b); the curve sits under the bars and ends at the last column. |
| `spot-*` | Ocean Beach, Tue 7 AM: photo band, NWS Beach Hazards banner, Call "Worth a look · 6–11 AM" with a plain reason, daylight row, Surf 7–10 ft overhead (est. breaker type spilling), Felt right?, wave-scale card ("The estimate's range, drawn to scale beside you"), rating, wind, swell partitions, tide (station prediction), water. |
| `map-*` | Tue 9 AM: the offshore wave-height layer clipped to the open sea, with SF Bay and the delta hatched "Not covered" (T-092); legend "Offshore wave height · not surf size"; Ocean Beach card 7–11 ft surf estimate. |
| `compare-spots-*` | Tue 8 AM, best rated first (Crescent City, Moonstone, Humboldt…); the subtitle says the heights are offshore model height, not surf; phone rows are name and height / rating, swell, wind / buttons (T-095). |
| `quiver-*` | My boards wall: each board in its own showroom colour with fins and tail (T-094); fit labels "Surf above its range" / "Edge of its range" / "In its range" (T-095). |
| `showroom-*` | 3D board with angles, configurator and rail; fit and Board Match lines in the new wording; the phone bar doesn't cover content. |
| `board-match-*` | Ranked for est. 7–10 ft at Ocean Beach: Bigger-day option (in range) first, then Everyday driver (edge), the fish and the longboard (surf above range); wave shape stated as unknown. |
| `compare-boards-*` | Fish and shortboard side by side at the same scale, in their own colours, with the spec table. |
| `wave-scale-*` | 3D at Tue 9:00 AM: "Est. 7–11 ft · drawn at 9 ft face · surfer 5′9″", lighting for 9 AM, "approximate" caption, hour slider, board picker. |
| `personal-*` | Hairline lists in sentence case (T-088): profile, favourites, journal, alerts, recommended board, preferences, units. |

## Still off (none is P0)
1. **Three board picks disagree in wording.** Home's quiver pick is Everyday driver (for Dillon Beach, 3–6 ft); Board match picks Bigger-day option (for Ocean Beach, 7–10 ft); Personal's "Recommended board" is Small-day fish. Personal says "Heuristic, not a forecast match", which is honest, but three answers on three screens will confuse. Suggest Personal shows the Board match pick for the home spot, or names its basis.
2. **"Good evening." at 2 AM** on Home (the greeting treats 0–5 AM as evening). It's a copy choice; "Good night" or "Early start" might read better.
3. **Map at 390:** the attribution line runs across the lower map, and when a "Model point" card is open it overlaps that card's "Pin this point" button. Spot pins near Santa Cruz sit under the time bar.
4. **Showroom at 390:** the fit line ("Surf above its range today…") starts just under the fixed Board Match bar on the first screen. It scrolls clear, and the bar text is cut off ("…above its ran…").
5. **Wave scale vs Spot:** the 3D page says "drawn at 9 ft face · surfer 5′9″"; the Spot card draws the range beside the person's own height (5′10″ default). Both are now labelled truthfully, but the two surfers differ.
6. **Compare spots** defaults to the current hour. At night every spot is "Unrated" until you step forward; it could open on the next daylight hour, as Home's nearby list already does after dark.
