/** R16: export the reference board's deck heights for the Blender surfer builder, so the baked foot keys sit on the SAME deck the viewer
 *  draws (one formula, boardMesh.ts). Writes tools/blender/assets/board-deck.json: a grid of deck heights over (x along the board, nose at
 *  -x; z across), metres, plus the dimensions. Run: node --experimental-strip-types tools/board-deck.ts */
import {writeFileSync} from 'node:fs';
import {boardCurves, REFERENCE_BOARD} from '../src/features/scale/boardMesh.ts';

const c = boardCurves(REFERENCE_BOARD), nx = 89, nz = 25, xs: number[] = [], zs: number[] = [], deck: number[][] = [], bottom: number[][] = [];
for (let i = 0; i < nx; i++) xs.push(-0.5 * c.L + c.L * i / (nx - 1));
for (let j = 0; j < nz; j++) zs.push(-0.5 * c.W + c.W * j / (nz - 1));
for (const x of xs) { deck.push(zs.map((z) => Math.round(c.deckAt(x, z) * 1e5) / 1e5)); bottom.push(zs.map((z) => Math.round(c.bottomAt(x, z) * 1e5) / 1e5)); }
const out = {source: 'src/features/scale/boardMesh.ts REFERENCE_BOARD (R16)', lengthM: c.L, widthM: c.W, thicknessM: c.T, xs: xs.map((v) => Math.round(v * 1e5) / 1e5), zs: zs.map((v) => Math.round(v * 1e5) / 1e5), deck, bottom, half: xs.map((x) => Math.round(c.halfCut(0.5 - x / c.L) * 1e5) / 1e5)};
writeFileSync(new URL('./blender/assets/board-deck.json', import.meta.url), JSON.stringify(out));
console.log('board-deck.json', nx, 'x', nz, 'deck mid', c.deckAt(0, 0).toFixed(4));
