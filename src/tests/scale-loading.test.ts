import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Audit B10 (R11, R13): the wave scale never labels a placeholder scene with a forecast time while loading, and a frame without the rider says why.
const stage = readFileSync('src/features/scale/ScaleStage.tsx', 'utf8');
const live = readFileSync('src/features/scale/WaveLive.tsx', 'utf8');
const css = readFileSync('src/features/scale/scale.css', 'utf8');

test('while the spot loads, the hour is the current hour and the stage is a skeleton', () => {
  assert.match(stage, /const loading = spotPhase\(view\.ocean, spot\.id, live\) === 'loading';/);
  assert.match(stage, /const hour = loading \? undefined : hours\[idx\] \?\? \(view\.forecast\?\.placeholder \? undefined : view\.forecast\);/);
  assert.match(stage, /const nowIso = view\.selectedTime \?\? /);
  assert.doesNotMatch(stage, /const hour = hours\[idx\] \?\? view\.forecast;/);
  assert.match(stage, /loading \? `\$\{weekdayPT\(nowIso\)\} \$\{timeLabelPT\(nowIso\)\}`/);
  assert.match(stage, /\{loading\s*\n\s*\? <div className="live-poster-only sc-stage-skel"/);
  assert.doesNotMatch(stage, /'Loading the forecast…'/);
});

test('between rides the stage says the rider is paddling back', () => {
  assert.match(live, /el\.dataset\.between = between/);
  assert.match(css, /\.live-host\[data-between="1"\]::after \{ content: "Paddling back for the next wave"/);
});
