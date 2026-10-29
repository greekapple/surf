"""Generate the Wave Scale surfer + board (sculpted, no downloaded assets).

Run:  blender -b --python scripts/blender/build_surfer.py -- public/models/wave/surfer.glb
Scene units are metres. Authoring is in three.js board space (x along the board, nose +x; y up; z across)
and converted to Blender's Z-up on creation, so the GLB (Y-up) comes out unchanged. The origin is the
board's centre at its underside. Standing height of the figure is 1.78 m (5'10"); the board is 6'0" x 19.25".

Nodes exported: board, rider (crouched surf stance), paddler (prone), each a separate root.
"""
import bpy, bmesh, sys, math
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'surfer.glb'
B = lambda p: Vector((p[0], -p[2], p[1]))  # three space -> Blender space

bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough, metal=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m
M_SUIT = mat('wetsuit', (0.012, 0.014, 0.017), 0.42)
M_PANEL = mat('wetsuit_panel', (0.05, 0.06, 0.07), 0.5)
M_SKIN = mat('skin', (0.52, 0.30, 0.20), 0.62)
M_HAIR = mat('hair', (0.05, 0.03, 0.02), 0.7)
M_BOARD = mat('board', (0.93, 0.92, 0.86), 0.18)
M_RAIL = mat('board_rail', (0.05, 0.42, 0.45), 0.2)
M_FIN = mat('fin', (0.08, 0.09, 0.1), 0.35)
M_LEASH = mat('leash', (0.02, 0.02, 0.02), 0.5)

def finish(obj, material, subsurf=0, smooth=True):
    obj.data.materials.append(material)
    if subsurf:
        m = obj.modifiers.new('sub', 'SUBSURF'); m.levels = subsurf; m.render_levels = subsurf
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    return obj

def skin_object(name, verts, edges, material, subsurf=2):
    """verts: list of (pos, (rx, rz)); edges: index pairs. Skin modifier makes the organic limb/torso volume."""
    me = bpy.data.meshes.new(name); me.from_pydata([B(p) for p, _ in verts], edges, [])
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    sk = ob.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True
    for i, (_, r) in enumerate(verts):
        me.skin_vertices[0].data[i].radius = r
    me.skin_vertices[0].data[0].use_root = True
    return finish(ob, material, subsurf)

def uvsphere(name, c, r, material, seg=24, along=None):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.location = B(c); ob.scale = (r[0], r[2], r[1])  # r given in three space (x, y, z)
    if along is not None:
        ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = Vector((1, 0, 0)).rotation_difference(B(along).normalized())
    return finish(ob, material)

# ---------------------------------------------------------------- board
def make_board():
    L, W, T = 1.83, 0.49, 0.062
    nu, nv = 56, 14
    def half(u):  # half-width in metres; u: tail (0) -> nose (1). Widest point just behind centre.
        x = (u - 0.5) * 2
        if x > 0:
            w = (1 - x ** 2.1) ** 0.62 * (1 - 0.12 * x)       # pointed nose
        else:
            w = (1 - abs(x) ** 3.2) ** 0.5 * (0.78 + 0.22 * (1 - abs(x)))  # soft squash tail
        return 0.5 * W * max(0.0, w)
    def thick(u):
        x = (u - 0.5) * 2
        return T * (1 - 0.9 * abs(x) ** 2.4) + 0.006
    def rocker(u):
        x = (u - 0.5) * 2
        return 0.16 * max(0, x) ** 2.4 + 0.045 * max(0, -x) ** 2.6
    bm = bmesh.new(); grid = []
    for i in range(nu + 1):
        u = i / nu; hw = half(u); t = thick(u); r = rocker(u); x = (u - 0.5) * L
        ring = []
        for k in range(nv * 2):
            a = math.pi * 2 * k / (nv * 2)  # around the section
            cz, cy = math.cos(a), math.sin(a)
            # rounded rail section: lower hull flatter, deck domed
            z = hw * cz
            y = r + t * 0.5 + (t * 0.5) * (cy if cy < 0 else cy * 0.9) * (1 - 0.0 * abs(cz))
            if cy < 0: y = r + t * 0.5 + t * 0.5 * cy * (0.55 + 0.45 * (1 - cz * cz))
            ring.append(bm.verts.new(B((x, y, z))))
        grid.append(ring)
    n = nv * 2
    for i in range(nu):
        for k in range(n):
            bm.faces.new([grid[i][k], grid[i + 1][k], grid[i + 1][(k + 1) % n], grid[i][(k + 1) % n]])
    for ring, rev in ((grid[0], True), (grid[-1], False)):
        bm.faces.new(list(reversed(ring)) if rev else ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('board'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('board', me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(M_BOARD); ob.data.materials.append(M_RAIL)
    for idx, p in enumerate(ob.data.polygons):
        k = idx % n
        p.use_smooth = True
        a_ = math.pi * 2 * (k + 0.5) / n
        if idx < nu * n and -0.8 < math.sin(a_) < -0.15 and abs(math.cos(a_)) > 0.45: p.material_index = 1  # rail stripe under the rail line
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 1
    # three fins (thruster), bottom of the tail
    fins = []
    for (fx, fz, h, lean) in ((-0.70, 0.17, 0.115, 0.12), (-0.70, -0.17, 0.115, -0.12), (-0.72, 0.0, 0.12, 0.0)):
        bm2 = bmesh.new()
        pts = [(0.0, 0.0, 0.0), (0.13, 0.0, 0.0), (0.02, -h, lean * h)]
        vs = [bm2.verts.new(B((fx + p[0], 0.0 + p[1], fz + p[2] + dz))) for p in pts for dz in (-0.004, 0.004)]
        bm2.faces.new([vs[0], vs[2], vs[4]]); bm2.faces.new([vs[1], vs[5], vs[3]])
        bm2.faces.new([vs[0], vs[1], vs[3], vs[2]]); bm2.faces.new([vs[2], vs[3], vs[5], vs[4]]); bm2.faces.new([vs[4], vs[5], vs[1], vs[0]])
        bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
        me2 = bpy.data.meshes.new('fin'); bm2.to_mesh(me2); bm2.free()
        f = bpy.data.objects.new('fin', me2); bpy.context.collection.objects.link(f); me2.materials.append(M_FIN); fins.append(f)
    return ob, fins

# ---------------------------------------------------------------- rider
def make_rider():
    parts = []
    deck = 0.07
    # wetsuit skeleton: (position, (rx, rz))
    V = []; E = []
    def add(p, r): V.append((p, r)); return len(V) - 1
    def link(a, b): E.append((a, b))
    pelvis = add((0.0, 0.66, -0.05), (0.165, 0.12))
    hipB = add((-0.10, 0.65, -0.02), (0.1, 0.1)); hipF = add((0.10, 0.65, -0.02), (0.1, 0.1))
    waist = add((0.01, 0.80, 0.03), (0.145, 0.108)); chest = add((0.02, 0.97, 0.13), (0.19, 0.13))
    neck = add((0.05, 1.12, 0.27), (0.052, 0.055))
    shB = add((-0.17, 1.02, 0.19), (0.075, 0.075)); shF = add((0.21, 1.04, 0.21), (0.075, 0.075))
    link(pelvis, hipB); link(pelvis, hipF); link(pelvis, waist); link(waist, chest); link(chest, neck); link(chest, shB); link(chest, shF)
    # legs (back leg, front leg): hip -> knee -> ankle -> heel/ball/toe (booties)
    for hip, kx, ax in ((hipB, -0.21, -0.32), (hipF, 0.20, 0.30)):
        knee = add((kx, 0.39, 0.30), (0.072, 0.072)); calf = add((kx * 1.07 + (0.02 if kx > 0 else -0.02), 0.25, 0.14), (0.068, 0.07))
        ankle = add((ax, deck + 0.075, 0.0), (0.036, 0.040)); ball = add((ax + (0.02 if ax > 0 else -0.02), deck + 0.03, 0.09), (0.040, 0.025)); toe = add((ax + (0.03 if ax > 0 else -0.03), deck + 0.02, 0.17), (0.036, 0.020))
        link(hip, knee); link(knee, calf); link(calf, ankle); link(ankle, ball); link(ball, toe)
    # arms
    for sh, el, wr in ((shF, (0.41, 0.90, 0.34), (0.66, 0.80, 0.46)), (shB, (-0.40, 0.93, 0.31), (-0.64, 0.86, 0.40))):
        ue = add(((V[sh][0][0] + el[0]) / 2, (V[sh][0][1] + el[1]) / 2, (V[sh][0][2] + el[2]) / 2), (0.058, 0.060))
        e = add(el, (0.047, 0.049)); w = add(wr, (0.034, 0.03))
        link(sh, ue); link(ue, e); link(e, w)
    parts.append(skin_object('rider_suit', V, E, M_SUIT, 2))
    # head (skin), hair cap, nose, ears; hands (skin)
    head = uvsphere('rider_head', (0.09, 1.25, 0.34), (0.088, 0.112, 0.098), M_SKIN, 28)
    hair = uvsphere('rider_hair', (0.085, 1.275, 0.325), (0.094, 0.108, 0.106), M_HAIR, 28)
    nose = uvsphere('rider_nose', (0.165, 1.235, 0.39), (0.016, 0.022, 0.016), M_SKIN, 12)
    ear = uvsphere('rider_ear', (0.07, 1.25, 0.32), (0.012, 0.03, 0.018), M_SKIN, 10)
    parts += [head, hair, nose, ear]
    for wr, hp, fwd in (((0.66, 0.80, 0.46), (0.715, 0.785, 0.485), (0.24, -0.08, 0.12)), ((-0.64, 0.86, 0.40), (-0.695, 0.85, 0.425), (-0.24, -0.06, 0.10))):
        parts.append(uvsphere('rider_hand', hp, (0.058, 0.02, 0.036), M_SKIN, 14, along=fwd))
        parts.append(uvsphere('rider_thumb', (hp[0], hp[1] + 0.022, hp[2] + 0.012), (0.03, 0.012, 0.011), M_SKIN, 8, along=fwd))
    # neck skin visible between suit collar and jaw
    parts.append(uvsphere('rider_neck', (0.07, 1.16, 0.30), (0.04, 0.05, 0.043), M_SKIN, 12))
    # leash: ankle cuff + cord to the tail
    cu = bpy.data.curves.new('leash', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.004
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
    pts = [(-0.32, deck + 0.09, 0.0), (-0.62, 0.05, -0.16), (-0.92, 0.07, 0.0)]
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = B(p); bp.handle_left_type = bp.handle_right_type = 'AUTO'
    lo = bpy.data.objects.new('leash', cu); bpy.context.collection.objects.link(lo); cu.materials.append(M_LEASH)
    parts.append(lo)
    return parts

def make_paddler():
    parts = []; V = []; E = []
    def add(p, r): V.append((p, r)); return len(V) - 1
    def link(a, b): E.append((a, b))
    d = 0.075
    pelvis = add((-0.30, d + 0.10, 0.0), (0.150, 0.095)); waist = add((-0.04, d + 0.115, 0.0), (0.135, 0.092)); chest = add((0.20, d + 0.14, 0.0), (0.170, 0.108))
    neck = add((0.42, d + 0.20, 0.0), (0.055, 0.055))
    link(pelvis, waist); link(waist, chest); link(chest, neck)
    for s in (1, -1):
        hip = add((-0.31, d + 0.09, 0.09 * s), (0.1, 0.1)); knee = add((-0.62, d + 0.07, 0.10 * s), (0.065, 0.062)); ankle = add((-0.94, d + 0.05, 0.10 * s), (0.04, 0.04)); toe = add((-1.03, d + 0.03, 0.10 * s), (0.035, 0.02))
        link(pelvis, hip); link(hip, knee); link(knee, ankle); link(ankle, toe)
    sh1 = add((0.28, d + 0.17, 0.19), (0.062, 0.062)); sh2 = add((0.22, d + 0.17, -0.19), (0.062, 0.062)); link(chest, sh1); link(chest, sh2)
    e1 = add((0.46, d + 0.20, 0.34), (0.044, 0.045)); w1 = add((0.70, d + 0.03, 0.31), (0.03, 0.028)); link(sh1, e1); link(e1, w1)
    e2 = add((0.04, d + 0.17, -0.37), (0.044, 0.045)); w2 = add((-0.20, d + 0.04, -0.40), (0.03, 0.028)); link(sh2, e2); link(e2, w2)
    ob = skin_object('paddler_suit', V, E, M_SUIT, 2); ob.name = 'paddler_suit'; parts.append(ob)
    parts += [uvsphere('paddler_head', (0.55, d + 0.33, 0.0), (0.098, 0.112, 0.088), M_SKIN, 28), uvsphere('paddler_hair', (0.54, d + 0.35, 0.0), (0.103, 0.108, 0.094), M_HAIR, 28),
              uvsphere('paddler_nose', (0.64, d + 0.33, 0.0), (0.02, 0.02, 0.016), M_SKIN, 10),
              uvsphere('paddler_hand1', (0.745, d + 0.02, 0.315), (0.06, 0.022, 0.04), M_SKIN, 14, along=(1, -0.2, 0)), uvsphere('paddler_hand2', (-0.245, d + 0.03, -0.405), (0.06, 0.022, 0.04), M_SKIN, 14, along=(-1, 0, 0)),
              uvsphere('paddler_neck', (0.46, d + 0.23, 0.0), (0.045, 0.045, 0.043), M_SKIN, 12)]
    return parts

board, fins = make_board()
rider = make_rider()
paddler = make_paddler()

def group(name, objs):
    e = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(e)
    for o in objs: o.parent = e
    return e
group('board', [board] + fins); group('rider', rider); group('paddler', paddler)

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
print('EXPORTED', out)
