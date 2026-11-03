# T-099 (product): the six morning findings

Branch `worktree-product` (forecast-trust 6317689 merged first). Minimal edits in engineering- and Fable-owned files where the lead allowed (homeDash.ts, ScaleStage.tsx, WaveLive.tsx).

1. **One board pick everywhere (P1).**
   - `boardPickFor()` in `src/features/quiver/fit.ts` is the only ranking. It takes the hour's `spotHourOf(...).surf.headline`. With a measured face value and wave character, the full scoring decides (Board Match's score list); otherwise the size + period ranking does. `pick` is set only when the board suits the size.
   - Home's quiver pick, Board Match (its "Best match" / "Best for this size" marker is now exactly that pick, not just row 1) and Personal all call it.
   - **Removed:** the preference-range heuristic `src/features/personal/recommend.ts` and its test. Personal's row now says "Board Match pick for Ocean Beach, 2:00 AM" or "None suits it" / "No surf estimate at …".
   - **Test:** `board-pick-agreement.test.ts` covers Ocean Beach and Linda Mar, in size and score modes, plus a source guard that the three screens call it and have no other ranking.
   - **Live:** Board Match and Personal both name Bigger-day option for Ocean Beach at the same hour.
2. **Greeting by local hour** (`src/features/home/greeting.ts`, tested): Good morning 5–12, Good afternoon 12–17, Good evening 17–22, and "Still up?" overnight ("Still up, Milo?"). I didn't use "Hello", because an earlier Home acceptance removed the old "Hello." hero, and t047 still guards that.
3. **Map at 390:** the credits line hides only while a popup card is open and comes back when it closes. Also fixed: a touch tap on the card's ✕ reached the map and opened a new Model point where the finger was (inland). Map clicks within 400 ms of closing are now ignored.
4. **Showroom at 390:** on phones the fit line moves into the fixed bar ("Today: Surf above its range · fish range 1–5 ft"), and the in-page copy that sat under the bar is hidden there. Nothing is covered at 390×844 or 375×667. Desktop is unchanged.
5. **3D surfer height:** `WaveLive` takes `surferM` and scales the 1.75 m model uniformly to the person's height. The label reads "drawn at 8.5 ft face · you 5'10" (default)", or "you 6'2"" when the height is saved; the alt text matches.
   - **Measured:** surfer bounding box 1.73 → 1.82 m tall for 5′10″ → 6′2″ (×1.05 = 74/70).
   - The pre-rendered spin frames really contain a 1.75 m surfer, so their fallback caption stays "surfer 5′9″".
   - To test, I copied the git-ignored `surfer.glb` and `scale3d-atlas/` into this worktree's ignored folders. They're local only; nothing is tracked.
6. **Compare spots at night** opens on the next morning's first daylight hour (Tue 6 AM at 2 AM, all 45 rated); the stepper is still free.
   - **Shared rule:** `nextMorningKey()` in homeDash.ts, also used by Home's morning ranking.
   - **Bug fixed:** Home's "Tomorrow AM" after midnight meant the day after today, skipping this morning.
   - **Label:** before 6 AM the tab now reads "This morning" ("Best this morning nearby"). Tested.

## Toolkit (backups `t056/toolkit-bak/*.pre-t099.mjs` in the product scratchpad)
- **t047:** accepts "Still up" and "Best this morning nearby", and the "This morning" tab.
- **t051:** accepts the "This morning" tab.
- **t074:** accepts the "Still up, Milo?" greeting.
- **t035:** the phone bar may carry the "Today:" fit line.
- **t054:** the 3D label reads "you <height>( (default))".

## Checks (5184)
tsc OK; unit tests 457/457; build OK; t025 27/0; t035 29/0; t043 54/0; t045 54/0; t047 55/0; t062 28/0; t074 28/0; t054 22/0; density ALL PASS; journeys 8/8.
**t052:** 33/2. The 2 failures ("size band browser … 15+ ft band comparing") fail identically on :5180 without my changes. They predate this branch and look time- or data-dependent.
**Shots:** `artifacts/t099/` (map card, showroom 390/375, wave scale default and 6′2″, compare 1440/390) and `artifacts/t099/after/` (the full morning-set script).
