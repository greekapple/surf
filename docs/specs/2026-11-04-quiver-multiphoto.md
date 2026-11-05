# Quiver: personalise a board from several photos
Status: **DRAFT, approved as a direction** (user 2026-11-04: "I would ultimately like to update that feature so you take multiple photos of your board and it's more personalised"). Scheduled after 3D round 13 and alongside T-134 (the surfer and board visuals). Not started.

## Context (today)
- `src/features/quiver/ScanPanel.tsx` + `outline.ts`: **one** top-down photo. The board is thresholded and traced to half-widths at stations (`Outline.hw`), and the deck is straightened into a texture (`Outline.tex`).
- Everything runs on the device; nothing is uploaded. The user checks the outline before "Use this outline".
- `traced.ts`: the 3D board is lofted from the traced outline, using the **category's** rocker and thickness (`looks.ts`: "a category shape, never an exact scan").
- **Missing:** the board's own rocker, its thickness and foil, its rails, its bottom (graphics, fins), its tail shape detail and its fin setup.

## Target
A guided capture of **4–6 photos**, each with one job. Each step is optional after the first, and each adds one thing:
| Step | Photo | What it gives |
|---|---|---|
| 1 | Deck, top-down (exists) | outline (widths nose → tail), deck graphics |
| 2 | Bottom, top-down | bottom graphics and colour, the fin positions (fin boxes found and placed), the outline cross-checked against photo 1 |
| 3 | Side profile, board flat on the floor, camera level with it | **rocker** (nose and tail lift) and the **thickness foil** along the length |
| 4 | Tail close-up, from above | tail shape (squash, round, swallow, pin, diamond) traced, not picked from a list |
| 5 | Fins, from the side (optional) | fin setup (thruster, quad, twin, single) and rough fin size |
| 6 | Rail close-up at the widest point (optional) | rail shape (soft, 50/50, hard), from the cross-section |

- **Scale:** comes from the typed dimensions (length × width × thickness from the stringer). Each photo's measurements are normalised to them. A photo that disagrees by more than about 5% (warped by the camera angle) is flagged, and the user re-shoots it or accepts it.
- **The result:** a 3D board built from its **own** outline, rocker, foil, tail, fins and rails, with deck and bottom graphics. The same model is used in the Quiver rack, the board room, the fit advice, and the 3D wave scene (the rider's board = the chosen board).
- **Honesty:** the board card says what was measured from photos and what is still a category default (e.g. "rocker: from your side photo · rails: typical for a shortboard"). Nothing is claimed as exact.

## Constraints
- **Privacy:** photos stay on the device, as today. Nothing is uploaded; only the derived numbers and the downscaled textures are stored, locally.
- **Size budget:** textures stay within today's `TEX_MAX` per side.
- **Works on phones:** each step shows a framing guide (an outline overlay, a "hold level" hint for the side shot) and an instant check ("rail traced ✓ / board not found, try a darker background").
- **No new paid services or ML APIs.** Image processing stays in the browser (canvas). Add a small on-device segmentation model only if thresholding fails on white boards, and only with the user's OK on size.

## Approach (draft)
1. A capture flow in `ScanPanel` as a stepper: step 1 as today, then the optional steps, each with its own extractor (`outline.ts` → `profile.ts`, `tail.ts`, `fins.ts`, `rail.ts`) and its own confirm screen.
2. The model (`traced.ts`): loft from the measured stations, rocker and foil curves (splines through the extracted points), a rail-shape cross-section, and placed fins. The category default is the fallback for every missing piece.
3. The data shape: `Outline` v2 with optional `rocker[]`, `foil[]`, `tail`, `fins`, `rail`, `bottomTex` and per-field `source: 'photo' | 'default'`. v1 boards keep working.
4. The 3D scene uses the rider's selected board, scaled to the rider (ties into T-134).

## Acceptance (draft)
- **Three real boards** (a shortboard, a fish and a longboard; the user's own): each step traced on the first try on a contrasting background.
  - Rocker within about 1 cm of a tape measurement at the nose and tail.
  - Tail shape and fin setup identified correctly.
- **The board card** shows "from your photos" against "typical" per field.
- **The 3D board** in the Quiver and in the wave scene matches the photos side by side.
- **Phone flow at 390:** each step usable with one hand, and the guides readable.
- **Checks:** tsc, tests, build, journeys, data-honesty review.

## Open questions (the user's, when this starts)
1. **White boards on light floors:** add a small on-device segmentation model (about 5–10 MB) if plain tracing isn't reliable? I recommend trying without it first.
2. **The 3D wave:** use your selected Quiver board by default? I recommend yes.
