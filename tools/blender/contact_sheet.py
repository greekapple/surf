"""Tile a folder of a00..aNN.jpg frames into one contact sheet (review aid). Run with Blender:
  blender -b --factory-startup --python tools/blender/contact_sheet.py -- <dir> <out.png> [cols]"""
import sys, glob, os
import bpy
argv = sys.argv[sys.argv.index('--') + 1:]
d, out = argv[0], argv[1]
cols = int(argv[2]) if len(argv) > 2 else 6
files = sorted(glob.glob(os.path.join(d, 'a[0-9][0-9].jpg')))
imgs = [bpy.data.images.load(f) for f in files]
w, h = imgs[0].size
rows = (len(imgs) + cols - 1) // cols
sheet = bpy.data.images.new('sheet', cols * w, rows * h)
px = [0.0] * (cols * w * rows * h * 4)
for k, im in enumerate(imgs):
    src = list(im.pixels)
    cx, cy = k % cols, rows - 1 - k // cols
    for y in range(h):
        o = ((cy * h + y) * cols * w + cx * w) * 4
        px[o:o + w * 4] = src[y * w * 4:(y + 1) * w * 4]
sheet.pixels = px
sheet.filepath_raw = out
sheet.file_format = 'PNG'
sheet.save()
print('SHEET', out, len(imgs))
