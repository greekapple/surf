# Wave: the kink and streak where the breaking section meets the open face
Status: **APPROVED** (user 2026-11-06, a brief from another chat adapted to this repo). Owner: one Opus agent, branch `wave-kink` from forecast-trust. No Fable unless it clearly fails.
The user's circled screenshot: `~/Development/swello-design-references/21-user-recordings/3d/bugs/2026-11-06-kink-at-curl-user-circled.png` (12.5 ft face, "Est. 11–14 ft"). Look at it first.

## The bug (from the screenshot)
1. **A see-through white vertical streak** hangs down the face from the lip to the trough, at the boundary between the broken (curling, foamy) section and the smooth unbroken face, like a waterfall pasted on.
2. **A step in the surface at the same place.** The sparkly foam band along the trough is broken and offset: the left piece is higher and stops, the right piece starts lower, with a dark notch between them.
3. **Secondary:** a faint ridge runs along the face about a third of the way down from the crest. The face should be one smooth concave curve from trough to lip.

A real wave has no seam there: the face flows continuously into the pitching section. The only things at the peel are the lip throwing, spray off the lip, and whitewater behind.

## Where to look (this repo)
- **The surface:** the atlas (`src/features/scale/waveAtlas.ts`: stageAt, sections, ampAt, bendZ, sample/profileInto) and its GLSL copies in `src/features/scale/WaveLive.tsx` (STRIP_VS/the ALONG block, WATER_FS foam). The atlas comes from `tools/blender/wave_atlas.py` (S_FEATHER/S_PITCH/S_LAND stages, resample by material index). Likely suspects:
  - the stage interpolation between unbroken and pitching stages;
  - `sections()` pulses;
  - foam placed by a different height than the surface;
  - an overlapping second mesh (the "head"/whitewater mesh, headMat), or spray/wake point sprites;
  - the 2-bucket blend (blendAtlas) of different bands.
- **The streak:** find what draws it (a whitewater/head mesh, spray points, the wake ribbon, the foam term in WATER_FS). Toggle each one and prove it.
- **Both atlases:** the default (licensed, git-ignored) and `?atlas=proc` (the traced one, git-ignored). Fix the shared code, not one atlas.

## Rules
1. **Diagnose first.** Write `docs/3d/wave-kink-findings.md` before any code change: what draws the streak, the exact cause of the step, which past rounds touched this area (git log on waveAtlas.ts, wave_atlas.py, WaveLive.tsx; FINDINGS §13–20) and why they didn't fix it, and the fix plan.
2. **Fix the cause, not the look:** no new effects, foam or fog to hide it.
3. **One source of truth:** the CPU atlas maths and the GLSL must agree. Add a test that compares the CPU and shader surfaces at sample points; extend the existing unit tests if a readback isn't practical.
4. **Continuous blend along the crest:** height and slope continuous across the peel boundary, the transition scaled with wave size; no second hump on the face.
5. **The foam band** sits on the same surface: continuous, or removed if it can't be.
6. **Hour changes:** when the forecast hour or spot changes, the wave must morph without a pop or a new seam (check the existing transition path).
7. **Small and in scope:** only the wave geometry and shading at the seam. Don't touch the rider, the barrel ride or the camera (the `3d-next` branch is changing those in WaveLive.tsx right now: keep your diff to the wave parts so the merges don't fight), the beach, lighting or UI. One commit per change.

## Proof
- **A numeric continuity test** (`src/tests/`), sampled across the peel boundary and along the face, failing on a step, a slope kink or a non-rising face. Sweep:
  - face height 1–25 ft (every atlas band and the blends between them);
  - spilling and plunging;
  - left and right;
  - several peel positions and times through the cycle.
  Run it on the CURRENT code first and show it fails, then show it passes after the fix.
- **Frames:**
  - `before-kink.png`, then the same view after;
  - a side-by-side of before | after | the user's circled image;
  - contact sheets from the default camera and a side-on camera at the peel for 4, 8 and 12.5 ft, plus one while scrubbing between two forecast hours.
  Look at them yourself.
- **Phone:** a Playwright run in iPhone-size emulation with 4× CPU throttling (average fps, 1% low, worst frame), before and after. Then the dev server with `--host` and the URL and query to open on the user's phone; start it only when the lead asks, and stop it after.
- tsc/tests/build; t062, t104, journeys; the 18-cell glitch matrix no worse.

## Rules carried over
- Public repo: never commit licensed or derived files (scale3d-atlas, scale3d-proc, proc-curves.json, *.fbx) or footage.
- Headless only: no visible windows.
- Free port; stop servers; local commits; no push, merge or deploy; never `git branch -D`.
- Never read 99-Private.

## Hand-back
- the root cause in one or two sentences;
- why earlier rounds missed it;
- the commits;
- the frames and sheets;
- the test results before and after;
- the phone numbers;
- anything still wrong in the circled area, plus out-of-scope problems listed but not touched.
