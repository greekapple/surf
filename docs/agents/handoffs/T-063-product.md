# T-063 (product): Live cam links + surf-analysis shell

Branch `worktree-product`, local commits only. I merged rebuild/swello-v0.16 (cabb95c) first. `src/features/scale/*` and the Wave scale card are untouched.

## 1. Live cam links (links only)
- **Data.** `src/data/cams.ts` lists each cam's spotId, owner, operator, URL, what it shows, verified date and how it was verified.
- **Log.** `docs/forecast/CAMS.md` has the rule, the linked cams, and every candidate checked and skipped, with the reason.
- **Verification.** Each candidate's owner page was opened in real Chrome (Playwright), looking for a working player.
  - **Linked (1): Morro Rock.** "Live cam · Morro Bay National Estuary Program" → https://mbnep.org/baycam (camera run by 805 Webcams). HTTP 200, a live YouTube stream "Morro Bay Rock and Harbor Webcam - 805 Webcams" is playing, on-screen clock 2026-11-02 12:27 PM. It shows the Rock and the harbour, not the surf side. The link's title and aria label say so, as does CAMS.md.
  - **Skipped:**
    - Huntington: surfcityusa.com returns 403 to automation, and the hdontap stream says "no longer available".
    - Oceanside: the San Diego Web Cam domain only redirects.
    - morrobay.org: no player rendered.
    - Pismo: no owner URL found.
    - SF Ocean Beach and Imperial Beach: aggregators only.
    - Scripps Pier: a different spot, and the connection was refused.
- **Spots searched.** Only those listed in CAMS.md; the rest of the 45 weren't searched in this pass. Firecrawl needs a paid key, so I used web search plus a browser check.
- **UI.** The link is a quiet text link in the spot band (next to Now and Map; its own row on phones). It opens in a new tab with `rel="noopener noreferrer"`. Nothing is embedded.
- **Also fixed.** On phones, the coastline-plan band's credit overlapped the star. It's now one line at the top right ("Natural Earth coast, approx."; the full text stays on wide screens).

## 2. Surf analysis
- **Plan:** `docs/product/SURF-ANALYSIS-PLAN.md`, from vault note 17 (the only note read).
  - Phases 0–5 with where each runs, its cost and what it needs.
  - Privacy: opt-in, blur others, no raw footage kept, and clips aren't in the backup until the user is asked.
  - What needs the user's approval: a pose library, an AI vision API or on-device model, keeping clips off the device, the note 09 change, and the cam site, legal review and FCC.
  - **The note 09 conflict** ("never identify, track or store individual surfers"): phases 0–1 don't conflict. Phases 2 and up need a dated, user-approved change to note 09; I propose wording in the doc.
- **Shell:** `src/features/personal/Clip.tsx`, in Personal › Surf journal. Each logged session has "Add a clip".
  - **Storage.** Pick a local video. It is kept in IndexedDB on this device and never uploaded; the t063 check asserts no request carries it. If the browser won't store it, the panel says "kept only for this visit… gone after a reload".
  - **Player.** Play/Pause, ±1 frame (30 fps assumed), a scrub bar with time. Keys: Space, comma/period (Shift = 1 s), M marks. It handles recorded WebM that reports no duration.
  - **Rides.** "Mark ride start", then "Mark ride end". Each ride is listed with jump-to and Delete.
  - **Stats.** Rides, longest, average and time riding, from the hand marks only ("nothing is detected automatically").
  - **AI row.** "AI analysis · Coming: needs your OK first", with nothing behind it.
  - **Reload.** The clip (IndexedDB) and marks (localStorage) come back. If the clip is gone, the marks still show, with a note. "Remove clip" clears both.
  - **Width.** On desktop the player sits in the journal's list column, about 360 px wide inside the 720 px Personal page. That's fine for a shell; it needs a wider layout if this becomes a real feature.

## Checks (5184)
- **New `t063-cams-clip.mjs`, ALL PASS at 1440 and 390:**
  - the cam link on Morro Rock: label, href, new tab, noopener, nothing embedded, tappable; no link on Ocean Beach, Linda Mar or Huntington;
  - Add a clip: a 4 s WebM recorded in the page, about 4 s long; +1 frame ×15 = 0.5 s;
  - two hand-marked rides → stats 2 / 1.5 s / 1.2 s / 2.5 s; the AI row;
  - reload keeps both; Remove clears;
  - nothing uploaded, no overflow, clean console.
- The first t063 run timed out once on a cold dev server (the page was still compiling); the warm rerun and the suite run both pass.
- tsc OK; unit tests 327/327; build OK; t063 42/0; t045 53/0; t041-sessionlog 23/0; density (tag t063) ALL PASS; journeys 8/8.
- Shots: `playwright-toolkit/swello/artifacts/t063/` ({1440,390}-cam-band, -clip).
