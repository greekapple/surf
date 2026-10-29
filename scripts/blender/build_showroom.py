"""SWELLO showroom backplate: a sunlit concrete-and-glass room, rendered with Cycles.

Run:  blender -b --python scripts/blender/build_showroom.py -- [--preview] [--samples N] [--out DIR]

Outputs (default public/showroom/): showroom-wide.webp, showroom-tall.webp, room.json.
The boards are NOT in the render: three.js draws them live over this image with the exact same camera
(room.json: position, forward, up, vertical fov, slot positions, sun direction), a ShadowMaterial floor and faint reflections.
Units are metres, Z up. room.json converts to three.js (inches, Y up): (x, y, z) -> (x, z, -y) * 39.3701.
"""
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = '--preview' in argv
SAMPLES = int(argv[argv.index('--samples') + 1]) if '--samples' in argv else (24 if PREVIEW else 160)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(ROOT, 'public', 'showroom')
os.makedirs(OUT, exist_ok=True)

random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
M2I = 39.3701

# ------------------------------------------------------------------ geometry constants
HX, Y0, Y1, H = 3.7, -6.0, 3.2, 4.4          # room half-width, front, back wall, ceiling height
SLOT = 0.8                                  # distance between stands
STAND_H, PED_H = 0.08, 0.20                 # top of stand plinth / pedestal
CAM = Vector((0.0, -4.75, 1.42)); TARGET = Vector((0.0, 0.0, 1.2)); FOV = 40.0
SUN_DIR = Vector((0.5, 0.55, -0.66)).normalized()   # direction the light travels

# ------------------------------------------------------------------ materials
def mat(name, color, rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    for k, v in kw.items(): b.inputs[k.replace('_', ' ').title().replace('Ior','IOR')].default_value = v
    return m

def tex_mix(m, c1, c2, scale=6.0, detail=8.0, bump=0.25, rough=None, noise_type='noise'):
    """Colour variation + bump from one noise texture (object coordinates)."""
    nt = m.node_tree; n = nt.nodes; l = nt.links; b = n['Principled BSDF']
    tc = n.new('ShaderNodeTexCoord'); no = n.new('ShaderNodeTexNoise'); no.inputs['Scale'].default_value = scale; no.inputs['Detail'].default_value = detail
    l.new(tc.outputs['Object'], no.inputs['Vector'])
    mx = n.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs[6].default_value = (*c1, 1); mx.inputs[7].default_value = (*c2, 1)
    l.new(no.outputs['Fac'], mx.inputs[0]); l.new(mx.outputs[2], b.inputs['Base Color'])
    bp = n.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = 0.01
    l.new(no.outputs['Fac'], bp.inputs['Height']); l.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

concrete = tex_mix(mat('Concrete', (0.6, 0.58, 0.54), 0.86), (0.52, 0.5, 0.46), (0.68, 0.65, 0.6), scale=5, bump=0.35)
concrete_l = tex_mix(mat('ConcreteLight', (0.72, 0.7, 0.66), 0.8), (0.66, 0.64, 0.6), (0.78, 0.76, 0.71), scale=4, bump=0.2)
bronze = mat('Frame', (0.07, 0.065, 0.06), 0.35, 0.9)
sofa_m = mat('Sofa', (0.74, 0.68, 0.58), 0.95, sheen_weight=0.4)
cushion_m = mat('Cushion', (0.82, 0.78, 0.7), 0.95)
pot_m = mat('Pot', (0.8, 0.77, 0.7), 0.65)
soil_m = mat('Soil', (0.05, 0.04, 0.03), 1.0)
leaf_a = mat('LeafA', (0.12, 0.3, 0.1), 0.45, subsurface_weight=0.15)
leaf_b = mat('LeafB', (0.2, 0.38, 0.12), 0.45, subsurface_weight=0.15)
stone = mat('PedestalStone', (0.9, 0.88, 0.84), 0.25, specular_ior_level=0.6)
slats_m = mat('Slats', (0.55, 0.4, 0.26), 0.55)

def wood_mat(name, base=(0.66, 0.5, 0.32)):
    m = mat(name, base, 0.42); nt = m.node_tree; n = nt.nodes; l = nt.links; b = n['Principled BSDF']
    tc = n.new('ShaderNodeTexCoord'); wv = n.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Z'
    wv.inputs['Scale'].default_value = 7; wv.inputs['Distortion'].default_value = 3; wv.inputs['Detail'].default_value = 3
    l.new(tc.outputs['Object'], wv.inputs['Vector'])
    mx = n.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs[6].default_value = (*[c * 0.78 for c in base], 1); mx.inputs[7].default_value = (*base, 1)
    l.new(wv.outputs['Fac'], mx.inputs[0]); l.new(mx.outputs[2], b.inputs['Base Color'])
    bp = n.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.1; l.new(wv.outputs['Fac'], bp.inputs['Height']); l.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
oak = wood_mat('Oak')
beam_m = wood_mat('Beam', (0.5, 0.36, 0.22))

# polished stone floor: big tiles, hairline joints, glossy
floor_m = mat('Floor', (0.72, 0.67, 0.6), 0.1, specular_ior_level=0.7)
nt = floor_m.node_tree; n = nt.nodes; l = nt.links; b = n['Principled BSDF']
tc = n.new('ShaderNodeTexCoord'); br = n.new('ShaderNodeTexBrick'); br.offset = 0.0
br.inputs['Scale'].default_value = 1.0; br.inputs['Brick Width'].default_value = 1.2; br.inputs['Row Height'].default_value = 1.2
br.inputs['Mortar Size'].default_value = 0.004; br.inputs['Mortar Smooth'].default_value = 0.0
br.inputs['Color1'].default_value = (0.74, 0.69, 0.62, 1); br.inputs['Color2'].default_value = (0.69, 0.64, 0.57, 1); br.inputs['Mortar'].default_value = (0.35, 0.32, 0.28, 1)
l.new(tc.outputs['Object'], br.inputs['Vector']); l.new(br.outputs['Color'], b.inputs['Base Color'])
no = n.new('ShaderNodeTexNoise'); no.inputs['Scale'].default_value = 3; no.inputs['Detail'].default_value = 6; l.new(tc.outputs['Object'], no.inputs['Vector'])
mr = n.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.07; mr.inputs['To Max'].default_value = 0.2; l.new(no.outputs['Fac'], mr.inputs['Value']); l.new(mr.outputs['Result'], b.inputs['Roughness'])

glass = bpy.data.materials.new('Glass'); glass.use_nodes = True
gn = glass.node_tree.nodes; gl = glass.node_tree.links; gb = gn['Principled BSDF']
gb.inputs['Transmission Weight'].default_value = 1.0; gb.inputs['Roughness'].default_value = 0.0; gb.inputs['IOR'].default_value = 1.45; gb.inputs['Base Color'].default_value = (0.95, 0.98, 0.97, 1)
lp = gn.new('ShaderNodeLightPath'); tr = gn.new('ShaderNodeBsdfTransparent'); mxs = gn.new('ShaderNodeMixShader'); out = gn['Material Output']
gl.new(lp.outputs['Is Shadow Ray'], mxs.inputs[0]); gl.new(gb.outputs['BSDF'], mxs.inputs[1]); gl.new(tr.outputs['BSDF'], mxs.inputs[2]); gl.new(mxs.outputs['Shader'], out.inputs['Surface'])

# ------------------------------------------------------------------ primitives
def box(name, c, s, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c); o = bpy.context.object; o.name = name; o.scale = s; o.data.materials.append(m)
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = 2
    return o

def cyl(name, c, r, h, m, r2=None, verts=24):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2, depth=h, location=c); o = bpy.context.object; o.name = name
    o.data.materials.append(m); return o

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); bpy.context.object.name = name; return bpy.context.object

# ------------------------------------------------------------------ architecture
box('Floor', (0, (Y0 + Y1) / 2, -0.05), (2 * HX, Y1 - Y0, 0.1), floor_m)
box('Ceiling_front', (0, (Y0 + 0.5) / 2, H + 0.1), (2 * HX, 0.5 - Y0, 0.2), concrete_l)
box('Ceiling_back', (0, (2.6 + Y1) / 2, H + 0.1), (2 * HX, Y1 - 2.6, 0.2), concrete_l)
box('Ceiling_l', (-(HX + 0.2) / 2 - 2.4, 1.55, H + 0.1), (HX - 2.6 + 0.2 + 0.0, 2.1, 0.2), concrete_l)
box('Ceiling_r', ((HX + 0.2) / 2 + 2.4, 1.55, H + 0.1), (HX - 2.6 + 0.2 + 0.0, 2.1, 0.2), concrete_l)
# skylight rafters (x in -2.6..2.6, y 0.5..2.6)
for i in range(9):
    box('Rafter', (-2.4 + i * 0.6, 1.55, H - 0.07), (0.07, 2.1, 0.14), beam_m, 0.004)
for j in (0.6, 1.55, 2.5):
    box('RafterX', (0, j, H - 0.04), (5.2, 0.05, 0.08), beam_m, 0.003)
# back wall: lower solid + clerestory band (frame) + upper
box('BackWall_lo', (0, Y1 + 0.15, 1.45), (2 * HX + 0.4, 0.3, 2.9), concrete)
box('BackWall_hi', (0, Y1 + 0.15, 4.12), (2 * HX + 0.4, 0.3, 0.56), concrete)
for i in range(7): box('ClereMull', (-3.6 + i * 1.2, Y1 - 0.02, 3.56), (0.07, 0.1, 0.86), bronze)
box('ClereSill', (0, Y1 - 0.02, 2.93), (2 * HX, 0.1, 0.06), bronze)
# right wall with oak slat panel
box('RightWall', (HX + 0.15, (Y0 + Y1) / 2, H / 2), (0.3, Y1 - Y0, H), concrete)
for i in range(28): box('Slat', (HX - 0.03, 0.2 + i * 0.1, 1.3), (0.05, 0.06, 2.4), slats_m, 0.003)
# left wall: curtain of full-height windows (openings, bronze mullions)
box('LeftWall_sill', (-HX - 0.15, (Y0 + Y1) / 2, 0.2), (0.3, Y1 - Y0, 0.4), concrete)
box('LeftWall_lintel', (-HX - 0.15, (Y0 + Y1) / 2, 4.1), (0.3, Y1 - Y0, 0.6), concrete)
box('LeftWall_pier', (-HX - 0.15, Y1 - 0.0, 2.2), (0.3, 0.5, 3.8), concrete)
for i in range(10): box('Mullion', (-HX + 0.02, -5.4 + i * 0.95, 2.3), (0.09, 0.06, 3.6), bronze)
box('Transom', (-HX + 0.02, (Y0 + Y1) / 2, 3.0), (0.09, Y1 - Y0, 0.06), bronze)
box('Transom2', (-HX + 0.02, (Y0 + Y1) / 2, 0.42), (0.09, Y1 - Y0, 0.05), bronze)
box('FrontWall', (0, Y0 - 0.15, H / 2), (2 * HX + 0.6, 0.3, H), concrete)

# ------------------------------------------------------------------ stands, pedestal, glass case
for k in range(-3, 4):
    x = k * SLOT
    if k == 0: continue
    parts = [box('plinth', (x, 0.0, STAND_H / 2), (0.5, 0.36, STAND_H), oak, 0.006),
             box('lip', (x, -0.15, STAND_H + 0.02), (0.5, 0.025, 0.04), oak, 0.004),
             box('railL', (x - 0.17, 0.12, 0.3), (0.03, 0.03, 0.5), oak, 0.004), box('railR', (x + 0.17, 0.12, 0.3), (0.03, 0.03, 0.5), oak, 0.004),
             box('bar', (x, 0.12, 0.5), (0.4, 0.03, 0.03), oak, 0.004)]
    join(parts, f'Stand{k}')
box('Pedestal', (0, 0, PED_H / 2), (1.0, 0.7, PED_H), stone, 0.01)
CW, CD, CH = 1.12, 0.86, 3.05
cz = CH / 2 + 0.0
for sx in (-1, 1):
    for sy in (-1, 1): box('CaseCol', (sx * CW / 2, sy * CD / 2, cz), (0.035, 0.035, CH), bronze)
for z in (0.02, CH):
    for sy in (-1, 1): box('CaseRailX', (0, sy * CD / 2, z), (CW, 0.035, 0.035), bronze)
    for sx in (-1, 1): box('CaseRailY', (sx * CW / 2, 0, z), (0.035, CD, 0.035), bronze)
box('CaseGlassF', (0, -CD / 2, cz), (CW, 0.01, CH), glass); box('CaseGlassB', (0, CD / 2, cz), (CW, 0.01, CH), glass)
box('CaseGlassL', (-CW / 2, 0, cz), (0.01, CD, CH), glass); box('CaseGlassR', (CW / 2, 0, cz), (0.01, CD, CH), glass); box('CaseGlassT', (0, 0, CH), (CW, CD, 0.01), glass)

# ------------------------------------------------------------------ sofas and plants
def sofa(x, y, w, yaw=0):
    parts = [box('seat', (x, y, 0.22), (w, 0.9, 0.3), sofa_m, 0.05), box('back', (x, y + 0.4, 0.55), (w, 0.2, 0.55), sofa_m, 0.05),
             box('armL', (x - w / 2 + 0.1, y, 0.38), (0.2, 0.9, 0.5), sofa_m, 0.05), box('armR', (x + w / 2 - 0.1, y, 0.38), (0.2, 0.9, 0.5), sofa_m, 0.05)]
    for i in range(2): parts.append(box('cush', (x - w / 4 + i * w / 2, y - 0.02, 0.43), (w / 2 - 0.25, 0.7, 0.14), cushion_m, 0.05))
    for i in range(3): parts.append(box('leg', (x - w / 2 + 0.2 + i * (w - 0.4) / 2, y, 0.04), (0.06, 0.7, 0.08), bronze))
    join(parts, 'Sofa')
sofa(2.15, 2.6, 2.1); sofa(-0.2, 2.75, 1.6)
box('Rug', (0.5, 1.4, 0.006), (4.4, 2.4, 0.012), mat('Rug', (0.78, 0.72, 0.62), 1.0))
box('Table', (1.6, 1.6, 0.18), (0.9, 0.6, 0.36), oak, 0.01)

def plant(x, y, h, spread, pot_r=0.22, n=46, mats=(leaf_a, leaf_b), tall=False):
    objs = [cyl('pot', (x, y, 0.28), pot_r, 0.56, pot_m, r2=pot_r * 0.72), cyl('soil', (x, y, 0.55), pot_r * 0.96, 0.03, soil_m)]
    for i in range(n):
        a = random.uniform(0, 2 * math.pi); r = random.uniform(0.0, 0.07)
        t = random.random()
        base = Vector((x + math.cos(a) * r, y + math.sin(a) * r, 0.56 + t * h * (0.55 if tall else 0.25)))
        out = random.uniform(0.35, 1.0) * spread; up = random.uniform(0.5, 1.0) * (1.4 if tall else 0.8)
        d = Vector((math.cos(a) * out, math.sin(a) * out, up)).normalized()
        length = random.uniform(0.28, 0.5) * (1.0 if not tall else 1.2); width = length * random.uniform(0.28, 0.4)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, location=base + d * length / 2); o = bpy.context.object
        o.scale = (width / 2, length / 2, 0.012); o.rotation_euler = d.to_track_quat('Y', 'Z').to_euler(); o.data.materials.append(random.choice(mats)); objs.append(o)
    bpy.context.view_layer.update()
    join(objs, 'Plant')
plant(-3.0, 1.0, 1.1, 0.9, 0.26, 70, tall=True)
plant(3.0, 0.4, 0.9, 0.8, 0.22, 52, tall=True)
plant(-1.8, 2.6, 0.9, 0.6, 0.18, 36, tall=True)
plant(-2.4, 1.9, 0.35, 0.8, 0.2, 40)

# ------------------------------------------------------------------ lights
sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 6.0; sun.angle = math.radians(1.6); sun.color = (1.0, 0.9, 0.76)
so = bpy.data.objects.new('Sun', sun); bpy.context.collection.objects.link(so); so.rotation_euler = SUN_DIR.to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('Sky'); w.use_nodes = True; scene.world = w
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.78, 0.86, 1.0, 1); bg.inputs['Strength'].default_value = 2.4

# ------------------------------------------------------------------ camera
cam = bpy.data.cameras.new('Cam'); cam.sensor_fit = 'VERTICAL'; cam.angle = math.radians(FOV); cam.clip_start = 0.1
co = bpy.data.objects.new('Cam', cam); bpy.context.collection.objects.link(co); co.location = CAM
co.rotation_euler = (TARGET - CAM).to_track_quat('-Z', 'Y').to_euler(); scene.camera = co
bpy.context.view_layer.update()
fwd = co.matrix_world.to_quaternion() @ Vector((0, 0, -1)); up = co.matrix_world.to_quaternion() @ Vector((0, 1, 0))
t3 = lambda v: [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]
info = {
    'units': 'inches, three.js Y-up', 'fovY': FOV, 'position': [round(c * M2I, 3) for c in t3(CAM)], 'forward': t3(fwd), 'up': t3(up),
    'sunToward': t3(-SUN_DIR), 'slot': round(SLOT * M2I, 3), 'slots': 7, 'standH': round(STAND_H * M2I, 3), 'pedH': round(PED_H * M2I, 3),
    'wallZ': round(-Y1 * M2I, 2), 'plates': {'wide': [2400, 1350], 'tall': [1080, 1350]},
}
with open(os.path.join(OUT, 'room.json'), 'w') as f: json.dump(info, f, indent=1)

# ------------------------------------------------------------------ render
c = scene.cycles; scene.render.engine = 'CYCLES'; c.samples = SAMPLES; c.use_denoising = True; c.denoiser = 'OPENIMAGEDENOISE'
c.max_bounces = 8; c.transmission_bounces = 8; c.glossy_bounces = 6; c.caustics_reflective = False; c.caustics_refractive = False
c.sample_clamp_indirect = 10.0
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = True
    c.device = 'GPU'
except Exception as e: print('GPU unavailable:', e)
scene.view_settings.view_transform = 'AgX'; scene.view_settings.exposure = 0.2
try: scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
scene.render.image_settings.file_format = 'WEBP'; scene.render.image_settings.quality = 80
k = 0.35 if PREVIEW else 1.0
for name, (w_, h_) in info['plates'].items():
    scene.render.resolution_x = int(w_ * k); scene.render.resolution_y = int(h_ * k); scene.render.resolution_percentage = 100
    scene.render.filepath = os.path.join(OUT, f'showroom-{name}.webp')
    bpy.ops.render.render(write_still=True)
    print('wrote', scene.render.filepath)
