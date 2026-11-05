# Trace OUR renders with the same tracer as the real clips: the ride recording's frames (rides/<tag>/f###.jpg + labels.json) are laid
# out as pose/frames/ours-<tag>/dense/t<el>.jpg and skeleton2.run() is called on them, so out2/ours-<tag>/ holds stick/, angles.csv and
# poses.json measured exactly as the real ones (2D, image plane). The move per frame comes from labels.json (the ride plan's own move).
#   SWELLO_POSE_DIR=<dir with skeleton2.py, frames/, out2/> SWELLO_RIDES_DIR=<dir with <rideTag>/f###.jpg + labels.json> \
#   pose/.venv/bin/python -I trace_ours.py <rideTag> [<rideTag> ...]   (every frame; FRAME_STEP=2 for every second frame)
# (T-138: the directories come from the environment, never a hard-coded scratchpad path)
import json, os, shutil, sys
P = os.environ.get('SWELLO_POSE_DIR'); RIDES = os.environ.get('SWELLO_RIDES_DIR')
if not P or not RIDES: sys.exit('set SWELLO_POSE_DIR (skeleton2.py, frames/, out2/) and SWELLO_RIDES_DIR (<rideTag>/f###.jpg + labels.json)')
sys.path.insert(0, P)
import skeleton2
step = int(os.environ.get('FRAME_STEP', '1'))
for tag in sys.argv[1:]:
    R = f'{RIDES}/{tag}'; labels = json.load(open(f'{R}/labels.json'))
    D = f'{P}/frames/ours-{tag}/dense'; shutil.rmtree(D, ignore_errors=True); os.makedirs(D)
    moves = {}
    for l in labels[::step]:
        src = f'{R}/f{l["i"]:03d}.jpg'
        if not os.path.exists(src): continue
        name = f't{l["el"]:07.2f}'; shutil.copyfile(src, f'{D}/{name}.jpg'); moves[round(l['el'], 2)] = l['move']
    json.dump(moves, open(f'{P}/out2/ours-{tag}-moves.json', 'w'))
    skeleton2.run(f'ours-{tag}', 'dense')
