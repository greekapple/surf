# T-030 Engineering handoff: Home, cinematic and phone-first

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first). Commits `37f149e`, `feb98bf` (review fixes). Files: `src/features/home/HomeView.tsx`, `home.css`, `public/media/manifest.json`; small fixes in `src/ui/Media.tsx`, `src/ui/mediaModel.ts`, `src/tests/media.test.ts` (my T-028 files). `SpotStrip.tsx` untouched.

## What Home is now
1. **Hero** (≥ 92svh at 390, 82svh at 1440): full-bleed `<Media id="home-hero">` with slow parallax, "Good afternoon" and "Hello, Milo." in `var(--display)` 700 up to 240 px, one line, one cut-corner primary action ("Check a spot"). The "Add your name" link was removed (single action); naming is still in Personal.
2. **Spot cards**: horizontal scroll-snap rail, large photo cards with name, region and a condition colour bar plus word (Good / Fair / Poor, **Flat**, **Demo data**, No rating). No numbers. Tap opens that spot's forecast (`setSpot` + `go('forecast')`). A spot with no photo of its own gets a generic CC photo marked "Illustrative photo, not this spot" with an empty alt. Empty state: "Popular spots / Not personalised. Star a spot on its forecast to keep it here." (Ocean Beach, Bolinas, Linda Mar, chosen only because they have cleared photos.)
3. **Scroll-lit sentence**: "Swello reads swell, wind and tide … what it knows and what it does not." Static and honest; words light as they pass the reading line.
4. **Three full-bleed panels** (Forecast, Map, Quiver): parallax image, giant type, each a link.
5. **Motion**: CSS `animation-timeline: view()` where supported; otherwise IntersectionObserver adds `.on`; with neither, everything is shown. `prefers-reduced-motion` forces final states (words lit, panels visible, no parallax).

## Image slots (one-line swap for Higgsfield)
Manifest ids `home-hero`, `home-panel-forecast`, `home-panel-map`, `home-panel-quiver` (currently the same CC photos). Replace one manifest entry with an `ai-illustration` entry (caption and fallback photo required, tested) and the Home picture changes with no code edit. Built-in defaults (`SLOT_DEFAULTS` in mediaModel) keep the slots filled if the manifest fetch fails.

## Checks (real output)
- `tsc` clean; `npm test` 216 pass, 0 fail (1 new: slots resolve with no manifest); `npm run build` built.
- New `t030-home.mjs` (toolkit), saved and empty states, at 1440, 390 and 390 with reduced motion: **ALL PASS**: no horizontal overflow (0 px), hero fill, greeting, card count, "Popular spots / not personalised" label, no forecast numbers in the Home body, three linked panels, 24 lit words that go dim → lit on scroll (and all lit under reduced motion), card opens `/forecast`, no console errors.
- `t030-nomanifest.mjs`: with the manifest blocked (404) hero and all three panels still load; the failure is logged (`console.error`).
- Height: **1440 = 2.97 viewports (≤ 3), 390 = 3.37 (saved) / 3.42 (empty) (≤ 4)**.
- `journeys.mjs`: **7/8**. Journey 3 (Forecast hour change, 30 s timeout) fails identically with my changes stashed, so it predates T-030 (Forecast is the Product session's area). Journeys 1 and 6 (Home strip, name on Home) pass.
- `t022-nav.mjs`: 2 FAIL, both the old Home height limits (≤ 2 and ≤ 3 viewports), now superseded by T-030's ≤ 3 and ≤ 4; every other t022 check passes (search, chips, console clean). Please update those two limits.

## Screenshots (looked at)
Scratchpad `/private/tmp/claude-501/-Users-milosin-Development-projects-surf--claude-worktrees-engineering/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t030/`:
- Before: `before-saved-1440-full.png`, `before-saved-390-full.png` (and `-fold`).
- After: `after-saved-1440-full.png`, `after-saved-390-full.png`, `after-empty-1440-full.png`, `after-empty-390-full.png`, `after-saved-390-reduced-full.png` (and `-fold`).
In the full-page 390 images the fixed bottom tab bar appears mid-page; that is a capture artefact.

## silent-failure-hunter (run on the diff) and what I did
Fixed: Home slots blank if the manifest failed (defaults added, manifest errors and unresolved ids now logged); panels unreadable without an image (dark background); card chip ignoring demo/flat (now "Demo data"/"Flat"); generic photo mislabelled as the spot (empty alt and visible note); `Media` hid nothing on a broken photo (now logs, hides the credit); no-IntersectionObserver case left words dim (shows all); empty rail with no message.
Not changed: the "Popular spots" wording (your spec; the list is hard-coded, so it is a curated set, not usage-ranked); `/media/manifest.json` is an absolute path (the app has no Vite `base`).

## Limits to know
- Hero text sits over a photograph with a dark gradient; type is layered over the photo, not behind a cut-out subject as in the Aeron reference (that needs an AI-cut image later).
- Spot cards for spots without their own photo use a generic CC photo, so they look alike until more photos exist.
- Parallax and the lit words use scroll timelines, which I verified in Chrome only; Safari and Firefox take the IntersectionObserver path (words/panels appear, no parallax).
- Dev server on 5185 still running. Not merged or pushed.
