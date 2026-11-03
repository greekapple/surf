# Cold-load performance (T-091)

Measured with `~/Development/ai-system-setup/playwright-toolkit/swello/t091-perf.mjs` (profile helper: `t091-profile.mjs`); raw medians in `t091-before.json` / `t091-after.json`.

**Method.** A production `vite build` served with gzip (the live providers behind `/api` are the real ones, JSON gzipped like the edge does), a new browser context per run (empty cache), Chrome with Slow-4G throttling (1.6 Mbit/s down, 750 kbit/s up, 150 ms RTT; Lighthouse's mobile profile), CPU 4x on the 390 phone profile and 1x on the 1440 desktop, median of 3 runs. FCP/LCP from the browser's own observers; TBT = long-task time over 50 ms after FCP until 6 s after load (a TBT-like sum, not Lighthouse's exact figure); "data on screen" = first moment a surf height range appears in the page text; transferred bytes are CDP `encodedDataLength` (headers included).

**Caveats.** The server is HTTP/1.1 (browsers limit parallel connections per host; the real edge uses HTTP/2, so the 212-request fan-out is probably cheaper there than here); the `/api` calls and their upstreams are not throttled and vary run to run; LCP in this app is a late element (see below) so it is noisy; swiftshader/headless is not a phone GPU. Numbers compare before and after under identical conditions; they are not a field measurement.

## Results (median of 3)

### 1440 px (desktop, CPU 1x)

| screen | | FCP | LCP | data on screen | TBT | JS transferred | total transferred | requests (of which /api) |
|---|---|---|---|---|---|---|---|---|
| Home | before | 3.0 s | 15.9 s | 11.6 s | 2788 ms | 449 KB | 1877 KB | 225 (212) |
|  | after | 1.4 s | 14.1 s | 8.4 s | 71 ms | 178 KB | 1884 KB | 229 (212) |
| Spot page | before | 3.2 s | 12.2 s | 10.3 s | 449 ms | 449 KB | 1425 KB | 221 (212) |
|  | after | 1.4 s | 10.4 s | 8.4 s | 19 ms | 178 KB | 1134 KB | 226 (212) |
| Map | before | 3.0 s | 3.3 s | n/a | 353 ms | 449 KB | 1502 KB | 283 (216) |
|  | after | 1.4 s | 4.4 s | n/a | 34 ms | 421 KB | 1466 KB | 292 (216) |
| Wave scale | before | 3.0 s | 11.0 s | 10.2 s | 346 ms | 631 KB | 2122 KB | 264 (212) |
|  | after | 1.4 s | 10.1 s | 8.5 s | 35 ms | 366 KB | 1837 KB | 270 (212) |

### 390 px (phone, DPR 2, CPU 4x)

| screen | | FCP | LCP | data on screen | TBT | JS transferred | total transferred | requests (of which /api) |
|---|---|---|---|---|---|---|---|---|
| Home | before | 3.1 s | 16.3 s | 16.6 s | 6156 ms | 449 KB | 1315 KB | 222 (212) |
|  | after | 1.6 s | 11.4 s | 9.3 s | 984 ms | 178 KB | 1158 KB | 226 (212) |
| Spot page | before | 3.4 s | 12.9 s | 11.9 s | 1968 ms | 449 KB | 1244 KB | 221 (212) |
|  | after | 1.5 s | 10.1 s | 9.1 s | 433 ms | 178 KB | 953 KB | 226 (212) |
| Map | before | 3.5 s | 3.8 s | 12.0 s | 1604 ms | 449 KB | 1433 KB | 245 (216) |
|  | after | 1.5 s | 5.6 s | 9.8 s | 453 ms | 421 KB | 1397 KB | 254 (216) |
| Wave scale | before | 3.1 s | 12.6 s | 11.8 s | 1792 ms | 631 KB | 2278 KB | 266 (212) |
|  | after | 1.5 s | 9.9 s | 8.8 s | 267 ms | 366 KB | 1837 KB | 270 (212) |

## What changed (no behaviour change intended)
1. **Only Home is in the first bundle.** Forecast, Map, Quiver and Personal are `React.lazy` chunks (`src/app/App.tsx`); Forecast is prefetched when the browser is idle (about 22 KB gzip), Map and Quiver load on demand. The main chunk went from 1,467 kB (460 kB gzip) to 514 kB (158 kB gzip); the Map chunk (Leaflet, the 548 kB land-globe data, the coast data) is 754 kB (237 kB gzip) and no longer loads for Home, the Spot page or the Wave scale. Three.js, WaveLive, the board room and Spin360 were already lazy and still are.
2. **Main-thread work when the data arrives.** A CPU profile (`t091-profile.mjs`) showed one 5.9 s task (4x throttled) right after the forecasts arrived, spending about 5 s in `Intl.DateTimeFormat` construction (`pacificDate`, `pacificHour`, and `toLocaleDateString` in the Home week grid and the best-bet code), which ran for every hour of every spot. The formatters are now built once and results memoised (`src/ocean/time.ts`, Welcome, WeekGrid, HomeView, forecast helpers). Also memoised: the provider URLs (`marineURL`/`weatherURL`), the MOP nearshore breaking result per record (`mopBreaking`), and the stale-source lookup is now a set (it was a scan of all entries once per labelled object).
3. **Images and frames.** `Media` already lazy-loads photos with explicit `sizes`/`srcSet`, and the 24 MB of Spin360 frames are not requested on a cold load of the Wave scale (the 3D scene or its first frame loads; the measurement shows 0.7 to 0.9 MB of images there). No change made.

## What did not change, and why
- **LCP stays 10 to 14 s on Home, the Spot page and the Wave scale.** The LCP element is not the first paint: the first paint is a text block at about 1.4 s; the LCP candidate that wins is the best-bet sentence and then the hero photo that appear only after the forecasts for the spots have been fetched and processed (about 8 to 9 s at Slow 4G here). The fan-out is the next lever.
- **The first-load fan-out is 212 `/api` requests, all of them unique** (90 marine and weather for 45 spots, 80 CDIP MOP forecast and issue files for 40 points, 4 for the two extra tide stations, 3 context buoys, and the fixed tide, level, buoy and SF023 files), about 0.8 to 1.0 MB gzip. I did not change it: Home's best-bet pool and Compare/Map rank the whole spot list, and `loadOcean` assembles one bundle from all of them, so splitting it changes what Home can show before the rest arrives (a product decision). Options for a follow-up, in order of risk: (a) fetch the 40 MOP issue (DAS) files after the first render, since only the nearshore panel shows the issue time (80 requests become 40 on the critical path); (b) a two-wave load: saved spots, the selected spot and the region first, the rest next; (c) a server-side bundle endpoint so the browser makes one request.
- **Map got slower to first content when opened directly** (LCP 3.3 s to 4.4 s at 1440, 3.8 s to 5.6 s at 390): the Map chunk is now fetched after the main one. TBT on the Map fell 10x at 1440. A route-aware `modulepreload` for `/explore` would remove it; not done because chunk file names are hashed at build time.

## Checks
tsc, 437 tests, journeys 8/8, t045, t065, t074, t043 pass. t055-one-source times out waiting for `.hd h1` on Home (it also fails on the lead's server; the selector predates product's Home change). t062-live times out waiting for `.live.is-live` on my dev servers, including a clean checkout of the commit before these changes, while it passes on the lead's :5180 server, so it is not caused by this work; the production-build measurement above shows the Wave-scale chunk set loading (9 script requests).
