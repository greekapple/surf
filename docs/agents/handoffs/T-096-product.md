# T-096 (product): map layers popover at 390, and the t055 selector

Branch `worktree-product` (forecast-trust merged first). Checked on a freshly restarted dev server (5184).

## Cause
T-088 renamed the waves chip to "Offshore wave height · not surf size". In the 5-column chip grid that one chip took ~400 px at 390: Swell and Period overflowed and Wind was off-screen. The model-point row and the source line also had no width limit.

## Fix
- **Chip words:** Offshore waves, Swell, Period, Wind, None. Each chip's aria-label and tooltip keep the full name (FIELDS `short` vs `label`). The honest full label still leads the popover's source line and the legend, unchanged.
- **Grid:** 3 across on desktop, 2 on phones, wrapping; chips `min-width: 0`.
- **No overflow:** the popover is limited to the viewport and clips sideways; the model-point row is full width and the source line wraps.
- **Measured:** no element inside the popover overflows at 390, 320 or 1440; chips are 167×54 at 390. Clicking Wind works at every width, and only Wind is selected after it loads.
- **Also fixed (my own T-095 regression):** the 44 px header targets pushed the bar 13 px past a 320 px screen. At ≤ 360 px the header gaps are tighter and the profile link keeps 44 px. 320 and 360 now have no horizontal scroll and no header target under 44 px.

## Toolkit (backups in the product session scratchpad, `t056/toolkit-bak/*.pre-t096.mjs`)
- **t043:** picks the waves chip by accessible name (`/offshore wave height/i`), since its visible text is now "Offshore waves".
- **t055:** waits for `.hd #hd-h` (the spots section heading) instead of `.hd h1`, because Home's h1 moved into the welcome band (T-074). It tests the same thing: the Home shell is up while the data is held.

## Checks
tsc OK; unit tests 441/441; build OK; t043 54/0 (1440 and 390, including the 390 popover, Wind and Escape); t055 11/0; t047 55/0; t025 27/0; density ALL PASS; journeys 8/8.
Shots: `artifacts/t043/t096-{390,320,1440}-layers.png`.
