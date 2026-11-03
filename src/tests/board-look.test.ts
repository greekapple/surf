import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {effectiveDeck, FOAM_HEX, resolvedLook, LOOKS_KEY, TINTS} from '../features/quiver/looks.ts';

// T-098 (Codex P2): the 2D renderer's deck colour must equal what the showroom's Studio.applyLook renders.
const studioDeck = (deck: string, finish: string, tint: string) => {
  const t = TINTS.find((x) => x.key === tint) ?? TINTS[0], tc = new THREE.Color(t.hex);
  const c = new THREE.Color(finish === 'clear' ? 0xece6d6 : deck);
  if (t.key !== 'none') c.lerp(c.clone().multiply(tc), 0.78);
  return '#' + c.getHexString();
};
test('effectiveDeck matches the showroom colour rule (tints, clear finish)', () => {
  for (const deck of ['#2f78ad', '#f3efe7', '#c4a17a', '#e8664f'])
    for (const finish of ['gloss', 'matte', 'clear'])
      for (const t of TINTS) assert.equal(effectiveDeck({deck, finish: finish as any, tint: t.key}), studioDeck(deck, finish, t.key), `${deck} ${finish} ${t.key}`);
  assert.equal(effectiveDeck({deck: '#2f78ad', finish: 'clear', tint: 'none'}), FOAM_HEX, 'a clear (epoxy) finish shows foam, not the deck colour');
});

test('resolvedLook: the board record\'s Fins wins over the saved cosmetic fins', () => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }};
  store[LOOKS_KEY] = JSON.stringify({b1: {deck: '#2f78ad', bottom: '#efe9dc', fade: 0.35, finish: 'gloss', tint: 'none', fins: 'twin'}});
  assert.equal(resolvedLook({id: 'b1', type: 'Shortboard', fins: 'Single fin'} as any).fins, 'single', 'edited Fins field wins');
  assert.equal(resolvedLook({id: 'b1', type: 'Shortboard', fins: ''} as any).fins, 'twin', 'no Fins recorded: the saved look stands');
  assert.equal(resolvedLook({id: 'b1', type: 'Shortboard', fins: 'Single fin'} as any).deck, '#2f78ad', 'colour still from the saved look');
  delete (globalThis as any).localStorage;
});
