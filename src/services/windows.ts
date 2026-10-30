import type {Forecast} from '../models/index.ts';
import {allSpots as spots} from '../data/catalog.ts';
import {rateForecast} from '../ratings/adapters.ts';
/** An hour qualifies for a surf window at this rating score or better. */
export const WINDOW_MIN_SCORE=55;
export interface WindowRange<T>{start:T;end:T;peak:T;peakScore:number;hours:number}
/** Groups supplied hours at one spot into ranges: qualifying (score >= min) hours exactly 1 h apart. A null score, a below-band hour or any gap in the supplied hours ends the range; no hours are invented. Peak is the highest score, earliest on a tie. */
export function windowRanges<T>(hours:T[],at:(h:T)=>{timestamp:string;score:number|null|undefined},min=WINDOW_MIN_SCORE):WindowRange<T>[]{
 const items=hours.map(h=>{const a=at(h);return {h,t:Date.parse(a.timestamp),score:a.score}}).filter(x=>Number.isFinite(x.t)).sort((a,b)=>a.t-b.t);
 const out:WindowRange<T>[]=[];let cur:typeof items=[];
 const flush=()=>{if(cur.length){let pk=cur[0];for(const x of cur)if(x.score!>pk.score!)pk=x;out.push({start:cur[0].h,end:cur[cur.length-1].h,peak:pk.h,peakScore:pk.score!,hours:cur.length});cur=[]}};
 for(const x of items){
  if(typeof x.score!=='number'||!Number.isFinite(x.score)||x.score<min){flush();continue}
  const last=cur[cur.length-1];
  if(last&&x.t===last.t)continue;
  if(last&&x.t-last.t!==3600000)flush();
  cur.push(x);
 }
 flush();return out;
}
/** Actual supplied hours only. Offshore potential is not a safety or session recommendation. */
export function upcomingWindows(records:Forecast[],now:number,ids:string[],limit=3){
 const valid=records.filter(f=>ids.includes(f.spotId)&&Date.parse(f.timestamp)>=now&&Date.parse(f.timestamp)<=now+48*3600000).map(f=>({forecast:f,rating:rateForecast(spots.find(s=>s.id===f.spotId)!,f,now)})).filter(x=>x.rating.score!==null&&x.rating.score>=WINDOW_MIN_SCORE).sort((a,b)=>b.rating.score!-a.rating.score!||Date.parse(a.forecast.timestamp)-Date.parse(b.forecast.timestamp));
 const chosen:typeof valid=[];for(const item of valid){if(chosen.every(x=>Math.abs(Date.parse(x.forecast.timestamp)-Date.parse(item.forecast.timestamp))>=6*3600000)){chosen.push(item);if(chosen.length===limit)break;}}return chosen.sort((a,b)=>Date.parse(a.forecast.timestamp)-Date.parse(b.forecast.timestamp));
}
