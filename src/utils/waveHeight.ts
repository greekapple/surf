import type {UserProfile} from '../models/index.ts';
import {heightValue} from './units.ts';
export type WaveMeasurementKind='offshore'|'swell'|'nearshore'|'breaking-estimate'|'breaking-observation'|'simulation'|'demonstration';
export interface WaveHeightInput {kind:WaveMeasurementKind;valueFt:number|null;rangeFt?:[number,number];rangeMethod?:string}
const labels:Record<WaveMeasurementKind,string>={offshore:'Offshore significant wave height',swell:'Swell height',nearshore:'Nearshore modeled significant wave height','breaking-estimate':'Estimated breaking-wave face height','breaking-observation':'Observed breaking-wave face height',simulation:'Hypothetical breaking-wave face height',demonstration:'Demonstration breaking-wave face height'};
/** Presentation only. A point never becomes an interval; range requires explicit breaking evidence and a method. */
export function formatWaveHeight(input:WaveHeightInput,p:UserProfile,precision:'headline'|'technical'='headline'){
 const breaking=['breaking-estimate','breaking-observation','simulation','demonstration'].includes(input.kind),suffix=` ${p.heightUnit}${breaking&&p.scale==='Hawaiian'?' ≈ Hawaiian':''}`,r=input.rangeFt;
 if(r&&['breaking-estimate','breaking-observation'].includes(input.kind)&&input.rangeMethod?.trim()&&r.every(x=>Number.isFinite(x)&&x>=0)&&r[1]>=r[0]){const values=r.map(v=>heightValue(v,p,true)),factor=p.heightUnit==='ft'?1:10,lo=Math.floor(values[0]*factor)/factor,hi=Math.ceil(values[1]*factor)/factor;return {text:`${lo}–${hi}${suffix}`,label:labels[input.kind],representation:'range' as const};}
 if(input.valueFt===null||!Number.isFinite(input.valueFt)||input.valueFt<0)return {text:'Unavailable',label:labels[input.kind],representation:'unavailable' as const};
 const v=heightValue(input.valueFt,p,breaking),factor=p.heightUnit==='ft'?1:10;
 const text=precision==='technical'?`${v.toFixed(1)}${suffix}`:v>0&&v<1/factor?`<${1/factor}${suffix}`:`≈ ${+(Math.round(v*factor)/factor).toFixed(1)}${suffix}`;
 return {text,label:labels[input.kind],representation:'point' as const};
}
export function headlineHeight(ft:number,p:UserProfile,breaking=false){return formatWaveHeight({valueFt:ft,kind:breaking?'breaking-estimate':'offshore'},p).text}
