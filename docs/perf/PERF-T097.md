# Deferring the MOP issue (DAS) files (T-097)

Same method as `PERF-T091.md` (production build, Slow-4G, cold cache, CPU 4x at 390, median of 4 runs; `t091-perf.mjs` with `SCREENS="Home,Spot page"`); raw medians in `t097-before.json` / `t097-after.json`. Before = the commit with T-091 to T-093; after = this change.

| view | screen | | data on screen | LCP | TBT | total transferred | requests (of which /api) |
|---|---|---|---|---|---|---|---|
| 1440 | Home | before | 8.5 s | 14.1 s | 106 ms | 1885 KB | 229 (212) |
|  |  | after | 7.2 s | 12.8 s | 146 ms | 1749 KB | 189 (172) |
|  | Spot page | before | 8.5 s | 10.5 s | 19 ms | 1135 KB | 226 (212) |
|  |  | after | 7.2 s | 9.2 s | 20 ms | 1002 KB | 187 (173) |
| 390 | Home | before | 9.7 s | 11.7 s | 1104 ms | 1159 KB | 226 (212) |
|  |  | after | 7.8 s | 9.8 s | 915 ms | 1023 KB | 186 (172) |
|  | Spot page | before | 9.0 s | 9.9 s | 312 ms | 954 KB | 226 (212) |
|  |  | after | 7.6 s | 8.5 s | 346 ms | 821 KB | 187 (173) |

**What changed.** The first load no longer requests the 40 `.das` files (the MOP forecast files' global attributes: only the Nearshore card shows the issue time). `src/ocean/mopIssue.ts` fetches one on demand when the card mounts (`useMopIssue`), caches it, keeps the saved-copy flag, and shows nothing (never a stale time) on failure. The headline's freshness labels are unchanged: the forecast file's own delivery and age still label the estimate, and the issue-file flag joins the label once that file has been loaded.

**Effect.** 40 fewer requests (229 to 189 on Home; the Spot page makes one on-demand request for its own point, 173 `/api`), about 0.1 to 0.14 MB less, and the forecasts reach the screen about 1.3 s earlier at 1440 and 1.8 to 2.0 s earlier at 390 under this throttle. LCP follows the data (the winning element appears after the forecasts), 1.3 to 1.9 s earlier. TBT is within run-to-run noise. The remaining 172 requests are the 90 marine/weather files, 40 MOP forecast files and the tide, buoy and station files; the two-wave load and the bundle endpoint are not part of this change.
