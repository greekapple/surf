# Briefing for Fable: make SWELLO the best surf forecast there is (updated for Thursday 2026-11-12)

You are taking over the SWELLO repo for one focused session. Read this whole brief, then `CLAUDE.md`, `PRODUCT.md`, `docs/agents/README.md` and `docs/agents/CONTRACTS.md` before touching anything.

The user's bar: **"exponentially better than Surfline"**. Their focus order:
1. spot accuracy;
2. an honest scorecard of how right we've been;
3. calibration to the surfer;
4. the go / when / which-board answer;
5. the 3D size view and the quiver, which are the differentiators.

## How to run
- **Session:** work in this repo as a Claude Code session on the Fable model. Use a worktree branch from `forecast-trust` (`git worktree add .claude/worktrees/fable -b fable-thu forecast-trust`), not a copy of the website: the tests, the private 3D assets and the browser toolkit only exist here.
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

## Where the app is (updated night of 2026-11-12, live version 6f4bfffc)
Read `docs/reviews/2026-11-10-audit-summary.md` first: the audit set A, B and C is live. Since then, also live:
- **1,078 spots:** Oregon, Washington and Sitka; the East Coast, Gulf and Puerto Rico; minus 3 merged duplicates. One slug system, a 404 page and "Spot not found".
- **The surf number, in order of trust:**
  1. CDIP MOP in California;
  2. the v1 profile estimate wherever cited guide facts allow it (breaking profiles 664 → 902 after the guide-facts round, `docs/forecast/GUIDE-FACTS-ROUND2.md`);
  3. **new:** the NWS Surf Zone Forecast as a labelled "official" fallback ("NWS surf forecast … not ours", with its issue time, HFO AM/PM halves kept; `docs/forecast/OFFICIAL-SURF.md`);
  4. otherwise the offshore height, labelled "offshore · not surf size".
  - Offshore-only for a static reason: 410 → 206 (`docs/forecast/OFFSHORE-ONLY.md`).
  - Hawaii SWAN is built but OFF (it read about 1.5 ft low against the buoys).
- **Evidence being recorded:** Worker hourly cron into R2:
  - nearshore gauges hourly;
  - NWS SRF four times a day;
  - Hawaii SWAN every 3 h;
  - the daily "How right" capture (now 763 spots; the first v1 numbers are due about Nov 12 and v2 about Nov 14).
  - Comparison tooling: `scripts/srf-compare.mjs` and `scripts/gauge-compare.mjs` (`docs/forecast/SRF-COMPARE.md`). The first read: ours is about 1 ft below the NWS (median ratio 0.67 on newly estimated spots).
- **Also live:**
  - **Phone pass 1–7:** answer first, the map takes the screen, honest limited/fallback pills, the legend chip "offshore · not surf".
  - **Map:** fills its whole seaboard in the background.
  - **Share card:** Wordle-style text plus a PNG.
  - **Quiver:** real retail example boards.
  - **Personal:** backup restore.
  - **Water quality:** the water-quality line.
  - **Go windows:** stable Go windows.
  - **Cameras:** Huntington, Hermosa and Venice.
- **Live since the first draft (2026-11-12, live version 23b0166a):**
  - **Map dots** (`docs/specs/2026-11-12-map-dots.md`): clean when zoomed out, numbered rating dots close in, dot style = kind of number, group stacks at z6–8.5; 1,236 DOM pins → 0; region pills removed.
  - **Phone pass 8–12:** header (wordmark, status dot, search icon, avatar), day-strip confidence said once, board period clauses, Home "This week" key behind an (i), Quiver fit line.
  - **Signature A, the Today ribbon** on the spot page (night, surf band, wind vs this beach, tide, window with its own verdict), plus the Call hierarchy (the actionable verdict first; after dark "Next: Go" / "Today: Skip").
  - **Call honesty:** the next-day answer names the hour it judged; "no estimate for this hour", never "for this spot"; a test that the Call and the Surf block never disagree unlabelled.
  - **Small pass:** tide sign rule (no "−0.0"), no board line under Skip, NWS box spacing (now loads on Home too), two-letter day labels on phones, map controls shield place names.
  - **Home:** compact Popular spots list, phone week table sticky/clamped/fade, smaller hero drawing.
  - **Atlantic 7 s minimum period (user approved):** 412 US Atlantic profiles use 7 s, 490 keep 8 s; labelled "our own evidence" (`docs/forecast/ATLANTIC-8S.md`). Re-check 6 s around 2026-12-03.
  - **How-right all-spots scorecard fix:** scoring ran out of hourly stages (420 of ~763); the cron now runs 00:20–13:20 UTC. The first full v2 card lands about 2026-11-13 13:20 UTC.
  - **3D:** the clean-room wave is the default (no licensed input).
- **Live since (evening 2026-11-12, latest 6f4bfffc):**
  - **California lock-in:** CDIP MOP for 128 more California spots (66 facing-matched, 62 nearest-point "chosen by us"); 198 MOP points ingested. California offshore-only went 143 → 14, and those 14 show the NWS range for the NWS's ~3 days (docs/forecast/CA-MOP.md). The NWS parser now reads multi-day blocks ("THIS AFTERNOON THROUGH FRIDAY", SGX).
  - **Open-Meteo Standard (commercial) plan:** key in the Worker secret OPEN_METEO_KEY; /api/health → openMeteo.plan. Cold Home at 390 measured on prod 2026-11-13 (version e2dd0e93, fresh browser ×3): HTML 0.9–1.4 s, best bet with a size 5.0–5.8 s, just under the 6 s budget (was 6–10 s). The loaders are already scoped (~60 spots, California only); what remains is 4 long tasks of 280–340 ms from per-spot normalisation (noaa.ts, tzOffsetMs). Track 0: chunk that normalisation and get the best bet under 4 s.
  - **Forecast charts:** the week fits the width, with one shared hour cursor and readout, and day zoom.
  - **Profile setup:** "Why we ask", an age band (under 13 saves nothing), 7 skill-level cards, an optional sex question with a female figure, and weight → Board Match volume.
  - **HDOnTap snapshot block:** Venice is live, with the switcher for spots with 2+ cameras; the other 16 wait on Tim's links (docs/forecast/CAMS.md). **Snapshot analysis is NOT allowed until HDOnTap agrees in writing.**
  - **Other:** chunk-reload after deploys; hero "now"; Atlantic 7 s; How-right cron 00:20–13:20 UTC.
- **Specs written today:** docs/specs/2026-11-12-forecast-order-and-map-clusters.md (in progress tonight: forecast-order, map-clusters), 2026-11-12-profile-setup.md, LAUNCH-GATE.md (legal checklist; the user runs /code-review ultra before publishing).
- **In flight (check before touching):** product-term: journey 3's End-key "NaN" at Ocean Beach (time-dependent, fails before the Atlantic merge too). eng-term: Europe land check (2,075 of 4,002; resumes after 00:00 UTC) and the local SWAN capture loop.
- **Decided since:** HDOnTap: the user sent their own reply (stills now, partnership later). Map attribution stays as is (full at open, folded to an (i) at the first interaction; OSMF).
- **Known open from the last design critique:** the sea-field scrub cost on the map (audit B8; glField texImage2D, buildField and getShaderParameter on every step; engineering's code).

## The user's two asks for this session (2026-11-12)
1. **"Just make the overall functionality"**: everything works, fast, with no dead ends, before anything new.
2. **"Avoid overcrowding"**: fewer things on each screen, each one earning its place. When in doubt, move it behind one tap rather than add it.

## Tracks, in order (finish and hand back each before starting the next)

### Track 0: it all just works (do this first)
**Goal:** a surfer can do every core job on a phone without a dead end, a wrong number, a stuck loader or a confusing state.
- **The jobs to walk, at 390 and 1440, light and dark:**
  - open the app → see today's best bet;
  - pick a spot by search and by map;
  - read the call and the surf number, then why;
  - change the hour and day;
  - compare two spots;
  - share;
  - add a board and get Board Match;
  - log a session and a "felt right";
  - change units;
  - back up and restore;
  - an unknown or old link;
  - offline or slow network;
  - a spot with each surf-number kind (MOP, v1, NWS official, offshore-only, demo).
- **For each job:** record time to the answer (cold and warm), errors in the console, layout breaks, wrong or contradictory labels, and states that never resolve.
- **Fix:**
  - every dead end and every stuck "loading";
  - every place two screens disagree (the Home best bet vs the spot page, the map pill vs the spot, the share vs the spot);
  - every console error.
- **Speed budget:** the spot page's surf number within 3 s on a warm cache and 6 s cold on the phone profile. The map is usable within 2 s, with no long tasks over 200 ms while scrubbing (this includes audit B8: pins updated in place, model steps blended on the GPU).
- **Known flaky checks to stabilise:**
  - search-fly at 1440 (Pipeline);
  - t043 under the map's background fill;
  - journey 3 End-key at the forecast's last hour (see In flight);
  - map-dots' snapshot check prints SKIP once the recorded day on 5194 expires (record a newer day).
- **Deliverable:** a table of job × width × theme with pass or fail, before and after; the toolkit gaining a check for every bug you fix.

### Track 0.5: the five-second Today call (user, 2026-11-14, after reviewing a competitor's phone app)
**Goal:** on a phone, the first card answers "go or not, how big, what's the surface like, which board" in one read, then Share. Our own design (docs/design/RULES.md); copy nothing.
- One **Today call card** at the top of Home and of the spot page:
  - the verdict as a big pill in our rating colour;
  - a one-line reason chip from the Call's own reason (e.g. "held back by wind");
  - a plain-language headline built from data: body-height words plus the surface word (Glassy / Clean / Textured / Choppy, our labelled rule, from the week-bars work), e.g. "Chest to head high, textured";
  - two short sentences: wind, tide now and next, best window;
  - a **"Bring your <board>"** row from Board Match with an honest fit note;
  - a **"Send today's call"** share button.
  Ranges, not one-decimal numbers. Every estimate keeps its label (model estimate / NWS / offshore).
- **Map:** favourite-spot chips across the top (name, range, body words, rating colour; tap to fly there), and a "Best near your spots right now" card above the dots on phones. Both are gated to California, as the app is.
- **Hourly row on the Today card:** the next 6 daylight hours as small cards (time, size range, body words, surface word). Start at the current hour, never midnight.
- **Acceptance:**
  - the brief-check answer is readable without scrolling at 390×844;
  - journeys, t034, phone-pass and the data-honesty review pass;
  - 390 and 1440, light and dark.

### Track 1: declutter, and stop it looking AI-made
The user, again: avoid overcrowding.
- **Screen budget:**
  - The phone spot page's first screen shows exactly: name, time, the call (word plus reason), the surf number with its kind, and one row of wind, tide and swell. Everything else is below or behind one tap.
  - Home's first screen shows the best bet and at most 3 other spots.
  - The phone map shows the map, search, time bar and legend chip; nothing else is pinned.
- **Remove or fold:**
  - repeated labels (the same source line in three places);
  - helper prose that a tap can hold;
  - decorative icons;
  - duplicate numbers (the same height shown twice in different styles);
  - empty states that take a whole card.
  - Each removal must keep the data-honesty labels reachable. Never drop a required label (offshore · not surf, the model estimate, NWS "not ours", provisional, stale or saved); shorten it instead.
- **Also look for the AI tells:**
  - generic gradients;
  - filler copy (e.g. "Swello reads … honest");
  - over-rounded cards;
  - an inconsistent type scale;
  - crowded phone screens.
- **The design rules:**
  - follow `docs/design/RULES.md` and the reference crops;
  - minimal, functional, data first: Surfline and Windy structure, done more beautifully;
  - no AI imagery on condition surfaces.
- **Decided by the user (2026-11-11):**
  - font: **Archivo**, as PRODUCT.md says; Inter goes;
  - example boards stay real retail models, labelled "Example board (retail model)" (done).
- **Also in this track:** the design-audit items D1–D15 and the three system fixes (`docs/reviews/2026-11-10-audit-summary.md` §D: type tokens, colour roles in both themes, five shared components).
- **Process:**
  - run the `design-critic` agent first, asking it to name every crowded screen and count the elements on each first screen;
  - fix its top 5;
  - re-critique once;
  - report the element counts before and after.

### Track 2: honest about how right we are (accuracy scorecard plus surf-height calibration)
- **Show it on every spot page:** a "How right we've been" line (last 7 and 30 days) with the typical error and whether we ran high or low, against the nearest open-ocean buoy; in California, also against CDIP MOP's analysis. The first real numbers land about Nov 12 (v1) and Nov 14 (v2); make sure they render well and briefly. Where there's no eligible buoy, it says so. There is never a number without a source.
- **Surf-height calibration:** run `srf-compare` and `gauge-compare` on everything captured so far. Report the error per region and per method (MOP, v1, NWS), with n.
- **Then bring the user two evidence-backed proposals:**
  1. ~~the Atlantic 8 s minimum period~~ done: 7 s on the US Atlantic (ATLANTIC-8S.md);
  2. a per-region correction of the breaking step, if the low bias holds (ATLANTIC-8S.md: about 25% low against the gauges at every period band; the wave model itself reads about 0.5 ft under).
  - Apply nothing that changes a number until the user approves.
- **Calibration of the rating:** use `docs/forecast/RATING-AUDIT-SPLIT.md` if it has landed. Make one rating-calibration spec; apply it only after the user approves, and byte-compare every unaffected spot.
- **Review:** data-honesty-reviewer.

### Track 3: cameras the honest way
- **HDOnTap snapshots:** once the user has OK'd the reply and HDOnTap confirms, show their auto-updating stills on the matching spot pages, with the HDOnTap credit, their approved logo and a link to the live page. Never their streams without a licence, never a workaround.
- **Spot-page hero:** where a spot has an enabled camera (still or stream), the hero shows it instead of the photo, with credit and live status. Without a camera, the current photo stays. Keep it uncluttered: one camera, one credit line.
- **Replay:** only for USGS stills (public domain) and SWELLO's own camera when it exists. Ask owners about recording before any video replay. No Surfline in any form.

### Track 4: personal calibration you can see
After a few "felt right?" taps or logged sessions at a spot, the headline shows "calibrated to your N sessions here", with the calibrated range next to the model's and one tap to see why they differ. A new user sees the plain model. Nothing is uploaded; everything stays local.

### Track 5: the 3D wave-to-surfer view (only after Tracks 0–2 are handed back) (`src/features/scale/WaveLive.tsx`, `rideSim.ts`, `riderBody.ts`, `boardObject.ts`, `peelDirection.ts`)
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

### Track 6: Australia (only if the groundwork says go)
**Update, 2026-11-10:** the source readers already exist, unwired and tested: `src/ocean/aodn.ts` (AODN/IMOS buoys) and `src/ocean/tmrTides.ts` (Queensland tides), described in `docs/forecast/AUSTRALIA-SOURCES.md`. Ireland's readers exist too (`src/ocean/marineInstitute.ts`, `docs/forecast/IRELAND-SOURCES.md`). Wire them; don't rebuild them. BoM tides are not permitted, so outside Queensland tides say "not available in this region" unless the user gets BoM permission.
**Precondition:** `docs/forecast/AUSTRALIA-DATA.md` and `docs/specs/DRAFT-australia-wiring.md` say the buoys and tides are allowed to be displayed.

**Then build in this order:**
1. the AODN buoy reader;
2. the "not available in this region" path for anything not permitted;
3. NSW and Queensland in gated batches, each data-honesty reviewed.

If the groundwork isn't merged, skip this track.

### Track 7: surf cameras, AI reading (only if the inventory found cameras that allow analysis)
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
- **The branch:** `fable-thu`, gated, not deployed (the lead deploys after review).
- **A report** at `docs/agents/handoffs/2026-11-12-fable-report.md`:
  - per track, what changed, with before and after numbers and stills (paths);
  - the gate output;
  - what you didn't do, and why;
  - the top 5 things you'd do next.
- **A vault note:** `~/Knowledge/AI-Knowledge/80-Handoffs/2026-11-12-fable-session.md`, linking the report.

## Stop and ask the user (in chat) before
- deploying;
- spending money;
- unpausing 3D motion work beyond Track 1;
- changing any rating weight or any rule that changes a shown number (e.g. the Atlantic 8 s minimum);
- publishing anything;
- anything touching licensed assets beyond local use.
