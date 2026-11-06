# The kink and streak at the curl: findings (2026-11-06, branch `wave-kink`)

Spec: `docs/specs/2026-11-06-wave-kink-at-curl.md`. The user's circled shot: 12.5 ft face, Ocean Beach, plunging, left.
Evidence (scratchpad, not committed): `…/scratchpad/wave/kink/` (`cap.mjs` deterministic headless captures on a virtual clock,
shader terms switched off by replacing the live material's fragment source; `an*.ts` / `py/proto.py` numeric probes).

Written before any code change.

## 1. What draws the streak
Not the spray, not the wake, not the rider, not a second mesh (`headMat` is the headland). With the spray, wake and rider hidden the
streak stays. With the water shader painted flat magenta it is gone, so it comes from the water surface (`STRIP_VS` + `WATER_FS`).
Turning off one term at a time (default camera, 12.5 ft, `crop-12-terms.png`, `sheet-toggles.png`, `sheet-channels.png`):
- the foam (`cov`, the leftover-foam `lm`), the drain streaks (`pre`), the dimples and the chop do not remove it;
- the **sun glint** removes the bright part (`no glint`), and the **sky reflection (fresnel)** removes the rest. With both off only a
  faint vertical crease is left.

So the streak is correct lighting on a wrong surface. A narrow vertical band of the face has its normal swung sideways (along the crest),
so it reflects the bright sky and catches the glint. The normal view (`r4/d-normal-t2.png`) shows the band: a patch where the normal's
x component jumps, bounded by two vertical creases. The fine vertical striation inside it is the chop and dimple normals on that
twisted patch.

## 2. The exact cause of the step (and the twisted patch)
The atlas rows on either side of the pitch put the open face in different places. Measured on the atlas files (`an3.ts`): the face's
cross-shore position at 30% of the crest height, in face heights, rows 2..6:

| band (plunging) | rows 2, 3, 4, 5, 6 | jump row 3 -> 4 |
|---|---|---|
| licensed 10-15 | 0.06, 0.23, -0.23, -0.23, -0.23 | **-0.46 H** |
| licensed 8-10 / 6-8 / 15-plus / 4-6 / 3-4 | | -0.45 / -0.43 / -0.43 / -0.28 / -0.30 H |
| proc 10-15 / 8-10 / 6-8 / 15-plus / 4-6 / 3-4 | | -0.52 / -0.48 / -0.43 / -0.45 / -0.33 / -0.30 H |
| all spilling, 1-2 / 2-3 plunging | | at most 0.11 H |

Why the jump: `tools/blender/wave_atlas.py` `stage_curves` applies `relax_face` (the rideable 72 degree face, wave-round3) only to
rows `k < S_PITCH`. That pushes the lower face, and the trough and flat water in front of it, toward the beach. From the pitch row on
the relax is off, and R9's `throw_lip` also draws the wall under the tube seaward. The lower face, the trough and everything beachward
of them snap back about half a face height between two adjacent rows. It is a processing switch, not wave physics: a real wave's face
flows into the pitching section, and the lip throws out over it.

Along the crest, `stageAt` makes this worse. On the shoulder the stage rises steepest just before the break point: 0.295 stage/m at
x -> 0 on 10-15, against 0.074 stage/m on the broken side. Rows 3 -> 4 are crammed into about one face height of crest (x -3.8 to 0 m at
12.5 ft), and the stage rate drops 4x at x = 0. Rows 4..6 share the face, so it stops moving there. Result on the 12.5 ft surface
(`an2.ts`): the face at mid height moves 1.6 m seaward in 3.8 m of crest, then stops dead. That is a twisted patch with a crease at each
end, x = -3.8 (row 3) and x = 0 (the pitch row plus the stage-rate break).

The foam band: the trough streaks in `WATER_FS` (the `trough` term of `lm`) are masked by `onFace` and `hf`, so they start where the
face's foot is. The foot jogs about 1.6 m at the seam, and the band jogs with it: the left piece ends higher (further back), the right
piece starts lower (nearer), with the creased patch's dark notch between. The band is drawn on the same surface; the surface steps.

Same on both atlases: the cause is in the shared build (`wave_atlas.py`), and `proc_source.py` only swaps the source rows.

## 3. The faint ridge a third of the way down (secondary)
Also from `relax_face`. On rows 1..3 the source face above `top` (0.8 of the crest) overhangs (100-133 degrees), and below it the cap
forces 72 degrees, so there is a hard corner at 0.8 of the crest height. On row 3 there is also a fold. The feathering lip's underside
runs seaward almost horizontally at 0.78-0.79 of the crest. `relax_face` only caps segments that go down (`dz > 0`), so this underside
is kept after the push, leaving a Z-shaped ledge across the face (`py/proto.py` angle dump: `0.80:72 … 0.78:-173 … 0.79:72`).
Lit, that is a horizontal line along the face.

## 4. Past rounds in this area and why they did not fix it
- wave-round3 (`85d01b2`, `relax_face` on rows < pitch): created the switch at the pitch and the ledge.
- R9 (`18fad91`, the C tube): `throw_lip` draws the wall under the tube seaward, which widened the jump.
- R7/R11/R12/N5 (`d8cebc9`, `a70cce9`, `dd2dfcc`, `aa4d251`): the plan-view bend and the height envelope (`bendZ`, `ampAt`). These act
  along the crest on the whole profile and are smooth; they never touched the row-to-row shape, so the seam stayed.
- R13 (FINDINGS section 15): put the user's vertical streak down to the wake trail and stopped the takeoff wake. That one was real, but
  the surface patch under it was never looked at. With the wake, spray and rider hidden the streak is still there today.
- Earlier rounds judged from frames and tuned envelopes and shading. No round measured the profile rows against each other, so a
  0.3-0.5 H jump between two rows, hidden in the build, never showed up.

## 5. Fix plan
1. **Build, one rule across the pitch** (`wave_atlas.py`, shared by both atlases): align the pitching rows (`S_PITCH..S_LAND`, plunging)
   on the shoulder's open face. They are translated beachward by the measured face offset between row pitch-1 and the pitch row, with
   the translation fading to zero down the back of the wave. The open face and trough stay continuous through the pitch, and the crest
   and lip advance over them as the lip throws (the tube's shape is unchanged; the bore rows follow, since they are built from the
   landed row). Prototype: the jump goes from -0.30..-0.54 H to at most 0.02 H on every plunging band, and the cavity area is unchanged.
2. **Build, no ledge**: `relax_face` caps every segment below `top` that goes seaward, not only the descending ones (no fold), and eases
   the cap in over a band below `top` instead of at one height (no corner).
3. **Runtime, if the continuity test still finds a slope kink at x = 0**: make `stageAt` C1 at the break point (TS and GLSL together).
   The rider's stage and the break point stay where they are.
4. Rebuild both atlases locally into this worktree (git-ignored, never committed). The lead must rebuild in the main checkout
   (`tools/blender/build_atlas.sh`, then `python proc_source.py public/media/scale3d-proc` with Blender's Python) before the change shows.
5. Proof: `src/tests/wave-kink.test.ts` reads the real atlases (both kinds, every band, both breakers, faces 1-25 ft through the viewer's
   bucket blend and scaling, several times, left and right) and fails on a face step, a slope kink or a non-rising face across the
   peel. It also checks the GLSL ALONG block against the TS maths. Run it on the current atlases first (fails), then on the rebuilt
   ones (passes). Then frames, sheets and phone numbers.
