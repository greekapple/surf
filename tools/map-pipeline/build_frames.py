#!/usr/bin/env python3
"""Swello map pipeline (Stage 2b): NOAA GFS-Wave 0.25 degree -> packed PNG frames + manifest.

Reads the public GFS-Wave GRIB2 files on AWS Open Data (noaa-gfs-bdp-pds, no account, no key), fetches ONLY the
messages we need with HTTP byte ranges from the .idx file, decodes them with ecCodes, and writes, per forecast hour:

  <out>/run=<YYYYMMDDHH>/<group>-fNNN.png     1440 x 721 RGB, row 0 = 90N, column 0 = 0E (0.25 degree)
  <out>/manifest.json                          what the client needs (run time, valid times, scales, nodata)

Groups (each PNG carries one scalar and one direction):
  waves    R,G = Hs total sea (HTSGW)            B = direction FROM (DIRPW)
  period   R,G = peak period (PERPW)             B = direction FROM (DIRPW)
  swell    R,G = primary swell height (SWELL:1)  B = direction FROM (SWDIR:1)
  swellper R,G = primary swell period (SWPER:1)  B = direction FROM (SWDIR:1)
  wind     R,G = 10 m speed from u/v             B = direction FROM (computed from u/v)

R,G are a 16-bit value (R high byte, G low byte) = round(value * scale); 65535 = no data (land, ice, outside the model).
B is the direction in 360/255 degree steps; 255 = none. RGB only (no alpha), so browsers cannot premultiply the data.
Never writes credentials; reads a public bucket.

Usage:  python3 build_frames.py --out ./frames [--run 2026110318] [--hours 0-120/3] [--groups waves,period,swell,swellper,wind]
Needs:  python3, numpy, pillow, eccodes (python bindings + the ecCodes library).
"""
import argparse, datetime as dt, io, json, os, re, sys, urllib.request
import numpy as np
from PIL import Image
import eccodes

BUCKET = "https://noaa-gfs-bdp-pds.s3.amazonaws.com"
NLON, NLAT = 1440, 721
# name in the .idx -> (key, level text must contain)
WANT = {"HTSGW": None, "PERPW": None, "DIRPW": None, "UGRD": None, "VGRD": None,
        "SWELL": "1 in sequence", "SWPER": "1 in sequence", "SWDIR": "1 in sequence"}
SCALES = {"waves": 1000.0, "period": 1000.0, "swell": 1000.0, "swellper": 1000.0, "wind": 500.0}  # value * scale -> 0..65534
GROUPS = {"waves": ("HTSGW", "DIRPW"), "period": ("PERPW", "DIRPW"), "swell": ("SWELL", "SWDIR"),
          "swellper": ("SWPER", "SWDIR"), "wind": ("UGRD", "VGRD")}
UNITS = {"waves": "m", "period": "s", "swell": "m", "swellper": "s", "wind": "m/s"}


def get(url, rng=None, tries=3):
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={"Range": rng} if rng else {})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 - retried, then raised
            last = e
    raise last


def latest_run(now=None):
    """The newest run whose last file of interest exists: probe the 4 most recent cycles."""
    now = now or dt.datetime.now(dt.timezone.utc)
    for back in range(0, 30, 6):
        t = (now - dt.timedelta(hours=back)).replace(minute=0, second=0, microsecond=0)
        t = t.replace(hour=(t.hour // 6) * 6)
        url = f"{BUCKET}/gfs.{t:%Y%m%d}/{t:%H}/wave/gridded/gfswave.t{t:%H}z.global.0p25.f000.grib2.idx"
        try:
            get(url)
            return t
        except Exception:  # noqa: BLE001
            continue
    raise SystemExit("no GFS-Wave run found in the last 30 hours")


def parse_idx(text):
    """-> list of (name, level, start, end_or_None) with byte offsets from a wgrib2-style .idx."""
    rows = [l.split(":") for l in text.strip().splitlines()]
    out = []
    for i, r in enumerate(rows):
        start = int(r[1])
        end = int(rows[i + 1][1]) - 1 if i + 1 < len(rows) else None
        out.append((r[3], r[4], start, end))
    return out


def fetch_fields(run, fh):
    base = f"{BUCKET}/gfs.{run:%Y%m%d}/{run:%H}/wave/gridded/gfswave.t{run:%H}z.global.0p25.f{fh:03d}.grib2"
    idx = parse_idx(get(base + ".idx").decode())
    fields = {}
    for name, level, start, end in idx:
        if name not in WANT or (WANT[name] and WANT[name] not in level):
            continue
        blob = get(base, f"bytes={start}-{end}" if end is not None else f"bytes={start}-")
        h = eccodes.codes_new_from_message(blob)
        try:
            ni, nj = eccodes.codes_get(h, "Ni"), eccodes.codes_get(h, "Nj")
            vals = eccodes.codes_get_values(h).reshape(nj, ni)
            miss = eccodes.codes_get(h, "missingValue")
            vals = np.where(np.isclose(vals, miss) | (np.abs(vals) > 1e9), np.nan, vals)
            if eccodes.codes_get(h, "jScansPositively"):
                vals = vals[::-1]  # make row 0 the northern edge
            if (nj, ni) != (NLAT, NLON):
                raise SystemExit(f"unexpected grid {nj}x{ni} for {name}")
            fields[name] = vals.astype(np.float64)
        finally:
            eccodes.codes_release(h)
    return fields


def pack(scalar, direction, scale):
    rgb = np.zeros((NLAT, NLON, 3), dtype=np.uint8)
    q = np.where(np.isfinite(scalar) & (scalar >= 0), np.minimum(np.round(scalar * scale), 65534), 65535).astype(np.uint16)
    rgb[..., 0], rgb[..., 1] = q >> 8, q & 255
    d = np.where(np.isfinite(direction), np.round((direction % 360.0) * 255.0 / 360.0), 255).astype(np.uint8)
    d = np.where(q == 65535, 255, d)
    rgb[..., 2] = d
    buf = io.BytesIO()
    Image.fromarray(rgb, "RGB").save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def frame_images(fields, groups):
    out = {}
    for g in groups:
        a, b = GROUPS[g]
        if g == "wind":
            u, v = fields.get("UGRD"), fields.get("VGRD")
            if u is None or v is None:
                continue
            speed = np.hypot(u, v)
            direction = (np.degrees(np.arctan2(-u, -v)) + 360.0) % 360.0
            direction = np.where(speed < 0.05, np.nan, direction)  # calm air has no direction
            out[g] = pack(speed, direction, SCALES[g])
        else:
            if a not in fields:
                continue
            scalar = fields[a]
            if g == 'swell' and 'HTSGW' in fields:
                # GFS-Wave leaves the swell partition EMPTY where the sea is wind sea only (measured: |HTSGW - WVHGT| median 0.000 m over those cells). That is 'no swell partition', not missing data: swell height is 0 there. Real partitions are never exactly 0 (minimum seen 0.03 m), so an exact 0 in this group means 'no partition'.
                scalar = np.where(~np.isfinite(scalar) & np.isfinite(fields['HTSGW']), 0.0, scalar)
            out[g] = pack(scalar, fields.get(b, np.full((NLAT, NLON), np.nan)), SCALES[g])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--run", help="YYYYMMDDHH (default: newest available)")
    ap.add_argument("--hours", default="0-120/3", help="forecast hours first-last/step, e.g. 0-168/3")
    ap.add_argument("--groups", default=",".join(GROUPS))
    a = ap.parse_args()
    run = dt.datetime.strptime(a.run, "%Y%m%d%H").replace(tzinfo=dt.timezone.utc) if a.run else latest_run()
    m = re.fullmatch(r"(\d+)-(\d+)/(\d+)", a.hours)
    if not m:
        raise SystemExit("--hours must look like 0-120/3")
    hours = list(range(int(m[1]), int(m[2]) + 1, int(m[3])))
    groups = [g for g in a.groups.split(",") if g in GROUPS]
    rundir = os.path.join(a.out, f"run={run:%Y%m%d%H}")
    os.makedirs(rundir, exist_ok=True)
    frames = []
    for fh in hours:
        try:
            fields = fetch_fields(run, fh)
        except Exception as e:  # noqa: BLE001 - a missing hour is skipped and listed, never invented
            print(f"f{fh:03d}: skipped ({e})", file=sys.stderr)
            continue
        files = {}
        for g, png in frame_images(fields, groups).items():
            name = f"{g}-f{fh:03d}.png"
            with open(os.path.join(rundir, name), "wb") as fp:
                fp.write(png)
            files[g] = f"run={run:%Y%m%d%H}/{name}"
        frames.append({"fh": fh, "validAt": (run + dt.timedelta(hours=fh)).strftime("%Y-%m-%dT%H:%M:%SZ"), "files": files})
        print(f"f{fh:03d}: {', '.join(files)}")
    if not frames:
        raise SystemExit("no frames written")
    manifest = {
        "version": 1, "source": "NOAA NCEP GFS-Wave 0.25 degree (AWS Open Data, noaa-gfs-bdp-pds)",
        "run": run.strftime("%Y-%m-%dT%H:%M:%SZ"), "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "grid": {"nlon": NLON, "nlat": NLAT, "lon0": 0.0, "lat0": 90.0, "dlon": 0.25, "dlat": -0.25, "rowZero": "north"},
        "encoding": {"value": "R*256+G, divided by scale; 65535 = no data", "direction": "B*360/255 degrees FROM; 255 = none"},
        "groups": {g: {"scale": SCALES[g], "unit": UNITS[g], "scalar": GROUPS[g][0] if g != "wind" else "speed(UGRD,VGRD)",
                       "direction": GROUPS[g][1] if g != "wind" else "from(UGRD,VGRD)",
                       **({"noPartitionIsZero": True} if g == "swell" else {})} for g in groups},
        "frames": frames,
    }
    with open(os.path.join(a.out, "manifest.json"), "w") as fp:
        json.dump(manifest, fp, indent=1)
    print(f"manifest: run {manifest['run']}, {len(frames)} frames")


if __name__ == "__main__":
    main()
