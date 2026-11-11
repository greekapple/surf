import type {Forecast,SurfSpot} from '../models/index.ts';
import {calculateSQI} from '../recommendation/sqi.ts';
export function selectRecord(records:Forecast[],spotId:string,day:number,hour:number){return records.find(f=>f.spotId===spotId&&f.day===day&&f.hour===hour)}
/** Audit B4: the demonstration record for a spot-hour, or, for a spot outside the demonstration week (most of the catalogue, e.g. a spot opened from
 *  search before its forecast loads), a complete placeholder with every input marked missing. It used to be `selectRecord(...)!`, which is undefined
 *  for those spots, so the screens got a record without `source` or `timestamp` and the rating code threw (adapters.ts `f.source.includes`). */
export function recordOrPlaceholder(records:Forecast[],spotId:string,day:number,hour:number):Forecast{
 return selectRecord(records,spotId,day,hour)??placeholderRecord(spotId,day,hour);
}
/** Review MEDIUM: the explicit stand-in: `placeholder: true`, source 'none', no timestamp (never one borrowed from a demonstration record), every input missing. */
export function placeholderRecord(spotId:string,day=0,hour=0):Forecast{
 return {spotId,timestamp:'',day,hour,face:NaN,offshore:NaN,primary:{height:NaN,direction:NaN,period:NaN},secondary:null,tertiary:null,wind:{speed:NaN,direction:NaN,gusts:null},tide:{height:NaN,stage:'Unknown'},character:'Unknown',confidence:'Unrated',source:'none',updatedAt:'',model:'none',horizon:0,quality:[],waterTempF:null,issuedAt:'',kind:'prediction',availability:{face:false,swell:false,wind:false,tide:false,organization:false},organization:NaN,placeholder:true};
}
export function dayOutlook(spot:SurfSpot,records:Forecast[]){
 const valid=records.filter(f=>f.availability.face);const qualities=records.map(f=>({forecast:f,sqi:calculateSQI(spot,f)})).filter(x=>x.sqi.score!==null).sort((a,b)=>b.sqi.score!-a.sqi.score!||a.forecast.hour-b.forecast.hour);
 const winds=records.filter(f=>f.availability.wind);
 return {min:valid.length?Math.min(...valid.map(f=>f.face)):null,max:valid.length?Math.max(...valid.map(f=>f.face)):null,best:qualities[0]??null,averageWind:winds.length?winds.reduce((n,f)=>n+f.wind.speed,0)/winds.length:null};
}
