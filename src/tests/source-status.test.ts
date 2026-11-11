import {test} from 'node:test';
import assert from 'node:assert/strict';
import {limitedText, sourceFamily} from '../services/sourceStatus.ts';

test('audit F25: the status chip names the limited source', () => {
  assert.equal(sourceFamily('CDIP MOP MA137 forecast'), 'CDIP nearshore');
  assert.equal(sourceFamily('Open-Meteo Marine · Ocean Beach'), 'Open-Meteo marine');
  assert.equal(sourceFamily('NOAA CO-OPS high/low predictions 9414131'), 'NOAA tides');
  assert.equal(limitedText([{provider: 'Open-Meteo Marine · Ocean Beach', state: 'connected'}]), '');
  assert.equal(limitedText([{provider: 'CDIP MOP MA137 forecast', state: 'unavailable'}, {provider: 'CDIP MOP SF023 forecast', state: 'partial'}]), ' · CDIP nearshore limited');
  assert.equal(limitedText([{provider: 'CDIP MOP MA137 forecast', state: 'unavailable'}, {provider: 'NOAA NDBC buoy observations', state: 'partial'}]), ' · CDIP nearshore and NDBC buoys limited');
  assert.equal(limitedText([{provider: 'CDIP MOP MA137 forecast', state: 'unavailable'}, {provider: 'NOAA NDBC buoy observations', state: 'partial'}, {provider: 'NOAA CO-OPS tide predictions', state: 'unavailable'}]), ' · CDIP nearshore, NDBC buoys and 1 more limited');
  assert.equal(limitedText([{provider: 'CDIP MOP MA137 forecast', state: 'loading'}]), '', 'still loading is not limited');
});
