# 3D round 14: a bent back arm, a simple barrel, and the 6 ft tube back
Status: **APPROVED, started 2026-11-04** (user: "the functionality is super close … add to the spec and go ahead"; the barrel-ride sequence revised by the user, see item 2). Owner: Fable, branch `3d-r14` from forecast-trust **after R13 is merged**. The lead cross-checks and merges.

## The user's feedback, verbatim gist
1. **The back arm**, on both sides but especially backside (the right arm for a regular-foot rider): "pretty much straight". In real surfing that arm is "conventionally bent and facing more towards the other arm: not fully, don't over-exaggerate". Watch pro clips first.
2. **Barrel rides:** "it just randomly throws a snap for the barrel". The user's revision: **don't remove the turn.** The surfer goes more forward (down the line) to avoid clipping, and the turn happens right where the wave is starting to fold into the barrel, not inside it. After the turn, the surfer stalls back into the barrel and the barrel-riding position.
3. **Backside barrel riding** looks different (rail grabbing and so on). Research it now, build it later.

## What the lead saw in the pro clips (skeleton overlays, scratchpad `pose/out2/`)
- **Surf Ranch pros** (`pro-popups-surfranch`, side-on), trim and turns: the back arm is bent, about 90–130° at the elbow by eye. The forearm swings forward and across toward the front arm, with the hand in front of the body between hip and chest height. The front arm leads, longer and lower. Look at `overlay/t0013.90.jpg` and `t0035.29.jpg`.
- **The 2D trace's back-elbow medians read straighter** (~145–165°: Surf Ranch 143, close-up 165, Reunion 152, cutback 149, backside 145), because an arm reaching across the body foreshortens toward the camera. **Use the frames and side-on views, not those medians, for the back arm.** Check the bend from a camera at 90° to the arm's plane.
- **Backside** (`backside-turns`): the back arm is bent and held closer, with the hand near the hip line (front elbow median 111°).

## Target
1. **The back arm** (trim, pump, bottom turn, recovery, both sides):
   - elbow about 100–130°;
   - the upper arm slightly forward of the torso;
   - the forearm angled toward the front arm, with the hand in front of the body between hip and chest height;
   - not folded tight across the chest, and not straight (the user: don't over-exaggerate).
   - Backside: a little tighter to the body.
   - It moves with the torso's rotation and opens out (straighter, higher) only in snaps and cutbacks, as the real clips show.
   - Re-author it in the surfer keys (v10). No new runtime layer.
2. **The barrel ride, in the user's order:** takeoff → bottom turn → **a turn at the lip where the wave is just starting to fold into the barrel** (ahead of the barrel section, never inside the cavity or under the thrown lip) → **stall back** (drag the inside rail or hand, weight back) into the pocket → the barrel crouch, in the tube → exit → kick-out.
   - The rider travels further **forward** (down the line) before the turn, so the turn happens on the open, steep section ahead of the curl. This avoids the clipping R12 and R13 saw at the 6 ft hit.
   - The turn is a real top turn: board up the face to the folding lip, with the R8 pivot and the arm throw and drop.
   - The stall is a visible deceleration: the curl catches up and the rider settles into the barrel stance. It isn't a jump back.
   - Non-barrel rides keep their own move sequences.
   - Check: per barrel-style ride, log the turn's position relative to the curl (it must be ahead of the cavity, at the fold) and the stall's duration (≥ about 0.5 s).
3. **Restore the 6 ft barrel time** lost in R13 (R12 3.7 s → R13 0.45 s). The R13 open-face positioning stays for trim. The barrel knots anchor to the tube as they did in R12 (head ≥ 0.15 m under the lip, dry), with a smooth transition from the open face into the pocket. Targets: 6 ft ≥ 3 s, 8 and 12 ft ≥ 4 s.
4. **Carry-overs from R13** (only after 1–3):
   - wrist and arm gate hits on backside (hand above the shoulder from the v9 climbB/topB keys);
   - over-rotation after the hit (shoulders about 61° vs about 45° real);
   - p95 fluidity;
   - frontside recognisability, now scored with all 12 traced clips.

## Later (user, not in R14)
- **Visuals:** the surfer model and the board (T-134).
- **Maybe a cutback** variant in the ride styles.
- **Airs:** probably not ("a little too complicated and not really needed").

## Research for later: backside barrel riding (not built in R14)
Notes for a later round. Fable is to read these and propose an approach in FINDINGS §16 without implementing it.
- **Pig-dog:** a low crouch with the back knee dropped toward the deck, shoulders squared to the wave, head down, weight forward, and often a firm grip on the **outside rail**. Stab Mag (Jamie O'Brien; "your backside tuberiding is likely all wrong"; the etymology piece) describes the hunter-dog stance and the classic teaching of one arm behind, reaching into the face.
- **The modern variant:** a subtler, "rubbery" backside tube stance, with the open front hand extended onto the face (Stab Mag).
- **When to grab:** John John Florence (Stab Mag, big-wave backside tube) says to grab in a smaller barrel to stay compact, when stalling (pull back on the board), or when falling.
- **To settle before building:** which hand grabs which rail in each variant. Confirm with frames from `pigdog-backside` and `barrel-backside-100fps` (traced; low confidence) plus a coaching video.
- **Sources:**
  - [Stab: Jamie O'Brien, backside barrels](https://stabmag.com/?p=33240)
  - [Stab: backside tuberiding](https://stabmag.com/?p=37717)
  - [Stab: John John Florence, big-wave backside tube](https://stabmag.com/?p=17399)
  - [Stab: pigdogging etymology](https://stabmag.com/elsewhere/anyone-know-the-etymology-of-pigdogging/)

## Rules
Same as R13:
- don't break what works;
- all gates 0, the pop check 0, 60 fps;
- licensed atlas local only;
- free ports, stop servers;
- one commit per item, with stick-figure before/after against the real frames.

## Acceptance
- **Back arm:** stills at matched phases (front and backside, a side-on camera) beside the Surf Ranch and backside frames. Elbow 100–130° in trim and turns, the hand in front of the body. The lead and then the user look at them.
- **Barrel rides:** in every barrel-style ride, the move sequence is takeoff → bottom → turn at the fold → stall → tube → exit (logged). The turn happens ahead of the cavity with no clipping (bodyclip and board clip 0 during the turn). Tube time 6 ft ≥ 3 s, 8 and 12 ft ≥ 4 s, head dry. A clip of a 6 ft Expert barrel ride from the default camera, looked at.
- **The rest:** the matrix of 18 cells with all gates 0; the default view and a 6 ft Expert barrel clip looked at; tsc, tests, build; t104 / t034 / t062 (T-135 known failures excepted).
