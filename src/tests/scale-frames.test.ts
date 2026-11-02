import test from 'node:test';
import assert from 'node:assert/strict';
import {SCALE_BANDS} from '../services/waveScale.ts';
import {SPIN_FRAMES, SPIN_CAPTION, bandFolder, framePath, framePaths, posterPath, allBandFolders, wrapFrame, frameFromDrag, frameFromKey, counterText} from '../services/scaleFrames.ts';

test('every band maps to its own folder, 24 padded frames and a poster', () => {
  assert.deepEqual(allBandFolders(), ['1-2', '2-3', '3-4', '4-6', '6-8', '8-10', '10-15', '15-plus']);
  assert.equal(new Set(allBandFolders()).size, SCALE_BANDS.length);
  const b = SCALE_BANDS[3]; assert.equal(bandFolder(b), '4-6');
  const f = framePaths(b); assert.equal(f.length, 24);
  assert.equal(f[0], '/media/scale3d/4-6/a00.jpg'); assert.equal(f[9], '/media/scale3d/4-6/a09.jpg'); assert.equal(f[23], '/media/scale3d/4-6/a23.jpg'); assert.equal(new Set(f).size, 24);
  assert.equal(posterPath(b), '/media/scale3d/4-6/poster.jpg'); assert.equal(framePath(SCALE_BANDS[7], 5), '/media/scale3d/15-plus/a05.jpg');
  assert.equal(SPIN_FRAMES, 24);
});

test('frames wrap around the loop', () => {
  assert.equal(wrapFrame(24), 0); assert.equal(wrapFrame(-1), 23); assert.equal(wrapFrame(-25), 23); assert.equal(wrapFrame(49), 1); assert.equal(wrapFrame(3.4), 3);
});

test('dragging: a full stage width is one turn; right drag goes to earlier frames; bad input does nothing', () => {
  assert.equal(frameFromDrag(0, 0, 400), 0);
  assert.equal(frameFromDrag(10, 400, 400), 10, 'one full width is a full turn back to the same frame');
  assert.equal(frameFromDrag(0, 100, 400), 18, '¼ turn right from frame 0 = 6 frames back');
  assert.equal(frameFromDrag(0, -100, 400), 6);
  assert.equal(frameFromDrag(5, -4000, 400), wrapFrame(5 + 240));
  assert.equal(frameFromDrag(7, NaN, 400), 7); assert.equal(frameFromDrag(7, 50, 0), 7);
});

test('keys: arrows step one, page keys four, Home/End jump, others ignored', () => {
  assert.equal(frameFromKey('ArrowRight', 23), 0); assert.equal(frameFromKey('ArrowLeft', 0), 23); assert.equal(frameFromKey('ArrowUp', 3), 4); assert.equal(frameFromKey('ArrowDown', 3), 2);
  assert.equal(frameFromKey('PageUp', 22), 2); assert.equal(frameFromKey('PageDown', 1), 21); assert.equal(frameFromKey('Home', 9), 0); assert.equal(frameFromKey('End', 9), 23);
  assert.equal(frameFromKey('a', 9), null); assert.equal(frameFromKey('Enter', 9), null);
});

test('counter and caption wording', () => {
  assert.equal(counterText(0), '1 / 24'); assert.equal(counterText(23), '24 / 24'); assert.equal(counterText(24), '1 / 24');
  assert.equal(SPIN_CAPTION, '3D illustration · approximate scale, not current conditions');
});
