# SWELLO (repo: SURF)

Surf forecast app for Northern/Central California. Product truth, brand and constraints: `PRODUCT.md` (read before product or UI work). Process, roles and quality gate: `docs/agents/README.md`. Backlog and defects: `docs/agents/TASK-BOARD.md`.

## How the user works with you
The user describes outcomes in plain language ("the Explore map looks terrible", "the buttons don't work"). Turn each request into a scoped task yourself using the `swello-product-iteration` skill: retrieve only the relevant context, set measurable acceptance criteria, choose a level and owners, implement, verify in the browser, report. Ask only when a decision is genuinely the user's (product direction, data honesty trade-offs, anything on the approval list).

## Non-negotiables
- Never fake data or labels; follow the data-honesty rules in `PRODUCT.md` and `docs/agents/CONTRACTS.md`.
- Done means verified: the journey works in a real browser and the 1440/390 screenshots were looked at against the references. Compiling, rendering, passing tests or an agent saying "done" is not completion. Report incomplete work as incomplete.
- Full autonomy (user, 2026-11-02): commits, merges, pushes, installs and dependencies are pre-approved. Hard limits: no destructive git on `surf-history` (force-push/delete), nothing secret pushed, ask before spending money. Deploying the private site with `npm run deploy` is pre-approved (user, 2026-11-12) after a green merge, followed by a live check at 1440 and 390.
- **This repo is PUBLIC.** Never push licensed third-party assets or anything derived from them: the TurboSquid wave meshes and the `public/media/scale3d-live/*.glb` waves built from them stay local (git-ignored) until a private asset host exists.
- Obsidian notes (`~/Knowledge/AI-Knowledge/10-Projects/SWELLO/`) hold durable decisions; write and update them directly.
- Knowledge lookup: read `~/Knowledge/AI-Knowledge/00-MAP.md` first, then the one `45-Wiki/` page it names. Design work follows `docs/design/RULES.md`.

## Commands (Node via fnm: wrap as `zsh -lic 'cd <repo> && …'`)
- Dev: `npm run dev -- --port 5180 --strictPort` → http://127.0.0.1:5180
- Checks: `npx tsc --noEmit` · `npm test` · `npm run build`
- Browser: `~/Development/ai-system-setup/playwright-toolkit/swello/` (`journeys.mjs`, `swello-qa.mjs`, `home-shots.mjs`); usage in `docs/agents/README.md`.
