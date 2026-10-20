import type {OceanRecord} from '../ocean/types';
import {pacificDate,pacificHour} from '../ocean/time.ts';

/** An explicit selection is exact: never substitute another spot or hour. */
export function selectedRecord(records:OceanRecord[],spotId:string,instant:string|null,now=Date.now()){
 const matching=records.filter(r=>r.spotId===spotId);
 return instant?matching.find(r=>r.timestamp===instant)??null:matching.find(r=>Date.parse(r.timestamp)>=now)??matching[0]??null;
}
export function recordOnDay(records:OceanRecord[],date:string,hour:number){
 const day=records.filter(r=>pacificDate(r.timestamp)===date);
 return day.find(r=>pacificHour(r.timestamp)===hour)??day[0]??null;
}
export function toggleComparison(ids:string[],id:string,limit:number){return ids.includes(id)?ids.filter(x=>x!==id):ids.length<limit?[...ids,id]:ids;}
export function forecastState(loading:boolean,hasRecord:boolean){return hasRecord?'available':loading?'loading':'unavailable';}
/** Bearings describe the direction FROM; north = 0°, east = 90°. */
export function bearingPoint(degrees:number,radius=32){const radians=degrees*Math.PI/180;return {x:50+radius*Math.sin(radians),y:50-radius*Math.cos(radians)};}
export function availableCompare(a:number|null|undefined,b:number|null|undefined,descending=false){
 if(a==null&&b==null)return 0;if(a==null)return 1;if(b==null)return -1;return descending?b-a:a-b;
}

export function navigationTarget(current:string,next:string,positions:Record<string,number|undefined>,scroll:number,top=false){return {positions:{...positions,[current]:scroll},scroll:top?0:positions[next]??0};}
