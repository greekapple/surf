"""SWELLO wave scale (T-036): build a peeling surf wave at true size and render orbit angles.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/blender/wave_scene.py -- \
      --face 1.5 --out /tmp/wave --angles 24 [--surfer path/to/surfer.glb] [--size 1280x720] [--samples 32]

Units are metres. --face is the wave face height (trough to crest) in metres; the surfer is scaled to 1.75 m tall,
so the picture is a scale illustration, not a simulation of any real wave.
"""
import argparse
import math
import sys

import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--face', type=float, default=1.5)
ap.add_argument('--out', default='/tmp/wave')
ap.add_argument('--angles', type=int, default=24)
ap.add_argument('--surfer', default='')
ap.add_argument('--size', default='1280x720')
ap.add_argument('--samples', type=int, default=32)
ap.add_argument('--only', type=int, default=-1, help='render a single angle index (for previews)')
ap.add_argument('--blend', default='', help='also save the .blend here')
a = ap.parse_args(argv)

H = a.face
SURFER_H = 1.75

# ---------- reset ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def profile(t, curl, h):
    """Cross-shore wave profile at parameter t in [0, 1] (seaward trough -> crest -> lip), returns (y, z).
    curl in [0, 1]: 0 = unbroken swell face, 1 = pitching lip. y grows toward the beach."""
    # back of the wave: gentle rise from the seaward trough to the crest
    if t < 0.55:
        u = t / 0.55
        y = -3.2 * h + u * 3.2 * h
        z = h * (0.5 - 0.5 * math.cos(math.pi * u)) ** 1.3
        return y, z
    # front: crest, then the face falling toward the beach, with the lip throwing forward by `curl`
    u = (t - 0.55) / 0.45
    ang = u * (math.pi * (0.55 + 0.9 * curl))
    r = h * (0.55 + 0.25 * curl)
    cy, cz = 0.15 * h * curl, h - r
    y = cy + r * math.sin(ang) * (1.0 + 0.6 * curl)
    z = cz + r * math.cos(ang)
    # without curl the face drops steeply but stays a height field
    if curl < 0.05:
        y = u * 1.4 * h
        z = h * (1 - u) ** 1.6
    return y, max(z, -0.02 * h)


def build_wave(length, slices, samples, h):
    """Sweep the profile along x; the breaking point peels from +x toward -x (left to right for a viewer offshore)."""
    me = bpy.data.meshes.new('wave')
    bm = bmesh.new()
    rows = []
    for i in range(slices + 1):
        x = -length / 2 + length * i / slices
        s = (x + length / 2) / length            # 0 .. 1 along the wave
        curl = max(0.0, min(1.0, (s - 0.35) / 0.3))  # open shoulder at -x, pitching around the middle, broken at +x
        hh = h * (1.0 - 0.35 * max(0.0, s - 0.75) / 0.25)
        row = []
        for j in range(samples + 1):
            y, z = profile(j / samples, curl, hh)
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for i in range(slices):
        for j in range(samples):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('Wave', me)
    scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def water_material():
    m = bpy.data.materials.new('Water')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.04
    bsdf.inputs['IOR'].default_value = 1.333
    bsdf.inputs['Transmission Weight'].default_value = 0.35
    # colour by height: deep blue-green in the trough, light jade where the face thins near the crest
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mapr = nt.nodes.new('ShaderNodeMapRange')
    mapr.inputs['From Min'].default_value = 0.0
    mapr.inputs['From Max'].default_value = H
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.004, 0.03, 0.05, 1)
    ramp.color_ramp.elements[1].color = (0.03, 0.22, 0.22, 1)
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], mapr.inputs['Value'])
    nt.links.new(mapr.outputs['Result'], ramp.inputs['Fac'])
    # foam: noise masked by curvature-ish (pointiness is Cycles-only, so use height + noise)
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.0
    noise.inputs['Detail'].default_value = 8.0
    fr = nt.nodes.new('ShaderNodeValToRGB')
    fr.color_ramp.elements[0].position = 0.55
    fr.color_ramp.elements[1].position = 0.62
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['B'].default_value = (0.92, 0.95, 0.96, 1)
    nt.links.new(noise.outputs['Fac'], fr.inputs['Fac'])
    nt.links.new(fr.outputs['Color'], mix.inputs['Factor'])
    nt.links.new(ramp.outputs['Color'], mix.inputs['A'])
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    # small surface chop
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    wn = nt.nodes.new('ShaderNodeTexNoise')
    wn.inputs['Scale'].default_value = 9.0
    nt.links.new(wn.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def ocean_plane(mat):
    bpy.ops.mesh.primitive_plane_add(size=1)
    ob = bpy.context.object
    ob.name = 'Sea'
    mod = ob.modifiers.new('Ocean', 'OCEAN')
    mod.size = 6.0
    mod.spatial_size = 120
    mod.resolution = 10
    mod.wave_scale = 0.12
    mod.choppiness = 1.0
    ob.location = (0, -60, -0.05)
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def placeholder_surfer():
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=SURFER_H - 0.3)
    body = bpy.context.object
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0, 0, (SURFER_H - 0.3) / 2 + 0.15))
    head = bpy.context.object
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    head.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = 'Surfer'
    m = bpy.data.materials.new('Wetsuit')
    m.diffuse_color = (0.02, 0.02, 0.02, 1)
    body.data.materials.append(m)
    return body


def import_surfer(path):
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.context.selected_objects]
    root = bpy.data.objects.new('Surfer', None)
    scene.collection.objects.link(root)
    for o in objs:
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    zs = [ (o.matrix_world @ Vector(c)).z for o in objs if o.type == 'MESH' for c in o.bound_box]
    height = max(zs) - min(zs) if zs else 1.0
    s = SURFER_H / height  # the model includes the board; close enough for a scale reference
    root.scale = (s, s, s)
    bpy.context.view_layer.update()
    zs = [ (o.matrix_world @ Vector(c)).z for o in objs if o.type == 'MESH' for c in o.bound_box]
    root.location.z -= min(zs)
    return root


# ---------- build ----------
water = water_material()
wave = build_wave(length=max(40.0, 14 * H), slices=220, samples=90, h=H)
wave.data.materials.append(water)
sea = ocean_plane(water)
sea.scale = (max(200, 60 * H), 120, 1)

bpy.ops.mesh.primitive_plane_add(size=1)
shallow = bpy.context.object
shallow.name = 'Inside'
shallow.scale = (max(200, 60 * H), 80, 1)
shallow.location = (0, 40, 0.02)
shallow.data.materials.append(water)
sand_m = bpy.data.materials.new('Sand')
sand_m.use_nodes = True
sand_m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.62, 0.55, 0.45, 1)
bpy.ops.mesh.primitive_plane_add(size=1)
sand = bpy.context.object
sand.scale = (max(200, 60 * H), 60, 1)
sand.location = (0, 110, 0.4)
sand.data.materials.append(sand_m)

surfer = import_surfer(a.surfer) if a.surfer else placeholder_surfer()
# surfer on the open face just ahead of the curl, about 45% up the face, angled down the line
sx = -0.12 * max(40.0, 14 * H)
fy, fz = profile(0.75, 0.0, H)
surfer.location = (sx, fy * 0.6, H * 0.42)
surfer.rotation_euler = (math.radians(-25), 0, math.radians(-75))

# sky + sun
world = bpy.data.worlds.new('Sky')
scene.world = world
world.use_nodes = True
sky = world.node_tree.nodes.new('ShaderNodeTexSky')
try:
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(18)
    sky.sun_rotation = math.radians(200)
except Exception:
    pass
world.node_tree.links.new(sky.outputs['Color'], world.node_tree.nodes['Background'].inputs['Color'])
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35
sun = bpy.data.lights.new('Sun', 'SUN')
sun.energy = 3.0
sun_ob = bpy.data.objects.new('Sun', sun)
sun_ob.rotation_euler = (math.radians(55), 0, math.radians(200))
scene.collection.objects.link(sun_ob)

# camera on an orbit around the surfer, from the channel side
cam = bpy.data.cameras.new('Cam')
cam.lens = 35
cam_ob = bpy.data.objects.new('Cam', cam)
scene.collection.objects.link(cam_ob)
scene.camera = cam_ob
target = bpy.data.objects.new('Target', None)
target.location = (sx, fy * 0.6, H * 0.45)
scene.collection.objects.link(target)
tc = cam_ob.constraints.new('TRACK_TO')
tc.target = target
tc.track_axis = 'TRACK_NEGATIVE_Z'
tc.up_axis = 'UP_Y'

# render settings
w, h = (int(v) for v in a.size.split('x'))
r = scene.render
r.resolution_x, r.resolution_y = w, h
r.image_settings.file_format = 'JPEG'
r.image_settings.quality = 82
try:
    r.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    r.engine = 'BLENDER_EEVEE'
try:
    scene.eevee.taa_render_samples = a.samples
    scene.eevee.use_raytracing = True
except Exception:
    pass
scene.view_settings.view_transform = 'AgX'

radius = 6.0 + 4.5 * H
elev = 0.35 + 0.25 * H
if a.blend:
    bpy.ops.wm.save_as_mainfile(filepath=a.blend)
idx = range(a.angles) if a.only < 0 else [a.only]
for i in idx:
    # start offshore looking at the face (angle 0 = straight in from the channel), go round
    th = math.radians(200 + 360 * i / a.angles)
    cam_ob.location = (target.location.x + radius * math.cos(th), target.location.y + radius * math.sin(th), elev)
    r.filepath = f'{a.out}/a{i:02d}.jpg'
    bpy.ops.render.render(write_still=True)
print('DONE', a.out)
