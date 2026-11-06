# 3D, next (2026-11-06): a real barrel ride, surf-photo framing, then the arms
Status: **APPROVED** (user 2026-11-06: "yes perfect … fix all the things you think you should, in order"). Opus by default; Fable only if a track clearly fails. Slow and deliberate: frame-by-frame against the references, past mistakes checked (FINDINGS §13–20, the vault 3D rounds, the wave-lab lessons).

The lead's audit (scratchpad wave/audit2/fs.png and bs.png), both R17 and ?motion=real, 6 ft Expert, default camera:
1. The "barrel" (about 2 s) is a crouch on open face with no lip over the rider: the ride plan keeps the rider on the unbroken shoulder.
2. About 25% of each loop is an empty wave after the kick-out (the reset).
3. The rider is about 15% of the frame height: too small for the pose to read.
4. The user: "the arms … still just look very awkward"; the motion-real arm speed gain isn't visible at the default camera.

## In order
1. **A real barrel ride.** For the barrel move, place the rider behind the peel where the lip is pitching and falling (the stage between pitch and land), low on the face, under the roof, coming out with the curl's speed. Use the roof/head clearance logic. On frontside and backside, at 6 ft and up. On waves too small for a tube, keep the current line. Use the slightly hollower tube (`?atlas=proc`, private).
   Acceptance: the lip visibly over the rider for 1.5 s or more from the default camera at 6 and 8 ft; bodyclip and head-wet not worse; side-by-side with barrel-machado frames.
2. **Surf-photo framing.** The default camera closer, with a longer lens (the wave-lab channel cam): the rider about 25–30% of the frame height at 1440 and 390, the curl and whitewater in frame, nothing cropped. t062's camera invariants still hold.
3. **The arms.** Make the arms read naturally at the default camera: front arm leading down the line at chest height, back arm bent and balancing, the hands following the turns (trailing hand toward the face in the bottom turn, arms swinging through the snap). Check against the pro frames; a frame-step strip 0.05 s; no new arm/wrist gate events.
4. **Later:** the surfskate capture when the user has a board; then T-140 (paddle out, sets, the lineup; it also removes the empty-wave gap); then T-141 (wipeouts).

Each step: its own commit; stills before and after; tsc/tests/build, t062/t104/journeys; the 18-cell matrix no worse. The lead reviews visually before any merge.
