# T-110 handoff (engineering): Codex P2s on Compare and the Home hero, plus the drain

Branch `t110-codex` (forecast-trust f1b0791). tsc clean, 474 tests (3 new, `src/tests/t110-labels.test.ts`), build OK, journeys 8/8.

1. **Compare height column** (Codex on c3b7e2f): new `src/services/headlineLabel.ts` `estimateLabel(headline, profile)`, built from the same `headlineText` every card uses. The cell now reads "8–12 ft est." (value keeps its unit and the Hawaiian qualifier: "4–6 ft ≈ Hawaiian est." under the Hawaiian scale), with the tag and method line in the tooltip and an `sr-only` sentence; a saved or stale estimate says "saved est." / "stale est.". Offshore rows are unchanged ("7.0 ft offshore"). Browser (:5185): OB shows "8–12 ft est." and "4–6 ft ≈ Hawaiian est." with the method tooltip.
2. **Home hero caption** (Codex on df7d103): `heroEstimateText` gives "Est. 8–12 ft", and "Est. 8–12 ft (saved estimate)" / "(stale estimate)" when the hero hour's estimate is not current; Hawaiian qualifier kept. Fresh data and Hawaiian checked in the browser; the stale case is covered by the unit test only (I did not force a stale copy live).
3. **Codex drain** (queued 9682084): one P1, `WaveLive.tsx:496-497` "the board is a Group, bounds throw with no Quiver board". It is already fixed on forecast-trust: the board bounds now traverse the child meshes (lines ~497-502), so nothing to change (and `src/features/scale/` is not mine). The queue is empty.
4. t062 flip-invariant update: held as instructed, waiting for your ping.
