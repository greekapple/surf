---
name: merge-gate
description: The lead's merge routine for SWELLO worker branches (product/engineering/agent worktrees). Use when a worker hands off a task: merge, run every check, Codex + data-honesty review, look at the screens, report. Invoke as /merge-gate <branch> [checks...].
---

# Merge gate (lead)

1. `git branch --show-current` (integration branch, e.g. `forecast-trust` or `rebuild/swello-v0.16`), then `git merge --no-ff -q <branch> -m "Merge T-0xx: <one line>"`. Resolve conflicts keeping both sides' intent; never drop a worker's tests.
2. Checks (Node via fnm): `zsh -lic 'npx tsc --noEmit && npm test && npm run build'` — report pass counts.
3. Browser (dev server 5180 must be up): `cd ~/Development/ai-system-setup/playwright-toolkit/swello && node journeys.mjs http://127.0.0.1:5180` plus the task's own `t0xx-*.mjs` and `t034-density.mjs lead <base>`. A failing check that only reflects an intended change: update the script (keep a `.pre-<task>` backup) and say so.
4. Reviews: `tools/review/codex-review.sh HEAD` (the hook also runs it async); for data-touching merges also run the `data-honesty-reviewer` subagent on `git diff HEAD^1..HEAD -- src`. P0/P1 → send back to the worker before anything else.
5. Look: open the changed screens in Chrome (1440, and 390 via the toolkit) and compare against the task's references. Builds and tests alone are not done.
6. Board: append one line to `docs/agents/TASK-BOARD.md` (merged commit, check results, open issues). Fast-forward `rebuild/swello-v0.16` when the integration branch is green.
7. Reply to the worker (merged + next task) and report to the user in plain language: what changed for them, what was verified, what's still open.

Never push while `tools/review/licence-guard.sh` blocks (public repo).

## After a green merge (night of 2026-11-02 onward)
- Fast-forward `rebuild/swello-v0.16` to `forecast-trust` (local only; its history still holds licensed GLBs, never upload it).
- Run `tools/review/port-to-clean.sh` to replay the new integration commits onto the scrubbed public line `swello-v0.17`, then upload that one branch explicitly (`git` + `push origin swello-v0.17`, no flags). The licence guard checks it; never bypass, never force.
