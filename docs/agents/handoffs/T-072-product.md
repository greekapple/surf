# T-072 (product): board showroom up to the Porsche configurator reference

Branch `worktree-product`: I merged forecast-trust (5146a1d) first. Commits fbbb89c (set, materials, thumbnails) and 2c3f6d1 (the Codex fix). Local only.

## Root cause of "flat plastic slab"
`studioEnvironment()` built the reflection environment with `PMREMGenerator.fromScene(room, 0.02)`. Its default far plane is 100, but the room is 400 units across and every light panel sat beyond 100, so the environment the board reflects was empty. The clearcoat had nothing to reflect, and lighting changes didn't show. The fix is `fromScene(room, 0.02, 0.1, 1000)`.

## Changes (`src/features/quiver/studio.ts`, `BoardRoom.tsx`, `quiver.css`)
- **The set:**
  - A darker studio room with car-studio light strips (three long ceiling strips along the board, a bright band around the walls), so the resin shows crisp highlight lines.
  - Environment intensity is now 0.42; the old 1.3 washed the colour out once the environment actually rendered.
  - A real soft shadow: the key light casts (2048 map, PCF soft) onto a ShadowMaterial catcher, focus view only, on top of the existing contact pool. The lineup photo room keeps its own sun shadow.
  - The stage background is a cyclorama: a cool off-white wall curving into a slightly darker floor.
  - No HDRI was downloaded; the procedural studio covers it.
- **Materials:** the existing MeshPhysicalMaterial (clearcoat 1, weave normal, stringer, deck vs bottom colour) now has a real environment to reflect. The deck shows highlight lines, the rails catch bright edges, and the stringer and the deck/bottom difference read.
- **Fins:** smoky translucent fibreglass (transmission 0.45, clearcoat, a tinted attenuation) instead of near-black. They come from the board's own fin setting (single/twin/thruster, the existing glb foils) and cast shadows.
- **Porsche patterns:**
  - Angle thumbnails are rendered from the live scene (`Studio.snapshot`), refreshed after the board and its fins settle. Each pose is drawn into a corner of the main canvas and copied with the stage's own tone mapping (Codex P2), and the stage is redrawn in the same task.
  - Smooth camera glides between presets (950 ms, reduced motion respected), hotspots that open spec notes (nose, tail, fins, rail) and Compare at true relative length already existed; I kept them as they were.
- **Style:**
  - The spec panel is hairline (a left rule, no boxed card) and the headings are Instrument Sans.
  - The size + period match line has its "Board Match:" label back. It went missing in T-065, and t035's phone sticky-bar check caught it.

## Checks (5184)
- tsc OK; unit tests 373/373; build OK.
- t035 29/0; t025 27/0; t023 52/0; density ALL PASS; journeys 8/8.
- Codex: fbbb89c had one P2 (thumbnails skipped tone mapping), fixed in 2c3f6d1; 2c3f6d1 had no findings.
- Shots: `playwright-toolkit/swello/artifacts/t072/` with before/, showroom-{1440,390} and ref/ (Porsche 1440-01, 1440-04, 390-01).

## Notes for the lead
- `tools/review/codex-review.sh` resolves the commit in `$CLAUDE_PROJECT_DIR` (the main checkout), so from a worktree it reviews the main checkout's HEAD. It produced `docs/reviews/2026-11-02-a5d7ae7.md` there by mistake. I reran it with `CLAUDE_PROJECT_DIR=$PWD`, but the review files still land in the main checkout's `docs/reviews/`.
- While I worked, the PostToolUse Codex hook kept reporting findings on `tools/review/licence-guard.sh`, which I don't own:
  - P1: `--all`, `--mirror` and configured push refspecs are not resolved.
  - P1: only the last push in a compound command is inspected.
  - P1: `git -C …/-c … push` bypasses the guard.
  - P1: `--follow-tags` skips explicit sources and destination-specific bases.
  - P2: `push origin :branch` deletions are blocked.
  - Separately, the guard's PreToolUse check once blocked a non-push command of mine (a Python edit) with "outgoing commits contain licensed assets". Every branch, including worktree-product, carries `public/media/scale3d-live/*.glb` through merged history. Nothing was pushed.
