# T-067 (product): this-week grid, breaker label, de-AI pass 2, privacy

Spec: `docs/specs/2026-11-02-references-round.md` §1, rows 1, 3, 5 and 6. Branch `worktree-product`: 05594bf (grid), 046c8bb (breaker, de-AI, privacy), 3fea65d (the Codex fix for 4cb6b48, which can be cherry-picked separately), then the final commit with this handoff.

## 1. Home "This week" grid (`src/features/home/WeekGrid.tsx`)
- **Layout.** Rows are spots (saved or popular first, then the nearest others by distance, up to 8). Columns are 8 days (Today, Tue 3, …).
- **Cells.**
  - The day's surf range comes from `dayRange` (the T-057/T-064 day logic, daylight hours only).
  - Under it is a three-part AM/midday/PM bar (7, 12, 5 o'clock): rated parts in their band colour, dark parts in a night tone and unrated, missing hours grey.
  - A soft curve of the daily estimate midpoints runs faintly behind each row (estimate days only).
  - Offshore-only days are muted "7 off". Their accessible name says "surf estimate unavailable, offshore up to 7 ft", never styled as surf.
  - A tap opens that spot at the day's representative hour (`dayRange().typical.atIso`).
- **Layout by width.** At 1440 it is a full-width table above the cards. At 390 it scrolls sideways with the spot names pinned.
- **Nearby rows** come by distance, not rating, because after dark the "best right now" ranking is empty.
- **No Surfline home reference** to compare against: `21-surfline-home/` doesn't exist yet. Shots are in artifacts/t067/.

## 2. est. breaker type
- The SURF card shows "est. breaker type: Spilling (soft, slow-breaking)" from `callFor().breaker` (`BREAKER_WORD`), only when the type isn't 'unknown'.
- To keep the first screen, the SURF source line is now just "model estimate". The method (CDIP nearshore point, v2, unvalidated) is in its title and screen-reader text, and stays in Sources & data.

## 3. De-AI pass 2 (taste-skill app-screens + tells)
- **(a)** Rating reasons are a condition dot + "Swell size good · Wind fair · Swell quality good" (card and detail). There are no ✓/✗ glyphs; the inspector had flagged them as emoji.
- **(b) Copy audit:**
  - My UI copy has no em dashes in sentences and no "not X, it's Y". A lone "—" for a missing value stays (the skill asks for it).
  - Engineering-owned strings still have em dashes: `services/measurementStatus.ts` ("Simulation — Not Actual Forecast"), `ratings/provisional.ts` reasons, and `services/spotReview.ts` (a doc). I didn't edit them; flagged for engineering.
- **(c) Face:**
  - **Ground:** light ground `#f5f8f7`, a sea-foam off-white, replacing pure #fff. This supersedes the 2026-10-30 "minimal white" note, per this approved spec. Cards stay white.
  - **Lines:** opaque hairlines `--line #e4e8e7`, `--line-2 #d2d7d6`. The old 8%-black ones read as #000 to the inspector.
  - **Mark:** a SWELLO mark (a breaking curl) before the wordmark, in the surf-band data hue `--hs-hi`, so the brand and the main series share one hue.
  - **Signature element:** the surf-band graph and the wave scale on the spot page, and the week grid with its size curve on Home.
- **Inspector fixes:**
  - no text shadows (the photo scrims carry legibility);
  - no edge-fade gradient on scrolling tables;
  - tracked-uppercase labels made sentence case;
  - "Not rated" in readable grey;
  - grid cells top-aligned (no blank bands);
  - the phone wordmark on the 16 px margin.
- **(d)** Typeface untouched (the lead is trialling it with the user).
- **`inspect.mjs --app` results** (dev server, 1440/768/390):
  - **Spot, before:** 5 fails (micro-label, emoji ✓, gradient, text-shadow, contrast "Not rated" 2.2:1) and 5 warnings.
  - **Spot, after:** 0 fails, 3 warnings:
    - dev-server;
    - tiny-text 66% under 13 px: these are 12 px sublines and source notes, which the skill allows. Raising them pushes Tide out of the first screen.
    - panel-void: fixed by top-aligning, but it may still flag the swell/rating cells beside the taller scale card.
  - **Home, before:** 1 fail (text-shadow) and 3 warnings (dev-server, heavy borders, wordmark at the phone edge).
  - **Home, after:** 1 fail and 1 warning (dev-server). The fail is `covered-text` at 768/390: the fixed bottom tab bar covers a card's "6–13 ft" at one scroll position. That is the app's standard phone tab bar, and the text scrolls clear, so it is defended.

## 4. Privacy (`src/ui/Legal.tsx`)
- "What stays on your device" lists every local-storage key and the IndexedDB clip store, grouped by purpose.
- "Services the app contacts" lists:
  - Open-Meteo, NOAA CO-OPS/NDBC/ERDDAP and CDIP (through SWELLO's server);
  - the NWS alerts API and Esri tiles (direct from the browser, so they see the IP address);
  - live cam links, which open the owner's page.
- Last updated is November 2, 2026.

## Codex fix (3fea65d), for the lead's 4cb6b48 review
- [P1] The graph band, tooltip and slider use estimate points only.
- [P2] periodFit gets a mapped kind and the board length.
- [P2] Felt right? is per displayed hour.
- [P2] The NWS banner refreshes every 15 min and drops expired alerts.
- Tests in `src/tests/trust-ui.test.ts`; t065 also asserts no band on an offshore-only spot.

## Checks (5184)
- tsc OK; unit tests 367/367; build OK.
- New `t067-week-face.mjs` ALL PASS at 1440 and 390:
  - 8 day columns with "Today"; 3–8 rows; the AM/midday/PM bar in every cell;
  - offshore days muted and labelled; estimate cells as surf;
  - the curve; a cell opens that spot and day;
  - no check marks and reasons in words; the breaker label; the mark; the tinted ground;
  - Privacy keys and services; no overflow; console clean.
- t045 ALL PASS; t065 ALL PASS; t047 ALL PASS. t047's ranking switch failed once while I was editing files during the run and passed on rerun.
- Final run: t045 54/0, t047 55/0, t065 52/0, t067 30/0, density ALL PASS, journeys 8/8.

## Typeface (user decision, 2026-11-02, added to T-067)
- **Self-hosted:** Instrument Sans (SIL OFL 1.1), `public/fonts/instrument-sans-latin-var.woff2`, 76 KB. It is a Latin subset of the variable TTF (wdth 75–100, wght 400–700), converted with fonttools in a scratch venv, not a project dependency. The font's own OFL text is in `public/fonts/InstrumentSans-OFL.txt`. `public/fonts-trial/` is not committed.
- **Applied:** `--display` is now 'Instrument Sans' with an Inter fallback. It covers the wordmark, page h1s, spot names (band, Home cards, nearby, week grid), section titles (This week, Popular spots, Sources & data, What did you see, Board Match and board-room names) and the Call's verdict word. This is an explicit list in `src/ui/app.css`, because feature styles set Inter with the font shorthand. Tracking is −0.025em on large titles and −0.03em on the wordmark. Inter stays for body, numbers, tables and charts; the Call's window times are Inter too.
- **Proof:**
  - In Chrome, `document.fonts` reports Instrument Sans loaded (HTTP 200 for the woff2), and `check("700 28px 'Instrument Sans'")` is true.
  - The spot h1 and the verdict use it; the surf number and the window times use Inter.
  - Inspector: Home is 91% Inter / 9% Instrument Sans; Spot is 99% Inter (headings only). There's no fallback flag.
  - At 1440/390: no new wrapping, and t045's first-screen checks still pass.
- **t047:** its "one font family on Home" check encoded the old Inter-only decision. It now checks "two faces: Instrument Sans for headings, Inter for numbers" (backup kept).
- **Inspector after the font:** Spot has 0 fails and 3 warnings: dev-server, tiny-text, and ragged-row, which is the trade-off of top-aligning cells (it removed panel-void). Cells have hairline tops and no boxes, so ragged bottoms don't show. Home has 1 fail (covered-text, the fixed phone tab bar, defended) and 1 warning (dev-server).
- **Checks after the font:** t045 54/0, t047 ALL PASS, t065 52/0, t067 30/0, density ALL PASS, journeys 8/8; tsc OK, unit tests 367/367, build OK.
