// Build injects the Vite assets into this ESM Worker; React/Vite source remains unchanged.
import {createForecastService} from '../services/forecast-service.mjs';
export function createWorker(assets){const handle=createForecastService({assets});return {fetch:(request,env,ctx)=>handle(request,env,ctx)}}
