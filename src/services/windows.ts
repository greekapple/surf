import type {Forecast} from '../models/index.ts';
import {allSpots as spots} from '../data/catalog.ts';
import {rateForecast} from '../ratings/adapters.ts';
/** An hour qualifies for a surf window at this rating score or better. */
export const WINDOW_MIN_SCORE=55;
export interface WindowRange<T>{start:T;end:T;peak:T;peakScore:number;hours:number}
/** Groups supplied hours at one spot into ranges: qualifying (score >= min) hours exactly 1 h apart. A null score, a below-band hour or any gap in the supplied hours ends the range; no hours are invented. Peak is the highest score, earliest on a tie. With `within`, a window keeps only hours within that many points of its peak (T-014b); the leftover hours on each side are windowed again around their own peaks. */
export const WINDOW_BAND=10;
export function windowRanges<T>(hours:T[],at:(h:T)=>{timestamp:string;score:number|null|undefined},min=WINDOW_MIN_SCORE,within=Infinity):WindowRange<T>[]{
 const items=hours.map(h=>{const a=at(h);return {h,t:Date.parse(a.timestamp),score:a.score}}).filter(x=>Number.isFinite(x.t)).sort((a,b)=>a.t-b.t);
 const out:WindowRange<T>[]=[];let cur:typeof items=[];
 const emit=(run:typeof items)=>{
  if(!run.length)return;let pi=0;run.forEach((x,i)=>{if(x.score!>run[pi].score!)pi=i});
  const floor=run[pi].score!-within;let lo=pi,hi=pi;while(lo>0&&run[lo-1].score!>=floor)lo--;while(hi<run.length-1&&run[hi+1].score!>=floor)hi++;
  out.push({start:run[lo].h,end:run[hi].h,peak:run[pi].h,peakScore:run[pi].score!,hours:hi-lo+1});emit(run.slice(0,lo));emit(run.slice(hi+1));
 };
 const flush=()=>{emit(cur);cur=[]};
 for(const x of items){
  if(typeof x.score!=='number'||!Number.isFinite(x.score)||x.score<min){flush();continue}
  const last=cur[cur.length-1];
  if(last&&x.t===last.t)continue;
  if(last&&x.t-last.t!==3600000)flush();
  cur.push(x);
 }
 flush();return out.sort((a,b)=>Date.parse((at(a.start).timestamp))-Date.parse(at(b.start).timestamp));
}
/** Actual supplied hours only. Offshore potential is not a safety or session recommendation. */
export function upcomingWindows(records:Forecast[],now:number,ids:string[],limit=3){
 const valid=records.filter(f=>ids.includes(f.spotId)&&Date.parse(f.timestamp)>=now&&Date.parse(f.timestamp)<=now+48*3600000).map(f=>({forecast:f,rating:rateForecast(spots.find(s=>s.id===f.spotId)!,f,now)})).filter(x=>x.rating.score!==null&&x.rating.score>=WINDOW_MIN_SCORE).sort((a,b)=>b.rating.score!-a.rating.score!||Date.parse(a.forecast.timestamp)-Date.parse(b.forecast.timestamp));
 const chosen:typeof valid=[];for(const item of valid){if(chosen.every(x=>Math.abs(Date.parse(x.forecast.timestamp)-Date.parse(item.forecast.timestamp))>=6*3600000)){chosen.push(item);if(chosen.length===limit)break;}}return chosen.sort((a,b)=>Date.parse(a.forecast.timestamp)-Date.parse(b.forecast.timestamp));
}
