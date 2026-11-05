import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAtlas, faceDistanceAt, breakX, type AtlasMeta} from '../features/scale/waveAtlas.ts';
import {RiderSim, S, buildPlan, planAt, defaultStance, hashSeed, isFrontside, lerpState, STATE_N, Spring, wrapPi} from '../features/scale/rideSim.ts';
import {BOARD, RIDE, SKILLS, bandFor, boardForBand} from '../features/scale/surfSceneConfig.ts';
import type {Skill} from '../models/index.ts';

const meta = (o: Partial<AtlasMeta> = {}): AtlasMeta => ({band: '4-6', face_m: 1.52, family: 'peeler', breaker: 'plunging', stages: 12, points: 96, stage_feather: 2, stage_pitch: 4, stage_land: 6,
  y0_m: -14, y1_m: 5, bed_along_per_m: 0.027, cycle_s: 6.5, break_len_m: 38, shoulder_len_m: 40, depth_break_m: 1.95, celerity_mps: 4.37, peel_speed_mps: 5.9, period_s: 13, Lb_m: 57, ...o});
const toHalf = (v: number) => { const f = new Float32Array([v]), i = new Uint32Array(f.buffer)[0], s = (i >>> 16) & 0x8000, e = ((i >>> 23) & 0xff) - 127 + 15, m = i & 0x7fffff;
  if (v === 0) return 0; if (e <= 0) return s; return s | (e << 10) | Math.round(m / 8192); };
// a smooth hump at every stage: back from y=-6..0 (cosine), face 0..+2.4 (a steepening front), so the face has a real slope profile
const synth = (m: AtlasMeta) => { const n = m.points * m.stages * 2 * 4, h = new Uint16Array(n), H = m.face_m;
  for (let s = 0; s < m.stages; s++) for (let i = 0; i < m.points; i++) { const u = i / (m.points - 1), y = -6 + 8.4 * u;
    const z = y < 0 ? H * 0.5 * (1 + Math.cos(Math.PI * y / 6)) : Math.max(0, H * (1 - (y / 2.4) ** 0.6)); const o = (s * m.points + i) * 4; h[o] = toHalf(y); h[o + 1] = toHalf(z); }
  return makeAtlas(m, h.buffer); };

test('seed and stance are deterministic; frontside follows stance and direction', () => {
  assert.equal(hashSeed('ocean-beach|2026-11-04T15:00'), hashSeed('ocean-beach|2026-11-04T15:00'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
  assert.equal(defaultStance(7), defaultStance(7));
  assert.ok(['regular', 'goofy'].includes(defaultStance(7)));
  assert.equal(isFrontside('goofy', 'left'), true); assert.equal(isFrontside('regular', 'left'), false);
  assert.equal(isFrontside('regular', 'right'), true); assert.equal(isFrontside('goofy', 'right'), false);
});

test('the spring is critically damped and stable through a 50 ms step', () => {
  const s = new Spring().set(1); for (let i = 0; i < 200; i++) s.step(0, 0.05, 40);
  assert.ok(Math.abs(s.x) < 1e-6 && Math.abs(s.v) < 1e-6);
  const q = new Spring().set(0); let overshoot = 0; for (let i = 0; i < 400; i++) { q.step(1, 1 / 120, 10); overshoot = Math.max(overshoot, q.x - 1); } assert.ok(overshoot < 1e-6, 'no overshoot');
});

test('the plan is a closed C1 loop per skill: continuous, derivative matches a finite difference, moves cycle trim/bottom/top', () => {
  for (const skill of ['Beginner', 'Intermediate', 'Expert'] as Skill[]) {
    const p = buildPlan(skill, 42, 1.83), a = {u: 0, v: 0, comp: 0, du: 0, dv: 0, seg: 0, move: 'trim' as const, pose: 'trim' as const, ahead: 0.32}, b = {...a};
    planAt(p, 0, a); planAt(p, p.period, b); assert.ok(Math.abs(a.u - b.u) < 1e-9 && Math.abs(a.v - b.v) < 1e-9, `${skill} closes`);
    const moves = new Set<string>(); let worst = 0;
    for (let t = 0; t < p.period; t += 0.005) { planAt(p, t, a); planAt(p, t + 0.005, b); moves.add(a.move);
      worst = Math.max(worst, Math.abs((b.u - a.u) / 0.005 - a.du), Math.abs((b.v - a.v) / 0.005 - a.dv)); assert.ok(a.v > -0.05 && a.v < 1 && (a.u < 0 || a.move === 'barrel'), `${skill} in range`); }   // the spline may overshoot a knot slightly; the sim clamps v to [vMin, cap]; a barrel knot sits behind the curl (u > 0)
    assert.ok(worst < 0.2, `${skill} derivative vs finite difference: ${worst.toFixed(3)}`);
    for (const m of ['trim', 'bottom', 'top']) assert.ok(moves.has(m), `${skill} has ${m}`);
    assert.ok(p.period > 6 && p.period < 20, `${skill} period ${p.period.toFixed(1)} s`); assert.equal(p.band.id, 'C'); assert.ok(p.rideEnd < p.period && p.rideEnd > 4, `${skill} ride end ${p.rideEnd.toFixed(1)} s`);
    for (const m of ['takeoff', skill === 'Beginner' ? 'out' : 'kickout']) assert.ok(moves.has(m), `${skill} has ${m}`);
  }
  // jitter: a different seed gives a different plan; the same seed the same plan
  assert.notDeepEqual(buildPlan('Expert', 1, 1.83).times, buildPlan('Expert', 2, 1.83).times);
  assert.deepEqual(buildPlan('Expert', 5, 1.83).times, buildPlan('Expert', 5, 1.83).times);
});

test('the rider simulation: board on the water, ahead of the curl, smooth, deterministic, the rail banks into the turn', () => {
  const atlas = synth(meta()), m = atlas.meta, flowX = Math.min(m.peel_speed_mps, 6);
  for (const skill of ['Beginner', 'Intermediate', 'Expert'] as Skill[]) {
    const sim = new RiderSim(atlas, skill, 1234, flowX, null, 0), c = sim.cur, h = 1 / 120;
    let maxGap = 0, maxBridge = 0, maxRoll = 0, maxEnd = 0, maxTail = 0, maxDeg = 0, minAhead = Infinity, maxSpeed = 0, maxV = 0, minV = 1, bankOk = 0, bankBad = 0;
    const pF = [0, 0, 0], pU = [0, 0, 0];
    for (let i = 0; i < 120 * 12; i++) {
      sim.advance(h); const t = c[S.T], x = c[S.X], y = c[S.Y], z = c[S.Z];
      // the centre minus its deliberate bridge over a concave section (R8: the snap's pivoted board spans more of the face's curve, 1.7 cm here)
      // R11: plus the rail pivot's lift (the board on its rail: the centre sits rb sin(roll) above the face, the engaged rail in it)
      const lf = c[S.LIFT]; { const b = c[S.BRIDGE] + lf; maxGap = Math.max(maxGap, Math.abs(faceDistanceAt(atlas, x - c[S.NX] * b, y - c[S.NY] * b, z - c[S.NZ] * b, t))); maxBridge = Math.max(maxBridge, c[S.BRIDGE]); maxRoll = Math.max(maxRoll, Math.abs(c[S.ROLL])); }
      // the ends along the board axis, on the bottom plane: within a few cm of the water on this smooth synthetic face
      // (R8: a board pivoted up the face in the snap rides on its tail with the nose above the lip, so the nose is only checked while the board
      // pitches under 30 deg; the tail is always checked, within 10 cm)
      const ea = 0.77, pitched = Math.abs(c[S.FY]) > 0.5; for (const sgn of [1, -1]) { const ex = x + sgn * ea * c[S.FX] - c[S.NX] * lf, ey = y + sgn * ea * c[S.FY] - c[S.NY] * lf, ez = z + sgn * ea * c[S.FZ] - c[S.NZ] * lf; const g = Math.abs(faceDistanceAt(atlas, ex, ey, ez, t)); if (sgn < 0) maxTail = Math.max(maxTail, g); if (sgn < 0 || !pitched) maxEnd = Math.max(maxEnd, g); }
      minAhead = Math.min(minAhead, breakX(m, t) - x); maxSpeed = Math.max(maxSpeed, c[S.SPEED]); maxV = Math.max(maxV, c[S.V]); minV = Math.min(minV, c[S.V]);
      if (i > 2) { const dF = Math.acos(Math.min(1, pF[0] * c[S.FX] + pF[1] * c[S.FY] + pF[2] * c[S.FZ])), dU = Math.acos(Math.min(1, pU[0] * c[S.UX] + pU[1] * c[S.UY] + pU[2] * c[S.UZ])); maxDeg = Math.max(maxDeg, dF, dU); }
      pF[0] = c[S.FX]; pF[1] = c[S.FY]; pF[2] = c[S.FZ]; pU[0] = c[S.UX]; pU[1] = c[S.UY]; pU[2] = c[S.UZ];
      // bank: with a positive roll (a left turn) the deck leans toward the left rail: U . (F x N) < 0, N the unrolled fit normal
      const rx = c[S.FY] * c[S.NZ] - c[S.FZ] * c[S.NY], ry = c[S.FZ] * c[S.NX] - c[S.FX] * c[S.NZ], rz = c[S.FX] * c[S.NY] - c[S.FY] * c[S.NX];
      if (Math.abs(c[S.ROLL]) > 0.05) { const d = (c[S.UX] * rx + c[S.UY] * ry + c[S.UZ] * rz) * Math.sign(c[S.ROLL]); if (d < 0) bankOk++; else bankBad++; }
    }
    assert.ok(maxGap < 0.01, `${skill}: centre on the face (${maxGap.toFixed(4)} m)`);
    assert.ok(maxBridge < 0.05, `${skill}: the bridge stays small on this smooth face (${maxBridge.toFixed(3)} m)`);
    assert.ok(maxEnd < 0.2, `${skill}: ends within 20 cm of the water on this cusped synthetic face (the real atlas is checked by the glitch monitor) (${maxEnd.toFixed(3)})`);
    assert.ok(maxTail < 0.1, `${skill}: the tail stays within 10 cm of the water, pivoted or not (${maxTail.toFixed(3)})`);
    assert.ok(minAhead >= Math.max(RIDE.minAheadFaces * m.face_m, RIDE.minAheadM) - 0.05, `${skill}: ahead of the curl by ${minAhead.toFixed(2)} m`);
    assert.ok(maxDeg * 180 / Math.PI < 8, `${skill}: board turns at most ${(maxDeg * 180 / Math.PI).toFixed(2)} deg per 1/120 s`);
    assert.ok(maxSpeed < RIDE.speedMaxMps && maxSpeed > 2, `${skill}: speed over the water ${maxSpeed.toFixed(1)} m/s`);
    assert.ok(minV >= RIDE.vMin - 1e-9 && maxV < 0.9, `${skill}: v ${minV.toFixed(2)}..${maxV.toFixed(2)}`);
    if (skill === 'Expert') assert.ok(maxV > 0.55, 'the expert reaches the upper face');
    assert.ok(maxRoll > 0.2 && maxRoll <= BOARD.rollMaxDeg * Math.PI / 180 + 1e-9, `${skill}: the board rides on its rail (max roll ${(maxRoll * 180 / Math.PI).toFixed(1)} deg)`);
    assert.ok(bankOk > 0 && bankBad === 0, `${skill}: the rail banks into the turn (${bankOk} ok, ${bankBad} wrong)`);
    // R13: the takeoff's and the exit's u are relative to the band's pocket; placed, they are ahead of the curl on every band
    for (const H of [0.61, 1.52, 1.83, 3.66]) assert.ok(buildPlan(skill, 1234, H).knots.filter((k) => k.move === 'takeoff' || k.move === 'kickout' || k.move === 'out').every((k) => k.u < 0), `${skill}: takeoff and exit ahead of the curl at ${H} m`);
  }
  // determinism: the same seed replays the same ride; a different seed does not
  const a = new RiderSim(atlas, 'Expert', 99, flowX, null, 0), b = new RiderSim(atlas, 'Expert', 99, flowX, null, 0), d = new RiderSim(atlas, 'Expert', 100, flowX, null, 0);
  for (let i = 0; i < 600; i++) { a.advance(1 / 60); b.advance(1 / 60); d.advance(1 / 60); }
  assert.deepEqual(Array.from(a.cur), Array.from(b.cur)); assert.notDeepEqual(Array.from(a.cur), Array.from(d.cur));
  // the render interpolation stays between the two states
  const out = new Float64Array(STATE_N); lerpState(a.prev, a.cur, 0.5, out); assert.ok(Math.abs(out[S.X] - (a.prev[S.X] + a.cur[S.X]) / 2) < 1e-12);
  assert.ok(Math.abs(wrapPi(3 * Math.PI)) - Math.PI < 1e-9);
});

test('style bands and the expertise layer (brief part 2): thresholds round to 0.5 ft, beginners never barrel or snap, experts play band A softly', () => {
  assert.equal(bandFor(3.7).id, 'A'); assert.equal(bandFor(3.76).id, 'B'); assert.equal(bandFor(5.7).id, 'B'); assert.equal(bandFor(5.76).id, 'C'); assert.equal(bandFor(9.7).id, 'C'); assert.equal(bandFor(9.76).id, 'D');
  const movesOf = (skill: Skill, H: number) => new Set(buildPlan(skill, 7, H).knots.map((k) => k.move));
  for (const H of [0.61, 1.83, 3.66, 6.1]) { const m = movesOf('Beginner', H); assert.ok(!m.has('barrel') && !m.has('cutback') && !m.has('pump'), `Beginner at ${H} m: ${[...m]}`); assert.ok(m.has('out')); }
  // round 4: an intermediate's barrel is a cover-up that never goes behind the curl; an expert's goes inside the tube (negative ahead) on every ride from 6 ft
  assert.ok(buildPlan('Intermediate', 7, 3.66).knots.every((k) => (k.ahead ?? 1) >= 0), 'Intermediate: never behind the curl');
  for (const H of [1.83, 2.44, 3.66, 6.1]) assert.ok(buildPlan('Expert', 7, H).knots.some((k) => k.move === 'barrel' && (k.ahead ?? 1) < 0), `Expert barrels inside at ${H} m`);
  assert.ok(!buildPlan('Expert', 7, 1.52).knots.some((k) => k.move === 'barrel'), 'no barrel under 6 ft');
  const a = buildPlan('Expert', 7, 0.61), b = buildPlan('Expert', 7, 1.83);
  assert.equal(a.band.id, 'A'); assert.equal(b.band.id, 'C'); assert.equal(buildPlan('Expert', 7, 1.37).band.id, 'B');
  const meanComp = (p: ReturnType<typeof buildPlan>) => p.knots.reduce((s, k) => s + k.comp, 0) / p.knots.length;
  assert.ok(meanComp(a) < meanComp(b), 'band A is more upright than band B');
  // the beginner rides further out than the expert on the same wave
  const avg = (p: ReturnType<typeof buildPlan>) => p.knots.reduce((s, k) => s + k.u, 0) / p.knots.length;
  assert.ok(avg(buildPlan('Beginner', 7, 1.83)) < avg(buildPlan('Intermediate', 7, 1.83)) && avg(buildPlan('Intermediate', 7, 1.83)) < avg(b));
  // the quiver board follows the band: a fish under 4 ft, a step-up at 12 ft, none without a quiver
  const q = [{id: 'f', type: 'Fish', length: 68}, {id: 's', type: 'Performance shortboard', length: 72}, {id: 'g', type: 'Step-up', length: 84}];
  assert.equal(boardForBand(bandFor(2), 2, q, 5.83), 'f'); assert.equal(boardForBand(bandFor(6), 6, q, 5.83), 's'); assert.equal(boardForBand(bandFor(12), 12, q, 5.83), 'g'); assert.equal(boardForBand(bandFor(12), 12, [], 5.83), null);
});
