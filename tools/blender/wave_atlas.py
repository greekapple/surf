"""SWELLO wave-v3 profile atlas (P1): per size bucket, a break-cycle table of NS stages x NP points that the live viewer's vertex
shader samples by (u along the profile, stage). Called by `wave_scene.py --atlas <out-dir>` (Blender reads the licensed FBX rows);
the maths here is plain numpy so it can also run on rows dumped to JSON.

The cross-sections are derived from the licensed TurboSquid 1773957 rows (HUMP=ond3[125], MID=ond2[70], BARREL=ond2[15]); the
output is licensed-derived and must stay git-ignored (public/media/scale3d-atlas/). Parametric shaping on top of the rows:
  - a broad, convex back and a shallow, broad trough in front (asymmetric: sharp crest, steep front, gentle back);
  - per-bucket break physics: breaking where H = 0.78 x depth on a per-bucket bed slope; the Iribarren number of that slope and
    the swell period picks how hard the lip throws (spilling -> plunging), the wavelength sets the back, the peel angle and the
    shallow-water speed set the peel speed and how long the break cycle runs along the crest;
  - the lip falls ballistically and lands in the trough, then the section collapses into a foam ball that advances and shrinks.

Files per bucket: <band>.bin (float16 little-endian RGBA, width NP, height 2*NS; rows 0..NS-1 = (y, z, thin, foam), rows NS..2NS-1 =
(thickness, arc length, normal y, normal z)) and <band>.json (dimensions and the physics the viewer needs). Metres; y is
cross-shore (+ toward the beach), z is up from still water.
"""
import json
import math
import os

import numpy as np

NS, NP = 12, 96
FLAT = 0.009
G, GAMMA = 9.81, 0.78
# id, face height (band midpoint, m), family (the real-wave model), swell period (s), bed slope at the break, peel angle (deg)
BANDS = [
    ('1-2', 0.46, 'spiller', 8.0, 0.020, 64.0),        # mellow beach-break crumbler
    ('2-3', 0.76, 'spiller', 9.0, 0.024, 60.0),
    ('3-4', 1.07, 'peeler', 11.0, 0.034, 52.0),        # Lower Trestles: peak, tapering shoulder, feather then pitch
    ('4-6', 1.52, 'peeler', 13.0, 0.040, 48.0),
    ('6-8', 2.13, 'thick', 14.0, 0.060, 42.0),         # heavier beach break at size (Ocean Beach SF): thick throwing lip
    ('8-10', 2.74, 'thick', 15.0, 0.070, 40.0),
    ('10-15', 3.81, 'bigreef', 16.0, 0.100, 36.0),     # Sunset / Waimea: very thick lip, massive whitewater
    ('15-plus', 5.49, 'mavericks', 17.0, 0.120, 32.0),  # Mavericks scale
]
# stage timeline (index -> event); the viewer maps along-crest position and time to a fractional stage
S_FEATHER, S_PITCH, S_LAND = 2, 4, 6


def ss(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def soften_trough(pr):
    """Same as wave_scene.soften_trough: a shallow trough (~12% of the crest) eased back to flat water toward the beach."""
    pr = pr.copy()
    ci = int(np.argmax(pr[:, 1]))
    zc = pr[ci, 1]
    ti = ci + int(np.argmin(pr[ci:, 1]))
    zt = pr[ti, 1]
    if zt >= FLAT or zc <= FLAT:
        return pr
    zt2 = max(zt, FLAT - 0.12 * (zc - FLAT))
    k = (zc - zt2) / (zc - zt)
    xt, xe = pr[ti, 0], pr[-1, 0]
    for i in range(ci + 1, len(pr)):
        z = zt2 + (pr[i, 1] - zt) * k
        if i >= ti:
            z = FLAT + (zt2 - FLAT) * (1 - float(ss(xt, xe, pr[i, 0])))
        pr[i, 1] = z
    return pr


class Source:
    """The three licensed rows as (x, z) arrays, normalised so the barrel's trough-to-crest is 1."""

    def __init__(self, hump, mid, barrel):
        self.rows = [np.array(r, float) for r in (hump, mid, barrel)]
        b = self.rows[2]
        self.hm = b[:, 1].max() - b[:, 1].min()
        self.x0 = b[int(np.argmax(b[:, 1])), 0]
        dev = np.zeros(len(b), bool)
        for r in self.rows:
            dev |= np.abs(r[:, 1] - FLAT) > 1e-4
        idx = np.nonzero(dev)[0]
        self.ia, self.ib = max(0, idx[0] - 2), min(len(b) - 1, idx[-1] + 2)

    def chain(self, c):
        """c in [0,1]: 0 hump, 0.5 small curl, 1 barrel. Normalised (y, z): trough-to-crest 1, still water 0."""
        h, m, b = self.rows
        pr = h + (m - h) * (2 * c) if c < 0.5 else m + (b - m) * (2 * c - 1)
        pr = soften_trough(pr)
        zt, zb = pr[:, 1].max(), pr[:, 1].min()
        out = np.empty_like(pr)
        out[:, 0] = (pr[:, 0] - self.x0) / self.hm
        out[:, 1] = (pr[:, 1] - FLAT) / (zt - zb)
        return out[self.ia:self.ib + 1]


def crest_index(p):
    return int(np.argmax(p[:, 1]))


def broaden_back(p, sb, power=2.6):
    """Stretch the back (seaward of the crest) so it is broad at the base and still sharp at the crest."""
    p = p.copy()
    ci = crest_index(p)
    yc, zc = p[ci]
    zn = np.clip(p[:ci, 1] / max(zc, 1e-6), 0, 1)
    p[:ci, 0] = yc - (yc - p[:ci, 0]) * (1 + (sb - 1) * (1 - zn) ** power)
    return p


def lip_indices(p):
    """crest, lip tip (most shoreward point above 30% height) and the back of the cavity under the lip."""
    ci = crest_index(p)
    above = [i for i in range(ci, len(p)) if p[i, 1] > 0.3 * p[ci, 1]]
    ti = max(above, key=lambda i: p[i, 0]) if above else ci
    # the cavity back: after the tip, the most seaward point before the face reaches the trough
    tail = range(ti, len(p))
    low = next((i for i in tail if p[i, 1] < 0.08), len(p) - 1)
    ki = ti + int(np.argmin(p[ti:low + 1, 0])) if low > ti else ti
    return ci, ti, ki


def thicken_lip(p, f):
    """Shrink the barrel's cavity about its centre (f < 1): a thicker lip and a thicker wall, same outer shape."""
    if f >= 0.999:
        return p
    p = p.copy()
    ci, ti, ki = lip_indices(p)
    if ki <= ti + 2:
        return p
    end = next((i for i in range(ki, len(p)) if p[i, 1] < 0.02), len(p) - 1)
    seg = p[ti:end + 1]
    cen = np.array([seg[:, 0].mean(), seg[:, 1].mean()])
    n = len(p)
    i = np.arange(n)
    w = ss(ti - 2, ti + 3, i) * (1 - ss(ki + 0.6 * (end - ki), end + 2, i))
    p = p + (cen - p) * ((1 - f) * w)[:, None]
    return p


def fall_lip(p, k):
    """The lip falls ballistically and lands: k=0 pitched, k=1 tip at the trough. It also travels forward as it falls."""
    if k <= 0:
        return p
    p = p.copy()
    ci, ti, ki = lip_indices(p)
    drop = (p[ti, 1] - 0.02) * k
    fwd = 0.45 * drop
    i = np.arange(len(p))
    end = next((j for j in range(ki, len(p)) if p[j, 1] < 0.05), len(p) - 1)
    w = ss(ci + 1, ti, i) * (i <= ti) + (i > ti) * (1 - ss(ti, max(ki, ti + 2), i))
    w = w ** 1.2
    p[:, 0] += fwd * w
    p[:, 1] -= drop * w
    return p


def relax_face(p, cap_deg=72.0, top=0.8):
    """A rideable face (wave-round3): below `top` of the crest height the open face is no steeper than cap_deg, so a rider can climb
    to the upper third for a top turn. The crest and the lip above `top` keep their shape; below it the face (and the cavity the source
    rows carve under the lip) is pushed toward the beach where it was steeper than the cap, and the trough and the flat water beyond
    move with it. Normalised units."""
    p = p.copy()
    ci, ti, _ = lip_indices(p)
    zc = p[ci, 1]
    tanc = math.tan(math.radians(cap_deg))
    shift = 0.0
    for i in range(max(ci, ti) + 1, len(p)):
        p[i, 0] += shift
        dz = p[i - 1, 1] - p[i, 1]
        if dz > 0 and p[i, 1] < top * zc:
            need = p[i - 1, 0] + dz / tanc
            if p[i, 0] < need:
                shift += need - p[i, 0]
                p[i, 0] = need
    return p


def bore(p, h, adv, wf=0.55, back=None):
    """A whitewater bore / foam ball of height h: the back keeps the wave's own back (scaled), the top rises to a rounded front
    whose peak sits adv ahead of the original crest. Points behind the crest keep their place; the rest (crest, lip, cavity,
    face) are spread along the new front by arc length, so stages interpolate without folding."""
    back = p if back is None else back
    ci = crest_index(p)
    bi = crest_index(back)
    yc, zc = back[bi]
    yp = p[ci, 0] + adv
    out = p.copy()
    out[:ci + 1, 1] = np.interp(p[:ci + 1, 0], back[:bi + 1, 0], back[:bi + 1, 1]) * (h / max(zc, 1e-6))
    out[:ci + 1, 1] = np.minimum(out[:ci + 1, 1], h)
    y_start, z_start = out[ci]
    y1 = max(p[-1, 0], yp + 1.8 * wf)
    ys = np.linspace(y_start, y1, 500)
    rise = z_start + (h - z_start) * ss(y_start, yp, ys)
    tf = np.clip((ys - yp) / wf, 0, 1)
    front = h * (1 - ss(0, 1, tf)) * (1 - 0.25 * tf * tf)
    zs = np.where(ys < yp, rise, front)
    zs += np.where(ys > yp + wf, 0.05 * h * np.exp(-(ys - yp - wf) / (0.8 * wf)), 0)  # a skirt of broken water ahead of it
    zs[-1] = 0.0
    seg = np.r_[0.0, np.cumsum(np.hypot(*np.diff(p[ci:], axis=0).T))]
    t = seg / max(seg[-1], 1e-9)
    bs = np.r_[0.0, np.cumsum(np.hypot(np.diff(ys), np.diff(zs)))]
    bs /= bs[-1]
    out[ci:, 0] = np.interp(t, bs, ys)
    out[ci:, 1] = np.interp(t, bs, zs)
    return out


def inward_normals(p):
    d = np.gradient(p, axis=0)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    return np.stack([d[:, 1], -d[:, 0]], 1)  # tangent rotated clockwise: into the water


def thickness(p, floor_z):
    """Distance through the water from each surface point along its inward normal (to the next surface or the bed)."""
    n = inward_normals(p)
    a, b = p[:-1], p[1:]
    out = np.zeros(len(p))
    for i in range(len(p)):
        o, d = p[i] + n[i] * 1e-4, n[i]
        best = (floor_z - o[1]) / d[1] if d[1] < -1e-6 else 1e9
        e = b - a
        den = d[0] * e[:, 1] - d[1] * e[:, 0]
        ok = np.abs(den) > 1e-12
        w = a - o
        t = np.where(ok, (w[:, 0] * e[:, 1] - w[:, 1] * e[:, 0]) / np.where(ok, den, 1), -1)
        s = np.where(ok, (w[:, 0] * d[1] - w[:, 1] * d[0]) / np.where(ok, den, 1), -1)
        hit = ok & (t > 1e-3) & (s >= 0) & (s <= 1)
        hit[max(0, i - 1):i + 1] = False
        if hit.any():
            best = min(best, t[hit].min())
        out[i] = best
    return out


def band_physics(face, period, slope, peel):
    d_b = face / GAMMA
    c = math.sqrt(G * d_b)                       # shallow-water speed at the break
    L0 = G * period ** 2 / (2 * math.pi)         # deep-water wavelength
    Lb = period * c                              # wavelength at the break (shallow)
    xi = slope / math.sqrt(face / L0)            # Iribarren number: < 0.4 spilling, 0.4..2 plunging
    plunge = float(ss(0.25, 0.75, xi))
    v_peel = c / math.sin(math.radians(peel))
    return dict(depth_break_m=d_b, celerity_mps=c, L0_m=L0, Lb_m=Lb, iribarren=xi, plunge=plunge, peel_speed_mps=v_peel)


def stage_curves(src, face, breaker, phys):
    """breaker: 'spilling' (gradual bed: the crest crumbles and rolls down a soft face, no lip) or 'plunging' (steep bank or
    reef: the lip pitches, forms a tube and lands in a foam ball). Kept separate from size so a spot's bed slope can pick it."""
    plunge = phys['plunge']
    spill = breaker == 'spilling'
    cm = 0.3 + 0.7 * plunge if not spill else 0.12 + 0.2 * plunge  # how far along hump -> mid -> barrel the crest gets
    heavy = float(ss(1.5, 5.5, face))                    # lip thickness grows with size
    f_lip = 1 - 0.32 * heavy - 0.08 * plunge
    back_len = 0.2 * phys['Lb_m'] / face                 # back length in face heights
    sb = max(3.0, back_len / 0.48)
    wy = 1 + 1.3 * (1 - float(ss(0.5, 1.6, face)))       # small waves are much less steep: wider cross-shore
    cs = [0.0, 0.32, 0.62, 0.86, 1.0, 1.0, 1.0] if not spill else [0.0, 0.35, 0.7, 1.0, 1.0, 1.0, 1.0]
    hs = [0.78, 0.86, 0.94, 1.0, 1.0, 0.97, 0.92]
    curves, foams = [], []

    def shape(p):
        p = broaden_back(p, sb, 3.0)
        p[:, 0] *= wy
        return p

    for k in range(S_LAND + 1):
        p = src.chain(cm * cs[k])
        p = thicken_lip(p, 1 - (1 - f_lip) * float(ss(1, S_PITCH, k)))
        if not spill and k > S_PITCH:
            p = fall_lip(p, (k - S_PITCH) / (S_LAND - S_PITCH) * (0.55 + 0.45 * plunge))
        p[:, 1] *= hs[k]
        if k < S_PITCH:   # the unbroken shoulder the rider is on: a rideable face under the lip (wave-round3)
            p = relax_face(p, 72.0, 0.8)
        curves.append(shape(p))
    if spill:
        # spilling: the crest crumbles from stage 3 on and the foam rolls down a gentle face as a long, low bore
        curves = curves[:4]
        base = curves[3]
        ci = crest_index(base)
        for k in range(4, NS):
            t = (k - 3) / (NS - 4)
            p = base.copy()
            p[:, 1] *= 1 - 0.45 * t
            yc = p[ci, 0]
            # the foam roller: a lumpy bulge riding down the front just below the crest, growing then thinning
            p[:, 1] += (0.14 - 0.06 * t) * np.exp(-((p[:, 0] - yc - (0.2 + 0.3 * t) * wy) / (0.35 * wy)) ** 2) * (np.arange(len(p)) > ci)
            curves.append(p)
    else:
        landed = curves[S_LAND]
        ci, ti, _ = lip_indices(landed)
        for k in range(S_LAND + 1, NS):
            t = (k - S_LAND) / (NS - 1 - S_LAND)
            h = (0.78 - 0.4 * t) * (0.9 + 0.2 * heavy)   # big waves keep a taller foam ball
            adv = landed[ti, 0] - landed[ci, 0] + 0.3 * t * wy
            w = 0.55 if k == S_LAND + 1 else (0.85 if k == S_LAND + 2 else 1.0)  # a gradual collapse from tube to foam ball
            curves.append(landed + (bore(landed, h, adv, wf=(0.8 + 0.4 * heavy) * wy, back=curves[S_PITCH]) - landed) * w)
    curves = curves[:NS]
    # foam per stage, by geometry (normalised units)
    for k, p in enumerate(curves):
        n = len(p)
        i = np.arange(n)
        ci = crest_index(p)
        fo = np.zeros(n)
        if spill:
            if k >= 2:
                a = min(1.0, 0.35 * (k - 1))
                down = 3 + 4 * (k - 2)  # foam spills down the face
                fo = a * ss(ci - 4, ci, i) * (1 - ss(ci + down, ci + down + 8, i))
                fo = np.maximum(fo, 0.45 * a * np.exp(-((i - ci) / 6.0) ** 2))
            if k >= 4:
                yc = p[ci, 0]
                fo = np.maximum(fo, (0.95 - 0.25 * (k - 4) / 7) * ss(yc - 0.9 * wy, yc - 0.1 * wy, p[:, 0]) * (p[:, 1] > 0.02))
        else:
            _, ti, ki = lip_indices(p)
            if k == S_FEATHER or k == S_FEATHER + 1:
                fo = (0.3 + 0.25 * (k - S_FEATHER)) * np.exp(-((i - ci - 1) / 2.5) ** 2)
            elif k in (S_PITCH, S_PITCH + 1):
                fo = (0.2 + 0.25 * (k - S_PITCH)) * np.exp(-((i - ti) / 3.0) ** 2)
            elif k == S_LAND:
                fo = 0.9 * np.exp(-((i - ti) / (4.0 + 5.0 * heavy)) ** 2) + (0.35 + 0.3 * heavy) * ss(ci, ti, i) * (i <= ti)
            if k > S_LAND:
                yc = p[ci, 0]
                f = (1.0 - 0.3 * (k - S_LAND - 1) / (NS - 2 - S_LAND)) * ss(yc - 1.6 * wy, yc - 0.2 * wy, p[:, 0]) * (p[:, 1] > 0.01)
                fo = np.maximum(fo, f)
        foams.append(np.clip(fo, 0, 1))
    return curves, foams, dict(cm=cm, f_lip=f_lip, sb=sb, wy=wy, heavy=heavy)


def resample(curves, foams, face, floor_m, y0, y1):
    """Arc-length resampling shared by every stage (same u = same material point), denser high on the wave."""
    m = len(curves[0])
    fr = np.zeros(m)
    for p in curves:
        dl = np.hypot(*np.diff(p, axis=0).T) * (1 + 5 * np.clip(0.5 * (p[1:, 1] + p[:-1, 1]), 0, 1))
        s = np.r_[0.0, np.cumsum(dl)]
        fr += s / s[-1]
    fr /= len(curves)
    # the fixed flat ends: a short weight so the strip edges stay put
    e = 0.04
    fr = e + fr * (1 - 2 * e)
    full_fr = np.r_[0.0, fr, 1.0]
    us = np.linspace(0, 1, NP)
    mi = np.interp(us, full_fr, np.arange(-1, m + 1))  # fractional material index (-1 and m are the fixed ends)
    out = np.zeros((2 * NS, NP, 4), np.float32)
    for k, (p, fo) in enumerate(zip(curves, foams)):
        pm = p * face
        full = np.vstack([[y0, 0.0], pm, [y1, 0.0]])
        ff = np.r_[0.0, fo, 0.0]
        th = thickness(pm, -floor_m)
        th = np.r_[floor_m, th, floor_m]
        j = np.arange(-1, m + 1)
        y = np.interp(mi, j, full[:, 0])
        z = np.interp(mi, j, full[:, 1])
        q = np.stack([y, z], 1)
        T = np.interp(mi, j, th)
        n = -inward_normals(q)  # outward
        arc = np.r_[0.0, np.cumsum(np.hypot(*np.diff(q, axis=0).T))]
        thin = np.exp(-np.clip(T, 0, None) / 0.45) * (z > 0.05 * face)
        out[k, :, 0], out[k, :, 1], out[k, :, 2], out[k, :, 3] = y, z, thin, np.interp(mi, j, ff)
        out[NS + k, :, 0], out[NS + k, :, 1], out[NS + k, :, 2], out[NS + k, :, 3] = np.minimum(T, 50), arc, n[:, 0], n[:, 1]
    return out


def default_breaker(family):
    return 'spilling' if family == 'spiller' else 'plunging'


def build_band(src, band, breaker=None):
    bid, face, family, period, slope, peel = band
    phys = band_physics(face, period, slope, peel)
    breaker = breaker or default_breaker(family)
    curves, foams, shape = stage_curves(src, face, breaker, phys)
    ymin = min(p[:, 0].min() for p in curves) * face
    ymax = max(p[:, 0].max() for p in curves) * face
    y0, y1 = ymin - 0.5 * face, ymax + 1.5 * face
    atlas = resample(curves, foams, face, phys['depth_break_m'], y0, y1)
    # along the crest: the shoulder tapers where depth grows (H/d falls from 0.78), the break cycle runs at the peel speed
    peel_sin = math.sin(math.radians(peel))
    bed_along = slope * math.cos(math.radians(peel))     # depth change per metre along the crest line
    cycle_s = period * (0.75 if breaker == 'spilling' else 0.5)
    # file id: the family's own breaker is the plain band id; the forced other breaker gets a suffix (viewer: waveAtlas.atlasId)
    meta = dict(
        band=bid + ('' if breaker == default_breaker(family) else '-' + breaker), face_m=face, family=family, breaker=breaker, period_s=period, slope=slope, peel_angle_deg=peel, breaker_index=GAMMA,
        stages=NS, points=NP, layout='float16 RGBA, width=points, height=2*stages; rows 0..stages-1 (y, z, thin, foam), '
        'rows stages.. (thickness, arc, normal_y, normal_z); metres, y cross-shore (+ beach), z up',
        stage_feather=S_FEATHER, stage_pitch=S_PITCH, stage_land=S_LAND, y0_m=y0, y1_m=y1,
        bed_along_per_m=bed_along, cycle_s=cycle_s, break_len_m=phys['peel_speed_mps'] * cycle_s,
        shoulder_len_m=min(26 * face + 12, (face / 0.5 - phys['depth_break_m']) / max(bed_along, 1e-3)),
        **{k: round(v, 4) for k, v in phys.items()}, shape={k: round(v, 4) for k, v in shape.items()}, peel_sin=peel_sin,
    )
    return atlas, meta, curves


def write_band(out_dir, atlas, meta):
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, meta['band'] + '.bin'), 'wb') as fh:
        fh.write(atlas.astype('<f2').tobytes())
    with open(os.path.join(out_dir, meta['band'] + '.json'), 'w') as fh:
        json.dump(meta, fh, indent=1)


def build_all(hump, mid, barrel, out_dir, only=None, breaker=None, variants=False):
    """variants: also write the other breaker for every bucket (<band>-spilling / <band>-plunging), so the viewer can draw the
    forecast hour's estimated breaker type (breaker.ts) at any size."""
    src = Source(hump, mid, barrel)
    res = []
    for band in BANDS:
        if only and band[0] not in only:
            continue
        kinds = [breaker] if breaker else ([None, 'spilling' if default_breaker(band[2]) == 'plunging' else 'plunging'] if variants else [None])
        for kind in kinds:
            atlas, meta, curves = build_band(src, band, kind)
            write_band(out_dir, atlas, meta)
            print('ATLAS', meta['band'], meta['family'], meta['breaker'], 'xi %.2f' % meta['iribarren'], 'plunge %.2f' % meta['plunge'],
                  'peel %.1f m/s' % meta['peel_speed_mps'], 'break_len %.1f m' % meta['break_len_m'], 'shoulder %.1f m' % meta['shoulder_len_m'],
                  'bytes', atlas.size * 2)
            res.append((atlas, meta))
    return res
