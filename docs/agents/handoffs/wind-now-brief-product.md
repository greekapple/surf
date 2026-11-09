# Brief: wind now, Product (lead, 2026-11-08)
You are the Product terminal. Build part 2 of docs/specs/2026-11-08-wind-now.md.

Setup in .claude/worktrees/product: `git checkout -b wind-now-ui wind-shore`. Read CLAUDE.md, PRODUCT.md (data honesty and brand), docs/design/RULES.md, and the spec. Engineering is building the data side (src/ocean/shoreWind.ts and related files) in parallel; don't create or edit those files.

Build `src/features/forecast/WindNow.tsx`, with its CSS in forecast.css:
- **Props:**
  - `ShoreWindNow | null`. Copy the spec's interface as a local type, marked "mirror of src/ocean/shoreWind.ts; lead swaps to the import at merge".
  - The forecast wind for the same hour (mph and direction-from). See how the WIND tile gets it in SpotPage.tsx / ForecastView.tsx.
- **Mount:** ONE line next to the forecast wind in the conditions area. The prop is `null` for now; the lead wires the real data at merge.
- **Dev-only fixture:** `?windNowFixture=asos|ndbc|stale`, read only when `import.meta.env.DEV`.
- **Copy:**
  - "Measured 14 mph W, gust 19 · Half Moon Bay airport, 2.1 km · 10:55 AM", in Pacific time using the existing clock helpers.
  - Beside it, "forecast 11 mph WNW" for that hour.
  - One muted kind note. Airport: "airfield wind, can read lighter than at the water". NDBC/NOS: "pier/shore station".
  - null → render nothing.
  - observedAt older than 2 h → "No reading in the last 2 h".
  - Never imply the forecast is right or wrong from one reading.
- **Style:** the existing 16-point direction helper and tokens. Minimal; it fits the conditions grid.

Verify:
- Run a dev server in your worktree on 5184. Headless Playwright only (channel 'chrome', headless true).
- Shoot the Mavericks spot page at 1440 and 390, light and dark, with each fixture and with none. Look at the shots yourself.
- 0 px horizontal overflow at 390.
- tsc, npm test and build.
- Stop your dev server afterwards.

Commit on wind-now-ui; the message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never merge or push other branches, and never `git branch -D`.

Before handing back, criticise your own work like a demanding designer: name the 2 weakest visual or copy points, then fix them or state them.

Handoff: message `lead` (≤250 words) and write docs/agents/handoffs/wind-now-product.md. Include:
- branch and commit;
- files;
- the mount location;
- screenshot absolute paths;
- checks with real results;
- weaknesses.

Time box: about 30 min.
