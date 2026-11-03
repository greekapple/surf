# Wave scale 3D: surfer movement that reads as real surfing
Status: DRAFT for user approval. The work itself is approved scope ("next round", Fable round 3, branch `wave-round3`); this spec re-prioritises it and sets the bar.

User (2026-11-03): "main thing is surfer movements suck look at it yourself it looks pretty terrible … thats definitely the biggest immediate issue make a spec for this prompt"

## Context
- The riding surfer was merged at 9682084 (plus the dbbbb74 fix):
  - a CC0 MPFB2 rig with 24 bones;
  - one `ride` clip of about 4 s, made of 4 key poses (trim, bottom, top, pump) with linear blends;
  - placed every frame by `placeRider` in `src/features/scale/WaveLive.tsx`.
- **Placement:**
  - `pathAt(phase)` gives an along-crest offset and a height fraction on the face;
  - then a per-frame search drops the rider in 3% steps until the face slope is ≤ 50° and no rail is more than 20 cm under the centre;
  - then the board is lifted so the rail stays within 15 cm.
- Bank = 0.95 × the face slope, capped at 55°. The board yaw comes from the clip.
- **The QA harness** (`t102-ride.mjs`, `t104-noboard.mjs`) checks contact, rail depth, ahead-of-break, the move cycle, reduced motion and fps. It doesn't check that the motion is continuous or believable.

## Problems (lead, 1191×647 Chrome on :5180, 6 frames 0.6 s apart, Ocean Beach 11 AM, 9 ft face)
1. **It jumps.** Between frames 0.6 s apart the rider jumps across the frame and up and down; there's no continuous line. Likely cause: the per-frame slope and rail search changes the height fraction in discrete steps, and the phase-keyed path isn't smoothed.
2. **The board's heading flips.** The nose points at the camera in one frame, down the line in the next, then back. The board doesn't point where it's travelling. Its yaw comes from the clip, not the path.
3. **The surfer rides in front of the wave.** Most frames have the board on the flat water at the bottom of the wave. The "walk down until ≤ 50°" rule pushes the rider to the trough because this atlas's face is steep.
4. **A mannequin body:**
   - upright torso;
   - both arms reaching forward at shoulder height;
   - no knee or hip compression changing with the turn;
   - the head doesn't lead.
5. **Spray detaches.** Tail-spray particles hang in the air away from the board.
6. **The motion isn't tied to the wave.** The rider's speed along the crest doesn't relate to the peel speed, so it reads as sliding, not riding.

## Target
- **One continuous, velocity-smooth ride line** across the face, staying ahead of the curl:
  - the bottom turn at the base of the face;
  - a climb to the upper third;
  - a top turn just under the lip;
  - a descent and trim;
  - repeat.
  - Speed and timing follow the wave: the rider moves along the crest at about the peel speed, and a full turn sequence takes about 2–3 s on an overhead wave.
- **The board always points along its velocity** (yaw from the path tangent), banks into each turn (roll from path curvature × speed), and has its rail in the face.
- **The body follows the board and the turn** (layered procedural pose on top of the clip):
  - compressed knees at the bottom turn, extending through the climb;
  - shoulders and head lead the turn;
  - the lead arm points the line, the trailing arm stays low behind;
  - weight over the back foot in turns.
- **Spray is emitted at the tail** only during the top turn, launched up and off the back of the wave, falling under gravity.
- **References for motion:**
  - real footage frames: the user's tabs "Types of Waves" (YouTube) and the WSL Teahupo'o drone video;
  - frontside turn sequences (Wikimedia/Unsplash, CC licences recorded in `docs/design/REFERENCES-2026-11-03-surfer.md`).
  - Compare a 6-frame strip of ours against a 6-frame strip of a real ride at matching timing.

## Constraints
- **Data honesty:** an illustration of the forecast hour. The label stays, the surfer is at the person's height, and the motion is generic (not implied by the forecast).
- **Performance:** 60 fps and a 1% low ≥ 55 at 1440 DPR 2 on a real GPU. No per-frame allocations in the placement.
- **Keep:**
  - Left/Right (frontside both ways);
  - quiver board dimensions;
  - reduced-motion fallback;
  - the dev rider interface;
  - t102/t104 passing.
- **Assets:** CC0 rig only. No Mixamo (the user's account would be needed, and its licence). No AI-generated motion.

## Approach (recommended)
1. **The path first.**
   - Compute a ride line once per wave cycle: a smooth closed spline in the crest frame (x along the crest, the height fraction on the face) through bottom-turn, climb, top-turn and descent waypoints. Keep it ≥ 1 face height ahead of the break, and place it on parts of the face the atlas can ride.
   - Sample it by time, so position, velocity and curvature are continuous.
   - Replace the per-frame slope/rail search with a precomputed safe envelope (allowed height fraction per x from the atlas stage), and clamp the spline into it once.
2. **The board from the path.** Yaw = the path tangent. Roll = atan(v²·κ / g), blended with the face normal and capped (rail ≤ 15 cm). Pitch from the face slope along the heading.
3. **The body from the board.**
   - Keep the clip for the base stance.
   - Add procedural layers:
     - knee and hip compression from the turn load (v²·κ);
     - torso and head yaw leading the heading by about 0.2 s;
     - an arm counter-rotation from roll.
   - Smooth critically damped springs on every layer, so nothing snaps.
4. **Spray:** emitted from the tail world position with the board's velocity plus an up/back kick, under gravity, only while roll and curvature are high (the top turn).
5. **Check against real footage:**
   - a 6-frame strip of our rider next to real-ride strips;
   - an animated GIF of 4 s at 1440 and 390 for the user.

Rejected:
- **Tuning the current keyframes:** the jumps and heading flips come from placement, not poses.
- **A frozen scene:** the user chose a ride.
- **Mocap or Mixamo:** licence and account.

## Owners and level
- **Level 2.**
- **Fable** (`wave-round3`, already running): this spec is now its first priority, ahead of the board shape and face texture.
- **Engineering:** extend t102 with motion checks (below), toolkit only.
- **Lead:** gate, Codex, a fresh Fable critic before merge, and the GIF shown to the user.

## Acceptance
- **Continuity** (new t102 checks, 30 Hz samples over 2 cycles, Left and Right):
  - the rider's screen position never moves more than 3% of the frame width between consecutive samples;
  - its velocity never reverses along the crest.
- **Heading:** board yaw within 15° of the path velocity in ≥ 95% of samples (new field `heading_err_deg` in the rider interface).
- **On the face:** height fraction ≥ 0.15 in ≥ 80% of samples, and the top turn reaches ≥ 0.55 (new field `frac`).
- **Existing gates still pass:** contact, rail ≤ 15 cm, ahead of the break, the move cycle, reduced motion, t104.
- **Performance:** 60 fps and a 1% low ≥ 55 on a real GPU (the lead measures in Chrome).
- **Visual:**
  - the 6-frame strips beside real footage strips are signed off by the lead and a fresh Fable critic;
  - the user watches the 4 s GIF before merge.

## Open questions (yours)
1. **Camera:** follow the rider with a gentle tracking camera (like surf footage), or keep it fixed with the rider travelling through the frame? Recommended: **gentle follow**, so the rider stays readable and the wave peels past.
