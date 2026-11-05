import test from 'node:test';
import assert from 'node:assert/strict';
import {demoBoards} from '../data/demo.ts';
import {MODELLED_NOTE, REFERENCE_BOARDS, migrateDemoBoards, referenceFor, volumeLabel} from '../data/referenceBoards.ts';
import {boardCurves, boardParamsFor, buildBoard} from '../features/scale/boardMesh.ts';
import {defaultLook, finsFromText} from '../features/quiver/looks.ts';
import {validDimensions} from '../utils/units.ts';
import type {Surfboard} from '../models/index.ts';

const IN = 0.0254;
const byId = (id: string) => demoBoards.find((b) => b.id === id)!;
const params = (b: Surfboard) => boardParamsFor(b, null, referenceFor(b));

test('real boards: the published numbers, the real names, no fictional wording', () => {
  const want: Record<string, [string, string, number, number, number, number, string, string]> = {
    'demo-short': ['Sharp Eye', 'Inferno 72 C1 Carbon', 70, 19.25, 2.625, 29.4, 'Squash', 'Thruster'],
    'demo-fish': ['Firewire', 'Seaside (Helium)', 71, 22.75, 2.75, 41.1, 'Swallow', 'Quad'],
    'demo-long': ['Wavestorm', "8' Classic", 96, 22.5, 3.25, 86, 'Round', 'Thruster'],
    'demo-step': ['Pyzel', 'Ghost', 78, 20.5, 3, 40.1, 'Squash', 'Thruster'],
  };
  assert.equal(demoBoards.length, 4);
  for (const b of demoBoards) {
    const [mk, model, l, w, t, v, tail, fins] = want[b.id];
    assert.deepEqual([b.manufacturer, b.model, b.length, b.width, b.thickness, b.volume, b.tail, b.fins], [mk, model, l, w, t, v, tail, fins], b.id);
    assert.ok(validDimensions(b.length, b.width, b.thickness, b.volume), b.id);
    assert.equal(b.specificationSource, MODELLED_NOTE); assert.ok(b.demo);
    assert.ok(!/fictional|Demo Workshop/i.test(JSON.stringify(b)), 'no fictional wording');
    assert.equal(b.rocker, undefined, 'rocker is not published: left unset');
  }
});

test('real boards: traced outlines are numbers only, 40 stations, believable shapes', () => {
  for (const [id, r] of Object.entries(REFERENCE_BOARDS)) {
    assert.equal(r.hw.length, 40, id);
    assert.ok(r.hw.every((x) => typeof x === 'number' && x > 0 && x < 0.5), id);
    const b = byId(id), mx = Math.max(...r.hw), wide = r.hw.indexOf(mx) / 39;
    assert.ok(Math.abs(2 * mx * b.length - b.width) < 0.05, `${id}: scaled to the published width`);
    assert.ok(wide > 0.3 && wide < 0.65, `${id}: wide point mid-board (${wide})`);
    assert.ok(r.hw[0] < 0.25 * mx && r.hw[39] < 0.6 * mx, `${id}: closes at the nose and tail`);
  }
  // the fish is the widest planform, the step-up the narrowest for its length
  assert.ok(Math.max(...REFERENCE_BOARDS['demo-fish'].hw) > Math.max(...REFERENCE_BOARDS['demo-step'].hw));
});

test('real boards: buildBoard params per board (photo fields, tail, fins, soft-top, measured rocker)', () => {
  const short = params(byId('demo-short')), fish = params(byId('demo-fish')), long = params(byId('demo-long')), step = params(byId('demo-step'));
  for (const p of [short, fish, long, step]) { assert.equal(p.outline.source, 'photo'); assert.equal(p.traced?.length, 40); assert.equal(p.foil.source, 'default'); }
  assert.deepEqual([short.tail.value, fish.tail.value, long.tail.value, step.tail.value], ['squash', 'swallow', 'round', 'squash']);
  assert.deepEqual([short.fins.value, fish.fins.value, long.fins.value, step.fins.value], ['thruster', 'quad', 'thruster', 'thruster']);
  assert.ok(Math.abs(long.thicknessM.value - 3.25 * IN) < 1e-9 && Math.abs(short.thicknessM.value - 2.625 * IN) < 1e-9);
  // the Wavestorm: rocker measured from the side profile, soft-top build; the others keep the category rocker
  assert.equal(long.rocker.source, 'photo'); assert.ok(Math.abs(long.rocker.value.noseM - 5.05 * IN) < 1e-9 && Math.abs(long.rocker.value.tailM - 2.3 * IN) < 1e-9);
  assert.equal(long.softTop?.value, true); assert.equal(long.softTop?.source, 'photo'); assert.equal(long.rail.value, 'soft');
  for (const p of [short, fish, step]) { assert.equal(p.rocker.source, 'default'); assert.equal(p.softTop, undefined); }
  // the drawn widths are the published ones
  for (const [id, p] of [['demo-short', short], ['demo-fish', fish], ['demo-long', long], ['demo-step', step]] as const) {
    const c = boardCurves(p); let mx = 0; for (let t = 0; t <= 1; t += 0.005) mx = Math.max(mx, c.half(t));
    assert.ok(Math.abs(2 * mx - byId(id).width * IN) < 0.002, id);
  }
  // meshes: quad = 4 fins, thruster = 3; the soft-top has no stringer, a foam deck group and a flat bottom
  assert.equal(buildBoard(fish).fins.length, 4); assert.equal(buildBoard(short).fins.length, 3);
  const lg = buildBoard(long), parts = lg.groups.map((g) => g.part);
  assert.ok(!parts.includes('stringer') && parts.includes('wax'));
  assert.equal(lg.curves.concave(0.4, 0), 0);
  assert.ok(buildBoard(short).groups.some((g) => g.part === 'stringer'));
  // the user's own traced outline still wins over the reference outline
  const own = Array.from({length: 40}, (_, i) => 0.1 * Math.sin(Math.PI * (i + 0.5) / 40));
  assert.equal(boardParamsFor(byId('demo-short'), own, referenceFor(byId('demo-short'))).traced, own);
});

test('real boards: the reference follows the model, looks and fins', () => {
  assert.ok(referenceFor(byId('demo-short')));
  assert.equal(referenceFor({...byId('demo-short'), model: 'My own board'}), null, 'a re-purposed example board loses the reference shape');
  assert.equal(referenceFor({id: 'mine', model: 'Ghost'}), null); assert.equal(referenceFor({id: 'demo-short', model: 'Inferno 72 C1 Carbon'}), null, 'without demo and the published dimensions there is no reference');
  assert.equal(defaultLook(byId('demo-short')).pattern, 'carbon');
  assert.equal(defaultLook(byId('demo-long')).pattern, 'stripes'); assert.equal(defaultLook(byId('demo-long')).finish, 'matte');
  assert.equal(defaultLook(byId('demo-fish')).fins, 'quad'); assert.equal(defaultLook(byId('demo-step')).pattern, undefined);
  assert.equal(finsFromText({fins: 'Quad', type: 'Fish'}), 'quad'); assert.equal(finsFromText({fins: '2+1', type: 'Longboard'}), 'thruster');
});

test('real boards: saved fictional example boards migrate (same ids, favourite kept) only while still the exact old record; edited and own boards do not', () => {
  const oldFish: Surfboard = {id: 'demo-fish', name: 'Small-day fish', manufacturer: 'Demo Workshop', model: 'Drift (fictional)', type: 'Fish', length: 70, width: 21, thickness: 2.625, volume: 36, tail: 'Swallow', fins: 'Twin', rocker: 'Low', character: 'Soft', favorite: true, demo: true};
  const old: Surfboard[] = [
    oldFish,
    {id: 'demo-short', name: 'My driver', manufacturer: 'Demo Workshop', model: 'Arc (fictional)', type: 'Performance shortboard', length: 72, width: 19.5, thickness: 2.5, volume: 30, favorite: false, demo: false},
    {id: 'mine', name: 'Mine', manufacturer: 'Me', model: 'X', type: 'Fish', length: 66, width: 21, thickness: 2.5, volume: 33, favorite: false},
  ];
  const m = migrateDemoBoards(old);
  assert.equal(m[0].model, 'Seaside (Helium)'); assert.equal(m[0].favorite, true); assert.equal(m[0].id, 'demo-fish');
  assert.equal(m[1], old[1]); assert.equal(m[2], old[2]);
  assert.deepEqual(migrateDemoBoards(structuredClone(demoBoards)), demoBoards, 'the new records are stable');
  // an edited example board (the showroom saves keep demo:true) is left alone, whatever field the person changed
  for (const edit of [{length: 71}, {width: 21.5}, {thickness: 2.7}, {volume: 38}, {tail: 'Round'}, {fins: 'Quad'}, {name: 'My fish'}, {model: 'Drift 2'}, {manufacturer: 'Me'}, {type: 'Hybrid'}, {rocker: 'High'}, {character: 'Steep'}, {construction: 'PU'}, {notes: 'my note'}] as Partial<Surfboard>[]) {
    const edited = {...oldFish, ...edit}; assert.equal(migrateDemoBoards([edited])[0], edited, `edited ${Object.keys(edit)[0]} stays as saved`);
  }
  // the other three old records migrate when untouched (frozen table)
  const oldStep: Surfboard = {id: 'demo-step', name: 'Bigger-day option', manufacturer: 'Demo Workshop', model: 'Reach (fictional)', type: 'Step-up', length: 78, width: 19.5, thickness: 2.75, volume: 35, rocker: 'High', character: 'Powerful', favorite: false, demo: true};
  assert.equal(migrateDemoBoards([oldStep])[0].model, 'Ghost'); assert.equal(migrateDemoBoards([{...oldStep, tail: 'Squash'}])[0].tail, 'Squash', 'a step-up that gained a tail was edited');
  assert.equal(migrateDemoBoards([{...oldStep, tail: 'Squash'}])[0].model, 'Reach (fictional)');
});

test('real boards (honesty): an edited example board loses the published-specs label and the reference outline; the volume qualifier and unset character', () => {
  for (const d of demoBoards) {
    assert.ok(referenceFor(d), d.id);
    for (const edit of [{length: d.length + 1}, {width: d.width + 0.25}, {thickness: d.thickness + 0.125}, {demo: false}, {demo: undefined}] as Partial<Surfboard>[]) assert.equal(referenceFor({...d, ...edit}), null, `${d.id} ${Object.keys(edit)[0]}`);
    assert.equal(d.character, undefined, `${d.id}: character is not published, so it is unset`);
    assert.match(d.notes ?? '', /https?:\/\//, `${d.id}: the exact source URL is in the notes`);
  }
  const fish = demoBoards.find((d) => d.id === 'demo-fish')!;
  assert.equal(volumeLabel(fish), '41.1 L (retailer photo)'); assert.equal(volumeLabel({...fish, length: 72}), '41.1 L', 'an edited board carries no retailer qualifier');
  assert.equal(volumeLabel(demoBoards.find((d) => d.id === 'demo-short')!), '29.4 L');
});

test('real boards: the small-day band accepts a soft-top (where Longboard was listed), and boardForBand still picks the Ghost for a big day', async () => {
  const {BANDS, bandFor, boardForBand} = await import('../features/scale/surfSceneConfig.ts');
  assert.ok(BANDS[0].boardTypes.includes('Soft-top'));
  assert.equal(boardForBand(bandFor(12), 12, demoBoards, 5 + 10 / 12), 'demo-step', 'a 12 ft day gets the Ghost, not the Inferno');
});
