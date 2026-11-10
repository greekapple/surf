# NDBC realtime2 archive (round 4A)

NDBC deletes realtime2 files after 45 days. From the first run on, every UTC day of each buoy's `.spec` (NDBC's own swell / wind-sea split: SwH, SwP, SwD, WWH, WWP, WWD) and `.data_spec` (the spectrum and NDBC's Sep_Freq) is kept in R2, so a later audit has the published split for any window. Design and sizes: `docs/specs/DRAFT-spec-archive.md` (branch `spec-archive-draft`); code: `services/ndbc-archive.mjs`; tests: `src/tests/ndbc-archive.test.ts`.

## What it does
- **73 buoys** (`ARCHIVE_BUOYS`): the NDBC-hosted union of the split audit, the HI/East audit (minus 46656) and the app's context buoys, plus the 19 California buoys of the west-ca batch (2026-11-10). A test fails if an NDBC context buoy is missing. 41065's `.data_spec` is a 404 (recorded, not retried); its `.spec` has MM for every swell field (kept, the manifest says "no swell values").
- **Layout** (R2 bucket `swello-forecast-cache`, no lifecycle rule; about 110 MB a year gzip):
  ```
  archive/ndbc/spec/<buoy>/<YYYY>/<YYYY-MM-DD>.spec.gz
  archive/ndbc/data_spec/<buoy>/<YYYY>/<YYYY-MM-DD>.data_spec.gz
  archive/ndbc/_manifest/<YYYY-MM-DD>.json   runs of that UTC day: per buoy and file: status, days, rows, first, last, bytes, headerChanged, note
  archive/ndbc/_cursor.json                  backfill cursor, last header hash per file kind, lastDay
  archive/ndbc/_status.json                  the last run's short report (lastArchiveDay, failures)
  ```
  Objects are gzip (`Content-Encoding: gzip`, `Content-Type: text/plain`). Rows are NDBC's lines byte for byte with the two header lines; a day is the lines whose `YY MM DD` columns match (UTC). Writes are idempotent (same key, same bytes).
- **Cron triggers** (`wrangler.jsonc`, `worker/cloudflare.mjs`): `17 6 * * *` is the daily run (the previous 3 complete UTC days, covers 2 missed runs; today is left out as partial). `47 * * * *` (hourly) only continues the one-time 45-day backfill and is a one-read no-op once `_cursor.json` says `done`. The archive has its own invocation and its own 800-subrequest budget; the 5-minute refresh is untouched.
- **Backfill:** the first run creates the cursor and slices every day NDBC still holds (45 days, the oldest partial). The cursor is a buoy index, so an invocation takes as many whole buoys as fit the budget (about 8: 2 GETs + 90 PUTs each) and resumes at the next tick: 7 invocations, so the backfill is done about 6 hours after the deploy.
- **Budget (tested with 73 simulated buoys):** backfill invocations use 757 operations (fetches + R2) at most (the room check keeps 94 + 6 in hand per buoy), 10 invocations for 73 buoys; a daily run is 589 operations (146 GETs); a daily run uses 437 (108 GETs, 324 PUTs, 5 for cursor, manifest and status).
- **Politeness:** one GET per second, generic User-Agent, a 404 or empty file is recorded and not retried, a network or HTTP error retries twice.
- **Header change** (NDBC has changed these before): the slicer matches only the date columns and stores lines raw, so a changed header is archived and the manifest entry gets `headerChanged: true`.

## Failure handling (review round)
- **Nothing is lost when a buoy fails.** The backfill cursor moves on, but a buoy whose files did not end terminally (http error, network error, budget, put failed) goes on `cursor.backfill.retry` with its attempt count and last status. Once the main pass is over each tick retries them (not in the invocation they failed in). `done` is set only when the list is empty. A buoy still failing after 12 tries moves to `cursor.backfill.abandoned` (shown in `_status.json`), so a permanent fault cannot block `done` forever, and never disappears silently. A 404 and an empty file are terminal.
- **A failed R2 read is not "no cursor".** A thrown read aborts the run before any fetch or write (`{ok: false}`); only a missing key starts a fresh backfill. A manifest read that throws sends this run to its own `_manifest/<day>.run-<hhmmss>.json` instead of overwriting the day's earlier runs.
- **A partial copy never replaces a fuller one.** Each object carries `customMetadata` `{rows, first, last, partial}`. The first day of an NDBC file (the oldest of the 45-day window, or after a reset) is usually partial: it is marked `partial` in the manifest (`partialDays`) and a `head` of the existing copy decides: if the stored copy has more rows, the write is skipped (`keptLarger`). Later complete copies replace a partial one.
- **Run deadline:** a run stops starting new buoys after 10 minutes (`stoppedBy: deadline` in manifest and status) and still writes manifest, cursor and status; the cursor stays at the first buoy not done.
- **missingDays:** an `ok` file that lacks a day between its oldest wanted day and yesterday (an NDBC outage) gets `missingDays` in the manifest entry.
- A gzip failure is a recorded `put failed`, not a crashed run.

## Local run against live NDBC (2026-11-10, no deploy)
`node scripts/archive-ndbc-local.mjs <dir> --buoys 46026,51201` wrote 183 objects, 466 KB: 45 days of `.spec` and `.data_spec` for each buoy (2026-09-26 to 2026-11-09, 46026 2,102 rows, 51201 2,159 spec rows and 1,080 data_spec rows), the manifest, cursor and status. The 51201 slice for 2026-11-09 (48 rows) is byte-identical to the live file's lines for that day.

## After the deploy (lead, with wrangler)
- `npx wrangler r2 object get swello-forecast-cache/archive/ndbc/_cursor.json --remote --pipe`: `backfill.next` rises each hour until `done: true` (about 7 invocations).
- `.../archive/ndbc/_manifest/<today UTC>.json` exists; every buoy has `spec` and `data_spec` entries.
- `.../archive/ndbc/_status.json`: `lastArchiveDay` is yesterday (UTC) once the daily run has happened.
