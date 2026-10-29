---
name: swello-product-iteration
description: Turn a plain-language SWELLO product request ("the map looks terrible", "the buttons don't work", "improve Home", "fix D-04") into a scoped, verified change. Use for any SWELLO feature, defect, visual or UX request. Covers context retrieval, acceptance criteria, sizing, delegation, browser verification, documentation and reporting.
---

# SWELLO product iteration

The user describes what the product should do or feel like. You own the technical path. The details live in `docs/agents/README.md` (roles, task template, functional/visual acceptance, quality gate); this skill is the order of operations, so don't restate that file.

## 1. Interpret
- Restate the outcome in one sentence in product terms (what a surfer will see or be able to do).
- Map the request to an area with `request-map.md` (next to this file): source files, references, open backlog IDs.
- If the request matches an existing board item (D-xx, F-xx, V-xx, T-xxx), continue that item instead of creating a duplicate.
- Ask only when the answer changes what you build and can't be inferred: product direction, data-honesty trade-offs, items on the approval list. Otherwise choose a sensible default and state it.

## 2. Retrieve (selectively)
In this order, stopping when you have enough:
1. The relevant source files and `git log --oneline -10 -- <paths>`.
2. The board item and its `docs/audit/2026-10-29/AUDIT.md` row or review files.
3. References for visual work: `rg '"feature": "<x>"' ~/Development/swello-design-references/INDEX.jsonl`, then open only the matched images. A reference is a target only if it is `proposed-primary`/approved; the rest is inspiration.
4. The one or two vault notes for the area (`~/Knowledge/AI-Knowledge/10-Projects/SWELLO/`), and never `99-Private/`.
Don't claim to have checked something you didn't open.

## 3. Define and size
- Write acceptance criteria before editing: functional (action → state → persistence → visible errors) plus visual (1440 and 390, both themes if themed, against named references).
- Level by risk (global policy): 0–1 you implement directly; 2 one owner + `qa-tester`; 3 show the plan first, one owner + QA + `code-reviewer`, `design-critic` for visible redesigns; 4 detailed plan + approval.
- Level 2+: add or update a T-xxx entry on `docs/agents/TASK-BOARD.md` using the README template. Level 0–1: one board line when it closes a listed defect.

## 4. Implement
- Smallest change that meets the criteria, in the existing idiom. Reversible: working tree on the current branch; Level 3+ on its own branch or worktree.
- Delegation briefs under ~300 words: goal, owned files, criteria, expected output. Agents run one at a time; you relay handoffs.

## 5. Verify (required evidence)
- `npx tsc --noEmit`, `npm test`, `npm run build`.
- Real browser (Playwright, Chrome channel) at 1440 and 390: exercise the actual interaction and assert the result, not just that a click happened. Run `journeys.mjs` before any commit.
- Open the screenshots and look at them. For visual work: list the visible shortcomings against the reference, fix, recapture, and look again.
- Independent check by level: none for 0–1 (your own browser evidence is enough); `qa-tester` for 2; plus one `code-reviewer` (or Codex) and `design-critic` for visible redesigns at 3+. Max 2 correction cycles, then stop and report.

## 6. Record and report
- Board: status, tests run with real results, review files. Durable decisions: propose a vault note, write after approval.
- Report to the user in product terms: what changed, the evidence (commands + results, screenshot paths), what's still not right, and the next step. Say "not done" when it isn't.
- Never commit, push, install, deploy or restructure without approval.
