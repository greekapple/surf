# T-094 (product): one board look

Branch `worktree-product` (forecast-trust merged first). No quiver data model change, and no edits to `src/features/scale/*`.

## Before
Three looks for one board:
- **Wall:** generic AI illustrations by board type (green fish, "Illustration · AI-generated").
- **Compare:** two fixed theme colours (board-a / hs-hi).
- **Showroom:** a 3D model in the board's own `looks` colour; its rail used the flat outline in a fixed colour.

## After
`BoardOutline` (`src/features/quiver/BoardOutline.tsx`) is the one 2D renderer, used by the wall (via `BoardPicture`), the phone strip, the showroom rail, Compare, the Board Match ranking and the Board Match overlay. It draws:
- **Outline:** the board's real length and width with its type's category outline. Its own tail word (pin, rounded pin, round, diamond, squash, square, swallow) now sets the tail width and swallow notch; boards without one fall back to the type.
- **Colour:** from the same `looks` record (`loadLook`) as the 3D showroom: deck colour plus resin tint, rail shading, and a gloss highlight (flat for matte).
- **Details:** the stringer, and fin boxes for the fin set (single, twin, thruster or none) seen through the deck.
- **Showroom rail:** the current board shows the live draft look while you configure it.
- **Traced boards:** a person's traced outline or photo still takes priority (`Upright`).

**Removed from the wall:** the generic AI-made type illustrations. They showed a board type, not your board, and never matched the showroom colour. `illustrationFor` is now unused; it's left in place for you to decide whether to delete it.

**Limits:**
- The 3D showroom shape still comes from its template meshes (shortboard, fish, longboard, gun, midlength). The 2D outline is the category approximation, so silhouettes match by category, not point for point.
- Showroom lighting makes a colour look a little lighter in 3D than flat.

## Checks (5184)
tsc OK; unit tests 437/437; build OK; t035 29/0; t025 27/0; density ALL PASS; journeys 8/8 (Quiver: add, edit, reload, persists in the list and showroom).
Shots: before `artifacts/t088/after/{quiver,showroom,compare}-*`; after `artifacts/t094/after/` (1440/390 × light/dark).
