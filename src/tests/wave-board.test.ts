import test from 'node:test';
import assert from 'node:assert/strict';
import {boardGeometry, boardShape, MODEL_DECK_M} from '../features/scale/boardMesh.ts';

test('quiver board mesh: true length, width and thickness; the deck under the feet stays where the surfer stands', () => {
  for (const b of [{length: 72, width: 19.5, thickness: 2.44, type: 'Shortboard'}, {length: 110, width: 22.75, thickness: 3, type: 'Longboard'}, {length: 64, width: 21, thickness: 2.6, type: 'Fish'}] as const) {
    const g = boardGeometry(boardShape(b as never)), p = g.positions; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, deckMid = -Infinity, botMid = Infinity;
    for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]); if (Math.abs(p[i]) < 0.02) { deckMid = Math.max(deckMid, p[i + 1]); botMid = Math.min(botMid, p[i + 1]); } }
    assert.ok(Math.abs(x1 - x0 - b.length * 0.0254) < 1e-6, 'length');
    assert.ok(Math.abs(z1 - z0 - b.width * 0.0254) < 0.01, `width ${z1 - z0}`);
    assert.ok(Math.abs(deckMid - MODEL_DECK_M) < 2e-3 && Math.abs(deckMid - botMid - b.thickness * 0.0254) < 2e-3, `deck ${deckMid} thick ${deckMid - botMid}`);
  }
  // a traced outline is rescaled to the entered width
  const tr = boardShape({length: 70, width: 20, thickness: 2.5, type: 'Shortboard'}, Array.from({length: 40}, (_, i) => 0.12 * Math.sin(Math.PI * (i + 0.5) / 40)));
  assert.ok(Math.abs(tr.half(0.5) - 0.5) < 0.01);
});
