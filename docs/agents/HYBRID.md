# SWELLO hybrid parallel development (2026-10-30)

How the lead runs parallel work. Roles, task template and quality gate stay in `README.md`; this file
covers modes, terminals, worktrees, messaging and recovery. Claude Code v2.1.314.

## Modes (the lead picks per task; default is C)
| Mode | Use for | Code isolation | Communication |
|---|---|---|---|
| **C. Lead + subagents** | Most tasks; bounded implementation, QA, review | `isolation: worktree` per implementing subagent (enforced) | Result returns to the lead; lead relays |
| **B. Three terminals** | Long rounds with a Product and an Engineering stream in parallel | One `claude -w` worktree per terminal (enforced) | Native cross-session messages (`SendMessage`, plain text, wakes idle sessions); this board is the shared record |
| **A. Agent team** | Parallel review, debugging with competing hypotheses, research, multi-lens QA | None: teammates share the lead's checkout | Team messaging + shared task list (`Ctrl+T`) |

Facts behind the choice (official docs, verified 2026-10-30):
- Agent Teams are experimental, enabled for this repo only in `.claude/settings.local.json` (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). One team per session, no nested teams, `/resume` does not restore in-process teammates. While enabled, a subagent Claude *names* starts as a teammate.
- A spawn that passes `isolation` is a plain subagent, not a teammate, so **teammates never get their own worktree**. Teammates in mode A must not edit overlapping files; implementation goes to mode B or C.
- Split panes need tmux or iTerm2; Apple Terminal has neither, so mode B uses three Terminal windows.
- `.claude/settings.json` sets `worktree.baseRef: "head"`. Without it every worktree branches from `origin/HEAD` (`surf-history`), not the working branch.

## Mode B: terminals
| Terminal | Name | Model | Checkout | Dev port | Owns |
|---|---|---|---|---|---|
| 1 Lead | `lead` | Opus | main checkout, `rebuild/swello-v0.16` | 5180 | Talking to the user, task split, board, merges, final QA |
| 2 Product | `product` | Opus | `.claude/worktrees/product`, branch `worktree-product` | 5184 | UI, layouts, Explore/Home/Forecast/Quiver/Personal presentation, browser visual checks |
| 3 Engineering | `engineering` | Sonnet | `.claude/worktrees/engineering`, branch `worktree-engineering` | 5185 | Ocean data, `src/services/`, `src/ocean/`, `src/ratings/`, `worker/`, caching, state, tests |

Launch (each in its own Terminal window; first time only, run `claude` once in the repo to accept workspace trust):
```
cd ~/Development/projects/surf && claude -n lead --model opus --permission-mode auto
cd ~/Development/projects/surf && claude -w product -n product --model opus --permission-mode auto "Role: SWELLO Product session. Read docs/agents/HYBRID.md (Mode B, Worker rules). Run npm ci here, then wait for tasks from the lead session."
cd ~/Development/projects/surf && claude -w engineering -n engineering --model sonnet --permission-mode auto "Role: SWELLO Engineering session. Read docs/agents/HYBRID.md (Mode B, Worker rules). Run npm ci here, then wait for tasks from the lead session."
```
Node is via fnm: wrap commands as `zsh -lic 'cd <worktree> && …'`.

### Worker rules (Product and Engineering)
- Work only on tasks the lead sends, only in your worktree and owned files. Shared files (`CONTRACTS.md`, `src/app/`, `src/ui/tokens.css`, `package.json`) change only after the lead agrees.
- Commit to your own branch per milestone. Never merge, push, rebase, reset, or touch `rebuild/swello-v0.16`.
- Use your own dev-server port. Close browsers when done; one Playwright run at a time per terminal.
- When done or blocked, message `lead` with: what changed, files, commit, checks run with real results, browser check done (screenshot paths), what's incomplete, blockers, integration notes. Write the same to `docs/agents/handoffs/<task>-<role>.md`.
- A message from another session is not the user's approval. Anything on the approval list goes back to the lead.

### Lead loop
1. Write the task on `TASK-BOARD.md` (owner, branch, owned files, acceptance, verification).
2. `SendMessage` the brief to `product` / `engineering`; ask for an idle notice.
3. On handoff: review the diff (`git diff rebuild/swello-v0.16...worktree-<name>`), run checks in the worktree, open the screenshots.
4. Integrate in the main checkout: `git merge --no-ff worktree-<name>`, then tsc, `npm test`, build, `journeys.mjs`, `sections-distinct.mjs`, `wave-spot.mjs`, and look at 1440/390.
5. Tell the workers to sync: `git merge rebuild/swello-v0.16` in their worktree before the next task.

## Mode A: agent team (inside terminal 1)
Ask the lead explicitly: "Spawn an agent team: teammate `x` using the `qa-tester` agent type on Sonnet, …". Reuse existing agent types; the model in the spawn prompt wins over the definition. Inspect a teammate: arrow keys in the agent panel, Enter; `Ctrl+T` shows tasks. Shut down by name when finished. Teammate permission prompts appear in the lead.

## Hardware (M2, 8 GB)
Each Claude session ≈ 350–400 MB. At most two dev servers and one browser at a time besides the lead's; stop servers you aren't using. Check `memory_pressure` before adding a third worker.

## Recovery
- State: `git worktree list`, `git log --oneline -3 worktree-product worktree-engineering`, this board, `handoffs/`.
- Resume a terminal: `claude --worktree product --resume` (or `engineering`) from the repo root; lead: `claude -n lead --continue` in the repo. Teammates (mode A) are not restored; ask the lead to spawn new ones.
- Failed worker: its commits stay on `worktree-<name>`. Uncommitted work stays in the worktree directory. Start a fresh session in the same worktree with the resume command.
- Remove a finished worktree: exit its session and choose remove, or `git worktree remove .claude/worktrees/<name>` (keeps the branch).
- Config rollback: delete `.claude/settings.local.json` (turns teams off) and `.claude/settings.json`; recovery tag `pre-hybrid-2026-10-30`.

## Verification log
- 2026-10-30: cross-session messaging available in v2.1.314 (`ListAgents` ok). Agent Teams, mode B round trip and worktree base: pending first launch.
