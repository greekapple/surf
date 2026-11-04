# 3D wave scene, round 4: a surfer who moves like a real one, barrels on bigger waves, then the wave and the beach
Status: **APPROVED** (user, 2026-11-04: "fix the issues you are referring to … but it's still just decent … the surfer is the main problem … make a spec for the old improvements and keep these in mind"). It continues docs/specs/2026-11-04-3d-real-surfing.md (the user's brief; stages 7–9 still open) and docs/3d/FINDINGS-2026-11-04.md (runs 1–3).

## What the user saw (Ocean Beach, Wed 8 AM, 11.5 ft face, Intermediate)
- **The movement still isn't fluid:** "the idea is there but it's not executed very well". It needs to improve drastically.
- **The knees look wrong:** "knees are literally touching each other" (2026-11-04, second look).
- **The arm goes up far too high before every turn; the arms are still wild.**
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
   - **HARD GATE (user, 2026-11-04: "knees are literally touching each other, which is extremely inaccurate"):**
     - the knee-to-knee distance is ≥ 60% of the foot-to-foot distance at all times (a surfer's knees are about shoulder width apart, over the feet);
     - each knee stays within ±10 cm (lateral, in the board plane) of the line from its hip to its foot;
     - the knees NEVER touch or cross.
     - Measured every frame by the glitch monitor (`knock` count); must be 0 in every matrix cell.
3. **Arms:**
   - no high arm raise before turns;
   - real surfers keep their arms low to mid, lead with the front arm pointing where they're going, the back arm low and behind;
   - turns are driven by the shoulders and hips;
   - arm motion is small and damped, never a raise-and-drop each turn.
   - **HARD GATE (user, 2026-11-04: "the arms are still wild"):**
     - wrists stay below shoulder height except: the front hand in a big snap (≤ 0.3 s), or the back hand dragging the face in a barrel stall;
     - hands stay inside a box ±70 cm sideways of the torso and between the knee and the shoulder height;
     - arm joint angular speed ≤ 360°/s, with no reversal faster than 0.25 s.
     - Measured by the glitch monitor (`arm` count, wrist-above-shoulder seconds per minute); 0 violations in every matrix cell.
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

---

## Appendix M: Motion specification (detailed; the bar every pose and transition is measured against)
Added 2026-11-04 at the user's request ("make anything more extensive or detailed"). Angles are in degrees.
- **Knee flexion:** 0 = straight leg.
- **Hip flexion:** 0 = standing upright.
- **Torso pitch:** forward lean from vertical.
- **Board frame:** x = nose direction, y = up off the deck, z = across (toe side +).
- Values are targets with tolerances, drawn from coaching references and frame studies. Fable refines them from its own reference sheet (docs/3d/MOTION-REFERENCE.md) and records any change with the source.

### M1. Base stance (every move starts from and returns to this)
- **Feet:**
  - back foot over the fins (about 15–20% of board length from the tail), front foot just ahead of centre;
  - stance width ≈ 0.85–1.0 × shoulder width (≈ 45–55 cm for a 1.75 m rider, scaled by height);
  - front foot angled 30–45° toward the nose, back foot 70–90° (across the board).
- **Knees:**
  - both bent, front 35–55°, back 45–70° in trim;
  - knees tracking over the 2nd–3rd toe (the IK pole points forward and slightly outward, never inward);
  - knee-to-knee distance ≥ 60% of foot-to-foot (HARD GATE, §A2).
  - The back knee angles slightly toward the front foot ("knee to knee" coaching cue means pointing, NOT touching).
- **Hips:**
  - flexed 20–35°, centred over the board's stringer between the feet;
  - weight about 55/45 back/front in trim.
- **Torso:**
  - pitch 10–25° forward, spine neutral (no slumping round back, no arched back);
  - shoulders roughly parallel to the board's direction in trim, chest open toward the wave on frontside.
- **Head:** level, eyes looking down the line ahead of the curl (yaw leads travel by 20–40°); vertical bob ≤ 3 cm per second.
- **Arms:**
  - relaxed, slightly bent at the elbow (20–40°);
  - hands between knee and chest height, ±50 cm to the side of the torso;
  - the front hand slightly forward over the front foot, the back hand slightly back over the tail.

### M2. Moves (key poses plus timing; transitions eased, no linear blends)

#### Takeoff / pop-up
- **Duration:** 0.6–1.0 s (beginner 1.2–1.6 s, with a visible knee-down step).
- **Ends in:** the base stance with deeper compression (knees 55–75°).
- **Arms:** come forward and down to balance, never above the shoulders.
- **Big waves (band C):** the drop has a compressed stance (knees 70–90°) and arms out low to the sides for balance.

#### Trim
- The base stance (M1).
- Small continuous fore/aft weight shifts (±5 cm, 0.5–1.5 Hz) and micro knee flex (±5°).
- Arms quiet.

#### Bottom turn (frontside)
- **Compress into it:** knees front 70–90°, back 80–100°; hips flexed 45–65°; torso pitch 25–40°.
- **Lean:** into the face up to the lean the speed and radius need (tan θ = v²/(g·r), capped 55°).
- **Head and shoulders:** they rotate toward the target on the lip ≈ 0.2 s before the hips.
- **Front arm:** points down the line, then up the face toward the target, at shoulder height or BELOW.
- **Back arm:** low behind the hip; the inside hand may skim the water on deep turns.
- **Duration:** 0.6–1.0 s; the deepest compression at the turn's apex.

#### Bottom turn (backside)
- Same compression.
- The rider's back faces the wave; the shoulders open toward the face, and the head looks over the leading shoulder.
- The front arm leads over the toe-side rail, the back hand low near the heel-side rail.

#### Top turn / snap
- **Extend** up the face (knees 30–45°).
- **Rotate:** the shoulders rotate first, the hips follow (≥ 0.15 s lag), and the back foot pushes the tail through.
- **Front arm:** sweeps from pointing up the face to pointing down the line. This is the ONE move where the front hand may rise briefly to about shoulder height (≤ 0.3 s).
- **Back arm:** stays low.
- **Duration:** 0.4–0.7 s; recompression (knees back to 50–65°) on the way down.

#### Cutback
- **Lower and wider than the top turn:** knees 50–70°.
- **Rotation:** the torso rotates 120–180° over 1.0–1.6 s, the head leading toward the curl.
- **Arms:** the front arm leads around at chest height, the back arm trails low.
- Rebound off the whitewater with a quick compress (0.2 s) and extend.

#### Pump
- A rhythmic compress/extend at 1.2–2 Hz: knees ±15° around 45°, hips ±10°.
- Weight shifting forward on the down-pump.
- Arms counter-move a little (≤ 10 cm).

#### Barrel stance (bands B upper / C, Intermediate+ only)
- **Frontside (facing the wave):**
  - a deep crouch, knees front 90–110°, back 100–120°, hips flexed 70–90°, torso pitched 35–55° and compact;
  - the back hand may drag the face to stall (≤ 1.5 s);
  - the head up, looking at the exit;
  - the front arm low and forward.
- **Backside (back to the wave), the pig-dog:**
  - the back knee drops low toward the deck (100–130°), the front knee 80–100°;
  - the leading hand grabs the toe-side rail; the back arm low.
- **Height:** in the tube, the rider fits under the lip (head ≥ 15 cm below the lip's inner surface at all times; the scene checks this).
- **Duration inside:** 0.8–3 s; exit ahead of the foam ball with a small extension.

#### Kick-out / exit
- Rising extension (knees 25–40°), then turning over the back of the wave, or straightening out (beginner).
- Arms relax down.

### M3. Transitions and fluidity
- **Blend time:** 0.25–0.6 s between moves, ending in the move's own rhythm. Use eased curves (no linear), and continuous velocity in every joint (no corners in the joint-angle curves).
- **Limits:** peak joint angular speed ≤ 360°/s (arms) and ≤ 300°/s (legs/torso); peak angular acceleration ≤ 3000°/s².
- **Chains:**
  - compression/extension travels hips → knees → ankles within 0.1 s, so the body moves as one unit;
  - rotation is head → shoulders → hips → board, each 0.05–0.15 s behind.
- **No frozen poses:** every key pose carries micro-motion (±2–5°) so nothing locks.
- **No repeated motion:** the same move twice in a row must vary by ≥ 10% in depth or timing (seeded), so it doesn't look canned.

### M4. Level and wave size (complexity table)

| | Small (< 4 ft) | Mid (4–6 ft) | Big (6–10 ft) | Very big (10 ft +) |
|---|---|---|---|---|
| **Beginner** | trim, gentle turns, upright (knees 30–45°), arms out wide but low | trim and one wide bottom turn, stays on the shoulder | angled takeoff, straight trim to the shoulder, kick-out early | same, very conservative; never in the pocket |
| **Intermediate** | flowing turns, mellow cutbacks | carves with real rail, top turns, pumps | deep bottom turns, top turns, a shallow cover-up | long lines, one barrel attempt from the shoulder |
| **Expert** | stylish carves and cutbacks, no aggressive snaps | snaps, roundhouse cutbacks, re-entries | at least one barrel ride per cycle, vertical turns | deep barrel, drawn-out bottom turns, a high fast line |

- The skill also sets the body: beginners are stiffer (×0.6 the compression range, wider stance, arms more out, slower reactions); experts are fully compressed and fluid.

### M5. Character and look
- **Proportions:** realistic adult, 1.75 m default, scaled to the user's height; athletic but not exaggerated.
- **Hair:** short, wet, swept back (or a natural short cut), clean against the scalp. No hard hairline edge, no bald band. The MPFB2 CC0 hair system or a modelled hair cap.
- **Wetsuit:** black full suit with subtle seams, satin roughness (not plastic), and a slightly wet sheen on the shoulders.
- **Skin:** slightly subsurface or warm; no plastic highlight.
- **Later (not now):** attire by water temperature (board shorts, spring suit, full suit, hooded suit).

### M6. Measurement (in the glitch monitor and the matrix report)
Per cell, all must hold:
- `knock` = 0;
- `arm` = 0;
- wrist-above-shoulder ≤ 0.3 s per snap and 0 otherwise (barrel hand-drag excepted);
- knee angles within each move's range ±10°;
- peak angular speed and acceleration within the M3 limits;
- the barrel check (head under the lip, rider inside the cavity ≥ 0.8 s) for cells with barrel rides.

Report a table of these per cell, before vs after.
