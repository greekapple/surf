// Cloudflare Workers entry (production). The Worker answers /api/* only; every page, photo and model is served by Workers Static Assets
// from .cf/public (scripts/build-cloudflare.mjs), so nothing is embedded in the Worker and nothing licensed is uploaded.
import {createForecastService} from '../services/forecast-service.mjs';
const handle = createForecastService({});
// T-129 warm cache. A cron trigger (wrangler.jsonc, every 5 minutes) refreshes the ingestion targets that are due into the R2 bucket, so a visitor after a quiet spell reads a warm bucket instead of waiting on ~265 upstreams.
// T-129b (Codex P1s): (1) refresh-ahead is RELATIVE to each target's TTL (min(40 min, 0.3 x TTL)), so a value retrieved just now is not due on the next run, and Open-Meteo and CDIP THREDDS values are not refetched more than once an hour (their quota and politeness);
// (2) every run has a SUBREQUEST BUDGET: fetches plus R2 operations are counted and the run stops before 800 (the Paid plan allows 1,000 internal subrequests per invocation), so a cold fill of an empty bucket completes over several runs; fresh targets cost one R2 read each, so each run gets further.
// The /api/refresh token path is unchanged (all targets, no budget).
export const CRON = {perRun: 0, everyMs: 300000, aheadMs: 2400000, budget: 800, minAgeMs: (t) => (/open-meteo\.com|thredds\.cdip\.ucsd\.edu/.test(t.url) ? 3600000 : 0)};
export default {
  fetch: (request, env, ctx) => handle(request, env, ctx),
  scheduled: (event, env, ctx) => { ctx.waitUntil(handle.refresh(env, {perRun: CRON.perRun, tick: Math.floor(event.scheduledTime / CRON.everyMs), ahead: CRON.aheadMs, budget: CRON.budget, minAgeMs: CRON.minAgeMs})); },
};
