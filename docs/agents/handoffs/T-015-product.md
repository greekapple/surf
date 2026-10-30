# T-015 · Forecast polish + D-05 — Product handoff (2026-10-30)

Branch `worktree-product` (synced with `rebuild/swello-v0.16` at 1d5ee66 first), dev port 5184. Only `src/features/forecast/*` changed.

## What changed
- **Tooltip** (`charts.tsx`, `forecast.css`): each row has an icon, a label and a value with its unit. The rows are Offshore Hs, Swell (`3.1 ft · 13 s · from S`), Wind (`10.9 mph · from NW`), Tide (`+4.5 ft · falling`) and Rating (chip plus `score 74/100`, where the score used to be a bare number). The tooltip is 236 px wide so the rating row stays on one line.
- **Wave-scale slider** (`ForecastView.tsx`, `forecast.css`): a horizontal range input along the bottom of the photo, next to the big value. It works by drag, arrow keys and Home/End, since it's a native `<input type=range>`. Its accessible name is "Illustrative wave face height", and it now has `aria-valuetext` ("5 ft face, illustrative", or m when metric).
- **Period labels** (`charts.tsx`): a day needs only 34 px (was 70), so 390 gets labels in 7 Days too. When a day's swell is falling, the peak is its first hour on the plot edge; the dot stays there and only the label is pulled inside the plot. Before, the label was dropped, so days 4–6 at 390 had none. Labels are kept 34 px apart.
- **D-05** (`helpers.ts`, `charts.tsx`): `monotonePath` returns `M x,y` for a single point (it used to return `''`). The chart's area fills use `areaD`, which is undefined when there is no line. Previously `'' + ' L…Z'` gave a `d` without M. That happens when the animated window sits past the series (`vis` empty) or a day has one hour (`TideDay`, `Spark`).

## D-05 status (honest)
I could not reproduce it on this build with today's data, either with the audit steps or with the End key on the last hour (`t015-probe.mjs`). The audit says the errors appeared only during the transition and the chart then recovered. Both repros are asserted in `t015-qa.mjs`, which samples the SVG every 80 ms during the range animation, checks every tab and listens to the console. The code paths that can emit a `d` without M are now guarded. Negative rect widths: every computed width in these files is already `Math.max(0, …)` or positive by construction; none were seen.

## Checks (real output)
- `npx tsc --noEmit`: OK
- `npm test`: pass 167, fail 0
- `npm run build`: built in 1.54 s
- `node journeys.mjs http://127.0.0.1:5184`: 8/8 journeys passed; no unexpected browser errors
- `node t015-qa.mjs` (`~/Development/ai-system-setup/playwright-toolkit/swello/`): ALL PASS
  - 1440 D-05 last day → 7 Days: SVG clean, console clean
  - 390 D-05 Home week cell "Ocean Beach, Wed 7 AM" → Forecast: SVG clean, console clean
  - Tooltip: 5 rows, each with an icon and a label
  - Slider 239×32 (horizontal): Home 2, → 2.5, End 20, ← 19.5, drag 5; name and valuetext present
  - 390 period labels: 1 per day in Day view (days 0–6), 3–4 in 7 Days; none clipped, none overlapping, 11 px
- Baseline before the changes: 6 FAILs (no tooltip icons, vertical slider, period labels dropped and the script's own false "clipped"; see below).

## Screenshots (looked at)
`~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t015/`: `1440-d05.png`, `1440-tooltip.png`, `1440-wavecard.png`, `390-d05.png`, `390-swell-day.png`, `390-swell-7days.png`, `cmp-1440.png` and `cmp-390.png` (live next to `00-target/forecast.png`). Before-change shots are in `artifacts/t015-before/`.

## Incomplete / notes
- No unit test for the `monotonePath` single-point case: tests live in `src/tests/`, outside my owned files. It's a one-line test if the lead wants it.
- At 390 the hero photo credit sits right under the range buttons. That was already the case and is outside this task.
- The first run of the script measured `#tlclip rect`, which returns an empty box inside `<defs>`; it now derives the plot bounds from the viewBox.
