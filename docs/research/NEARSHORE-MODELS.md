# Nearshore wave models for spots outside CDIP MOP

Written 2026-11-10 (research and test fetches only; no `src/` change). Question: where can SWELLO get a real modelled wave height close to the break for the 417 of 492 spots that have no CDIP MOP point (all of Hawaii, the US Atlantic coast, Oregon/Washington and 13 California spots)?

Per-spot numbers: [`data/nearshore-coverage.csv`](data/nearshore-coverage.csv) (one row per spot, 492 rows). Draft wiring: [`../specs/DRAFT-nearshore-wiring.md`](../specs/DRAFT-nearshore-wiring.md).

## Verdict

| source | spots it reaches (of the 417 without MOP) | resolution | access | verdict |
|---|---|---|---|---|
| **PacIOOS SWAN** (UH, Hawaii) | **152 of 152 Hawaii spots** have a wet model cell within 640 m of the pin (151 within 500 m; median 236 m) | ~500 m (0.005°) | ERDDAP griddap, JSON/CSV point subsetting, no decoding | **Use first.** Smallest wiring job, complete Hawaii coverage, depth available from PacIOOS 50 m bathymetry on the same server. |
| **NWS NWPS** (NOAA, 31 coastal WFO domains) | Atlantic/OR/WA/CA (265 spots): **79** within 500 m of a wet cell on a nested grid (≤1 km); **99** within 500 m of a point on the 5 m depth contour (rip file); **148** within 500 m of either; 260 within 2 km of a coarse CG1 cell (1.8–4 km, not nearshore). Hawaii: 91 of 152 on a 500 m nest. | CG1 1.0–4.0 km; nests 0.05–1.25 km; 5 m-contour points ~0.5–2 km apart | NOMADS GRIB2 (grib filter subsets by variable and box) and plain-text point files | **Second.** The only nearshore model on the East Coast. Text point files need no GRIB decoder; GRIB nests are simple-packed (easy to decode). The grid layout changed yesterday (v1.5), so cell choices must be re-checked per run. |
| **CariCOOS SWAN** (Puerto Rico, USVI) | **0** (SWELLO has no Puerto Rico or USVI spots) | 120 m (PR), 1 km regional | ERDDAP griddap | Works; keep for a future Puerto Rico catalogue. |
| NERACOOS / SECOORA / MARACOOS / GCOOS | 0 | — | — | No nearshore wave model found on their servers (see below). The Gulf of Maine and Mid-Atlantic are covered by NWPS BOX/GYX/OKX/PHI/AKQ instead. |

How the counts were made: for each spot pin (`src/data/coast.ts`, `src/ocean/spots.ts`; the pins are approximate public map positions), the distance to the nearest **wet** model cell (a cell with a wave height at the first forecast hour; land and dry cells are missing values) on each grid. I measured from the beach pin, not from the "marine point": that point is deliberately ~9 km seaward (`marinePoint` in `src/data/coast.ts`) and every model reaches it. "Within 500 m" is a reach test only: it does **not** say the nearest wet cell is a good cell for the break (it may be in a bay, behind a reef, or inside the surf zone). Choosing a cell per spot is a separate, reviewed step (see the spec). NWPS grids at 4.5 km or coarser (wind-only and duplicate coarse runs) were ignored.

## 1. NOAA NWS Nearshore Wave Prediction System (NWPS)

**What it is.** SWAN run by each coastal NWS Weather Forecast Office (WFO), driven by the forecasters' own wind grids, with WAVEWATCH III boundaries, RTOFS currents and STOFS/P-SURGE water levels (NCEP EMC NWPS page). Runs are on demand, triggered by the WFO. Version 1.5 became operational on **2026-11-09 12Z** (Service Change Notice 26-91): 12 WFOs (EKA, LOX, LWX, BRO, LCH, LIX, PQR, MTR, MFR and three in Alaska) now compute on unstructured meshes and interpolate back to the regular CG grids; rip-current and runup products were extended to LOX, MTR, EKA, MFR, PQR, SEW, SGX, BRO, LCH, LIX and CRP; the Grays Harbor nest moved from PQR to SEW; EKA gained a 0.05 km Humboldt Bay spit nest; the nested-grid spectral point files of the unstructured domains were discontinued.

**Domains and grids (read from today's files, 2026-11-10).** NOMADS region directories: `ar` (Alaska), `er` (East), `sr` (South incl. Gulf, Florida, San Juan), `wr` (West), `pr` (Pacific: HFO, GUM), `ofs` (forcing). WFOs with output today: ER AKQ, BOX, CAR, CHS, GYX, ILM, LWX, MHX, OKX, PHI; SR BRO, CRP, HGX, JAX, KEY, LCH, LIX, MFL, MLB, MOB, SJU, TAE, TBW; WR EKA, LOX, MFR, MTR, PQR, SEW, SGX; PR GUM, HFO. Grid geometry below comes from the first GRIB2 message of each file (byte-range read of the latest cycle). CG1 is the whole domain; CG2–CG5 are nests (the numbering differs by office; some offices' CG3/CG4/CG5 are coarse wind-only or duplicate runs, shown at ~5 km).

| WFO | cycle read | grids (resolution, extent, full file size) | 5 m rip file | 20 m runup file |
|---|---|---|---|---|
| AKQ | 12z | CG1 1.81×1.80 km (35.80–39.50N, 77.30–74.25W; 62 MB) | yes | yes |
| BOX | 12z | CG1 2.00×2.01 km (40.45–43.25N, 72.50–68.85W; 46 MB); CG2 0.50×0.50 km (41.90–43.20N, 71.20–70.30W; 67 MB) | yes | yes |
| BRO | 12z | CG1 1.81×1.80 km (25.26–28.26N, 98.00–95.41W; 53 MB) | yes | yes |
| CAR | 12z | CG1 1.80×1.80 km (43.30–45.05N, 69.20–66.30W; 28 MB); CG2 0.10×0.10 km (44.27–44.42N, 68.17–67.96W; 51 MB); CG3 0.10×0.10 km (44.16–44.30N, 68.42–68.22W; 43 MB) | yes | yes |
| CHS | 12z | CG1 1.80×1.80 km (30.67–33.58N, 81.70–78.10W; 66 MB); CG2 0.51×0.51 km (32.61–32.83N, 80.01–79.61W; 7 MB); CG3 0.50×0.50 km (31.88–32.38N, 81.13–80.44W; 25 MB) | yes | yes |
| CRP | 12z | CG1 1.80×1.80 km (26.00–29.50N, 98.50–95.00W; 72 MB) | yes | yes |
| EKA | 12z | CG1 4.03×4.02 km (38.40–42.20N, 126.27–123.35W; 14 MB); CG2 0.05×0.05 km (40.74–40.78N, 124.26–124.21W; 14 MB); CG3 5.08×5.02 km (38.40–42.20N, 126.27–123.35W; 8 MB) | yes | yes |
| GYX | 12z | CG1 2.50×2.50 km (42.40–44.70N, 71.75–67.85W; 23 MB); CG2 0.10×0.10 km (43.76–43.93N, 70.64–70.46W; 21 MB); CG3 0.10×0.10 km (43.47–43.73N, 71.50–71.19W; 48 MB) | yes | yes |
| HFO | 12z | CG1 2.70×2.70 km (18.07–23.09N, 161.50–153.90W; 98 MB); CG2 0.50×0.50 km (21.55–22.40N, 160.04–159.09W; 54 MB); CG3 0.50×0.50 km (21.20–21.81N, 158.35–157.60W; 27 MB); CG4 0.50×0.50 km (20.40–21.40N, 156.90–155.90W; 65 MB); CG5 0.50×0.50 km (19.40–19.90N, 155.20–154.60W; 17 MB) | yes | no |
| HGX | 12z | CG1 1.80×1.80 km (27.00–30.50N, 97.40–93.37W; 65 MB); CG2 0.50×0.50 km (29.00–29.80N, 95.18–94.46W; 31 MB) | yes | yes |
| ILM | 12z | CG1 2.50×2.50 km (32.50–34.80N, 80.40–76.50W; 28 MB) | yes | yes |
| JAX | 12z | CG1 1.80×1.80 km (28.70–32.00N, 81.70–79.30W; 43 MB); CG2 0.51×0.50 km (30.93–31.29N, 81.47–81.25W; 5 MB); CG3 0.20×0.20 km (30.62–30.78N, 81.49–81.26W; 15 MB); CG4 0.20×0.21 km (30.38–30.43N, 81.43–81.36W; 1 MB); CG5 0.31×0.30 km (29.87–29.96N, 81.32–81.24W; 1 MB) | yes | yes |
| KEY | 12z | CG1 3.51×3.51 km (23.00–26.00N, 83.50–79.00W; 25 MB); CG2 1.00×1.00 km (24.30–25.40N, 83.20–80.10W; 78 MB) | yes | no |
| LCH | 12z | CG1 1.80×1.80 km (27.41–30.30N, 95.03–90.43W; 91 MB) | yes | yes |
| LIX | 12z | CG1 1.80×1.80 km (27.50–30.60N, 91.80–87.40W; 95 MB); CG2 1.25×1.26 km (29.30–30.40N, 90.60–88.80W; 24 MB) | yes | yes |
| LOX | 12z | CG1 4.02×4.01 km (32.60–36.10N, 123.36–117.30W; 26 MB); CG2 0.50×0.50 km (33.52–33.77N, 118.41–117.81W; 11 MB); CG3 5.01×5.05 km (32.60–36.10N, 123.36–117.30W; 15 MB) | yes | yes |
| LWX | 18z | CG1 2.01×2.01 km (36.75–39.70N, 77.80–75.40W; 15 MB) | no | no |
| MFL | 12z | CG1 2.00×2.00 km (24.10–27.70N, 83.54–78.41W; 105 MB); CG2 0.20×0.20 km (25.72–26.00N, 80.20–80.03W; 18 MB); CG3 0.50×0.50 km (26.67–27.23N, 81.13–80.57W; 11 MB); CG4 0.20×0.20 km (26.72–27.00N, 80.14–79.98W; 14 MB); CG5 0.20×0.20 km (26.00–26.32N, 80.14–80.00W; 22 MB) | yes | yes |
| MFR | 12z | CG1 2.00×2.00 km (41.00–44.45N, 127.30–123.65W; 61 MB); CG2 0.40×0.40 km (43.15–43.75N, 124.70–124.10W; 35 MB); CG3 0.50×0.50 km (42.22–43.03N, 125.10–124.25W; 45 MB); CG4 0.30×0.30 km (42.00–42.15N, 124.45–124.18W; 6 MB); CG5 5.01×5.04 km (41.00–44.45N, 127.30–123.65W; 9 MB) | yes | yes |
| MHX | 12z | CG1 1.80×1.81 km (33.85–36.60N, 78.00–74.75W; 53 MB); CG2 0.51×0.50 km (36.00–36.30N, 75.80–75.50W; 7 MB); CG3 0.05×0.05 km (36.00–36.05N, 75.68–75.63W; 12 MB); CG4 0.51×0.50 km (34.40–34.77N, 77.27–76.90W; 10 MB); CG5 0.09×0.09 km (34.60–34.68N, 77.15–77.00W; 28 MB) | yes | yes |
| MLB | 12z | CG1 1.81×1.80 km (26.50–30.00N, 81.40–78.51W; 68 MB); CG2 0.50×0.50 km (28.20–28.80N, 80.80–80.30W; 25 MB) | yes | yes |
| MOB | 12z | CG1 1.80×1.80 km (28.50–31.00N, 89.10–85.90W; 54 MB); CG2 0.75×0.75 km (30.15–30.85N, 88.45–87.65W; 15 MB); CG3 0.76×0.76 km (30.08–30.55N, 87.68–87.20W; 7 MB); CG4 0.75×0.75 km (30.10–30.65N, 87.32–86.78W; 9 MB); CG5 0.75×0.75 km (30.15–30.55N, 86.80–86.07W; 10 MB) | yes | yes |
| MTR | 12z | CG1 2.50×2.50 km (35.00–39.40N, 125.80–120.74W; 69 MB); CG2 1.00×1.00 km (37.30–38.40N, 123.30–122.30W; 19 MB); CG3 0.50×0.50 km (36.20–37.00N, 122.20–121.70W; 27 MB); CG4 2.50×2.50 km (35.00–39.40N, 125.80–120.74W; 62 MB) | yes | yes |
| OKX | 12z | CG1 1.80×1.81 km (39.75–41.40N, 74.45–71.05W; 26 MB); CG2 0.50×0.50 km (40.40–40.73N, 74.30–73.82W; 7 MB); CG3 1.00×1.03 km (40.54–40.80N, 73.78–72.78W; 3 MB); CG4 1.00×1.00 km (40.83–41.37N, 72.75–71.69W; 7 MB) | yes | yes |
| PHI | 18z | CG1 1.80×1.80 km (38.20–40.60N, 75.75–73.35W; 31 MB); CG2 1.00×1.00 km (38.50–39.85N, 75.70–74.65W; 19 MB); CG3 1.01×1.00 km (39.40–40.40N, 74.60–73.80W; 12 MB) | yes | yes |
| PQR | 14z | CG1 2.00×2.01 km (43.50–47.15N, 126.28–123.30W; 48 MB); CG2 0.50×0.50 km (46.59–46.79N, 124.24–123.99W; 3 MB); CG3 0.51×0.50 km (46.13–46.38N, 124.20–123.95W; 4 MB); CG4 0.51×0.50 km (45.37–45.77N, 124.20–123.90W; 8 MB); CG5 5.00×5.00 km (43.50–47.15N, 126.28–123.30W; 7 MB) | yes | yes |
| SEW | 12z | CG1 1.00×1.00 km (46.10–49.42N, 127.00–121.91W; 262 MB); CG2 0.25×0.25 km (46.84–47.01N, 124.26–124.10W; 7 MB); CG3 5.02×5.05 km (46.10–49.42N, 127.00–121.91W; 10 MB) | yes | yes |
| SGX | 12z | CG1 2.01×2.01 km (32.08–33.82N, 119.00–116.50W; 17 MB); CG2 0.12×0.12 km (32.68–32.89N, 117.34–117.24W; 22 MB); CG3 5.04×5.09 km (31.95–33.60N, 119.20–116.90W; 2 MB) | yes | yes |
| SJU | 12z | CG1 1.80×1.80 km (17.00–19.50N, 68.00–64.00W; 73 MB); CG2 1.00×1.00 km (17.55–18.80N, 67.40–64.40W; 82 MB); CG3 0.10×0.10 km (18.33–18.52N, 67.30–67.10W; 71 MB) | yes | no |
| TAE | 12z | CG1 1.80×1.80 km (28.35–30.60N, 87.35–82.60W; 69 MB); CG2 0.60×0.61 km (29.95–30.37N, 85.87–85.37W; 9 MB); CG3 0.60×0.61 km (29.60–29.95N, 85.46–84.85W; 10 MB); CG4 0.60×0.61 km (29.85–30.15N, 84.50–83.65W; 12 MB); CG5 0.75×0.76 km (29.00–29.60N, 83.55–82.75W; 15 MB) | yes | yes |
| TBW | 12z | CG1 1.80×1.80 km (25.45–29.70N, 84.80–81.50W; 93 MB); CG2 0.35×0.35 km (27.48–28.05N, 83.20–82.38W; 72 MB) | yes | yes |

**Variables.** The grib filter for CG1 lists: HTSGW (significant wave height), PERPW (peak period), DIRPW (peak direction), SWELL/SWPER/SWDIR (swell), WIND/WDIR, DIRC/SPC (currents), DSLM (water level), RIPCOP (rip probability, where produced). Swell partitions (tracked wave systems) are in the separate CG0 "trkng" file. The v1.5 notice adds runup/erosion/overwash fields to CG1 in 11 domains.

**Horizon, cadence, latency.** 145 hourly steps (0–144 h) in every file read. Cycles seen today: 00, 12, 14 (PQR), 18 (PHI); the notice lists 00/06/12/18 as possible cycles, and runs are on demand, so a WFO may skip one. The 12Z files were posted between 15:41 UTC (ILM, JAX) and 19:35 UTC (LOX), i.e. **3.7–7.6 h after cycle time**; HFO 12Z GRIB 17:23–17:34. NOMADS keeps 5 days (directories 2026-11-06…10 listed).

**Access.**
- Raw files: `https://nomads.ncep.noaa.gov/pub/data/nccf/com/nwps/prod/{region}.YYYYMMDD/{wfo}/{CC}/CG{n}/nwps.t{CC}z.cg{n}.{wfo}.grib2`, 1.5–98 MB each. No `.idx` files.
- **NOMADS grib filter** (server-side subsetting by variable and lat/lon box, returns GRIB2): `https://nomads.ncep.noaa.gov/cgi-bin/filter_{region}nwps.pl?dir=%2F{region}.YYYYMMDD%2F{wfo}%2F{CC}%2FCG{n}&file=…&var_HTSGW=on&var_PERPW=on&var_DIRPW=on&lev_surface=on&subregion=&leftlon=…&rightlon=…&toplat=…&bottomlat=…`. It cannot select forecast hours.
- Plain-text point files on CG1: `nwps.t{CC}z.5m_cg1_ripprob.{wfo}.txt` (every WFO above except LWX) and `nwps.t{CC}z.20m_cg1_runup.{wfo}.txt` (all except HFO, KEY, LWX, SJU).
- No OPeNDAP/THREDDS or ERDDAP for NWPS: NOMADS OPeNDAP now answers "OpenDAP format has been retired. Please see Service Change Notice 25-81" (checked 2026-11-10), and no other server was found. polar.ncep.noaa.gov distribution ends with v1.5 (SCN 26-91).
- HTTP/2 to NOMADS fails from curl here (malformed `content-length` header); HTTP/1.1 works. A Worker `fetch` should be checked for the same.

**Encoding.** GRIB2 `grid_simple` packing with a bitmap (checked on HFO CG1) — no JPEG2000/PNG, so a reader in a Worker is a small hand-written decoder (sections 3/5/6/7, simple packing, bitmap), not a library port.

**Licence.** US Government work (NWS/NCEP); no copyright. NOMADS publishes no rate figure on the pages read; the tests ran at ≤1 request/s.

**Test results (2026-11-10, UA "SWELLO surf forecast prototype").**
1. Listed `prod/`, each region's day directory, and each WFO's latest cycle (≈90 requests at 1/s): all 200.
2. Grib filter, HFO 12Z CG1, HTSGW+PERPW+DIRPW, box 21.62–21.70 N, 158.10–158.00 W (Pipeline): **200, 81,659 bytes, 1.6 s**, 435 messages = 3 variables × 145 hours, 4 × 3 cells at 0.02559° × 0.02437°. First hour, cell 21.677 N 158.045 W: HTSGW 2.50 m. (A 2.7 km CG1 cell, shown only to prove the read; not a nearshore value.)
3. First ~700 KB of every CG file (97 files across 31 WFOs) for grid geometry and land mask: all 206 (partial content).
4. Rip file, HFO 12Z (2.4 MB): 189 points along the 5 m contour of Oahu (21.25–21.72 N), each with 145 hourly rows: `DATE Xp Yp Prob Hs pp mwdsn tide event`; first row 2026-11-10 12Z at 21.2882 N 157.664 W: rip probability 84.1 %, Hs 1.70 m, peak period 7.9 s, mwdsn −27.4°. Fixed 93-byte lines. 18 more WFO rip files downloaded (70 MB total): 117–673 points per office, median spacing 0.5 km (SGX) to 2.0 km (JAX, MFL, MHX). MLB has duplicate point rows (144–146 rows per position).
5. Runup file, MHX 12Z (first 3 KB): fixed 322-character rows with Hs, peak period, beach slope, total water level, runup, setup, swash, dune crest/toe, overwash/erosion probabilities; the header says "X,Y locations refer to shoreline location projected from the 20m contour".

**Open questions (not answered by any page read).** (a) Whether the runup file's Hs is the value at the 20 m contour (the header implies it; confirm with NWPS/NCO before using it as a depth-known input). (b) The exact meaning of `mwdsn` (reads as mean wave direction relative to shore normal). (c) Whether the 5 m-contour points are fixed between cycles (they must be, for a per-spot point table; check across several cycles).

**Spot coverage (spots without MOP, outside Hawaii; 265).** "Nest" = nearest wet cell on a grid of ≤1 km; "5 m point" = nearest point in the rip file; "CG1 ≤2 km" = the coarse domain grid only.

| region | spots | nest cell ≤500 m | 5 m point ≤500 m | 5 m point ≤1 km | either ≤500 m | CG1 cell ≤2 km |
|---|---|---|---|---|---|---|
| Space Coast | 46 | 11 | 22 | 46 | 25 | 46 |
| Northeast Florida | 32 | 11 | 14 | 26 | 24 | 32 |
| Outer Banks | 31 | 8 | 10 | 25 | 14 | 31 |
| Northern New Jersey | 24 | 6 | 8 | 24 | 12 | 24 |
| Southern North Carolina | 23 | 3 | 4 | 19 | 6 | 23 |
| Southeast Florida | 21 | 16 | 8 | 19 | 17 | 21 |
| South Carolina | 15 | 8 | 0 | 0 | 8 | 15 |
| New York | 13 | 2 | 9 | 13 | 9 | 13 |
| Virginia | 9 | 0 | 9 | 9 | 9 | 9 |
| Georgia | 8 | 7 | 0 | 0 | 7 | 8 |
| Treasure Coast | 8 | 0 | 3 | 8 | 3 | 8 |
| Southern New Jersey | 4 | 0 | 2 | 4 | 2 | 4 |
| Massachusetts | 2 | 2 | 2 | 2 | 2 | 2 |
| Rhode Island | 2 | 0 | 0 | 0 | 0 | 2 |
| Oregon/Washington (9 counties) | 14 | 3 | 2 | 7 | 3 | 13 |
| California without MOP | 13 | 2 | 6 | 13 | 6 | 11 |
| **total** | **265** | **79** | **99** | **215** | **148** | **260** |

California without MOP (13): Princeton Jetty, Pigeon Point, Scott Creek, Natural Bridges, Andrew Molera, Shell Beach, Hammond's, Campus Point, Leadbetter, Mondos, Leo Carrillo, Bolsa Chica, Doheny. Every one has a 5 m-contour point within 1 km (MTR, LOX or SGX); only Andrew Molera (MTR CG3, 490 m) and Bolsa Chica (LOX CG2, 216 m) have a nest cell within 500 m. LOX CG1 is now 4 km.

Hawaii on NWPS (HFO): nests CG2 Kauai, CG3 Oahu, CG4 Maui County, CG5 a 0.5° box off east Hawaii Island (all 0.5 km). 91 of 152 Hawaii spots have a nest cell within 500 m; the rip file covers Oahu only. PacIOOS is better here.

## 2. PacIOOS SWAN regional models (Hawaii)

**What it is.** SWAN nested in PacIOOS's Hawaii WAVEWATCH III (`ww3_hawaii`), run by Kwok Fai Cheung (University of Hawaii); "7-day output with a 5-day hourly forecast … at approximately 500-m resolution … to capture shallow water effects and nearshore coastal dynamics such as refracting, shoaling, and smaller scale shadowing"; "some of the nested model setup is still in the testing and validation phase" (dataset summaries).

| dataset id (+ `_lon180` twin) | area | lat range | lon range (°E) | cells | wet cells |
|---|---|---|---|---|---|
| `swan_oahu` | Oahu | 21.20–21.75 | 201.65–202.40 | 111 × 151 | 11,340 |
| `swan_maui` | Maui, Molokai, Lanai, Kahoolawe | 20.40–21.30 | 202.60–204.10 | 181 × 301 | 43,864 |
| `swan_bigi` | Hawaii Island | 18.85–20.35 | 203.80–205.30 | 301 × 301 | 54,629 |
| `swan_kauai` | Kauai, Niihau | 21.70–22.35 | 199.65–200.80 | 131 × 231 | 24,511 |

Resolution 0.005° (≈ 520 m × 555 m). Variables: `shgt` significant wave height (m), `pper` peak period, `mper` mean period, `pdir` peak direction, `mdir` mean direction (degrees, "from"). Hourly. Archive from 2010-06-20. Time axis read today ends **2026-11-16T18:00Z**. Run time: "run directly after" `ww3_hawaii`; no issue time is published in the metadata, so the reader has to detect a new run from `time_coverage_end`. Other PacIOOS SWAN grids exist for Guam, Saipan, Rota, Palau, Apra Harbor and American Samoa (no SWELLO spots).

**Access.** `https://pae-paha.pacioos.hawaii.edu/erddap/griddap/swan_oahu_lon180.json?shgt[(start):1:(last)][0][(lat)][(lon)],pper[…],pdir[…]` — ERDDAP does the subsetting and returns JSON/CSV, so nothing to decode. Same ERDDAP serves `hmrg_bathytopo_50m_mhi` (Main Hawaiian Islands multibeam synthesis, 50 m), which gives a depth for any chosen cell.

**Licence.** "The data may be used and redistributed for free but is not intended for legal use … [no] warranty …". Acknowledgement requested: PacIOOS, funded by NOAA as an IOOS Regional Association, coordinated by UH SOEST. Fine for SWELLO with a credit line.

**Test results (2026-11-10).**
1. Dataset metadata for the four islands: 200.
2. `swan_oahu_lon180` `shgt[(last)][0][(21.65):1:(21.68)][(-158.07):1:(-158.04)]` (Pipeline): **200, 2,514 bytes, 0.99 s**; 2026-11-16T18Z values 1.34–1.86 m, NaN on land cells (e.g. 21.665 N 158.050 W and east).
3. Full `shgt` field at 2026-11-11T00Z for each island (.nc, 76–373 KB) to build the wet-cell mask.
4. `hmrg_bathytopo_50m_mhi` `z[(21.665)][(-158.055)]`: **−8.04 m** (the wet SWAN cell nearest Pipeline is about 8 m deep on the 50 m bathymetry; the SWAN cell itself averages a 500 m square).

**Spot coverage.** All 152 Hawaii spots have a wet cell within 640 m of the pin; 151 within 500 m (exception: Honolii Point, 638 m); median 236 m. By region: Maui 32/32, Big Island 30/31 (+1 at 638 m), Oahu North Shore 22/22, Oahu South Shore 22/22, Kauai 20/20, Oahu East Side 9/9, Oahu West Side 6/6, Molokai 5/5, Lanai 4/4, Niihau 1/1.

## 3. Other IOOS regional models (East Coast, Gulf, Caribbean)

- **CariCOOS SWAN** (UPR, Miguel Canals), ERDDAP `https://dm3.caricoos.org/erddap/`: `SWAN_HighRes_PR` (120 m, 17.8–18.6 N, 67.5–65.1 W, `hs`/`tp`/`dir`, ~3-hourly, 2024-11-09 → 2026-11-14T12Z) and `swan_1km_caricoos` (1 km PR+USVI, "run twice daily", `Hsig`/`Hswell`/`Per`/`Dir`, to 2026-11-15T00Z). Same free-use/no-warranty licence wording. Test: `SWAN_HighRes_PR` hs at 2026-11-14T12Z, 18.350 N 67.300 W (off Rincón) **0.93 m**; the cells at 18.36 N 67.27 W are NaN (land). NWPS SJU (CG3 at 0.1 km off western Puerto Rico) also covers Puerto Rico. **0 SWELLO spots** today.
- **NERACOOS**: its ERDDAP (`data.neracoos.org/erddap`) has no gridded datasets at all ("no datasets with protocol=griddap"). The Bedford Institute WAVEWATCH III Gulf of Maine forecast listed in catalogues (`erddap.riddc.brown.edu … WW3_72_GulfOfMaine_latest`) returned 404; it is a regional WW3, not a nearshore model, in any case.
- **SECOORA**: `erddap.secoora.org` lists 3 gridded datasets, none of them waves.
- **MARACOOS, GCOOS**: no nearshore wave model found in web searches. Not exhaustive; NWPS covers both coasts regardless.

## Data-honesty notes for any use

- These are **models**, not measurements, and none is the break: a 500 m SWAN cell averages its square; NWPS nests are interpolated from unstructured meshes in 12 domains; a cell inside the surf zone already carries SWAN's depth-limited breaking, so its height is not comparable to MOP's 10–15 m point. Choose cells by depth (target 8–20 m, like MOP), not by distance alone.
- NWPS is forecaster-driven (local wind grids): it can differ run to run from the global models for reasons that are not wave physics; show the issuing office and run time.
- PacIOOS warns parts of the nested setup are still being validated. Neither source has been checked against a Hawaii or East Coast buoy by us yet (the spec's first calibration step).

## Sources

- NWPS: NOMADS directory `https://nomads.ncep.noaa.gov/pub/data/nccf/com/nwps/prod/`; grib filter `https://nomads.ncep.noaa.gov/gribfilter.php?ds=prnwps`; NCEP EMC NWPS page `https://www.emc.ncep.noaa.gov/emc/pages/numerical_forecast_systems/nwps.php`; Service Change Notice 26-91 `https://www.weather.gov/media/notification/pdf_2026/scn26-91_nwps_1.5.0.pdf`.
- PacIOOS: `https://pae-paha.pacioos.hawaii.edu/erddap/info/swan_oahu/index.html` (and `swan_maui`, `swan_bigi`, `swan_kauai`, `hmrg_bathytopo_50m_mhi`); `https://www.pacioos.hawaii.edu/waves/model-oahu/`.
- CariCOOS: `https://dm3.caricoos.org/erddap/info/SWAN_HighRes_PR/index.html`, `…/swan_1km_caricoos/index.html`.
- NERACOOS `https://data.neracoos.org/erddap/`; SECOORA `https://erddap.secoora.org/erddap/`.
