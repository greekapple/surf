// Wind cell rule (docs/forecast/WIND-POINT.md): ask Open-Meteo for the grid cell that contains the beach (cell_selection=nearest),
// not its default "land" cell, which for many spots is 2.5–4.5 km inland. Browser and forecast service must request the same cell.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {weatherURL} from '../ocean/openMeteo.ts';
import {evidenceSpots} from '../ocean/spots.ts';

test('wind is requested from the grid cell nearest the beach, in the app and the forecast service', () => {
  for (const s of evidenceSpots) assert.match(weatherURL(s), /cell_selection=nearest/);
  const svc = fs.readFileSync(new URL('../../services/forecast-service.mjs', import.meta.url), 'utf8');
  assert.match(svc, /key:'weather-'\+s\.id[^\n]*cell_selection:'nearest'/);
});
