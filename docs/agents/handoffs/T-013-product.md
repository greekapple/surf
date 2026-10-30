# T-013 · Explore marker labels never collide — Product handoff (2026-10-30)

Branch `worktree-product` (worktree `.claude/worktrees/product`), dev port 5184.

## What changed
- `src/features/explore/ExploreView.tsx`: `declutter()` places spot labels greedily: the selected spot goes first, then the rest in `evidenceSpots` order (a stable order, so labels don't flicker while scrubbing the timeline). Each label tries the right of its pin, then the left; if both collide with a placed label or another pin it is hidden until you zoom in. The visible boxes are measured in one layout pass. It runs after the markers are rebuilt and on `zoomend`/`resize`.
- `src/features/explore/explore.css`: `.xpin.lft` (label on the left) and `.xpin.xhide` (label `visibility: hidden`). A hovered pin still reveals its label.
- Dev-only hook `window.__xmap` (behind `import.meta.env.DEV`) so QA scripts can set zoom/centre. Verified absent from `npm run build` output.
- The existing zoom-level rules stay as they were: below z9 only the selected or hovered label shows, and below z5 pins hide.

## Checks (real output)
- `npx tsc --noEmit`: OK
- `npm test`: pass 160, fail 0
- `npm run build`: built OK; `grep __xmap dist` returns nothing
- `node journeys.mjs http://127.0.0.1:5184`: 8/8 journeys passed; no unexpected browser errors
- `node t013-overlap.mjs` (`~/Development/ai-system-setup/playwright-toolkit/swello/`): ALL PASS, 0 overlaps in 16 views (1440 and 390 × default, Bay z9–11, Santa Cruz z9–12). The selected label shows whenever its pin is on screen; clicking the Steamer Lane pin selects Steamer Lane at both widths; no console or page errors.
- Baseline before the fix (same script, `artifacts/t013-before/`): 16 failures, e.g. Santa Cruz z9 had 13 overlaps.
- Hidden labels come back as you zoom in: Cowell's is hidden at z11 (its pin sits beside Steamer Lane) and shows at z12.

## Screenshots (looked at)
`~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t013/`: `1440-*.png`, `390-*.png`, `*-after-click.png`, `cmp-1440.png`, `cmp-390.png` (live next to `D-explore-map-collection.png`).

## Incomplete / notes
- Labels can still sit under floating panels (map controls, legend, time card, the translucent side panel). That was the same before and isn't covered by this task.
- On phones the default zoom is 8, so only the selected label shows (the existing zoom-level rule). The reference phone view shows several labels at regional zoom. Letting `declutter` replace the z<9 rule would show a few non-colliding labels there; that's a product call.
- `compare.mjs` loads hard-coded `127.0.0.1:5180/` once first (caught, harmless) before loading the URL it's given.

## Integration
Only Explore files changed; no shared files touched. No new dependencies.
