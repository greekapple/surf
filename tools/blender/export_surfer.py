"""Export the surfer once for the real-time viewer (T-062): feet at the origin, raw model units (the per-band JSON carries the
placement matrix that scales it to 1.75 m), textures downsized to 1024 px, mesh decimated for the web.
  blender -b --factory-startup --python tools/blender/export_surfer.py -- <in.glb> <out.glb> [ratio]"""
import sys
import bpy
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
ratio = float(argv[2]) if len(argv) > 2 else 0.35
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.selected_objects if o.type == 'MESH']
zs = [(o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box]
for o in objs:
    o.location.z -= min(zs)  # feet at the origin, matching wave_scene.import_surfer
    d = o.modifiers.new('dec', 'DECIMATE')
    d.ratio = ratio
for im in bpy.data.images:
    if im.size[0] > 1024:
        im.scale(1024, max(1, int(im.size[1] * 1024 / im.size[0])))
bpy.ops.object.select_all(action='DESELECT')
for o in objs:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_apply=True, export_image_format='JPEG', export_jpeg_quality=82)
print('SURFER', out, sum(len(o.data.polygons) for o in objs), 'faces before decimate')
