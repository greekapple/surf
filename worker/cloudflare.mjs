// Cloudflare Workers entry (production). The Worker answers /api/* only; every page, photo and model is served by Workers Static Assets
// from .cf/public (scripts/build-cloudflare.mjs), so nothing is embedded in the Worker and nothing licensed is uploaded.
import {createForecastService} from '../services/forecast-service.mjs';
const handle = createForecastService({});
export default {fetch: (request, env, ctx) => handle(request, env, ctx)};
