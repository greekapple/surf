# Real-clip angle statistics: per clip (optionally per time segment), the median and the 10-90% range of every angles.csv column over
# the confident frames (conf >= 0.5). python3 -I realstats.py [clip[:t0-t1[:label]] ...]  (no args: every traced clip, whole)
import csv, glob, os, sys
import statistics as st
OUT2 = '/private/tmp/claude-501/-Users-milosin-Development-projects-surf/250e1e66-bb9b-4659-a5ff-86bd5a0084e7/scratchpad/pose/out2'
COLS = ['knee_l', 'knee_r', 'hip_l', 'hip_r', 'elbow_l', 'elbow_r', 'shoulder_l', 'shoulder_r', 'torso_lean', 'wrist_l_above_hip', 'wrist_r_above_hip', 'hip_height', 'stance_width']
def q(v, p):
    v = sorted(v); n = len(v)
    if n == 0: return float('nan')
    k = (n - 1) * p; i = int(k); f = k - i
    return v[i] if i + 1 >= n else v[i] * (1 - f) + v[i + 1] * f
def load(clip):
    rows = list(csv.DictReader(open(f'{OUT2}/{clip}/angles.csv')))
    return [{k: float(v) for k, v in r.items()} for r in rows]
def stats(rows, t0=None, t1=None):
    sel = [r for r in rows if r['conf'] >= 0.5 and (t0 is None or t0 <= r['t'] <= t1)]
    out = {}
    for c in COLS:
        v = [r[c] for r in sel if r[c] == r[c]]
        out[c] = (st.median(v), q(v, 0.1), q(v, 0.9)) if v else (float('nan'),) * 3
    return len([r for r in rows if t0 is None or t0 <= r['t'] <= t1]), len(sel), out
if __name__ == '__main__':
    specs = sys.argv[1:] or [os.path.basename(d) for d in sorted(glob.glob(f'{OUT2}/*')) if os.path.exists(f'{d}/angles.csv')]
    print('clip/segment'.ljust(34), 'frames(conf)', ' '.join(c[:9].rjust(9) for c in COLS))
    for s in specs:
        parts = s.split(':'); clip = parts[0]; t0 = t1 = None; label = clip
        if len(parts) > 1: t0, t1 = map(float, parts[1].split('-')); label = f'{clip} {t0}-{t1}' + (f' {parts[2]}' if len(parts) > 2 else '')
        rows = load(clip); n, m, o = stats(rows, t0, t1)
        print(label.ljust(34), f'{n:3d}({m:3d})'.ljust(12), ' '.join(f'{o[c][0]:6.0f}'.rjust(9) if 'wrist' not in c and c not in ('hip_height', 'stance_width') else f'{o[c][0]:6.2f}'.rjust(9) for c in COLS))
        print(' ' * 34, '10-90%'.ljust(12), ' '.join((f'{o[c][1]:3.0f}-{o[c][2]:3.0f}' if 'wrist' not in c and c not in ('hip_height', 'stance_width') else f'{o[c][1]:.2f}/{o[c][2]:.2f}').rjust(9) for c in COLS))
