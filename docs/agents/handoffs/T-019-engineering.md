# T-019 Engineering handoff: D-03 and D-06

**Branch:** `worktree-engineering`

## D-03 (demo-only spot saves silently): not reproducible, verified working end to end
- The defect premise (7 spots with no live data) no longer holds: all 45 catalogue spots (`allSpots`) have live evidence (`evidenceSpots`), so `spotOptions` in live mode includes every spot. I checked this from the data, and added `src/tests/t019-spots.test.ts` as a regression guard (fails if a catalogue spot ever lacks evidence, i.e. a star could again be accepted for a spot Home and the picker cannot show).
- Browser (port 5185, 1440 and 390, fresh state, 14 PASS, 0 FAIL): starring Stinson Beach and Mavericks (two of the former demo-only spots) from Personal › Favorite Spots shows them saved, stores them, shows both as Home cards with a pressed star, shows the picker star pressed, and unstarring on the Home card removes the card and the stored id.
- I first wrote a visible refusal for demo-only spots, found it could never trigger, and removed it rather than ship dead code.
- Not covered: the demonstration-data mode (provider fetch fails). There `spotOptions` is the 10 demo spots, which are a subset, so saving works there too, but I did not force that mode in a browser.

## D-06 (Home region unused): already used by Find spots; made visible
- `FindSpots.tsx` already reads `profile.region`: it averages the evidence spots in that region as the anchor and says "Around <region>…" when location is off. Verified in the browser: with region "All regions" it says "Around Ocean Beach…", with "San Mateo" it says "Around San Mateo…" (1440 and 390).
- Change: one helper line under the Home region control in Personal (`PersonalView.tsx`): "Used by Explore › Find spots as your starting point when location is off." Home itself does not use the region.
- Screenshots: `/private/tmp/claude-501/-Users-milosin-Development-projects-surf/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t019/` (`d06-desktop.png`, `d06-mobile.png`, `d03-picker-*.png`).

## Checks (real output)
- `tsc` clean; `npm test` 192 pass, 0 fail; `npm run build` built; `journeys.mjs` on 5185: 8/8.

## Incomplete
- `FindSpots.tsx` needed no change. Not merged or pushed.
