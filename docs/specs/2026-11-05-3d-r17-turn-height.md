# 3D round 17: a longer bottom turn and a snap at the top of the wave
Status: **APPROVED** (user 2026-11-05: "17 is ok"). Owner: Fable, branch `3d-r17` from forecast-trust after R16 merged (surfer-v12). Credits are tight until the Wednesday reset: keep it lean, at most one correction cycle. Restore tag `3d-before-r17`.

## The user's words (2026-11-05)
> "a surfer's bottom turn is a little longer; the top of a snap or turn should be nearer to the top of the wave. Our surfer just points the board upwards and his body upwards and then back down, basically a snap in the middle of the wave. It needs to be higher as well."

## What's wrong now (R15)
- **The bottom turn is short.** About 1.25 s for the drop plus the turn, with a short arc, so the turn ends low on the face.
- **The carve up is a small rise** (R15 FINDINGS §17: kept modest so the head stays out of the face). The hit happens around mid-face. The rider pitches the board and body up, then back down, without ever travelling up to the lip.
- So the "snap" reads as a wiggle in the middle of the wave rather than a hit at the top.

## What a real one looks like (to confirm against the references)
Sources: the `bottom-turn-fs` and `snap` skeletons and the Surf Ranch clip in `pose/out2/`, and the pro frames in `~/Development/swello-design-references/`.
- **The bottom turn:** a longer, drawn-out arc on the rail at the trough, about **1.5–2 s at 6 ft** (scaled with face height). Speed is carried through it. Its exit angle points steeply up the face, roughly 45–70° from the wave's line.
- **The vertical climb:** the board travels up the face, not just pitches. The rider extends progressively on the way up.
- **The hit at the top:** the turn's apex is in the **top ~15–20% of the face**, with the board's tail at or near the lip line (in the curl's throw zone for a snap, just below the lip for a top turn). The rider rotates there, and the spray comes off the lip.
- **The return:** back down the face (re-entry), then into the next bottom turn or the trim.

## Items
1. **Measure first.** Per cell (4, 6, 8 and 12 ft; frontside and backside; Intermediate and up), log:
   - the bottom-turn duration and arc length;
   - the turn's exit angle;
   - the apex height as a fraction of the face (board centre and tail);
   - the rise from the bottom-turn exit to the apex.
   Put the same numbers for the reference skeletons and frames in a table.
2. **A longer bottom turn.** About 1.5–2 s at 6 ft, a wider arc, the rail held through it, speed carried; the R15 look stays (the compression, the spray fan, the head leading).
3. **A real climb.** The path goes up the face to the hit: board centre apex ≥ 80% of the face height, tail ≤ 0.3 m from the lip line at the snap (scaled with size). The body extends on the way up, not just a pitch of the board and torso.
4. **Keep the head out of the face** (the reason R15 held back):
   - move the hit point and lean the rider's line away from the face as it climbs;
   - use the roof/head clearance logic from R14–R15 rather than lowering the apex;
   - bodyclip and the head-wet check stay at 0.
5. **The hit and the re-entry at the top:**
   - the rotation, the spray off the lip and the re-entry back down;
   - a top turn variant (apex just below the lip) for smaller waves and beginners, so a 2–4 ft wave doesn't throw the rider over the lip.

## Rules
- Don't regress R13–R16: the trim, the barrel sequence (forward → turn at the fold → stall → tube), the arms, the board and feet.
- Beginner clips are for small-wave tuning only.
- Licensed atlas local only; free ports; one commit per item.

## Acceptance
- **A side-by-side strip** (ours vs the reference stick figures and frames), with the turn path drawn over the face for 6 ft frontside and backside, before and after.
- **The table:** apex ≥ 80% of the face at 4 ft and up (Intermediate and up), the bottom turn 1.5–2 s at 6 ft, the exit angle ≥ 45°.
- **A default-camera clip** where the snap clearly happens at the top of the wave.
- **The glitch matrix:** bodyclip 0 in 18 of 18, every gate 0; the barrel times kept (6 ft ≥ 3 s); 60 fps.
- tsc, tests and build; t104/t034/t062; FINDINGS §19.
