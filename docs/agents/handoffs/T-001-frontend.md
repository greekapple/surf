# T-001 frontend handoff

## Files changed
- `src/features/home/HomeView.tsx` (`Week` only): added `data-day` ("Thu 29") on each `td`, and explicit ARIA table roles (table/rowgroup/row/rowheader/cell) so semantics survive `display:block/grid` in Safari. Data logic untouched.
- `src/features/home/home.css`: inside `@media (max-width: 860px)` the table is turned into blocks. One block per spot: spot name as a full-width heading, then a 2-column grid of day cells, each labelled by `td::before { content: attr(data-day) }`. Header row is visually hidden (still in DOM). Empty cells are hidden. `.week` loses its horizontal scroll. Desktop rules are unchanged.

## Commands and results
- `npx tsc --noEmit -p .`: OK
- `npm test`: 130 pass, 0 fail
- `npm run build`: built OK (chunk-size warning only)
- Playwright (`playwright-toolkit/swello/t001.mjs`), dev server 5180:
  - 390x844 mobile: page overflow 0, no element in `.week` beyond viewport, week scrollWidth-clientWidth 0, 18 cell buttons, 1 `.best`. Clicking the first cell goes to `/forecast?spot=bolinas`.
  - 1440x900: overflow 0, 18 cells, 1 best, table layout as before.
  - Console errors: 2 per page load (not inspected individually; presumably the known NDBC CORS).

## Screenshots (`/Users/milosin/Development/ai-system-setup/playwright-toolkit/swello/artifacts/T-001/`)
`mobile-full.png`, `mobile-week.png`, `desktop-full.png`, `desktop-week.png`. I viewed the two week crops (mobile and desktop); I did not view the full-page images.

## Not verified / open issues
- The 2 console errors were not confirmed as NDBC-only.
- Screen-reader behaviour not tested; the button `aria-label`s are unchanged and carry spot, day, time, rating, height.
- Mobile is long (3 spots x 4 rows of 2 days); a denser layout is possible if the lead prefers.
- The mobile block separator uses `var(--line)` and the sticky bottom bar overlaps the full-page capture (capture artefact).

## Correction cycle 1
- `HomeView.tsx`: added `role="columnheader"` to all thead `th` cells (including the sr-only "Spot" header).
- `home.css`: `.week td::before` keeps `content: attr(data-day);` as fallback, followed by `content: attr(data-day) / "";` (empty alt text, so the day is not announced twice).
- Results: `tsc --noEmit` OK; `npm test` pass 130, fail 0. Browser not re-run (CSS fallback/alt-text change only).
