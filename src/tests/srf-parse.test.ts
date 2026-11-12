import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSrf, parseRange, parseSurfValue, expandUgc, periodWhen, facingOf, pickEntry} from '../../services/srf-parse.mjs';

const prod = (office: string, productText: string) => ({id: 'id-' + office, issuingOffice: 'K' + office, issuanceTime: '2026-11-11T06:26:00+00:00', productText});
const MTR = prod('MTR', `
000
FZUS56 KMTR 110626
SRFMTR

NORTHERN AND CENTRAL CALIFORNIA SURF ZONE FORECAST
NATIONAL WEATHER SERVICE SAN FRANCISCO BAY AREA
1026 PM PST Tue Nov 10 2026

...Please check with your local authorities on potential beach closures...

CAZ509-112000-
SAN FRANCISCO AND SAN MATEO COUNTY COASTAL AREAS-
1026 PM PST Tue Nov 10 2026


.WEDNESDAY...
Surf Height...................Northwest Facing Beaches - 7 to 11 feet.
                              South Facing Beaches - 3 to 5 feet.
Thunderstorm Potential........None expected.
Water Temperature.............Around 65 degrees.
Wind..........................N at 5 MPH becoming N at 3 MPH.
Tides.........................High 4.6 feet (MLLW) 01:27 AM PST.
                              Low 3.2 feet (MLLW) 05:41 AM PST.

.THURSDAY...
Surf Height...................West Facing Beaches - 10 to 14 feet.
                              South Facing Beaches - 3 to 6 feet.
Weather.......................Mostly cloudy.

$$

CAZ530-112000-
MONTEREY BAY AND BIG SUR COASTAL AREAS-
1026 PM PST Tue Nov 10 2026

...COASTAL FLOOD ADVISORY THROUGH 4 PM FRIDAY...

.WEDNESDAY...
Surf Height...................Northwest Facing Beaches - 6 to 9 feet.
                              Southwest Facing Beaches - 3 to 5 feet.

$$
`);
const BOX = prod('BOX', `
000
FZUS51 KBOX 092109
SRFBOX

Surf Zone Forecast
409 PM EST Mon Nov 9 2026

MAZ022-101100-
Barnstable MA-
Including the beaches of Chatham, Eastham, and Provincetown
409 PM EST Mon Nov 9 2026

.REST OF TODAY...
Rip Current Risk*...
   East Coast...............Low. 
Surf Height...
   East Coast...............3 to 5 feet. 
Water Temperature...
   East Coast...............In the mid 50s. 
Weather.....................Partly sunny. Scattered showers. 
Tides...
   Nauset Beach.............Low 0.0 feet (MLLW) 04:29 PM EST.

.TUESDAY...
Surf Height...
   East Coast...............4 to 5 feet. 

.VETERANS DAY...Surf height 3 to 5 feet. Sunny. Highs in the mid 50s.
Northwest winds around 10 mph. 
.THURSDAY...Surf height around 2 feet. Mostly cloudy. A slight chance
of rain. Highs in the mid 50s. East winds around 10 mph. 

&&

$$

MAZ024-101100-
Nantucket MA-
409 PM EST Mon Nov 9 2026

.REST OF TODAY...
Rip Current Risk*...
   East Coast...............High. 
   South Coast..............Moderate. 
Surf Height...
   East Coast...............4 to 6 feet. 
   South Coast..............5 to 7 feet. 

$$
`);
const GUM = prod('GUM', `
GUZ001-MPZ001>003-110915-
Guam-Rota-Tinian-Saipan-
412 AM ChST Wed Nov 11 2026

.TODAY...
Rip Current Risk.....Moderate *. 
Surf Height
      North facing reefs............5 to 7 feet. 
      East  facing reefs............5 to 7 feet. 
      South facing reefs............2 to 4 feet. 
      West  facing reefs............5 to 7 feet. 
Swell/Period
      Primary swell................Northwest at 4 feet. 

$$
`);
const MFR = prod('MFR', `
ORZ021-110000-
Southwest Oregon coastal areas from Reedsport to Port Orford-
240 AM PST Tue Nov 10 2026

.TODAY...
Surf Height...................16 FT.
Water Temperature.............Around 56 degrees.
Tides.........................
          Charleston..........High 6.5 feet (MLLW) 12:51 AM PST.

.WEDNESDAY...
Surf Height...................15 FT.

$$
`);
const HFO = prod('HFO', `
HIZ003-029>031-120245-
Kauai-
343 PM HST Tue Nov 10 2026

...HIGH SURF ADVISORY FOR NORTH AND WEST FACING SHORES...
__________________________________________________________________
                      Tonight                    Wednesday

Shores                  Surf                       Surf     
                     PM     AM                  AM     PM 
__________________________________________________________________

North Facing         6-8   8-12               14-18  15-20 
West Facing          4-6    5-7                9-12  10-15 
                                                                  

.TONIGHT...
Weather.....................Partly cloudy. 

$$
`);
const zone = (p: ReturnType<typeof parseSrf>, ugc: string) => p.zones.find((z: any) => z.ugc.includes(ugc))!;

test('UGC headers expand ranges and bare numbers, and keep the expiry apart', () => {
  assert.deepEqual(expandUgc('HIZ003-029>031-120245-'), {zones: ['HIZ003', 'HIZ029', 'HIZ030', 'HIZ031'], expires: '120245'});
  assert.deepEqual(expandUgc('GUZ001-MPZ001>003-110915-'), {zones: ['GUZ001', 'MPZ001', 'MPZ002', 'MPZ003'], expires: '110915'});
});

test('ranges: only what the text says (range, around, "or less" has no lower bound, single, nothing readable)', () => {
  assert.deepEqual(parseRange('3 to 6 feet.'), {lo: 3, hi: 6, kind: 'range'});
  assert.deepEqual(parseRange('20 to 25 ft.'), {lo: 20, hi: 25, kind: 'range'});
  assert.deepEqual(parseRange('Around 2 feet.'), {lo: 2, hi: 2, kind: 'around'});
  assert.deepEqual(parseRange('1 foot or less.'), {lo: null, hi: 1, kind: 'or_less'});
  assert.deepEqual(parseRange('14 FT.'), {lo: 14, hi: 14, kind: 'single'});
  assert.deepEqual(parseRange('1.5 to 2.5 feet'), {lo: 1.5, hi: 2.5, kind: 'range'});
  assert.equal(parseRange('Surf will be small'), null);
});

test('a surf value keeps the facing label, the "becoming" remainder and the sets as text and numbers, and unreadable text stays text', () => {
  const a = parseSurfValue('Northwest Facing Beaches - 10 to 15 feet, Becoming 6 to 9 feet Thursday afternoon. Southwest Facing Beaches - 4 to 7 feet.');
  assert.equal(a.length, 2); assert.deepEqual([a[0].facing, a[0].lo, a[0].hi, a[0].then], ['northwest', 10, 15, 'Becoming 6 to 9 feet Thursday afternoon']); assert.deepEqual([a[1].facing, a[1].lo, a[1].hi], ['southwest', 4, 7]);
  const b = parseSurfValue('3 to 5 feet. Sets to 6 feet.'); assert.equal(b.length, 1); assert.deepEqual([b[0].lo, b[0].hi, b[0].sets], [3, 5, 6]);
  const c = parseSurfValue('Around 2 feet, subsiding to around 1 foot in the afternoon.'); assert.deepEqual([c[0].lo, c[0].hi, c[0].kind], [2, 2, 'around']); assert.match(c[0].then!, /subsiding to around 1 foot/);
  const d = parseSurfValue('Large and dangerous'); assert.deepEqual([d[0].kind, d[0].lo, d[0].hi], ['text', null, null]);
});

test('period labels give the local date: TODAY is the issue date, a weekday the first such day after it, a holiday no date (a multi-day block: see the THROUGH test below)', () => {
  assert.deepEqual(periodWhen('WEDNESDAY', '2026-11-10'), {date: '2026-11-11', part: 'day'});
  assert.deepEqual(periodWhen('TUESDAY', '2026-11-10'), {date: '2026-11-17', part: 'day'});
  assert.deepEqual(periodWhen('REST OF TODAY', '2026-11-09'), {date: '2026-11-09', part: 'day'});
  assert.deepEqual(periodWhen('TONIGHT', '2026-11-09'), {date: '2026-11-09', part: 'night'});
  assert.deepEqual(periodWhen('THURSDAY NIGHT', '2026-11-10'), {date: '2026-11-12', part: 'night'});
  for (const l of ['VETERANS DAY', 'EXTENDED']) assert.deepEqual(periodWhen(l, '2026-11-10'), {date: null, part: null});
  assert.equal(facingOf('Northwest Facing Beaches'), 'northwest'); assert.equal(facingOf('East Coast'), 'east'); assert.equal(facingOf(null), null);
});

test('MTR: zones, local issue date, one entry per facing, other lines kept as written, tides left out, an alert line kept', () => {
  const p = parseSrf(MTR); assert.equal(p.zones.length, 2); assert.equal(p.office, 'KMTR');
  const z = zone(p, 'CAZ509'); assert.equal(z.name, 'SAN FRANCISCO AND SAN MATEO COUNTY COASTAL AREAS'); assert.deepEqual(z.issued, {date: '2026-11-10', time: '1026 PM', tz: 'PST', weekday: 'Tue'});
  const [wed, thu] = z.periods; assert.deepEqual([wed.label, wed.date, wed.part], ['WEDNESDAY', '2026-11-11', 'day']); assert.deepEqual(thu.date, '2026-11-12');
  assert.deepEqual(wed.surf.map((e: any) => [e.facing, e.lo, e.hi]), [['northwest', 7, 11], ['south', 3, 5]]); assert.deepEqual(thu.surf.map((e: any) => [e.facing, e.lo, e.hi]), [['west', 10, 14], ['south', 3, 6]]);
  assert.deepEqual(wed.other['Water Temperature'], [{value: 'Around 65 degrees.'}]); assert.equal(wed.other.Wind[0].value, 'N at 5 MPH becoming N at 3 MPH.'); assert.ok(!('Tides' in wed.other));
  assert.deepEqual(zone(p, 'CAZ530').alerts, ['COASTAL FLOOD ADVISORY THROUGH 4 PM FRIDAY']);
});

test('BOX: sub-lines per coast, the rip current risk per coast, inline periods, a holiday with no date', () => {
  const p = parseSrf(BOX), z = zone(p, 'MAZ022'), [today, tue, vet, thu] = z.periods;
  assert.deepEqual([today.label, today.date], ['REST OF TODAY', '2026-11-09']); assert.deepEqual(today.surf.map((e: any) => [e.label, e.facing, e.lo, e.hi]), [['East Coast', 'east', 3, 5]]);
  assert.deepEqual(today.rip, {'East Coast': 'Low.'}); assert.equal(today.other['Water Temperature'][0].label, 'East Coast'); assert.deepEqual([tue.date, tue.surf[0].lo, tue.surf[0].hi], ['2026-11-10', 4, 5]);
  assert.deepEqual([vet.label, vet.date, vet.surf[0].lo, vet.surf[0].hi], ['VETERANS DAY', null, 3, 5]); assert.deepEqual([thu.date, thu.surf[0].kind, thu.surf[0].lo], ['2026-11-12', 'around', 2]);
  const n = zone(p, 'MAZ024').periods[0]; assert.deepEqual(n.surf.map((e: any) => [e.facing, e.lo, e.hi]), [['east', 4, 6], ['south', 5, 7]]); assert.deepEqual(n.rip, {'East Coast': 'High.', 'South Coast': 'Moderate.'});
});

test('GUM: a bare "Surf Height" with facing reefs, several zones in one header, rip current, other lines', () => {
  const z = parseSrf(GUM).zones[0]; assert.deepEqual(z.ugc, ['GUZ001', 'MPZ001', 'MPZ002', 'MPZ003']); const p = z.periods[0];
  assert.deepEqual(p.surf.map((e: any) => [e.facing, e.lo, e.hi]), [['north', 5, 7], ['east', 5, 7], ['south', 2, 4], ['west', 5, 7]]); assert.deepEqual(p.rip, {all: 'Moderate *.'}); assert.equal(p.other['Swell/Period'][0].label, 'Primary swell');
});

test('MFR: "16 FT." is a single value, not a range; the empty Tides key does not swallow the next lines', () => {
  const z = parseSrf(MFR).zones[0]; assert.deepEqual([z.periods[0].surf[0].kind, z.periods[0].surf[0].lo, z.periods[0].surf[0].hi], ['single', 16, 16]); assert.equal(z.periods[1].surf[0].lo, 15);
  assert.equal(z.periods[0].other['Water Temperature'][0].value, 'Around 56 degrees.');
});

test('HFO: the facing table is read by half-day columns only when the columns match; a TONIGHT half keeps its label and no date-part guess', () => {
  const z = parseSrf(HFO).zones[0], halves = z.periods.filter((p: any) => /AM|PM/.test(p.label));
  assert.deepEqual(halves.map((p: any) => p.label), ['TONIGHT PM', 'TONIGHT AM', 'WEDNESDAY AM', 'WEDNESDAY PM']);
  const wedPm = halves[3]; assert.equal(wedPm.date, '2026-11-11'); assert.deepEqual(wedPm.surf.map((e: any) => [e.facing, e.lo, e.hi]), [['north', 15, 20], ['west', 10, 15]]); assert.equal(wedPm.part, 'day-pm');
  const broken = parseSrf(prod('HFO', HFO.productText.replace('14-18  15-20', '14-18'))); assert.ok(!broken.zones[0].periods.some((p: any) => /AM|PM/.test(p.label))); assert.ok(broken.notes.length > 0);
});

test('the product with no zone block says so; nothing is invented', () => {
  const p = parseSrf({id: 'x', issuingOffice: 'KXXX', issuanceTime: '2026-11-11T00:00:00Z', productText: 'Surf Height...3 to 5 feet.'}); assert.deepEqual(p.zones, []); assert.deepEqual(p.notes, ['no zone blocks found']);
});

test('pickEntry: zone-wide entry as it is; facing matched within 45 degrees; ties, mismatches, no bearing and "or less" give a reason', () => {
  const E = (facing: string | null, lo: number | null, hi: number | null, kind = 'range') => ({label: facing, facing, lo, hi, kind, raw: '', then: null, sets: null});
  const two = [E('northwest', 7, 11), E('south', 3, 5)];
  assert.equal(pickEntry([E(null, 2, 3)], undefined).entry!.lo, 2);
  assert.deepEqual([pickEntry(two, 300).entry!.lo, pickEntry(two, 300).diff], [7, 15]); assert.equal(pickEntry(two, 190).entry!.lo, 3);
  assert.match(pickEntry(two, 90).reason!, /more than 45 degrees/); assert.match(pickEntry(two, undefined).reason!, /no seaward bearing/);
  assert.match(pickEntry([E('west', 5, 7), E('north', 3, 4)], 315).reason!, /ambiguous/);
  assert.match(pickEntry([E(null, null, 1, 'or_less')], 0).reason!, /or less/); assert.match(pickEntry([{...E(null, null, null, 'text')}], 0).reason!, /no readable/);
});

test('a multi-day block ("THIS AFTERNOON THROUGH FRIDAY", SGX 2026-11-12) covers each day from its start to its end', () => {
  assert.deepEqual(periodWhen('THIS AFTERNOON THROUGH FRIDAY', '2026-11-12'), {date: '2026-11-12', part: 'day', dateEnd: '2026-11-13'});
  assert.deepEqual(periodWhen('SATURDAY THROUGH MONDAY', '2026-11-12'), {date: '2026-11-14', part: 'day', dateEnd: '2026-11-16'});
  assert.deepEqual(periodWhen('NONSENSE THROUGH FRIDAY', '2026-11-12'), {date: null, part: null});
  assert.deepEqual(periodWhen('SATURDAY', '2026-11-12'), {date: '2026-11-14', part: 'day'});   // single days unchanged
});
