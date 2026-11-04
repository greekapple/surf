# T-115 round 2 handoff (engineering): Windy's look, no grey edges, no loading gaps

Branch `t115b-look` (forecast-trust merged, includes T-116 chrome). tsc clean, 483 tests, build OK, t043-map ALL PASS, `t115-zoom.mjs` ALL PASS (desktop, iPhone, Android). Light QA again (one load per profile plus a few diagnostics).
**Side-by-side (Windy live frame vs ours, same hour):** `~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t115/side-by-side-windy.png` (kept out of the repo: it contains Windy imagery, reference only).

## 1. Windy's look
- **Colours:** the value → stop mapping was already right (metres converted to feet before the lookup, pinned by tests). The dull look was the blend. The stops above 6.6 ft were also too muted: they came from Windy's legend STRIP, but Windy paints big seas on the map much more saturated than its strip (violet, magenta, rose, crimson). I re-sampled those stops from the live overlay in your `waves-1568-big-swell.jpg`: 6.6 ft #4b50b8, 8 #8648b4, 9.5 #a037a0, 11.5 #992d82, 13 #992a6d, 15 #912d4a, 17.5 #882f34, 20 #a23047 (≤5 ft and ≥24 ft unchanged). Today's 7 to 14 ft coast now reads magenta-purple with the blue strip at the shore, and offshore goes toward crimson, as on Windy.
- **Opaque field:** `FIELD_ALPHA = 1` (no 0.72 wash). Land is still never painted, enclosed waters keep the "Not covered" hatch (now a light hatch so it reads on grey).
- **Basemap:** with the field on, `field.ts` sets `data-heat="on"` on the map container and `basemap.ts` switches to the Esri dark grey canvas (even in the light theme); CSS (`basemap.css`) filters it to a flat mid-grey land (grayscale + brightness) with brighter labels, container ground #7a7a7d. No new tile provider. Turning the layer off returns the normal light/dark basemap. Satellite is untouched.

## 2. Zoom-out edges and loading tiles
- (a) **Hard field edge:** the field canvas is now padded by 50% of the viewport on every side, so a one-level zoom-out (wheel and the +/- buttons) is covered edge to edge. To keep the cost down: the land mask is half-resolution and the sample step is 6 when the padded canvas is large. Redraw is ~15 to 20 ms on desktop and 35 to 40 ms on iPhone at 4x CPU (`data-draw-ms` on the canvas).
- (b) **Basemap tiles:** both tile layers use `updateWhenZooming: false`, `updateWhenIdle: false`, `keepBuffer: 8`, and a `PaddedTileLayer` that also loads a ring of tiles 40% of the viewport wide around it (Leaflet only loads what is visible), so zooming out reveals loaded tiles. The container ground is the map grey, so a late tile reads as map, not a hole.
- `t115-zoom.mjs` now samples the WHOLE map mid-animation: the share of container-ground pixels over the area between the header and the bottom bar must be <= 2% in every frame (the previous T-115 build on :5180 scored 5.2%, 7.7%, 1.7% there; this branch 0.0 to 0.1%), the sea strip must stay field-coloured (<= 15% grey), and frame rates hold (desktop 57 to 60 fps while zooming; iPhone and Android 54 to 57 fps at 4x CPU, worst frame 83 to 117 ms). Backup `t115-zoom.mjs.pre-look`.

## Notes
- Windy shows data in the bays (teal); we have none there, so the hatch stays by design.
- Files: `src/map/colors.ts`, `src/map/field.ts`, `src/map/basemap.ts`, `src/map/basemap.css`; toolkit `t115-zoom.mjs`. No explore/ chrome files touched this round.
- The map legend gradient follows automatically (same function).
