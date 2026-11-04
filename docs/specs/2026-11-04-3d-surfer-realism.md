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

### M7. Back/torso rotation must not throw the arms (user, 2026-11-04: "the back still turns, making the arm do weird things")
- **The fault:** the torso/spine rotation is applied and the arms are carried along with it (or a counter-rotation is layered on top), so each turn swings an arm up and around.
- **Rule:** arm targets are set in the **board/world frame**, not inherited from the spine. When the torso rotates, the shoulders turn but the hands stay near their M1/M2 positions (an IK or aim constraint on each hand), so the arm only moves as much as the move itself asks for.
- **Limits:**
  - total spine twist ≤ 35° in trim and pumps, ≤ 60° in bottom turns, ≤ 90° only in cutbacks and snaps;
  - spread over the lumbar and thoracic bones (no single bone > 20°);
  - eased in and out over ≥ 0.25 s.
- **Check:** with the torso rotating through a full cutback, the hand's distance from its target stays ≤ 25 cm, and the wrist stays below the shoulder (except the snap window).

### M8. Different waves, different riding (user, again: "not very realistic for a surfer to do the exact same movements on different sized waves")
- The M4 table is a REQUIREMENT, not a guide. Measure it: each matrix cell reports its move sequence, and cells in different size bands must differ in moves AND in body (compression depth, spine twist, turn radius, speed).
- **Small waves (< 4 ft):** at most 3 move types per ride (trim, gentle bottom turn, mellow top turn or cutback), shallow compression (knees ≤ 55°), small twist (≤ 35°), soft rhythm.
- **Mid and big waves:** the full repertoire, with depth growing with size.
- **Barrels:** at faces > 6 ft, at least one ride per cycle is a barrel ride (M2 barrel stance + S1 tube), Intermediate and up; beginners never. Reported per cell (barrel time inside the cavity ≥ 0.8 s).

### M9. No leaning back (user, 2026-11-04 ~23:10: "the model leans his head and back BACK, which in turn messes with the arms; it should just move like a real surfer")
- **Rule:** the torso never pitches backward past vertical relative to the board's up axis, except the brief layback snap (Expert, ≤ 0.4 s, not in this round).
  - Torso pitch (forward lean from the deck normal) stays within +5° … +45° in every move; trim 10–25°, bottom turn 25–40°.
  - The head stays over or ahead of the hips, never behind them; head pitch is level to slightly down, looking down the line.
- **Root cause to check first:** a body-lean or angulation term (lean into the face, the backside counter, the leg IK pulling the pelvis back, or the hip-height keeping) is rotating the whole upper body backward, and the arms (hand targets in the board frame, M7) then stretch to reach.
  - Fix the torso first. Arms follow naturally once the torso is forward.
- **Gate:** a new monitor count `lean` (torso pitch < +5° or head behind the hips) = 0 in every cell.

### M10. The wake/contrail comes off the TAIL and trails BEHIND the board (user, 2026-11-04: "the contrail of the surfer is also going the wrong way off the board")
- The wake must start at the tail (the fins) and stream backward along the path already travelled, i.e. opposite the board's velocity over the water.
  - It must never appear ahead of the nose or go off sideways in the travel direction.
- **Check:** the sign of (wake point − tail) · board velocity is negative for all wake samples (a monitor count `wake` = 0). Clip from the side and from behind.
- **Likely cause:** the ribbon re-seats samples at x − flow·t (run 3) while the rider moves with the peel, or uses the board's nose/axis sign for a right/left mirror.

### Later (user, same message)
- Barrel riding will need more work, but that's for later; don't prioritise it over M9/M10 and the arms.

---

## Appendix S: Setting the scene so it looks real (the wave, the waves around it, the beach)
Added 2026-11-04 (user: "clarify the earlier fixes … the beach in the background, waves behind the wave or in front, setting the scene to look real"). It expands §B and §C and the open stages 7–9 of the original brief (docs/specs/2026-11-04-3d-real-surfing.md). Order: §A surfer first, then S1 (needed for barrels), then S2–S6. Each stage leaves the scene working, at 60 fps.

### S1. The wave itself (stage 8)
- **Shape along the crest:**
  - a **peak** that tapers into a **shoulder** on the open side and ends into the foam on the broken side, not one endless uniform tube;
  - crest height varies ±10–20% along the line;
  - the crest is gently curved toward the beach (refraction), not ruler-straight;
  - the wave fades out at its far ends instead of running off-screen at full height.
- **Breaking by type** (from the forecast breaker type and the band):
  - **Spilling (small / band A):** the crest crumbles from the top, white water spilling down the face, no tube.
  - **Plunging (band B):** a steep face, the lip throwing at sections, short cover-ups.
  - **Heavy plunging (band C, 10 ft+):** a thick lip throwing out and down onto the flats, with a full **tube**: a hollow cavity readable from the side, wide enough for a crouched rider (≥ 1.3 × the rider's crouched height at the exit) and spitting mist out of the end.
- **Peeling:**
  - the curl point advances down the line continuously at a size-appropriate speed (3–6 m/s small, 6–10 m/s mid, 10–15 m/s big/hollow);
  - the surfer's line stays tied to it (already true since run 1);
  - the scale label stays honest: the face height at the rider's position matches "drawn at X ft face" within 10% (fix the run-2 shoulder taper so the pole reads right, or draw the label's height at the peak and say so).
- **Lip:** thickness grows with size (about 0.1 × face at band A, 0.2 × face at band C), translucent green where it's thin and backlit by the forecast sun, feathering spray off the top when the wind is offshore.
- **Whitewater:**
  - a churning **foam ball** at the curl with real volume (not a flat decal), a rolling white mass behind it that keeps moving shoreward;
  - everything grows continuously, nothing pops in a frame;
  - mist and spray where the lip lands.

### S2. Water in front of and behind the wave
- **In front (between the wave and the beach):**
  - a visible trough at the base of the face, with water drawing up the face ahead of the curl;
  - leftover foam lines, streaks and reformed whitewater from earlier waves drifting toward the beach and dissolving over 10–30 s;
  - lighter, more turquoise colour as the water gets shallower (the sandbar), with a sand tint through the water in the shallowest band.
- **Behind (out to sea):** cleaner, darker, deeper-blue water; no foam except the occasional whitecap when the wind is strong.
- **Bathymetry implied:** the wave breaks over a sandbar (beach break preset); the colour change and the line where waves start breaking show where it is.

### S3. Waves behind (the set) and in front (the last wave)
- **Behind:**
  - the next 2–4 swell lines of the set coming in, spaced by the forecast swell period (wavelength ≈ 1.56 × T² m in deep water, shorter as they reach the bar);
  - aligned to the forecast swell direction;
  - lower and unbroken far out, building as they approach the sandbar;
  - one per cycle becomes the next ridden wave, so the loop is continuous and believable.
- **In front:** the previous wave as whitewater rolling toward the beach (a reformed white line), shrinking as it reaches the shore-break.
- **A secondary swell** (when the forecast has one): a fainter cross-pattern of lines from its own direction.
- **Lulls:** occasional calm between sets (seeded), so it isn't a metronome.

### S4. The beach (stage 7, beach-break preset now; point and reef presets later per spot)
- **Shoreline** in the direction the waves travel, far enough away to frame the scene without crowding the wave (visible but secondary: about 150–400 m behind the break at default zoom).
- **Sand:**
  - a dry pale band, a darker reflective **wet-sand** band, and the swash line where thin sheets of water run up and slide back (animated);
  - small shore-break waves dumping on the sand.
- **Backdrop:**
  - low dunes or bluffs behind the beach, softened by haze matched to the forecast lighting;
  - a soft headland silhouette along one side to frame the break;
  - low-poly or impostor so it's cheap.
- **For Ocean Beach SF specifically** (when a spot-preset system exists): long straight beach, a low seawall/dunes, Sutro Heights headland to the north. Not now; the generic beach-break preset first.
- **Camera:** orbiting toward the shore must clearly read as a beach break; toward the horizon it must still read as open ocean; no clipping through the beach or the dunes.

### S5. Ocean surface, wind and light
- **Surface:** a multi-octave surface (summed Gerstner or FFT) with crisp small chop; no smearing.
- **Wind-driven** (from the forecast wind relation and speed):
  - **offshore:** clean glassy faces and spray blowing back off the lip;
  - **onshore:** choppy, crumbly faces and whitecaps out the back;
  - **cross-shore:** chop at an angle.
- **Light** (keep the forecast lighting):
  - the lip glows green/teal when backlit;
  - a darker, deeper colour low on the face;
  - Fresnel reflection matched to the sky;
  - sun glint on the water;
  - haze toward the horizon.
- **Tide** (optional, data exists): low tide moves the shoreline out and makes the wave hollower; high tide moves it in and softer.

### S6. Performance and honesty
- **Quality tiers:** set lines, foam detail, beach detail and spray scale down on phones; never silently dropped. 60 fps desktop, ≥ 30 fps on a recent phone, no per-frame allocations.
- **Labels:** "3D illustration of this forecast hour · approximate" stays. The beach and set count are illustrative; only the face height, breaker type, period, swell direction, wind and light come from the forecast.

### Verification for Appendix S
- **Orbit stills** at each band (2, 6, 12, 20 ft): toward shore (the beach reads clearly), toward the horizon (open ocean), side-on (the tube at band C, the face and lip), and from behind the wave (the set lines coming in).
- **Side by side** with real photos (refs-drone, refs/ob-*) and the True Surf frames (refs-motion) at matching angles.
- **Measurements:**
  - the set spacing matches 1.56 × T² within 15% in deep water;
  - the tube cavity fits the crouched rider at band C;
  - the face height at the rider matches the label within 10%;
  - no grey or empty sky band; no clipping during a full orbit;
  - real-GPU fps per band.
