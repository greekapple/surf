# T-025 Engineering handoff: Quiver My Boards as a showroom rack

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first). Files: `src/features/quiver/*` only (+ toolkit scripts outside the repo).

## What changed
- **`Rack.tsx` (new)** replaces the card grid on `/quiver`: boards stand upright on a shared floor line in front of the repo's existing showroom backplate (`/showroom/showroom-wide.webp`, `-tall.webp`, the Blender render already used by the 3D Showroom). Each stands on a small wooden stand; the selected board is 1.2x larger, lifted, with an orange stand and full opacity (others 80%). A board with a saved trace is drawn from its traced outline, and its scanned deck photo when it has one; every other board is the category outline in the board's colour. Nothing new was generated or added.
- Under the stage: the existing `SpecCard` (real stored length, width, thickness, volume; tags; "Example board" kept on demo boards, now readable on the cream card) with **View in 3D**, which selects that board and opens `/quiver/showroom` on it; then the existing thumbnail `Strip`. Edit and Delete moved to a quiet row under the strip.
- **Keyboard:** Left/Right step through boards (also Home/End), focus stays on the board row, the roving tab stop is the selected board, and each change is announced in a polite live region ("Everyday driver, board 2 of 4"). Arrow buttons and the strip work as before.
- **390:** one board in view at a time, scroll-snap swipe; once a swipe settles the nearest board becomes the selected one; the arrows scroll the board into view. No horizontal overflow.
- **Scan crop box by keyboard (T-020 gap, `ScanPanel.tsx`):** focus the photo canvas; arrows create and move the box (Alt for fine steps), Shift+arrows resize it from the bottom-right corner, Escape clears it. The outline is re-traced about 0.45 s after the keys pause; a status line announces the box size and position; a visible hint explains the keys.

## Checks (real output)
- `tsc` clean; `npm test` 202 pass, 0 fail; `npm run build` built; `journeys.mjs` on 5185: **8/8** after updating journey 5 (below).
- `t023-quiver.mjs`: all passed (updated for the new markup).
- New `t025-quiver.mjs` (toolkit): 27 PASS, 0 FAIL: rack of 4 boards on one floor line, upright and large, spec text and "Example board", ArrowRight/Left/End, announcement, strip, View in 3D lands on the same board in the Showroom, 390 one-at-a-time swipe and arrow, no overflow at either size, and the crop-box keyboard path (create, move, resize, shrink, re-trace, Escape).
- Screenshots looked at, live vs `00-target/quiver.png` side by side (same layout as compare.mjs, with an onboarded profile so the page itself renders): `/private/tmp/claude-501/-Users-milosin-Development-projects-surf--claude-worktrees-engineering/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t025/quiver-1440-compare.png` and `quiver-390-compare.png` (plus `-live.png`). No horizontal overflow at either size.

## Script changes outside the repo (please note)
- `journeys.mjs` journey 5 used the old grid (`.qv-grid`, `.qv-card`, `.qv-selected h2`, "Open in Showroom"). I moved it to the rack's markup (strip buttons, spec card, "View in 3D"); the same behaviours are asserted (add, edit, no duplicate, persisted after reload, volume shown, showroom shows the board).
- `t023-quiver.mjs`: button name now `Open in Showroom|View in 3D`, board count read from the strip.
- Temporary screenshot script removed.

## Honest gaps against the target
- The target's room is a photo with many boards and real graphics on the decks; ours is the repo's rendered backplate with flat board outlines in the demo colours, so it reads as a showroom rack but is not photographic. Boards with a scan show their real deck photo.
- All four demo boards fit in the row, so the selected board is emphasised by size, lift and an orange stand rather than being centred; with more boards the row scrolls and centres the selected one.
- Compare is desktop-only in the target; 390 has no reference.
- The old card-grid CSS (`.qv-grid`, `.qv-card`) is now unused; left in place.
- Dev server stopped. Not merged or pushed.
