# T-028 Engineering handoff: labelled Media component + AI asset slot

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first). Commits: `5bd0caa` (Media), then the two follow-ups in a second commit.

## API (small)
```tsx
import {Media} from '../../ui/Media';
<Media id="ocean-beach-seal-rocks" className="hero-img" eager hideCredit sizes="100vw" />
```
- `id`: a manifest id (`public/media/manifest.json`) or the id of any built-in CC photo. Props: `className`, `eager` (load now; use for the top image), `hideCredit` (photos only), `sizes`.
- It renders a `<figure>` that fills its box (`object-fit: cover`); **size it from the parent via `className`** (width/height/aspect-ratio).
- Photo: lazy image with `srcset`, focal point as `object-position`, visible credit line "Photographer · Licence".
- Video entry: looping muted `playsInline` clip, mounted only when near the viewport, poster is the image `sources`. `prefers-reduced-motion: reduce` shows the poster only (live-updates).
- AI entry: always shows "Illustration · AI-generated, not current conditions"; the credit line is replaced by it and cannot be hidden. If its asset fails to load, it swaps to its `fallback` photo, which then shows the photo's own credit and no AI caption (honest: the image is a photo again).
- Unknown id, manifest absent: built-in CC photos still resolve; an id found nowhere renders nothing (no blank box). Manifest is fetched once, so assets can be added without a rebuild.

## Manifest entry shape
`{kind: 'photo'|'ai-illustration', alt, sources: [{src, width}], video?: {src, type}, focal: [x%, y%], credit, licence, licenceUrl?, source?, caption?, fallback?}`.
AI entries need `caption` exactly equal to `AI_CAPTION` and `fallback` = a photo id. The manifest now holds the 13 existing CC photos (`kind: 'photo'`, real credits/licences from `photos.ts`). **No AI entries yet**: there are no Higgsfield assets, so none are invented. To add one, add an entry and drop the file under `public/media/`.

## Files
New: `src/ui/Media.tsx`, `src/ui/media.css`, `public/media/manifest.json`, `src/tests/media.test.ts`, plus **`src/ui/mediaModel.ts`** (not on your list: the pure logic—types, `AI_CAPTION`, `resolveMedia`, `entryProblems`—lives here because the Node test runner cannot import a `.tsx`).

## Tests (5 new)
Every manifest entry has kind/credit/licence/alt/focal; **no AI entry lacks the caption or a fallback photo**; the check itself is proven to fail on an AI entry with no/changed caption, missing/non-photo fallback, empty licence, bad focal; captions and credit line; CC-photo fallback with no manifest.

## Follow-ups
1. **Sunrise dedupe:** new `src/ocean/sun.ts` `solarTimes(dateKey, lat, lon, zenith = 90.833)`; `features/forecast/helpers.ts` `sunTimes` and `services/spotReport.ts` both call it (same maths, `sin(-0.833°)` = `cos(90.833°)`). Spot-report tests (sunrise/sunset/DST) unchanged and passing.
2. **Removed `.qv-grid` and the `.qv-card` / `.qv-card-stage` / `.qv-card-meta` rules** (only used by the old grid; `qv-card-spec`/`-id` are live and kept).

## Checks
`tsc` clean; `npm test` 215 pass, 0 fail; `npm run build` built. **Not verified in a browser**: nothing renders `<Media>` yet (T-027 will), and I did not run journeys for the CSS/sun refactors. Forecast sunrise lines use the same formula; please eyeball them when T-027 lands.

Not merged or pushed.
