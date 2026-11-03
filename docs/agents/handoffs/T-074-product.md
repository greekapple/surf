# T-074 (product): a welcoming Home (spec 2026-11-02-forecast-driven-3d-home §3)

Branch `worktree-product`: I merged forecast-trust (fd03b86) first. Commits ffd266c (the welcome) and the fix commit for the Codex review of ffd266c. Local only. I didn't touch src/services, src/ocean or src/features/scale.

## What's above the week grid (`src/features/home/Welcome.tsx`)
- **Greeting and the day's answer** in one sentence, e.g. "Good evening. Linda Mar is your best bet tomorrow, 8–10 AM, 3–8 ft and moderate offshore."
  - It uses the profile's first name when one is set.
  - `bestBet` looks across every saved (or popular) spot plus the nearest others, up to 12 (the grid shows 6). For each, it takes the Call's next daylight window (`callFor`: today's if still ahead, else `nextWindow`) and keeps it only if `hourCall` at the window's first hour is Go or Worth a look. It ranks by verdict, then by how soon.
  - The surf in the sentence is `spotHourOf` at that hour, and only if it is a surf estimate ("surf estimate unavailable there" otherwise). The wind is `windOf`'s adjective plus the shore relation.
  - When nothing is good, it says so. When forecasts are missing, it says that instead ("no forecast for your spots right now", or "at the 3 of 6 spots with a forecast; the others have none"); missing data is never presented as bad conditions (Codex P2).
  - The "Open Linda Mar, tomorrow 8:00 AM" button opens that spot at that hour.
- **Photo band:** the best spot's credited real photo (SpotBand), or its drawn coast when it has none; never AI. A time-of-day tint (dawn, day, dusk, night) comes from daylightFor at that spot.
- **NWS hazard banner** (existing, active alerts only).
- **Today at a glance:**
  - sunrise and sunset;
  - next tide, only where that spot's own record carries the tide (the pipeline withholds the SF reference outside the Bay), labelled "station" (Codex P2);
  - water temperature;
  - **Your quiver's pick:** rankBoards size + period at the window, "suits a–b ft, wave shape unknown". Board ranges always say ft, the unit they're stored in (Codex P2: the code had written m for metric users).
- **Layout:** the greeting is the page's one h1; the cards title is now h2. One accent, hairline glance row, Instrument Sans greeting. To keep Home within two screens at 1440 (t047), the week grid is 6 rows and the band 260–280 px.

## Checks (5184)
- tsc OK; unit tests 388/388; build OK.
- New `t074-welcome.mjs` 26/0 at 1440 and 390:
  - one h1 greeting; the answer; a real credited photo or the drawn coast;
  - the glance row; ranges say ft; tide labelled station or "—";
  - the grid after the welcome;
  - honesty: the button opens the named spot, the sentence's surf matches that spot's SURF card at that hour, and that hour's Call is Go or Worth a look;
  - the profile name in the greeting; no overflow; console clean.
- t047 55/0. Its "no hero, greeting or Hello" check encoded the old T-047 rule; it now checks for one greeting with the day's answer and no old hero blocks. Backup kept.
- t067 34/0 (rows ≤ 6); density ALL PASS; journeys 8/8 (`.hd h1` → `#hd-h` in t047 and journeys, backups kept).
- Codex on ffd266c gave 4 P2s, all fixed in the fix commit. Following your new rule, I didn't rerun Codex on the fix commit; it's yours at merge.
- Shots: `playwright-toolkit/swello/artifacts/t074/`. before/ is the T-069 Home, the last state before this change; home-{1440,390} is after.
