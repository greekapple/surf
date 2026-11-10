# DRAFT: archive NDBC realtime2 `.spec` daily in the Worker cron (not approved, not wired)
Status: draft for lead and the user. **No code, no wrangler change, no deploy.** From proposal 3 of docs/forecast/RATING-AUDIT-SPLIT.md. Drafted 2026-11-10.

## Why
NDBC keeps realtime2 files for 45 days. The split audit (swell vs wind-sea) could only use a published split for the recent window; every older window had none (California) or a computed one (HI/East). An archive from today means any future window has NDBC's own published `.spec` (SwH, SwP, SwD, WWH, WWP, WWD). `.data_spec` (the spectrum plus NDBC's own Sep_Freq) lets a future audit recompute a split with the same method if the published fields are `MM`.

## Which buoys (54)
The union of what the audits read and what the app shows, NDBC-hosted only (CDIP-only ids such as 029p1, 098p1 and 106p1 have no realtime2 `.spec`):
- **Audit buoys (44):** the split audit (25) and the HI/East audit (38) as read from their JSON, minus 46656.
- **App-only context buoys (10):** 46026, 46012, 46214, 44025, 44085, 44087, 44090, 44097, 44098, 41159.
- By region: California/Pacific NW 9: 46012 46026 46214 46221 46235 46236 46237 46254 46275. Hawaii 6: 51201 51202 51207 51210 51211 51212. US East 39: 41024 41025 41029 41033 41038 41065 41066 41067 41068 41069 41070 41076 41108 41110 41112 41113 41114 41117 41120 41122 41159 44013 44022 44025 44029 44056 44064 44065 44069 44085 44086 44087 44090 44091 44095 44097 44098 44099 44100.
- The list lives in one constant (`ARCHIVE_BUOYS`) generated from src/ocean/buoys.ts plus the audit JSON by a script and checked by a test, so it cannot drift from the app. 41065's `.spec` has MM for every swell field (see the audit); it stays in the list (cheap) and the manifest records "no swell values".
- Not archived: stdmet (`.txt`): the audits already get stdmet history from ERDDAP.

## What is stored
Per buoy per UTC day: the day's rows of `.spec` (header kept) and of `.data_spec`, sliced from the 45-day file by timestamp. A manifest object per run records the retrieval time, rows kept, first and last timestamp, and any failure.

## R2 key layout
```
archive/ndbc/spec/<buoyId>/<YYYY>/<YYYY-MM-DD>.spec.gz
archive/ndbc/data_spec/<buoyId>/<YYYY>/<YYYY-MM-DD>.data_spec.gz
archive/ndbc/_manifest/<YYYY-MM-DD>.json      one per run: [{buoy, file, rows, first, last, bytes, status}]
archive/ndbc/_cursor.json                      backfill cursor (below)
```
- Objects are gzip (`Content-Encoding: gzip`, `Content-Type: text/plain`); the key keeps `.gz` so a download reads correctly outside the Worker.
- Rows are NDBC's lines byte for byte (no reformatting), UTC, so a day slice is exactly the lines whose `YY MM DD` match.
- Prefix `archive/` does not collide with `forecast/v10/...`; R2 lifecycle rules (retention below) can target the prefix.
- Writes are idempotent (same key, same content): a rerun just overwrites.

## Schedule and flow
A second cron trigger, once a day (for example `17 6 * * *`, 06:17 UTC, after the UTC day closed), separate from the 5-minute refresh so it has its own invocation and its own subrequest budget:
1. For each buoy (sequential, about 1 request per second to be polite to NDBC): GET `.spec`, then `.data_spec`; keep the previous 3 UTC days (covers a missed run); PUT each day slice.
2. Write the manifest, add the run to the existing run report (so a failed buoy shows in the same place as a failed refresh).
3. A 404 or an empty file is recorded, not retried that day; a network error retries twice.
**Backfill (one-time):** NDBC still has about 45 days, so the first runs slice every day available. A cursor (`_cursor.json`) lets it resume across invocations so the first fill does not spend more than one invocation's budget.

## Size per day
Measured from today's live files (46026): `.spec` 148 KB for 45 days (2,114 rows) = about 3.3 KB per buoy-day raw (0.5 KB gzip); `.data_spec` 1.41 MB for 45 days = about 31 KB per buoy-day raw (5 KB gzip).
| | per day (54 buoys) | per year |
|---|---|---|
| `.spec` raw / gzip | 180 KB / 27 KB | 65 MB / 10 MB |
| `.data_spec` raw / gzip | 1.7 MB / 270 KB | 620 MB / 100 MB |
Stored gzip: about 110 MB per year in total.

## Limits and cost (checked against the limits as published by Cloudflare; confirm before wiring)
- **Subrequests per invocation:** the project's Worker is on the Paid plan (1,000; worker/cloudflare.mjs counts fetches plus R2 operations and stops before 800). One daily run: 54 buoys x (2 GETs + 2 PUTs, one slice each for 3 days is still one PUT per file if the slices are batched per day: 3 days x 2 x 54 = 324 PUTs) = about 108 GETs + 324 PUTs = **~430 subrequests**, under 800. To lower it: keep only the last day per run (54 x 4 = 216) and rely on the 45-day backfill for gaps (see failure handling).
- **If the plan were Free (50 subrequests per invocation):** it fits only as 54 buoys x 2 (GET + PUT of `.spec`) split over 3 triggers; `.data_spec` would need 6 more. Not recommended; the Paid plan is already required by the refresh cron.
- **CPU and memory:** each file is processed alone (the `.data_spec` is 1.4 MB, parse by line split, never all 54 at once, under the 128 MB isolate limit). Cron invocations allow up to 15 minutes of wall time; politeness delays count as wall time, not CPU.
- **R2 free tier:** 10 GB storage, 1 million Class A (write) and 10 million Class B (read) operations per month, free egress. This design: about 0.1 GB per year, about 10,000 writes per month (324 x 30), a few reads. Cost: $0.
- **NDBC:** public files, no key; one request per second, a descriptive User-Agent without contact details (as the existing fetches do).

## Retention
- Keep everything: about 110 MB per year, 1 percent of the free 10 GB over a decade. No expiry rule initially.
- Review at 2 GB (not expected): R2 lifecycle rule on `archive/ndbc/data_spec/` (expire after N days) while keeping `spec/` forever, because `.spec` is the small published split and the part the audits cannot reproduce.
- Never deleted by the refresh cron: it lists only `forecast/v10/hot/` and writes only under `forecast/`.

## Failure handling
- A missed run: the next run's 3-day window covers 2 missed days; beyond that, the manual backfill (same code with `--days 45`) covers up to 45 days since NDBC still has them. After 45 days of a dead cron the data is gone: the run report shows "last archive day" so Home or the weekly check can alert.
- Header or column change (NDBC has changed these before): the slicer matches by the date columns only and stores lines raw, so a changed header is archived, not lost; the manifest flags a header that differs from the last one seen.
- Partial day: a slice taken before the UTC day closed is rewritten by the next run (idempotent).

## Test plan (before any wiring)
- Unit: slicing by UTC day on a saved real file; idempotent rewrite; gzip round trip; the buoy list equals the generated union; a header change is flagged; a 404 recorded.
- Simulation like hot-cron.test.ts: fake R2 and fake fetcher, 54 buoys, 45-day backfill resumes across invocations, peak subrequests under 800.
- Then one dry run against the real NDBC with a fake R2 (no deploy).

## Decisions needed (user)
1. Archive `.data_spec` too (1.7 MB per day raw), or `.spec` only? Recommended: both; it is 100 MB a year gzip.
2. Wire it as a second cron trigger (needs wrangler config and a deploy, so the user's approval).
3. Start the backfill immediately on the first deploy.
