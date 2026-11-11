import type {UserProfile} from '../models/index.ts';
export const angle=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180);
export const compass=(d:number)=>['N','NE','E','SE','S','SW','W','NW'][Math.round(d/45)%8];
export const timeLabel=(h:number)=>`${h>12?h-12:h} ${h>=12?'PM':'AM'}`;
export function heightValue(ft:number,p:UserProfile,breaking=true){return ft*(breaking&&p.scale==='Hawaiian'?.5:1)*(p.heightUnit==='m'?.3048:1)}
export const height=(ft:number,p:UserProfile,breaking=true)=>!Number.isFinite(ft)?'Unavailable':`${heightValue(ft,p,breaking).toFixed(1)} ${p.heightUnit}${breaking&&p.scale==='Hawaiian'?' ≈ Hawaiian':''}`;
/** B12: a height range (board ranges, surf estimates, preference ranges) in the user's height unit, no scale conversion: ft keep their own
 *  precision (rounded to whole feet with `whole`), metres one decimal, so 2–6 ft reads 0.6–1.8 m and never collapses to 1–2 m. */
export function heightRange(loFt:number,hiFt:number,p:Pick<UserProfile,'heightUnit'>,whole=false){if(p.heightUnit==='m')return `${(loFt*.3048).toFixed(1)}–${(hiFt*.3048).toFixed(1)} m`;const f=(v:number)=>whole?Math.round(v):+v.toFixed(1);return `${f(loFt)}–${f(hiFt)} ft`}
/** B12: a height stored in feet (the profile's preferred range), shown and edited in the user's unit (metres to one decimal). */
export const toUnit=(ft:number,unit:string)=>unit==='m'?Math.round(ft*.3048*10)/10:ft;
export const fromUnit=(v:number,unit:string)=>unit==='m'?Math.round(v/.3048*10)/10:v;
/** Review P1-1: a board's surf-height range shown like the surf estimate it is compared with: the user's unit AND the Hawaiian scale
 *  (the estimate is halved under Hawaiian, so the ranges are too, and both say so). */
export function surfRange(loFt:number,hiFt:number,p:Pick<UserProfile,'heightUnit'|'scale'>){const h=p.scale==='Hawaiian';const r=heightRange(h?loFt/2:loFt,h?hiFt/2:hiFt,p);return h?`${r} ≈ Hawaiian`:r}
/** B12: a wind speed in the user's wind unit, whole number with the unit. */
export const windWhole=(mph:number,p:Pick<UserProfile,'windUnit'>)=>`${Math.round(mph*(p.windUnit==='kn'?.868976:p.windUnit==='km/h'?1.609344:1))} ${p.windUnit}`;
export const wind=(mph:number,p:UserProfile)=>`${(mph*(p.windUnit==='kn'?.868976:p.windUnit==='km/h'?1.609344:1)).toFixed(1)} ${p.windUnit}`;
export function parseDimension(raw:string,length=false):number {const s=raw.trim().replace(/[”“″]/g,'"').replace(/[’′]/g,"'");if(length&&s.includes("'")){const m=s.match(/^(\d+)\s*'\s*(\d+(?:\.\d+)?)?\s*"?$/);if(!m||+(m[2]||0)>=12)return NaN;return +m[1]*12+ +(m[2]||0)}const cleaned=s.replace(/"$/,'').trim();const m=cleaned.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);if(m){if(+m[3]===0||+m[2]>=+m[3])return NaN;return +(m[1]||0)+ +m[2]/+m[3]}return /^\d+(\.\d+)?$/.test(cleaned)?+cleaned:NaN}
export const lengthLabel=(v:number)=>`${Math.floor(v/12)}′ ${+(v%12).toFixed(2)}″`;
export function validDimensions(length:number,width:number,thickness:number,volume:number){return [length,width,thickness,volume].every(Number.isFinite)&&length>=36&&length<=180&&width>=12&&width<=36&&thickness>=1&&thickness<=6&&volume>=5&&volume<=200&&volume<length*width*thickness*.016387}
