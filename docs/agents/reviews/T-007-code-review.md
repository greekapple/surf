# T-007 code review
Reviewer: `code-reviewer` (Sonnet, read-only, static). Recorded by the lead. Verdict: **APPROVE WITH FIXES**.

| Severity | Location | Finding |
|---|---|---|
| Medium | `ForecastView.tsx:99` | "Go to latest nowcast hour" selects a raw CDIP timestamp that may not exist in the hourly `series`. It should select the nearest `series` hour within tolerance. |
| Medium | `ForecastView.tsx:99` | In demo mode the panel says no CDIP data was returned; it should say the nearshore model needs retrieved data. (Also found by QA.) |
| Medium | `ForecastView.tsx:83` | Buoy observation times have no date, so a 9-day-old saved snapshot looks current. (Also found by QA.) |
| Low | `waveHeight.ts` `nearestNearshore` | A NaN `nowMs` skips the window check. |
| Low | `waveHeight.ts` `canPresentBreakingEstimate` | Inconsistent with the `formatWaveHeight` range branch; a point-valued breaking estimate still formats. |
| Low | `ForecastView.tsx:96-104` | SF023 strings and depth are hard-coded; derive them from coastal metadata. |
| Low | `ForecastView.tsx:101` | The model-chip explanation lives only in `title`; the inline 3-column grid may be tight on narrow screens. |

Confirmed OK: UTC→PT handling, QC flag 1 only, ft/m conversion without Hawaiian scaling, 30-minute tolerance and ±24 h window, no readers broken by the confidence/updatedAt change, hooks.
Lead decision: enforce the breaking-estimate guard inside `formatWaveHeight` and update `src/tests/quiver-v9.test.ts:16`, which encoded the opposite rule.
