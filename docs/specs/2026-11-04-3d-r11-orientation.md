# 3D round 11: the board on its rail, the body facing the right way, no clipping, a better barrel, no fake crest curve
Status: **APPROVED** (user 2026-11-04: "make a spec for Fable and complete that"). Owner: Fable. Branch `3d-r11`. The lead cross-checks against the real sequences and merges.

## The user's feedback (on the live site, after R10)
"The movements are getting much better and real progress is being made", but:
1. **The wave has a weird little curvature that's inaccurate.** This is R7's S1 plan-view crest curve (`waveAtlas.ts:125`, `WaveLive.tsx:59`): the shoulder sweeps seaward away from the peak.
2. **The surfer's body orientation is still really bad.**
3. **The board is flat on the wave face, which is wrong.**
4. **In some instances the surfer clips through the wave on a top turn.**
5. **Barrel riding could still improve.**

## Target, per item (check every one against `refs-motion/` real sequences and the True Surf frames; cite the frame)
1. **Crest:**
   - remove the plan-view curve, or reduce it to what real refraction shows (a gentle bend only far down the shoulder, never a visible kink or hook near the rider);
   - a straight-to-gently-bowed crest in the default view, like the real Ocean Beach / True Surf frames.
   - If something else causes the "little curvature" (a bump in the lip line, a seam between atlas stages), find it from frames and fix that.
2. **Body orientation:** the body faces where a real surfer's does in each move:
   - **chest:** open toward the wave face frontside, toward the beach / down the line backside;
   - **hips and shoulders:** roughly along the stringer in trim, rotating ahead of the turn (shoulders lead, hips follow);
   - **head:** turned down the line toward where the board is going.
   - Measure the shoulder-line and hip-line yaw relative to the board stringer and the path per move, and put a table of ours vs the real frames in FINDINGS.
3. **The board on its rail:**
   - in trim on a face the board is NOT flat to the face plane: the inside rail digs in and the deck rolls toward the wave (rail angle about 20–45° to the local face in trim, more in turns);
   - nose slightly up the face going down the line;
   - the board's long axis follows the path tangent, not the crest line.
   - Measure the board roll relative to the local face normal per move and compare it with the real frames.
4. **No clipping:**
   - add a glitch-monitor gate for any part of the board or body inside the wave body (below the water surface by more than 5 cm, or inside the lip) during top turns, snaps and cutbacks, at every size and skill;
   - the gate must be 0 in all 18 matrix cells (the R10 snap fixes stay).
5. **Barrel:**
   - the stance compact and low (the back knee near the deck), with the inside hand trailing in or toward the face;
   - the line high in the tube, under the lip, not dropping to the floor;
   - the rider visible from the default camera;
   - the exit ahead of the foam ball.
   - Compare with `real-barrel-seq/` and the True Surf tube frames.

## Rules
- **Don't fix what doesn't need fixing:** the R6–R10 wins stay, every gate stays 0, and the whitewater-pop check stays 0.
- **Licensed atlas:** rebuild it locally only; never stage it.
- **Each item** is its own commit, with before/after strips of ours against the real frames at the same timings.

## Acceptance
- **Strips per item** in scratchpad `wave/r11/`, ours beside the real sequence:
  - trim (front and backside);
  - bottom turn;
  - top turn and snap;
  - cutback;
  - barrel at 6 / 8 / 12 ft.
- **Numbers:**
  - board roll vs face, per move, within the real range;
  - shoulder and hip yaw vs stringer, per move, within the real range;
  - the clipping gate 0.
- **Default view** (5 ft Intermediate, seed 11) series and a 6 ft Expert barrel clip, both looked at.
- **Glitch matrix** 18 cells, all gates 0. Real-GPU fps 60.
- **Checks:** tsc, tests, build; toolkit t104 / t062 / t034.
- **FINDINGS §13:** what was off, the cause, the fix, and an honest list.
