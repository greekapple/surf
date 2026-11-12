# Server captures: nearshore gauges, NWS surf zone forecasts, Hawaii SWAN (server-captures)

Three keyless evidence captures run in the Worker and write to R2 (`swello-forecast-cache`, binding `BUCKET`). They exist so the surf-height work (nearshore gauge How-right checks, NWS SRF as a comparison, SWAN against the Hawaii buoys) has a record that does not depend on one laptop being awake. **Nothing here is shown in the app.** Code: `services/surf-capture.mjs` (+ generated `services/swan-capture-cells.mjs`); tests: `src/tests/surf-capture.test.ts`. The Duck FRF data is private-use only and is not captured here (it stays in the local capture).

## Where the data lives (all under `archive/`, same bucket as the NDBC archive)
```
archive/surf-height/gauges/<station>/<YYYY-MM-DD>/<HH>.txt      NDBC realtime2 .txt rows of that UTC hour, byte for byte, with NDBC's two header lines
archive/surf-height/gauges/<station>/<YYYY-MM-DD>/<HH>.spec     the same for .spec
archive/surf-height/srf/<OFFICE>/<product id>.json              an NWS Surf Zone Forecast product exactly as api.weather.gov returned it
archive/surf-height/srf/_seen.json                              the de-dup index: ids already stored per office (newest 300)
archive/surf-height/_status-gauges.json, _status-srf.json       the last run of each job (per station / per office result, subrequests used)
archive/swan/<YYYY-MM-DD>/swan-<HH>.json.gz                     one SWAN slice (about 35 cells): rows as ERDDAP returned them, from 6 h before the capture through the whole forecast; gzip
archive/swan/<YYYY-MM-DD>/cdip-<106|098>-<HH>.csv               CDIP Hawaii buoys, last 6 h, as THREDDS returned them (hour with slice 0 only)
archive/swan/_status.json                                       the last slice's result
```
- **Gauges** (LJPC1, 46254, 46266, 46274, 46285, 46268, 46286, 41115, 41121, 51211, 44056): every hour at :47 UTC the rows of the **previous complete UTC hour** are written (10 or 30 minute rows, a few hundred bytes). A station file with no row for that hour, a 404 or an outage is recorded in `_status-gauges.json` and nothing is written for it (no empty or invented object). A missed run leaves a one-hour gap: NDBC keeps 45 days, so the local `.txt` can refill it later.
- **SRF** (BOX BRO CAR CRP EKA GUM HFO JAX LOX MFL MFR MLB MOB MTR PQR SGX SJU TAE TBW): at 02, 08, 14 and 20 UTC each office's product list (`/products/types/SRF/locations/<office>`, about a week, 70 to 100 products) is read and every id not in `_seen.json` is fetched and stored once. An id is added to the index only after its object was written, so a failed or out-of-budget product is taken next run. The first run starts at a rotating office and takes up to 30 products an office; the first week's backlog (about 1,300 products) drains over the first 3 to 4 days.
- **SWAN** (104 cells shared by the 120 Hawaii spots of `src/ocean/swanPointsSourced.ts`, the same cells and buoys as `scripts/swan-capture-local.mjs`): cell i of the list is in slice i mod 3, and the slice is `UTC hour mod 3`, so every cell is captured every 3 h and one invocation makes about 35 requests (slice 0 adds the two CDIP buoys). One request a second across the whole invocation.
- **Politeness:** keyless, `User-Agent: SWELLO surf forecast prototype`, one request per second, one retry on a network error or 5xx, a 404 is recorded not retried.

## Cron
No new trigger. `47 * * * *` (`BACKFILL_CRON` in `worker/cloudflare.mjs`) runs the captures for the scheduled hour, then the NDBC backfill continuation (a one-read no-op once done) exactly as before. A job that throws is recorded and does not stop the next one. Per-invocation budgets (fetches + R2 operations, each job counts its own): gauges 48 (uses 45), SWAN 80 (uses about 37, 41 in slice 0), SRF 200 (19 lists + index read and write + 2 per new product). Worst hour (02/08/14/20 UTC): about 290 operations in total, the same convention as the other archive jobs (800 per job).

## Cost estimate (stays inside the free tiers: R2 10 GB-month storage, 1 M Class A and 10 M Class B operations a month)
| | R2 writes a month (Class A) | stored a month |
|---|---|---|
| gauges | 23 an hour = 16,600 | 22 objects an hour at about 250 B = 4 MB |
| SRF | about 76 products a day + 8 = 2,500 (+ about 1,300 once for the first week) | about 76 x 7.7 KB = 18 MB |
| SWAN | 2 an hour (+ 2 CDIP every 3 h) = 1,700 | 24 slices a day x 48 KB (gzip of 382 KB, measured) = 35 MB, CDIP 2 x 1.1 KB every 3 h |
| **total** | **about 21,000 = 2 % of the free 1 M** | **about 57 MB a month, 0.7 GB a year** |
Reads (Class B): the SRF index, 4 a day. Egress is free. With the NDBC archive (about 0.11 GB a year) the year-one total is about 0.8 GB of the free 10 GB: no lifecycle rule is set (like the NDBC archive); look again at 6 GB. No new Worker invocations (the hourly trigger already existed) and no new cron trigger, so no cost on the Workers side either.
Measured on live endpoints 2026-11-11 (fake bucket, real NDBC, NWS, ERDDAP and THREDDS): 3 gauges 6 objects 1.5 KB; MTR 80 products 621 KB; a SWAN slice 35 cells + 2 buoys 48 KB gzip.

## After the deploy (lead, with wrangler)
- `npx wrangler r2 object get swello-forecast-cache/archive/surf-height/_status-gauges.json --remote --pipe`: `hour` is the previous UTC hour, `failures` mostly 0 (some stations have no `.spec`: recorded as 404).
- `.../archive/surf-height/_status-srf.json` after 02, 08, 14 or 20 UTC; `.../archive/swan/_status.json` every hour.
- Keep the local SWAN capture (`scripts/swan-capture-local.mjs`) running until the R2 objects of one full day (24 `swan-<HH>.json.gz`) exist.

## SRF serving is serve-first (production fix, 2026-11-12)
Each SRF run first serves the NEWEST product of EVERY office (phase A: one list read per office; where the newest listed product is newer than the one served, one product read, the serve put and the archive put: about 77 operations for 19 offices), and only then drains the archival backlog with the rest of the budget (phase B, which never writes a serve key). The 02:47Z run drained the first offices' backlog and ran out before MLB..TBW (no serve key) and its serve put for MFR was refused by the closing-write reserve ("serve put failed"). The index remembers `served` (id, issuedAt) per office so the key only moves forward, and an unreadable newest product (`unparsed`) is not read again every run.
