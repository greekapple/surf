# T-043 Map, minimal — Product handoff (2026-11-01)

Branch `worktree-product`. Commits: 3a8abd5 (T-043), 4b6cc8d (merge of `rebuild/swello-v0.16` with T-042; clean, no conflicts), then this handoff. I touched only `src/features/explore/*`. The map-init block that holds engineering's basemap lines is byte-identical to before (md5 checked), and T-042's `addBasemap` merged in cleanly.

## What changed
- **Map first.**
  - Full-bleed map with one floating search, top left at 1440.
  - The list is a slim sheet (340 px) that opens only on demand: the chevron, focusing the search, or typing.
  - Rows are compact: rating dot, name, "4–6 ft offshore", rating chip. The photos are gone.
  - Under the list are links to Find spots and Compare spots.
- **Phone (390).** A bottom sheet with a handle and three detents:
  - **Peek:** search plus the selected spot's card. It sizes itself to the card, and the controls sit above it.
  - **Half:** the list.
  - **Full:** the list at almost full height.
  - Drag, press, or use ArrowUp/ArrowDown on the handle. Search focus goes to full; picking a spot returns to peek.
- **Labels.** Sparse and collision-aware.
  - The selected spot is labelled first, then the best-rated in view, within a zoom budget: 1440 shows 3/5/8 and 390 shows 2/3/5, for zoom <9 / 9–10 / ≥11.
  - Every other spot is a small dot, and its label shows on hover.
  - Labels read name plus rating word, so the pins carry no unlabelled offshore number.
- **One layer control.** A button opens a popover with:
  - "Colour the sea by": Wave height, Swell height, Wave period, Wind, None;
  - Flow animation and Swell direction arrows;
  - "Model point at map centre";
  - the source and validity note.
  - The non-working "Tides / SST soon" rows are dropped.
- **One legend chip.** It shows the unit, the gradient and the end values ("ft 0 ▬ 13+", "mph 0 ▬ 34+"). Pressing it shows the source and validity.
- **One time bar.** A thin pill (play, the hour, progress) opens to the full scrubber (step, 1h/3h/1d, window, slider). It folds back after 5 s idle, but not while playing or while keyboard focus is inside.
- **Spot tap.** A callout card: name, region and hour, rating chip, the labelled height, wind with its shore relation, and "Open forecast".
  - The height reads, for example, "5.2 ft offshore · not surf size", or "Est. … at the break · model estimate".
  - The wind reads, for example, "5.9 mph from W · onshore", or "shore relation unknown".
  - At 1440 it is a popup at the pin, closed by ×, Escape or a tap on the sea. At 390 it is the sheet's peek.
- **Light-native chrome.** Built from theme tokens: white with a soft shadow in light, and it follows dark mode. The forced `on-dark` navy is gone.

## UI element count (visible on the default view; `t043-count.mjs`)
| | controls | pin labels | text items | total |
|---|---|---|---|---|
| 1440 before | 31 | 10 | 20 | **61** |
| 1440 after | 9 | 5 | 0 | **14** |
| 390 before | 15 | 5 | 16 | **36** |
| 390 after | 10 | 2 | 8 | **20** (8 texts = the peek spot card) |

## Checks (real output, 5184, after merging T-042)
- `t043-map.mjs` (new, around 30 checks per size plus a dark check): ALL PASS. It covers:
  - full-bleed map, one search, no sheet until asked, peek with the selected spot;
  - light chrome, sparse labels (5 of 45 / 2 of 45), no unlabelled numbers;
  - layer popover, Wind → mph legend, Escape;
  - thin time bar → open → step → idle fold;
  - list on demand, half/full detents, search filter;
  - callout with labelled height and wind relation, selection following, Escape, pin → callout;
  - Open forecast keeps the spot; 0 px overflow; clean console.
- `t013-overlap` ALL PASS · `t034-density` ALL PASS · `t022-nav` ALL PASS · `t038-no-ai` 18 PASS / 0 FAIL · `journeys` 8/8 · tsc OK · npm test 259/0 · build OK.
- **Journey 4** now uses the new UI: open the list, pick a spot, check the callout heading, selected pin, aria-current row and `?spot=`, then read the hour from `.xtime[data-valuetext]`. Its assertions are unchanged. The old version is saved at the scratchpad `journeys.mjs.bak`.
- **Shots** are in `playwright-toolkit/swello/artifacts/t043/`:
  - `side-1440.png`: before | after | callout | Windy.
  - `side-390.png`: before | peek | half | layers | Windy.
  - Per-step `1440-*` / `390-*` and `1440-dark.png`.

## Not done / for the lead
1. **Two searches at 1440.** The global nav bar's "Search spots" field and the map's floating search both show. Hiding the global one on `/explore` is an app-shell change and not mine.
2. **`m.panBy([-170, 0])`** in engineering's init lines still offsets the start view for the old 340 px side panel, so the coast sits right of centre. Suggest engineering drops it; my fly-to already accounts for the list sheet.
3. **Surfline has no map shots** in `18-teardown-2026-10-31/surfline/` (spot page only), so the comparison is against Windy. I can capture Surfline's map logged out if you want it.
4. **Phone attribution** is 12 px over two lines (density rule). It is now T-042's longer Esri Canvas credit.
5. The unused `Nearshore` in ForecastView is left for the next forecast task, as asked.
