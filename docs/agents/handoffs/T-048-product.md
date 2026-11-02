# T-048 Wave scale back on the spot page + phone polish + dead code (product, 2026-11-02 overnight)

Branch `worktree-product` (merged rebuild/swello-v0.16 at the start). Owned: `src/features/forecast/*`; also `src/features/explore/Callout.tsx` (my T-043 file) to drop its last Cinematic import.

## 1. Wave scale panel (next to SURF)
- `SpotPage.tsx › ScalePanel` is a card beside SURF at 1440 (grid areas: surf | scale (2 rows) | rating | wind / tide | scale | swell | water), and a full-width row after WIND/TIDE on phones, so the 390 first screen is still SURF, RATING, WIND, TIDE.
- It is drawn to one scale (an SVG, no imagery) and contains:
  - the hour's face estimate as a wave shape: the outer outline at the high bound, the darker inner shape at the low bound;
  - a surfer silhouette at 5'10" (default: the profile has no height field yet, and the label says "(default)");
  - the board standing beside them.
- **Board:**
  - the Board Match pick for the hour when there is one;
  - otherwise the favourite or first board in the quiver, labelled "Your …", not as a pick.
- Without a face estimate the wave is not drawn and the panel says "no face estimate" (offshore height is not surf size).
- **Interaction:**
  - The whole card is one button that opens the full Wave scale.
  - Shapes transition over 260 ms when the hour changes (no transition with reduced motion).
  - Tick labels are axis numbers only, so the SURF value is not repeated (t045's no-duplicate check still passes).
- **Board Match line:** it no longer repeats the range ("for this hour's estimated surf") and shows the board length.
- **Removed:** SURF's separate "Wave scale →" link, which the panel replaces. On phones the method line is hidden (the "model estimate" tag stays; the method is on wider screens and in Sources).

## 2. Phone: spot name once
At ≤ 860 px the page h1 is `sr-only` (still the page heading for screen readers and tests); the shell's spot switcher shows the name. The meta line and star stay.

## 3. Dead code removed
- `Cinematic.tsx`, `SeaState.tsx` and `seastate.css` are deleted. The Explore callout now uses `headlineSurf`/`headlineText` (map, Home and spot page agree).
- `model.ts`: removed the unused `Provenance`/`provenance`, `Reason`/`reasons`, `SignalStrength`/`signalStrength` and their imports.
- `forecast.css`: 461 → ~175 lines. I removed every rule whose selectors reference a class no TS/TSX file uses (`cine-*`, `fc-*` except `fc-fav`, `anno-*`, `plan-*`, `wc-*`, readout, hours, near…) and the keyframes left without users. The pre-edit copy is in the scratchpad (`forecast.css.pre-t048`).
- tsc with `--noUnusedLocals` is clean for forecast and explore.

## 4. Checks (5184, real output)
- t045-spot 53/0 · firstview 40/0 · density ALL PASS (all screens) · journeys 8/8.
- wave-spot 14/0 · t041 tides 4/0 and flag 5/0 · t038 16/0 · t043 ALL PASS on rerun (the first run missed the wind legend while the field loaded) · npm test 281/0 · build OK.
- **Toolkit edits:** `t031-firstview` and `wave-spot` now use the scale panel (`[data-card=scale]`) instead of the removed link. Backups `*.pre-t048` are in the scratchpad.
- **Shots:** `playwright-toolkit/swello/artifacts/t045/t048-{1440,390}-{first,full,grid}.png`. Page height at 1440 is 1,723 px.
