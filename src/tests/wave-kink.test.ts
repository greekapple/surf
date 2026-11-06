/** The kink and streak at the curl (spec 2026-11-06-wave-kink-at-curl, docs/3d/wave-kink-findings.md): the drawn surface must be continuous
 *  across the peel boundary. Sampled on the REAL atlases (git-ignored, licensed-derived: public/media/scale3d-atlas and scale3d-proc; the
 *  cases skip when the files are absent, e.g. in a clean checkout) through the viewer's own bucket blend / scaling / period, faces 1-25 ft,
 *  several times through the cycle, the strip from 3 face heights up the shoulder to 2 down the broken side of the break point. Left and
 *  right draw the same crest-frame surface (a right is the model matrix mirrored), so one sweep covers both.
 *  Also: the GLSL along-crest block in WaveLive evaluates to the same numbers as the TS maths (one source of truth). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ATLAS_BANDS, type Atlas, type AtlasMeta, ampAt, bendW, bendZ, blendAtlas, breakX, bucketsFor, makeAtlas, profileAt, scaleAtlas, sections, stageAt, stripX, withPeriod} from '../features/scale/waveAtlas.ts';

const ROOT = process.env.SWELLO_ATLAS_ROOT ?? new URL('../../public/media/', import.meta.url).pathname;   // the env var: another checkout's atlases (before/after runs)
const KINDS = ['scale3d-atlas', 'scale3d-proc'];
const load = (dir: string, id: string): Atlas | null => {
  const j = `${ROOT}${dir}/${id}.json`, b = `${ROOT}${dir}/${id}.bin`;
  if (!fs.existsSync(j) || !fs.existsSync(b)) return null;
  const buf = fs.readFileSync(b);
  return makeAtlas(JSON.parse(fs.readFileSync(j, 'utf8')) as AtlasMeta, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
/** WaveLive.composeAtlas, from files */
function compose(dir: string, faceM: number, periodS: number | null): Atlas | null {
  const b = bucketsFor(faceM), lo = load(dir, ATLAS_BANDS[b.lo].id), hi = load(dir, ATLAS_BANDS[b.hi].id);
  if (!lo || !hi) return null;
  return withPeriod(b.lo === b.hi ? scaleAtlas(lo, faceM / ATLAS_BANDS[b.lo].faceM) : blendAtlas(lo, hi, b.w), periodS);
}

/** The open face at x: the beach-side crossings (walking up from the trough) at fractions of the trough-to-crest height, and the walk. */
function faceAt(a: Atlas, x: number, t: number) {
  const p = profileAt(a, x, t, 480, true), n = p.z.length;
  let ci = 0; for (let i = 1; i < n; i++) if (p.z[i] > p.z[ci]) ci = i;
  let ti = ci; for (let i = ci; i < n; i++) if (p.z[i] < p.z[ti]) ti = i;
  const tro = p.z[ti], crest = p.z[ci];
  const at = (f: number) => { const tg = tro + f * (crest - tro); for (let i = ti; i > ci; i--) if ((p.z[i] - tg) * (p.z[i - 1] - tg) <= 0 && p.z[i] !== p.z[i - 1]) { const k = (tg - p.z[i]) / (p.z[i - 1] - p.z[i]); return p.y[i] + k * (p.y[i - 1] - p.y[i]); } return NaN; };
  return {p, ci, ti, tro, crest, y15: at(0.15), y30: at(0.3), y50: at(0.5)};
}

interface Case {kind: string; ft: number; period: number | null; t: number}
const CASES: Case[] = [];
for (const kind of KINDS) for (const ft of [1, 1.8, 2.8, 3.5, 4.2, 5, 6, 7, 8, 9, 10, 11, 12.5, 14, 16, 18, 21, 25]) for (const period of [null, 10]) for (const t of [0, 1.3, 2.9]) CASES.push({kind, ft, period, t});

/** Worst numbers per case: the face's along-crest slope (cross-shore metres per metre: a step or twist), the change of that slope between
 *  neighbouring quarter-face-height windows (a crease), a hump on the face below 0.7 of the crest (face heights), a fold below 0.8 (face heights). */
function measure(a: Atlas, t: number) {
  const m = a.meta, H = m.face_m, bx = breakX(m, t), x0 = Math.max(bx - 3 * H, -m.shoulder_len_m), x1 = Math.min(bx + 2 * H, 0.6 * m.break_len_m);
  const dx = 0.05 * H, xs: number[] = [], ys: number[][] = [[], [], []];
  let hump = 0, fold = 0, crestStep = 0, prevCrest = NaN;
  for (let x = x0; x <= x1 + 1e-9; x += dx) {
    const f = faceAt(a, x, t); xs.push(x); ys[0].push(f.y15); ys[1].push(f.y30); ys[2].push(f.y50);
    if (Number.isFinite(prevCrest)) crestStep = Math.max(crestStep, Math.abs(f.crest - prevCrest) / dx); prevCrest = f.crest;
    // walk up the face from the trough
    // (the open face: up to just past the pitch, before the lip lands in the trough; the fold check on the shoulder rows themselves, before
    // the tube's roof starts to come in at the curl, which is a real undercut)
    const {p, ci, ti, tro, crest} = f, hgt = crest - tro, s = stageAt(m, x, t); let zmax = -Infinity, ymin = Infinity;
    for (let i = ti; i > ci; i--) {
      const zr = (p.z[i] - tro) / hgt;
      if (zr < 0.7 && s <= m.stage_pitch + 0.5) { zmax = Math.max(zmax, p.z[i]); hump = Math.max(hump, (zmax - p.z[i]) / H); }
      if (zr < 0.8 && s <= m.stage_pitch - 1) { ymin = Math.min(ymin, p.y[i]); fold = Math.max(fold, (p.y[i] - ymin) / H); }
      if (zr >= 0.8) break;
    }
  }
  let slope = 0, crease = 0; const w = Math.max(1, Math.round(0.25 * H / dx));
  for (const y of ys) {
    for (let i = 1; i < y.length; i++) if (Number.isFinite(y[i]) && Number.isFinite(y[i - 1])) slope = Math.max(slope, Math.abs(y[i] - y[i - 1]) / dx);
    for (let i = w; i + w < y.length; i++) { const g0 = (y[i] - y[i - w]) / (w * dx), g1 = (y[i + w] - y[i]) / (w * dx); if (Number.isFinite(g0) && Number.isFinite(g1)) crease = Math.max(crease, Math.abs(g1 - g0)); }
  }
  return {slope, crease, hump, fold, crestStep};
}

// Limits. Slope 0.35: the open face may swing at most ~19 deg in plan across the peel (the seam measured 0.4-0.76, with creases at both
// ends; after the fix the steepest is 0.34, the Mavericks band at 21-25 ft, the steepest bed: the shoulder steepens into the pitch fastest
// there, smoothly). Crease 0.2: the swing may not turn by more than that between neighbouring quarter-face-height windows (was up to 0.76).
// Hump / fold: 2% / 3% of the face.
const LIM = {slope: 0.35, crease: 0.2, hump: 0.02, fold: 0.03};
for (const kind of KINDS) {
  test(`the surface is continuous across the peel (${kind}: faces 1-25 ft, blends, periods, times)`, (tc) => {
    const fails: string[] = []; let ran = 0;
    for (const c of CASES.filter((q) => q.kind === kind)) {
      const a = compose(kind, c.ft * 0.3048, c.period); if (!a) continue; ran++;
      const r = measure(a, c.t);
      const bad = (Object.keys(LIM) as (keyof typeof LIM)[]).filter((k) => r[k] > LIM[k]);
      if (bad.length) fails.push(`${c.ft} ft P${c.period ?? '-'} t${c.t} (${a.meta.band} ${a.meta.breaker}): ` + bad.map((k) => `${k} ${r[k].toFixed(3)} > ${LIM[k]}`).join(', '));
    }
    if (!ran) { tc.skip(`no ${kind} files (git-ignored)`); return; }
    assert.equal(fails.length, 0, `${fails.length} of ${ran} cases:\n` + fails.join('\n'));
  });
}

test('the GLSL along-crest block computes the same stage, height, sections and bend as waveAtlas.ts', () => {
  const src = fs.readFileSync(new URL('../features/scale/WaveLive.tsx', import.meta.url), 'utf8');
  const glsl = /const ALONG = \/\* glsl \*\/ `([\s\S]*?)`;/.exec(src)?.[1]; assert.ok(glsl, 'ALONG block found');
  // GLSL -> JS: the block is scalar float maths only (tolerance 1e-6: the GLSL writes 2 pi as 6.2831853)
  const js = glsl.replace(/^uniform[^;]*;/m, '').replace(/\/\/.*$/gm, '').replace(/float (\w+)\(([^)]*)\)\{/g, (_, n: string, args: string) => `function ${n}(${args.replace(/float /g, '')}){`).replace(/\bfloat\b/g, 'let');
  const lib = {smoothstep: (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }, clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)), pow: Math.pow, exp: Math.exp, sin: Math.sin};
  const U = ['uTime', 'uFace', 'uNS', 'uNP', 'uPitch', 'uDb', 'uBed', 'uSh', 'uBl', 'uCyc', 'uX0', 'uX1'];
  const make = new Function(...U, ...Object.keys(lib), `${js}\nreturn {sections, stageAt, ampAt, bendZ, bendW};`);
  for (const m of [
    {band: '4-6', face_m: 1.52, stages: 12, points: 96, stage_pitch: 4, depth_break_m: 1.95, bed_along_per_m: 0.027, shoulder_len_m: 40, break_len_m: 38, cycle_s: 6.5},
    {band: '10-15', face_m: 3.81, stages: 12, points: 96, stage_pitch: 4, depth_break_m: 4.88, bed_along_per_m: 0.0809, shoulder_len_m: 33.8, break_len_m: 94.2, cycle_s: 8},
  ] as AtlasMeta[]) {
    const [x0, x1] = stripX(m), g = make(0, m.face_m, m.stages, m.points, m.stage_pitch, m.depth_break_m, m.bed_along_per_m, m.shoulder_len_m, m.break_len_m, m.cycle_s, x0, x1, ...Object.values(lib));
    for (let x = x0; x <= x1; x += (x1 - x0) / 97) for (const t of [0, 1.7, 5.3]) {
      assert.ok(Math.abs(g.stageAt(x, t) - stageAt(m, x, t)) < 1e-6, `stage ${m.band} x${x}`);
      assert.ok(Math.abs(g.sections(x, t) - sections(m, x, t)) < 1e-6, `sections ${m.band} x${x}`);
      assert.ok(Math.abs(g.ampAt(x) - ampAt(m, x)) < 1e-9, `amp ${m.band} x${x}`);
      assert.ok(Math.abs(g.bendZ(x) - bendZ(m, x)) < 1e-9, `bend ${m.band} x${x}`);
    }
    for (let u = 0; u <= 1; u += 0.01) assert.ok(Math.abs(g.bendW(u) - bendW(u)) < 1e-12);
  }
});
