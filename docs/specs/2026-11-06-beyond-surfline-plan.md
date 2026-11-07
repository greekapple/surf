# Beyond Surfline: the next focus (plan, 2026-11-06)

Status: PROPOSED (waiting on the user's own ideas and the order). The 3D is paused (see the end).

## The goal
SWELLO's job (PRODUCT.md) is to say whether a specific break is worth paddling out, when it gets better, and why, with every number traceable and its uncertainty shown. Surfline answers "how big, region-wide, with a cam". SWELLO should win on three things Surfline does not do:
1. **Right for this break.**
2. **Honest about how right.**
3. **Personal.** Your skill, your boards, your sense of size.

## What already exists (built, not yet the product's headline)
- **The Call** (`services/call.ts`, T-064): one verdict per spot and hour, with its basis.
- **The rating** explains itself (`ratings/explain.ts`).
- **Nearshore heights:** a CDIP MOP point at all 45 spots (T-130), with the breaking rule where a profile is known.
- **Model spread** (`services/modelSpread.ts`, T-073): several wave models at one point.
- **Personal loop:** session log, "felt right?" taps, the forecast archive (what was predicted when you looked) and calibration (`sessionLog`, `feltRight`, `forecastArchive`, `calibration`). All local, never uploaded.
- **Board Match** from your own quiver (`recommendation/board.ts`, T-017).
- **The 3D size view** (paused, good enough for its job).

## Proposed work, in order
Each step is small enough for one round and is checked in the browser at 1440 and 390.

### 1. Right for this break: finish the spot-accuracy review (T-131)
At 14 spots, our estimate and MOP differ by more than 1 ft on average. Ocean Beach (−4.8 ft), Moss Landing (+4.0) and Jalama come first.
- **Work:** a sourced profile review per spot (exposure, the shoal or reef, tide behaviour), the transfer from offshore to the break, and the caveats on screen.
- **Done:** the mean difference is under 1 ft at every reviewed spot, or the gap is explained and labelled on the spot page.
- **Review:** data-honesty-reviewer.

### 2. Honest about how right: an accuracy scorecard
None of Surfline, MSW or Windy shows how often they were right (vault 15-Competitor-Teardown, "What SWELLO adds" #2).
- **Work:** per spot, compare what we predicted (the archive) with the nearest buoy, and with MOP's later analysis where it exists. Show the last 7 and 30 days: typical error, and whether we ran high or low.
- **Done:** every spot page shows a "How right we've been" line with real numbers and its source. No number where we have no data, and that is said plainly.

### 3. Personal: make the calibration visible
The loop is built but quiet.
- **Work:** after a few "felt right?" taps or logged sessions, the headline shows "calibrated to your N sessions here". Your calibrated range sits next to the model's, with one tap to see why it differs.
- **Done:** a new user sees the plain model; a user with logged sessions at a spot sees both, clearly labelled. Nothing is uploaded.

### 4. Personal: one answer, "go, when, on what"
- **Work:** combine the Call, the best windows and Board Match into the first thing on Home: "Go 7–9 am at Linda Mar, take the 7'2"" or "Skip today: onshore after 9".
- **Done:** on a phone, the first screen answers when to go and what to ride without scrolling, with the reason one tap away.

### Later (not in this round)
- Cams and AI surf analysis (vault 09-AI-Surf-Cameras).
- T-140 lineup and sets; T-141 wipeouts.
- The surfskate motion capture (below).

## The user's own ideas
The user has more ideas for standing out from Surfline (2026-11-06). Fold them in here before choosing the order.

## 3D: paused (user, 2026-11-06)
The 3D size view does its job: it shows the wave height against a surfer, at a readable size, riding believably.
- **Live, as of today:**
  - the real barrel ride;
  - the surf-photo framing;
  - the arm carriage;
  - the 12 ft board-clip fix (efa292b).
- **Motion work stops** until the user films the surfskate session (vault Surfskate-Capture-Shotlist). Then revisit with the `motion-real` pipeline.
- **Known leftovers, not chased:**
  - **The tube doesn't feel enclosed:** the lip passes well overhead, and the foam lands about 7 m behind the rider.
  - **Backside arms** improved less than frontside.
  - **The arms during the snap** still come from the keyed poses.
  - **The left calf at the takeoff** dips about 8 cm into the water at 6 ft and 12 ft Expert right (22–25 samples per 20 s; existed before efa292b).
  - **Faint reflections inside the tube**, and the hour change jumps instead of morphing.
