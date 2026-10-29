"""SWELLO Quiver: procedural surfboard + fin GLBs.

Run:  blender -b --python scripts/blender/build_boards.py -- [--out public/models/boards] [--preview DIR]

Coordinates while building (Blender): +X = nose, Y = width, Z = up. Each board is normalised to length 1 along X
(centred) and exported Y-up, so the app scales it to the real length/width/thickness. The template width and
thickness (in length-1 units) are written to the node's glTF extras as `width` and `thickness`.

Each board is a lofted surface: outline curve (PCHIP), nose/tail rocker, domed deck and concave/vee bottom, and a
superellipse rail section (soft 50/50 at the nose, apex dropping toward a down rail and harder bottom edge at the tail).
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = os.path.abspath(arg('--out', 'public/models/boards'))
PREVIEW = arg('--preview')
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- helpers
def pchip(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    for i in range(1, n - 1):
        if d[i - 1] * d[i] > 0:
            w1 = 2 * h[i] + h[i - 1]; w2 = h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    def end(h0, h1, d0, d1):
        v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
        if v * d0 <= 0: return 0.0
        if d0 * d1 <= 0 and abs(v) > 3 * abs(d0): return 3 * d0
        return v
    m[0] = end(h[0], h[1], d[0], d[1]) if n > 2 else d[0]
    m[-1] = end(h[-1], h[-2], d[-1], d[-2]) if n > 2 else d[-1]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = 0
        while xs[i + 1] < x: i += 1
        t = (x - xs[i]) / h[i]; t2 = t * t; t3 = t2 * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
                + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1])
    return f

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def cap(u, rn, rt):
    c = 1.0
    if rn > 0 and u < rn: c *= math.sqrt(max(0.0, 1 - ((rn - u) / rn) ** 2))
    if rt > 0 and u > 1 - rt: c *= math.sqrt(max(0.0, 1 - ((u - (1 - rt)) / rt) ** 2))
    return c

# ---------------------------------------------------------------- board templates
# u = 0 at the nose, 1 at the tail. Dimensions in inches define the template proportions (L, W, T).
BOARDS = {
 'shortboard': dict(L=72, W=19.5, T=2.5, rn=0.006, rt=0.018,
   outline=[(0,0),(.014,.18),(.05,.34),(.083,.45),(.167,.64),(.25,.80),(.33,.91),(.43,.985),(.5,1),(.58,.985),(.7,.90),(.833,.73),(.917,.63),(.97,.57),(1,.54)],
   thick=[(0,.34),(.02,.40),(.08,.52),(.18,.70),(.3,.90),(.42,1),(.5,1),(.6,.96),(.72,.86),(.84,.72),(.93,.58),(1,.46)],
   rocker=(5.2, 2.2, .50, 2.5, 2.2),
   tn=[(0,2.1),(.5,2.3),(1,2.9)], tb=[(0,2.5),(.5,2.7),(1,4.0)], ap=[(0,.50),(.5,.44),(1,.30)],
   conc=[(0,0),(.2,.0006),(.4,.0030),(.62,.0034),(.8,.0020),(1,0)], dbl=[(0,0),(.55,0),(.75,.0014),(1,.0016)], vee=[(0,0),(.7,0),(.88,.0016),(1,.0034)], notch=None),
 'fish': dict(L=70, W=21, T=2.625, rn=0.012, rt=0.04,
   outline=[(0,0),(.012,.20),(.04,.38),(.09,.55),(.17,.73),(.27,.88),(.38,.97),(.47,1),(.57,.98),(.68,.91),(.8,.80),(.9,.68),(.96,.60),(1,.56)],
   thick=[(0,.36),(.04,.44),(.15,.68),(.3,.92),(.45,1),(.6,.95),(.75,.80),(.9,.60),(1,.48)],
   rocker=(4.4, 1.6, .50, 2.2, 2.0),
   tn=[(0,2.1),(.5,2.2),(1,2.6)], tb=[(0,2.4),(.5,2.6),(1,3.4)], ap=[(0,.50),(.5,.46),(1,.36)],
   conc=[(0,0),(.25,.0008),(.45,.0030),(.7,.0036),(1,.0016)], dbl=[(0,0),(.55,0),(.8,.0016),(1,.0018)], vee=[(0,0),(.75,0),(1,.0012)],
   notch=dict(depth=.046, half=.30)),
 'longboard': dict(L=108, W=22.5, T=3.0, rn=0.075, rt=0.085,
   outline=[(0,.50),(.075,.66),(.15,.80),(.25,.92),(.38,.99),(.5,1),(.62,.985),(.74,.93),(.85,.82),(.93,.70),(1,.55)],
   thick=[(0,.40),(.05,.52),(.15,.74),(.3,.94),(.45,1),(.6,.97),(.75,.82),(.9,.60),(1,.46)],
   rocker=(6.4, 3.0, .52, 2.8, 2.4),
   tn=[(0,2.4),(.5,2.9),(1,3.0)], tb=[(0,2.6),(.5,3.0),(1,4.2)], ap=[(0,.50),(.5,.46),(1,.38)],
   conc=[(0,.0010),(.2,.0016),(.45,.0016),(.7,.0010),(1,0)], dbl=[(0,0),(1,0)], vee=[(0,0),(.7,0),(1,.0030)], notch=None),
 'gun': dict(L=78, W=19.5, T=2.75, rn=0.006, rt=0.0,
   outline=[(0,0),(.015,.17),(.05,.32),(.1,.46),(.18,.64),(.28,.82),(.4,.96),(.48,1),(.56,.99),(.66,.92),(.78,.76),(.88,.55),(.95,.32),(.985,.14),(1,0)],
   thick=[(0,.30),(.03,.40),(.12,.62),(.25,.88),(.42,1),(.55,.98),(.7,.84),(.85,.60),(.95,.38),(1,.26)],
   rocker=(7.6, 3.0, .52, 2.7, 2.3),
   tn=[(0,2.1),(.5,2.3),(1,2.8)], tb=[(0,2.5),(.5,2.9),(1,4.2)], ap=[(0,.50),(.5,.42),(1,.28)],
   conc=[(0,0),(.3,.0016),(.55,.0030),(.8,.0010),(1,0)], dbl=[(0,0),(1,0)], vee=[(0,0),(.55,.0006),(.8,.0030),(1,.0044)], notch=None),
 'midlength': dict(L=84, W=21, T=2.9, rn=0.012, rt=0.04,
   outline=[(0,0),(.01,.22),(.04,.42),(.09,.56),(.17,.74),(.27,.88),(.38,.97),(.47,1),(.56,.99),(.67,.93),(.78,.80),(.88,.62),(.95,.44),(.985,.28),(1,.10)],
   thick=[(0,.34),(.04,.44),(.15,.70),(.3,.93),(.45,1),(.6,.96),(.75,.82),(.9,.58),(1,.40)],
   rocker=(5.6, 2.4, .52, 2.6, 2.3),
   tn=[(0,2.2),(.5,2.5),(1,3.0)], tb=[(0,2.5),(.5,2.8),(1,4.0)], ap=[(0,.50),(.5,.45),(1,.32)],
   conc=[(0,.0004),(.25,.0014),(.5,.0028),(.75,.0016),(1,0)], dbl=[(0,0),(.6,0),(1,.0010)], vee=[(0,0),(.7,0),(1,.0026)], notch=None),
}

N_STATIONS = 74
N_SIDE = 15          # points per deck / bottom half-ring (excluding apex)
STRINGER_HALF = 0.0016

def build_board(name, P):
    Lin = P['L']
    ow = pchip(P['outline']); ot = pchip(P['thick'])
    tn = pchip(P['tn']); tb = pchip(P['tb']); ap = pchip(P['ap'])
    conc = pchip(P['conc']); dbl = pchip(P['dbl']); vee = pchip(P['vee'])
    half_max = P['W'] / Lin / 2; t_max = P['T'] / Lin
    rn_in, rt_in, uc, pn, pt = P['rocker']; rn_in /= Lin; rt_in /= Lin
    stations = [0.5 - 0.5 * math.cos(math.pi * k / (N_STATIONS - 1)) for k in range(N_STATIONS)]
    rings = []; stringer_rows = []
    for u in stations:
        c = cap(u, P['rn'], P['rt'])
        w = half_max * ow(u) * c
        T = t_max * ot(u) * c
        base = rn_in * ((uc - u) / uc) ** pn if u < uc else rt_in * ((u - uc) / (1 - uc)) ** pt
        # centre offset of the bottom at the stringer: concave lifts, vee and spine lower it
        center_off = (conc(u) - dbl(u) - vee(u)) * c
        a = ap(u)
        nt, nb = tn(u), tb(u)
        Tt = T + center_off
        hb, ht = a * Tt, (1 - a) * Tt
        zc = base + hb - center_off
        s = min(STRINGER_HALF, 0.12 * w)
        ring_half = []
        if w < 1e-9:
            ring_half = [(0.0, zc)] * (2 * N_SIDE + 1)
        else:
            th0t = math.acos(min(1.0, (s / w) ** (nt / 2))); th0b = math.acos(min(1.0, (s / w) ** (nb / 2)))
            top = []
            for k in range(N_SIDE):
                th = th0t * (1 - k / N_SIDE)
                y = w * math.cos(th) ** (2 / nt); z = zc + ht * math.sin(th) ** (2 / nt)
                top.append((y, z))
            bot = []
            for k in range(1, N_SIDE + 1):
                th = th0b * (k / N_SIDE)
                eta = math.cos(th) ** (2 / nb); y = w * eta
                z = zc - hb * math.sin(th) ** (2 / nb)
                # bottom contour: single concave, double-concave spine, vee (all fade to zero at the rail)
                q = max(0.0, 1 - eta * eta)
                z += conc(u) * q * q * c
                z -= dbl(u) * c * math.exp(-(eta / 0.24) ** 2) * q * q
                z -= vee(u) * c * (1 - math.sqrt(eta * eta + 0.004)) * 1.0 * q ** 0.5
                bot.append((y, z))
            ring_half = top + [(w, zc)] + bot
        rings.append((u, ring_half, s))
    # shear the tail centre forward for the swallow
    nt_ = P['notch']
    verts = []; R = 2 * (2 * N_SIDE + 1)
    for u, half, s in rings:
        ring = [(y, z) for (y, z) in half] + [(-y, z) for (y, z) in reversed(half)]
        for (y, z) in ring:
            x = 0.5 - u
            if nt_:
                yn = nt_['half'] * half_max * 2 * 0.5
                g = smoothstep(0.86, 1.0, u)
                k = max(0.0, 1 - math.sqrt(y * y + 1e-6) / yn)
                x += nt_['depth'] * g * k ** 1.3
            verts.append((x, y, z))
    return verts, R

def make_board_object(name, P):
    verts, R = build_board(name, P)
    S = N_STATIONS
    # normalise to length 1 along X, centred
    xs = [v[0] for v in verts]; sc = 1.0 / (max(xs) - min(xs)); cx = (max(xs) + min(xs)) / 2
    verts = [((x - cx) * sc, y * sc, z * sc) for x, y, z in verts]
    width = (max(v[1] for v in verts) - min(v[1] for v in verts))
    mesh = bpy.data.meshes.new(name); obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap')
    bv = [bm.verts.new(v) for v in verts]
    half = 2 * N_SIDE + 1
    for i in range(S - 1):
        for j in range(R):
            j2 = (j + 1) % R
            f = bm.faces.new((bv[i * R + j], bv[i * R + j2], bv[(i + 1) * R + j2], bv[(i + 1) * R + j]))
            # stringer strips: across the deck centre (wrap quad) and the bottom centre
            f.material_index = 1 if (j == R - 1 or j == half - 1) else 0
            f.smooth = True
            # UVs: u along the length, v round the section (seam on the deck stringer)
            u0, u1 = verts[i * R][0] + 0.5, verts[(i + 1) * R][0] + 0.5
            v0, v1 = j / R, (j + 1) / R
            for loop, (uu, vv) in zip(f.loops, ((u0, v0), (u0, v1), (u1, v1), (u1, v0))):
                loop[uv].uv = (uu, vv)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh); bm.free()
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj, sc, width

def principled(name, color, roughness, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; m.diffuse_color = color
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = color; b.inputs['Roughness'].default_value = roughness
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.02
    return m

def add_materials(obj):
    """Slot 0 = glassed resin, slot 1 = stringer (appended without clear(), which would reset face indices)."""
    obj.data.materials.append(principled('Resin', (0.9, 0.9, 0.88, 1), 0.12, 1.0))
    obj.data.materials.append(principled('Stringer', (0.42, 0.26, 0.12, 1), 0.3, 1.0))

def board_extras(obj, width, P, sc):
    verts = obj.data.vertices
    obj['width'] = round(width, 5)
    # template thickness measured along the stringer, in length-1 units
    obj['thickness'] = round(P['T'] / P['L'] * sc, 5)
    obj['category'] = obj.name

# ---------------------------------------------------------------- fins
def airfoil(n=14):
    pts = []
    for k in range(n + 1):
        xi = 0.5 * (1 - math.cos(math.pi * k / n))
        yt = 5 * (0.2969 * math.sqrt(xi) - 0.1260 * xi - 0.3516 * xi ** 2 + 0.2843 * xi ** 3 - 0.1036 * xi ** 4)
        pts.append((xi, yt))
    return pts

def make_fin(name, C, H, rake, tfrac, asym, cant, toe, side=1, tipchord=0.28, base_len=None):
    """Fin with its root centre at the origin, chord along X (leading edge +X), hanging down -Z."""
    mesh = bpy.data.meshes.new(name); obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new(); K = 24; af = airfoil(14)
    rows = []
    for k in range(K + 1):
        s = (k / K)
        s_ = 1 - (1 - s) ** 1.0
        c = C * (1 - (1 - tipchord) * s) * math.sqrt(max(0.0, 1 - s ** 7))
        xle = C / 2 - rake * s ** 1.5
        z = -H * s
        t = tfrac * (1 - 0.30 * s)
        up = []; lo = []
        for xi, yt in af:
            x = xle - c * xi
            yy = yt * t * c * 2.0
            up.append((x, yy if asym else yy * 0.5)); lo.append((x, 0.0 if asym else -yy * 0.5))
        ring = up + list(reversed(lo[1:-1]))
        rows.append([bm.verts.new((x, y, z)) for x, y in ring])
    R = len(rows[0])
    for k in range(K):
        for j in range(R):
            bm.faces.new((rows[k][j], rows[k][(j + 1) % R], rows[k + 1][(j + 1) % R], rows[k + 1][j])).smooth = True
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    # root cap + base plate (second material)
    bm.to_mesh(mesh); bm.free()
    # base plate
    bl = base_len or (C + 0.5)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.0))
    base = bpy.context.active_object
    base.scale = (bl, tfrac * C * (1.1 if asym else 1.0) + 0.3, 0.16); base.location = (0, tfrac * C * 0.35 if asym else 0, 0.04)
    bpy.ops.object.transform_apply(location=True, scale=True)
    bev = base.modifiers.new('b', 'BEVEL'); bev.width = 0.07; bev.segments = 3
    bpy.context.view_layer.objects.active = base; bpy.ops.object.modifier_apply(modifier='b')
    for p in base.data.polygons: p.use_smooth = True
    for o in (obj, base): o.select_set(False)
    obj.select_set(True); base.select_set(True); bpy.context.view_layer.objects.active = obj
    # materials
    mf = bpy.data.materials.get('Fin') or bpy.data.materials.new('Fin')
    mb = bpy.data.materials.get('FinBase') or bpy.data.materials.new('FinBase')
    mf.diffuse_color = (0.12, 0.13, 0.14, 1); mb.diffuse_color = (0.05, 0.05, 0.05, 1)
    for m, col, rough in ((mf, (0.12, 0.13, 0.14, 1), 0.35), (mb, (0.04, 0.04, 0.045, 1), 0.5)):
        m.use_nodes = True; bs = m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value = col; bs.inputs['Roughness'].default_value = rough
    obj.data.materials.clear(); obj.data.materials.append(mf)
    base.data.materials.clear(); base.data.materials.append(mb)
    bpy.ops.object.join()
    obj = bpy.context.active_object; obj.name = name
    # cant (tip outward) and toe (leading edge toward the centreline); +Y is the board's left
    obj.rotation_euler = (math.radians(cant) * side, 0, math.radians(-toe) * side)
    bpy.ops.object.transform_apply(rotation=True)
    return obj

# ---------------------------------------------------------------- run
def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_extras=True, export_cameras=False, export_lights=False, export_texcoords=True, export_normals=True)
    print('wrote', path, os.path.getsize(path) // 1024, 'KB')

def main():
    clear()
    built = []
    for name, P in BOARDS.items():
        o, sc, width = make_board_object(name, P)
        add_materials(o); board_extras(o, width, P, sc)
        built.append(o)
        export([o], os.path.join(OUT, f'board-{name}.glb'))
        o.hide_set(False)
    # fins
    fins = [
        make_fin('fin_single', 6.8, 9.0, 3.1, 0.085, False, 0, 0, base_len=7.6),
        make_fin('fin_twin_R', 5.2, 5.0, 2.8, 0.075, True, 6, 3.0, side=1),
        make_fin('fin_twin_L', 5.2, 5.0, 2.8, 0.075, True, 6, 3.0),
        make_fin('fin_side_R', 4.3, 4.4, 2.4, 0.07, True, 5, 2.5, side=1),
        make_fin('fin_side_L', 4.3, 4.4, 2.4, 0.07, True, 5, 2.5),
        make_fin('fin_center', 4.4, 4.5, 2.2, 0.07, False, 0, 0),
    ]
    # left fins are right fins mirrored across the centreline (outer face toward the rail)
    for f in fins:
        if f.name.endswith('_L'):
            f.scale = (1, -1, 1); bpy.context.view_layer.objects.active = f
            f.select_set(True); bpy.ops.object.transform_apply(scale=True)
            bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.flip_normals(); bpy.ops.object.mode_set(mode='OBJECT')
            f.select_set(False)
    export(fins, os.path.join(OUT, 'fins.glb'))
    if PREVIEW:
        preview(built, fins)

# ---------------------------------------------------------------- previews (not shipped)
def preview(boards, fins):
    os.makedirs(PREVIEW, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
    sc.render.resolution_x = 1200; sc.render.resolution_y = 420
    sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.35, 0.37, 0.4, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    for loc, e in (((0, -3, 4), 400), ((4, 3, 3), 150)):
        bpy.ops.object.light_add(type='AREA', location=loc); L = bpy.context.active_object; L.data.energy = e; L.data.size = 5
        L.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.06)); fl = bpy.context.active_object
    fm = bpy.data.materials.new('f'); fm.diffuse_color = (0.5, 0.5, 0.5, 1); fl.data.materials.append(fm)
    cam_data = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cam_data); sc.collection.objects.link(cam); sc.camera = cam
    for o in boards: o.hide_render = True
    for f in fins: f.hide_render = True
    def shot(path, loc, target=(0, 0, 0.0), ortho=None):
        cam.location = loc; cam.data.type = 'ORTHO' if ortho else 'PERSP'
        if ortho: cam.data.ortho_scale = ortho
        cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    for o in boards:
        o.hide_render = False
        shot(os.path.join(PREVIEW, f'{o.name}-top.png'), (0, 0, 3), ortho=1.25)
        shot(os.path.join(PREVIEW, f'{o.name}-side.png'), (0, -3, 0.05), ortho=1.25)
        shot(os.path.join(PREVIEW, f'{o.name}-three.png'), (0.55, -0.85, 0.5))
        shot(os.path.join(PREVIEW, f'{o.name}-tail.png'), (-1.1, -0.15, 0.12), target=(-0.4, 0, 0.03))
        o.hide_render = True
    for f in fins: f.hide_render = False; f.location = (0, 0, 0)
    for k, f in enumerate(fins): f.location = (k * 7 - 17, 0, 0)
    sc.render.resolution_y = 300
    shot(os.path.join(PREVIEW, 'fins.png'), (0, -40, -3), target=(0, 0, -3), ortho=44)

main()
