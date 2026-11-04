# 3D wave scene: look and move like real surfing (user brief, 2026-11-04)
Status: **APPROVED** (the user wrote and pasted this brief: "here is a specific extensive prompt for 3d improvement"). It starts after the current Fable round 3 work finishes ("after completing that"). The order is the brief's own priority list.

## Repo mapping (lead, checked before writing)
- **Scene:** `src/features/scale/WaveLive.tsx` (three.js).
  - The wave is a vertex-shader grid sampling a Blender-built break-cycle profile atlas (`waveAtlas.ts`; atlas built by `tools/blender/wave_atlas.py` from licensed TurboSquid rows, git-ignored, never pushed).
  - Surfer: `tools/blender/build_surfer.py` → `tools/blender/assets/surfer-v3.glb` (CC0 MPFB2, 24 bones, clips `ride` and `still`).
  - The round-3 ride line, follow camera and rider dev interface are in `WaveLive.tsx`.
- **Inputs available:**
  - face height: `WaveSpec.faceM`, the estimate's centre, shown as "drawn at X ft face";
  - the user's height (`surferM`);
  - **expertise: `UserProfile.skill` = 'Beginner' | 'Intermediate' | 'Expert'** (it exists, so use those three levels);
  - breaker type, swell period (`periodS`), wind relation and speed, peel direction (left/right), the hour's lighting.
  - Forecast records also carry primary/secondary swell direction and period, and tide height/stage, for sets and tide.
- **Missing:** stance (regular/goofy) isn't in the profile. Use a seeded default per spot-hour, and add a profile field only if the user approves (ask; don't invent a setting silently).
- **Data honesty:**
  - labels stay ("Est. … · drawn at X ft face · you …", "3D illustration of this forecast hour · approximate");
  - riding style, stance and moves are illustration, never implied by the forecast; only the face height, breaker type, period, wind, direction and light come from the forecast.
- **Existing QA:**
  - toolkit `t102-ride.mjs` (rider gates), `t104-noboard.mjs`, `t062-live.mjs`;
  - the dev hook `window.__wave` (`setWave`, `rider`, `probe`, `setBoard`, `surfer`).
  - The new glitch monitor, dev panel and scale pole extend these.
- **Repo rules that also apply:**
  - the repo is PUBLIC: licensed atlas/fbx never staged or pushed; publish only via `tools/review/port-to-clean.sh` + `swello-v0.17`;
  - merge via the lead's gate;
  - Codex once per merge.

## Owner and level
**Fable**, on the stage plan below, one stage per branch/merge. **Level 3**, so the findings note comes first (brief §Ground rules). The lead gates each stage, and a fresh Fable critic reviews before the riding-style and wave stages merge. Engineering extends the toolkit checks (glitch monitor capture, matrix capture script).

## The brief (verbatim from the user)

# Task: Make the SURF 3D wave scene look and move like real surfing

## Context
You're working on the 3D "forecast hour" illustration in SURF, our premium surf forecasting app. It's the card with the overlay "Est. 4–6 ft · drawn at 5 ft face · you 5'10" (default)", a "Lighting for <day> <time>" badge, and the caption "3D illustration of this forecast hour · approximate". It shows one wave and one surfer on an orbitable camera.

The bar is a premium consumer product. When a surfer looks at this card, it should instantly read as "that's what the session will look like." Right now it reads as a tech demo:

- The surfer's movement is glitchy and unrealistic.
- There's no coastline, so it looks like open ocean.
- The wave doesn't behave like a real breaking wave.

Priorities, in order:
1. **Surfer movement: glitchiness and realism.** This is the most urgent fix, and nothing else ships until it's solid.
2. **Riding style by wave height and the surfer's expertise level.**
3. **Beach / coastline.**
4. **Wave and ocean mechanics and look.**

---

## Ground rules
- **Investigate before changing anything.** Read the scene code end to end: wave generation (geometry or shader), the breaking/whitewater system, the surfer rig and animation, the board, the camera, lighting, and the data plumbing. Find where face height, user height, expertise level, and any swell period, swell direction, wind or tide values come from.
- **Write up what you find before implementing.** Put a short findings note in the PR or a `docs/` markdown file covering:
  - how the scene is built today;
  - what's causing the glitching (name the actual cause, don't guess);
  - your plan for each stage.
- **Build on what's there.** Don't rewrite the renderer, swap engines, or bring in a heavy physics engine unless you can show the current architecture can't do the job. If you think it can't, stop and explain why before doing it.
- **Preserve what works:**
  - the overlay labels;
  - the forecast-driven lighting;
  - scaling the surfer to the user's height;
  - the orbit camera;
  - the "approximate" framing.
- **Git:**
  - small, clean stages, with one or more commits per stage and clear messages;
  - don't squash, force-push or rewrite history;
  - work on a feature branch.
- **Config:** put every tunable in one config module (e.g. `surfSceneConfig`), never magic numbers in animation code. That includes height thresholds, spring constants, style profiles, board dimensions, peel rates and foam lifetimes.
- **Performance:**
  - hold 60 fps on a mid-range laptop and 30–60 fps on a recent phone;
  - make anything expensive (particles, extra swell lines, coastline detail) a quality tier that scales down, never something silently dropped;
  - no per-frame allocations in the animation loop.
- **Determinism:** for a given forecast hour plus user settings, the scene plays the same ride every time. Seed any randomness from the forecast hour ID so it's reproducible and debuggable.

---

## 1. Fix the glitchy surfer (do this first)

### What's wrong now (seen in a screen recording, frame by frame)
- **Pose popping.** Between consecutive frames:
  - arms jump to completely different positions;
  - the torso snaps;
  - the board's yaw flips back and forth.

  It looks like poses switch between discrete keyframes with no blending, or there's per-frame random noise on the joints. Find out which.
- **Physically wrong poses:**
  - leaning far back like he's about to fall off the tail;
  - nearly lying flat on the board while "riding";
  - a hand trailing in odd places;
  - arms flailing in random, unrelated directions.

  Nothing is counter-balancing anything.
- **The board doesn't sit on the water:**
  - it sometimes floats above or behind the crest, or clips into the face;
  - its pitch and roll don't match the slope it's on.
- **The surfer drifts onto the back or top of the wave** instead of riding the face.
- **No sense of a line.** The path along the wave doesn't relate to where the wave is breaking.

### Target architecture
Use three layers, each smooth on its own:

**Layer A: Line planner (where the surfer goes)**
- The ride is a time-parameterized path on the wave face. Express it in **wave-relative coordinates**:
  - `u` = distance along the crest relative to the moving curl/breaking point;
  - `v` = height on the face from trough (0) to lip (1).
- Represent the path as a smooth spline built from **maneuver segments**: takeoff → bottom turn → top turn → trim → cutback → … Each segment type has a parametric shape (entry/exit `v`, turn radius, duration).
- The planner keeps the surfer in the right relation to the curl for their style and skill: close to the pocket for experts, out on the shoulder for beginners.
- **Speed must make sense:**
  - down-the-line speed has to keep up with the peel speed, or the surfer gets caught by the whitewater;
  - typical surfer speeds are roughly 5–10 m/s on small to mid waves and 10–20 m/s on big waves;
  - speed is gained in bottom turns and pumps and lost in top turns, stalls and cutbacks.

**Layer B: Board (driven by the water)**
- Every frame, place the board using the **same height and normal function that renders the wave surface**. Use the exact function or shader math mirrored on the CPU, not an approximation or a separate collider.
- **Orientation:**
  - pitch and roll follow the surface normal;
  - add rail roll into turns, from speed and turn radius (the bank angle a carve really needs);
  - yaw follows the velocity direction.
- Smooth the board's orientation with a spring.
- **Never** let the board leave the water except in a deliberate move like a floater, where it rides the foam. Never let it clip into the face.

**Layer C: Body (procedural, balanced)**
- **Feet:** locked to the deck with IK; set foot positions by stance width.
- **Stance:** support **regular** (left foot forward) and **goofy** (right foot forward). Pick one from the user profile if it exists, otherwise a seeded default.
- **Frontside vs backside:** work it out from stance plus wave direction (left or right). The surfer's chest faces the wave on frontside and their back faces it on backside. This changes every pose, so get it right.
- **Center of mass:** keep it over the board.
  - Lean angle comes from turn radius and speed (`tan θ ≈ v² / (g·r)`), so real carves get real lean and trimming stays upright.
  - Fore/aft weight shifts drive acceleration (forward) and stalls (back).
- **Compression and extension:**
  - knees and hips compress going into a bottom turn and extend coming out of it;
  - legs absorb chop;
  - compress before a top turn, extend through it.
- **Upper body:**
  - head and eyes lead every turn, looking where the surfer is going next;
  - shoulders rotate before the hips (upper body leads, lower body follows);
  - arms counter-balance and point the way: the leading arm points down the line in bottom turns, and the back arm drags or touches the face in tight frontside turns and barrel stalls.
- **Idle motion:** small, continuous micro-adjustments (low-frequency noise on balance), never per-frame jitter.

### Smoothing and stability rules
- Blend all pose, orientation and position targets with **critically damped springs** (or equivalent eased interpolation). Tune the stiffness per joint group: core is stiff, arms are looser, head is quick.
- Run motion on a **fixed timestep** (e.g. 120 Hz sim with interpolated render) so frame-rate hitches don't change the motion.
- Remove all per-frame randomness. Any variation must be low-frequency and continuous.
- Cross-fade between maneuvers over 150–400 ms depending on the move. No hard cuts.
- Clamp joints to human ranges of motion. No knees bending backwards and no spine past what's anatomically possible.

### Glitch guard (must have)
- Add a dev-only monitor. Each frame it measures the angular change of every joint and of the board, plus the board's distance from the water surface.
- If a jump exceeds a threshold (e.g. more than 25° per frame on any joint) or the board leaves or clips into the water by more than a few cm, it logs a warning with:
  - the maneuver name;
  - the timestamp;
  - the joint involved.
- With this monitor running, a full ride at every band and skill level should produce zero warnings.

---

## 2. Riding style by wave height and expertise

### Inputs
- **Face height:** use the "drawn at X ft face" value as the driver, not the forecast range.
- **Expertise:** find where the app stores the user's expertise or skill level and use those exact levels. **If no expertise setting exists yet, stop and tell me** rather than inventing one.
- **Stance:** regular or goofy, if the profile has it.
- **Quiver or board data:** if the app has it, use it to pick the board model and size.

### Wave-height bands
Thresholds go in config. Each forecast hour picks one band. If a value lands within ±0.5 ft of a threshold, pick deterministically (e.g. use the rounded value) so it never flickers between styles.

#### Band A: under 4 ft. Chill, flowing.
- **Feel:** relaxed, unhurried, playful; style over power.
- **Stance:** upright, knees softly bent, arms low and quiet, little upper-body twist.
- **Line:** trims mid-to-high on the face; light pumping only to make flat sections.
- **Move set:**
  - long, drawn-out bottom turn;
  - soft, open-face carves;
  - mellow cutbacks;
  - occasional floater across a closeout section;
  - kick-out or straighten out at the end.
- **Board:** a shorter, wider groveler/fish (about 5'4"–5'10" for a 5'10" rider) with low rocker. If the quiver says longboard, the rider can trim and do a cross-step instead.
- **Spray:** minimal, at most a light fan on cutbacks.

#### Band B: 4–9 ft. Aggressive shortboard carving.
- **Feel:** fast, compressed, committed, powerful.
- **Stance:** low center of gravity, deep knee bend, active arms.
- **Line:** goes vertical, using the whole face from trough to lip, and stays close to the pocket for skilled surfers.
- **Move set:**
  - **Bottom turn:** deep compression with the rail buried and the leading arm pointing up at the lip; the hardest-loaded moment of the ride.
  - **Top turn / snap:** project up the face, release the tail at the lip and throw a fan of spray, then redirect back down.
  - **Roundhouse cutback:** full-rail arc back toward the curl, rebound off the whitewater, and turn back down the line.
  - **Re-entry / layback snap** for experts on steep sections.
  - **Pumping:** rhythmic compress/extend through flat sections to keep speed.
- **Board:** performance shortboard about 5'10"–6'2" for a 5'10" rider; step up toward 6'4"–6'6" at the top of the band.
- **Spray:** strong fans off the tail on snaps and cutbacks, scaled by speed and how hard the turn is. Spray particles need gravity and a short lifetime.

#### Band C: 10 ft and up. Big-wave: barrels and straight lines.
- **Feel:** survival plus precision. Few, deliberate moves. Speed and line choice matter most.
- **Stance:** low and centered, arms wide for balance on the drop, weight forward for speed.
- **Line:**
  - late, steep takeoff with a big drop;
  - deep, drawn-out bottom turn at the base;
  - then **high, straight-ish lines** across the face with the rail set, running ahead of the whitewater.
- **Move set:**
  - **Takeoff and drop:** the board pitches steeply and chatter or air under the board is allowed for a split second, but it stays connected.
  - **Bottom turn:** long radius, heavy load.
  - **Barrel:** when the section ahead stands up and pitches, stall (back hand dragging in the face, weight shifted back) to let the lip throw over. Then crouch low with the body tucked to fit the tube, hold a high line inside, and come out ahead of the foam ball with spray blowing out.
  - **Straight-line run:** when there's no barrel, a long, fast, high trim line out to the shoulder.
- **Board:** step-up to gun, roughly 6'8"–7'6" at 10–15 ft faces and 8'–10' beyond that; narrow with a pulled-in tail.
- **Very large waves:** above roughly 25–30 ft faces, keep it to drop → bottom turn → straight line. No playful moves.

### Expertise layer
Expertise filters and scales the band's move set:

| Level | Stance and body | Position | Allowed moves | Execution |
|---|---|---|---|---|
| Beginner | Wide and stiff, arms out for balance, little compression, slower reactions | Out on the shoulder, well away from the curl | Simplest moves only: angled takeoff, one wide bottom turn, straight trim. Never barrels or snaps. | Small lean angles, slow transitions, a little wobble (low-frequency) |
| Intermediate | Athletic, moderate compression | Mid-face, a moderate distance from the pocket | Most of the band's moves at reduced intensity. Barrels only in Band C, and only the shallow ones. | Medium lean, clean but conservative |
| Advanced / Expert | Low, loose, fluid; full compression and extension | Tight in the pocket | The band's full move set | Deep lean, sharp redirects, smooth links between moves |

Use the app's real levels and map them onto this.

**Mismatches:**
- A beginner on a 12 ft wave rides very conservatively (angled takeoff, straight line to the shoulder) and is never shown pulling into a barrel.
- An expert on 2 ft plays it stylishly, not aggressively.

### Implementation shape
- Represent style as **data**. Each band has a style profile: allowed maneuvers with weights, preferred line height `v`, pocket distance, aggression, compression depth, arm style, stance width, board model, spray intensity.
- Expertise is a second profile that **filters and scales** the first. The planner draws a ride from the result, seeded by the forecast hour.
- Don't scatter `if (height > x)` branches through the animation code.
- Add a dev panel or URL params to force face height, expertise, stance, wave direction (left/right) and seed. That's needed for tuning and for the verification step.

---

## 3. Add the beach / coastline

### Problem
Every direction is endless open ocean to the horizon, so the wave looks like a swell line in deep water instead of a wave breaking over a sandbar or reef.

### What to build
- **Shoreline in the direction the wave is travelling:**
  - a sand beach with a believable slope;
  - a darker, reflective wet-sand band;
  - small shore-break and swash running up and back down the sand.
- **Coastal backdrop:**
  - low dunes, bluffs or a headland silhouette behind the beach, softened by atmospheric haze that matches the forecast lighting;
  - keep it low-poly or impostor-based so it's cheap;
  - a soft distant headland along one side helps frame the break.
- **The water between the break and the beach:**
  - foam lines and reformed whitewater rolling shoreward;
  - lighter, more turquoise or teal shading as the water gets shallower;
  - visible sand-colored bottom tint in the shallows.
- **Bathymetry:** the scene should imply a sandbar or reef where the wave breaks. Water outside the break is darker and deeper, and water inside is lighter and churned up.
- **Camera:** when the user orbits toward shore, it clearly reads as a beach break. Toward the horizon it still reads as open ocean.
- **Distance:** keep the beach far enough away that it frames the scene without crowding the wave. Make it visible but secondary.
- **Extensibility:** build the coastline from a **preset** (beach break, point break, reef break) so each spot can supply its own later. Ship the beach-break preset now.

---

## 4. Wave and ocean mechanics: obvious problems to fix

### Wave shape
- **Problem:** the wave is one infinitely long, uniform extruded tube with the same cross-section everywhere.
- **Fix:**
  - give the wave a **peak** that tapers into a **shoulder**, with height varying along the crest;
  - have the face steepen and get hollower closer to the breaking point;
  - make the crest line slightly curved, not ruler-straight;
  - add an end to the wave: it fades out into the shoulder rather than going on forever.
- Break type should follow the band:
  - Band A: softer, crumbly spilling breaks;
  - Band B: steeper, partly plunging, with a throwing lip at sections;
  - Band C: heavy plunging with a thick lip and a real tube.

### Breaking and peeling
- **Problem:** the breaking part is a small white blob at one end and doesn't move like a peeling wave.
- **Fix:**
  - the break should **peel** progressively down the line;
  - the lip pitches forward and curls over to form a tube on steeper waves;
  - the curl point advances at a peel speed suited to wave size and break type (roughly 3–15 m/s; faster for hollow, big waves);
  - the surfer's line stays tied to it.
- Waves break in shallow water when wave height is roughly 0.8× the water depth. Use that as a sanity check against the bathymetry implied in section 3.
- **The lip:** it should have **thickness** that grows with wave size, more for Band C. It should throw out and down, and give off spray where it hits the flats.

### Whitewater and foam
- **Problem:** whitewater pops in suddenly and looks like a flat, translucent decal or a paddle-shaped patch.
- **Fix:**
  - whitewater has **volume**: a churning foam ball at the curl and a rolling white mass behind it that keeps moving shoreward and slowly fades into foam;
  - foam textures that move and break up, plus spray and mist kicked up where the lip lands;
  - everything **grows continuously**. Nothing appears in a single frame.
- Leftover foam patches and streaks drift on the surface after the wave passes and dissolve over several seconds.

### Water in front of and behind the wave
- **Problem:** no trough or draw-down, and the flat water in front looks identical to the water behind.
- **Fix:**
  - water visibly **draws up the face** in front of the breaking wave;
  - add a trough at the base of the face;
  - water ahead of the wave (shoreward) shows foam remnants from earlier waves;
  - water behind (seaward) is cleaner and darker.

### Sets and swell
- **Problem:** a single wave on an otherwise empty sea.
- **Fix:**
  - add the **next swell lines of the set** coming in from behind;
  - space them to match the forecast **swell period** if the scene has it (deep-water wavelength ≈ 1.56 × T² meters);
  - align them to swell direction if it's available.
- Lines further out are lower and unbroken, and they build as they reach the sandbar.

### Scale
- **Problem:** at a "5 ft face" with a 5'10" rider, the surfer often stands taller than the wave.
- **Fix:**
  - a 5 ft face should be about chest-to-head high on a standing adult and clearly taller than the surfer's crouched riding height;
  - check that face height in world units really matches the label: trough to crest of the face, in feet, at the surfer's scale;
  - add a dev-only scale reference (a 6 ft pole you can toggle on) to confirm it.

### Board wake and spray
- **Problem:** the board leaves a long, straight, hard white line that runs down the face and across the flats, like a jet ski.
- **Fix:**
  - short spray off the rail and a thin foam trail that **disperses within 1–2 seconds**;
  - more spray coming off turns;
  - the trail follows the actual curved path and fades along its length.

### Open-ocean surface
- **Problem:** the surface looks streaky and smeared, like heavy motion blur.
- **Fix:**
  - a proper multi-octave surface (e.g. summed Gerstner waves or an FFT ocean) with crisp small chop;
  - chop direction and strength follow forecast **wind** if available: offshore gives clean faces and spray blowing back off the lip, onshore gives choppy, crumbly faces;
  - remove any blur or smearing that isn't true camera motion blur.

### Wave face look
- **Problem:** the face is a uniform glossy green with no detail.
- **Fix:**
  - **light coming through** the thin water near the lip, so the lip glows green or teal when backlit by the forecast sun;
  - **surface texture** on the face: micro-ripples, plus foam streaks being drawn up the face;
  - a darker, deeper color low on the face;
  - believable reflection with Fresnel, matched to the sky.

### Tide (optional, if data exists)
If tide is available, adjust how far up the beach the shoreline sits and the break intensity a little (low tide hollower, high tide softer).

---

## Suggested stage and commit plan
1. Findings note and debug tooling: dev panel, glitch monitor, scale pole.
2. Board placed by the water's height/normal function; remove all the popping; springs and fixed timestep.
3. Procedural body: IK feet, balance, compression, frontside/backside, stance.
4. Line planner in wave-relative coordinates, tied to the moving curl.
5. Style profiles (bands A/B/C) and the expertise layer; maneuver library.
6. Spray and board wake.
7. Coastline preset (beach break), bathymetry shading, shore-break.
8. Wave shape: peak/shoulder, peeling, lip, whitewater volume, draw-down.
9. Sets and swell lines, ocean surface, wind-driven chop, face shading.
10. Performance pass and quality tiers.

Each stage should leave the app working. If a stage turns out much bigger than expected, split it and tell me.

---

## Verification (required before calling it done)
1. **Matrix captures:** record short clips (or frame strips) at **2 ft, 6 ft, 12 ft and 20 ft** faces × **every expertise level** × **left and right** waves × **regular and goofy**. Look at them yourself, compare against how real surfing looks, and fix what's off. Then send me a contact sheet plus a few representative clips.
2. **Frame-by-frame check:** step through at least 5 seconds per band. The glitch monitor must stay silent: no pose pops, no board floating or clipping.
3. **Camera:** orbit all the way around at each band and check:
   - no clipping through the wave or the surfer;
   - the beach is visible toward shore;
   - the horizon still reads as open ocean;
   - the coastline isn't distracting.
4. **Scale:** turn on the scale pole and confirm face height matches the label at every band.
5. **Peel vs surfer:** confirm the surfer never gets accidentally overtaken by the whitewater except in a deliberate beginner straight-out at the end of a ride.
6. **Performance:**
   - measure fps on desktop and a mobile-sized viewport with CPU throttling;
   - report the numbers;
   - check that quality tiers kick in.
7. **Regression:** the overlay labels, lighting badge, user-height scaling, and the forecast-hour switching all still work. Switching hours rebuilds the scene cleanly with no leaks (check memory over 20 hour switches).

## When you're done, report back with
- what changed in each stage, with commit hashes;
- the actual root cause of the original glitching;
- any assumptions you made: missing data such as stance or swell period, or thresholds you chose;
- anything that still looks off and what you'd do next;
- the capture contact sheet.
