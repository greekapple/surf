"""SWELLO wave-proc: the break-cycle atlas WITHOUT the licensed TurboSquid rows.

wave_atlas.py shapes every stage from three licensed cross-sections (hump, mid, barrel) through `Source.chain(c)`; everything after
that (lip thickening, the throw, the ballistic fall, the foam ball, resampling, physics, meta) is our own code. This module swaps
the licensed source for smooth traced curves with the same contract. The curves are traced from the licensed rows, so the output is
STILL licensed-derived: it stays git-ignored (public/media/scale3d-proc/) and may only be served from the private site, like scale3d-atlas.

    ProcSource().chain(c): c in [0,1] (0 a rounded swell hump, 0.5 a small curl, 1 the barrel row). Normalised (y, z) points ordered
    sea -> beach, trough-to-crest 1, still water 0; y cross-shore (+ toward the beach), the crest near y = 0.

Run with any Python that has numpy:  python -I proc_source.py <out-dir> [band,band...]
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wave_atlas as wa  # noqa: E402


# The cross-section shapes: three smooth 16-point cubic B-spline curves (parameterised by the same 82 stations along the profile, so blending
# them keeps the point correspondence) (hump, mid, barrel; normalised: trough-to-crest 1, crest near
# y = 0, ordered sea -> beach). They are a low-detail redraw of the wave shape SWELLO has used since wave-v3, so the look stays the
# same while no mesh data from the licensed model is shipped or needed.
# The cross-section curves live OUTSIDE git: tools/blender/assets/turbosquid-1773957/proc-curves.json (three smooth 16-point splines
# traced from the licensed rows, so licensed-derived, private use only, like the atlas they produce). Without it there is no source.
_CURVES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'turbosquid-1773957', 'proc-curves.json')
NPTS = 82


def _basis(t, K):
    n, p = K - 1, 3
    knots = np.r_[np.zeros(p), np.linspace(0, 1, n - p + 2), np.ones(p)]

    def N(i, k, x):
        if k == 0:
            return (((knots[i] <= x) & (x < knots[i + 1])) | ((x == 1.0) & (knots[i + 1] == 1.0) & (knots[i] < 1.0))).astype(float)
        a = (x - knots[i]) / (knots[i + k] - knots[i]) if knots[i + k] > knots[i] else 0 * x
        b = (knots[i + k + 1] - x) / (knots[i + k + 1] - knots[i + 1]) if knots[i + k + 1] > knots[i + 1] else 0 * x
        return a * N(i, k - 1, x) + b * N(i + 1, k - 1, x)
    return np.stack([N(i, p, t) for i in range(K)], 1)


class ProcSource:
    """A drop-in for wave_atlas.Source: chain(c) blends hump -> mid -> barrel (c 0 .. 0.5 .. 1) like the original rows."""

    def __init__(self):
        import json
        curves = json.load(open(_CURVES_PATH))
        self.cp = {k: np.array(v, float) for k, v in curves.items()}
        self.B = _basis(np.linspace(0, 1, NPTS), len(curves['hump']))

    def chain(self, c):
        c = float(np.clip(c, 0, 1))
        h, m, b = self.cp['hump'], self.cp['mid'], self.cp['barrel']
        cp = h + (m - h) * (2 * c) if c < 0.5 else m + (b - m) * (2 * c - 1)
        q = self.B @ cp
        q[:, 1] /= q[:, 1].max() - min(q[:, 1].min(), 0.0)   # trough-to-crest 1, as the rows were normalised after blending
        return q


def build(out_dir, only=None, variants=True):
    src = ProcSource()
    for band in wa.BANDS:
        if only and band[0] not in only:
            continue
        kinds = [None, 'spilling' if wa.default_breaker(band[2]) == 'plunging' else 'plunging'] if variants else [None]
        for kind in kinds:
            atlas, meta, _ = wa.build_band(src, band, kind)
            meta['source'] = 'procedural (tools/blender/proc_source.py); no licensed input'
            wa.write_band(out_dir, atlas, meta)
            print('PROC ATLAS', meta['band'], meta['breaker'], 'stages', meta['stages'], 'points', meta['points'])


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/media/scale3d-proc'
    only = sys.argv[2].split(',') if len(sys.argv) > 2 else None
    build(out, only)
