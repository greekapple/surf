import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateBreakingV2, BREAKER_INDEX} from '../ocean/breakingEstimate.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';

// T-076: an INDEPENDENT check of the v2 transform from the MOP depth to the break. Linear wave theory, normal incidence (Dean & Dalrymple, Water Wave Mechanics for Engineers and Scientists, ch. 4;
// USACE Shore Protection Manual): dispersion ω² = g k tanh(kh); group speed Cg = (ω/k)·½(1 + 2kh/sinh 2kh); shoaling coefficient Ks = √(Cg(h0)/Cg(h)); the wave breaks where H = γ·h.
const G = 9.80665, FT = 1 / 0.3048;
const k = (T: number, h: number) => { const w = 2 * Math.PI / T; let lo = 1e-6, hi = 10; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; (G * m * Math.tanh(m * h) > w * w ? (hi = m) : (lo = m)); } return (lo + hi) / 2; };
const cg = (T: number, h: number) => { const kk = k(T, h), w = 2 * Math.PI / T, x = 2 * kk * h; return (w / kk) * 0.5 * (1 + x / Math.sinh(x)); };
const independent = (hs0M: number, T: number, h0: number, gamma: number) => { for (let h = h0; h > 0.1; h -= 0.005) { const H = hs0M * Math.sqrt(cg(T, h0) / cg(T, h)); if (H >= gamma * h) return {H, h}; } return null; };
const P = breakingProfile('spot-2')!;

test('v2 matches an independent linear-theory solve (shoaling only, normal incidence) to within 2%: it starts from the 10 m MOP value and does not shoal from deep water', () => {
  for (const [hsFt, T] of [[4.5, 14], [9.3, 15.4], [15, 15.4], [3, 10]] as const) {
    const ind = independent(hsFt / FT, T, 10, BREAKER_INDEX)!, r = estimateBreakingV2({hsFt, periodS: T, directionDeg: 263.49, depthM: 10, shoreNormalDeg: 263.49}, P);
    assert.ok(r.ok, `${hsFt} ft ${T} s`); if (!r.ok) return;
    assert.ok(Math.abs(r.centralFt - ind.H * FT) / (ind.H * FT) < 0.02, `v2 ${r.centralFt.toFixed(2)} vs independent ${(ind.H * FT).toFixed(2)} ft`);
    assert.ok(Math.abs(r.breakDepthM - ind.h) < 0.1, `break depth ${r.breakDepthM} vs ${ind.h}`);
  }
});
test('the transform from 10 m to the break multiplies Hs by about 1.1–1.4 for Ocean Beach swells (shoaling 10 m → ~2.5–4 m; less for big swells that break deeper), and refraction at 52° off the normal reduces it', () => {
  for (const [hsFt, T] of [[4.5, 14], [9.3, 15.4], [15, 15.4]] as const) { const r = estimateBreakingV2({hsFt, periodS: T, directionDeg: 263.49, depthM: 10, shoreNormalDeg: 263.49}, P); assert.ok(r.ok && r.centralFt / hsFt > 1.05 && r.centralFt / hsFt < 1.45, `${hsFt}: ${r.ok ? r.centralFt / hsFt : 'refused'}`); }
  const straight = estimateBreakingV2({hsFt: 9.3, periodS: 15.4, directionDeg: 263.49, depthM: 10, shoreNormalDeg: 263.49}, P), oblique = estimateBreakingV2({hsFt: 9.3, periodS: 15.4, directionDeg: 315, depthM: 10, shoreNormalDeg: 263.49}, P);
  assert.ok(straight.ok && oblique.ok && oblique.centralFt < straight.centralFt, 'refraction/obliquity lowers the breaking height');
});
test('the central height has no face multiplier or H1/10 factor in it: only the breaker index (the convention widens the range symmetrically, it does not move the centre)', () => {
  const a = estimateBreakingV2({hsFt: 6, periodS: 14, directionDeg: 263.49, depthM: 10, shoreNormalDeg: 263.49}, P), b = estimateBreakingV2({hsFt: 6, periodS: 14, directionDeg: 263.49, depthM: 10, shoreNormalDeg: 263.49}, {...P, faceFactors: [0.1, 9]});
  assert.ok(a.ok && b.ok && a.centralFt === b.centralFt, 'the profile face factors only shape the legacy range, never the central height');
});
test('the central height is insensitive to the breaker index for long swells (Green\'s law: Hs ∝ h^-1/4 near the break), so a different γ cannot explain a large bias', () => {
  const c = (g: number) => independent(9.3 / FT, 15.4, 10, g)!.H * FT;
  assert.ok(c(0.6) / c(0.78) > 0.9 && c(0.6) / c(0.78) < 1.0 && c(0.83) / c(0.78) > 1.0 && c(0.83) / c(0.78) < 1.08, `γ 0.6 → ${(c(0.6) / c(0.78)).toFixed(3)}, γ 0.83 → ${(c(0.83) / c(0.78)).toFixed(3)} of the γ = 0.78 height`);
});
