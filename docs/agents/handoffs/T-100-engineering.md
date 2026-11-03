# T-100 handoff (engineering): the 9 Codex P2s from the morning drain

Branch worktree-engineering (forecast-trust 7c39504 merged first). tsc clean, 461 tests pass, build OK. Nothing under `src/features/scale/` touched (the Scale lazy wrapper in App.tsx only changed how it is imported).

| # | Finding | Result |
|---|---|---|
| 1, 2 | BoardOutline fins precedence and deck colour | **Already fixed in T-098**: `resolvedLook` (record Fins win) and `effectiveDeck` (foam for clear, tint x0.78 in linear light) in `looks.ts`; BoardOutline uses both; `board-look.test.ts` pins them. No change needed. |
| 3 | mopIssue cache never refreshed | Epoch per forecast bundle (`syncMopIssueEpoch(bundle.loadedAt)` from `useMopIssue`): entries from an older bundle read as unknown (null) until reloaded, so an old issue time or "saved" flag is never shown against a newer forecast; hook reloads when the bundle changes. Test in mop-issue.test.ts. |
| 4 | Failed lazy import cannot retry | Each lazy area is a holder; ErrorBoundary `onRetry` recreates every lazy component, then clears the error. |
| 5 | Compare hour set before data arrives | Effect runs on the first available hour, once (ref guard), never overrides a later pick. Browser: clock 10 PM, direct load of /explore/compare opens on Wed 4 · 6 AM (was stuck on the night hour). |
| 6 | Fixed 6 AM cutoff | `nextMorningHour` = the next not-dark hour after now (today included), before noon Pacific. Test with first light after 6. Home's ranking (`nextMorningKey`) unchanged. |
| 7 | Longitude wrap | `isEnclosedWater` normalises to [-180, 180). Test: Central Bay at 237.577. |
| 8 | Labels on land | Label candidates skip cells whose pixel is in the land mask. Browser: Bay shot, label sits on the hatched water (`artifacts/t092/t100-*-bay.png`). |
| 9 | "small or short-period" for huge swell | Reads combined Hs from the factor's own reason: above 10 ft says "very large: the rating treats that much energy as unfavourable"; else neutral "swell energy rates low for this hour: small or short-period". Test in call.test.ts. |

Also for lead: the Stop-hook Codex review of your `tools/review/licence-guard.sh:27` (P1: forcing strict mode on an explicit push can skip a tag-only licensed commit) is not mine to change; not touched.
