"""SWELLO wave scale v2 (T-054): a peeling surf wave at true size with a 1.75 m surfer, rendered as a 24-angle orbit.

Run headless (Cycles on the Metal GPU):
  blender -b --factory-startup --python tools/blender/wave_scene.py -- \
      --face 1.52 --curl 0.75 --out public/media/scale3d/4-6 --angles 24 --surfer tools/blender/assets/surfer.glb \
      --profiles tools/blender/assets/turbosquid-1773957 [--size 1280x960] [--samples 64] [--only 0]

Units are metres; --face is trough-to-crest face height. The wave's cross-sections come from the licensed TurboSquid
1773957 meshes (ond2/ond3, not redistributed), blended along the crest so the wave peels: flat -> shoulder -> pocket ->
barrel (when --curl allows) -> whitewater -> flat. It is a scale illustration, not a simulation of a real wave.
"""
import argparse
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--face', type=float, default=1.52)
ap.add_argument('--curl', type=float, default=0.75, help='0 = crumbling, 1 = full barrel')
ap.add_argument('--out', default='/tmp/wave')
ap.add_argument('--angles', type=int, default=24)
ap.add_argument('--surfer', default='')
ap.add_argument('--profiles', default='tools/blender/assets/turbosquid-1773957')
ap.add_argument('--size', default='1280x960')
ap.add_argument('--samples', type=int, default=64)
ap.add_argument('--only', default='', help='comma list of angle indices to render (previews)')
ap.add_argument('--blend', default='')
ap.add_argument('--poster', type=int, default=0, help='angle index copied to poster.jpg')
ap.add_argument('--yaw', type=float, default=90.0, help='surfer yaw (deg) so the nose points down the line')
ap.add_argument('--sun', type=float, default=150.0, help='sun azimuth (deg)')
ap.add_argument('--sunel', type=float, default=14.0)
ap.add_argument('--look', type=float, default=0.0, help='debug: shift the camera target along the crest (m)')
a = ap.parse_args(argv)

H = a.face
SURFER_H = 1.75
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

# ---------------------------------------------------------------- profiles from the licensed meshes
COLS, ROWS = 171, 141


def grid_rows(path):
    bpy.ops.import_scene.fbx(filepath=path)
    ob = [o for o in bpy.context.selected_objects if o.type == 'MESH'][0]
    P = [ob.matrix_world @ v.co for v in ob.data.vertices]
    for o in list(bpy.context.selected_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return [[(p.x, p.z) for p in P[r * COLS:(r + 1) * COLS]] for r in range(ROWS)]


ond2 = grid_rows(os.path.join(a.profiles, 'ond2.fbx'))
ond3 = grid_rows(os.path.join(a.profiles, 'ond3.fbx'))
FLAT = 0.009
HUMP, MID, BARREL = ond3[125], ond2[70], ond2[15]
TROUGH = min(z for _, z in BARREL)
HM = max(z for _, z in BARREL) - TROUGH
K = H / HM  # model units -> metres, so the barrel's trough-to-crest is H
crest_i = max(range(COLS), key=lambda i: BARREL[i][1])
tip_i = max(range(crest_i, COLS), key=lambda i: BARREL[i][0] if BARREL[i][1] > FLAT + 0.02 else -1)


def lerp(p, q, t):
    return [(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) for (x0, z0), (x1, z1) in zip(p, q)]


FLATROW = [(x, FLAT) for x, _ in HUMP]


def profile(c, amp):
    """c in [0,1]: 0 hump, 0.5 small curl, 1 barrel; amp scales height above the flat (0 = flat sea)."""
    pr = lerp(HUMP, MID, c * 2) if c < 0.5 else lerp(MID, BARREL, c * 2 - 1)
    # every cross-section keeps the band's true face height (the source shoulder rows are smaller than the barrel)
    zt, zb = max(z for _, z in pr), min(z for _, z in pr)
    g = (HM / (zt - zb)) if zt > zb else 1.0
    pr = [(x, FLAT + (z - FLAT) * g) for x, z in pr]
    return lerp(FLATROW, pr, amp)


# ---------------------------------------------------------------- the wave as one sea mesh
def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# along-crest layout (scene x; the surfer rides toward -x, the wave breaks behind them toward +x)
SHOULDER, POCKET, BROKEN, FADE = 7 * H, 3.5 * H, 14 * H, 9 * H
rng = random.Random(11)
WOB = [(rng.uniform(0.6, 1.6) / H, rng.uniform(0, 6.28), rng.uniform(0.03, 0.07) * (1.8 if H < 1 else 1.0)) for _ in range(4)]


def wobble(x):
    """Small along-crest irregularity in height (a real wave line is never a perfect cylinder)."""
    return 1.0 + sum(a_ * math.sin(f * x + ph) for f, ph, a_ in WOB) * smooth(-SHOULDER - FADE, -0.5 * SHOULDER, x)


def along(x):
    """(curl c, amplitude, foam) at along-crest position x."""
    if x < 0:
        amp = 0.12 + 0.88 * smooth(-SHOULDER - FADE, 0, x) ** 1.3
        amp *= smooth(-SHOULDER - 2.2 * FADE, -SHOULDER - 0.6 * FADE, x)
        c = 0.5 * a.curl * smooth(-SHOULDER, 0, x) ** 2
        return c, amp * wobble(x), 0.0
    if x < POCKET:
        t = x / POCKET
        return a.curl * (0.5 + 0.5 * smooth(0, 0.6, t)), 1.0, -smooth(0.35, 1.0, t)  # negative = pocket foam (impact zone only)
    t = (x - POCKET) / BROKEN
    amp = 1.0 - 0.45 * smooth(0, 0.5, t)
    amp *= 1 - smooth(0.6, 1.4, t)
    return a.curl * (1 - 0.7 * smooth(0, 0.3, t)), amp * wobble(x), 1.0 - smooth(1.0, 1.6, t)


def axis_samples(lo, hi, fine_lo, fine_hi, fine_step, far):
    """Fine spacing near the wave, geometric spacing out to `far`."""
    xs = []
    x = fine_lo
    while x <= fine_hi:
        xs.append(x)
        x += fine_step
    step = fine_step
    x = fine_lo
    while x > -far:
        step *= 1.18
        x -= step
        xs.insert(0, max(x, -far))
    x, step = fine_hi, fine_step
    while x < far:
        step *= 1.18
        x += step
        xs.append(min(x, far))
    return [v for v in xs if lo <= v <= hi] if lo > -far else xs


FAR = 20000.0  # far enough that aerial angles never see the sea edge
xs = axis_samples(-FAR, FAR, -SHOULDER - FADE, POCKET + BROKEN + FADE, max(0.06, H / 12), FAR)
# cross-shore: the profile's own 171 columns (scaled), then flat extensions out to the horizon
# small waves are much less steep than big ones: widen them cross-shore (2.2x at 1.5 ft, 1x from ~5 ft)
KY = K * (1.0 + 1.2 * (1 - smooth(0.5, 1.5, H)))
half = 0.1 * KY
ext_out = []
d, step = half, H / 10
while d < FAR:
    step *= 1.06 if d < 45 * H else 1.25
    d += step
    ext_out.append(min(d, FAR))
# the next waves of the set, out the back (seaward = -y), smaller and unbroken
SETS = [(half + 9.0 * H, 0.42, 2.2 * H), (half + 19.0 * H, 0.3, 2.6 * H), (half + 31.0 * H, 0.2, 3.0 * H)]


def swell_z(d, x):
    """Height of the set waves at distance d seaward of the tile edge (their crests bend a little along x)."""
    z = 0.0
    for k_, (d0, amp_, w_) in enumerate(SETS):
        dd = d - d0 - 0.02 * (x ** 2) / max(H, 0.5) * (0.4 + 0.3 * k_) / 10
        z += amp_ * H * math.exp(-(dd / w_) ** 2) * (1.0 - smooth(60 * H, 120 * H, abs(x)))
    return z

me = bpy.data.meshes.new('Sea')
bm = bmesh.new()
foam_l = bm.verts.layers.float.new('foam')
thin_l = bm.verts.layers.float.new('thin')
crest_l = bm.verts.layers.float.new('crestd')
rows = []
for x in xs:
    c, amp, foam = along(x)
    pr = profile(c, amp)
    pts = [(-e, swell_z(e, x), None) for e in reversed(ext_out)]
    pts += [((px) * KY, (pz - FLAT) * K, i) for i, (px, pz) in enumerate(pr)]
    pts += [(e, 0.0, None) for e in ext_out]
    row = []
    for y, z, i in pts:
        v = bm.verts.new((x, y, z))
        if i is None:
            fo, th, cd = 0.0, 0.0, 9.0
        else:
            # thin water: from just before the crest, over the lip, to the tip; only as thick as the curl allows
            th = smooth(crest_i - 18, crest_i - 4, i) * (1 - smooth(tip_i + 6, tip_i + 20, i)) * (0.35 + 0.65 * c) * amp * (0.25 + 0.75 * smooth(0.5, 1.4, H))  # small waves are mostly sea-coloured, not a glowing slab
            cd = abs(i - crest_i) / 20.0
            # foam: whitewater on the broken section (face side, i >= crest), a crest feather where the lip is about to go
            face_side = smooth(crest_i - 10, crest_i + 5, i)
            impact = smooth(98, 108, i) * (1 - smooth(126, 140, i))
            feather = smooth(crest_i - 4, crest_i, i) * (1 - smooth(crest_i + 2, crest_i + 7, i))
            if foam < 0:
                # pocket: the lip stays clear water; whitewater where it lands in front, and a feather on the crest
                fo = -foam * (impact + 0.5 * feather)
            else:
                # whitewater grows out of the impact zone over the first metres of the broken section (no hard edge)
                # (only past the pocket: the open shoulder ahead of it has no whitewater)
                b = smooth(POCKET, POCKET + 0.15 * BROKEN, x)
                fo = 0.0 if x < POCKET else (1 - b) * (impact + 0.5 * feather) + b * foam * (0.55 + 0.45 * face_side)
        v[foam_l], v[thin_l], v[crest_l] = fo, th, cd
        row.append(v)
    rows.append(row)
for r0, r1 in zip(rows, rows[1:]):
    for j in range(len(r0) - 1):
        bm.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1]))
# beach is +y in the model (the lip throws toward +x model = +y scene)
bm.to_mesh(me)
bm.free()
sea = bpy.data.objects.new('Sea', me)
scene.collection.objects.link(sea)
for p in me.polygons:
    p.use_smooth = True
# copy the float layers to point attributes the shader can read
for name in ('foam', 'thin', 'crestd'):
    pass  # bmesh float layers become mesh attributes with the same names


# ---------------------------------------------------------------- materials
def water_material():
    m = bpy.data.materials.new('Water')
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    tc = N.new('ShaderNodeTexCoord')

    def attr(name):
        n = N.new('ShaderNodeAttribute')
        n.attribute_name = name
        return n.outputs['Fac']

    def noise(scale, detail=6.0, rough=0.55, vec=None):
        n = N.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        L.new(vec or tc.outputs['Object'], n.inputs['Vector'])
        return n.outputs['Fac']

    def math(op, x, y=None, clamp=False):
        n = N.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = clamp
        for k, v in enumerate((x, y)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[k].default_value = v
            else:
                L.new(v, n.inputs[k])
        return n.outputs[0]

    def ramp(fac, stops):
        n = N.new('ShaderNodeValToRGB')
        el = n.color_ramp.elements
        el[0].position, el[0].color = stops[0]
        el[1].position, el[1].color = stops[-1]
        for pos, col in stops[1:-1]:
            e = el.new(pos)
            e.color = col
        L.new(fac, n.inputs['Fac'])
        return n.outputs['Color']

    foam_a, thin_a = attr('foam'), attr('thin')
    # stretched noise so foam reads as streaks running along the wave, not blobs
    mp = N.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.35, 1.0, 1.0)
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    streak = noise(2.2 / max(H, 0.6), 8.0, 0.62, mp.outputs['Vector'])
    fine = noise(9.0, 4.0, 0.5)
    fmask = math('MULTIPLY', math('ADD', math('MULTIPLY', streak, 1.2), math('MULTIPLY', fine, 0.35)), foam_a)
    fcov = ramp(fmask, [(0.42, (0, 0, 0, 1)), (0.62, (1, 1, 1, 1))])

    # scattered surface foam on the flat water inside, plus a little everywhere (old whitewater, wind lines)
    patch = noise(0.35, 5.0, 0.6)
    patchm = ramp(math('MULTIPLY', patch, math('ADD', math('MULTIPLY', foam_a, 0.25), 0.82)), [(0.62, (0, 0, 0, 1)), (0.72, (0.6, 0.6, 0.6, 1))])
    fsum = N.new('ShaderNodeMix')
    fsum.data_type = 'RGBA'
    fsum.blend_type = 'LIGHTEN'
    fsum.inputs['Factor'].default_value = 1.0
    L.new(fcov, fsum.inputs['A'])
    L.new(patchm, fsum.inputs['B'])
    foamfac = fsum.outputs['Result']

    water = N.new('ShaderNodeBsdfPrincipled')
    water.inputs['Base Color'].default_value = (0.006, 0.045, 0.05, 1)
    water.inputs['Roughness'].default_value = 0.07
    water.inputs['IOR'].default_value = 1.333
    water.inputs['Specular IOR Level'].default_value = 0.5
    # subsurface gives the body of the wave depth instead of a painted look
    water.inputs['Subsurface Weight'].default_value = 0.02 + 0.1 * smooth(0.5, 1.4, H)
    water.inputs['Subsurface Radius'].default_value = (0.1, 0.6, 0.5)
    water.inputs['Subsurface Scale'].default_value = min(0.4 * H, 0.5)

    glow = N.new('ShaderNodeBsdfTranslucent')
    glow.inputs['Color'].default_value = (0.05, 0.42, 0.30, 1)
    gloss = N.new('ShaderNodeBsdfGlossy')
    gloss.inputs['Roughness'].default_value = 0.04
    lip = N.new('ShaderNodeMixShader')
    L.new(glow.outputs[0], lip.inputs[1])
    L.new(gloss.outputs[0], lip.inputs[2])
    lip.inputs['Fac'].default_value = 0.35

    mthin = N.new('ShaderNodeMixShader')
    L.new(math('MULTIPLY', thin_a, 0.85, clamp=True), mthin.inputs['Fac'])
    L.new(water.outputs[0], mthin.inputs[1])
    L.new(lip.outputs[0], mthin.inputs[2])

    foam = N.new('ShaderNodeBsdfPrincipled')
    foam.inputs['Base Color'].default_value = (0.86, 0.9, 0.9, 1)
    foam.inputs['Roughness'].default_value = 0.7
    foam.inputs['Subsurface Weight'].default_value = 0.6
    foam.inputs['Subsurface Radius'].default_value = (0.3, 0.4, 0.4)
    foam.inputs['Subsurface Scale'].default_value = 0.05
    mf = N.new('ShaderNodeMixShader')
    L.new(foamfac, mf.inputs['Fac'])
    L.new(mthin.outputs[0], mf.inputs[1])
    L.new(foam.outputs[0], mf.inputs[2])
    L.new(mf.outputs[0], out.inputs['Surface'])

    # ripples at two scales, rougher where there is foam
    b1 = N.new('ShaderNodeBump')
    b1.inputs['Strength'].default_value = 0.32
    b1.inputs['Distance'].default_value = 0.05
    mp2 = N.new('ShaderNodeMapping')
    mp2.inputs['Scale'].default_value = (1.0, 0.25, 1.0)  # stretched across the face: lines that run up and down it
    L.new(tc.outputs['Object'], mp2.inputs['Vector'])
    face_lines = math('MULTIPLY', noise(3.0, 5.0, 0.6, mp2.outputs['Vector']), math('MULTIPLY', thin_a, 0.0, ) if False else 0.6)
    L.new(math('ADD', math('ADD', noise(1.4, 6.0, 0.6), math('MULTIPLY', noise(7.0, 3.0, 0.5), 0.45)), face_lines), b1.inputs['Height'])
    b2 = N.new('ShaderNodeBump')
    b2.inputs['Strength'].default_value = 0.6
    b2.inputs['Distance'].default_value = 0.03
    L.new(math('MULTIPLY', noise(14.0, 4.0, 0.7), foamfac), b2.inputs['Height'])
    L.new(b1.outputs['Normal'], b2.inputs['Normal'])
    for sh in (water, foam, gloss):
        L.new(b2.outputs['Normal'], sh.inputs['Normal'])
    return m


water = water_material()
sea.data.materials.append(water)

# broad swell and chop on the flat water (not on the wave, where it would tear the thin lip)
vg = sea.vertex_groups.new(name='flat')
foam_vals = [d.value for d in me.attributes['crestd'].data]
for i, cd in enumerate(foam_vals):
    vg.add([i], min(1.0, max(0.0, (cd - 1.2) / 3.0)), 'REPLACE')
tex = bpy.data.textures.new('chop', 'CLOUDS')
tex.noise_scale = 2.2
tex.noise_depth = 3
dsp = sea.modifiers.new('Chop', 'DISPLACE')
dsp.texture = tex
dsp.texture_coords = 'GLOBAL'
dsp.direction = 'Z'
dsp.vertex_group = 'flat'
dsp.strength = 0.22
dsp.mid_level = 0.5
# whitewater bulk: lumpy displacement along the normal where there is foam
vgf = sea.vertex_groups.new(name='white')
for i, d in enumerate(me.attributes['foam'].data):
    if d.value > 0.01:
        vgf.add([i], d.value, 'REPLACE')
tex2 = bpy.data.textures.new('white', 'CLOUDS')
tex2.noise_scale = 0.18 * max(H, 0.5)
tex2.noise_depth = 4
d2 = sea.modifiers.new('White', 'DISPLACE')
d2.texture = tex2
d2.texture_coords = 'GLOBAL'
d2.vertex_group = 'white'
d2.strength = 0.16 * H
d2.mid_level = 0.35
sub = sea.modifiers.new('Smooth', 'SUBSURF')
sub.levels = 0
sub.render_levels = 1


# ---------------------------------------------------------------- surfer
def import_surfer(path):
    bpy.ops.import_scene.gltf(filepath=path)
    objs = list(bpy.context.selected_objects)
    root = bpy.data.objects.new('Surfer', None)
    scene.collection.objects.link(root)
    for o in objs:
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    P = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    zmin, zmax = min(p.z for p in P), max(p.z for p in P)
    s = SURFER_H / (zmax - zmin)
    for o in objs:
        if o.parent is root:
            o.location.z -= zmin  # feet/board at the root origin
    return root, s


def face_point(x, frac):
    """Point on the open face (beach side of the crest) at `frac` of the face height, plus the face normal."""
    c, amp, _ = along(x)
    pr = [((px) * KY, (pz - FLAT) * K) for px, pz in profile(c, amp)]
    ci = max(range(COLS), key=lambda i: pr[i][1])
    top = pr[ci][1]
    tro = min(z for _, z in pr[ci:])
    target = tro + frac * (top - tro)
    # walk down the face from the crest (toward +y) and stop at the target height, skipping any overhang (y must increase)
    best = None
    # the open face is the last downward crossing before the trough (after any lip fold), so take the highest index
    for i in range(ci, COLS - 1):
        (y0, z0), (y1, z1) = pr[i], pr[i + 1]
        if (z0 - target) * (z1 - target) <= 0 and y1 > y0 and z1 < z0:
            t = (target - z0) / (z1 - z0 + 1e-9)
            best = (y0 + (y1 - y0) * t, target, math.atan2(z0 - z1, y1 - y0))
    if best is None:
        best = (pr[ci][0] + 0.3 * H, 0.5 * top, math.radians(35))
    return best


# ride the open shoulder ahead of the pocket, where the face is about 50 degrees (as on a real wave), not the vertical curl
SURFER_X = next(x / 100 * H for x in range(0, -1200, -5) if along(x / 100 * H)[0] <= 0.32 * min(1.0, a.curl / 0.75))
# at the bottom of the face (a bottom turn): body words like 'head high' compare the crest with a surfer standing there
fy, fz, slope = face_point(SURFER_X, 0.1)
print("SURFPOS", SURFER_X, fy, fz, math.degrees(slope), "K", K, "crest_i", crest_i, "tip_i", tip_i, "along", along(SURFER_X))
if a.surfer:
    surfer, s = import_surfer(a.surfer)
    # face slope, softened: a rigid figure tilted to the full face angle looks like it's falling over
    tilt = min(slope, math.radians(40)) * 0.6
    nrm = Vector((0, math.sin(slope), math.cos(slope)))
    surfer.matrix_world = (Matrix.Translation(Vector((SURFER_X, fy, fz)) + nrm * 0.02) @ Matrix.Rotation(-tilt, 4, 'X')
                           @ Matrix.Rotation(math.radians(a.yaw), 4, 'Z') @ Matrix.Scale(s, 4))
else:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=SURFER_H, location=(SURFER_X, fy, fz + SURFER_H / 2))
    surfer = bpy.context.object

# spray off the board's rail and a fan of droplets off the lip of the barrel, as small instanced spheres
drop_me = bpy.data.meshes.new('drop')
bmd = bmesh.new()
bmesh.ops.create_icosphere(bmd, subdivisions=1, radius=1.0)
bmd.to_mesh(drop_me)
bmd.free()
spray_m = bpy.data.materials.new('Spray')
spray_m.use_nodes = True
sp = spray_m.node_tree.nodes['Principled BSDF']
sp.inputs['Base Color'].default_value = (0.9, 0.94, 0.95, 1)
sp.inputs['Roughness'].default_value = 0.5
sp.inputs['Transmission Weight'].default_value = 0.2
sp.inputs['Alpha'].default_value = 0.55
drop_me.materials.append(spray_m)
pts = []
# rail spray: a fan behind and seaward of the board
for _ in range(int(900 * min(1.6, H))):
    u = random.random()
    back = 0.3 + 1.1 * u * min(H, 1.8)
    up = (0.15 + 0.9 * u * (1 - u)) * min(H, 1.6) * (0.6 + 0.4 * random.random())
    pts.append(((SURFER_X + back + random.gauss(0, 0.08), fy - 0.15 - 0.4 * u + random.gauss(0, 0.08), fz + up), 0.003 + 0.006 * random.random() ** 2))
# lip spray: along the pocket where the lip is pitching, feathering back over the wave
for _ in range(int(2500 * a.curl * min(1.8, H))):
    x = random.uniform(0.3 * POCKET, POCKET + 0.4 * BROKEN)
    c, amp, _ = along(x)
    pr = profile(c, amp)
    ci = max(range(COLS), key=lambda i: pr[i][1])
    ti = max(range(ci, COLS), key=lambda i: pr[i][0] if pr[i][1] > FLAT + 0.6 * (pr[ci][1] - FLAT) else -9)
    j = random.randint(ci, ti)
    py, pz = pr[j][0] * KY, (pr[j][1] - FLAT) * K
    pts.append(((x + random.gauss(0, 0.1), py + random.gauss(0, 0.04 * H) - random.random() * 0.2 * H, pz + abs(random.gauss(0, 0.05 * H))), 0.002 + 0.006 * random.random() ** 2))
spray = bmesh.new()
for (p, r) in pts:
    g = bmesh.ops.create_icosphere(spray, subdivisions=1, radius=r)
    bmesh.ops.translate(spray, verts=g['verts'], vec=Vector(p))
spm = bpy.data.meshes.new('Spray')
spray.to_mesh(spm)
spray.free()
spm.materials.append(spray_m)
spo = bpy.data.objects.new('Spray', spm)
scene.collection.objects.link(spo)

# ---------------------------------------------------------------- sky and sun
world = bpy.data.worlds.new('Sky')
scene.world = world
world.use_nodes = True
wn = world.node_tree
sky = wn.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'MULTIPLE_SCATTERING'
sky.sun_elevation = math.radians(a.sunel)
sky.sun_rotation = math.radians(a.sun)
sky.altitude = 2.0
sky.air_density = 1.0
sky.aerosol_density = 0.7
sky.sun_intensity = 0.45
# below the horizon the sky model is dark "ground"; aerial angles see a sliver of it past the farthest water as a black line,
# so directions at or below the horizon take the horizon haze colour instead
wtc = wn.nodes.new('ShaderNodeTexCoord')
wsep = wn.nodes.new('ShaderNodeSeparateXYZ')
wn.links.new(wtc.outputs['Generated'], wsep.inputs[0])
wmr = wn.nodes.new('ShaderNodeMapRange')
wmr.inputs['From Min'].default_value = -0.01
wmr.inputs['From Max'].default_value = 0.02
wn.links.new(wsep.outputs['Z'], wmr.inputs['Value'])
wmix = wn.nodes.new('ShaderNodeMix')
wmix.data_type = 'RGBA'
wmix.inputs['A'].default_value = (0.62, 0.7, 0.76, 1)  # horizon haze
wn.links.new(wmr.outputs['Result'], wmix.inputs['Factor'])
wn.links.new(sky.outputs['Color'], wmix.inputs['B'])
wn.links.new(wmix.outputs['Result'], wn.nodes['Background'].inputs['Color'])
wn.nodes['Background'].inputs['Strength'].default_value = 0.22

# ---------------------------------------------------------------- camera: water-level orbit around the surfer
cam = bpy.data.cameras.new('Cam')
cam.lens = 32
cam.sensor_width = 36
cam_ob = bpy.data.objects.new('Cam', cam)
scene.collection.objects.link(cam_ob)
scene.camera = cam_ob
target = Vector((SURFER_X + 0.6 * H + a.look, fy - 0.15 * H, fz + 0.35 * SURFER_H))

w, h = (int(v) for v in a.size.split('x'))
r = scene.render
r.engine = 'CYCLES'
r.resolution_x, r.resolution_y = w, h
r.image_settings.file_format = 'JPEG'
r.image_settings.quality = 84
cy = scene.cycles
cy.device = 'GPU'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.refresh_devices()
for d in prefs.devices:
    d.use = d.type == 'METAL'
cy.samples = a.samples
cy.use_denoising = True
cy.max_bounces = 8
cy.transmission_bounces = 8
cy.caustics_reflective = False
cy.caustics_refractive = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -0.2

radius = 4.2 + 3.4 * H


def surface_z(x, y):
    """Highest water surface at (x, y), from the cross-section there (enough to keep the camera out of the wave)."""
    c, amp, _ = along(x)
    pr = profile(c, amp)
    zs = [(pz - FLAT) * K for px, pz in pr if abs(px * KY - y) < 0.6 + 0.2 * H]
    return max(zs) if zs else 0.3
if a.blend:
    bpy.ops.wm.save_as_mainfile(filepath=a.blend)
os.makedirs(a.out, exist_ok=True)
idx = range(a.angles) if not a.only else [int(v) for v in a.only.split(',')]
for i in idx:
    # angle 0 looks at the face from the channel, slightly down the line; then round
    th = math.radians(125 + 360 * i / a.angles)
    # smooth path: a water photographer in front of the face, rising to an aerial view where the orbit crosses the
    # crest line (looking down the line) and behind the wave, so no frame sits inside or flush with the water
    along_ = abs(math.cos(th)) ** 2
    behind = max(0.0, -math.sin(th))
    rr = radius * (1.0 + 0.3 * along_)
    pos = Vector((target.x + rr * math.cos(th), target.y + rr * math.sin(th), 0))
    pos.z = 0.9 + 0.35 * H + along_ * (1.0 + 1.3 * H) + behind * 1.1 * H
    pos.z = max(pos.z, surface_z(pos.x, pos.y) + 0.8 + 0.3 * H)
    cam_ob.location = pos
    cam_ob.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
    r.filepath = f'{a.out}/a{i:02d}.jpg'
    bpy.ops.render.render(write_still=True)
    if i == a.poster:
        import shutil
        shutil.copyfile(r.filepath, f'{a.out}/poster.jpg')
print('DONE', a.out)
