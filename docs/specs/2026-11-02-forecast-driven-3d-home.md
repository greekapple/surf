# 3D wave driven by the real forecast · honest narrower ranges · a welcoming Home

Status: APPROVED, running (user, 2026-11-02 ~21:10: "make a spec for this and run it"). Branch: `forecast-trust`.
Model split (user): **Fable** for the 3D design; Opus (engineering/product terminals) for range and Home.

## 1. 3D wave = this spot's forecast (Fable subagent, own worktree)
User: "I don't want to be able to switch through different wave heights … when the 3D model is opened it just directly correlates with the surf spot's true forecast data … we should be able to change the wave from a left to a right … still a little choppy … the surfer has to be correctly oriented using the reference I gave you."

- **Forecast-driven, no size switching.** Remove the 8 size chips from the 3D view. The wave is built from the selected spot-hour's forecast (`spotHour` / `headlineSurf` / `callFor`). There is no "comparing" mode in 3D.
  - Face height: the estimate's central value, interpolated between atlas buckets (or atlas parameters), not snapped to a band.
  - Breaker type: `breakerType` (spilling/plunging) where known; otherwise from bucket family.
  - Period: the lip and power.
  - Wind relation: offshore feathering/back-spray vs onshore chop.
  - Tide: subtle water-level/shape change if the atlas supports it cheaply.
  - The hour slider stays: scrubbing hours changes the wave and the light together.
  - No estimate (offshore-only spot): say so, and show the offshore swell honestly labelled ("offshore swell, not breaking-wave size"), or a neutral state. Never present it as surf size.
  - The 2D Diagram view may keep its band browser for comparison; the 3D does not.
- **Left / Right.** A small control flips the peel direction (a left breaks to the surfer's left as they ride). The default comes from the spot's published-guide facts when known (right/left/both), else "both" with a toggle. The surfer rides in the peel direction.
- **Surfer orientation.** Correct stance for the direction: the surfer faces the wave on the frontside and rides toward the open shoulder, matching the user's reference photos (bottom turn, `Google Images "waves breaking surfer"` set, `20-youtube-wave-types` frames). Deeper research on stance per direction can follow later; get it right for left vs right now.
- **Smoothness ("a little choppy").** Steady 60 fps animation with no hitches. Profile the frame time and remove per-frame CPU work (spray buffers, uniform churn), so time-stepping is smooth and peel/foam motion has no visible stepping. Report the 1% low frame time.
- **Gaps from wave-v3 round 2 to address if possible:** the white "teeth" at the base of the pitching section on 8 ft+, the lip curtain/tube read from the front, the landing burst.
- **Constraints:**
  - No licensed-derived files committed (public repo).
  - No new runtime deps.
  - Caption kept ("3D illustration · approximate scale, not current conditions" → now "3D illustration of this forecast hour · approximate").
  - Honest labels; fallbacks kept.
- **Acceptance:**
  - Opening the scale page for Ocean Beach / Linda Mar / an offshore-only spot shows a wave matching that spot-hour (face, type, light).
  - Left/right flips both peel and surfer.
  - The 1440 and 390 shots look right.
  - 60 fps, 1% low ≥ 50 fps on the M2.
  - Toolkit checks t062/t054 updated.
  - Codex is clean.

## 2. Narrower, honest ranges (engineering, Opus)
User: "we still need to improve the range."

Today the v2 breaking estimate uses a fixed ×0.7–1.4 spread, so Ocean Beach reads 6–13 ft.

Target: a range that reflects actual uncertainty and is usually narrower:
1. **Model spread.** Use the spread across the wave models available for the spot-hour (Open-Meteo offers several wave models; compare like the Windy model view), and the MOP nearshore vs offshore agreement.
2. **Calibration.** Use it where active (T-059).
3. **Factor uncertainty.** Narrow it only with evidence: published breaking-height relations for the breaker type (e.g. spilling vs plunging ratios from the literature), cited.
4. **Combine** these into a central estimate ± an interval. Show it as e.g. "7–9 ft" when the inputs agree, wider when they don't, and say "sources disagree" when they do.
5. **Testing:** test the method, backtest against buoys only as context, report widths before/after for 45 spots × 72 h, and run the data-honesty-reviewer.

## 3. A welcoming Home (product, Opus)
User: "the home page is not very welcoming, it's kind of just data."

Keep the function-first rule (no AI imagery on condition surfaces; real data only), but add warmth above the grid:
- A **greeting + the day's answer in one sentence**, using the Call. For example: "Good evening, Milo. Linda Mar is your best bet tomorrow, 7–9 AM, 3–5 ft and light offshore." It's personal (name, home spots, skill) and honest when nothing is good.
- A **real photo band** of the best spot (credited CC photos from the manifest), with time-of-day tint (dawn, day, dusk, night).
- **Today at a glance:** sunrise/sunset, tide turn, water temp, and any NWS hazard.
- **Your quiver's pick** for the best spot.
- Then the week grid. Generous spacing, Instrument Sans headings, one accent; nothing AI-looking (follow taste-skill app-screens: one signature element, no card soup).
- **Acceptance:** 1440/390 before/after, journeys and t047/t067 pass, density passes, and the greeting never invents data.
