---
name: spec
description: Turn the user's rough SWELLO request ("/spec the wave looks like a pipe", "/spec make the quiver feel premium") into a full, reviewable spec using the project's own context (CLAUDE.md, PRODUCT.md, task board, design references, decisions, vault notes, memory), show it, and WAIT for approval before any work. Use only when the user types /spec or asks for a spec/brief first.
---

# /spec: rough request → approved spec

The user gives a few words. You write the brief they would have written with an hour to spare, grounded in this repo, then stop. **Never change code, assets or docs (other than saving the spec) until the user approves.**

## 1. Gather context (read only what the request needs)
- `CLAUDE.md`, `PRODUCT.md` (truth, brand, data-honesty rules), `docs/design/RULES.md` for UI work.
- `docs/agents/TASK-BOARD.md`: the last ~80 lines, plus `rg` for the area (open items, past decisions, D-/T- ids). Continue an existing item rather than inventing a duplicate.
- The area's source files (`.claude/skills/swello-product-iteration/request-map.md` maps area → files) and `git log --oneline -10 -- <paths>`.
- References: `docs/design/REFERENCES-*.md`, `docs/design/TEARDOWN-*.md`, `rg '"feature": "<x>"' ~/Development/swello-design-references/INDEX.jsonl` (approved = target, rest = inspiration).
- Decisions: the vault `~/Knowledge/AI-Knowledge/10-Projects/SWELLO/19-Decision-Log.md` and the one note the request touches (start from `00-MAP.md`; never touch `99-Private/`). Memory index if relevant.
- For visual requests, look at the current screen (1440 and 390) before describing what is wrong. For real-world fidelity (waves, boards, surf photos), name the real reference you are comparing against.

## 2. Write the spec (this shape, tight, no filler)
```
# <Area>: <one-line outcome in product terms>
Context: what exists now (files, current behaviour, related task ids) — 3–6 lines, facts only.
Problems: numbered, concrete, each tied to what the user sees (screens/angles/hours).
Target: what "good" looks like, with named references (real-world + approved design refs) per problem.
Constraints: data honesty, function-first, approval list (deps, paid, pushes), performance/size budgets, things to keep (captions, labels).
Approach: the recommended technique and why; alternatives rejected in one line each (incl. ideas from the request that don't fit the repo, with the reason).
Owners & level: lead / product / engineering, Level 0–4, branch name, commit plan (one per fix area).
Acceptance: measurable checks (tests, browser checks, fps/size numbers, 1440/390 shots, side-by-side comparisons).
Open questions: only decisions that are genuinely the user's (max 3), each with a recommended default.
```

## 3. Show it and stop
- Print the spec in the reply. Save it to `docs/specs/<yyyy-mm-dd>-<slug>.md` (create the folder if needed) so it can be referenced later.
- End with: approve / edit / answer the open questions. Do not start work in the same turn.
- On approval, hand off to the normal flow (`swello-product-iteration`): board entry, owners, implementation, verification.
