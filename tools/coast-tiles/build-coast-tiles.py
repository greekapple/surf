#!/usr/bin/env python3
"""forecast-visuals (2026-11-13): the coastline tiles behind the swell and wind direction tiles on the spot page.

Source: OpenStreetMap land polygons (osmdata.openstreetmap.de, "land-polygons-split-4326", derived from the OSM natural=coastline ways;
data (c) OpenStreetMap contributors, ODbL 1.0). Nothing is drawn by hand: for each California spot the land inside a 5 km square around the
pin is clipped from those polygons, projected to metres around the pin (x east, y north), simplified to about 25 m and stored as rings of
integers on a 0..1000 grid (1000 = the tile's width).

Usage (needs pyshp and shapely, e.g. in a scratch venv):
  node --experimental-strip-types tools/coast-tiles/ca-spots.ts > ca-spots.json
  python3 build-coast-tiles.py <land_polygons.shp> ca-spots.json src/data/coastTiles.json
"""
import json, math, sys, datetime
import shapefile
from shapely.geometry import Polygon, MultiPolygon, box, shape
from shapely.strtree import STRtree
from shapely.ops import transform, unary_union

HALF_M = 2500          # the tile is 5 km across, centred on the pin
SIMPLIFY_M = 25        # simplified to about 25 m (a schematic, not a chart)
GRID = 1000            # coordinates as integers 0..GRID across the tile
CA = (-125.5, 32.2, -116.8, 42.2)   # lon/lat box around the California coast

shp_path, spots_path, out_path = sys.argv[1:4]
spots = json.load(open(spots_path))

# land polygons that touch the California box
r = shapefile.Reader(shp_path)
polys = []
for sr in r.iterShapes():
    x0, y0, x1, y1 = sr.bbox
    if x1 < CA[0] or x0 > CA[2] or y1 < CA[1] or y0 > CA[3]:
        continue
    g = shape(sr.__geo_interface__)
    if not g.is_valid:
        g = g.buffer(0)
    polys.append(g)
tree = STRtree(polys)
print(f"{len(polys)} land polygons in the California box", file=sys.stderr)

def tile_for(s):
    lat, lon = s["lat"], s["lon"]
    k = math.cos(math.radians(lat))
    dlat, dlon = HALF_M / 111_320, HALF_M / (111_320 * k)
    win = box(lon - dlon, lat - dlat, lon + dlon, lat + dlat)
    land = [polys[i].intersection(win) for i in tree.query(win)]
    land = [g for g in land if not g.is_empty]
    land = [unary_union(land)] if land else []   # the split polygons meet along their split lines: merge them so no seam is drawn
    # to metres around the pin, then to the 0..GRID grid (y down, as in SVG)
    to_m = lambda x, y, z=None: ((x - lon) * 111_320 * k, (y - lat) * 111_320)
    rings, area = [], 0.0
    for g in land:
        gm = transform(to_m, g).simplify(SIMPLIFY_M, preserve_topology=True)
        for p in (gm.geoms if isinstance(gm, MultiPolygon) else [gm] if isinstance(gm, Polygon) else []):
            if p.is_empty or p.area < (SIMPLIFY_M * 2) ** 2:
                continue
            area += p.area
            for ring in [p.exterior, *p.interiors]:
                pts = []
                for x, y in ring.coords[:-1]:
                    q = [round((x + HALF_M) / (2 * HALF_M) * GRID), round((HALF_M - y) / (2 * HALF_M) * GRID)]
                    if not pts or pts[-1] != q:
                        pts.append(q)
                if len(pts) >= 3:
                    rings.append([v for q in pts for v in q])   # flat [x0, y0, x1, y1, ...]; holes (lakes, lagoons) are rings too, drawn even-odd
    share = area / (2 * HALF_M) ** 2
    return rings, share

out, empty, full = {}, [], []
for s in spots:
    rings, share = tile_for(s)
    if not rings:
        empty.append(s["id"])            # no land within 2.5 km: the tile shows only the facing line
        continue
    if share > 0.985:
        full.append(s["id"])             # the pin is inland of the OSM coast by more than 2.5 km: not usable as a coast tile
        continue
    out[s["id"]] = {"rings": rings, "land": round(share, 3)}

doc = {
    "source": "OpenStreetMap land polygons (osmdata.openstreetmap.de land-polygons-split-4326, from natural=coastline), (c) OpenStreetMap contributors, ODbL 1.0",
    "licence": "ODbL 1.0: this file is a derivative of OpenStreetMap data and is under the same licence",
    "built": datetime.date.today().isoformat(),
    "tool": "tools/coast-tiles/build-coast-tiles.py",
    "tileMetres": 2 * HALF_M, "simplifiedMetres": SIMPLIFY_M, "grid": GRID,
    "note": "Land inside a 5 km square centred on the spot's pin, north up, y down, simplified: a schematic, not a chart. Rings are flat [x, y, ...] lists, filled even-odd.",
    "tiles": out,
}
json.dump(doc, open(out_path, "w"), separators=(",", ":"))
print(f"{len(out)} tiles; no land within 2.5 km: {len(empty)} {empty[:8]}; inland pins: {len(full)} {full[:8]}", file=sys.stderr)
