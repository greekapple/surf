"""SWELLO wave-clean: the break-cycle atlas from cross-section curves drawn from scratch (no licensed input at all).

wave_atlas.py shapes every stage from three cross-sections (hump, mid, barrel) through `Source.chain(c)`; everything after that
(lip thickening, the throw, the ballistic fall, the foam ball, resampling, physics, meta) is SWELLO's own code. The default atlas
samples the three sections from a licensed mesh and `proc_source.py` from splines traced off it. This module draws them again from
first principles and public descriptions of breaking waves (derivation, parameters and sources: tools/blender/CLEAN-WAVE.md), so
its output carries no licensed input and could be committed and served publicly.

    CleanSource().chain(c): c in [0,1] (0 a rounded swell hump, 0.5 a steepened crest starting to curl, 1 a plunging barrel). Normalised
    (y, z) points ordered sea -> beach, trough-to-crest 1, still water 0; y cross-shore (+ toward the beach), the crest near y = 0.
    Same contract as proc_source.ProcSource: three 16-point clamped cubic B-splines sampled at the same 82 stations, blended
    control point by control point (hump -> mid -> barrel), so the point correspondence holds through the blend.

    python -I clean_source.py curves            # redraw the curves from the design below into clean-curves.json
    python -I clean_source.py <out-dir> [bands] # build the atlas (default out-dir public/media/scale3d-clean)

Any Python with numpy (Blender's own works: /Applications/Blender.app/Contents/Resources/<ver>/python/bin/python3.13).
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wave_atlas as wa  # noqa: E402

CURVES_PATH = os.path.join(HERE, 'clean-curves.json')
NPTS, NCP = 82, 16


def basis(t, K=NCP):
    """Clamped uniform cubic B-spline basis (identical to proc_source._basis): len(t) x K."""
    n, p = K - 1, 3
    knots = np.r_[np.zeros(p), np.linspace(0, 1, n - p + 2), np.ones(p)]

    def N(i, k, x):
        if k == 0:
            return (((knots[i] <= x) & (x < knots[i + 1])) | ((x == 1.0) & (knots[i + 1] == 1.0) & (knots[i] < 1.0))).astype(float)
        a = (x - knots[i]) / (knots[i + k] - knots[i]) if knots[i + k] > knots[i] else 0 * x
        b = (knots[i + k + 1] - x) / (knots[i + k + 1] - knots[i + 1]) if knots[i + k + 1] > knots[i + 1] else 0 * x
        return a * N(i, k - 1, x) + b * N(i + 1, k - 1, x)
    return np.stack([N(i, p, t) for i in range(K)], 1)


# ---------------------------------------------------------------------------------------------------------------------------------
# The design. Units: the wave's own trough-to-crest height H = 1; y cross-shore in H (+ toward the beach), z up from still water.
# Every shape is a chain of landmarks at FIXED parameter values s (the same s in all three shapes), so the blend moves each landmark
# along a straight path: the crest stays the crest, the hump's upper front face becomes the mid's vertical nose and then the barrel's
# lip, the lower front face becomes the barrel's inner wall. Most of s is given to the front (0.33 .. 0.90), where the curl needs the
# spline's resolution (a uniform 16-point cubic has 13 spans; the crest-to-foot front gets about 7.5 of them).
S = np.array([0.00, 0.10, 0.22, 0.33, 0.40, 0.46, 0.515, 0.57, 0.625, 0.68, 0.735, 0.79, 0.845, 0.90, 0.95, 1.00])
#              sea  back  back crest ----------------------------- front / curl ----------------------------- trough beach

# Hump (c = 0): a solitary-wave crest, z = sech^2(y / lam) (Boussinesq/KdV solitary wave; Munk 1949 used it for waves near breaking).
# Theory puts lam = 1/kappa = sqrt(4 h^3 / 3 H) = 1.67 H at the breaking limit H/h = 0.78 (McCowan 1894); that is the far field.
# The pipeline treats these sections as the crest region only (broaden_back stretches the back to 0.2 L_b, `wy` widens the small
# bands), so the crest is drawn with lam = HUMP_LAM on the front (rounded, still water by y ~ 1.75) and HUMP_LAM_BACK on the back,
# which reaches still water by y = -0.8: all three shapes share that short back because broaden_back expects a source back of
# ~0.48 H and stretches it by sb = 3..14 at the base (a long source back took most of the atlas's 96 samples and left ~11 for the
# whole crest-to-trough curl).
HUMP_LAM, HUMP_LAM_BACK = 0.55, 0.40
HUMP_Y = np.array([-0.80, -0.50, -0.25, 0.0, 0.12, 0.22, 0.31, 0.40, 0.49, 0.58, 0.67, 0.77, 0.88, 1.00, 1.25, 1.75])

# Mid (c = 0.5): the crest steepened and leaning forward, as in the computed overturning sequence of Longuet-Higgins & Cokelet (1976)
# and Peregrine's (1983) review: the back keeps a moderate slope, the crest's highest point moves forward, the front face turns
# vertical high up (at ~0.6-0.9 H) and just starts to overhang under a rounded nose; below that the face eases to ~55-60 degrees
# into a shallow trough (~6% of H, the set-down ahead of a steep crest).
MID = [(-0.80, 0.0), (-0.50, 0.25), (-0.25, 0.68), (0.0, 1.0), (0.13, 0.975), (0.215, 0.92), (0.255, 0.85), (0.25, 0.79),
       (0.245, 0.72), (0.25, 0.62), (0.29, 0.48), (0.38, 0.32), (0.50, 0.17), (0.68, 0.03), (1.05, -0.06), (1.75, 0.0)]
# (the nose's landmarks sit high, 0.62-0.92 H: they become the barrel's tip, underside and roof, so in the blend they rise only a
#  little; spread down the face they rose ~0.3 H through the in-between rows and lay flat on the way: a shelf at ~0.75 H on the
#  shoulder rows that caught the sky as a horizontal line at 12 ft)

# Barrel (c = 1): a plunging crest. The jet leaves the crest forward and turns down (Peregrine 1983: the front becomes vertical, then
# a jet is thrown forward from the crest and falls under gravity, enclosing an air tube). The lip tip is ~0.57 H ahead of the crest at
# ~0.8 H; the underside curls back under it to a roof apex and the inner wall drops near-vertically to the trough. This is the tube
# at the pitch, before the throw: wave_atlas.throw_lip / fall_lip carry the lip on out and down, and the cavity they produce is
# measured on the built atlas (CLEAN-WAVE.md; target length:height ~1.5-2, the hollow end of the plunging range).
BARREL = [(-0.80, 0.0), (-0.50, 0.25), (-0.25, 0.68), (0.0, 1.0), (0.24, 0.995), (0.46, 0.955), (0.575, 0.85), (0.52, 0.82),
          (0.38, 0.90), (0.20, 0.89), (0.05, 0.77), (-0.04, 0.53), (-0.02, 0.28), (0.11, 0.055), (0.62, -0.065), (1.75, 0.0)]
# (roof 0.90, wall top 0.77, tip 0.85, trough -0.065: picked from a small sweep against src/tests/wave-kink.test.ts; the neighbouring
#  variants fail it by a hair: a falling-tip hump of 0.020-0.021 H at 5 ft or 18 ft, a 0.030-0.036 H fold at 7 ft, a side-of-face
#  misread at 16 ft. The margin is thin.)


def hermite_chain(s, pts, sd):
    """Cubic Hermite (in s) through (s_i, P_i) with Catmull-Rom tangents (non-uniform), evaluated at sd."""
    P = np.asarray(pts, float)
    m = np.zeros_like(P)
    for i in range(len(P)):
        a, b = max(i - 1, 0), min(i + 1, len(P) - 1)
        m[i] = (P[b] - P[a]) / (s[b] - s[a])
    out = np.zeros((len(sd), 2))
    for j, x in enumerate(sd):
        i = min(np.searchsorted(s, x, side='right') - 1, len(s) - 2)
        h = s[i + 1] - s[i]
        t = (x - s[i]) / h
        h00, h10, h01, h11 = 2 * t**3 - 3 * t**2 + 1, t**3 - 2 * t**2 + t, -2 * t**3 + 3 * t**2, t**3 - t**2
        out[j] = h00 * P[i] + h10 * h * m[i] + h01 * P[i + 1] + h11 * h * m[i + 1]
    return out


def hump_points():
    y = HUMP_Y
    lam = np.where(y < 0, HUMP_LAM_BACK, HUMP_LAM)
    e = 1 / np.cosh(y / lam) ** 2
    end = np.where(y < 0, e[0], e[-1])        # each side eased to still water at its own end
    z = (e - end) / (1 - end)
    z[0] = z[-1] = 0.0
    return np.stack([y, np.maximum(z, 0)], 1)


def fit(points, s=S):
    """Least-squares 16-point control polygon whose spline follows the landmark chain at the same parameter values."""
    sd = np.linspace(0, 1, 600)
    dense = hermite_chain(s, points, sd)
    B = basis(sd)
    cp, *_ = np.linalg.lstsq(B, dense, rcond=None)
    cp[0], cp[-1] = points[0], points[-1]
    return cp


def design():
    return {'hump': fit(hump_points()), 'mid': fit(MID), 'barrel': fit(BARREL)}


def write_curves(path=CURVES_PATH):
    cps = design()
    doc = {k: [[round(float(a), 5), round(float(b), 5)] for a, b in v] for k, v in cps.items()}
    with open(path, 'w') as fh:
        json.dump(doc, fh, indent=1)
    print('wrote', path)


class CleanSource:
    """A drop-in for wave_atlas.Source / proc_source.ProcSource: chain(c) blends hump -> mid -> barrel (c 0 .. 0.5 .. 1)."""

    def __init__(self, path=CURVES_PATH):
        curves = json.load(open(path))
        self.cp = {k: np.array(curves[k], float) for k in ('hump', 'mid', 'barrel')}
        self.B = basis(np.linspace(0, 1, NPTS), len(self.cp['hump']))

    def chain(self, c):
        c = float(np.clip(c, 0, 1))
        h, m, b = self.cp['hump'], self.cp['mid'], self.cp['barrel']
        cp = h + (m - h) * (2 * c) if c < 0.5 else m + (b - m) * (2 * c - 1)
        q = self.B @ cp
        q[:, 1] /= q[:, 1].max() - min(q[:, 1].min(), 0.0)   # trough-to-crest 1
        return q


def build(out_dir, only=None, variants=True):
    src = CleanSource()
    for band in wa.BANDS:
        if only and band[0] not in only:
            continue
        kinds = [None, 'spilling' if wa.default_breaker(band[2]) == 'plunging' else 'plunging'] if variants else [None]
        for kind in kinds:
            atlas, meta, _ = wa.build_band(src, band, kind)
            meta['source'] = 'clean (tools/blender/clean_source.py + clean-curves.json, drawn from scratch); no licensed input'
            wa.write_band(out_dir, atlas, meta)
            print('CLEAN ATLAS', meta['band'], meta['breaker'], 'stages', meta['stages'], 'points', meta['points'])


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'curves':
        write_curves()
    else:
        out = sys.argv[1] if len(sys.argv) > 1 else 'public/media/scale3d-clean'
        only = sys.argv[2].split(',') if len(sys.argv) > 2 else None
        build(out, only)
