import type {Forecast} from '../models/index.ts';
import {spots} from '../data/demo.ts';
import {rateForecast} from '../ratings/adapters.ts';
/** Actual supplied hours only. Offshore potential is not a safety or session recommendation. */
export function upcomingWindows(records:Forecast[],now:number,ids:string[],limit=3){
 const valid=records.filter(f=>ids.includes(f.spotId)&&Date.parse(f.timestamp)>=now&&Date.parse(f.timestamp)<=now+48*3600000).map(f=>({forecast:f,rating:rateForecast(spots.find(s=>s.id===f.spotId)!,f,now)})).filter(x=>x.rating.score!==null&&x.rating.score>=55).sort((a,b)=>b.rating.score!-a.rating.score!||Date.parse(a.forecast.timestamp)-Date.parse(b.forecast.timestamp));
 const chosen:typeof valid=[];for(const item of valid){if(chosen.every(x=>Math.abs(Date.parse(x.forecast.timestamp)-Date.parse(item.forecast.timestamp))>=6*3600000)){chosen.push(item);if(chosen.length===limit)break;}}return chosen.sort((a,b)=>Date.parse(a.forecast.timestamp)-Date.parse(b.forecast.timestamp));
}
