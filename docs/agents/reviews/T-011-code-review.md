# T-011 code review
Reviewer: `code-reviewer` (Sonnet, read-only). Recorded by the lead. Verdict: **APPROVE WITH FIXES**.

| Severity | Location | Finding | Route |
|---|---|---|---|
| Medium | `src/map/spatial.ts:53` | Every `/api/grid` 404 was treated as final "no frame". `forecast-service.mjs:87` also returns 404 for unknown endpoints, and an older or static host would too; those cases used to fall back to the saved snapshot. Production regression risk | Correction cycle 1: the server tags `code:'no_frame'`; the client treats only that as final |
| Low | no test | `loadField` 404, non-404 and abort behaviour untested | Correction cycle 1: `src/tests/t011.test.ts` |

Confirmed OK: 400/5xx fallback unchanged; abort handling; `directUnavailableUntil` not set by a no-frame error; errors not cached; a direction-only 404 is handled; `.env.development` is safe to commit (VITE_ only, dev only).
