# Map pipeline: GFS-Wave 0.25° frames (Stage 2b)

Goal: a finer, faster, more reliable map field than live ERDDAP calls: **NOAA GFS-Wave 0.25°** (1440 × 721, ~28 km), published on AWS Open Data (`noaa-gfs-bdp-pds`, public, no account, no key). A small job turns each model run into packed PNG frames plus a manifest; the app reads them from a plain URL (Cloudflare R2 public bucket). No server work per user.

Status: the job (`tools/map-pipeline/build_frames.py`) and the client (`src/map/packedFrame.ts`, used by `loadGlobe` in `src/map/spatial.ts`) are built and tested locally. Nothing is deployed and no cloud account is used yet. Until `VITE_MAP_FRAMES_BASE` is set the map keeps using `/api/ocean` (WW3 0.5° via ERDDAP).

## What the job does
1. Finds the newest run (`gfs.YYYYMMDD/HH/wave/gridded/gfswave.tHHz.global.0p25.fNNN.grib2`, 4 runs a day) that exists.
2. For each forecast hour reads the `.idx` file and downloads **only the messages needed** with HTTP byte ranges (~3 MB of the ~11 MB file): `HTSGW` (Hs), `PERPW`/`DIRPW` (peak period, direction), `SWELL:1`/`SWPER:1`/`SWDIR:1` (primary swell partition), `UGRD`/`VGRD` (10 m wind).
3. Decodes them with ecCodes and writes, per hour, five 1440 × 721 RGB PNGs (`waves`, `period`, `swell`, `swellper`, `wind`): R,G = 16-bit value (65535 = no data), B = direction FROM in 360/255° steps. No alpha channel, so a browser can never premultiply the data. Wind speed and direction are computed from u/v (calm air gets no direction).
4. Writes `manifest.json`: run time, per-frame valid times, scales, units, grid, source. A missing hour is skipped and listed, never invented or shifted.

Measured locally (this machine): 8 s per forecast hour, ~0.7 MB per PNG, ~3.5 MB per hour for all five, so 0–168 h at 3-hourly (57 hours) ≈ 200 MB and ≈ 8 min per run. Decoded values agree with the WW3 0.5° ERDDAP value at the same point (Hs offshore San Francisco: 2.97 m vs 3.06 m).

Honesty notes (also in `docs/agents/CONTRACTS.md` terms): the swell groups are GFS-Wave's **primary swell partition**, not the WW3 "combined swell" the 0.5° path shows; the source text says so. When a packed frame is on screen the regional WW3 nest is not painted (it would blend a different model in). If the manifest lacks an hour, that hour falls back to `/api/ocean`, labelled WW3.

## Run it locally (works today)
```
brew install eccodes                      # once (macOS); Linux: apt-get install libeccodes-dev
python3 -m venv .venv && .venv/bin/pip install numpy pillow eccodes   # Python 3.11–3.13 recommended
.venv/bin/python tools/map-pipeline/build_frames.py --out ./frames --hours 0-120/3
mkdir -p public/map-frames && cp -R frames/. public/map-frames/      # git-ignored
VITE_MAP_FRAMES_BASE=/map-frames npm run dev -- --port 5185 --strictPort
```
(`/public/map-frames/` is git-ignored: the frames are generated, never committed. They are NOAA public-domain data, not licensed assets.)

## One-time steps for you (Cloudflare R2): about 10 minutes
1. In the Cloudflare dashboard create an **R2 bucket**, e.g. `swello-map-frames` (R2 → Create bucket). R2 has a free tier (10 GB storage, 1 M writes and 10 M reads a month, **no egress fees**); this job needs ≈ 200 MB stored and a few thousand writes a day, so expect **$0 per month**. Ask me before anything that could cost money.
2. Bucket → Settings → **Public access**: enable the `r2.dev` public URL (fine for testing) or connect a custom domain (recommended for production, e.g. `frames.<your-domain>`). Note the base URL; it goes in the app as `VITE_MAP_FRAMES_BASE`.
3. Bucket → Settings → **CORS policy**: allow `GET` from the app's origins (the production site and `http://127.0.0.1:5180`), header `*`, max age 3600.
4. R2 → Manage API tokens → create an **R2 API token** with *Object Read & Write* limited to that one bucket. Cloudflare shows an Access Key ID, a Secret Access Key and the account endpoint **once**.
5. Store them **only** as GitHub Actions secrets (repo → Settings → Secrets and variables → Actions): `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`), `R2_BUCKET`. Never paste them into a file, a chat or the repo; this repo is public. I will never ask you for the values.
6. Tell me the public base URL and that the secrets exist; I add the workflow (below) and set the app's `VITE_MAP_FRAMES_BASE` for production builds. Deploying to production still needs your explicit go.

## How it runs: recommendation = a GitHub Action on a schedule
- **GitHub Actions cron (recommended):** a scheduled workflow every 6 h at ~4 h 40 min after each run time (the GFS-Wave files land roughly 4–5 h after cycle start), runs the job on `ubuntu-latest` (`apt-get install libeccodes-dev`, `pip install numpy pillow eccodes`), uploads `frames/` to R2 with the S3 API (`aws s3 sync --endpoint-url "$R2_ENDPOINT"`), manifest **last** so the app never sees a half-written run, then removes runs older than 2 from the bucket. ≈ 10 minutes of runner time per run, ≈ 1,200 minutes a month: inside the free tier of GitHub-hosted runners for a public repo (unlimited minutes). Secrets are exposed only to that workflow.
- **Cloudflare Cron Trigger (alternative):** a Worker cannot run ecCodes (no native libraries, 128 MB memory, 30 s CPU) so the decode would have to move to a JS GRIB2 decoder (complex packing + JPEG2000 are not practical there) or to a Cloudflare Container. More moving parts for no gain now.
- **Local cron / your laptop:** works but the map would stall whenever the machine is off.

## What I need from you, and what I do
You: steps 1–5 above (R2 bucket, public access + CORS, token → GitHub secrets). Me, once the secrets exist: the workflow file, the retention clean-up, the production base URL, a verification that the live manifest's run is fresh, and the fallback behaviour (`/api/ocean`) if the manifest is older than 12 h.

## Cost estimate
R2 storage ≈ 0.2–0.4 GB (the latest two runs) ≈ $0; operations ≈ 6 k writes/day, reads scale with users (free tier 10 M/month, then $0.36 per million); egress free. GitHub Actions free for public repos. NOAA data free. Expected: **$0** at current scale.

## Not done yet (next stages)
Time interpolation between 3-hourly frames (Stage 5), GPU particles from these frames (Stage 4), the freshness fallback, and the workflow itself (needs the secrets).
