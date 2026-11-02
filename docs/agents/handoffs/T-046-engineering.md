# T-046 Engineering handoff: headline surf selector

## API (`src/services/headlineSurf.ts`, pure, read-only)
```ts
import {headlineSurf, headlineText} from '../../services/headlineSurf';
const h = headlineSurf(spotId, hour /* Forecast */, {bundle: view.ocean.bundle, nowMs: now});
const t = headlineText(h, profile);   // {value, label, words, tag, detail}
```
`h` is one of:
- `{kind:'estimate', loFt, hiFt, words, wordsNote, method:'mop-v2'|'v1', methodLabel, label, mop?}`: a range (feet), body words ("waist to chest", `null` only if unusable), the method named, `label` = "Est. at the break · model estimate".
- `{kind:'demonstration', ft, label}`: demonstration-week face height, labelled "demonstration face · not a forecast".
- `{kind:'offshore', ft, label:'offshore · not surf size'}`.
- `{kind:'none', label}`: no usable height for the hour.

Order: **v2** where a reviewed MOP point exists and has data for that hour (Ocean Beach today) and the estimate is presentable → **v1** where presentable (≥1 ft wide range, versioned method) → offshore → none. `headlineText(h, profile)` returns display strings in the user's unit and scale: `value` "4–6 ft", `label` "Est. 4–6 ft at the break", `words`, `tag` ("model estimate" / "demonstration" / "offshore"), `detail` (method line). Show `tag` and `label` with the number; never show the number without them.

## Body words (`src/services/bodyWords.ts`)
Face heights (never the Hawaiian scale), anchors from the OceanFit "simplified wave face scale" (1 ft ankle, 2 knee, 3 waist, 4 chest, 5 head, 6–11 overhead, 12 double overhead); **thigh (2.5 ft) and shoulder (4.5 ft) are not in that source, they are our in-between anchors**; University of Hawaiʻi page cited for why local-scale calls differ. Always labelled approximate (`wordsNote`). Both sources are exported as `BODY_WORD_SOURCES` for a footnote.

## Guarantees
It never feeds the rating (nothing imports it from `src/ratings`), does not change its inputs, and refuses (falls to the next tier) on missing, short-period, outside-window or too-narrow results. Tests: `src/tests/headline-surf.test.ts` (8: word edges, ranges, v2-by-default only for the reviewed point, v1/offshore/demo/none fallbacks, read-only, units). **274 tests pass**, tsc clean.

## Notes
- v2 is still unvalidated; its `methodLabel` says so. The Nearshore card's flag line ("Experimental, off by default") now describes a method the headline uses by default at Ocean Beach; I'll reword it with T-047.
- `hour` must be the hour's Forecast (`evidence.faceEstimate` is where v1 lives); `bundle` is optional (without it v2 is skipped).
