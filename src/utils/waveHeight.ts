import type {UserProfile} from '../models/index.ts';
import {heightValue} from './units.ts';
export type WaveMeasurementKind='offshore'|'swell'|'nearshore'|'breaking-estimate'|'breaking-observation'|'simulation'|'demonstration';
export interface WaveHeightInput {kind:WaveMeasurementKind;valueFt:number|null;rangeFt?:[number,number];rangeMethod?:string}
const labels:Record<WaveMeasurementKind,string>={offshore:'Offshore significant wave height',swell:'Swell height',nearshore:'Nearshore modeled significant wave height','breaking-estimate':'Estimated breaking-wave face height','breaking-observation':'Observed breaking-wave face height',simulation:'Hypothetical breaking-wave face height',demonstration:'Demonstration breaking-wave face height'};
const validRange=(input:WaveHeightInput)=>{const r=input.rangeFt;return !!input.rangeMethod?.trim()&&!!r&&r.length===2&&r.every(x=>Number.isFinite(x)&&x>=0)&&r[1]>=r[0]};
/** A breaking-wave estimate may be shown only as a range with a stated method; anything else is refused. */
export function canPresentBreakingEstimate(input:WaveHeightInput){return input.kind==='breaking-estimate'&&validRange(input)}
/** Nearshore nowcast window: the record nearest `selectedMs`, only if within `toleranceMs` and inside now±24 h. Never extrapolates. */
export function nearestNearshore<T extends {timestamp:string}>(records:T[]|undefined,selectedMs:number,nowMs:number,toleranceMs=1800000):{record:T|null;reason:'ok'|'no-data'|'outside-window'}{
 if(!records?.length)return {record:null,reason:'no-data'};
 if(!Number.isFinite(selectedMs)||!Number.isFinite(nowMs)||Math.abs(selectedMs-nowMs)>86400000)return {record:null,reason:'outside-window'};
 let best:T|null=null,d=Infinity;for(const r of records){const x=Math.abs(Date.parse(r.timestamp)-selectedMs);if(x<d){d=x;best=r}}
 return d<=toleranceMs?{record:best,reason:'ok'}:{record:null,reason:'outside-window'};
}
export type NearshoreView<T>={state:'exact';record:T}|{state:'latest';record:T;hoursBefore:number}|{state:'before-first';first:T}|{state:'gap'}|{state:'outside-window';latest:T|null}|{state:'no-data'};
/** What the nearshore panel may show for the selected hour. 'latest' is never the selected hour's value; it is only offered when the selected hour is after the last record and inside now±24 h. */
export function nearshoreView<T extends {timestamp:string}>(records:T[]|undefined,selectedMs:number,nowMs:number,toleranceMs=1800000):NearshoreView<T>{
 if(!records?.length)return {state:'no-data'};
 const last=records[records.length-1],first=records[0],lastMs=Date.parse(last.timestamp);
 if(!Number.isFinite(selectedMs)||!Number.isFinite(nowMs)||Math.abs(selectedMs-nowMs)>86400000)return {state:'outside-window',latest:last};
 const n=nearestNearshore(records,selectedMs,nowMs,toleranceMs);
 if(n.record)return {state:'exact',record:n.record};
 if(selectedMs<Date.parse(first.timestamp))return {state:'before-first',first};
 if(selectedMs>lastMs)return {state:'latest',record:last,hoursBefore:Math.round((selectedMs-lastMs)/360000)/10};
 return {state:'gap'};
}
/** Presentation only. A point never becomes an interval; range requires explicit breaking evidence and a method. */
export function formatWaveHeight(input:WaveHeightInput,p:UserProfile,precision:'headline'|'technical'='headline'){
 const breaking=['breaking-estimate','breaking-observation','simulation','demonstration'].includes(input.kind),suffix=` ${p.heightUnit}${breaking&&p.scale==='Hawaiian'?' ≈ Hawaiian':''}`,r=input.rangeFt;
 if(input.kind==='breaking-estimate'&&!validRange(input))return {text:'Unavailable',label:labels[input.kind],representation:'unavailable' as const};
 if(r&&['breaking-estimate','breaking-observation'].includes(input.kind)&&validRange(input)){const values=r.map(v=>heightValue(v,p,true)),factor=p.heightUnit==='ft'?1:10,lo=Math.floor(values[0]*factor)/factor,hi=Math.ceil(values[1]*factor)/factor;return {text:`${lo}–${hi}${suffix}`,label:labels[input.kind],representation:'range' as const};}
 if(input.valueFt===null||!Number.isFinite(input.valueFt)||input.valueFt<0)return {text:'Unavailable',label:labels[input.kind],representation:'unavailable' as const};
 const v=heightValue(input.valueFt,p,breaking),factor=p.heightUnit==='ft'?1:10;
 const text=precision==='technical'?`${v.toFixed(1)}${suffix}`:v>0&&v<1/factor?`<${1/factor}${suffix}`:`≈ ${+(Math.round(v*factor)/factor).toFixed(1)}${suffix}`;
 return {text,label:labels[input.kind],representation:'point' as const};
}
export function headlineHeight(ft:number,p:UserProfile,breaking=false){return formatWaveHeight({valueFt:ft,kind:breaking?'breaking-estimate':'offshore'},p).text}
