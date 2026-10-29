"""Generate the Wave Scale surfer + board (procedural, no downloaded assets).

Run:  blender -b --python scripts/blender/build_surfer.py -- public/models/wave/surfer.glb
Scene units are metres. Authoring is in three.js board space (x along the board, nose +x; y up; z across)
and converted to Blender's Z-up on creation, so the GLB (Y-up) comes out unchanged. The origin is the
board's centre at its underside. Standing height of the figure is 1.78 m (5'10"); the board is 6'0" x 19.25".

Nodes exported: board, rider (crouched surf stance), paddler (prone), each a separate root.
rider/paddler roots sit on the deck (y = 0.07); their children are local to the soles/belly (y = 0).
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

# ---------------------------------------------------------------- human figure
# Anatomical build: every body part is a lofted tube with its own elliptical cross-section (a = half-width,
# b = half-depth), resampled with Catmull-Rom so no subdivision is needed and seams can ride the exact surface.
# Proportions follow a 1.78 m adult (head height 0.237 m = 1/7.5), limbs from standard anthropometry.
# Rider/paddler coordinates are local to the deck contact point (soles at y = 0); the parent empty sits on the deck.
M_SKIN = mat('skin', (0.50, 0.29, 0.20), 0.55)
M_LIP = mat('lips', (0.36, 0.14, 0.12), 0.45)
M_SCLERA = mat('sclera', (0.75, 0.72, 0.68), 0.3)
M_IRIS = mat('iris', (0.05, 0.03, 0.02), 0.25)
M_HAIR = mat('hair', (0.045, 0.028, 0.017), 0.5)
M_SEAM = mat('wetsuit_seam', (0.055, 0.060, 0.068), 0.6)
M_PAD = mat('wetsuit_pad', (0.045, 0.05, 0.058), 0.7)
M_ZIP = mat('wetsuit_zip', (0.30, 0.31, 0.32), 0.35, metal=0.6)
for _m in (M_SUIT, M_PANEL):  # wet neoprene: a soft clear-coat sheen
    b = _m.node_tree.nodes['Principled BSDF']; b.inputs['Coat Weight'].default_value = 0.35; b.inputs['Coat Roughness'].default_value = 0.28

V3 = lambda x, y, z: Vector((x, y, z))
UPV = V3(0, 1, 0)
def lerp(a, b, t): return a + (b - a) * t
def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

class Mesh:
    """bmesh wrapper working in three.js space (converted with B on creation)."""
    def __init__(self): self.bm = bmesh.new()
    def v(self, p): return self.bm.verts.new(B(p))
    def build(self, name, material, smooth=True):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
        me.materials.append(material)
        for p in me.polygons: p.use_smooth = smooth
        return ob

def node(p, a, b, fh=None): return {'p': Vector(p), 'a': a, 'b': b, 'fh': Vector(fh) if fh is not None else None}

def resample(nodes, per):
    out = []; n = len(nodes)
    for i in range(n - 1):
        p0, p1, p2, p3 = nodes[max(i - 1, 0)], nodes[i], nodes[i + 1], nodes[min(i + 2, n - 1)]
        for s in range(per):
            t = s / per; t2, t3 = t * t, t * t * t
            pos = 0.5 * ((2 * p1['p']) + (-p0['p'] + p2['p']) * t + (2 * p0['p'] - 5 * p1['p'] + 4 * p2['p'] - p3['p']) * t2 + (-p0['p'] + 3 * p1['p'] - 3 * p2['p'] + p3['p']) * t3)
            e = t * t * (3 - 2 * t)
            f1 = p1['fh'] if p1['fh'] is not None else p2['fh']; f2 = p2['fh'] if p2['fh'] is not None else p1['fh']
            out.append({'p': pos, 'a': lerp(p1['a'], p2['a'], e), 'b': lerp(p1['b'], p2['b'], e), 'fh': (f1.lerp(f2, e) if f1 is not None else None)})
    out.append(nodes[-1]); return out

def loft(name, nodes, material, fh=(0, 0, 1), n=24, per=5, cap=(True, True)):
    """Tube through `nodes`. fh: default direction the cross-section's depth (b) axis faces. Returns (object, rings)."""
    pts = resample(nodes, per); M = Mesh(); rings = []
    for i, q in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)]['p'] - pts[max(i - 1, 0)]['p']).normalized()
        h = (q['fh'] if q['fh'] is not None else Vector(fh)).normalized()
        s = t.cross(h)
        if s.length < 1e-4: s = t.cross(V3(1, 0, 0.01))
        s.normalize(); f = s.cross(t).normalized()
        ring = []
        for k in range(n):
            th = 2 * math.pi * k / n
            ring.append(M.v(q['p'] + s * (q['a'] * math.cos(th)) + f * (q['b'] * math.sin(th))))
        rings.append((ring, q['p'].copy(), s.copy(), f.copy(), q['a'], q['b']))
    for i in range(len(rings) - 1):
        for k in range(n): M.bm.faces.new([rings[i][0][k], rings[i][0][(k + 1) % n], rings[i + 1][0][(k + 1) % n], rings[i + 1][0][k]])
    for (ring, c, *_), on in ((rings[0], cap[0]), (rings[-1], cap[1])):
        if on:
            cv = M.v(c)
            for k in range(n): M.bm.faces.new([ring[(k + 1) % n], ring[k], cv])
    return M.build(name, material), rings

def surf_pt(rings, i, th, lift=0.0):
    """Point on the lofted surface at ring i, angle th (0 = +side, pi/2 = +front), pushed out by `lift`."""
    _, c, s, f, a, b = rings[i]
    d = s * (a * math.cos(th)) + f * (b * math.sin(th))
    return c + d + d.normalized() * lift

def tube(name, pts, radius, material, taper=1.0):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 1; cu.resolution_u = 3
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for pt, p in zip(sp.points, pts): pt.co = (*B(p), 1)
    cu.materials.append(material)
    ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob); return ob

def ellipsoid(name, c, radii, material, basis=None, seg=16):
    """radii along (R, U, F) basis vectors given in three space."""
    M = Mesh(); R, U, F = basis if basis else (V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1))
    tmp = bmesh.new(); bmesh.ops.create_uvsphere(tmp, u_segments=seg, v_segments=seg // 2, radius=1.0)
    vm = {}
    for v in tmp.verts: vm[v] = M.v(c + R * (v.co.x * radii[0]) + F * (v.co.y * radii[2]) + U * (v.co.z * radii[1]))
    for f in tmp.faces: M.bm.faces.new([vm[v] for v in f.verts])
    tmp.free(); return M.build(name, material)

def ik(A, H, l1, l2, pole):
    """Two-bone IK: joint between A (start) and H (end) with segment lengths l1 (A->joint) and l2 (joint->H); bends toward `pole`."""
    d = H - A; dist = min(d.length, l1 + l2 - 1e-3); dn = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist); h = math.sqrt(max(l1 * l1 - a * a, 0))
    pp = Vector(pole) - dn * Vector(pole).dot(dn); pp.normalize()
    return A + dn * a + pp * h

def rot_y(v, deg):
    r = math.radians(deg); return V3(v.x * math.cos(r) + v.z * math.sin(r), v.y, -v.x * math.sin(r) + v.z * math.cos(r))

# ---- head
def make_head(prefix, c, fwd, noseless=False):
    """Skull, jaw, brow, nose, lips, eyes, ears and short wet hair. c = skull centre, fwd = direction the face looks."""
    F = Vector(fwd).normalized(); U = (UPV - F * UPV.dot(F)).normalized(); R = U.cross(F)  # local x=R, y=U, z=F
    hw, hh, hd = 0.0765, 0.1185, 0.0950  # head height 2*hh = 0.237 m = 1.78 / 7.5
    W = lambda x, y, z: c + R * x + U * y + F * z
    def sculpt(ux, uy, uz, detail=True):
        x, y, z = ux * hw, uy * hh, uz * hd
        if uy < 0:
            t = -uy; x *= 1 - 0.30 * t ** 1.4; z *= 1 - 0.10 * t
            if uz > 0 and uy < -0.55: z += 0.007 * sstep(-0.55, -0.95, uy) * uz  # chin
        if uz < 0 and uy > -0.2: z *= 1.07  # occiput
        if detail and uz > 0:
            g = lambda c0, w: math.exp(-((uy - c0) / w) ** 2)
            ex = math.exp(-((abs(ux) - 0.45) / 0.2) ** 2)
            z += 0.0055 * g(0.20, 0.13) * uz ** 2          # brow ridge
            z -= 0.0055 * g(0.02, 0.12) * ex * uz ** 2     # eye sockets
            z += 0.0035 * g(-0.28, 0.18) * math.exp(-((abs(ux) - 0.55) / 0.22) ** 2) * uz  # cheeks
            z -= 0.0030 * g(-0.70, 0.045) * uz ** 3 * math.exp(-(ux / 0.55) ** 2)         # mouth line
            z += 0.0030 * g(-0.84, 0.10) * uz ** 2 * math.exp(-(ux / 0.35) ** 2)          # chin pad
        return x, y, z
    def sphere(seg_u=44, seg_v=30):
        tmp = bmesh.new(); bmesh.ops.create_uvsphere(tmp, u_segments=seg_u, v_segments=seg_v, radius=1.0); return tmp
    # skull
    M = Mesh(); tmp = sphere(); vm = {}
    for v in tmp.verts: vm[v] = M.v(W(*sculpt(v.co.x, v.co.z, v.co.y)))
    for f in tmp.faces: M.bm.faces.new([vm[v] for v in f.verts])
    tmp.free(); parts = [M.build(prefix + '_head', M_SKIN)]
    # hair: shell above a hairline that dips at the nape, with clumped strands
    M = Mesh(); tmp = sphere(); vm = {}
    for v in tmp.verts:
        ux, uy, uz = v.co.x, v.co.z, v.co.y
        x, y, z = sculpt(ux, uy, uz, False)
        n = Vector((x / hw ** 2, y / hh ** 2, z / hd ** 2)).normalized()
        clump = math.sin(13 * math.atan2(ux, uz) + 5 * uy) * math.sin(9 * uy + 3 * ux)
        m = uy - (-0.38 + 0.95 * sstep(-0.75, 0.55, uz))  # height above the hairline; hair sinks under the skin there
        off = -0.0035 + (0.0095 + 0.0035 * clump + 0.004 * max(uy, 0) ** 2) * sstep(-0.02, 0.16, m)
        vm[v] = M.v(W(x + n.x * off, y + n.y * off, z + n.z * off))
    for f in tmp.faces:
        cx = sum(v.co.x for v in f.verts) / len(f.verts); cy = sum(v.co.z for v in f.verts) / len(f.verts); cz = sum(v.co.y for v in f.verts) / len(f.verts)
        if cy > -0.38 + 0.95 * sstep(-0.75, 0.55, cz) - 0.12 and not (abs(cx) > 0.8 and -0.2 < cy < 0.3 and cz > -0.3):
            M.bm.faces.new([vm[v] for v in f.verts])
    for v in [v for v in M.bm.verts if not v.link_faces]: M.bm.verts.remove(v)
    tmp.free(); parts.append(M.build(prefix + '_hair', M_HAIR))
    # nose, eyes, brows, lips, ears
    if not noseless:
        nb = [node(W(0, 0.006, 0.081), 0.0075, 0.007), node(W(0, -0.020, 0.090), 0.0098, 0.0092), node(W(0, -0.043, 0.0975), 0.0145, 0.0115)]
        parts.append(loft(prefix + '_nose', [dict(n, fh=F) for n in nb], M_SKIN, fh=F, n=12, per=4)[0])
        for s in (-1, 1): parts.append(ellipsoid(prefix + '_nostril', W(0.0125 * s, -0.043, 0.091), (0.0075, 0.0068, 0.0082), M_SKIN, (R, U, F), 10))
    for s in (-1, 1):
        parts.append(ellipsoid(prefix + '_eye', W(0.031 * s, 0.004, 0.0745), (0.0112, 0.0092, 0.0112), M_SCLERA, (R, U, F), 12))
        parts.append(ellipsoid(prefix + '_iris', W(0.031 * s + 0.0008 * s, 0.003, 0.0845), (0.0052, 0.0052, 0.0022), M_IRIS, (R, U, F), 10))
        parts.append(ellipsoid(prefix + '_lid', W(0.031 * s, 0.0105, 0.0738), (0.0128, 0.0042, 0.0118), M_SKIN, (R, U, F), 12))
        brow = [W(0.014 * s, 0.025, 0.085), W(0.034 * s, 0.031, 0.0825), W(0.056 * s, 0.032, 0.071)]
        parts.append(tube(prefix + '_brow', brow, 0.0033, M_HAIR))
        parts.append(ellipsoid(prefix + '_ear', W(0.0745 * s, -0.012, -0.004), (0.0065, 0.0305, 0.0195), M_SKIN, (R, U, F), 12))
    parts.append(ellipsoid(prefix + '_lip_up', W(0, -0.0745, 0.0845), (0.0185, 0.0045, 0.0065), M_LIP, (R, U, F), 12))
    parts.append(ellipsoid(prefix + '_lip_lo', W(0, -0.0905, 0.0815), (0.0155, 0.0048, 0.0065), M_LIP, (R, U, F), 12))
    return parts

# ---- hand
def make_hand(prefix, wrist, D, palmN, thumb_sign, curl=1.0, spread=1.0):
    """Palm + four fingers (three phalanges each) + two-bone thumb. D = fingers' direction, palmN = palm normal."""
    D = Vector(D).normalized(); N = (Vector(palmN) - D * Vector(palmN).dot(D)).normalized(); T = N.cross(D) * thumb_sign  # T: toward the thumb
    P = lambda u, s=0.0, h=0.0: Vector(wrist) + D * u + T * s + N * h
    parts = []
    parts.append(loft(prefix + '_palm', [node(P(-0.01), 0.027, 0.0125, N), node(P(0.045), 0.0355, 0.0125, N), node(P(0.092), 0.0385, 0.0105, N)], M_SKIN, fh=N, n=12, per=3)[0])
    lens = (0.068, 0.076, 0.071, 0.057); rad = (0.0088, 0.0090, 0.0083, 0.0072)
    for i in range(4):
        s0 = 0.0285 - 0.019 * i; ang = (0.10 - 0.07 * i) * spread
        d = (D * math.cos(ang) + T * math.sin(ang)).normalized(); p = P(0.094, s0, -0.001); ns = []
        bend = (0.16, 0.30, 0.22)
        for j in range(3):
            ns.append(node(p, rad[i] * (1 - 0.1 * j), rad[i] * (1 - 0.1 * j) * 0.92, N))
            seg = lens[i] * (0.42, 0.33, 0.25)[j]
            dd = (d * math.cos(bend[j] * curl) + N * math.sin(bend[j] * curl)).normalized(); d = dd
            p = p + dd * seg
        ns.append(node(p, rad[i] * 0.62, rad[i] * 0.58, N))
        parts.append(loft(prefix + '_finger%d' % i, ns, M_SKIN, fh=N, n=8, per=3)[0])
    d = (D * math.cos(0.75) + T * math.sin(0.75) + N * 0.25).normalized(); p = P(0.022, 0.03, 0.0); ns = []
    for j, (seg, r) in enumerate(((0.040, 0.0125), (0.032, 0.0098), (0.026, 0.0086))):
        ns.append(node(p, r, r * 0.92, N)); p = p + d * seg; d = (d * math.cos(0.18) + D * math.sin(0.18) + N * 0.10).normalized()
    ns.append(node(p, 0.0066, 0.0062, N))
    parts.append(loft(prefix + '_thumb', ns, M_SKIN, fh=N, n=8, per=3)[0])
    return parts

# ---- foot (neoprene bootie)
def make_foot(prefix, A, t, sole_y=0.0):
    t = Vector(t).normalized(); t.y = 0; t.normalize(); S = t.cross(UPV)
    P = lambda u, h: V3(A.x, 0, A.z) + t * u + UPV * h
    ns = [node(P(-0.062, 0.043), 0.036, 0.043, UPV), node(P(0.0, 0.038), 0.042, 0.036, UPV), node(P(0.07, 0.030), 0.046, 0.030, UPV),
          node(P(0.15, 0.024), 0.049, 0.024, UPV), node(P(0.215, 0.019), 0.041, 0.019, UPV), node(P(0.245, 0.016), 0.022, 0.014, UPV)]
    return loft(prefix, ns, M_SUIT, fh=UPV, n=16, per=4)[0]

# ---- the surfer: low, compressed stance
def make_rider():
    parts = []; seams = []
    # feet and pelvis
    Ab = V3(-0.30, 0.088, -0.040); tb = V3(0.15, 0, 0.99)   # back foot: across the board
    Af = V3(0.30, 0.088, -0.020); tf = V3(0.66, 0, 0.75)    # front foot: angled toward the nose
    P = V3(0.0, 0.70, -0.01); ψp = 18
    Fp = rot_y(V3(0, 0, 1), ψp); Lp = rot_y(V3(1, 0, 0), ψp)  # pelvis facing / lateral (toward +x)
    hipB = P - Lp * 0.098; hipF = P + Lp * 0.098
    legs = {}
    for nm, A, H, t in (('back', Ab, hipB, tb), ('front', Af, hipF, tf)):
        K = ik(A, H, 0.425, 0.435, t.normalized() + V3(0, 0.0, 0)); legs[nm] = K
        fhk = (K - (A + H) / 2).normalized()
        ns = [node(A, 0.040, 0.044, fhk), node(lerp(A, K, 0.30) + fhk * 0.006, 0.050, 0.056, fhk), node(lerp(A, K, 0.45) + fhk * 0.008, 0.055, 0.060, fhk),
              node(lerp(A, K, 0.85), 0.050, 0.052, fhk), node(K, 0.056, 0.058, fhk), node(lerp(K, H, 0.30), 0.074, 0.078, fhk),
              node(lerp(K, H, 0.65), 0.088, 0.092, fhk), node(H + (H - K).normalized() * 0.02, 0.092, 0.096, fhk)]
        o, rings = loft('rider_leg_' + nm, ns, M_SUIT, fh=fhk, n=24, per=5)
        parts.append(o)
        # knee pad, outer-leg seam and calf seam
        fk = (t.normalized() + fhk).normalized()
        parts.append(ellipsoid('rider_kneepad_' + nm, K + fhk * 0.056, (0.040, 0.050, 0.010), M_PAD, (Lp, (K - A).normalized(), fhk), 14))
        for th in (0.0, math.pi):
            seams.append([surf_pt(rings, i, th, 0.0015) for i in range(0, len(rings), 2)])
        parts.append(make_foot('rider_foot_' + nm, A, t))
        parts.append(ellipsoid('rider_ankle_' + nm, A, (0.040, 0.044, 0.042), M_SUIT, None, 12))
    # torso: pelvis -> neck base, leaning forward and twisting to look down the line
    lean = math.radians(24); sdir = V3(0.02, math.cos(lean), math.sin(lean)).normalized(); L = 0.545
    Nb = P + sdir * L
    def fr(u): return rot_y(V3(0, 0, 1), lerp(18, 52, u))
    def tp(u): return P + sdir * (L * u) + (V3(0, 0, 0.01) if 0.2 < u < 0.7 else V3(0, 0, 0))
    tn = [node(tp(-0.10), 0.115, 0.090, fr(0)), node(tp(0.0), 0.168, 0.108, fr(0)), node(tp(0.17), 0.146, 0.098, fr(0.15)),
          node(tp(0.40), 0.162, 0.116, fr(0.4)), node(tp(0.66), 0.188, 0.135, fr(0.7)), node(tp(0.86), 0.198, 0.112, fr(0.95)),
          node(tp(0.95), 0.150, 0.088, fr(1)), node(tp(1.03), 0.066, 0.074, fr(1))]
    torso, trings = loft('rider_torso', tn, M_SUIT, fh=fr(0.5), n=28, per=5)
    parts.append(torso)
    n = 28
    for th in (0.0, math.pi):  # side seams, waist to armpit
        seams.append([surf_pt(trings, i, th, 0.0015) for i in range(7, 34, 2)])
    seams.append([surf_pt(trings, i, -math.pi / 2, 0.0015) for i in range(8, 34, 2)])  # centre-back zip line
    for s in (-1, 1):  # chest panel lines, shoulder to sternum
        seams.append([surf_pt(trings, i, math.pi / 2 - s * (0.55 + 0.5 * (i - 18) / 16.0), 0.0015) for i in range(18, 34, 2)])
    seams.append([surf_pt(trings, 10, th, 0.0015) for th in [2 * math.pi * k / 28 for k in range(29)]])  # lower waist panel line
    # shoulders / sleeves
    Lc = rot_y(V3(1, 0, 0), 52); Fc = rot_y(V3(0, 0, 1), 52)
    Sf = Nb + Lc * 0.178 - UPV * 0.046 - Fc * 0.01; Sb = Nb - Lc * 0.178 - UPV * 0.046 - Fc * 0.01
    arms = {}
    for nm, S, W, pole, sgn in (('front', Sf, Sf + V3(0.50, -0.18, 0.20), V3(0, -1, 0.25), 1), ('back', Sb, Sb + V3(-0.44, -0.22, 0.14), V3(0, -1, 0.35), -1)):
        E = ik(S, W, 0.315, 0.275, pole); arms[nm] = (S, E, W)
        fhs = (E - (S + W) / 2).normalized()
        an = [node(S - (E - S).normalized() * 0.01, 0.056, 0.058, fhs), node(lerp(S, E, 0.4), 0.052, 0.054, fhs), node(E, 0.043, 0.045, fhs), node(lerp(E, W, 0.4), 0.044, 0.046, fhs),
              node(lerp(E, W, 0.92), 0.033, 0.034, fhs), node(W + (W - E).normalized() * 0.006, 0.0345, 0.0345, fhs)]
        o, rings = loft('rider_arm_' + nm, an, M_SUIT, fh=fhs, n=20, per=5); parts.append(o)
        seams.append([surf_pt(rings, i, -math.pi / 2, 0.0014) for i in range(0, len(rings), 2)])
        parts.append(ellipsoid('rider_delt_' + nm, S + (S - Nb).normalized() * 0.004, (0.053, 0.058, 0.052), M_SUIT, None, 14))
        D = (W - E).normalized(); D = (D - UPV * 0.18).normalized()
        parts += make_hand('rider_hand_' + nm, W + D * 0.004, D, V3(0, -1, 0) + (V3(0.2, 0, 0.3) if sgn > 0 else V3(-0.2, 0, 0.3)), thumb_sign=1 if sgn > 0 else -1, curl=0.9, spread=1.2)
    # neck + head: up, looking down the line (+x)
    head_c = Nb + V3(0.035, 0.160, 0.040)
    Fh = V3(0.86, -0.04, 0.50)
    parts.append(loft('rider_neck', [node(Nb - UPV * 0.01, 0.058, 0.060, Fh), node(Nb + V3(0.012, 0.045, 0.014), 0.056, 0.058, Fh), node(head_c + V3(-0.008, -0.085, -0.01), 0.054, 0.056, Fh)], M_SKIN, fh=Fh, n=16, per=4)[0])
    parts.append(loft('rider_collar', [node(Nb - UPV * 0.01, 0.070, 0.072, Fh), node(Nb + V3(0.006, 0.030, 0.008), 0.064, 0.066, Fh)], M_SUIT, fh=Fh, n=20, per=3)[0])
    parts += make_head('rider', head_c, Fh)
    # seams as thin raised tubes; zip pull
    for i, s in enumerate(seams): parts.append(tube('rider_seam%d' % i, s, 0.0021, M_SEAM))
    zs = [surf_pt(trings, i, -math.pi / 2, 0.0035) for i in range(26, 34)]
    parts.append(tube('rider_zip', zs, 0.0042, M_ZIP))
    # leash: ankle cuff + cord to the tail (board tail deck is ~0.02 below the soles' origin)
    cu = bpy.data.curves.new('leash', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.004
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
    for bp, p in zip(sp.bezier_points, [(-0.30, 0.095, -0.045), (-0.62, -0.01, -0.17), (-0.92, -0.015, 0.0)]):
        bp.co = B(p); bp.handle_left_type = bp.handle_right_type = 'AUTO'
    lo = bpy.data.objects.new('leash', cu); bpy.context.collection.objects.link(lo); cu.materials.append(M_LEASH)
    parts.append(lo)
    parts.append(ellipsoid('leash_cuff', Ab + V3(0, 0.0, 0), (0.046, 0.030, 0.046), M_LEASH, None, 12))
    return parts

# ---- prone paddler (head up, arms in a stroke, legs together)
def make_paddler():
    parts = []; seams = []
    pelvis = V3(-0.30, 0.095, 0.0); chest = V3(0.18, 0.125, 0.0); nb = V3(0.40, 0.175, 0.0)
    DN = V3(0, 1, 0)
    tn = [node(V3(-0.43, 0.082, 0), 0.115, 0.082, DN), node(pelvis, 0.160, 0.095, DN), node(V3(-0.08, 0.098, 0), 0.140, 0.092, DN), node(V3(0.07, 0.112, 0), 0.158, 0.104, DN),
          node(chest, 0.176, 0.112, DN), node(V3(0.31, 0.138, 0), 0.155, 0.096, DN), node(nb + V3(-0.01, 0.0, 0), 0.075, 0.075, DN)]
    torso, tr = loft('paddler_torso', tn, M_SUIT, fh=DN, n=26, per=5); parts.append(torso)
    for th in (0.0, math.pi): seams.append([surf_pt(tr, i, th, 0.0015) for i in range(3, 27, 2)])
    seams.append([surf_pt(tr, i, math.pi / 2, 0.0015) for i in range(6, 26, 2)])  # centre-back zip line (belly down: back is up)
    for s in (-1, 1):
        d = 0.092 * s
        ns = [node(V3(-0.33, 0.092, d), 0.090, 0.085, DN), node(V3(-0.50, 0.085, d * 1.05), 0.078, 0.073, DN), node(V3(-0.66, 0.075, d * 1.05), 0.056, 0.058, DN),
              node(V3(-0.80, 0.078, d), 0.058, 0.062, DN), node(V3(-0.96, 0.080, d * 0.95), 0.040, 0.044, DN)]
        o, rr = loft('paddler_leg%d' % s, ns, M_SUIT, fh=DN, n=18, per=5); parts.append(o)
        seams.append([surf_pt(rr, i, math.pi, 0.0014) if s > 0 else surf_pt(rr, i, 0.0, 0.0014) for i in range(0, len(rr), 2)])
        t = V3(-1, 0, -0.1 * s)
        ft = loft('paddler_foot%d' % s, [node(V3(-0.98, 0.060, d * 0.95), 0.040, 0.034, V3(0, 0, 1)), node(V3(-1.07, 0.036, d * 0.95), 0.046, 0.024, V3(0, 0, 1)), node(V3(-1.16, 0.026, d * 0.97), 0.038, 0.019, V3(0, 0, 1)), node(V3(-1.20, 0.022, d * 0.97), 0.02, 0.012, V3(0, 0, 1))], M_SUIT, fh=V3(0, 0, 1), n=14, per=4)[0]
        parts.append(ft)
    # arms: one reaching, one pulling back
    head_c = V3(0.55, 0.30, 0.0); Fh = V3(0.97, -0.10, 0.0)
    for s, S_off, W in ((1, V3(0.02, 0.0, 0.0), V3(0.72, 0.045, 0.30)), (-1, V3(0.0, 0.0, 0.0), V3(-0.22, 0.045, -0.40))):
        S = V3(0.29, 0.17, 0.185 * s) + S_off
        E = ik(S, W, 0.315, 0.275, V3(0, 0.6, 1.0 * s))
        fhs = V3(0, 1, 0)
        an = [node(S, 0.056, 0.058, fhs), node(lerp(S, E, 0.5), 0.050, 0.052, fhs), node(E, 0.043, 0.045, fhs), node(lerp(E, W, 0.5), 0.043, 0.045, fhs), node(lerp(E, W, 0.92), 0.033, 0.034, fhs), node(W, 0.0345, 0.0345, fhs)]
        o, rr = loft('paddler_arm%d' % s, an, M_SUIT, fh=fhs, n=18, per=5); parts.append(o)
        parts.append(ellipsoid('paddler_delt%d' % s, S, (0.053, 0.056, 0.052), M_SUIT, None, 14))
        D = (W - E).normalized()
        parts += make_hand('paddler_hand%d' % s, W + D * 0.004, D, V3(0, -1, 0), thumb_sign=-s, curl=0.6, spread=0.8)
    parts.append(loft('paddler_neck', [node(nb + V3(-0.02, 0.0, 0), 0.060, 0.062, DN), node(nb + V3(0.04, 0.045, 0), 0.052, 0.054, DN), node(head_c + V3(-0.03, -0.08, 0), 0.050, 0.052, DN)], M_SKIN, fh=V3(0.3, 1, 0), n=16, per=4)[0])
    parts.append(loft('paddler_collar', [node(nb + V3(-0.02, 0.0, 0), 0.072, 0.074, DN), node(nb + V3(0.012, 0.028, 0), 0.064, 0.066, DN)], M_SUIT, fh=V3(0.3, 1, 0), n=20, per=3)[0])
    parts += make_head('paddler', head_c, Fh)
    for i, s in enumerate(seams): parts.append(tube('paddler_seam%d' % i, s, 0.0021, M_SEAM))
    return parts

def merge_by_material(objs, name):
    """Convert curves, then join everything that shares a material so the GLB stays light (few nodes, few draw calls)."""
    meshes = []
    for o in objs:
        if o.type == 'CURVE':
            bpy.context.view_layer.objects.active = o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.ops.object.convert(target='MESH'); o = bpy.context.view_layer.objects.active
        meshes.append(o)
    by = {}
    for o in meshes: by.setdefault(o.data.materials[0].name, []).append(o)
    out = []
    for mname, lst in by.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in lst: o.select_set(True)
        bpy.context.view_layer.objects.active = lst[0]
        if len(lst) > 1: bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active; j.name = '%s_%s' % (name, mname); out.append(j)
    return out

board, fins = make_board()
rider = merge_by_material(make_rider(), 'rider')
paddler = merge_by_material(make_paddler(), 'paddler')

def group(name, objs):
    e = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(e)
    for o in objs: o.parent = e
    return e
group('board', [board] + fins)
for nm, ob in (('rider', rider), ('paddler', paddler)): group(nm, ob).location = B((0, 0.07, 0))

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
print('EXPORTED', out)
