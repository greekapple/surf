# T-103 handoff (engineering): the height field no longer loses typed text

Branch worktree-engineering (forecast-trust 7b85274 merged first). tsc clean, 461 tests pass, build OK.

**Real root cause** (not only the resync effect): `HeightField` was declared INSIDE `PersonalView`, so every PersonalView render made a new component type and React REMOUNTED the field when a save landed: the input element was replaced (measured: the element from before the save was disconnected), losing the person's text and focus. Fixes in `PersonalView.tsx`:
1. `HeightField` moved to module level (stable component identity).
2. As asked, belt and braces: a `dirty` ref skips the resync from the saved height while the person has typed since the last commit (cleared on a valid commit or an empty one, kept while an invalid entry shows its message).
Only the field's own file changed; nothing else was nested the same way (grep for indented component declarations found only render helpers).

Verification: the raw race (invalid height typed 400 ms after a save, 20 runs, half at 6x CPU) failed 6-8 of 20 before; **0 of 20 after** — saved as `~/Development/ai-system-setup/playwright-toolkit/swello/t103-height-race.mjs` (exits 1 on any failure). t052 (with the save-echo waits) ALL PASS. No unit test: the component needs a DOM and the project has no component-test setup; the toolkit check covers it.
