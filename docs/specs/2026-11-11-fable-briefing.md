# Briefing for Fable: make SWELLO the best surf forecast there is (for Wednesday 2026-11-11)

You are taking over the SWELLO repo for one focused session. Read this whole brief, then `CLAUDE.md`, `PRODUCT.md`, `docs/agents/README.md` and `docs/agents/CONTRACTS.md` before touching anything.

The user's bar: **"exponentially better than Surfline"**. Their focus order:
1. spot accuracy;
2. an honest scorecard of how right we've been;
3. calibration to the surfer;
4. the go / when / which-board answer;
5. the 3D size view and the quiver, which are the differentiators.

## How to run
- **Session:** work in this repo as a Claude Code session on the Fable model. Use a worktree branch from `forecast-trust` (`git worktree add .claude/worktrees/fable fable-wed forecast-trust`), not a copy of the website: the tests, the private 3D assets and the browser toolkit only exist here.
- **Node via fnm:** `zsh -lic 'cd <worktree> && …'`.
- **Dev server:** `npm run dev -- --port 5186 --strictPort`. 5180 is the lead's and 5184 is product's.
- **Browser checks:** `~/Development/ai-system-setup/playwright-toolkit/swello/` (journeys, t043, t062, t104, t034, clock-deselect, point-panel-390, t091 perf).
- **Help:** two other sessions run next to you, `eng-term` and `product-term`. Hand them well-scoped pieces with SendMessage if useful. Opus subagents are fine for research and review; Fable credits are for the hard parts.

## Non-negotiables (break one and the work is reverted)
1. **Never fake data or labels.** Every number shown comes from a named source, or the app says it doesn't know. Read the data-honesty rules in PRODUCT.md and CONTRACTS.md. Run the `data-honesty-reviewer` after any change to numbers, labels, ratings, charts, sources or copy, with one correction cycle.
2. **The repo is public.** Never commit licensed or derived assets: the TurboSquid wave meshes, `public/media/scale3d-live/*.glb`, the scale3d atlases, `*.fbx`, footage, MotionBERT weights. They stay git-ignored and local.
3. **No production deploy without the user's explicit OK in chat.** Hand back a gated branch; the lead deploys.
4. **No secrets** in any file, note or log. Never read or touch the vault's `99-Private/`.
5. **Git hygiene:**
   - never `git branch -D` or force-push;
   - one commit per change;
   - each commit message ends `Co-Authored-By:` with your model line.
6. **"Done" means seen working:**
   - tsc, `npm test` and `npm run build` pass;
   - journeys 8/8 and the toolkit checks for the area you touched pass;
   - you looked at the 1440 and 390 screenshots against the references in `docs/design/`.

## Where the app is (2026-11-09, live version 60a46f96)
- **492 spots:**
  - California, Oregon and Washington: 102;
  - Hawaii: 152;
  - the US East Coast: 238.

  Each has sourced positions, facing and guide facts; a tide station chosen by a reviewed open-coast rule; NWS alerts; shore wind where a station is close; and buoys shown with their distance.
- **Per-spot local time:** the clocks follow the spot in view. The map has a deselect state.
- **Hot/cold refresh:** the server refreshes only spots viewed in the last 24 h, so cost stays flat as the catalogue grows.
- **World catalogue (not in the app yet):** 5,220 sourced spots in `docs/forecast/data/world-spots/`, with a vault note for each.
- **In progress this round:** `docs/specs/2026-11-09-round-3.md`. Check what has merged before you start, so you don't redo it:
  - phone map speed;
  - landscape tap and Home zone tags;
  - the Hawaii tide leftovers;
  - a split-swell rating audit;
  - Australia groundwork.

## Tracks, in order (finish and hand back each before starting the next)

### Track 1: the 3D wave-to-surfer view (`src/features/scale/WaveLive.tsx`, `rideSim.ts`, `riderBody.ts`, `boardObject.ts`, `peelDirection.ts`)
**What it is for:** the user sees today's forecast wave at true size next to a surfer of their own height, on a board from their own quiver, riding believably. It's a size comparison first, and a ride second.

**Status:**
- **Live:**
  - the real barrel ride (lip over the head 2.1–2.2 s at 6 and 8 ft);
  - surf-photo framing (fov 32, rider about 0.27 of the frame height);
  - the arm carriage;
  - the 12 ft board-clip fix.
- **Motion work** was paused on 2026-11-06 until the user films a surfskate session (vault `10-Projects/SWELLO/Surfskate-Capture-Shotlist.md`). The user will send it before Wednesday, so it is unpaused for step 7.

Steps 1–6 need no capture; step 7 uses it.
- **Before you start:** read `docs/specs/2026-11-06-3d-barrel-camera-arms.md`, `docs/specs/2026-11-06-wave-kink-at-curl.md`, the "3D: paused" section of `docs/specs/2026-11-06-beyond-surfline-plan.md`, and the vault notes `08-3D-Wave-Scale.md` and `3D-Rounds.base`.
- **Private wave atlases:** if they're missing in your worktree, copy them from the main checkout and compare md5s (see the memory note on worktree local assets).

**Do, in this order. Each step gets its own commit, with stills before and after at 1440 and 390.**

1. **Scale truth audit (before any visual work).**
   - Each height band's face height in metres must match the forecast band midpoint.
   - The rider is the user's saved height (default 1.75 m) and the board is the selected quiver board's real length.
   - The caption reads "3D illustration · approximate scale".
   - Write a test that measures the rendered face height against the band, to within 5%, for 2, 4, 6, 8, 12 and 15+ ft. If any band is off, fix that first.
2. **A tube that feels enclosed: the surfer must be DEEP in the barrel.**
   - **User, 2026-11-10:** "turns look pretty good … most immediate problem was just that the surfer wasn't actually deep in the barrel."
   - **Target:**
     - the rider sits inside the tube, behind the curtain, not on the open face beside it;
     - from the default camera, the lip is in front of and above the rider, with the rider partly hidden by the falling curtain for the middle of the barrel section;
     - the exit is visible.
   - **Check:** do the stills match the barrel references frame by frame?

   The earlier wording follows:
   - **The problem today:** the lip passes well overhead, and the foam lands about 7 m behind the rider.
   - **Target, at 6 and 8 ft frontside and backside:**
     - the lip lands no more than 2 m behind the rider while they're in the barrel;
     - the rider stays visible inside the tube from the default camera;
     - the lip stays over the head for 1.5 s or more;
     - no bodyclip or head-wet regressions.
   - **Check:** compare side by side with the barrel reference frames (the barrel-machado frames named in the 2026-11-06 spec).
   - **Keep:** waves too small for a tube keep the current line.
3. **The hour change morphs instead of jumping.** When the user scrubs to another hour, the wave eases between the two forecast heights over about 0.6 s. At rest it shows the exact height for that hour. No frame may show a height outside the two endpoints.
4. **Fix the body leftovers:**
   - **The left calf at the takeoff** dips about 8 cm into the water at 6 and 12 ft Expert right. Target: 0 samples below the water in the 18-cell matrix.
   - **Backside arms:** bring them up to the frontside quality (front arm leading at chest height, back arm bent and balancing) against the pro frames. Show a 0.05 s frame-step strip, with no new arm or wrist gate events.
   - **Arms through the snap:** swing through the turn, not snap between keyed poses.
5. **Fix the faint reflections inside the tube.** Remove the artefact, and keep the water shading elsewhere unchanged (compare stills).
6. **Phone performance.** iPhone-size emulation with 4× CPU throttling: average fps, the 1% low and the worst frame, before and after every step. No step may make them worse. If you can make the 390 frame rate better, do.
7. **Real motion from the user's surfskate capture.** The user said they'll film it before Wednesday, so motion work is unpaused for this step.
   - **Footage:** `~/Development/swello-design-references/21-user-recordings/3d/`. The shot list is the vault note `10-Projects/SWELLO/Surfskate-Capture-Shotlist.md`: trim, bottom turn, snap, cutback, barrel crouch and pig-dog, frontside and backside, 3–5 reps each. If the folder is empty, skip this step and say so.
   - **Pipeline:** the `motion-real` branch and `?motion=real`: RTMPose trace → MotionBERT 3D lift → retarget onto the rider. MotionBERT weights are fine while the app is private; never commit them. Read FINDINGS §20 and the shot list's "What the pipeline showed it needs" first.
   - **Do:**
     - trace every clip and report which reps traced cleanly (no dropped frames, knees in a human range);
     - build one clip per move per side;
     - drive the rider's moves in the ride plan with them, replacing the keyed poses for those moves. The arms come from the capture too, which should settle the backside and snap arms in step 4.
   - **Acceptance:**
     - side by side with the user's own footage and the pro frames;
     - a 0.05 s frame-step strip per move;
     - knee and elbow angles within the captured range;
     - no new bodyclip, head-wet, arm or wrist gate events;
     - the 18-cell matrix no worse;
     - phone fps no worse.
   - **Don't** commit the user's footage, the traces or anything derived from MotionBERT to the public repo. Keep them git-ignored, the same as the wave atlases.
8. **Stretch, only if 1–7 are done and the user OKs it in chat: T-140.** Paddle out, sets and the lineup. This replaces the empty-wave gap, about 25% of each loop after the kick-out. T-141 (wipeouts) waits for a later round.

**Gates for the track:**
- tsc, tests and build;
- t062 (camera invariants), t104 (no-board), journeys;
- the 18-cell matrix no worse on any cell.

The lead looks at the stills before any merge.

### Track 2: honest about how right we are (accuracy scorecard)
- **Show it on every spot page:** a "How right we've been" line (last 7 and 30 days) with the typical error and whether we ran high or low, against the nearest open-ocean buoy. In California it is also measured against CDIP MOP's analysis.
  - **Data:** the forecast archive (`services/forecastArchive`), plus the buoy readings.
  - **No data:** where there's no eligible buoy, it says so. There is never a number without a source.
- **Calibration:** use `docs/forecast/RATING-AUDIT-SPLIT.md` (the round-3 study) if it has landed. Turn its evidence-backed proposals into one rating-calibration spec, apply it only after the user approves, and byte-compare every unaffected spot.
- **Review:** data-honesty-reviewer.

- **Surf-height calibration (added 2026-11-11):** the surf number is a model estimate. Score it daily per zone against the NWS Surf Zone Forecasts (official, public domain, 1,040 spots mapped in `docs/forecast/data/surf-height-sources.json`), and calibrate the breaking step against the measured nearshore gauges (CDIP/NDBC, list in `docs/research/SURF-HEIGHT-SOURCES.md`). The records: `~/Development/swello-data/surf-height/` (since 2026-11-10 22:45 PST) and, once eng's server capture lands, R2 `archive/surf-height/`. Report the error per region before proposing any change; apply only after the user approves.

### Track 3: personal calibration you can see
After a few "felt right?" taps or logged sessions at a spot, the headline shows "calibrated to your N sessions here", with the calibrated range next to the model's and one tap to see why they differ. A new user sees the plain model. Nothing is uploaded; everything stays local.

### Track 4: "it still looks AI-made" (the user, repeatedly)
- **Look for the AI tells:**
  - generic gradients;
  - filler copy (e.g. "Swello reads … honest");
  - over-rounded cards;
  - inconsistent type scale;
  - decorative icons;
  - crowded phone screens.

  Check Home, Forecast, Map and Quiver at 1440 and 390, light and dark.
- **The design rules:**
  - follow `docs/design/RULES.md` and the reference crops;
  - minimal, functional, data first: Surfline and Windy structure, done more beautifully;
  - no AI imagery on condition surfaces.
- **Decided by the user (2026-11-11):**
  - font: **Archivo**, as PRODUCT.md says; Inter goes (RULES.md calls it an AI tell);
  - example boards stay real retail models, labelled "Example board (retail model)" (being done on `boards-restore`).
- **Also in this track:** the design-audit items D1–D15 and the three system fixes (`docs/reviews/2026-11-10-audit-summary.md` §D), plus map scrub performance (B8: pins updated in place, model steps blended on the GPU).
- **Process:**
  - run the `design-critic` agent first;
  - fix its top 5;
  - re-critique once.

### Track 5: Australia (only if the groundwork says go)
**Update, 2026-11-10:** the source readers already exist, unwired and tested: `src/ocean/aodn.ts` (AODN/IMOS buoys) and `src/ocean/tmrTides.ts` (Queensland tides), described in `docs/forecast/AUSTRALIA-SOURCES.md`. Ireland's readers exist too (`src/ocean/marineInstitute.ts`, `docs/forecast/IRELAND-SOURCES.md`). Wire them; don't rebuild them. BoM tides are not permitted, so outside Queensland tides say "not available in this region" unless the user gets BoM permission.
**Precondition:** `docs/forecast/AUSTRALIA-DATA.md` and `docs/specs/DRAFT-australia-wiring.md` say the buoys and tides are allowed to be displayed.

**Then build in this order:**
1. the AODN buoy reader;
2. the "not available in this region" path for anything not permitted;
3. NSW and Queensland in gated batches, each data-honesty reviewed.

If the groundwork isn't merged, skip this track.

### Track 6a: live camera as the hero, with replay (user vision, 2026-11-10)
The user: when we embed cameras, "replacing the current images on the spot at the very top of forecasting pages and the first comparison diagram thing at home with the recommended spot will be a live cam … it should also be replayable … so you can ultimately find yourself surfing."
- **Spot-page hero:** where a spot has an enabled camera (the Camera panel's data), the hero shows that camera instead of the photo. A still is shown directly; a stream as a poster plus tap to play. Credit and live status as in the Camera panel. Without a camera, the current photo stays.
- **Home:** the recommended spot's camera replaces the comparison drawing when it has one. The drawing stays as the fallback, and stays available elsewhere.
- **Replay ("find yourself surfing"):** a scrubbable rewind of the last hours. It needs **recording**, which needs the camera owner's explicit permission to record and keep footage. The current permissions cover display only (HDOnTap, YouTube owners), and USGS stills are public domain, so a still-frame rewind is possible for USGS now. Build replay first for USGS stills (a frame strip of the last 24 h stored in R2, with retention) and for SWELLO's own camera when it exists. Ask HDOnTap and owners about recording rights before any video replay. Never record a stream without permission.
- **No Surfline in any form.**

### Track 6: surf cameras, AI reading (only if the inventory found cameras that allow analysis)
**Input:** `docs/forecast/CAMERAS-INVENTORY.md` and `docs/forecast/data/camera-sources.json` (the Phase A inventory, 2026-11-10). The rules in vault `10-Projects/SWELLO/09-AI-Surf-Cameras.md` are non-negotiable:
- written permission for display, and separately for analysis;
- no Surfline or other restricted feeds;
- no scraping;
- never identify or track anyone.

**Steps:**
1. **Display first.** Show attributed embeds on the spot page, only for cameras with `embedAllowed: yes`.
2. **Then Phase C, only for cameras with `analysisAllowed: yes`.** First candidate: the USGS Dream Inn camera at Cowell's (public domain, so display and analysis are both allowed).
   - Process daylight stills every 5–10 min on the server.
   - Output aggregates only: breaking or not, the set interval, and relative height against calibrated markers, with uncertainty.
   - Delete each frame after inference.
   - Calibrate against the nearest buoy and the How-right archive.
   - Show the result as "Observed · AI estimate", with confidence, only after the lead and the user review it.

## What to hand back
- **The branch:** `fable-wed`, gated, not deployed.
- **A report** at `docs/agents/handoffs/2026-11-11-fable-report.md`:
  - per track, what changed, with before and after numbers and stills (paths);
  - the gate output;
  - what you didn't do, and why;
  - the top 5 things you'd do next.
- **A vault note:** `~/Knowledge/AI-Knowledge/80-Handoffs/2026-11-11-fable-session.md`, linking the report.

## Stop and ask the user (in chat) before
- deploying;
- spending money;
- unpausing 3D motion work beyond Track 1;
- changing any rating weight;
- publishing anything;
- anything touching licensed assets beyond local use.
