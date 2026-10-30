# T-022 · Surfline-led navigation, top bar and concise Home — Product handoff (2026-10-30)

Branch `worktree-product`. Commits: ccbb0fa (NAV-SPEC), a1836e7 (implementation), 65ea937 (merge of `rebuild/swello-v0.16` with T-023/T-024/T-025/T-026), then this handoff commit.
Files: `src/app/App.tsx`, `src/app/Nav.tsx`, `src/app/routes.ts`, `src/ui/app.css`, `src/features/home/{HomeView.tsx, home.css, SpotStrip.tsx}`; removed `src/features/home/Almanac.tsx`. Spec: `docs/design/NAV-SPEC.md`.

## What changed
- **Bar** (Surfline structure, Apple restraint; always solid): Swello wordmark (= Home) · Forecast · Map · Quiver · search · data status · theme · avatar (= Personal). Bar items are **links**: a click always navigates. Hover, ArrowDown or the small chevron button opens the panel. This fixes the user's "clickable things don't change anything".
  - **Forecast:** the existing Region › County › Spot place browser. Rows now use `spotStrip` (colour + "X ft offshore" / "Est."); the narrow rail shows colour + name.
  - **Map, Quiver, Personal:** Apple-style flyouts with one large lead link and line of context, then smaller links. Map's flyout has Ocean map · Compare spots · Find spots. Wind/Swell are now hidden routes chosen from the map's own layer controls.
- **No section pills:** `SubNav` is deleted. Quiver relies on T-023 (the form closes on route change).
- **Search:** one overlay. Opens with "/" or the bar; results grouped by county, each with colour + labelled height; ↑/↓/Enter/Esc.
- **Saved-spots strip** (Surfline's favourites bar) under the bar on Home and Forecast. Chips show name · colour · labelled height from engineering's `spotStrip` (T-024). `STRIP_CONDITIONS = true`, as the user approved. Includes an empty state, an "All spots" switcher on Forecast (the spot switcher) and "Edit" → Personal › Saved Spots.
- **Home:** photo hero ("Good afternoon / Hello." + one sentence, no numbers) and three entry tiles (Check a spot, Open the map, Your quiver). Removed: bulletin, next-24 chart, week matrix, windows, almanac, recommendations. Photo credits stay visible, as the photo licences require. Tile titles are stretched links, so there are no nested links.
- **Routes:** "Map" is the label; `/map` is an alias of `/explore`. `/home/spots` and `/home/windows` resolve to Home. `/scale` and `/forecast/compare` still work.
- **Phone:** the bar has the wordmark · search icon · status · theme · avatar, the strip scrolls horizontally, and the bottom tab bar (Home, Forecast, Map, Quiver, Personal) stays.

## Checks (real output)
- `npx tsc --noEmit` OK · `npm test` pass 210, fail 0 · `npm run build` built (after merging the integration branch)
- `t022-nav.mjs http://127.0.0.1:5184` (new; replaces sections-distinct): **ALL PASS** at 1440 and 390:
  - no pills on 15 routes;
  - 6 old URLs and the `/map` alias resolve;
  - Home 1.17 viewports at 1440 and 1.21 at 390 (budgets 2 and 3);
  - Home body has no forecast numbers;
  - strip empty state, then chips with labelled heights;
  - every bar link, avatar, wordmark, all 12 flyout links, a mega-menu spot, search + Enter, "/" and Escape, every strip chip, and every phone tab changes the main content;
  - console clean.
- `journeys.mjs http://127.0.0.1:5184`: **8/8**. Updated only where the UI legitimately moved:
  - **Helper:** `nav()` clicks bar links instead of opening menus.
  - **Journey 1:** was "favourite card features in the hero"; Home has no cards now, so it checks the strip chips (labelled heights, no Home numbers, the chip opens the forecast and is marked current).
  - **Journey 2:** was "Home card → Forecast"; it now checks search → Forecast with `?spot=`, the switcher and reload.
  - **Journey 4:** no bar spot picker on Explore, so it reads Explore's own heading.
  - **Journey 6:** Preferences is reached through the avatar flyout, and the metres check moves to the Forecast readout because Home has no numbers.
  - Journeys 3, 5, 7 and 8 are unchanged.

## Screenshots (looked at)
`~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t022/`:
- Side-by-sides with Surfline/Apple: `side-1440-home.png`, `side-1440-mega.png`, `side-1440-search.png`, `side-1440-flyout.png`, `side-390-home.png`, `side-390-search.png`
- Plus `1440-home.png`, `1440-forecast.png`, `390-home.png`, `390-search.png`

## Bugs found and fixed while verifying
- Class collisions: my `.strip` collided with the old day-strip `.strip button` (renamed `favbar`), and `.chip-c` with the Condition chip, which broke the "Not bad" chip (renamed `cdot`).
- Nested links in Home tiles (React hydration warning).
- Duplicate React keys in search groups.
- The avatar was hidden on phones.
- Double clear button in phone search.

## Notes / incomplete
- The store writes `?spot=` only for non-default spots (existing behaviour); opening Ocean Beach from a chip leaves the URL without `?spot=`.
- Surfline spot pages were not captured (Cloudflare bot check, not bypassed), and neither was the signed-in favourites bar (no login); see NAV-SPEC.
- Journey 4 takes about 33 s because its `.xc-photo` read waits out a timeout before Explore's panel shows; it passes, but could be tightened.
