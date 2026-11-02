"""SWELLO surfer v2 (T-062, user decision 2026-11-02: MPFB2 human, CC0): a rigged MakeHuman body posed in a goofy-foot frontside
bottom turn on a procedural 6'0" shortboard, black full wetsuit. Replaces the AI surfer, which faced the board's nose.

Run (MPFB is a user extension, so NOT --factory-startup):
  blender -b --python tools/blender/build_surfer.py -- --out tools/blender/assets/surfer-v2.glb [--preview DIR] [--board 1.83]

Frame of the exported model (Blender, z-up; glTF converts to y-up): board along x with the NOSE AT -X, the surfer faces -Y (toward
the wave), the board's bottom at z = 0, true scale (standing height 1.75 m). wave_scene.py --surfer-v2 places it without rescaling.
"""
import argparse
import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='tools/blender/assets/surfer-v2.glb')
ap.add_argument('--preview', default='')
ap.add_argument('--board', type=float, default=1.83, help='board length in metres (6\'0" = 1.83)')
ap.add_argument('--height', type=float, default=1.75)
a = ap.parse_args(argv)

from bl_ext.blender_org.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.blender_org.mpfb.services.targetservice import TargetService  # noqa: E402

bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- body
macro = TargetService.get_default_macro_info_dict()
macro.update({'gender': 1.0, 'age': 0.45, 'muscle': 0.68, 'weight': 0.42, 'proportions': 0.6})
body = HumanService.create_human(macro_detail_dict=macro)
rig = HumanService.add_builtin_rig(body, 'game_engine')
bpy.context.view_layer.update()
k = a.height / body.dimensions.z  # true standing height
rig.scale = (k, k, k)
bpy.context.view_layer.update()

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

# ---------------------------------------------------------------- pose: goofy frontside bottom turn (right foot forward, toward -x)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
pb = rig.pose.bones
M = rig.matrix_world


def world_head(n):
    return M @ pb[n].head


def ik_target(name, loc):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    scene.collection.objects.link(e)
    return e


FRONT_X, BACK_X = -0.26 * L / 1.83, 0.31 * L / 1.83   # front foot near the middle, back foot over the tail pad
ankle = (M @ pb['foot_r'].head).z                   # ankle height above the sole in rest pose
# pelvis: drop into the crouch, sit back over the tail a little, hips open toward the nose
p0 = M @ pb['pelvis'].head
crouch = 0.6 * k
pb['pelvis'].location = (0, 0, 0)
rig.pose.bones['Root'].location = (0, 0, 0)
bpy.context.view_layer.update()


def rot_world(name, axis, deg):
    """Rotate a pose bone about a world axis through its head (children follow)."""
    b = pb[name]
    bpy.context.view_layer.update()
    mw = M @ b.matrix
    head = mw.to_translation()
    R = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, Vector(axis)) @ Matrix.Translation(-head)
    b.matrix = M.inverted() @ (R @ mw)
    bpy.context.view_layer.update()


def aim(name, direction, twist=0.0):
    """Turn a bone so it points along `direction` (world), optionally twisting about its own axis."""
    b = pb[name]
    bpy.context.view_layer.update()
    mw = M @ b.matrix
    cur = (M @ b.tail - M @ b.head).normalized()
    q = cur.rotation_difference(Vector(direction).normalized())
    head = mw.to_translation()
    R = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head)
    b.matrix = M.inverted() @ (R @ mw)
    bpy.context.view_layer.update()
    if twist:
        axis = (M @ b.tail - M @ b.head).normalized()
        rot_world(name, axis, twist)


# whole body: lower the root so the hips sit at crouch height, shifted slightly toward the tail
dz = crouch - p0.z
rig.location = (0.03, 0.02, rig.location.z + dz)
bpy.context.view_layer.update()
# hips open ~20° toward the nose (frontside: chest to the wave, shoulders down the line)
rot_world('pelvis', (0, 0, 1), -18)
# legs by IK onto the deck
for side, fx in (('r', FRONT_X), ('l', BACK_X)):
    tgt = ik_target(f'foot_{side}_tgt', (fx, -0.02, deck_z(fx) + ankle))
    pole = ik_target(f'knee_{side}_pole', (fx * 1.9, -1.0, 0.5))  # knees over the toes and apart, not caving in
    c = pb[f'calf_{side}'].constraints.new('IK')
    c.target, c.pole_target, c.chain_count, c.pole_angle = tgt, pole, 2, math.radians(-90)
bpy.context.view_layer.update()
# feet across the stringer (toes toward the wave), front foot angled ~15° toward the nose, flat on the deck
for side, yaw in (('r', 15), ('l', -5)):
    f = pb[f'foot_{side}']
    c = f.constraints.new('COPY_ROTATION')
    holder = ik_target(f'foot_{side}_rot', (0, 0, 0))
    holder.rotation_euler = (0, 0, math.radians(yaw))
    c.target = holder
    c.mix_mode = 'BEFORE'
    c.target_space = c.owner_space = 'WORLD'
    c.influence = 0.85
# torso: lean toward the wave and forward, chest twisted down the line
aim('spine_01', (-0.05, -0.45, 1.0))
aim('spine_02', (-0.08, -0.55, 1.0))
aim('spine_03', (-0.10, -0.45, 1.0), twist=-14)
aim('neck_01', (-0.05, -0.15, 1.0))
aim('head', (0.0, -0.05, 1.0), twist=-55)  # looking down the line (toward the nose)
# arms: front (right) arm reaching down the line, back (left) arm low and slightly behind, both relaxed at the elbow
aim('upperarm_r', (-0.82, -0.38, -0.30))
aim('lowerarm_r', (-0.88, -0.30, -0.05))
aim('hand_r', (-0.9, -0.2, -0.2))
aim('upperarm_l', (0.38, -0.45, -0.80))
aim('lowerarm_l', (0.15, -0.75, -0.45))
aim('hand_l', (0.1, -0.8, -0.5))
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()

# ---------------------------------------------------------------- materials


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
deck = mat('Board', (0.93, 0.93, 0.9), 0.28)
pad = mat('Pad', (0.03, 0.03, 0.03), 0.8)
for m_ in (suit, skin, hair):
    body.data.materials.append(m_)
board.data.materials.append(deck)
board.data.materials.append(pad)

# wetsuit everywhere except head, hands and feet (by the rig's weights); hair on the top/back of the scalp
SKIN_BONES = {'head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'}
SKIN_BONES |= {b.name for b in rig.data.bones if any(s in b.name for s in ('index', 'middle', 'pinky', 'ring', 'thumb'))}
gi = {g.index: g.name for g in body.vertex_groups}
skin_w = []
for v in body.data.vertices:
    w = sum(g.weight for g in v.groups if gi.get(g.group) in SKIN_BONES)
    skin_w.append(w)
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

# ---------------------------------------------------------------- bake the pose and export
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
if body.data.shape_keys:
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)  # bake the MPFB body targets first
for mod in list(body.modifiers):
    if mod.type in ('ARMATURE', 'MASK'):
        bpy.ops.object.modifier_apply(modifier=mod.name)
body.parent = None
body.matrix_world = Matrix.Identity(4) if body.matrix_world == Matrix.Identity(4) else body.matrix_world
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.data.objects.remove(rig, do_unlink=True)
for o in list(scene.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o, do_unlink=True)
body.name = 'Surfer'
# sole of the feet on the deck: drop/raise the body so its lowest point sits on the board top under the feet
low = min((body.matrix_world @ v.co).z for v in body.data.vertices)
body.location.z += deck_z(BACK_X) - low + 0.004
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.ops.object.transform_apply(location=True)
zs = [v.co.z for v in body.data.vertices]
print('SURFER height crouched', round(max(zs) - min(zs), 3), 'standing', a.height, 'board', L, 'x', W)

if a.preview:
    import os
    os.makedirs(a.preview, exist_ok=True)
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
    tgt = Vector((0, 0, 0.75))
    for n, ang in (('front', -90), ('nose', 180), ('back', 90), ('tail', 0), ('q', -50)):
        th = math.radians(ang)
        cam.location = tgt + Vector((math.cos(th), math.sin(th), 0.18)) * 4.2
        cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{a.preview}/{n}.png'
        bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=a.out, use_selection=True, export_apply=True)
print('SURFER', a.out)
