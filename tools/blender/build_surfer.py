"""SWELLO surfer v3 (spec 2026-11-03 wave-surfer follow-up, Track A): a rigged, skinned MPFB2 human (CC0) riding a procedural 6'0"
shortboard in a black wetsuit, with two clips: `ride` (a 4 s loop: trim -> bottom turn -> top turn -> pump -> trim, keyed against real
photos, see docs/design/REFERENCES-2026-11-03-surfer.md) and `still` (the bottom turn, for reduced motion). Goofy-foot frontside on a left;
the viewer mirrors it for a right. Replaces the baked single pose of v2 (which this script used to build).

Run (MPFB is a user extension, so NOT --factory-startup):
  blender -b --python tools/blender/build_surfer.py -- --out tools/blender/assets/surfer-v3.glb [--preview DIR] [--board 1.83]

Frame of the exported model (Blender, z-up; glTF converts to y-up): board along x with the NOSE AT -X, the surfer faces -Y (toward the
wave), the board's bottom at z = 0 at rest, true scale (the standing height is printed: SURFER_MODEL_M in WaveLive.tsx must match).
Skeleton: the MPFB game_engine rig minus the fingers (23 body bones) plus a `board` bone (child of Root) the board mesh is parented to.
Bank/yaw/pitch of the board inside the clips are rider-relative; the viewer banks the whole rider to the wave face.
"""
import argparse
import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='tools/blender/assets/surfer-v3.glb')
ap.add_argument('--preview', default='')
ap.add_argument('--board', type=float, default=1.83, help='board length in metres (6\'0" = 1.83)')
ap.add_argument('--fps', type=int, default=24)
a = ap.parse_args(argv)

from bl_ext.blender_org.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.blender_org.mpfb.services.targetservice import TargetService  # noqa: E402

bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene
scene.render.fps = a.fps

# ---------------------------------------------------------------- body (no object scale: the viewer scales by the printed height)
macro = TargetService.get_default_macro_info_dict()
macro.update({'gender': 1.0, 'age': 0.45, 'muscle': 0.68, 'weight': 0.42, 'proportions': 0.6, 'height': 0.575})
body = HumanService.create_human(macro_detail_dict=macro)
rig = HumanService.add_builtin_rig(body, 'game_engine')
bpy.context.view_layer.update()
STAND_H = body.dimensions.z
print('SURFER standing height', round(STAND_H, 4))

# ---------------------------------------------------------------- board (procedural shortboard, nose at -x)
L, W, T = a.board, 0.49 * (a.board / 1.83) ** 0.35, 0.062


def planshape(t):
    """Half width at t (0 = tail, 1 = nose): squash-ish tail, wide point just behind centre, pulled-in pointed nose."""
    tail = 0.36 + 0.64 * math.sin(min(1.0, t / 0.45) * math.pi / 2) ** 0.9
    nose = math.cos(max(0.0, (t - 0.45) / 0.55) * math.pi / 2) ** 0.75 if t > 0.45 else 1.0
    return 0.5 * W * min(tail, nose) * (1.0 if t > 0.004 else 0.85)


def rocker(t):
    return 0.11 * max(0.0, (t - 0.62) / 0.38) ** 2.2 + 0.035 * max(0.0, (0.25 - t) / 0.25) ** 1.8


def thick(t):
    return T * (0.35 + 0.65 * math.sin(math.pi * min(1.0, max(0.0, t * 0.92 + 0.04))) ** 0.7)


bmb = bmesh.new()
rings = []
NS, NR = 60, 20
for s_ in range(NS + 1):
    t = s_ / NS
    x = (0.5 - t) * L  # nose (t=1) at -x
    hw, th, zr = max(planshape(t), 0.004), thick(t), rocker(t)
    ring = []
    for r_ in range(NR):
        u = 2 * math.pi * r_ / NR
        cu, su = math.cos(u), math.sin(u)
        y = hw * math.copysign(abs(cu) ** 0.55, cu)
        z = zr + th * (0.5 + 0.5 * math.copysign(abs(su) ** (0.8 if su > 0 else 1.6), su))  # domed deck, flatter bottom
        ring.append(bmb.verts.new((x, y, z)))
    rings.append(ring)
for r0, r1 in zip(rings, rings[1:]):
    for j in range(NR):
        bmb.faces.new((r0[j], r1[j], r1[(j + 1) % NR], r0[(j + 1) % NR]))
bmb.faces.new(list(reversed(rings[0])))
bmb.faces.new(rings[-1])
bm_me = bpy.data.meshes.new('Board')
bmb.to_mesh(bm_me)
bmb.free()
board = bpy.data.objects.new('Board', bm_me)
scene.collection.objects.link(board)
for p in bm_me.polygons:
    p.use_smooth = True
deck_z = lambda x: rocker(0.5 - x / L) + thick(0.5 - x / L)  # noqa: E731

# ---------------------------------------------------------------- materials (before the finger groups are merged away)


def mat(name, rgb, rough, sss=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
        b.inputs['Subsurface Radius'].default_value = (0.9, 0.4, 0.25)
        b.inputs['Subsurface Scale'].default_value = 0.01
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.25
    return m


suit = mat('Wetsuit', (0.018, 0.018, 0.02), 0.42, coat=0.35)
skin = mat('Skin', (0.6, 0.41, 0.31), 0.48, sss=0.25)
hair = mat('Hair', (0.06, 0.04, 0.03), 0.6)
deck = mat('Board', (0.84, 0.84, 0.8), 0.2, coat=0.5)
pad = mat('Pad', (0.03, 0.03, 0.03), 0.8)
for m_ in (suit, skin, hair):
    body.data.materials.append(m_)
board.data.materials.append(deck)
board.data.materials.append(pad)
FINGER = ('index', 'middle', 'pinky', 'ring', 'thumb')
SKIN_BONES = {'head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'}
SKIN_BONES |= {b.name for b in rig.data.bones if any(s in b.name for s in FINGER)}
gi = {g.index: g.name for g in body.vertex_groups}
skin_w = []
for v in body.data.vertices:
    skin_w.append(sum(g.weight for g in v.groups if gi.get(g.group) in SKIN_BONES))
head_top = max(v.co.z for v in body.data.vertices)
for p in body.data.polygons:
    ws = [skin_w[i] for i in p.vertices]
    if min(ws) > 0.55:
        c = p.center
        is_hair = c.z > head_top - 0.15 * (body.dimensions.z / 1.73) and c.y > -0.095
        p.material_index = 2 if is_hair else 1
    else:
        p.material_index = 0
for p in bm_me.polygons:  # tail pad: deck faces in the last 18% of the board toward the tail
    if p.center.x > 0.5 * L - 0.18 * L and p.normal.z > 0.5:
        p.material_index = 1

# ---------------------------------------------------------------- bake the body targets and the mask, keep the armature modifier
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
if body.data.shape_keys:
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
for mod in list(body.modifiers):
    if mod.type == 'MASK':
        bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
        bpy.ops.object.modifier_apply(modifier=mod.name)
# fingers: their weights move to the hand (23 body bones), the finger bones go
for side in ('l', 'r'):
    hand = body.vertex_groups[f'hand_{side}']
    fg = [g for g in body.vertex_groups if any(g.name.startswith(f) for f in FINGER) and g.name.endswith('_' + side)]
    fidx = {g.index for g in fg}
    for v in body.data.vertices:
        w = sum(g.weight for g in v.groups if g.group in fidx)
        if w > 0:
            hand.add([v.index], w, 'ADD')
    for g in fg:
        body.vertex_groups.remove(g)

bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones
for b in list(eb):
    if any(s in b.name for s in FINGER):
        eb.remove(b)
# the board bone (deforms nothing: the board mesh is parented to it) and the IK helpers (removed again after the bake)
bb = eb.new('board')
bb.head, bb.tail, bb.parent, bb.use_deform = (0, 0, 0), (0, 0, 0.1), eb['Root'], False
for n in ('tgt_l', 'tgt_r', 'pole_l', 'pole_r'):
    h = eb.new(n)
    h.head, h.tail, h.use_deform = (0, 0, 0), (0, 0, 0.05), False
bpy.ops.object.mode_set(mode='OBJECT')
board.parent, board.parent_type, board.parent_bone = rig, 'BONE', 'board'
board.matrix_parent_inverse = (rig.matrix_world @ rig.data.bones['board'].matrix_local @ Matrix.Translation((0, 0.1, 0))).inverted()  # bone parenting pivots at the tail
bpy.context.view_layer.update()
print('SURFER bones', len(rig.data.bones), [b.name for b in rig.data.bones])

# ---------------------------------------------------------------- posing helpers (world space; the rig sits at the origin)
bpy.ops.object.mode_set(mode='POSE')
pb = rig.pose.bones
for b in pb:
    b.rotation_mode = 'QUATERNION'
M = rig.matrix_world
REST = {b.name: b.matrix_local.copy() for b in rig.data.bones}
PARENT = {b.name: (b.parent.name if b.parent else None) for b in rig.data.bones}
FRONT_X, BACK_X = -0.26 * L / 1.83, 0.31 * L / 1.83   # front foot near the middle, back foot over the tail pad
ANKLE = pb['foot_r'].head.z                            # ankle height above the sole at rest
P0 = pb['pelvis'].head.copy()                          # hips at rest (standing)


def upd():
    bpy.context.view_layer.update()


def reset_pose():
    for b in pb:
        b.matrix_basis = Matrix.Identity(4)
    upd()


def set_world(name, mw):
    pb[name].matrix = M.inverted() @ mw
    upd()


def rot_world(name, axis, deg):
    """Rotate a pose bone about a world axis through its head (children follow)."""
    b = pb[name]
    mw = M @ b.matrix
    head = mw.to_translation()
    R = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, Vector(axis)) @ Matrix.Translation(-head)
    set_world(name, R @ mw)


def aim(name, direction, twist=0.0):
    """Turn a bone so it points along `direction` (world), optionally twisting about its own axis."""
    b = pb[name]
    mw = M @ b.matrix
    cur = (M @ b.tail - M @ b.head).normalized()
    q = cur.rotation_difference(Vector(direction).normalized())
    head = mw.to_translation()
    R = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head)
    set_world(name, R @ mw)
    if twist:
        axis = (M @ b.tail - M @ b.head).normalized()
        rot_world(name, axis, twist)


def move_world(name, d):
    b = pb[name]
    set_world(name, Matrix.Translation(Vector(d)) @ (M @ b.matrix))


def board_matrix(bank, pitch, yaw):
    """The board's rotation about its bottom centre: yaw about z (+: nose toward the wave), pitch about y (+: nose up), bank about x (+: toe rail, the wave side, down)."""
    return Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.radians(-pitch), 4, 'Y') @ Matrix.Rotation(math.radians(bank), 4, 'X')


# IK: calves reach the target bones, knees toward the poles
for side in ('l', 'r'):
    c = pb[f'calf_{side}'].constraints.new('IK')
    c.target, c.subtarget, c.pole_target, c.pole_subtarget, c.chain_count, c.pole_angle = rig, f'tgt_{side}', rig, f'pole_{side}', 2, math.radians(-90)


_gi = {g.index: g.name for g in body.vertex_groups}
FOOT_IDX = [v.index for v in body.data.vertices if sum(g.weight for g in v.groups if _gi.get(g.group) in ('foot_l', 'foot_r', 'ball_l', 'ball_r')) > 0.5]


def foot_penetration(Rb):
    """How far the lowest foot vertex sits below the deck, measured in the board's own (banked) frame; negative = through the deck."""
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    ev = body.evaluated_get(dg)
    Ri, Mw = Rb.inverted(), ev.matrix_world
    pen = 1.0
    for i in FOOT_IDX:
        p = Ri @ (Mw @ ev.data.vertices[i].co)
        pen = min(pen, p.z - deck_z(max(-0.5 * L, min(0.5 * L, p.x))))
    return pen


def pose(P):
    """Set the whole rider from a pose dict (see POSES). Frame: nose -x, wave -y, z up; goofy: right foot forward."""
    reset_pose()
    Rb = board_matrix(*P['board'])
    set_world('board', Rb)
    # feet on the (banked) deck: targets at ankle height above the deck, poles out past the knees, apart (never caving in)
    for side, fx, yaw in (('r', FRONT_X, P['foot_yaw'][0]), ('l', BACK_X, P['foot_yaw'][1])):
        set_world(f'tgt_{side}', Matrix.Translation(Rb @ Vector((fx, -0.02, deck_z(fx) + ANKLE))))
        set_world(f'pole_{side}', Matrix.Translation(Rb @ Vector((fx * 1.6, -1.1, 0.45))))
    # hips: crouch height, shifted toward the tail / the wave, opened toward the nose
    cz, dx, dy = P['hips']   # height as a fraction of the standing hip height (1 = legs straight)
    move_world('pelvis', (dx, dy, (cz - 1) * P0.z))
    rot_world('pelvis', (0, 0, 1), P['hip_yaw'])
    upd()
    for side, yaw in (('r', P['foot_yaw'][0]), ('l', P['foot_yaw'][1])):
        aim(f'foot_{side}', Rb @ Vector((-math.sin(math.radians(yaw)), -math.cos(math.radians(yaw)), -0.5)))
    s1, s2, s3, tw = P['spine']
    aim('spine_01', s1)
    aim('spine_02', s2)
    aim('spine_03', s3, twist=tw)
    aim('neck_01', P['neck'])
    aim('head', P['head'][0], twist=P['head'][1])
    ua, la, ha = P['arm_r']
    aim('upperarm_r', ua)
    aim('lowerarm_r', la)
    aim('hand_r', ha)
    ua, la, ha = P['arm_l']
    aim('upperarm_l', ua)
    aim('lowerarm_l', la)
    aim('hand_l', ha)
    upd()
    # plant the soles: lift both IK targets along the deck normal by whatever the lowest foot vertex sits through the deck (two passes)
    for _ in range(2):
        pen = foot_penetration(Rb)
        if pen > -0.002:
            break
        for side in ('l', 'r'):
            set_world(f'tgt_{side}', Matrix.Translation((M @ pb[f'tgt_{side}'].matrix).to_translation() + Rb @ Vector((0, 0, -pen + 0.004))))
    upd()


# The four poses, keyed against the reference photos (docs/design/REFERENCES-2026-11-03-surfer.md):
#  trim   (Unsplash Newport, Santa Cruz inside): tall-ish, knees soft, arms low and loose, looking down the line
#  bottom (Blacks bottom turn): compressed, hips over the back foot and leaning into the wave, toe rail buried, trailing hand to the water,
#         leading arm pointing the line
#  top    (USFWS cutback, Santa Cruz snap): extended on the back leg, board turned toward the beach on its heel rail, trailing arm swung
#         round leading the shoulders, head on the landing
#  pump   : a small compress between trims
POSES = {
    'trim': dict(board=(4, 0, 0), hips=(0.74, 0.02, -0.04), hip_yaw=-14, foot_yaw=(18, -2),
                 spine=((-0.22, -0.2, 1.0), (-0.3, -0.25, 1.0), (-0.3, -0.2, 1.0), -12), neck=(-0.1, -0.1, 1.0), head=((-0.05, -0.05, 1.0), -50),
                 arm_r=((-0.75, -0.35, -0.5), (-0.95, -0.2, 0.05), (-0.9, -0.2, 0.0)), arm_l=((0.3, -0.25, -0.9), (0.1, -0.7, -0.65), (0.0, -0.8, -0.55))),
    'bottom': dict(board=(36, -4, 10), hips=(0.64, 0.07, -0.14), hip_yaw=-24, foot_yaw=(16, -6),
                   spine=((-0.06, -0.5, 1.0), (-0.1, -0.6, 1.0), (-0.12, -0.5, 1.0), -18), neck=(-0.06, -0.2, 1.0), head=((0.0, -0.1, 1.0), -58),
                   arm_r=((-0.7, -0.45, -0.55), (-0.95, -0.2, 0.1), (-0.9, -0.2, 0.0)), arm_l=((0.25, -0.55, -0.8), (-0.15, -0.9, -0.35), (-0.2, -0.9, -0.3))),
    'top': dict(board=(-24, 6, -19), hips=(0.76, 0.06, 0.1), hip_yaw=22, foot_yaw=(20, 4),
                spine=((0.0, 0.25, 1.0), (0.02, 0.3, 1.0), (0.04, 0.25, 1.0), 28), neck=(0.0, 0.1, 1.0), head=((0.05, 0.1, 1.0), 5),
                arm_r=((-0.7, 0.1, -0.7), (-0.95, 0.3, 0.1), (-0.9, 0.3, 0.0)), arm_l=((0.45, 0.6, 0.65), (0.0, 0.95, 0.3), (-0.1, 0.95, 0.2))),
    'pump': dict(board=(10, -2, 2), hips=(0.74, 0.03, -0.06), hip_yaw=-16, foot_yaw=(18, -3),
                 spine=((-0.04, -0.3, 1.0), (-0.07, -0.38, 1.0), (-0.08, -0.3, 1.0), -14), neck=(-0.05, -0.12, 1.0), head=((0.0, -0.06, 1.0), -52),
                 arm_r=((-0.55, -0.4, -0.7), (-0.95, -0.3, -0.05), (-0.9, -0.3, -0.1)), arm_l=((0.35, -0.35, -0.85), (0.0, -0.9, -0.4), (-0.1, -0.9, -0.4))),
}
# the ride: 4 s at 24 fps, frame 97 == frame 1 so it loops
RIDE = [(1, 'trim'), (22, 'bottom'), (38, 'bottom'), (54, 'trim'), (64, 'top'), (74, 'top'), (86, 'pump'), (97, 'trim')]
STILL = 'bottom'
CHECK_FRAMES = {1, 30, 69, 86}


def fcurves_of(act):
    """Every F-curve of a (slotted, Blender 4.4+) action."""
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                out.append((cb, list(cb.fcurves)))
    return out


def key_all(f):
    for b in pb:
        b.keyframe_insert('location', frame=f)
        b.keyframe_insert('rotation_quaternion', frame=f)


def new_action(name):
    act = bpy.data.actions.new(name)
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = act
    return act


def bake(src_name, frames, out_name):
    """Evaluate the keyed (IK-driven) action frame by frame, then write the visual result into a plain FK action `out_name`."""
    stored = []
    dg = bpy.context.evaluated_depsgraph_get()
    for f in frames:
        scene.frame_set(f)
        stored.append({b.name: (M @ b.matrix).copy() for b in pb})
        if f in CHECK_FRAMES:
            dg.update()
            ev = body.evaluated_get(dg)
            low = min((ev.matrix_world @ v.co).z for v in ev.data.vertices)
            Rb = M @ pb['board'].matrix
            dk = Rb @ Vector((BACK_X, -0.02, deck_z(BACK_X)))
            eul = Rb.to_euler('ZYX')
            print(f'SURFER check f{f}: lowest body z {low:.3f}, deck under the back foot z {dk.z:.3f}, sole-to-deck (board frame) {foot_penetration(Rb):+.3f}, '
                  f'board bank/pitch/yaw {math.degrees(eul.x):.0f}/{math.degrees(-eul.y):.0f}/{math.degrees(eul.z):.0f}')
    out = new_action(out_name)
    for b in pb:
        for c in list(b.constraints):  # the baked pose carries everything
            b.constraints.remove(c)
    order = sorted(pb, key=lambda b: sum(1 for _ in iter_parents(b.name)))
    for f, st in zip(frames, stored):
        scene.frame_set(f)
        for b in order:
            par = PARENT[b.name]
            if par is None:
                basis = REST[b.name].inverted() @ (M.inverted() @ st[b.name])
            else:
                basis = (( M.inverted() @ st[par]) @ REST[par].inverted() @ REST[b.name]).inverted() @ (M.inverted() @ st[b.name])
            loc, rot, scl = basis.decompose()
            b.location, b.rotation_quaternion, b.scale = loc, rot, (1, 1, 1)
        key_all(f)
    for b in pb:  # re-add the IK so the next source action can use it
        pass
    upd()
    scene.frame_set(frames[0])
    err = max(((M @ b.matrix).to_translation() - stored[0][b.name].to_translation()).length for b in pb)
    print(f'SURFER baked {out_name}: {len(frames)} frames, max head error {err:.4f} m')
    return out


def iter_parents(n):
    while PARENT[n]:
        n = PARENT[n]
        yield n


# ride: key the poses, bake, then still (constraints are cleared by the first bake, so key still into FK space from its own evaluation)
ride_src = new_action('ride_src')
for f, name in RIDE:
    pose(POSES[name])
    key_all(f)
# the clip's F-curves: cyclic, smooth
for _cb, fcs in fcurves_of(ride_src):
  for fc in fcs:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
        kp.easing = 'AUTO'
scene.frame_start, scene.frame_end = 1, 96
frames = list(range(1, 98))
stored_still = None
# evaluate the still pose with IK before the bake clears constraints
scene.frame_set(1)
pose(POSES[STILL])
upd()
stored_still = {b.name: (M @ b.matrix).copy() for b in pb}
rig.animation_data.action = ride_src
ride = bake('ride_src', frames, 'ride')
still = new_action('still')
scene.frame_set(1)
order = sorted(pb, key=lambda b: sum(1 for _ in iter_parents(b.name)))
for b in order:
    par = PARENT[b.name]
    if par is None:
        basis = REST[b.name].inverted() @ (M.inverted() @ stored_still[b.name])
    else:
        basis = ((M.inverted() @ stored_still[par]) @ REST[par].inverted() @ REST[b.name]).inverted() @ (M.inverted() @ stored_still[b.name])
    loc, rot, _ = basis.decompose()
    b.location, b.rotation_quaternion, b.scale = loc, rot, (1, 1, 1)
key_all(1)
key_all(2)
# both clips go on NLA tracks (the exporter writes every stashed action); the helper bones go
rig.animation_data.action = None
for act in (ride, still):
    tr = rig.animation_data.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, 1, act)
    if hasattr(st, 'action_slot') and len(act.slots):
        st.action_slot = act.slots[0]
    tr.mute = True
bpy.data.actions.remove(ride_src)
bpy.ops.object.mode_set(mode='EDIT')
for n in ('tgt_l', 'tgt_r', 'pole_l', 'pole_r'):
    rig.data.edit_bones.remove(rig.data.edit_bones[n])
bpy.ops.object.mode_set(mode='OBJECT')
for act in (ride, still):  # orphan curves of the removed helpers
    for cb, fcs in fcurves_of(act):
        for fc in fcs:
            if any(f'"{n}"' in fc.data_path for n in ('tgt_l', 'tgt_r', 'pole_l', 'pole_r')):
                cb.fcurves.remove(fc)
rig.name, body.name = 'SurferRig', 'Surfer'

print('SURFER bones final', len(rig.data.bones), 'verts', len(body.data.vertices), 'clips', [(x.name, x.frame_range[:]) for x in (ride, still)])

# ---------------------------------------------------------------- previews: each move from the channel (3/4 front) and from the beach side
if a.preview:
    import os
    os.makedirs(a.preview, exist_ok=True)
    rig.animation_data.nla_tracks[ride.name].mute = False
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 640
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.8, 0.85, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    tgt = Vector((0, 0, 0.7))
    for f, name in ((1, 'trim'), (30, 'bottom'), (69, 'top'), (86, 'pump')):
        scene.frame_set(f)
        for n, ang, up in (('front', -60, 0.25), ('side', -110, 0.15), ('back', 120, 0.35)):
            th = math.radians(ang)
            cam.location = tgt + Vector((math.cos(th), math.sin(th), up)) * 4.0
            cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = f'{a.preview}/{name}-{n}.png'
            bpy.ops.render.render(write_still=True)
    rig.animation_data.nla_tracks[ride.name].mute = True

# ---------------------------------------------------------------- export: skinned, both clips, no helpers
bpy.ops.object.select_all(action='DESELECT')
for o in (rig, body, board):
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=a.out, use_selection=True, export_apply=True, export_animations=True, export_animation_mode='ACTIONS',
                          export_nla_strips=True, export_force_sampling=True, export_frame_range=False, export_skins=True, export_def_bones=False,
                          export_optimize_animation_size=True, export_bake_animation=False)
import os  # noqa: E402
print('SURFER', a.out, round(os.path.getsize(a.out) / 1e6, 3), 'MB')
