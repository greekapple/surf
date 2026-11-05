# T-134: surfer and board visuals plan
Status: **DRAFT for the user's decision** (2026-11-05). Planning only: no code, no downloads, no purchases.
User words: "the surfer model looks pretty terrible", "improve the actual visuals and cleanliness", "the feet lying on the board and the board itself need a rework".
Sources checked this session are linked in the licence section; anything marked (unverified) is from background knowledge and must be confirmed before money or files move.

## Where we are
- Surfer: MPFB2 human (CC0 output), `game_engine` rig minus fingers (23 bones + `board`), black wetsuit, modelled hair cap, 16 pose keys + `still`, foot IK baked to FK, `surfer-v10.glb` 1.10 MB (`tools/blender/build_surfer.py`). The viewer adds head/torso/arm layers.
- Board: two copies of the same idea. Blender (`build_surfer.py`) bakes a 6'0" board into the GLB; `src/features/scale/boardMesh.ts` builds the Quiver board from dimensions (rings, domed deck, tucked rails, foil, 3 plate fins).
- Likely causes of "terrible" (to confirm with a 1440/390 close-up before phase 1): low-poly MPFB base with flat unlit-looking black, no cloth detail, no seams/panels, blocky hands (fingers removed), no face read, feet that are flat soles clipping or floating a few mm over a smooth deck, board with no wax, no stringer, no graphics, plate fins.
- Camera reality: the rider is ~17% of frame height, so about 100-150 px tall on a laptop and 60-90 px on a phone. Silhouette, pose and material read matter far more than facial or finger detail.

## 1. Surfer body options
| Option | Realism | Rig/keys fit | Size | Licence for public repo | Cost | Verdict |
|---|---|---|---|---|---|---|
| A. Keep MPFB2, upgrade (higher subdivision on body, MPFB CC0 skins, clothes/wetsuit proxy with seams, hands with fingers, bake normal+AO) | medium-good at 17% | Identical: same rig, keys and IK, zero retarget | 1.5-2.5 MB with 1k textures (KTX2) | CC0 output, may be committed | 0 | **Phase 1-2** |
| B. Quaternius / Kenney / similar CC0 character | stylised, low-poly | Needs retarget; style clashes with the realistic wave | 0.3-1 MB | CC0, committable | 0 | Reject: wrong style |
| C. Mixamo characters/animations | medium, generic, no wetsuit; rig is Mixamo naming (retarget needed) | Retarget of our 16 keys; its animations are not surf | ~2-4 MB | Free for commercial use, **raw files may not be redistributed**; no ML training. The 2022 FAQ is the only official text found and may be outdated (see sources) | 0 | Keep private only, and not worth it |
| D. Ready Player Me | stylised avatar | n/a | n/a | **Service shut down 31 Jan 2026 after the Netflix acquisition** | n/a | Dead, reject |
| E. Paid rigged athlete (Sketchfab Store, CGTrader, Fab, TurboSquid; typical 30-300 USD) | high; a wetsuit surfer specifically is rare (unverified) | Retarget plus new IK; our hand-authored keys would be re-posed | 3-15 MB raw, 2-3 MB after decimate + KTX2 | Standard/royalty-free store licences allow commercial use and forbid resale; whether a GLB inside a public web bundle counts as redistribution is not answered by the store text. **Treat as private-host only** | 30-300 USD, user approval required | Option if A fails the look test |
| F. Commissioned sculpt (artist, 600-3,000 USD, 2-4 weeks, unverified range) | highest, wetsuit panels, our proportions | Built to our rig and the 23 bones; keys keep working | 2-3 MB | Work-for-hire or exclusive licence can be committed; negotiate "may publish in a public repo" | highest | Best final quality, last resort |
| G. Photogrammetry / scan of a person | very high skin, bad topology, no rig | Heavy retopo + rig + pose cleanup | needs 10x reduction | Consent and model-release needed | high effort | Reject |

Recommendation: **A first.** It is free, committable, keeps every authored key and the foot IK, and the problem is mostly materials, cloth shaping and hands, which A fixes. Run a look test after phase 2; only then consider E (private host) or F.

## 2. Wetsuit and skin materials (three.js)
- **Neoprene** (MeshPhysicalMaterial or MeshStandardMaterial): base colour near-black but not 0 (sRGB ~0.05-0.08, so the lights show), roughness 0.55-0.7 with a roughness map (matte wet-rubber with glossy wet patches), a tileable fine-cell normal map (512 px, repeat) plus a baked 1k AO/curvature map for seams, panels, knee pads and a chest zip. `sheen` (0.3-0.5, slightly bluish) fakes the rubber fuzz at grazing angles and is cheap. Wet look: lower roughness (~0.35) on the lower legs and arms in water frames, via a vertex colour or a mask channel, rather than clearcoat everywhere.
- **Skin** (face, hands, feet, forearms): MeshStandardMaterial with an MPFB CC0 skin albedo, plus fake subsurface: a warm rim term in `onBeforeCompile` (a wrapped diffuse, ~10 lines of shader) or `MeshPhysicalMaterial.sheen` in warm tint. Real SSS (transmission, three-subsurface) is too heavy for phones; do not use.
- **Hair:** keep a modelled cap with a normal map and anisotropy-like highlight (specular colour only). Hair cards with alpha add overdraw and sorting issues for a 100 px head; a shell/cap is the right call at this distance.
- **Budget (phone):** one skinned mesh, 20-35k tris, 3-4 draw calls (body+suit, skin, hair, board), textures 1024 max for body, 512 for tiling, all KTX2/Basis (about 1/4 the VRAM of PNG), 24 bones. Target rider cost under 1.5 ms GPU on a mid phone (unverified, measure with the existing 390 profile).

## 3. Hands, feet, face at 17% of frame
- **Feet** (the user's explicit complaint): the grip must read. Plan: re-model the foot with toes and a proper arch so the foot wraps the deck line; the sole contact follows the board's deck dome, not a flat plane; a small contact-shadow/AO blob under each foot on the deck (baked into the board's deck texture or a blob decal, never faked on the wave); wax texture lightens around the feet. Check "sole within 6 mm" is already printed by the script; extend it to every key and to rail-angle toes. Back foot square to the stringer with toes at the rail, front foot angled ~15-25 deg, per the reference notes.
- **Hands:** add fingers back (MPFB `game_engine` has hand bones in the full rig) but pose only 3 states (open, relaxed fist, grab-rail) as blend keys. At 100 px, a hand is ~6 px: it needs a skin tone different from the sleeve, a clean silhouette, and no spiky fingers. Wetsuit glove-less.
- **Face:** read only as a skin-tone head with a darker hair cap, a nose bump and a brow ridge facing the right direction. No eyes beyond a subtle texture dark band. Do not chase a detailed face; the uncanny risk is higher than the benefit.
- **Joints:** the real "cleanliness" win is smooth deformation at shoulders, hips and knees: re-weight, add corrective shape keys (knee 100 deg crouch, shoulder raise), cap shoulder and hip twist. Check against the barrel crouch and snap keys.
- **Silhouette first:** a rim/fresnel light, correct proportions, a slight lean and speed lines come before any texture.

## 4. Board: one parametric source for the wave and the Quiver (T-136)
- **Single source of truth:** move the Blender board and `boardMesh.ts` onto one TypeScript function `buildBoard(params)` (the Blender build imports the baked output, not a second formula). Parameters: length, width, thickness; outline half-width curve (traced or category); rocker curve (nose/tail lift, optional polyline from photo 3); foil curve; rail profile (soft/50-50/hard); tail type; fin setup; `source` flags per field (`photo` or `default`) matching the T-136 spec.
- **Mesh:** loft rings along the outline (like today) but with: an explicit stringer line (seam on the deck centre), a bottom with a gentle concave/vee entry, rail apex shaped by a cross-section parameter, a proper tail (squash, round, swallow, pin cut into the outline) and a nose with a rounded tip, and real fin foils (an airfoil-like section with a flat inside face, 8-12 verts per section) with fin box bases. Aim 3-6k tris for the board.
- **Textures:** deck (traced photo texture from the Quiver or a clean default with a tinted lap and stringer), bottom (photo or plain with fin boxes), **wax**: a procedural grid/bumpy wax normal map (tileable 256-512 px) in the foot zone only, with a wax-shine roughness map; **resin**: glossy roughness 0.15-0.25, clearcoat 0.6 (clearcoat on the board is one pass on a small mesh, fine on phones).
- **Fit with T-136:** the photo steps map onto fields (side photo to rocker/foil, bottom photo to bottom tex and fin positions, tail close-up to tail, rail photo to rail). Missing fields use category defaults and show "typical" on the card. A board saved before T-136 renders through the same function with defaults.
- **Foot placement:** the surfer reads the board's deck height under each foot from `buildBoard` (a function of the deck curve), so IK follows the real shape. The model's own baked board goes away; the board is built by the viewer and parented to the `board` bone.

## 5. Phases (each shippable)
| Phase | Scope | Ships as | Size delta | Rough effort |
|---|---|---|---|---|
| 0 | Look-test baseline: close-up shots of v10 at 1440/390 and a list of the 5 worst problems with the user | doc + screenshots | 0 | 0.5 day |
| 1 | Board rework: `buildBoard` shared by wave and Quiver; stringer, bottom shape, tail variants, foil fins, wax + resin materials; viewer builds the board (bone parent); feet follow the deck | one change, behind no flag | ~0 (board code replaces baked mesh, -0.1 MB GLB) | 2-3 days |
| 2 | Surfer materials: neoprene PBR + sheen, skin albedo from MPFB CC0 skins, rim light, baked AO, KTX2 textures; hair cap shading | `surfer-v11.glb` | +0.5-1 MB | 2-3 days |
| 3 | Feet and hands: modelled feet with toes, fingers back, 3 hand poses, contact shadows, re-weight and corrective shapes at knee/shoulder/hip | `surfer-v12.glb` | +0.2-0.4 MB | 3-4 days |
| 4 | Look gate: side-by-side vs the references at 1440/390 with the user; if still "terrible", run option E (private host) or F (commission) | decision | n/a | 0.5 day |
| 5 | T-136 hooks: rocker/foil/rail/fins from photos feed `buildBoard` (as per that spec) | with T-136 | 0 | in T-136 |

## 6. Budgets
- GLB: surfer under 2.5 MB (hard cap 3 MB, v10 is 1.10 MB); textures KTX2, 1k body, 512 tiling.
- Runtime: rider under 35k tris, 4 draw calls, 24 bones (no per-frame allocations); board 3-6k tris.
- Phone: keep today's frame rate on the 390 profile; no real SSS, no hair cards, no extra shadow pass (blob/baked contact AO only).
- Network: the rider loads after the wave, on demand, as today.

## 7. Licence notes (what may be committed)
- **May be committed (public repo):** everything we produce from MPFB2/MakeHuman CC0 outputs and CC0 skins ([MPFB FAQ: closed-source](https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html), [MakeHuman licence](https://static.makehumancommunity.org/about/license.html)); our own procedural board code and procedurally generated wax/neoprene textures; photos the user takes of their own board, kept on-device.
- Not CC0: MPFB source (GPL) and MakeHuman (AGPL) are tools, not shipped. Some asset packs are CC-BY (attribution file if used); check each pack.
- **Keep on a private host (never in git):** any paid marketplace model; Mixamo files ([Adobe community FAQ](https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/td-p/13234775): commercial use allowed, raw character/animation files may not be redistributed, no ML training; the FAQ is from 2022, recheck); the TurboSquid wave meshes and `scale3d-live/*.glb`, as today.
- Marketplace store licences ([Sketchfab Store licence FAQ](https://help.sketchfab.com/en/articles/16152225-store-license-usage-faq)) are royalty-free but forbid resale; a GLB served to browsers is extractable, so assume it counts as redistribution unless the seller states otherwise in writing.
- Ready Player Me is unavailable ([service shutdown](https://genies.com/blog/ready-player-me-shutdown), 31 Jan 2026), so no licence question remains.
- Note: any private host (Cloudflare Workers site) is already in place for production; a paid or Mixamo model would live only there, and the public build falls back to the CC0 surfer.

## 8. Risks
- A: the MPFB topology may cap the realism; mitigate with the phase 4 gate and option E/F.
- Re-skinning and re-weighting can break the 16 baked keys' contact (feet within 6 mm); keep the existing per-key checks as a CI gate.
- Fingers add bones and skinning cost; mitigate with 3 pose states and no finger IK.
- Texture size creep on phones; KTX2 and the 3 MB cap.
- The board built in the viewer changes the GLB contract (`board` bone, deck height); needs a version bump and a fallback for old caches.
- Paid asset licence ambiguity for a public repo; mitigate by the private-host rule and written seller confirmation.
- Looking realistic at 100 px is limited by the camera; do not over-invest in the face.
- Research gaps: marketplace prices, commission rates and phone GPU timings are unverified; confirm before deciding E/F.

## 9. Decisions for the user
1. **Body path.** (a) Upgrade MPFB2 in place (recommended default), (b) buy a rigged athlete for a private host (needs your OK on cost), (c) commission a sculpt. Default: (a), with a look gate after phase 3 that decides if (b) or (c) is needed.
2. **Board first or surfer first.** Default: the board rework first (phase 1), because it is self-contained, fixes "feet lying on the board", and unblocks T-136.
3. **Hands and face detail level.** (a) Silhouette-level only, fingers with 3 poses, no facial features (recommended default), (b) full detail face and hands (more risk of the uncanny look, +1 MB). Default: (a).
