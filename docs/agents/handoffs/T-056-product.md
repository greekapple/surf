# T-056 (product): Quiver, properly (D6) + less "AI" (D8, D5) + Map (D4)

Branch `worktree-product`, local commits only: 22b8534 (quiver), c572205 (forecast), the map commit, 50b65fd (merge of rebuild/swello-v0.16 with T-055 and T-054), 576f1ed (dayRange + Home), plus this handoff.

## Quiver (D6)
- **White shortboard cutout.** New `src/features/quiver/cutout.ts` replaces the T-053 white-to-alpha cutout, which erased the lit left rail. The lit rail is brighter than the seamless backdrop.
  - The board is now found as a silhouette:
    - a backdrop model per pixel;
    - extents from sharp horizontal edges only, so the soft floor shadow and vignette don't count;
    - the stringer as the axis, else the median midpoint;
    - each row takes the wider of its two sides, so a washed-out rail takes its mirror;
    - the outline is kept convex;
    - a swallow notch stays open.
  - Inside the silhouette is opaque in the image's own (levelled) colours, with an anti-aliased edge and a thin rail line, so a white board keeps its outline on the light wall.
  - Checked on all six illustrations. If no believable board is found, the masked JPEG fallback is used, as before.
- **One floor.**
  - Every board stands on one floor line at 0′ at true scale: labels have a fixed height and the selected board is no longer lifted.
  - The floor band starts at the tails. t053: ruler 0′ offset −1.0 px; the 5′10″ fish measures 5.82 ft at 1440 and 5.85 ft at 390.
- **Caption.** "Illustration · AI-generated" now sits only above the selected board; the full caption is in its title and the alt text. It is no longer stuck top-left.
- **Arrows.** They are now light, inset past the ruler at 1440 (left 76 px) and at 50 px on phones, so no ruler label is covered.
- **Balanced wall.** Boards are spread evenly (`space-evenly`), so there's no dead half. The fit chips are now a coloured dot and a word.
- **Duplicate title removed.** The giant greyed title and the annotated stage below the wall are removed (`Stage.tsx` deleted, its `qc-*` CSS dropped). In their place is a quiet hairline spec row, `section.qv-selected.qv-spec`: name, one fact line, then Length/Width/Thickness/Volume/Fins/Tail (shown as "36 L"), the Board Match line and the actions. Values are as recorded; "Not recorded" where missing.
- **Board room.** The header is the plain name, one fact line (type · maker · Example board) and today's size fit ("Edge of its range today · fish range a–b ft"), with no chips. The board was already large in frame, so the stage is unchanged.
- **Phone strip.** Thumbnails are scaled to fit their 64 px buttons; the longboard no longer spills.

## De-AI pass (D8) + D5
- **Spot page cards.**
  - No icons and no UPPERCASE labels: sentence-case 14 px labels.
  - Cells are separated by hairlines instead of boxes.
  - "Model estimate" appears once, as quiet text on the SURF value ("model estimate" plus the method on wide screens), instead of a pill. The page meta line says "heights are model estimates · ratings provisional".
  - The shore relation is a coloured dot and word, not a pill.
- **Links.** "Board Match" and "Full wave scale" are plain text links without arrows.
- **Lower page.** The day strip and lower sections use hairlines instead of cards. Spacing is on an 8-pt rhythm (24/32 desktop, 16 phone).
- **D5.**
  - The spot name is visible in the photo band at 390 (name, meta, then hour · star · Now).
  - The SURF title isn't truncated, now that the pill is gone.
  - The Wave scale card is full width with no empty half.
- **Wave scale card (lead addendum).** When `useHasSpin(band)` is true for the estimate's band (`selectScaleBand` on the estimate), the card shows `posterPath(band)`:
  - 4:3, rounded, the drawn chart as a small inset;
  - "3D illustration · approximate scale" and "<band> wave · surfer 1.75 m";
  - a tap opens /forecast/wave-scale.
  - Otherwise the drawn panel is unchanged. `src/features/scale/*` is untouched.
  - Verified by layout only. My worktree has no frames; the lead's checkout has untracked 1-2, 2-3 and 4-6. Today's estimate (5–11 ft) is in the 8–10 band, which isn't rendered yet. For one local screenshot I put the 4–6 render in an 8-10 folder, then deleted it; nothing under public/media/scale3d is committed.
  - The "surfer 1.75 m" text is the lead's wording. Please confirm it matches the render.
- **Day cards (engineering request).** They use `dayRange` from `src/services/spotHour.ts`, so they come from the same engine as the SURF card. The demo week, which has no estimate or offshore height, keeps its labelled typical face.
- **Home.**
  - No coloured card tops or green side bars.
  - Height labels ("model estimate", "offshore") are quiet text instead of pills. Every height is still labelled (t047 and journeys assert it).
  - The rating word has no pill.

## Map (D4)
- **One search per page.** The map's own "Search spots" box is now a plain "Spots 45" list toggle at 1440, and the phone sheet's search field is removed. The header search is the only one.
- **"Loading model…" clears.** The model loads in about 3 s today. If it hangs, after 20 s the chip says "Sea colour is not loading right now · spots and forecasts still work · Retry" (calls `spatial.retry()`) instead of loading forever. Data logic is unchanged.
- **Phone attribution.** One line, 18 px tall (was 31). Tap or Enter expands the full credits; links work once it's open.

## Checks (5184)
- tsc OK; unit tests 315/315; build OK.
- t053-wall 9/0, t025 27/0, t035 29/0, t045 53/0, t047 55/0, t043-map 54/0; density (t034, tag t056) ALL PASS; journeys 8/8 (journey 5 included).
- After shots: `playwright-toolkit/swello/artifacts/t056/{quiver,showroom,forecast,map,home}-{1440,390}.png`; before = `artifacts/audit-1102/`.
- **Toolkit edits** (backups in the session scratchpad):
  - t025 and journeys: `.qv-cine` → `.qv-spec`.
  - journeys and t043-map: the list toggle is `.xlist-t[aria-expanded=false]` instead of the "Show spot list" button.
  - t043-map: the in-map search filter test is replaced by "the map adds no second search box", and the chrome luminance check uses `.xlist-t`.
  - `t032-shots` / `t032-first` still read the removed `.qv-cine`. They're retired T-032 scripts and weren't updated.
- **Journey 5:** it waits for `.qv-spec`, which this branch provides (the spec row with "36 L"). It fails on rebuild only because this branch isn't merged yet.

## Not done / for others
- Every spot reading "Solid" (D3) is the T-055 rating calibration, not product.
- The longboard illustration's heavy stringer is unchanged; it's in the image.
- The map's phone peek still has the "Solid" pill and a blue "Open forecast" button; the de-AI pass covered Forecast and Home.
