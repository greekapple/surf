# SWELLO agent workflow

Bounded, mostly sequential delegation. The lead (Claude Code main session, Opus) owns priorities,
acceptance criteria, integration and the final report. Subagents cannot message each other: the lead
relays every handoff, and the durable record lives in files.

| Where | What it holds |
|---|---|
| Git (`rebuild/swello-v0.16`, local only) | Code. Source of truth. |
| `docs/agents/TASK-BOARD.md` | Active assignments: owner, files, status. Operational source. |
| `docs/agents/CONTRACTS.md` | Shared interfaces every agent reads before editing code. |
| `docs/agents/handoffs/<task>-<role>.md` | What an agent did: files changed, evidence, open issues. |
| `docs/agents/reviews/<task>-<role>.md` | QA reports and code reviews. |
| Obsidian `10-Projects/SWELLO/` | Durable product knowledge: vision, specs, decisions, milestones. Not task logs. Edits need the user's approval. |

## Roles
| Role | Agent (model) | Owns | Does not |
|---|---|---|---|
| Lead orchestrator | main session (Opus) | Task decomposition, acceptance criteria, architecture decisions, integration, commits, user reports | Hand off without criteria; report work it has not verified |
| Frontend engineer | `frontend-engineer` (Sonnet) | Assigned React/TS/CSS files; tests what it builds; writes a handoff | Edit files outside its assignment; commit |
| QA tester | `qa-tester` (Sonnet) | Independent Playwright/Chrome checks, screenshots, defect reports, retests | Change app code; mark a defect fixed without retesting |
| Code reviewer | `code-reviewer` (Sonnet, read-only) | Correctness, accessibility, regressions, maintainability findings with file:line | Rewrite code |
| Architect | `architect` (Sonnet, read-only) | Forecast data contracts, 3D integration, cross-feature design | Routine UI work |

Not every task uses every role. Per the user's global policy: one implementation pass, one independent
review (code-reviewer **or** Codex), at most two correction cycles, then stop and report.

## Task protocol
States: `BACKLOG → READY → IN PROGRESS → REVIEW → VERIFIED → COMPLETE`, plus `BLOCKED`.
Each task on the board lists: ID, objective, owner, dependencies, owned files, inputs, acceptance
criteria, status, outputs, tests, blockers, next handoff.

1. **Specify**: lead writes the task with measurable acceptance criteria and owned files.
2. **Assign**: one owner per file set; no two agents edit the same file at once.
3. **Implement**: the owner edits only its files and writes `handoffs/<task>-<role>.md`.
4. **Inspect**: the lead or QA opens the real app in Chrome (Playwright), at desktop 1440 and mobile 390, and looks at the screenshots.
5. **Review**: QA report in `reviews/<task>-qa.md`; code review in `reviews/<task>-code-review.md`.
6. **Correct**: the lead routes findings back to the owner; QA retests.
7. **Hand off**: the lead commits locally, updates the board, and records durable decisions in Obsidian (with approval).

## Quality gate (feature is not COMPLETE unless)
- The user journey works in a real browser, and controls do something meaningful.
- `tsc --noEmit`, `npm test`, `npm run build` pass; relevant Playwright checks pass.
- No new console errors (known: NDBC CORS in local dev).
- Desktop and mobile screenshots were *looked at*, not just captured.
- Data is labelled honestly: offshore model, nearshore estimate, observation, or illustrative.
- 3D work is judged on rendered geometry and proportions, not on the scene loading.
- Known limitations are written down.

## Conflicts and parallel work
Default is sequential. Parallel work only for tasks with disjoint file ownership, each in its own git
worktree (`isolation: worktree`) and branch; the lead merges and resolves conflicts, and QA runs on
the merged result. Experimental multi-agent features stay off.

## Running the app and tests
- Node is via fnm: wrap commands as `zsh -lic 'cd <dir> && …'`.
- Dev server: `npm run dev -- --port 5180 --strictPort` → http://127.0.0.1:5180
- Browser scripts (Playwright 1.64.1, `channel: 'chrome'`): `~/Development/ai-system-setup/playwright-toolkit/swello/`
  - `swello-qa.mjs`: every route at both sizes plus interaction checks
  - `home-shots.mjs <tag> <base> <outDir>`: Home screenshots and 13 interaction checks
  - `journeys.mjs [base]`: 8 functional user journeys (Home, spot hand-off, forecast hour, Explore, Quiver, Personal, Wave Scale, theme), fresh browser context each; prints PASS/FAIL per journey, saves failure screenshots to `swello/artifacts/journeys/<stamp>/`, exits 1 on any failure (about 40 s). Run before every commit with the dev server up.
