# T-037 Engineering handoff: Personal as a grouped settings list

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first). Files: `src/features/personal/*`, and a small edit to `src/app/routes.ts` (see below).

## What it is now
- **One grouped list** (iOS-Settings style, max 720 px, light-first, theme tokens, no blue pills): Profile header card, then groups **Favorite spots**, **Sessions and alerts** (Surf journal, Alerts, Recommended board), **Surf preferences**, **Units**, **Appearance**, **Data & privacy**. Each row shows its current value and opens its own page with a **"‹ Personal" back control** (aria-label "Back to Personal") and a title. The sideways-scrolling section pills are gone.
- **First 390 screen:** the profile summary and the favorite-spot rows (name, region, labelled offshore height; tap opens that spot's forecast) are both inside it; "All favorite spots" is the third row.
- **Pages:** Edit profile (`/personal/profile`: name, home region, photo, ability), Favorite spots (`/personal/spots`, the cards with star toggles and Forecast buttons), Surf preferences (`/personal/preferences`: wave range, ability, swell directions, period, tide), **Units** (`/personal/units`: heights, wind, breaking-wave scale), **Appearance** (`/personal/appearance`: Light/Dark/System with arrow-key support), Surf journal (`/personal/journal`), Alerts (`/personal#alerts`), **Data & privacy** (`/personal/account`: data source, export backup, storage counts, Privacy and Terms links).
- **Old URLs still resolve:** `/personal`, `/personal/spots`, `/personal/preferences`, `/personal/journal`, `/personal/account`, `#alerts`, `/personal/privacy`, `/personal/terms`, and an unknown section falls back to the list. Note the Units and Appearance controls moved off `/personal/preferences` onto their own pages (they were in that page's "Units" and "Display and data" panels); the data source moved to Data & privacy.
- **Everything that worked still works:** units (persisted, drive Forecast), theme (persisted), favourites, preferences, journal logging and delete, alerts, profile photo, export. Removed only the dashboard duplicates: the three-column dashboard, Recent Sessions strip, photo-credits footer (credits remain on the spot cards) and the unused `AlertsCard` / `JournalColumn` components.
- **Shared file touched (please confirm):** `src/app/routes.ts` gains three hidden Personal sections (`profile`, `units`, `appearance`), and three labels changed ("Saved Spots" → "Favorite Spots", "Preferences" → "Surf preferences", "Account" → "Data & privacy"; the root section is now "Personal"), so the Personal menu and the new pages resolve. No other shared files.

## Checks (real output)
- `tsc` clean; `npm test` 226 pass, 0 fail; `npm run build` built.
- `t034-density.mjs` **ALL PASS** at 390 on all 15 screens, now including Personal profile, units, appearance and alerts (and Personal in dark). In the process it also fixed real findings on the Personal pages: swell/tide chip rows were 40 px tall (now 44) and spaced 6 px (now 12), alert inputs 10 px apart (now 12).
- `journeys.mjs` **8/8**. Journey 6 and journey 8 were updated because the UI legitimately moved (journey 6 reaches Units from the list; journey 8 uses `/personal/appearance`). Journey 3 (Forecast hour change) failed once on a live-data swell-period mismatch and passed on the next run; it does not touch Personal.
- New `t037-flow.mjs` **ALL PASS** at 390 and 1440: profile and favorites on the first screen, the six groups in order, no sideways pills and 0 px overflow, every group's row opens its page and Back returns to the list, the header opens the profile editor and the edited name shows, a favourite row opens its forecast, old URLs resolve. `t031-firstview` and `t022-nav` pass.
- Before/after (light) in `/private/tmp/claude-501/-Users-milosin-Development-projects-surf--claude-worktrees-engineering/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t037/`: `before-<page>-{1440,390}-{fold,full}.png` and `after-<page>-{1440,390}-{fold,full}.png` for `root, profile, spots, preferences, units, appearance, journal, account` (before has root, spots, preferences, journal, account); dark proof `t037dark-personal-fold.png`.

## Limits
- The favourites in the list show the nearest forecast hour's offshore height with its label; spots without live data show only their region.
- "Recommended board" is a row (name plus "Heuristic, not a forecast match" or the score), not the old card; the Quiver has the full view.
- Not merged or pushed. Dev server on 5185 still running.
