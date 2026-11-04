# 3D wave scene, round 4: a surfer who moves like a real one, barrels on bigger waves, then the wave and the beach
Status: **APPROVED** (user, 2026-11-04: "fix the issues you are referring to … but it's still just decent … the surfer is the main problem … make a spec for the old improvements and keep these in mind"). It continues docs/specs/2026-11-04-3d-real-surfing.md (the user's brief; stages 7–9 still open) and docs/3d/FINDINGS-2026-11-04.md (runs 1–3).

## What the user saw (Ocean Beach, Wed 8 AM, 11.5 ft face, Intermediate)
- **The movement still isn't fluid:** "the idea is there but it's not executed very well". It needs to improve drastically.
- **The knees look wrong.**
- **The arm goes up far too high before every turn.**
- **The hairline looks bad:** give him a better, more realistic hairstyle.
- **Too little difference by size and skill:** simpler surfing should go with smaller waves and lower experience, and more technical riding with bigger waves.
- **No barrel riding yet:** these waves are barrelling, so above 6 ft one of the rides should be a barrel ride, crouched inside the tube and visible from the side, or just coming out of it.
- **The wave is better** but can still improve. The surfer is the main problem.
- **Benchmark:** the game **True Surf** ("it's pretty accurate"), plus real surfers at each level and wave size.

## Targets (priority order)

### A. Surfer motion quality (first; nothing else ships until it's clearly better)
1. **Study real motion before changing poses:**
   - frame-by-frame references of real surfers (beginner, intermediate and expert) on small, mid and big waves;
   - True Surf gameplay clips for animation quality and fluidity;
   - a reference sheet per move (pop-up/takeoff, trim, bottom turn, top turn/snap, cutback, pump, barrel stance, kick-out) with joint angles and timing read from the references (knee and hip flexion, torso pitch, arm heights, head direction).
   - Lead-captured frames are in the scratchpad `wave/refs-motion/`. Fable finds more with WebSearch/WebFetch.
   - Reference images stay out of the repo (third party).
2. **Knees and legs:**
   - correct knee flexion range and direction for each stance, with the front and back knee different (the back knee drives toward the front);
   - no hyperextension, no knock-knee or bow-leg artefacts;
   - feet planted with the board's tilt.
   - The IK must respect the knee pole direction (the knee points over the toes).
3. **Arms:**
   - no high arm raise before turns;
   - real surfers keep their arms low to mid, lead with the front arm pointing where they're going, the back arm low and behind;
   - turns are driven by the shoulders and hips;
   - arm motion is small and damped, never a raise-and-drop each turn.
4. **Fluidity:**
   - continuous motion between moves (blend in the move's own rhythm, about 0.3–0.6 s, with no pose holding still mid-move);
   - compression and extension as one smooth wave through the legs;
   - head stable and looking down the line;
   - match True Surf's smoothness.
5. **Movement grows with size and skill:**
   - **small waves or beginners:** simple trims, gentle turns, upright, little rotation;
   - **mid waves:** carving with real rail work;
   - **bigger waves or experts:** technical riding (deep bottom turns, vertical top turns, hard cutbacks, barrel riding).
   - Skill caps what each band can do (as in run 3), with the movement quality clearly different between levels.
6. **Barrel rides:**
   - for faces above 6 ft, at least one ride per cycle is a barrel ride: a late, deep bottom turn, a stall (back hand dragging), then a low crouch (the knees deep; a "pig-dog" for backside) inside the tube with the lip pitching over, coming out ahead of the foam ball, or just out of it;
   - beginners never pull in;
   - this needs a real drawn tube (B1).
7. **The character:** a better, realistic hairstyle (short, wet, swept back; no visible hairline artefact). Skin and wetsuit materials less plastic.

### B. The wave (needed for barrels; continues brief stage 8)
1. A **real tube**: the lip throws out and down to form a hollow cavity on plunging/bigger waves, readable from the side; the foam ball behind; a lip thickness that grows with size.
2. **Peeling** progressively down the line at a peel speed suited to size; the surfer's line tied to it.
3. **Whitewater with volume** (no flat decals); foam that grows continuously.
4. The face shading and the pole/label scale (the shoulder taper at 12–20 ft from run 2) kept honest.

### C. Beach, sets and ocean (brief stages 7 and 9; after A and B)
- Beach-break coastline preset, bathymetry shading, shore-break.
- Set lines spaced by period, ocean surface chop by wind, face shading.

### Later (noted, not now)
- **Attire by water temperature:** board shorts → spring suit → full wetsuit → hooded full suit, from the forecast water temperature (the spot page already has a wetsuit guide). Only when the user asks.
- A stance setting (regular/goofy) in the profile, when the user agrees.

## Verification
- **Side-by-side strips** (6 frames, same timing) of our rider vs real surfers AND vs True Surf for: trim, bottom turn, top turn, cutback, barrel. Per level (Beginner, Intermediate, Expert) at 2, 6, 12 and 20 ft. The lead and a fresh Fable critic must say it reads as the same move.
- **Knee/arm checks in the glitch monitor (dev):**
  - knee angle within human range and pointing over the toes;
  - wrist height above the shoulder for no more than 0.3 s outside a barrel hand-drag or a big snap;
  - a joint jerk metric (peak angular acceleration) under a threshold for fluidity.
- **Barrel check:** at ≥ 6 ft, at least one ride per cycle has the rider inside the tube (inside the lip's projected cavity) visible from a side camera, for ≥ 0.8 s.
- **Existing:** 0 glitches, heading ≤ 15°, rail ≤ 9 cm, 60 fps real GPU, t104/t062/t034, journeys.
- A 4 s clip per level at 2, 6 and 12 ft, and a barrel clip at 12 ft, for the user.

## Owner and rules
- **Fable** (3D owner), on a branch per run. The lead gates every merge and shows the user clips.
- **Repo rules:** no licensed assets staged; third-party reference footage stays in the scratchpad; True Surf is studied as a reference only (no copied assets).
- If a run's budget runs short: commit what works, report partial.
