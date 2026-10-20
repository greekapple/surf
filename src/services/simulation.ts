import type {Forecast} from '../models/index.ts';
export interface SimulationPatch {face?:number;direction?:number;period?:number;windSpeed?:number;windDirection?:number;tideStage?:string}
export function simulateForecast(original:Forecast,p:SimulationPatch):Forecast{
 // Copy every mutable nested object. Never modify provider records or timestamps.
 return {...structuredClone(original),face:p.face??original.face,primary:{...original.primary,direction:p.direction??original.primary.direction,period:p.period??original.primary.period},wind:{...original.wind,speed:p.windSpeed??original.wind.speed,direction:p.windDirection??original.wind.direction,gusts:p.windSpeed===undefined?original.wind.gusts:null},tide:{...original.tide,stage:p.tideStage??original.tide.stage},source:'Simulation — Not Actual Forecast'};
}
