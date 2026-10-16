import type {Forecast,SurfSpot} from '../models/index.ts';
import {forecasts} from '../data/demo.ts';
export interface RawMarineInput {source:string; timestamp:string; updatedAt:string; model:string|null; horizon:number|null; offshoreHeight:number|null; quality:string[]}
export interface ForecastProvider {getForecasts(spot:SurfSpot):Promise<Forecast[]>}
export const demoProvider:ForecastProvider={async getForecasts(spot){return forecasts.filter(f=>f.spotId===spot.id)}};
// Future adapters must distinguish offshore inputs from calibrated breaking-wave estimates.
