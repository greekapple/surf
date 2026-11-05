# Trace OUR renders with the same tracer as the real clips: the ride recording's frames (rides/<tag>/f###.jpg + labels.json) are laid
# out as pose/frames/ours-<tag>/dense/t<el>.jpg and skeleton2.run() is called on them, so out2/ours-<tag>/ holds stick/, angles.csv and
# poses.json measured exactly as the real ones (2D, image plane). The move per frame comes from labels.json (the ride plan's own move).
#   pose/.venv/bin/python -I trace_ours.py <rideTag> [<rideTag> ...]   (every frame; FRAME_STEP=2 for every second frame)
import json, os, shutil, sys
S = '/private/tmp/claude-501/-Users-milosin-Development-projects-surf/250e1e66-bb9b-4659-a5ff-86bd5a0084e7/scratchpad'
sys.path.insert(0, f'{S}/pose')
import skeleton2
step = int(os.environ.get('FRAME_STEP', '1'))
for tag in sys.argv[1:]:
    R = f'{S}/wave/r13/rides/{tag}'; labels = json.load(open(f'{R}/labels.json'))
    D = f'{S}/pose/frames/ours-{tag}/dense'; shutil.rmtree(D, ignore_errors=True); os.makedirs(D)
    moves = {}
    for l in labels[::step]:
        src = f'{R}/f{l["i"]:03d}.jpg'
        if not os.path.exists(src): continue
        name = f't{l["el"]:07.2f}'; shutil.copyfile(src, f'{D}/{name}.jpg'); moves[round(l['el'], 2)] = l['move']
    json.dump(moves, open(f'{S}/pose/out2/ours-{tag}-moves.json', 'w'))
    skeleton2.run(f'ours-{tag}', 'dense')
