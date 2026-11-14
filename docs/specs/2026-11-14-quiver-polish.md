# Quiver polish spec (2026-11-14)

Status: design review, ready for the engineering session. Level 2 (UI and interaction; no forecast numbers change).
Scope: `src/features/quiver/` (`QuiverView.tsx`, `Rack.tsx`, `BoardRoom.tsx`, `studio.ts`), `src/data/referenceBoards.ts`, quiver CSS.
Evidence: screenshots of the dev build, light theme, in the session scratchpad `quiver/` folder: `p-quiver-top|full|3d.png` (390) and `w-quiver-top|full|3d.png` (1440). Quality bar: `look2-1440-home.png`, `look2-390-home.png`, `fc-1440-0.png`.
Method: screenshots plus a structural skim of the code. Nothing was run in a browser for this review, so causes marked "likely" must be confirmed by the implementer before fixing.

## 1. What a finished quiver lets a surfer do

1. See all their boards together at true relative size, and know at a glance which one is theirs to take.
2. Get the answer first: "which board for today (or the hour I picked) at my spot, and why", in one line, with the same wording and condition colours as Home and Forecast.
3. Open one board and read its numbers (length, width, thickness, volume, fins, tail, construction) without entering an edit mode.
4. Turn that board freely in 3D with a finger or mouse: any side, the bottom, the rails, close up.
5. Compare two boards side by side at true scale.
6. Add a board in under a minute, and edit or remove one later, with an explicit save.
7. Tell at a glance what is theirs, what is an example, and what is approximate (the 3D shape, the size-only match).
8. Do all of the above one-handed on a phone, with nothing hidden under the tab bar.

## 2. Top problems, ranked

P1. **The quiver does not lead with an answer.** Home opens with "Stinson Beach is your best bet... Take your Everyday shortboard". The quiver opens with a rack, and the verdict is a small grey sentence under the spec row ("Board Match: est. 24-29 ft at Ocean Beach is above its range...", `w-quiver-full.png`, `p-quiver-full.png`). All four boards repeat the identical chip "Surf above its range", so the one useful fact (nothing in this quiver fits today) is said four times and never stated once. Compared with Home and with Surfline's habit of putting the condition verdict at the top of every spot page, this page has no headline.

P2. **3D is not felt as 3D (user complaint b).** The stage presents itself as a slideshow: a "1 / 6" counter with arrows, six angle thumbnails, an "Angles" tab selected by default (`p-quiver-3d.png`, `w-quiver-3d.png`). `studio.ts` does have OrbitControls, but on phones a sideways swipe over 50 px is captured to step the angle (`BoardRoom.tsx` `onUp`), `touch-action: pan-y` is set on the canvas, and the polar angle is clamped (`maxPolarAngle = 1.5`), so the bottom cannot be reached by dragging at all. Nothing tells the user that dragging works.

P3. **Phone 3D stage is broken-looking (includes user complaint a).** In `p-quiver-3d.png`:
   - the board is cropped at the left edge and nearly invisible (cream board on a cream set, heavy blurred shadow larger than the board);
   - two dark grey translucent pills (counter, toolbar) sit on the stage; they are off-system (RULES: pills only for true toggles, no glass);
   - the sticky "Today / Open Board Match" bar and the floating tab bar stack to about 170 px of an 844 px viewport and cover the spec rows ("Length" is cut in half);
   - the meta line wraps and clips: "Example board (retail model)" is cut off under the bar.
   - "Little blue things below the boards": likely the four hotspot buttons (`.br-hot`, fins/tail/nose/rail), which are shown for 4 s after a touch (`hot-on`) and positioned from projected anchors; when the board is cropped or the anchors project below the hull they float under it as unlabeled dots. Second candidate: the blue selected-name underline in the rack. Confirm which on a real phone width before fixing.

P4. **Two pages for one thing.** "My boards" (rack + read-only spec) and "Showroom" (3D + a full configurator) have different titles, different layouts and duplicate the name, maker line, match sentence and dimensions. "View in 3D" is a mode switch, and once there the right column is a form of steppers ("Inspect and configure one board"), so looking at a board and editing it are the same screen. Dimensions that the surfer measured once are presented as +/- controls permanently.

P5. **Desktop composition is thin next to Home and Forecast.** `w-quiver-full.png`: the rack is good (the ruler is the one distinctive idea) but the page ends at 940 px with a third of the viewport empty; the prev/next arrows are shown although all four boards fit (dead controls); the selected state is only a thin blue underline; three equal-weight buttons close the page. `w-quiver-3d.png`: a small low-contrast board in a very large empty stage, visible stair-stepping on the rail edge, and the angle thumbnails plus the board rail fall below the fold and collide.

P6. **Example boards carry a real brand.** "Firewire Seaside (Helium) · Example board (retail model)" appears as the board's maker line on both pages. See section 5.

P7. **3D render quality.** White board on a white set with no edge definition; shadow reads as a smudge; aliased silhouette. The 2D rack drawings currently look better than the 3D model, which reverses the intended hierarchy.

## 3. Target layout

One Quiver page. The 3D viewer is a state of the selected board (deep link `?board=<id>&view=3d`), not a second page with its own title. Title stays "Quiver" (matches the nav); drop "My boards" and "Showroom".

### Desktop (1440)

```
Quiver · 4 boards                                        [+ Add board]
---------------------------------------------------------------------
TODAY AT OCEAN BEACH  est. 24-29 ft · 13 s                (verdict band)
None of your boards fits by size. Closest: Bigger-day option (to 12 ft).
Size only; wave shape unknown.            [Change spot / hour]
---------------------------------------------------------------------
| ruler |   board    board    BOARD(selected)    board            |
|       |   name     name     name               name             |
|       |   5'11     5'10     8'0                6'6              |
---------------------------------------------------------------------
Small-day fish     Fish · Example                 [2D | 3D] [Compare] [Edit]
+----------------------------------------+  Length   5'11"
|  stage: 2D outline or 3D viewer        |  Width    22 3/4"
|  (drag to turn)                        |  Thick    2 3/4"
|                                        |  Volume   41.1 L
+----------------------------------------+  Fins Quad · Tail Swallow
                                            Fit today: above its range (1-5 ft)
```

- Verdict band: one sentence, the pick or an honest "none fits", using the existing Board Match output and its existing caveat ("by size; wave shape unknown"). No new numbers.
- Rack keeps the ruler. Per-board fit chips stay only when they differ between boards; when all are equal the verdict band says it once. Arrows render only when the rack overflows. Selected board: full contrast plus name in weight 600; others at reduced contrast. Keyboard: arrow keys move selection.
- Detail region below the rack, two columns: stage (about 60%) and a read-only spec list separated by 1 px rules (no cards). The stage shows the 3D viewer directly on desktop; 2D remains as a toggle and as the loading state.
- Edit opens the existing controls (steppers, fins, tail, construction, colour, Save/Discard) in place of the spec list. Read mode never shows steppers.
- Empty state (no boards): the ruler with a ghost outline and one "Add your first board" action; examples are offered, not pre-installed as if owned (see section 5).

### Phone (390)

```
Quiver · 4 boards            [+]
Today at Ocean Beach 24-29 ft
None fits by size. Closest: ...
--------------------------------
[ stage, 1:1, full width      ]
[ selected board, 2D | 3D     ]
( o o o o ) board strip, 56 px thumbs with names
--------------------------------
Small-day fish · Fish · Example
Length 5'11"  Width 22 3/4"  Thick 2 3/4"
Volume 41.1 L Fins Quad      Tail Swallow
[Compare] [Edit]
```

- One stage; the board strip under it switches boards (horizontal scroll, 44 px targets, names visible, not just thumbnails).
- No sticky "Today" bar: the verdict band at the top replaces it. Only the tab bar floats, and the page has bottom padding equal to tab bar height plus safe area so the last row is never covered.
- Stage controls are two plain icon buttons (reset, full screen) in the stage corner, solid surface, 44 px. No dark translucent pills, no counter.
- Full screen on phone gives the viewer the whole viewport with a close button; this is where pinch and two-finger gestures have room.

## 4. Interactive 3D viewer requirements

Interaction
- Free rotation by drag (mouse, touch, pen) on both axes. Full 360 degrees of azimuth; elevation from directly above to directly below so the bottom and fins are reachable by dragging (replace the `maxPolarAngle = 1.5` clamp with a range that passes under the board; avoid gimbal flip at the poles by stopping a few degrees short).
- Remove the flick-to-step gesture and the "n / 6" counter. A horizontal drag always rotates.
- Phone scroll: a mostly vertical drag that starts on the stage scrolls the page; a mostly horizontal drag rotates (decide on the first 8-10 px of movement). In full screen, every drag rotates.
- Zoom: wheel/trackpad pinch on desktop, two-finger pinch on phone, clamped so the board never leaves the frame or clips the camera. No pan.
- Inertia with damping after release, off under `prefers-reduced-motion`. Response within one frame of pointer move.
- Double-tap or double-click, and the reset button, return to the 3/4 view.
- Preset views (Deck, Bottom, Rail, Tail, Nose) stay as a small secondary row of text buttons that animate the camera to that view; they are shortcuts, never the main control, and nothing is "selected" once the user drags.
- Auto-spin ("360") is removed as a mode. Optional: one slow quarter-turn on first open as the drag hint, cancelled by any input, skipped under reduced motion.
- A "Drag to turn" hint on first open only, removed on first drag and remembered per browser.
- Keyboard: arrows rotate, plus/minus zoom, Home resets (the aria-label already promises this; keep it true).

Framing and rendering
- The whole board is inside the stage with at least 8% margin at every angle and at both widths; refit on resize and orientation change.
- The board reads against the set: a mid-light neutral set (not the board's own colour), a defined silhouette, a tight contact shadow under the hull rather than a wide blur. Check the white fish specifically.
- Antialiased edges at device pixel ratio capped at 2; no visible stair-stepping on the rail at 1440.
- Hotspots (fins, tail, nose, rail): hidden by default on touch; shown from an explicit "Details" toggle; each has a text label, a 44 px target, hides when its anchor is occluded or off-stage, and never sits outside the stage. If this cannot be made reliable tonight, remove hotspots on phones and keep the facts in the spec list. This closes complaint (a) once the cause is confirmed.
- Loading: the existing faded 2D outline skeleton. WebGL failure or context loss: fall back to the 2D outline with one line "3D is not available on this device".
- Performance: interactive on an 8 GB Apple Silicon Mac and a mid-range phone; render on demand (no continuous loop when idle); release the context when the viewer is closed.
- Honesty: keep one short note at the stage, "3D shape is approximate, built from this board's dimensions", in place of the scattered notes.
- No new runtime dependency: OrbitControls from three is already in use.

## 5. Example boards: decision

**Use generic examples. Remove real brand and model names from example boards.**

Reasons
- Honesty: a brand line under "My boards / Your collection" reads as something the user owns, and the 3D shape is an approximation, not that manufacturer's board. "Example board (retail model)" does not repair that; it adds a claim about a retail product that SWELLO cannot stand behind.
- Trademark: naming a maker's product next to a rendered approximation of it invites an implied-endorsement reading. This matters at the launch gate; it costs nothing to avoid now.
- Do not swap in invented brands either (the older "Demo Workshop · Drift (fictional)" data): a fictional maker is still a made-up label.

What to show
- Name by role, as now: "Small-day fish", "Everyday shortboard", "Soft-top cruiser", "Bigger-day option".
- Meta line: "Fish · Example" (type, then the word Example). No maker, no model.
- Dimensions: keep realistic numbers and label the set once as "Example boards use typical dimensions for their type." If the current numbers are a specific retail model's published dimensions, either keep them under that generic label or round them to typical values; the implementer chooses, but no brand string may remain in the UI, aria-labels, thumbnails or deep links.
- Deck look: plain colours and procedural patterns only, as the data file already states (no logos, graphics or text).
- A visible "Example" tag on the rack and the detail header, and one action "Replace with your board". Examples are excluded from "N boards" once the user has added a real board, or the count reads "4 example boards".
- Real brands remain fully allowed in boards the user enters themselves; that is their own data.

Flag for the lead: Home currently recommends "Take your Everyday shortboard" from an example board. With examples it should say "an everyday shortboard (example)" or stay silent. Outside this spec's files; listed so it is not lost.

## 6. Acceptance criteria

Checked in a real browser at 1440 and 390, light and dark, with screenshots looked at.

1. One Quiver page; the title is "Quiver" in both states; `?board=&view=3d` restores the same board and view on reload.
2. The first content under the header is a one-sentence verdict for the selected spot and hour, taken from the existing Board Match logic, with its caveat. When no board fits it says so once. Identical per-board chips are not repeated four times.
3. Read mode shows no steppers. Edit shows them and nothing saves without Save.
4. On a phone, dragging on the stage rotates the board continuously through a full turn and to the underside; no step counter exists; a vertical drag starting on the stage scrolls the page.
5. On desktop, mouse drag rotates on both axes, wheel zooms, double-click resets.
6. At every preset and after any free rotation, the full board is inside the stage at both widths (no cropping as in `p-quiver-3d.png`).
7. No unlabeled dots or marks appear under or around the board on a phone at any time, including the 4 s after a touch. The cause of complaint (a) is named in the hand-off.
8. Nothing on the page is covered by the tab bar or any sticky bar at 390 when scrolled to the end; there is at most one floating bar.
9. No dark translucent pills on the stage; controls use the 4/8/12 radius scale and solid surfaces; all touch targets at least 44 px.
10. The white fish is clearly distinguishable from the set in both themes; no visible aliasing on the silhouette at 1440.
11. No real or invented brand or model name appears for example boards anywhere (UI text, aria-labels, titles). Each example is tagged "Example".
12. The rack arrows appear only when the rack overflows; the desktop page has no empty third of the viewport at 1440 x 900.
13. `prefers-reduced-motion`: no inertia, no hint turn, preset changes cut rather than animate.
14. WebGL unavailable: the 2D outline and one honest line, no blank stage.
15. `npx tsc --noEmit`, `npm test`, `npm run build` pass; existing quiver journeys in the toolkit still pass or are updated for the merged page.

## 7. Not in scope

- New board data, a board catalogue, or brand/model lookup.
- Changes to Board Match logic, ranges or any forecast number; only where and how the existing result is shown.
- Photo-realistic materials, textures, logos, photos or any AI-generated imagery.
- Board scanning (`ScanPanel`) changes, beyond keeping it reachable from Add/Edit.
- Accounts, sync, sharing, or selling boards.
- New runtime dependencies.
- Home's quiver pick wording (flagged in section 5 for the lead).
- Generic bug hunting in the quiver; the engineering session's own audit covers that.
- Dark-theme redesign; only parity checks.
