# T-001 code review
Reviewer: `code-reviewer` (Sonnet, read-only). Recorded by the lead from the agent's returned report.
Scope: uncommitted diff to `src/features/home/HomeView.tsx` and `src/features/home/home.css`.
Verdict: **APPROVE** (no high or critical findings).

| Severity | Location | Finding | Resolution |
|---|---|---|---|
| Medium | home.css (`.bulletin .verdict i, .home-hero .meta {…}`) | A merged selector from commit 94dcf40 gave the hero rating dot the meta rule's `margin-top: 14px` and `font-size: 13px`. | Fixed by the lead: selector is now `.home-hero .meta`. |
| Low | HomeView.tsx `Week` + home.css `.week td::before` | Day label from `content: attr(data-day)` could be announced twice. | Fixed by frontend-engineer (cycle 1): `content: attr(data-day) / ""`, with the plain `content:` kept as a fallback. |
| Low | HomeView.tsx `Week` thead | No explicit `columnheader` role, while other rows and cells have explicit roles. | Fixed by frontend-engineer (cycle 1). |
| Low | home.css `td:has(.empty)` | No fallback in older browsers. | Accepted; it degrades to a visible "—". |

The reviewer confirmed that `.tip i` and `.spots i` match only their intended elements, and that desktop (≥861px) rules are unchanged.
