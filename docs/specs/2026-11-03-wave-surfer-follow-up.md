# Wave scale 3D: a surfer who rides the wave, and no AI photo under the 3D view
Status: **APPROVED** (user, 2026-11-03 ~09:50: "yes do what you recommend … use the agents and engineer and product teams and git trees"). Answers: 1 **ride**; 2 **remove the AI photo entirely**; 3 **frontside only**.
Base: the restored wave look merged at 93e1848 (on GitHub as swello-v0.17 6239b22).

User (2026-11-03): "the ai illustration doesnt need to be there on the 3d render also if the wave is moving than the surfer should be doing shit to like doing moves or it should just look stationary the surfer still looks super awkward … make a spec for this after we need to get the 3d render right"

## Context
- **The 3D view** is `src/features/scale/WaveLive.tsx`. The wave cycles and peels while the camera frame moves with the peel. The surfer is fixed at `surferX(m)` on the face: the water streams past, but the body never moves.
- **The surfer** is `tools/blender/assets/surfer-v2.glb`:
  - an MPFB2 human (CC0), posed in Blender by `build_surfer.py` in one bottom-turn crouch, on a procedural 6'0" board;
  - exported with no skeleton and no animation (0 skins, 0 animations);
  - mirrored in the viewer into a frontside stance and scaled to the person's height (T-099).
- **The AI photo:** under the 3D view, `ScaleStage.tsx:185-187` shows a "Show example photo (AI illustration)" button. It opens the band's AI image (`public/media/ai/ai-scale-*`, from T-033).
- **Decisions in force:**
  - no AI imagery on condition surfaces; AI only inside comparison tools, labelled (2026-10-31);
  - the 3D wave is this spot-hour's forecast, with no size chips (2026-11-02);
  - Fable owns the 3D design.

## Problems
1. **The AI photo competes with the 3D.** It's a different, invented wave next to the forecast-driven one. With a real 3D illustration it adds nothing, and it's off-brand.
2. **The motion is inconsistent.** The wave breaks and peels, but the surfer is frozen in one crouch, like a cut-out pasted on moving water. Real riders on a peeling wave are always moving: trimming, pumping, turning, adjusting their height on the face.
3. **The pose reads as awkward:**
   - stiff arms;
   - the board doesn't bank into the face;
   - the weight sits over the middle instead of the back foot in a turn;
   - from many orbit angles the rider seems to float above the face rather than plant into it.

## Target
- **Problem 1:** the 3D view has no AI photo button. The Diagram stays as the honest to-scale comparison.
- **Problem 2 (recommended): the surfer rides, a short loop synced to the wave cycle.**
  - **Trim:** high on the face, upright, arms loose.
  - **Bottom turn:** compressed, the board banked about 30–45° into the face, the inside hand near the water.
  - **Top turn or cutback:** extended, the board banked the other way, spray off the tail.
  - Then back to trim.
  - The rider moves along and up and down the face with the peel, and stays ahead of the curl. They are never swallowed by the whitewater and never ride flat water.
  - Real references to match, each saved with its URL in `docs/design/REFERENCES-2026-11-03-surfer.md`:
    - frame-by-frame frontside bottom turn and top turn sequences from real surf footage (the user's Chrome tabs: Google Images "waves breaking surfer" and the YouTube "Types of Waves");
    - surf-coaching stills of the stance: back-foot weight in turns, a low centre of mass, the leading arm pointing the line.
- **Problem 2 fallback (Open question 1): the whole scene holds still.** The wave is frozen at a single moment (the lip feathering, the face open) and the surfer in one good bottom-turn pose. Orbit still works. There's no mismatch, but also no life.
- **Problem 3:** a pose a surfer would recognise from every orbit angle:
  - the board in contact with the water (the rails in the face), banked;
  - knees bent and the back knee tucked;
  - hips over the back foot in turns;
  - arms balancing, not hanging.
  - A side-by-side with 2–3 real photos at matching angles must read as the same move.

## Constraints
- **Data honesty:**
  - the motion is an illustration. The existing label ("3D illustration of this forecast hour · approximate") stays, and the surfer stays at the person's height;
  - no moves implied by the forecast: the loop is the same for every hour, and only its speed follows the wave cycle.
- **Assets:**
  - the surfer stays CC0 (MPFB2/MakeHuman) and is built by our own Blender script. No paid rigs and no AI-generated people;
  - Mixamo would need the user's Adobe login and its licence terms, so we don't use it;
  - the licensed TurboSquid wave assets stay local, as now.
- **Performance:**
  - 60 fps held (1% low ≥ 55) at 1440 DPR 2 and on a mid phone;
  - the animated surfer GLB is under 1.5 MB (now 0.68 MB static), and the skeleton is ≤ 30 bones (body only, no fingers or face).
- **Keep:** Left/Right (the moves mirror), the board from your quiver under the rider, orbit control, lighting by hour, and the reduced-motion fallback (a still pose).

## Approach (recommended)
1. **Remove the AI photo from the 3D view.**
   - Show the button only in Diagram mode, or remove it entirely (Open question 2).
   - Update t052 and journey 7, which mention "the AI photo is optional".
2. **Rig and animate in Blender.**
   - Extend `build_surfer.py` to keep the MPFB2 game-engine skeleton (skinned) and key 4 poses:
     - trim;
     - bottom turn;
     - top turn;
     - pump.
   - Blend them into one looping clip, `ride`, about 3–4 s, plus a `still` clip for reduced motion.
   - Export a skinned GLB with the clips. The board is parented to the feet bones.
   - Poses are set against the reference photos, one side-by-side per pose.
3. **Viewer** (`WaveLive.tsx`):
   - play the clip with `THREE.AnimationMixer`, its time scaled to the atlas `cycle_s`;
   - move the rider along a path on the face, sampled from the atlas profile (`facePoint` at the stage, with height on the face varying through the loop), so the board stays on the water;
   - bank the board root to the face normal;
   - keep the rider ahead of the break point every frame (clamp against the foam line);
   - spray off the tail at the top turn uses the existing spray emitters.
4. **Verify:**
   - 6 orbit angles × 3 moves, side by side with real photos;
   - fps;
   - 390 and 1440 screenshots;
   - Left and Right.

Rejected:
- **Procedural only** (tilting the static mesh along a path): the stiff limbs, the main source of the awkwardness, would stay.
- **A Mixamo rig:** needs the user's account and a different licence.
- **A video loop of a real surfer:** licensing, and it can't follow the forecast wave or the orbit.
- **AI-generated animation:** off-brand (no AI people on the product surface) and not controllable.

## Owners and level
- **Level 2.** Visual and asset work, no data changes.
- **Fable:** owns the pose, motion design and Blender script, as the 3D owner.
- **Lead:** gate, references, toolkit updates.
- **Branch:** `wave-surfer` from `forecast-trust` after the render merge.
- **Commits:**
  1. no AI photo on 3D;
  2. rigged and animated surfer build script, plus the reference sheet;
  3. viewer rider path, banking and mixer;
  4. toolkit and tests.

## Acceptance
- The 3D view has no AI photo or button. Diagram behaves as Open question 2 decides. t052 and journeys pass.
- The surfer GLB has a skin and `ride` + `still` clips, ≤ 1.5 MB, ≤ 30 bones, CC0 provenance in `tools/blender/assets/README.md`.
- At any frame the board's contact points are within 5 cm of the water surface. A dev check samples 60 frames.
- The rider is never inside the foam ball or behind the break point. A dev check over 2 full cycles, Left and Right.
- At least 60 fps average and a 1% low ≥ 55 at 1440 DPR 2 over 10 s. No console errors.
- Side-by-side sheet: trim, bottom turn and top turn, each beside 2 real photos, at 2 angles. The lead and Fable sign off that each reads as the move. The user sees the sheet before merge.
- Reduced motion shows the still pose.

## Open questions (yours)
1. **Ride or still?** Recommended: **ride** (a looping trim → bottom turn → top turn). The fallback is a fully frozen moment.
2. **AI photo in Diagram mode?** Recommended: **remove it entirely**. The Diagram and 3D cover scale honestly, and it's the last AI wave image in the product. Alternative: keep it, labelled, in Diagram only.
3. **Moves:** recommended **frontside only** (the rider faces the wave on both Left and Right, as now). Backside could come later.

## Team plan (each in its own git worktree off forecast-trust 93e1848; the lead merges through the gate)
| Track | Owner | Branch | Files (no overlap) |
|---|---|---|---|
| A. Render polish (Fable's leftovers: the bright "teeth" at the foot of the break, the pale streak along the trough, airbrushed whitewater → textured foam) and then the riding surfer (rig, poses, clips, viewer path, banking, mixer) | **Fable** agent | `wave-ride` | `tools/blender/build_surfer.py`, `tools/blender/assets/README.md`, `src/features/scale/WaveLive.tsx`, `waveAtlas.ts`, `docs/design/REFERENCES-2026-11-03-surfer.md` |
| B. Remove the AI wave photo everywhere (button, `media` on bands, the manifest entries and files if unused elsewhere), copy and tests | **product** terminal | `t101-no-ai-photo` | `ScaleStage.tsx` (the photo block only), `services/waveScale.ts`, `public/media/manifest.json`, `tests/wave-scale.test.ts` |
| C. QA harness: `t102-ride.mjs`, which reads WaveLive's data attributes/dev hook to check board-to-water contact ≤ 5 cm over 60 frames, the rider never behind the break or in the foam (2 cycles, Left and Right), fps (≥ 60 avg, 1% low ≥ 55), reduced motion = still pose; update `t052`, `journeys.mjs` and `t033-shots.mjs` for the removed photo | **engineering** terminal | `t102-ride-qa` | toolkit only (`~/Development/ai-system-setup/playwright-toolkit/swello/`) |
| Review | **Fable critic** (a fresh Fable subagent, read-only) compares the result with the real photos, then **Codex** once per merge | | |

Interface between A and C: WaveLive exposes `el.dataset.rider = JSON.stringify({x, y, z, contact_m, ahead_m, move})` each frame in dev, plus `__wave.rider()`. Fable adds it first and tells the lead, who relays it to engineering.
Order: B and C start now; A starts with the render polish, then the surfer. Merge order: B → A → C (C's checks run against A).
