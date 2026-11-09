import test from 'node:test';
import assert from 'node:assert/strict';
import {dateIn, hourIn, dateInMs, hourInMs, pacificDate, pacificHour, addDaysKey, fmtIn, validZone, DEFAULT_TIME_ZONE} from '../ocean/time.ts';
import {timeZoneOf, setActiveZone, activeZone} from '../ocean/spotZone.ts';
import {evidenceSpots, evidenceSpot} from '../ocean/spots.ts';
import {daylightFor, isDark, clampToLight} from '../services/daylight.ts';
import {windowLabel, dashCard, bestWindowToday, nextMorningKey, ribbon12} from '../services/homeDash.ts';
import {callFor, windowOnDay, bestWindowFrom} from '../services/call.ts';
import {spotReport} from '../services/spotReport.ts';
import {dayRange} from '../services/spotHour.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';
import {timeLabelPT, localHour, weekdayPT, dayNumPT} from '../features/forecast/format.ts';
import {weekDays} from '../features/home/weekDays.ts';

const HNL = 'Pacific/Honolulu', LIS = 'Europe/Lisbon', AKL = 'Pacific/Auckland', LA = 'America/Los_Angeles';
const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
// synthetic world spots (not in the app): registered only for the duration of this file
const base = evidenceSpot('spot-2');
const mk = (id: string, name: string, lat: number, lon: number, timeZone: string) => ({...base, id, name, latitude: lat, longitude: lon, marineLatitude: lat, marineLongitude: lon, timeZone});
const syn = [mk('zz-honolulu', 'Zz Honolulu', 21.28, -157.84, HNL), mk('zz-lisbon', 'Zz Lisbon', 38.7, -9.42, LIS), mk('zz-auckland', 'Zz Auckland', -36.85, 174.77, AKL)];
const surf = (id: string) => ({...allSpots.find((s) => s.id === 'spot-2')!, id, name: id, timeZone: syn.find((s) => s.id === id)!.timeZone});
test.before(() => { for (const s of syn) evidenceSpots.push(s as any); for (const s of syn) allSpots.push(surf(s.id) as any); });
test.after(() => { for (const s of syn) { evidenceSpots.splice(evidenceSpots.findIndex((x) => x.id === s.id), 1); allSpots.splice(allSpots.findIndex((x) => x.id === s.id), 1); } setActiveZone(null); });

const records = (id: string, startIso: string, hours = 72) => {
  const t0 = Date.parse(startIso) / 1000, times = Array.from({length: hours}, (_, i) => t0 + i * 3600);
  const marine = {latitude: 0, longitude: 0, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
    hourly: {time: times, wave_height: times.map(() => 1.6), swell_wave_height: times.map(() => 1.5), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0.2), secondary_swell_wave_direction: times.map(() => 200), secondary_swell_wave_period: times.map(() => 9), sea_surface_temperature: times.map(() => 20)}};
  const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 8)}};
  return normalizeOpenMeteo(evidenceSpots.find((s) => s.id === id)!, marine, weather, startIso).map(toLegacy);
};

test('the zone of a spot: its own IANA zone, else the registry by id, else America/Los_Angeles; an invalid zone falls back instead of throwing', () => {
  assert.equal(DEFAULT_TIME_ZONE, LA); assert.equal(timeZoneOf(null), LA); assert.equal(timeZoneOf('no-such-spot'), LA);
  assert.equal(timeZoneOf('zz-honolulu'), HNL); assert.equal(timeZoneOf({id: 'x', timeZone: LIS}), LIS); assert.equal(timeZoneOf({id: 'zz-lisbon'}), LIS);
  assert.equal(timeZoneOf({id: 'x', timeZone: 'Not/AZone'}), LA); assert.equal(validZone('Not/AZone'), LA); assert.equal(validZone(null), LA);
  assert.ok(evidenceSpots.filter((s) => !s.id.startsWith('zz-') && !s.id.startsWith('w-hawaii-')).every((s) => timeZoneOf(s.id) === LA), 'every California, Oregon and Washington spot stays on Pacific time'); assert.ok(evidenceSpots.filter((s) => s.id.startsWith('w-hawaii-')).every((s) => timeZoneOf(s.id) === HNL), 'the Hawaii spots are on Hawaii time');
  assert.ok(allSpots.filter((s) => !s.id.startsWith('zz-') && !s.id.startsWith('w-hawaii-')).every((s) => timeZoneOf(s) === LA));
});
test('local date and hour of one instant differ by zone, and the pacific* names are the default-zone wrappers', () => {
  const iso = '2026-11-09T09:30:00.000Z';
  assert.deepEqual([dateIn(HNL, iso), hourIn(HNL, iso)], ['2026-11-08', 23]); assert.deepEqual([dateIn(LIS, iso), hourIn(LIS, iso)], ['2026-11-09', 9]);
  assert.deepEqual([dateIn(AKL, iso), hourIn(AKL, iso)], ['2026-11-09', 22]); assert.deepEqual([dateIn(LA, iso), hourIn(LA, iso)], ['2026-11-09', 1]);
  assert.equal(pacificDate(iso), dateIn(LA, iso)); assert.equal(pacificHour(iso), hourIn(LA, iso)); assert.equal(dateInMs(HNL, Date.parse(iso)), '2026-11-08'); assert.equal(hourInMs(HNL, Date.parse('2026-11-09T10:00:00Z')), 0, 'midnight is hour 0, never 24');
  assert.equal(addDaysKey('2026-10-31', 1), '2026-11-01'); assert.equal(addDaysKey('2026-12-31', 1), '2027-01-01'); assert.equal(addDaysKey('2026-03-01', -1), '2026-02-28');
});
test('Honolulu: first and last light, dark hours and the window clamp use the HST day (no DST)', () => {
  const d = daylightFor('zz-honolulu', '2026-06-21'), ms = (s: string) => Date.parse(s);
  assert.ok(ms(d.firstLight) < ms(d.sunrise) && ms(d.sunrise) < ms(d.sunset) && ms(d.sunset) < ms(d.lastLight));
  assert.ok(hourInMs(HNL, ms(d.sunrise)) === 5 || hourInMs(HNL, ms(d.sunrise)) === 6, 'sunrise about 5:50 HST: ' + fmtIn(HNL, {hour: 'numeric', minute: '2-digit'}).format(new Date(d.sunrise)));
  assert.ok([18, 19].includes(hourInMs(HNL, ms(d.sunset))), 'sunset about 7:15 PM HST');
  assert.equal(isDark('zz-honolulu', '2026-11-09T12:00:00Z'), true, '2 AM HST is dark'); assert.equal(isDark('zz-honolulu', '2026-11-09T20:00:00Z'), false, '10 AM HST is light'); assert.equal(isDark('zz-honolulu', '2026-11-10T05:00:00Z'), true, '7 PM HST on Nov 9 is dark (Nov sunset ~5:40 PM)');
  const [s, e] = clampToLight('zz-honolulu', ms('2026-11-09T14:00:00Z'), ms('2026-11-10T08:00:00Z'));
  assert.ok(hourInMs(HNL, s) === 6 && hourInMs(HNL, e) >= 17 && hourInMs(HNL, e) <= 18, `clamped to light: ${fmtIn(HNL, {hour: 'numeric', minute: '2-digit'}).format(new Date(s))} to ${fmtIn(HNL, {hour: 'numeric', minute: '2-digit'}).format(new Date(e))}`);
  const la = daylightFor('spot-2', '2026-11-09'); assert.notEqual(daylightFor('zz-honolulu', '2026-11-09').sunrise, la.sunrise, 'a different place has different light');
});
test('Honolulu: the window, call, dashboard and report speak HST clock labels and the local "today"', () => {
  const now = Date.parse('2026-11-09T19:10:00Z'), recs = records('zz-honolulu', '2026-11-08T10:00:00Z'), spot = allSpots.find((s) => s.id === 'zz-honolulu')!, ctx = {records: recs, nowMs: now};
  assert.equal(dateInMs(HNL, now), '2026-11-09'); assert.equal(hourInMs(HNL, now), 9);
  const w = windowOnDay(spot, '2026-11-09', profile, ctx, now);
  assert.ok(w, 'a window exists today'); assert.ok(hourInMs(HNL, Date.parse(w!.start)) >= 6 && hourInMs(HNL, Date.parse(w!.end)) <= 18, 'daylight in HST: ' + w!.label);
  const [a, b] = w!.label.split('–'); assert.ok(/\d/.test(a) && /(AM|PM)$/.test(b), w!.label);
  assert.equal(w!.label, windowLabel(Date.parse(w!.start), Date.parse(w!.end), HNL), 'the label is in the spot zone');
  assert.notEqual(w!.label, windowLabel(Date.parse(w!.start), Date.parse(w!.end), LA), 'and not the Pacific one');
  const best = bestWindowToday(spot, recs, now); assert.ok(best === null || best.label === windowLabel(Date.parse(best.start), Date.parse(best.end), HNL));
  const call = callFor(spot, recs.find((f) => Date.parse(f.timestamp) === Math.floor(now / 3600000) * 3600000)!, profile, ctx);
  assert.match(call.basis, /first light \d{1,2}:\d{2} AM, last light \d{1,2}:\d{2} PM/, call.basis); assert.ok(call.basis.includes(fmtIn(HNL, {hour: 'numeric', minute: '2-digit'}).format(new Date(daylightFor('zz-honolulu', '2026-11-09').firstLight))));
  const rep = spotReport(spot, recs, now, profile); assert.equal(rep.days[0].date, '2026-11-09'); assert.equal(rep.days.length, 7); assert.equal(rep.days[0].label, '9 Mon');
  assert.equal(rep.light.sunrise.localTime, fmtIn(HNL, {hour: 'numeric', minute: '2-digit'}).format(new Date(rep.light.sunrise.iso)));
  const card = dashCard(spot, recs, now, profile); assert.equal(card.name, 'zz-honolulu');
  assert.equal(nextMorningKey(Date.parse('2026-11-09T19:00:00Z'), HNL), '2026-11-10', 'after 6 AM local the next morning is tomorrow'); assert.equal(nextMorningKey(Date.parse('2026-11-09T12:00:00Z'), HNL), '2026-11-09', '2 AM local: this morning');
  const dr = dayRange(spot, recs, '2026-11-09', now, profile); assert.ok(dr.hours > 0 && dr.hours <= 13, 'daylight hours of the HST day: ' + dr.hours);
  assert.equal(ribbon12(spot, recs, now).length, 12);
});
test('Lisbon: local day and daylight in winter and summer, and the clock-change days (25 h autumn, 23 h spring)', () => {
  const ms = (s: string) => Date.parse(s);
  const w = daylightFor('zz-lisbon', '2026-12-15'), s = daylightFor('zz-lisbon', '2026-06-21');
  assert.ok(hourInMs(LIS, ms(w.sunrise)) === 7 && hourInMs(LIS, ms(w.sunset)) === 17, 'Dec: sunrise ~7:40, sunset ~17:20 WET'); assert.ok(hourInMs(LIS, ms(s.sunrise)) === 6 && hourInMs(LIS, ms(s.sunset)) === 21, 'Jun: ~6:10 / ~21:05 WEST');
  assert.equal(isDark('zz-lisbon', '2026-12-15T03:00:00Z'), true); assert.equal(isDark('zz-lisbon', '2026-12-15T12:00:00Z'), false); assert.equal(isDark('zz-lisbon', '2026-06-21T05:00:00Z'), false, '06:00 WEST is already light in June (first light ~5:30)');
  // 2026-10-25 01:00 UTC: Lisbon goes from WEST (UTC+1) back to WET (UTC+0): the local day of Oct 25 has 25 hours
  const hours = Array.from({length: 72}, (_, i) => new Date(ms('2026-10-24T12:00:00Z') + i * 3600000).toISOString());
  const count = (key: string) => hours.filter((h) => dateIn(LIS, h) === key).length;
  assert.equal(count('2026-10-25'), 25, 'autumn change: a 25-hour local day'); assert.equal(count('2026-10-26'), 24);
  const hr = hours.filter((h) => dateIn(LIS, h) === '2026-10-25').map((h) => hourIn(LIS, h)); assert.deepEqual(hr.slice(0, 4), [0, 1, 1, 2], 'the 01:00 hour happens twice'); assert.equal(hr[hr.length - 1], 23);
  // 2027-03-28 01:00 UTC: WET to WEST, a 23-hour day
  const spring = Array.from({length: 72}, (_, i) => new Date(ms('2027-03-27T12:00:00Z') + i * 3600000).toISOString()); assert.equal(spring.filter((h) => dateIn(LIS, h) === '2027-03-28').length, 23, 'spring change: a 23-hour local day');
  // the calls on the change day: no crash, the window clock labels and the day keys stay consistent
  const spot = allSpots.find((x) => x.id === 'zz-lisbon')!, now = ms('2026-10-25T10:00:00Z'), recs = records('zz-lisbon', '2026-10-24T12:00:00Z', 96), ctx = {records: recs, nowMs: now};
  const bw = bestWindowFrom(spot, profile, ctx, now, 3); assert.ok(bw === null || bw.when === 'today' || bw.when === 'tomorrow' || /day$/.test(bw.when));
  const wd = windowOnDay(spot, '2026-10-25', profile, ctx, 0); assert.ok(wd === null || hourInMs(LIS, Date.parse(wd.start)) >= 6, 'a daylight window on the 25-hour day starts after first light: ' + wd?.label);
  const rep = spotReport(spot, recs, now, profile); assert.deepEqual(rep.days.slice(0, 3).map((d) => d.date), ['2026-10-25', '2026-10-26', '2026-10-27']);
  assert.equal(dateIn(LIS, '2026-10-26T12:00:00Z'), addDaysKey(dateInMs(LIS, now), 1)); assert.equal(dateIn(LIS, '2026-10-25T20:00:00Z'), dateInMs(LIS, now));
});
test('east of UTC+11 (Auckland): the local date, "tomorrow" and the day sequence are not shifted a day', () => {
  const now = Date.parse('2026-11-09T12:30:00Z');   // 01:30 on Nov 10 in Auckland (NZDT, UTC+13)
  assert.equal(dateInMs(AKL, now), '2026-11-10'); assert.equal(dateIn(AKL, '2026-11-10T20:00:00Z'), addDaysKey(dateInMs(AKL, now), 1), '09:00 on Nov 11 local is tomorrow');
  assert.deepEqual(weekDays(now, [], ['zz-auckland'], 3, AKL).slice(0, 1), ['2026-11-10']);
  const recs = records('zz-auckland', '2026-11-09T00:00:00Z', 96), spot = allSpots.find((x) => x.id === 'zz-auckland')!, rep = spotReport(spot, recs, now, profile);
  assert.deepEqual(rep.days.slice(0, 3).map((d) => d.date), ['2026-11-10', '2026-11-11', '2026-11-12']); assert.equal(rep.days[0].label, '10 Tue');
  const dl = daylightFor('zz-auckland', '2026-11-10'); assert.ok(hourInMs(AKL, Date.parse(dl.sunrise)) === 6 && hourInMs(AKL, Date.parse(dl.sunset)) === 20, `NZDT sunrise ~6:00, sunset ~20:10: ${dl.sunrise} ${dl.sunset}`);
});
test('screen helpers format in the zone passed, else the zone of the spot on screen', () => {
  const iso = '2026-11-09T09:30:00.000Z';
  assert.equal(timeLabelPT(iso, HNL), '11:30 PM'); assert.equal(timeLabelPT(iso, LIS), '9:30 AM'); assert.equal(localHour(iso, HNL), 23); assert.equal(weekdayPT(iso, HNL), 'Sun'); assert.equal(dayNumPT(iso, HNL), '8');
  assert.equal(fmtIn(HNL, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}).format(new Date(iso)), 'Sun, Nov 8, 11:30 PM HST');
  setActiveZone(HNL); assert.equal(activeZone(), HNL); assert.equal(timeLabelPT(iso), '11:30 PM'); setActiveZone(null); assert.equal(activeZone(), LA); assert.equal(timeLabelPT(iso), '1:30 AM');
  assert.equal(windowLabel(Date.parse('2026-11-09T17:00:00Z'), Date.parse('2026-11-09T20:00:00Z'), HNL), '7–10 AM'); assert.equal(windowLabel(Date.parse('2026-11-09T17:00:00Z'), Date.parse('2026-11-09T20:00:00Z')), '9 AM–12 PM');
});
