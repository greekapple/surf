# T-060 (product): "What did you see?" two-tap report + observed source label

Branch `worktree-product`, local commits only. I merged rebuild/swello-v0.16 (7a00cd4, then 3a5883c) and engineering's T-059 commit f497322 from worktree-engineering. The lead had said to switch over when it landed, so it's included here; f497322 is unchanged, so merging it into rebuild again is a no-op.

## What it does
- **Entry.** "What did you see?" is a quiet text link in the SURF card's label row, so it adds no height. It is 24 px on pointer screens and 44 px on touch.
- **Panel.** It opens inline, below the conditions grid, with no modal and no form fields. It scrolls into view and focuses the first size.
  - **Tap 1: size.** Nine body words (BODY_TICKS: ankle, knee, thigh, waist, chest, shoulder, head, overhead, double overhead), each with its face height small in the profile's unit (ft or m). Overhead shows its range (6–11 ft) and double overhead "12 ft+", so the labels don't claim engineering's internal 8/14 ft mapping.
    - 1440: one hairline row of 9.
    - 390: a 3×3 grid of 56 px cells, every control ≥ 44×44, Save full-width at the bottom for one hand.
  - **Tap 2 (optional): quality.** Five dots (radio group, 44 px targets, a word beside them: Poor … Epic). Tapping again clears it.
  - **Save.** It names the size ("Save head high"); Cancel is a text link.
  - **Time.** Defaults to now, shown as "Now · 11:43 AM". One tap turns it into a datetime field (max now).
  - Errors from `logObservation` are shown as-is. Keyboard: arrow keys move within each radio group.
- **After saving.** The SURF card shows "You saw ~head high · 7:10 AM · your observation" (`latestObservation`, same Pacific day) and "Calibrating: n of 8 observations". It becomes "Calibrated with your N observations" when `calibrationFor` is active.
  - If the observation is unpaired (no forecast for that hour), the line says "not counted: no forecast for that hour", and the journal says "not paired with a forecast".
  - The engine headline's own "calibrated with your N observations" label is engineering's (`headline.calibration.label`). The SURF value already comes from the headline, so I add nothing there.
- **Personal › Surf journal › What you saw.** It sits at the top of the journal: hairline rows "Spot · ~word", the date, time and quality, and a red text Delete. It re-renders via `subscribeObservations` (`useSyncExternalStore`), so the spot page and journal stay in step, including across tabs.
- **Style.** Sentence case, hairlines, no pills, no decorative icons, 8-pt spacing.

## Files
- `src/features/forecast/observeApi.ts` is the seam (re-exports `src/services/calibration`). `Observe.tsx` holds ObservePanel, ObserveEntry, ObservedLine and useObservations. `SpotPage.tsx` gets the `observe`/`observeEntry` slots, and `ForecastView.tsx` the panel and the `env` (`{records: view.mapRecords, bundle, profile, nowMs}`). `forecast.css` has the styles.
- `src/features/personal/SawList.tsx` is new; `PersonalView.tsx` and `personal.css` are updated.
- `src/services` is not edited.
- The older "Check the forecast (optional)" fieldset inside Log a session (`sessionLog`) still exists. It is a second, longer way to record a face range. Engineering and the lead should decide whether to fold it into T-059 or retire it.

## Checks (5184)
- New `t060-observe.mjs`, 44/0 against the real T-059 module, at 1440 and 390:
  - the entry exists; the panel is inline, with no dialog and no inputs by default; the time defaults to now; 9 sizes with units; Save waits for a size; 44 px targets and the panel fits at 390;
  - Head plus quality 4, then Save: the line and "1 of 8";
  - a second log with the time changed in one tap (an hour earlier, Chest): "2 of 8", and the line keeps the newest (head);
  - the journal lists 2 with quality; Delete leaves 1; the card follows ("1 of 8", "~chest high");
  - no overflow; console clean.
- t045 ALL PASS. The 1440 page height went over 2,200 when the entry had its own line; it's back under now that the entry sits in the label row.
- tsc OK; unit tests 327/327 (with T-059's); build OK; t047 55/0; density (t034, tag t060) ALL PASS; journeys 8/8.
- Shots: `playwright-toolkit/swello/artifacts/t060/` ({1440,390}-panel, -surf, -first, -journal).
