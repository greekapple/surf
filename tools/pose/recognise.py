# R13 recognisability score (spec 2026-11-04-3d-r13-skeleton, from Balestriero & LeCun arXiv 2610.39302: alignment of two views of the
# same thing in a shared representation that drops each side's nuisance, measured with nearest neighbours, nothing fitted).
# The shared representation is the skeleton: the real clips' traces (pose/out2/<clip>/poses.json + angles.csv) and OUR renders traced by the
# same skeleton2.py (pose/out2/ours-<tag>/). Features per frame: the 13 body joints centred on the mid-hip and scaled by the torso length
# (mid-shoulder to mid-hip), plus the angles.csv columns; joints with confidence < 0.5 dropped, frames with fewer than 10 kept joints
# dropped; the features standardised over the real frames. Score: for each of our frames, the share of its k = 10 nearest real frames
# (Euclidean) with the same move label; per move and overall, beside the chance level (the move's share of the real frames).
# Labels: the real frames by clip (single-move clips) or by time segment (SEGMENTS below); ours by the ride plan's move (the recording's
# labels.json, carried into out2/ours-<tag>-moves.json by trace_ours.py), with the side (front/back) from the tag.
#   python3 -I recognise.py <oursTag> [<oursTag> ...]      e.g. recognise.py r12-6e-bs r13c-6e-bs
import csv, json, math, os, sys
S = '/private/tmp/claude-501/-Users-milosin-Development-projects-surf/250e1e66-bb9b-4659-a5ff-86bd5a0084e7/scratchpad/pose/out2'
K = 10
J13 = ['nose', 'l_sh', 'r_sh', 'l_el', 'r_el', 'l_wr', 'r_wr', 'l_hip', 'r_hip', 'l_knee', 'r_knee', 'l_ank', 'r_ank']
ANG = ['knee_l', 'knee_r', 'hip_l', 'hip_r', 'elbow_l', 'elbow_r', 'shoulder_l', 'shoulder_r', 'torso_lean', 'wrist_l_above_hip', 'wrist_r_above_hip', 'hip_height', 'stance_width']
# the real clips: (clip, side, [(t0, t1, move), ...]); a None segment list = the whole clip is one move. The side is the rider's: the
# clips' notes (pose/clips.json) and the overlays; snap-fs is a backside rider per R11's note. The Surf Ranch and close-up segments are
# read off the per-second joint statistics (hip height, knees, torso lean, wrist heights; r13/realstats.py) and are approximate; the
# Surf Ranch stretch 18-31 s (both arms held high for 13 s, a claim or another person) is left unlabelled.
CLIPS = [
    ('bottom-turn-fs', 'front', [(0, 99, 'bottom')]),
    ('snap-fs', 'back', [(0, 99, 'top')]),
    ('cutback-fs', 'front', [(0, 99, 'cutback')]),
    ('backside-turns', 'back', [(8, 9.9, 'bottom'), (10, 11.9, 'top'), (12, 16.1, 'trim')]),
    ('barrel-machado', 'front', [(0, 99, 'barrel')]),
    ('pro-popups-surfranch', 'front', [(1, 6.9, 'popup'), (7, 10.9, 'bottom'), (11, 17.9, 'trim'), (32, 35.9, 'trim'), (36, 39.9, 'bottom'), (40, 41.9, 'trim'), (42, 43.9, 'bottom'), (47, 50.9, 'popup'), (51, 52.9, 'bottom'), (53, 56.9, 'trim')]),
    ('snap-cutback-closeup', 'front', [(0, 6.9, 'trim'), (7, 12.9, 'bottom'), (13, 17.9, 'top'), (18, 23.9, 'cutback')]),
    # the lead's later traces (2026-11-04 late): the backside barrels; the Reunion clip mixes turns and barrels without a segment list yet,
    # barrel-big-standing (3 confident frames) and bigwave-drops (figures a few px tall) are not for angles
    ('barrel-backside-100fps', 'back', [(0, 99, 'barrel')]),
    ('pigdog-backside', 'back', [(0, 99, 'barrel')]),
]
# our moves -> the label vocabulary (the plan's 'recover' and 'pump' have no real segment of their own: recover scored as the move it
# leaves (top), pump as trim; takeoff/kickout/out/floater are not scored)
OURS_MAP = {'trim': 'trim', 'pump': 'trim', 'bottom': 'bottom', 'top': 'top', 'recover': 'top', 'cutback': 'cutback', 'barrel': 'barrel'}

def frames(clip):
    P = json.load(open(f'{S}/{clip}/poses.json'))['frames']
    A = {round(float(r['t']), 2): {k: float(v) for k, v in r.items()} for r in csv.DictReader(open(f'{S}/{clip}/angles.csv'))}
    out = []
    for f in P:
        t = round(f['t'], 2); j = f['joints']; a = A.get(t)
        if a is None: continue
        ok = {k: j[k] for k in J13 if j[k][2] >= 0.5}
        if len(ok) < 10 or not all(k in ok for k in ('l_sh', 'r_sh', 'l_hip', 'r_hip')): continue
        msh = ((j['l_sh'][0] + j['r_sh'][0]) / 2, (j['l_sh'][1] + j['r_sh'][1]) / 2); mhip = ((j['l_hip'][0] + j['r_hip'][0]) / 2, (j['l_hip'][1] + j['r_hip'][1]) / 2)
        torso = math.hypot(msh[0] - mhip[0], msh[1] - mhip[1]) or 1e-6
        v = []
        for k in J13:
            if k in ok: v += [(j[k][0] - mhip[0]) / torso, (j[k][1] - mhip[1]) / torso]
            else: v += [float('nan'), float('nan')]
        v += [a[c] for c in ANG]
        out.append((t, v))
    return out

def label(segs, t):
    for t0, t1, m in segs:
        if t0 <= t <= t1: return m
    return None

def main(tags):
    real = []   # (features, move, side)
    for clip, side, segs in CLIPS:
        if not os.path.exists(f'{S}/{clip}/poses.json'): print('missing real clip', clip); continue
        for t, v in frames(clip):
            m = label(segs, t)
            if m: real.append((v, m, side))
    n = len(real[0][0]); mu = [0.0] * n; sd = [0.0] * n; cnt = [0] * n
    for v, _, _ in real:
        for i, x in enumerate(v):
            if x == x: mu[i] += x; cnt[i] += 1
    mu = [m / c if c else 0 for m, c in zip(mu, cnt)]
    for v, _, _ in real:
        for i, x in enumerate(v):
            if x == x: sd[i] += (x - mu[i]) ** 2
    sd = [math.sqrt(s / c) if c > 1 and s > 0 else 1 for s, c in zip(sd, cnt)]
    z = lambda v: [((x - mu[i]) / sd[i]) if x == x else 0.0 for i, x in enumerate(v)]   # a dropped joint = the mean (0 after standardising)
    R = [(z(v), m, s) for v, m, s in real]
    chance = {}
    for _, m, s in R: chance[(m, s)] = chance.get((m, s), 0) + 1
    print(f'real frames kept: {len(R)}; per move/side: ' + ', '.join(f'{m}/{s} {c} ({100 * c / len(R):.0f}%)' for (m, s), c in sorted(chance.items())))
    for tag in tags:
        d = f'{S}/ours-{tag}'
        if not os.path.exists(f'{d}/poses.json'): print(tag, 'not traced'); continue
        moves = {round(float(k), 2): v for k, v in json.load(open(f'{S}/ours-{tag}-moves.json')).items()}
        side = 'back' if any(part == 'bs' for part in tag.split('-')) else 'front'   # the recording tags: <round>-<face><skill>-<bs|fs>[-<camera>]
        per = {}; tot = [0, 0]
        for t, v in frames(f'ours-{tag}'):
            mv = OURS_MAP.get(moves.get(t, ''), None)
            if not mv: continue
            q = z(v)
            d2 = sorted((sum((a - b) ** 2 for a, b in zip(q, r)), m, s) for r, m, s in R)[:K]
            hit = sum(1 for _, m, s in d2 if m == mv and s == side)
            p = per.setdefault(mv, [0, 0]); p[0] += hit; p[1] += K; tot[0] += hit; tot[1] += K
        line = f'{tag} ({side}side): overall {100 * tot[0] / max(1, tot[1]):.1f}% over {tot[1] // K} frames; '
        line += '; '.join(f'{m} {100 * h / max(1, n):.0f}% (chance {100 * chance.get((m, side), 0) / len(R):.0f}%, {n // K} frames)' for m, (h, n) in sorted(per.items()))
        print(line)

if __name__ == '__main__': main(sys.argv[1:])
