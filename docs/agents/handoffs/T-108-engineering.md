# T-108 handoff (engineering): data-label fixes from the site critique

Branch `t108-labels` (forecast-trust 169dd19 merged). tsc clean, 471 tests (2 new in `src/tests/t108-labels.test.ts`), build OK.

| # | Fix |
|---|---|
| 1 | Spot hero subtitle follows the spot's estimate availability: "offshore heights only · not surf size · ratings provisional" when no hour has a surf estimate, else "heights are model estimates". (ForecastView) |
| 2 | Surf tab with no estimate draws only the Offshore Hs line (thin muted style, no blue area; the selection dot is muted too). The legend lists only drawn series: no "Surf estimate" without estimates, "Offshore Hs · not surf size", Tide only when a tide is drawn (Cowell's has none). (charts.tsx, ForecastView) |
| 3 | Map legend at 390 keeps a short "Offshore Hs · not surf" (two small lines); the chip gradient is narrower on phones so the time bar keeps its room. t043 caught an overlap in my first version; fixed and re-checked (t043 ALL PASS). |
| 4 | "est. face" is now "est. surf height" on the spot-page scale card and the Diagram (one string in `ScaleStage.tsx`, the only edit in `src/features/scale/`); aria "Estimated surf height ...", "no surf estimate". t052 text check updated (backup `t052-scale.mjs.pre-t108`). |
| 5 | Offshore-only rating breakdown: shows "Swell size: no estimate", and the engine's wave-potential factor is named what it is, "Offshore swell energy". **Not done: removing it from the score.** The score is the provisional engine's (offshore energy + wind + quality); making it ignore offshore energy changes the rating model, which is your call. The text no longer calls it swell size. |
| 6 | Compare's height column: the surf estimate (headlineSurf) where one exists ("8–12 ft surf"), otherwise "7.0 ft offshore"; sort uses the estimate midpoint else offshore; header note updated. Product's header label should be "Height". |
| 7 | One best-window function: `bestWindowFrom` in `call.ts` (the call's rule). The call's next window, Compare's "Best today 12–6 PM" and Find spots all use it (test: the call's nextWindow equals it). The ★ on the day strip has a tooltip and aria: "Best day of the week: highest average rating over its 6 AM–7 PM hours; the call's window is the best stretch within one day". |
| 8 | The scale card's board and the Board Match line use `boardPickFor` (`choice.pick`), else the favourite/first board. OB now draws the 6'6" step-up the line recommends. |
| 9 | The call names the person's own preferred range from the profile (minWave/maxWave): "within the range you prefer (2–6 ft)", "above the range you prefer (up to 6 ft)" (Worth a look when entirely above or below it). The skill table stays the Skip floor and ceiling (a default 2–6 profile must not make an Expert skip 7 ft). Test with a 2–3 ft profile. |
| 10 | Personal › Units: **made the setting match the labels**, did not apply a different convention: the stored value stays "Face height" (saved profiles), shown as "Surf height (as reports quote it)" vs "Hawaiian (about half)", setting named "Surf height scale". |

Browser (:5185): Bolinas and Cowell's say "offshore heights only · not surf size", the chart legend has no Surf-estimate entry (Cowell's no Tide), rating shows "Swell size: no estimate"; OB: subtitle unchanged, scale draws the 6'6" matching its Board Match line, Compare shows "8–12 ft surf" and "Best today 12–6 PM" (same as the call). 1440 and 390 shots in the scratchpad (t108-*.png).

Suites on :5185 (with the git-ignored local wave assets temporarily symlinked in, then removed): journeys 8/8, t043 ALL PASS, t052 ALL PASS, t054 no FAIL. t062: 4 failures (polar-drag, Right-flip, 1440 and 390) that fail identically on the lead's :5180 baseline, so not from this change. Without the assets this worktree's live 3D does not mount (journey 7's label check, t054, t062 then fail), so run them on a checkout that has them.
