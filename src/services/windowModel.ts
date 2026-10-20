import {pacificDate} from '../ocean/time.ts';
import type {Forecast} from '../models/index.ts';
import type {SurfRating} from '../ratings/types.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {spots} from '../data/demo.ts';
export interface SurfWindow {spotId:string;start:string;end:string;samples:Forecast[];ratings:SurfRating[];minimumScore:number;peakScore:number;reliability:string;reasons:string[];changes:string[];limitations:string[]}
/** Groups supplied hourly samples only. Unknown daylight/tide response is never an assumed benefit. */
export function groupWindows(samples:{forecast:Forecast;rating:SurfRating}[],maxGapMs=3600000):SurfWindow[]{
 const groups=new Map<string,typeof samples>();
 for(const item of samples){const id=item.forecast.spotId;if(!groups.has(id))groups.set(id,[]);groups.get(id)!.push(item);}
 const output:SurfWindow[]=[];
 for(const [spotId,values] of groups){let current:typeof samples=[];
  const flush=()=>{if(current.length>=2){const rows=current.map(x=>x.forecast),ratings=current.map(x=>x.rating),first=rows[0],last=rows.at(-1)!,scores=ratings.map(r=>r.score!);const delta=last.wind.speed-first.wind.speed,period=last.primary.period-first.primary.period;
   output.push({spotId,start:first.timestamp,end:last.timestamp,samples:rows,ratings,minimumScore:Math.min(...scores),peakScore:Math.max(...scores),reliability:ratings.some(r=>r.reliability.category==='LIMITED')?'LIMITED':ratings.some(r=>r.reliability.category==='MODERATE')?'MODERATE':ratings[0].reliability.category,reasons:[`${rows.length} consecutive supplied records have offshore potential ≥55.`,`Wind ${Math.min(...rows.map(f=>f.wind.speed)).toFixed(0)}–${Math.max(...rows.map(f=>f.wind.speed)).toFixed(0)} mph; primary periods ${Math.min(...rows.map(f=>f.primary.period)).toFixed(1)}–${Math.max(...rows.map(f=>f.primary.period)).toFixed(1)} s.`],changes:[Math.abs(delta)>=2?`Wind ${delta>0?'strengthens':'eases'} by ${Math.abs(delta).toFixed(0)} mph across these samples.`:'Wind changes by less than 2 mph across these samples.',Math.abs(period)>=1?`Primary swell period ${period>0?'increases':'decreases'} by ${Math.abs(period).toFixed(1)} s.`:'Primary swell period changes by less than 1 s.',first.availability.swell&&last.availability.swell?`Primary swell height ${last.primary.height>first.primary.height?'rises':'falls or holds'} from ${first.primary.height.toFixed(1)} to ${last.primary.height.toFixed(1)} ft offshore.`:'Swell-height trend unavailable.',rows.every(f=>f.availability.tide)?`Regional tide runs ${Math.min(...rows.map(f=>f.tide.height)).toFixed(1)}–${Math.max(...rows.map(f=>f.tide.height)).toFixed(1)} ft; local suitability is unknown.`:'Regional tide missing within this window.'],limitations:['Offshore potential, not verified local surf or a board recommendation.','Daylight has not been evaluated; check local sunrise/sunset.','Local tide response, breaking height and conditions between samples are unknown.']});}current=[];};
  for(const item of [...values].sort((a,b)=>a.forecast.timestamp.localeCompare(b.forecast.timestamp))){const time=Date.parse(item.forecast.timestamp),last=current.at(-1),gap=last?time-Date.parse(last.forecast.timestamp):null;
   if(gap===0)continue;
   const usable=Number.isFinite(time)&&item.rating.score!==null&&item.rating.score>=55&&item.rating.reliability.category!=='INSUFFICIENT';
   if(!usable){flush();continue;}if(gap!==null&&(gap<=0||gap>maxGapMs||pacificDate(item.forecast.timestamp)!==pacificDate(last!.forecast.timestamp)))flush();current.push(item);
  }flush();
 }
 return output.sort((a,b)=>b.minimumScore-a.minimumScore||a.start.localeCompare(b.start));
}
export function forecastWindows(records:Forecast[],now:number,ids:string[],limit=3){
 const samples=records.filter(f=>ids.includes(f.spotId)&&Date.parse(f.timestamp)>=now&&Date.parse(f.timestamp)<=now+48*3600000).map(f=>({forecast:f,rating:rateForecast(spots.find(s=>s.id===f.spotId)!,f,now)})).map(x=>{const stale=x.rating.mode==='retrieved'&&x.rating.sources.some(s=>s.delivery==='saved'||!Number.isFinite(Date.parse(s.retrievedAt))||now-Date.parse(s.retrievedAt)>7200000||Date.parse(s.retrievedAt)>now+300000);return stale?{...x,rating:{...x.rating,score:null}}:x});
 return groupWindows(samples).slice(0,limit).sort((a,b)=>a.start.localeCompare(b.start));
}
