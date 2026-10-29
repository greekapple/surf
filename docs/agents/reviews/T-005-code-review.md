# T-005 code review
Reviewer: `code-reviewer` (Sonnet, read-only, static review). Recorded by the lead. Verdict: **APPROVE WITH FIXES**.

Confirmed OK:
- Every `var(--x)` is in a context that accepts it: SVG attributes, inline style, Leaflet divIcon HTML, `color-mix`.
- No alpha string concatenation, colour maths or Three.js colour use.
- `BAND_COLOR` is used only as a CSS value.
- `:where(.coast)` keeps Home light under dark.
- `theme.ts`: storage access in try/catch, matchMedia guarded, listener cleanup, server snapshot.
- The pre-paint script runs before first paint; the backup schema is untouched.

| Severity | Location | Finding | Route |
|---|---|---|---|
| Medium | `ForecastView.tsx:183` | Legend "White primary · blue secondary" is wrong in light mode (`--sw1` is #0e2a47) | correction cycle 1 |
| Low | `theme.ts:36-39`, `index.html:3` | Resolve logic and meta colours are duplicated | sync comments, cycle 1 |
| Low | `theme.ts:31` | `current` cached; no cross-tab `storage` sync | cycle 1 (small) |
| Low | `PersonalView.tsx` Appearance control | No roving tabindex or arrow keys | cycle 1 |
| Low | `charts.tsx` windInk | `color-mix` needs Safari 16.2+ | literal fallback, cycle 1 |
| Low | `app.css:166-167` `.spotpin` | Hard-coded colours on map tiles | accepted |

Lead ran criterion 6: tsc ✓ · npm test 130/130 ✓ · build ✓.
