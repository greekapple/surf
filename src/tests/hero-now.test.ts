import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {betHour, windowPhrase} from '../services/homeDash.ts';

// hero-now (lead, 2026-11-12, live on Home at 3:02 PM PST): "Deadmans is your best bet today, on now, until 5:30 PM" with a button "Open Deadmans, today 6:25 AM".
const hours = Array.from({length: 24}, (_, i) => ({spotId: 'cs-deadmans', timestamp: new Date(Date.UTC(2026, 10, 12, 8 + i)).toISOString()}));   // 12 AM PST on
const win = {start: '2026-11-12T14:25:00.000Z', end: '2026-11-13T01:30:00.000Z', label: '6:25 AM–5:30 PM'};   // 6:25 AM–5:30 PM PST
const at = (iso: string) => Date.parse(iso);

test('hero-now: a window that started before now is shown and opened at the CURRENT hour, called "now"', () => {
  const now = at('2026-11-12T23:02:00.000Z');   // 3:02 PM PST
  const r = betHour(hours, 'cs-deadmans', win, now);
  assert.equal(r.onNow, true);
  assert.equal(r.rec?.timestamp, '2026-11-12T23:00:00.000Z', 'the 3 PM hour, not the 6 AM hour holding the start');
  assert.match(windowPhrase(win, now), /^on now, until 5:30 PM/, 'the sentence already said "on now"');
});

test('hero-now: a window still ahead is shown at the hour holding its start; after it ends it is not "now"', () => {
  const r = betHour(hours, 'cs-deadmans', win, at('2026-11-12T13:00:00.000Z'));   // 5 AM PST
  assert.equal(r.onNow, false); assert.equal(r.rec?.timestamp, '2026-11-12T14:00:00.000Z');
  assert.equal(betHour(hours, 'cs-deadmans', win, at('2026-11-13T02:00:00.000Z')).onNow, false, '6 PM: the window is over');
});

test('hero-now: the button and the caption say "now" and use the current hour when the window is on now', () => {
  const w = fs.readFileSync(new URL('../features/home/Welcome.tsx', import.meta.url), 'utf8');
  assert.match(w, /const \{rec, onNow\} = betHour\(mine, spot\.id, w, nowMs\)/);
  assert.match(w, /Open \{bet\.spot\.name\}, \{bet\.onNow \? 'now' :/);
  assert.match(w, /onClick=\{\(\) => onOpen\(bet\.spot\.id, bet\.rec\.timestamp\)\}/, 'opens the hour it shows');
  assert.match(w, /const heroWhen = bet\?\.onNow \? 'now'/);
});
