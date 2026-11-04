// Cloudflare Workers entry (production). The Worker answers /api/* only; every page, photo and model is served by Workers Static Assets
// from .cf/public (scripts/build-cloudflare.mjs), so nothing is embedded in the Worker and nothing licensed is uploaded.
import {createForecastService} from '../services/forecast-service.mjs';
const handle = createForecastService({});
// T-129 warm cache. A cron trigger (wrangler.jsonc, every 5 minutes) refreshes every ingestion target that is due into the R2 bucket, so a visitor after a quiet spell reads a warm bucket
// instead of waiting on ~265 upstreams. Sized for the Workers Paid plan (30 s CPU and 1000 subrequests per run; the free plan's 50 subrequests and 10 ms could only take a rotating slice: set perRun to e.g. 24 to go back).
// Refresh-ahead: a target is refetched when it would expire within 40 minutes, and the service's conditional requests (ETag, If-Modified-Since) make unchanged data a cheap 304. The /api/refresh token path is unchanged.
export const CRON = {perRun: 0, everyMs: 300000, aheadMs: 2400000};
export default {
  fetch: (request, env, ctx) => handle(request, env, ctx),
  scheduled: (event, env, ctx) => { ctx.waitUntil(handle.refresh(env, {perRun: CRON.perRun, tick: Math.floor(event.scheduledTime / CRON.everyMs), ahead: CRON.aheadMs})); },
};
