// Cloudflare Workers entry (production). The Worker answers /api/* only; every page, photo and model is served by Workers Static Assets
// from .cf/public (scripts/build-cloudflare.mjs), so nothing is embedded in the Worker and nothing licensed is uploaded.
import {createForecastService} from '../services/forecast-service.mjs';
import {createNdbcArchive} from '../services/ndbc-archive.mjs';
import {createSurfCapture} from '../services/surf-capture.mjs';
const handle = createForecastService({});
const archive = createNdbcArchive({});
const surfCapture = createSurfCapture({});
// T-129 warm cache. A cron trigger (wrangler.jsonc, every 5 minutes) refreshes the ingestion targets that are due into the R2 bucket, so a visitor after a quiet spell reads a warm bucket instead of waiting on ~265 upstreams.
// T-129b (Codex P1s): (1) refresh-ahead is RELATIVE to each target's TTL (min(40 min, 0.3 x TTL)), so a value retrieved just now is not due on the next run, and Open-Meteo and CDIP THREDDS values are not refetched more than once an hour (their quota and politeness);
// (2) every run has a SUBREQUEST BUDGET: fetches plus R2 operations are counted and the run stops before 800 (the Paid plan allows 1,000 internal subrequests per invocation), so a cold fill of an empty bucket completes over several runs; fresh targets cost one R2 read each, so each run gets further.
// The /api/refresh token path is unchanged (all targets, no budget).
/** hotHours: the cron refreshes the per-spot Open-Meteo targets only for spots a browser requested in the last 24 h (services/forecast-service.mjs touch()); cold spots refresh on demand. */
export const CRON = {perRun: 0, everyMs: 300000, aheadMs: 2400000, budget: 800, hotHours: 24, minAgeMs: (t) => (/open-meteo\.com|thredds\.cdip\.ucsd\.edu/.test(t.url) ? 3600000 : 0)};
// "How right we've been" (services/how-right.mjs, docs/forecast/HOW-RIGHT.md): once a day, on the 5-minute tick at 00:30 UTC (the evening before, Pacific), this run captures
// what we are showing and scores the last 30 days against the buoys INSTEAD of refreshing (about 140 subrequests of its own budget, no Open-Meteo call); the refresh resumes 5 minutes later.
export const HOW_RIGHT_TICK = 6; // tick of the UTC day (288 five-minute ticks a day): 6 = 00:30 UTC
export const isHowRightTick = (scheduledTime) => Math.floor(scheduledTime / CRON.everyMs) % 288 === HOW_RIGHT_TICK;
// NDBC realtime2 archive (services/ndbc-archive.mjs, round 4A): its own cron triggers, so it has its own invocation and subrequest budget and never takes a refresh tick.
// ARCHIVE_CRON runs once a day (06:17 UTC, after the UTC day closed); BACKFILL_CRON are hourly ticks that continue the 45-day backfill after a deploy and are a one-read no-op once it is done.
export const ARCHIVE_CRON = '17 6 * * *';
export const BACKFILL_CRON = '47 * * * *';
// server-captures (services/surf-capture.mjs, docs/forecast/SURF-CAPTURE.md): the same hourly tick first runs the evidence captures (nearshore gauges every hour, NWS surf zone forecasts at 02/08/14/20 UTC, one SWAN slice every hour) into R2, then the NDBC backfill continuation. No fifth cron trigger.
// "How right we've been" for every spot (services/how-right-all.mjs, round 4C): hourly 00:20-06:20 UTC, its own invocations: capture what we show (resumable), then score once.
export const HRA_CRON = '20 0-6 * * *';
export default {
  fetch: (request, env, ctx) => handle(request, env, ctx),
  scheduled: (event, env, ctx) => {
    if (event.cron === HRA_CRON) { ctx.waitUntil(handle.howRightAll(env)); return; }
    if (event.cron === BACKFILL_CRON) { ctx.waitUntil((async () => { try { await surfCapture.run(env, event.scheduledTime); } catch { /* the captures never block the NDBC continuation */ } await archive.run(env, {backfillOnly: true}); })()); return; }
    if (event.cron === ARCHIVE_CRON) { ctx.waitUntil(archive.run(env, {backfillOnly: false})); return; }
    if (isHowRightTick(event.scheduledTime)) { ctx.waitUntil(handle.howRight(env)); return; }
    ctx.waitUntil(handle.refresh(env, {perRun: CRON.perRun, tick: Math.floor(event.scheduledTime / CRON.everyMs), ahead: CRON.aheadMs, budget: CRON.budget, minAgeMs: CRON.minAgeMs, hotHours: CRON.hotHours}));
  },
};
