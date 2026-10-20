import type {Forecast,SurfSpot} from '../models/index.ts';
import {calculateSQI} from '../recommendation/sqi.ts';
export function selectRecord(records:Forecast[],spotId:string,day:number,hour:number){return records.find(f=>f.spotId===spotId&&f.day===day&&f.hour===hour)}
export function dayOutlook(spot:SurfSpot,records:Forecast[]){
 const valid=records.filter(f=>f.availability.face);const qualities=records.map(f=>({forecast:f,sqi:calculateSQI(spot,f)})).filter(x=>x.sqi.score!==null).sort((a,b)=>b.sqi.score!-a.sqi.score!||a.forecast.hour-b.forecast.hour);
 const winds=records.filter(f=>f.availability.wind);
 return {min:valid.length?Math.min(...valid.map(f=>f.face)):null,max:valid.length?Math.max(...valid.map(f=>f.face)):null,best:qualities[0]??null,averageWind:winds.length?winds.reduce((n,f)=>n+f.wind.speed,0)/winds.length:null};
}
