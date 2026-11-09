// Wind cell rule (docs/forecast/WIND-POINT.md): the app keeps Open-Meteo's default cell selection ("land"). Trying the cell that
// contains the beach (cell_selection=nearest) was measured and NOT adopted: mixed against stations, and no station stands at a beach
// the rule moves. Browser, forecast service and the Explore point must ask with the same rule, so one place never shows another cell's wind.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {weatherURL} from '../ocean/openMeteo.ts';
import {evidenceSpots} from '../ocean/spots.ts';

test('every wind request uses the same cell rule (the API default) in the app, the forecast service and the Explore point', () => {
  for (const s of evidenceSpots) assert.doesNotMatch(weatherURL(s), /cell_selection/);
  const svc = fs.readFileSync(new URL('../../services/forecast-service.mjs', import.meta.url), 'utf8');
  assert.match(svc, /key:'weather-'\+s\.id/);
  assert.doesNotMatch(svc, /cell_selection/);
});
