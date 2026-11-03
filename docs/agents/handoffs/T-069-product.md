# T-069 (product): the Call doesn't repeat itself; the week grid reads with mostly offshore spots

Branch `worktree-product`: I merged rebuild/swello-v0.16 (a40e3f0) first; one commit, local only.

1. **The Call's why line.**
   - New rule in `trustRules.ts`: `restatesHeadline(why, headline)` is true when every word of the sentence, after filler words, is already in the verdict + window. `firstNewReason(why[], headline)` returns the first reason that adds something.
   - The line under the verdict shows that reason, or nothing. "It is dark. The next window is tomorrow 6 AM–2 PM." under "Dark · next window 6 AM–2 PM tomorrow" is dropped. A reason like "Plunging and 6–9 ft: experienced surfers only." still shows.
   - Every reason is still in the tap-open list. The phone-only CSS that hid the why after dark is gone; the rule replaces it.
2. **Week grid.**
   - Rows sort by how many days have a surf estimate, most first, otherwise keeping the saved/nearest order.
   - An offshore-only day is a small grey number (12 px, no "off" in the cell).
   - The row label says "· offshore only", or "· offshore where grey" when a row mixes estimate and offshore days.
   - Each cell's accessible name still says "surf estimate unavailable, offshore up to N ft". No estimates are invented.

## Checks (5184)
- tsc OK; unit tests 373/373 (trust-ui.test.ts: one new test for the restatement rule); build OK.
- t067 34/0. Updated (backup kept): offshore cells are bare grey numbers with an offshore aria label, estimate rows come first, and rows with offshore days say so.
- t065 52/0. Its "one-line why" check now reads: the why line adds to the headline or is absent (backup kept).
- t045 54/0; t047 55/0; density ALL PASS; journeys 8/8.
- Shots: `playwright-toolkit/swello/artifacts/t069/` ({home,spot}-{1440,390}).
