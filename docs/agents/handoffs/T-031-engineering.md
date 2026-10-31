# T-031 Engineering handoff: AI media on Forecast and Home, function first, white theme

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` four times, last after the white-theme default). Commits `…` see `git log` (T-031 series). Owned files touched: `public/media/manifest.json`, `src/ui/Media.tsx`, `src/ui/mediaModel.ts`, `src/features/forecast/{Cinematic.tsx,ForecastView.tsx,forecast.css}`, `src/features/home/*`.

## What it is now
**Manifest** (`public/media/manifest.json`): `ai-forecast-hero-{tall,wide}`, `ai-forecast-loop-{tall,wide}`, `ai-home-hero-{tall,wide}`, `ai-home-loop-{tall,wide}`, `ai-today-aerial`, `ai-board-studio`: all `ai-illustration`, forced caption, CC fallback, srcset from the -800/-1400/-2400 (-900/-1600) stills, stills as video posters, alt says "Generic AI illustration … not this spot". The existing manifest test enforces caption + fallback on every AI entry.

**Media**: video muted, loop, playsinline, preload metadata, **plays only while on screen** (IntersectionObserver), poster only under reduced motion and Save-Data, and falls back to its poster if the file fails (logged). New `useNarrow()` picks tall or wide variants.

**Forecast (function-first rule)**
- Hero is a band: 40svh at 390 (338 px), 45vh at 1440 (405 px), AI backdrop dimmed, caption kept. Phones get the still (the loop is 3 MB); 1440 gets `ai-forecast-loop-wide` with the still as its poster. The huge height number is a backdrop on the right of the band.
- The band itself answers the question: spot name, rating chip, honest height label ("4.0 ft offshore · not surf size" or "Est. …"), **wind (speed, direction, shore relation)**, **tide (height, trend)**, and a **Wave scale** button (opens the existing scale; I did not touch the 3D scene).
- Right under it: the Range/Now/Map selector, the readout (3 compact columns on phones), the 7-day strip (on screen at 1440). Then a one-paragraph summary (replaces the lit sentence) with the spot's own real photo and credit beside it, then charts. "Today at" follows on desktop and moves **below the charts on phones** (charts start at 1114 px at 390, within 1.5 screens).
- Removed: "The week ahead." parallax band, the pinned scroll-lit chapter, the AI aerial behind "Today at", the AI backdrop behind the summary. "Today at" callouts are visible on load (scroll effect only fades 60% → 100%, ≤10 px, 300 ms).
- White theme: the only dark area is the photo band under its scrim. "Today at" and everything else follow the theme (plan view colours now use theme tokens). Dark mode still works (verified).

**Home**: hero 52svh at 390 (439 px; 66svh desktop), poster-only on phones, loop only on desktop; the first spot card starts at ~310 px of the 780 px usable. Cards, panels and the "Popular spots / Not personalised" fix kept. The Home sentence now rests at 40% opacity so it never reads as empty.

## Checks (real output)
- `tsc` clean; `npm test` 216 pass, 0 fail; `npm run build` built.
- **t031-firstview.mjs (new, first-viewport bounding boxes)**: ALL PASS in light and in dark. Forecast 390 and 1440: spot name, rating, labelled height, wind (unit + relation), tide (height + trend), selector, Wave scale entry, hero ≤ 40svh/45vh, caption kept, callouts never below 60% opacity, no AI image behind data, summary present, no band/lit chapter, own photo reachable with credit, no horizontal overflow. 1440 also the 7-day strip. 390: charts at 1114 px. Home 390: hero ≤ 55svh, first card inside the first viewport, greeting + CTA + heading in view, poster only.
- **t031-media.mjs (rewritten)**: ALL PASS: desktop video plays/pauses/resumes, one video per page, phone/reduced-motion/Save-Data poster only, caption and alt.
- `t030-home.mjs` saved and empty: ALL PASS (the hero-fill assertion became "hero is a band"). `journeys.mjs` **8/8**. `t022-nav.mjs` ALL PASS. `t027-shots.mjs` runs clean (its "chapters" line is stale). `t027-tide.mjs` prints empty labels because `allInnerTexts()` on SVG `<text>` is always empty; it was never a real check.
- Shots in `/private/tmp/claude-501/-Users-milosin-Development-projects-surf--claude-worktrees-engineering/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t031/`: **before** `before-fofi-forecast-{1440,390}-{fold,full}.png`, `before-fofi-home-{1440,390}-fold.png`; **after (light)** `after-forecast-{1440,390}-{fold,full}.png`, `after-home-390-{fold,full}.png`, `after-saved-1440-{fold,full}.png`; **dark proof** `dark-forecast-{1440,390}-fold.png`.

## Worker size (item 6): the build DOES embed the media
`scripts/build-worker.mjs` base64-embeds everything in `dist` into `dist/server/index.js`. Measured: 69 assets / 21.6 MB before this task (65 before the media), **86 assets / 40.9 MB now** (the mp4s alone are ~10.4 MB raw, about 14 MB as base64). Also: the Worker has no `.mp4` content type (falls to octet-stream), no HTTP Range support (Safari will not play such a video), and it decodes the whole base64 body per request. **I did not change the build**: I cannot see how the host serves static files or R2, and a change that moves the videos out would 404 them in production. What I did instead: phones never request a video, and a failed video falls back to its poster, so nothing breaks if they 404 or cannot play. Decision needed from you: serve `public/media/ai/*.mp4` (and ideally `photos/`) from R2/static hosting and skip them in `build-worker.mjs`; also `ai-forecast-loop-tall.mp4` and `ai-home-loop-tall.mp4` (4.7 MB) are no longer used by the app, so they can stay out of `dist`.

## Limits
- `ai-board-studio` is in the manifest but unused here (Quiver is Product's).
- The Forecast "Wave scale" button opens the current 3D scene; the user's rejection of the 3D is not addressed here.
- Parallax and scroll fades verified in Chrome only. Not merged or pushed.
