import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {run, mapNotes, applyBlock, blockFor, rowFor, existingRows, START, END, HEADING} from '../../scripts/vault-forecast-log.mjs';
import {evidenceSpots} from '../ocean/spots.ts';
import {ratingAt} from '../services/coastSnapshot.ts';
import {spotResult, offshoreLine, ratingLine, type OffshorePair, type RatingPair} from '../services/howRightAll.ts';

const CAP = JSON.parse(fs.readFileSync(new URL('./fixtures/coast-capture-2026-11-10.json', import.meta.url), 'utf8')), IDS = Object.keys(CAP.spots) as string[], SPOTS = evidenceSpots.filter((s) => IDS.includes(s.id));
const HOUR = 3600000, NOW = Date.parse('2026-11-10T20:00:00Z'), SCORED = Date.UTC(2026, 10, 20, 12);
const pairs = (days: number): OffshorePair[] => Array.from({length: days * 24}, (_, i) => ({t: SCORED - i * HOUR, leadH: 20, fcHs: 1.2, obHs: 1.5, fcSw: 1.0, obSw: 1.2, fcSwP: 12, obSwP: 14, fcSwD: 290, obSwD: 300})).reverse();
const PICK = {buoy: {id: '46237', name: 'San Francisco Bar', lat: 37.79, lon: -122.63, sheltered: false}, km: 11.4, bearing: 287, window: {fromDeg: 180, toDeg: 292.5}};
const noRating = {pairs: [] as RatingPair[], windHours: 0};

/** A temporary vault, a local copy of the bucket, and the notes the script has to find, leave alone or report. */
function fixture(extra: {scorecard?: boolean} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-log-')), vault = path.join(root, 'Spots'), r2 = path.join(root, 'r2');
  fs.mkdirSync(path.join(vault, 'World/Somewhere'), {recursive: true}); fs.mkdirSync(path.join(vault, '99-Private'), {recursive: true}); fs.mkdirSync(path.join(vault, '.obsidian'), {recursive: true});
  const note = (rel: string, body: string) => { const f = path.join(vault, rel); fs.writeFileSync(f, body); return f; };
  const fm = (id: string | null, name: string, alias = '') => `---\ntype: reference\nupdated: 2026-11-02\n${alias ? `aliases:\n  - "${alias}"\n` : ''}${id ? `spot_id: ${id}\n` : ''}---\n# ${name}\n\nHand-written text about ${name}.\n\n## Coverage\nKept exactly.\n`;
  const files = {
    byId: note('Spot-Ocean-Beach.md', fm('spot-2', 'Ocean Beach')),                                                  // matched by spot_id
    byName: note('World/Somewhere/Spot-Malibu.md', fm(null, 'Malibu')),                                              // matched by its title (no id)
    headingOnly: note('Spot-Crescent.md', fm('cs-crescent-city', 'Crescent City') + `\n${HEADING}\n\nMy own line under the heading.\n\n## After\nTail.\n`),   // heading but no markers
    notApp: note('Spot-Elsewhere.md', fm('w-australia-nowhere', 'Nowhere')),                                         // a spot that is not in the app
    twinA: note('Spot-Dup-A.md', fm(null, 'Dillon Beach')), twinB: note('Spot-Dup-B.md', fm(null, 'Dillon Beach')),    // ambiguous by name
    private: note('99-Private/Spot-Private.md', fm('w-hawaii-unreals', 'Unreals')), obsidian: note('.obsidian/Spot-X.md', fm('cs-brookings', 'Brookings')),
  };
  fs.mkdirSync(path.join(r2, 'howright/v2/shown'), {recursive: true});
  fs.writeFileSync(path.join(r2, 'howright/v2/shown/2026-11-10.json'), JSON.stringify(CAP)); fs.writeFileSync(path.join(r2, 'howright/v2/_status.json'), JSON.stringify({captureDate: '2026-11-10', captureComplete: true}));
  if (extra.scorecard) fs.writeFileSync(path.join(r2, 'howright/v2/scorecard.json'), JSON.stringify({schema: 2, computedAt: '2026-11-10T07:44:28.925Z', spots: {'spot-2': spotResult('spot-2', PICK, true, pairs(10), noRating, null, SCORED), 'cs-malibu': spotResult('cs-malibu', PICK, true, pairs(1), noRating, null, SCORED)}}));
  return {root, vault, r2, files};
}
const quiet = () => {};
const snapshotOf = (dir: string) => Object.fromEntries(fs.readdirSync(dir, {recursive: true, withFileTypes: true}).filter((e) => e.isFile()).map((e) => [path.join(e.parentPath, e.name), fs.readFileSync(path.join(e.parentPath, e.name), 'utf8')]));

test('notes are found by spot_id first, then by an unambiguous title; the misses and the ambiguous are reported; 99-Private and .obsidian are never read', () => {
  const {vault, files} = fixture(), m = mapNotes(vault, SPOTS);
  assert.equal(m.map.get('spot-2'), files.byId); assert.equal(m.map.get('cs-malibu'), files.byName); assert.equal(m.map.get('cs-crescent-city'), files.headingOnly);
  assert.ok(!m.map.has('w-hawaii-unreals') && !m.map.has('cs-brookings'), 'a note under 99-Private or .obsidian is not used'); assert.ok(![...m.map.values()].some((f) => /99-Private|\.obsidian/.test(f)));
  assert.deepEqual(m.ambiguous, ['cs-dillon-beach'], 'two notes called Dillon Beach: not guessed'); assert.ok(m.missing.includes('cs-brookings') && m.missing.includes('w-hawaii-unreals')); assert.equal(m.stale, 1, 'the Australian note is not an app spot'); assert.equal(m.notes, 6, 'the private and .obsidian files were not even listed');
});
test('the row is the capture\'s own numbers: the best daylit window and word are the engine\'s (peak = the highest daylit score), Hs and wind are the capture\'s range, the model-run age is capture minus retrieval', () => {
  const r = rowFor('spot-2', CAP, 'America/Los_Angeles')!, c = CAP.spots['spot-2'];
  const day = c.marine.time.map((t: number) => ratingAt('spot-2', c, t)).filter((e: any) => e && e[0] !== null && e[2] === 0), peak = Math.max(...day.map((e: any) => e[0]));
  assert.match(r.window, new RegExp(`^\\w{3}, Nov \\d+ \\d+ [AP]M–\\d+ [AP]M PST: \\w+ \\(peak ${peak}\\)$`)); assert.equal(r.date, '2026-11-10'); assert.equal(r.captured, 'Nov 9, 11:40 PM PST');
  const hs = c.marine.wave_height, lo = Math.min(...hs), hi = Math.max(...hs); assert.ok(r.hs.startsWith(`${+lo.toFixed(1)}–${+hi.toFixed(1)} m (`), r.hs); assert.match(r.wind, /^\d+–\d+ mph(, [NESW]+ at the best hour)?$/); assert.match(r.age, /^(<1|\d+) h$/);
  assert.equal(rowFor('not-captured', CAP), null);
});
test('a run writes the block under the heading, changes NOTHING else, is idempotent (a second run changes no byte), and --dry-run prints without writing', async () => {
  const {vault, r2, files} = fixture({scorecard: true}), before = snapshotOf(vault);
  const dry: string[] = [], d = await run({vault, dir: r2, dryRun: true, now: NOW, spots: SPOTS, log: (x: string) => dry.push(x)}); assert.deepEqual(snapshotOf(vault), before, 'a dry run writes nothing'); assert.equal(d.changed.length, 3); assert.match(dry.join('\n'), /DRY RUN: .*3 note\(s\) would change.*\d+ app spots have no note, 1 ambiguous/s); assert.match(dry.join('\n'), /would change .*Spot-/);
  const r1 = await run({vault, dir: r2, now: NOW, spots: SPOTS, log: quiet}); assert.deepEqual(r1.changed.sort(), [files.byId, files.byName, files.headingOnly].sort()); const after = snapshotOf(vault);
  for (const [f, text] of Object.entries(after)) { if (![files.byId, files.byName, files.headingOnly].includes(f)) assert.equal(text, before[f], 'untouched: ' + f); }
  for (const f of [files.byId, files.byName, files.headingOnly]) { const a = after[f], b = before[f], i = a.indexOf(START), j = a.indexOf(END) + END.length; assert.ok(i > 0 && j > i); assert.equal(a.replace(a.slice(i, j), '').replace(/\n{3,}/g, '\n\n').includes('Hand-written text'), true); assert.ok(a.startsWith(b.slice(0, b.indexOf('\n## Forecast log') >= 0 ? b.indexOf('\n## Forecast log') : b.replace(/\s*$/, '').length)), 'everything before the block is unchanged: ' + f); }
  assert.match(after[files.byId], new RegExp(`${HEADING}\\n\\n${START}`), 'a note with no heading gets the heading and the block at its end'); assert.ok(after[files.headingOnly].includes(`${HEADING}\n${START}`) || after[files.headingOnly].includes(`${HEADING}\n\n${START}`)); assert.ok(after[files.headingOnly].includes('My own line under the heading.') && after[files.headingOnly].includes('## After\nTail.'), 'the note\'s own text under and after the heading stays');
  const r2run = await run({vault, dir: r2, now: NOW, spots: SPOTS, log: quiet}); assert.equal(r2run.changed.length, 0, 'second run: no diff'); assert.deepEqual(snapshotOf(vault), after);
});
test('the How-right lines are the scorecard\'s own words verbatim when it has numbers, "collecting: N days" otherwise, and a spot with no scorecard entry says so; the source line names the capture', async () => {
  const {vault, r2, files} = fixture({scorecard: true}); await run({vault, dir: r2, now: NOW, spots: SPOTS, log: quiet});
  const sc = JSON.parse(fs.readFileSync(path.join(r2, 'howright/v2/scorecard.json'), 'utf8')).spots, ob = fs.readFileSync(files.byId, 'utf8'), ml = fs.readFileSync(files.byName, 'utf8'), cr = fs.readFileSync(files.headingOnly, 'utf8');
  assert.equal(sc['spot-2'].status, 'ok'); assert.ok(ob.includes(`- ${offshoreLine(sc['spot-2']).text}`)); assert.match(ob, /Offshore wave height at the buoy \(not surf at the spot\): .*typical difference/); if (ratingLine(sc['spot-2'])) assert.ok(ob.includes(`- ${ratingLine(sc['spot-2'])!.text}`));
  assert.equal(sc['cs-malibu'].status, 'collecting'); assert.match(ml, /- How right we've been: collecting: 1 day so far \(we need 3 before showing a number\)/); assert.doesNotMatch(ml, /typical difference/);
  assert.match(cr, /- How right we've been: no scorecard yet|collecting|No offshore check/); assert.match(ob, /Source: SWELLO daily forecast capture .*capture 2026-11-10T07:40:44\.464Z\), re-rated with the current rating engine; scorecard computed 2026-11-10T07:44:28\.925Z\. Offshore model values, not surf at the spot\./);
});
test('the table keeps the last 14 capture days and drops older rows; an older day\'s row is read back unchanged, and today\'s row replaces the same date', () => {
  const old = Array.from({length: 15}, (_, i) => `| 2026-10-${String(30 - i).padStart(2, '0')} | x | window ${i} | hs | wind | run |`);
  const prev = `${START}\n| h |\n|---|\n${old.join('\n')}\n${END}`, rows = existingRows(prev); assert.equal(rows.size, 15);
  const b = blockFor('spot-2', CAP, null, prev), lines = b.split('\n').filter((l) => /^\| \d{4}-/.test(l)); assert.equal(lines.length, 14); assert.ok(lines[0].startsWith('| 2026-11-10 |')); assert.equal(lines[1], old[0], 'yesterday\'s row is verbatim'); assert.ok(!b.includes('2026-10-17'), 'the 15th day dropped');
  const again = blockFor('spot-2', CAP, null, b); assert.equal(again, b, 'the same capture again gives the same block');
  const note = `x\n\n${HEADING}\n\n${b}\n\nafter`, replaced = applyBlock(note, blockFor('spot-2', CAP, null, note)); assert.equal(replaced, note);
});
test('no complete capture: nothing is written; and the script never writes into 99-Private', async () => {
  const {vault, root, files} = fixture(); const before = snapshotOf(vault), empty = path.join(root, 'empty'); fs.mkdirSync(empty);
  const r = await run({vault, dir: empty, now: NOW, spots: SPOTS, log: quiet}); assert.equal(r.wrote, false); assert.deepEqual(snapshotOf(vault), before);
  await run({vault, dir: path.join(root, 'r2'), now: NOW, spots: SPOTS, log: quiet}); assert.equal(fs.readFileSync(files.private, 'utf8'), before[files.private]); assert.equal(fs.readFileSync(files.obsidian, 'utf8'), before[files.obsidian]);
});
