# T-085 handoff (engineering): breaker classes for ξ₀
- Bug: `services/breaker.ts` computed ξ from the OFFSHORE height (ξ₀) but classified with the ξb thresholds (0.4/2.0). Fixed to the deep-water classes: spilling < 0.5, plunging 0.5-3.3, surging > 3.3 (Battjes 1974; values checked on Wikipedia "Iribarren number", 2026-11-02; the CEM attribution was dropped as unverified). Comment, constants, basis string (built from the constants) and tests agree; tests cover the formerly misclassified bands (0.45 spilling, 2.5 plunging).
- Spot-hours changing class, 45 spots x next 72 h (live, `docs/forecast/data/breaker-class-change.ts`): **0**. Only Ocean Beach has a defensible slope (73 spot-hours, all spilling at xi about 0.1-0.2, far from any boundary). The fix matters for the spots that will get slopes later.
- User-facing breaker notes now say "(est. from a mean seabed slope)".
- waveSpec/ScaleStage/call only read the type; t062-live, t045, journeys pass. Reviewer: no P0/P1.
